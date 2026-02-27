import os
import io
import math
import requests
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Chargement CSV DVF au démarrage ─────────────────────────────────────────
DVF_URL = "https://raw.githubusercontent.com/raphaelrousselle-droid/radar-immo76/main/dvf_76.csv"
LOYERS_URL = "https://raw.githubusercontent.com/raphaelrousselle-droid/radar-immo76/main/loyers_76.csv"

MIN_VENTES_APT = 10   # seuil fiabilité appartements
MIN_VENTES_MAI = 5    # seuil fiabilité maisons

df_dvf    = None
df_loyers = None

def load_data():
    global df_dvf, df_loyers

    # DVF
    try:
        r = requests.get(DVF_URL, timeout=15)
        r.raise_for_status()
        sep = ";" if ";" in r.text[:500] else ","
        df_dvf = pd.read_csv(io.StringIO(r.text), sep=sep, dtype={"code_insee": str})
        df_dvf["code_insee"] = df_dvf["code_insee"].astype(str).str.zfill(5)
        print(f"DVF chargé : {len(df_dvf)} communes")
    except Exception as e:
        print(f"Erreur chargement DVF : {e}")
        df_dvf = pd.DataFrame()

    # Loyers ANIL
    try:
        r = requests.get(LOYERS_URL, timeout=15)
        r.raise_for_status()
        sep = ";" if ";" in r.text[:500] else ","
        df_loyers = pd.read_csv(io.StringIO(r.text), sep=sep, dtype={"code_insee": str})
        df_loyers["code_insee"] = df_loyers["code_insee"].astype(str).str.zfill(5)
        print(f"Loyers chargé : {len(df_loyers)} communes")
    except Exception as e:
        print(f"Erreur chargement Loyers : {e}")
        df_loyers = pd.DataFrame()

load_data()

# ─── Helpers ─────────────────────────────────────────────────────────────────
def safe_float(v):
    try:
        f = float(v)
        return f if not math.isnan(f) else None
    except:
        return None

def safe_int(v):
    try:
        return int(v)
    except:
        return None

def get_dvf(code_insee: str):
    """Retourne les prix DVF fiables pour un code INSEE."""
    if df_dvf is None or df_dvf.empty:
        return None, None, None, None

    row = df_dvf[df_dvf["code_insee"] == code_insee]
    if row.empty:
        return None, None, None, None

    row = row.iloc[0]

    nb_apt = safe_int(row.get("nb_ventes_apt", 0)) or 0
    nb_mai = safe_int(row.get("nb_ventes_mai", 0)) or 0
    prix_apt_raw = safe_float(row.get("prix_appt_m2"))
    prix_mai_raw = safe_float(row.get("prix_maison_m2"))

    # Fiabilité : seuil minimum de ventes
    prix_apt = prix_apt_raw if (prix_apt_raw and nb_apt >= MIN_VENTES_APT) else None
    prix_mai = prix_mai_raw if (prix_mai_raw and nb_mai >= MIN_VENTES_MAI) else None

    return prix_apt, prix_mai, nb_apt, nb_mai

def get_loyer(code_insee: str):
    """Retourne le loyer médian ANIL pour un code INSEE."""
    if df_loyers is None or df_loyers.empty:
        return None

    row = df_loyers[df_loyers["code_insee"] == code_insee]
    if row.empty:
        return None

    row = row.iloc[0]
    for col in ["loyer_median", "loyer", "loyer_m2", "loy_m2"]:
        v = safe_float(row.get(col))
        if v:
            return v
    return None

def get_geo(commune: str):
    """Résolution INSEE via API Géo."""
    try:
        r = requests.get(
            "https://geo.api.gouv.fr/communes",
            params={"nom": commune, "codeDepartement": "76", "fields": "code,nom,population", "limit": 1},
            timeout=8
        )
        data = r.json()
        if data:
            return data[0].get("code"), data[0].get("nom"), safe_int(data[0].get("population"))
    except:
        pass
    return None, commune, None

