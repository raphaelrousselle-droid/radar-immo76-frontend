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

      <CriteriaRow
        label="Rentabilité brute"
        displayValue={rb != null ? rb.toFixed(2) + "%" : null}
        note={noteRb}
        info="Cible >8%"
      />
      <CriteriaRow
        label="Prix d'achat appartement"
        displayValue={pa != null ? pa.toLocaleString("fr-FR") + " €/m²" : null}
        note={notePa}
        info="Plus bas = mieux"
      />
      <CriteriaRow
        label="Loyer médian"
        displayValue={lo != null ? lo.toFixed(1) + " €/m²/mois" : null}
        note={noteLo}
        info="Cible >10 €/m²"
      />

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
        <KpiCard
          label="Population"
          value={pop != null ? pop.toLocaleString("fr-FR") + " hab." : null}
          color="#1d4ed8"
        />
        <KpiCard
          label="Évolution annuelle"
          value={ev != null ? (ev >= 0 ? "+" : "") + ev.toFixed(1) + "%" : null}
          color={ev != null && ev >= 0 ? "#22c55e" : "#ef4444"}
        />
        <KpiCard
          label="Vacance logements"
          value={vac != null ? vac.toFixed(1) + "%" : null}
          color={vac != null && vac < 8 ? "#22c55e" : "#ef4444"}
        />
        <KpiCard
          label="Zonage ABC"
          value={apiData?.zonage_abc ?? "N/A"}
          color="#374151"
        />
      </div>

      <CriteriaRow
        label="Taille de la commune"
        displayValue={pop != null ? pop.toLocaleString("fr-FR") + " hab." : null}
        note={notePop}
        info=">10 000 = top"
      />
      <CriteriaRow
        label="Dynamisme démographique"
        displayValue={ev != null ? (ev >= 0 ? "+" : "") + ev.toFixed(1) + "%" : null}
        note={noteEv}
        info="Croissance positive = mieux"
      />
      <CriteriaRow
        label="Vacance logements"
        displayValue={vac != null ? vac.toFixed(1) + "%" : null}
        note={noteVac}
        info="<8% = favorable"
      />
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
        <KpiCard
          label="Taux de chômage"
          value={ch != null ? ch.toFixed(1) + "%" : null}
          color={ch != null && ch < 10 ? "#22c55e" : "#ef4444"}
        />
        <KpiCard
          label="Revenu médian"
          value={rv != null ? rv.toLocaleString("fr-FR") + " €/an" : null}
          color="#7c3aed"
        />
        <KpiCard
          label="Part cadres"
          value={cad != null ? cad.toFixed(1) + "%" : null}
          color="#374151"
        />
        <KpiCard
          label="Taux de pauvreté"
          value={pauv != null ? pauv.toFixed(1) + "%" : null}
          color={pauv != null && pauv > 15 ? "#ef4444" : "#22c55e"}
        />
      </div>

      <CriteriaRow
        label="Chômage"
        displayValue={ch != null ? ch.toFixed(1) + "%" : null}
        note={noteChom}
        info="<8% = favorable"
      />
      <CriteriaRow
        label="Revenu médian"
        displayValue={rv != null ? rv.toLocaleString("fr-FR") + " €/an" : null}
        note={noteRev}
        info="Cible >20 000 €"
      />
      <CriteriaRow
        label="Part cadres"
        displayValue={cad != null ? cad.toFixed(1) + "%" : null}
        note={noteCad}
        info=">15% = dynamique"
      />
      <CriteriaRow
        label="Taux de pauvreté"
        displayValue={pauv != null ? pauv.toFixed(1) + "%" : null}
        note={notePauv}
        info="<12% = favorable"
      />
    </div>
  );
}

