import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const dot = (bg, txt) => L.divIcon({ className: "pin-ic", html: `<span style="background:${bg}">${txt}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] });

// shortcut: ubin peta dari server OpenStreetMap (gratis, ada batas wajar); pindah ke penyedia ubin lain kalau halaman lacak dibuka puluhan ribu kali/hari.
// Peta jalan (OpenStreetMap). origin = outlet; stops = titik tujuan berurutan; onPick(lat,lng) -> titik tujuan pertama bisa digeser/ketuk.
export default function PinMap({ origin, stops = [], onPick, height = 240, label = "Peta lokasi", originText = "EX" }) {
  const el = useRef(null), map = useRef(null), layer = useRef(null), pick = useRef(onPick);
  pick.current = onPick;
  useEffect(() => {
    map.current = L.map(el.current, { scrollWheelZoom: false, attributionControl: true }).setView([-6.2, 106.82], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    map.current.on("click", e => pick.current?.(e.latlng.lat, e.latlng.lng));
    return () => map.current.remove();
  }, []);
  const key = JSON.stringify([origin?.lat, origin?.lng, stops.map(s => [s.lat, s.lng])]);
  useEffect(() => {
    const g = layer.current; g.clearLayers();
    const pts = stops.filter(s => s.lat != null), all = [...(origin?.lat != null ? [origin] : []), ...pts];
    if (origin?.lat != null) L.marker([origin.lat, origin.lng], { icon: dot("#16201a", originText), keyboard: false }).addTo(g);
    if (all.length > 1) L.polyline(all.map(p => [p.lat, p.lng]), { color: "#c2552d", weight: 3, dashArray: "6 6" }).addTo(g);
    pts.forEach((p, i) => {
      const m = L.marker([p.lat, p.lng], { icon: dot("#c2552d", pts.length > 1 ? i + 1 : "●"), draggable: !!onPick && i === 0, title: p.title || "" }).addTo(g);
      if (p.title) m.bindTooltip(p.title);
      m.on("dragend", () => { const ll = m.getLatLng(); pick.current?.(ll.lat, ll.lng); });
    });
    if (all.length === 1) map.current.setView([all[0].lat, all[0].lng], 15);
    else if (all.length) map.current.fitBounds(L.latLngBounds(all.map(p => [p.lat, p.lng])), { padding: [28, 28], maxZoom: 16 });
  }, [key]);
  return <div ref={el} className="pinmap" style={{ height }} role="application" aria-label={label} />;
}
