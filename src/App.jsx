import React, { useState, useEffect, useCallback, useMemo } from "react";


// Helper localStorage protégé contre QuotaExceededError
function safeLS(key, value) {
  try {
    // Si les photos sont trop lourdes, on les vide d'abord
    localStorage.setItem(key, JSON.stringify(value));
  } catch(e) {
    if (e && e.name === 'QuotaExceededError') {
      try { localStorage.removeItem('radar-immo-photos-v1'); } catch(_) {}
      try { localStorage.setItem(key, JSON.stringify(value)); } catch(_) {}
    }
  }
}

const SUPABASE_URL = "https://iudxpwmbwcaspihtvhay.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Ab3inJlUcsRG-p6fU4y4pQ_0ncHppba";

// Chargement dynamique de Supabase via CDN (pas besoin de npm install)
var _supabaseReady = null;
function getSupabase() {
  if (_supabaseReady) return _supabaseReady;
  _supabaseReady = new Promise(function(resolve) {
    if (window.supabase) { resolve(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)); return; }
    var script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
    script.onload = function() { resolve(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)); };
    script.onerror = function() { resolve(null); };
    document.head.appendChild(script);
  });
  return _supabaseReady;
}
// Eager load
getSupabase();

const API_BASE = "https://radar-immo76-1.onrender.com";
const CACHE_KEY = "radar-immo-communes-v3";
const PROJETS_KEY = "radar-immo-projets-v1";

// Cache communes en mémoire (évite de re-parser le JSON à chaque frappe)
var _communesCache = null;
var _communesCachePromise = null;
function getCommunesCache() {
  if (_communesCache) return Promise.resolve(_communesCache);
  if (_communesCachePromise) return _communesCachePromise;
  // Essayer localStorage d'abord
  try {
    var stored = localStorage.getItem(CACHE_KEY);
    if (stored) { _communesCache = JSON.parse(stored); return Promise.resolve(_communesCache); }
  } catch(e) {}
  // Sinon charger depuis l'API
  _communesCachePromise = fetch(API_BASE + "/communes")
    .then(function(r) { return r.json(); })
    .then(function(d) {
      _communesCache = d.communes || [];
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(_communesCache)); } catch(e) {}
      _communesCachePromise = null;
      return _communesCache;
    })
    .catch(function() { _communesCachePromise = null; return []; });
  return _communesCachePromise;
}
// Précharger au démarrage (en tâche de fond)
getCommunesCache();

const nc = (v) => { if (v == null) return "#94a3b8"; if (v >= 7) return "#16a34a"; if (v >= 5) return "#d97706"; return "#dc2626"; };
const nLabel = (v) => { if (v == null) return "—"; if (v >= 7) return "Bon"; if (v >= 5) return "Moyen"; return "Faible"; };
const sn = (v) => (v != null && !isNaN(Number(v)) ? Number(v) : null);
const pf = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const fmt = (n, d) => { const dd = d !== undefined ? d : 0; return n == null ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: dd, maximumFractionDigits: dd }); };
const fmtEur = (n) => n == null ? "—" : fmt(n) + " €";
const fmtPct = (n) => n == null ? "—" : fmt(n, 2) + " %";
const fmtK = (v) => v >= 1000 || v <= -1000 ? (v / 1000).toFixed(1) + "k €" : Math.round(v) + " €";
const LOT_DEFAULT = { id: 1, nom: "Lot 1", surface: "", loyer: "", travaux: "", charges: "", debutLoyerMois: "0", dpe: "" };

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
  const fraisBancairesAchat = pf(i.fraisBancairesAchat);
  const depenseNette = pv + pf(i.fraisNotaire) + pf(i.travaux) + pf(i.amenagements) + fraisBancairesAchat;
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

