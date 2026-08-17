// api/dpe.js — Proxy Vercel pour l'API ADEME DPE + BAN
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, q, lat, lon, adresse_brut } = req.query;

  try {
    // ── 1. Geocoder via API BAN ──────────────────────────────────────────────
    if (action === "geocode") {
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("BAN " + r.status);
      const data = await r.json();
      return res.status(200).json(data);
    }

    // ── 2. DPE par coordonnées GPS ────────────────────────────────────────────
    if (action === "dpe_coords") {
      // L'API ADEME DPE logements existants — filtrage par commune + adresse
      // On passe par le dataset dpe-v2-logements-existants
      const fields = "numero_dpe,date_etablissement_dpe,etiquette_dpe,etiquette_ges,consommation_energie,emission_ges,surface_habitable_logement,annee_construction,type_batiment_dpe,type_energie_principale_chauffage,type_installation_chauffage,type_isolation_mur_interieur,type_isolation_plancher_bas_derriere_ecran,type_vitrage,adresse_ban,commune_ban,code_postal_ban";

      // Chercher par latitude/longitude via bbox (boite de 200m autour du point)
      const latN = parseFloat(lat), lonN = parseFloat(lon);
      const delta = 0.001; // ~100m
      const params = new URLSearchParams({
        bbox: `${lonN-delta},${latN-delta},${lonN+delta},${latN+delta}`,
        size: 10,
        sort: "-date_etablissement_dpe",
        select: fields,
      });

      const url = `https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines?${params}`;
      const r = await fetch(url, { headers: { "User-Agent": "RadarImmo76/1.0" } });
      if (!r.ok) throw new Error("ADEME " + r.status);
      const data = await r.json();
      return res.status(200).json({ results: data.results || [] });
    }

    // ── 3. DPE par adresse texte ──────────────────────────────────────────────
    if (action === "dpe_adresse") {
      const fields = "numero_dpe,date_etablissement_dpe,etiquette_dpe,etiquette_ges,consommation_energie,emission_ges,surface_habitable_logement,annee_construction,type_batiment_dpe,type_energie_principale_chauffage,type_installation_chauffage,type_isolation_mur_interieur,type_isolation_plancher_bas_derriere_ecran,type_vitrage,adresse_ban,commune_ban,code_postal_ban";

      const params = new URLSearchParams({
        q: adresse_brut || q,
        size: 5,
        sort: "-date_etablissement_dpe",
        select: fields,
      });

      const url = `https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines?${params}`;
      const r = await fetch(url, { headers: { "User-Agent": "RadarImmo76/1.0" } });
      if (!r.ok) throw new Error("ADEME " + r.status);
      const data = await r.json();
      return res.status(200).json({ results: data.results || [] });
    }

    return res.status(400).json({ error: "Action inconnue" });

  } catch (err) {
    console.error("Proxy DPE:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