# ─── Calcul des scores ────────────────────────────────────────────────────────
def score_rendement(rentabilite_pct):
    """Score /10 basé sur la rentabilité brute."""
    if rentabilite_pct is None:
        return 5.0
    if rentabilite_pct >= 10:  return 10.0
    if rentabilite_pct >= 8:   return 8.0 + (rentabilite_pct - 8) / 2
    if rentabilite_pct >= 6:   return 6.0 + (rentabilite_pct - 6)
    if rentabilite_pct >= 4:   return 3.0 + (rentabilite_pct - 4) * 1.5
    return max(1.0, rentabilite_pct * 0.75)

def score_demographie(pop, ev_pct, vacance_pct):
    s = 5.0
    if pop:
        if pop > 50000: s += 2.0
        elif pop > 10000: s += 1.0
        elif pop > 5000:  s += 0.5
        elif pop < 2000:  s -= 1.0
    if ev_pct is not None:
        s += min(2.0, max(-2.0, ev_pct * 2))
    if vacance_pct is not None:
        if vacance_pct < 6:   s += 1.0
        elif vacance_pct < 9: s += 0.0
        elif vacance_pct < 12: s -= 0.5
        else:                  s -= 1.5
    return round(min(10.0, max(1.0, s)), 2)

def score_socioeco(chomage, revenu, cadres, pauvrete):
    s = 5.0
    if chomage is not None:
        if chomage < 7:    s += 2.0
        elif chomage < 10: s += 1.0
        elif chomage < 13: s += 0.0
        elif chomage < 17: s -= 1.0
        else:              s -= 2.0
    if revenu is not None:
        if revenu > 25000:   s += 1.5
        elif revenu > 20000: s += 0.5
        elif revenu > 16000: s += 0.0
        else:                s -= 1.0
    if cadres is not None:
        if cadres > 20: s += 1.0
        elif cadres > 10: s += 0.5
    if pauvrete is not None:
        if pauvrete < 10:  s += 0.5
        elif pauvrete > 20: s -= 1.0
    return round(min(10.0, max(1.0, s)), 2)

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "dvf_communes": len(df_dvf) if df_dvf is not None else 0,
        "loyers_communes": len(df_loyers) if df_loyers is not None else 0,
        "min_ventes_apt": MIN_VENTES_APT,
        "min_ventes_mai": MIN_VENTES_MAI,
    }

@app.get("/search")
def search(q: str = "", dep: str = "76"):
    """Recherche de communes par nom."""
    try:
        r = requests.get(
            "https://geo.api.gouv.fr/communes",
            params={"nom": q, "codeDepartement": dep, "fields": "code,nom,population", "limit": 10},
            timeout=8
        )
        results = [
            {"commune": c["nom"], "code_insee": c["code"], "population": c.get("population")}
            for c in r.json()
        ]
        return {"results": results}
    except:
        return {"results": []}

@app.get("/debug/dvf/{code_insee}")
def debug_dvf(code_insee: str):
    """Debug : voir les données brutes DVF pour un code INSEE."""
    if df_dvf is None or df_dvf.empty:
        return {"error": "DVF non chargé"}
    code = code_insee.zfill(5)
    row = df_dvf[df_dvf["code_insee"] == code]
    if row.empty:
        return {"error": f"Code INSEE {code} non trouvé", "total_communes": len(df_dvf)}
    r = row.iloc[0].to_dict()
    nb_apt = safe_int(r.get("nb_ventes_apt", 0)) or 0
    nb_mai = safe_int(r.get("nb_ventes_mai", 0)) or 0
    return {
        "code_insee": code,
        "donnees_brutes": r,
        "nb_ventes_apt": nb_apt,
        "nb_ventes_mai": nb_mai,
        "prix_apt_fiable": nb_apt >= MIN_VENTES_APT,
        "prix_mai_fiable": nb_mai >= MIN_VENTES_MAI,
        "seuil_apt": MIN_VENTES_APT,
        "seuil_mai": MIN_VENTES_MAI,
    }

