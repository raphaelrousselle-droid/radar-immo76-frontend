import React, { useState, useEffect, useCallback, useMemo } from "react";

const API_BASE = "https://radar-immo76-1.onrender.com";
const CACHE_KEY = "radar-immo-communes-v2";

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
const calcGlobal = (r, d, s) => {
  const nr = sn(r), nd = sn(d), ns = sn(s);
  if (nr != null && nd != null && ns != null) return nr * 0.4 + nd * 0.3 + ns * 0.3;
  return null;
};

function ProgressBar({ value }) {
  const n = sn(value);
  const pct = Math.min(100, Math.max(0, ((n ?? 0) / 10) * 100));
  return (
    <div style={{ background: "#1e293b", borderRadius: 4, height: 6, width: "100%" }}>
      <div style={{ width: `${pct}%`, background: nc(n), height: 6, borderRadius: 4, transition: "width 0.3s" }} />
    </div>
  );
}

// ─── Simulation de rentabilité ────────────────────────────────────────────────
function calculer(i) {
  const fraisAgenceTx  = (i.prixVente * i.fraisAgencePct) / 100;
  const depenseNette   = i.prixVente + i.fraisNotaire + i.travaux + i.amenagements + fraisAgenceTx;
  const sommeEmpruntee = depenseNette - i.apport;

  const nMois       = i.dureeAnnees * 12;
  const tauxMensuel = i.tauxCredit / 100 / 12;
  const mensualite  = tauxMensuel === 0
    ? sommeEmpruntee / nMois
    : (sommeEmpruntee * tauxMensuel) / (1 - Math.pow(1 + tauxMensuel, -nMois));

  const remboursementAnnuel = mensualite * 12;
  const coutPretTotal       = remboursementAnnuel * i.dureeAnnees - sommeEmpruntee;
  const interetsAnnuels     = coutPretTotal / i.dureeAnnees;
  const loyersAnnuels       = i.loyerMensuelHC * i.tauxOccupation;
  const assurancePNO        = i.assurancePNOAn > 0 ? i.assurancePNOAn : depenseNette * 0.0012;
  const gestionLocativeAn   = (loyersAnnuels * i.gestionLocativePct) / 100;
  const totalFraisAnnuels   =
    i.chargesImmeubleAn + i.taxeFonciereAn + assurancePNO +
    gestionLocativeAn + i.provisionTravauxAn + i.fraisBancairesAn + i.expertComptableAn;
  const amortissement = (depenseNette * i.coefAmortissement) / 100;
  const ebe           = loyersAnnuels - totalFraisAnnuels;

  const mkRegime = (ebe, impot) => {
    const tresorerie = ebe - remboursementAnnuel - impot;
    const rendBrut   = depenseNette > 0 ? (loyersAnnuels / depenseNette) * 100 : 0;
    const rendNet    = depenseNette > 0 ? (tresorerie / depenseNette) * 100 : 0;
    const tri        = tresorerie > 0 ? depenseNette / tresorerie : null;
    const regle70    = loyersAnnuels > 0 ? remboursementAnnuel / loyersAnnuels : null;
    return { ebe, impot, tresorerie, rendBrut, rendNet, tri, regle70 };
  };

  const baseIS         = Math.max(0, loyersAnnuels - totalFraisAnnuels - interetsAnnuels - amortissement);
  const impotIS        = baseIS * (i.tauxIS / 100);
  const baseLMNPReel   = Math.max(0, loyersAnnuels - totalFraisAnnuels - interetsAnnuels - amortissement);
  const impotLMNPReel  = baseLMNPReel * ((i.tmi + 17.2) / 100);
  const impotMicroBIC  = Math.max(0, loyersAnnuels * 0.5) * ((i.tmi + 17.2) / 100);
  const baseFoncierReel= Math.max(0, loyersAnnuels - totalFraisAnnuels - interetsAnnuels);
  const impotFoncierR  = baseFoncierReel * ((i.tmi + 17.2) / 100);
  const impotMicroFonc = Math.max(0, loyersAnnuels * 0.7) * ((i.tmi + 17.2) / 100);

  return {
    depenseNette, sommeEmpruntee, mensualite, coutPretTotal,
    remboursementAnnuel, interetsAnnuels, loyersAnnuels,
    totalFraisAnnuels, amortissement,
    rendBrut: depenseNette > 0 ? (loyersAnnuels / depenseNette) * 100 : 0,
    regimes: {
      "SAS / SCI IS":   mkRegime(ebe, impotIS),
      "LMNP Réel":      mkRegime(ebe, impotLMNPReel),
      "LMNP Micro BIC": mkRegime(ebe, impotMicroBIC),
      "Foncier Réel":   mkRegime(ebe, impotFoncierR),
      "Micro Foncier":  mkRegime(ebe, impotMicroFonc),
    },
  };
}

