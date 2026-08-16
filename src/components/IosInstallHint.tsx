"use client";

import { useState, useSyncExternalStore } from "react";

const DISMISSED_KEY = "ios-install-hint-dismissed";

function subscribe() {
  return () => {};
}

// iOS gives no automatic install prompt (unlike Android), so this banner
// is the only nudge users get toward Share -> Add to Home Screen. Only
// eligible on iOS Safari, not already installed, and not dismissed.
function getEligibleSnapshot() {
  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari-specific flag — not in the standard lib.dom types.
    (window.navigator as { standalone?: boolean }).standalone === true;
  const dismissed = localStorage.getItem(DISMISSED_KEY) !== null;
  return isIos && !isStandalone && !dismissed;
}

function getServerSnapshot() {
  return false;
}

export default function IosInstallHint() {
  const eligible = useSyncExternalStore(subscribe, getEligibleSnapshot, getServerSnapshot);
  const [dismissed, setDismissed] = useState(false);

  if (!eligible || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-gray-200 bg-white p-3 text-sm shadow-lg">
      <p>
        Install this app: tap <span className="font-medium">Share</span>, then{" "}
        <span className="font-medium">Add to Home Screen</span>.
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISSED_KEY, "1");
          setDismissed(true);
        }}
        aria-label="Dismiss"
        className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs"
      >
        ✕
      </button>
    </div>
  );
}
