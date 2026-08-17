// api/dpe.js — Proxy Vercel pour l'API ADEME DPE + BAN (évite CORS)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, q, lat, lon, adresse_brut } = req.query;

  try {
    // ── 1. Geocoder une adresse via l'API BAN ──────────────────────────────
    if (action === "geocode") {
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5&type=housenumber`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("BAN API error " + r.status);
      const data = await r.json();
      return res.status(200).json(data);
    }

    // ── 2. Chercher le DPE par adresse dans la base ADEME ─────────────────
    if (action === "dpe_adresse") {
      // Chercher par adresse normalisée (champ adresse_brut = adresse concaténée)
      const params = new URLSearchParams({
        q: adresse_brut || q,
        size: 5,
        select: [
          "numero_dpe",
          "date_etablissement_dpe",
          "etiquette_dpe",
          "etiquette_ges",
          "consommation_energie",
          "emission_ges",
          "surface_habitable_logement",
          "annee_construction",
          "type_batiment",
          "type_energie_principale_chauffage",
          "type_installation_chauffage",
          "type_isolation_mur_interieur",
          "type_isolation_plancher_bas",
          "type_vitrage",
          "adresse_ban",
          "commune",
          "code_postal_ban",
        ].join(","),
      });

      const url = `https://data.ademe.fr/data-fair/api/v1/datasets/dpe-france/lines?${params}`;
      const r = await fetch(url, {
        headers: { "User-Agent": "RadarImmo76/1.0" },
      });
      if (!r.ok) throw new Error("ADEME API error " + r.status);
      const data = await r.json();
      return res.status(200).json(data);
    }

    // ── 3. Chercher DPE par coordonnées GPS (rayon 50m) ───────────────────
    if (action === "dpe_coords") {
      const params = new URLSearchParams({
        geo_distance: `${lat},${lon},50m`,
        size: 10,
        sort: "date_etablissement_dpe:desc",
        select: [
          "numero_dpe",
          "date_etablissement_dpe",
          "etiquette_dpe",
          "etiquette_ges",
          "consommation_energie",
          "emission_ges",
          "surface_habitable_logement",
          "annee_construction",
          "type_batiment",
          "type_energie_principale_chauffage",
          "type_installation_chauffage",
          "type_isolation_mur_interieur",
          "type_isolation_plancher_bas",
          "type_vitrage",
          "adresse_ban",
          "commune",
          "code_postal_ban",
        ].join(","),
      });

      const url = `https://data.ademe.fr/data-fair/api/v1/datasets/dpe-france/lines?${params}`;
      const r = await fetch(url, {
        headers: { "User-Agent": "RadarImmo76/1.0" },
      });
      if (!r.ok) throw new Error("ADEME API error " + r.status);
      const data = await r.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: "Action inconnue" });
  } catch (err) {
    console.error("Proxy DPE error:", err);
    return res.status(500).json({ error: err.message });
  }
}
