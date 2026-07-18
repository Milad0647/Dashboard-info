import { formatBillboardLocationLine } from "@/lib/billboard-location";
import { getBillboardCardImage } from "@/lib/billboard-media";
import { getBillboardDateLabel } from "@/lib/billboards";
import type { Billboard } from "@/lib/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildBillboardMapTooltipHtml(billboard: Billboard): string {
  const imageUrl = escapeHtml(getBillboardCardImage(billboard));
  const title = escapeHtml(billboard.title);
  const location = escapeHtml(formatBillboardLocationLine(billboard));
  const dateLabel = getBillboardDateLabel(billboard);
  const code = billboard.code?.trim() ? escapeHtml(billboard.code.trim()) : "";

  return `
    <div class="billboard-map-tooltip-content">
      <img src="${imageUrl}" alt="${title}" loading="lazy" />
      <div class="meta">
        <strong>${title}</strong>
        ${code ? `<div class="muted">${code}</div>` : ""}
        <div class="muted">${location}</div>
        ${dateLabel ? `<div class="muted">${escapeHtml(dateLabel)}</div>` : ""}
      </div>
    </div>
  `;
}
