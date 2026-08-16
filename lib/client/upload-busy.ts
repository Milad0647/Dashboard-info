/**
 * Tracks in-flight uploads so session expiry / recovery can avoid
 * interrupting the user mid-transfer.
 */

let busyCount = 0;

export function beginUploadBusy(): void {
  busyCount += 1;
}

export function endUploadBusy(): void {
  busyCount = Math.max(0, busyCount - 1);
}

export function isUploadBusy(): boolean {
  return busyCount > 0;
}

/** Run an upload while marking the panel as busy. */
export async function withUploadBusy<T>(fn: () => Promise<T>): Promise<T> {
  beginUploadBusy();
  try {
    return await fn();
  } finally {
    endUploadBusy();
  }
}
