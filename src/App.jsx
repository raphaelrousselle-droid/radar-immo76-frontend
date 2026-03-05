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
  const totalFraisAnnuels = pf(i.chargesImmeubleAn) + pf(i.taxeFonciereAn) + assurancePNO + gestionAn + pf(i.provisionTravauxAn) + pf(i.fraisBancairesAn) + pf(i.expertComptableAn);
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
    const fraisAn = pf(inputs.chargesImmeubleAn) + pf(inputs.taxeFonciereAn) + assurancePNOBase + gestionAn + pf(inputs.provisionTravauxAn) + pf(inputs.fraisBancairesAn) + pf(inputs.expertComptableAn);
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
  prixVente: "175000", fraisNotaire: "13300", travaux: "0", amenagements: "0",
  fraisAgencePct: "5", apport: "14000", tauxCredit: "4.2", dureeAnnees: "25",
  surfaceGlobale: "0", loyerMensuelHC: "1000", tauxOccupation: "11.5",
  chargesImmeubleAn: "250", taxeFonciereAn: "1400", assurancePNOAn: "0",
  gestionLocativePct: "0", provisionTravauxAn: "0", fraisBancairesAn: "300",
  expertComptableAn: "600", coefAmortissement: "4.75", tauxIS: "15", tmi: "11",
};