function projeterCashFlow(inputs, regimeNom, lots) {
  const pv = pf(inputs.prixVente);
  const depenseNette = pv + pf(inputs.fraisNotaire) + pf(inputs.travaux) + pf(inputs.amenagements) + pf(inputs.fraisBancairesAchat);
  const sommeEmpruntee = depenseNette - pf(inputs.apport);
  const tc = pf(inputs.tauxCredit); const dur = Math.max(1, Math.round(pf(inputs.dureeAnnees)));
  const nMois = dur * 12; const tMensuel = tc / 100 / 12;
  const mensualite = tMensuel === 0 ? sommeEmpruntee / nMois : (sommeEmpruntee * tMensuel) / (1 - Math.pow(1 + tMensuel, -nMois));
  const amortissement = (depenseNette * pf(inputs.coefAmortissement)) / 100;
  const tis = pf(inputs.tauxIS); const tmi = pf(inputs.tmi);
  const assurancePNOBase = pf(inputs.assurancePNOAn) > 0 ? pf(inputs.assurancePNOAn) : depenseNette * 0.0012;
  const differeMois = Math.max(0, Math.round(pf(inputs.differeMois)));
  var solde = sommeEmpruntee;
  var moisGlobal = 0;
  const data = [];

  // Préparer les lots (si pas de lots ou lots sans loyer, fallback sur le global)
  var lotsEffectifs = (lots && lots.length > 0) ? lots : [{ loyer: inputs.loyerMensuelHC, debutLoyerMois: "0" }];
  var loyerGlobalFallback = pf(inputs.loyerMensuelHC);
  var totalLoyerLots = lotsEffectifs.reduce(function(s, l) { return s + pf(l.loyer); }, 0);
  // Si les lots n'ont pas de loyer renseigné, on utilise le loyer global
  var useLots = totalLoyerLots > 0;

  for (var y = 1; y <= dur + 5; y++) {
    var creditAn = 0;
    var interetsAn = 0;
    // Crédit mois par mois
    for (var m = 0; m < 12; m++) {
      moisGlobal++;
      if (moisGlobal <= nMois && solde > 0) {
        if (tMensuel > 0) {
          var intM = solde * tMensuel;
          interetsAn += intM;
          if (moisGlobal <= differeMois) {
            creditAn += intM;
          } else {
            creditAn += mensualite;
            solde = Math.max(0, solde - (mensualite - intM));
          }
        } else {
          if (moisGlobal > differeMois) {
            creditAn += mensualite;
            solde = Math.max(0, solde - mensualite);
          }
        }
      }
    }

    // Loyers : calculés par lot avec décalage individuel
    var loyersAn = 0;
    var moisDebutAn = (y - 1) * 12;
    var moisFinAn = y * 12;
    var tauxOccup = pf(inputs.tauxOccupation);

    if (useLots) {
      lotsEffectifs.forEach(function(lot) {
        var lotLoyer = pf(lot.loyer);
        if (lotLoyer <= 0) return;
        var lotDebut = Math.max(0, Math.round(pf(lot.debutLoyerMois)));
        // Mois actifs pour ce lot dans cette année
        var debut = Math.max(moisDebutAn, lotDebut);
        var moisActifs = Math.max(0, moisFinAn - debut);
        moisActifs = Math.min(moisActifs, 12);
        // Occupation : prorata du taux global sur les mois où le lot est actif
        var occupLot = Math.min(tauxOccup * (moisActifs / 12), moisActifs);
        loyersAn += lotLoyer * occupLot * Math.pow(1.01, y - 1);
      });
    } else {
      var occupEff = Math.min(tauxOccup, 12);
      loyersAn = loyerGlobalFallback * occupEff * Math.pow(1.01, y - 1);
    }

    const gestionAn = (loyersAn * pf(inputs.gestionLocativePct)) / 100;
    const gliAn = (loyersAn * pf(inputs.gliPct)) / 100;
    const fraisAn = pf(inputs.chargesImmeubleAn) + pf(inputs.taxeFonciereAn) + assurancePNOBase + gestionAn + gliAn + pf(inputs.provisionTravauxAn) + pf(inputs.fraisBancairesAn) + pf(inputs.expertComptableAn);
    const baseDeductible = Math.max(0, loyersAn - fraisAn - interetsAn - amortissement);
    const baseFoncierR = Math.max(0, loyersAn - fraisAn - interetsAn);
    var impots = 0;
    if (regimeNom === "SAS / SCI IS") impots = baseDeductible * (tis / 100);
    else if (regimeNom === "LMNP Réel") impots = baseDeductible * ((tmi + 17.2) / 100);
    else if (regimeNom === "LMNP Micro BIC") impots = Math.max(0, loyersAn * 0.5) * ((tmi + 17.2) / 100);
    else if (regimeNom === "Foncier Réel") impots = baseFoncierR * ((tmi + 17.2) / 100);
    else if (regimeNom === "Micro Foncier") impots = Math.max(0, loyersAn * 0.7) * ((tmi + 17.2) / 100);
    data.push({ year: y, loyers: loyersAn, frais: fraisAn, credit: creditAn, interets: interetsAn, capitalRembourse: Math.max(0, creditAn - interetsAn), impots: impots, cashflow: loyersAn - fraisAn - creditAn - impots });
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

function EnrichmentChart({ data, depenseNette }) {
  const [hovered, setHovered] = useState(null);
  if (!data || data.length === 0) return null;

  // Calculer les données cumulées
  var cumData = [];
  var tresoCum = 0, capitalCum = 0;
  data.forEach(function(d) {
    tresoCum += d.cashflow;
    capitalCum += d.capitalRembourse || 0;
    cumData.push({ year: d.year, treso: tresoCum, capital: capitalCum, enrichissement: tresoCum + capitalCum });
  });

  var W = 680, H = 280, padL = 72, padR = 140, padT = 20, padB = 48;
  var chartW = W - padL - padR, chartH = H - padT - padB;
  var maxV = Math.max.apply(null, cumData.map(function(d) { return d.enrichissement; })) * 1.1 || 1;
  var minV = Math.min(0, Math.min.apply(null, cumData.map(function(d) { return d.treso; }))) * 1.1;
  var range = maxV - minV || 1;
  var toY = function(v) { return padT + chartH - ((v - minV) / range) * chartH; };
  var cx = function(i) { return padL + (i / cumData.length) * chartW + (chartW / cumData.length) / 2; };

  var h = hovered != null ? cumData[hovered] : null;

  var lines = [
    { key: "enrichissement", label: "Enrichissement total", color: "#22c55e", width: 3 },
    { key: "capital", label: "Capital remboursé", color: "#f59e0b", width: 2 },
    { key: "treso", label: "Trésorerie cumulée", color: "#60a5fa", width: 2 },
  ];

  // Grid
  var step = maxV > 200000 ? 50000 : maxV > 100000 ? 25000 : maxV > 50000 ? 10000 : 5000;
  var gridVals = [];
  for (var gv = 0; gv <= maxV; gv += step) gridVals.push(gv);
  for (var gvn = -step; gvn >= minV; gvn -= step) gridVals.push(gvn);

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={"0 0 " + W + " " + H} style={{ width: "100%", minWidth: 480, fontFamily: "system-ui,sans-serif" }} onMouseLeave={function() { setHovered(null); }}>
          <rect x={padL} y={padT} width={chartW} height={chartH} fill="rgba(248,250,252,0.8)" rx={8} />

          {/* Grid */}
          {gridVals.map(function(v) {
            var y = toY(v);
            if (y < padT - 2 || y > padT + chartH + 2) return null;
            return (<g key={v}><line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke={v === 0 ? "rgba(51,65,85,0.3)" : "rgba(148,163,184,0.18)"} strokeWidth={v === 0 ? 1.2 : 0.8} strokeDasharray={v === 0 ? "0" : "4 3"} /><text x={padL - 5} y={y + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{fmtK(v)}</text></g>);
          })}

          {/* Hover */}
          {hovered != null && (
            <line x1={cx(hovered)} y1={padT} x2={cx(hovered)} y2={padT + chartH} stroke="rgba(99,102,241,0.3)" strokeWidth={1} strokeDasharray="4 2" />
          )}

          {/* Area fill for enrichissement */}
          <defs>
            <linearGradient id="enrichGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={
            "M " + cx(0) + " " + toY(0) + " " +
            cumData.map(function(d, i) { return "L " + cx(i) + " " + toY(d.enrichissement); }).join(" ") +
            " L " + cx(cumData.length - 1) + " " + toY(0) + " Z"
          } fill="url(#enrichGrad)" />

          {/* Lines */}
          {lines.map(function(line) {
            return (
              <g key={line.key}>
                <polyline points={cumData.map(function(d, i) { return cx(i) + "," + toY(d[line.key]); }).join(" ")} fill="none" stroke={line.color} strokeWidth={line.width} strokeLinejoin="round" />
                {cumData.map(function(d, i) {
                  return <circle key={i} cx={cx(i)} cy={toY(d[line.key])} r={hovered === i ? 5 : 2.5} fill={hovered === i ? line.color : "white"} stroke={line.color} strokeWidth={1.5} onMouseEnter={function() { setHovered(i); }} style={{ cursor: "pointer" }} />;
                })}
              </g>
            );
          })}

          {/* X axis */}
          {cumData.map(function(d, i) {
            var show = cumData.length <= 15 || i === 0 || (i + 1) % 5 === 0 || i === cumData.length - 1;
            return show ? <text key={i} x={cx(i)} y={H - padB + 14} textAnchor="middle" fontSize={10} fill="#94a3b8">{d.year}</text> : null;
          })}
          <text x={padL + chartW / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#94a3b8">Année</text>

          {/* Legend */}
          {lines.map(function(l, i) {
            return (<g key={l.label} transform={"translate(" + (W - padR + 12) + "," + (padT + 14 + i * 22) + ")"}>
              <line x1={0} y1={-3} x2={14} y2={-3} stroke={l.color} strokeWidth={l.width} />
              <circle cx={7} cy={-3} r={3.5} fill="white" stroke={l.color} strokeWidth={1.5} />
              <text x={19} y={1} fontSize={10} fill="#475569">{l.label}</text>
            </g>);
          })}

          {/* Tooltip */}
          {h != null && (
            <g>
              <rect x={cx(hovered) > W / 2 ? cx(hovered) - 155 : cx(hovered) + 10} y={padT + 5} width={145} height={78} rx={8} fill="rgba(255,255,255,0.97)" stroke="rgba(148,163,184,0.35)" strokeWidth={1} />
              {(function() {
                var tx = cx(hovered) > W / 2 ? cx(hovered) - 150 : cx(hovered) + 15;
                return (<g>
                  <text x={tx} y={padT + 20} fontSize={11} fontWeight="700" fill="#0f172a">Année {h.year}</text>
                  {[
                    { label: "Tréso cumulée", value: h.treso, color: "#60a5fa" },
                    { label: "Capital remboursé", value: h.capital, color: "#f59e0b" },
                    { label: "Enrichissement", value: h.enrichissement, color: "#22c55e" },
                  ].map(function(row, idx) {
                    return (<g key={row.label} transform={"translate(" + tx + "," + (padT + 30 + idx * 16) + ")"}>
                      <circle cx={4} cy={-3} r={3} fill={row.color} />
                      <text x={11} y={0} fontSize={9} fill="#475569">{row.label}</text>
                      <text x={138} y={0} fontSize={9} fontWeight="600" fill={row.color} textAnchor="end">{fmtK(row.value)}</text>
                    </g>);
                  })}
                </g>);
              })()}
            </g>
          )}
        </svg>
      </div>
      {/* KPIs finaux */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 8 }}>
        {[
          { label: "Trésorerie cumulée", value: fmtEur(Math.round(cumData[cumData.length - 1].treso)), color: "#60a5fa", icon: "💰" },
          { label: "Capital remboursé", value: fmtEur(Math.round(cumData[cumData.length - 1].capital)), color: "#f59e0b", icon: "🏦" },
          { label: "Enrichissement total", value: fmtEur(Math.round(cumData[cumData.length - 1].enrichissement)), color: "#22c55e", icon: "🚀" },
        ].map(function(k) {
          return (<div key={k.label} style={{ background: k.color + "12", borderRadius: 14, padding: "12px 14px", border: "1px solid " + k.color + "30", textAlign: "center" }}>
            <div style={{ fontSize: 18, marginBottom: 2 }}>{k.icon}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{k.label}</div>
          </div>);
        })}
      </div>
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
    onChange(lots.concat([{ id: newId, nom: "Lot " + newId, surface: "", loyer: "", travaux: "", charges: "", debutLoyerMois: "0", dpe: "" }]));
  };
  const removeLot = function(id) { if (lots.length <= 1) return; onChange(lots.filter(function(l) { return l.id !== id; })); };
  const updateLot = function(id, field, value) { onChange(lots.map(function(l) { return l.id === id ? Object.assign({}, l, { [field]: value }) : l; })); };

  var fieldS = { width: "100%", background: "rgba(255,255,255,0.9)", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 8, padding: "6px 9px", fontSize: 13, color: "#0f172a", outline: "none" };
  var labelS = { fontSize: 10, color: "#94a3b8", marginBottom: 2 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Détail des lots ({lots.length})</div>
        <button onClick={addLot} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 8, padding: "5px 12px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>+ Lot</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lots.map(function(lot, idx) {
          var debutMois = pf(lot.debutLoyerMois);
          var debutLabel = debutMois <= 0 ? "Immédiat" : debutMois + " mois";
          var debutColor = debutMois <= 0 ? "#16a34a" : debutMois <= 3 ? "#d97706" : "#dc2626";
          return (
            <div key={lot.id} style={{ background: "rgba(248,250,252,0.9)", borderRadius: 14, padding: "12px 14px", border: "1px solid rgba(148,163,184,0.2)" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, background: "linear-gradient(135deg,#6366f1,#38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>#{idx + 1}</div>
                  <input value={lot.nom} onChange={function(e) { updateLot(lot.id, "nom", e.target.value); }} style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", background: "transparent", border: "none", outline: "none", borderBottom: "1px dashed #cbd5e1", maxWidth: 120 }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: debutColor, background: debutColor + "15", padding: "2px 7px", borderRadius: 6 }}>🔑 {debutLabel}</span>
                </div>
                <button onClick={function() { removeLot(lot.id); }} style={{ background: "rgba(239,68,68,0.08)", border: "none", borderRadius: 6, padding: "3px 8px", color: "#dc2626", cursor: lots.length > 1 ? "pointer" : "not-allowed", fontSize: 11, opacity: lots.length > 1 ? 1 : 0.3 }}>✕</button>
              </div>
              {/* Row 1: Surface + Loyer + Début loyer */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 6 }}>
                <div>
                  <div style={labelS}>Surface</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <input type="number" value={lot.surface} step="1" min="0" onChange={function(e) { updateLot(lot.id, "surface", e.target.value); }} style={fieldS} placeholder="—" />
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>m²</span>
                  </div>
                </div>
                <div>
                  <div style={labelS}>Loyer HC/mois</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <input type="number" value={lot.loyer} step="50" min="0" onChange={function(e) { updateLot(lot.id, "loyer", e.target.value); }} style={fieldS} placeholder="—" />
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>€</span>
                  </div>
                </div>
                <div>
                  <div style={labelS}>Début loyer</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <input type="number" value={lot.debutLoyerMois} step="1" min="0" onChange={function(e) { updateLot(lot.id, "debutLoyerMois", e.target.value); }} style={fieldS} placeholder="0" />
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>mois</span>
                  </div>
                </div>
              </div>
              {/* Row 2: Travaux + Charges + DPE */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <div style={labelS}>Travaux</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <input type="number" value={lot.travaux} step="500" min="0" onChange={function(e) { updateLot(lot.id, "travaux", e.target.value); }} style={fieldS} placeholder="—" />
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>€</span>
                  </div>
                </div>
                <div>
                  <div style={labelS}>Charges/an</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <input type="number" value={lot.charges} step="100" min="0" onChange={function(e) { updateLot(lot.id, "charges", e.target.value); }} style={fieldS} placeholder="—" />
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>€</span>
                  </div>
                </div>
                <div>
                  <div style={labelS}>DPE</div>
                  <div style={{ display: "flex", gap: 2 }}>
                    {["A","B","C","D","E","F","G"].map(function(note) {
                      var colors = { A:"#16a34a", B:"#4ade80", C:"#a3e635", D:"#facc15", E:"#fb923c", F:"#f97316", G:"#dc2626" };
                      var isA = lot.dpe === note;
                      return (
                        <button key={note} onClick={function() { updateLot(lot.id, "dpe", isA ? "" : note); }}
                          style={{ flex: 1, padding: "4px 0", borderRadius: 5, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11,
                            background: isA ? colors[note] : "rgba(148,163,184,0.12)",
                            color: isA ? "#fff" : "#94a3b8" }}>
                          {note}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
  prixVente: "", fraisNotaire: "", travaux: "", amenagements: "",
  fraisBancairesAchat: "", apport: "", tauxCredit: "4.2", dureeAnnees: "25",
  differeMois: "0",
  surfaceGlobale: "", loyerMensuelHC: "", tauxOccupation: "11.5",
  chargesImmeubleAn: "", taxeFonciereAn: "", assurancePNOAn: "",
  gestionLocativePct: "0", provisionTravauxAn: "", fraisBancairesAn: "",
  expertComptableAn: "", coefAmortissement: "4.75", tauxIS: "15", tmi: "11",
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
    try { localStorage.removeItem("radar-immo-photos-v1"); localStorage.setItem("radar-immo-photos-v1", JSON.stringify(photos)); } catch(e) { console.warn("Photos trop lourdes pour localStorage"); }
  }, [photos]);

  // Commune + donnees marche
  const [communeSearch, setCommuneSearch] = useState(inputs.commune || "");
  const [communeSuggestions, setCommuneSuggestions] = useState([]);
  const [donneesCommune, setDonneesCommune] = useState(null);
  const [loadingCommune, setLoadingCommune] = useState(false);

  // Autocompletion depuis le cache mémoire
  useEffect(function() {
    if (!communeSearch || communeSearch.length < 2) { setCommuneSuggestions([]); return; }
    getCommunesCache().then(function(communes) {
      var q = communeSearch.toLowerCase();
      var matches = communes.filter(function(c) { return c.nom.toLowerCase().includes(q); }).slice(0, 6);
      setCommuneSuggestions(matches);
    });
  }, [communeSearch]);

  // Charger les données de la commune sélectionnée
  var fetchDonneesCommune = useCallback(function(nom) {
    if (!nom) return;
    // Chercher dans le cache mémoire (instantané)
    getCommunesCache().then(function(communes) {
      var found = communes.find(function(c) { return c.nom === nom; });
      if (found && (found.prix || found.loyer || found.scores)) {
        setDonneesCommune(found);
        return;
      }
      // Cache insuffisant : appel API
      setLoadingCommune(true);
      setDonneesCommune(null);
      fetch(API_BASE + "/analyse/" + encodeURIComponent(nom))
        .then(function(r) { if (!r.ok) throw new Error("Erreur"); return r.json(); })
        .then(function(d) { setDonneesCommune(d); })
        .catch(function() { setDonneesCommune(null); })
        .finally(function() { setLoadingCommune(false); });
    });
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
  const chartRef = React.useRef(null);
  const enrichChartRef = React.useRef(null);

  const handleChange = function(e) {
    const name = e.target.name; const value = e.target.value;
    setInputs(function(prev) {
      var next = Object.assign({}, prev, { [name]: value });
      // Auto-calcul frais de notaire à 8.5% du prix FAI
      if (name === "prixVente" && pf(value) > 0) {
        next.fraisNotaire = String(Math.round(pf(value) * 0.085));
      }
      return next;
    });
  };
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
    try { localStorage.setItem(PROJETS_KEY, JSON.stringify(liste)); } catch(e) { console.warn("localStorage plein:", e); }
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
  const supprimer = function(id) { const liste = projets.filter(function(p) { return p.id !== id; }); setProjets(liste); try { localStorage.setItem(PROJETS_KEY, JSON.stringify(liste)); } catch(e) {} };

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
      alert("jsPDF non chargé. Ajoutez dans index.html :\n<script src=\"https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js\"></script>");
      return;
    }
    // Basculer sur l'onglet projection pour rendre le graphique visible
    var prevTab = activeTab;
    setActiveTab("projection");
    // Attendre que React rende le graphique
    await new Promise(function(resolve) { setTimeout(resolve, 500); });

    try {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    var W = 210, H = 297, ML = 15, MR = 15;
    var CW = W - ML - MR;

    var C = {
      primary: [44, 62, 80], accent: [41, 128, 185], green: [39, 174, 96],
      red: [231, 76, 60], orange: [243, 156, 18], grey: [127, 140, 141],
      lightGrey: [236, 240, 241], dark: [44, 62, 80], white: [255, 255, 255], bg: [249, 250, 251],
    };

    var pv = pf(inputs.prixVente);
    var surf = pf(inputs.surfaceGlobale);
    var r = result;
    var regime = r.regimes[regimeActif];
    var tresoPMois = regime.tresorerie / 12;
    var prixM2 = surf > 0 ? pv / surf : null;
    var cfData = cashFlowData;

    // PDF-safe number format (replace narrow no-break space with normal space)
    function fmtP(n, d) { return fmt(n, d).replace(/[\u202F\u00A0]/g, " "); }
    function fmtPctP(n) { return fmtPct(n).replace(/[\u202F\u00A0]/g, " "); }
    function fmtEurP(n) { return fmtP(n) + " €"; }

    function setC(c) { doc.setTextColor(c[0], c[1], c[2]); }
    function setF(c) { doc.setFillColor(c[0], c[1], c[2]); }
    function setD(c) { doc.setDrawColor(c[0], c[1], c[2]); }

    function banner(title, y) {
      setF(C.primary);
      doc.roundedRect(ML, y, CW, 14, 3, 3, "F");
      doc.setFontSize(13); doc.setFont("helvetica", "bold"); setC(C.white);
      doc.text(title, W / 2, y + 9, { align: "center" });
      setC(C.dark); return y + 18;
    }
    function kpiBox(x, y, w, h, label, value, bg) {
      setF(bg); doc.roundedRect(x, y, w, h, 3, 3, "F");
      doc.setFontSize(8); doc.setFont("helvetica", "bold"); setC(C.white);
      doc.text(label, x + w / 2, y + 7, { align: "center" });
      doc.setFontSize(15); doc.text(String(value), x + w / 2, y + h - 5, { align: "center" });
      setC(C.dark);
    }
    function sectionH(title, y) {
      setF(C.accent); doc.roundedRect(ML, y, CW, 8, 2, 2, "F");
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); setC(C.white);
      doc.text(title, ML + 5, y + 5.5); setC(C.dark); return y + 12;
    }
    function footer(n) {
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); setC(C.grey);
      doc.text("Dossier généré par Radar Immo 76 — " + new Date().toLocaleDateString("fr-FR"), ML, H - 6);
      doc.text("Page " + n, W - MR, H - 6, { align: "right" }); setC(C.dark);
    }

    // ═══════════════ PAGE 1 — Présentation ═══════════════
    // Header bandeau gradient
    setF(C.primary); doc.rect(0, 0, W, 38, "F");
    setF(C.accent); doc.rect(0, 36, W, 2, "F");
    doc.setFontSize(24); doc.setFont("helvetica", "bold"); setC(C.white);
    doc.text(nomProjet || "Projet d'investissement immobilier", W / 2, 16, { align: "center" });
    if (inputs.commune) { doc.setFontSize(13); doc.setFont("helvetica", "normal"); doc.text(inputs.commune, W / 2, 28, { align: "center" }); }
    // Date en haut à droite
    doc.setFontSize(8); doc.text(new Date().toLocaleDateString("fr-FR"), W - MR, 8, { align: "right" });
    setC(C.dark);

    var y = 44;

    // Photo avec ratio correct
    if (photos && photos[0] && photos[0].url) {
      try {
        var imgDims = await new Promise(function(resolve) {
          var img = new Image();
          img.onload = function() { resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height }); };
          img.onerror = function() { resolve({ w: CW, h: 60 }); };
          img.src = photos[0].url;
          if (img.complete && img.naturalWidth) resolve({ w: img.naturalWidth, h: img.naturalHeight });
        });
        var ratio = imgDims.w / imgDims.h;
        var pdfImgW = CW;
        var pdfImgH = CW / ratio;
        if (pdfImgH > 75) { pdfImgH = 75; pdfImgW = pdfImgH * ratio; }
        if (pdfImgH < 30) pdfImgH = 30;
        var imgX = ML + (CW - pdfImgW) / 2;
        doc.addImage(photos[0].url, "JPEG", imgX, y, pdfImgW, pdfImgH, "", "MEDIUM");
        y += pdfImgH + 5;
      } catch(e) { y += 2; }
    }

    // 4 KPIs en ligne (style LyBox avec icônes)
    var kw4 = (CW - 12) / 4;
    var dpeColors = { A:[22,163,74], B:[74,222,128], C:[163,230,53], D:[250,204,21], E:[251,146,60], F:[249,115,22], G:[220,38,38] };
    var dpeC = dpeColors[inputs.noteDPE] || C.grey;
    kpiBox(ML, y, kw4, 24, "Prix d'achat FAI", fmtP(pv, 0) + " €", C.green);
    kpiBox(ML + kw4 + 4, y, kw4, 24, "Superficie", surf > 0 ? fmtP(surf, 0) + " m²" : "—", C.accent);
    kpiBox(ML + (kw4 + 4) * 2, y, kw4, 24, "Rendement brut", fmtPctP(r.rendBrut), C.orange);
    kpiBox(ML + (kw4 + 4) * 3, y, kw4, 24, "Cash-flow/mois", (tresoPMois >= 0 ? "+" : "") + fmtP(Math.round(tresoPMois), 0) + " €", tresoPMois >= 0 ? C.green : C.red);
    y += 28;

    // Descriptif lots avec DPE
    y = sectionH("Descriptif des lots", y);

    if (lots.length > 0) {
      // Header tableau
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); setC(C.grey);
      var lotCols = [ML + 3, ML + 40, ML + 68, ML + 98, ML + 128, ML + 158];
      doc.text("Lot", lotCols[0], y); doc.text("Surface", lotCols[1], y); doc.text("Loyer/mois", lotCols[2], y);
      doc.text("Travaux", lotCols[3], y); doc.text("Début loyer", lotCols[4], y); doc.text("DPE", lotCols[5], y);
      y += 2; setD(C.accent); doc.setLineWidth(0.5); doc.line(ML, y, W - MR, y); doc.setLineWidth(0.2); y += 4;

      lots.slice(0, 8).forEach(function(l, idx) {
        // Alternate row background
        if (idx % 2 === 0) { setF(C.bg); doc.rect(ML, y - 3.5, CW, 6.5, "F"); }
        doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); setC(C.dark);
        doc.text((l.nom || "Lot").substring(0, 18), lotCols[0], y);
        doc.setFont("helvetica", "normal");
        doc.text(l.surface ? l.surface + " m²" : "—", lotCols[1], y);
        setC(C.green); doc.setFont("helvetica", "bold");
        doc.text(l.loyer ? fmtP(pf(l.loyer), 0) + " €" : "—", lotCols[2], y);
        setC(C.dark); doc.setFont("helvetica", "normal");
        doc.text(pf(l.travaux) > 0 ? fmtP(pf(l.travaux), 0) + " €" : "—", lotCols[3], y);
        var deb = pf(l.debutLoyerMois);
        setC(deb > 0 ? C.orange : C.green);
        doc.text(deb > 0 ? deb + " mois" : "Immédiat", lotCols[4], y);
        // DPE badge coloré
        if (l.dpe) {
          var dpeBg = dpeColors[l.dpe] || C.grey;
          setF(dpeBg); doc.roundedRect(lotCols[5] - 1, y - 3, 10, 5, 1.5, 1.5, "F");
          doc.setFontSize(8); doc.setFont("helvetica", "bold"); setC(C.white);
          doc.text(l.dpe, lotCols[5] + 4, y, { align: "center" });
        } else {
          doc.setFontSize(8); setC(C.grey); doc.text("—", lotCols[5], y);
        }
        setC(C.dark);
        y += 6.5;
      });

      // Totaux
      y += 2;
      setF(C.lightGrey); doc.roundedRect(ML, y - 2, CW, 7, 2, 2, "F");
      var totalLoyer = lots.reduce(function(s, l) { return s + pf(l.loyer); }, 0);
      var totalTravaux = lots.reduce(function(s, l) { return s + pf(l.travaux); }, 0);
      doc.setFontSize(8); doc.setFont("helvetica", "bold"); setC(C.primary);
      doc.text("TOTAL", lotCols[0], y + 2);
      doc.text(fmtP(surf, 0) + " m²", lotCols[1], y + 2);
      setC(C.green); doc.text(fmtP(totalLoyer, 0) + " €", lotCols[2], y + 2);
      setC(C.dark); doc.text(totalTravaux > 0 ? fmtP(totalTravaux, 0) + " €" : "—", lotCols[3], y + 2);
      y += 12;
    }

    // Résumé financement rapide
    setF(C.bg); doc.roundedRect(ML, y, CW, 18, 3, 3, "F");
    setD(C.accent); doc.setLineWidth(0.8); doc.roundedRect(ML, y, CW, 18, 3, 3, "S"); doc.setLineWidth(0.2);
    var fw = CW / 4;
    [
      { label: "Total à financer", value: fmtP(Math.round(r.depenseNette), 0) + " €", color: C.primary },
      { label: "Apport", value: fmtP(pf(inputs.apport), 0) + " €", color: C.green },
      { label: "Reste à financer", value: fmtP(Math.round(r.sommeEmpruntee), 0) + " €", color: C.accent },
      { label: "Mensualité", value: fmtP(Math.round(r.mensualite), 0) + " €/mois", color: C.orange },
    ].forEach(function(item, i) {
      var ix = ML + i * fw + fw / 2;
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); setC(C.grey);
      doc.text(item.label, ix, y + 6, { align: "center" });
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); setC(item.color);
      doc.text(item.value, ix, y + 14, { align: "center" });
    });
    y += 22;

    // Zone notes
    setF([255, 251, 235]); doc.roundedRect(ML, y, CW, 20, 3, 3, "F");
    setD([251, 191, 36]); doc.setLineWidth(0.4); doc.roundedRect(ML, y, CW, 20, 3, 3, "S"); doc.setLineWidth(0.2);
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); setC(C.orange);
    doc.text("Notes", ML + 5, y + 6);
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); setC(C.grey);
    doc.text("...........", ML + 5, y + 13);

    footer(1);

    // ═══════════════ PAGE 2 — Analyse financière ═══════════════
    doc.addPage(); y = 14;
    y = banner("Analyse financière du projet", y);

    var kw = (CW - 8) / 3;
    kpiBox(ML, y, kw, 22, "Loyer mensuel HC", fmtP(pf(inputs.loyerMensuelHC), 0) + " €", C.green);
    kpiBox(ML + kw + 4, y, kw, 22, "Charges mensuelles (avec crédit)", fmtP(Math.round((r.totalFraisAnnuels + r.remboursementAnnuel) / 12), 0) + " €", C.orange);
    kpiBox(ML + kw * 2 + 8, y, kw, 22, "Cash-Flow", (tresoPMois >= 0 ? "+" : "") + fmtP(Math.round(tresoPMois), 0) + " €", tresoPMois >= 0 ? C.green : C.red);
    y += 26;
    var kw2 = (CW - 4) / 2;
    kpiBox(ML, y, kw2, 20, "Rendement brut", fmtPctP(r.rendBrut), C.orange);
    kpiBox(ML + kw2 + 4, y, kw2, 20, "Rendement net", fmtPctP(regime.rendNet), C.green);
    y += 24;

    // Charges détaillées
    y = sectionH("Charges annuelles", y);
    var chargesList = [
      ["Taxe foncière", fmtP(pf(inputs.taxeFonciereAn), 0) + " €/an"],
      ["Assurance PNO", fmtP(pf(inputs.assurancePNOAn) || Math.round(r.depenseNette * 0.0012), 0) + " €/an"],
      ["Gestion agence (" + pf(inputs.gestionLocativePct) + " %)", fmtP(Math.round(r.loyersAnnuels * pf(inputs.gestionLocativePct) / 100), 0) + " €/an"],
      ["Garantie loyers impayés (" + pf(inputs.gliPct) + " %)", fmtP(Math.round(r.loyersAnnuels * pf(inputs.gliPct) / 100), 1) + " €/an"],
      ["Charges de copropriété", fmtP(pf(inputs.chargesImmeubleAn), 0) + " €/an"],
      ["Vacance locative (" + (12 - pf(inputs.tauxOccupation)).toFixed(1) + " mois/an)", fmtP(Math.round(pf(inputs.loyerMensuelHC) * (12 - pf(inputs.tauxOccupation))), 0) + " €/an"],
      ["Provision travaux", fmtP(pf(inputs.provisionTravauxAn), 0) + " €/an"],
      ["Comptabilité / CGA / CFE", fmtP(pf(inputs.expertComptableAn), 0) + " €/an"],
      ["Frais bancaires", fmtP(pf(inputs.fraisBancairesAn), 0) + " €/an"],
    ];
    chargesList.forEach(function(c) {
      doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); setC(C.grey);
      doc.text(c[0], W / 2 + 5, y);
      doc.setFont("helvetica", "bold"); setC(C.dark);
      doc.text(c[1], W - MR - 3, y, { align: "right" });
      setD(C.lightGrey); doc.line(W / 2 + 3, y + 1.5, W - MR, y + 1.5);
      y += 6;
    });
    setF(C.lightGrey); doc.rect(W / 2 + 3, y - 3, CW / 2 - 3, 7, "F");
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); setC(C.primary);
    doc.text("Total", W / 2 + 6, y + 1);
    doc.text(fmtP(Math.round(r.totalFraisAnnuels), 0) + " €/an", W - MR - 3, y + 1, { align: "right" });
    y += 10;

    // 3 blocs : Achat / Crédit / Indicateurs
    y = sectionH("Achat / Crédit / Indicateurs clés", y);
    var tw = (CW - 8) / 3;
    var blocks = [
      { title: "Achat", x: ML, rows: [
        ["Prix d'achat FAI", fmtP(pv, 0) + " €"], ["Frais de notaire", fmtP(pf(inputs.fraisNotaire), 0) + " €"],
        ["Travaux", fmtP(pf(inputs.travaux), 0) + " €"], ["Aménagements", fmtP(pf(inputs.amenagements), 0) + " €"],
        ["Frais bancaires (dossier, garantie)", fmtP(pf(inputs.fraisBancairesAchat), 0) + " €"],
        ["Total à financer", fmtP(Math.round(r.depenseNette), 0) + " €"],
      ]},
      { title: "Crédit", x: ML + tw + 4, rows: [
        ["Apport", fmtP(pf(inputs.apport), 0) + " €"],
        ["Reste à financer", fmtP(Math.round(r.sommeEmpruntee), 0) + " €"],
        ["Taux crédit", pf(inputs.tauxCredit) + " %"],
        ["Durée", pf(inputs.dureeAnnees) + " ans"], ["Mensualité", fmtP(Math.round(r.mensualite), 0) + " €"],
        ["Coût total crédit", fmtP(Math.round(r.coutPretTotal), 0) + " €"],
      ]},
      { title: "Indicateurs clés", x: ML + tw * 2 + 8, rows: [
        ["Prix au m² à l'achat", prixM2 ? fmtP(Math.round(prixM2), 0) + " €/m²" : "—"],
        ["Prix au m² final", prixM2 ? fmtP(Math.round(r.depenseNette / surf), 0) + " €/m²" : "—"],
        ["Rendement brut", fmtPctP(r.rendBrut)], ["Rendement net", fmtPctP(regime.rendNet)],
        ["Cash-flow annuel", fmtP(Math.round(regime.tresorerie), 0) + " €"],
        ["Cash-flow mensuel", fmtP(Math.round(tresoPMois), 0) + " €"],
        ["Taux de couverture", regime.regle70 != null ? fmtPctP(1 / regime.regle70) : "—"],
      ]},
    ];
    var maxR = Math.max.apply(null, blocks.map(function(b) { return b.rows.length; }));
    blocks.forEach(function(block) {
      var bh = 7 + block.rows.length * 6;
      setF(C.bg); doc.roundedRect(block.x, y, tw, bh, 2, 2, "F");
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setC(C.primary);
      doc.text(block.title, block.x + tw / 2, y + 5, { align: "center" });
      block.rows.forEach(function(row, i) {
        var ry = y + 10 + i * 6;
        var isLast = i === block.rows.length - 1;
        doc.setFontSize(7); doc.setFont("helvetica", isLast ? "bold" : "normal"); setC(isLast ? C.primary : C.grey);
        doc.text(row[0], block.x + 2, ry);
        doc.setFont("helvetica", "bold"); setC(C.dark);
        doc.text(row[1], block.x + tw - 2, ry, { align: "right" });
      });
    });
    y += 7 + maxR * 6 + 4;
    footer(2);

    // ═══════════════ PAGE 3 — Analyse du secteur ═══════════════
    doc.addPage(); y = 14;
    y = banner("Analyse du secteur" + (inputs.commune ? " — " + inputs.commune : ""), y);

    if (donneesCommune && donneesCommune.scores) {
      var dc = donneesCommune; var pri = dc.prix || {}; var loy = dc.loyer || {};
      var dem = dc.demographie || {}; var se = dc.socio_eco || {};
      kpiBox(ML, y, kw, 22, "Nombre d'habitants", dc.population ? fmtP(dc.population, 0) : "—", C.green);
      kpiBox(ML + kw + 4, y, kw, 22, "Tension locative", dem.tension_locative_pct != null ? dem.tension_locative_pct + " %" : "—", C.red);
      kpiBox(ML + kw * 2 + 8, y, kw, 22, "Prix au m² moyen", pri.appartement_m2 ? fmtP(pri.appartement_m2, 0) + " €/m²" : "—", C.accent);
      y += 26;

      y = sectionH("Informations sur la ville", y);
      var infoItems = [
        ["Niveau de vie moyen par habitant", se.revenu_median ? fmtP(se.revenu_median, 0) + " €" : "—"],
        ["Taux de logements vacants", dem.vacance_pct != null ? dem.vacance_pct + " %" : "—"],
        ["Taux de chômage", se.chomage_pct != null ? se.chomage_pct + " %" : "—"],
        ["Évolution population/an", dem.evolution_pop_pct_an != null ? dem.evolution_pop_pct_an + " %" : "—"],
        ["Taux de taxe foncière", "—"],
        ["Ancienneté des locataires", "—"],
        ["Zone ABC", dc.zonage_abc || "—"],
        ["Loyer médian", loy.appartement_m2 != null ? Number(loy.appartement_m2).toFixed(1) + " €/m²" : "—"],
      ];
      var halfCW = (CW - 4) / 2;
      infoItems.forEach(function(item, i) {
        var col = i % 2; var row = Math.floor(i / 2);
        var x = ML + col * (halfCW + 4); var iy = y + row * 10;
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); setC(C.grey);
        doc.text(item[0], x + 3, iy);
        doc.setFontSize(14); doc.setFont("helvetica", "bold"); setC(C.dark);
        doc.text(item[1], x + 3, iy + 7);
      });
      y += Math.ceil(infoItems.length / 2) * 10 + 6;

      y = sectionH("Scores d'investissement", y);
      [
        ["Score global", dc.scores.global, 10], ["Score rendement", dc.scores.rendement, 10],
        ["Score démographie", dc.scores.demographie, 10], ["Score socio-éco", dc.scores.socio_eco, 10],
      ].forEach(function(s) {
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); setC(C.grey);
        doc.text(s[0], ML + 3, y);
        var val = s[1] != null ? s[1].toFixed(1) : "—";
        var barColor = s[1] >= 7 ? C.green : s[1] >= 5 ? C.orange : C.red;
        // Barre de progression
        setF(C.lightGrey); doc.roundedRect(ML + 70, y - 3, 80, 5, 1.5, 1.5, "F");
        if (s[1] != null) { setF(barColor); doc.roundedRect(ML + 70, y - 3, Math.max(2, (s[1] / s[2]) * 80), 5, 1.5, 1.5, "F"); }
        doc.setFont("helvetica", "bold"); setC(C.dark);
        doc.text(val + " / " + s[2], ML + 155, y);
        y += 8;
      });
    } else {
      doc.setFontSize(11); doc.setFont("helvetica", "italic"); setC(C.grey);
      doc.text("Commune non renseignée.", ML, y + 10);
    }
    footer(3);

    // ═══════════════ PAGE 4 — Analyse patrimoniale ═══════════════
    doc.addPage(); y = 14;
    y = banner("Analyse patrimoniale", y);

    kpiBox(ML, y, kw, 22, "Loyers annuels HC", fmtP(Math.round(r.loyersAnnuels), 0) + " €", C.green);
    kpiBox(ML + kw + 4, y, kw, 22, "Amortissement annuel moyen", fmtP(Math.round(r.amortissement), 0) + " €", C.orange);
    kpiBox(ML + kw * 2 + 8, y, kw, 22, "Choix du régime fiscal", regimeActif, C.accent);
    y += 26;

    y = sectionH("Comparatif des régimes fiscaux", y);
    var rX = [ML + 2, 55, 88, 118, 148, 174];
    doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); setC(C.grey);
    ["Régime", "Trésorerie/an", "Cash-flow/mois", "Impôts/an", "Rdt brut", "Rdt net"].forEach(function(h, i) { doc.text(h, rX[i], y); });
    y += 4; setD(C.grey); doc.line(ML, y, W - MR, y); y += 5;
    Object.entries(r.regimes).forEach(function(entry) {
      var nom = entry[0]; var reg = entry[1]; var isA = nom === regimeActif;
      if (isA) { setF([232, 240, 254]); doc.rect(ML, y - 3.5, CW, 7, "F"); }
      doc.setFontSize(7.5); doc.setFont("helvetica", isA ? "bold" : "normal"); setC(C.dark);
      doc.text(nom, rX[0], y);
      doc.text(fmtP(Math.round(reg.tresorerie), 0) + " €", rX[1], y);
      var cfm = reg.tresorerie / 12; setC(cfm >= 0 ? C.green : C.red);
      doc.text(fmtP(Math.round(cfm), 0) + " €", rX[2], y);
      setC(C.red); doc.text(fmtP(Math.round(reg.impot), 0) + " €", rX[3], y);
      setC(C.dark); doc.text(fmtPctP(reg.rendBrut), rX[4], y); doc.text(fmtPctP(reg.rendNet), rX[5], y);
      y += 7;
    });
    y += 4;

    y = sectionH("Bilan comptable prévisionnel", y);
    var tX = [ML + 1, 34, 57, 80, 108, 140, 170];
    doc.setFontSize(7); doc.setFont("helvetica", "bold"); setC(C.grey);
    ["", "Loyers", "Annuité", "Charges", "Impôts sur les sociétés", "Cash-flow", "Rendement net d'impôts"].forEach(function(h, i) { doc.text(h, tX[i], y); });
    y += 3; setD(C.lightGrey); doc.line(ML, y, W - MR, y); y += 3;
    var maxRows = Math.min(cfData.length, Math.floor((H - y - 14) / 5.5));
    cfData.slice(0, maxRows).forEach(function(d, idx) {
      if (idx % 2 === 0) { setF(C.bg); doc.rect(ML, y - 3, CW, 5.5, "F"); }
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); setC(C.dark);
      doc.text(String(d.year), tX[0], y);
      doc.text(fmtP(Math.round(d.loyers), 0) + " €", tX[1], y);
      doc.text("-" + fmtP(Math.round(d.credit), 0) + " €", tX[2], y);
      doc.text("-" + fmtP(Math.round(d.frais), 0) + " €", tX[3], y);
      setC(C.red); doc.text("-" + fmtP(Math.round(d.impots), 0) + " €", tX[4], y);
      setC(d.cashflow >= 0 ? C.green : C.red); doc.setFont("helvetica", "bold");
      doc.text((d.cashflow >= 0 ? "+" : "") + fmtP(Math.round(d.cashflow), 0) + " €", tX[5], y);
      setC(C.dark); doc.setFont("helvetica", "normal");
      var rn = r.depenseNette > 0 ? (d.cashflow / r.depenseNette * 100) : 0;
      doc.text(rn.toFixed(2) + " %", tX[6], y);
      y += 5.5;
    });
    footer(4);

    // ═══════════════ PAGE 5 — Graphique Cash-Flow ═══════════════
    // Capturer le graphique SVG du simulateur
    if (chartRef && chartRef.current) {
      try {
        // Charger html2canvas dynamiquement si pas déjà présent
        if (!window.html2canvas) {
          await new Promise(function(resolve, reject) {
            var s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
          });
        }
        var canvas = await window.html2canvas(chartRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
        var imgData = canvas.toDataURL("image/png");
        doc.addPage();
        y = 14;
        y = banner("Évolution du Cash-Flow — " + regimeActif, y);
        // Calculer le ratio de l'image
        var cRatio = canvas.width / canvas.height;
        var chartPdfW = CW;
        var chartPdfH = CW / cRatio;
        if (chartPdfH > 180) { chartPdfH = 180; chartPdfW = chartPdfH * cRatio; }
        var chartX = ML + (CW - chartPdfW) / 2;
        doc.addImage(imgData, "PNG", chartX, y, chartPdfW, chartPdfH, "", "MEDIUM");
        y += chartPdfH + 6;
        // Cash-flow total cumulé
        var totalCF = cfData.reduce(function(s, d) { return s + d.cashflow; }, 0);
        setF(C.bg); doc.roundedRect(ML, y, CW, 14, 2, 2, "F");
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); setC(C.primary);
        doc.text("Cash-Flow total sur " + cfData.length + " ans :", ML + 5, y + 9);
        setC(totalCF >= 0 ? C.green : C.red);
        doc.text(fmtP(Math.round(totalCF), 0) + " €", W - MR - 5, y + 9, { align: "right" });
        footer(5);

        // Capturer le graphique d'enrichissement
        if (enrichChartRef && enrichChartRef.current) {
          var canvas2 = await window.html2canvas(enrichChartRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
          var imgData2 = canvas2.toDataURL("image/png");
          doc.addPage();
          y = 14;
          y = banner("Évolution du capital net — " + regimeActif, y);
          var cRatio2 = canvas2.width / canvas2.height;
          var chartPdfW2 = CW;
          var chartPdfH2 = CW / cRatio2;
          if (chartPdfH2 > 180) { chartPdfH2 = 180; chartPdfW2 = chartPdfH2 * cRatio2; }
          var chartX2 = ML + (CW - chartPdfW2) / 2;
          doc.addImage(imgData2, "PNG", chartX2, y, chartPdfW2, chartPdfH2, "", "MEDIUM");
          y += chartPdfH2 + 8;
          // KPIs enrichissement
          var tresoCum = cfData.reduce(function(s, d) { return s + d.cashflow; }, 0);
          var capitalCum = cfData.reduce(function(s, d) { return s + (d.capitalRembourse || 0); }, 0);
          var enrichTotal = tresoCum + capitalCum;
          var ew = (CW - 8) / 3;
          [
            { label: "Trésorerie cumulée", value: fmtP(Math.round(tresoCum), 0) + " €", color: C.accent },
            { label: "Capital remboursé", value: fmtP(Math.round(capitalCum), 0) + " €", color: C.orange },
            { label: "Enrichissement total", value: fmtP(Math.round(enrichTotal), 0) + " €", color: C.green },
          ].forEach(function(k, i) {
            var kx = ML + i * (ew + 4);
            setF(k.color); doc.roundedRect(kx, y, ew, 18, 3, 3, "F");
            doc.setFontSize(8); doc.setFont("helvetica", "bold"); setC(C.white);
            doc.text(k.label, kx + ew / 2, y + 6, { align: "center" });
            doc.setFontSize(14); doc.text(k.value, kx + ew / 2, y + 14, { align: "center" });
          });
          footer(6);
        }
      } catch(e) { console.warn("Capture graphique échouée:", e); }
    }

    // ═══════════════ PAGES FICHE PATRIMOINE ═══════════════
    var profilData = null;
    try { profilData = JSON.parse(localStorage.getItem("radar-immo-profil-v1")); } catch(e) {}

    if (profilData && profilData.emprunteurs && profilData.emprunteurs[0] && profilData.emprunteurs[0].nom) {
      var pg = 7; // numéro de page courant
      var emp = profilData.emprunteurs || [];
      var revs = profilData.revenus || [];
      var creds = profilData.credits || [];
      var patImmo = profilData.patrimoineImmo || [];
      var patFin = profilData.patrimoineFinancier || [];

      // Helper tableau PDF
      function pdfTable(headers, rows, colWidths, startY) {
        var tx = ML;
        // Header
        doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); setC(C.grey);
        headers.forEach(function(h, i) { doc.text(h, tx + 2, startY); tx += colWidths[i]; });
        startY += 2; setD(C.accent); doc.setLineWidth(0.5); doc.line(ML, startY, W - MR, startY); doc.setLineWidth(0.2); startY += 4;
        // Rows
        rows.forEach(function(row, ridx) {
          // Calculer la hauteur max de la ligne (texte wrappé dans la 1ère colonne)
          doc.setFontSize(7.5);
          var firstColLines = doc.splitTextToSize(String(row[0] || "—"), colWidths[0] - 4);
          var rowH = Math.max(6, firstColLines.length * 4 + 2);
          if (ridx % 2 === 0) { setF(C.bg); doc.rect(ML, startY - 3.5, CW, rowH, "F"); }
          tx = ML;
          doc.setFont("helvetica", "normal"); setC(C.dark);
          var isLast = ridx === rows.length - 1;
          if (isLast) { doc.setFont("helvetica", "bold"); setC(C.primary); }
          // Première colonne avec wrapping
          doc.text(firstColLines, tx + 2, startY);
          tx += colWidths[0];
          // Autres colonnes
          for (var ci = 1; ci < row.length; ci++) {
            doc.text(String(row[ci] || "—"), tx + 2, startY);
            tx += colWidths[ci];
          }
          startY += rowH;
        });
        return startY + 2;
      }

      // ── PAGE: État civil ──
      doc.addPage(); y = 14;
      y = banner("Fiche Patrimoine — État Civil", y);

      emp.forEach(function(e, idx) {
        if (!e.nom && !e.prenom) return;
        y = sectionH("Emprunteur " + (idx + 1), y);
        var fields = [
          ["Nom et Prénoms", (e.nom || "") + " " + (e.prenom || "")],
          ["Nationalité", e.nationalite || "—"],
          ["Date et lieu de naissance", (e.dateNaissance || "—") + " " + (e.lieuNaissance || "")],
          ["Adresse", e.adresse || "—"],
          ["Téléphone", e.telephone || "—"],
          ["Situation logement", (e.situationLogement || "—") + (e.ancienneteLogement ? " · Depuis le " + e.ancienneteLogement : "")],
          ["Employeur", e.employeur || "—"],
          ["Ancienneté", e.ancienneteEmployeur || "—"],
        ];
        fields.forEach(function(f) {
          doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); setC(C.grey);
          doc.text(f[0], ML + 3, y);
          doc.setFont("helvetica", "bold"); setC(C.dark);
          doc.text(f[1], ML + 60, y);
          setD(C.lightGrey); doc.line(ML, y + 2, W - MR, y + 2);
          y += 7;
        });
        y += 4;
      });
      footer(pg); pg++;

      // ── PAGE: Revenus + Crédits ──
      doc.addPage(); y = 14;
      y = banner("Fiche Patrimoine — Revenus & Crédits", y);

      // Revenus
      y = sectionH("Revenus", y);
      var totalRevPdf = 0;
      var revRows = revs.map(function(r2) { var m = pf(r2.montantAnnuel); totalRevPdf += m; return [r2.type || "—", r2.titulaire || "—", m > 0 ? fmtP(m, 0) + " €" : "—"]; });
      revRows.push(["TOTAL ANNUEL", "", fmtP(totalRevPdf, 0) + " €"]);
      y = pdfTable(["Type de revenu", "Titulaire", "Montant annuel"], revRows, [65, 50, 50], y);
      y += 6;

      // Crédits en cours
      y = sectionH("Crédits en cours", y);
      var totalCredPdf = 0;
      var credRows = creds.filter(function(c) { return c.nature; }).map(function(c) {
        var ch = pf(c.chargeAnnuelle); totalCredPdf += ch;
        return [c.nature || "—", c.titulaire || "—", c.preteur || "—", c.dureeRestante ? c.dureeRestante + " mois" : "—", pf(c.capitalRestant) > 0 ? fmtP(pf(c.capitalRestant), 0) + " €" : "—", ch > 0 ? fmtP(ch, 0) + " €" : "—"];
      });
      credRows.push(["TOTAL ANNUEL", "", "", "", "", fmtP(totalCredPdf, 0) + " €"]);
      y = pdfTable(["Nature", "Titulaire", "Prêteur", "Durée rest.", "Capital rest.", "Charge/an"], credRows, [30, 25, 30, 22, 30, 30], y);

      // Taux endettement
      y += 4;
      var tauxEndPdf = totalRevPdf > 0 ? (totalCredPdf / totalRevPdf * 100) : 0;
      setF(tauxEndPdf > 35 ? [254, 226, 226] : [220, 252, 231]); doc.roundedRect(ML, y, CW, 12, 2, 2, "F");
      doc.setFontSize(10); doc.setFont("helvetica", "bold");
      setC(tauxEndPdf > 35 ? C.red : C.green);
      doc.text("Taux d'endettement actuel : " + tauxEndPdf.toFixed(1) + " %", W / 2, y + 8, { align: "center" });
      y += 16;

      footer(pg); pg++;

      // ── PAGE: Patrimoine ──
      doc.addPage(); y = 14;
      y = banner("Fiche Patrimoine — Patrimoine", y);

      // Patrimoine immobilier
      y = sectionH("Patrimoine immobilier", y);
      var totalImmoNetPdf = 0;
      var immoRows = patImmo.filter(function(p2) { return p2.type; }).map(function(p2) {
        var net = pf(p2.valeurEstimee) - pf(p2.capitalRestant); totalImmoNetPdf += net;
        return [p2.type || "—", p2.proprietaire || "—", p2.anneeAcquisition || "—", pf(p2.valeurAcquisition) > 0 ? fmtP(pf(p2.valeurAcquisition), 0) + " €" : "—", pf(p2.valeurEstimee) > 0 ? fmtP(pf(p2.valeurEstimee), 0) + " €" : "—", pf(p2.capitalRestant) > 0 ? fmtP(pf(p2.capitalRestant), 0) + " €" : "—"];
      });
      immoRows.push(["TOTAL NET (estimé - CRD)", "", "", "", "", fmtP(Math.round(totalImmoNetPdf), 0) + " €"]);
      y = pdfTable(["Type et adresse", "Propriété", "Année", "Val. achat", "Val. estimée", "Capital dû"], immoRows, [50, 22, 16, 26, 26, 26], y);
      y += 6;

      // Patrimoine financier
      y = sectionH("Patrimoine financier et mobilier", y);
      var totalFinPdf = 0;
      var finRows = patFin.filter(function(p2) { return p2.type; }).map(function(p2) {
        var v = pf(p2.valeur); totalFinPdf += v;
        return [p2.type || "—", p2.proprietaire || "—", p2.etablissement || "—", v > 0 ? fmtP(v, 0) + " €" : "—"];
      });
      finRows.push(["TOTAL", "", "", fmtP(Math.round(totalFinPdf), 0) + " €"]);
      y = pdfTable(["Type", "Propriétaire", "Établissement", "Valeur"], finRows, [40, 35, 50, 40], y);
      y += 8;

      // Synthèse patrimoine total
      var patrimoineTotal = totalImmoNetPdf + totalFinPdf;
      var kw3 = (CW - 8) / 3;
      kpiBox(ML, y, kw3, 20, "Patrimoine immobilier net", fmtP(Math.round(totalImmoNetPdf), 0) + " €", C.accent);
      kpiBox(ML + kw3 + 4, y, kw3, 20, "Épargne financière", fmtP(Math.round(totalFinPdf), 0) + " €", C.orange);
      kpiBox(ML + kw3 * 2 + 8, y, kw3, 20, "Patrimoine total net", fmtP(Math.round(patrimoineTotal), 0) + " €", C.green);

      footer(pg);
    }

    var cleanNom = (nomProjet || "projet").replace(/[\W_]/g, " ").trim().substring(0, 30).replace(/\s+/g, "-").toLowerCase();
    doc.save("dossier-" + cleanNom + ".pdf");
    } catch(e) { console.error("Erreur PDF:", e); alert("Erreur lors de la génération du PDF : " + e.message); }
    // Restaurer l'onglet précédent
    setActiveTab(prevTab);
  };

  const result = useMemo(function() { return calculerSimulation(inputs); }, [inputs]);
  const regime = result.regimes[regimeActif];
  const cashFlowData = useMemo(function() { return projeterCashFlow(inputs, regimeActif, lots); }, [inputs, regimeActif, lots]);
  const note = useMemo(function() { return calculerNote(result, regimeActif); }, [result, regimeActif]);
  const noteColor = getNoteColor(note);
  const noteLabel = getNoteLabel(note);
  const couleurTreso = regime.tresorerie >= 0 ? "#16a34a" : "#f97316";
  const couleur70 = regime.regle70 != null && regime.regle70 < 0.7 ? "#16a34a" : "#ef4444";
  const circumference = 2 * Math.PI * 28;
  const dash = (Math.min(100, Math.max(0, note)) / 100) * circumference;
  const tresoPMois = regime.tresorerie / 12;

  const tabs = [{ id: "params", label: "Paramètres" }, { id: "bilan", label: "Bilan" }, { id: "projection", label: "Projection" }, { id: "comparatif", label: "Comparatif" }, { id: "revente", label: "Revente" }, { id: "dvf", label: "📊 Marché DVF" }];

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
              <InputField label="Frais bancaires (dossier, courtier, garantie)" name="fraisBancairesAchat" value={inputs.fraisBancairesAchat} onChange={handleChange} />
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
                <InputField label="Différé de remboursement" name="differeMois" value={inputs.differeMois} onChange={handleChange} unit="mois" step="1" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 6, background: "rgba(99,102,241,0.06)", borderRadius: 10, padding: "8px 10px" }}>
                <div><div style={{ fontSize: 10, color: "#94a3b8" }}>Total à financer</div><div style={{ fontSize: 13, fontWeight: 700, color: "#4338ca" }}>{fmtEur(result.depenseNette)}</div></div>
                <div><div style={{ fontSize: 10, color: "#94a3b8" }}>Apport</div><div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{fmtEur(pf(inputs.apport))}</div></div>
                <div><div style={{ fontSize: 10, color: "#94a3b8" }}>Reste à financer</div><div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{fmtEur(result.sommeEmpruntee)}</div></div>
                <div><div style={{ fontSize: 10, color: "#94a3b8" }}>Mensualité</div><div style={{ fontSize: 13, fontWeight: 700, color: "#4338ca" }}>{fmtEur(result.mensualite)}</div></div>
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
              <StatRow label="Frais bancaires (dossier, garantie)" value={fmtEur(pf(inputs.fraisBancairesAchat))} />
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
          <div style={SECTION} ref={chartRef}>
            <SectionHeader icon="📉" title={"Cash-Flow sur " + (pf(inputs.dureeAnnees) + 5) + " ans"} badge={regimeActif} />
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>Loyers indexés +1%/an · survole pour le détail</div>
            <CashFlowChart data={cashFlowData} />
          </div>
          <div style={SECTION} ref={enrichChartRef}>
            <SectionHeader icon="🚀" title="Évolution du capital net" badge={regimeActif} />
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>Trésorerie cumulée + Capital remboursé = Enrichissement total</div>
            <EnrichmentChart data={cashFlowData} depenseNette={result.depenseNette} />
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

      {/* Tab: Revente */}
      {activeTab === "revente" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ReventeSimulator inputs={inputs} result={result} regime={regime} regimeActif={regimeActif} cashFlowData={cashFlowData} />
        </div>
      )}

      {activeTab === "dvf" && (
        <DVFErrorBoundary>
          <DVFPanel commune={inputs.commune} inputs={inputs} active={true} />
        </DVFErrorBoundary>
      )}
    </div>
  );
}