@app.get("/debug/loyers/{code_insee}")
def debug_loyers(code_insee: str):
    """Debug : voir les données brutes loyers pour un code INSEE."""
    if df_loyers is None or df_loyers.empty:
        return {"error": "Loyers non chargé"}
    code = code_insee.zfill(5)
    row = df_loyers[df_loyers["code_insee"] == code]
    if row.empty:
        return {"error": f"Code INSEE {code} non trouvé", "total_communes": len(df_loyers),
                "colonnes": list(df_loyers.columns)}
    return {
        "code_insee": code,
        "donnees_brutes": row.iloc[0].to_dict(),
        "colonnes": list(df_loyers.columns),
        "total_communes": len(df_loyers),
    }

@app.get("/analyse/{commune}")
def analyse(commune: str):
    """Analyse complète d'une commune."""

    # 1. Résolution INSEE
    code_insee, nom_officiel, population = get_geo(commune)

    # 2. Prix DVF (avec seuil fiabilité)
    prix_apt, prix_mai, nb_apt, nb_mai = (None, None, 0, 0)
    if code_insee:
        prix_apt, prix_mai, nb_apt, nb_mai = get_dvf(code_insee)

    # 3. Prix de référence pour la rentabilité
    # Priorité : appartement si fiable, sinon maison
    prix_ref = prix_apt if prix_apt else prix_mai
    type_prix_ref = "appartement" if prix_apt else ("maison" if prix_mai else None)

    # 4. Loyer ANIL
    loyer = None
    if code_insee:
        loyer = get_loyer(code_insee)

    # 5. Rentabilité brute
    rentabilite = None
    if prix_ref and loyer:
        rentabilite = round((loyer * 12 / prix_ref) * 100, 2)

    # 6. Données socio-éco (valeurs par défaut Seine-Maritime si absentes)
    chomage   = 14.5
    revenu    = 20000
    cadres    = 9.0
    pauvrete  = 18.0
    ev_pop    = 0.0
    vacance   = 10.0

    # 7. Calcul des scores
    s_rend = round(score_rendement(rentabilite), 2)
    s_demo = round(score_demographie(population, ev_pop, vacance), 2)
    s_seco = round(score_socioeco(chomage, revenu, cadres, pauvrete), 2)
    s_glob = round(s_rend * 0.5 + s_demo * 0.25 + s_seco * 0.25, 2)

    # 8. Zonage ABC (simplifié Seine-Maritime)
    zonage = "B1"  # défaut Seine-Maritime
    if population:
        if population > 100000: zonage = "A"
        elif population > 50000: zonage = "B1"
        elif population > 20000: zonage = "B2"
        else: zonage = "C"

    return {
        "commune": nom_officiel,
        "code_insee": code_insee,
        "code_postal": None,
        "population": population,
        "prix": {
            "appartement_m2": int(prix_apt) if prix_apt else None,
            "maison_m2": int(prix_mai) if prix_mai else None,
            "nb_ventes_apt": nb_apt,
            "nb_ventes_mai": nb_mai,
            "prix_ref_type": type_prix_ref,
            "avertissement_apt": (
                f"Seulement {nb_apt} ventes — prix appartement peu fiable, rentabilité calculée sur les maisons"
                if prix_apt is None and nb_apt < MIN_VENTES_APT and nb_apt > 0
                else None
            ),
            "source": "DVF notarial 2024 (DGFiP)",
        },
        "loyer": {
            "appartement_m2": loyer,
            "source": "Carte loyers ANIL 2024",
        },
        "rentabilite_brute_pct": rentabilite,
        "zonage_abc": zonage,
        "socio_eco": {
            "chomage_pct": chomage,
            "revenu_median": revenu,
            "part_cadres_pct": cadres,
            "taux_pauvrete_pct": pauvrete,
        },
        "demographie": {
            "evolution_pop_pct_an": ev_pop,
            "nb_etudiants": 0,
            "vacance_pct": vacance,
        },
        "scores": {
            "rendement": s_rend,
            "demographie": s_demo,
            "socio_eco": s_seco,
            "global": s_glob,
        },
    }