function SimulationProjet() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [lots, setLots] = useState([Object.assign({}, LOT_DEFAULT)]);
  const [regimeActif, setRegimeActif] = useState("SAS / SCI IS");
  const [nomProjet, setNomProjet] = useState("");
  const [projets, setProjets] = useState(function() { try { return JSON.parse(localStorage.getItem(PROJETS_KEY)) || []; } catch(e) { return []; } });
  const [activeTab, setActiveTab] = useState("params");

  const handleChange = function(e) { const name = e.target.name; const value = e.target.value; setInputs(function(prev) { return Object.assign({}, prev, { [name]: value }); }); };
  const sauvegarder = function() {
    if (!nomProjet.trim()) return;
    const nouveau = { id: Date.now(), nom: nomProjet.trim(), inputs: Object.assign({}, inputs), lots: lots, regimeActif: regimeActif, savedAt: new Date().toLocaleDateString("fr-FR") };
    const liste = [nouveau].concat(projets.filter(function(p) { return p.nom !== nomProjet.trim(); }));
    setProjets(liste); localStorage.setItem(PROJETS_KEY, JSON.stringify(liste)); setNomProjet("");
  };
  const charger = function(p) { setInputs(p.inputs); setRegimeActif(p.regimeActif); if (p.lots) setLots(p.lots); };
  const supprimer = function(id) { const liste = projets.filter(function(p) { return p.id !== id; }); setProjets(liste); localStorage.setItem(PROJETS_KEY, JSON.stringify(liste)); };

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
                <Tag color="purple">{regimeActif}</Tag>
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
          </div>
        </div>
        {projets.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {projets.map(function(p) {
              return (<div key={p.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 8, padding: "3px 10px" }}>
                <button onClick={function() { charger(p); }} style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "#4338ca", cursor: "pointer" }}>📂 {p.nom}</button>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>{p.savedAt}</span>
                <button onClick={function() { supprimer(p.id); }} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 11 }}>✕</button>
              </div>);
            })}
          </div>
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
                    {c.population && <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>{c.population.toLocaleString("fr-FR")} hab.</div>}
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
                {detail.rentabilite_brute_pct && (
                  <div style={{ marginBottom: 10, background: "rgba(220,252,231,0.8)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(34,197,94,0.3)" }}>
                    <div style={{ fontSize: 10, color: "#15803d" }}>Rentabilité brute estimée</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#15803d" }}>{detail.rentabilite_brute_pct} %</div>
                  </div>
                )}
                {[{ title: "Socio-éco", rows: [{ label: "Revenu médian", v: detail.socio_eco && detail.socio_eco.revenu_median ? detail.socio_eco.revenu_median.toLocaleString("fr-FR") + " €" : "—" }, { label: "Chômage", v: detail.socio_eco && detail.socio_eco.chomage_pct != null ? detail.socio_eco.chomage_pct + " %" : "—" }, { label: "Taux pauvreté", v: detail.socio_eco && detail.socio_eco.taux_pauvrete_pct != null ? detail.socio_eco.taux_pauvrete_pct + " %" : "—" }] }, { title: "Démographie", rows: [{ label: "Population", v: detail.population ? detail.population.toLocaleString("fr-FR") + " hab." : "—" }, { label: "Évolution/an", v: detail.demographie && detail.demographie.evolution_pop_pct_an != null ? detail.demographie.evolution_pop_pct_an + " %" : "—" }, { label: "Vacance", v: detail.demographie && detail.demographie.vacance_pct != null ? detail.demographie.vacance_pct + " %" : "—" }] }].map(function(block) {
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
}
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

  const ajouterOffre = function() {
    const newId = Math.max.apply(null, offres.map(function(o) { return o.id; })) + 1;
    sauver(offres.concat([OFFRE_DEFAULT(newId)]));
  };

  const supprimerOffre = function(id) {
    if (offres.length <= 1) return;
    sauver(offres.filter(function(o) { return o.id !== id; }));
  };

  const updateOffre = function(id, field, value) {
    sauver(offres.map(function(o) { return o.id === id ? Object.assign({}, o, { [field]: value }) : o; }));
  };

  const calcOffre = function(o) {
    const M = pf(o.montant);
    const D = Math.max(1, pf(o.duree));
    const nMois = D * 12;
    const tMensuel = pf(o.taux) / 100 / 12;
    const tAssurMensuel = pf(o.assurance) / 100 / 12;
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

  // Trouver le meilleur sur chaque critère
  const meilleurMensualite = Math.min.apply(null, resultats.map(function(r) { return r.calc.mensualiteTotale; }));
  const meilleurCoutTotal  = Math.min.apply(null, resultats.map(function(r) { return r.calc.coutTotal; }));
  const meilleurTaeg       = Math.min.apply(null, resultats.map(function(r) { return r.calc.taeg; }));

  const isBest = function(val, best) { return Math.abs(val - best) < 0.01; };

  const couleurs = ["#6366f1", "#0ea5e9", "#16a34a", "#f97316", "#a855f7"];

  const inputSmall = { background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 8, padding: "5px 8px", fontSize: 13, color: "#0f172a", outline: "none", width: "100%" };

  const BestBadge = function() {
    return <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: "rgba(22,163,74,0.15)", color: "#15803d", border: "1px solid rgba(22,163,74,0.3)", marginLeft: 5 }}>✓ Meilleur</span>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Bouton ajouter */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>{offres.length} offre{offres.length > 1 ? "s" : ""} comparée{offres.length > 1 ? "s" : ""} · Les données sont sauvegardées automatiquement</div>
        <button onClick={ajouterOffre} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 10, padding: "8px 16px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
          + Ajouter une offre
        </button>
      </div>

      {/* Cartes de saisie */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {offres.map(function(o, idx) {
          const couleur = couleurs[idx % couleurs.length];
          const r = resultats.find(function(r) { return r.id === o.id; }).calc;
          return (
            <div key={o.id} style={{ background: "rgba(255,255,255,0.75)", borderRadius: 18, padding: 16, border: "2px solid " + couleur + "44", boxShadow: "0 4px 20px " + couleur + "18", backdropFilter: "blur(16px)" }}>
              {/* Header carte */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: couleur }} />
                  <input value={o.banque} onChange={function(e) { updateOffre(o.id, "banque", e.target.value); }}
                    style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", background: "transparent", border: "none", outline: "none", borderBottom: "1px dashed " + couleur + "66", width: 140 }} />
                </div>
                <button onClick={function() { supprimerOffre(o.id); }} style={{ background: "rgba(239,68,68,0.08)", border: "none", borderRadius: 8, padding: "3px 9px", color: "#dc2626", cursor: offres.length > 1 ? "pointer" : "not-allowed", fontSize: 12, opacity: offres.length > 1 ? 1 : 0.3 }}>✕</button>
              </div>

              {/* Inputs */}
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

                {/* Options booléennes */}
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

                {/* Différé */}
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(148,163,184,0.15)" }}>
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
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(148,163,184,0.15)" }}>
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

              {/* Mini résultat dans la carte */}
              <div style={{ marginTop: 12, background: couleur + "10", borderRadius: 12, padding: "10px 12px", border: "1px solid " + couleur + "33" }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>Mensualité totale</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: couleur }}>{fmt(r.mensualiteTotale, 0)} €<span style={{ fontSize: 13, fontWeight: 400 }}>/mois</span></div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>dont {fmt(r.mensualiteAssur, 0)} € assurance</div>
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
                  return (
                    <th key={o.id} style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, fontWeight: 700, color: couleurs[idx % couleurs.length] }}>{o.banque}</th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Montant", fn: function(r) { return fmtEur(pf(r.offre.montant)); }, best: null },
                { label: "Durée", fn: function(r) { return fmt(pf(r.offre.duree), 0) + " ans"; }, best: null },
                { label: "Taux crédit", fn: function(r) { return pf(r.offre.taux).toFixed(2) + " %"; }, best: null },
                { label: "Taux assurance", fn: function(r) { return pf(r.offre.assurance).toFixed(2) + " %"; }, best: null },
                { label: "Mensualité crédit", fn: function(r) { return fmt(r.calc.mensualiteCredit, 0) + " €"; }, best: null },
                { label: "Mensualité assurance", fn: function(r) { return fmt(r.calc.mensualiteAssur, 0) + " €"; }, best: null },
                { label: "Mensualité totale", fn: function(r) { return fmt(r.calc.mensualiteTotale, 0) + " €"; }, bestVal: meilleurMensualite, bestFn: function(r) { return r.calc.mensualiteTotale; }, highlight: true },
                { label: "Coût des intérêts", fn: function(r) { return fmtEur(r.calc.coutInterets); }, best: null },
                { label: "Coût assurance totale", fn: function(r) { return fmtEur(r.calc.coutAssurance); }, best: null },
                { label: "Frais (dossier+garantie+courtier)", fn: function(r) { return fmtEur(r.calc.fraisTotaux); }, best: null },
                { label: "Coût total (intérêts+assur.+frais)", fn: function(r) { return fmtEur(r.calc.coutTotal); }, bestVal: meilleurCoutTotal, bestFn: function(r) { return r.calc.coutTotal; }, highlight: true },
                { label: "TAEG estimé", fn: function(r) { return r.calc.taeg.toFixed(2) + " %"; }, bestVal: meilleurTaeg, bestFn: function(r) { return r.calc.taeg; }, highlight: true },
                { label: "Modulation mensualités", fn: function(r) { return r.offre.modulation ? "✓ Oui" : "✗ Non"; }, best: null },
                { label: "Remb. anticipé sans pénalité", fn: function(r) { return r.offre.remboursementAnticipe ? "✓ Oui" : "✗ Non"; }, best: null },
                { label: "Domiciliation obligatoire", fn: function(r) { return r.offre.domiciliation ? "⚠ Oui" : "✓ Non"; }, best: null },
                { label: "Différé", fn: function(r) { return r.offre.differe ? "✓ " + pf(r.offre.dureeDiffere) + " mois" : "✗ Non"; }, best: null },
                { label: "Type de garantie", fn: function(r) { return r.offre.typeGarantie === "hypotheque" ? "🏠 Hypothèque" : "🤝 Cautionnement"; }, best: null },

              ].map(function(row, idx) {
                return (
                  <tr key={row.label} style={{ borderBottom: "1px solid rgba(148,163,184,0.1)", background: row.highlight ? "rgba(99,102,241,0.03)" : (idx % 2 === 0 ? "rgba(248,250,252,0.5)" : "transparent") }}>
                    <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: row.highlight ? 700 : 400, color: row.highlight ? "#334155" : "#64748b" }}>{row.label}</td>
                    {resultats.map(function(r, ridx) {
                      const isB = row.bestFn && isBest(row.bestFn(r), row.bestVal);
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
            { label: "Mensualité la plus basse", best: meilleurMensualite, fn: function(r) { return r.calc.mensualiteTotale; }, format: function(v) { return fmt(v, 0) + " €/mois"; } },
            { label: "Coût total le plus bas", best: meilleurCoutTotal, fn: function(r) { return r.calc.coutTotal; }, format: function(v) { return fmtEur(v); } },
            { label: "TAEG le plus bas", best: meilleurTaeg, fn: function(r) { return r.calc.taeg; }, format: function(v) { return v.toFixed(2) + " %"; } },
          ].map(function(critere) {
            const winner = resultats.find(function(r) { return isBest(critere.fn(r), critere.best); });
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

export default function App() {
  const [onglet, setOnglet] = useState("analyse");

  const navItems = [
    { id: "analyse",    label: "Analyse communes",               icon: "📊" },
    { id: "simulation", label: "Simulation projet",              icon: "💼" },
    { id: "credit",     label: "Simulation de crédit",           icon: "🏦" },
    { id: "offres",     label: "Comparateur offres financement", icon: "📑" },
    { id: "travaux",    label: "Simulateur coût travaux",        icon: "🛠️" },
  ];

  const titres = {
    analyse:    { h: "Analyse investissement — Seine-Maritime",  sub: "TOP 10 · Clic = détail · Clic sur une jauge = détail du score · Clic droit = comparer" },
    simulation: { h: "Simulation de rentabilité",                sub: "Paramètre ton projet, sauvegarde-le et visualise l'évolution du cash-flow par régime fiscal." },
    credit:     { h: "Simulation de crédit",                     sub: "Calcule mensualités, coût total et tableau d'amortissement de ton prêt." },
    offres:     { h: "Comparateur d'offres de financement",      sub: "Compare plusieurs propositions de banques sur une base homogène." },
    travaux:    { h: "Simulateur de coût des travaux",           sub: "Estime le budget travaux poste par poste et son impact sur la rentabilité." },
  };

  const Placeholder = function({ texte }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, gap: 16 }}>
        <div style={{ fontSize: 48 }}>🚧</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#334155" }}>En cours de développement</div>
        <div style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", maxWidth: 400 }}>{texte}</div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "radial-gradient(ellipse at top left,#bfdbfe 0%,transparent 50%),radial-gradient(ellipse at top right,#fce7f3 0%,transparent 50%),radial-gradient(ellipse at bottom center,#d1fae5 0%,#f1f5f9 60%)", fontFamily: "-apple-system,BlinkMacSystemFont,system-ui,sans-serif" }}>

      {/* Sidebar */}
      <aside style={{ width: 220, minWidth: 220, background: "rgba(255,255,255,0.65)", borderRight: "1px solid rgba(148,163,184,0.25)", padding: "18px 12px", display: "flex", flexDirection: "column", gap: 4, backdropFilter: "blur(20px)", position: "relative", zIndex: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#38bdf8,#6366f1)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 10px rgba(99,102,241,0.35)" }}>R</span>
          Radar Immo 76
        </div>

        {navItems.map(function(n) {
          const isActive = onglet === n.id;
          return (
            <button
              key={n.id}
              onClick={function() { setOnglet(n.id); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", borderRadius: 10, border: "none",
                cursor: "pointer", fontSize: 13, fontWeight: 500,
                width: "100%", textAlign: "left",
                background: isActive ? "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(56,189,248,0.12))" : "transparent",
                color: isActive ? "#4338ca" : "#64748b",
                borderLeft: isActive ? "3px solid #6366f1" : "3px solid transparent",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 15 }}>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          );
        })}

        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "#94a3b8", paddingTop: 8, borderTop: "1px solid rgba(148,163,184,0.2)" }}>Sources : DVF · ANIL · INSEE</div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: 20, overflowY: "auto", minWidth: 0 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>{titres[onglet].h}</h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{titres[onglet].sub}</p>
        </div>

        {onglet === "analyse"    && <AnalyseCommunes />}
        {onglet === "simulation" && <SimulationProjet />}
        {onglet === "credit" && <SimulateurCredit />}
        {onglet === "offres" && <ComparateurOffres />}
        {onglet === "travaux" && <SimulateurTravaux />}
      </main>

    </div>
  );
}