// ─── Données statiques (Seine-Maritime >1000 hab) ─────────────────────────────
const D = [
  { n: "Rouen", pop: 110169, ch: 15.2, rv: 18900, ev: -0.5, vac: 9.2, tc: 62, sc: { r: 5.8, d: 4.5, s: 4.2, g: 5.1 } },
  { n: "Le Havre", pop: 170147, ch: 17.1, rv: 17200, ev: -1.2, vac: 10.8, tc: 58, sc: { r: 6.1, d: 4.0, s: 3.8, g: 5.2 } },
  { n: "Dieppe", pop: 29084, ch: 16.8, rv: 16800, ev: -1.8, vac: 11.2, tc: 55, sc: { r: 6.8, d: 3.8, s: 3.5, g: 5.5 } },
  { n: "Fécamp", pop: 19257, ch: 14.2, rv: 17500, ev: -0.9, vac: 9.8, tc: 57, sc: { r: 6.5, d: 4.2, s: 4.0, g: 5.7 } },
  { n: "Elbeuf", pop: 16599, ch: 18.5, rv: 16200, ev: -1.5, vac: 12.1, tc: 54, sc: { r: 7.2, d: 3.5, s: 3.2, g: 5.8 } },
  { n: "Sotteville-lès-Rouen", pop: 28950, ch: 16.1, rv: 17800, ev: -0.3, vac: 9.5, tc: 60, sc: { r: 6.9, d: 4.4, s: 4.1, g: 5.9 } },
  { n: "Saint-Étienne-du-Rouvray", pop: 28170, ch: 19.2, rv: 16500, ev: -0.8, vac: 10.2, tc: 56, sc: { r: 7.0, d: 4.1, s: 3.6, g: 5.9 } },
  { n: "Mont-Saint-Aignan", pop: 20220, ch: 8.5, rv: 24500, ev: 0.4, vac: 6.2, tc: 71, sc: { r: 4.8, d: 5.6, s: 6.8, g: 5.4 } },
  { n: "Maromme", pop: 12840, ch: 14.8, rv: 18200, ev: -0.6, vac: 9.1, tc: 59, sc: { r: 6.6, d: 4.3, s: 4.2, g: 5.7 } },
  { n: "Bois-Guillaume", pop: 13250, ch: 7.8, rv: 26000, ev: 0.8, vac: 5.9, tc: 73, sc: { r: 4.5, d: 5.8, s: 7.2, g: 5.3 } },
  { n: "Déville-lès-Rouen", pop: 10180, ch: 11.2, rv: 20400, ev: -0.2, vac: 8.2, tc: 64, sc: { r: 5.5, d: 5.0, s: 5.5, g: 5.4 } },
  { n: "Barentin", pop: 12680, ch: 12.5, rv: 19800, ev: 0.1, vac: 8.8, tc: 63, sc: { r: 6.1, d: 5.1, s: 5.2, g: 5.7 } },
  { n: "Yvetot", pop: 10950, ch: 13.1, rv: 19200, ev: 0.2, vac: 9.0, tc: 61, sc: { r: 6.4, d: 5.1, s: 5.0, g: 5.8 } },
  { n: "Lillebonne", pop: 9190, ch: 11.8, rv: 20100, ev: -0.3, vac: 8.5, tc: 63, sc: { r: 6.3, d: 4.9, s: 5.3, g: 5.8 } },
  { n: "Bolbec", pop: 11480, ch: 14.9, rv: 17900, ev: -1.0, vac: 10.5, tc: 57, sc: { r: 7.0, d: 4.0, s: 3.9, g: 5.8 } },
  { n: "Harfleur", pop: 8780, ch: 15.5, rv: 17600, ev: -0.5, vac: 9.8, tc: 58, sc: { r: 6.8, d: 4.3, s: 4.0, g: 5.8 } },
  { n: "Montivilliers", pop: 17440, ch: 10.2, rv: 21500, ev: 0.5, vac: 7.5, tc: 66, sc: { r: 5.6, d: 5.4, s: 5.8, g: 5.6 } },
  { n: "Gonfreville-l'Orcher", pop: 9540, ch: 11.5, rv: 20800, ev: -0.1, vac: 8.0, tc: 65, sc: { r: 5.9, d: 5.0, s: 5.6, g: 5.7 } },
  { n: "Notre-Dame-de-Gravenchon", pop: 8600, ch: 9.8, rv: 22000, ev: 0.3, vac: 7.2, tc: 67, sc: { r: 5.4, d: 5.3, s: 6.0, g: 5.5 } },
  { n: "Doudeville", pop: 2850, ch: 10.5, rv: 19500, ev: 0.1, vac: 8.3, tc: 62, sc: { r: 7.5, d: 4.2, s: 5.4, g: 6.4 } },
  { n: "Goderville", pop: 2720, ch: 9.2, rv: 21000, ev: 0.6, vac: 7.5, tc: 64, sc: { r: 7.3, d: 4.8, s: 5.6, g: 6.3 } },
  { n: "Gournay-en-Bray", pop: 6220, ch: 11.0, rv: 19800, ev: 0.0, vac: 8.8, tc: 62, sc: { r: 6.8, d: 4.8, s: 5.2, g: 6.1 } },
  { n: "Neufchâtel-en-Bray", pop: 4940, ch: 12.8, rv: 18700, ev: -0.7, vac: 9.5, tc: 59, sc: { r: 7.1, d: 4.3, s: 4.8, g: 6.1 } },
  { n: "Eu", pop: 7580, ch: 13.5, rv: 18200, ev: -0.8, vac: 9.8, tc: 58, sc: { r: 6.9, d: 4.1, s: 4.5, g: 5.9 } },
  { n: "Saint-Valery-en-Caux", pop: 4560, ch: 11.5, rv: 19000, ev: -0.3, vac: 9.0, tc: 61, sc: { r: 6.5, d: 4.5, s: 5.0, g: 5.9 } },
  { n: "Caudebec-en-Caux", pop: 2560, ch: 10.8, rv: 19200, ev: 0.2, vac: 8.5, tc: 62, sc: { r: 6.7, d: 4.6, s: 5.2, g: 6.0 } },
  { n: "Pavilly", pop: 5840, ch: 13.0, rv: 19000, ev: 0.0, vac: 9.2, tc: 60, sc: { r: 6.6, d: 4.5, s: 4.8, g: 5.9 } },
  { n: "Grand-Couronne", pop: 9860, ch: 10.5, rv: 21200, ev: 0.4, vac: 7.8, tc: 65, sc: { r: 5.8, d: 5.3, s: 5.7, g: 5.7 } },
  { n: "Oissel", pop: 11640, ch: 15.5, rv: 17800, ev: -0.6, vac: 10.2, tc: 57, sc: { r: 7.0, d: 4.2, s: 4.0, g: 5.8 } },
  { n: "Petit-Quevilly", pop: 21890, ch: 17.8, rv: 17000, ev: -1.0, vac: 10.8, tc: 56, sc: { r: 7.1, d: 3.9, s: 3.7, g: 5.9 } },
  { n: "Grand-Quevilly", pop: 25690, ch: 16.5, rv: 17400, ev: -0.9, vac: 10.5, tc: 57, sc: { r: 7.0, d: 4.0, s: 3.8, g: 5.9 } },
  { n: "Bihorel", pop: 9380, ch: 7.2, rv: 27500, ev: 0.9, vac: 5.5, tc: 75, sc: { r: 4.2, d: 6.0, s: 7.5, g: 5.0 } },
  { n: "Bonsecours", pop: 6950, ch: 7.5, rv: 26800, ev: 0.7, vac: 5.8, tc: 74, sc: { r: 4.4, d: 5.8, s: 7.3, g: 5.1 } },
  { n: "Canteleu", pop: 14450, ch: 19.8, rv: 16200, ev: -1.2, vac: 11.5, tc: 54, sc: { r: 7.3, d: 3.6, s: 3.3, g: 6.0 } },
  { n: "Cléon", pop: 3870, ch: 12.0, rv: 19600, ev: -0.2, vac: 8.8, tc: 62, sc: { r: 6.5, d: 4.6, s: 5.1, g: 5.9 } },
  { n: "Duclair", pop: 3850, ch: 10.2, rv: 20500, ev: 0.3, vac: 7.8, tc: 64, sc: { r: 6.1, d: 5.2, s: 5.5, g: 5.8 } },
  { n: "Fontaine-la-Mallet", pop: 2820, ch: 8.9, rv: 22500, ev: 0.8, vac: 6.8, tc: 67, sc: { r: 5.5, d: 5.5, s: 6.2, g: 5.7 } },
  { n: "Luneray", pop: 2980, ch: 10.0, rv: 20500, ev: 0.3, vac: 8.0, tc: 63, sc: { r: 7.0, d: 5.0, s: 5.5, g: 6.3 } },
  { n: "Octeville-sur-Mer", pop: 4320, ch: 8.5, rv: 22500, ev: 0.8, vac: 6.8, tc: 67, sc: { r: 5.3, d: 5.5, s: 6.2, g: 5.6 } },
  { n: "Sainte-Adresse", pop: 7830, ch: 8.0, rv: 25000, ev: 0.5, vac: 6.0, tc: 72, sc: { r: 4.8, d: 5.7, s: 7.0, g: 5.4 } },
  { n: "Saint-Aubin-lès-Elbeuf", pop: 8390, ch: 14.2, rv: 18500, ev: -0.5, vac: 9.5, tc: 59, sc: { r: 6.8, d: 4.4, s: 4.5, g: 5.9 } },
  { n: "Saint-Pierre-lès-Elbeuf", pop: 5050, ch: 15.8, rv: 17500, ev: -1.0, vac: 10.2, tc: 57, sc: { r: 7.0, d: 4.0, s: 3.8, g: 5.8 } },
  { n: "Tourville-la-Rivière", pop: 3890, ch: 9.8, rv: 21500, ev: 0.6, vac: 7.5, tc: 65, sc: { r: 5.8, d: 5.4, s: 5.8, g: 5.7 } },
];

