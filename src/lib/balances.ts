import type { Roommate, Expense } from "@/lib/database.types";

/**
 * The only place "who owes whom" is computed. A future payments
 * integration should read from this output rather than recomputing
 * balances elsewhere.
 *
 * v1 rule (confirmed): every expense ever logged, one-time or
 * recurring, is split equally across all currently-approved
 * roommates. This is a lifetime running total, not a monthly reset —
 * a recurring row counts once, regardless of how many months it's
 * been standing.
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
  expenses: Expense[],
): RoommateBalance[] {
  if (roommates.length === 0) return [];

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const fairShare = total / roommates.length;

  return roommates.map((roommate) => {
    const paid = expenses
      .filter((e) => e.paid_by === roommate.id)
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      roommateId: roommate.id,
      name: roommate.name,
      paid,
      fairShare,
      balance: paid - fairShare,
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