const fmt    = (n, d = 0) => n == null ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtEur = (n) => n == null ? "—" : `${fmt(n)} €`;
const fmtPct = (n) => n == null ? "—" : `${fmt(n, 2)} %`;

function InputField({ label, name, value, onChange, unit = "€", step = 1000, min = 0 }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number" name={name} value={value} step={step} min={min} onChange={onChange}
          style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", color: "#f1f5f9", fontSize: 13 }}
        />
        {unit && <span style={{ color: "#64748b", fontSize: 12, minWidth: 24 }}>{unit}</span>}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#3b82f6", borderBottom: "1px solid #1e3a5f", paddingBottom: 4, marginBottom: 10, marginTop: 18 }}>
      {children}
    </div>
  );
}

function SimulationProjet() {
  const [inputs, setInputs] = useState({
    prixVente: 175000, fraisNotaire: 13000, travaux: 0, amenagements: 0,
    fraisAgencePct: 5, apport: 14000, tauxCredit: 4.2, dureeAnnees: 25,
    loyerMensuelHC: 1000, tauxOccupation: 11.5, chargesImmeubleAn: 250,
    taxeFonciereAn: 1400, assurancePNOAn: 0, gestionLocativePct: 0,
    provisionTravauxAn: 0, fraisBancairesAn: 300, expertComptableAn: 600,
    coefAmortissement: 4.75, tauxIS: 15, tmi: 11,
  });
  const [regimeActif, setRegimeActif] = useState("SAS / SCI IS");
  const handleChange = (e) => {
    const { name, value } = e.target;
    setInputs((p) => ({ ...p, [name]: parseFloat(value) || 0 }));
  };
  const result = useMemo(() => calculer(inputs), [inputs]);
  const regime = result.regimes[regimeActif];
  const couleurTreso = regime.tresorerie >= 0 ? "#22c55e" : "#ef4444";
  const couleur70    = regime.regle70 != null && regime.regle70 < 0.7 ? "#22c55e" : "#ef4444";

  return (
    <div style={{ display: "flex", gap: 20, color: "#f1f5f9", fontSize: 13 }}>
      {/* Formulaire */}
      <div style={{ width: 270, minWidth: 250, background: "#0f172a", borderRadius: 12, padding: 16, overflowY: "auto", maxHeight: "calc(100vh - 80px)" }}>
        <SectionTitle>Achat</SectionTitle>
        <InputField label="Prix de vente"            name="prixVente"         value={inputs.prixVente}         onChange={handleChange} />
        <InputField label="Frais de notaire"          name="fraisNotaire"      value={inputs.fraisNotaire}      onChange={handleChange} />
        <InputField label="Travaux"                   name="travaux"           value={inputs.travaux}           onChange={handleChange} />
        <InputField label="Aménagements"              name="amenagements"      value={inputs.amenagements}      onChange={handleChange} />
        <InputField label="Frais d'agence (%)"        name="fraisAgencePct"    value={inputs.fraisAgencePct}    onChange={handleChange} unit="%" step={0.5} />
        <InputField label="Apport"                    name="apport"            value={inputs.apport}            onChange={handleChange} />
        <SectionTitle>Prêt</SectionTitle>
        <InputField label="Taux crédit (%)"           name="tauxCredit"        value={inputs.tauxCredit}        onChange={handleChange} unit="%" step={0.1} />
        <InputField label="Durée (années)"            name="dureeAnnees"       value={inputs.dureeAnnees}       onChange={handleChange} unit="ans" step={1} />
        <SectionTitle>Exploitation</SectionTitle>
        <InputField label="Loyer mensuel HC total"    name="loyerMensuelHC"    value={inputs.loyerMensuelHC}    onChange={handleChange} step={50} />
        <InputField label="Taux d'occupation (mois)"  name="tauxOccupation"   value={inputs.tauxOccupation}    onChange={handleChange} unit="mois" step={0.5} />
        <InputField label="Charges immeuble/an"       name="chargesImmeubleAn" value={inputs.chargesImmeubleAn} onChange={handleChange} step={100} />
        <InputField label="Taxe foncière/an"          name="taxeFonciereAn"    value={inputs.taxeFonciereAn}    onChange={handleChange} step={100} />
        <InputField label="Assurance PNO/an (0=auto)" name="assurancePNOAn"   value={inputs.assurancePNOAn}    onChange={handleChange} step={50} />
        <InputField label="Gestion locative (%)"      name="gestionLocativePct" value={inputs.gestionLocativePct} onChange={handleChange} unit="%" step={0.5} />
        <InputField label="Provision travaux/an"      name="provisionTravauxAn" value={inputs.provisionTravauxAn} onChange={handleChange} step={100} />
        <InputField label="Frais bancaires/an"        name="fraisBancairesAn"  value={inputs.fraisBancairesAn}  onChange={handleChange} step={50} />
        <InputField label="Expert-comptable + CFE/an" name="expertComptableAn" value={inputs.expertComptableAn} onChange={handleChange} step={50} />
        <SectionTitle>Fiscalité</SectionTitle>
        <InputField label="Coef amortissement (%)"   name="coefAmortissement" value={inputs.coefAmortissement} onChange={handleChange} unit="%" step={0.25} />
        <InputField label="Taux IS (%)"              name="tauxIS"            value={inputs.tauxIS}            onChange={handleChange} unit="%" step={1} />
        <InputField label="TMI (%)"                  name="tmi"               value={inputs.tmi}               onChange={handleChange} unit="%" step={1} />
      </div>

      {/* Résultats */}
      <div style={{ flex: 1, overflowY: "auto", maxHeight: "calc(100vh - 80px)" }}>
        {/* KPIs projet */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Dépense nette",     value: fmtEur(result.depenseNette) },
            { label: "Somme empruntée",   value: fmtEur(result.sommeEmpruntee) },
            { label: "Mensualité crédit", value: fmtEur(result.mensualite) },
            { label: "Coût total prêt",   value: fmtEur(result.coutPretTotal) },
            { label: "Loyers annuels",    value: fmtEur(result.loyersAnnuels) },
            { label: "Total frais/an",    value: fmtEur(result.totalFraisAnnuels) },
            { label: "Amortissement/an",  value: fmtEur(result.amortissement) },
            { label: "Rendement brut",    value: fmtPct(result.rendBrut) },
          ].map((c) => (
            <div key={c.label} style={{ background: "#0f172a", borderRadius: 8, padding: "10px 14px", borderLeft: "3px solid #1d4ed8" }}>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>{c.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Sélecteur régime */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {Object.keys(result.regimes).map((r) => (
            <button key={r} onClick={() => setRegimeActif(r)} style={{ padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: regimeActif === r ? "#1d4ed8" : "#1e293b", color: regimeActif === r ? "#fff" : "#94a3b8" }}>
              {r}
            </button>
          ))}
        </div>

        {/* Bilan régime actif */}
        <div style={{ background: "#0f172a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Bilan — {regimeActif}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "EBE",                value: fmtEur(regime.ebe),        color: "#3b82f6" },
              { label: "Fiscalité annuelle", value: fmtEur(regime.impot),      color: "#f59e0b" },
              { label: "Trésorerie/an",      value: fmtEur(regime.tresorerie), color: couleurTreso },
              { label: "Rendement brut",     value: fmtPct(regime.rendBrut),   color: "#94a3b8" },
              { label: "Rendement net",      value: fmtPct(regime.rendNet),    color: "#22c55e" },
              { label: "TRI",                value: regime.tri ? fmt(regime.tri, 1) + " ans" : "—", color: "#94a3b8" },
            ].map((c) => (
              <div key={c.label} style={{ background: "#1e293b", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>
          {/* Règle 70% */}
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#1e293b", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 12, color: "#94a3b8", minWidth: 90 }}>Règle des 70 %</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: couleur70 }}>{regime.regle70 != null ? fmt(regime.regle70, 2) : "—"}</div>
            <div style={{ fontSize: 11, color: couleur70 }}>
              {regime.regle70 != null ? (regime.regle70 < 0.7 ? "✓ OK (< 0,70)" : "✗ Trop élevé (> 0,70)") : ""}
            </div>
            <div style={{ flex: 1, background: "#0f172a", borderRadius: 4, height: 7 }}>
              <div style={{ width: `${Math.min(100, (regime.regle70 || 0) * 100)}%`, background: couleur70, height: 7, borderRadius: 4, transition: "width 0.3s" }} />
            </div>
          </div>
        </div>

        {/* Tableau comparatif */}
        <div style={{ background: "#0f172a", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Comparatif tous régimes</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: "#64748b", borderBottom: "1px solid #1e293b" }}>
                {["Régime", "Tréso/an", "Impôt/an", "Rdt net", "TRI", "Règle 70%"].map((h) => (
                  <th key={h} style={{ textAlign: h === "Régime" ? "left" : "right", padding: "6px 10px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.regimes).map(([nom, r]) => (
                <tr key={nom} onClick={() => setRegimeActif(nom)} style={{ borderBottom: "1px solid #0f172a", background: regimeActif === nom ? "#1e3a5f" : "transparent", cursor: "pointer" }}>
                  <td style={{ padding: "7px 10px", fontWeight: 600 }}>{nom}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", color: r.tresorerie >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{fmtEur(r.tresorerie)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", color: "#f59e0b" }}>{fmtEur(r.impot)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>{fmtPct(r.rendNet)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>{r.tri ? fmt(r.tri, 1) + " ans" : "—"}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", color: r.regle70 < 0.7 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{r.regle70 != null ? fmt(r.regle70, 2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Composant Analyse Communes (existant) ────────────────────────────────────
function AnalyseCommunes() {
  const [communes, setCommunes]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [search, setSearch]           = useState("");
  const [sortKey, setSortKey]         = useState("global");
  const [selected, setSelected]       = useState(null);
  const [detail, setDetail]           = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [filterMin, setFilterMin]     = useState(0);

  const loadCommunes = useCallback(async (force = false) => {
    if (!force) {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        try { setCommunes(JSON.parse(cached)); setLoading(false); return; } catch {}
      }
    }
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API_BASE}/communes`);
      if (!r.ok) throw new Error(`Erreur ${r.status}`);
      const d = await r.json();
      const list = d.communes || [];
      setCommunes(list);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(list));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCommunes(); }, [loadCommunes]);

  const fetchDetail = useCallback(async (nom) => {
    setLoadingDetail(true); setDetail(null);
    try {
      const r = await fetch(`${API_BASE}/analyse/${encodeURIComponent(nom)}`);
      if (!r.ok) throw new Error(`Erreur ${r.status}`);
      setDetail(await r.json());
    } catch (e) { setDetail({ error: e.message }); }
    finally { setLoadingDetail(false); }
  }, []);

  useEffect(() => { if (selected) fetchDetail(selected.nom); }, [selected, fetchDetail]);

  const filtered = useMemo(() => {
    let list = communes.filter((c) => {
      const g = sn(c.scores?.global);
      return c.nom.toLowerCase().includes(search.toLowerCase()) && (g == null || g >= filterMin);
    });
    return list.sort((a, b) => {
      const va = sn(a.scores?.[sortKey]) ?? -1;
      const vb = sn(b.scores?.[sortKey]) ?? -1;
      return vb - va;
    });
  }, [communes, search, sortKey, filterMin]);

  const toggleCompare = (c) => {
    setCompareList((prev) =>
      prev.find((x) => x.nom === c.nom) ? prev.filter((x) => x.nom !== c.nom)
      : prev.length < 4 ? [...prev, c] : prev
    );
  };

  const scoreKeys = [
    { key: "global",      label: "Score global" },
    { key: "rendement",   label: "Rendement" },
    { key: "demographie", label: "Démographie" },
    { key: "socio_eco",   label: "Socio-éco" },
  ];

  return (
    <div style={{ display: "flex", gap: 20, color: "#f1f5f9" }}>
      {/* Liste communes */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Barre de contrôle */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une commune…"
            style={{ flex: 1, minWidth: 160, background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 14px", color: "#f1f5f9", fontSize: 13 }}
          />
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}
            style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", color: "#f1f5f9", fontSize: 13 }}>
            {scoreKeys.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <select value={filterMin} onChange={(e) => setFilterMin(Number(e.target.value))}
            style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", color: "#f1f5f9", fontSize: 13 }}>
            <option value={0}>Tous les scores</option>
            <option value={5}>Score ≥ 5</option>
            <option value={6}>Score ≥ 6</option>
            <option value={7}>Score ≥ 7</option>
          </select>
          <button onClick={() => loadCommunes(true)} style={{ background: "#1d4ed8", border: "none", borderRadius: 8, padding: "8px 14px", color: "#fff", cursor: "pointer", fontSize: 13 }}>
            ↻ Actualiser
          </button>
          {compareList.length > 0 && (
            <button onClick={() => setShowCompare(true)} style={{ background: "#7c3aed", border: "none", borderRadius: 8, padding: "8px 14px", color: "#fff", cursor: "pointer", fontSize: 13 }}>
              Comparer ({compareList.length})
            </button>
          )}
        </div>

        {loading && <div style={{ color: "#64748b", padding: 40, textAlign: "center" }}>Chargement des communes…</div>}
        {error   && <div style={{ color: "#ef4444", padding: 20 }}>Erreur : {error}</div>}

        {!loading && !error && (
          <>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
              {filtered.length} commune{filtered.length > 1 ? "s" : ""} · Clic = détail · Clic long = comparer
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {filtered.map((c) => {
                const g = sn(c.scores?.global);
                const isSelected = selected?.nom === c.nom;
                const isCompared = compareList.find((x) => x.nom === c.nom);
                return (
                  <div key={c.nom}
                    onClick={() => setSelected(isSelected ? null : c)}
                    onContextMenu={(e) => { e.preventDefault(); toggleCompare(c); }}
                    style={{
                      background: isSelected ? "#1e3a5f" : isCompared ? "#2d1b69" : "#0f172a",
                      border: `1px solid ${isSelected ? "#3b82f6" : isCompared ? "#7c3aed" : "#1e293b"}`,
                      borderRadius: 10, padding: "12px 14px", cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{c.nom}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: nc(g) }}>{g != null ? g.toFixed(1) : "—"}</div>
                    </div>
                    {c.population && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{c.population.toLocaleString("fr-FR")} hab.</div>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {["rendement", "demographie", "socio_eco"].map((k) => {
                        const v = sn(c.scores?.[k]);
                        return (
                          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ fontSize: 10, color: "#64748b", width: 70 }}>
                              {k === "rendement" ? "Rendement" : k === "demographie" ? "Démographie" : "Socio-éco"}
                            </div>
                            <ProgressBar value={v} />
                            <div style={{ fontSize: 11, color: nc(v), minWidth: 24, textAlign: "right" }}>{v != null ? v.toFixed(1) : "—"}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Panneau détail */}
      {selected && (
        <div style={{ width: 340, minWidth: 300, background: "#0f172a", borderRadius: 12, padding: 20, overflowY: "auto", maxHeight: "calc(100vh - 80px)" }}>
          {loadingDetail && <div style={{ color: "#64748b", textAlign: "center", marginTop: 40 }}>Chargement…</div>}
          {detail?.error && <div style={{ color: "#ef4444" }}>Erreur : {detail.error}</div>}
          {detail && !detail.error && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{detail.commune}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{detail.code_insee} · Zone {detail.zonage_abc}</div>
                </div>
                <button onClick={() => { setSelected(null); setDetail(null); }} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18 }}>✕</button>
              </div>

              {/* Scores */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Scores</div>
                {[
                  { label: "Global",      v: sn(detail.scores?.global) },
                  { label: "Rendement",   v: sn(detail.scores?.rendement) },
                  { label: "Démographie", v: sn(detail.scores?.demographie) },
                  { label: "Socio-éco",   v: sn(detail.scores?.socio_eco) },
                ].map(({ label, v }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 12, width: 80, color: "#94a3b8" }}>{label}</div>
                    <ProgressBar value={v} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: nc(v), minWidth: 30, textAlign: "right" }}>{v != null ? v.toFixed(1) : "—"}</div>
                    <div style={{ fontSize: 11, color: nc(v), minWidth: 40 }}>{nLabel(v)}</div>
                  </div>
                ))}
              </div>

              {/* Prix */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Prix au m²</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Appartement", value: detail.prix?.appartement_m2 ? `${detail.prix.appartement_m2.toLocaleString("fr-FR")} €/m²` : "—", sub: detail.prix?.nb_ventes_apt ? `${detail.prix.nb_ventes_apt} ventes` : "" },
                    { label: "Maison",      value: detail.prix?.maison_m2 ? `${detail.prix.maison_m2.toLocaleString("fr-FR")} €/m²` : "—",       sub: detail.prix?.nb_ventes_mai ? `${detail.prix.nb_ventes_mai} ventes` : "" },
                  ].map((x) => (
                    <div key={x.label} style={{ background: "#1e293b", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: "#64748b" }}>{x.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{x.value}</div>
                      {x.sub && <div style={{ fontSize: 10, color: "#64748b" }}>{x.sub}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Loyer */}
              {detail.loyer?.appartement_m2 && (
                <div style={{ marginBottom: 14, background: "#1e293b", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "#64748b" }}>Loyer médian</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{detail.loyer.appartement_m2} €/m²/mois</div>
                </div>
              )}

              {/* Rentabilité */}
              {detail.rentabilite_brute_pct && (
                <div style={{ marginBottom: 14, background: "#1e3a5f", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "#64748b" }}>Rentabilité brute estimée</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#60a5fa" }}>{detail.rentabilite_brute_pct} %</div>
                </div>
              )}

              {/* Socio-éco */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Données socio-éco</div>
                {[
                  { label: "Revenu médian",    value: detail.socio_eco?.revenu_median     ? `${detail.socio_eco.revenu_median.toLocaleString("fr-FR")} €` : "—" },
                  { label: "Chômage",          value: detail.socio_eco?.chomage_pct       != null ? `${detail.socio_eco.chomage_pct} %` : "—" },
                  { label: "Taux pauvreté",    value: detail.socio_eco?.taux_pauvrete_pct != null ? `${detail.socio_eco.taux_pauvrete_pct} %` : "—" },
                  { label: "Part cadres",      value: detail.socio_eco?.part_cadres_pct   != null ? `${detail.socio_eco.part_cadres_pct} %` : "—" },
                ].map((x) => (
                  <div key={x.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e293b", fontSize: 13 }}>
                    <span style={{ color: "#94a3b8" }}>{x.label}</span>
                    <span style={{ fontWeight: 600 }}>{x.value}</span>
                  </div>
                ))}
              </div>

              {/* Démographie */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Démographie</div>
                {[
                  { label: "Population",        value: detail.population ? detail.population.toLocaleString("fr-FR") + " hab." : "—" },
                  { label: "Évolution/an",       value: detail.demographie?.evolution_pop_pct_an != null ? `${detail.demographie.evolution_pop_pct_an} %` : "—" },
                  { label: "Vacance logements",  value: detail.demographie?.vacance_pct         != null ? `${detail.demographie.vacance_pct} %` : "—" },
                  { label: "Tension locative",   value: detail.demographie?.tension_locative_pct != null ? `${detail.demographie.tension_locative_pct} %` : "—" },
                ].map((x) => (
                  <div key={x.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e293b", fontSize: 13 }}>
                    <span style={{ color: "#94a3b8" }}>{x.label}</span>
                    <span style={{ fontWeight: 600 }}>{x.value}</span>
                  </div>
                ))}
              </div>

              {detail.prix?.avertissement_apt && (
                <div style={{ background: "#451a03", border: "1px solid #92400e", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#fbbf24", marginBottom: 12 }}>
                  ⚠ {detail.prix.avertissement_apt}
                </div>
              )}
              <div style={{ fontSize: 10, color: "#475569" }}>
                Sources : {detail.prix?.source} · {detail.loyer?.source}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal comparaison */}
      {showCompare && compareList.length > 0 && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowCompare(false)}>
          <div style={{ background: "#0f172a", borderRadius: 16, padding: 24, minWidth: 500, maxWidth: 800, maxHeight: "80vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Comparaison de communes</div>
              <button onClick={() => setShowCompare(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "#64748b" }}>
                  <th style={{ textAlign: "left", padding: "6px 10px" }}>Critère</th>
                  {compareList.map((c) => <th key={c.nom} style={{ textAlign: "right", padding: "6px 10px", color: "#f1f5f9" }}>{c.nom}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Score global",   fn: (c) => sn(c.scores?.global)?.toFixed(1) ?? "—" },
                  { label: "Rendement",      fn: (c) => sn(c.scores?.rendement)?.toFixed(1) ?? "—" },
                  { label: "Démographie",    fn: (c) => sn(c.scores?.demographie)?.toFixed(1) ?? "—" },
                  { label: "Socio-éco",      fn: (c) => sn(c.scores?.socio_eco)?.toFixed(1) ?? "—" },
                  { label: "Population",     fn: (c) => c.population?.toLocaleString("fr-FR") ?? "—" },
                ].map(({ label, fn }) => (
                  <tr key={label} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "7px 10px", color: "#94a3b8" }}>{label}</td>
                    {compareList.map((c) => <td key={c.nom} style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600 }}>{fn(c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12, fontSize: 11, color: "#475569" }}>Clic droit sur une commune pour l'ajouter/retirer de la comparaison</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App principale avec sidebar ─────────────────────────────────────────────
export default function App() {
  const [onglet, setOnglet] = useState("analyse");

  const navItems = [
    { id: "analyse",    label: "Analyse communes", icon: "🗺️" },
    { id: "simulation", label: "Simulation projet", icon: "📊" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0f1e", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside style={{ width: 210, minWidth: 210, background: "#0f172a", borderRight: "1px solid #1e293b", padding: "20px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#3b82f6", marginBottom: 28, paddingLeft: 8, letterSpacing: -0.5 }}>
          📍 Radar Immo 76
        </div>
        {navItems.map((n) => (
          <button key={n.id} onClick={() => setOnglet(n.id)} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600, textAlign: "left", width: "100%",
            background: onglet === n.id ? "#1e3a5f" : "transparent",
            color:      onglet === n.id ? "#60a5fa" : "#64748b",
            transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 16 }}>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 10, color: "#334155", paddingLeft: 8, paddingBottom: 4 }}>
          Sources : DVF · ANIL · INSEE
        </div>
      </aside>

      {/* Contenu principal */}
      <main style={{ flex: 1, padding: 20, overflowY: "auto", minWidth: 0 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", margin: 0 }}>
            {onglet === "analyse"    ? "Analyse investissement — Seine-Maritime" : "Simulation de rentabilité"}
          </h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
            {onglet === "analyse"    ? "💡 Clic = détail · Clic droit = comparer" : "💡 Saisissez les paramètres du projet pour calculer la rentabilité en temps réel"}
          </p>
        </div>
        {onglet === "analyse"    && <AnalyseCommunes />}
        {onglet === "simulation" && <SimulationProjet />}
      </main>
    </div>
  );
}