const COMMUNES = Array.from(new Map(D.map(c => [c.n, c])).values());

// ─── Composant principal ──────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery]             = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [city, setCity]               = useState(null);
  const [apiData, setApiData]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [open, setOpen]               = useState(false);

  // Recherche suggestions via API
  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}&dep=76`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSuggestions((data.results ?? []).map(c => ({ ...c, _api: true })).slice(0, 10));
    } catch {
      setSuggestions(COMMUNES.filter(c => c.n.toLowerCase().includes(q.toLowerCase())).slice(0, 8));
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (query) fetchSuggestions(query); }, 250);
    return () => clearTimeout(t);
  }, [query, fetchSuggestions]);

  // Chargement données API pour une commune
  const fetchCommune = useCallback(async (name) => {
    setLoading(true);
    setApiData(null);
    setActivePanel(null);
    try {
      const res = await fetch(`${API_BASE}/analyse/${encodeURIComponent(name)}`);
      if (res.ok) {
        const d = await res.json();
        setApiData(d ?? null);
      }
    } catch {
      setApiData(null);
    }
    setLoading(false);
  }, []);

  // Sélection d'une commune
  const select = useCallback((c) => {
    try {
      const name = c.commune ?? c.n ?? "";
      const staticCity =
        COMMUNES.find(d => d.n.toLowerCase() === name.toLowerCase()) ?? {
          n: name,
          pop: sn(c.population) ?? null,
          ch: null, rv: null, ev: null, vac: null, tc: null,
          sc: { r: null, d: null, s: null, g: null },
        };
      setCity(staticCity);
      setQuery(name);
      setSuggestions([]);
      setOpen(false);
      fetchCommune(name);
    } catch (e) {
      console.error("select error", e);
    }
  }, [fetchCommune]);

  // Données affichées dans la liste
  const sorted = [...COMMUNES].sort((a, b) => (b.sc?.g ?? 0) - (a.sc?.g ?? 0));
  const displayed =
    query.length < 2
      ? sorted
      : suggestions.length
      ? suggestions
      : sorted.filter(c => c.n.toLowerCase().includes(query.toLowerCase()));

  // Scores : priorité aux données API réelles
  const sr = sn(apiData?.scores?.rendement   ?? city?.sc?.r);
  const sd = sn(apiData?.scores?.demographie ?? city?.sc?.d);
  const se = sn(apiData?.scores?.socio_eco   ?? city?.sc?.s);
  const sg = sn(apiData?.scores?.global      ?? city?.sc?.g);
  const globalNote =
    sr != null && sd != null && se != null
      ? sr * 0.5 + sd * 0.25 + se * 0.25
      : sg;
  const scores = city ? { r: sr, d: sd, s: se, g: globalNote } : null;

  // Chiffres clés (avec vrais champs API)
  const pa = sn(apiData?.prix?.appartement_m2);
  const pm = sn(apiData?.prix?.maison_m2);
  const lo = sn(apiData?.loyer?.appartement_m2);
  const rb = sn(apiData?.rentabilite_brute_pct);
  const ch = sn(apiData?.socio_eco?.chomage_pct   ?? city?.ch);
  const rv = sn(apiData?.socio_eco?.revenu_median  ?? city?.rv);
  const popAff = sn(apiData?.population ?? city?.pop);

  return (
    <div style={{
      fontFamily: "Inter, system-ui, sans-serif",
      background: "#f3f4f6", minHeight: "100vh", padding: 16
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{
          background: "linear-gradient(135deg,#1e3a5f,#2563eb)",
          borderRadius: 14, padding: "20px 24px", marginBottom: 16, color: "white"
        }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🏠 Radar Immo 76</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.8 }}>
            Analyse investissement — Seine-Maritime
          </p>
        </div>

        {/* ── Barre de recherche ── */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Tapez 2 lettres pour chercher une commune Seine-Maritime…"
            style={{
              width: "100%", boxSizing: "border-box", padding: "12px 16px",
              borderRadius: 10, border: "2px solid #e5e7eb", fontSize: 14,
              background: "white", outline: "none"
            }}
          />
          {open && displayed.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0,
              background: "white", borderRadius: 10,
              boxShadow: "0 4px 24px rgba(0,0,0,0.12)", zIndex: 100,
              maxHeight: 280, overflowY: "auto",
              border: "1px solid #e5e7eb", marginTop: 4
            }}>
              {displayed.map((c, i) => {
                const isApi = !!c._api;
                const scG   = isApi ? null : sn(c.sc?.g);
                return (
                  <div
                    key={i}
                    onClick={() => select(c)}
                    style={{
                      padding: "10px 16px", cursor: "pointer",
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", borderBottom: "1px solid #f3f4f6"
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={e => (e.currentTarget.style.background = "white")}
                  >
                    <span style={{ fontSize: 14, color: "#111827" }}>
                      {c.commune ?? c.n}
                    </span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {isApi && (
                        <span style={{
                          fontSize: 10, background: "#dbeafe", color: "#1d4ed8",
                          borderRadius: 4, padding: "1px 6px", fontWeight: 600
                        }}>DVF</span>
                      )}
                      {scG != null && (
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: "white",
                          background: nc(scG), borderRadius: 4, padding: "2px 8px"
                        }}>{scG.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Fiche commune ── */}
        {city && (
          <div style={{
            background: "white", borderRadius: 14, padding: 20,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
          }}>

            {/* En-tête commune */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "flex-start", marginBottom: 16
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>
                  {city.n}
                </h2>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                  {popAff != null ? popAff.toLocaleString("fr-FR") + " hab. · " : ""}
                  Seine-Maritime (76)
                  {loading && (
                    <span style={{ marginLeft: 8, color: "#f59e0b" }}>⏳ Chargement…</span>
                  )}
                  {!loading && apiData && (
                    <span style={{ marginLeft: 8, color: "#22c55e", fontWeight: 600 }}>
                      ✅ DVF + ANIL
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "center", minWidth: 80 }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: nc(scores?.g) }}>
                  {scores?.g != null ? scores.g.toFixed(1) : "—"}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>Note /10</div>
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                  50% rend · 25% démo · 25% socio
                </div>
              </div>
            </div>

            {/* Jauges */}
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#9ca3af" }}>
              💡 Clique sur une jauge pour voir le détail des critères
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <Gauge
                label="Rendement" value={scores?.r} weight={50}
                active={activePanel === "rendement"}
                onClick={() => setActivePanel(p => p === "rendement" ? null : "rendement")}
              />
              <Gauge
                label="Démographie" value={scores?.d} weight={25}
                active={activePanel === "demographie"}
                onClick={() => setActivePanel(p => p === "demographie" ? null : "demographie")}
              />
              <Gauge
                label="Socio-Éco" value={scores?.s} weight={25}
                active={activePanel === "socioeco"}
                onClick={() => setActivePanel(p => p === "socioeco" ? null : "socioeco")}
              />
            </div>

            {/* Panneaux détail */}
            {activePanel === "rendement"   && <PanelRendement   city={city} apiData={apiData} />}
            {activePanel === "demographie" && <PanelDemographie city={city} apiData={apiData} />}
            {activePanel === "socioeco"    && <PanelSocioEco    city={city} apiData={apiData} />}

            {/* Chiffres clés */}
            <div style={{ marginTop: 16, borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#374151" }}>
                📋 Chiffres clés
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                <KpiCard
                  label="Prix appt (DVF)"
                  value={pa != null ? pa.toLocaleString("fr-FR") + " €/m²" : null}
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
                  color={nc(scores?.r)}
                />
                <KpiCard
                  label="Chômage"
                  value={ch != null ? ch.toFixed(1) + "%" : null}
                  color={ch != null && ch < 10 ? "#22c55e" : "#ef4444"}
                />
                <KpiCard
                  label="Revenu médian"
                  value={rv != null ? rv.toLocaleString("fr-FR") + " €/an" : null}
                  color="#374151"
                />
              </div>
            </div>

            {/* Vue synthétique barres */}
            <div style={{ marginTop: 16, borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#374151" }}>
                📊 Vue synthétique
              </h3>
              <CriteriaRow
                label="🏦 Rendement locatif (50%)"
                note={scores?.r}
                info={scores?.r != null ? `→ ${(scores.r * 0.5).toFixed(2)} pts` : undefined}
              />
              <CriteriaRow
                label="👥 Démographie (25%)"
                note={scores?.d}
                info={scores?.d != null ? `→ ${(scores.d * 0.25).toFixed(2)} pts` : undefined}
              />
              <CriteriaRow
                label="💼 Socio-économique (25%)"
                note={scores?.s}
                info={scores?.s != null ? `→ ${(scores.s * 0.25).toFixed(2)} pts` : undefined}
              />
              <div style={{ height: 1, background: "#f3f4f6", margin: "8px 0" }} />
              <CriteriaRow label="⭐ Note globale pondérée" note={scores?.g} />
            </div>

          </div>
        )}

        {/* ── Ranking (accueil) ── */}
        {!city && (
          <div style={{
            background: "white", borderRadius: 14, padding: 16,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#374151" }}>
              🏆 Top communes Seine-Maritime
            </h3>
            {sorted.slice(0, 20).map((c, i) => (
              <div
                key={i}
                onClick={() => select(c)}
                style={{
                  display: "flex", alignItems: "center",
                  padding: "8px 4px", borderBottom: "1px solid #f3f4f6", cursor: "pointer"
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={e => (e.currentTarget.style.background = "white")}
              >
                <span style={{ width: 28, fontSize: 13, color: "#9ca3af", fontWeight: 600 }}>
                  #{i + 1}
                </span>
                <span style={{ flex: 1, fontSize: 14, color: "#111827", fontWeight: 500 }}>
                  {c.n}
                </span>
                <span style={{ fontSize: 12, color: "#6b7280", marginRight: 10 }}>
                  {c.pop?.toLocaleString("fr-FR")} hab.
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: "white",
                  background: nc(c.sc?.g), borderRadius: 5, padding: "2px 9px"
                }}>
                  {sn(c.sc?.g)?.toFixed(1) ?? "—"}
                </span>
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
