/** Global lock so only the mandatory directive ack gate can be open in the admin panel. */

export const ADMIN_MODAL_LOCK_EVENT = "admin-modal-lock-changed";

export type AdminModalLockDetail = {
  locked: boolean;
  reason?: "directive-ack";
};

const LOCK_ATTR = "data-admin-modal-lock";

let locked = false;

export function isAdminModalLocked(): boolean {
  return locked;
}

export function emitAdminModalLock(
  nextLocked: boolean,
  reason: AdminModalLockDetail["reason"] = "directive-ack"
) {
  if (typeof window === "undefined") return;
  locked = nextLocked;

  try {
    if (nextLocked) {
      document.documentElement.setAttribute(LOCK_ATTR, reason ?? "1");
    } else {
      document.documentElement.removeAttribute(LOCK_ATTR);
    }
  } catch {
    // Ignore DOM write failures.
  }

  const detail: AdminModalLockDetail = { locked: nextLocked, reason };
  window.dispatchEvent(new CustomEvent(ADMIN_MODAL_LOCK_EVENT, { detail }));
}

export function subscribeAdminModalLock(listener: (locked: boolean) => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onEvent = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const value = event.detail?.locked;
    if (typeof value === "boolean") listener(value);
  };

  window.addEventListener(ADMIN_MODAL_LOCK_EVENT, onEvent);
  return () => window.removeEventListener(ADMIN_MODAL_LOCK_EVENT, onEvent);
}
