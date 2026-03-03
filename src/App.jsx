import React, { useState, useEffect, useCallback } from "react";

const API_BASE = "https://radar-immo76-1.onrender.com";

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
const sn = (v) => (v != null && !isNaN(Number(v)) ? Number(v) : null);

// ─── Calcul note globale (source unique de vérité) ────────────────────────────
const calcGlobal = (r, d, s) => {
  const nr = sn(r), nd = sn(d), ns = sn(s);
  if (nr != null && nd != null && ns != null)
    return nr * 0.5 + nd * 0.25 + ns * 0.25;
  return null;
};

// ─── Barre de progression ─────────────────────────────────────────────────────
function ProgressBar({ value }) {
  const n = sn(value);
  const pct = Math.min(100, Math.max(0, ((n ?? 0) / 10) * 100));
  return (
    <div style={{ background: "#e5e7eb", borderRadius: 6, height: 10, overflow: "hidden", flex: 1 }}>
      <div style={{
        width: `${pct}%`, background: nc(n), height: "100%",
        borderRadius: 6, transition: "width 0.5s ease"
      }} />
    </div>
  );
}

// ─── Ligne critère avec barre ─────────────────────────────────────────────────
function CriteriaRow({ label, displayValue, note, info }) {
  const n = sn(note);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {displayValue != null && (
            <span style={{ fontSize: 13, color: "#6b7280" }}>{displayValue}</span>
          )}
          <span style={{
            fontSize: 12, fontWeight: 700, color: "white",
            background: nc(n), borderRadius: 4,
            padding: "1px 7px", minWidth: 28, textAlign: "center"
          }}>
            {n != null ? n.toFixed(1) : "—"}/10
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ProgressBar value={n} />
        {info && (
          <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>{info}</span>
        )}
      </div>
    </div>
  );
}

// ─── Jauge circulaire ─────────────────────────────────────────────────────────
function Gauge({ label, value, weight, onClick, active }) {
  const v = sn(value);
  const color = nc(v);
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = v != null ? ((v / 10) * circ) : 0;
  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer", textAlign: "center", padding: "10px 8px",
        borderRadius: 10, background: active ? "#f0f9ff" : "#f9fafb",
        border: `2px solid ${active ? color : "#e5e7eb"}`,
        transition: "all 0.2s", minWidth: 100, flex: 1
      }}
    >
      <svg width={80} height={80} style={{ display: "block", margin: "0 auto" }}>
        <circle cx={40} cy={40} r={r} fill="none" stroke="#e5e7eb" strokeWidth={7} />
        <circle
          cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <text x={40} y={44} textAnchor="middle" fontSize={16} fontWeight={700} fill={color}>
          {v != null ? v.toFixed(1) : "—"}
        </text>
      </svg>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#9ca3af" }}>Poids {weight}%</div>
      <div style={{ fontSize: 11, fontWeight: 600, color, marginTop: 2 }}>{nLabel(v)}</div>
    </div>
  );
}