// ─── DVF PANEL ────────────────────────────────────────────────────────────────
// ─── ERROR BOUNDARY pour DVFPanel ────────────────────────────────────────────
class DVFErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("DVFPanel crash:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: "rgba(255,255,255,0.7)", borderRadius: 20, padding: 20, border: "1px solid rgba(220,38,38,0.2)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>⚠️ Le panel DVF a rencontré une erreur</div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>{this.state.error && this.state.error.message}</div>
          <button onClick={function() { window.location.reload(); }}
            style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", cursor: "pointer", fontSize: 12 }}>
            🔄 Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


function DVFPanel({ commune, inputs, active }) {
  var _s = React.useState("idle"); var dvfStatus = _s[0]; var setDvfStatus = _s[1];
  var _d = React.useState(null); var dvfData = _d[0]; var setDvfData = _d[1];
  var _e = React.useState(null); var dvfError = _e[0]; var setDvfError = _e[1];

  var COMMUNES_76 = [
    { nom: "Rouen", code: "76540" }, { nom: "Le Havre", code: "76351" },
    { nom: "Dieppe", code: "76217" }, { nom: "Saint-Étienne-du-Rouvray", code: "76575" },
    { nom: "Sotteville-lès-Rouen", code: "76681" }, { nom: "Grand-Quevilly", code: "76322" },
    { nom: "Petit-Quevilly", code: "76498" }, { nom: "Mont-Saint-Aignan", code: "76447" },
    { nom: "Fécamp", code: "76259" }, { nom: "Maromme", code: "76415" },
    { nom: "Yvetot", code: "76757" }, { nom: "Déville-lès-Rouen", code: "76220" },
    { nom: "Harfleur", code: "76340" }, { nom: "Gonfreville-l'Orcher", code: "76305" },
    { nom: "Elbeuf", code: "76231" }, { nom: "Caudebec-lès-Elbeuf", code: "76168" },
    { nom: "Barentin", code: "76057" }, { nom: "Bolbec", code: "76108" },
    { nom: "Lillebonne", code: "76384" }, { nom: "Duclair", code: "76225" },
    { nom: "Bacqueville-en-Caux", code: "76049" }, { nom: "Envermeu", code: "76242" },
    { nom: "Neufchâtel-en-Bray", code: "76461" }, { nom: "Gournay-en-Bray", code: "76307" },
    { nom: "Étretat", code: "76255" }, { nom: "Saint-Valery-en-Caux", code: "76651" },
    { nom: "Eu", code: "76258" }, { nom: "Le Tréport", code: "76717" },
    { nom: "Offranville", code: "76472" }, { nom: "Arques-la-Bataille", code: "76036" },
    { nom: "Pavilly", code: "76495" }, { nom: "Tôtes", code: "76710" },
    { nom: "Luneray", code: "76397" }, { nom: "Clères", code: "76176" },
    { nom: "Montivilliers", code: "76437" }, { nom: "Octeville-sur-Mer", code: "76471" },
    { nom: "Criquetot-l'Esneval", code: "76197" }, { nom: "Saint-Nicolas-d'Aliermont", code: "76601" },
    { nom: "Cany-Barville", code: "76157" },
  ];

  function fmtD(n) { if (n == null || isNaN(n) || n === 0) return "—"; return Math.round(n).toLocaleString("fr-FR"); }

  var found = commune ? COMMUNES_76.find(function(c) {
    return c.nom.toLowerCase() === commune.toLowerCase() || c.nom.toLowerCase().includes(commune.toLowerCase());
  }) : null;

  async function lancerRecherche(codeInsee) {
    setDvfStatus("loading"); setDvfData(null); setDvfError(null);
    try {
      var url = "/api/dvf?code_commune=" + codeInsee;
      var resp = await fetch(url);
      if (!resp.ok) throw new Error("Erreur API (" + resp.status + ")");
      var data = await resp.json();
      if (!data.found) { setDvfStatus("empty"); return; }
      setDvfData(data);
      setDvfStatus("done");
    } catch(e) {
      setDvfError(e.message); setDvfStatus("error");
    }
  }

  React.useEffect(function() {
    if (found && active) lancerRecherche(found.code);
  }, [commune, active]);

  var cardS = { background: "rgba(255,255,255,0.85)", borderRadius: 14, padding: "12px 16px", border: "1px solid rgba(148,163,184,0.18)", boxShadow: "0 2px 8px rgba(99,102,241,0.05)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={SECTION}>
        <SectionHeader icon="📊" title="Données de marché DVF" badge="Open Data DGFiP" />

        {/* Info commune + bouton */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          {!commune && (
            <div style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>
              💡 Renseigne d'abord la commune dans l'onglet <strong>Paramètres</strong>.
            </div>
          )}
          {commune && !found && (
            <div style={{ fontSize: 13, color: "#f97316" }}>
              ⚠️ Commune « {commune} » absente de la liste. Vérifie l'orthographe dans Paramètres.
            </div>
          )}
          {found && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Commune : <strong style={{ color: "#0f172a" }}>{found.nom}</strong>
                <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6, fontFamily: "monospace" }}>INSEE {found.code}</span>
              </div>
              <button onClick={function(){ lancerRecherche(found.code); }}
                style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                {dvfStatus === "loading" ? "⏳ Chargement…" : "🔄 Actualiser"}
              </button>
            </div>
          )}
        </div>

        {dvfStatus === "loading" && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
            <div style={{ fontSize: 13 }}>Chargement des données DVF…</div>
          </div>
        )}

        {dvfStatus === "error" && (
          <div style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
            ⚠️ {dvfError}
          </div>
        )}

        {dvfStatus === "empty" && (
          <div style={{ textAlign: "center", padding: "30px 20px", color: "#94a3b8", fontSize: 13 }}>
            🔍 Aucune donnée DVF disponible pour cette commune.
          </div>
        )}

        {dvfStatus === "done" && dvfData && (function() {
          var d = dvfData;
          var surf = pf(d.prix_appt_m2) > 0 ? pf(d.prix_appt_m2) : null;
          var surfMai = pf(d.prix_maison_m2) > 0 ? pf(d.prix_maison_m2) : null;
          var prixProjetM2 = inputs && pf(inputs.prixVente) > 0 && pf(inputs.surfaceGlobale) > 0
            ? Math.round(pf(inputs.prixVente) / pf(inputs.surfaceGlobale)) : null;

          // Indicateur d'écart vs marché appartement
          var ecartAppt = (prixProjetM2 && surf) ? Math.round((prixProjetM2 - surf) / surf * 100) : null;
          var ecartMai  = (prixProjetM2 && surfMai) ? Math.round((prixProjetM2 - surfMai) / surfMai * 100) : null;
          var ecartColor = function(e) { return e == null ? "#6366f1" : e > 10 ? "#dc2626" : e > 0 ? "#d97706" : "#16a34a"; };
          var ecartLabel = function(e) { return e == null ? "—" : (e > 0 ? "+" : "") + e + "% vs votre projet"; };

          var kpis = [
            { label: "Prix marché appart.", value: surf ? fmtD(surf) + " €/m²" : "—", sub: fmtD(d.nb_ventes_apt) + " ventes", color: "#6366f1", icon: "🏢",
              ecart: ecartAppt },
            { label: "Prix marché maison", value: surfMai ? fmtD(surfMai) + " €/m²" : "—", sub: fmtD(d.nb_ventes_mai) + " ventes", color: "#d97706", icon: "🏡",
              ecart: ecartMai },
            { label: "Volume total ventes", value: fmtD((d.nb_ventes_apt||0) + (d.nb_ventes_mai||0)), sub: "appartements + maisons", color: "#16a34a", icon: "📋", ecart: null },
          ];

          if (prixProjetM2) {
            kpis.push({ label: "Votre prix /m²", value: fmtD(prixProjetM2) + " €/m²", sub: "prix FAI ÷ surface", color: "#0ea5e9", icon: "🎯", ecart: null });
          }

          return (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10, marginBottom: 16 }}>
                {kpis.map(function(k) {
                  return (
                    <div key={k.label} style={Object.assign({}, cardS, { borderTop: "3px solid " + k.color })}>
                      <div style={{ fontSize: 16, marginBottom: 4 }}>{k.icon}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.value}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{k.sub}</div>
                      {k.ecart != null && (
                        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: ecartColor(k.ecart),
                          background: ecartColor(k.ecart) + "15", padding: "2px 7px", borderRadius: 6, display: "inline-block" }}>
                          {ecartLabel(k.ecart)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Analyse positionnement prix */}
              {prixProjetM2 && (surf || surfMai) && (
                <div style={Object.assign({}, cardS, { marginBottom: 12 })}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 10 }}>📍 Positionnement de votre projet vs le marché</div>
                  {surf && (
                    <StatRow label={"Écart vs prix appt. (" + fmtD(surf) + " €/m²)"}
                      value={(ecartAppt > 0 ? "+" : "") + ecartAppt + "%"}
                      color={ecartColor(ecartAppt)} bold={Math.abs(ecartAppt) > 5} />
                  )}
                  {surfMai && (
                    <StatRow label={"Écart vs prix maison (" + fmtD(surfMai) + " €/m²)"}
                      value={(ecartMai > 0 ? "+" : "") + ecartMai + "%"}
                      color={ecartColor(ecartMai)} bold={Math.abs(ecartMai) > 5} border={false} />
                  )}
                </div>
              )}

              <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
                Source : DVF DGFiP — données agrégées Seine-Maritime · Mis à jour 2025
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}


// ─── SIMULATEUR DE REVENTE ────────────────────────────────────────────────────
function ReventeSimulator({ inputs, result, regime, regimeActif, cashFlowData }) {
  var _ra = React.useState({ anneeRevente: "10", prixReventeM2: "", fraisAgenceVente: "5", tauxPlusValueAn: "1.5" });
  var rv = _ra[0]; var setRv = _ra[1];
  var handleRv = function(e) { setRv(function(p) { return Object.assign({}, p, { [e.target.name]: e.target.value }); }); };

  var fS = { width: "100%", background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "7px 10px", color: "#0f172a", fontSize: 13, outline: "none" };
  var lS = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 };

  var anneeR = Math.max(1, Math.round(pf(rv.anneeRevente)));
  var surf = pf(inputs.surfaceGlobale);
  var prixAchat = pf(inputs.prixVente);
  var depenseNette = result.depenseNette;
  var emprunt = result.sommeEmpruntee;

  // Prix de revente
  var prixReventeM2 = pf(rv.prixReventeM2);
  var revalAn = pf(rv.tauxPlusValueAn) / 100;
  var prixReventeEstime = surf > 0 && prixReventeM2 > 0 ? surf * prixReventeM2 : prixAchat * Math.pow(1 + revalAn, anneeR);
  var fraisVente = prixReventeEstime * pf(rv.fraisAgenceVente) / 100;
  var netVendeur = prixReventeEstime - fraisVente;

  // Capital restant dû à l'année de revente
  var tM = pf(inputs.tauxCredit) / 100 / 12;
  var nMois = Math.max(1, pf(inputs.dureeAnnees)) * 12;
  var mensualite = tM === 0 ? emprunt / nMois : (emprunt * tM) / (1 - Math.pow(1 + tM, -nMois));
  var solde = emprunt;
  for (var m = 0; m < Math.min(anneeR * 12, nMois); m++) {
    var intM = solde * tM;
    solde = Math.max(0, solde - (mensualite - intM));
  }
  var capitalRestant = Math.max(0, solde);
  var capitalRembourse = emprunt - capitalRestant;

  // Plus-value et impôt
  var plusValue = Math.max(0, netVendeur - prixAchat - pf(inputs.travaux));
  // Abattements (simplifié) : 6% par an au-delà de la 5ème année (IR), 1.65% (PS)
  var abattIR = anneeR <= 5 ? 0 : anneeR <= 21 ? (anneeR - 5) * 6 : anneeR <= 22 ? 100 : 100;
  var abattPS = anneeR <= 5 ? 0 : anneeR <= 21 ? (anneeR - 5) * 1.65 : anneeR <= 22 ? (16 * 1.65 + 1.6) : anneeR <= 30 ? (16 * 1.65 + 1.6 + (anneeR - 22) * 9) : 100;
  abattIR = Math.min(100, abattIR); abattPS = Math.min(100, abattPS);
  var pvImposableIR = plusValue * (1 - abattIR / 100);
  var pvImposablePS = plusValue * (1 - abattPS / 100);
  var impotPV = pvImposableIR * 0.19 + pvImposablePS * 0.172;
  if (anneeR >= 22) impotPV = pvImposablePS * 0.172; // exonéré IR après 22 ans
  if (anneeR >= 30) impotPV = 0; // exonéré total après 30 ans

  // Cash-flow cumulé
  var cfCumule = 0;
  cashFlowData.slice(0, anneeR).forEach(function(d) { cfCumule += d.cashflow; });

  // Bilan total
  var produitNet = netVendeur - capitalRestant - impotPV;
  var apportInitial = pf(inputs.apport);
  var gainTotal = produitNet + cfCumule - apportInitial;
  var roiSurApport = apportInitial > 0 ? (gainTotal / apportInitial * 100) : 0;
  var triAnnualise = apportInitial > 0 && anneeR > 0 ? ((Math.pow((apportInitial + gainTotal) / apportInitial, 1 / anneeR) - 1) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={SECTION}>
        <SectionHeader icon="🏷️" title="Paramètres de revente" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <div><label style={lS}>Année de revente</label><input type="number" name="anneeRevente" value={rv.anneeRevente} onChange={handleRv} step="1" min="1" style={fS} /></div>
          <div><label style={lS}>Prix revente €/m² (optionnel)</label><input type="number" name="prixReventeM2" value={rv.prixReventeM2} onChange={handleRv} step="50" placeholder={"Auto: " + fmt(Math.round(prixReventeEstime / (surf || 1)), 0)} style={fS} /></div>
          <div><label style={lS}>Revalorisation/an</label><div style={{ display: "flex", gap: 4 }}><input type="number" name="tauxPlusValueAn" value={rv.tauxPlusValueAn} onChange={handleRv} step="0.5" style={fS} /><span style={{ fontSize: 11, color: "#94a3b8", alignSelf: "center" }}>%</span></div></div>
          <div><label style={lS}>Frais d'agence vente</label><div style={{ display: "flex", gap: 4 }}><input type="number" name="fraisAgenceVente" value={rv.fraisAgenceVente} onChange={handleRv} step="0.5" style={fS} /><span style={{ fontSize: 11, color: "#94a3b8", alignSelf: "center" }}>%</span></div></div>
        </div>
      </div>

      {/* Résultats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {[
          { label: "Prix de revente", value: fmtEur(Math.round(prixReventeEstime)), icon: "🏠", color: "#6366f1" },
          { label: "Net vendeur", value: fmtEur(Math.round(netVendeur)), icon: "💶", color: "#16a34a" },
          { label: "Capital restant dû", value: fmtEur(Math.round(capitalRestant)), icon: "🏦", color: "#dc2626" },
          { label: "Impôt plus-value", value: fmtEur(Math.round(impotPV)), icon: "🏛️", color: "#d97706" },
          { label: "Cash-flow cumulé " + anneeR + " ans", value: (cfCumule >= 0 ? "+" : "") + fmtEur(Math.round(cfCumule)), icon: "💰", color: cfCumule >= 0 ? "#16a34a" : "#dc2626" },
          { label: "Gain total net", value: (gainTotal >= 0 ? "+" : "") + fmtEur(Math.round(gainTotal)), icon: "🚀", color: gainTotal >= 0 ? "#16a34a" : "#dc2626" },
        ].map(function(k) {
          return (<div key={k.label} style={{ background: "rgba(255,255,255,0.8)", borderRadius: 14, padding: "10px 12px", border: "1px solid rgba(148,163,184,0.15)", textAlign: "center" }}>
            <div style={{ fontSize: 16, marginBottom: 2 }}>{k.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>{k.label}</div>
          </div>);
        })}
      </div>

      {/* Bilan détaillé */}
      <div style={SECTION}>
        <SectionHeader icon="📋" title={"Bilan de revente à " + anneeR + " ans"} />
        <StatRow label="Prix d'achat initial" value={fmtEur(prixAchat)} />
        <StatRow label={"Prix de revente estimé (année " + anneeR + ")"} value={fmtEur(Math.round(prixReventeEstime))} color="#6366f1" />
        <StatRow label={"Frais d'agence vente (" + rv.fraisAgenceVente + "%)"} value={"−" + fmtEur(Math.round(fraisVente))} color="#dc2626" />
        <StatRow label="Net vendeur" value={fmtEur(Math.round(netVendeur))} bold color="#16a34a" />
        <div style={{ margin: "8px 0", height: 1, background: "rgba(148,163,184,0.15)" }} />
        <StatRow label="Capital remboursé sur " value={fmtEur(Math.round(capitalRembourse))} color="#0ea5e9" />
        <StatRow label="Capital restant dû (à rembourser)" value={"−" + fmtEur(Math.round(capitalRestant))} color="#dc2626" />
        <StatRow label={"Plus-value brute"} value={fmtEur(Math.round(plusValue))} />
        <StatRow label={"Abattement IR (" + fmt(abattIR, 0) + "%) / PS (" + fmt(abattPS, 0) + "%)"} value={anneeR >= 30 ? "Exonéré total" : anneeR >= 22 ? "Exonéré IR" : "Partiel"} color={anneeR >= 22 ? "#16a34a" : "#d97706"} />
        <StatRow label="Impôt sur la plus-value" value={"−" + fmtEur(Math.round(impotPV))} color="#dc2626" />
        <div style={{ margin: "8px 0", height: 1, background: "rgba(148,163,184,0.15)" }} />
        <StatRow label={"Cash-flow cumulé sur " + anneeR + " ans"} value={(cfCumule >= 0 ? "+" : "") + fmtEur(Math.round(cfCumule))} color={cfCumule >= 0 ? "#16a34a" : "#dc2626"} />
        <StatRow label="Apport initial" value={"−" + fmtEur(apportInitial)} color="#64748b" />
        <StatRow label="Produit net (revente − CRD − impôt)" value={fmtEur(Math.round(produitNet))} bold color="#6366f1" />
        <div style={{ margin: "8px 0", height: 2, background: "rgba(99,102,241,0.2)" }} />
        <StatRow label="GAIN TOTAL NET" value={(gainTotal >= 0 ? "+" : "") + fmtEur(Math.round(gainTotal))} bold color={gainTotal >= 0 ? "#16a34a" : "#dc2626"} border={false} />

        {/* KPIs finaux */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
          <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: 14, padding: "12px", textAlign: "center", border: "1px solid rgba(99,102,241,0.15)" }}>
            <div style={{ fontSize: 10, color: "#64748b" }}>ROI sur apport</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: roiSurApport >= 0 ? "#16a34a" : "#dc2626" }}>{fmt(roiSurApport, 0)} %</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>Gain / Apport initial</div>
          </div>
          <div style={{ background: "rgba(22,163,74,0.08)", borderRadius: 14, padding: "12px", textAlign: "center", border: "1px solid rgba(22,163,74,0.15)" }}>
            <div style={{ fontSize: 10, color: "#64748b" }}>TRI annualisé</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: triAnnualise >= 0 ? "#16a34a" : "#dc2626" }}>{fmt(triAnnualise, 1)} %</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>Rendement annuel réel</div>
          </div>
          <div style={{ background: gainTotal >= 0 ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)", borderRadius: 14, padding: "12px", textAlign: "center", border: "1px solid " + (gainTotal >= 0 ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.15)") }}>
            <div style={{ fontSize: 10, color: "#64748b" }}>Gain total net</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: gainTotal >= 0 ? "#16a34a" : "#dc2626" }}>{(gainTotal >= 0 ? "+" : "") + fmtEur(Math.round(gainTotal))}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>Revente + CF − Apport</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD D'ACCUEIL ──────────────────────────────────────────────────────
