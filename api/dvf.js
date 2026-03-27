// api/dvf.js — Proxy Vercel pour l'API DVF (contourne le blocage CORS)
// Ce fichier doit être placé dans le dossier /api/ de ton projet Vercel

export default async function handler(req, res) {
  // Autoriser les appels depuis n'importe quelle origine (ton propre domaine Vercel)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Récupérer les paramètres passés par le composant DVFPanel
    const params = new URLSearchParams(req.query);

    // Appel côté serveur à l'API cquest — pas de blocage CORS côté serveur
    const url = `https://api.cquest.org/dvf?${params.toString()}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "RadarImmo76/1.0" },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Erreur API DVF : ${response.status}`,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error("Erreur proxy DVF :", err);
    return res.status(500).json({ error: err.message });
  }
}
