"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { formatBillboardLocationLine } from "@/lib/billboard-location";
import { getBillboardDateLabel, hasBillboardCoordinates } from "@/lib/billboards";
import { addLeafletTileLayer } from "@/lib/leaflet-tiles";
import type { Billboard } from "@/lib/types";

interface BillboardMapProps {
  billboards: Billboard[];
  onSelect: (billboard: Billboard) => void;
}

export function BillboardMap({ billboards, onSelect }: BillboardMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const mappableBillboards = billboards.filter(hasBillboardCoordinates);

  useEffect(() => {
    if (!containerRef.current || mappableBillboards.length === 0) return;

    let disposed = false;

    void import("leaflet").then((leafletModule) => {
      if (disposed || !containerRef.current) return;

      const L = leafletModule.default;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const first = mappableBillboards[0];
      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
      }).setView([first.latitude!, first.longitude!], 12);

      addLeafletTileLayer(L, map);

      mappableBillboards.forEach((billboard) => {
        const marker = L.circleMarker([billboard.latitude!, billboard.longitude!], {
          radius: 8,
          color: "#2563eb",
          weight: 2,
          fillColor: "#2563eb",
          fillOpacity: 0.85,
        });

        marker.bindTooltip(
          `<strong>${billboard.title}</strong><br/>${formatBillboardLocationLine(billboard)}${
            getBillboardDateLabel(billboard) ? `<br/>${getBillboardDateLabel(billboard)}` : ""
          }`,
          { direction: "top", opacity: 0.95 }
        );

        marker.on("click", () => onSelectRef.current(billboard));
        marker.addTo(map);
      });

      if (mappableBillboards.length > 1) {
        const bounds = L.latLngBounds(
          mappableBillboards.map((billboard) => [billboard.latitude!, billboard.longitude!])
        );
        map.fitBounds(bounds, { padding: [32, 32] });
      }

      mapRef.current = map;
    });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mappableBillboards]);

  if (mappableBillboards.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        موقعیت جغرافیایی برای نمایش روی نقشه موجود نیست.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div ref={containerRef} className="h-[420px] w-full" />
    </div>
  );
}
