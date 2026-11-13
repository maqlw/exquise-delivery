import { useState } from "react";
import { AREAS, WIL, findArea } from "../lib/logic.js";

// Satu datalist untuk semua kolom pilih area: ketik nama kelurahan, kecamatan, kota, atau kode pos.
export const WilList = () => (
  <datalist id="wil-list">{AREAS.map(a => <option key={a.name} value={a.name}>Area umum</option>)}{WIL.map((r, i) => <option key={i} value={r.label} />)}</datalist>
);
export function AreaPicker({ id, value = "", onPick, label = "Cari kelurahan / kode pos…" }) {
  const [v, setV] = useState(value);
  return <input id={id} type="search" list="wil-list" autoComplete="off" value={v} placeholder={label} aria-label={label}
    onChange={e => { const x = e.target.value; setV(x); if (!x || findArea(x)) onPick(x); }} />;
}