// ─── Carte chiffre clé ────────────────────────────────────────────────────────
function KpiCard({ label, value, color }) {
  return (
    <div style={{
      background: "white", borderRadius: 8, padding: 10,
      textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
    }}>
      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? "#111827" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

// ─── Panneau détail Rendement ─────────────────────────────────────────────────
function PanelRendement({ city, apiData }) {
  const pa  = sn(apiData?.prix?.appartement_m2);
  const pm  = sn(apiData?.prix?.maison_m2);
  const lo  = sn(apiData?.loyer?.appartement_m2);
  const rb  = sn(apiData?.rentabilite_brute_pct);
  const nv  = sn(apiData?.prix?.nb_ventes_apt);
  const src1 = apiData?.prix?.source ?? null;
  const src2 = apiData?.loyer?.source ?? null;

  const noteRb = rb != null ? Math.min(10, (rb / 12) * 10) : null;
  const notePa = pa != null ? Math.max(0, Math.min(10, 10 - (pa - 800) / 320)) : null;
  const noteLo = lo != null ? Math.min(10, (lo / 15) * 10) : null;

  return (
    <div style={{
      background: "#f0fdf4", border: "1px solid #bbf7d0",
      borderRadius: 10, padding: 16, marginTop: 8
    }}>
      <h4 style={{ margin: "0 0 14px", fontSize: 14, color: "#15803d", fontWeight: 700 }}>
        📊 Détail — Rendement Locatif
      </h4>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <KpiCard
          label="Prix appartement (DVF)"
          value={pa != null ? pa.toLocaleString("fr-FR") + " €/m²" + (nv ? ` · ${nv.toLocaleString("fr-FR")} ventes` : "") : null}
          color="#1e40af"
        />
        <KpiCard
          label="Prix maison (DVF)"
          value={pm != null ? pm.toLocaleString("fr-FR") + " €/m²" : null}
          color="#1e40af"
        />
        <KpiCard
          label="Loyer médian (ANIL)"
          value={lo != null ? lo.toFixed(1) + " €/m²/mois" : null}
          color="#7c3aed"
        />
        <KpiCard
          label="Rentabilité brute"
          value={rb != null ? rb.toFixed(2) + "%" : null}
          color={nc(sn(apiData?.scores?.rendement))}
        />
      </div>
      {rb != null && lo != null && pa != null && (
        <div style={{
          background: "white", borderRadius: 8, padding: 10, marginBottom: 14,
          fontSize: 12, color: "#6b7280", textAlign: "center"
        }}>
          Calcul : {lo.toFixed(1)} × 12 / {pa.toLocaleString("fr-FR")} × 100 = <strong style={{ color: nc(noteRb) }}>{rb.toFixed(2)}%</strong>
        </div>
      )}
      <CriteriaRow label="Rentabilité brute" displayValue={rb != null ? rb.toFixed(2) + "%" : null} note={noteRb} info="Cible >8%" />
      <CriteriaRow label="Prix d'achat appartement" displayValue={pa != null ? pa.toLocaleString("fr-FR") + " €/m²" : null} note={notePa} info="Plus bas = mieux" />
      <CriteriaRow label="Loyer médian" displayValue={lo != null ? lo.toFixed(1) + " €/m²/mois" : null} note={noteLo} info="Cible >10 €/m²" />
      {(src1 || src2) && (
        <div style={{ marginTop: 8, fontSize: 10, color: "#9ca3af" }}>
          {src1 && <div>📌 {src1}</div>}
          {src2 && <div>📌 {src2}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Panneau détail Démographie ───────────────────────────────────────────────
function PanelDemographie({ city, apiData }) {
  const pop = sn(apiData?.population ?? city?.pop);
  const ev  = sn(apiData?.demographie?.evolution_pop_pct_an ?? city?.ev);
  const vac = sn(apiData?.demographie?.vacance_pct ?? city?.vac);

  const notePop = pop != null ? Math.min(10, Math.max(0, (Math.log10(Math.max(1, pop)) - 2) * 2.5)) : null;
  const noteEv  = ev  != null ? Math.min(10, Math.max(0, 5 + ev * 2)) : null;
  const noteVac = vac != null ? Math.max(0, Math.min(10, 10 - (vac - 5) * 0.8)) : null;

  return (
    <div style={{
      background: "#eff6ff", border: "1px solid #bfdbfe",
      borderRadius: 10, padding: 16, marginTop: 8
    }}>
      <h4 style={{ margin: "0 0 14px", fontSize: 14, color: "#1d4ed8", fontWeight: 700 }}>
        📊 Détail — Attractivité Démographique
      </h4>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <KpiCard label="Population" value={pop != null ? pop.toLocaleString("fr-FR") + " hab." : null} color="#1d4ed8" />
        <KpiCard label="Évolution annuelle" value={ev != null ? (ev >= 0 ? "+" : "") + ev.toFixed(1) + "%" : null} color={ev != null && ev >= 0 ? "#22c55e" : "#ef4444"} />
        <KpiCard label="Vacance logements" value={vac != null ? vac.toFixed(1) + "%" : null} color={vac != null && vac < 8 ? "#22c55e" : "#ef4444"} />
        <KpiCard label="Zonage ABC" value={apiData?.zonage_abc ?? "N/A"} color="#374151" />
      </div>
      <CriteriaRow label="Taille de la commune" displayValue={pop != null ? pop.toLocaleString("fr-FR") + " hab." : null} note={notePop} info=">10 000 = top" />
      <CriteriaRow label="Dynamisme démographique" displayValue={ev != null ? (ev >= 0 ? "+" : "") + ev.toFixed(1) + "%" : null} note={noteEv} info="Croissance positive = mieux" />
      <CriteriaRow label="Vacance logements" displayValue={vac != null ? vac.toFixed(1) + "%" : null} note={noteVac} info="<8% = favorable" />
    </div>
  );
}

// ─── Panneau détail Socio-éco ─────────────────────────────────────────────────
function PanelSocioEco({ city, apiData }) {
  const ch   = sn(apiData?.socio_eco?.chomage_pct ?? city?.ch);
  const rv   = sn(apiData?.socio_eco?.revenu_median ?? city?.rv);
  const cad  = sn(apiData?.socio_eco?.part_cadres_pct);
  const pauv = sn(apiData?.socio_eco?.taux_pauvrete_pct);

  const noteChom = ch   != null ? Math.max(0, Math.min(10, 10 - (ch - 5) * 0.7)) : null;
  const noteRev  = rv   != null ? Math.min(10, (rv / 3000) * 10) : null;
  const noteCad  = cad  != null ? Math.min(10, cad / 3) : null;
  const notePauv = pauv != null ? Math.max(0, Math.min(10, 10 - pauv * 0.4)) : null;

  return (
    <div style={{
      background: "#faf5ff", border: "1px solid #e9d5ff",
      borderRadius: 10, padding: 16, marginTop: 8
    }}>
      <h4 style={{ margin: "0 0 14px", fontSize: 14, color: "#7c3aed", fontWeight: 700 }}>
        📊 Détail — Score Socio-Économique
      </h4>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <KpiCard label="Taux de chômage" value={ch != null ? ch.toFixed(1) + "%" : null} color={ch != null && ch < 10 ? "#22c55e" : "#ef4444"} />
        <KpiCard label="Revenu médian" value={rv != null ? rv.toLocaleString("fr-FR") + " €/an" : null} color="#7c3aed" />
        <KpiCard label="Part cadres" value={cad != null ? cad.toFixed(1) + "%" : null} color="#374151" />
        <KpiCard label="Taux de pauvreté" value={pauv != null ? pauv.toFixed(1) + "%" : null} color={pauv != null && pauv > 15 ? "#ef4444" : "#22c55e"} />
      </div>
      <CriteriaRow label="Chômage" displayValue={ch != null ? ch.toFixed(1) + "%" : null} note={noteChom} info="<8% = favorable" />
      <CriteriaRow label="Revenu médian" displayValue={rv != null ? rv.toLocaleString("fr-FR") + " €/an" : null} note={noteRev} info="Cible >20 000 €" />
      <CriteriaRow label="Part cadres" displayValue={cad != null ? cad.toFixed(1) + "%" : null} note={noteCad} info=">15% = dynamique" />
      <CriteriaRow label="Taux de pauvreté" displayValue={pauv != null ? pauv.toFixed(1) + "%" : null} note={notePauv} info="<12% = favorable" />
    </div>
  );
}

// ─── Données statiques (Seine-Maritime >1000 hab) ─────────────────────
