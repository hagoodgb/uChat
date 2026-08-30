// crypto.randomUUID() is part of the Web Crypto API, which browsers only
// expose in "secure contexts" — HTTPS, or the special-cased localhost. This
// app is meant to be reachable over plain HTTP from other machines on a
// LAN, and that's NOT a secure context, so crypto.randomUUID is undefined
// there even though it works fine on the host machine itself. These ids are
// only ever used as short-lived client-side correlation keys (matched up
// with the real database id once a save/generation completes), so they
// don't need cryptographic randomness — just uniqueness within a session.
export function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through to the manual generator below
    }
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
