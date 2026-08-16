import type { Roommate, ExpenseWithParticipants, Payment } from "@/lib/database.types";

/**
 * The only place "who owes whom" is computed. Payments are recorded
 * here directly (see the `payments` term below) — the deferred seam is
 * real payment *execution* (Stripe, Venmo links, etc.), not recording
 * that one already happened.
 *
 * v1 rule (confirmed): every expense ever logged, one-time or
 * recurring, is split equally across its own participant set — not
 * the whole household — pulled from expense_participants (rows with
 * opted_out=false). This is a lifetime running total, not a monthly
 * reset. "Paid" is always the full amount regardless of whether the
 * payer is themselves a participant; "fair share" only accrues for
 * expenses a roommate is actually a participant in. A roommate absent
 * from an expense's participant rows entirely (e.g. joined the
 * household after it was posted) owes nothing on it, same as if they
 * had opted out.
 *
 * Payments (confirmed): person-to-person, not tied to a specific
 * expense, one-sided and immediate (no recipient confirmation step —
 * same trust model expenses already use). A payment from A to B moves
 * A's balance up and B's balance down by the amount, on top of
 * whatever the expense math already produced — this is what lets a
 * payment bring a balance back toward (or past) zero.
 */
export interface RoommateBalance {
  roommateId: string;
  name: string;
  paid: number;
  fairShare: number;
  /** Positive: the household owes them. Negative: they owe the household. */
  balance: number;
}

export function calculateBalances(
  roommates: Roommate[],
  expenses: ExpenseWithParticipants[],
  payments: Payment[],
): RoommateBalance[] {
  if (roommates.length === 0) return [];

  const paidByRoommate = new Map<string, number>();
  const fairShareByRoommate = new Map<string, number>();

  for (const expense of expenses) {
    paidByRoommate.set(
      expense.paid_by,
      (paidByRoommate.get(expense.paid_by) ?? 0) + expense.amount,
    );

    const participantIds = expense.expense_participants
      .filter((p) => !p.opted_out)
      .map((p) => p.roommate_id);

    // Shouldn't happen — the payer is always seeded as a participant and
    // can't opt out of their own expense — but guard divide-by-zero.
    if (participantIds.length === 0) continue;

    const share = expense.amount / participantIds.length;
    for (const roommateId of participantIds) {
      fairShareByRoommate.set(roommateId, (fairShareByRoommate.get(roommateId) ?? 0) + share);
    }
  }

  const paymentAdjustment = new Map<string, number>();
  for (const payment of payments) {
    paymentAdjustment.set(
      payment.from_roommate_id,
      (paymentAdjustment.get(payment.from_roommate_id) ?? 0) + payment.amount,
    );
    paymentAdjustment.set(
      payment.to_roommate_id,
      (paymentAdjustment.get(payment.to_roommate_id) ?? 0) - payment.amount,
    );
  }

  return roommates.map((roommate) => {
    const paid = paidByRoommate.get(roommate.id) ?? 0;
    const fairShare = fairShareByRoommate.get(roommate.id) ?? 0;
    const adjustment = paymentAdjustment.get(roommate.id) ?? 0;

    return {
      roommateId: roommate.id,
      name: roommate.name,
      paid,
      fairShare,
      balance: paid - fairShare + adjustment,
    };
  });
}

export interface Settlement {
  fromRoommateId: string;
  fromName: string;
  toRoommateId: string;
  toName: string;
  amount: number;
}

// Balances under a cent are treated as settled — avoids floating point
// noise (e.g. 0.0000000001) from being reported as a real debt.
const SETTLED_EPSILON = 0.005;

/**
 * Turns net balances into an actual payout plan: who pays whom, how much.
 * Greedily matches the largest debtor against the largest creditor each
 * round (same heuristic Splitwise uses) to keep the transaction count
 * small. This does not guarantee the mathematically fewest possible
 * transactions — that's a harder problem — but it's a good approximation
 * and simple to reason about.
 */
export function calculateSettlements(balances: RoommateBalance[]): Settlement[] {
  const remaining = balances
    .filter((b) => Math.abs(b.balance) > SETTLED_EPSILON)
    .map((b) => ({ roommateId: b.roommateId, name: b.name, balance: b.balance }));

  const settlements: Settlement[] = [];

  while (true) {
    let debtorIdx = -1;
    let creditorIdx = -1;

    for (let i = 0; i < remaining.length; i++) {
      const b = remaining[i].balance;
      if (b < -SETTLED_EPSILON && (debtorIdx === -1 || b < remaining[debtorIdx].balance)) {
        debtorIdx = i;
      }
      if (b > SETTLED_EPSILON && (creditorIdx === -1 || b > remaining[creditorIdx].balance)) {
        creditorIdx = i;
      }
    }

    if (debtorIdx === -1 || creditorIdx === -1) break;

    const debtor = remaining[debtorIdx];
    const creditor = remaining[creditorIdx];
    const amount = Math.min(-debtor.balance, creditor.balance);

    settlements.push({
      fromRoommateId: debtor.roommateId,
      fromName: debtor.name,
      toRoommateId: creditor.roommateId,
      toName: creditor.name,
      amount: Math.round(amount * 100) / 100,
    });

    debtor.balance += amount;
    creditor.balance -= amount;
  }

  return settlements;
}
