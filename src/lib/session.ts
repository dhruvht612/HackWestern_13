import { useSyncExternalStore } from "react";
import type { AuthSession } from "./types";

// ponytail: tokens in localStorage keep the session across reloads; move to httpOnly cookies
// behind a backend session endpoint if XSS exposure of the token becomes a concern.
const KEY = "shadowscope.session";
const LEGACY_KEY = "attacksurface.session"; // pre-rename; moved to KEY on first read
const listeners = new Set<() => void>();
let cached: AuthSession | null | undefined;

function read(): AuthSession | null {
  if (cached !== undefined) return cached;
  try {
    let raw = localStorage.getItem(KEY);
    const legacy = raw ? null : localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      localStorage.setItem(KEY, legacy);
      localStorage.removeItem(LEGACY_KEY);
      raw = legacy;
    }
    cached = raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export const session = {
  get: read,
  set(value: AuthSession | null) {
    cached = value;
    try {
      if (value) localStorage.setItem(KEY, JSON.stringify(value));
      else localStorage.removeItem(KEY);
    } catch {
      // storage unavailable (private mode): session lives for this tab only
    }
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useSession(): AuthSession | null {
  return useSyncExternalStore(session.subscribe, read, () => null);
}