function Dashboard({ projets, onOuvrir, onNav, user }) {
  // Charger le profil investisseur
  var profil = null;
  try { profil = JSON.parse(localStorage.getItem("radar-immo-profil-v1")); } catch(e) {}

  // Charger les projets SCI
  var sciProjets = [];
  try { sciProjets = JSON.parse(localStorage.getItem("radar-immo-sci-v2")) || []; } catch(e) {}

  // Charger les simulations exploitation
  var exploitProjets = [];
  try { exploitProjets = JSON.parse(localStorage.getItem("radar-immo-exploit-v1")) || []; } catch(e) {}

  // Calculs patrimoine depuis profil
  var totalRevenus = 0, totalCredits = 0, totalImmoNet = 0, totalFin = 0;
  var revenusSalaires = 0, revenusLoyers = 0, revenusAutres = 0;
  if (profil) {
    (profil.revenus || []).forEach(function(r) {
      var m = pf(r.montantAnnuel); totalRevenus += m;
      var t = (r.type || "").toLowerCase();
      if (t.indexOf("loyer") >= 0 || t.indexOf("loc") >= 0) revenusLoyers += m;
      else if (t.indexOf("salaire") >= 0) revenusSalaires += m;
      else revenusAutres += m;
    });
    (profil.credits || []).forEach(function(c) { totalCredits += pf(c.chargeAnnuelle); });
    (profil.patrimoineImmo || []).forEach(function(p) { totalImmoNet += pf(p.valeurEstimee) - pf(p.capitalRestant); });
    (profil.patrimoineFinancier || []).forEach(function(p) { totalFin += pf(p.valeur); });
  }
  // Taux endettement méthode bancaire : charges mensuelles / (salaires + 70% loyers) mensuels
  var revenusRetenus = revenusSalaires + revenusAutres + revenusLoyers * 0.7;
  var tauxEndettement = revenusRetenus > 0 ? (totalCredits / revenusRetenus * 100) : 0;
  var patrimoineTotal = totalImmoNet + totalFin;

  // Score santé financière (0-100)
  var scoreSante = 50;
  if (profil && profil.emprunteurs && profil.emprunteurs[0].nom) {
    scoreSante = 30; // base
    if (tauxEndettement < 35) scoreSante += 25; else if (tauxEndettement < 45) scoreSante += 10;
    if (totalFin > 10000) scoreSante += 15; else if (totalFin > 5000) scoreSante += 8;
    if (patrimoineTotal > 100000) scoreSante += 15; else if (patrimoineTotal > 50000) scoreSante += 8;
    if (totalRevenus > 40000) scoreSante += 15; else if (totalRevenus > 25000) scoreSante += 8;
    scoreSante = Math.min(100, scoreSante);
  }
  var santeColor = scoreSante >= 70 ? "#16a34a" : scoreSante >= 45 ? "#f59e0b" : "#dc2626";
  var santeLabel = scoreSante >= 70 ? "Excellente" : scoreSante >= 45 ? "Correcte" : "À améliorer";
  var santeEmoji = scoreSante >= 70 ? "☀️" : scoreSante >= 45 ? "⛅" : "🌧️";

  var nbProjetsTotal = (projets || []).length + sciProjets.length + exploitProjets.length;
  var derniersProjets = (projets || []).slice(0, 4);

  // Raccourcis outils
  var outils = [
    { id: "analyse", icon: "🗺️", label: "Analyse communes", desc: "Scanner le marché local" },
    { id: "simulation", icon: "📊", label: "Simulation projet", desc: "Étudier un investissement" },
    { id: "exploitation", icon: "🏘️", label: "Mode d'exploitation", desc: "Comparer nu/meublé/coloc/LCD" },
    { id: "credit", icon: "🏦", label: "Simulation crédit", desc: "Calculer ta mensualité" },
    { id: "sci", icon: "🏢", label: "Simulateur SCI", desc: "Projeter ta SCI à l'IS" },
    { id: "profil", icon: "👤", label: "Profil investisseur", desc: "Ta fiche patrimoine" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header bienvenue */}
      <div style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(56,189,248,0.08))", borderRadius: 20, padding: "20px 24px", border: "1px solid rgba(99,102,241,0.12)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
              Bonjour{profil && profil.emprunteurs && profil.emprunteurs[0].prenom ? " " + profil.emprunteurs[0].prenom : ""} 👋
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{nbProjetsTotal} projet{nbProjetsTotal > 1 ? "s" : ""} en cours · Radar Immo 76</div>
          </div>
          {/* Météo investisseur */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.8)", borderRadius: 16, padding: "12px 20px", border: "1px solid rgba(148,163,184,0.15)" }}>
            <div style={{ fontSize: 36 }}>{santeEmoji}</div>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Santé financière</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: santeColor }}>{scoreSante}/100</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: santeColor }}>{santeLabel}</div>
            </div>
            <div style={{ width: 50, height: 50, position: "relative" }}>
              <svg viewBox="0 0 40 40" style={{ width: 50, height: 50 }}>
                <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="4" />
                <circle cx="20" cy="20" r="16" fill="none" stroke={santeColor} strokeWidth="4" strokeDasharray={(scoreSante / 100 * 100.5) + " 100.5"} strokeLinecap="round" transform="rotate(-90 20 20)" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs patrimoine */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {[
          { label: "Revenus annuels", value: totalRevenus > 0 ? fmtEur(totalRevenus) : "Non renseigné", icon: "💶", color: "#16a34a" },
          { label: "Charges crédit/an", value: totalCredits > 0 ? fmtEur(totalCredits) : "—", icon: "🏦", color: "#dc2626" },
          { label: "Taux endettement", value: totalRevenus > 0 ? fmt(tauxEndettement, 1) + " %" : "—", icon: "📊", color: tauxEndettement > 35 ? "#dc2626" : "#16a34a" },
          { label: "Patrimoine net", value: patrimoineTotal > 0 ? fmtEur(patrimoineTotal) : "Non renseigné", icon: "🏠", color: "#4338ca" },
          { label: "Épargne disponible", value: totalFin > 0 ? fmtEur(totalFin) : "—", icon: "💰", color: "#0ea5e9" },
          { label: "Projets en cours", value: String(nbProjetsTotal), icon: "📋", color: "#6366f1" },
        ].map(function(k) {
          return (<div key={k.label} style={{ background: "rgba(255,255,255,0.8)", borderRadius: 14, padding: "10px 12px", border: "1px solid rgba(148,163,184,0.15)", textAlign: "center" }}>
            <div style={{ fontSize: 16, marginBottom: 2 }}>{k.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>{k.label}</div>
          </div>);
        })}
      </div>

      {/* Derniers projets + Raccourcis */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* Derniers projets */}
        <div style={SECTION}>
          <SectionHeader icon="⭐" title="Dernières simulations" />
          {derniersProjets.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 10px", color: "#94a3b8" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Aucun projet pour l'instant</div>
              <button onClick={function() { onNav("simulation"); }} style={{ marginTop: 10, background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 10, padding: "8px 18px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Créer ma première simulation</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {derniersProjets.map(function(p) {
                var cashflow = 0;
                try { var r = calculerSimulation(p.inputs); var reg = r.regimes[p.regimeActif]; cashflow = reg ? reg.tresorerie / 12 : 0; } catch(e) {}
                return (<div key={p.id} onClick={function() { onOuvrir(p); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(248,250,252,0.8)", border: "1px solid rgba(148,163,184,0.12)", cursor: "pointer", transition: "transform 0.1s" }}
                  onMouseEnter={function(e) { e.currentTarget.style.transform = "translateX(4px)"; }}
                  onMouseLeave={function(e) { e.currentTarget.style.transform = ""; }}>
                  {p.coverPhoto ? <img src={p.coverPhoto} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} /> : <div style={{ width: 40, height: 40, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏠</div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nom}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{p.savedAt} · {p.regimeActif}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: cashflow >= 0 ? "#16a34a" : "#dc2626" }}>{(cashflow >= 0 ? "+" : "") + fmt(Math.round(cashflow), 0)} €/m</div>
                    {p.inputs && p.inputs.prixVente && <div style={{ fontSize: 10, color: "#64748b" }}>{fmtEur(pf(p.inputs.prixVente))}</div>}
                  </div>
                </div>);
              })}
              {(projets || []).length > 4 && (
                <button onClick={function() { onNav("favoris"); }} style={{ background: "none", border: "1px dashed rgba(99,102,241,0.3)", borderRadius: 10, padding: "8px", color: "#6366f1", cursor: "pointer", fontSize: 12, fontWeight: 500, textAlign: "center" }}>Voir tous les projets ({(projets || []).length})</button>
              )}
            </div>
          )}
        </div>

        {/* Raccourcis outils */}
        <div style={SECTION}>
          <SectionHeader icon="🧰" title="Outils" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {outils.map(function(o) {
              return (<div key={o.id} onClick={function() { onNav(o.id); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", borderRadius: 12, background: "rgba(248,250,252,0.8)", border: "1px solid rgba(148,163,184,0.12)", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={function(e) { e.currentTarget.style.background = "rgba(99,102,241,0.06)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)"; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = "rgba(248,250,252,0.8)"; e.currentTarget.style.borderColor = "rgba(148,163,184,0.12)"; }}>
                <span style={{ fontSize: 24 }}>{o.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{o.label}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{o.desc}</div>
                </div>
              </div>);
            })}
          </div>
        </div>
      </div>

      {/* Résumé si profil rempli */}
      {profil && profil.emprunteurs && profil.emprunteurs[0].nom && (
        <div style={SECTION}>
          <SectionHeader icon="📊" title="Capacité d'investissement" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            {(function() {
              var revSalaires = 0, revLoyers = 0;
              (profil.revenus || []).forEach(function(r) {
                var t = (r.type || "").toLowerCase();
                if (t.indexOf("loyer") >= 0 || t.indexOf("loc") >= 0) revLoyers += pf(r.montantAnnuel);
                else revSalaires += pf(r.montantAnnuel);
              });
              var loyersRetenus = revLoyers * 0.7;
              var revMensuel = (revSalaires + loyersRetenus) / 12;
              var chargesMens = totalCredits / 12;
              var disponible = Math.max(0, revMensuel * 0.35 - chargesMens);
              var tMo = 0.04 / 12; var nMo = 25 * 12;
              var capacite = disponible > 0 ? disponible * (1 - Math.pow(1 + tMo, -nMo)) / tMo : 0;
              return [
                { label: "Revenus retenus/mois", value: fmtEur(Math.round(revMensuel)), color: "#16a34a" },
                { label: "Charges crédit/mois", value: fmtEur(Math.round(chargesMens)), color: "#dc2626" },
                { label: "Mensualité dispo (35%)", value: fmtEur(Math.round(disponible)), color: "#6366f1" },
                { label: "Capacité emprunt (4%, 25a)", value: fmtEur(Math.round(capacite)), color: "#4338ca" },
              ];
            })().map(function(k) {
              return (<div key={k.label} style={{ background: "rgba(255,255,255,0.8)", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(148,163,184,0.15)" }}>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>{k.label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: k.color, marginTop: 2 }}>{k.value}</div>
              </div>);
            })}
          </div>
        </div>
      )}

      {/* CTA profil si pas rempli */}
      {(!profil || !profil.emprunteurs || !profil.emprunteurs[0].nom) && (
        <div style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(56,189,248,0.06))", borderRadius: 16, padding: "20px", border: "1px dashed rgba(99,102,241,0.25)", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>👤</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Complète ta fiche patrimoine</div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>Renseigne tes revenus, crédits et patrimoine pour voir ta capacité d'investissement et générer un dossier bancaire complet.</div>
          <button onClick={function() { onNav("profil"); }} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 10, padding: "10px 24px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Remplir ma fiche</button>
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
    if (force) { _communesCache = null; _communesCachePromise = null; try { localStorage.removeItem(CACHE_KEY); } catch(e) {} }
    setLoading(true); setError(null);
    getCommunesCache().then(function(list) {
      setCommunes(list); setLoading(false);
    }).catch(function(e) { setError(e.message || "Erreur"); setLoading(false); });
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
  const [rembAnticipeAnnee, setRembAnticipeAnnee] = useState("");
  const [rembAnticipeMontant, setRembAnticipeMontant] = useState("");

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

    // Tableau d'amortissement annuel avec remboursement anticipé
    const raAnnee = Math.round(pf(rembAnticipeAnnee));
    const raMontant = pf(rembAnticipeMontant);
    const tableau = [];
    var solde = M;
    var totalInterets = 0; var totalAssur = 0; var anneesEffectives = D;
    for (var y = 1; y <= D; y++) {
      if (solde <= 0) break;
      var capitalAn = 0; var interetsAn = 0; var assurAn = mensualiteAssur * 12;
      // Remboursement anticipé
      var rembAnticipe = 0;
      if (raAnnee > 0 && raMontant > 0 && y === raAnnee) {
        rembAnticipe = Math.min(raMontant, solde);
        solde = Math.max(0, solde - rembAnticipe);
      }
      for (var m = 0; m < 12; m++) {
        if (solde <= 0) break;
        var intM = solde * tMensuel;
        var capM = Math.min(mensualiteHorsAssur - intM, solde);
        interetsAn += intM;
        capitalAn += capM;
        solde = Math.max(0, solde - capM);
      }
      totalInterets += interetsAn; totalAssur += assurAn;
      tableau.push({ annee: y, capital: capitalAn, interets: interetsAn, assurance: assurAn, rembAnticipe: rembAnticipe, solde: Math.max(0, solde) });
      if (solde <= 0) { anneesEffectives = y; break; }
    }
    var economieInterets = coutTotalHorsAssur - totalInterets;

    return { mensualiteHorsAssur, mensualiteAssur, mensualiteTotale, coutTotalHorsAssur, coutTotalAssur, coutTotal, tableau, anneesEffectives, economieInterets, totalInteretsEffectifs: totalInterets };
  }, [montant, duree, tauxHorsAssurance, tauxAssurance, rembAnticipeAnnee, rembAnticipeMontant]);

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

      {/* Remboursement anticipé */}
      <div style={SECTION}>
        <SectionHeader icon="⚡" title="Simulation de remboursement anticipé" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Année du remboursement</label>
            <input type="number" value={rembAnticipeAnnee} step="1" min="1" max={duree} placeholder="Ex: 10" onChange={function(e) { setRembAnticipeAnnee(e.target.value); }} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Montant remboursé</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" value={rembAnticipeMontant} step="5000" min="0" placeholder="Ex: 50000" onChange={function(e) { setRembAnticipeMontant(e.target.value); }} style={inputStyle} />
              <span style={{ color: "#94a3b8", fontSize: 13, minWidth: 16 }}>€</span>
            </div>
          </div>
          <div>
            {pf(rembAnticipeAnnee) > 0 && pf(rembAnticipeMontant) > 0 && (
              <div style={{ background: "rgba(22,163,74,0.08)", borderRadius: 10, padding: "8px 12px", border: "1px solid rgba(22,163,74,0.2)" }}>
                <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 600 }}>Économie d'intérêts</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>{fmtEur(Math.round(calc.economieInterets))}</div>
                {calc.anneesEffectives < pf(duree) && <div style={{ fontSize: 10, color: "#64748b" }}>Prêt soldé en {calc.anneesEffectives} ans au lieu de {duree}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tableau d'amortissement */}
      <div style={SECTION}>
        <SectionHeader icon="📅" title="Tableau d'amortissement" badge={calc.anneesEffectives + " ans"} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(148,163,184,0.2)" }}>
                {["Année", "Capital remboursé", "Intérêts", "Assurance", "Remb. anticipé", "Mensualité totale", "Capital restant dû"].map(function(h) {
                  return <th key={h} style={{ padding: "8px 10px", textAlign: h === "Année" ? "left" : "right", fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{h}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {calc.tableau.map(function(row, idx) {
                const isEven = idx % 2 === 0;
                const hasRA = row.rembAnticipe > 0;
                return (
                  <tr key={row.annee} style={{ background: hasRA ? "rgba(22,163,74,0.06)" : isEven ? "rgba(248,250,252,0.6)" : "transparent", borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                    <td style={{ padding: "7px 10px", fontWeight: 600, color: "#334155" }}>An {row.annee}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: "#16a34a", fontWeight: 500 }}>{fmt(row.capital, 0)} €</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: "#dc2626" }}>{fmt(row.interets, 0)} €</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: "#f97316" }}>{fmt(row.assurance, 0)} €</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: hasRA ? "#16a34a" : "#94a3b8", fontWeight: hasRA ? 700 : 400 }}>{hasRA ? fmt(row.rembAnticipe, 0) + " €" : "—"}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600, color: "#4338ca" }}>{fmt(row.capital + row.interets + row.assurance, 0)} €</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: row.solde === 0 ? "#16a34a" : "#64748b", fontWeight: row.solde === 0 ? 700 : 400 }}>{row.solde === 0 ? "Soldé ✓" : fmt(row.solde, 0) + " €"}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid rgba(148,163,184,0.3)", background: "rgba(99,102,241,0.05)" }}>
                <td style={{ padding: "10px", fontWeight: 700, color: "#0f172a" }}>Total</td>
                <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>{fmtEur(M)}</td>
                <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{fmtEur(Math.round(calc.totalInteretsEffectifs))}</td>
                <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: "#f97316" }}>{fmtEur(calc.coutTotalAssur)}</td>
                <td style={{ padding: "10px", textAlign: "right" }}></td>
                <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: "#4338ca" }}>{fmtEur(Math.round(M + calc.totalInteretsEffectifs + calc.coutTotalAssur))}</td>
                <td style={{ padding: "10px", textAlign: "right", color: "#16a34a", fontWeight: 700 }}>0 €</td>
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
      const qty = Math.max(1, pf(s.quantite));
      const montant = prix * qty;
      total += montant;
      detail.push({ label: item.label + (qty > 1 ? " ×" + qty : ""), montant: montant });
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
          : showQty === "fixe" ? prix * Math.max(1, pf(s.quantite))
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
          {(showQty === "quantite" || showQty === "fixe") && (
            <td style={{ padding: "10px 12px", textAlign: "center" }}>
              {isActif ? (
                <input type="number" value={s.quantite} min="1" step="1" onChange={function(e) { updateState(setter, item.id, "quantite", e.target.value); }}
                  style={{ width: 50, background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 8, padding: "4px 8px", fontSize: 12, color: "#0f172a", outline: "none", textAlign: "center" }} />
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
              <th style={thStyle("center")}>Qté</th>
              <th style={thStyle("right")}>Prix unit.</th>
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
  var COMPARATIFS_KEY = "radar-immo-comparatifs-v1";
  const [offres, setOffres] = useState(function() {
    try { return JSON.parse(localStorage.getItem(OFFRES_KEY)) || [OFFRE_DEFAULT(1), OFFRE_DEFAULT(2)]; }
    catch(e) { return [OFFRE_DEFAULT(1), OFFRE_DEFAULT(2)]; }
  });
  var _nomComp = useState(""); var nomComparatif = _nomComp[0]; var setNomComparatif = _nomComp[1];
  var _comps = useState(function() { try { return JSON.parse(localStorage.getItem(COMPARATIFS_KEY)) || []; } catch(e) { return []; } });
  var comparatifs = _comps[0]; var setComparatifs = _comps[1];
  var _saveS = useState("idle"); var saveStatusComp = _saveS[0]; var setSaveStatusComp = _saveS[1];

  React.useEffect(function() { cloudLoad("comparatifs_offres").then(function(c) { if (c && c.length > 0) { var loc = []; try { loc = JSON.parse(localStorage.getItem(COMPARATIFS_KEY)) || []; } catch(e) {} if (c.length >= loc.length) { setComparatifs(c); localStorage.setItem(COMPARATIFS_KEY, JSON.stringify(c)); } } }).catch(function() {}); }, []);

  var sauverComparatif = function() {
    if (!nomComparatif.trim()) return;
    var entry = { id: Date.now(), nom: nomComparatif.trim(), offres: offres, savedAt: new Date().toLocaleDateString("fr-FR") };
    var liste = [entry].concat(comparatifs.filter(function(c) { return c.nom !== nomComparatif.trim(); }));
    setComparatifs(liste); localStorage.setItem(COMPARATIFS_KEY, JSON.stringify(liste)); debouncedCloudSave("comparatifs_offres", liste, 1500);
    setSaveStatusComp("saved"); setTimeout(function() { setSaveStatusComp("idle"); }, 3000);
  };
  var chargerComparatif = function(c) { sauver(c.offres); setNomComparatif(c.nom); };
  var supprimerComparatif = function(id) { var liste = comparatifs.filter(function(c) { return c.id !== id; }); setComparatifs(liste); localStorage.setItem(COMPARATIFS_KEY, JSON.stringify(liste)); debouncedCloudSave("comparatifs_offres", liste, 1000); };

  const sauver = function(liste) { setOffres(liste); localStorage.setItem(OFFRES_KEY, JSON.stringify(liste)); debouncedCloudSave("offres", liste, 2000); };
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

      {/* Save/Load comparatifs */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input type="text" value={nomComparatif} onChange={function(e) { setNomComparatif(e.target.value); }} placeholder="Nom du comparatif..." style={{ flex: 1, minWidth: 140, background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "7px 12px", fontSize: 13, outline: "none", color: "#0f172a" }} />
        <button onClick={sauverComparatif} disabled={!nomComparatif.trim()} style={{ background: nomComparatif.trim() ? "linear-gradient(135deg,#6366f1,#38bdf8)" : "rgba(148,163,184,0.3)", border: "none", borderRadius: 10, padding: "8px 16px", color: "#fff", cursor: nomComparatif.trim() ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600 }}>💾 Sauver</button>
        {saveStatusComp === "saved" && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓ Sauvé</span>}
        {comparatifs.length > 0 && comparatifs.slice(0, 5).map(function(c) {
          return (<div key={c.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button onClick={function() { chargerComparatif(c); }} style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#4338ca", cursor: "pointer", fontWeight: 500 }}>{c.nom}</button>
            <button onClick={function() { supprimerComparatif(c.id); }} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 10, padding: "2px" }}>✕</button>
          </div>);
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>{offres.length} offre{offres.length > 1 ? "s" : ""} comparée{offres.length > 1 ? "s" : ""}</div>
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
    differeMois: "0",
    debutLoyerMois: "0",
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

  const differeMois = Math.max(0, Math.round(pf(bien.differeMois)));
  const debutLoyerMois = Math.max(0, Math.round(pf(bien.debutLoyerMois)));

  // Loyers : décalés de debutLoyerMois mois après l'achat
  const tauxReval = pf(bien.tauxRevalorisation) / 100;
  const moisDansAnnee = (anneesDepuisAchat === 0) ? Math.max(0, 12 - moisAchat) : 12;
  // Combien de mois de loyer dans cette année (en tenant compte du décalage)
  var moisDepuisAchatDebut = anneesDepuisAchat * 12; // mois depuis achat au début de l'année
  var moisDepuisAchatFin = moisDepuisAchatDebut + moisDansAnnee;
  var moisLoyerDebut = Math.max(moisDepuisAchatDebut, debutLoyerMois);
  var moisLoyerFin = moisDepuisAchatFin;
  var moisLoyerActifs = Math.max(0, moisLoyerFin - moisLoyerDebut);
  moisLoyerActifs = Math.min(moisLoyerActifs, moisDansAnnee);
  const tauxOccupationEffectif = Math.min(pf(bien.tauxOccupation), moisLoyerActifs);
  const loyersAn = pf(bien.loyerMensuel) * tauxOccupationEffectif
    * Math.pow(1 + tauxReval, anneesDepuisAchat);

  const gestionAn = loyersAn * pf(bien.gestionPct) / 100;
  const assurancePNO = pf(bien.assurancePNOAn) > 0 ? pf(bien.assurancePNOAn) : (pa + tv) * 0.0012;
  const gliAn = pf(bien.gliAn) > 0 ? pf(bien.gliAn) : 0;
  const chargesTotal = pf(bien.chargesAn) + pf(bien.taxeFonciereAn) + assurancePNO
    + gestionAn + pf(bien.provisionTravauxAn) + pf(bien.expertComptableAn) + pf(bien.fraisBancairesAn) + gliAn;
  const provisionGros = pf(bien.provisionGrosTravauxAn);

  // Crédit : mois par mois avec gestion du différé
  var interetsAn = 0, remboursementAn = 0;

  if (M > 0 && duree > 0) {
    // On simule mois par mois depuis le début du crédit
    var solde = M;
    var moisCreditDebut = Math.max(0, (anneeReelle - anneeAchat) * 12 - moisAchat);
    var moisCreditFin = moisCreditDebut + moisDansAnnee;

    // Avancer le solde jusqu'au début de cette année
    for (var mm = 0; mm < moisCreditDebut && solde > 0 && mm < nMois; mm++) {
      var intPre = solde * tMensuel;
      if (mm < differeMois) {
        // Différé : on ne rembourse pas le capital
      } else {
        solde = Math.max(0, solde - (mensualite - intPre));
      }
    }
    // Calculer les remboursements de cette année
    for (var m = moisCreditDebut; m < moisCreditFin && m < nMois; m++) {
      if (solde <= 0) break;
      var intM = solde * tMensuel;
      interetsAn += intM;
      if (m < differeMois) {
        // Différé : on ne paie que les intérêts
        remboursementAn += intM;
      } else {
        remboursementAn += mensualite;
        solde = Math.max(0, solde - (mensualite - intM));
      }
    }
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
  const totalYears = Math.max(dureeMax, 30);
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
    if (i === 0) console.log("[SCI Debug an1]", { anneeReelle, loyersTotal: Math.round(loyersTotal), chargesTotal: Math.round(chargesTotal), remboursementTotal: Math.round(remboursementTotal), isTotal: Math.round(isTotal), tresoConsolidee: Math.round(tresoConsolidee), provisionGrosTotal: Math.round(provisionGrosTotal), nbBiens: biens.length });
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

  var n = rows.length;
  // Compute stacked values per year
  var posMax = 0, negMax = 0;
  rows.forEach(function(r) {
    var pos = r.loyersTotal;
    var charges = r.chargesTotal + r.provisionGrosTotal;
    var credit = r.remboursementTotal;
    var impots = r.isTotal;
    var negStack = charges + credit + impots;
    if (pos > posMax) posMax = pos;
    if (negStack > negMax) negMax = negStack;
    // Include treso curve in range
    if (r.tresoConsolidee > posMax) posMax = r.tresoConsolidee;
    if (r.tresoConsolidee < 0 && Math.abs(r.tresoConsolidee) > negMax) negMax = Math.abs(r.tresoConsolidee);
  });
  posMax = posMax * 1.15 || 1;
  negMax = negMax * 1.15 || 1;
  var range = posMax + negMax;

  var W = 820, H = 360, padL = 62, padR = 14, padT = 14, padB = 44;
  var chartW = W - padL - padR, chartH = H - padT - padB;
  var toY = function(v) { return padT + chartH - ((v + negMax) / range) * chartH; };
  var zeroY = toY(0);
  var colW = chartW / n;
  var gap = Math.max(1, colW * 0.12);
  var bW = colW - gap;
  var cx = function(i) { return padL + i * colW + colW / 2; };

  // Grid
  var step = range > 200000 ? 50000 : range > 100000 ? 25000 : range > 50000 ? 10000 : 5000;
  var gridVals = [];
  for (var g = 0; g <= posMax; g += step) gridVals.push(g);
  for (var gn = -step; gn >= -negMax; gn -= step) gridVals.push(gn);

  var h = hovered !== null ? rows[hovered] : null;
  var ttW = 195, ttH = 168;
  var ttX = hovered !== null ? Math.min(Math.max(cx(hovered) - ttW / 2, padL), W - padR - ttW) : 0;

  var legendItems = [
    { color: "#22c55e", label: "Loyers" },
    { color: "#94a3b8", label: "Charges" },
    { color: "#f59e0b", label: "Crédit" },
    { color: "#ef4444", label: "Impôts (IS)" },
    { color: "#60a5fa", dash: true, label: "Trésorerie" },
  ];

  return (
    <div style={Object.assign({}, SECTION, { marginTop: 0 })}>
      <SectionHeader icon="📊" title={"Projection consolidée SCI — " + n + " ans"} />
      {/* Légende */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 10, paddingLeft: 4 }}>
        {legendItems.map(function(l) {
          return (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#475569", fontWeight: 500 }}>
              {l.dash
                ? <svg width="18" height="10"><line x1="0" y1="5" x2="18" y2="5" stroke={l.color} strokeWidth="2.5" /><circle cx="9" cy="5" r="3.5" fill="white" stroke={l.color} strokeWidth="2" /></svg>
                : <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
              }
              {l.label}
            </div>
          );
        })}
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={"0 0 " + W + " " + H} style={{ width: "100%", minWidth: 580, fontFamily: "system-ui,sans-serif" }}
          onMouseLeave={function() { setHovered(null); }}>
          {/* Background */}
          <rect x={padL} y={padT} width={chartW} height={chartH} fill="#fafbfc" rx={4} />

          {/* Grid */}
          {gridVals.map(function(v) {
            var y = toY(v);
            if (y < padT - 1 || y > padT + chartH + 1) return null;
            return (
              <g key={v}>
                <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke={v === 0 ? "#cbd5e1" : "#e2e8f0"} strokeWidth={v === 0 ? 1.2 : 0.8} />
                <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize={9} fill="#94a3b8">{fmtK(v)}</text>
              </g>
            );
          })}

          {/* Hover highlight */}
          {hovered !== null && (
            <rect x={padL + hovered * colW} y={padT} width={colW} height={chartH} fill="rgba(99,102,241,0.06)" />
          )}

          {/* Stacked bars */}
          {rows.map(function(r, i) {
            var x = padL + i * colW + gap / 2;
            var op = hovered !== null && hovered !== i ? 0.45 : 1;

            // Positive : loyers
            var hLoyers = (r.loyersTotal / range) * chartH;

            // Negative stack : charges, credit, IS
            var charges = r.chargesTotal + r.provisionGrosTotal;
            var credit = r.remboursementTotal;
            var impots = r.isTotal;
            var hCharges = (charges / range) * chartH;
            var hCredit = (credit / range) * chartH;
            var hImpots = (impots / range) * chartH;

            return (
              <g key={i} opacity={op} onMouseEnter={function() { setHovered(i); }} style={{ cursor: "pointer" }}>
                {/* Loyers - au-dessus de zéro */}
                <rect x={x} y={zeroY - hLoyers} width={bW} height={hLoyers} fill="#22c55e" rx={2} />
                {/* Charges - en dessous de zéro */}
                <rect x={x} y={zeroY} width={bW} height={hCharges} fill="#94a3b8" rx={0} />
                {/* Crédit - empilé sous charges */}
                <rect x={x} y={zeroY + hCharges} width={bW} height={hCredit} fill="#f59e0b" rx={0} />
                {/* IS - empilé sous crédit */}
                {hImpots > 0.5 && <rect x={x} y={zeroY + hCharges + hCredit} width={bW} height={hImpots} fill="#ef4444" rx={0} />}
              </g>
            );
          })}

          {/* Cash-flow curve */}
          <polyline
            points={rows.map(function(r, i) { return cx(i) + "," + toY(r.tresoConsolidee); }).join(" ")}
            fill="none" stroke="#60a5fa" strokeWidth={2.5} strokeLinejoin="round" />
          {rows.map(function(r, i) {
            return <circle key={i} cx={cx(i)} cy={toY(r.tresoConsolidee)} r={hovered === i ? 5.5 : 3.5}
              fill="white" stroke="#60a5fa" strokeWidth={2}
              onMouseEnter={function() { setHovered(i); }} style={{ cursor: "pointer" }} />;
          })}

          {/* X axis labels */}
          {rows.map(function(r, i) {
            var show = n <= 15 || i === 0 || (i + 1) % 5 === 0 || i === n - 1;
            return show ? <text key={i} x={cx(i)} y={H - padB + 16} textAnchor="middle" fontSize={9} fill="#94a3b8" fontWeight="500">{r.year}</text> : null;
          })}

          {/* Tooltip */}
          {h !== null && (
            <g>
              <rect x={ttX} y={4} width={ttW} height={ttH} rx={10} fill="rgba(255,255,255,0.97)" stroke="rgba(148,163,184,0.3)" strokeWidth={1} />
              <text x={ttX + 10} y={22} fontSize={12} fontWeight="800" fill="#0f172a">{h.year}</text>
              {[
                { label: "Loyers", value: h.loyersTotal, color: "#22c55e", sign: "+" },
                { label: "Charges", value: h.chargesTotal + h.provisionGrosTotal, color: "#94a3b8", sign: "−" },
                { label: "Crédit", value: h.remboursementTotal, color: "#f59e0b", sign: "−" },
                { label: "IS total", value: h.isTotal, color: "#ef4444", sign: "−" },
                { label: "Trésorerie / an", value: h.tresoConsolidee, color: "#60a5fa", sign: h.tresoConsolidee >= 0 ? "+" : "" },
                { label: "Trésorerie / mois", value: h.tresoConsolidee / 12, color: h.tresoConsolidee >= 0 ? "#16a34a" : "#dc2626", sign: h.tresoConsolidee >= 0 ? "+" : "" },
                { label: "CCA restant", value: h.soldeCCA, color: "#38bdf8", sign: "" },
                { label: "Dividendes nets", value: h.dividendesNets, color: "#7c3aed", sign: "+" },
              ].map(function(row, idx) {
                var yPos = 36 + idx * 17;
                var isSep = idx === 4;
                return (
                  <g key={row.label}>
                    {isSep && <line x1={ttX + 8} y1={yPos - 4} x2={ttX + ttW - 8} y2={yPos - 4} stroke="rgba(148,163,184,0.25)" strokeWidth={0.8} />}
                    <circle cx={ttX + 12} cy={yPos} r={3} fill={row.color} />
                    <text x={ttX + 20} y={yPos + 3.5} fontSize={9.5} fill="#475569">{row.label}</text>
                    <text x={ttX + ttW - 10} y={yPos + 3.5} fontSize={9.5} fontWeight="600" fill={row.color} textAnchor="end">
                      {row.sign}{fmtK(Math.abs(row.value))}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
        </svg>
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
        <BienField vals={bien} onChange={onChange} field="differeMois" label="Différé remboursement" unit="mois" step="1" hint="Période sans remboursement capital" />
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
        <BienField vals={bien} onChange={onChange} field="debutLoyerMois" label="Début loyers (après achat)" unit="mois" step="1" hint="Ex: 6 = loyers à partir du 7e mois" />
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

// ─── SIMULATEUR MODE D'EXPLOITATION ──────────────────────────────────────────
// ─── SIMULATEUR MODE D'EXPLOITATION (MULTI-LOTS) ─────────────────────────────
// ─── SIMULATEUR MODE D'EXPLOITATION (MULTI-LOTS) ─────────────────────────────
function SimulateurExploitation({ simProjets }) {
  var EXPLOIT_KEY = "radar-immo-exploit-v1";
  var _i = React.useState({
    prixAchat: "", commune: "",
    taxeFonciere: "", chargesAn: "", assurancePNO: "",
    tauxCredit: "4.2", dureeCredit: "25", apport: "", fraisNotaire: "",
    travaux: "", fraisBancaires: "",
  });
  var inputs = _i[0]; var setInputs = _i[1];
  var _lots = React.useState([
    { id: 1, nom: "Lot 1", surface: "", nbChambres: "1", loyerNuMarche: "", mode: "nu" },
  ]);
  var lots = _lots[0]; var setLots = _lots[1];

  // Import from simulation projet
  var importerProjet = function(p) {
    var inp = p.inputs || {};
    setInputs({
      prixAchat: inp.prixVente || "", commune: inp.commune || "",
      taxeFonciere: inp.taxeFonciereAn || "", chargesAn: inp.chargesImmeubleAn || "",
      assurancePNO: inp.assurancePNOAn || "",
      tauxCredit: inp.tauxCredit || "4.2", dureeCredit: inp.dureeAnnees || "25",
      apport: inp.apport || "", fraisNotaire: inp.fraisNotaire || "",
      travaux: inp.travaux || "", fraisBancaires: inp.fraisBancairesAchat || "",
    });
    // Importer les lots
    var newLots = (p.lots || []).map(function(l, idx) {
      return { id: idx + 1, nom: l.nom || "Lot " + (idx + 1), surface: l.surface || "", nbChambres: "1", loyerNuMarche: l.loyer || "", mode: "nu" };
    });
    if (newLots.length === 0) newLots = [{ id: 1, nom: "Lot 1", surface: inp.surfaceGlobale || "", nbChambres: "1", loyerNuMarche: inp.loyerMensuelHC || "", mode: "nu" }];
    setLots(newLots);
    setNomSimu(p.nom || "");
    if (inp.commune) {
      setCommuneSearch(inp.commune);
      getCommunesCache().then(function(c) { var f = c.find(function(x) { return x.nom === inp.commune; }); if (f) setDonneesCommune(f); });
    }
  };
  var lots = _lots[0]; var setLots = _lots[1];
  var _dc = React.useState(null); var donneesCommune = _dc[0]; var setDonneesCommune = _dc[1];
  var _cs = React.useState(""); var communeSearch = _cs[0]; var setCommuneSearch = _cs[1];
  var _sugg = React.useState([]); var suggestions = _sugg[0]; var setSuggestions = _sugg[1];
  var _view = React.useState("lots"); var view = _view[0]; var setView = _view[1];
  var _nom = React.useState(""); var nomSimu = _nom[0]; var setNomSimu = _nom[1];
  var _projets = React.useState(function() { try { return JSON.parse(localStorage.getItem(EXPLOIT_KEY)) || []; } catch(e) { return []; } });
  var projets = _projets[0]; var setProjets = _projets[1];
  var _saveStatus = React.useState("idle"); var saveStatus = _saveStatus[0]; var setSaveStatus = _saveStatus[1];

  React.useEffect(function() { cloudLoad("exploit_projets").then(function(c) { if (c && c.length > 0) { var local = []; try { local = JSON.parse(localStorage.getItem(EXPLOIT_KEY)) || []; } catch(e) {} if (c.length >= local.length) { setProjets(c); localStorage.setItem(EXPLOIT_KEY, JSON.stringify(c)); } } }).catch(function() {}); }, []);

  var sauvegarder = function() {
    if (!nomSimu.trim()) return;
    var entry = { id: Date.now(), nom: nomSimu.trim(), inputs: inputs, lots: lots, commune: inputs.commune, savedAt: new Date().toLocaleDateString("fr-FR") };
    var liste = [entry].concat(projets.filter(function(p) { return p.nom !== nomSimu.trim(); }));
    setProjets(liste); localStorage.setItem(EXPLOIT_KEY, JSON.stringify(liste)); debouncedCloudSave("exploit_projets", liste, 1500);
    setSaveStatus("saved"); setTimeout(function() { setSaveStatus("idle"); }, 3000);
  };
  var charger = function(p) { setInputs(p.inputs); setLots(p.lots); setNomSimu(p.nom); if (p.commune) { setCommuneSearch(p.commune); getCommunesCache().then(function(c) { var f = c.find(function(x) { return x.nom === p.commune; }); if (f) setDonneesCommune(f); }); } };
  var supprimer = function(id) { var liste = projets.filter(function(p) { return p.id !== id; }); setProjets(liste); localStorage.setItem(EXPLOIT_KEY, JSON.stringify(liste)); debouncedCloudSave("exploit_projets", liste, 1000); };

  var handleChange = function(e) { var n = e.target.name; var v = e.target.value; setInputs(function(p) { var next = Object.assign({}, p, { [n]: v }); if (n === "prixAchat" && pf(v) > 0) next.fraisNotaire = String(Math.round(pf(v) * 0.085)); return next; }); };
  var fS = { width: "100%", background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "6px 8px", color: "#0f172a", fontSize: 12, outline: "none", boxSizing: "border-box" };
  var lS = { display: "block", fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 2 };

  // Commune autocomplete
  React.useEffect(function() {
    if (!communeSearch || communeSearch.length < 2) { setSuggestions([]); return; }
    getCommunesCache().then(function(c) { setSuggestions(c.filter(function(x) { return x.nom.toLowerCase().includes(communeSearch.toLowerCase()); }).slice(0, 5)); });
  }, [communeSearch]);
  var selectCommune = function(nom) {
    setCommuneSearch(nom); setSuggestions([]);
    setInputs(function(p) { return Object.assign({}, p, { commune: nom }); });
    getCommunesCache().then(function(c) { var f = c.find(function(x) { return x.nom === nom; }); if (f) setDonneesCommune(f); });
  };

  var tauxEtu = donneesCommune && donneesCommune.demographie ? pf(donneesCommune.demographie.taux_etudiants_pct) : 0;
  var pop = donneesCommune ? pf(donneesCommune.population) : 0;

  // Lot management
  var addLot = function() { var nid = lots.length > 0 ? Math.max.apply(null, lots.map(function(l) { return l.id; })) + 1 : 1; setLots(function(p) { return p.concat({ id: nid, nom: "Lot " + nid, surface: "30", nbChambres: "1", loyerNuMarche: "400", mode: "nu" }); }); };
  var removeLot = function(id) { if (lots.length <= 1) return; setLots(function(p) { return p.filter(function(l) { return l.id !== id; }); }); };
  var updateLot = function(id, f, v) { setLots(function(p) { return p.map(function(l) { return l.id === id ? Object.assign({}, l, { [f]: v }) : l; }); }); };

  // Globals
  var prix = pf(inputs.prixAchat);
  var depenseNette = prix + pf(inputs.fraisNotaire) + pf(inputs.travaux) + pf(inputs.fraisBancaires);
  var emprunt = depenseNette - pf(inputs.apport);
  var tM = pf(inputs.tauxCredit) / 100 / 12;
  var nMo = Math.max(1, pf(inputs.dureeCredit)) * 12;
  var mensualite = tM === 0 ? emprunt / nMo : (emprunt * tM) / (1 - Math.pow(1 + tM, -nMo));
  var creditAn = mensualite * 12;
  var chargesBaseAn = pf(inputs.taxeFonciere) + pf(inputs.chargesAn) + pf(inputs.assurancePNO);

  var MODES = {
    nu: { nom: "Location nue", icon: "🏠", color: "#6366f1", badge: "Classique", occup: 11.5, major: 1, chargesM2: 0, mobilierM2: 0, gliPct: 3, risque: 2, gestion: 1 },
    meuble: { nom: "Meublé LMNP", icon: "🛋️", color: "#0ea5e9", badge: "Optimisé", occup: 11, major: 1.2, chargesM2: 4, mobilierM2: 80, gliPct: 3.5, risque: 3, gestion: 2 },
    coloc: { nom: "Colocation", icon: "👥", color: "#22c55e", badge: "Rendement+", occup: 10.5, major: 1, chargesM2: 15, mobilierM2: 60, gliPct: 4, risque: 4, gestion: 3 },
    lcd: { nom: "Courte durée", icon: "✈️", color: "#f59e0b", badge: "Max rdt", occup: 8, major: 2.2, chargesM2: 30, mobilierM2: 120, gliPct: 0, risque: 5, gestion: 5 },
  };

  // Compute per lot
  function calcLot(lot) {
    var m = MODES[lot.mode] || MODES.nu;
    var s = pf(lot.surface); var ch = Math.max(1, Math.round(pf(lot.nbChambres)));
    var loyerNu = pf(lot.loyerNuMarche);
    var loyerMois;
    if (lot.mode === "coloc") loyerMois = Math.round(ch * loyerNu * 0.55);
    else if (lot.mode === "lcd") loyerMois = Math.round(loyerNu * m.major); // LCD = loyer nu × 2.2
    else loyerMois = Math.round(loyerNu * m.major);
    var loyerAn = loyerMois * m.occup;
    var chSpec = s * m.chargesM2; var gli = loyerAn * m.gliPct / 100;
    return Object.assign({}, lot, { modeInfo: m, loyerMois: loyerMois, loyerAn: loyerAn, chargesSpec: chSpec, gliAn: gli, totalCh: chSpec + gli, mobilier: Math.round(s * m.mobilierM2) });
  }
  var lotsR = lots.map(calcLot);
  var totalLoyerMois = lotsR.reduce(function(s, l) { return s + l.loyerMois; }, 0);
  var totalLoyerAn = lotsR.reduce(function(s, l) { return s + l.loyerAn; }, 0);
  var totalChLots = lotsR.reduce(function(s, l) { return s + l.totalCh; }, 0);
  var totalChAn = chargesBaseAn + totalChLots;
  var cfAn = totalLoyerAn - totalChAn - creditAn;
  var cfMois = cfAn / 12;
  var rdtBrut = depenseNette > 0 ? (totalLoyerAn / depenseNette * 100) : 0;
  var totalSurf = lotsR.reduce(function(s, l) { return s + pf(l.surface); }, 0);
  var totalMob = lotsR.reduce(function(s, l) { return s + l.mobilier; }, 0);

  // Compare all modes for all lots combined (pour le radar + cartes)
  function calcAllModesForLots(modeId) {
    var m = MODES[modeId];
    var tLoy = 0, tCh = 0, tMob = 0;
    lots.forEach(function(lot) {
      var s = pf(lot.surface); var ch = Math.max(1, Math.round(pf(lot.nbChambres)));
      var loyerNu = pf(lot.loyerNuMarche);
      var loyerMois = modeId === "coloc" ? Math.round(ch * loyerNu * 0.55) : Math.round(loyerNu * m.major);
      var loyerAn = loyerMois * m.occup;
      tLoy += loyerAn; tCh += s * m.chargesM2 + loyerAn * m.gliPct / 100; tMob += Math.round(s * m.mobilierM2);
    });
    var totalC = chargesBaseAn + tCh;
    var cf = tLoy - totalC - creditAn;
    return { id: modeId, nom: m.nom, icon: m.icon, color: m.color, badge: m.badge, loyerAn: tLoy, loyerMois: Math.round(tLoy / 12), totalCh: totalC, cfAn: cf, cfMois: cf / 12, rdtBrut: depenseNette > 0 ? tLoy / depenseNette * 100 : 0, rdtNet: depenseNette > 0 ? cf / depenseNette * 100 : 0, mobilier: tMob, risque: m.risque, gestion: m.gestion };
  }
  var compareAll = Object.keys(MODES).map(calcAllModesForLots);
  var bestCF = compareAll.reduce(function(a, b) { return b.cfAn > a.cfAn ? b : a; });

  // Radar
  function Radar() {
    var axes = ["Rendement", "Cash-flow", "Simplicité", "Sécurité", "Fiscalité"];
    var cx2 = 110, cy2 = 95, R2 = 70, aStep = (2 * Math.PI) / 5;
    function pt(i, v) { var a = -Math.PI / 2 + i * aStep; return { x: cx2 + Math.cos(a) * (v / 10) * R2, y: cy2 + Math.sin(a) * (v / 10) * R2 }; }
    var maxR = Math.max.apply(null, compareAll.map(function(r) { return r.rdtBrut; })) || 1;
    var maxCF = Math.max.apply(null, compareAll.map(function(r) { return Math.max(1, r.cfMois); })) || 1;
    return (
      <svg viewBox="0 0 220 190" style={{ width: "100%", maxWidth: 320, fontFamily: "system-ui" }}>
        {[2,4,6,8,10].map(function(lev) { var pts = axes.map(function(_, i) { var p = pt(i, lev); return p.x + "," + p.y; }).join(" "); return <polygon key={lev} points={pts} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth={0.5} />; })}
        {axes.map(function(ax, i) { var p = pt(i, 10); var pl = pt(i, 12); return (<g key={ax}><line x1={cx2} y1={cy2} x2={p.x} y2={p.y} stroke="rgba(148,163,184,0.2)" strokeWidth={0.5} /><text x={pl.x} y={pl.y + 3} textAnchor="middle" fontSize={8} fill="#64748b" fontWeight="600">{ax}</text></g>); })}
        {compareAll.map(function(r) {
          var vals = [Math.min(10, r.rdtBrut / maxR * 10), Math.min(10, Math.max(0, r.cfMois) / maxCF * 10), (6 - r.gestion) * 2, (6 - r.risque) * 2, r.id === "meuble" ? 9 : r.id === "nu" ? 4 : r.id === "coloc" ? 7 : 5];
          return <polygon key={r.id} points={vals.map(function(v, i) { var p = pt(i, v); return p.x + "," + p.y; }).join(" ")} fill={r.color + "20"} stroke={r.color} strokeWidth={1.5} />;
        })}
      </svg>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Save bar + Import */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input type="text" value={nomSimu} onChange={function(e) { setNomSimu(e.target.value); }} placeholder="Nom de la simulation..." style={{ flex: 1, minWidth: 140, background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "7px 12px", fontSize: 13, outline: "none", color: "#0f172a" }} />
        <button onClick={sauvegarder} disabled={!nomSimu.trim()} style={{ background: nomSimu.trim() ? "linear-gradient(135deg,#6366f1,#38bdf8)" : "rgba(148,163,184,0.3)", border: "none", borderRadius: 10, padding: "8px 16px", color: "#fff", cursor: nomSimu.trim() ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600 }}>💾 Sauver</button>
        {saveStatus === "saved" && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓ Sauvé</span>}
        {projets.length > 0 && projets.slice(0, 4).map(function(p) {
          return (<div key={p.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button onClick={function() { charger(p); }} style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#4338ca", cursor: "pointer", fontWeight: 500 }}>{p.nom}</button>
            <button onClick={function() { supprimer(p.id); }} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 10, padding: "2px" }}>✕</button>
          </div>);
        })}
      </div>
      {/* Import depuis simulation projet */}
      {(simProjets || []).length > 0 && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>📥 Importer un projet :</span>
          {(simProjets || []).slice(0, 6).map(function(p) {
            return (<button key={p.id} onClick={function() { importerProjet(p); }} style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#16a34a", cursor: "pointer", fontWeight: 500 }}>{p.nom}</button>);
          })}
        </div>
      )}

      {/* KPIs globaux */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
        {[
          { label: "Loyers/mois", value: fmtEur(totalLoyerMois), icon: "💶", color: "#16a34a" },
          { label: "Cash-flow/mois", value: (cfMois >= 0 ? "+" : "") + fmtEur(Math.round(cfMois)), icon: "💰", color: cfMois >= 0 ? "#16a34a" : "#dc2626" },
          { label: "Rdt brut", value: fmtPct(rdtBrut), icon: "📊", color: "#6366f1" },
          { label: "Mobilier", value: totalMob > 0 ? fmtEur(totalMob) : "—", icon: "🛒", color: "#0ea5e9" },
          { label: lots.length + " lots · " + fmt(totalSurf, 0) + " m²", value: fmtEur(Math.round(mensualite)) + "/mois", icon: "🏦", color: "#64748b" },
        ].map(function(k) {
          return (<div key={k.label} style={{ background: "rgba(255,255,255,0.8)", borderRadius: 12, padding: "8px 10px", border: "1px solid rgba(148,163,184,0.15)", textAlign: "center" }}>
            <div style={{ fontSize: 14, marginBottom: 1 }}>{k.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>{k.label}</div>
          </div>);
        })}
      </div>

      {/* Tabs : Lots / Comparer */}
      <div style={{ display: "flex", gap: 6 }}>
        {[{ id: "lots", label: "🏘️ Lots & Paramètres" }, { id: "compare", label: "⚖️ Comparer tous les modes" }].map(function(t) {
          var isA = view === t.id;
          return (<button key={t.id} onClick={function() { setView(t.id); }} style={{ padding: "8px 16px", borderRadius: 10, border: isA ? "2px solid #6366f1" : "1px solid rgba(148,163,184,0.3)", background: isA ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.7)", color: isA ? "#4338ca" : "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t.label}</button>);
        })}
      </div>

      {view === "lots" && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14 }}>
          {/* Colonne gauche : Paramètres compact */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={SECTION}>
              <SectionHeader icon="🏠" title="Bien" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                {[["Prix FAI", "prixAchat"], ["Frais notaire", "fraisNotaire"], ["Travaux", "travaux"], ["Frais bancaires", "fraisBancaires"], ["Apport", "apport"], ["Taxe foncière", "taxeFonciere"], ["Charges/an", "chargesAn"], ["Assurance PNO", "assurancePNO"]].map(function(f) {
                  return (<div key={f[1]}><label style={lS}>{f[0]}</label><input type="number" name={f[1]} value={inputs[f[1]]} onChange={handleChange} step="100" style={fS} /></div>);
                })}
                <div><label style={lS}>Taux crédit (%)</label><input type="number" name="tauxCredit" value={inputs.tauxCredit} onChange={handleChange} step="0.05" style={fS} /></div>
                <div><label style={lS}>Durée (ans)</label><input type="number" name="dureeCredit" value={inputs.dureeCredit} onChange={handleChange} step="1" style={fS} /></div>
              </div>
            </div>
            {/* Commune */}
            <div style={SECTION}>
              <SectionHeader icon="📍" title="Commune" />
              <div style={{ position: "relative", marginBottom: 6 }}>
                <input type="text" value={communeSearch} onChange={function(e) { setCommuneSearch(e.target.value); }} placeholder="Rechercher..." style={fS} />
                {suggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 20, maxHeight: 150, overflowY: "auto", border: "1px solid rgba(148,163,184,0.2)" }}>
                    {suggestions.map(function(c) { return (<div key={c.nom} onClick={function() { selectCommune(c.nom); }} style={{ padding: "6px 10px", cursor: "pointer", fontSize: 11, borderBottom: "1px solid rgba(148,163,184,0.08)" }}>{c.nom}</div>); })}
                  </div>
                )}
              </div>
              {donneesCommune && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 11 }}>
                  <div style={{ background: "rgba(248,250,252,0.8)", borderRadius: 6, padding: "4px 6px" }}><span style={{ color: "#94a3b8" }}>Pop.</span> <b>{fmt(pop, 0)}</b></div>
                  <div style={{ background: "rgba(248,250,252,0.8)", borderRadius: 6, padding: "4px 6px" }}><span style={{ color: "#94a3b8" }}>Étudiants</span> <b style={{ color: tauxEtu > 5 ? "#16a34a" : "#64748b" }}>{tauxEtu > 0 ? tauxEtu + "%" : "—"}</b></div>
                  <div style={{ background: "rgba(248,250,252,0.8)", borderRadius: 6, padding: "4px 6px" }}><span style={{ color: "#94a3b8" }}>Tension</span> <b>{donneesCommune.demographie && donneesCommune.demographie.tension_locative_pct != null ? donneesCommune.demographie.tension_locative_pct + "%" : "—"}</b></div>
                  <div style={{ background: "rgba(248,250,252,0.8)", borderRadius: 6, padding: "4px 6px" }}><span style={{ color: "#94a3b8" }}>Score</span> <b>{donneesCommune.scores ? donneesCommune.scores.global.toFixed(1) + "/10" : "—"}</b></div>
                  {tauxEtu > 5 && <div style={{ gridColumn: "1/-1", background: "rgba(22,163,74,0.08)", borderRadius: 6, padding: "4px 6px", color: "#16a34a", fontWeight: 500 }}>✓ Favorable colocation</div>}
                  {pop > 0 && pop < 2000 && <div style={{ gridColumn: "1/-1", background: "rgba(220,38,38,0.08)", borderRadius: 6, padding: "4px 6px", color: "#dc2626", fontWeight: 500 }}>⚠ LCD risquée (petite commune)</div>}
                </div>
              )}
            </div>
          </div>

          {/* Colonne droite : Lots */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>Lots ({lots.length})</span>
              <button onClick={addLot} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 8, padding: "5px 12px", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>+ Lot</button>
            </div>
            {lotsR.map(function(lot, idx) {
              var m = lot.modeInfo;
              return (<div key={lot.id} style={{ background: "rgba(255,255,255,0.85)", borderRadius: 14, padding: "10px 12px", border: "2px solid " + m.color + "30" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>#{idx + 1}</div>
                    <input value={lot.nom} onChange={function(e) { updateLot(lot.id, "nom", e.target.value); }} style={{ fontWeight: 600, fontSize: 12, color: "#0f172a", background: "transparent", border: "none", outline: "none", borderBottom: "1px dashed " + m.color, maxWidth: 100 }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#16a34a" }}>{fmtEur(lot.loyerMois)}/m</span>
                    <button onClick={function() { removeLot(lot.id); }} style={{ background: "rgba(220,38,38,0.08)", border: "none", borderRadius: 5, padding: "2px 6px", color: "#dc2626", cursor: lots.length > 1 ? "pointer" : "not-allowed", fontSize: 10, opacity: lots.length > 1 ? 1 : 0.3 }}>✕</button>
                  </div>
                </div>
                {/* Mode buttons */}
                <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
                  {Object.entries(MODES).map(function(e) { var mId = e[0]; var mm = e[1]; var isA = lot.mode === mId;
                    return (<button key={mId} onClick={function() { updateLot(lot.id, "mode", mId); }} style={{ flex: 1, padding: "4px 2px", borderRadius: 6, border: isA ? "2px solid " + mm.color : "1px solid rgba(148,163,184,0.2)", background: isA ? mm.color + "12" : "transparent", cursor: "pointer", fontSize: 9, fontWeight: 600, color: isA ? mm.color : "#94a3b8" }}>{mm.icon} {mm.nom.split(" ")[0]}</button>);
                  })}
                </div>
                {/* Fields */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                  <div><label style={lS}>Surface</label><input type="number" value={lot.surface} step="1" onChange={function(e) { updateLot(lot.id, "surface", e.target.value); }} style={fS} /></div>
                  <div><label style={lS}>{lot.mode === "coloc" ? "Chambres" : "Pièces"}</label><input type="number" value={lot.nbChambres} step="1" onChange={function(e) { updateLot(lot.id, "nbChambres", e.target.value); }} style={fS} /></div>
                  <div><label style={lS}>Loyer nu</label><input type="number" value={lot.loyerNuMarche} step="50" onChange={function(e) { updateLot(lot.id, "loyerNuMarche", e.target.value); }} style={fS} /></div>
                </div>
              </div>);
            })}
            {/* Synthèse tableau */}
            <div style={{ background: "rgba(255,255,255,0.85)", borderRadius: 12, padding: 10, border: "1px solid rgba(148,163,184,0.15)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ borderBottom: "2px solid rgba(148,163,184,0.15)" }}>
                  {["Lot", "Mode", "m²", "Loyer/m", "Loyer/an", "Charges", "Mobilier"].map(function(h) { return <th key={h} style={{ padding: "4px 4px", textAlign: h === "Lot" ? "left" : "center", fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>{h}</th>; })}
                </tr></thead>
                <tbody>
                  {lotsR.map(function(l) { var m = l.modeInfo; return (<tr key={l.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                    <td style={{ padding: "3px 4px", fontWeight: 600, fontSize: 10 }}>{l.nom}</td>
                    <td style={{ textAlign: "center" }}><span style={{ fontSize: 9, color: m.color, fontWeight: 600 }}>{m.icon}</span></td>
                    <td style={{ textAlign: "center", fontSize: 10 }}>{l.surface}</td>
                    <td style={{ textAlign: "center", fontWeight: 600, color: "#16a34a", fontSize: 10 }}>{fmtEur(l.loyerMois)}</td>
                    <td style={{ textAlign: "center", fontSize: 10 }}>{fmtEur(Math.round(l.loyerAn))}</td>
                    <td style={{ textAlign: "center", color: "#dc2626", fontSize: 10 }}>{fmtEur(Math.round(l.totalCh))}</td>
                    <td style={{ textAlign: "center", fontSize: 10 }}>{l.mobilier > 0 ? fmtEur(l.mobilier) : "—"}</td>
                  </tr>); })}
                  <tr style={{ borderTop: "2px solid rgba(148,163,184,0.2)", background: "rgba(99,102,241,0.04)" }}>
                    <td style={{ padding: "4px", fontWeight: 700, color: "#4338ca", fontSize: 10 }}>TOTAL</td><td></td>
                    <td style={{ textAlign: "center", fontWeight: 600, fontSize: 10 }}>{fmt(totalSurf, 0)}</td>
                    <td style={{ textAlign: "center", fontWeight: 700, color: "#16a34a", fontSize: 10 }}>{fmtEur(totalLoyerMois)}</td>
                    <td style={{ textAlign: "center", fontWeight: 600, fontSize: 10 }}>{fmtEur(Math.round(totalLoyerAn))}</td>
                    <td style={{ textAlign: "center", fontWeight: 600, color: "#dc2626", fontSize: 10 }}>{fmtEur(Math.round(totalChLots))}</td>
                    <td style={{ textAlign: "center", fontWeight: 600, fontSize: 10 }}>{totalMob > 0 ? fmtEur(totalMob) : "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === "compare" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 4 cartes comparatives */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {compareAll.map(function(r) {
              var isBest = r.id === bestCF.id;
              return (<div key={r.id} style={{ background: "rgba(255,255,255,0.85)", borderRadius: 16, overflow: "hidden", border: isBest ? "2px solid " + r.color : "1px solid rgba(148,163,184,0.15)", position: "relative" }}>
                {isBest && <div style={{ background: r.color, color: "#fff", fontSize: 9, fontWeight: 700, textAlign: "center", padding: "2px 0" }}>⭐ MEILLEUR CASH-FLOW</div>}
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>{r.icon}</span>
                    <div><div style={{ fontSize: 13, fontWeight: 800 }}>{r.nom}</div><span style={{ fontSize: 9, fontWeight: 600, color: r.color, background: r.color + "15", padding: "1px 6px", borderRadius: 5 }}>{r.badge}</span></div>
                  </div>
                  {[
                    { l: "Loyers/mois", v: fmtEur(r.loyerMois), c: "#16a34a" },
                    { l: "Charges/an", v: fmtEur(Math.round(r.totalCh)), c: "#dc2626" },
                    { l: "Cash-flow/mois", v: (r.cfMois >= 0 ? "+" : "") + fmtEur(Math.round(r.cfMois)), c: r.cfMois >= 0 ? "#16a34a" : "#dc2626", big: true },
                    { l: "Rdt brut", v: fmtPct(r.rdtBrut), c: r.color },
                    { l: "Rdt net", v: fmtPct(r.rdtNet), c: r.rdtNet >= 0 ? "#16a34a" : "#dc2626" },
                  ].map(function(k) { return (<div key={k.l} style={{ display: "flex", justifyContent: "space-between", fontSize: k.big ? 13 : 11, marginBottom: k.big ? 4 : 1 }}><span style={{ color: "#64748b" }}>{k.l}</span><span style={{ fontWeight: k.big ? 700 : 600, color: k.c, fontSize: k.big ? 15 : 11 }}>{k.v}</span></div>); })}
                  {r.mobilier > 0 && <div style={{ marginTop: 4, fontSize: 10, color: "#64748b", background: "rgba(248,250,252,0.8)", borderRadius: 6, padding: "3px 6px" }}>🛒 Mobilier : {fmtEur(r.mobilier)}</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                    {[{ l: "Risque", v: r.risque }, { l: "Gestion", v: r.gestion }].map(function(b) {
                      var bc = b.v <= 2 ? "#16a34a" : b.v <= 3 ? "#f59e0b" : "#dc2626";
                      return (<div key={b.l}><div style={{ fontSize: 9, color: "#94a3b8" }}>{b.l} {b.v}/5</div><div style={{ height: 4, background: "rgba(148,163,184,0.15)", borderRadius: 99 }}><div style={{ width: (b.v / 5 * 100) + "%", height: "100%", background: bc, borderRadius: 99 }} /></div></div>);
                    })}
                  </div>
                </div>
              </div>);
            })}
          </div>
          {/* Radar + légende */}
          <div style={SECTION}>
            <SectionHeader icon="📊" title="Comparaison radar (tous lots en un seul mode)" />
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <Radar />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {compareAll.map(function(r) { return (<div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: r.color }} /><b>{r.nom}</b><span style={{ color: "#64748b" }}>CF : {(r.cfMois >= 0 ? "+" : "") + fmt(Math.round(r.cfMois), 0)} €/m</span></div>); })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SUIVI PORTFOLIO ──────────────────────────────────────────────────────────
function SuiviPortfolio({ simProjets }) {
  var PORTFOLIO_KEY = "radar-immo-portfolio-v1";
  var _b = React.useState(function() { try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY)) || []; } catch(e) { return []; } });
  var biens = _b[0]; var setBiens = _b[1];
  var _sel = React.useState(null); var selected = _sel[0]; var setSelected = _sel[1];

  React.useEffect(function() { cloudLoad("portfolio").then(function(c) { if (c && c.length > 0) { var loc = []; try { loc = JSON.parse(localStorage.getItem(PORTFOLIO_KEY)) || []; } catch(e) {} if (c.length >= loc.length) { setBiens(c); localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(c)); } } }).catch(function() {}); }, []);

  var sauver = function(liste) { setBiens(liste); localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(liste)); debouncedCloudSave("portfolio", liste, 2000); };

  var ajouterBien = function() {
    var newId = Date.now();
    var moisActuel = new Date().toISOString().slice(0, 7); // "2026-03"
    sauver(biens.concat([{
      id: newId, nom: "Nouveau bien", adresse: "", dateAchat: moisActuel,
      prixAchat: "", loyerProjete: "", mensualiteCredit: "", chargesProjetees: "",
      moisData: {},
    }]));
    setSelected(newId);
  };

  var importerProjet = function(p) {
    var inp = p.inputs || {};
    var r = null; try { r = calculerSimulation(inp); } catch(e) {}
    var regime = r && p.regimeActif ? r.regimes[p.regimeActif] : null;
    var totalLoyer = 0;
    (p.lots || []).forEach(function(l) { totalLoyer += pf(l.loyer); });
    if (totalLoyer === 0) totalLoyer = pf(inp.loyerMensuelHC);
    var newId = Date.now();
    sauver(biens.concat([{
      id: newId, nom: p.nom || "Projet importé", adresse: inp.commune || "",
      dateAchat: new Date().toISOString().slice(0, 7),
      prixAchat: inp.prixVente || "", loyerProjete: String(Math.round(totalLoyer)),
      mensualiteCredit: r ? String(Math.round(r.mensualite)) : "",
      chargesProjetees: r ? String(Math.round(r.totalFraisAnnuels / 12)) : "",
      moisData: {},
    }]));
    setSelected(newId);
  };

  var supprimerBien = function(id) { sauver(biens.filter(function(b) { return b.id !== id; })); if (selected === id) setSelected(null); };
  var updateBien = function(id, field, value) { sauver(biens.map(function(b) { return b.id === id ? Object.assign({}, b, { [field]: value }) : b; })); };
  var updateMois = function(bienId, moisKey, field, value) {
    sauver(biens.map(function(b) {
      if (b.id !== bienId) return b;
      var md = Object.assign({}, b.moisData);
      md[moisKey] = Object.assign({}, md[moisKey] || {}, { [field]: value });
      return Object.assign({}, b, { moisData: md });
    }));
  };

  var fS = { width: "100%", background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "6px 8px", color: "#0f172a", fontSize: 12, outline: "none", boxSizing: "border-box" };
  var lS = { display: "block", fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 2 };

  // KPIs globaux portfolio
  var totalLoyerReelMois = 0, totalLoyerProjeteMois = 0, totalChargesReelMois = 0, totalCreditMois = 0;
  var moisDernierKey = new Date().toISOString().slice(0, 7);
  biens.forEach(function(b) {
    var md = b.moisData[moisDernierKey] || {};
    totalLoyerReelMois += pf(md.loyerReel);
    totalLoyerProjeteMois += pf(b.loyerProjete);
    totalChargesReelMois += pf(md.chargesReelles || b.chargesProjetees);
    totalCreditMois += pf(b.mensualiteCredit);
  });
  var cfReelMois = totalLoyerReelMois - totalChargesReelMois - totalCreditMois;

  // Bien sélectionné
  var bien = selected ? biens.find(function(b) { return b.id === selected; }) : null;

  // Générer les 12 derniers mois
  var derniersMois = [];
  for (var mi = 11; mi >= 0; mi--) {
    var d = new Date(); d.setMonth(d.getMonth() - mi);
    derniersMois.push(d.toISOString().slice(0, 7));
  }

  // Stats du bien sélectionné
  var bienStats = null;
  if (bien) {
    var totalLoyer = 0, totalCharges = 0, nbMoisRemplis = 0;
    derniersMois.forEach(function(mk) {
      var md = bien.moisData[mk] || {};
      if (pf(md.loyerReel) > 0) { totalLoyer += pf(md.loyerReel); nbMoisRemplis++; }
      totalCharges += pf(md.chargesReelles);
    });
    var loyerMoyen = nbMoisRemplis > 0 ? totalLoyer / nbMoisRemplis : 0;
    var ecartLoyer = pf(bien.loyerProjete) > 0 && loyerMoyen > 0 ? ((loyerMoyen - pf(bien.loyerProjete)) / pf(bien.loyerProjete) * 100) : 0;
    bienStats = { totalLoyer: totalLoyer, totalCharges: totalCharges, nbMois: nbMoisRemplis, loyerMoyen: loyerMoyen, ecartLoyer: ecartLoyer };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* KPIs portfolio global */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        {[
          { label: "Biens en portfolio", value: String(biens.length), icon: "🏠", color: "#6366f1" },
          { label: "Loyers réels ce mois", value: fmtEur(totalLoyerReelMois), icon: "💶", color: "#16a34a" },
          { label: "Loyers projetés", value: fmtEur(totalLoyerProjeteMois), icon: "📊", color: "#0ea5e9" },
          { label: "Charges + Crédit", value: fmtEur(totalChargesReelMois + totalCreditMois), icon: "🏦", color: "#dc2626" },
          { label: "Cash-flow réel/mois", value: (cfReelMois >= 0 ? "+" : "") + fmtEur(Math.round(cfReelMois)), icon: "💰", color: cfReelMois >= 0 ? "#16a34a" : "#dc2626" },
        ].map(function(k) {
          return (<div key={k.label} style={{ background: "rgba(255,255,255,0.8)", borderRadius: 14, padding: "10px 12px", border: "1px solid rgba(148,163,184,0.15)", textAlign: "center" }}>
            <div style={{ fontSize: 16, marginBottom: 2 }}>{k.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>{k.label}</div>
          </div>);
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14 }}>
        {/* Colonne gauche : liste des biens */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={ajouterBien} style={{ flex: 1, background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 10, padding: "8px 12px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ Ajouter un bien</button>
          </div>
          {/* Import depuis projets */}
          {(simProjets || []).length > 0 && (
            <div style={{ background: "rgba(248,250,252,0.9)", borderRadius: 10, padding: "8px", border: "1px solid rgba(148,163,184,0.15)" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, marginBottom: 4 }}>📥 Importer un projet :</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(simProjets || []).slice(0, 5).map(function(p) {
                  return (<button key={p.id} onClick={function() { importerProjet(p); }} style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)", borderRadius: 6, padding: "3px 8px", fontSize: 10, color: "#16a34a", cursor: "pointer", fontWeight: 500 }}>{p.nom}</button>);
                })}
              </div>
            </div>
          )}
          {/* Liste biens */}
          {biens.map(function(b) {
            var isActive = selected === b.id;
            var md = b.moisData[moisDernierKey] || {};
            return (<div key={b.id} onClick={function() { setSelected(b.id); }} style={{ padding: "10px 12px", borderRadius: 12, background: isActive ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.8)", border: isActive ? "2px solid #6366f1" : "1px solid rgba(148,163,184,0.12)", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{b.nom}</div>
                <button onClick={function(e) { e.stopPropagation(); supprimerBien(b.id); }} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 10 }}>✕</button>
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{b.adresse || "Sans adresse"}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 11 }}>
                <span style={{ color: "#16a34a", fontWeight: 600 }}>Projeté: {fmtEur(pf(b.loyerProjete))}/m</span>
                {pf(md.loyerReel) > 0 && <span style={{ color: "#4338ca", fontWeight: 600 }}>Réel: {fmtEur(pf(md.loyerReel))}/m</span>}
              </div>
            </div>);
          })}
          {biens.length === 0 && (
            <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 12 }}>Aucun bien dans le portfolio</div>
          )}
        </div>

        {/* Colonne droite : détail du bien sélectionné */}
        {bien ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Info bien */}
            <div style={SECTION}>
              <SectionHeader icon="🏠" title={bien.nom} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                <div><label style={lS}>Nom du bien</label><input value={bien.nom} onChange={function(e) { updateBien(bien.id, "nom", e.target.value); }} style={fS} /></div>
                <div><label style={lS}>Adresse / Commune</label><input value={bien.adresse} onChange={function(e) { updateBien(bien.id, "adresse", e.target.value); }} style={fS} /></div>
                <div><label style={lS}>Date d'achat</label><input type="month" value={bien.dateAchat} onChange={function(e) { updateBien(bien.id, "dateAchat", e.target.value); }} style={fS} /></div>
                <div><label style={lS}>Prix d'achat</label><input type="number" value={bien.prixAchat} onChange={function(e) { updateBien(bien.id, "prixAchat", e.target.value); }} style={fS} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 6 }}>
                <div><label style={lS}>Loyer projeté/mois</label><input type="number" value={bien.loyerProjete} onChange={function(e) { updateBien(bien.id, "loyerProjete", e.target.value); }} style={fS} /></div>
                <div><label style={lS}>Mensualité crédit</label><input type="number" value={bien.mensualiteCredit} onChange={function(e) { updateBien(bien.id, "mensualiteCredit", e.target.value); }} style={fS} /></div>
                <div><label style={lS}>Charges projetées/mois</label><input type="number" value={bien.chargesProjetees} onChange={function(e) { updateBien(bien.id, "chargesProjetees", e.target.value); }} style={fS} /></div>
              </div>
            </div>

            {/* Stats performance */}
            {bienStats && bienStats.nbMois > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                {[
                  { label: "Loyer moyen réel", value: fmtEur(Math.round(bienStats.loyerMoyen)), color: "#16a34a" },
                  { label: "Loyer projeté", value: fmtEur(pf(bien.loyerProjete)), color: "#0ea5e9" },
                  { label: "Écart", value: (bienStats.ecartLoyer >= 0 ? "+" : "") + fmt(bienStats.ecartLoyer, 1) + " %", color: bienStats.ecartLoyer >= 0 ? "#16a34a" : "#dc2626" },
                  { label: "Total encaissé (" + bienStats.nbMois + " mois)", value: fmtEur(Math.round(bienStats.totalLoyer)), color: "#4338ca" },
                  { label: "Total charges", value: fmtEur(Math.round(bienStats.totalCharges)), color: "#dc2626" },
                ].map(function(k) {
                  return (<div key={k.label} style={{ background: "rgba(255,255,255,0.8)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(148,163,184,0.12)", textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: k.color }}>{k.value}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>{k.label}</div>
                  </div>);
                })}
              </div>
            )}

            {/* Graphique barres loyers réels vs projetés */}
            {(function() {
              var projete = pf(bien.loyerProjete);
              var hasData = derniersMois.some(function(mk) { return pf((bien.moisData[mk] || {}).loyerReel) > 0; });
              if (!hasData || projete <= 0) return null;
              var maxVal = projete * 1.5;
              return (
                <div style={SECTION}>
                  <SectionHeader icon="📊" title="Loyers réels vs projetés" />
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
                    {derniersMois.map(function(mk) {
                      var md = bien.moisData[mk] || {};
                      var reel = pf(md.loyerReel);
                      var hReel = reel > 0 ? Math.max(4, (reel / maxVal) * 100) : 0;
                      var hProj = Math.max(4, (projete / maxVal) * 100);
                      var moisLabel = mk.slice(5, 7) + "/" + mk.slice(2, 4);
                      return (<div key={mk} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <div style={{ display: "flex", gap: 1, alignItems: "flex-end", height: 90 }}>
                          <div style={{ width: 8, height: hProj + "%", background: "rgba(14,165,233,0.3)", borderRadius: "3px 3px 0 0" }} title={"Projeté: " + projete + "€"} />
                          <div style={{ width: 8, height: hReel + "%", background: reel >= projete ? "#16a34a" : reel > 0 ? "#f59e0b" : "rgba(148,163,184,0.15)", borderRadius: "3px 3px 0 0" }} title={"Réel: " + reel + "€"} />
                        </div>
                        <div style={{ fontSize: 8, color: "#94a3b8", transform: "rotate(-45deg)", transformOrigin: "center", whiteSpace: "nowrap" }}>{moisLabel}</div>
                      </div>);
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 6, fontSize: 10, color: "#94a3b8" }}>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, background: "rgba(14,165,233,0.3)", borderRadius: 2, marginRight: 3 }}></span>Projeté</span>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#16a34a", borderRadius: 2, marginRight: 3 }}></span>Réel ≥ projeté</span>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#f59e0b", borderRadius: 2, marginRight: 3 }}></span>Réel &lt; projeté</span>
                  </div>
                </div>
              );
            })()}

            {/* Saisie mensuelle */}
            <div style={SECTION}>
              <SectionHeader icon="📅" title="Saisie mensuelle" badge={derniersMois.length + " mois"} />
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead><tr style={{ borderBottom: "2px solid rgba(148,163,184,0.2)" }}>
                    <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "#64748b", fontWeight: 600 }}>Mois</th>
                    <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, color: "#64748b", fontWeight: 600 }}>Loyer réel</th>
                    <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, color: "#64748b", fontWeight: 600 }}>Charges réelles</th>
                    <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, color: "#64748b", fontWeight: 600 }}>Vacance</th>
                    <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, color: "#64748b", fontWeight: 600 }}>Notes</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 10, color: "#64748b", fontWeight: 600 }}>Cash-flow</th>
                    <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, color: "#64748b", fontWeight: 600 }}>Écart</th>
                  </tr></thead>
                  <tbody>
                    {derniersMois.map(function(mk, idx) {
                      var md = bien.moisData[mk] || {};
                      var loyerR = pf(md.loyerReel);
                      var chargesR = pf(md.chargesReelles);
                      var cf = loyerR - chargesR - pf(bien.mensualiteCredit);
                      var ecart = pf(bien.loyerProjete) > 0 && loyerR > 0 ? loyerR - pf(bien.loyerProjete) : null;
                      var moisLabel = mk.slice(5, 7) + "/" + mk.slice(0, 4);
                      return (<tr key={mk} style={{ borderBottom: "1px solid rgba(148,163,184,0.08)", background: idx % 2 === 0 ? "rgba(248,250,252,0.5)" : "transparent" }}>
                        <td style={{ padding: "4px 8px", fontWeight: 600, color: "#334155", fontSize: 11 }}>{moisLabel}</td>
                        <td style={{ padding: "4px 4px", textAlign: "center" }}><input type="number" value={md.loyerReel || ""} onChange={function(e) { updateMois(bien.id, mk, "loyerReel", e.target.value); }} placeholder={bien.loyerProjete || "—"} step="50" style={Object.assign({}, fS, { width: 80, textAlign: "center" })} /></td>
                        <td style={{ padding: "4px 4px", textAlign: "center" }}><input type="number" value={md.chargesReelles || ""} onChange={function(e) { updateMois(bien.id, mk, "chargesReelles", e.target.value); }} placeholder={bien.chargesProjetees || "—"} step="50" style={Object.assign({}, fS, { width: 80, textAlign: "center" })} /></td>
                        <td style={{ padding: "4px 4px", textAlign: "center" }}>
                          <button onClick={function() { updateMois(bien.id, mk, "vacant", md.vacant ? false : true); }} style={{ background: md.vacant ? "rgba(220,38,38,0.1)" : "rgba(22,163,74,0.1)", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 600, color: md.vacant ? "#dc2626" : "#16a34a", cursor: "pointer" }}>{md.vacant ? "Vacant" : "Occupé"}</button>
                        </td>
                        <td style={{ padding: "4px 4px", textAlign: "center" }}><input value={md.notes || ""} onChange={function(e) { updateMois(bien.id, mk, "notes", e.target.value); }} placeholder="..." style={Object.assign({}, fS, { width: 100 })} /></td>
                        <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600, color: loyerR > 0 ? (cf >= 0 ? "#16a34a" : "#dc2626") : "#94a3b8", fontSize: 11 }}>{loyerR > 0 ? (cf >= 0 ? "+" : "") + fmt(Math.round(cf), 0) + " €" : "—"}</td>
                        <td style={{ padding: "4px 8px", textAlign: "center", fontSize: 10, fontWeight: 600, color: ecart != null ? (ecart >= 0 ? "#16a34a" : "#dc2626") : "#94a3b8" }}>{ecart != null ? (ecart >= 0 ? "+" : "") + fmt(Math.round(ecart), 0) + " €" : "—"}</td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: "#94a3b8" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Sélectionne ou ajoute un bien pour commencer le suivi</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PROFIL INVESTISSEUR ───────────────────────────────────────────────────
function ProfilInvestisseur() {
  var PROFIL_KEY = "radar-immo-profil-v1";
  var defaultProfil = {
    emprunteurs: [
      { nom: "", prenom: "", nationalite: "Française", dateNaissance: "", lieuNaissance: "", telephone: "", employeur: "", ancienneteEmployeur: "", profession: "", adresse: "", situationLogement: "Propriétaire", ancienneteLogement: "" },
      { nom: "", prenom: "", nationalite: "Française", dateNaissance: "", lieuNaissance: "", telephone: "", employeur: "", ancienneteEmployeur: "", profession: "", adresse: "", situationLogement: "Propriétaire", ancienneteLogement: "" },
    ],
    revenus: [{ type: "Salaire", titulaire: "Emprunteur 1", montantAnnuel: "" }],
    credits: [{ nature: "", titulaire: "Commun", preteur: "", dureeRestante: "", capitalRestant: "", chargeAnnuelle: "" }],
    chargesAutres: [{ type: "", debiteur: "Commun", montantAnnuel: "" }],
    patrimoineImmo: [{ type: "", proprietaire: "Commun", anneeAcquisition: "", valeurAcquisition: "", valeurEstimee: "", capitalRestant: "" }],
    patrimoineFinancier: [{ type: "", proprietaire: "Emprunteur 1", etablissement: "", valeur: "" }],
    futursLoyersMensuels: "",
  };

  var _p = React.useState(function() {
    try { return Object.assign({}, defaultProfil, JSON.parse(localStorage.getItem(PROFIL_KEY))); } catch(e) { return defaultProfil; }
  });
  var profil = _p[0]; var setProfil = _p[1];
  var _saved = React.useState("idle"); var saveStatus = _saved[0]; var setSaveStatus = _saved[1];

  // Cloud load on mount
  React.useEffect(function() {
    cloudLoad("profil_investisseur").then(function(cloud) {
      if (cloud && cloud.emprunteurs) { setProfil(Object.assign({}, defaultProfil, cloud)); }
    }).catch(function() {});
  }, []);

  var sauvegarder = function() {
    localStorage.setItem(PROFIL_KEY, JSON.stringify(profil));
    cloudSave("profil_investisseur", profil);
    setSaveStatus("saved");
    setTimeout(function() { setSaveStatus("idle"); }, 3000);
  };

  var update = function(path, value) {
    setSaveStatus("pending");
    setProfil(function(prev) {
      var next = JSON.parse(JSON.stringify(prev));
      var keys = path.split(".");
      var obj = next;
      for (var i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  var fieldStyle = { width: "100%", background: "rgba(248,250,252,0.9)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 10, padding: "7px 10px", color: "#0f172a", fontSize: 13, outline: "none", boxSizing: "border-box" };
  var labelStyle = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 };
  var sepStyle = { fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14, marginBottom: 6, paddingBottom: 4, borderBottom: "2px solid rgba(99,102,241,0.15)" };

  // Inline field renderer (not a component, avoids focus loss)
  var renderField = function(label, path, opts) {
    opts = opts || {};
    return React.createElement("div", { style: { marginBottom: 6 } },
      React.createElement("label", { style: labelStyle }, label),
      React.createElement("input", {
        type: opts.type || "text",
        value: path.split(".").reduce(function(o, k) { return o && o[k]; }, profil) || "",
        onChange: function(e) { update(path, e.target.value); },
        style: fieldStyle,
        placeholder: opts.placeholder || ""
      })
    );
  };

  function addRow(key, template) { setProfil(function(p) { var n = JSON.parse(JSON.stringify(p)); n[key].push(template); return n; }); }
  function removeRow(key, idx) { setProfil(function(p) { var n = JSON.parse(JSON.stringify(p)); n[key].splice(idx, 1); return n; }); }

  // Calculs synthèse
  var totalRevenus = profil.revenus.reduce(function(s, r) { return s + pf(r.montantAnnuel); }, 0);
  var totalCredits = profil.credits.reduce(function(s, c) { return s + pf(c.chargeAnnuelle); }, 0);
  var totalChargesAutres = profil.chargesAutres.reduce(function(s, c) { return s + pf(c.montantAnnuel); }, 0);
  var totalPatrimoineImmoNet = profil.patrimoineImmo.reduce(function(s, p) { return s + pf(p.valeurEstimee) - pf(p.capitalRestant); }, 0);
  var totalPatrimoineFinancier = profil.patrimoineFinancier.reduce(function(s, p) { return s + pf(p.valeur); }, 0);
  var tauxEndettement = totalRevenus > 0 ? (totalCredits / totalRevenus * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Synthèse rapide */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {[
          { label: "Revenus annuels", value: fmtEur(totalRevenus), icon: "💶", color: "#16a34a" },
          { label: "Charges crédit/an", value: fmtEur(totalCredits), icon: "🏦", color: "#dc2626" },
          { label: "Taux endettement", value: fmt(tauxEndettement, 1) + " %", icon: "📊", color: tauxEndettement > 35 ? "#dc2626" : "#16a34a" },
          { label: "Patrimoine immo net", value: fmtEur(totalPatrimoineImmoNet), icon: "🏠", color: "#4338ca" },
          { label: "Épargne financière", value: fmtEur(totalPatrimoineFinancier), icon: "💰", color: "#0ea5e9" },
          { label: "Patrimoine total", value: fmtEur(totalPatrimoineImmoNet + totalPatrimoineFinancier), icon: "🚀", color: "#6366f1" },
        ].map(function(k) {
          return (<div key={k.label} style={{ background: "rgba(255,255,255,0.8)", borderRadius: 14, padding: "12px", border: "1px solid rgba(148,163,184,0.2)", textAlign: "center" }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{k.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{k.label}</div>
          </div>);
        })}
      </div>

      {/* Bouton enregistrer */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center" }}>
        {saveStatus === "saved" && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓ Enregistré</span>}
        {saveStatus === "pending" && <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 500 }}>Modifications non enregistrées</span>}
        <button onClick={sauvegarder} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 10, padding: "10px 24px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 14px rgba(99,102,241,0.3)" }}>
          💾 Enregistrer
        </button>
      </div>

      {/* État Civil */}
      <div style={SECTION}>
        <SectionHeader icon="👤" title="État civil" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {profil.emprunteurs.map(function(emp, idx) {
            var prefix = "emprunteurs." + idx + ".";
            return (<div key={idx} style={{ background: "rgba(248,250,252,0.7)", borderRadius: 12, padding: 12, border: "1px solid rgba(148,163,184,0.15)" }}>
              <div style={sepStyle}>Emprunteur {idx + 1}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {renderField("Nom", prefix + "nom", { placeholder: "NOM" })}
                {renderField("Prénom", prefix + "prenom", { placeholder: "Prénom" })}
                {renderField("Nationalité", prefix + "nationalite")}
                {renderField("Date de naissance", prefix + "dateNaissance", { type: "date" })}
                {renderField("Lieu de naissance", prefix + "lieuNaissance", { placeholder: "Ville (Dept)" })}
                {renderField("Téléphone", prefix + "telephone", { placeholder: "06..." })}
                {renderField("Employeur", prefix + "employeur")}
                {renderField("Ancienneté emploi", prefix + "ancienneteEmployeur", { placeholder: "Depuis le ..." })}
              </div>
              <div style={Object.assign({}, sepStyle, { color: "#0ea5e9" })}>Logement</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
                {renderField("Adresse", prefix + "adresse", { placeholder: "Adresse complète" })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div><label style={labelStyle}>Situation</label>
                  <select value={emp.situationLogement || "Propriétaire"} onChange={function(e) { update(prefix + "situationLogement", e.target.value); }} style={fieldStyle}>
                    <option>Propriétaire</option><option>Locataire</option><option>Hébergé</option>
                  </select>
                </div>
                {renderField("Depuis le", prefix + "ancienneteLogement", { placeholder: "JJ/MM/AAAA" })}
              </div>
            </div>);
          })}
        </div>
      </div>

      {/* Revenus */}
      <div style={SECTION}>
        <SectionHeader icon="💶" title="Revenus" badge={fmtEur(totalRevenus) + "/an"} />
        {profil.revenus.map(function(rev, idx) {
          return (<div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 32px", gap: 6, marginBottom: 4, alignItems: "end" }}>
            <div><label style={labelStyle}>Type</label><input value={rev.type} onChange={function(e) { update("revenus." + idx + ".type", e.target.value); }} style={fieldStyle} placeholder="Salaire, dividende..." /></div>
            <div><label style={labelStyle}>Titulaire</label>
              <select value={rev.titulaire} onChange={function(e) { update("revenus." + idx + ".titulaire", e.target.value); }} style={fieldStyle}>
                <option>Emprunteur 1</option><option>Emprunteur 2</option><option>Commun</option>
              </select>
            </div>
            <div><label style={labelStyle}>Montant annuel</label><input type="number" value={rev.montantAnnuel} onChange={function(e) { update("revenus." + idx + ".montantAnnuel", e.target.value); }} style={fieldStyle} placeholder="€/an" /></div>
            <button onClick={function() { removeRow("revenus", idx); }} style={{ background: "rgba(220,38,38,0.08)", border: "none", borderRadius: 8, padding: "7px 0", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>✕</button>
          </div>);
        })}
        <button onClick={function() { addRow("revenus", { type: "", titulaire: "Emprunteur 1", montantAnnuel: "" }); }} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500, marginTop: 6 }}>+ Ajouter un revenu</button>
      </div>

      {/* Crédits en cours */}
      <div style={SECTION}>
        <SectionHeader icon="🏦" title="Crédits en cours" badge={fmtEur(totalCredits) + "/an"} />
        {profil.credits.map(function(cred, idx) {
          return (<div key={idx} style={{ background: "rgba(248,250,252,0.7)", borderRadius: 10, padding: "8px 10px", marginBottom: 6, border: "1px solid rgba(148,163,184,0.15)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 2fr 1fr 1.5fr 1.5fr 32px", gap: 5, alignItems: "end" }}>
              <div><label style={labelStyle}>Nature</label><input value={cred.nature} onChange={function(e) { update("credits." + idx + ".nature", e.target.value); }} style={fieldStyle} placeholder="RP, Loc..." /></div>
              <div><label style={labelStyle}>Titulaire</label><select value={cred.titulaire} onChange={function(e) { update("credits." + idx + ".titulaire", e.target.value); }} style={fieldStyle}><option>Commun</option><option>Emprunteur 1</option><option>Emprunteur 2</option></select></div>
              <div><label style={labelStyle}>Prêteur</label><input value={cred.preteur} onChange={function(e) { update("credits." + idx + ".preteur", e.target.value); }} style={fieldStyle} placeholder="Banque" /></div>
              <div><label style={labelStyle}>Durée rest.</label><input type="number" value={cred.dureeRestante} onChange={function(e) { update("credits." + idx + ".dureeRestante", e.target.value); }} style={fieldStyle} placeholder="mois" /></div>
              <div><label style={labelStyle}>Capital restant</label><input type="number" value={cred.capitalRestant} onChange={function(e) { update("credits." + idx + ".capitalRestant", e.target.value); }} style={fieldStyle} placeholder="€" /></div>
              <div><label style={labelStyle}>Charge/an</label><input type="number" value={cred.chargeAnnuelle} onChange={function(e) { update("credits." + idx + ".chargeAnnuelle", e.target.value); }} style={fieldStyle} placeholder="€/an" /></div>
              <button onClick={function() { removeRow("credits", idx); }} style={{ background: "rgba(220,38,38,0.08)", border: "none", borderRadius: 8, padding: "7px 0", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
          </div>);
        })}
        <button onClick={function() { addRow("credits", { nature: "", titulaire: "Commun", preteur: "", dureeRestante: "", capitalRestant: "", chargeAnnuelle: "" }); }} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500, marginTop: 6 }}>+ Ajouter un crédit</button>
      </div>

      {/* Patrimoine Immobilier */}
      <div style={SECTION}>
        <SectionHeader icon="🏠" title="Patrimoine immobilier" badge={"Net : " + fmtEur(totalPatrimoineImmoNet)} />
        {profil.patrimoineImmo.map(function(bien, idx) {
          return (<div key={idx} style={{ background: "rgba(248,250,252,0.7)", borderRadius: 10, padding: "8px 10px", marginBottom: 6, border: "1px solid rgba(148,163,184,0.15)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1.5fr 1.5fr 1.5fr 32px", gap: 5, alignItems: "end" }}>
              <div><label style={labelStyle}>Type & adresse</label><input value={bien.type} onChange={function(e) { update("patrimoineImmo." + idx + ".type", e.target.value); }} style={fieldStyle} placeholder="RP, Locatif..." /></div>
              <div><label style={labelStyle}>Propriétaire</label><select value={bien.proprietaire} onChange={function(e) { update("patrimoineImmo." + idx + ".proprietaire", e.target.value); }} style={fieldStyle}><option>Commun</option><option>Emprunteur 1</option><option>Emprunteur 2</option></select></div>
              <div><label style={labelStyle}>Année acq.</label><input type="number" value={bien.anneeAcquisition} onChange={function(e) { update("patrimoineImmo." + idx + ".anneeAcquisition", e.target.value); }} style={fieldStyle} placeholder="2024" /></div>
              <div><label style={labelStyle}>Val. achat</label><input type="number" value={bien.valeurAcquisition} onChange={function(e) { update("patrimoineImmo." + idx + ".valeurAcquisition", e.target.value); }} style={fieldStyle} placeholder="€" /></div>
              <div><label style={labelStyle}>Val. estimée</label><input type="number" value={bien.valeurEstimee} onChange={function(e) { update("patrimoineImmo." + idx + ".valeurEstimee", e.target.value); }} style={fieldStyle} placeholder="€" /></div>
              <div><label style={labelStyle}>Capital restant</label><input type="number" value={bien.capitalRestant} onChange={function(e) { update("patrimoineImmo." + idx + ".capitalRestant", e.target.value); }} style={fieldStyle} placeholder="€" /></div>
              <button onClick={function() { removeRow("patrimoineImmo", idx); }} style={{ background: "rgba(220,38,38,0.08)", border: "none", borderRadius: 8, padding: "7px 0", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
          </div>);
        })}
        <button onClick={function() { addRow("patrimoineImmo", { type: "", proprietaire: "Commun", anneeAcquisition: "", valeurAcquisition: "", valeurEstimee: "", capitalRestant: "" }); }} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500, marginTop: 6 }}>+ Ajouter un bien</button>
      </div>

      {/* Patrimoine Financier */}
      <div style={SECTION}>
        <SectionHeader icon="💰" title="Patrimoine financier & mobilier" badge={fmtEur(totalPatrimoineFinancier)} />
        {profil.patrimoineFinancier.map(function(pf2, idx) {
          return (<div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 2fr 1.5fr 32px", gap: 6, marginBottom: 4, alignItems: "end" }}>
            <div><label style={labelStyle}>Type</label><input value={pf2.type} onChange={function(e) { update("patrimoineFinancier." + idx + ".type", e.target.value); }} style={fieldStyle} placeholder="Livret A, PEA, AV..." /></div>
            <div><label style={labelStyle}>Propriétaire</label><select value={pf2.proprietaire} onChange={function(e) { update("patrimoineFinancier." + idx + ".proprietaire", e.target.value); }} style={fieldStyle}><option>Emprunteur 1</option><option>Emprunteur 2</option><option>Commun</option></select></div>
            <div><label style={labelStyle}>Établissement</label><input value={pf2.etablissement} onChange={function(e) { update("patrimoineFinancier." + idx + ".etablissement", e.target.value); }} style={fieldStyle} placeholder="Banque, courtier..." /></div>
            <div><label style={labelStyle}>Valeur</label><input type="number" value={pf2.valeur} onChange={function(e) { update("patrimoineFinancier." + idx + ".valeur", e.target.value); }} style={fieldStyle} placeholder="€" /></div>
            <button onClick={function() { removeRow("patrimoineFinancier", idx); }} style={{ background: "rgba(220,38,38,0.08)", border: "none", borderRadius: 8, padding: "7px 0", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>✕</button>
          </div>);
        })}
        <button onClick={function() { addRow("patrimoineFinancier", { type: "", proprietaire: "Emprunteur 1", etablissement: "", valeur: "" }); }} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500, marginTop: 6 }}>+ Ajouter un placement</button>
      </div>

      {/* Capacité d'emprunt */}
      <div style={SECTION}>
        <SectionHeader icon="📊" title="Capacité d'emprunt estimée" />
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, background: "rgba(99,102,241,0.06)", borderRadius: 8, padding: "8px 10px" }}>
          Les banques retiennent <b>70 % des loyers perçus</b> dans le calcul des revenus. Renseigne tes loyers actuels dans "Revenus" (type = Loyers) et les futurs loyers de ton projet ci-dessous.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {renderField("Futurs loyers mensuels HC (nouveau projet)", "futursLoyersMensuels", { type: "number", placeholder: "Ex: 2050" })}
          <div>
            <label style={labelStyle}>Futurs loyers retenus (70%)</label>
            <div style={{ padding: "7px 10px", background: "rgba(22,163,74,0.08)", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "#16a34a" }}>
              {fmtEur(Math.round(pf(profil.futursLoyersMensuels) * 0.7))} /mois
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {(function() {
            // Identifier les revenus locatifs actuels
            var revenusSalaires = 0; var revenusLoyers = 0; var revenusAutres = 0;
            profil.revenus.forEach(function(r) {
              var m = pf(r.montantAnnuel);
              var t = (r.type || "").toLowerCase();
              if (t.indexOf("loyer") >= 0 || t.indexOf("loc") >= 0) revenusLoyers += m;
              else if (t.indexOf("salaire") >= 0) revenusSalaires += m;
              else revenusAutres += m;
            });
            // 70% des loyers actuels + 70% des futurs loyers
            var loyersRetenus70 = revenusLoyers * 0.7;
            var futursLoyersRetenus70 = pf(profil.futursLoyersMensuels) * 12 * 0.7;
            var revMensuel = (revenusSalaires + revenusAutres + loyersRetenus70 + futursLoyersRetenus70) / 12;
            var chargesMensuelles = (totalCredits + totalChargesAutres) / 12;
            var tauxEndettAvecProjet = revMensuel > 0 ? (chargesMensuelles / revMensuel * 100) : 0;
            var capaciteMensuelle35 = revMensuel * 0.35 - chargesMensuelles;
            var capaciteMensuelleRestante = Math.max(0, capaciteMensuelle35);
            var tM = 0.04 / 12; var nM = 25 * 12;
            var capaciteEmprunt = capaciteMensuelleRestante > 0 ? capaciteMensuelleRestante * (1 - Math.pow(1 + tM, -nM)) / tM : 0;
            return [
              { label: "Salaires & autres", value: fmtEur(Math.round((revenusSalaires + revenusAutres) / 12)) + "/mois", color: "#16a34a" },
              { label: "Loyers actuels retenus (70%)", value: fmtEur(Math.round(loyersRetenus70 / 12)) + "/mois", color: "#0ea5e9" },
              { label: "Futurs loyers retenus (70%)", value: fmtEur(Math.round(futursLoyersRetenus70 / 12)) + "/mois", color: "#6366f1" },
              { label: "Revenus retenus total", value: fmtEur(Math.round(revMensuel)) + "/mois", color: "#16a34a", bold: true },
              { label: "Charges crédits", value: fmtEur(Math.round(chargesMensuelles)) + "/mois", color: "#dc2626" },
              { label: "Taux endettement actuel", value: fmt(tauxEndettement, 1) + " %", color: tauxEndettement > 35 ? "#dc2626" : "#16a34a" },
              { label: "Mensualité disponible (35%)", value: fmtEur(Math.round(capaciteMensuelleRestante)) + "/mois", color: "#6366f1" },
              { label: "Capacité d'emprunt (4%, 25 ans)", value: fmtEur(Math.round(capaciteEmprunt)), color: "#4338ca", bold: true },
            ];
          })().map(function(k) {
            return (<div key={k.label} style={{ background: k.bold ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.8)", borderRadius: 12, padding: "10px 14px", border: "1px solid " + (k.bold ? "rgba(99,102,241,0.2)" : "rgba(148,163,184,0.2)") }}>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{k.label}</div>
              <div style={{ fontSize: k.bold ? 18 : 16, fontWeight: 800, color: k.color, marginTop: 2 }}>{k.value}</div>
            </div>);
          })}
        </div>
      </div>

      {/* Bouton enregistrer en bas */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center", padding: "10px 0" }}>
        {saveStatus === "saved" && <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>✓ Données enregistrées avec succès</span>}
        {saveStatus === "pending" && <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 500 }}>⚠ Modifications non enregistrées</span>}
        <button onClick={sauvegarder} style={{ background: "linear-gradient(135deg,#6366f1,#38bdf8)", border: "none", borderRadius: 12, padding: "12px 32px", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 14px rgba(99,102,241,0.3)" }}>
          💾 Enregistrer ma fiche patrimoine
        </button>
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

  // Cloud sync : charger SCI au montage
  useEffect(function() {
    cloudLoad("sci_projets").then(function(cloud) {
      if (cloud && cloud.length > 0) {
        var local = [];
        try { local = JSON.parse(localStorage.getItem("radar-immo-sci-v2")) || []; } catch(e) {}
        if (cloud.length >= local.length) {
          setProjets(cloud);
          localStorage.setItem("radar-immo-sci-v2", JSON.stringify(cloud));
        }
      }
    }).catch(function() {});
  }, []);

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
      debouncedCloudSave("sci_projets", liste, 1500);
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
      debouncedCloudSave("sci_projets", liste, 1000);
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

// ─── CLOUD SYNC ──────────────────────────────────────────────────────────────
async function cloudSave(key, value) {
  var sb = await getSupabase();
  if (!sb) return;
  var sess = await sb.auth.getSession();
  var user = sess.data.session && sess.data.session.user;
  if (!user) return;
  await sb.from("user_data").upsert({
    user_id: user.id,
    data_key: key,
    data_value: value,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,data_key" });
}

async function cloudLoad(key) {
  var sb = await getSupabase();
  if (!sb) return null;
  var sess = await sb.auth.getSession();
  var user = sess.data.session && sess.data.session.user;
  if (!user) return null;
  var res = await sb.from("user_data").select("data_value").eq("user_id", user.id).eq("data_key", key).single();
  return res.data ? res.data.data_value : null;
}

// Debounce cloud save
var _cloudTimers = {};
function debouncedCloudSave(key, value, delay) {
  clearTimeout(_cloudTimers[key]);
  _cloudTimers[key] = setTimeout(function() { cloudSave(key, value); }, delay || 2000);
}

// ─── AUTH SCREEN ─────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  var _s = React.useState("login"); var mode = _s[0]; var setMode = _s[1];
  var _e = React.useState(""); var email = _e[0]; var setEmail = _e[1];
  var _p = React.useState(""); var pass = _p[0]; var setPass = _p[1];
  var _err = React.useState(""); var err = _err[0]; var setErr = _err[1];
  var _l = React.useState(false); var loading = _l[0]; var setLoading = _l[1];
  var _msg = React.useState(""); var msg = _msg[0]; var setMsg = _msg[1];

  var submit = async function() {
    setErr(""); setMsg(""); setLoading(true);
    try {
      var sb = await getSupabase();
      if (!sb) throw { message: "Impossible de charger Supabase" };
      if (mode === "signup") {
        var res = await sb.auth.signUp({ email: email, password: pass });
        if (res.error) throw res.error;
        setMsg("Inscription réussie ! Vérifie ton email pour confirmer ton compte, puis connecte-toi.");
        setMode("login");
      } else {
        var res2 = await sb.auth.signInWithPassword({ email: email, password: pass });
        if (res2.error) throw res2.error;
        onAuth(res2.data.user);
      }
    } catch(e) {
      setErr(e.message || "Erreur d'authentification");
    }
    setLoading(false);
  };

  var boxS = { maxWidth: 380, margin: "0 auto", padding: 32, background: "rgba(255,255,255,0.85)", borderRadius: 24, boxShadow: "0 8px 40px rgba(99,102,241,0.12)", border: "1px solid rgba(148,163,184,0.2)", backdropFilter: "blur(20px)" };
  var inputS = { width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid rgba(148,163,184,0.4)", fontSize: 14, outline: "none", background: "rgba(248,250,252,0.9)", color: "#0f172a", boxSizing: "border-box" };
  var btnS = { width: "100%", padding: "12px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#6366f1,#38bdf8)", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at top left,#bfdbfe 0,transparent 50%),radial-gradient(ellipse at top right,#fce7f3 0,transparent 50%),radial-gradient(ellipse at bottom center,#d1fae5 0,#f1f5f9 60%)", fontFamily: "-apple-system,BlinkMacSystemFont,system-ui,sans-serif", padding: 20 }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#6366f1,#38bdf8)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(99,102,241,0.4)", marginBottom: 16 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M3 12L12 4l9 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 10v8a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="18" cy="8" r="1.5" fill="#fbbf24"/></svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>
          <span style={{ background: "linear-gradient(90deg,#6366f1,#38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>RADAR</span>
          <span style={{ color: "#0f172a" }}> IMMO 76</span>
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "8px 0 0" }}>Connecte-toi pour synchroniser tes projets sur tous tes appareils</p>
      </div>
      <div style={boxS}>
        <div style={{ display: "flex", marginBottom: 20, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(148,163,184,0.3)" }}>
          {["login", "signup"].map(function(m) {
            var active = mode === m;
            return (
              <button key={m} onClick={function() { setMode(m); setErr(""); setMsg(""); }}
                style={{ flex: 1, padding: "9px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: active ? "rgba(99,102,241,0.12)" : "transparent", color: active ? "#4338ca" : "#94a3b8" }}>
                {m === "login" ? "Connexion" : "Inscription"}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={function(e) { setEmail(e.target.value); }} style={inputS} placeholder="ton@email.com" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Mot de passe</label>
            <input type="password" value={pass} onChange={function(e) { setPass(e.target.value); }} style={inputS} placeholder="••••••••"
              onKeyDown={function(e) { if (e.key === "Enter") submit(); }} />
          </div>
          {err && <div style={{ fontSize: 12, color: "#dc2626", background: "rgba(220,38,38,0.06)", padding: "8px 12px", borderRadius: 8 }}>{err}</div>}
          {msg && <div style={{ fontSize: 12, color: "#16a34a", background: "rgba(22,163,74,0.06)", padding: "8px 12px", borderRadius: 8 }}>{msg}</div>}
          <button onClick={submit} disabled={loading} style={Object.assign({}, btnS, { opacity: loading ? 0.6 : 1 })}>
            {loading ? "⏳ Chargement..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </div>
        {mode === "login" && (
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <button onClick={async function() {
              if (!email) { setErr("Entre ton email d'abord"); return; }
              setLoading(true); setErr(""); setMsg("");
              var sb = await getSupabase();
              if (!sb) { setErr("Erreur de chargement"); setLoading(false); return; }
              var r = await sb.auth.resetPasswordForEmail(email);
              if (r.error) setErr(r.error.message);
              else setMsg("Email de réinitialisation envoyé !");
              setLoading(false);
            }} style={{ background: "none", border: "none", color: "#6366f1", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
              Mot de passe oublié ?
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── APP WRAPPER (Auth + Sync) ───────────────────────────────────────────────
export default function App() {
  // Nettoyage automatique si localStorage plein
  React.useEffect(function() {
    try {
      var test = '__quota_test__';
      localStorage.setItem(test, '1');
      localStorage.removeItem(test);
    } catch(e) {
      // localStorage plein : vider les photos (le plus gros consommateur)
      try { localStorage.removeItem('radar-immo-photos-v1'); } catch(_) {}
      try { localStorage.removeItem('radar-immo-communes-v3'); } catch(_) {}
      console.warn('localStorage plein — photos vidées automatiquement');
    }
  }, []);

  var _auth = useState(null); var user = _auth[0]; var setUser = _auth[1];
  var _loading = useState(true); var authLoading = _loading[0]; var setAuthLoading = _loading[1];
  var _authSub = React.useRef(null);

  useEffect(function() {
    getSupabase().then(function(sb) {
      if (!sb) { setAuthLoading(false); return; }
      sb.auth.getSession().then(function(res) {
        setUser(res.data.session ? res.data.session.user : null);
        setAuthLoading(false);
      });
      var sub = sb.auth.onAuthStateChange(function(_event, session) {
        setUser(session ? session.user : null);
      });
      // Store unsubscribe ref
      _authSub.current = sub;
    });
    return function() { if (_authSub.current) _authSub.current.data.subscription.unsubscribe(); };
  }, []);

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", fontFamily: "system-ui,sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏠</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>Chargement...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuth={setUser} />;
  }

  return <AppMain user={user} onLogout={function() { getSupabase().then(function(sb) { if (sb) sb.auth.signOut(); }); setUser(null); }} />;
}

function AppMain({ user, onLogout }) {
  const [onglet, setOnglet] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);

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

  // ── Cloud sync : charger au démarrage ──
  useEffect(function() {
    if (!user) return;
    Promise.all([
      cloudLoad("projets"),
      cloudLoad("photos"),
    ]).then(function(results) {
      var cloudProjets = results[0];
      var cloudPhotos = results[1];
      if (cloudProjets && cloudProjets.length > 0) {
        // Merge: cloud gagne si plus récent ou si local vide
        var localProjets = [];
        try { localProjets = JSON.parse(localStorage.getItem("radar-immo-projets-v1")) || []; } catch(e) {}
        if (cloudProjets.length >= localProjets.length) {
          setSimProjets(cloudProjets);
          localStorage.setItem("radar-immo-projets-v1", JSON.stringify(cloudProjets));
        }
      }
      if (cloudPhotos && cloudPhotos.length > 0) {
        setSimPhotos(cloudPhotos);
        localStorage.setItem("radar-immo-photos-v1", JSON.stringify(cloudPhotos));
      }
      setCloudReady(true);
    }).catch(function() { setCloudReady(true); });
  }, [user]);

  // ── Cloud sync : sauvegarder quand les projets changent ──
  useEffect(function() {
    if (!cloudReady) return;
    localStorage.setItem("radar-immo-projets-v1", JSON.stringify(simProjets));
    debouncedCloudSave("projets", simProjets, 2000);
  }, [simProjets, cloudReady]);

  useEffect(function() {
    if (!cloudReady) return;
    localStorage.setItem("radar-immo-photos-v1", JSON.stringify(simPhotos));
    debouncedCloudSave("photos", simPhotos, 3000);
  }, [simPhotos, cloudReady]);

  const ouvrirProjet = function(p) {
    setSimProjetACharger(p);
    setOnglet("simulation");
  };

  const navItems = [
    { id: "dashboard",     label: "Tableau de bord",         icon: "🏠" },
    { id: "analyse",       label: "Analyse communes",        icon: "🗺️" },
    { id: "simulation",    label: "Simulation projet",       icon: "📊" },
    { id: "exploitation",  label: "Mode d'exploitation",     icon: "🏘️" },
    { id: "credit",        label: "Simulation de crédit",    icon: "🏦" },
    { id: "offres",        label: "Comparateur offres",      icon: "⚖️" },
    { id: "travaux",       label: "Simulateur travaux",      icon: "🔨" },
    { id: "plusvalue",     label: "Plus-value immo",         icon: "📈" },
    { id: "sci",           label: "Simulateur SCI IS",       icon: "🏢" },
    { id: "portfolio",     label: "Suivi portfolio",         icon: "📂" },
    { id: "profil",        label: "Profil investisseur",     icon: "👤" },
    { id: "favoris",       label: "Mes projets",             icon: "⭐" },
  ];

  const titres = {
    dashboard:     { h: "Tableau de bord", sub: "Vue d'ensemble de ta situation et de tes projets d'investissement." },
    analyse:       { h: "Analyse investissement — Seine-Maritime", sub: "TOP 10 des communes selon tes filtres · Clic = détail · Clic sur une jauge = détail du score · Clic droit = comparer" },
    simulation:    { h: "Simulation de rentabilité", sub: "Paramètre ton projet, sauvegarde-le et visualise l'évolution du cash-flow par régime fiscal." },
    exploitation:  { h: "Comparateur de modes d'exploitation", sub: "Compare location nue, meublée, colocation et courte durée pour optimiser ton rendement." },
    credit:        { h: "Simulation de crédit", sub: "Calcule mensualités, coût total et tableau d'amortissement de ton prêt." },
    offres:        { h: "Comparateur d'offres de financement", sub: "Compare plusieurs propositions de banques sur une base homogène avec score pondéré." },
    travaux:       { h: "Simulateur de coût des travaux", sub: "Estime le budget travaux poste par poste et son impact sur la rentabilité." },
    plusvalue:      { h: "Calculateur de plus-value immobilière", sub: "Estime l'impôt sur la plus-value selon la durée de détention et les abattements légaux." },
    sci:           { h: "Simulateur SCI à l'IS", sub: "Analyse rentabilité, fiscalité IS, amortissements et dividendes de ta SCI." },
    portfolio:     { h: "Suivi de portfolio", sub: "Suis la performance réelle de tes biens : loyers encaissés, charges, comparaison avec les projections." },
    profil:        { h: "Fiche patrimoine investisseur", sub: "Renseigne ta situation pour générer un dossier bancaire complet." },
    favoris:       { h: "Mes projets sauvegardés", sub: "Retrouve et charge toutes tes simulations d'investissement." },
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
        {/* User + Logout */}
        {sidebarOpen ? (
          <div style={{ marginTop: 6, padding: "8px", borderRadius: 10, background: "rgba(99,102,241,0.06)", overflow: "hidden" }}>
            <div style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 6 }}>
              🔒 {user.email}
            </div>
            <button onClick={onLogout}
              style={{ width: "100%", padding: "6px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.06)", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              Déconnexion
            </button>
          </div>
        ) : (
          <button onClick={onLogout} title="Déconnexion"
            style={{ marginTop: 4, width: "100%", padding: "6px", borderRadius: 8, border: "none", background: "rgba(220,38,38,0.06)", color: "#dc2626", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            ⏻
          </button>
        )}
        {!sidebarOpen && <div style={{ fontSize: 9, color: "#cbd5e1", textAlign: "center", marginTop: 4, letterSpacing: "1px", fontWeight: 700 }}>76</div>}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: 20, overflowY: "auto", minWidth: 0 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>{titres[onglet].h}</h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{titres[onglet].sub}</p>
        </div>
        {onglet === "dashboard"  && <Dashboard projets={simProjets} onOuvrir={ouvrirProjet} onNav={handleNav} user={user} />}
        {onglet === "analyse"    && <AnalyseCommunes />}
        {onglet === "simulation" && <SimulationProjet photos={simPhotos} setPhotos={setSimPhotos} projets={simProjets} setProjets={setSimProjets} projetACharger={simProjetACharger} onProjetCharge={function() { setSimProjetACharger(null); }} />}
        {onglet === "exploitation" && <SimulateurExploitation simProjets={simProjets} />}
        {onglet === "credit"     && <SimulateurCredit />}
        {onglet === "offres"     && <ComparateurOffres />}
        {onglet === "travaux"    && <SimulateurTravaux />}
        {onglet === "plusvalue"  && <CalculateurPlusValue />}
        {onglet === "sci"       && <SimulateurSCI />}
        {onglet === "portfolio" && <SuiviPortfolio simProjets={simProjets} />}
        {onglet === "profil"   && <ProfilInvestisseur />}
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
