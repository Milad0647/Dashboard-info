"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { getCityCoordinates } from "@/lib/iran-city-coordinates";

interface BillboardLocationMapPickerProps {
  latitude: number;
  longitude: number;
  city?: string | null;
  onChange: (coords: { latitude: number; longitude: number }) => void;
}

export function BillboardLocationMapPicker({
  latitude,
  longitude,
  city,
  onChange,
}: BillboardLocationMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    void import("leaflet").then((leafletModule) => {
      if (disposed || !containerRef.current) return;

      const L = leafletModule.default;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }

      const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(
        [latitude, longitude],
        13
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        onChangeRef.current({ latitude: position.lat, longitude: position.lng });
      });

      map.on("click", (event) => {
        marker.setLatLng(event.latlng);
        onChangeRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng });
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
    if (!mapRef.current || !markerRef.current) return;
    const [lat, lng] = getCityCoordinates(city);
    mapRef.current.setView([lat, lng], 13);
    markerRef.current.setLatLng([lat, lng]);
    onChangeRef.current({ latitude: lat, longitude: lng });
  }, [city]);

  useEffect(() => {
    markerRef.current?.setLatLng([latitude, longitude]);
    mapRef.current?.panTo([latitude, longitude]);
  }, [latitude, longitude]);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div ref={containerRef} className="h-[320px] w-full" />
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        روی نقشه کلیک کنید یا نشانگر را بکشید. مختصات: {latitude.toFixed(5)}, {longitude.toFixed(5)}
      </p>
    </div>
  );
}
