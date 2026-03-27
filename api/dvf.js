// api/dvf.js — Lit dvf_76.csv (prix agrégés par commune)
import fs from "fs";
import path from "path";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { code_commune } = req.query;
    if (!code_commune) {
      return res.status(400).json({ error: "Paramètre code_commune requis." });
    }

    const csvPath = path.join(process.cwd(), "dvf_76.csv");
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ error: "Fichier dvf_76.csv introuvable à la racine du repo." });
    }

    const raw = fs.readFileSync(csvPath, "utf-8");
    const lines = raw.split("\n").filter(Boolean);
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

    // Trouver la ligne correspondant au code_commune
    // Le code INSEE dans dvf_76.csv est à 5 chiffres (ex: 76217)
    // mais peut aussi être stocké sans le zéro initial sur certains CSV
    const codeRecherche = code_commune.toString().trim();

    let found = null;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const codeCol = (cols[0] || "").toString().trim();
      // Comparer avec et sans padding à 5 chiffres
      if (
        codeCol === codeRecherche ||
        codeCol.padStart(5, "0") === codeRecherche.padStart(5, "0")
      ) {
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = cols[idx] || ""; });
        found = obj;
        break;
      }
    }

    if (!found) {
      return res.status(200).json({ found: false, message: "Commune non trouvée dans dvf_76.csv" });
    }

    const pf = (v) => {
      const n = parseFloat(String(v).replace(",", "."));
      return isNaN(n) ? null : Math.round(n);
    };

    return res.status(200).json({
      found: true,
      code_commune: codeRecherche,
      prix_appt_m2:   pf(found.prix_appt_m2),
      nb_ventes_apt:  pf(found.nb_ventes_apt),
      prix_maison_m2: pf(found.prix_maison_m2),
      nb_ventes_mai:  pf(found.nb_ventes_mai),
    });

  } catch (err) {
    console.error("Erreur lecture DVF CSV :", err);
    return res.status(500).json({ error: err.message });
  }
}
