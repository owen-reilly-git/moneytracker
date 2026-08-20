// Venmo handoff only — this never talks to Venmo's API, never
// authenticates, and never moves money. It just builds a venmo.com
// universal link pre-filled with the recipient's public handle, an
// amount, and a note; the OS opens the recipient's own already-logged-in
// Venmo app (or venmo.com on desktop) and the user confirms the payment
// themselves. Venmo's amount pre-fill is best-effort on their end, not
// guaranteed — always show the amount in the UI too, not just the link.

export function buildVenmoUrl(params: { handle: string; amount: number; note: string }): string {
  const handle = params.handle.trim().replace(/^@/, "");
  const amount = params.amount.toFixed(2);
  const note = encodeURIComponent(params.note);
  return `https://venmo.com/${encodeURIComponent(handle)}?txn=pay&amount=${amount}&note=${note}`;
}

function isMobile(): boolean {
  return /iphone|ipad|ipod|android/i.test(window.navigator.userAgent.toLowerCase());
}

// Same-window navigation on mobile — more reliable than window.open for
// triggering the OS-level app handoff, and a standalone installed PWA
// (how this app is mostly used) doesn't reliably support spawning a new
// tab anyway. New tab on desktop, so the dashboard stays open.
export function openVenmoLink(url: string) {
  if (isMobile()) {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
