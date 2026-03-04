import React, { useState, useEffect, useCallback, useMemo } from "react";

const API_BASE = "https://radar-immo76-1.onrender.com";
const CACHE_KEY = "radar-immo-communes-v2";
const PROJETS_KEY = "radar-immo-projets-v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const nc = (v) => { if (v == null) return "#94a3b8"; if (v >= 7) return "#16a34a"; if (v >= 5) return "#d97706"; return "#dc2626"; };
const nLabel = (v) => { if (v == null) return "—"; if (v >= 7) return "Bon"; if (v >= 5) return "Moyen"; return "Faible"; };
const sn = (v) => (v != null && !isNaN(Number(v)) ? Number(v) : null);
const pf = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const fmt = (n, d = 0) => n == null ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtEur = (n) => n == null ? "—" : `${fmt(n)} €`;
const fmtPct = (n) => n == null ? "—" : `${fmt(n, 2)} %`;

// ─── ProgressBar ──────────────────────────────────────────────────────────────
function ProgressBar({ value, clickable, onClick }) {
  const n = sn(value);
  const pct = Math.min(100, Math.max(0, ((n ?? 0) / 10) * 100));
  return (
    <div onClick={onClick} style={{ background: "rgba(148,163,184,0.2)", borderRadius: 999, height: 7, width: "100%", overflow: "hidden", cursor: clickable ? "pointer" : "default" }}>
      <div style={{ width: `${pct}%`, background: "linear-gradient(90deg,#38bdf8,#818cf8)", height: 7, borderRadius: 999, transition: "width 0.3s" }} />
    </div>
  );
}

// ─── ScoreDetail ──────────────────────────────────────────────────────────────
function ScoreDetail({ scoreKey, detail, onClose }) {
  const se = detail?.socio_eco || {};
  const dem = detail?.demographie || {};
  const pri = detail?.prix || {};
  const configs = {
    rendement: {
      title: "Détail — Rendement", color: "#38bdf8",
      items: [
        { label: "Prix appartement/m²", value: pri.appartement_m2 ? `${pri.appartement_m2.toLocaleString("fr-FR")} €` : "—" },
        { label: "Prix maison/m²", value: pri.maison_m2 ? `${pri.maison_m2.toLocaleString("fr-FR")} €` : "—" },
        { label: "Loyer médian/m²", value: detail?.loyer?.appartement_m2 != null ? `${Number(detail.loyer.appartement_m2).toFixed(1)} €/m²/mois` : "—" },
        { label: "Rentabilité brute", value: detail?.rentabilite_brute_pct ? `${detail.rentabilite_brute_pct} %` : "—", highlight: true },
        { label: "Nb ventes appartements", value: pri.nb_ventes_apt ?? "—" },
        { label: "Nb ventes maisons", value: pri.nb_ventes_mai ?? "—" },
      ],
      note: "Rendement brut ≈ (loyer × 12) / prix m².",
    },
    demographie: {
      title: "Détail — Démographie", color: "#a78bfa",
      items: [
        { label: "Population", value: detail?.population ? detail.population.toLocaleString("fr-FR") + " hab." : "—" },
        { label: "Évolution population/an", value: dem.evolution_pop_pct_an != null ? `${dem.evolution_pop_pct_an} %` : "—", highlight: true },
        { label: "Vacance logements", value: dem.vacance_pct != null ? `${dem.vacance_pct} %` : "—", highlight: true },
        { label: "Tension locative", value: dem.tension_locative_pct != null ? `${dem.tension_locative_pct} %` : "—", highlight: true },
        { label: "Zone ABC", value: detail?.zonage_abc ?? "—" },
      ],
      note: "Score basé sur dynamique démographique, vacance et locataires.",
    },
    socio_eco: {
      title: "Détail — Socio-économique", color: "#4ade80",
      items: [
        { label: "Revenu médian", value: se.revenu_median ? `${se.revenu_median.toLocaleString("fr-FR")} €` : "—", highlight: true },
        { label: "Taux de chômage", value: se.chomage_pct != null ? `${se.chomage_pct} %` : "—", highlight: true },
        { label: "Taux de pauvreté", value: se.taux_pauvrete_pct != null ? `${se.taux_pauvrete_pct} %` : "—", highlight: true },
        { label: "Part cadres", value: se.part_cadres_pct != null ? `${se.part_cadres_pct} %` : "—" },
        { label: "Indice de Gini", value: se.gini != null ? se.gini : "—" },
      ],
      note: "Plus le revenu est élevé et le chômage faible, meilleur est le score.",
    },
  };
  const cfg = configs[scoreKey];
  if (!cfg) return null;
  return (
    <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 14, padding: 12, marginTop: 8, border: `1px solid ${cfg.color}44`, backdropFilter: "blur(16px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{cfg.title}</div>
        <button onClick={onClose} style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>✕</button>
      </div>
      {cfg.items.map((item) => (
        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(148,163,184,0.2)", fontSize: 12 }}>
          <span style={{ color: "#64748b" }}>{item.label}</span>
          <span style={{ fontWeight: item.highlight ? 600 : 500, color: item.highlight ? "#0f172a" : "#334155" }}>{item.value}</span>
        </div>
      ))}
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 5, fontStyle: "italic" }}>{cfg.note}</div>
    </div>
  );
}

