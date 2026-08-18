// api/dpe.js — Proxy BAN + ADEME DPE avec les vrais noms de colonnes
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, q, lat, lon } = req.query;

  try {
    // ── 1. Géocoder via API BAN ──────────────────────────────────────────────
    if (action === "geocode") {
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("BAN " + r.status);
      return res.status(200).json(await r.json());
    }

    // ── 2. DPE par coordonnées GPS ────────────────────────────────────────────
    if (action === "dpe_coords") {
      const latN = parseFloat(lat);
      const lonN = parseFloat(lon);
      const delta = 0.002; // ~200m

      // Noms réels des colonnes dans l'API ADEME dpe-v2-logements-existants
      const select = [
        "N°DPE",
        "Date_établissement_DPE",
        "Etiquette_DPE",
        "Etiquette_GES",
        "Consommation_Energie_primaire",
        "Emission_GES_5_usages_par_m²",
        "Surface_habitable_logement",
        "Année_construction",
        "Type_bâtiment",
        "Type_énergie_principale_chauffage",
        "Type_installation_chauffage",
        "Type_isolation_mur_intérieur",
        "Type_vitrage",
        "Adresse_(BAN)",
        "Commune_(BAN)",
        "Code_postal_(BAN)",
      ].join(",");

      const params = new URLSearchParams({
        bbox: `${lonN - delta},${latN - delta},${lonN + delta},${latN + delta}`,
        size: "10",
        sort: "-Date_établissement_DPE",
        select,
      });

      const url = `https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines?${params}`;
      const r = await fetch(url, { headers: { "User-Agent": "RadarImmo76/1.0" } });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error("ADEME " + r.status + " — " + txt.slice(0, 200));
      }
      const data = await r.json();

      // Normaliser les clés pour le front
      const results = (data.results || []).map(normalise);
      return res.status(200).json({ results });
    }

    // ── 3. DPE par adresse texte ──────────────────────────────────────────────
    if (action === "dpe_adresse") {
      const adresse = req.query.adresse_brut || q || "";
      const select = [
        "N°DPE",
        "Date_établissement_DPE",
        "Etiquette_DPE",
        "Etiquette_GES",
        "Consommation_Energie_primaire",
        "Emission_GES_5_usages_par_m²",
        "Surface_habitable_logement",
        "Année_construction",
        "Type_bâtiment",
        "Type_énergie_principale_chauffage",
        "Type_installation_chauffage",
        "Type_isolation_mur_intérieur",
        "Type_vitrage",
        "Adresse_(BAN)",
        "Commune_(BAN)",
        "Code_postal_(BAN)",
      ].join(",");

      const params = new URLSearchParams({
        q: adresse,
        size: "5",
        sort: "-Date_établissement_DPE",
        select,
      });

      const url = `https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines?${params}`;
      const r = await fetch(url, { headers: { "User-Agent": "RadarImmo76/1.0" } });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error("ADEME " + r.status + " — " + txt.slice(0, 200));
      }
      const data = await r.json();
      const results = (data.results || []).map(normalise);
      return res.status(200).json({ results });
    }

    return res.status(400).json({ error: "Action inconnue : " + action });

  } catch (err) {
    console.error("Proxy DPE:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

// Normaliser les clés ADEME (avec accents/majuscules) vers des clés simples
function normalise(d) {
  return {
    numero_dpe:                   d["N°DPE"] || "",
    date_etablissement_dpe:       d["Date_établissement_DPE"] || "",
    etiquette_dpe:                d["Etiquette_DPE"] || "",
    etiquette_ges:                d["Etiquette_GES"] || "",
    consommation_energie:         d["Consommation_Energie_primaire"] || 0,
    emission_ges:                 d["Emission_GES_5_usages_par_m²"] || 0,
    surface_habitable_logement:   d["Surface_habitable_logement"] || 0,
    annee_construction:           d["Année_construction"] || "",
    type_batiment:                d["Type_bâtiment"] || "",
    type_energie_chauffage:       d["Type_énergie_principale_chauffage"] || "",
    type_installation_chauffage:  d["Type_installation_chauffage"] || "",
    type_isolation_mur:           d["Type_isolation_mur_intérieur"] || "",
    type_vitrage:                 d["Type_vitrage"] || "",
    adresse:                      d["Adresse_(BAN)"] || "",
    commune:                      d["Commune_(BAN)"] || "",
    code_postal:                  d["Code_postal_(BAN)"] || "",
  };
}
