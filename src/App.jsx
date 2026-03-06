import React, { useState, useEffect, useCallback, useMemo } from "react";

const API_BASE = "https://radar-immo76-1.onrender.com";
const CACHE_KEY = "radar-immo-communes-v2";
const PROJETS_KEY = "radar-immo-projets-v1";

const nc = (v) => { if (v == null) return "#94a3b8"; if (v >= 7) return "#16a34a"; if (v >= 5) return "#d97706"; return "#dc2626"; };
const nLabel = (v) => { if (v == null) return "—"; if (v >= 7) return "Bon"; if (v >= 5) return "Moyen"; return "Faible"; };
const sn = (v) => (v != null && !isNaN(Number(v)) ? Number(v) : null);
const pf = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const fmt = (n, d) => { const dd = d !== undefined ? d : 0; return n == null ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: dd, maximumFractionDigits: dd }); };
const fmtEur = (n) => n == null ? "—" : fmt(n) + " €";
const fmtPct = (n) => n == null ? "—" : fmt(n, 2) + " %";
const fmtK = (v) => v >= 1000 || v <= -1000 ? (v / 1000).toFixed(1) + "k €" : Math.round(v) + " €";
const LOT_DEFAULT = { id: 1, nom: "Lot 1", surface: "", loyer: "", travaux: "", charges: "" };

const CARD = { background: "rgba(255,255,255,0.7)", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(99,102,241,0.07)", border: "1px solid rgba(148,163,184,0.2)" };
const SECTION = { background: "rgba(255,255,255,0.55)", borderRadius: 20, padding: 20, boxShadow: "0 4px 24px rgba(99,102,241,0.07)", border: "1px solid rgba(148,163,184,0.18)", backdropFilter: "blur(18px)" };

function Tag({ color, children }) {
  const colors = {
    green: { bg: "rgba(22,163,74,0.1)", text: "#15803d", border: "rgba(22,163,74,0.3)" },
    orange: { bg: "rgba(217,119,6,0.1)", text: "#b45309", border: "rgba(217,119,6,0.3)" },
    red: { bg: "rgba(220,38,38,0.1)", text: "#dc2626", border: "rgba(220,38,38,0.3)" },
    blue: { bg: "rgba(14,165,233,0.1)", text: "#0369a1", border: "rgba(14,165,233,0.3)" },
    purple: { bg: "rgba(99,102,241,0.1)", text: "#4338ca", border: "rgba(99,102,241,0.3)" },
  };
  const c = colors[color] || colors.blue;
  return <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: c.bg, color: c.text, border: "1px solid " + c.border }}>{children}</span>;
}

function SectionHeader({ icon, title, badge }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{title}</div>
      {badge && <Tag color="purple">{badge}</Tag>}
    </div>
  );
}

function StatRow({ label, value, color, bold, border }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: border !== false ? "1px solid rgba(148,163,184,0.15)" : "none" }}>
      <span style={{ fontSize: 13, color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: color || "#0f172a" }}>{value}</span>
    </div>
  );
}

function ProgressBar({ value, clickable, onClick }) {
  const n = sn(value);
  const pct = Math.min(100, Math.max(0, ((n != null ? n : 0) / 10) * 100));
  return (
    <div onClick={onClick} style={{ background: "rgba(148,163,184,0.25)", borderRadius: 999, height: 7, width: "100%", overflow: "hidden", cursor: clickable ? "pointer" : "default" }}>
      <div style={{ width: pct + "%", background: "linear-gradient(90deg,#38bdf8,#818cf8)", height: 7, borderRadius: 999, transition: "width 0.3s" }} />
    </div>
  );
}

function ScoreDetail({ scoreKey, detail, onClose }) {
  const se = detail && detail.socio_eco ? detail.socio_eco : {};
  const dem = detail && detail.demographie ? detail.demographie : {};
  const pri = detail && detail.prix ? detail.prix : {};
  const configs = {
    rendement: { title: "Détail — Rendement", color: "#0ea5e9", items: [
      { label: "Prix appartement/m²", value: pri.appartement_m2 ? pri.appartement_m2.toLocaleString("fr-FR") + " €" : "—" },
      { label: "Prix maison/m²", value: pri.maison_m2 ? pri.maison_m2.toLocaleString("fr-FR") + " €" : "—" },
      { label: "Loyer médian/m²", value: detail && detail.loyer && detail.loyer.appartement_m2 != null ? Number(detail.loyer.appartement_m2).toFixed(1) + " €/m²/mois" : "—" },
      { label: "Rentabilité brute", value: detail && detail.rentabilite_brute_pct ? detail.rentabilite_brute_pct + " %" : "—", highlight: true },
    ], note: "Rendement brut ≈ (loyer × 12) / prix m²." },
    demographie: { title: "Détail — Démographie", color: "#8b5cf6", items: [
      { label: "Population", value: detail && detail.population ? detail.population.toLocaleString("fr-FR") + " hab." : "—" },
      { label: "Évolution pop./an", value: dem.evolution_pop_pct_an != null ? dem.evolution_pop_pct_an + " %" : "—", highlight: true },
      { label: "Vacance logements", value: dem.vacance_pct != null ? dem.vacance_pct + " %" : "—", highlight: true },
      { label: "Tension locative", value: dem.tension_locative_pct != null ? dem.tension_locative_pct + " %" : "—", highlight: true },
    ], note: "Score basé sur dynamique démographique, vacance et locataires." },
    socio_eco: { title: "Détail — Socio-économique", color: "#22c55e", items: [
      { label: "Revenu médian", value: se.revenu_median ? se.revenu_median.toLocaleString("fr-FR") + " €" : "—", highlight: true },
      { label: "Taux de chômage", value: se.chomage_pct != null ? se.chomage_pct + " %" : "—", highlight: true },
      { label: "Taux de pauvreté", value: se.taux_pauvrete_pct != null ? se.taux_pauvrete_pct + " %" : "—", highlight: true },
      { label: "Part cadres", value: se.part_cadres_pct != null ? se.part_cadres_pct + " %" : "—" },
    ], note: "Plus le revenu est élevé et le chômage faible, meilleur est le score." },
  };
  const cfg = configs[scoreKey];
  if (!cfg) return null;
  return (
    <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 12, padding: 12, marginTop: 6, border: "1px solid " + cfg.color + "44" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>{cfg.title}</div>
        <button onClick={onClose} style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>✕</button>
      </div>
      {cfg.items.map(function(item) {
        return (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid rgba(148,163,184,0.15)", fontSize: 12 }}>
            <span style={{ color: "#64748b" }}>{item.label}</span>
            <span style={{ fontWeight: item.highlight ? 600 : 500, color: item.highlight ? "#0f172a" : "#334155" }}>{item.value}</span>
          </div>
        );
      })}
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, fontStyle: "italic" }}>{cfg.note}</div>
    </div>
  );
}

function calculerSimulation(i) {
  const pv = pf(i.prixVente);
  const depenseNette = pv + pf(i.fraisNotaire) + pf(i.travaux) + pf(i.amenagements) + (pv * pf(i.fraisAgencePct) / 100);
  const sommeEmpruntee = depenseNette - pf(i.apport);
  const tc = pf(i.tauxCredit);
  const dur = pf(i.dureeAnnees);
  const nMois = dur * 12;
  const tMensuel = tc / 100 / 12;
  const mensualite = tMensuel === 0 ? sommeEmpruntee / nMois : (sommeEmpruntee * tMensuel) / (1 - Math.pow(1 + tMensuel, -nMois));
  const remboursementAnnuel = mensualite * 12;
  const coutPretTotal = remboursementAnnuel * dur - sommeEmpruntee;
  const interetsAnnuels = coutPretTotal / dur;
  const loyersAnnuels = pf(i.loyerMensuelHC) * pf(i.tauxOccupation);
  const assurancePNO = pf(i.assurancePNOAn) > 0 ? pf(i.assurancePNOAn) : depenseNette * 0.0012;
  const gestionAn = (loyersAnnuels * pf(i.gestionLocativePct)) / 100;
  const gliAn = (loyersAnnuels * pf(i.gliPct)) / 100;
  const totalFraisAnnuels = pf(i.chargesImmeubleAn) + pf(i.taxeFonciereAn) + assurancePNO + gestionAn + gliAn + pf(i.provisionTravauxAn) + pf(i.fraisBancairesAn) + pf(i.expertComptableAn);
  const amortissement = (depenseNette * pf(i.coefAmortissement)) / 100;
  const tis = pf(i.tauxIS);
  const tmi = pf(i.tmi);
  const bIS = Math.max(0, loyersAnnuels - totalFraisAnnuels - interetsAnnuels - amortissement);
  const bFR = Math.max(0, loyersAnnuels - totalFraisAnnuels - interetsAnnuels);
  const mkR = function(impot) {
    const tresorerie = loyersAnnuels - totalFraisAnnuels - remboursementAnnuel - impot;
    const rendBrut = depenseNette > 0 ? (loyersAnnuels / depenseNette) * 100 : 0;
    const rendNet = depenseNette > 0 ? (tresorerie / depenseNette) * 100 : 0;
    const regle70 = loyersAnnuels > 0 ? remboursementAnnuel / loyersAnnuels : null;
    const ebe = loyersAnnuels - totalFraisAnnuels;
    const tri = ebe > 0 ? depenseNette / ebe : null;
    return { ebe: ebe, impot: impot, tresorerie: tresorerie, rendBrut: rendBrut, rendNet: rendNet, tri: tri, regle70: regle70 };
  };
  return {
    depenseNette: depenseNette, sommeEmpruntee: sommeEmpruntee, mensualite: mensualite,
    coutPretTotal: coutPretTotal, remboursementAnnuel: remboursementAnnuel,
    loyersAnnuels: loyersAnnuels, totalFraisAnnuels: totalFraisAnnuels, amortissement: amortissement,
    rendBrut: depenseNette > 0 ? (loyersAnnuels / depenseNette) * 100 : 0,
    regimes: {
      "SAS / SCI IS": mkR(bIS * (tis / 100)),
      "LMNP Réel": mkR(bIS * ((tmi + 17.2) / 100)),
      "LMNP Micro BIC": mkR(Math.max(0, loyersAnnuels * 0.5) * ((tmi + 17.2) / 100)),
      "Foncier Réel": mkR(bFR * ((tmi + 17.2) / 100)),
      "Micro Foncier": mkR(Math.max(0, loyersAnnuels * 0.7) * ((tmi + 17.2) / 100)),
    },
  };
}

function calculerNote(result, regimeActif) {
  const r = result.regimes[regimeActif];
  if (!r) return 0;
  var score = 0;
  score += Math.min(25, Math.max(0, (result.rendBrut / 8) * 25));
  var treso = r.tresorerie;
  if (treso >= 3600) score += 30;
  else if (treso >= 0) score += 15 + (treso / 3600) * 15;
  else score += Math.max(0, 15 + (treso / 3600) * 15);
  var rg = r.regle70;
  if (rg != null) { if (rg <= 0.60) score += 20; else if (rg <= 0.70) score += 15; else if (rg <= 0.80) score += 8; }
  score += Math.min(15, Math.max(0, (r.rendNet / 4) * 15));
  if (r.tri != null && isFinite(r.tri)) { if (r.tri <= 12) score += 10; else if (r.tri <= 20) score += 5; else score += 2; }
  return Math.round(Math.min(100, Math.max(0, score)));
}

function getNoteColor(note) {
  if (note >= 75) return "#16a34a"; if (note >= 50) return "#d97706";
  if (note >= 30) return "#f97316"; return "#dc2626";
}
function getNoteLabel(note) {
  if (note >= 80) return "Excellent"; if (note >= 65) return "Très bon";
  if (note >= 50) return "Correct"; if (note >= 35) return "Passable"; return "Risqué";
}

function projeterCashFlow(inputs, regimeNom) {
  const pv = pf(inputs.prixVente);
  const depenseNette = pv + pf(inputs.fraisNotaire) + pf(inputs.travaux) + pf(inputs.amenagements) + (pv * pf(inputs.fraisAgencePct) / 100);
  const sommeEmpruntee = depenseNette - pf(inputs.apport);
  const tc = pf(inputs.tauxCredit); const dur = Math.max(1, Math.round(pf(inputs.dureeAnnees)));
  const nMois = dur * 12; const tMensuel = tc / 100 / 12;
  const mensualite = tMensuel === 0 ? sommeEmpruntee / nMois : (sommeEmpruntee * tMensuel) / (1 - Math.pow(1 + tMensuel, -nMois));
  const remboursementAnnuel = mensualite * 12;
  const amortissement = (depenseNette * pf(inputs.coefAmortissement)) / 100;
  const tis = pf(inputs.tauxIS); const tmi = pf(inputs.tmi);
  const assurancePNOBase = pf(inputs.assurancePNOAn) > 0 ? pf(inputs.assurancePNOAn) : depenseNette * 0.0012;
  var solde = sommeEmpruntee;
  const data = [];
  for (var y = 1; y <= dur + 5; y++) {
    const loyersAn = pf(inputs.loyerMensuelHC) * pf(inputs.tauxOccupation) * Math.pow(1.01, y - 1);
    const gestionAn = (loyersAn * pf(inputs.gestionLocativePct)) / 100;
    const gliAn = (loyersAn * pf(inputs.gliPct)) / 100;
    const fraisAn = pf(inputs.chargesImmeubleAn) + pf(inputs.taxeFonciereAn) + assurancePNOBase + gestionAn + gliAn + pf(inputs.provisionTravauxAn) + pf(inputs.fraisBancairesAn) + pf(inputs.expertComptableAn);
    var interetsAn = 0; const creditAn = y <= dur ? remboursementAnnuel : 0;
    if (y <= dur && tMensuel > 0) { for (var m = 0; m < 12; m++) { const intM = solde * tMensuel; interetsAn += intM; solde = Math.max(0, solde - (mensualite - intM)); } }
    const baseDeductible = Math.max(0, loyersAn - fraisAn - interetsAn - amortissement);
    const baseFoncierR = Math.max(0, loyersAn - fraisAn - interetsAn);
    var impots = 0;
    if (regimeNom === "SAS / SCI IS") impots = baseDeductible * (tis / 100);
    else if (regimeNom === "LMNP Réel") impots = baseDeductible * ((tmi + 17.2) / 100);
    else if (regimeNom === "LMNP Micro BIC") impots = Math.max(0, loyersAn * 0.5) * ((tmi + 17.2) / 100);
    else if (regimeNom === "Foncier Réel") impots = baseFoncierR * ((tmi + 17.2) / 100);
    else if (regimeNom === "Micro Foncier") impots = Math.max(0, loyersAn * 0.7) * ((tmi + 17.2) / 100);
    data.push({ year: y, loyers: loyersAn, frais: fraisAn, credit: creditAn, impots: impots, cashflow: loyersAn - fraisAn - creditAn - impots });
  }
  return data;
}
function CashFlowChart({ data }) {
  const [hovered, setHovered] = useState(null);
  if (!data || data.length === 0) return null;
  const W = 680; const H = 280; const padL = 64; const padR = 130; const padT = 20; const padB = 48;
  const chartW = W - padL - padR; const chartH = H - padT - padB;
  const allVals = [0];
  for (var ii = 0; ii < data.length; ii++) { allVals.push(data[ii].loyers); allVals.push(-(data[ii].frais + data[ii].credit + data[ii].impots)); allVals.push(data[ii].cashflow); }
  const maxV = Math.max.apply(null, allVals) * 1.15; const minV = Math.min.apply(null, allVals) * 1.15;
  const range = maxV - minV || 1;
  const toY = function(v) { return padT + chartH - ((v - minV) / range) * chartH; };
  const zeroY = toY(0);
  const barCenterX = function(i) { return padL + (i / data.length) * chartW + (chartW / data.length) / 2; };
  const barW = Math.max(4, chartW / data.length - 3);
  const TW = 148; const TH = 108;
  const h = hovered != null ? data[hovered] : null;
  var ttX = hovered != null ? barCenterX(hovered) - TW / 2 : 0;
  if (ttX < padL) ttX = padL; if (ttX + TW > W - padR) ttX = W - padR - TW;
  const tooltipRows = h == null ? [] : [
    { label: "Loyers", value: h.loyers, color: "#16a34a" },
    { label: "Charges", value: -h.frais, color: "#64748b" },
    { label: "Crédit", value: -h.credit, color: "#d97706" },
    { label: "Impôts", value: -h.impots, color: "#dc2626" },
    { label: "Cash-Flow", value: h.cashflow, color: h.cashflow >= 0 ? "#0369a1" : "#dc2626" },
  ];
  const legend = [{ color: "#4ade80", label: "Loyers" }, { color: "#94a3b8", label: "Charges" }, { color: "#fbbf24", label: "Crédit" }, { color: "#f87171", label: "Impôts" }, { color: "#38bdf8", label: "Cash-Flow" }];
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={"0 0 " + W + " " + H} style={{ width: "100%", minWidth: 480, fontFamily: "system-ui,sans-serif" }} onMouseLeave={function() { setHovered(null); }}>
        <rect x={padL} y={padT} width={chartW} height={chartH} fill="rgba(248,250,252,0.8)" rx="8" />
        {[0, 0.25, 0.5, 0.75, 1].map(function(t) {
          const v = minV + t * range; const y = toY(v);
          return (<g key={t}><line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="rgba(148,163,184,0.25)" strokeWidth={1} strokeDasharray="4 3" /><text x={padL - 5} y={y + 4} textAnchor="end" fontSize={10} fill="#94a3b8">{fmtK(v)}</text></g>);
        })}
        <line x1={padL} y1={zeroY} x2={padL + chartW} y2={zeroY} stroke="#cbd5e1" strokeWidth={1.5} />
        {hovered != null && <rect x={padL + (hovered / data.length) * chartW} y={padT} width={chartW / data.length} height={chartH} fill="rgba(99,102,241,0.06)" rx={3} />}
        {data.map(function(d, i) {
          const x = padL + (i / data.length) * chartW + (chartW / data.length - barW) / 2;
          const op = hovered != null && hovered !== i ? 0.4 : 1;
          const hL = Math.max(0, zeroY - toY(d.loyers));
          const hF = Math.max(0, (d.frais / range) * chartH);
          const hC = Math.max(0, (d.credit / range) * chartH);
          const hI = Math.max(0, (Math.max(0, d.impots) / range) * chartH);
          return (<g key={i} opacity={op} onMouseEnter={function() { setHovered(i); }} style={{ cursor: "pointer" }}>
            {hL > 0 && <rect x={x} y={toY(d.loyers)} width={barW} height={hL} fill="#4ade80" rx={2} />}
            {hF > 0 && <rect x={x} y={zeroY} width={barW} height={hF} fill="#94a3b8" rx={2} />}
            {hC > 0 && <rect x={x} y={zeroY + hF} width={barW} height={hC} fill="#fbbf24" rx={2} />}
            {hI > 0 && <rect x={x} y={zeroY + hF + hC} width={barW} height={hI} fill="#f87171" rx={2} />}
          </g>);
        })}
        <polyline points={data.map(function(d, i) { return barCenterX(i) + "," + toY(d.cashflow); }).join(" ")} fill="none" stroke="#38bdf8" strokeWidth={2.5} strokeLinejoin="round" />
        {data.map(function(d, i) { return <circle key={i} cx={barCenterX(i)} cy={toY(d.cashflow)} r={hovered === i ? 5 : 3} fill={hovered === i ? "#0ea5e9" : "#38bdf8"} stroke="white" strokeWidth={1.5} onMouseEnter={function() { setHovered(i); }} style={{ cursor: "pointer" }} />; })}
        {data.map(function(d, i) { if (i === 0 || (i + 1) % 5 === 0) return <text key={i} x={barCenterX(i)} y={H - padB + 14} textAnchor="middle" fontSize={10} fill="#94a3b8">{d.year}</text>; return null; })}
        <text x={padL + chartW / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#94a3b8">Année</text>
        {legend.map(function(l, i) { return (<g key={l.label} transform={"translate(" + (W - padR + 12) + "," + (padT + 14 + i * 20) + ")"}><rect x={0} y={-9} width={12} height={12} fill={l.color} rx={3} /><text x={17} y={2} fontSize={10} fill="#475569">{l.label}</text></g>); })}
        {h != null && (
          <g>
            <rect x={ttX} y={2} width={TW} height={TH} rx={8} fill="rgba(255,255,255,0.97)" stroke="rgba(148,163,184,0.35)" strokeWidth={1} />
            <text x={ttX + 8} y={17} fontSize={11} fontWeight="700" fill="#0f172a">Année {h.year}</text>
            {tooltipRows.map(function(row, idx) { return (<g key={row.label} transform={"translate(" + (ttX + 8) + "," + (24 + idx * 16) + ")"}><circle cx={4} cy={-3} r={3} fill={row.color} /><text x={11} y={0} fontSize={9} fill="#475569">{row.label}</text><text x={TW - 10} y={0} fontSize={9} fontWeight="600" fill={row.color} textAnchor="end">{fmtK(row.value)}</text></g>); })}
          </g>
        )}
      </svg>
    </div>
  );
}

function InputField({ label, name, value, onChange, unit, step, min }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 3, fontWeight: 500 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <input type="number" name={name} value={value} step={step || "1000"} min={min || "0"} onChange={onChange}
          style={{ width: "100%", background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "6px 10px", color: "#0f172a", fontSize: 13, outline: "none" }} />
        {(unit !== undefined ? unit : "€") && <span style={{ color: "#94a3b8", fontSize: 11, minWidth: 24 }}>{unit !== undefined ? unit : "€"}</span>}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#94a3b8", margin: "12px 0 6px" }}>{children}</div>;
}

