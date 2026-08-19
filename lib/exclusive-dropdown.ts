export const EXCLUSIVE_DROPDOWN_EVENT = "dashboard:exclusive-dropdown-open";

export function announceExclusiveDropdown(id: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EXCLUSIVE_DROPDOWN_EVENT, { detail: id }));
}
