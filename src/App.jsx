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