function GestionLots({ lots, onChange, surfaceGlobale, loyerGlobal }) {
  const totalSurface = lots.reduce(function(s, l) { return s + pf(l.surface); }, 0);
  const totalLoyer = lots.reduce(function(s, l) { return s + pf(l.loyer); }, 0);
  const totalTravaux = lots.reduce(function(s, l) { return s + pf(l.travaux); }, 0);
  const totalCharges = lots.reduce(function(s, l) { return s + pf(l.charges); }, 0);
  const surfOk = surfaceGlobale > 0 ? Math.abs(totalSurface - surfaceGlobale) < 1 : true;
  const loyerOk = loyerGlobal > 0 ? Math.abs(totalLoyer - loyerGlobal) < 1 : true;
  const addLot = function() {
    const newId = lots.length > 0 ? Math.max.apply(null, lots.map(function(l) { return l.id; })) + 1 : 1;
    onChange(lots.concat([{ id: newId, nom: "Lot " + newId, surface: "", loyer: "", travaux: "", charges: "" }]));
  };
  const removeLot = function(id) { if (lots.length <= 1) return; onChange(lots.filter(function(l) { return l.id !== id; })); };
  const updateLot = function(id, field, value) { onChange(lots.map(function(l) { return l.id === id ? Object.assign({}, l, { [field]: value }) : l; })); };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Détail des lots ({lots.length})</div>
        <button onClick={addLot} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 8, padding: "5px 12px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>+ Lot</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lots.map(function(lot, idx) {
          return (
            <div key={lot.id} style={{ background: "rgba(248,250,252,0.9)", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(148,163,184,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: "linear-gradient(135deg,#6366f1,#38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>#{idx + 1}</div>
                  <input value={lot.nom} onChange={function(e) { updateLot(lot.id, "nom", e.target.value); }} style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", background: "transparent", border: "none", outline: "none", borderBottom: "1px dashed #cbd5e1" }} />
                </div>
                <button onClick={function() { removeLot(lot.id); }} style={{ background: "rgba(239,68,68,0.08)", border: "none", borderRadius: 6, padding: "2px 8px", color: "#dc2626", cursor: lots.length > 1 ? "pointer" : "not-allowed", fontSize: 11, opacity: lots.length > 1 ? 1 : 0.3 }}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                {[{ label: "Surface (m²)", field: "surface", unit: "m²", step: "1" }, { label: "Loyer HC/mois", field: "loyer", unit: "€", step: "50" }, { label: "Travaux", field: "travaux", unit: "€", step: "500" }, { label: "Charges/an", field: "charges", unit: "€", step: "100" }].map(function(col) {
                  return (<div key={col.field}>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 3 }}>{col.label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <input type="number" value={lot[col.field]} step={col.step} min="0" onChange={function(e) { updateLot(lot.id, col.field, e.target.value); }}
                        style={{ width: "100%", background: "rgba(255,255,255,0.9)", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 7, padding: "4px 7px", fontSize: 12, color: "#0f172a", outline: "none" }} />
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>{col.unit}</span>
                    </div>
                  </div>);
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {[
          { label: "Σ Surface", value: fmt(totalSurface, 0) + " m²", ok: surfOk, ref: surfaceGlobale > 0, refVal: fmt(surfaceGlobale, 0) + " m²" },
          { label: "Σ Loyers", value: fmtEur(totalLoyer), ok: loyerOk, ref: loyerGlobal > 0, refVal: fmtEur(loyerGlobal) },
          { label: "Σ Travaux", value: fmtEur(totalTravaux), ok: true, ref: false },
          { label: "Σ Charges", value: fmtEur(totalCharges), ok: true, ref: false },
        ].map(function(s) {
          return (<div key={s.label} style={{ background: s.ref ? (s.ok ? "rgba(220,252,231,0.7)" : "rgba(254,243,199,0.7)") : "rgba(241,245,249,0.7)", borderRadius: 10, padding: "7px 10px", border: "1px solid " + (s.ref ? (s.ok ? "rgba(22,163,74,0.2)" : "rgba(251,191,36,0.3)") : "rgba(148,163,184,0.15)") }}>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{s.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: s.ref ? (s.ok ? "#15803d" : "#92400e") : "#0f172a" }}>{s.value} {s.ref && <span style={{ fontSize: 10, fontWeight: 400 }}>{s.ok ? "✓" : "≠ " + s.refVal}</span>}</div>
          </div>);
        })}
      </div>
      {(!surfOk && surfaceGlobale > 0) && <div style={{ marginTop: 6, background: "rgba(254,243,199,0.9)", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "#92400e" }}>⚠ Surfaces : {fmt(totalSurface, 0)} m² ≠ {fmt(surfaceGlobale, 0)} m² (global)</div>}
      {(!loyerOk && loyerGlobal > 0) && <div style={{ marginTop: 4, background: "rgba(254,243,199,0.9)", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "#92400e" }}>⚠ Loyers : {fmtEur(totalLoyer)} ≠ {fmtEur(loyerGlobal)} (global)</div>}
    </div>
  );
}
const DEFAULT_INPUTS = {
  commune: "",
  prixVente: "175000", fraisNotaire: "13300", travaux: "0", amenagements: "0",
  fraisAgencePct: "5", apport: "14000", tauxCredit: "4.2", dureeAnnees: "25",
  surfaceGlobale: "0", loyerMensuelHC: "1000", tauxOccupation: "11.5",
  chargesImmeubleAn: "250", taxeFonciereAn: "1400", assurancePNOAn: "0",
  gestionLocativePct: "0", provisionTravauxAn: "0", fraisBancairesAn: "300",
  expertComptableAn: "600", coefAmortissement: "4.75", tauxIS: "15", tmi: "11",
  noteDPE: "",
  gliPct: "0",
};

function SimulationProjet({ photos, setPhotos, projets, setProjets, projetACharger, onProjetCharge }) {
  const [inputs, setInputs] = useState(function() {
    // Pas de persistence directe des inputs - on repart de DEFAULT_INPUTS
    // La persistence se fait via les projets sauvegardés
    return Object.assign({}, DEFAULT_INPUTS);
  });
  const [lots, setLots] = useState([Object.assign({}, LOT_DEFAULT)]);
  const [regimeActif, setRegimeActif] = useState("SAS / SCI IS");
  const [nomProjet, setNomProjet] = useState("");
  // projets et photos reçus en props depuis App (persistent lors des changements d'onglet)
  // Sync photos dans localStorage à chaque modif
  useEffect(function() {
    try { localStorage.setItem("radar-immo-photos-v1", JSON.stringify(photos)); }
    catch(e) {}
  }, [photos]);

  // Commune + donnees marche
  const [communeSearch, setCommuneSearch] = useState(inputs.commune || "");
  const [communeSuggestions, setCommuneSuggestions] = useState([]);
  const [donneesCommune, setDonneesCommune] = useState(null);
  const [loadingCommune, setLoadingCommune] = useState(false);

  // Autocompletion dans le cache sessionStorage des communes
  useEffect(function() {
    if (!communeSearch || communeSearch.length < 2) { setCommuneSuggestions([]); return; }
    try {
      var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY)) || [];
      var matches = cached.filter(function(c) {
        return c.nom.toLowerCase().includes(communeSearch.toLowerCase());
      }).slice(0, 6);
      setCommuneSuggestions(matches);
    } catch(e) { setCommuneSuggestions([]); }
  }, [communeSearch]);

  // Charger les données de la commune sélectionnée
  var fetchDonneesCommune = useCallback(function(nom) {
    if (!nom) return;
    // Chercher dans le cache sessionStorage (instantane, pas d appel API)
    try {
      var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY)) || [];
      var found = cached.find(function(c) { return c.nom === nom; });
      if (found && (found.prix || found.loyer)) {
        setDonneesCommune(found);
        return;
      }
    } catch(e) {}
    // Cache absent : appel API
    setLoadingCommune(true);
    setDonneesCommune(null);
    fetch(API_BASE + "/analyse/" + encodeURIComponent(nom))
      .then(function(r) { if (!r.ok) throw new Error("Erreur"); return r.json(); })
      .then(function(d) { setDonneesCommune(d); })
      .catch(function() { setDonneesCommune(null); })
      .finally(function() { setLoadingCommune(false); });
  }, []);

  useEffect(function() {
    if (inputs.commune) {
      setCommuneSearch(inputs.commune);
      fetchDonneesCommune(inputs.commune);
    }
  }, [inputs.commune]);

  // Charger un projet depuis l'onglet Favoris
  useEffect(function() {
    if (!projetACharger) return;
    // Merger avec DEFAULT_INPUTS pour ne jamais perdre les nouveaux champs
    var mergedInputs = Object.assign({}, DEFAULT_INPUTS, projetACharger.inputs);
    setInputs(mergedInputs);
    setRegimeActif(projetACharger.regimeActif || "SAS SCI IS");
    if (projetACharger.lots) setLots(projetACharger.lots);
    setNomProjet(projetACharger.nom);
    var restoredPhotos = projetACharger.photos || [];
    setPhotos(restoredPhotos);
    // Sync commune si présente
    if (mergedInputs.commune) {
      setCommuneSearch(mergedInputs.commune);
      fetchDonneesCommune(mergedInputs.commune);
    }
    try { localStorage.setItem("radar-immo-photos-v1", JSON.stringify(restoredPhotos)); } catch(e) {}
    if (onProjetCharge) onProjetCharge();
  }, [projetACharger]);

  const handlePhotos = function(e) {
    var files = Array.from(e.target.files);
    files.forEach(function(file) {
      var reader = new FileReader();
      reader.onload = function(ev) {
        setPhotos(function(prev) {
          var updated = prev.concat({ id: Date.now() + Math.random(), url: ev.target.result, name: file.name });
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removePhoto = function(id) {
    setPhotos(function(prev) { return prev.filter(function(p) { return p.id !== id; }); });
  };
  const [activeTab, setActiveTab] = useState("params");

  const handleChange = function(e) { const name = e.target.name; const value = e.target.value; setInputs(function(prev) { return Object.assign({}, prev, { [name]: value }); }); };
   const sauvegarder = function() {
    if (!nomProjet.trim()) return;
    const existing = projets.find(function(p) { return p.nom === nomProjet.trim(); });
    const entry = {
      id: existing ? existing.id : Date.now(),
      nom: nomProjet.trim(),
      inputs: Object.assign({}, inputs),
      lots: lots,
      regimeActif: regimeActif,
      savedAt: new Date().toLocaleDateString("fr-FR"),
      coverPhoto: photos.length > 0 ? photos[0].url : (existing ? existing.coverPhoto : null),
      photos: photos,
    };
    const liste = [entry].concat(projets.filter(function(p) { return p.nom !== nomProjet.trim(); }));
    setProjets(liste);
    localStorage.setItem(PROJETSKEY, JSON.stringify(liste));
    // Ne PAS vider nomProjet ici pour permettre de ré-enregistrer
  };
  const charger = function(p) {
    setInputs(p.inputs);
    setRegimeActif(p.regimeActif);
    if (p.lots) setLots(p.lots);
    setNomProjet(p.nom);
    var restoredPhotos = p.photos || [];
    setPhotos(restoredPhotos);
    try { localStorage.setItem("radar-immo-photos-v1", JSON.stringify(restoredPhotos)); } catch(e) {}
  };
  const supprimer = function(id) { const liste = projets.filter(function(p) { return p.id !== id; }); setProjets(liste); localStorage.setItem(PROJETSKEY, JSON.stringify(liste)); };

  const exportJSON = function() {
    var data = { nom: nomProjet, inputs: inputs, lots: lots, regimeActif: regimeActif };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "simulation-" + (nomProjet || "projet") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (data.inputs) setInputs(data.inputs);
        if (data.lots) setLots(data.lots);
        if (data.regimeActif) setRegimeActif(data.regimeActif);
        if (data.nom) setNomProjet(data.nom);
      } catch(err) { alert("Fichier JSON invalide"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const exportPDF = async function() {
    if (!window.jspdf) {
      alert("jsPDF non chargé. Vérifiez que le script jsPDF est bien dans votre index.html :\n<script src=\"https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js\"></script>");
      return;
    }
    try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const H = 297;
    const BLEU = [30, 58, 138]; const BLEU_CLAIR = [99, 102, 241]; const GRIS = [100, 116, 139];
    const VERT = [22, 163, 74]; const ROUGE = [220, 38, 38]; const ORANGE = [217, 119, 6];
    const BG = [248, 250, 252];

    var pv = pf(inputs.prixVente);
    var surf = pf(inputs.surfaceGlobale);
    var r = result;
    var regime = r.regimes[regimeActif];
    var tresoPMois = regime.tresorerie / 12;
    var prixM2 = surf > 0 ? pv / surf : null;
    var lotsDesc = lots.map(function(l) { return l.nom + (l.surface ? " (" + l.surface + " m²)" : "") + (l.loyer ? " — " + fmt(pf(l.loyer), 0) + " €/mois" : ""); }).join("\n");

    // ── Helpers ──────────────────────────────────────────────────────────────
    function hdr(title, subtitle) {
      doc.setFillColor(BLEU[0], BLEU[1], BLEU[2]);
      doc.rect(0, 0, W, 22, "F");
      doc.setFillColor(BLEU_CLAIR[0], BLEU_CLAIR[1], BLEU_CLAIR[2]);
      doc.rect(0, 20, W, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text(title, 14, 14);
      if (subtitle) { doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(subtitle, W - 14, 14, { align: "right" }); }
      doc.setTextColor(30, 41, 59);
    }
    function footer(n) {
      doc.setFillColor(BLEU[0], BLEU[1], BLEU[2]);
      doc.rect(0, H - 10, W, 10, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text("Généré par Radar Immo 76", 14, H - 3.5);
      doc.text("Page " + n, W - 14, H - 3.5, { align: "right" });
      doc.setTextColor(30, 41, 59);
    }
    function section(title, y) {
      doc.setFillColor(BLEU_CLAIR[0], BLEU_CLAIR[1], BLEU_CLAIR[2]);
      doc.roundedRect(14, y, W - 28, 8, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.text(title, 18, y + 5.5);
      doc.setTextColor(30, 41, 59);
      return y + 12;
    }
    function kpiRow(items, y) {
      var colW = (W - 28) / items.length;
      items.forEach(function(item, i) {
        var x = 14 + i * colW;
        doc.setFillColor(BG[0], BG[1], BG[2]);
        doc.roundedRect(x, y, colW - 3, 18, 2, 2, "F");
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
        doc.text(item.label, x + (colW - 3) / 2, y + 5, { align: "center" });
        var vc = item.color || BLEU;
        doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(vc[0], vc[1], vc[2]);
        doc.text(item.value, x + (colW - 3) / 2, y + 13, { align: "center" });
      });
      doc.setTextColor(30, 41, 59);
      return y + 22;
    }
    function row2(label, value, y, color) {
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
      doc.text(label, 16, y);
      var vc = color || [30, 41, 59];
      doc.setFont("helvetica", "bold"); doc.setTextColor(vc[0], vc[1], vc[2]);
      doc.text(value, W - 16, y, { align: "right" });
      doc.setDrawColor(220, 220, 220); doc.line(14, y + 1.5, W - 14, y + 1.5);
      doc.setTextColor(30, 41, 59);
      return y + 7;
    }
    function col3block(x, y, w, title, rows) {
      doc.setFillColor(BG[0], BG[1], BG[2]);
      doc.roundedRect(x, y, w, 6 + rows.length * 7, 2, 2, "F");
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(BLEU[0], BLEU[1], BLEU[2]);
      doc.text(title, x + 3, y + 4.5);
      rows.forEach(function(r2, i) {
        var ry = y + 10 + i * 7;
        doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
        doc.text(r2[0], x + 3, ry);
        doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59);
        doc.text(r2[1], x + w - 3, ry, { align: "right" });
      });
      doc.setTextColor(30, 41, 59);
    }
    function pieChart(cx, cy, radius, data) {
      var total = data.reduce(function(s, d) { return s + d.value; }, 0);
      if (total === 0) return;
      var angle = -Math.PI / 2;
      data.forEach(function(d) {
        var slice = (d.value / total) * 2 * Math.PI;
        doc.setFillColor(d.color[0], d.color[1], d.color[2]);
        var steps = Math.max(6, Math.round(slice * 12));
        var pts = [[cx, cy]];
        for (var i = 0; i <= steps; i++) { var a = angle + (slice * i / steps); pts.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]); }
        pts.push([cx, cy]);
        doc.lines(pts.slice(1).map(function(p, i) { return [p[0] - pts[i][0], p[1] - pts[i][1]]; }), pts[0][0], pts[0][1], [1, 1], "F");
        angle += slice;
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // PAGE 1 — Page de garde
    // ═══════════════════════════════════════════════════════════════
    hdr("Dossier d'investissement immobilier", new Date().toLocaleDateString("fr-FR"));

    // Photo si disponible
    var photoY = 28;
    if (photos && photos[0] && photos[0].url) {
      try { doc.addImage(photos[0].url, "JPEG", 14, photoY, W - 28, 55, "", "MEDIUM"); photoY += 58; }
      catch(e) { photoY += 2; }
    }

    // Titre projet
    doc.setFillColor(BLEU[0], BLEU[1], BLEU[2]);
    doc.roundedRect(14, photoY, W - 28, 16, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text(nomProjet || "Projet immobilier", W / 2, photoY + 7, { align: "center" });
    if (inputs.commune) { doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("📍 " + inputs.commune, W / 2, photoY + 13, { align: "center" }); }
    doc.setTextColor(30, 41, 59);
    photoY += 20;

    // KPIs principaux
    photoY = kpiRow([
      { label: "Prix d'achat FAI", value: fmt(pv, 0) + " €", color: BLEU },
      { label: "Superficie", value: surf > 0 ? fmt(surf, 0) + " m²" : "—", color: BLEU },
      { label: "Rendement brut", value: fmtPct(r.rendBrut), color: VERT },
      { label: "Cash-flow/mois", value: (tresoPMois >= 0 ? "+" : "") + fmt(tresoPMois, 0) + " €", color: tresoPMois >= 0 ? VERT : ROUGE },
    ], photoY);

    // Lots
    if (lots && lots.length > 0) {
      photoY = section("📦 Descriptif des lots", photoY);
      lots.forEach(function(l) {
        doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59);
        doc.text("• " + l.nom, 18, photoY);
        doc.setFont("helvetica", "normal"); doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
        var details = [];
        if (l.surface) details.push(l.surface + " m²");
        if (l.loyer) details.push(fmt(pf(l.loyer), 0) + " €/mois");
        if (l.travaux) details.push("travaux : " + fmt(pf(l.travaux), 0) + " €");
        if (details.length > 0) doc.text(details.join(" · "), W - 16, photoY, { align: "right" });
        photoY += 7;
      });
      photoY += 4;
    }

    // KPIs secondaires
    photoY = section("📊 Indicateurs rapides", photoY);
    photoY = kpiRow([
      { label: "Régime fiscal", value: regimeActif, color: BLEU_CLAIR },
      { label: "Loyer mensuel HC", value: fmt(pf(inputs.loyerMensuelHC), 0) + " €", color: VERT },
      { label: "Mensualité crédit", value: fmt(r.mensualite, 0) + " €", color: ORANGE },
      { label: "Durée", value: fmt(pf(inputs.dureeAnnees), 0) + " ans", color: GRIS },
    ], photoY);

    if (inputs.noteDPE) {
      doc.setFillColor(BG[0], BG[1], BG[2]);
      doc.roundedRect(14, photoY, 40, 14, 2, 2, "F");
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
      doc.text("DPE", 34, photoY + 5, { align: "center" });
      doc.setFontSize(16); doc.setTextColor(30, 41, 59);
      doc.text(inputs.noteDPE, 34, photoY + 12, { align: "center" });
      photoY += 18;
    }

    footer(1);

    // ═══════════════════════════════════════════════════════════════
    // PAGE 2 — Analyse financière
    // ═══════════════════════════════════════════════════════════════
    doc.addPage();
    hdr("Analyse financière du projet", nomProjet || "");

    var y = 28;
    y = kpiRow([
      { label: "Loyer mensuel HC", value: fmt(pf(inputs.loyerMensuelHC), 0) + " €", color: VERT },
      { label: "Charges mensuelles", value: fmt((r.totalFraisAnnuels + r.remboursementAnnuel) / 12, 0) + " €", color: ORANGE },
      { label: "Cash-Flow mensuel", value: (tresoPMois >= 0 ? "+" : "") + fmt(tresoPMois, 0) + " €", color: tresoPMois >= 0 ? VERT : ROUGE },
    ], y);

    y = kpiRow([
      { label: "Rendement brut", value: fmtPct(r.rendBrut), color: VERT },
      { label: "Rendement net (" + regimeActif + ")", value: fmtPct(regime.rendNet), color: VERT },
      { label: "Règle des 70 %", value: regime.regle70 != null ? fmtPct(regime.regle70) : "—", color: regime.regle70 != null && regime.regle70 <= 0.7 ? VERT : ROUGE },
    ], y);

    // Bloc 3 colonnes : Achat | Crédit | Indicateurs
    y = section("🏠 Achat  ·  💳 Crédit  ·  📈 Indicateurs clés", y);
    var colW3 = (W - 28 - 6) / 3;
    col3block(14, y, colW3, "Achat", [
      ["Prix d'achat FAI", fmt(pv, 0) + " €"],
      ["Frais de notaire", fmt(pf(inputs.fraisNotaire), 0) + " €"],
      ["Travaux", fmt(pf(inputs.travaux), 0) + " €"],
      ["Aménagements", fmt(pf(inputs.amenagements), 0) + " €"],
      ["Frais d'agence", fmt(pv * pf(inputs.fraisAgencePct) / 100, 0) + " €"],
      ["TOTAL ACHAT", fmt(r.depenseNette, 0) + " €"],
    ]);
    col3block(14 + colW3 + 3, y, colW3, "Crédit", [
      ["Apport", fmt(pf(inputs.apport), 0) + " €"],
      ["Montant emprunté", fmt(r.sommeEmpruntee, 0) + " €"],
      ["Taux crédit", pf(inputs.tauxCredit) + " %"],
      ["Durée", pf(inputs.dureeAnnees) + " ans"],
      ["Mensualité", fmt(r.mensualite, 0) + " €"],
      ["Coût total crédit", fmt(r.coutPretTotal, 0) + " €"],
    ]);
    col3block(14 + colW3 * 2 + 6, y, colW3, "Indicateurs clés", [
      ["Prix/m² achat", prixM2 ? fmt(prixM2, 0) + " €/m²" : "—"],
      ["Rdt brut", fmtPct(r.rendBrut)],
      ["Rdt net", fmtPct(regime.rendNet)],
      ["Cash-flow annuel", fmt(regime.tresorerie, 0) + " €"],
      ["Cash-flow mensuel", fmt(tresoPMois, 0) + " €"],
      ["TRI payback", regime.tri != null ? fmt(regime.tri, 1) + " ans" : "—"],
    ]);
    y += 6 + 6 * 7 + 8;

    // Charges annuelles détaillées
    y = section("💰 Charges annuelles détaillées", y);
    var chargesRows = [
      ["Charges immeuble", fmt(pf(inputs.chargesImmeubleAn), 0) + " €/an"],
      ["Taxe foncière", fmt(pf(inputs.taxeFonciereAn), 0) + " €/an"],
      ["Assurance PNO", fmt(pf(inputs.assurancePNOAn) || r.depenseNette * 0.0012, 0) + " €/an"],
      ["Gestion locative (" + pf(inputs.gestionLocativePct) + " %)", fmt(r.loyersAnnuels * pf(inputs.gestionLocativePct) / 100, 0) + " €/an"],
      ["GLI (" + pf(inputs.gliPct) + " %)", fmt(r.loyersAnnuels * pf(inputs.gliPct) / 100, 0) + " €/an"],
      ["Provision travaux", fmt(pf(inputs.provisionTravauxAn), 0) + " €/an"],
      ["Frais bancaires", fmt(pf(inputs.fraisBancairesAn), 0) + " €/an"],
      ["Expert-comptable / CFE", fmt(pf(inputs.expertComptableAn), 0) + " €/an"],
      ["TOTAL CHARGES", fmt(r.totalFraisAnnuels, 0) + " €/an"],
    ];

    // Pie chart + liste charges côte à côte
    var pieData = [
      { label: "Taxe foncière", value: pf(inputs.taxeFonciereAn), color: [99, 102, 241] },
      { label: "Assurance", value: pf(inputs.assurancePNOAn) || r.depenseNette * 0.0012, color: [14, 165, 233] },
      { label: "Gestion", value: r.loyersAnnuels * pf(inputs.gestionLocativePct) / 100, color: [34, 197, 94] },
      { label: "GLI", value: r.loyersAnnuels * pf(inputs.gliPct) / 100, color: [56, 189, 248] },
      { label: "Provision travaux", value: pf(inputs.provisionTravauxAn), color: [249, 115, 22] },
      { label: "Frais bancaires", value: pf(inputs.fraisBancairesAn), color: [168, 85, 247] },
      { label: "Comptable/CFE", value: pf(inputs.expertComptableAn), color: [236, 72, 153] },
      { label: "Charges immeuble", value: pf(inputs.chargesImmeubleAn), color: [245, 158, 11] },
    ].filter(function(d) { return d.value > 0; });

    pieChart(45, y + 22, 18, pieData);
    // légende pie
    pieData.slice(0, 6).forEach(function(d, i) {
      doc.setFillColor(d.color[0], d.color[1], d.color[2]);
      doc.rect(68, y + 4 + i * 6, 3, 3, "F");
      doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
      doc.text(d.label + " : " + fmt(d.value, 0) + " €", 73, y + 6.5 + i * 6);
    });
    // liste charges à droite
    chargesRows.forEach(function(cr, i) {
      var isTotal = cr[0].startsWith("TOTAL");
      if (isTotal) { doc.setDrawColor(BLEU[0], BLEU[1], BLEU[2]); doc.line(W / 2 + 5, y + 1 + i * 6.5, W - 14, y + 1 + i * 6.5); }
      doc.setFontSize(isTotal ? 9 : 8); doc.setFont("helvetica", isTotal ? "bold" : "normal");
      doc.setTextColor(isTotal ? BLEU[0] : GRIS[0], isTotal ? BLEU[1] : GRIS[1], isTotal ? BLEU[2] : GRIS[2]);
      doc.text(cr[0], W / 2 + 7, y + 5 + i * 6.5);
      doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59);
      doc.text(cr[1], W - 16, y + 5 + i * 6.5, { align: "right" });
    });
    y += 58;

    footer(2);

    // ═══════════════════════════════════════════════════════════════
    // PAGE 3 — Analyse du secteur (commune)
    // ═══════════════════════════════════════════════════════════════
    doc.addPage();
    hdr("Analyse du secteur", inputs.commune || "Commune non renseignée");
    y = 28;

    if (donneesCommune && donneesCommune.scores) {
      var dc = donneesCommune;
      var pri = dc.prix || {};
      var loy = dc.loyer || {};
      var dem = dc.demographie || {};
      var se = dc.socio_eco || {};

      y = kpiRow([
        { label: "Habitants", value: dc.population ? dc.population.toLocaleString("fr-FR") : "—", color: BLEU },
        { label: "Tension locative", value: dem.tension_locative_pct != null ? dem.tension_locative_pct + " %" : "—", color: dem.tension_locative_pct > 10 ? ROUGE : VERT },
        { label: "Prix moyen appart.", value: pri.appartement_m2 ? fmt(pri.appartement_m2, 0) + " €/m²" : "—", color: BLEU },
        { label: "Loyer médian", value: loy.appartement_m2 != null ? Number(loy.appartement_m2).toFixed(1) + " €/m²" : "—", color: VERT },
      ], y);

      // Si on a le prix/m² projet, afficher la comparaison
      if (prixM2 && pri.appartement_m2) {
        var diff = (prixM2 - Number(pri.appartement_m2)) / Number(pri.appartement_m2) * 100;
        var diffColor = diff > 10 ? ROUGE : diff > 0 ? ORANGE : VERT;
        doc.setFillColor(BG[0], BG[1], BG[2]);
        doc.roundedRect(14, y, W - 28, 14, 2, 2, "F");
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
        doc.text("Votre prix/m² (" + fmt(prixM2, 0) + " €/m²) vs marché (" + fmt(Number(pri.appartement_m2), 0) + " €/m²) :", 18, y + 6);
        doc.setFont("helvetica", "bold"); doc.setTextColor(diffColor[0], diffColor[1], diffColor[2]);
        doc.text((diff >= 0 ? "+" : "") + diff.toFixed(1) + " % — " + (diff < 0 ? "Achat sous le marché ✓" : diff < 10 ? "Légèrement au-dessus" : "Au-dessus du marché"), 18, y + 12);
        y += 18;
      }

      y = section("🏘️ Informations sur la commune", y);
      var infoRows = [
        ["Score global", dc.scores.global != null ? dc.scores.global.toFixed(1) + " / 10" : "—"],
        ["Score rendement", dc.scores.rendement != null ? dc.scores.rendement.toFixed(1) + " / 10" : "—"],
        ["Score démographie", dc.scores.demographie != null ? dc.scores.demographie.toFixed(1) + " / 10" : "—"],
        ["Score socio-éco", dc.scores.socio_eco != null ? dc.scores.socio_eco.toFixed(1) + " / 10" : "—"],
        ["Revenu médian", se.revenu_median ? se.revenu_median.toLocaleString("fr-FR") + " €" : "—"],
        ["Taux de chômage", se.chomage_pct != null ? se.chomage_pct + " %" : "—"],
        ["Taux de pauvreté", se.taux_pauvrete_pct != null ? se.taux_pauvrete_pct + " %" : "—"],
        ["Vacance logements", dem.vacance_pct != null ? dem.vacance_pct + " %" : "—"],
        ["Évolution pop./an", dem.evolution_pop_pct_an != null ? dem.evolution_pop_pct_an + " %" : "—"],
        ["Zone ABC", dc.zonage_abc || "—"],
        ["Rentabilité brute estimée", dc.rentabilite_brute_pct ? dc.rentabilite_brute_pct + " %" : "—"],
      ];
      infoRows.forEach(function(ir) { y = row2(ir[0], ir[1], y); });
    } else {
      doc.setFontSize(11); doc.setFont("helvetica", "italic"); doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
      doc.text("Aucune commune renseignée — renseigne la commune dans le simulateur pour afficher l'analyse du secteur.", 14, y + 20, { maxWidth: W - 28 });
    }

    footer(3);

    // ═══════════════════════════════════════════════════════════════
    // PAGE 4 — Analyse patrimoniale & bilan comptable
    // ═══════════════════════════════════════════════════════════════
    doc.addPage();
    hdr("Analyse patrimoniale", nomProjet || "");
    y = 28;

    y = kpiRow([
      { label: "Loyers annuels HC", value: fmt(r.loyersAnnuels, 0) + " €", color: VERT },
      { label: "Amortissement annuel", value: fmt(r.amortissement, 0) + " €", color: BLEU },
      { label: "Régime fiscal", value: regimeActif, color: BLEU_CLAIR },
    ], y);

    // Comparatif régimes
    y = section("⚖️ Comparatif des régimes fiscaux", y);
    var regCols = ["Régime", "Trésorerie/an", "Cash-flow/mois", "Impôts/an", "Rdt brut", "Rdt net"];
    var regColX = [14, 50, 86, 116, 146, 168];
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    regCols.forEach(function(h, i) { doc.text(h, regColX[i], y); });
    y += 5; doc.setDrawColor(200, 200, 200); doc.line(14, y, W - 14, y); y += 4;
    Object.entries(r.regimes).forEach(function(entry) {
      var nom = entry[0]; var reg = entry[1];
      var isActive = nom === regimeActif;
      if (isActive) { doc.setFillColor(238, 242, 255); doc.rect(14, y - 3.5, W - 28, 6.5, "F"); }
      doc.setFontSize(8); doc.setFont("helvetica", isActive ? "bold" : "normal"); doc.setTextColor(30, 41, 59);
      doc.text(nom, regColX[0], y);
      doc.text(fmt(reg.tresorerie, 0) + " €", regColX[1], y);
      var cfm = reg.tresorerie / 12; doc.setTextColor(cfm >= 0 ? VERT[0] : ROUGE[0], cfm >= 0 ? VERT[1] : ROUGE[1], cfm >= 0 ? VERT[2] : ROUGE[2]);
      doc.text(fmt(cfm, 0) + " €", regColX[2], y);
      doc.setTextColor(ROUGE[0], ROUGE[1], ROUGE[2]);
      doc.text(fmt(reg.impot, 0) + " €", regColX[3], y);
      doc.setTextColor(30, 41, 59);
      doc.text(fmtPct(reg.rendBrut), regColX[4], y);
      doc.text(fmtPct(reg.rendNet), regColX[5], y);
      y += 7; doc.setDrawColor(240, 240, 240); doc.line(14, y - 2, W - 14, y - 2);
    });
    y += 4;

    // Tableau bilan annuel (cashflow projeté)
    y = section("📅 Bilan prévisionnel annuel — " + regimeActif, y);
    var cfData = cashFlowData;
    var maxRows = Math.min(cfData.length, Math.floor((H - y - 20) / 6.5));
    var tblCols = ["Année", "Loyers", "Annuité", "Charges", "Impôts", "Cash-flow", "Rdt net"];
    var tblX = [14, 40, 65, 93, 120, 148, 178];
    doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    tblCols.forEach(function(h, i) { doc.text(h, tblX[i], y); });
    y += 4; doc.setDrawColor(200, 200, 200); doc.line(14, y, W - 14, y); y += 4;
    cfData.slice(0, maxRows).forEach(function(d, idx) {
      if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(14, y - 3.5, W - 28, 6, "F"); }
      doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(30, 41, 59);
      doc.text(String(d.year), tblX[0], y);
      doc.text(fmt(d.loyers, 0) + " €", tblX[1], y);
      doc.text((d.credit > 0 ? "-" : "") + fmt(d.credit, 0) + " €", tblX[2], y);
      doc.text("-" + fmt(d.frais, 0) + " €", tblX[3], y);
      doc.text("-" + fmt(d.impots, 0) + " €", tblX[4], y);
      var cfColor = d.cashflow >= 0 ? VERT : ROUGE;
      doc.setTextColor(cfColor[0], cfColor[1], cfColor[2]); doc.setFont("helvetica", "bold");
      doc.text((d.cashflow >= 0 ? "+" : "") + fmt(d.cashflow, 0) + " €", tblX[5], y);
      doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "normal");
      var rn = r.depenseNette > 0 ? (d.cashflow / r.depenseNette * 100) : 0;
      doc.text(fmtPct(rn), tblX[6], y);
      y += 6.5;
    });

    footer(4);

    doc.save("dossier-" + (nomProjet || "projet").replace(/\s+/g, "-") + ".pdf");
    } catch(e) { console.error("Erreur PDF:", e); alert("Erreur lors de la génération du PDF : " + e.message); }
  };

  const result = useMemo(function() { return calculerSimulation(inputs); }, [inputs]);
  const regime = result.regimes[regimeActif];
  const cashFlowData = useMemo(function() { return projeterCashFlow(inputs, regimeActif); }, [inputs, regimeActif]);
  const note = useMemo(function() { return calculerNote(result, regimeActif); }, [result, regimeActif]);
  const noteColor = getNoteColor(note);
  const noteLabel = getNoteLabel(note);
  const couleurTreso = regime.tresorerie >= 0 ? "#16a34a" : "#f97316";
  const couleur70 = regime.regle70 != null && regime.regle70 < 0.7 ? "#16a34a" : "#ef4444";
  const circumference = 2 * Math.PI * 28;
  const dash = (Math.min(100, Math.max(0, note)) / 100) * circumference;
  const tresoPMois = regime.tresorerie / 12;

  const tabs = [{ id: "params", label: "Paramètres" }, { id: "bilan", label: "Bilan" }, { id: "projection", label: "Projection" }, { id: "comparatif", label: "Comparatif" }];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header projet */}
      <div style={Object.assign({}, SECTION, { padding: "14px 20px" })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <svg width="60" height="60" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="7" />
                <circle cx="36" cy="36" r="28" fill="none" stroke={noteColor} strokeWidth="7" strokeDasharray={dash + " " + circumference} strokeLinecap="round" transform="rotate(-90 36 36)" style={{ transition: "stroke-dasharray 0.5s ease" }} />
                <text x="36" y="40" textAnchor="middle" fontSize="17" fontWeight="700" fill={noteColor}>{note}</text>
              </svg>
              <div style={{ fontSize: 10, fontWeight: 600, color: noteColor }}>{noteLabel}</div>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Simulation projet</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {pf(inputs.prixVente) > 0 && <span>{fmt(pf(inputs.prixVente))} € · </span>}
                {pf(inputs.surfaceGlobale) > 0 && <span>{fmt(pf(inputs.surfaceGlobale), 0)} m² · </span>}
                                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                  <Tag color="purple">{regimeActif}</Tag>
                  {inputs.noteDPE && (
                    <span style={{ fontWeight: 800, fontSize: 13, padding: "1px 8px", borderRadius: 6,
                      background: { A:"#16a34a",B:"#4ade80",C:"#a3e635",D:"#facc15",E:"#fb923c",F:"#f97316",G:"#dc2626" }[inputs.noteDPE] + "22",
                      color: { A:"#15803d",B:"#166534",C:"#3f6212",D:"#854d0e",E:"#9a3412",F:"#7c2d12",G:"#991b1b" }[inputs.noteDPE],
                      border: "1px solid " + { A:"#16a34a",B:"#4ade80",C:"#a3e635",D:"#facc15",E:"#fb923c",F:"#f97316",G:"#dc2626" }[inputs.noteDPE] + "44" }}>
                      DPE {inputs.noteDPE}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {[
              { label: "Loyers/mois", value: fmtEur(pf(inputs.loyerMensuelHC)), color: "#0ea5e9" },
              { label: "Rdt brut", value: fmtPct(result.rendBrut), color: "#6366f1" },
              { label: "Rdt net", value: fmtPct(regime.rendNet), color: "#16a34a" },
              { label: "Cashflow/mois", value: (tresoPMois >= 0 ? "+" : "") + fmt(tresoPMois, 0) + " €", color: tresoPMois >= 0 ? "#16a34a" : "#dc2626" },
            ].map(function(s) {
              return (<div key={s.label} style={{ textAlign: "center", minWidth: 80 }}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>);
            })}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={nomProjet} onChange={function(e) { setNomProjet(e.target.value); }} placeholder="Nom du projet…"
              style={{ background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "6px 12px", fontSize: 12, color: "#0f172a", width: 160, outline: "none" }} />
            <button onClick={sauvegarder} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 10, padding: "7px 14px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500, opacity: nomProjet.trim() ? 1 : 0.5 }}>💾 Sauver</button>
            <button onClick={exportJSON} style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, padding: "7px 12px", color: "#4338ca", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>⬇️ JSON</button>
            <label style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, padding: "7px 12px", color: "#4338ca", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
              ⬆️ Import<input type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />
            </label>
            <button onClick={exportPDF} style={{ background: "linear-gradient(135deg,#dc2626,#f97316)", border: "none", borderRadius: 10, padding: "7px 12px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>📄 Export PDF</button>
          </div>
        </div>
        {projets.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {projets.map(function(p) {
              return (<div key={p.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 8, padding: "3px 10px" }}>
                {p.coverPhoto && <img src={p.coverPhoto} alt="" style={{ width: 36, height: 28, objectFit: "cover", borderRadius: 5, flexShrink: 0 }} />}
                <button onClick={function() { charger(p); }} style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "#4338ca", cursor: "pointer" }}>📂 {p.nom}</button>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>{p.savedAt}</span>
                <button onClick={function() { supprimer(p.id); }} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 11 }}>✕</button>
              </div>);
            })}
          </div>
        )}
      </div>

      {/* ── Bloc Photos ── */}
      <div style={Object.assign({}, SECTION, { padding: "14px 20px" })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: photos.length > 0 ? 12 : 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>📷 Photos du projet <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400 }}>({photos.length} photo{photos.length > 1 ? "s" : ""})</span></div>
          <label style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, padding: "6px 14px", color: "#4338ca", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
            + Ajouter
            <input type="file" accept="image/*" multiple onChange={handlePhotos} style={{ display: "none" }} />
          </label>
        </div>
        {photos.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {photos.map(function(ph, idx) {
              return (
                <div key={ph.id} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: idx === 0 ? "2px solid #6366f1" : "1px solid rgba(148,163,184,0.3)" }}>
                  {idx === 0 && <div style={{ position: "absolute", top: 4, left: 4, background: "rgba(99,102,241,0.9)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 6 }}>Couverture</div>}
                  <img src={ph.url} alt={ph.name} style={{ width: 110, height: 80, objectFit: "cover", display: "block" }} />
                  <button onClick={function() { removePhoto(ph.id); }}
                    style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", width: 20, height: 20, color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: "20px", padding: 0 }}>✕</button>
                </div>
              );
            })}
          </div>
        )}
        {photos.length === 0 && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Ajoute des photos pour les retrouver facilement dans tes projets sauvegardés</div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.55)", borderRadius: 14, padding: 4, width: "fit-content", backdropFilter: "blur(18px)", border: "1px solid rgba(148,163,184,0.18)" }}>
        {tabs.map(function(t) {
          return (<button key={t.id} onClick={function() { setActiveTab(t.id); }}
            style={{ padding: "7px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: activeTab === t.id ? "white" : "transparent", color: activeTab === t.id ? "#4338ca" : "#64748b", boxShadow: activeTab === t.id ? "0 2px 8px rgba(99,102,241,0.15)" : "none" }}>{t.label}</button>);
        })}
      </div>

      {/* Tab: Paramètres */}
      {activeTab === "params" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Bloc Commune */}
          <div style={Object.assign({}, SECTION, { padding: "14px 20px", isolation: "isolate", zIndex: 10, position: "relative" })}>
            <SectionHeader icon="📍" title="Commune du bien" />
            <div style={{ position: "relative", zIndex: 1000 }}>
              <input value={communeSearch}
                onChange={function(e) { setCommuneSearch(e.target.value); if (!e.target.value) { setInputs(function(p) { return Object.assign({}, p, { commune: "" }); }); setDonneesCommune(null); setCommuneSuggestions([]); } }}
                placeholder="Rechercher une commune (Seine-Maritime)..."
                style={{ width: "100%", background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "8px 14px", fontSize: 13, color: "#0f172a", outline: "none", boxSizing: "border-box" }} />
              {communeSuggestions.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000, background: "#fff", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", marginTop: 4, overflow: "hidden" }}>
                  {communeSuggestions.map(function(c) {
                    return <div key={c.nom}
                      onClick={function() { setCommuneSearch(c.nom); setCommuneSuggestions([]); setInputs(function(p) { return Object.assign({}, p, { commune: c.nom }); }); fetchDonneesCommune(c.nom); }}
                      onMouseEnter={function(e) { e.currentTarget.style.background = "rgba(99,102,241,0.06)"; }}
                      onMouseLeave={function(e) { e.currentTarget.style.background = ""; }}
                      style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, color: "#0f172a", borderBottom: "1px solid rgba(148,163,184,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>{c.nom}</span>
                      {c.scores && <span style={{ fontSize: 11, color: "#94a3b8" }}>Score {c.scores.global != null ? c.scores.global.toFixed(1) : "—"}/10</span>}
                    </div>;
                  })}
                </div>
              )}
            </div>
            {loadingCommune && <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>⏳ Chargement des données marché...</div>}
            {donneesCommune && donneesCommune.prix && (function() {
              var pri = donneesCommune.prix;
              var loy = donneesCommune.loyer;
              var surf = pf(inputs.surfaceGlobale);
              var prixM2Projet = surf > 0 ? pf(inputs.prixVente) / surf : null;
              var prixM2Appart = pri.appartement_m2 ? Number(pri.appartement_m2) : null;
              var prixM2Maison = pri.maison_m2 ? Number(pri.maison_m2) : null;
              var loyerM2 = loy && loy.appartement_m2 != null ? Number(loy.appartement_m2) : null;
              var diffA = prixM2Projet && prixM2Appart ? (prixM2Projet - prixM2Appart) / prixM2Appart * 100 : null;
              var diffM = prixM2Projet && prixM2Maison ? (prixM2Projet - prixM2Maison) / prixM2Maison * 100 : null;
              var gc = function(d) { return d == null ? "#6366f1" : d > 10 ? "#dc2626" : d > 0 ? "#d97706" : "#16a34a"; };
              var gb = function(d) { return d == null ? "rgba(241,245,249,0.8)" : d > 10 ? "rgba(254,226,226,0.5)" : d > 0 ? "rgba(254,243,199,0.5)" : "rgba(220,252,231,0.5)"; };
              var diffLabel = function(d) { return d != null ? (d > 0 ? "⬆️ +" : "⬇️ ") + Math.abs(d).toFixed(1) + "% vs votre projet" : surf > 0 ? "—" : "Renseigne la surface"; };
              return (
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                  {prixM2Appart && <div style={{ background: gb(diffA), borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(148,163,184,0.15)" }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Prix marché appart.</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: gc(diffA), margin: "3px 0 2px" }}>{fmt(prixM2Appart, 0)} €/m²</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{diffLabel(diffA)}</div>
                  </div>}
                  {prixM2Maison && <div style={{ background: gb(diffM), borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(148,163,184,0.15)" }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Prix marché maison</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: gc(diffM), margin: "3px 0 2px" }}>{fmt(prixM2Maison, 0)} €/m²</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{diffLabel(diffM)}</div>
                  </div>}
                  {loyerM2 && <div style={{ background: "rgba(224,242,254,0.5)", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(148,163,184,0.15)" }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Loyer marché /m²</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#0ea5e9", margin: "3px 0 2px" }}>{loyerM2.toFixed(1)} €/m²/mois</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{surf > 0 ? "→ Loyer estimé : " + fmt(loyerM2 * surf, 0) + " €/mois" : "Renseigne la surface"}</div>
                  </div>}
                  {prixM2Projet && <div style={{ background: "rgba(238,242,255,0.7)", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(148,163,184,0.15)" }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Votre prix /m²</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#6366f1", margin: "3px 0 2px" }}>{fmt(prixM2Projet, 0)} €/m²</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{fmt(pf(inputs.prixVente), 0)} € ÷ {fmt(surf, 0)} m²</div>
                  </div>}
                </div>
              );
            })()}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div style={SECTION}>
            <SectionHeader icon="🏠" title="Achat & Financement" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <InputField label="Prix de vente" name="prixVente" value={inputs.prixVente} onChange={handleChange} />
              <InputField label="Frais de notaire" name="fraisNotaire" value={inputs.fraisNotaire} onChange={handleChange} />
              <InputField label="Travaux (global)" name="travaux" value={inputs.travaux} onChange={handleChange} />
              <InputField label="Aménagements" name="amenagements" value={inputs.amenagements} onChange={handleChange} />
              <InputField label="Frais d'agence" name="fraisAgencePct" value={inputs.fraisAgencePct} onChange={handleChange} unit="%" step="0.5" />
              <InputField label="Apport personnel" name="apport" value={inputs.apport} onChange={handleChange} />
              <InputField label="Surface globale" name="surfaceGlobale" value={inputs.surfaceGlobale} onChange={handleChange} unit="m²" step="1" />
                            <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>Note DPE</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["A", "B", "C", "D", "E", "F", "G", ""].map(function(note) {
                    const colors = { A: "#16a34a", B: "#4ade80", C: "#a3e635", D: "#facc15", E: "#fb923c", F: "#f97316", G: "#dc2626", "": "#94a3b8" };
                    const isActive = inputs.noteDPE === note;
                    return (
                      <button key={note === "" ? "nd" : note}
                        onClick={function() { setInputs(function(prev) { return Object.assign({}, prev, { noteDPE: note }); }); }}
                        style={{ flex: 1, padding: "5px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
                          background: isActive ? colors[note] : "rgba(148,163,184,0.12)",
                          color: isActive ? (["A","B","C","D"].includes(note) ? "#fff" : "#0f172a") : "#64748b",
                          boxShadow: isActive ? "0 2px 8px " + colors[note] + "66" : "none" }}>
                        {note === "" ? "N/D" : note}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, background: "rgba(241,245,249,0.8)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Crédit</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <InputField label="Taux crédit" name="tauxCredit" value={inputs.tauxCredit} onChange={handleChange} unit="%" step="0.05" />
                <InputField label="Durée" name="dureeAnnees" value={inputs.dureeAnnees} onChange={handleChange} unit="ans" step="1" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 6, background: "rgba(99,102,241,0.06)", borderRadius: 10, padding: "8px 10px" }}>
                <div><div style={{ fontSize: 10, color: "#94a3b8" }}>Emprunt</div><div style={{ fontSize: 14, fontWeight: 700, color: "#4338ca" }}>{fmtEur(result.sommeEmpruntee)}</div></div>
                <div><div style={{ fontSize: 10, color: "#94a3b8" }}>Mensualité</div><div style={{ fontSize: 14, fontWeight: 700, color: "#4338ca" }}>{fmtEur(result.mensualite)}</div></div>
                <div><div style={{ fontSize: 10, color: "#94a3b8" }}>Coût total</div><div style={{ fontSize: 14, fontWeight: 700, color: "#4338ca" }}>{fmtEur(result.coutPretTotal)}</div></div>
              </div>
            </div>
          </div>

          <div style={SECTION}>
            <SectionHeader icon="📊" title="Exploitation & Fiscalité" />
            <SectionTitle>Revenus</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <InputField label="Loyer mensuel HC total" name="loyerMensuelHC" value={inputs.loyerMensuelHC} onChange={handleChange} step="50" />
              <InputField label="Taux d'occupation" name="tauxOccupation" value={inputs.tauxOccupation} onChange={handleChange} unit="mois" step="0.5" />
            </div>
            <SectionTitle>Charges annuelles</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <InputField label="Charges immeuble" name="chargesImmeubleAn" value={inputs.chargesImmeubleAn} onChange={handleChange} step="100" />
              <InputField label="Taxe foncière" name="taxeFonciereAn" value={inputs.taxeFonciereAn} onChange={handleChange} step="100" />
              <InputField label="Assurance PNO" name="assurancePNOAn" value={inputs.assurancePNOAn} onChange={handleChange} step="50" />
              <InputField label="Gestion locative" name="gestionLocativePct" value={inputs.gestionLocativePct} onChange={handleChange} unit="%" step="0.5" />
              <InputField label="GLI (loyers impayés)" name="gliPct" value={inputs.gliPct} onChange={handleChange} unit="%" step="0.1" />
              <InputField label="Provision travaux" name="provisionTravauxAn" value={inputs.provisionTravauxAn} onChange={handleChange} step="100" />
              <InputField label="Frais bancaires" name="fraisBancairesAn" value={inputs.fraisBancairesAn} onChange={handleChange} step="50" />
              <InputField label="Expert-comptable/CFE" name="expertComptableAn" value={inputs.expertComptableAn} onChange={handleChange} step="50" />
            </div>
            <SectionTitle>Fiscalité</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <InputField label="Coef. amort." name="coefAmortissement" value={inputs.coefAmortissement} onChange={handleChange} unit="%" step="0.25" />
              <InputField label="Taux IS" name="tauxIS" value={inputs.tauxIS} onChange={handleChange} unit="%" step="1" />
              <InputField label="TMI" name="tmi" value={inputs.tmi} onChange={handleChange} unit="%" step="1" />
            </div>
          </div>

          <div style={SECTION}>
            <SectionHeader icon="🏘️" title="Lots / Biens" badge={lots.length + " lot" + (lots.length > 1 ? "s" : "")} />
            <GestionLots lots={lots} onChange={setLots} surfaceGlobale={pf(inputs.surfaceGlobale)} loyerGlobal={pf(inputs.loyerMensuelHC)} />
          </div>
        </div>
          </div>
      )}

      {/* Tab: Bilan */}
      {activeTab === "bilan" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Sélecteur régime */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.keys(result.regimes).map(function(r) {
              return (<button key={r} onClick={function() { setRegimeActif(r); }}
                style={{ padding: "6px 14px", borderRadius: 10, border: regimeActif === r ? "1.5px solid #6366f1" : "1px solid rgba(148,163,184,0.35)", background: regimeActif === r ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.7)", color: regimeActif === r ? "#4338ca" : "#475569", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{r}</button>);
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {/* Ce que vous payez */}
            <div style={SECTION}>
              <SectionHeader icon="💸" title="Ce que vous payez" />
              <StatRow label="Prix d'achat" value={fmtEur(pf(inputs.prixVente))} />
              <StatRow label="Frais de notaire" value={fmtEur(pf(inputs.fraisNotaire))} />
              <StatRow label="Travaux" value={fmtEur(pf(inputs.travaux) + pf(inputs.amenagements))} />
              <StatRow label="Frais d'agence" value={fmtEur(pf(inputs.prixVente) * pf(inputs.fraisAgencePct) / 100)} />
              <StatRow label="Coût total" value={fmtEur(result.depenseNette)} bold color="#0f172a" border={false} />
              <div style={{ marginTop: 10, background: "rgba(99,102,241,0.06)", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(99,102,241,0.15)" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Crédit · {fmt(pf(inputs.dureeAnnees), 0)} ans · {pf(inputs.tauxCredit)}%</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#64748b" }}>Montant emprunté</span><span style={{ fontWeight: 600, color: "#4338ca" }}>{fmtEur(result.sommeEmpruntee)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4 }}>
                  <span style={{ color: "#64748b" }}>Mensualité</span><span style={{ fontWeight: 700, color: "#4338ca", fontSize: 15 }}>{fmtEur(result.mensualite)}</span>
                </div>
              </div>
            </div>

            {/* Ce que vous gagnez */}
            <div style={SECTION}>
              <SectionHeader icon="📈" title="Ce que vous gagnez" />
              <StatRow label="Loyer mensuel" value={"+" + fmtEur(pf(inputs.loyerMensuelHC))} color="#16a34a" />
              <StatRow label="Loyer annuel" value={"+" + fmtEur(result.loyersAnnuels)} color="#16a34a" />
              <div style={{ margin: "8px 0", background: "rgba(220,252,231,0.5)", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>Rentabilité brute</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#15803d" }}>{fmtPct(result.rendBrut)}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Loyers annuels / Coût total</div>
              </div>
              <StatRow label="Charges annuelles" value={"–" + fmtEur(result.totalFraisAnnuels)} color="#d97706" />
              <StatRow label="EBE" value={fmtEur(regime.ebe)} color="#0ea5e9" />
              <StatRow label="Fiscalité annuelle" value={"–" + fmtEur(regime.impot)} color="#dc2626" />
              <div style={{ margin: "8px 0", background: "rgba(220,252,231,0.5)", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>Rentabilité nette · {regimeActif}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#15803d" }}>{fmtPct(regime.rendNet)}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>(Loyers – Charges) / Coût total</div>
              </div>
            </div>

            {/* Effort mensuel */}
            <div style={SECTION}>
              <SectionHeader icon="📅" title="Effort mensuel" />
              <StatRow label="Loyer perçu" value={"+" + fmt(pf(inputs.loyerMensuelHC), 0) + " €"} color="#16a34a" />
              <StatRow label="Mensualité crédit" value={"–" + fmt(result.mensualite, 0) + " €"} color="#dc2626" />
              <StatRow label="Charges moy./mois" value={"–" + fmt(result.totalFraisAnnuels / 12, 0) + " €"} color="#d97706" />
              <StatRow label="Impôts moy./mois" value={"–" + fmt(regime.impot / 12, 0) + " €"} color="#f97316" />
              <div style={{ marginTop: 10, background: tresoPMois >= 0 ? "rgba(220,252,231,0.7)" : "rgba(254,226,226,0.7)", borderRadius: 12, padding: "10px 12px", border: "1px solid " + (tresoPMois >= 0 ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)") }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Cashflow net après impôt</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: tresoPMois >= 0 ? "#15803d" : "#dc2626", marginTop: 2 }}>
                  {tresoPMois >= 0 ? "+" : ""}{fmt(tresoPMois, 0)} €/mois
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <SectionTitle>Indicateurs clés</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Règle des 70%", value: regime.regle70 != null ? fmt(regime.regle70, 2) : "—", color: couleur70, sub: regime.regle70 != null ? (regime.regle70 < 0.7 ? "✓ OK" : "✗ Élevé") : "" },
                    { label: "TRI (Payback)", value: regime.tri != null ? fmt(regime.tri, 1) + " ans" : "—", color: regime.tri != null && regime.tri <= 15 ? "#16a34a" : "#d97706", sub: "Dép. nette / EBE" },
                    { label: "Amortissement/an", value: fmtEur(result.amortissement), color: "#6366f1", sub: pf(inputs.coefAmortissement) + "% de la valeur" },
                    { label: "Dépense nette", value: fmtEur(result.depenseNette), color: "#0f172a", sub: "Tout inclus" },
                  ].map(function(k) {
                    return (<div key={k.label} style={{ background: "rgba(248,250,252,0.9)", borderRadius: 12, padding: "8px 10px", border: "1px solid rgba(148,163,184,0.15)" }}>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>{k.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: k.color }}>{k.value}</div>
                      {k.sub && <div style={{ fontSize: 10, color: "#94a3b8" }}>{k.sub}</div>}
                    </div>);
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Projection */}
      {activeTab === "projection" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.keys(result.regimes).map(function(r) {
              return (<button key={r} onClick={function() { setRegimeActif(r); }}
                style={{ padding: "6px 14px", borderRadius: 10, border: regimeActif === r ? "1.5px solid #6366f1" : "1px solid rgba(148,163,184,0.35)", background: regimeActif === r ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.7)", color: regimeActif === r ? "#4338ca" : "#475569", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{r}</button>);
            })}
          </div>
          <div style={SECTION}>
            <SectionHeader icon="📉" title={"Cash-Flow sur " + (pf(inputs.dureeAnnees) + 5) + " ans"} badge={regimeActif} />
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>Loyers indexés +1%/an · survole pour le détail</div>
            <CashFlowChart data={cashFlowData} />
          </div>
        </div>
      )}

      {/* Tab: Comparatif */}
      {activeTab === "comparatif" && (
        <div style={SECTION}>
          <SectionHeader icon="⚖️" title="Comparatif des régimes fiscaux" />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid rgba(148,163,184,0.2)" }}>
                  {["Régime", "Tréso/an", "Cashflow/mois", "Impôt/an", "Rdt brut", "Rdt net", "TRI", "Règle 70%", "Note"].map(function(h) {
                    return <th key={h} style={{ textAlign: h === "Régime" ? "left" : "right", padding: "8px 10px", fontWeight: 600, color: "#64748b", fontSize: 12 }}>{h}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.regimes).map(function(entry) {
                  const nom = entry[0]; const r = entry[1];
                  const n = calculerNote(result, nom);
                  const isActive = regimeActif === nom;
                  return (
                    <tr key={nom} onClick={function() { setRegimeActif(nom); }} style={{ borderBottom: "1px solid rgba(148,163,184,0.12)", background: isActive ? "rgba(99,102,241,0.06)" : "transparent", cursor: "pointer" }}>
                      <td style={{ padding: "10px 10px", fontWeight: isActive ? 700 : 500, color: isActive ? "#4338ca" : "#1e293b" }}>{nom}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", color: r.tresorerie >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>{fmtEur(r.tresorerie)}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", color: r.tresorerie >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>{(r.tresorerie / 12 >= 0 ? "+" : "") + fmt(r.tresorerie / 12, 0) + " €"}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", color: "#d97706" }}>{fmtEur(r.impot)}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", color: "#334155" }}>{fmtPct(r.rendBrut)}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", color: "#16a34a", fontWeight: 600 }}>{fmtPct(r.rendNet)}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", color: r.tri != null && r.tri <= 15 ? "#16a34a" : "#d97706" }}>{r.tri != null ? fmt(r.tri, 1) + " ans" : "—"}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", color: r.regle70 != null && r.regle70 < 0.7 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>{r.regle70 != null ? fmt(r.regle70, 2) : "—"}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right" }}><span style={{ fontWeight: 800, color: getNoteColor(n), background: getNoteColor(n) + "18", borderRadius: 8, padding: "2px 8px" }}>{n}/100</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
function AnalyseCommunes() {
  const [communes, setCommunes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("global");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [filterMin, setFilterMin] = useState(0);
  const [openScore, setOpenScore] = useState(null);

  const loadCommunes = useCallback(function(force) {
    if (!force) { const cached = sessionStorage.getItem(CACHE_KEY); if (cached) { try { setCommunes(JSON.parse(cached)); setLoading(false); return; } catch(e) {} } }
    setLoading(true); setError(null);
    fetch(API_BASE + "/communes")
      .then(function(r) { if (!r.ok) throw new Error("Erreur " + r.status); return r.json(); })
      .then(function(d) { const list = d.communes || []; setCommunes(list); sessionStorage.setItem(CACHE_KEY, JSON.stringify(list)); })
      .catch(function(e) { setError(e.message); })
      .finally(function() { setLoading(false); });
  }, []);
  useEffect(function() { loadCommunes(false); }, [loadCommunes]);

  const fetchDetail = useCallback(function(nom) {
    setLoadingDetail(true); setDetail(null); setOpenScore(null);
    fetch(API_BASE + "/analyse/" + encodeURIComponent(nom))
      .then(function(r) { if (!r.ok) throw new Error("Erreur " + r.status); return r.json(); })
      .then(function(d) { setDetail(d); })
      .catch(function(e) { setDetail({ error: e.message }); })
      .finally(function() { setLoadingDetail(false); });
  }, []);
  useEffect(function() { if (selected) fetchDetail(selected.nom); }, [selected, fetchDetail]);

  const filtered = useMemo(function() {
    return communes
      .filter(function(c) { const g = sn(c.scores && c.scores.global); return c.nom.toLowerCase().includes(search.toLowerCase()) && (g == null || g >= filterMin); })
      .sort(function(a, b) { return (sn(b.scores && b.scores[sortKey]) || -1) - (sn(a.scores && a.scores[sortKey]) || -1); });
  }, [communes, search, sortKey, filterMin]);
  const top10 = useMemo(function() { return filtered.slice(0, 10); }, [filtered]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 820, flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 999, background: "rgba(255,255,255,0.75)", boxShadow: "0 4px 20px rgba(99,102,241,0.1)", backdropFilter: "blur(18px)", border: "1px solid rgba(148,163,184,0.25)" }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Rechercher une commune… (TOP 10 affiché)" style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "#0f172a" }} />
          <select value={sortKey} onChange={function(e) { setSortKey(e.target.value); }} style={{ background: "rgba(241,245,249,0.9)", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "#334155", outline: "none" }}>
            {[{ key: "global", label: "Score global" }, { key: "rendement", label: "Rendement" }, { key: "demographie", label: "Démographie" }, { key: "socio_eco", label: "Socio-éco" }].map(function(k) { return <option key={k.key} value={k.key}>{k.label}</option>; })}
          </select>
          <select value={filterMin} onChange={function(e) { setFilterMin(Number(e.target.value)); }} style={{ background: "rgba(241,245,249,0.9)", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "#334155", outline: "none" }}>
            <option value={0}>Tous</option><option value={5}>≥ 5</option><option value={6}>≥ 6</option><option value={7}>≥ 7</option>
          </select>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>{filtered.length} communes · top 10 · clic = détail · clic droit = comparer</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={function() { loadCommunes(true); }} style={{ background: "linear-gradient(135deg,#38bdf8,#6366f1)", border: "none", borderRadius: 10, padding: "7px 14px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>↻ Actualiser</button>
          {compareList.length > 0 && <button onClick={function() { setShowCompare(true); }} style={{ background: "linear-gradient(135deg,#a855f7,#ec4899)", border: "none", borderRadius: 10, padding: "7px 14px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>Comparer ({compareList.length})</button>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading && <div style={{ color: "#94a3b8", padding: 40, textAlign: "center" }}>Chargement…</div>}
          {error && <div style={{ color: "#dc2626", padding: 20 }}>Erreur : {error}</div>}
          {!loading && !error && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {top10.map(function(c) {
                const g = sn(c.scores && c.scores.global);
                const isSelected = selected && selected.nom === c.nom;
                const isCompared = !!compareList.find(function(x) { return x.nom === c.nom; });
                return (
                  <div key={c.nom} onClick={function() { setSelected(isSelected ? null : c); }} onContextMenu={function(e) { e.preventDefault(); toggleCompare(c); }}
                    style={{ background: "rgba(255,255,255,0.7)", borderRadius: 16, padding: "12px 14px", boxShadow: isSelected ? "0 6px 24px rgba(99,102,241,0.18)" : "0 2px 10px rgba(99,102,241,0.06)", border: isSelected ? "1.5px solid #6366f1" : isCompared ? "1.5px solid #a855f7" : "1px solid rgba(148,163,184,0.2)", cursor: "pointer", backdropFilter: "blur(12px)", transition: "box-shadow 0.2s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{c.nom}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: nc(g) }}>{g != null ? g.toFixed(1) : "—"}</div>
                    </div>
                    {c.population && <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>{c.population.toLocaleString("fr-FR")} hab.</div>}
                    {/* Indicateurs rapides : prix m² + tension locative */}
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                      {c.prix && c.prix.appartement_m2 && (
                        <span style={{ fontSize: 10, fontWeight: 600, background: "rgba(99,102,241,0.08)", color: "#4338ca", borderRadius: 6, padding: "2px 7px" }}>
                          {Number(c.prix.appartement_m2).toLocaleString("fr-FR")} €/m²
                        </span>
                      )}
                      {c.demographie && c.demographie.tension_locative_pct != null && (
                        <span style={{ fontSize: 10, fontWeight: 600,
                          background: c.demographie.tension_locative_pct > 15 ? "rgba(220,38,38,0.1)" : c.demographie.tension_locative_pct > 8 ? "rgba(217,119,6,0.1)" : "rgba(22,163,74,0.1)",
                          color: c.demographie.tension_locative_pct > 15 ? "#dc2626" : c.demographie.tension_locative_pct > 8 ? "#d97706" : "#16a34a",
                          borderRadius: 6, padding: "2px 7px" }}>
                          🔥 {c.demographie.tension_locative_pct} % tension
                        </span>
                      )}
                      {c.loyer && c.loyer.appartement_m2 != null && (
                        <span style={{ fontSize: 10, fontWeight: 600, background: "rgba(14,165,233,0.08)", color: "#0369a1", borderRadius: 6, padding: "2px 7px" }}>
                          {Number(c.loyer.appartement_m2).toFixed(1)} €/m²/mois
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {["rendement", "demographie", "socio_eco"].map(function(k) {
                        const v = sn(c.scores && c.scores[k]);
                        return (<div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ fontSize: 10, color: "#94a3b8", width: 76 }}>{k === "rendement" ? "Rendement" : k === "demographie" ? "Démographie" : "Socio-éco"}</div>
                          <ProgressBar value={v} />
                          <div style={{ fontSize: 11, color: nc(v), minWidth: 26, textAlign: "right", fontWeight: 600 }}>{v != null ? v.toFixed(1) : "—"}</div>
                        </div>);
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selected && (
          <div style={{ width: 350, minWidth: 310, background: "rgba(255,255,255,0.8)", borderRadius: 20, padding: 16, boxShadow: "0 8px 32px rgba(99,102,241,0.12)", backdropFilter: "blur(22px)", border: "1px solid rgba(148,163,184,0.25)" }}>
            {loadingDetail && <div style={{ color: "#94a3b8", textAlign: "center", marginTop: 40 }}>Chargement…</div>}
            {detail && detail.error && <div style={{ color: "#dc2626" }}>Erreur : {detail.error}</div>}
            {detail && !detail.error && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{detail.commune}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{detail.code_insee} · Zone {detail.zonage_abc}</div>
                  </div>
                  <button onClick={function() { setSelected(null); setDetail(null); setOpenScore(null); }} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}>✕</button>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Scores · clic = détail</div>
                  {[{ key: "global", label: "Global", v: sn(detail.scores && detail.scores.global) }, { key: "rendement", label: "Rendement", v: sn(detail.scores && detail.scores.rendement) }, { key: "demographie", label: "Démographie", v: sn(detail.scores && detail.scores.demographie) }, { key: "socio_eco", label: "Socio-éco", v: sn(detail.scores && detail.scores.socio_eco) }].map(function(item) {
                    const clickable = item.key !== "global"; const isOpen = openScore === item.key;
                    return (<div key={item.key} style={{ marginBottom: 5 }}>
                      <div onClick={function() { if (clickable) setOpenScore(isOpen ? null : item.key); }} style={{ display: "flex", alignItems: "center", gap: 7, cursor: clickable ? "pointer" : "default", padding: "2px 0" }}>
                        <div style={{ fontSize: 12, width: 76, color: "#475569" }}>{item.label}</div>
                        <ProgressBar value={item.v} clickable={clickable} />
                        <div style={{ fontSize: 13, fontWeight: 700, color: nc(item.v), minWidth: 30, textAlign: "right" }}>{item.v != null ? item.v.toFixed(1) : "—"}</div>
                        <div style={{ fontSize: 10, color: nc(item.v), minWidth: 38 }}>{nLabel(item.v)}</div>
                        {clickable && <div style={{ fontSize: 10, color: "#94a3b8" }}>{isOpen ? "▲" : "▼"}</div>}
                      </div>
                      {isOpen && clickable && <ScoreDetail scoreKey={item.key} detail={detail} onClose={function() { setOpenScore(null); }} />}
                    </div>);
                  })}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {[{ label: "Appartement", value: detail.prix && detail.prix.appartement_m2 ? detail.prix.appartement_m2.toLocaleString("fr-FR") + " €/m²" : "—", sub: detail.prix && detail.prix.nb_ventes_apt ? detail.prix.nb_ventes_apt + " ventes" : "" }, { label: "Maison", value: detail.prix && detail.prix.maison_m2 ? detail.prix.maison_m2.toLocaleString("fr-FR") + " €/m²" : "—", sub: detail.prix && detail.prix.nb_ventes_mai ? detail.prix.nb_ventes_mai + " ventes" : "" }].map(function(x) {
                    return (<div key={x.label} style={{ background: "rgba(241,245,249,0.8)", borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 10, color: "#94a3b8" }}>{x.label}</div><div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{x.value}</div>{x.sub && <div style={{ fontSize: 10, color: "#94a3b8" }}>{x.sub}</div>}</div>);
                  })}
                </div>
                {detail.loyer && detail.loyer.appartement_m2 != null && (
                  <div style={{ marginBottom: 10, background: "rgba(224,242,254,0.8)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(56,189,248,0.3)" }}>
                    <div style={{ fontSize: 10, color: "#0369a1" }}>Loyer médian</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{Number(detail.loyer.appartement_m2).toFixed(1)} €/m²/mois</div>
                  </div>
                )}
                {detail.demographie && detail.demographie.tension_locative_pct != null && (function() {
                  var t = detail.demographie.tension_locative_pct;
                  var color = t > 15 ? "#dc2626" : t > 8 ? "#d97706" : "#16a34a";
                  var bg = t > 15 ? "rgba(254,226,226,0.8)" : t > 8 ? "rgba(254,243,199,0.8)" : "rgba(220,252,231,0.8)";
                  var border = t > 15 ? "rgba(220,38,38,0.3)" : t > 8 ? "rgba(217,119,6,0.3)" : "rgba(22,163,74,0.3)";
                  var label = t > 15 ? "Marché très tendu" : t > 8 ? "Marché tendu" : "Marché détendu";
                  return (
                    <div style={{ marginBottom: 10, background: bg, borderRadius: 10, padding: "10px 12px", border: "1px solid " + border }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 10, color: color, fontWeight: 600, textTransform: "uppercase" }}>Tension locative</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: color, lineHeight: 1.1 }}>{t} %</div>
                          <div style={{ fontSize: 11, color: color, marginTop: 2 }}>{label}</div>
                        </div>
                        <div style={{ fontSize: 32 }}>{t > 15 ? "🔥" : t > 8 ? "⚡" : "🟢"}</div>
                      </div>
                      <div style={{ marginTop: 8, background: "rgba(255,255,255,0.5)", borderRadius: 6, height: 6, overflow: "hidden" }}>
                        <div style={{ width: Math.min(100, t * 4) + "%", height: "100%", background: color, borderRadius: 6, transition: "width 0.4s" }} />
                      </div>
                      <div style={{ fontSize: 9, color: color, marginTop: 3, opacity: 0.7 }}>Ratio demandes / offres locatives disponibles</div>
                    </div>
                  );
                })()}
                {detail.rentabilite_brute_pct && (
                  <div style={{ marginBottom: 10, background: "rgba(220,252,231,0.8)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(34,197,94,0.3)" }}>
                    <div style={{ fontSize: 10, color: "#15803d" }}>Rentabilité brute estimée</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#15803d" }}>{detail.rentabilite_brute_pct} %</div>
                  </div>
                )}
                {[{ title: "Socio-éco", rows: [{ label: "Revenu médian", v: detail.socio_eco && detail.socio_eco.revenu_median ? detail.socio_eco.revenu_median.toLocaleString("fr-FR") + " €" : "—" }, { label: "Chômage", v: detail.socio_eco && detail.socio_eco.chomage_pct != null ? detail.socio_eco.chomage_pct + " %" : "—" }, { label: "Taux pauvreté", v: detail.socio_eco && detail.socio_eco.taux_pauvrete_pct != null ? detail.socio_eco.taux_pauvrete_pct + " %" : "—" }] }, { title: "Démographie", rows: [{ label: "Population", v: detail.population ? detail.population.toLocaleString("fr-FR") + " hab." : "—" }, { label: "Évolution/an", v: detail.demographie && detail.demographie.evolution_pop_pct_an != null ? detail.demographie.evolution_pop_pct_an + " %" : "—" }, { label: "Vacance", v: detail.demographie && detail.demographie.vacance_pct != null ? detail.demographie.vacance_pct + " %" : "—" }, { label: "Tension locative", v: detail.demographie && detail.demographie.tension_locative_pct != null ? detail.demographie.tension_locative_pct + " %" : "—", highlight: true }] }].map(function(block) {
                  return (<div key={block.title} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>{block.title}</div>
                    {block.rows.map(function(row) { return (<div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid rgba(148,163,184,0.12)", fontSize: 12 }}><span style={{ color: "#64748b" }}>{row.label}</span><span style={{ fontWeight: 500, color: "#0f172a" }}>{row.v}</span></div>); })}
                  </div>);
                })}
                {detail.prix && detail.prix.avertissement_apt && <div style={{ background: "rgba(254,243,199,0.9)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#92400e", marginBottom: 8 }}>⚠ {detail.prix.avertissement_apt}</div>}
                <div style={{ fontSize: 10, color: "#94a3b8" }}>Sources : {detail.prix && detail.prix.source} · {detail.loyer && detail.loyer.source}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {showCompare && compareList.length > 0 && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={function() { setShowCompare(false); }}>
          <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 20, padding: 20, minWidth: 500, maxWidth: 820, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(15,23,42,0.2)" }} onClick={function(e) { e.stopPropagation(); }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Comparaison de communes</div>
              <button onClick={function() { setShowCompare(false); }} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ color: "#94a3b8" }}><th style={{ textAlign: "left", padding: "6px 8px" }}>Critère</th>{compareList.map(function(c) { return <th key={c.nom} style={{ textAlign: "right", padding: "6px 8px", color: "#0f172a", fontWeight: 600 }}>{c.nom}</th>; })}</tr></thead>
              <tbody>
                {[{ label: "Score global", fn: function(c) { const v = sn(c.scores && c.scores.global); return v != null ? v.toFixed(1) : "—"; } }, { label: "Rendement", fn: function(c) { const v = sn(c.scores && c.scores.rendement); return v != null ? v.toFixed(1) : "—"; } }, { label: "Démographie", fn: function(c) { const v = sn(c.scores && c.scores.demographie); return v != null ? v.toFixed(1) : "—"; } }, { label: "Socio-éco", fn: function(c) { const v = sn(c.scores && c.scores.socio_eco); return v != null ? v.toFixed(1) : "—"; } }, { label: "Population", fn: function(c) { return c.population ? c.population.toLocaleString("fr-FR") : "—"; } }].map(function(row) {
                  return (<tr key={row.label} style={{ borderBottom: "1px solid rgba(148,163,184,0.2)" }}><td style={{ padding: "7px 8px", color: "#64748b" }}>{row.label}</td>{compareList.map(function(c) { return <td key={c.nom} style={{ padding: "7px 8px", textAlign: "right", fontWeight: 500 }}>{row.fn(c)}</td>; })}</tr>);
                })}
              </tbody>
            </table>
            <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>Clic droit sur une commune pour ajouter/retirer.</div>
          </div>
        </div>
      )}
    </div>
  );
}
function SimulateurCredit() {
  const [montant, setMontant] = useState("200000");
  const [duree, setDuree] = useState("25");
  const [tauxHorsAssurance, setTauxHorsAssurance] = useState("4.20");
  const [tauxAssurance, setTauxAssurance] = useState("0.30");

  const calc = useMemo(function() {
    const M = pf(montant);
    const D = Math.max(1, pf(duree));
    const nMois = D * 12;
    const tMensuel = pf(tauxHorsAssurance) / 100 / 12;
    const tAssurMensuel = pf(tauxAssurance) / 100 / 12;
    const mensualiteHorsAssur = tMensuel === 0
      ? M / nMois
      : (M * tMensuel) / (1 - Math.pow(1 + tMensuel, -nMois));
    const mensualiteAssur = M * tAssurMensuel;
    const mensualiteTotale = mensualiteHorsAssur + mensualiteAssur;
    const coutTotalHorsAssur = mensualiteHorsAssur * nMois - M;
    const coutTotalAssur = mensualiteAssur * nMois;
    const coutTotal = coutTotalHorsAssur + coutTotalAssur;

    // Tableau d'amortissement annuel
    const tableau = [];
    var solde = M;
    for (var y = 1; y <= D; y++) {
      var capitalAn = 0; var interetsAn = 0; var assurAn = mensualiteAssur * 12;
      for (var m = 0; m < 12; m++) {
        var intM = solde * tMensuel;
        var capM = mensualiteHorsAssur - intM;
        interetsAn += intM;
        capitalAn += capM;
        solde = Math.max(0, solde - capM);
      }
      tableau.push({ annee: y, capital: capitalAn, interets: interetsAn, assurance: assurAn, solde: Math.max(0, solde) });
    }

    return { mensualiteHorsAssur, mensualiteAssur, mensualiteTotale, coutTotalHorsAssur, coutTotalAssur, coutTotal, tableau };
  }, [montant, duree, tauxHorsAssurance, tauxAssurance]);

  const M = pf(montant);
  const tresoPMois = calc.mensualiteTotale;
  const inputStyle = { width: "100%", background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "8px 12px", color: "#0f172a", fontSize: 14, outline: "none" };
  const labelStyle = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Formulaire + résultat principal */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>

        {/* Inputs */}
        <div style={SECTION}>
          <SectionHeader icon="🏦" title="Paramètres du prêt" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Montant emprunté</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" value={montant} step="5000" min="0" onChange={function(e) { setMontant(e.target.value); }} style={inputStyle} />
                <span style={{ color: "#94a3b8", fontSize: 13, minWidth: 16 }}>€</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Durée du prêt</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" value={duree} step="1" min="1" max="30" onChange={function(e) { setDuree(e.target.value); }} style={inputStyle} />
                <span style={{ color: "#94a3b8", fontSize: 13, minWidth: 28 }}>ans</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Taux hors assurance</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" value={tauxHorsAssurance} step="0.05" min="0" onChange={function(e) { setTauxHorsAssurance(e.target.value); }} style={inputStyle} />
                <span style={{ color: "#94a3b8", fontSize: 13, minWidth: 16 }}>%</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Taux assurance (sur capital initial)</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" value={tauxAssurance} step="0.01" min="0" onChange={function(e) { setTauxAssurance(e.target.value); }} style={inputStyle} />
                <span style={{ color: "#94a3b8", fontSize: 13, minWidth: 16 }}>%</span>
              </div>
            </div>
          </div>

          {/* Barre durée visuelle */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
              <span>1 an</span><span>{duree} ans</span><span>30 ans</span>
            </div>
            <input type="range" min="1" max="30" value={duree} onChange={function(e) { setDuree(e.target.value); }}
              style={{ width: "100%", accentColor: "#6366f1" }} />
          </div>
        </div>

        {/* Résultat principal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Mensualité hero */}
          <div style={Object.assign({}, SECTION, { textAlign: "center", padding: "24px 20px" })}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Votre mensualité sera de</div>
            <div style={{ fontSize: 48, fontWeight: 800, color: "#6366f1", lineHeight: 1 }}>
              {fmt(calc.mensualiteTotale, 0)} <span style={{ fontSize: 32 }}>€</span>
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
              dont {fmt(calc.mensualiteAssur, 0)} € d'assurance / mois
            </div>
            <div style={{ marginTop: 14, height: 8, borderRadius: 999, background: "rgba(148,163,184,0.2)", overflow: "hidden", display: "flex" }}>
              <div style={{ flex: calc.mensualiteHorsAssur, background: "linear-gradient(90deg,#6366f1,#38bdf8)", borderRadius: "999px 0 0 999px" }} />
              <div style={{ flex: calc.mensualiteAssur, background: "#f97316", borderRadius: "0 999px 999px 0" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
              <span>🟣 Crédit : {fmt(calc.mensualiteHorsAssur, 0)} €</span>
              <span>🟠 Assurance : {fmt(calc.mensualiteAssur, 0)} €</span>
            </div>
          </div>

          {/* Détail chiffres */}
          <div style={SECTION}>
            <SectionHeader icon="📋" title="Récapitulatif" />
            <StatRow label="Montant de votre prêt" value={fmtEur(M)} bold />
            <StatRow label="Mensualité hors assurance" value={fmt(calc.mensualiteHorsAssur, 2) + " €/mois"} />
            <StatRow label="dont assurance" value={fmt(calc.mensualiteAssur, 2) + " €/mois"} color="#f97316" />
            <StatRow label="Mensualité totale" value={fmt(calc.mensualiteTotale, 2) + " €/mois"} bold color="#6366f1" />
            <div style={{ margin: "8px 0", background: "rgba(241,245,249,0.8)", borderRadius: 10, height: 1 }} />
            <StatRow label="Coût total du crédit (intérêts)" value={fmtEur(calc.coutTotalHorsAssur)} color="#dc2626" />
            <StatRow label="Coût total assurance" value={fmtEur(calc.coutTotalAssur)} color="#f97316" />
            <StatRow label="Coût total (intérêts + assurance)" value={fmtEur(calc.coutTotal)} bold color="#dc2626" border={false} />
            <div style={{ marginTop: 10, background: "rgba(254,226,226,0.5)", borderRadius: 10, padding: "8px 12px", border: "1px solid rgba(220,38,38,0.15)" }}>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Coût total remboursé (capital + intérêts + assurance)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#dc2626" }}>{fmtEur(M + calc.coutTotal)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau d'amortissement */}
      <div style={SECTION}>
        <SectionHeader icon="📅" title="Tableau d'amortissement" badge={duree + " ans"} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(148,163,184,0.2)" }}>
                {["Année", "Capital remboursé", "Intérêts", "Assurance", "Mensualité totale", "Capital restant dû"].map(function(h) {
                  return <th key={h} style={{ padding: "8px 12px", textAlign: h === "Année" ? "left" : "right", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {calc.tableau.map(function(row, idx) {
                const isEven = idx % 2 === 0;
                return (
                  <tr key={row.annee} style={{ background: isEven ? "rgba(248,250,252,0.6)" : "transparent", borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "#334155" }}>Année {row.annee}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "#16a34a", fontWeight: 500 }}>{fmt(row.capital, 0)} €</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "#dc2626" }}>{fmt(row.interets, 0)} €</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "#f97316" }}>{fmt(row.assurance, 0)} €</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "#4338ca" }}>{fmt(row.capital + row.interets + row.assurance, 0)} €</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "#64748b" }}>{fmt(row.solde, 0)} €</td>
                  </tr>
                );
              })}
              {/* Ligne totaux */}
              <tr style={{ borderTop: "2px solid rgba(148,163,184,0.3)", background: "rgba(99,102,241,0.05)" }}>
                <td style={{ padding: "10px 12px", fontWeight: 700, color: "#0f172a" }}>Total</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>{fmtEur(M)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{fmtEur(calc.coutTotalHorsAssur)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#f97316" }}>{fmtEur(calc.coutTotalAssur)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#4338ca" }}>{fmtEur(M + calc.coutTotal)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "#16a34a", fontWeight: 700 }}>0 €</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
const TRAVAUX_DATA = {
  quantite: [
    { id: "fenetres",   label: "Fenêtres",              icon: "🪟", delegue: 1200, moi: 800,  unite: "fenêtre(s)" },
    { id: "radiateur",  label: "Radiateur électrique",  icon: "🔥", delegue: 350,  moi: 250,   unite: "radiateur(s)" },
    { id: "chaudiere",  label: "Chaudière électrique",  icon: "⚙️", delegue: 2250, moi: 1750,  unite: "chaudière(s)" },
  ],
  fixe: [
    { id: "cuisine",    label: "Cuisine",               icon: "🍳", delegue_inf: 5000, delegue_sup: 6000, moi_inf: 3000, moi_sup: 4000 },
    { id: "sdb",        label: "Salle de bains",        icon: "🚿", delegue_inf: 4000, delegue_sup: 5500, moi_inf: 2500, moi_sup: 3000 },
    { id: "vmc",        label: "VMC",                   icon: "💨", delegue_inf: 800,  delegue_sup: 1200, moi_inf: 400,  moi_sup: 600  },
    { id: "tableau",    label: "Tableau électrique",    icon: "⚡", delegue_inf: 1750, delegue_sup: 1750, moi_inf: 600,  moi_sup: 600  },
  ],
  m2: [
    { id: "elec",       label: "Électricité (complet)", icon: "💡", delegue: 120, moi: 50  },
    { id: "normes",     label: "Mise aux normes élec.", icon: "🔌", delegue: 75,  moi: 25  },
    { id: "plomberie",  label: "Plomberie",             icon: "🚰", delegue: 100, moi: 45  },
    { id: "cloisons",   label: "Cloisons intérieures",  icon: "🧱", delegue: 60,  moi: 20  },
    { id: "isolation",  label: "Isolation",             icon: "🏠", delegue: 40,  moi: 20  },
    { id: "peinture",   label: "Peinture murs/plafond", icon: "🎨", delegue: 50,  moi: 20  },
    { id: "sol",        label: "Sol",                   icon: "🏡", delegue: 80,  moi: 30  },
  ],
  batiment: [
    { id: "toiture",    label: "Remplacement couverture toiture", icon: "🏗️", delegue: 230, moi: 50,   type: "toiture" },
    { id: "tuiles",     label: "Révision tuiles/chevrons",        icon: "🔧", delegue: 38,  moi: 10,   type: "toiture" },
    { id: "charpente",  label: "Remplacement charpente",          icon: "🪵", delegue: 200, moi: null, type: "toiture" },
    { id: "ravalement", label: "Ravalement façade",               icon: "🏢", delegue: 70,  moi: 10,   type: "facade" },
  ],
};

function Toggle({ value, onChange }) {
  return (
    <button onClick={function() { onChange(!value); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, transition: "all 0.15s", background: value ? "rgba(99,102,241,0.9)" : "rgba(220,38,38,0.12)", color: value ? "#fff" : "#dc2626", boxShadow: value ? "0 2px 8px rgba(99,102,241,0.3)" : "inset 0 0 0 1.5px rgba(220,38,38,0.4)" }}>
      {value ? "✓ Oui" : "✗ Non"}
    </button>
  );
}

function SimulateurTravaux() {
  const [surface, setSurface] = useState("80");
  const [surfaceToiture, setSurfaceToiture] = useState("60");
  const [surfaceFacade, setSurfaceFacade] = useState("100");

  // État pour chaque poste : { actif, delegue, quantite }
  const initState = function(items, defQty) {
    const s = {};
    items.forEach(function(item) { s[item.id] = { actif: false, delegue: true, quantite: defQty || "1" }; });
    return s;
  };

  const [stateQ, setStateQ] = useState(function() { return initState(TRAVAUX_DATA.quantite, "1"); });
  const [stateF, setStateF] = useState(function() { return initState(TRAVAUX_DATA.fixe, "1"); });
  const [stateM, setStateM] = useState(function() { return initState(TRAVAUX_DATA.m2, "1"); });
  const [stateB, setStateB] = useState(function() { return initState(TRAVAUX_DATA.batiment, "1"); });

  const updateState = function(setter, id, field, value) {
    setter(function(prev) { return Object.assign({}, prev, { [id]: Object.assign({}, prev[id], { [field]: value }) }); });
  };

  const surf = pf(surface) || 1;
  const surfT = pf(surfaceToiture) || 1;
  const surfF = pf(surfaceFacade) || 1;
  const grand = surf >= 50;

  const calcQ = useMemo(function() {
    var total = 0; var detail = [];
    TRAVAUX_DATA.quantite.forEach(function(item) {
      const s = stateQ[item.id];
      if (!s.actif) return;
      const prix = s.delegue ? item.delegue : item.moi;
      if (prix == null) { detail.push({ label: item.label, montant: null }); return; }
      const montant = prix * pf(s.quantite);
      total += montant;
      detail.push({ label: item.label, montant: montant });
    });
    return { total, detail };
  }, [stateQ]);

  const calcF = useMemo(function() {
    var total = 0; var detail = [];
    TRAVAUX_DATA.fixe.forEach(function(item) {
      const s = stateF[item.id];
      if (!s.actif) return;
      const prix = s.delegue ? (grand ? item.delegue_sup : item.delegue_inf) : (grand ? item.moi_sup : item.moi_inf);
      const montant = prix;
      total += montant;
      detail.push({ label: item.label, montant: montant });
    });
    return { total, detail };
  }, [stateF, grand]);

  const calcM = useMemo(function() {
    var total = 0; var detail = [];
    TRAVAUX_DATA.m2.forEach(function(item) {
      const s = stateM[item.id];
      if (!s.actif) return;
      const prix = s.delegue ? item.delegue : item.moi;
      const montant = prix * surf;
      total += montant;
      detail.push({ label: item.label, montant: montant });
    });
    return { total, detail };
  }, [stateM, surf]);

  const calcB = useMemo(function() {
    var total = 0; var detail = [];
    TRAVAUX_DATA.batiment.forEach(function(item) {
      const s = stateB[item.id];
      if (!s.actif) return;
      const prix = s.delegue ? item.delegue : item.moi;
      if (prix == null) { detail.push({ label: item.label, montant: null }); return; }
      const surface2 = item.type === "toiture" ? surfT : surfF;
      const montant = prix * surface2;
      total += montant;
      detail.push({ label: item.label, montant: montant });
    });
    return { total, detail };
  }, [stateB, surfT, surfF]);

  const totalGeneral = calcQ.total + calcF.total + calcM.total + calcB.total;
  const prixM2 = surf > 0 ? totalGeneral / surf : 0;

  const sectionStyle = Object.assign({}, SECTION, { marginBottom: 0 });

  const renderRows = function(items, state, setter, showQty, qtyLabel) {
    return items.map(function(item) {
      const s = state[item.id];
      const isActif = s.actif;
      const prix = isActif ? (
        item.delegue_inf !== undefined
          ? (s.delegue ? (grand ? item.delegue_sup : item.delegue_inf) : (grand ? item.moi_sup : item.moi_inf))
          : (s.delegue ? item.delegue : item.moi)
      ) : null;
      const montant = isActif && prix != null
        ? (showQty === "quantite" ? prix * pf(s.quantite)
          : showQty === "m2_logement" ? prix * surf
          : showQty === "m2_toiture" ? prix * surfT
          : showQty === "m2_facade" ? prix * surfF
          : prix)
        : null;

      return (
        <tr key={item.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.1)", background: isActif ? "rgba(99,102,241,0.03)" : "transparent", opacity: isActif ? 1 : 0.55, transition: "all 0.15s" }}>
          <td style={{ padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{item.label}</span>
              {item.moi === null && isActif && s.delegue === false && <Tag color="orange">Délégatoire uniquement</Tag>}
            </div>
          </td>
          <td style={{ padding: "10px 12px", textAlign: "center" }}>
           <Toggle value={isActif} onChange={function(v) { updateState(setter, item.id, "actif", v); }} />
          </td>
          <td style={{ padding: "10px 12px", textAlign: "center" }}>
            {isActif ? (
              <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                <button onClick={function() { updateState(setter, item.id, "delegue", true); }} style={{ padding: "3px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: s.delegue ? "rgba(99,102,241,0.9)" : "rgba(148,163,184,0.2)", color: s.delegue ? "#fff" : "#64748b" }}>Entreprise</button>
                <button onClick={function() { if (item.moi !== null && item.moi_inf !== undefined || item.moi !== null) updateState(setter, item.id, "delegue", false); }} style={{ padding: "3px 10px", borderRadius: 8, border: "none", cursor: item.moi !== null ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 600, background: !s.delegue ? "rgba(22,163,74,0.85)" : "rgba(148,163,184,0.2)", color: !s.delegue ? "#fff" : "#64748b", opacity: item.moi === null && item.moi_inf === undefined ? 0.4 : 1 }}>Moi-même</button>
              </div>
            ) : <span style={{ fontSize: 11, color: "#cbd5e1" }}>—</span>}
          </td>
          {showQty === "quantite" && (
            <td style={{ padding: "10px 12px", textAlign: "center" }}>
              {isActif ? (
                <input type="number" value={s.quantite} min="1" step="1" onChange={function(e) { updateState(setter, item.id, "quantite", e.target.value); }}
                  style={{ width: 60, background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 8, padding: "4px 8px", fontSize: 12, color: "#0f172a", outline: "none", textAlign: "center" }} />
              ) : <span style={{ fontSize: 11, color: "#cbd5e1" }}>—</span>}
            </td>
          )}
          <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, color: "#94a3b8" }}>
            {isActif && prix != null ? fmt(prix, 0) + " €" + (showQty !== "fixe" ? (showQty === "quantite" ? "/u" : "/m²") : "") : "—"}
          </td>
          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: montant != null ? "#4338ca" : "#f97316", fontSize: 13 }}>
            {montant != null ? fmtEur(montant) : isActif ? "⚠ N/A" : "—"}
          </td>
        </tr>
      );
    });
  };

  const theadStyle = { borderBottom: "2px solid rgba(148,163,184,0.2)" };
  const thStyle = function(align) { return { padding: "8px 12px", textAlign: align || "left", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.3 }; };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Avertissement */}
      <div style={{ background: "rgba(254,243,199,0.9)", borderRadius: 14, padding: "10px 16px", border: "1px solid rgba(251,191,36,0.4)", fontSize: 12, color: "#92400e" }}>
        ⚠️ <strong>Estimation indicative uniquement.</strong> Les prix peuvent varier selon la région et les artisans. Faites venir plusieurs devis pour une estimation précise.
      </div>

      {/* Surfaces */}
      <div style={sectionStyle}>
        <SectionHeader icon="📐" title="Surfaces de référence" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {[
            { label: "Surface habitable", value: surface, setter: setSurface, unit: "m²", sub: "Utilisée pour les postes au m²" },
            { label: "Surface toiture", value: surfaceToiture, setter: setSurfaceToiture, unit: "m²", sub: "Utilisée pour les postes toiture" },
            { label: "Surface façade", value: surfaceFacade, setter: setSurfaceFacade, unit: "m²", sub: "Utilisée pour le ravalement" },
          ].map(function(f) {
            return (
              <div key={f.label} style={{ background: "rgba(248,250,252,0.9)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(148,163,184,0.2)" }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>{f.label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" value={f.value} min="1" step="1" onChange={function(e) { f.setter(e.target.value); }}
                    style={{ width: "100%", background: "white", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 8, padding: "7px 10px", fontSize: 16, fontWeight: 700, color: "#0f172a", outline: "none" }} />
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>{f.unit}</span>
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{f.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section Prix à la quantité */}
      <div style={sectionStyle}>
        <SectionHeader icon="🔢" title="Prix à la quantité" badge={"Sous-total : " + fmtEur(calcQ.total)} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={theadStyle}>
              <th style={thStyle()}>Poste</th>
              <th style={thStyle("center")}>À rénover ?</th>
              <th style={thStyle("center")}>Qui rénove ?</th>
              <th style={thStyle("center")}>Quantité</th>
              <th style={thStyle("right")}>Prix unitaire</th>
              <th style={thStyle("right")}>Montant</th>
            </tr></thead>
            <tbody>{renderRows(TRAVAUX_DATA.quantite, stateQ, setStateQ, "quantite")}</tbody>
          </table>
        </div>
      </div>

      {/* Section Prix fixe */}
      <div style={sectionStyle}>
        <SectionHeader icon="🏠" title={"Prix fixe (logement " + (grand ? "> 50 m²" : "< 50 m²") + ")"} badge={"Sous-total : " + fmtEur(calcF.total)} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={theadStyle}>
              <th style={thStyle()}>Poste</th>
              <th style={thStyle("center")}>À rénover ?</th>
              <th style={thStyle("center")}>Qui rénove ?</th>
              <th style={thStyle("right")}>Prix</th>
              <th style={thStyle("right")}>Montant</th>
            </tr></thead>
            <tbody>{renderRows(TRAVAUX_DATA.fixe, stateF, setStateF, "fixe")}</tbody>
          </table>
        </div>
      </div>

      {/* Section Prix au m² (habitable) */}
      <div style={sectionStyle}>
        <SectionHeader icon="📏" title={"Prix au m² habitable (" + fmt(surf, 0) + " m²)"} badge={"Sous-total : " + fmtEur(calcM.total)} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={theadStyle}>
              <th style={thStyle()}>Poste</th>
              <th style={thStyle("center")}>À rénover ?</th>
              <th style={thStyle("center")}>Qui rénove ?</th>
              <th style={thStyle("right")}>Prix/m²</th>
              <th style={thStyle("right")}>Montant</th>
            </tr></thead>
            <tbody>{renderRows(TRAVAUX_DATA.m2, stateM, setStateM, "m2_logement")}</tbody>
          </table>
        </div>
      </div>

      {/* Section Bâtiment */}
      <div style={sectionStyle}>
        <SectionHeader icon="🏗️" title="Bâtiment (toiture & façade)" badge={"Sous-total : " + fmtEur(calcB.total)} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={theadStyle}>
              <th style={thStyle()}>Poste</th>
              <th style={thStyle("center")}>À rénover ?</th>
              <th style={thStyle("center")}>Qui rénove ?</th>
              <th style={thStyle("right")}>Prix/m²</th>
              <th style={thStyle("right")}>Montant</th>
            </tr></thead>
            <tbody>
              <tr><td colSpan={5} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "#94a3b8", background: "rgba(241,245,249,0.8)", textTransform: "uppercase" }}>Toiture — {fmt(surfT, 0)} m²</td></tr>
              {renderRows(TRAVAUX_DATA.batiment.filter(function(i) { return i.type === "toiture"; }), stateB, setStateB, "m2_toiture")}
              <tr><td colSpan={5} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "#94a3b8", background: "rgba(241,245,249,0.8)", textTransform: "uppercase" }}>Façade — {fmt(surfF, 0)} m²</td></tr>
              {renderRows(TRAVAUX_DATA.batiment.filter(function(i) { return i.type === "facade"; }), stateB, setStateB, "m2_facade")}
            </tbody>
          </table>
        </div>
      </div>

      {/* Récap total */}
      <div style={Object.assign({}, sectionStyle, { background: "linear-gradient(135deg,rgba(99,102,241,0.08),rgba(56,189,248,0.08))", border: "1.5px solid rgba(99,102,241,0.25)" })}>
        <SectionHeader icon="💰" title="Récapitulatif total" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Quantité", value: fmtEur(calcQ.total), color: "#6366f1" },
            { label: "Prix fixe", value: fmtEur(calcF.total), color: "#8b5cf6" },
            { label: "Au m² habitable", value: fmtEur(calcM.total), color: "#0ea5e9" },
            { label: "Bâtiment", value: fmtEur(calcB.total), color: "#d97706" },
          ].map(function(c) {
            return (
              <div key={c.label} style={{ background: "rgba(255,255,255,0.75)", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(148,163,184,0.2)" }}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{c.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ background: "rgba(255,255,255,0.85)", borderRadius: 16, padding: "14px 20px", flex: 1, minWidth: 180, border: "1px solid rgba(99,102,241,0.25)" }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Coût total estimé</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#4338ca" }}>{fmtEur(totalGeneral)}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.85)", borderRadius: 16, padding: "14px 20px", flex: 1, minWidth: 180, border: "1px solid rgba(148,163,184,0.2)" }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Prix rénovation / m² habitable</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#0f172a" }}>{fmt(prixM2, 0)} <span style={{ fontSize: 16 }}>€/m²</span></div>
          </div>
        </div>
      </div>

    </div>
  );
};

const OFFRES_KEY = "radar-immo-offres-v1";

const OFFRE_DEFAULT = function(id) {
  return { id: id, banque: "Banque " + id, montant: "200000", duree: "25", taux: "4.20", assurance: "0.30", fraisDossier: "1000", fraisGarantie: "2000", fraisCourtier: "0", modulation: false, remboursementAnticipe: false, domiciliation: false, differe: false, dureeDiffere: "0", typeGarantie: "caution" };
};

function ComparateurOffres() {
  const [offres, setOffres] = useState(function() {
    try { return JSON.parse(localStorage.getItem(OFFRES_KEY)) || [OFFRE_DEFAULT(1), OFFRE_DEFAULT(2)]; }
    catch(e) { return [OFFRE_DEFAULT(1), OFFRE_DEFAULT(2)]; }
  });

  const sauver = function(liste) { setOffres(liste); localStorage.setItem(OFFRES_KEY, JSON.stringify(liste)); };
  const ajouterOffre = function() { const newId = Math.max.apply(null, offres.map(function(o) { return o.id; })) + 1; sauver(offres.concat([OFFRE_DEFAULT(newId)])); };
  const supprimerOffre = function(id) { if (offres.length <= 1) return; sauver(offres.filter(function(o) { return o.id !== id; })); };
  const updateOffre = function(id, field, value) { sauver(offres.map(function(o) { return o.id === id ? Object.assign({}, o, { [field]: value }) : o; })); };

  const calcOffre = function(o) {
    const M = pf(o.montant); const D = Math.max(1, pf(o.duree)); const nMois = D * 12;
    const tMensuel = pf(o.taux) / 100 / 12; const tAssurMensuel = pf(o.assurance) / 100 / 12;
    const mensualiteCredit = tMensuel === 0 ? M / nMois : (M * tMensuel) / (1 - Math.pow(1 + tMensuel, -nMois));
    const mensualiteAssur = M * tAssurMensuel;
    const mensualiteTotale = mensualiteCredit + mensualiteAssur;
    const coutInterets = mensualiteCredit * nMois - M;
    const coutAssurance = mensualiteAssur * nMois;
    const fraisTotaux = pf(o.fraisDossier) + pf(o.fraisGarantie) + pf(o.fraisCourtier);
    const coutTotal = coutInterets + coutAssurance + fraisTotaux;
    const taeg = M > 0 ? ((coutTotal / M) / D) * 100 : 0;
    return { mensualiteCredit, mensualiteAssur, mensualiteTotale, coutInterets, coutAssurance, fraisTotaux, coutTotal, taeg };
  };

  const resultats = offres.map(function(o) { return { id: o.id, offre: o, calc: calcOffre(o) }; });
  const meilleurMensualite = Math.min.apply(null, resultats.map(function(r) { return r.calc.mensualiteTotale; }));
  const meilleurCoutTotal  = Math.min.apply(null, resultats.map(function(r) { return r.calc.coutTotal; }));
  const meilleurTaeg       = Math.min.apply(null, resultats.map(function(r) { return r.calc.taeg; }));
  const meilleurDiffere    = Math.max.apply(null, resultats.map(function(r) { return r.offre.differe ? pf(r.offre.dureeDiffere) : 0; }));

  const isBest = function(val, best) {
    if (best === null || best === undefined) return false;
    if (typeof best === "string") return val === best;
    return Math.abs(val - best) < 0.01;
  };

  // Score global pondéré /100
  const calculerScore = function(r) {
    var score = 0;
    const ecartMens = meilleurMensualite > 0 ? (r.calc.mensualiteTotale - meilleurMensualite) / meilleurMensualite : 0;
    score += Math.max(0, 25 - ecartMens * 200);
    const ecartCout = meilleurCoutTotal > 0 ? (r.calc.coutTotal - meilleurCoutTotal) / meilleurCoutTotal : 0;
    score += Math.max(0, 30 - ecartCout * 200);
    const ecartTaeg = meilleurTaeg > 0 ? (r.calc.taeg - meilleurTaeg) / meilleurTaeg : 0;
    score += Math.max(0, 20 - ecartTaeg * 200);
    const maxDiff = meilleurDiffere > 0 ? meilleurDiffere : 1;
    const diffVal = r.offre.differe ? pf(r.offre.dureeDiffere) : 0;
    score += meilleurDiffere > 0 ? (diffVal / maxDiff) * 10 : 10;
    score += r.offre.typeGarantie === "caution" ? 10 : 4;
    if (r.offre.modulation) score += 2;
    if (r.offre.remboursementAnticipe) score += 2;
    if (!r.offre.domiciliation) score += 1;
    return Math.min(100, Math.max(0, Math.round(score)));
  };

  const scores = resultats.map(function(r) { return { id: r.id, score: calculerScore(r) }; });
  const meilleurScore = Math.max.apply(null, scores.map(function(s) { return s.score; }));
  const getScore = function(id) { return scores.find(function(s) { return s.id === id; }).score; };
  const getScoreColor = function(s) {
    if (s >= 80) return "#16a34a";
    if (s >= 60) return "#d97706";
    if (s >= 40) return "#f97316";
    return "#dc2626";
  };

  const couleurs = ["#6366f1", "#0ea5e9", "#16a34a", "#f97316", "#a855f7"];
  const inputSmall = { background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 8, padding: "5px 8px", fontSize: 13, color: "#0f172a", outline: "none", width: "100%" };

  const BestBadge = function() {
    return <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: "rgba(22,163,74,0.15)", color: "#15803d", border: "1px solid rgba(22,163,74,0.3)", marginLeft: 5 }}>✓ Meilleur</span>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>{offres.length} offre{offres.length > 1 ? "s" : ""} comparée{offres.length > 1 ? "s" : ""} · Sauvegarde automatique</div>
        <button onClick={ajouterOffre} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 10, padding: "8px 16px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Ajouter une offre</button>
      </div>

      {/* Cartes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {offres.map(function(o, idx) {
          const couleur = couleurs[idx % couleurs.length];
          const r = resultats.find(function(r) { return r.id === o.id; }).calc;
          const s = getScore(o.id);
          const scoreColor = getScoreColor(s);
          return (
            <div key={o.id} style={{ background: "rgba(255,255,255,0.75)", borderRadius: 18, padding: 16, border: "2px solid " + couleur + "44", boxShadow: "0 4px 20px " + couleur + "18", backdropFilter: "blur(16px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: couleur }} />
                  <input value={o.banque} onChange={function(e) { updateOffre(o.id, "banque", e.target.value); }} style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", background: "transparent", border: "none", outline: "none", borderBottom: "1px dashed " + couleur + "66", width: 140 }} />
                </div>
                <button onClick={function() { supprimerOffre(o.id); }} style={{ background: "rgba(239,68,68,0.08)", border: "none", borderRadius: 8, padding: "3px 9px", color: "#dc2626", cursor: offres.length > 1 ? "pointer" : "not-allowed", fontSize: 12, opacity: offres.length > 1 ? 1 : 0.3 }}>✕</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Montant emprunté", field: "montant", unit: "€", step: "5000" },
                  { label: "Durée", field: "duree", unit: "ans", step: "1" },
                  { label: "Taux hors assurance", field: "taux", unit: "%", step: "0.05" },
                  { label: "Taux assurance", field: "assurance", unit: "%", step: "0.01" },
                  { label: "Frais de dossier", field: "fraisDossier", unit: "€", step: "100" },
                  { label: "Frais de garantie", field: "fraisGarantie", unit: "€", step: "100" },
                  { label: "Frais de courtier", field: "fraisCourtier", unit: "€", step: "100" },
                ].map(function(f) {
                  return (
                    <div key={f.field}>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2, fontWeight: 600 }}>{f.label}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <input type="number" value={o[f.field]} step={f.step} min="0" onChange={function(e) { updateOffre(o.id, f.field, e.target.value); }} style={inputSmall} />
                        <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 20 }}>{f.unit}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Options */}
                <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Options</div>
                  {[
                    { field: "modulation", label: "Modulation des mensualités" },
                    { field: "remboursementAnticipe", label: "Remboursement anticipé sans pénalité" },
                    { field: "domiciliation", label: "Domiciliation bancaire obligatoire" },
                  ].map(function(opt) {
                    return (
                      <div key={opt.field} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#475569" }}>{opt.label}</span>
                        <button onClick={function() { updateOffre(o.id, opt.field, !o[opt.field]); }}
                          style={{ padding: "2px 10px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: o[opt.field] ? "rgba(99,102,241,0.9)" : "rgba(220,38,38,0.1)", color: o[opt.field] ? "#fff" : "#dc2626", boxShadow: o[opt.field] ? "0 2px 6px rgba(99,102,241,0.3)" : "inset 0 0 0 1px rgba(220,38,38,0.3)" }}>
                          {o[opt.field] ? "✓ Oui" : "✗ Non"}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Différé */}
                <div style={{ marginTop: 4, paddingTop: 6, borderTop: "1px solid rgba(148,163,184,0.15)" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Différé</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "#475569" }}>Différé de remboursement</span>
                    <button onClick={function() { updateOffre(o.id, "differe", !o.differe); }}
                      style={{ padding: "2px 10px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: o.differe ? "rgba(99,102,241,0.9)" : "rgba(220,38,38,0.1)", color: o.differe ? "#fff" : "#dc2626", boxShadow: o.differe ? "0 2px 6px rgba(99,102,241,0.3)" : "inset 0 0 0 1px rgba(220,38,38,0.3)" }}>
                      {o.differe ? "✓ Oui" : "✗ Non"}
                    </button>
                  </div>
                  {o.differe && (
                    <div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>Durée du différé</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <input type="number" value={o.dureeDiffere} step="1" min="0" max="24" onChange={function(e) { updateOffre(o.id, "dureeDiffere", e.target.value); }} style={inputSmall} />
                        <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 28 }}>mois</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Garantie */}
                <div style={{ marginTop: 4, paddingTop: 6, borderTop: "1px solid rgba(148,163,184,0.15)" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Type de garantie</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[{ val: "caution", label: "🤝 Cautionnement" }, { val: "hypotheque", label: "🏠 Hypothèque" }].map(function(g) {
                      const isActive = o.typeGarantie === g.val;
                      return (
                        <button key={g.val} onClick={function() { updateOffre(o.id, "typeGarantie", g.val); }}
                          style={{ flex: 1, padding: "5px 8px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: isActive ? "rgba(99,102,241,0.9)" : "rgba(148,163,184,0.12)", color: isActive ? "#fff" : "#64748b", boxShadow: isActive ? "0 2px 6px rgba(99,102,241,0.25)" : "none" }}>
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                  {o.typeGarantie === "hypotheque" && (
                    <div style={{ marginTop: 5, background: "rgba(254,243,199,0.8)", borderRadius: 8, padding: "5px 8px", fontSize: 10, color: "#92400e" }}>
                      ⚠ Hypothèque : frais de mainlevée à prévoir en cas de revente anticipée
                    </div>
                  )}
                </div>
              </div>

              {/* Mini résultat */}
              <div style={{ marginTop: 12, background: couleur + "10", borderRadius: 12, padding: "10px 12px", border: "1px solid " + couleur + "33" }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>Mensualité totale</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: couleur }}>{fmt(r.mensualiteTotale, 0)} €<span style={{ fontSize: 13, fontWeight: 400 }}>/mois</span></div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>dont {fmt(r.mensualiteAssur, 0)} € assurance</div>
              </div>

              {/* Score global */}
              <div style={{ marginTop: 8, background: scoreColor + "10", borderRadius: 10, padding: "8px 12px", border: "1px solid " + scoreColor + "33", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Score global</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>Mensualité · Coût · TAEG · Différé · Garantie</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{s}<span style={{ fontSize: 13, fontWeight: 500 }}>/100</span></div>
                  {s === meilleurScore && <div style={{ fontSize: 10, fontWeight: 700, color: "#15803d", marginTop: 2 }}>🏆 Meilleure offre</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tableau comparatif */}
      <div style={SECTION}>
        <SectionHeader icon="⚖️" title="Tableau comparatif" />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(148,163,184,0.2)" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Critère</th>
                {offres.map(function(o, idx) {
                  return <th key={o.id} style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, fontWeight: 700, color: couleurs[idx % couleurs.length] }}>{o.banque}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "⭐ Score global /100",              fn: function(r) { return getScore(r.id) + " / 100"; }, bestVal: meilleurScore, bestFn: function(r) { return getScore(r.id); }, highlight: true },
                { label: "Montant",                           fn: function(r) { return fmtEur(pf(r.offre.montant)); } },
                { label: "Durée",                             fn: function(r) { return fmt(pf(r.offre.duree), 0) + " ans"; } },
                { label: "Taux crédit",                       fn: function(r) { return pf(r.offre.taux).toFixed(2) + " %"; } },
                { label: "Taux assurance",                    fn: function(r) { return pf(r.offre.assurance).toFixed(2) + " %"; } },
                { label: "Mensualité crédit",                 fn: function(r) { return fmt(r.calc.mensualiteCredit, 0) + " €"; } },
                { label: "Mensualité assurance",              fn: function(r) { return fmt(r.calc.mensualiteAssur, 0) + " €"; } },
                { label: "Mensualité totale",                 fn: function(r) { return fmt(r.calc.mensualiteTotale, 0) + " €"; }, bestVal: meilleurMensualite, bestFn: function(r) { return r.calc.mensualiteTotale; }, highlight: true },
                { label: "Coût des intérêts",                 fn: function(r) { return fmtEur(r.calc.coutInterets); } },
                { label: "Coût assurance totale",             fn: function(r) { return fmtEur(r.calc.coutAssurance); } },
                { label: "Frais (dossier+garantie+courtier)", fn: function(r) { return fmtEur(r.calc.fraisTotaux); } },
                { label: "Coût total",                        fn: function(r) { return fmtEur(r.calc.coutTotal); }, bestVal: meilleurCoutTotal, bestFn: function(r) { return r.calc.coutTotal; }, highlight: true },
                { label: "TAEG estimé",                       fn: function(r) { return r.calc.taeg.toFixed(2) + " %"; }, bestVal: meilleurTaeg, bestFn: function(r) { return r.calc.taeg; }, highlight: true },
                { label: "Différé",                           fn: function(r) { return r.offre.differe ? "✓ " + pf(r.offre.dureeDiffere) + " mois" : "✗ Non"; }, bestVal: meilleurDiffere > 0 ? meilleurDiffere : null, bestFn: function(r) { return r.offre.differe ? pf(r.offre.dureeDiffere) : 0; }, highlight: meilleurDiffere > 0 },
                { label: "Type de garantie",                  fn: function(r) { return r.offre.typeGarantie === "hypotheque" ? "🏠 Hypothèque" : "🤝 Cautionnement"; }, bestVal: "caution", bestFn: function(r) { return r.offre.typeGarantie; }, highlight: true },
                { label: "Modulation mensualités",            fn: function(r) { return r.offre.modulation ? "✓ Oui" : "✗ Non"; } },
                { label: "Remb. anticipé sans pénalité",      fn: function(r) { return r.offre.remboursementAnticipe ? "✓ Oui" : "✗ Non"; } },
                { label: "Domiciliation obligatoire",         fn: function(r) { return r.offre.domiciliation ? "⚠ Oui" : "✓ Non"; } },
              ].map(function(row, idx) {
                return (
                  <tr key={row.label} style={{ borderBottom: "1px solid rgba(148,163,184,0.1)", background: row.highlight ? "rgba(99,102,241,0.03)" : (idx % 2 === 0 ? "rgba(248,250,252,0.5)" : "transparent") }}>
                    <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: row.highlight ? 700 : 400, color: row.highlight ? "#334155" : "#64748b" }}>{row.label}</td>
                    {resultats.map(function(r, ridx) {
                      const isB = row.bestFn && row.bestVal !== null && isBest(row.bestFn(r), row.bestVal);
                      return (
                        <td key={r.id} style={{ padding: "9px 12px", textAlign: "right", fontWeight: row.highlight ? 700 : 500, color: isB ? "#15803d" : (row.highlight ? couleurs[ridx % couleurs.length] : "#334155"), background: isB ? "rgba(22,163,74,0.06)" : "transparent" }}>
                          {row.fn(r)}
                          {isB && <BestBadge />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verdict */}
      <div style={Object.assign({}, SECTION, { background: "linear-gradient(135deg,rgba(99,102,241,0.07),rgba(56,189,248,0.07))", border: "1.5px solid rgba(99,102,241,0.2)" })}>
        <SectionHeader icon="🏆" title="Verdict" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {[
            { label: "Meilleur score global",    best: meilleurScore,                                fn: function(r) { return getScore(r.id); },                                    format: function(v) { return v + " / 100"; } },
            { label: "Mensualité la plus basse", best: meilleurMensualite,                          fn: function(r) { return r.calc.mensualiteTotale; },                           format: function(v) { return fmt(v, 0) + " €/mois"; } },
            { label: "Coût total le plus bas",   best: meilleurCoutTotal,                           fn: function(r) { return r.calc.coutTotal; },                                  format: function(v) { return fmtEur(v); } },
            { label: "TAEG le plus bas",         best: meilleurTaeg,                                fn: function(r) { return r.calc.taeg; },                                       format: function(v) { return v.toFixed(2) + " %"; } },
            { label: "Différé le plus long",     best: meilleurDiffere > 0 ? meilleurDiffere : null, fn: function(r) { return r.offre.differe ? pf(r.offre.dureeDiffere) : 0; }, format: function(v) { return v + " mois"; } },
            { label: "Meilleure garantie",       best: "caution",                                   fn: function(r) { return r.offre.typeGarantie; },                              format: function() { return "🤝 Cautionnement"; } },
          ].filter(function(c) { return c.best !== null; }).map(function(critere) {
            const winner = resultats.find(function(r) { return isBest(critere.fn(r), critere.best); });
            if (!winner) return null;
            const idx = offres.findIndex(function(o) { return o.id === winner.id; });
            const couleur = couleurs[idx % couleurs.length];
            return (
              <div key={critere.label} style={{ background: "rgba(255,255,255,0.85)", borderRadius: 14, padding: "12px 16px", border: "1.5px solid " + couleur + "44", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{critere.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: couleur }}>{winner.offre.banque}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 2 }}>{critere.format(critere.best)}</div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

function CalculateurPlusValue() {
  const [typeBien, setTypeBien] = useState("non-resid");
  const [regime, setRegime] = useState("particulier");
  const [duree, setDuree] = useState(10);
  const [debutMois, setDebutMois] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [debutAnnee, setDebutAnnee] = useState(String(new Date().getFullYear()));
  const [vals, setVals] = useState({
    prixAchat: "175000",
    fraisAchat: "13300",
    travauxDeduc: "0",
    prixVente: "250000",
    fraisVente: "0",
    montantCredit: "160000",
    tauxCredit: "4.20",

    dureeCredit: "25",
    coefAmortissement: "2.50",
    tauxIS: "15",
  });

  const handleChange = useCallback(function(field, value) {
    setVals(function(prev) { return Object.assign({}, prev, { [field]: value }); });
  }, []);

  const calc = useMemo(function() {
    const pa = pf(vals.prixAchat); const fa = pf(vals.fraisAchat); const tv = pf(vals.travauxDeduc);
    const pv = pf(vals.prixVente); const fv = pf(vals.fraisVente);
    const ans = Math.max(0, Math.round(duree));
    const prixRevient = pa + fa + tv;
    const pvBrute = pv - fv - prixRevient;

    // Crédit
    const M = pf(vals.montantCredit);
    const tMensuel = pf(vals.tauxCredit) / 100 / 12;
    const nMois = Math.max(1, pf(vals.dureeCredit)) * 12;
    const mensualite = tMensuel === 0 ? M / nMois : (M * tMensuel) / (1 - Math.pow(1 + tMensuel, -nMois));
    var moisEcoules = 0;
    if (debutMois && debutAnnee) {
      const debut = new Date(parseInt(debutAnnee), parseInt(debutMois) - 1, 1);
      const dateRevente = new Date(debut);
      dateRevente.setFullYear(dateRevente.getFullYear() + ans);
      moisEcoules = Math.max(0, Math.round((dateRevente - debut) / (1000 * 60 * 60 * 24 * 30.44)));
    }
    moisEcoules = Math.min(moisEcoules, nMois);
    var solde = M;
    if (tMensuel === 0) {
      solde = Math.max(0, M - (M / nMois) * moisEcoules);
    } else {
      solde = M * Math.pow(1 + tMensuel, moisEcoules) - mensualite * (Math.pow(1 + tMensuel, moisEcoules) - 1) / tMensuel;
      solde = Math.max(0, solde);
    }
    const creditRembourse = M - solde;
    const creditRestant = solde;
    const produitNetAvantImpot = pv - fv - creditRestant;

    const base0 = { pvBrute, prixRevient, pvNette: 0, impotIR: 0, impotPS: 0, impotTotal: 0, abattIR: 0, abattPS: 0, exonere: false, ans, surtaxe: 0, baseIR: 0, basePS: 0, creditRestant, creditRembourse, produitNetAvantImpot, moisEcoules, mensualite, isSCI: false };

    if (pvBrute <= 0) return base0;

    // Résidence principale : exonération totale
    if (typeBien === "resid-principale") return Object.assign({}, base0, { abattIR: 100, abattPS: 100, exonere: true, pvNette: produitNetAvantImpot });

    // ---- SCI IS ----
    if (regime === "sci-is") {
      const coef = pf(vals.coefAmortissement) / 100;
      const amortissementCumul = pa * coef * ans;
      const valeurNetteCom = Math.max(0, pa - amortissementCumul);
      const pvFiscaleSCI = Math.max(0, pv - fv - valeurNetteCom);
      const tIS = pf(vals.tauxIS) / 100;
      const impotSCI = pvFiscaleSCI * tIS;
      const pvNetteSCI = produitNetAvantImpot - impotSCI;
      return Object.assign({}, base0, { pvNette: pvNetteSCI, impotTotal: impotSCI, isSCI: true, amortissementCumul, valeurNetteCom, pvFiscaleSCI, tIS });
    }

    // ---- Particulier / LMNP ----
    var abattIR = 0; var abattPS = 0;
    if (ans >= 22) { abattIR = 100; } else if (ans >= 6) { abattIR = (ans - 5) * 6; }
    if (ans >= 30) { abattPS = 100; } else if (ans >= 23) { abattPS = Math.min(100, 28 + (ans - 22) * 9); } else if (ans >= 6) { abattPS = (ans - 5) * 1.65; }
    abattIR = Math.min(100, Math.round(abattIR * 10) / 10);
    abattPS = Math.min(100, Math.round(abattPS * 10) / 10);
    const baseIR = pvBrute * (1 - abattIR / 100);
    const basePS = pvBrute * (1 - abattPS / 100);
    var impotIR = baseIR * 0.19; var surtaxe = 0;
    if (baseIR > 50000) {
      const tranches = [{ max: 50000, taux: 0 }, { max: 100000, taux: 0.02 }, { max: 150000, taux: 0.03 }, { max: 200000, taux: 0.04 }, { max: 250000, taux: 0.05 }, { max: Infinity, taux: 0.06 }];
      for (var i = 0; i < tranches.length; i++) {
        const prev = i > 0 ? tranches[i - 1].max : 0;
        const tranche = Math.min(baseIR, tranches[i].max) - prev;
        if (tranche > 0) surtaxe += tranche * tranches[i].taux;
      }
    }
    impotIR += surtaxe;
    const impotPS = basePS * 0.172;
    const impotTotal = impotIR + impotPS;
    const exonere = abattIR >= 100 && abattPS >= 100;
    return Object.assign({}, base0, { pvNette: produitNetAvantImpot - impotTotal, impotIR, impotPS, impotTotal, abattIR, abattPS, exonere, surtaxe, baseIR, basePS });
  }, [vals, duree, typeBien, regime, debutMois, debutAnnee]);

  const inputS = { width: "100%", background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "7px 10px", color: "#0f172a", fontSize: 13, outline: "none" };
  const labelS = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 };

  const BarAb = function(props) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
          <span style={{ color: "#64748b" }}>{props.label}</span>
          <span style={{ fontWeight: 700, color: props.color }}>{props.value}%</span>
        </div>
        <div style={{ background: "rgba(148,163,184,0.2)", borderRadius: 999, height: 8, overflow: "hidden" }}>
          <div style={{ width: props.value + "%", background: props.color, height: 8, borderRadius: 999, transition: "width 0.4s" }} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>

        {/* Colonne gauche - Inputs */}
        <div style={SECTION}>
          <SectionHeader icon="🏠" title="Paramètres de la vente" />

          {/* Type de bien */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>Type de bien</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[{ val: "resid-principale", label: "🏡 Résidence principale" }, { val: "non-resid", label: "🏢 Locatif / secondaire" }].map(function(t) {
                const isA = typeBien === t.val;
                return (
                  <button key={t.val} onClick={function() { setTypeBien(t.val); }}
                    style={{ flex: 1, padding: "7px 8px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: isA ? "linear-gradient(135deg,#6366f1,#38bdf8)" : "rgba(148,163,184,0.12)", color: isA ? "#fff" : "#64748b", boxShadow: isA ? "0 2px 8px rgba(99,102,241,0.3)" : "none" }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
            {typeBien === "resid-principale" && (
              <div style={{ marginTop: 8, background: "rgba(220,252,231,0.8)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#15803d" }}>
                ✅ Exonération totale, quelle que soit la durée de détention.
              </div>
            )}
          </div>

          {/* Régime fiscal */}
          {typeBien !== "resid-principale" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>Régime fiscal</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ val: "particulier", label: "👤 Particulier / LMNP" }, { val: "sci-is", label: "🏢 SCI à l'IS" }].map(function(r) {
                  const isA = regime === r.val;
                  return (
                    <button key={r.val} onClick={function() { setRegime(r.val); }}
                      style={{ flex: 1, padding: "7px 8px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: isA ? "linear-gradient(135deg,#6366f1,#38bdf8)" : "rgba(148,163,184,0.12)", color: isA ? "#fff" : "#64748b", boxShadow: isA ? "0 2px 8px rgba(99,102,241,0.3)" : "none" }}>
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* À l'achat */}
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>À l'achat</div>
            {[
              { field: "prixAchat",    label: "Prix d'achat",              unit: "€", step: "1000" },
              { field: "fraisAchat",   label: "Frais notaire + agence",    unit: "€", step: "500"  },
              { field: "travauxDeduc", label: "Travaux déductibles",       unit: "€", step: "500"  },
            ].map(function(f) {
              return (
                <div key={f.field}>
                  <label style={labelS}>{f.label}</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <input type="number" value={vals[f.field]} step={f.step} min="0"
                      onChange={function(e) { handleChange(f.field, e.target.value); }} style={inputS} />
                    <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 20 }}>{f.unit}</span>
                  </div>
                </div>
              );
            })}

            {/* À la vente */}
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>À la vente</div>
            {[
              { field: "prixVente",  label: "Prix de vente",        unit: "€", step: "1000" },
              { field: "fraisVente", label: "Frais d'agence vente",  unit: "€", step: "500"  },
            ].map(function(f) {
              return (
                <div key={f.field}>
                  <label style={labelS}>{f.label}</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <input type="number" value={vals[f.field]} step={f.step} min="0"
                      onChange={function(e) { handleChange(f.field, e.target.value); }} style={inputS} />
                    <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 20 }}>{f.unit}</span>
                  </div>
                </div>
              );
            })}

            {/* SCI IS params */}
            {regime === "sci-is" && typeBien !== "resid-principale" && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>Paramètres SCI IS</div>
                <div>
                  <label style={labelS}>Taux d'amortissement annuel</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <input type="number" value={vals.coefAmortissement} step="0.25" min="0" max="10"
                      onChange={function(e) { handleChange("coefAmortissement", e.target.value); }} style={inputS} />
                    <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 40 }}>%/an</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Généralement 2.5% pour l'immobilier (hors terrain)</div>
                </div>
                <div>
                  <label style={labelS}>Taux IS applicable</label>
                  <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                    {[{ val: "15", label: "15% (≤ 42 500 €)" }, { val: "25", label: "25% (taux normal)" }].map(function(t) {
                      const isA = vals.tauxIS === t.val;
                      return (
                        <button key={t.val} onClick={function() { handleChange("tauxIS", t.val); }}
                          style={{ flex: 1, padding: "6px 8px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: isA ? "rgba(99,102,241,0.9)" : "rgba(148,163,184,0.12)", color: isA ? "#fff" : "#64748b" }}>
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Crédit */}
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>Crédit immobilier</div>
            {[
              { field: "montantCredit", label: "Montant emprunté",    unit: "€",   step: "5000" },
              { field: "tauxCredit",    label: "Taux hors assurance", unit: "%",   step: "0.05" },
              { field: "dureeCredit",   label: "Durée du crédit",     unit: "ans", step: "1"    },
            ].map(function(f) {
              return (
                <div key={f.field}>
                  <label style={labelS}>{f.label}</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <input type="number" value={vals[f.field]} step={f.step} min="0"
                      onChange={function(e) { handleChange(f.field, e.target.value); }} style={inputS} />
                    <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 28 }}>{f.unit}</span>
                  </div>
                </div>
              );
            })}
            <div>
              <label style={labelS}>Date de début du crédit</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select value={debutMois} onChange={function(e) { setDebutMois(e.target.value); }}
                  style={{ flex: 1, background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "7px 10px", color: "#0f172a", fontSize: 13, outline: "none" }}>
                  {["01","02","03","04","05","06","07","08","09","10","11","12"].map(function(m, i) {
                    const labels = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
                    return <option key={m} value={m}>{labels[i]}</option>;
                  })}
                </select>
                <select value={debutAnnee} onChange={function(e) { setDebutAnnee(e.target.value); }}
                  style={{ width: 95, background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "7px 10px", color: "#0f172a", fontSize: 13, outline: "none" }}>
                  {Array.from({ length: 21 }, function(_, i) { return String(2014 + i); }).map(function(y) {
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
              </div>
            </div>

            {/* Détention */}
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>Durée de détention</div>
            <div>
              <label style={labelS}>Revente dans : <strong style={{ color: "#4338ca" }}>{duree} ans</strong></label>
              <input type="range" min="0" max="30" value={duree}
                onChange={function(e) { setDuree(Number(e.target.value)); }}
                style={{ width: "100%", accentColor: "#6366f1", marginTop: 4 }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                <span>0 an</span><span>6 ans</span><span>22 ans</span><span>30 ans</span>
              </div>
            </div>
          </div>
        </div>

        {/* Colonne droite - Résultats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Prix de revient */}
          <div style={SECTION}>
            <SectionHeader icon="📐" title="Plus-value & prix de revient" />
            <StatRow label="Prix d'achat" value={fmtEur(pf(vals.prixAchat))} />
            <StatRow label="Frais notaire + agence" value={"+ " + fmtEur(pf(vals.fraisAchat))} />
            <StatRow label="Travaux déductibles" value={"+ " + fmtEur(pf(vals.travauxDeduc))} />
            <StatRow label="Prix de revient total" value={fmtEur(calc.prixRevient)} bold color="#0f172a" border={false} />
            <div style={{ margin: "10px 0", height: 1, background: "rgba(148,163,184,0.2)" }} />
            <StatRow label="Prix de vente net vendeur" value={fmtEur(pf(vals.prixVente) - pf(vals.fraisVente))} color="#16a34a" />
            <div style={{ marginTop: 10, background: calc.pvBrute > 0 ? "rgba(220,252,231,0.7)" : "rgba(254,226,226,0.7)", borderRadius: 12, padding: "12px 14px", border: "1px solid " + (calc.pvBrute > 0 ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)") }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Plus-value brute</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: calc.pvBrute > 0 ? "#15803d" : "#dc2626" }}>
                {calc.pvBrute > 0 ? "+" : ""}{fmtEur(calc.pvBrute)}
              </div>
            </div>
          </div>

          {/* Crédit */}
          {pf(vals.montantCredit) > 0 && (
            <div style={SECTION}>
              <SectionHeader icon="🏦" title="Remboursement anticipé du crédit" />
              <StatRow label="Capital emprunté" value={fmtEur(pf(vals.montantCredit))} />
              <StatRow label="Mensualité estimée" value={fmt(calc.mensualite, 0) + " €/mois"} />
              <StatRow label="Mois écoulés à la revente" value={calc.moisEcoules + " mois"} />
              <StatRow label="Capital déjà remboursé" value={fmtEur(calc.creditRembourse)} color="#16a34a" />
              <StatRow label="Capital restant dû" value={"– " + fmtEur(calc.creditRestant)} color="#dc2626" bold border={false} />
              <div style={{ marginTop: 8, background: "rgba(254,243,199,0.7)", borderRadius: 10, padding: "6px 10px", fontSize: 10, color: "#92400e", border: "1px solid rgba(251,191,36,0.3)" }}>
                ⚠ IRA (indemnités remboursement anticipé) non incluses — max 3% du capital restant ou 6 mois d'intérêts.
              </div>
            </div>
          )}

          {/* Abattements — uniquement particulier */}
          {typeBien !== "resid-principale" && regime === "particulier" && calc.pvBrute > 0 && (
            <div style={SECTION}>
              <SectionHeader icon="⏳" title={"Abattements — " + calc.ans + " ans"} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                <BarAb label="Abattement IR (exo à 22 ans)" value={calc.abattIR} color="#6366f1" />
                <BarAb label="Abattement PS (exo à 30 ans)" value={Math.round(calc.abattPS)} color="#0ea5e9" />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[{ ans: 6, label: "Début abattements" }, { ans: 22, label: "Exo IR" }, { ans: 30, label: "Exo totale" }].map(function(j) {
                  const atteint = calc.ans >= j.ans;
                  return (
                    <div key={j.ans} style={{ flex: 1, minWidth: 80, padding: "6px 8px", borderRadius: 8, textAlign: "center", background: atteint ? "rgba(99,102,241,0.1)" : "rgba(148,163,184,0.08)", border: "1px solid " + (atteint ? "rgba(99,102,241,0.3)" : "rgba(148,163,184,0.2)") }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: atteint ? "#4338ca" : "#94a3b8" }}>{j.ans} ans</div>
                      <div style={{ fontSize: 10, color: atteint ? "#6366f1" : "#94a3b8" }}>{j.label}</div>
                      {atteint && <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>✓ Atteint</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SCI IS — avertissement + calcul */}
          {typeBien !== "resid-principale" && regime === "sci-is" && calc.pvBrute > 0 && calc.isSCI && (
            <div style={SECTION}>
              <SectionHeader icon="🏢" title="Fiscalité SCI IS" />
              <div style={{ marginBottom: 10, background: "rgba(254,243,199,0.7)", borderRadius: 10, padding: "8px 12px", fontSize: 11, color: "#92400e", border: "1px solid rgba(251,191,36,0.3)" }}>
                ⚠ En SCI IS, <strong>aucun abattement</strong> pour durée de détention. La base imposable = prix vente − valeur nette comptable (les amortissements sont réintégrés).
              </div>
              <StatRow label="Prix d'achat (base amortissable)" value={fmtEur(pf(vals.prixAchat))} />
              <StatRow label={"Amortissements cumulés (" + calc.ans + " ans × " + vals.coefAmortissement + "%/an)"} value={"– " + fmtEur(calc.amortissementCumul)} color="#d97706" />
              <StatRow label="Valeur nette comptable (VNC)" value={fmtEur(calc.valeurNetteCom)} bold color="#0f172a" border={false} />
              <div style={{ margin: "8px 0", height: 1, background: "rgba(148,163,184,0.2)" }} />
              <StatRow label="Prix de vente net" value={fmtEur(pf(vals.prixVente) - pf(vals.fraisVente))} color="#16a34a" />
              <StatRow label="– Valeur nette comptable" value={"– " + fmtEur(calc.valeurNetteCom)} color="#64748b" />
              <StatRow label="= PV fiscale SCI (base IS)" value={fmtEur(calc.pvFiscaleSCI)} bold color="#dc2626" border={false} />
              <div style={{ margin: "8px 0", height: 1, background: "rgba(148,163,184,0.2)" }} />
              <StatRow label={"IS à " + (calc.tIS * 100).toFixed(0) + "%"} value={"– " + fmtEur(calc.impotTotal)} color="#dc2626" bold border={false} />
            </div>
          )}

          {/* Fiscalité particulier */}
          {typeBien !== "resid-principale" && regime === "particulier" && calc.pvBrute > 0 && (
            <div style={SECTION}>
              <SectionHeader icon="🧾" title="Fiscalité" />
              {calc.exonere ? (
                <div style={{ background: "rgba(220,252,231,0.8)", borderRadius: 12, padding: "14px", textAlign: "center", border: "1px solid rgba(22,163,74,0.3)" }}>
                  <div style={{ fontSize: 24 }}>🎉</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#15803d", marginTop: 4 }}>Totalement exonéré d'impôt !</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>IR et prélèvements sociaux = 0 €</div>
                </div>
              ) : (
                <>
                  <StatRow label={"Base IR (abatt. " + calc.abattIR + "%)"} value={fmtEur(calc.baseIR)} />
                  <StatRow label="IR à 19%" value={"– " + fmtEur(calc.impotIR - calc.surtaxe)} color="#dc2626" />
                  {calc.surtaxe > 0 && <StatRow label="Surtaxe (PV > 50 000 €)" value={"– " + fmtEur(calc.surtaxe)} color="#f97316" />}
                  <StatRow label={"Base PS (abatt. " + Math.round(calc.abattPS) + "%)"} value={fmtEur(calc.basePS)} />
                  <StatRow label="Prélèvements sociaux 17.2%" value={"– " + fmtEur(calc.impotPS)} color="#d97706" />
                  <div style={{ margin: "8px 0", height: 1, background: "rgba(148,163,184,0.2)" }} />
                  <StatRow label="Impôt total" value={"– " + fmtEur(calc.impotTotal)} color="#dc2626" bold border={false} />
                </>
              )}
            </div>
          )}

          {/* Bilan final */}
          {calc.pvBrute > 0 && (
            <div style={Object.assign({}, SECTION, { background: "linear-gradient(135deg,rgba(99,102,241,0.07),rgba(56,189,248,0.07))", border: "1.5px solid rgba(99,102,241,0.2)" })}>
              <SectionHeader icon="💰" title="Bilan net encaissé" />
              <StatRow label="Prix de vente net" value={fmtEur(pf(vals.prixVente) - pf(vals.fraisVente))} color="#16a34a" />
              {pf(vals.montantCredit) > 0 && <StatRow label="– Capital restant dû" value={"– " + fmtEur(calc.creditRestant)} color="#dc2626" />}
              {!calc.exonere && <StatRow label={"– Impôt (" + (calc.isSCI ? "IS" : "IR+PS") + ")"} value={"– " + fmtEur(calc.impotTotal)} color="#dc2626" />}
              {calc.exonere && <StatRow label="– Impôt" value="0 € (exonéré ✅)" color="#16a34a" />}
              <div style={{ marginTop: 10, background: calc.pvNette > 0 ? "rgba(220,252,231,0.8)" : "rgba(254,226,226,0.8)", borderRadius: 12, padding: "12px 14px", border: "1px solid " + (calc.pvNette > 0 ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)") }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>Net encaissé après crédit + impôt</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: calc.pvNette > 0 ? "#15803d" : "#dc2626" }}>
                  {calc.pvNette > 0 ? "+" : ""}{fmtEur(calc.pvNette)}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <div style={{ background: "rgba(241,245,249,0.8)", borderRadius: 12, padding: "10px 14px", fontSize: 11, color: "#64748b", border: "1px solid rgba(148,163,184,0.2)" }}>
        ℹ️ Particulier : IR 19% + PS 17.2%, abattements à partir de 6 ans, exo IR 22 ans, exo totale 30 ans, surtaxe si PV &gt; 50 000 €. — SCI IS : aucun abattement, base = prix vente − VNC, IS 15% ou 25%. — IRA crédit non incluses.
      </div>
    </div>
  );
}


function SCIField({ sciVals, onChange, field, label, unit, step, hint }) {
  const inputS = { width: "100%", background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "7px 10px", color: "#0f172a", fontSize: 13, outline: "none" };
  const labelS = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 };
  return (
    <div>
      <label style={labelS}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <input type="number" value={sciVals[field]} step={step || "100"} min="0"
          onChange={function(e) { onChange(field, e.target.value); }} style={inputS} />
        {unit && <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 28 }}>{unit}</span>}
      </div>
      {hint && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}


// ─── SCI MULTI-BIENS ────────────────────────────────────────────────────────

const SEUIL_IS_BAS = 42500;
const TAUX_CCA_LEGAL = 2.5; // taux légal CCA 2024

const DEFAULT_BIEN = function(id) {
  var now = new Date();
  var mm = String(now.getMonth() + 1).padStart(2, "0");
  return {
    id: id,
    nom: "Bien " + id,
    prixAchat: "200000",
    fraisAchat: "16000",
    travaux: "0",
    montantCredit: "196000",
    tauxCredit: "4.20",
    dureeCredit: "20",
    dateAchat: now.getFullYear() + "-" + mm,
    loyerMensuel: "900",
    tauxOccupation: "11",
    tauxRevalorisation: "1.5",
    chargesAn: "1200",
    taxeFonciereAn: "1200",
    assurancePNOAn: "0",
    gestionPct: "0",
    provisionTravauxAn: "0",
    expertComptableAn: "800",
    fraisBancairesAn: "200",
    coefAmortBatiment: "2.50",
    coefAmortTravaux: "10.00",
    partTerrain: "15",
    fraisNotaireAmort: "1",
    fraisDossierCredit: "1500",
    dureeFraisDossier: "20",
    provisionGrosTravauxAn: "500",
    gliAn: "0",
  };
};

const DEFAULT_SCI_PARAMS = {
  tauxIS: "15",
  tauxDividendes: "30",
  nbParts: "2",
  capitalSocial: "1000",
  tauxCCA: TAUX_CCA_LEGAL.toString(),
  distribuerOuRembourser: "rembourser",
};

// Calcule le résultat fiscal d'UN bien pour l'année Y
function calcBienAnnee(bien, anneeReelle) {
  const pa = pf(bien.prixAchat);
  const fa = pf(bien.fraisAchat);
  const tv = pf(bien.travaux);
  const M = pf(bien.montantCredit);
  const duree = Math.max(1, Math.round(pf(bien.dureeCredit)));
  const tMensuel = pf(bien.tauxCredit) / 100 / 12;
  const nMois = duree * 12;
  const mensualite = tMensuel === 0 ? M / nMois : (M * tMensuel) / (1 - Math.pow(1 + tMensuel, -nMois));

  const dateAchat = bien.dateAchat || (new Date().getFullYear() + "-01");
  const anneeAchat = parseInt(dateAchat.split("-")[0], 10);
  const moisAchat = parseInt(dateAchat.split("-")[1] || "1", 10) - 1;
  const anneesDepuisAchat = anneeReelle - anneeAchat;

  if (anneesDepuisAchat < 0) {
    return {
      loyersAn: 0, chargesTotal: 0, interetsAn: 0, totalAmort: 0,
      provisionGros: 0, resultatBrut: 0, remboursementAn: 0,
      amortBat: 0, amortTrav: 0, amortFraisAcquis: 0, amortFraisDossier: 0,
      actif: false,
    };
  }

  const tauxReval = pf(bien.tauxRevalorisation) / 100;
  const moisDansAnnee = (anneesDepuisAchat === 0) ? Math.max(0, 12 - moisAchat) : 12;
  const tauxOccupationEffectif = Math.min(pf(bien.tauxOccupation), moisDansAnnee);
  const loyersAn = pf(bien.loyerMensuel) * tauxOccupationEffectif
    * Math.pow(1 + tauxReval, anneesDepuisAchat);

  const gestionAn = loyersAn * pf(bien.gestionPct) / 100;
  const assurancePNO = pf(bien.assurancePNOAn) > 0 ? pf(bien.assurancePNOAn) : (pa + tv) * 0.0012;
  const gliAn = pf(bien.gliAn) > 0 ? pf(bien.gliAn) : 0;
  const chargesTotal = pf(bien.chargesAn) + pf(bien.taxeFonciereAn) + assurancePNO
    + gestionAn + pf(bien.provisionTravauxAn) + pf(bien.expertComptableAn) + pf(bien.fraisBancairesAn) + gliAn;
  const provisionGros = pf(bien.provisionGrosTravauxAn);

  const moisDebutAnnee = (anneeReelle - anneeAchat) * 12 - moisAchat;
  const moisFinAnnee = moisDebutAnnee + 12;
  var interetsAn = 0, remboursementAn = 0;

  if (anneesDepuisAchat < duree && M > 0) {
    var solde = M;
    var debut = Math.max(0, moisDebutAnnee);
    for (var mm = 0; mm < debut && solde > 0 && mm < nMois; mm++) {
      var intM2 = solde * tMensuel;
      solde = Math.max(0, solde - (mensualite - intM2));
    }
    for (var m = debut; m < moisFinAnnee && solde > 0 && m < nMois; m++) {
      var intM = solde * tMensuel;
      interetsAn += intM;
      solde = Math.max(0, solde - (mensualite - intM));
    }
    var moisActifs = Math.min(moisFinAnnee, nMois) - debut;
    remboursementAn = moisActifs > 0 ? mensualite * moisActifs : 0;
  }

  var y = anneesDepuisAchat + 1;
  const amortBat = pa * (1 - pf(bien.partTerrain) / 100) * pf(bien.coefAmortBatiment) / 100;
  const amortTrav = tv * pf(bien.coefAmortTravaux) / 100;
  const amortFraisAcquis = bien.fraisNotaireAmort === "1" && y <= 5 ? fa / 5 : 0;
  const fraisAcquisAn1 = bien.fraisNotaireAmort === "0" && y === 1 ? fa : 0;
  const amortFraisDossier = y <= duree ? pf(bien.fraisDossierCredit) / Math.max(1, pf(bien.dureeFraisDossier)) : 0;
  const totalAmort = amortBat + amortTrav + amortFraisAcquis + amortFraisDossier;
  const resultatBrut = loyersAn - chargesTotal - interetsAn - totalAmort - fraisAcquisAn1 - provisionGros;

  return {
    loyersAn, chargesTotal, interetsAn, totalAmort, provisionGros,
    resultatBrut, remboursementAn,
    amortBat, amortTrav, amortFraisAcquis, amortFraisDossier,
    actif: true,
  };
}
// Projection SCI consolidée sur N années
function projeterSCI(biens, sciParams, ccaAssocies) {
  const anneeActuelle = new Date().getFullYear();
  const dureeMax = Math.max(...biens.map(function(b) {
    var anneeAchat = parseInt((b.dateAchat || anneeActuelle + "-01").split("-")[0], 10);
    return (anneeAchat - anneeActuelle) + Math.round(pf(b.dureeCredit));
  })) + 5;
  const totalYears = Math.min(Math.max(dureeMax, 10), 35);
  const tIS = pf(sciParams.tauxIS) / 100;
  const tauxCCA = pf(sciParams.tauxCCA) / 100;
  const tDiv = pf(sciParams.tauxDividendes) / 100;

  var soldeCCA = ccaAssocies.reduce(function(acc, a) { return acc + pf(a.montant); }, 0);

  var rows = [];
  for (var i = 0; i < totalYears; i++) {
    var anneeReelle = anneeActuelle + i;
    var loyersTotal = 0, chargesTotal = 0, amortTotal = 0, interetsTotal = 0,
        remboursementTotal = 0, provisionGrosTotal = 0;
    var bienDetails = [];

    biens.forEach(function(bien) {
      var r = calcBienAnnee(bien, anneeReelle);
      loyersTotal += r.loyersAn;
      chargesTotal += r.chargesTotal;
      amortTotal += r.totalAmort;
      interetsTotal += r.interetsAn;
      remboursementTotal += r.remboursementAn;
      provisionGrosTotal += r.provisionGros;
      bienDetails.push({ nom: bien.nom, resultat: r.resultatBrut, loyers: r.loyersAn, actif: r.actif !== false });
    });

    var interetsCCA = soldeCCA * tauxCCA;
    var resultatFiscal = Math.max(0, loyersTotal - chargesTotal - interetsTotal - amortTotal - provisionGrosTotal - interetsCCA);
    var isPartBas = Math.min(resultatFiscal, SEUIL_IS_BAS) * Math.min(tIS, 0.15);
    var isPartHaut = Math.max(0, resultatFiscal - SEUIL_IS_BAS) * 0.25;
    var isTotal = isPartBas + isPartHaut;
    var margeAvantBasculement = Math.max(0, SEUIL_IS_BAS - resultatFiscal);
    var alertePalier = resultatFiscal > SEUIL_IS_BAS * 0.8;
    var resultatNetApresIS = Math.max(0, resultatFiscal) - isTotal;
    var tresoConsolidee = loyersTotal - chargesTotal - remboursementTotal - isTotal - provisionGrosTotal;

    var remboursementCCA = 0, dividendesDistribues = 0;
    if (sciParams.distribuerOuRembourser === "rembourser" && soldeCCA > 0) {
      remboursementCCA = Math.min(soldeCCA, Math.max(0, tresoConsolidee));
    } else {
      dividendesDistribues = resultatNetApresIS;
    }
    soldeCCA = Math.max(0, soldeCCA - remboursementCCA);
    var dividendesNets = dividendesDistribues * (1 - tDiv);

    rows.push({
      year: anneeReelle,
      loyersTotal, chargesTotal, amortTotal, interetsTotal, interetsCCA,
      provisionGrosTotal, resultatFiscal, isPartBas, isPartHaut, isTotal,
      margeAvantBasculement, alertePalier, remboursementTotal, tresoConsolidee,
      soldeCCA, remboursementCCA, resultatNetApresIS,
      dividendesDistribues, dividendesNets, bienDetails,
    });
  }
  return rows;
}
// ─── CHAMP INPUT GENERIQUE ────────────────────────────────────────────────────
function BienField({ vals, onChange, field, label, unit, step, hint }) {
  const inputS = { width: "100%", background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "7px 10px", color: "#0f172a", fontSize: 13, outline: "none" };
  const labelS = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 };
  return (
    <div>
      <label style={labelS}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <input type="number" value={vals[field]} step={step || "100"} min="0"
          onChange={function(e) { onChange(field, e.target.value); }} style={inputS} />
        {unit && <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 32 }}>{unit}</span>}
      </div>
      {hint && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

// ─── GRAPHIQUE CONSOLIDE SCI ──────────────────────────────────────────────────
function SCIConsolideChart({ rows }) {
  const [hovered, setHovered] = React.useState(null);
  if (!rows || rows.length === 0) return null;

  const W = 720, H = 300, padL = 72, padR = 150, padT = 24, padB = 50;
  const chartW = W - padL - padR, chartH = H - padT - padB;
  const maxV = Math.max(SEUIL_IS_BAS * 1.3, ...rows.map(function(r) { return r.resultatFiscal; })) * 1.1 || 1;
  const toY = function(v) { return padT + chartH - (v / maxV) * chartH; };
  const bW = Math.max(4, chartW / rows.length - 3);
  const cx = function(i) { return padL + i * (chartW / rows.length) + (chartW / rows.length) / 2; };
  const seuilY = toY(SEUIL_IS_BAS);
  const h = hovered !== null ? rows[hovered] : null;
  const ttW = 168, ttH = 130;
  var ttX = hovered !== null ? cx(hovered) - ttW / 2 : 0;
  if (ttX < padL) ttX = padL;
  if (ttX + ttW > W - padR + 10) ttX = W - padR + 10 - ttW;

  return (
    <div style={Object.assign({}, SECTION, { marginTop: 0 })}>
      <SectionHeader icon="📊" title="Évolution fiscale consolidée SCI" />
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
        IS à 15% (violet) + IS à 25% (rouge) — Ligne pointillée : seuil 42 500 € — Courbe : base IS consolidée
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={"0 0 " + W + " " + H} style={{ width: "100%", minWidth: 500, fontFamily: "system-ui,sans-serif" }}
          onMouseLeave={function() { setHovered(null); }}>
          <rect x={padL} y={padT} width={chartW} height={chartH} fill="rgba(248,250,252,0.8)" rx={8} />
          {/* Zone verte : sous le seuil */}
          <rect x={padL} y={seuilY} width={chartW} height={padT + chartH - seuilY} fill="rgba(22,163,74,0.04)" />
          {/* Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map(function(t) {
            const v = maxV * t; const y = toY(v);
            return (
              <g key={t}>
                <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="rgba(148,163,184,0.2)" strokeWidth={1} strokeDasharray="4 3" />
                <text x={padL - 5} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{fmtK(v)}</text>
              </g>
            );
          })}
          {/* Seuil 42 500 */}
          <line x1={padL} y1={seuilY} x2={padL + chartW} y2={seuilY} stroke="#16a34a" strokeWidth={1.5} strokeDasharray="6 3" />
          <text x={padL + chartW + 4} y={seuilY + 4} fontSize={9} fill="#16a34a" fontWeight="600">42 500 €</text>
          {/* Hover col */}
          {hovered !== null && (
            <rect x={padL + hovered * (chartW / rows.length)} y={padT} width={chartW / rows.length} height={chartH} fill="rgba(99,102,241,0.06)" rx={3} />
          )}
          {/* Barres IS */}
          {rows.map(function(r, i) {
            const x = padL + i * (chartW / rows.length) + (chartW / rows.length - bW) / 2;
            const op = hovered !== null && hovered !== i ? 0.45 : 1;
            const hBas = Math.max(0, (r.isPartBas / maxV) * chartH);
            const hHaut = Math.max(0, (r.isPartHaut / maxV) * chartH);
            return (
              <g key={i} opacity={op} onMouseEnter={function() { setHovered(i); }} style={{ cursor: "pointer" }}>
                {hBas > 0 && <rect x={x} y={padT + chartH - hBas} width={bW} height={hBas} fill="#818cf8" rx={2} />}
                {hHaut > 0 && <rect x={x} y={padT + chartH - hBas - hHaut} width={bW} height={hHaut} fill="#ef4444" rx={2} />}
              </g>
            );
          })}
          {/* Courbe base IS */}
          <polyline
            points={rows.map(function(r, i) { return cx(i) + "," + toY(r.resultatFiscal); }).join(" ")}
            fill="none" stroke="#fbbf24" strokeWidth={2.5} strokeLinejoin="round" />
          {rows.map(function(r, i) {
            return <circle key={i} cx={cx(i)} cy={toY(r.resultatFiscal)} r={hovered === i ? 5 : 3}
              fill={hovered === i ? "#f59e0b" : "#fbbf24"} stroke="white" strokeWidth={1.5}
              onMouseEnter={function() { setHovered(i); }} style={{ cursor: "pointer" }} />;
          })}
          {/* Courbe CCA restant */}
          <polyline
            points={rows.map(function(r, i) { return cx(i) + "," + toY(r.soldeCCA); }).join(" ")}
            fill="none" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="4 2" strokeLinejoin="round" opacity={0.7} />
          {/* Axe X */}
          {rows.map(function(r, i) {
            const show = rows.length <= 20 || i === 0 || (i + 1) % 5 === 0;
            return show ? <text key={i} x={cx(i)} y={H - padB + 14} textAnchor="middle" fontSize={9} fill="#94a3b8">{r.year}</text> : null;
          })}
          <text x={padL + chartW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="#94a3b8">Année</text>
          {/* Légende */}
          {[
            { color: "#818cf8", label: "IS 15%" },
            { color: "#ef4444", label: "IS 25%" },
            { color: "#fbbf24", label: "Base IS" },
            { color: "#38bdf8", label: "CCA restant" },
            { color: "#16a34a", label: "Seuil 42 500 €" },
          ].map(function(l, i) {
            return (
              <g key={l.label} transform={"translate(" + (W - padR + 12) + "," + (padT + 4 + i * 20) + ")"}>
                <rect x={0} y={-8} width={10} height={10} fill={l.color} rx={3} />
                <text x={14} y={2} fontSize={9} fill="#475569">{l.label}</text>
              </g>
            );
          })}
          {/* Tooltip */}
          {h !== null && (
            <g>
              <rect x={ttX} y={2} width={ttW} height={ttH} rx={8} fill="rgba(255,255,255,0.97)" stroke="rgba(148,163,184,0.35)" strokeWidth={1} />
              <text x={ttX + 8} y={17} fontSize={11} fontWeight="700" fill="#0f172a">Année {h.year}</text>
              {[
                { label: "Base IS", value: h.resultatFiscal, color: "#fbbf24" },
                { label: "IS 15%", value: h.isPartBas, color: "#818cf8" },
                { label: "IS 25%", value: h.isPartHaut, color: "#ef4444" },
                { label: "IS total", value: h.isTotal, color: "#dc2626" },
                { label: "Tréso / mois", value: h.tresoConsolidee / 12, color: h.tresoConsolidee >= 0 ? "#16a34a" : "#dc2626" },
                { label: "CCA restant", value: h.soldeCCA, color: "#38bdf8" },
              ].map(function(row, idx) {
                return (
                  <g key={row.label} transform={"translate(" + ttX + "," + (24 + idx * 17) + ")"}>
                    <circle cx={8} cy={4} r={3} fill={row.color} />
                    <text x={16} y={8} fontSize={9} fill="#475569">{row.label}</text>
                    <text x={ttW - 6} y={8} fontSize={9} fontWeight="600" fill={row.color} textAnchor="end">{fmtK(row.value)}</text>
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {[
          { color: "#818cf8", label: "IS 15%" }, { color: "#ef4444", label: "IS 25%" },
          { color: "#fbbf24", label: "Base IS consolidée" }, { color: "#38bdf8", label: "CCA restant" },
          { color: "#16a34a", label: "Seuil 42 500 €" },
        ].map(function(l) {
          return (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#64748b" }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
              {l.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TABLEAU ANNUEL CONSOLIDE ─────────────────────────────────────────────────
function SCITableauAnnuel({ rows, sciParams }) {
  const [expanded, setExpanded] = React.useState(null);
  if (!rows || rows.length === 0) return null;

  return (
    <div style={Object.assign({}, SECTION, { marginTop: 0 })}>
      <SectionHeader icon="📋" title="Tableau de bord annuel consolidé" />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid rgba(148,163,184,0.2)" }}>
              {["An", "Loyers", "Charges+Amort", "Int. CCA", "Base IS", "IS dû", "Palier", "Tréso/mois", "CCA restant", "Dividendes nets"].map(function(h) {
                return <th key={h} style={{ padding: "7px 8px", textAlign: h === "An" ? "left" : "right", fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map(function(r, idx) {
              const isEven = idx % 2 === 0;
              const alerteColor = r.resultatFiscal > SEUIL_IS_BAS ? "rgba(254,226,226,0.6)" : r.alertePalier ? "rgba(254,243,199,0.6)" : "transparent";
              const margePct = Math.min(100, (r.resultatFiscal / SEUIL_IS_BAS) * 100);
              const isExpanded = expanded === r.year;
              return (
                <React.Fragment key={r.year}>
                  <tr
                    onClick={function() { setExpanded(isExpanded ? null : r.year); }}
                    style={{ background: isEven ? "rgba(248,250,252,0.5)" : alerteColor, borderBottom: "1px solid rgba(148,163,184,0.1)", cursor: "pointer" }}>
                    <td style={{ padding: "7px 8px", fontWeight: 700, color: "#334155" }}>{r.year}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: "#16a34a", fontWeight: 500 }}>{fmtK(r.loyersTotal)}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: "#64748b" }}>{fmtK(r.chargesTotal + r.amortTotal + r.provisionGrosTotal)}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: "#38bdf8" }}>{fmtK(r.interetsCCA)}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, color: r.resultatFiscal > SEUIL_IS_BAS ? "#dc2626" : "#0f172a" }}>{fmtK(r.resultatFiscal)}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{fmtK(r.isTotal)}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", minWidth: 80 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ flex: 1, height: 5, background: "rgba(148,163,184,0.2)", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ width: Math.min(100, margePct) + "%", height: "100%", background: margePct > 100 ? "#ef4444" : margePct > 80 ? "#f97316" : "#818cf8", borderRadius: 999 }} />
                        </div>
                        <span style={{ fontSize: 9, color: margePct >= 100 ? "#dc2626" : "#94a3b8", minWidth: 28 }}>
                          {margePct >= 100 ? "25%" : Math.round(margePct) + "%"}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, color: r.tresoConsolidee >= 0 ? "#16a34a" : "#dc2626" }}>{fmtK(r.tresoConsolidee / 12)}/m</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: "#38bdf8" }}>{fmtK(r.soldeCCA)}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: "#4338ca" }}>{fmtK(r.dividendesNets)}</td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ background: "rgba(99,102,241,0.04)" }}>
                      <td colSpan={10} style={{ padding: "8px 16px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {r.bienDetails.map(function(bd) {
                            return (
                              <div key={bd.nom} style={{ background: "rgba(255,255,255,0.9)", borderRadius: 8, padding: "6px 10px", fontSize: 10, border: "1px solid rgba(148,163,184,0.2)", minWidth: 140 }}>
                                <div style={{ fontWeight: 700, color: "#334155", marginBottom: 2 }}>{bd.nom}</div>
                                <div style={{ color: "#16a34a" }}>Loyers : {fmtEur(bd.loyers)}</div>
                                <div style={{ color: bd.resultat >= 0 ? "#6366f1" : "#dc2626" }}>Résultat : {fmtEur(bd.resultat)}</div>
                              </div>
                            );
                          })}
                          <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 8, padding: "6px 10px", fontSize: 10, border: "1px solid rgba(99,102,241,0.2)", minWidth: 140 }}>
                            <div style={{ fontWeight: 700, color: "#4338ca", marginBottom: 2 }}>Marge avant 25%</div>
                            <div style={{ color: "#334155" }}>{r.resultatFiscal > SEUIL_IS_BAS ? "⚠️ Seuil dépassé !" : fmtEur(r.margeAvantBasculement) + " restants"}</div>
                            {r.remboursementCCA > 0 && <div style={{ color: "#38bdf8" }}>Remb. CCA : {fmtEur(r.remboursementCCA)}</div>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>💡 Cliquer sur une ligne pour voir le détail par bien</div>
    </div>
  );
}

// ─── FORMULAIRE BIEN ──────────────────────────────────────────────────────────
function FormulaireBien({ bien, onChange }) {
  const sepS = { fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 };
  const inputS = { width: "100%", background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "7px 10px", color: "#0f172a", fontSize: 13, outline: "none" };
  const labelS = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={sepS}>Acquisition</div>
        <BienField vals={bien} onChange={onChange} field="prixAchat" label="Prix d'achat" unit="€" step="5000" />
        <BienField vals={bien} onChange={onChange} field="fraisAchat" label="Frais notaire + agence" unit="€" step="500" />
        <BienField vals={bien} onChange={onChange} field="travaux" label="Travaux" unit="€" step="1000" />
        <div style={sepS}>Financement</div>
        <BienField vals={bien} onChange={onChange} field="montantCredit" label="Montant emprunté" unit="€" step="5000" />
        <BienField vals={bien} onChange={onChange} field="tauxCredit" label="Taux hors assurance" unit="%" step="0.05" />
        <BienField vals={bien} onChange={onChange} field="dureeCredit" label="Durée du crédit" unit="ans" step="1" />
        <div style={sepS}>Frais notaire</div>
        <div>
          <label style={labelS}>Frais notaire/agence ({fmtEur(pf(bien.fraisAchat))})</label>
          <div style={{ display: "flex", gap: 6 }}>
            {[{ val: "1", label: "÷5 ans" }, { val: "0", label: "An 1" }].map(function(t) {
              const isA = bien.fraisNotaireAmort === t.val;
              return <button key={t.val} onClick={function() { onChange("fraisNotaireAmort", t.val); }}
                style={{ flex: 1, padding: "6px 8px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: isA ? "rgba(99,102,241,0.9)" : "rgba(148,163,184,0.12)", color: isA ? "#fff" : "#64748b" }}>{t.label}</button>;
            })}
          </div>
        </div>
        <BienField vals={bien} onChange={onChange} field="fraisDossierCredit" label="Frais dossier crédit" unit="€" step="100" />
        <BienField vals={bien} onChange={onChange} field="dureeFraisDossier" label="Amortis sur" unit="ans" step="1" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={sepS}>Revenus</div>
        <BienField vals={bien} onChange={onChange} field="loyerMensuel" label="Loyer mensuel HC" unit="€" step="50" />
        <BienField vals={bien} onChange={onChange} field="tauxRevalorisation" label="Reval. loyer/an" unit="%" step="0.5" hint="Indexation annuelle depuis la date d'achat" />
        <div>
          <label style={labelS}>Date d'achat</label>
          <div style={{ display: "flex", gap: 6 }}>
            <select
              value={(bien.dateAchat || "").split("-")[1] || "01"}
              onChange={function(e) {
                var parts = (bien.dateAchat || (new Date().getFullYear() + "-01")).split("-");
                onChange("dateAchat", parts[0] + "-" + e.target.value);
              }}
              style={{ flex: 1, minWidth: 0, background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "7px 6px", color: "#0f172a", fontSize: 12, outline: "none" }}>
              {["01","02","03","04","05","06","07","08","09","10","11","12"].map(function(m) {
                var labels = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
                return <option key={m} value={m}>{labels[parseInt(m,10)-1]}</option>;
              })}
            </select>
            <select
              value={(bien.dateAchat || "").split("-")[0] || new Date().getFullYear()}
              onChange={function(e) {
                var parts = (bien.dateAchat || (new Date().getFullYear() + "-01")).split("-");
                onChange("dateAchat", e.target.value + "-" + (parts[1] || "01"));
              }}
              style={{ flex: 1, minWidth: 0, background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "7px 6px", color: "#0f172a", fontSize: 12, outline: "none" }}>
              {(function() {
                var opts = []; var now = new Date().getFullYear();
                for (var yr = now - 10; yr <= now + 15; yr++) opts.push(yr);
                return opts.map(function(yr) { return <option key={yr} value={yr}>{yr}</option>; });
              })()}
            </select>
          </div>
        </div>
        <div>
          <label style={labelS}>Taux d'occupation</label>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <input type="number" value={bien.tauxOccupation} step="0.5" min="0" max="12"
              onChange={function(e) { onChange("tauxOccupation", e.target.value); }}
              style={{ width: "100%", background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "7px 10px", color: "#0f172a", fontSize: 13, outline: "none" }} />
            <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 55 }}>mois/an</span>
          </div>
        </div>
        <div style={sepS}>Charges annuelles</div>
        <BienField vals={bien} onChange={onChange} field="chargesAn" label="Charges immeuble" unit="€/an" />
        <BienField vals={bien} onChange={onChange} field="taxeFonciereAn" label="Taxe foncière" unit="€/an" />
        <BienField vals={bien} onChange={onChange} field="assurancePNOAn" label="Assurance PNO" unit="€/an" hint="0 = auto" />
        <BienField vals={bien} onChange={onChange} field="gliAn" label="GLI loyers impayés" unit="€/an" step="50" hint="≈ 2-3% des loyers — déductible IS" />
        <BienField vals={bien} onChange={onChange} field="gestionPct" label="Gestion locative" unit="%/an" step="0.5" />
        <BienField vals={bien} onChange={onChange} field="provisionTravauxAn" label="Provision entretien" unit="€/an" />
        <BienField vals={bien} onChange={onChange} field="expertComptableAn" label="Expert-comptable" unit="€/an" />
        <BienField vals={bien} onChange={onChange} field="fraisBancairesAn" label="Frais bancaires" unit="€/an" step="50" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={sepS}>Amortissements</div>
        <BienField vals={bien} onChange={onChange} field="coefAmortBatiment" label="Taux amort. bâtiment" unit="%/an" step="0.25" hint="2.5% standard" />
        <BienField vals={bien} onChange={onChange} field="coefAmortTravaux" label="Taux amort. travaux" unit="%/an" step="1" hint="10% standard" />
        <BienField vals={bien} onChange={onChange} field="partTerrain" label="Part terrain" unit="%" step="1" hint="15-20% non amortissable" />
        <BienField vals={bien} onChange={onChange} field="provisionGrosTravauxAn" label="Provision gros travaux" unit="€/an" step="100" />
      </div>
    </div>
  );
}

// ─── SIMULATEUR SCI PRINCIPAL ─────────────────────────────────────────────────
function SimulateurSCI() {
  const [biens, setBiens] = React.useState([DEFAULT_BIEN(1)]);
  const [activeBien, setActiveBien] = React.useState(1);
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [sciParams, setSciParams] = React.useState(DEFAULT_SCI_PARAMS);
  const [ccaAssocies, setCcaAssocies] = React.useState([{ id: 1, nom: "Associé 1", montant: "10000" }]);

  // ── Sauvegarde SCI ──────────────────────────────────────────────────────────
  var SCI_KEY = "radar-immo-sci-v2";
  const [nomProjet, setNomProjet] = React.useState("");
  const [saveStatus, setSaveStatus] = React.useState("idle");
  const [projets, setProjets] = React.useState(function() {
    try { return JSON.parse(localStorage.getItem("radar-immo-sci-v2")) || []; }
    catch(e) { return []; }
  });
  const saveTimer = React.useRef(null);

  useEffect(function() {
    if (!nomProjet.trim()) return;
    setSaveStatus("pending");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(function() { sauvegarderSCI(true); }, 1500);
    return function() { clearTimeout(saveTimer.current); };
  }, [biens, sciParams, ccaAssocies, nomProjet]);

  function sauvegarderSCI(silent) {
    if (!nomProjet.trim()) {
      if (!silent) alert("Donne un nom à ta simulation SCI");
      return;
    }
    var entry = {
      id: Date.now(),
      nom: nomProjet.trim(),
      biens: biens, sciParams: sciParams, ccaAssocies: ccaAssocies,
      savedAt: new Date().toLocaleDateString("fr-FR"),
    };
    setProjets(function(prev) {
      var liste = [entry].concat(prev.filter(function(p) { return p.nom !== nomProjet.trim(); }));
      localStorage.setItem("radar-immo-sci-v2", JSON.stringify(liste));
      return liste;
    });
    setSaveStatus("saved");
    setTimeout(function() { setSaveStatus("idle"); }, 3000);
  }

  function chargerProjetSCI(p) {
    setBiens(p.biens);
    setSciParams(p.sciParams);
    setCcaAssocies(p.ccaAssocies);
    setNomProjet(p.nom);
    setSaveStatus("idle");
  }

  function supprimerProjetSCI(id) {
    setProjets(function(prev) {
      var liste = prev.filter(function(p) { return p.id !== id; });
      localStorage.setItem("radar-immo-sci-v2", JSON.stringify(liste));
      return liste;
    });
  }

  function exportJSONSCI() {
    var blob = new Blob(
      [JSON.stringify({ nom: nomProjet, biens: biens, sciParams: sciParams, ccaAssocies: ccaAssocies }, null, 2)],
      { type: "application/json" }
    );
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "sci-" + (nomProjet || "simulation") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const updateBien = useCallback(function(id, field, value) {
    setBiens(function(prev) {
      return prev.map(function(b) { return b.id === id ? Object.assign({}, b, { [field]: value }) : b; });
    });
  }, []);

  const addBien = useCallback(function() {
    const newId = Math.max(...biens.map(function(b) { return b.id; })) + 1;
    setBiens(function(prev) { return prev.concat(DEFAULT_BIEN(newId)); });
    setActiveBien(newId);
    setActiveTab("bien_" + newId);
  }, [biens]);

  const removeBien = useCallback(function(id) {
    if (biens.length === 1) return;
    setBiens(function(prev) { return prev.filter(function(b) { return b.id !== id; }); });
    setActiveBien(biens[0].id !== id ? biens[0].id : biens[1].id);
    setActiveTab("dashboard");
  }, [biens]);

  const updateCCA = useCallback(function(id, field, value) {
    setCcaAssocies(function(prev) {
      return prev.map(function(a) { return a.id === id ? Object.assign({}, a, { [field]: value }) : a; });
    });
  }, []);

  const addCCA = useCallback(function() {
    const newId = Math.max(...ccaAssocies.map(function(a) { return a.id; })) + 1;
    setCcaAssocies(function(prev) { return prev.concat({ id: newId, nom: "Associé " + newId, montant: "0" }); });
  }, [ccaAssocies]);

  const projectionRows = useMemo(function() {
    return projeterSCI(biens, sciParams, ccaAssocies);
  }, [biens, sciParams, ccaAssocies]);

  // KPIs an 1
  const an1 = projectionRows[0] || {};
  const totalCCA = ccaAssocies.reduce(function(acc, a) { return acc + pf(a.montant); }, 0);
  const couleurTreso = (an1.tresoConsolidee || 0) >= 0 ? "#16a34a" : "#dc2626";
  const alertePalier = (an1.resultatFiscal || 0) > SEUIL_IS_BAS * 0.8;

  const sepS = { fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 };
  const inputS = { width: "100%", background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "7px 10px", color: "#0f172a", fontSize: 13, outline: "none" };
  const labelS = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 };

  // Tabs
  const tabs = [{ id: "dashboard", label: "📊 Tableau de bord" }]
    .concat(biens.map(function(b) { return { id: "bien_" + b.id, label: "🏠 " + b.nom, bienId: b.id }; }))
    .concat([{ id: "sci_params", label: "⚙️ Paramètres SCI" }]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Barre de sauvegarde SCI ── */}
      <div style={Object.assign({}, SECTION, { padding: "12px 20px" })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={nomProjet}
              onChange={function(e) { setNomProjet(e.target.value); }}
              placeholder="Nom de la simulation SCI"
              style={{ background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "6px 14px", fontSize: 13, color: "#0f172a", width: 220, outline: "none" }}
            />
            <button onClick={function() { sauvegarderSCI(false); }}
              style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 10, padding: "7px 16px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              💾 Sauver
            </button>
            <button onClick={exportJSONSCI}
              style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, padding: "7px 14px", color: "#4338ca", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
              ⬇️ Export JSON
            </button>
            <span style={{ fontSize: 11, color: saveStatus === "saved" ? "#16a34a" : saveStatus === "pending" ? "#d97706" : "transparent" }}>
              {saveStatus === "saved" ? "✅ Sauvegardé" : "💾 Modifications en cours..."}
            </span>
          </div>
        </div>
        {projets.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {projets.map(function(p) {
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 8, padding: "3px 10px" }}>
                  <button onClick={function() { chargerProjetSCI(p); }}
                    style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "#4338ca", cursor: "pointer" }}>
                    {p.nom}
                  </button>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{p.savedAt}</span>
                  <button onClick={function() { supprimerProjetSCI(p.id); }}
                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 11 }}>✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info banner */}
      <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.08),rgba(56,189,248,0.08))", borderRadius: 14, padding: "12px 16px", border: "1px solid rgba(99,102,241,0.2)", fontSize: 12, color: "#334155" }}>
        <strong>SCI IS — Pilotage multi-biens</strong> — Consolidez plusieurs biens dans une même SCI. IS calculé sur le résultat global. CCA remboursables sans fiscalité. Seuil 15% / 25% suivi chaque année.
      </div>

      {/* KPIs consolidés */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {[
          { label: "Biens dans la SCI", value: biens.length, icon: "🏠", color: "#4338ca" },
          { label: "Loyers consolidés/an", value: fmtEur(an1.loyersTotal || 0), icon: "💶", color: "#16a34a" },
          { label: "IS an 1", value: fmtEur(an1.isTotal || 0), icon: "🏛️", color: "#dc2626" },
          { label: "Tréso/mois an 1", value: fmt(an1.tresoConsolidee / 12 || 0, 0) + " €", icon: "💰", color: couleurTreso },
          { label: "CCA total (remboursable)", value: fmtEur(totalCCA), icon: "🔁", color: "#38bdf8" },
          { label: alertePalier ? "⚠️ Proche seuil 25%" : "Marge avant 25%", value: fmtEur(an1.margeAvantBasculement || 0), icon: "📏", color: alertePalier ? "#f97316" : "#16a34a" },
        ].map(function(kpi) {
          return (
            <div key={kpi.label} style={{ background: "rgba(255,255,255,0.8)", borderRadius: 14, padding: "12px", border: "1px solid rgba(148,163,184,0.2)", textAlign: "center", backdropFilter: "blur(12px)" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{kpi.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{kpi.label}</div>
            </div>
          );
        })}
      </div>

      {/* Navigation onglets */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {tabs.map(function(t) {
          const isActive = activeTab === t.id;
          return (
            <button key={t.id} onClick={function() { setActiveTab(t.id); if (t.bienId) setActiveBien(t.bienId); }}
              style={{ padding: "7px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: isActive ? "rgba(99,102,241,0.9)" : "rgba(148,163,184,0.12)", color: isActive ? "#fff" : "#64748b" }}>
              {t.label}
            </button>
          );
        })}
        <button onClick={addBien}
          style={{ padding: "7px 14px", borderRadius: 10, border: "1.5px dashed rgba(99,102,241,0.4)", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "transparent", color: "#6366f1" }}>
          + Ajouter un bien
        </button>
      </div>

      {/* Contenu onglet Dashboard */}
      {activeTab === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SCIConsolideChart rows={projectionRows} />
          <SCITableauAnnuel rows={projectionRows} sciParams={sciParams} />
        </div>
      )}

      {/* Contenu onglet Bien */}
      {biens.map(function(bien) {
        if (activeTab !== "bien_" + bien.id) return null;
        return (
          <div key={bien.id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={Object.assign({}, SECTION)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>🏠</span>
                  <input value={bien.nom} onChange={function(e) { updateBien(bien.id, "nom", e.target.value); }}
                    style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", background: "transparent", border: "none", outline: "none", borderBottom: "2px dashed rgba(99,102,241,0.3)" }} />
                </div>
                {biens.length > 1 && (
                  <button onClick={function() { removeBien(bien.id); }}
                    style={{ background: "rgba(220,38,38,0.08)", border: "none", borderRadius: 8, padding: "5px 12px", color: "#dc2626", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    Supprimer
                  </button>
                )}
              </div>
              <FormulaireBien bien={bien} onChange={function(field, val) { updateBien(bien.id, field, val); }} />
            </div>
            {/* Aperçu rapide an 1 pour ce bien */}
            {(function() {
              var r = calcBienAnnee(bien, new Date().getFullYear());
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10 }}>
                  {[
                    { label: "Loyers an 1", value: fmtEur(r.loyersAn), color: "#16a34a" },
                    { label: "Charges totales", value: fmtEur(r.chargesTotal), color: "#64748b" },
                    { label: "Amortissements", value: fmtEur(r.totalAmort), color: "#6366f1" },
                    { label: "Résultat fiscal", value: fmtEur(Math.max(0, r.resultatBrut)), color: r.resultatBrut <= 0 ? "#16a34a" : "#d97706" },
                  ].map(function(kpi) {
                    return (
                      <div key={kpi.label} style={{ background: "rgba(255,255,255,0.8)", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(148,163,184,0.2)", textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{kpi.label}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        );
      })}

      {/* Onglet Paramètres SCI */}
      {activeTab === "sci_params" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>

          <div style={SECTION}>
            <SectionHeader icon="🏛️" title="Fiscalité SCI" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelS}>Taux IS</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[{ val: "15", label: "15% (≤ 42 500 €)" }, { val: "25", label: "25% (normal)" }].map(function(t) {
                    const isA = sciParams.tauxIS === t.val;
                    return <button key={t.val} onClick={function() { setSciParams(function(p) { return Object.assign({}, p, { tauxIS: t.val }); }); }}
                      style={{ flex: 1, padding: "7px 8px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: isA ? "rgba(99,102,241,0.9)" : "rgba(148,163,184,0.12)", color: isA ? "#fff" : "#64748b" }}>{t.label}</button>;
                  })}
                </div>
              </div>
              <div>
                <label style={labelS}>Taux dividendes</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[{ val: "30", label: "30% (PFU)" }, { val: "17.2", label: "17.2% (PS)" }].map(function(t) {
                    const isA = sciParams.tauxDividendes === t.val;
                    return <button key={t.val} onClick={function() { setSciParams(function(p) { return Object.assign({}, p, { tauxDividendes: t.val }); }); }}
                      style={{ flex: 1, padding: "7px 8px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: isA ? "rgba(99,102,241,0.9)" : "rgba(148,163,184,0.12)", color: isA ? "#fff" : "#64748b" }}>{t.label}</button>;
                  })}
                </div>
              </div>
              <div>
                <label style={labelS}>Nombre de parts</label>
                <input type="number" value={sciParams.nbParts} min="1" step="1"
                  onChange={function(e) { setSciParams(function(p) { return Object.assign({}, p, { nbParts: e.target.value }); }); }} style={inputS} />
              </div>
              <div>
                <label style={labelS}>Capital social (€)</label>
                <input type="number" value={sciParams.capitalSocial} min="0" step="100"
                  onChange={function(e) { setSciParams(function(p) { return Object.assign({}, p, { capitalSocial: e.target.value }); }); }} style={inputS} />
              </div>
            </div>
          </div>

          <div style={SECTION}>
            <SectionHeader icon="🔁" title="Comptes Courants d'Associés (CCA)" />
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
              Les apports CCA sont remboursables sans fiscalité. Les intérêts versés aux associés ({sciParams.tauxCCA}%/an) sont déductibles du résultat fiscal SCI.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={labelS}>Taux intérêts CCA (%/an)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <input type="number" value={sciParams.tauxCCA} min="0" step="0.1"
                    onChange={function(e) { setSciParams(function(p) { return Object.assign({}, p, { tauxCCA: e.target.value }); }); }} style={inputS} />
                  <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 28 }}>%</span>
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Taux légal 2024 : {TAUX_CCA_LEGAL}% — déductible du résultat fiscal</div>
              </div>
              <div>
                <label style={labelS}>Stratégie de distribution</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[{ val: "rembourser", label: "🔁 Rembourser CCA d'abord" }, { val: "distribuer", label: "💸 Distribuer dividendes" }].map(function(t) {
                    const isA = sciParams.distribuerOuRembourser === t.val;
                    return <button key={t.val} onClick={function() { setSciParams(function(p) { return Object.assign({}, p, { distribuerOuRembourser: t.val }); }); }}
                      style={{ flex: 1, padding: "7px 8px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: isA ? "rgba(99,102,241,0.9)" : "rgba(148,163,184,0.12)", color: isA ? "#fff" : "#64748b" }}>{t.label}</button>;
                  })}
                </div>
              </div>
              <div style={sepS}>Associés & apports CCA</div>
              {ccaAssocies.map(function(assoc) {
                return (
                  <div key={assoc.id} style={{ background: "rgba(56,189,248,0.07)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(56,189,248,0.2)" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <input value={assoc.nom}
                        onChange={function(e) { updateCCA(assoc.id, "nom", e.target.value); }}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", borderBottom: "1px dashed rgba(56,189,248,0.4)", fontSize: 13, fontWeight: 600, color: "#0f172a" }} />
                      {ccaAssocies.length > 1 && (
                        <button onClick={function() { setCcaAssocies(function(prev) { return prev.filter(function(a) { return a.id !== assoc.id; }); }); }}
                          style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>✕</button>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <input type="number" value={assoc.montant} min="0" step="1000"
                        onChange={function(e) { updateCCA(assoc.id, "montant", e.target.value); }}
                        style={Object.assign({}, inputS, { flex: 1 })} />
                      <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 16 }}>€</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#38bdf8", marginTop: 4 }}>
                      Intérêts/an : {fmtEur(pf(assoc.montant) * pf(sciParams.tauxCCA) / 100)} (déductibles)
                    </div>
                  </div>
                );
              })}
              <button onClick={addCCA}
                style={{ padding: "7px", borderRadius: 9, border: "1.5px dashed rgba(56,189,248,0.4)", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "transparent", color: "#0ea5e9" }}>
                + Ajouter un associé
              </button>
              <div style={{ background: "rgba(56,189,248,0.08)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(56,189,248,0.2)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", marginBottom: 4 }}>Récapitulatif CCA</div>
                <StatRow label="Total CCA apporté" value={fmtEur(totalCCA)} color="#38bdf8" bold />
                <StatRow label={"Intérêts/an (" + sciParams.tauxCCA + "%)"} value={fmtEur(totalCCA * pf(sciParams.tauxCCA) / 100)} color="#0ea5e9" border={false} />
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
                  ✅ Remboursement non imposable — sortie d'argent sans PFU ni IR
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: "rgba(241,245,249,0.8)", borderRadius: 12, padding: "10px 14px", fontSize: 11, color: "#64748b", border: "1px solid rgba(148,163,184,0.2)" }}>
        ℹ️ IS calculé sur le résultat <strong>consolidé</strong> de la SCI (Σ tous biens). Seuil taux réduit 15% : 42 500 €/an. Les loyers sont indexés +1%/an. Les CCA sont remboursables sans imposition et les intérêts versés sont déductibles (taux légal {TAUX_CCA_LEGAL}%). Attention à la plus-value à la revente (amortissements réintégrés).
      </div>
    </div>
  );
}


export default function App() {
  const [onglet, setOnglet] = useState("analyse");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Photos et projets remontés ici pour survivre aux changements d'onglet
  const [simPhotos, setSimPhotos] = useState(function() {
    try { return JSON.parse(localStorage.getItem("radar-immo-photos-v1")) || []; }
    catch(e) { return []; }
  });
  const [simProjets, setSimProjets] = useState(function() {
    try { return JSON.parse(localStorage.getItem("radar-immo-projets-v1")) || []; }
    catch(e) { return []; }
  });
  const [simProjetACharger, setSimProjetACharger] = useState(null);

  const ouvrirProjet = function(p) {
    setSimProjetACharger(p);
    setOnglet("simulation");
  };

  const navItems = [
    { id: "analyse",    label: "Analyse communes",        icon: "🗺️" },
    { id: "simulation", label: "Simulation projet",       icon: "📊" },
    { id: "credit",     label: "Simulation de crédit",    icon: "🏦" },
    { id: "offres",     label: "Comparateur offres",      icon: "⚖️" },
    { id: "travaux",    label: "Simulateur travaux",      icon: "🔨" },
    { id: "plusvalue",  label: "Plus-value immo",         icon: "📈" },
    { id: "sci",       label: "Simulateur SCI IS",          icon: "🏢" },
    { id: "favoris",   label: "Mes projets",                  icon: "⭐" },
  ];

  const titres = {
    analyse:    { h: "Analyse investissement — Seine-Maritime", sub: "TOP 10 des communes selon tes filtres · Clic = détail · Clic sur une jauge = détail du score · Clic droit = comparer" },
    simulation: { h: "Simulation de rentabilité", sub: "Paramètre ton projet, sauvegarde-le et visualise l'évolution du cash-flow par régime fiscal." },
    credit:     { h: "Simulation de crédit", sub: "Calcule mensualités, coût total et tableau d'amortissement de ton prêt." },
    offres:     { h: "Comparateur d'offres de financement", sub: "Compare plusieurs propositions de banques sur une base homogène avec score pondéré." },
    travaux:    { h: "Simulateur de coût des travaux", sub: "Estime le budget travaux poste par poste et son impact sur la rentabilité." },
    plusvalue:  { h: "Calculateur de plus-value immobilière", sub: "Estime l'impôt sur la plus-value selon la durée de détention et les abattements légaux." },
    sci:       { h: "Simulateur SCI à l'IS", sub: "Analyse rentabilité, fiscalité IS, amortissements et dividendes de ta SCI." },
    favoris:   { h: "Mes projets sauvegardés", sub: "Retrouve et charge toutes tes simulations d'investissement." },
  };

  const handleNav = function(id) { setOnglet(id); setSidebarOpen(false); };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "radial-gradient(ellipse at top left,#bfdbfe 0,transparent 50%),radial-gradient(ellipse at top right,#fce7f3 0,transparent 50%),radial-gradient(ellipse at bottom center,#d1fae5 0,#f1f5f9 60%)", fontFamily: "-apple-system,BlinkMacSystemFont,system-ui,sans-serif" }}>

      {/* Sidebar */}
      <aside style={{ width: sidebarOpen ? 220 : 64, minWidth: sidebarOpen ? 220 : 64, background: "rgba(255,255,255,0.72)", borderRight: "1px solid rgba(148,163,184,0.25)", padding: sidebarOpen ? "18px 12px" : "18px 8px", display: "flex", flexDirection: "column", gap: 4, backdropFilter: "blur(24px)", position: "sticky", top: 0, height: "100vh", overflowX: "hidden", transition: "width 0.22s cubic-bezier(.4,0,.2,1), min-width 0.22s cubic-bezier(.4,0,.2,1), padding 0.22s", zIndex: 30, boxShadow: sidebarOpen ? "4px 0 24px rgba(99,102,241,0.08)" : "none" }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, overflow: "hidden", minHeight: 40 }}>
          <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(99,102,241,0.45)", cursor: "pointer" }}
            onClick={function() { setSidebarOpen(!sidebarOpen); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 12L12 4l9 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 10v8a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="18" cy="8" r="1.5" fill="#fbbf24"/>
            </svg>
          </div>
          {sidebarOpen && (
            <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                <span style={{ background: "linear-gradient(90deg,#6366f1,#38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>RADAR</span>
                <span style={{ color: "#0f172a" }}> IMMO</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", letterSpacing: "2px", marginTop: 1 }}>76</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {navItems.map(function(n) {
            const isActive = onglet === n.id;
            return (
              <button key={n.id} onClick={function() { handleNav(n.id); }} title={!sidebarOpen ? n.label : undefined}
                style={{ display: "flex", alignItems: "center", gap: sidebarOpen ? 10 : 0, justifyContent: sidebarOpen ? "flex-start" : "center", padding: sidebarOpen ? "9px 10px" : "9px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, width: "100%", textAlign: "left", background: isActive ? "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(56,189,248,0.15))" : "transparent", color: isActive ? "#4338ca" : "#64748b", borderLeft: isActive ? "3px solid #6366f1" : "3px solid transparent", transition: "all 0.15s", overflow: "hidden", whiteSpace: "nowrap", position: "relative" }}>
                <span style={{ fontSize: 17, flexShrink: 0 }}>{n.icon}</span>
                {sidebarOpen && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{n.label}</span>}
                {isActive && !sidebarOpen && <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, borderRadius: "3px 0 0 3px", background: "#6366f1" }} />}
              </button>
            );
          })}
        </div>

        {/* Toggle */}
        <button onClick={function() { setSidebarOpen(!sidebarOpen); }}
          style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "flex-end" : "center", gap: 6, padding: "7px 8px", borderRadius: 10, border: "none", cursor: "pointer", background: "rgba(148,163,184,0.1)", color: "#94a3b8", fontSize: 11, fontWeight: 500, width: "100%", transition: "all 0.15s" }}>
          <span style={{ fontSize: 14, transition: "transform 0.22s", transform: sidebarOpen ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block" }}>›</span>
          {sidebarOpen && <span>Réduire</span>}
        </button>
        {!sidebarOpen && <div style={{ fontSize: 9, color: "#cbd5e1", textAlign: "center", marginTop: 4, letterSpacing: "1px", fontWeight: 700 }}>76</div>}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: 20, overflowY: "auto", minWidth: 0 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>{titres[onglet].h}</h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{titres[onglet].sub}</p>
        </div>
        {onglet === "analyse"    && <AnalyseCommunes />}
        {onglet === "simulation" && <SimulationProjet photos={simPhotos} setPhotos={setSimPhotos} projets={simProjets} setProjets={setSimProjets} projetACharger={simProjetACharger} onProjetCharge={function() { setSimProjetACharger(null); }} />}
        {onglet === "credit"     && <SimulateurCredit />}
        {onglet === "offres"     && <ComparateurOffres />}
        {onglet === "travaux"    && <SimulateurTravaux />}
        {onglet === "plusvalue"  && <CalculateurPlusValue />}
        {onglet === "sci"       && <SimulateurSCI />}
        {onglet === "favoris"   && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {simProjets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#64748b" }}>Aucun projet sauvegardé</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>Crée une simulation et clique sur "💾 Sauver" pour la retrouver ici.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {simProjets.map(function(p) {
                  var note = (function() {
                    try {
                      var r = calculerSimulation(p.inputs);
                      return calculerNote(r, p.regimeActif);
                    } catch(e) { return null; }
                  })();
                  var noteColor = note != null ? getNoteColor(note) : "#94a3b8";
                  var noteLabel = note != null ? getNoteLabel(note) : "—";
                  return (
                    <div key={p.id} style={{ background: "rgba(255,255,255,0.85)", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 24px rgba(99,102,241,0.10)", border: "1px solid rgba(148,163,184,0.2)", backdropFilter: "blur(18px)", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                      onClick={function() { ouvrirProjet(p); }}
                      onMouseEnter={function(e) { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(99,102,241,0.18)"; }}
                      onMouseLeave={function(e) { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 24px rgba(99,102,241,0.10)"; }}>
                      {/* Photo de couverture */}
                      <div style={{ height: 160, background: p.coverPhoto ? "transparent" : "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(56,189,248,0.15))", position: "relative", overflow: "hidden" }}>
                        {p.coverPhoto
                          ? <img src={p.coverPhoto} alt={p.nom} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 48 }}>🏠</div>
                        }
                        {/* Badge note */}
                        {note != null && (
                          <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.92)", borderRadius: 12, padding: "6px 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", textAlign: "center", minWidth: 56 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: noteColor, lineHeight: 1 }}>{note}</div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: noteColor, marginTop: 1 }}>{noteLabel}</div>
                          </div>
                        )}
                        {/* Badge régime */}
                        <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(99,102,241,0.88)", color: "#fff", fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 8 }}>
                          {p.regimeActif}
                        </div>
                      </div>
                      {/* Infos */}
                      <div style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nom}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>📅 {p.savedAt}</span>
                          {p.inputs && p.inputs.prixVente && (
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#4338ca" }}>{fmtEur(pf(p.inputs.prixVente))}</span>
                          )}
                        </div>
                        {/* KPIs rapides */}
                        {p.inputs && (function() {
                          try {
                            var r = calculerSimulation(p.inputs);
                            var reg = r.regimes[p.regimeActif];
                            var cfMois = reg ? Math.round(reg.tresorerie / 12) : null;
                            return (
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
                                {[
                                  { label: "Rdt brut", value: fmtPct(r.rendBrut), color: "#16a34a" },
                                  { label: "CF/mois", value: cfMois != null ? (cfMois >= 0 ? "+" : "") + fmt(cfMois, 0) + " €" : "—", color: cfMois != null && cfMois >= 0 ? "#16a34a" : "#dc2626" },
                                  { label: "Loyer/mois", value: fmtEur(pf(p.inputs.loyerMensuelHC)), color: "#0ea5e9" },
                                ].map(function(k) {
                                  return (
                                    <div key={k.label} style={{ background: "rgba(241,245,249,0.8)", borderRadius: 10, padding: "6px 8px", textAlign: "center" }}>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</div>
                                      <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>{k.label}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          } catch(e) { return null; }
                        })()}
                        <button
                          onClick={function(e) { e.stopPropagation(); ouvrirProjet(p); }}
                          style={{ width: "100%", background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 10, padding: "8px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                          📂 Ouvrir la simulation
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
