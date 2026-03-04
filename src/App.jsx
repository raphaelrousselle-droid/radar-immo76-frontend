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
    rendement: {
      title: "Détail — Rendement", color: "#0ea5e9",
      items: [
        { label: "Prix appartement/m²", value: pri.appartement_m2 ? pri.appartement_m2.toLocaleString("fr-FR") + " €" : "—" },
        { label: "Prix maison/m²", value: pri.maison_m2 ? pri.maison_m2.toLocaleString("fr-FR") + " €" : "—" },
        { label: "Loyer médian/m²", value: detail && detail.loyer && detail.loyer.appartement_m2 != null ? Number(detail.loyer.appartement_m2).toFixed(1) + " €/m²/mois" : "—" },
        { label: "Rentabilité brute", value: detail && detail.rentabilite_brute_pct ? detail.rentabilite_brute_pct + " %" : "—", highlight: true },
        { label: "Nb ventes appartements", value: pri.nb_ventes_apt != null ? pri.nb_ventes_apt : "—" },
        { label: "Nb ventes maisons", value: pri.nb_ventes_mai != null ? pri.nb_ventes_mai : "—" },
      ],
      note: "Rendement brut ≈ (loyer × 12) / prix m².",
    },
    demographie: {
      title: "Détail — Démographie", color: "#8b5cf6",
      items: [
        { label: "Population", value: detail && detail.population ? detail.population.toLocaleString("fr-FR") + " hab." : "—" },
        { label: "Évolution population/an", value: dem.evolution_pop_pct_an != null ? dem.evolution_pop_pct_an + " %" : "—", highlight: true },
        { label: "Vacance logements", value: dem.vacance_pct != null ? dem.vacance_pct + " %" : "—", highlight: true },
        { label: "Tension locative", value: dem.tension_locative_pct != null ? dem.tension_locative_pct + " %" : "—", highlight: true },
        { label: "Zone ABC", value: detail && detail.zonage_abc ? detail.zonage_abc : "—" },
      ],
      note: "Score basé sur dynamique démographique, vacance et locataires.",
    },
    socio_eco: {
      title: "Détail — Socio-économique", color: "#22c55e",
      items: [
        { label: "Revenu médian", value: se.revenu_median ? se.revenu_median.toLocaleString("fr-FR") + " €" : "—", highlight: true },
        { label: "Taux de chômage", value: se.chomage_pct != null ? se.chomage_pct + " %" : "—", highlight: true },
        { label: "Taux de pauvreté", value: se.taux_pauvrete_pct != null ? se.taux_pauvrete_pct + " %" : "—", highlight: true },
        { label: "Part cadres", value: se.part_cadres_pct != null ? se.part_cadres_pct + " %" : "—" },
        { label: "Indice de Gini", value: se.gini != null ? se.gini : "—" },
      ],
      note: "Plus le revenu est élevé et le chômage faible, meilleur est le score.",
    },
  };
  const cfg = configs[scoreKey];
  if (!cfg) return null;
  return (
    <div style={{ background: "rgba(255,255,255,0.85)", borderRadius: 14, padding: 12, marginTop: 8, border: "1px solid " + cfg.color + "55", backdropFilter: "blur(16px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{cfg.title}</div>
        <button onClick={onClose} style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>✕</button>
      </div>
      {cfg.items.map(function(item) {
        return (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(148,163,184,0.2)", fontSize: 12 }}>
            <span style={{ color: "#64748b" }}>{item.label}</span>
            <span style={{ fontWeight: item.highlight ? 600 : 500, color: item.highlight ? "#0f172a" : "#334155" }}>{item.value}</span>
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 5, fontStyle: "italic" }}>{cfg.note}</div>
    </div>
  );
}
function calculerIRR(cashFlows) {
  if (!cashFlows || cashFlows.length < 2) return null;
  if (cashFlows[0] >= 0) return null;
  var guess = 0.1;
  for (var iter = 0; iter < 2000; iter++) {
    var npv = 0;
    var dnpv = 0;
    for (var t = 0; t < cashFlows.length; t++) {
      var pow = Math.pow(1 + guess, t);
      if (!isFinite(pow) || pow === 0) return null;
      npv += cashFlows[t] / pow;
      if (t > 0) dnpv -= t * cashFlows[t] / (pow * (1 + guess));
    }
    if (!isFinite(npv) || !isFinite(dnpv)) return null;
    if (Math.abs(dnpv) < 1e-12) break;
    var delta = npv / dnpv;
    guess = guess - delta;
    if (guess <= -0.999) guess = 0.01;
    if (Math.abs(delta) < 1e-9) break;
  }
  if (!isFinite(guess) || guess <= -1 || guess > 5) return null;
  return guess;
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
    const mkR = function(impot) {
    const tresorerie = loyersAnnuels - totalFraisAnnuels - remboursementAnnuel - impot;
    const rendBrut = depenseNette > 0 ? (loyersAnnuels / depenseNette) * 100 : 0;
    const rendNet = depenseNette > 0 ? (tresorerie / depenseNette) * 100 : 0;
    const regle70 = loyersAnnuels > 0 ? remboursementAnnuel / loyersAnnuels : null;
    // TRI : apport négatif en t=0, puis cash-flows annuels sur la durée du prêt
       const apport = pf(i.apport);
    const cfIRR = apport > 0 ? [-apport] : [-depenseNette * 0.05];
    for (var y = 0; y < Math.max(1, dur); y++) {
      const loyAn = loyersAnnuels * Math.pow(1.01, y);
      const gAn = (loyAn * pf(i.gestionLocativePct)) / 100;
      const frAn = pf(i.chargesImmeubleAn) + pf(i.taxeFonciereAn) + (depenseNette * 0.0012) + gAn + pf(i.provisionTravauxAn) + pf(i.fraisBancairesAn) + pf(i.expertComptableAn);
      cfIRR.push(loyAn - frAn - remboursementAnnuel - impot);
    }
    const triVal = calculerIRR(cfIRR);
    return { ebe: loyersAnnuels - totalFraisAnnuels, impot: impot, tresorerie: tresorerie, rendBrut: rendBrut, rendNet: rendNet, tri: triVal, regle70: regle70 };
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
  if (rg != null) {
    if (rg <= 0.60) score += 20;
    else if (rg <= 0.70) score += 15;
    else if (rg <= 0.80) score += 8;
  }
  score += Math.min(15, Math.max(0, (r.rendNet / 4) * 15));
   if (r.tri != null && isFinite(r.tri)) {
    if (r.tri >= 0.08) score += 10;
    else if (r.tri >= 0.05) score += 5;
    else if (r.tri > 0) score += 2;
  }
  return Math.round(Math.min(100, Math.max(0, score)));
}

function getNoteColor(note) {
  if (note >= 75) return "#16a34a";
  if (note >= 50) return "#d97706";
  if (note >= 30) return "#f97316";
  return "#dc2626";
}

function getNoteLabel(note) {
  if (note >= 80) return "Excellent";
  if (note >= 65) return "Très bon";
  if (note >= 50) return "Correct";
  if (note >= 35) return "Passable";
  return "Risqué";
}

function projeterCashFlow(inputs, regimeNom) {
  const pv = pf(inputs.prixVente);
  const depenseNette = pv + pf(inputs.fraisNotaire) + pf(inputs.travaux) + pf(inputs.amenagements) + (pv * pf(inputs.fraisAgencePct) / 100);
  const sommeEmpruntee = depenseNette - pf(inputs.apport);
  const tc = pf(inputs.tauxCredit);
  const dur = Math.max(1, Math.round(pf(inputs.dureeAnnees)));
  const nMois = dur * 12;
  const tMensuel = tc / 100 / 12;
  const mensualite = tMensuel === 0 ? sommeEmpruntee / nMois : (sommeEmpruntee * tMensuel) / (1 - Math.pow(1 + tMensuel, -nMois));
  const remboursementAnnuel = mensualite * 12;
  const amortissement = (depenseNette * pf(inputs.coefAmortissement)) / 100;
  const tis = pf(inputs.tauxIS);
  const tmi = pf(inputs.tmi);
  const assurancePNOBase = pf(inputs.assurancePNOAn) > 0 ? pf(inputs.assurancePNOAn) : depenseNette * 0.0012;
  var solde = sommeEmpruntee;
  const nbAnnees = dur + 5;
  const data = [];
  for (var y = 1; y <= nbAnnees; y++) {
    const loyersAn = pf(inputs.loyerMensuelHC) * pf(inputs.tauxOccupation) * Math.pow(1.01, y - 1);
    const gestionAn = (loyersAn * pf(inputs.gestionLocativePct)) / 100;
    const fraisAn = pf(inputs.chargesImmeubleAn) + pf(inputs.taxeFonciereAn) + assurancePNOBase + gestionAn + pf(inputs.provisionTravauxAn) + pf(inputs.fraisBancairesAn) + pf(inputs.expertComptableAn);
    var interetsAn = 0;
    const creditAn = y <= dur ? remboursementAnnuel : 0;
    if (y <= dur && tMensuel > 0) {
      for (var m = 0; m < 12; m++) {
        const intM = solde * tMensuel;
        interetsAn += intM;
        solde = Math.max(0, solde - (mensualite - intM));
      }
    }
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
  const W = 700; const H = 300;
  const padL = 72; const padR = 140; const padT = 24; const padB = 54;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const allVals = [];
  for (var ii = 0; ii < data.length; ii++) {
    allVals.push(data[ii].loyers);
    allVals.push(-(data[ii].frais + data[ii].credit + data[ii].impots));
    allVals.push(data[ii].cashflow);
  }
  allVals.push(0);
  const maxV = Math.max.apply(null, allVals) * 1.15;
  const minV = Math.min.apply(null, allVals) * 1.15;
  const range = maxV - minV || 1;
  const toY = function(v) { return padT + chartH - ((v - minV) / range) * chartH; };
  const zeroY = toY(0);
  const barCenterX = function(i) { return padL + (i / data.length) * chartW + (chartW / data.length) / 2; };
  const barW = Math.max(4, chartW / data.length - 3);
  const TOOLTIP_W = 148;
  const TOOLTIP_H = 112;
  const h = hovered != null ? data[hovered] : null;
  var ttX = hovered != null ? barCenterX(hovered) - TOOLTIP_W / 2 : 0;
  if (ttX < padL) ttX = padL;
  if (ttX + TOOLTIP_W > W - padR) ttX = W - padR - TOOLTIP_W;
  const ttY = 2;
  const tooltipRows = h == null ? [] : [
    { label: "Loyers",    value: h.loyers,   color: "#16a34a" },
    { label: "Charges",   value: -h.frais,   color: "#64748b" },
    { label: "Crédit",    value: -h.credit,  color: "#d97706" },
    { label: "Impôts",    value: -h.impots,  color: "#dc2626" },
    { label: "Cash-Flow", value: h.cashflow, color: h.cashflow >= 0 ? "#0369a1" : "#dc2626" },
  ];
  const legend = [
    { color: "#4ade80", label: "Loyers" },
    { color: "#94a3b8", label: "Charges" },
    { color: "#fbbf24", label: "Crédit" },
    { color: "#f87171", label: "Impôts" },
    { color: "#38bdf8", label: "Cash-Flow" },
  ];
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={"0 0 " + W + " " + H} style={{ width: "100%", minWidth: 500, fontFamily: "system-ui,sans-serif", cursor: "default" }} onMouseLeave={function() { setHovered(null); }}>
        <rect x={padL} y={padT} width={chartW} height={chartH} fill="rgba(255,255,255,0.45)" rx="8" />
        {[0, 0.25, 0.5, 0.75, 1].map(function(t) {
          const v = minV + t * range; const y = toY(v);
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="rgba(148,163,184,0.3)" strokeWidth={1} strokeDasharray="4 3" />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#64748b">{fmtK(v)}</text>
            </g>
          );
        })}
        <line x1={padL} y1={zeroY} x2={padL + chartW} y2={zeroY} stroke="#94a3b8" strokeWidth={1.5} />
        {hovered != null && (
          <rect x={padL + (hovered / data.length) * chartW} y={padT} width={chartW / data.length} height={chartH} fill="rgba(99,102,241,0.08)" rx={4} />
        )}
        {data.map(function(d, i) {
          const x = padL + (i / data.length) * chartW + (chartW / data.length - barW) / 2;
          const isH = hovered === i;
          const opacity = hovered != null && !isH ? 0.4 : 1;
          const hLoyers = Math.max(0, zeroY - toY(d.loyers));
          const yLoyers = toY(d.loyers);
          const hFrais = Math.max(0, (d.frais / range) * chartH);
          const hCredit = Math.max(0, (d.credit / range) * chartH);
          const hImpots = Math.max(0, (Math.max(0, d.impots) / range) * chartH);
          return (
            <g key={i} opacity={opacity} onMouseEnter={function() { setHovered(i); }} style={{ cursor: "pointer" }}>
              {hLoyers > 0 && <rect x={x} y={yLoyers} width={barW} height={hLoyers} fill="#4ade80" rx={2} />}
              {hFrais > 0 && <rect x={x} y={zeroY} width={barW} height={hFrais} fill="#94a3b8" rx={2} />}
              {hCredit > 0 && <rect x={x} y={zeroY + hFrais} width={barW} height={hCredit} fill="#fbbf24" rx={2} />}
              {hImpots > 0 && <rect x={x} y={zeroY + hFrais + hCredit} width={barW} height={hImpots} fill="#f87171" rx={2} />}
            </g>
          );
        })}
        <polyline points={data.map(function(d, i) { return barCenterX(i) + "," + toY(d.cashflow); }).join(" ")} fill="none" stroke="#38bdf8" strokeWidth={2.5} strokeLinejoin="round" />
        {data.map(function(d, i) {
          return (
            <circle key={i} cx={barCenterX(i)} cy={toY(d.cashflow)} r={hovered === i ? 5.5 : 3.5} fill={hovered === i ? "#0ea5e9" : "#38bdf8"} stroke="white" strokeWidth={1.5} onMouseEnter={function() { setHovered(i); }} style={{ cursor: "pointer" }} />
          );
        })}
        {data.map(function(d, i) {
          if (i === 0 || (i + 1) % 5 === 0) {
            return <text key={i} x={barCenterX(i)} y={H - padB + 16} textAnchor="middle" fontSize={10} fill="#64748b">{d.year}</text>;
          }
          return null;
        })}
        <text x={padL + chartW / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="#64748b">Année</text>
        {legend.map(function(l, i) {
          return (
            <g key={l.label} transform={"translate(" + (W - padR + 14) + "," + (padT + 18 + i * 22) + ")"}>
              <rect x={0} y={-10} width={14} height={14} fill={l.color} rx={3} />
              <text x={20} y={2} fontSize={11} fill="#334155">{l.label}</text>
            </g>
          );
        })}
        {h != null && (
          <g>
            <rect x={ttX} y={ttY} width={TOOLTIP_W} height={TOOLTIP_H} rx={8} fill="rgba(255,255,255,0.97)" stroke="rgba(148,163,184,0.4)" strokeWidth={1} />
            <text x={ttX + 8} y={ttY + 15} fontSize={11} fontWeight="700" fill="#0f172a">Année {h.year}</text>
            {tooltipRows.map(function(row, idx) {
              return (
                <g key={row.label} transform={"translate(" + (ttX + 8) + "," + (ttY + 27 + idx * 16) + ")"}>
                  <circle cx={4} cy={-4} r={3.5} fill={row.color} />
                  <text x={12} y={0} fontSize={9.5} fill="#334155">{row.label}</text>
                  <text x={TOOLTIP_W - 12} y={0} fontSize={9.5} fontWeight="600" fill={row.color} textAnchor="end">{fmtK(row.value)}</text>
                </g>
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}

function InputField({ label, name, value, onChange, unit, step, min }) {
  const u = unit !== undefined ? unit : "€";
  const s = step !== undefined ? step : "1000";
  const m = min !== undefined ? min : "0";
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 12, color: "#334155", marginBottom: 4 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="number" name={name} value={value} step={s} min={m} onChange={onChange} style={{ width: "100%", background: "rgba(255,255,255,0.75)", border: "1px solid rgba(148,163,184,0.5)", borderRadius: 999, padding: "7px 12px", color: "#0f172a", fontSize: 13, outline: "none" }} />
        {u && <span style={{ color: "#64748b", fontSize: 11, minWidth: 28, textAlign: "right" }}>{u}</span>}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748b", margin: "10px 0 4px" }}>{children}</div>;
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
  const removeLot = function(id) {
    if (lots.length <= 1) return;
    onChange(lots.filter(function(l) { return l.id !== id; }));
  };
  const updateLot = function(id, field, value) {
    onChange(lots.map(function(l) { return l.id === id ? Object.assign({}, l, { [field]: value }) : l; }));
  };

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>🏘️ Lots / Biens du projet</div>
        <button onClick={addLot} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 999, padding: "5px 12px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>+ Ajouter un lot</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lots.map(function(lot) {
          return (
            <div key={lot.id} style={{ background: "rgba(241,245,249,0.9)", borderRadius: 14, padding: "10px 12px", border: "1px solid rgba(148,163,184,0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <input
                  value={lot.nom}
                  onChange={function(e) { updateLot(lot.id, "nom", e.target.value); }}
                  style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", background: "transparent", border: "none", outline: "none", borderBottom: "1px dashed #94a3b8", minWidth: 80 }}
                />
                <button onClick={function() { removeLot(lot.id); }} style={{ background: "rgba(239,68,68,0.1)", border: "none", borderRadius: 999, padding: "3px 9px", color: "#dc2626", cursor: lots.length > 1 ? "pointer" : "not-allowed", fontSize: 12, opacity: lots.length > 1 ? 1 : 0.3 }}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "Surface (m²)", field: "surface", unit: "m²", step: "1" },
                  { label: "Loyer mensuel HC", field: "loyer", unit: "€", step: "50" },
                  { label: "Travaux", field: "travaux", unit: "€", step: "500" },
                  { label: "Charges/an", field: "charges", unit: "€", step: "100" },
                ].map(function(col) {
                  return (
                    <div key={col.field}>
                      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>{col.label}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="number" value={lot[col.field]} step={col.step} min="0"
                          onChange={function(e) { updateLot(lot.id, col.field, e.target.value); }}
                          style={{ width: "100%", background: "rgba(255,255,255,0.85)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 8, padding: "5px 8px", fontSize: 12, color: "#0f172a", outline: "none" }}
                        />
                        <span style={{ fontSize: 10, color: "#94a3b8", minWidth: 20 }}>{col.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, background: "rgba(255,255,255,0.7)", borderRadius: 12, padding: "8px 12px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: "#64748b" }}>Total surface lots</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: surfOk ? "#16a34a" : "#dc2626" }}>{fmt(totalSurface, 0)} m²
            {surfaceGlobale > 0 && <span style={{ fontSize: 10, fontWeight: 400, color: surfOk ? "#16a34a" : "#dc2626", marginLeft: 4 }}>{surfOk ? "✓" : "≠ " + fmt(surfaceGlobale, 0) + " m²"}</span>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#64748b" }}>Total loyers lots</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: loyerOk ? "#16a34a" : "#dc2626" }}>{fmtEur(totalLoyer)}
            {loyerGlobal > 0 && <span style={{ fontSize: 10, fontWeight: 400, color: loyerOk ? "#16a34a" : "#dc2626", marginLeft: 4 }}>{loyerOk ? "✓" : "≠ " + fmtEur(loyerGlobal)}</span>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#64748b" }}>Total travaux lots</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{fmtEur(totalTravaux)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#64748b" }}>Total charges lots</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{fmtEur(totalCharges)}</div>
        </div>
      </div>

      {(!surfOk && surfaceGlobale > 0) && (
        <div style={{ marginTop: 6, background: "rgba(254,243,199,0.9)", borderRadius: 10, padding: "6px 10px", fontSize: 11, color: "#92400e", border: "1px solid rgba(251,191,36,0.4)" }}>
          ⚠ La somme des surfaces des lots ({fmt(totalSurface, 0)} m²) ne correspond pas à la surface globale renseignée ({fmt(surfaceGlobale, 0)} m²).
        </div>
      )}
      {(!loyerOk && loyerGlobal > 0) && (
        <div style={{ marginTop: 6, background: "rgba(254,243,199,0.9)", borderRadius: 10, padding: "6px 10px", fontSize: 11, color: "#92400e", border: "1px solid rgba(251,191,36,0.4)" }}>
          ⚠ La somme des loyers des lots ({fmtEur(totalLoyer)}) ne correspond pas au loyer mensuel global renseigné ({fmtEur(loyerGlobal)}).
        </div>
      )}
    </div>
  );
}

const DEFAULT_INPUTS = {
  prixVente: "175000", fraisNotaire: "13300", travaux: "0", amenagements: "0",
  fraisAgencePct: "5", apport: "14000", tauxCredit: "4.2", dureeAnnees: "25",
  surfaceGlobale: "0",
  loyerMensuelHC: "1000", tauxOccupation: "11.5", chargesImmeubleAn: "250",
  taxeFonciereAn: "1400", assurancePNOAn: "0", gestionLocativePct: "0",
  provisionTravauxAn: "0", fraisBancairesAn: "300", expertComptableAn: "600",
  coefAmortissement: "4.75", tauxIS: "15", tmi: "11",
};

function SimulationProjet() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [lots, setLots] = useState([Object.assign({}, LOT_DEFAULT)]);
  const [regimeActif, setRegimeActif] = useState("SAS / SCI IS");
  const [nomProjet, setNomProjet] = useState("");
  const [projets, setProjets] = useState(function() {
    try { return JSON.parse(localStorage.getItem(PROJETS_KEY)) || []; } catch(e) { return []; }
  });

  const handleChange = function(e) {
    const name = e.target.name; const value = e.target.value;
    setInputs(function(prev) { return Object.assign({}, prev, { [name]: value }); });
  };
  const sauvegarder = function() {
    if (!nomProjet.trim()) return;
    const nouveau = { id: Date.now(), nom: nomProjet.trim(), inputs: Object.assign({}, inputs), lots: lots, regimeActif: regimeActif, savedAt: new Date().toLocaleDateString("fr-FR") };
    const liste = [nouveau].concat(projets.filter(function(p) { return p.nom !== nomProjet.trim(); }));
    setProjets(liste);
    localStorage.setItem(PROJETS_KEY, JSON.stringify(liste));
    setNomProjet("");
  };
  const charger = function(p) { setInputs(p.inputs); setRegimeActif(p.regimeActif); if (p.lots) setLots(p.lots); };
  const supprimer = function(id) {
    const liste = projets.filter(function(p) { return p.id !== id; });
    setProjets(liste); localStorage.setItem(PROJETS_KEY, JSON.stringify(liste));
  };

  const result = useMemo(function() { return calculerSimulation(inputs); }, [inputs]);
  const regime = result.regimes[regimeActif];
  const cashFlowData = useMemo(function() { return projeterCashFlow(inputs, regimeActif); }, [inputs, regimeActif]);
  const note = useMemo(function() { return calculerNote(result, regimeActif); }, [result, regimeActif]);
  const noteColor = getNoteColor(note);
  const noteLabel = getNoteLabel(note);
  const couleurTreso = pf(regime.tresorerie) >= 0 ? "#16a34a" : "#f97316";
  const couleur70 = regime.regle70 != null && regime.regle70 < 0.7 ? "#16a34a" : "#ef4444";
  const circumference = 2 * Math.PI * 28;
  const dash = (Math.min(100, Math.max(0, note)) / 100) * circumference;
  const glassCard = { background: "rgba(255,255,255,0.55)", borderRadius: 20, padding: 16, boxShadow: "0 8px 32px rgba(99,102,241,0.08), 0 0 0 1px rgba(148,163,184,0.25)", backdropFilter: "blur(18px)" };
  const glassCardAlt = { background: "rgba(241,245,249,0.75)", borderRadius: 18, padding: 16, boxShadow: "0 8px 24px rgba(99,102,241,0.10), 0 0 0 1px rgba(148,163,184,0.3)", backdropFilter: "blur(18px)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {projets.length > 0 && (
        <div style={Object.assign({}, glassCard, { padding: "12px 16px" })}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 10 }}>📁 Projets sauvegardés</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {projets.map(function(p) {
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 999, padding: "5px 10px" }}>
                  <button onClick={function() { charger(p); }} style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "#4338ca", cursor: "pointer" }}>📂 {p.nom}</button>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{p.savedAt}</span>
                  <button onClick={function() { supprimer(p.id); }} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12 }}>✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={glassCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Paramètres du projet</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={nomProjet} onChange={function(e) { setNomProjet(e.target.value); }} placeholder="Nom du projet…" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(148,163,184,0.5)", borderRadius: 999, padding: "6px 12px", fontSize: 13, color: "#0f172a", width: 180, outline: "none" }} />
            <button onClick={sauvegarder} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 999, padding: "6px 14px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500, opacity: nomProjet.trim() ? 1 : 0.5 }}>💾 Sauvegarder</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", columnGap: 18, rowGap: 6 }}>
          <div>
            <SectionTitle>Achat</SectionTitle>
            <InputField label="Prix de vente" name="prixVente" value={inputs.prixVente} onChange={handleChange} />
            <InputField label="Frais de notaire" name="fraisNotaire" value={inputs.fraisNotaire} onChange={handleChange} />
            <InputField label="Travaux (global)" name="travaux" value={inputs.travaux} onChange={handleChange} />
            <InputField label="Aménagements" name="amenagements" value={inputs.amenagements} onChange={handleChange} />
            <InputField label="Frais d'agence (%)" name="fraisAgencePct" value={inputs.fraisAgencePct} onChange={handleChange} unit="%" step="0.5" />
            <InputField label="Apport" name="apport" value={inputs.apport} onChange={handleChange} />
            <InputField label="Surface globale (m²)" name="surfaceGlobale" value={inputs.surfaceGlobale} onChange={handleChange} unit="m²" step="1" />
          </div>
          <div>
            <SectionTitle>Prêt & Fiscalité</SectionTitle>
            <InputField label="Taux crédit (%)" name="tauxCredit" value={inputs.tauxCredit} onChange={handleChange} unit="%" step="0.05" />
            <InputField label="Durée (années)" name="dureeAnnees" value={inputs.dureeAnnees} onChange={handleChange} unit="ans" step="1" />
            <InputField label="Coef amortissement (%)" name="coefAmortissement" value={inputs.coefAmortissement} onChange={handleChange} unit="%" step="0.25" />
            <InputField label="Taux IS (%)" name="tauxIS" value={inputs.tauxIS} onChange={handleChange} unit="%" step="1" />
            <InputField label="TMI (%)" name="tmi" value={inputs.tmi} onChange={handleChange} unit="%" step="1" />
          </div>
          <div>
            <SectionTitle>Exploitation (global)</SectionTitle>
            <InputField label="Loyer mensuel HC total" name="loyerMensuelHC" value={inputs.loyerMensuelHC} onChange={handleChange} step="50" />
            <InputField label="Taux d'occupation (mois/an)" name="tauxOccupation" value={inputs.tauxOccupation} onChange={handleChange} unit="mois" step="0.5" />
            <InputField label="Charges immeuble/an" name="chargesImmeubleAn" value={inputs.chargesImmeubleAn} onChange={handleChange} step="100" />
            <InputField label="Taxe foncière/an" name="taxeFonciereAn" value={inputs.taxeFonciereAn} onChange={handleChange} step="100" />
            <InputField label="Assurance PNO/an (0=auto)" name="assurancePNOAn" value={inputs.assurancePNOAn} onChange={handleChange} step="50" />
            <InputField label="Gestion locative (%)" name="gestionLocativePct" value={inputs.gestionLocativePct} onChange={handleChange} unit="%" step="0.5" />
            <InputField label="Provision travaux/an" name="provisionTravauxAn" value={inputs.provisionTravauxAn} onChange={handleChange} step="100" />
            <InputField label="Frais bancaires/an" name="fraisBancairesAn" value={inputs.fraisBancairesAn} onChange={handleChange} step="50" />
            <InputField label="Expert-comptable + CFE/an" name="expertComptableAn" value={inputs.expertComptableAn} onChange={handleChange} step="50" />
          </div>
        </div>

        <div style={{ marginTop: 14, borderTop: "1px solid rgba(148,163,184,0.25)", paddingTop: 14 }}>
          <GestionLots
            lots={lots}
            onChange={setLots}
            surfaceGlobale={pf(inputs.surfaceGlobale)}
            loyerGlobal={pf(inputs.loyerMensuelHC)}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 }}>
        {[
          { label: "Dépense nette", value: fmtEur(result.depenseNette) },
          { label: "Somme empruntée", value: fmtEur(result.sommeEmpruntee) },
          { label: "Mensualité crédit", value: fmtEur(result.mensualite) },
          { label: "Coût total prêt", value: fmtEur(result.coutPretTotal) },
          { label: "Loyers annuels", value: fmtEur(result.loyersAnnuels) },
          { label: "Total frais/an", value: fmtEur(result.totalFraisAnnuels) },
          { label: "Amortissement/an", value: fmtEur(result.amortissement) },
          { label: "Rendement brut", value: fmtPct(result.rendBrut) },
        ].map(function(c) {
          return (
            <div key={c.label} style={{ background: "rgba(255,255,255,0.65)", borderRadius: 14, padding: "10px 12px", boxShadow: "0 4px 14px rgba(99,102,241,0.08)", backdropFilter: "blur(14px)" }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>{c.value}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {Object.keys(result.regimes).map(function(r) {
          return (
            <button key={r} onClick={function() { setRegimeActif(r); }} style={{ padding: "6px 14px", borderRadius: 999, border: regimeActif === r ? "1.5px solid #6366f1" : "1px solid rgba(148,163,184,0.4)", background: regimeActif === r ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.6)", color: regimeActif === r ? "#4338ca" : "#475569", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{r}</button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
        <div style={glassCardAlt}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#1e293b" }}>Bilan — {regimeActif}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
            {[
              { label: "EBE", value: fmtEur(regime.ebe), color: "#0ea5e9" },
              { label: "Fiscalité annuelle", value: fmtEur(regime.impot), color: "#d97706" },
              { label: "Trésorerie/an", value: fmtEur(regime.tresorerie), color: couleurTreso },
              { label: "Rendement brut", value: fmtPct(regime.rendBrut), color: "#64748b" },
            { label: "TRI", value: regime.tri != null ? fmtPct(regime.tri * 100) : "—", color: "#64748b" },
            ].map(function(c) {
              return (
                <div key={c.label} style={{ background: "rgba(255,255,255,0.7)", borderRadius: 14, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 14, background: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 12, color: "#334155", minWidth: 110 }}>Règle des 70 %</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: couleur70 }}>{regime.regle70 != null ? fmt(regime.regle70, 2) : "—"}</div>
            <div style={{ fontSize: 11, color: couleur70, minWidth: 120 }}>{regime.regle70 != null ? (regime.regle70 < 0.7 ? "✓ OK (< 0,70)" : "✗ Trop élevé") : ""}</div>
            <div style={{ flex: 1, background: "rgba(148,163,184,0.25)", borderRadius: 999, height: 7, overflow: "hidden" }}>
              <div style={{ width: Math.min(100, (regime.regle70 || 0) * 100) + "%", background: couleur70, height: 7, borderRadius: 999, transition: "width 0.3s" }} />
            </div>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.65)", borderRadius: 20, padding: "16px 20px", boxShadow: "0 8px 32px rgba(99,102,241,0.10), 0 0 0 1px rgba(148,163,184,0.25)", backdropFilter: "blur(18px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 130 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Note globale</div>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="7" />
            <circle cx="36" cy="36" r="28" fill="none" stroke={noteColor} strokeWidth="7" strokeDasharray={dash + " " + circumference} strokeLinecap="round" transform="rotate(-90 36 36)" style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.3s" }} />
            <text x="36" y="40" textAnchor="middle" fontSize="18" fontWeight="700" fill={noteColor}>{note}</text>
          </svg>
          <div style={{ fontSize: 13, fontWeight: 600, color: noteColor }}>{noteLabel}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", lineHeight: 1.4 }}>Rendement · Tréso<br />Règle 70% · TRI</div>
        </div>
      </div>

      <div style={glassCard}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
          Évolution du Cash-Flow — <span style={{ color: "#6366f1" }}>{regimeActif}</span>
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>Survole une colonne pour le détail · Loyers indexés +1%/an</div>
        <CashFlowChart data={cashFlowData} />
      </div>

      <div style={glassCard}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#1e293b" }}>Comparatif des régimes fiscaux</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "#64748b", borderBottom: "1px solid rgba(148,163,184,0.35)" }}>
              {["Régime", "Tréso/an", "Impôt/an", "Rdt net", "TRI", "Règle 70%", "Note"].map(function(h) {
                return <th key={h} style={{ textAlign: h === "Régime" ? "left" : "right", padding: "6px 8px", fontWeight: 500 }}>{h}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {Object.entries(result.regimes).map(function(entry) {
              const nom = entry[0]; const r = entry[1];
              const n = calculerNote(result, nom);
              return (
                <tr key={nom} onClick={function() { setRegimeActif(nom); }} style={{ borderBottom: "1px solid rgba(148,163,184,0.2)", background: regimeActif === nom ? "rgba(99,102,241,0.07)" : "transparent", cursor: "pointer" }}>
                  <td style={{ padding: "8px 8px", fontWeight: 500, color: "#1e293b" }}>{nom}</td>
                  <td style={{ padding: "8px 8px", textAlign: "right", color: r.tresorerie >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>{fmtEur(r.tresorerie)}</td>
                  <td style={{ padding: "8px 8px", textAlign: "right", color: "#d97706" }}>{fmtEur(r.impot)}</td>
                  <td style={{ padding: "8px 8px", textAlign: "right", color: "#334155" }}>{fmtPct(r.rendNet)}</td>
                  <td style={{ padding: "8px 8px", textAlign: "right", color: "#334155" }}>{r.tri ? fmt(r.tri, 1) + " ans" : "—"}</td>
                  <td style={{ padding: "8px 8px", textAlign: "right", color: r.regle70 != null && r.regle70 < 0.7 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>{r.regle70 != null ? fmt(r.regle70, 2) : "—"}</td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 700, color: getNoteColor(n) }}>{n}/100</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
    if (!force) {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) { try { setCommunes(JSON.parse(cached)); setLoading(false); return; } catch(e) {} }
    }
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
  const toggleCompare = function(c) {
    setCompareList(function(prev) {
      if (prev.find(function(x) { return x.nom === c.nom; })) return prev.filter(function(x) { return x.nom !== c.nom; });
      if (prev.length < 4) return prev.concat([c]);
      return prev;
    });
  };
  const scoreKeys = [
    { key: "global", label: "Score global" },
    { key: "rendement", label: "Rendement" },
    { key: "demographie", label: "Démographie" },
    { key: "socio_eco", label: "Socio-éco" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 820, flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.75)", boxShadow: "0 8px 28px rgba(99,102,241,0.12), 0 0 0 1px rgba(148,163,184,0.3)", backdropFilter: "blur(18px)" }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Rechercher une commune… (TOP 10 affiché)" style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "#0f172a" }} />
          <select value={sortKey} onChange={function(e) { setSortKey(e.target.value); }} style={{ background: "rgba(241,245,249,0.85)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 999, padding: "6px 10px", fontSize: 12, color: "#334155", outline: "none" }}>
            {scoreKeys.map(function(k) { return <option key={k.key} value={k.key}>{k.label}</option>; })}
          </select>
          <select value={filterMin} onChange={function(e) { setFilterMin(Number(e.target.value)); }} style={{ background: "rgba(241,245,249,0.85)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 999, padding: "6px 10px", fontSize: 12, color: "#334155", outline: "none" }}>
            <option value={0}>Tous</option>
            <option value={5}>≥ 5</option>
            <option value={6}>≥ 6</option>
            <option value={7}>≥ 7</option>
          </select>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>{filtered.length} communes · top 10 affiché · clic = détail · clic droit = comparer</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={function() { loadCommunes(true); }} style={{ background: "linear-gradient(135deg,#38bdf8,#6366f1)", border: "none", borderRadius: 999, padding: "7px 14px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500, boxShadow: "0 6px 18px rgba(99,102,241,0.3)" }}>↻ Actualiser</button>
          {compareList.length > 0 && (
            <button onClick={function() { setShowCompare(true); }} style={{ background: "linear-gradient(135deg,#a855f7,#ec4899)", border: "none", borderRadius: 999, padding: "7px 14px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>Comparer ({compareList.length})</button>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading && <div style={{ color: "#64748b", padding: 40, textAlign: "center" }}>Chargement des communes…</div>}
          {error && <div style={{ color: "#dc2626", padding: 20 }}>Erreur : {error}</div>}
          {!loading && !error && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
              {top10.map(function(c) {
                const g = sn(c.scores && c.scores.global);
                const isSelected = selected && selected.nom === c.nom;
                const isCompared = !!compareList.find(function(x) { return x.nom === c.nom; });
                return (
                  <div key={c.nom} onClick={function() { setSelected(isSelected ? null : c); }} onContextMenu={function(e) { e.preventDefault(); toggleCompare(c); }}
                    style={{ background: "rgba(255,255,255,0.65)", borderRadius: 18, padding: "12px 14px", boxShadow: isSelected ? "0 8px 28px rgba(99,102,241,0.22)" : "0 4px 16px rgba(99,102,241,0.07)", border: isSelected ? "1.5px solid #6366f1" : isCompared ? "1.5px solid #a855f7" : "1px solid rgba(148,163,184,0.3)", cursor: "pointer", backdropFilter: "blur(14px)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>{c.nom}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: nc(g) }}>{g != null ? g.toFixed(1) : "—"}</div>
                    </div>
                    {c.population && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{c.population.toLocaleString("fr-FR")} hab.</div>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {["rendement", "demographie", "socio_eco"].map(function(k) {
                        const v = sn(c.scores && c.scores[k]);
                        return (
                          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ fontSize: 11, color: "#64748b", width: 80 }}>{k === "rendement" ? "Rendement" : k === "demographie" ? "Démographie" : "Socio-éco"}</div>
                            <ProgressBar value={v} />
                            <div style={{ fontSize: 11, color: nc(v), minWidth: 28, textAlign: "right" }}>{v != null ? v.toFixed(1) : "—"}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {selected && (
          <div style={{ width: 360, minWidth: 320, background: "rgba(255,255,255,0.75)", borderRadius: 20, padding: 16, boxShadow: "0 12px 36px rgba(99,102,241,0.12)", backdropFilter: "blur(22px)", border: "1px solid rgba(148,163,184,0.3)" }}>
            {loadingDetail && <div style={{ color: "#64748b", textAlign: "center", marginTop: 40 }}>Chargement…</div>}
            {detail && detail.error && <div style={{ color: "#dc2626" }}>Erreur : {detail.error}</div>}
            {detail && !detail.error && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a" }}>{detail.commune}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{detail.code_insee} · Zone {detail.zonage_abc}</div>
                  </div>
                  <button onClick={function() { setSelected(null); setDetail(null); setOpenScore(null); }} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}>✕</button>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 6 }}>Scores (clic = détail)</div>
                  {[
                    { key: "global", label: "Global", v: sn(detail.scores && detail.scores.global) },
                    { key: "rendement", label: "Rendement", v: sn(detail.scores && detail.scores.rendement) },
                    { key: "demographie", label: "Démographie", v: sn(detail.scores && detail.scores.demographie) },
                    { key: "socio_eco", label: "Socio-éco", v: sn(detail.scores && detail.scores.socio_eco) },
                  ].map(function(item) {
                    const clickable = item.key !== "global";
                    const isOpen = openScore === item.key;
                    return (
                      <div key={item.key} style={{ marginBottom: isOpen ? 4 : 6 }}>
                        <div onClick={function() { if (clickable) setOpenScore(isOpen ? null : item.key); }} style={{ display: "flex", alignItems: "center", gap: 8, cursor: clickable ? "pointer" : "default", padding: "3px 0" }}>
                          <div style={{ fontSize: 12, width: 80, color: "#334155" }}>{item.label}</div>
                          <ProgressBar value={item.v} clickable={clickable} />
                          <div style={{ fontSize: 13, fontWeight: 600, color: nc(item.v), minWidth: 32, textAlign: "right" }}>{item.v != null ? item.v.toFixed(1) : "—"}</div>
                          <div style={{ fontSize: 11, color: nc(item.v), minWidth: 42 }}>{nLabel(item.v)}</div>
                          {clickable && <div style={{ fontSize: 11, color: "#94a3b8" }}>{isOpen ? "▲" : "▼"}</div>}
                        </div>
                        {isOpen && clickable && <ScoreDetail scoreKey={item.key} detail={detail} onClose={function() { setOpenScore(null); }} />}
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Prix au m²</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Appartement", value: detail.prix && detail.prix.appartement_m2 ? detail.prix.appartement_m2.toLocaleString("fr-FR") + " €/m²" : "—", sub: detail.prix && detail.prix.nb_ventes_apt ? detail.prix.nb_ventes_apt + " ventes" : "" },
                      { label: "Maison", value: detail.prix && detail.prix.maison_m2 ? detail.prix.maison_m2.toLocaleString("fr-FR") + " €/m²" : "—", sub: detail.prix && detail.prix.nb_ventes_mai ? detail.prix.nb_ventes_mai + " ventes" : "" },
                    ].map(function(x) {
                      return (
                        <div key={x.label} style={{ background: "rgba(241,245,249,0.8)", borderRadius: 12, padding: "9px 10px" }}>
                          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{x.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{x.value}</div>
                          {x.sub && <div style={{ fontSize: 11, color: "#94a3b8" }}>{x.sub}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {detail.loyer && detail.loyer.appartement_m2 != null && (
                  <div style={{ marginBottom: 12, background: "rgba(224,242,254,0.8)", borderRadius: 12, padding: "8px 10px", border: "1px solid rgba(56,189,248,0.4)" }}>
                    <div style={{ fontSize: 11, color: "#0369a1", marginBottom: 2 }}>Loyer médian</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{Number(detail.loyer.appartement_m2).toFixed(1)} €/m²/mois</div>
                  </div>
                )}
                {detail.rentabilite_brute_pct && (
                  <div style={{ marginBottom: 12, background: "rgba(220,252,231,0.8)", borderRadius: 12, padding: "8px 10px", border: "1px solid rgba(34,197,94,0.4)" }}>
                    <div style={{ fontSize: 11, color: "#15803d", marginBottom: 2 }}>Rentabilité brute estimée</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#15803d" }}>{detail.rentabilite_brute_pct} %</div>
                  </div>
                )}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Socio-éco</div>
                  {[
                    { label: "Revenu médian", value: detail.socio_eco && detail.socio_eco.revenu_median ? detail.socio_eco.revenu_median.toLocaleString("fr-FR") + " €" : "—" },
                    { label: "Chômage", value: detail.socio_eco && detail.socio_eco.chomage_pct != null ? detail.socio_eco.chomage_pct + " %" : "—" },
                    { label: "Taux pauvreté", value: detail.socio_eco && detail.socio_eco.taux_pauvrete_pct != null ? detail.socio_eco.taux_pauvrete_pct + " %" : "—" },
                    { label: "Part cadres", value: detail.socio_eco && detail.socio_eco.part_cadres_pct != null ? detail.socio_eco.part_cadres_pct + " %" : "—" },
                  ].map(function(x) {
                    return (
                      <div key={x.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(148,163,184,0.2)", fontSize: 13 }}>
                        <span style={{ color: "#64748b" }}>{x.label}</span>
                        <span style={{ fontWeight: 500, color: "#0f172a" }}>{x.value}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Démographie</div>
                  {[
                    { label: "Population", value: detail.population ? detail.population.toLocaleString("fr-FR") + " hab." : "—" },
                    { label: "Évolution/an", value: detail.demographie && detail.demographie.evolution_pop_pct_an != null ? detail.demographie.evolution_pop_pct_an + " %" : "—" },
                    { label: "Vacance logements", value: detail.demographie && detail.demographie.vacance_pct != null ? detail.demographie.vacance_pct + " %" : "—" },
                    { label: "Tension locative", value: detail.demographie && detail.demographie.tension_locative_pct != null ? detail.demographie.tension_locative_pct + " %" : "—" },
                  ].map(function(x) {
                    return (
                      <div key={x.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(148,163,184,0.2)", fontSize: 13 }}>
                        <span style={{ color: "#64748b" }}>{x.label}</span>
                        <span style={{ fontWeight: 500, color: "#0f172a" }}>{x.value}</span>
                      </div>
                    );
                  })}
                </div>
                {detail.prix && detail.prix.avertissement_apt && (
                  <div style={{ background: "rgba(254,243,199,0.9)", borderRadius: 12, padding: "8px 10px", fontSize: 12, color: "#92400e", marginBottom: 10, border: "1px solid rgba(251,191,36,0.5)" }}>
                    ⚠ {detail.prix.avertissement_apt}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Sources : {detail.prix && detail.prix.source} · {detail.loyer && detail.loyer.source}</div>
              </div>
            )}
          </div>
        )}
      </div>
      {showCompare && compareList.length > 0 && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={function() { setShowCompare(false); }}>
          <div style={{ background: "rgba(255,255,255,0.92)", borderRadius: 20, padding: 20, minWidth: 520, maxWidth: 840, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(15,23,42,0.2)", backdropFilter: "blur(24px)" }} onClick={function(e) { e.stopPropagation(); }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>Comparaison de communes</div>
              <button onClick={function() { setShowCompare(false); }} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "#64748b" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Critère</th>
                  {compareList.map(function(c) { return <th key={c.nom} style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500, color: "#0f172a" }}>{c.nom}</th>; })}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Score global", fn: function(c) { const v = sn(c.scores && c.scores.global); return v != null ? v.toFixed(1) : "—"; } },
                  { label: "Rendement", fn: function(c) { const v = sn(c.scores && c.scores.rendement); return v != null ? v.toFixed(1) : "—"; } },
                  { label: "Démographie", fn: function(c) { const v = sn(c.scores && c.scores.demographie); return v != null ? v.toFixed(1) : "—"; } },
                  { label: "Socio-éco", fn: function(c) { const v = sn(c.scores && c.scores.socio_eco); return v != null ? v.toFixed(1) : "—"; } },
                  { label: "Population", fn: function(c) { return c.population ? c.population.toLocaleString("fr-FR") : "—"; } },
                ].map(function(row) {
                  return (
                    <tr key={row.label} style={{ borderBottom: "1px solid rgba(148,163,184,0.3)" }}>
                      <td style={{ padding: "7px 8px", color: "#64748b" }}>{row.label}</td>
                      {compareList.map(function(c) { return <td key={c.nom} style={{ padding: "7px 8px", textAlign: "right", fontWeight: 500, color: "#0f172a" }}>{row.fn(c)}</td>; })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8" }}>Clic droit sur une commune pour ajouter/retirer.</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [onglet, setOnglet] = useState("analyse");
  const navItems = [
    { id: "analyse", label: "Analyse communes", icon: "📊" },
    { id: "simulation", label: "Simulation projet", icon: "💼" },
  ];
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "radial-gradient(ellipse at top left, #bfdbfe 0%, transparent 50%), radial-gradient(ellipse at top right, #fce7f3 0%, transparent 50%), radial-gradient(ellipse at bottom center, #d1fae5 0%, #f1f5f9 60%)", fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}>
      <aside style={{ width: 220, minWidth: 220, background: "rgba(255,255,255,0.65)", borderRight: "1px solid rgba(148,163,184,0.3)", padding: "18px 14px", display: "flex", flexDirection: "column", gap: 6, boxShadow: "4px 0 20px rgba(99,102,241,0.06)", backdropFilter: "blur(20px)", position: "relative", zIndex: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 18, display: "flex", alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 999, background: "linear-gradient(135deg,#38bdf8,#6366f1)", color: "#fff", fontSize: 14, marginRight: 8, boxShadow: "0 4px 12px rgba(99,102,241,0.4)" }}>R</span>
          Radar Immo 76
        </div>
        {navItems.map(function(n) {
          return (
            <button key={n.id} onClick={function() { setOnglet(n.id); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, textAlign: "left", width: "100%", background: onglet === n.id ? "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(56,189,248,0.15))" : "transparent", color: onglet === n.id ? "#4338ca" : "#475569", boxShadow: onglet === n.id ? "0 4px 14px rgba(99,102,241,0.15)" : "none", borderLeft: onglet === n.id ? "3px solid #6366f1" : "3px solid transparent" }}>
              <span>{n.icon}</span><span>{n.label}</span>
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "#94a3b8" }}>Sources : DVF · ANIL · INSEE</div>
      </aside>
      <main style={{ flex: 1, padding: 20, overflowY: "auto", minWidth: 0 }}>
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>{onglet === "analyse" ? "Analyse investissement — Seine-Maritime" : "Simulation de rentabilité"}</h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{onglet === "analyse" ? "TOP 10 · Clic = détail · Clic sur une jauge = détail du score · Clic droit = comparer" : "Paramètre ton projet, sauvegarde-le et visualise l'évolution du cash-flow par régime fiscal."}</p>
        </div>
        {onglet === "analyse" && <AnalyseCommunes />}
        {onglet === "simulation" && <SimulationProjet />}
      </main>
    </div>
  );
}