// ─── Calcul simulation ────────────────────────────────────────────────────────
function calculerSimulation(i) {
  const pv = pf(i.prixVente);
  const depenseNette = pv + pf(i.fraisNotaire) + pf(i.travaux) + pf(i.amenagements) + (pv * pf(i.fraisAgencePct) / 100);
  const sommeEmpruntee = depenseNette - pf(i.apport);
  const tc = pf(i.tauxCredit); const dur = pf(i.dureeAnnees);
  const nMois = dur * 12; const tMensuel = tc / 100 / 12;
  const mensualite = tMensuel === 0 ? sommeEmpruntee / nMois : (sommeEmpruntee * tMensuel) / (1 - Math.pow(1 + tMensuel, -nMois));
  const remboursementAnnuel = mensualite * 12;
  const coutPretTotal = remboursementAnnuel * dur - sommeEmpruntee;
  const interetsAnnuels = coutPretTotal / dur;
  const loyersAnnuels = pf(i.loyerMensuelHC) * pf(i.tauxOccupation);
  const assurancePNO = pf(i.assurancePNOAn) > 0 ? pf(i.assurancePNOAn) : depenseNette * 0.0012;
  const gestionAn = (loyersAnnuels * pf(i.gestionLocativePct)) / 100;
  const totalFraisAnnuels = pf(i.chargesImmeubleAn) + pf(i.taxeFonciereAn) + assurancePNO + gestionAn + pf(i.provisionTravauxAn) + pf(i.fraisBancairesAn) + pf(i.expertComptableAn);
  const amortissement = (depenseNette * pf(i.coefAmortissement)) / 100;
  const ebe = loyersAnnuels - totalFraisAnnuels;
  const tis = pf(i.tauxIS); const tmi = pf(i.tmi);
  const mkR = (impot) => {
    const tresorerie = ebe - remboursementAnnuel - impot;
    const rendBrut = depenseNette > 0 ? (loyersAnnuels / depenseNette) * 100 : 0;
    const rendNet = depenseNette > 0 ? (tresorerie / depenseNette) * 100 : 0;
    const tri = tresorerie > 0 ? depenseNette / tresorerie : null;
    const regle70 = loyersAnnuels > 0 ? remboursementAnnuel / loyersAnnuels : null;
    return { ebe, impot, tresorerie, rendBrut, rendNet, tri, regle70 };
  };
  const bIS = Math.max(0, loyersAnnuels - totalFraisAnnuels - interetsAnnuels - amortissement);
  const bFR = Math.max(0, loyersAnnuels - totalFraisAnnuels - interetsAnnuels);
  return {
    depenseNette, sommeEmpruntee, mensualite, coutPretTotal, remboursementAnnuel,
    loyersAnnuels, totalFraisAnnuels, amortissement,
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

// ─── Projection cash-flow annuelle ───────────────────────────────────────────
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
  const tis = pf(inputs.tauxIS); const tmi = pf(inputs.tmi);
  const assurancePNOBase = pf(inputs.assurancePNOAn) > 0 ? pf(inputs.assurancePNOAn) : depenseNette * 0.0012;
  let solde = sommeEmpruntee;
  const nbAnnees = dur + 5;
  const data = [];
  for (let y = 1; y <= nbAnnees; y++) {
    const loyersAn = pf(inputs.loyerMensuelHC) * pf(inputs.tauxOccupation) * Math.pow(1.01, y - 1);
    const gestionAn = (loyersAn * pf(inputs.gestionLocativePct)) / 100;
    const fraisAn = pf(inputs.chargesImmeubleAn) + pf(inputs.taxeFonciereAn) + assurancePNOBase + gestionAn + pf(inputs.provisionTravauxAn) + pf(inputs.fraisBancairesAn) + pf(inputs.expertComptableAn);
    let interetsAn = 0;
    const creditAn = y <= dur ? remboursementAnnuel : 0;
    if (y <= dur && tMensuel > 0) {
      for (let m = 0; m < 12; m++) {
        const intM = solde * tMensuel;
        interetsAn += intM;
        solde -= (mensualite - intM);
      }
    }
    let impots = 0;
    const baseDeductible = Math.max(0, loyersAn - fraisAn - interetsAn - amortissement);
    const baseFoncierR = Math.max(0, loyersAn - fraisAn - interetsAn);
    if (regimeNom === "SAS / SCI IS") impots = baseDeductible * (tis / 100);
    else if (regimeNom === "LMNP Réel") impots = baseDeductible * ((tmi + 17.2) / 100);
    else if (regimeNom === "LMNP Micro BIC") impots = Math.max(0, loyersAn * 0.5) * ((tmi + 17.2) / 100);
    else if (regimeNom === "Foncier Réel") impots = baseFoncierR * ((tmi + 17.2) / 100);
    else if (regimeNom === "Micro Foncier") impots = Math.max(0, loyersAn * 0.7) * ((tmi + 17.2) / 100);
    const cashflow = loyersAn - fraisAn - creditAn - impots;
    data.push({ year: y, loyers: loyersAn, frais: fraisAn, credit: creditAn, impots, cashflow });
  }
  return data;
}

// ─── CashFlowChart SVG ────────────────────────────────────────────────────────
function CashFlowChart({ data }) {
  if (!data || data.length === 0) return null;
  const W = 720; const H = 290;
  const padL = 72; const padR = 20; const padT = 20; const padB = 54;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxPos = Math.max(...data.map(d => d.loyers), 0);
  const maxNeg = Math.max(...data.map(d => d.frais + d.credit + d.impots), 0);
  const maxCF = Math.max(...data.map(d => d.cashflow), 0);
  const minCF = Math.min(...data.map(d => d.cashflow), 0);
  const maxV = Math.max(maxPos, maxCF) * 1.12;
  const minV = Math.min(-maxNeg, minCF) * 1.12;
  
