import React, { useState, useEffect, useCallback } from "react";

const API_BASE = "https://radar-immo76-1.onrender.com";

// ─── Palette & helpers ───────────────────────────────────────────────────────
const nc = (v) => {
  if (v == null) return "#818cf8";
  if (v >= 7) return "#22c55e";
  if (v >= 5) return "#f59e0b";
  return "#ef4444";
};

const nLabel = (v) => {
  if (v == null) return "—";
  if (v >= 7) return "Bon";
  if (v >= 5) return "Moyen";
  return "Faible";
};

// ─── Barre de progression ─────────────────────────────────────────────────────
const ProgressBar = ({ value, max = 10, color }) => {
  const pct = Math.min(100, Math.max(0, ((value ?? 0) / max) * 100));
  return (
    <div style={{ background: "#e5e7eb", borderRadius: 6, height: 10, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${pct}%`, background: color ?? nc(value), height: "100%", borderRadius: 6, transition: "width 0.5s ease" }} />
    </div>
  );
};

// ─── Ligne critère avec barre ─────────────────────────────────────────────────
const CriteriaRow = ({ label, value, unit = "", note, max = 10, info }) => {
  const color = nc(note);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {value != null && (
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              {typeof value === "number" ? value.toLocaleString("fr-FR") : value}{unit}
            </span>
          )}
          <span style={{
            fontSize: 12, fontWeight: 700, color: "white",
            background: color, borderRadius: 4, padding: "1px 7px", minWidth: 28, textAlign: "center"
          }}>
            {note != null ? note.toFixed(1) : "—"}/10
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ProgressBar value={note} max={max} color={color} />
        {info && <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>{info}</span>}
      </div>
    </div>
  );
};

// ─── Jauge circulaire ─────────────────────────────────────────────────────────
const Gauge = ({ label, value, weight, onClick, active }) => {
  const color = nc(value);
  const pct = value != null ? (value / 10) * 100 : 0;
  const r = 32, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div onClick={onClick} style={{
      cursor: "pointer", textAlign: "center", padding: "10px 8px",
      borderRadius: 10, background: active ? "#f0f9ff" : "#f9fafb",
      border: `2px solid ${active ? color : "#e5e7eb"}`,
      transition: "all 0.2s", minWidth: 100, flex: 1
    }}>
      <svg width={80} height={80} style={{ display: "block", margin: "0 auto" }}>
        <circle cx={40} cy={40} r={r} fill="none" stroke="#e5e7eb" strokeWidth={7} />
        <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)" />
        <text x={40} y={44} textAnchor="middle" fontSize={16} fontWeight={700} fill={color}>
          {value != null ? value.toFixed(1) : "—"}
        </text>
      </svg>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#9ca3af" }}>Poids {weight}%</div>
      <div style={{ fontSize: 11, fontWeight: 600, color, marginTop: 2 }}>{nLabel(value)}</div>
    </div>
  );
};

// ─── Panneau détail d'une jauge ───────────────────────────────────────────────
const DetailPanel = ({ type, city, apiData }) => {
  const d = apiData ?? {};

  if (type === "rendement") {
    const rb = d.rentabilite_brute_pct;
    const pa = d.appartement_m2;
    const lo = d.loyer;
    const noteRb = rb != null ? Math.min(10, (rb / 12) * 10) : null;
    const notePa = pa != null ? Math.max(0, Math.min(10, 10 - (pa - 800) / 320)) : null;
    const noteLo = lo != null ? Math.min(10, (lo / 15) * 10) : null;

    return (
      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 16, marginTop: 8 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#15803d", fontWeight: 700 }}>📊 Détail — Rendement Locatif</h4>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div style={{ background: "white", borderRadius: 8, padding: 10, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Prix achat (DVF)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1e40af" }}>{pa != null ? pa.toLocaleString("fr-FR") : "—"} €/m²</div>
          </div>
          <div style={{ background: "white", borderRadius: 8, padding: 10, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Loyer médian (ANIL)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#7c3aed" }}>{lo != null ? lo.toFixed(1) : "—"} €/m²/mois</div>
          </div>
          <div style={{ background: "white", borderRadius: 8, padding: 10, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", gridColumn: "1/-1" }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Rentabilité brute</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: nc(d.rendement) }}>{rb != null ? rb.toFixed(2) : "—"}%</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>= loyer × 12 / prix achat × 100</div>
          </div>
        </div>

        <CriteriaRow label="Rentabilité brute" value={rb} unit="%" note={noteRb} info="Cible >8%" />
        <CriteriaRow label="Prix d'achat au m²" value={pa} unit=" €/m²" note={notePa} info="Plus bas = mieux" />
        <CriteriaRow label="Loyer médian" value={lo} unit=" €/m²/mois" note={noteLo} info="Cible >10 €" />
      </div>
    );
  }

  if (type === "demographie") {
    const pop = city?.pop ?? null;
    const ev = city?.ev ?? null;
    const notePop = pop != null ? Math.min(10, Math.log10(Math.max(1, pop)) - 2) * 2.5 : null;
    const noteEv = ev != null ? Math.min(10, Math.max(0, 5 + ev * 2)) : null;

    return (
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 16, marginTop: 8 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#1d4ed8", fontWeight: 700 }}>📊 Détail — Attractivité Démographique</h4>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div style={{ background: "white", borderRadius: 8, padding: 10, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Population</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1d4ed8" }}>{pop != null ? pop.toLocaleString("fr-FR") : "—"} hab.</div>
          </div>
          <div style={{ background: "white", borderRadius: 8, padding: 10, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Évolution pop.</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: ev != null && ev >= 0 ? "#22c55e" : "#ef4444" }}>
              {ev != null ? (ev >= 0 ? "+" : "") + ev.toFixed(1) + "%" : "—"}
            </div>
          </div>
        </div>

        <CriteriaRow label="Taille de la commune" value={pop != null ? pop.toLocaleString("fr-FR") : null} unit=" hab." note={notePop} info=">10 000 = top" />
        <CriteriaRow label="Dynamisme démographique" value={ev} unit="%" note={noteEv} info="Croissance positive = mieux" />
      </div>
    );
  }

  if (type === "socioeco") {
    const ch = city?.ch ?? null;
    const rv = city?.rv ?? null;
    const noteChom = ch != null ? Math.max(0, Math.min(10, 10 - (ch - 5) * 0.7)) : null;
    const noteRev = rv != null ? Math.min(10, (rv / 3000) * 10) : null;

    return (
      <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 10, padding: 16, marginTop: 8 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#7c3aed", fontWeight: 700 }}>📊 Détail — Score Socio-Économique</h4>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div style={{ background: "white", borderRadius: 8, padding: 10, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Taux de chômage</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: ch != null && ch < 10 ? "#22c55e" : "#ef4444" }}>
              {ch != null ? ch.toFixed(1) + "%" : "—"}
            </div>
          </div>
          <div style={{ background: "white", borderRadius: 8, padding: 10, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Revenu médian</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#7c3aed" }}>
              {rv != null ? rv.toLocaleString("fr-FR") + " €/an" : "—"}
            </div>
          </div>
        </div>

        <CriteriaRow label="Chômage" value={ch} unit="%" note={noteChom} info="<8% = favorable" />
        <CriteriaRow label="Revenu médian" value={rv != null ? rv.toLocaleString("fr-FR") : null} unit=" €/an" note={noteRev} info="Cible >20 000 €" />
      </div>
    );
  }

  return null;
};

// ─── Données statiques (53 communes Seine-Maritime >1000 hab) ─────────────────
const D = [
  { n: "Rouen", dep: "76", pop: 110169, ch: 15.2, rv: 18900, ev: -0.5, vac: 9.2, tc: 62, sc: { r: 5.8, d: 4.5, s: 4.2, g: 5.1 } },
  { n: "Le Havre", dep: "76", pop: 170147, ch: 17.1, rv: 17200, ev: -1.2, vac: 10.8, tc: 58, sc: { r: 6.1, d: 4.0, s: 3.8, g: 5.2 } },
  { n: "Dieppe", dep: "76", pop: 29084, ch: 16.8, rv: 16800, ev: -1.8, vac: 11.2, tc: 55, sc: { r: 6.8, d: 3.8, s: 3.5, g: 5.5 } },
  { n: "Fécamp", dep: "76", pop: 19257, ch: 14.2, rv: 17500, ev: -0.9, vac: 9.8, tc: 57, sc: { r: 6.5, d: 4.2, s: 4.0, g: 5.7 } },
  { n: "Elbeuf", dep: "76", pop: 16599, ch: 18.5, rv: 16200, ev: -1.5, vac: 12.1, tc: 54, sc: { r: 7.2, d: 3.5, s: 3.2, g: 5.8 } },
  { n: "Sotteville-lès-Rouen", dep: "76", pop: 28950, ch: 16.1, rv: 17800, ev: -0.3, vac: 9.5, tc: 60, sc: { r: 6.9, d: 4.4, s: 4.1, g: 5.9 } },
  { n: "Saint-Étienne-du-Rouvray", dep: "76", pop: 28170, ch: 19.2, rv: 16500, ev: -0.8, vac: 10.2, tc: 56, sc: { r: 7.0, d: 4.1, s: 3.6, g: 5.9 } },
  { n: "Mont-Saint-Aignan", dep: "76", pop: 20220, ch: 8.5, rv: 24500, ev: 0.4, vac: 6.2, tc: 71, sc: { r: 4.8, d: 5.6, s: 6.8, g: 5.4 } },
  { n: "Maromme", dep: "76", pop: 12840, ch: 14.8, rv: 18200, ev: -0.6, vac: 9.1, tc: 59, sc: { r: 6.6, d: 4.3, s: 4.2, g: 5.7 } },
  { n: "Bois-Guillaume", dep: "76", pop: 13250, ch: 7.8, rv: 26000, ev: 0.8, vac: 5.9, tc: 73, sc: { r: 4.5, d: 5.8, s: 7.2, g: 5.3 } },
  { n: "Déville-lès-Rouen", dep: "76", pop: 10180, ch: 11.2, rv: 20400, ev: -0.2, vac: 8.2, tc: 64, sc: { r: 5.5, d: 5.0, s: 5.5, g: 5.4 } },
  { n: "Barentin", dep: "76", pop: 12680, ch: 12.5, rv: 19800, ev: 0.1, vac: 8.8, tc: 63, sc: { r: 6.1, d: 5.1, s: 5.2, g: 5.7 } },
  { n: "Yvetot", dep: "76", pop: 10950, ch: 13.1, rv: 19200, ev: 0.2, vac: 9.0, tc: 61, sc: { r: 6.4, d: 5.1, s: 5.0, g: 5.8 } },
  { n: "Lillebonne", dep: "76", pop: 9190, ch: 11.8, rv: 20100, ev: -0.3, vac: 8.5, tc: 63, sc: { r: 6.3, d: 4.9, s: 5.3, g: 5.8 } },
  { n: "Bolbec", dep: "76", pop: 11480, ch: 14.9, rv: 17900, ev: -1.0, vac: 10.5, tc: 57, sc: { r: 7.0, d: 4.0, s: 3.9, g: 5.8 } },
  { n: "Harfleur", dep: "76", pop: 8780, ch: 15.5, rv: 17600, ev: -0.5, vac: 9.8, tc: 58, sc: { r: 6.8, d: 4.3, s: 4.0, g: 5.8 } },
  { n: "Montivilliers", dep: "76", pop: 17440, ch: 10.2, rv: 21500, ev: 0.5, vac: 7.5, tc: 66, sc: { r: 5.6, d: 5.4, s: 5.8, g: 5.6 } },
  { n: "Gonfreville-l'Orcher", dep: "76", pop: 9540, ch: 11.5, rv: 20800, ev: -0.1, vac: 8.0, tc: 65, sc: { r: 5.9, d: 5.0, s: 5.6, g: 5.7 } },
  { n: "Notre-Dame-de-Gravenchon", dep: "76", pop: 8600, ch: 9.8, rv: 22000, ev: 0.3, vac: 7.2, tc: 67, sc: { r: 5.4, d: 5.3, s: 6.0, g: 5.5 } },
  { n: "Doudeville", dep: "76", pop: 2850, ch: 10.5, rv: 19500, ev: 0.1, vac: 8.3, tc: 62, sc: { r: 7.5, d: 4.2, s: 5.4, g: 6.4 } },
  { n: "Goderville", dep: "76", pop: 2720, ch: 9.2, rv: 21000, ev: 0.6, vac: 7.5, tc: 64, sc: { r: 7.3, d: 4.8, s: 5.6, g: 6.3 } },
  { n: "Gournay-en-Bray", dep: "76", pop: 6220, ch: 11.0, rv: 19800, ev: 0.0, vac: 8.8, tc: 62, sc: { r: 6.8, d: 4.8, s: 5.2, g: 6.1 } },
  { n: "Neufchâtel-en-Bray", dep: "76", pop: 4940, ch: 12.8, rv: 18700, ev: -0.7, vac: 9.5, tc: 59, sc: { r: 7.1, d: 4.3, s: 4.8, g: 6.1 } },
  { n: "Eu", dep: "76", pop: 7580, ch: 13.5, rv: 18200, ev: -0.8, vac: 9.8, tc: 58, sc: { r: 6.9, d: 4.1, s: 4.5, g: 5.9 } },
  { n: "Saint-Valery-en-Caux", dep: "76", pop: 4560, ch: 11.5, rv: 19000, ev: -0.3, vac: 9.0, tc: 61, sc: { r: 6.5, d: 4.5, s: 5.0, g: 5.9 } },
  { n: "Caudebec-en-Caux", dep: "76", pop: 2560, ch: 10.8, rv: 19200, ev: 0.2, vac: 8.5, tc: 62, sc: { r: 6.7, d: 4.6, s: 5.2, g: 6.0 } },
  { n: "Pavilly", dep: "76", pop: 5840, ch: 13.0, rv: 19000, ev: 0.0, vac: 9.2, tc: 60, sc: { r: 6.6, d: 4.5, s: 4.8, g: 5.9 } },
  { n: "Grand-Couronne", dep: "76", pop: 9860, ch: 10.5, rv: 21200, ev: 0.4, vac: 7.8, tc: 65, sc: { r: 5.8, d: 5.3, s: 5.7, g: 5.7 } },
  { n: "Oissel", dep: "76", pop: 11640, ch: 15.5, rv: 17800, ev: -0.6, vac: 10.2, tc: 57, sc: { r: 7.0, d: 4.2, s: 4.0, g: 5.8 } },
  { n: "Petit-Quevilly", dep: "76", pop: 21890, ch: 17.8, rv: 17000, ev: -1.0, vac: 10.8, tc: 56, sc: { r: 7.1, d: 3.9, s: 3.7, g: 5.9 } },
  { n: "Grand-Quevilly", dep: "76", pop: 25690, ch: 16.5, rv: 17400, ev: -0.9, vac: 10.5, tc: 57, sc: { r: 7.0, d: 4.0, s: 3.8, g: 5.9 } },
  { n: "Bihorel", dep: "76", pop: 9380, ch: 7.2, rv: 27500, ev: 0.9, vac: 5.5, tc: 75, sc: { r: 4.2, d: 6.0, s: 7.5, g: 5.0 } },
  { n: "Bonsecours", dep: "76", pop: 6950, ch: 7.5, rv: 26800, ev: 0.7, vac: 5.8, tc: 74, sc: { r: 4.4, d: 5.8, s: 7.3, g: 5.1 } },
  { n: "Canteleu", dep: "76", pop: 14450, ch: 19.8, rv: 16200, ev: -1.2, vac: 11.5, tc: 54, sc: { r: 7.3, d: 3.6, s: 3.3, g: 6.0 } },
  { n: "Cléon", dep: "76", pop: 3870, ch: 12.0, rv: 19600, ev: -0.2, vac: 8.8, tc: 62, sc: { r: 6.5, d: 4.6, s: 5.1, g: 5.9 } },
  { n: "Duclair", dep: "76", pop: 3850, ch: 10.2, rv: 20500, ev: 0.3, vac: 7.8, tc: 64, sc: { r: 6.1, d: 5.2, s: 5.5, g: 5.8 } },
  { n: "Écalles-sur-Buchy", dep: "76", pop: 1050, ch: 9.5, rv: 20000, ev: 0.5, vac: 7.5, tc: 64, sc: { r: 7.0, d: 4.8, s: 5.3, g: 6.2 } },
  { n: "Fontaine-la-Mallet", dep: "76", pop: 2820, ch: 8.9, rv: 22500, ev: 0.8, vac: 6.8, tc: 67, sc: { r: 5.5, d: 5.5, s: 6.2, g: 5.7 } },
  { n: "Fontaine-le-Dun", dep: "76", pop: 1180, ch: 9.0, rv: 21000, ev: 0.4, vac: 7.2, tc: 65, sc: { r: 6.8, d: 5.0, s: 5.8, g: 6.2 } },
  { n: "Luneray", dep: "76", pop: 2980, ch: 10.0, rv: 20500, ev: 0.3, vac: 8.0, tc: 63, sc: { r: 7.0, d: 5.0, s: 5.5, g: 6.3 } },
  { n: "Ourville-en-Caux", dep: "76", pop: 1050, ch: 9.2, rv: 21000, ev: 0.5, vac: 7.5, tc: 64, sc: { r: 7.1, d: 5.0, s: 5.7, g: 6.3 } },
  { n: "Saint-Nicolas-d'Aliermont", dep: "76", pop: 3230, ch: 10.5, rv: 19800, ev: 0.1, vac: 8.2, tc: 63, sc: { r: 6.8, d: 4.8, s: 5.3, g: 6.1 } },
  { n: "Saint-Romain-de-Colbosc", dep: "76", pop: 3710, ch: 10.0, rv: 21000, ev: 0.5, vac: 7.8, tc: 64, sc: { r: 6.2, d: 5.2, s: 5.7, g: 5.9 } },
  { n: "Tôtes", dep: "76", pop: 1080, ch: 9.8, rv: 20000, ev: 0.2, vac: 7.8, tc: 63, sc: { r: 7.0, d: 4.8, s: 5.4, g: 6.2 } },
  { n: "Valmont", dep: "76", pop: 1010, ch: 9.5, rv: 20500, ev: 0.4, vac: 7.5, tc: 64, sc: { r: 7.1, d: 5.0, s: 5.6, g: 6.3 } },
  { n: "Auffay", dep: "76", pop: 2720, ch: 11.0, rv: 19500, ev: 0.0, vac: 8.5, tc: 62, sc: { r: 6.9, d: 4.7, s: 5.2, g: 6.2 } },
  { n: "Bacqueville-en-Caux", dep: "76", pop: 2480, ch: 10.8, rv: 19800, ev: 0.2, vac: 8.2, tc: 63, sc: { r: 7.0, d: 4.8, s: 5.3, g: 6.2 } },
  { n: "Criel-sur-Mer", dep: "76", pop: 2760, ch: 11.5, rv: 18900, ev: -0.5, vac: 9.2, tc: 61, sc: { r: 6.7, d: 4.4, s: 5.0, g: 6.0 } },
  { n: "Octeville-sur-Mer", dep: "76", pop: 4320, ch: 8.5, rv: 22500, ev: 0.8, vac: 6.8, tc: 67, sc: { r: 5.3, d: 5.5, s: 6.2, g: 5.6 } },
  { n: "Sainte-Adresse", dep: "76", pop: 7830, ch: 8.0, rv: 25000, ev: 0.5, vac: 6.0, tc: 72, sc: { r: 4.8, d: 5.7, s: 7.0, g: 5.4 } },
  { n: "Saint-Aubin-lès-Elbeuf", dep: "76", pop: 8390, ch: 14.2, rv: 18500, ev: -0.5, vac: 9.5, tc: 59, sc: { r: 6.8, d: 4.4, s: 4.5, g: 5.9 } },
  { n: "Saint-Pierre-lès-Elbeuf", dep: "76", pop: 5050, ch: 15.8, rv: 17500, ev: -1.0, vac: 10.2, tc: 57, sc: { r: 7.0, d: 4.0, s: 3.8, g: 5.8 } },
  { n: "Tourville-la-Rivière", dep: "76", pop: 3890, ch: 9.8, rv: 21500, ev: 0.6, vac: 7.5, tc: 65, sc: { r: 5.8, d: 5.4, s: 5.8, g: 5.7 } },
];

// ─── App principale ───────────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [city, setCity] = useState(null);
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePanel, setActivePanel] = useState(null); // "rendement" | "demographie" | "socioeco"
  const [open, setOpen] = useState(false);

  // Recherche API dynamique
  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}&dep=76`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const apiResults = (data.results ?? []).map(c => ({ ...c, _api: true }));
      setSuggestions(apiResults.slice(0, 10));
    } catch {
      const local = D.filter(c => c.n.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
      setSuggestions(local);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (query) fetchSuggestions(query); }, 250);
    return () => clearTimeout(t);
  }, [query, fetchSuggestions]);

  const fetchCommune = useCallback(async (name) => {
    setLoading(true); setApiData(null); setActivePanel(null);
    try {
      const res = await fetch(`${API_BASE}/analyse/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setApiData(d);
    } catch { setApiData(null); }
    setLoading(false);
  }, []);

  const select = (c) => {
    const staticCity = D.find(d => d.n.toLowerCase() === (c.commune ?? c.n ?? "").toLowerCase()) ?? c;
    setCity(staticCity);
    setQuery(c.commune ?? c.n ?? "");
    setSuggestions([]);
    setOpen(false);
    fetchCommune(c.commune ?? c.n);
  };

  const sorted = [...D].sort((a, b) => b.sc.g - a.sc.g);
  const displayed = query.length < 2 ? sorted : suggestions.length ? suggestions : sorted;

  const globalNote = apiData
    ? (apiData.rendement ?? city?.sc?.r ?? 0) * 0.5 + (apiData.demographie ?? city?.sc?.d ?? 0) * 0.25 + (apiData.socio_eco ?? city?.sc?.s ?? 0) * 0.25
    : city
      ? city.sc.r * 0.5 + city.sc.d * 0.25 + city.sc.s * 0.25
      : null;

  const scores = city ? {
    r: apiData?.rendement ?? city.sc.r,
    d: apiData?.demographie ?? city.sc.d,
    s: apiData?.socio_eco ?? city.sc.s,
    g: globalNote ?? city.sc.g,
  } : null;

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", background: "#f3f4f6", minHeight: "100vh", padding: 16 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)", borderRadius: 14, padding: "20px 24px", marginBottom: 16, color: "white" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🏠 Radar Immo 76</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.8 }}>Analyse investissement — Seine-Maritime</p>
        </div>

        {/* Recherche */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Tapez 2 lettres pour chercher parmi les 676 communes Seine-Maritime…"
            style={{
              width: "100%", boxSizing: "border-box", padding: "12px 16px",
              borderRadius: 10, border: "2px solid #e5e7eb", fontSize: 14,
              background: "white", outline: "none"
            }}
          />
          {open && displayed.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, background: "white",
              borderRadius: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.12)", zIndex: 100,
              maxHeight: 280, overflowY: "auto", border: "1px solid #e5e7eb", marginTop: 4
            }}>
              {displayed.map((c, i) => {
                const cs = c._api ? null : c.sc;
                const cc = cs ? nc(cs.g) : "#818cf8";
                return (
                  <div key={i} onClick={() => select(c)}
                    style={{ padding: "10px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f3f4f6" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                    onMouseLeave={e => e.currentTarget.style.background = "white"}
                  >
                    <span style={{ fontSize: 14, color: "#111827" }}>{c.commune ?? c.n}</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {c._api && <span style={{ fontSize: 10, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>DVF</span>}
                      {cs && <span style={{ fontSize: 12, fontWeight: 700, color: "white", background: cc, borderRadius: 4, padding: "2px 8px" }}>{cs.g.toFixed(1)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fiche commune */}
        {city && (
          <div style={{ background: "white", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>

            {/* Titre commune */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>{city.n}</h2>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                  {city.pop?.toLocaleString("fr-FR")} hab. · Seine-Maritime (76)
                  {loading && <span style={{ marginLeft: 8, color: "#f59e0b" }}>⏳ Chargement DVF…</span>}
                  {apiData && <span style={{ marginLeft: 8, color: "#22c55e", fontWeight: 600 }}>✅ Données DVF chargées</span>}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: nc(scores?.g) }}>{scores?.g?.toFixed(1) ?? "—"}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>Note globale /10</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>50% rend. · 25% démo. · 25% socio</div>
              </div>
            </div>

            {/* ─── Jauges + détail au clic ─── */}
            <div style={{ marginBottom: 8 }}>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#9ca3af" }}>💡 Clique sur une jauge pour voir le détail des critères</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Gauge label="Rendement" value={scores?.r} weight={50} active={activePanel === "rendement"}
                  onClick={() => setActivePanel(p => p === "rendement" ? null : "rendement")} />
                <Gauge label="Démographie" value={scores?.d} weight={25} active={activePanel === "demographie"}
                  onClick={() => setActivePanel(p => p === "demographie" ? null : "demographie")} />
                <Gauge label="Socio-Éco" value={scores?.s} weight={25} active={activePanel === "socioeco"}
                  onClick={() => setActivePanel(p => p === "socioeco" ? null : "socioeco")} />
              </div>
            </div>

            {/* Panneau détail */}
            {activePanel && (
              <DetailPanel type={activePanel} city={city} apiData={apiData} />
            )}

            {/* ─── Bloc chiffres clés ─── */}
            <div style={{ marginTop: 16, borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#374151" }}>📋 Chiffres clés</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {[
                  { l: "Prix achat (DVF)", v: apiData?.appartement_m2, u: " €/m²", c: "#1e40af" },
                  { l: "Loyer médian (ANIL)", v: apiData?.loyer != null ? apiData.loyer.toFixed(1) : null, u: " €/m²/mois", c: "#7c3aed" },
                  { l: "Rentabilité brute", v: apiData?.rentabilite_brute_pct != null ? apiData.rentabilite_brute_pct.toFixed(2) : null, u: "%", c: nc(scores?.r) },
                  { l: "Chômage", v: city.ch, u: "%", c: city.ch < 10 ? "#22c55e" : "#ef4444" },
                  { l: "Revenu médian", v: city.rv?.toLocaleString("fr-FR"), u: " €/an", c: "#374151" },
                  { l: "Taux propriétaires", v: city.tc, u: "%", c: "#374151" },
                ].map((item, i) => (
                  <div key={i} style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4, lineHeight: 1.3 }}>{item.l}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: item.c ?? "#111827" }}>
                      {item.v != null ? `${item.v}${item.u}` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Barres de progression globales ─── */}
            <div style={{ marginTop: 16, borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#374151" }}>📊 Vue synthétique des scores</h3>
              <CriteriaRow label="🏦 Rendement locatif (poids 50%)" note={scores?.r} info={`Contribution : ${scores?.r != null ? (scores.r * 0.5).toFixed(2) : "—"} pts`} />
              <CriteriaRow label="👥 Attractivité démographique (poids 25%)" note={scores?.d} info={`Contribution : ${scores?.d != null ? (scores.d * 0.25).toFixed(2) : "—"} pts`} />
              <CriteriaRow label="💼 Score socio-économique (poids 25%)" note={scores?.s} info={`Contribution : ${scores?.s != null ? (scores.s * 0.25).toFixed(2) : "—"} pts`} />
              <div style={{ height: 1, background: "#f3f4f6", margin: "8px 0" }} />
              <CriteriaRow label="⭐ Note globale pondérée" note={scores?.g} />
            </div>

          </div>
        )}

        {/* Liste ranking */}
        {!city && (
          <div style={{ background: "white", borderRadius: 14, padding: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#374151" }}>🏆 Top communes Seine-Maritime</h3>
            {sorted.slice(0, 20).map((c, i) => (
              <div key={i} onClick={() => select(c)}
                style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                onMouseLeave={e => e.currentTarget.style.background = "white"}
              >
                <span style={{ width: 28, fontSize: 13, color: "#9ca3af", fontWeight: 600 }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 14, color: "#111827", fontWeight: 500 }}>{c.n}</span>
                <span style={{ fontSize: 12, color: "#6b7280", marginRight: 10 }}>{c.pop?.toLocaleString("fr-FR")} hab.</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "white", background: nc(c.sc.g), borderRadius: 5, padding: "2px 9px" }}>{c.sc.g.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 16 }}>
          Prix DVF Cerema · Loyers ANIL 2024 · Géo API INSEE
        </p>
      </div>
    </div>
  );
}
