"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { configureLeafletDefaultIcon } from "@/lib/leaflet-default-icon";
import { addLeafletTileLayer } from "@/lib/leaflet-tiles";

interface BillboardLocationMapPickerProps {
  latitude: number;
  longitude: number;
  mapCenter?: { lat: number; lng: number; revision?: number } | null;
  onChange: (coords: { latitude: number; longitude: number }) => void;
  /** Fired only when the user clicks the map or finishes dragging the marker. */
  onUserPick?: (coords: { latitude: number; longitude: number }) => void;
}

export function BillboardLocationMapPicker({
  latitude,
  longitude,
  mapCenter = null,
  onChange,
  onUserPick,
}: BillboardLocationMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const onUserPickRef = useRef(onUserPick);
  const pendingCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const skipCoordsSyncRef = useRef(false);
  onChangeRef.current = onChange;
  onUserPickRef.current = onUserPick;

  const mapCenterRef = useRef(mapCenter);
  mapCenterRef.current = mapCenter;

  const applyMapCenter = (center: { lat: number; lng: number }) => {
    if (!mapRef.current || !markerRef.current) {
      pendingCenterRef.current = center;
      return;
    }

    pendingCenterRef.current = null;
    skipCoordsSyncRef.current = true;
    mapRef.current.flyTo([center.lat, center.lng], 14, { duration: 0.6 });
    markerRef.current.setLatLng([center.lat, center.lng]);
    onChangeRef.current({ latitude: center.lat, longitude: center.lng });
    window.setTimeout(() => {
      skipCoordsSyncRef.current = false;
    }, 0);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    void import("leaflet").then((leafletModule) => {
      if (disposed || !containerRef.current) return;

      const L = leafletModule.default;
      configureLeafletDefaultIcon(L);

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }

      const initialCenter =
        pendingCenterRef.current ??
        mapCenterRef.current ?? { lat: latitude, lng: longitude };
      pendingCenterRef.current = null;

      const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(
        [initialCenter.lat, initialCenter.lng],
        14
      );

      addLeafletTileLayer(L, map);

      const marker = L.marker([initialCenter.lat, initialCenter.lng], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        const coords = { latitude: position.lat, longitude: position.lng };
        onChangeRef.current(coords);
        onUserPickRef.current?.(coords);
      });

      map.on("click", (event) => {
        marker.setLatLng(event.latlng);
        const coords = { latitude: event.latlng.lat, longitude: event.latlng.lng };
        onChangeRef.current(coords);
        onUserPickRef.current?.(coords);
      });

      mapRef.current = map;
      markerRef.current = marker;
    });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapCenter) return;
    applyMapCenter(mapCenter);
  }, [mapCenter?.lat, mapCenter?.lng, mapCenter?.revision]);

  useEffect(() => {
    if (skipCoordsSyncRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([latitude, longitude]);
    mapRef.current?.panTo([latitude, longitude]);
  }, [latitude, longitude]);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div ref={containerRef} className="h-[320px] w-full" />
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        روی نقشه کلیک کنید یا نشانگر را بکشید تا نوع محل از نقشه خوانده شود. مختصات:{" "}
        {latitude.toFixed(5)}, {longitude.toFixed(5)}
      </p>
    </div>
  );
}
