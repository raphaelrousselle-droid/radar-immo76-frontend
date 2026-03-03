import React, { useState, useEffect, useCallback, useMemo } from "react";

const API_BASE = "https://radar-immo76-1.onrender.com";

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
  if (nr != null && nd != null && ns != null)
    return nr * 0.4 + nd * 0.3 + ns * 0.3;
  return null;
};

function ProgressBar({ value }) {
  const n = sn(value);
  const pct = Math.min(100, Math.max(0, ((n ?? 0) / 10) * 100));
  return (
    <div style={{ background: "#e5e7eb", borderRadius: 6, height: 10, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${pct}%`, background: nc(n), height: "100%", borderRadius: 6, transition: "width 0.5s ease" }} />
    </div>
  );
}

function CriteriaRow({ label, displayValue, note, info }) {
  const n = sn(note);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {displayValue != null && <span style={{ fontSize: 13, color: "#6b7280" }}>{displayValue}</span>}
          <span style={{ fontSize: 12, fontWeight: 700, color: "white", background: nc(n), borderRadius: 4, padding: "1px 7px", minWidth: 28, textAlign: "center" }}>
            {n != null ? n.toFixed(1) : "—"}/10
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ProgressBar value={n} />
        {info && <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>{info}</span>}
      </div>
    </div>
  );
}

function Gauge({ label, value, weight, onClick, active }) {
  const v = sn(value);
  const color = nc(v);
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = v != null ? ((v / 10) * circ) : 0;
  return (
    <div onClick={onClick} style={{ cursor: "pointer", textAlign: "center", padding: "10px 8px", borderRadius: 10, background: active ? "#f0f9ff" : "#f9fafb", border: `2px solid ${active ? color : "#e5e7eb"}`, transition: "all 0.2s", minWidth: 100, flex: 1 }}>
      <svg width={80} height={80} style={{ display: "block", margin: "0 auto" }}>
        <circle cx={40} cy={40} r={r} fill="none" stroke="#e5e7eb" strokeWidth={7} />
        <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={7} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" transform="rotate(-90 40 40)" />
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

function KpiCard({ label, value, color }) {
  return (
    <div style={{ background: "white", borderRadius: 8, padding: 10, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? "#111827" }}>{value ?? "—"}</div>
    </div>
  );
}

function PanelRendement({ city, apiData }) {
  const pa   = sn(apiData?.prix?.appartement_m2 ?? apiData?.prix?.maison_m2);
  const pm   = sn(apiData?.prix?.maison_m2);
  const lo   = sn(apiData?.loyer?.appartement_m2);
  const rb   = sn(apiData?.rentabilite_brute_pct);
  const nv   = sn(apiData?.prix?.nb_ventes_apt);
  const src1 = apiData?.prix?.source ?? null;
  const src2 = apiData?.loyer?.source ?? null;
  const isApt = apiData?.prix?.appartement_m2 != null;
  const noteRb = rb != null ? Math.min(10, (rb / 12) * 10) : null;
  const notePa = pa != null ? Math.max(0, Math.min(10, 10 - (pa - 800) / 320)) : null;
  const noteLo = lo != null ? Math.min(10, (lo / 15) * 10) : null;
  return (
    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 16, marginTop: 8 }}>
      <h4 style={{ margin: "0 0 14px", fontSize: 14, color: "#15803d", fontWeight: 700 }}>📊 Détail — Rendement Locatif</h4>
      {apiData?.prix?.avertissement_apt && (
        <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#854d0e" }}>
          ⚠️ {apiData.prix.avertissement_apt}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <KpiCard label={isApt ? "Prix appartement (DVF)" : "Prix maison (DVF)"} value={pa != null ? pa.toLocaleString("fr-FR") + " €/m²" + (nv ? ` · ${nv.toLocaleString("fr-FR")} ventes` : "") : null} color="#1e40af" />
        <KpiCard label="Prix maison (DVF)" value={pm != null ? pm.toLocaleString("fr-FR") + " €/m²" : null} color="#1e40af" />
        <KpiCard label="Loyer médian (ANIL)" value={lo != null ? lo.toFixed(1) + " €/m²/mois" : null} color="#7c3aed" />
        <KpiCard label="Rentabilité brute" value={rb != null ? rb.toFixed(2) + "%" : null} color={nc(sn(apiData?.scores?.rendement))} />
      </div>
      {rb != null && lo != null && pa != null && (
        <div style={{ background: "white", borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12, color: "#6b7280", textAlign: "center" }}>
          Calcul : {lo.toFixed(1)} × 12 / {pa.toLocaleString("fr-FR")} × 100 = <strong style={{ color: nc(noteRb) }}>{rb.toFixed(2)}%</strong>
        </div>
      )}
      <CriteriaRow label="Rentabilité brute" displayValue={rb != null ? rb.toFixed(2) + "%" : null} note={noteRb} info="Cible >8%" />
      <CriteriaRow label={isApt ? "Prix d'achat appartement" : "Prix d'achat maison"} displayValue={pa != null ? pa.toLocaleString("fr-FR") + " €/m²" : null} note={notePa} info="Plus bas = mieux" />
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

function PanelDemographie({ city, apiData }) {
  const pop = sn(apiData?.population ?? city?.pop);
  const ev  = sn(apiData?.demographie?.evolution_pop_pct_an ?? city?.ev);
  const vac = sn(apiData?.demographie?.vacance_pct ?? city?.vac);
  const notePop = pop != null ? Math.min(10, Math.max(0, (Math.log10(Math.max(1, pop)) - 2) * 2.5)) : null;
  const noteEv  = ev  != null ? Math.min(10, Math.max(0, 5 + ev * 2)) : null;
  const noteVac = vac != null ? Math.max(0, Math.min(10, 10 - (vac - 5) * 0.8)) : null;
  return (
    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 16, marginTop: 8 }}>
      <h4 style={{ margin: "0 0 14px", fontSize: 14, color: "#1d4ed8", fontWeight: 700 }}>📊 Détail — Attractivité Démographique</h4>
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
    <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 10, padding: 16, marginTop: 8 }}>
      <h4 style={{ margin: "0 0 14px", fontSize: 14, color: "#7c3aed", fontWeight: 700 }}>📊 Détail — Score Socio-Économique</h4>
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

export default function App() {
  const [communes, setCommunes]           = useState([]);
  const [communesLoaded, setCommunesLoaded] = useState(false);
  const [query, setQuery]                 = useState("");
  const [suggestions, setSuggestions]     = useState([]);
  const [city, setCity]                   = useState(null);
  const [apiData, setApiData]             = useState(null);
  const [loading, setLoading]             = useState(false);
  const [activePanel, setActivePanel]     = useState(null);
  const [open, setOpen]                   = useState(false);
  const [sortBy, setSortBy]               = useState("global");
  const [compareList, setCompareList]     = useState([]);
  const [simSurface, setSimSurface]       = useState(50);
  const [simApport, setSimApport]         = useState(20);
  const [simTaux, setSimTaux]             = useState(3.5);
  const [simDuree, setSimDuree]           = useState(20);

 // Au chargement :
const cached = localStorage.getItem(`radar-immo-communes-${CACHE_VERSION}`);

// À la sauvegarde :
localStorage.setItem(`radar-immo-communes-${CACHE_VERSION}`, JSON.stringify(list));
    }
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/communes`);
        if (res.ok) {
          const data = await res.json();
          const list = (data.communes ?? []).map(c => ({
            n:   c.nom,
            pop: sn(c.population),
            sc: {
              r: sn(c.scores?.rendement),
              d: sn(c.scores?.demographie),
              s: sn(c.scores?.socio_eco),
              g: sn(c.scores?.global) ?? calcGlobal(c.scores?.rendement, c.scores?.demographie, c.scores?.socio_eco),
            }
          }));
          setCommunes(list);
          setCommunesLoaded(true);
          localStorage.setItem("radar-immo-communes", JSON.stringify(list));
        }
      } catch { /* garde le cache */ }
    };
    load();
  }, []);

  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}&dep=76`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSuggestions((data.results ?? []).map(c => ({ ...c, _api: true })).slice(0, 10));
    } catch {
      setSuggestions(communes.filter(c => c.n.toLowerCase().includes(q.toLowerCase())).slice(0, 8));
    }
  }, [communes]);

  useEffect(() => {
    const t = setTimeout(() => { if (query) fetchSuggestions(query); }, 250);
    return () => clearTimeout(t);
  }, [query, fetchSuggestions]);

  const fetchCommune = useCallback(async (name) => {
    setLoading(true);
    setApiData(null);
    setActivePanel(null);
    try {
      const res = await fetch(`${API_BASE}/analyse/${encodeURIComponent(name)}`);
      if (res.ok) {
        const d = await res.json();
        setApiData(d ?? null);
        if (d?.scores) {
          const g = sn(d.scores.global) ?? calcGlobal(d.scores.rendement, d.scores.demographie, d.scores.socio_eco);
          setCommunes(prev => prev.map(c =>
            c.n.toLowerCase() === name.toLowerCase()
              ? { ...c, sc: { r: sn(d.scores.rendement) ?? c.sc.r, d: sn(d.scores.demographie) ?? c.sc.d, s: sn(d.scores.socio_eco) ?? c.sc.s, g: g ?? c.sc.g } }
              : c
          ));
        }
      }
    } catch { setApiData(null); }
    setLoading(false);
  }, []);

  const select = useCallback((c) => {
    try {
      const name = c.commune ?? c.n ?? "";
      const staticCity =
        communes.find(d => d.n.toLowerCase() === name.toLowerCase()) ?? {
          n: name, pop: sn(c.population) ?? null,
          sc: { r: null, d: null, s: null, g: null },
        };
      setCity(staticCity);
      setQuery(name);
      setSuggestions([]);
      setOpen(false);
      fetchCommune(name);
    } catch (e) { console.error("select error", e); }
  }, [communes, fetchCommune]);

  const sorted = useMemo(() => {
    return [...communes].sort((a, b) => {
      if (sortBy === "rendement")   return (b.sc?.r ?? 0) - (a.sc?.r ?? 0);
      if (sortBy === "demographie") return (b.sc?.d ?? 0) - (a.sc?.d ?? 0);
      if (sortBy === "socioeco")    return (b.sc?.s ?? 0) - (a.sc?.s ?? 0);
      if (sortBy === "population")  return (b.pop  ?? 0)  - (a.pop  ?? 0);
      return (b.sc?.g ?? 0) - (a.sc?.g ?? 0);
    });
  }, [communes, sortBy]);

  const displayed =
    query.length < 2 ? sorted
    : suggestions.length ? suggestions
    : sorted.filter(c => c.n.toLowerCase().includes(query.toLowerCase()));

  const sr = sn(apiData?.scores?.rendement   ?? city?.sc?.r);
  const sd = sn(apiData?.scores?.demographie ?? city?.sc?.d);
  const se = sn(apiData?.scores?.socio_eco   ?? city?.sc?.s);
  const globalNote = sn(apiData?.scores?.global) ?? calcGlobal(sr, sd, se) ?? sn(city?.sc?.g);
  const scores = city ? { r: sr, d: sd, s: se, g: globalNote } : null;

  const pa     = sn(apiData?.prix?.appartement_m2 ?? apiData?.prix?.maison_m2);
  const pm     = sn(apiData?.prix?.maison_m2);
  const lo     = sn(apiData?.loyer?.appartement_m2);
  const rb     = sn(apiData?.rentabilite_brute_pct);
  const ch     = sn(apiData?.socio_eco?.chomage_pct);
  const rv     = sn(apiData?.socio_eco?.revenu_median);
  const popAff = sn(apiData?.population ?? city?.pop);
  const isApt  = apiData?.prix?.appartement_m2 != null;

  const inCompare = city ? !!compareList.find(c => c.n === city.n) : false;
  const toggleCompare = () => {
    if (!city) return;
    if (inCompare) {
      setCompareList(compareList.filter(c => c.n !== city.n));
    } else if (compareList.length < 3) {
      setCompareList([...compareList, { n: city.n, scores, pa, lo, rb, pop: popAff }]);
    }
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", background: "#f3f4f6", minHeight: "100vh", padding: 16 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)", borderRadius: 14, padding: "20px 24px", marginBottom: 16, color: "white" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🏠 Radar Immo 76</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.8 }}>Analyse investissement — Seine-Maritime</p>
        </div>

        {/* Barre de recherche */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Tapez 2 lettres pour chercher une commune Seine-Maritime…"
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 16px", borderRadius: 10, border: "2px solid #e5e7eb", fontSize: 14, background: "white", outline: "none" }}
          />
          {open && displayed.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", borderRadius: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.12)", zIndex: 100, maxHeight: 280, overflowY: "auto", border: "1px solid #e5e7eb", marginTop: 4 }}>
              {displayed.map((c, i) => {
                const isApi = !!c._api;
                const scG   = isApi ? null : sn(c.sc?.g);
                return (
                  <div key={i} onClick={() => select(c)}
                    style={{ padding: "10px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f3f4f6" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={e => (e.currentTarget.style.background = "white")}
                  >
                    <span style={{ fontSize: 14, color: "#111827" }}>{c.commune ?? c.n}</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {isApi && <span style={{ fontSize: 10, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>DVF</span>}
                      {scG != null && <span style={{ fontSize: 12, fontWeight: 700, color: "white", background: nc(scG), borderRadius: 4, padding: "2px 8px" }}>{scG.toFixed(1)}</span>}
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

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <button
                onClick={() => { setCity(null); setApiData(null); setQuery(""); setActivePanel(null); }}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, color: "#6b7280", fontFamily: "inherit" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                ← Retour
              </button>
              <button onClick={toggleCompare}
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit", border: "1px solid #2563eb", background: inCompare ? "#2563eb" : "white", color: inCompare ? "white" : "#2563eb", fontWeight: 600 }}
              >
                {inCompare ? "✓ Dans le comparateur" : compareList.length >= 3 ? "Comparateur plein (3/3)" : "+ Comparer"}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>{city.n}</h2>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                  {popAff != null ? popAff.toLocaleString("fr-FR") + " hab. · " : ""}Seine-Maritime (76)
                  {loading && <span style={{ marginLeft: 8, color: "#f59e0b" }}>⏳ Chargement…</span>}
                  {!loading && apiData && <span style={{ marginLeft: 8, color: "#22c55e", fontWeight: 600 }}>✅ DVF + ANIL</span>}
                </div>
              </div>
              <div style={{ textAlign: "center", minWidth: 80 }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: nc(scores?.g) }}>{scores?.g != null ? scores.g.toFixed(1) : "—"}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>Note /10</div>
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>40% rend · 30% démo · 30% socio</div>
              </div>
            </div>

            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#9ca3af" }}>💡 Clique sur une jauge ou une ligne pour voir le détail</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <Gauge label="Rendement"   value={scores?.r} weight={40} active={activePanel === "rendement"}   onClick={() => setActivePanel(p => p === "rendement"   ? null : "rendement")} />
              <Gauge label="Démographie" value={scores?.d} weight={30} active={activePanel === "demographie"} onClick={() => setActivePanel(p => p === "demographie" ? null : "demographie")} />
              <Gauge label="Socio-Éco"   value={scores?.s} weight={30} active={activePanel === "socioeco"}    onClick={() => setActivePanel(p => p === "socioeco"    ? null : "socioeco")} />
            </div>

            <div style={{ marginBottom: 16, borderBottom: "1px solid #f3f4f6", paddingBottom: 14 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#374151" }}>📋 Chiffres clés</h3>
              {apiData?.prix?.avertissement_apt && (
                <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#854d0e" }}>
                  ⚠️ {apiData.prix.avertissement_apt}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                <KpiCard label={isApt ? "Prix appt (DVF)" : "Prix maison (DVF)"} value={pa != null ? pa.toLocaleString("fr-FR") + " €/m²" : null} color="#1e40af" />
                <KpiCard label="Prix maison (DVF)"   value={pm != null ? pm.toLocaleString("fr-FR") + " €/m²" : null} color="#1e40af" />
                <KpiCard label="Loyer médian (ANIL)" value={lo != null ? lo.toFixed(1) + " €/m²/mois" : null} color="#7c3aed" />
                <KpiCard label="Rentabilité brute"   value={rb != null ? rb.toFixed(2) + "%" : null} color={nc(scores?.r)} />
                <KpiCard label="Chômage"             value={ch != null ? ch.toFixed(1) + "%" : null} color={ch != null && ch < 10 ? "#22c55e" : "#ef4444"} />
                <KpiCard label="Revenu médian"       value={rv != null ? rv.toLocaleString("fr-FR") + " €/an" : null} color="#374151" />
              </div>
            </div>

            <div style={{ marginBottom: 16, borderBottom: "1px solid #f3f4f6", paddingBottom: 14 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#374151" }}>📊 Vue synthétique</h3>
              <div onClick={() => setActivePanel(p => p === "rendement" ? null : "rendement")}
                style={{ cursor: "pointer", borderRadius: 8, padding: "4px 8px", margin: "0 -8px", background: activePanel === "rendement" ? "#f0fdf4" : "transparent" }}>
                <CriteriaRow label="🏦 Rendement locatif (40%)" note={scores?.r} info={scores?.r != null ? `→ ${(scores.r * 0.4).toFixed(2)} pts` : undefined} />
              </div>
              {activePanel === "rendement" && <PanelRendement city={city} apiData={apiData} />}

              <div onClick={() => setActivePanel(p => p === "demographie" ? null : "demographie")}
                style={{ cursor: "pointer", borderRadius: 8, padding: "4px 8px", margin: "0 -8px", background: activePanel === "demographie" ? "#eff6ff" : "transparent" }}>
                <CriteriaRow label="👥 Démographie (30%)" note={scores?.d} info={scores?.d != null ? `→ ${(scores.d * 0.3).toFixed(2)} pts` : undefined} />
              </div>
              {activePanel === "demographie" && <PanelDemographie city={city} apiData={apiData} />}

              <div onClick={() => setActivePanel(p => p === "socioeco" ? null : "socioeco")}
                style={{ cursor: "pointer", borderRadius: 8, padding: "4px 8px", margin: "0 -8px", background: activePanel === "socioeco" ? "#faf5ff" : "transparent" }}>
                <CriteriaRow label="💼 Socio-économique (30%)" note={scores?.s} info={scores?.s != null ? `→ ${(scores.s * 0.3).toFixed(2)} pts` : undefined} />
              </div>
              {activePanel === "socioeco" && <PanelSocioEco city={city} apiData={apiData} />}

              <div style={{ height: 1, background: "#f3f4f6", margin: "8px 0" }} />
              <CriteriaRow label="⭐ Note globale pondérée" note={scores?.g} />
            </div>

            {pa != null && lo != null && (
              <div>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#374151" }}>🧮 Simulateur d'investissement</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    { label: "Surface (m²)", value: simSurface, set: setSimSurface, min: 10,  max: 200, step: 1 },
                    { label: "Apport (%)",   value: simApport,  set: setSimApport,  min: 0,   max: 100, step: 1 },
                    { label: "Taux (%)",     value: simTaux,    set: setSimTaux,    min: 0.5, max: 10,  step: 0.1 },
                    { label: "Durée (ans)",  value: simDuree,   set: setSimDuree,   min: 5,   max: 30,  step: 1 },
                  ].map(({ label, value, set, min, max, step }) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{label}</div>
                      <input type="number" value={value} min={min} max={max} step={step}
                        onChange={e => set(Number(e.target.value))}
                        style={{ width: "100%", boxSizing: "border-box", padding: "6px 10px", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 14, fontFamily: "inherit" }}
                      />
                    </div>
                  ))}
                </div>
                {(() => {
                  const prixTotal    = pa * simSurface;
                  const emprunt      = prixTotal * (1 - simApport / 100);
                  const tauxMensuel  = simTaux / 100 / 12;
                  const nbMois       = simDuree * 12;
                  const mensualite   = emprunt * tauxMensuel / (1 - Math.pow(1 + tauxMensuel, -nbMois));
                  const loyerMensuel = lo * simSurface;
                  const cashflow     = loyerMensuel - mensualite;
                  const rentaNette   = (loyerMensuel * 12 / prixTotal) * 100;
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                      <KpiCard label="Prix total estimé"  value={prixTotal.toLocaleString("fr-FR") + " €"} color="#1e40af" />
                      <KpiCard label="Mensualité crédit"  value={mensualite.toFixed(0) + " €/mois"} color="#ef4444" />
                      <KpiCard label="Loyer estimé"       value={loyerMensuel.toFixed(0) + " €/mois"} color="#7c3aed" />
                      <KpiCard label="Cashflow mensuel"   value={(cashflow >= 0 ? "+" : "") + cashflow.toFixed(0) + " €"} color={cashflow >= 0 ? "#22c55e" : "#ef4444"} />
                      <KpiCard label="Rentabilité nette"  value={rentaNette.toFixed(2) + "%"} color={nc(rentaNette > 5 ? 7 : rentaNette > 3 ? 5 : 3)} />
                      <KpiCard label="Emprunt total"      value={emprunt.toLocaleString("fr-FR") + " €"} color="#374151" />
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Ranking */}
        {!city && (
          <div style={{ background: "white", borderRadius: 14, padding: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#374151" }}>🏆 Classement Seine-Maritime</h3>
              {!communesLoaded && (
                <span style={{ fontSize: 12, color: "#f59e0b" }}>⏳ Chargement…</span>
              )}
              {communesLoaded && (
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{communes.length} communes</span>
              )}
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {[
                { key: "global",      label: "⭐ Global" },
                { key: "rendement",   label: "🏦 Rendement" },
                { key: "demographie", label: "👥 Démo" },
                { key: "socioeco",    label: "💼 Socio" },
                { key: "population",  label: "👤 Population" },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setSortBy(key)} style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                  fontFamily: "inherit", fontWeight: sortBy === key ? 700 : 400,
                  background: sortBy === key ? "#2563eb" : "#f3f4f6",
                  color: sortBy === key ? "white" : "#374151", border: "none"
                }}>{label}</button>
              ))}
            </div>

            {communes.length === 0 && (
              <div style={{ textAlign: "center", padding: 32, color: "#9ca3af", fontSize: 13 }}>
                ⏳ Chargement des communes…
              </div>
            )}

            {sorted.slice(0, 50).map((c, i) => (
              <div key={i} onClick={() => select(c)}
                style={{ display: "flex", alignItems: "center", padding: "8px 4px", borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={e => (e.currentTarget.style.background = "white")}
              >
                <span style={{ width: 28, fontSize: 13, color: "#9ca3af", fontWeight: 600 }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 14, color: "#111827", fontWeight: 500 }}>{c.n}</span>
                <span style={{ fontSize: 12, color: "#6b7280", marginRight: 10 }}>
                  {c.pop != null ? c.pop.toLocaleString("fr-FR") + " hab." : ""}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "white", background: nc(c.sc?.g), borderRadius: 5, padding: "2px 9px" }}>
                  {sn(c.sc?.g)?.toFixed(1) ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Comparateur */}
        {compareList.length >= 2 && (
          <div style={{ background: "white", borderRadius: 14, padding: 16, marginTop: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#374151" }}>⚖️ Comparateur</h3>
              <button onClick={() => setCompareList([])} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af", fontFamily: "inherit" }}>Effacer</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <td style={{ padding: "6px 8px", color: "#6b7280" }}></td>
                  {compareList.map(c => (
                    <td key={c.n} style={{ padding: "6px 8px", fontWeight: 700, textAlign: "center", color: "#111827" }}>{c.n}</td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "⭐ Note globale", fn: c => c.scores?.g != null ? <span style={{ fontWeight: 800, color: nc(c.scores.g) }}>{c.scores.g.toFixed(1)}</span> : "—" },
                  { label: "🏦 Rendement",    fn: c => c.scores?.r != null ? <span style={{ color: nc(c.scores.r) }}>{c.scores.r.toFixed(1)}</span> : "—" },
                  { label: "👥 Démographie",  fn: c => c.scores?.d != null ? <span style={{ color: nc(c.scores.d) }}>{c.scores.d.toFixed(1)}</span> : "—" },
                  { label: "💼 Socio-éco",    fn: c => c.scores?.s != null ? <span style={{ color: nc(c.scores.s) }}>{c.scores.s.toFixed(1)}</span> : "—" },
                  { label: "💰 Prix m²",      fn: c => c.pa != null ? c.pa.toLocaleString("fr-FR") + " €" : "—" },
                  { label: "🏠 Loyer m²",     fn: c => c.lo != null ? c.lo.toFixed(1) + " €" : "—" },
                  { label: "📈 Rentabilité",  fn: c => c.rb != null ? c.rb.toFixed(2) + "%" : "—" },
                  { label: "👤 Population",   fn: c => c.pop != null ? c.pop.toLocaleString("fr-FR") + " hab." : "—" },
                ].map(({ label, fn }) => (
                  <tr key={label} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 8px", color: "#6b7280", fontWeight: 500 }}>{label}</td>
                    {compareList.map(c => (
                      <td key={c.n} style={{ padding: "8px 8px", textAlign: "center", fontWeight: 600 }}>{fn(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 16 }}>
          Prix DVF Cerema · Loyers ANIL 2024 · Géo API INSEE
        </p>
      </div>
    </div>
  );
}
