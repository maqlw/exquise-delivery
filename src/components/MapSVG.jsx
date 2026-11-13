// Peta skema rute. shortcut: grid ±1 km tanpa ubin peta; ganti ke Leaflet + OpenStreetMap kalau perlu peta jalan sungguhan.
export default function MapSVG({ origin, routes, label = true, title = "Peta skema rute", showOrigin = true }) {
  const pts = [origin, ...routes.flatMap(r => [...r.pts, ...(r.pos ? [r.pos] : [])])].filter(p => p && p.lat != null);
  const W = 600, H = 440, pad = 34, kx = Math.cos(origin.lat * Math.PI / 180);
  const xs = pts.map(p => p.lng * kx), ys = pts.map(p => p.lat);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * (W / H), 0.02);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2, s = (W - 2 * pad) / span;
  const P = p => [W / 2 + (p.lng * kx - cx) * s, H / 2 - (p.lat - cy) * s];
  const step = 0.009 * s, gx = [], gy = [];
  for (let x = (W / 2) % step; x < W; x += step) gx.push(x);
  for (let y = (H / 2) % step; y < H; y += step) gy.push(y);
  const line = list => list.map(P).map(p => p.join(",")).join(" ");
  const [ox, oy] = P(origin);
  return (
    <svg className="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
      <g style={{ stroke: "var(--grid)", strokeWidth: 1 }}>
        {gx.map(x => <line key={"x" + x} x1={x} y1="0" x2={x} y2={H} />)}
        {gy.map(y => <line key={"y" + y} x1="0" y1={y} x2={W} y2={y} />)}
      </g>
      {routes.map((r, ri) => {
        const pts2 = r.pts.filter(p => p.lat != null);
        return (
          <g key={ri}>
            {label && pts2.length > 0 && <polyline points={line([origin, ...pts2])} style={{ fill: "none", stroke: r.color, strokeWidth: 3, strokeDasharray: "6 6", opacity: 0.75 }} />}
            {r.doneN > 0 && <polyline points={line([origin, ...pts2.slice(0, r.doneN)])} style={{ fill: "none", stroke: "var(--ok)", strokeWidth: 4 }} />}
            {pts2.map((p, i) => { const [x, y] = P(p); return (
              <g key={i}>
                <circle cx={x} cy={y} r="11" style={{ fill: i < (r.doneN || 0) ? "var(--ok)" : r.color, stroke: "var(--surface)", strokeWidth: 2 }} />
                {label && <text x={x} y={y + 4} textAnchor="middle" style={{ fill: "#fff", font: "600 10px var(--f-mono)" }}>{i + 1}</text>}
              </g>); })}
            {r.pos && (() => { const [x, y] = P(r.pos); return (<g><circle cx={x} cy={y} r="17" style={{ fill: r.color, opacity: 0.2 }} /><circle cx={x} cy={y} r="7" style={{ fill: "var(--ink)", stroke: "var(--surface)", strokeWidth: 3 }} /></g>); })()}
          </g>);
      })}
      {showOrigin && <>
      <rect x={ox - 12} y={oy - 12} width="24" height="24" rx="5" style={{ fill: "var(--ink)" }} />
      <text x={ox} y={oy + 4} textAnchor="middle" style={{ fill: "var(--bg)", font: "700 10px var(--f-mono)" }}>EX</text></>}
    </svg>
  );
}
