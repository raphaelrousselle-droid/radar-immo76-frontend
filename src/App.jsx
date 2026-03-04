import React, { useState, useEffect, useCallback, useMemo } from "react";

const API_BASE = "https://radar-immo76-1.onrender.com";
const CACHE_KEY = "radar-immo-communes-v2";

// ─── Helpers généraux ─────────────────────────────────────────────────────────
const nc = (v) => {
  if (v == null) return "#a1a1aa";
  if (v >= 7) return "#22c55e";
  if (v >= 5) return "#f97316";
  return "#ef4444";
};
const nLabel = (v) => {
  if (v == null) return "—";
  if (v >= 7) return "Bon";
  if (v >= 5) return "Moyen";
  return "Faible";
};
const sn = (v) => (v != null && !isNaN(Number(v)) ? Number(v) : null);
const pf = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

function ProgressBar({ value, onClick, clickable }) {
  const n = sn(value);
  const pct = Math.min(100, Math.max(0, ((n ?? 0) / 10) * 100));
  return (
    <div
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,0.35)",
        borderRadius: 999,
        height: 7,
        width: "100%",
        overflow: "hidden",
        cursor: clickable ? "pointer" : "default",
        boxShadow: "inset 0 0 0 1px rgba(148,163,184,0.3)",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          background:
            "linear-gradient(90deg, rgba(56,189,248,0.9), rgba(129,140,248,0.9))",
          height: 7,
          borderRadius: 999,
          transition: "width 0.3s",
        }}
      />
    </div>
  );
}

const fmt = (n, d = 0) =>
  n == null
    ? "—"
    : n.toLocaleString("fr-FR", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });
const fmtEur = (n) => (n == null ? "—" : `${fmt(n)} €`);
const fmtPct = (n) => (n == null ? "—" : `${fmt(n, 2)} %`);

// ─── Détail d'un score ────────────────────────────────────────────────────────
function ScoreDetail({ scoreKey, detail, onClose }) {
  const se = detail?.socio_eco || {};
  const dem = detail?.demographie || {};
  const pri = detail?.prix || {};

  const configs = {
    rendement: {
      title: "Détail — Rendement",
      color: "#38bdf8",
      items: [
        {
          label: "Prix appartement/m²",
          value: pri.appartement_m2
            ? `${pri.appartement_m2.toLocaleString("fr-FR")} €`
            : "—",
        },
        {
          label: "Prix maison/m²",
          value: pri.maison_m2
            ? `${pri.maison_m2.toLocaleString("fr-FR")} €`
            : "—",
        },
        {
          label: "Loyer médian/m²",
          value: detail?.loyer?.appartement_m2 != null
            ? `${Number(detail.loyer.appartement_m2).toFixed(1)} €/m²/mois`
            : "—",
        },
        {
          label: "Rentabilité brute",
          value: detail?.rentabilite_brute_pct
            ? `${detail.rentabilite_brute_pct} %`
            : "—",
          highlight: true,
        },
        {
          label: "Nb ventes appartements",
          value: pri.nb_ventes_apt ?? "—",
        },
        {
          label: "Nb ventes maisons",
          value: pri.nb_ventes_mai ?? "—",
        },
      ],
      note: "Rendement brut ≈ (loyer × 12) / prix m² × surface estimée.",
    },
    demographie: {
      title: "Détail — Démographie",
      color: "#a855f7",
      items: [
        {
          label: "Population",
          value: detail?.population
            ? detail.population.toLocaleString("fr-FR") + " hab."
            : "—",
        },
        {
          label: "Évolution population/an",
          value:
            dem.evolution_pop_pct_an != null
              ? `${dem.evolution_pop_pct_an} %`
              : "—",
          highlight: true,
        },
        {
          label: "Vacance logements",
          value:
            dem.vacance_pct != null ? `${dem.vacance_pct} %` : "—",
          highlight: true,
        },
        {
          label: "Tension locative",
          value:
            dem.tension_locative_pct != null
              ? `${dem.tension_locative_pct} %`
              : "—",
          highlight: true,
        },
        {
          label: "Zone ABC",
          value: detail?.zonage_abc ?? "—",
        },
      ],
      note: "Score basé sur taille, dynamique démographique, vacance et part de locataires.",
    },
    socio_eco: {
      title: "Détail — Socio-économique",
      color: "#22c55e",
      items: [
        {
          label: "Revenu médian",
          value: se.revenu_median
            ? `${se.revenu_median.toLocaleString("fr-FR")} €`
            : "—",
          highlight: true,
        },
        {
          label: "Taux de chômage",
          value:
            se.chomage_pct != null ? `${se.chomage_pct} %` : "—",
          highlight: true,
        },
        {
          label: "Taux de pauvreté",
          value:
            se.taux_pauvrete_pct != null
              ? `${se.taux_pauvrete_pct} %`
              : "—",
          highlight: true,
        },
        {
          label: "Part cadres",
          value:
            se.part_cadres_pct != null
              ? `${se.part_cadres_pct} %`
              : "—",
        },
        {
          label: "Indice de Gini",
          value: se.gini != null ? se.gini : "—",
        },
      ],
      note: "Plus le revenu est élevé et le chômage faible, meilleur est le score.",
    },
  };

  const cfg = configs[scoreKey];
  if (!cfg) return null;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.75)",
        borderRadius: 14,
        padding: 12,
        marginTop: 8,
        border: `1px solid ${cfg.color}33`,
        boxShadow: "0 18px 45px rgba(15,23,42,0.10)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          alignItems: "center",
        }}
      >
        <div
          style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}
        >
          {cfg.title}
        </div>
        <button
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            color: "#9ca3af",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          ✕
        </button>
      </div>
      {cfg.items.map((item) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "4px 0",
            borderBottom: "1px solid rgba(148,163,184,0.25)",
            fontSize: 12,
          }}
        >
          <span style={{ color: "#6b7280" }}>{item.label}</span>
          <span
            style={{
              fontWeight: item.highlight ? 600 : 500,
              color: item.highlight ? "#111827" : "#4b5563",
            }}
          >
            {item.value}
          </span>
        </div>
      ))}
      <div
        style={{
          fontSize: 11,
          color: "#9ca3af",
          marginTop: 5,
          fontStyle: "italic",
        }}
      >
        {cfg.note}
      </div>
    </div>
  );
}

// ─── Simulation de rentabilité ────────────────────────────────────────────────
function calculerSimulation(i) {
  const pv = pf(i.prixVente);
  const fn = pf(i.fraisNotaire);
  const tr = pf(i.travaux);
  const am = pf(i.amenagements);
  const fap = pf(i.fraisAgencePct);
  const ap = pf(i.apport);
  const tc = pf(i.tauxCredit);
  const dur = pf(i.dureeAnnees);
  const loy = pf(i.loyerMensuelHC);
  const occ = pf(i.tauxOccupation);
  const chi = pf(i.chargesImmeubleAn);
  const tf = pf(i.taxeFonciereAn);
  const pno = pf(i.assurancePNOAn);
  const glp = pf(i.gestionLocativePct);
  const ptv = pf(i.provisionTravauxAn);
  const fba = pf(i.fraisBancairesAn);
  const ec = pf(i.expertComptableAn);
  const coa = pf(i.coefAmortissement);
  const tis = pf(i.tauxIS);
  const tmi = pf(i.tmi);

  const fraisAgenceTx = (pv * fap) / 100;
  const depenseNette = pv + fn + tr + am + fraisAgenceTx;
  const sommeEmpruntee = depenseNette - ap;

  const nMois = dur * 12;
  const tauxMensuel = tc / 100 / 12;
  const mensualite =
    tauxMensuel === 0
      ? sommeEmpruntee / nMois
      : (sommeEmpruntee * tauxMensuel) /
        (1 - Math.pow(1 + tauxMensuel, -nMois));
  const remboursementAnnuel = mensualite * 12;
  const coutPretTotal = remboursementAnnuel * dur - sommeEmpruntee;
  const interetsAnnuels = coutPretTotal / dur;

  const loyersAnnuels = loy * occ;
  const assurancePNO = pno > 0 ? pno : depenseNette * 0.0012;
  const gestionLocativeAn = (loyersAnnuels * glp) / 100;
  const totalFraisAnnuels =
    chi + tf + assurancePNO + gestionLocativeAn + ptv + fba + ec;
  const amortissement = (depenseNette * coa) / 100;
  const ebe = loyersAnnuels - totalFraisAnnuels;

  const mkRegime = (ebeVal, impot) => {
    const tresorerie = ebeVal - remboursementAnnuel - impot;
    const rendBrut =
      depenseNette > 0 ? (loyersAnnuels / depenseNette) * 100 : 0;
    const rendNet =
      depenseNette > 0 ? (tresorerie / depenseNette) * 100 : 0;
    const tri = tresorerie > 0 ? depenseNette / tresorerie : null;
    const regle70 =
      loyersAnnuels > 0 ? remboursementAnnuel / loyersAnnuels : null;
    return { ebe: ebeVal, impot, tresorerie, rendBrut, rendNet, tri, regle70 };
  };

  const baseIS = Math.max(
    0,
    loyersAnnuels - totalFraisAnnuels - interetsAnnuels - amortissement
  );
  const impotIS = baseIS * (tis / 100);

  const baseLMNPReel = Math.max(
    0,
    loyersAnnuels - totalFraisAnnuels - interetsAnnuels - amortissement
  );
  const impotLMNPReel = baseLMNPReel * ((tmi + 17.2) / 100);

  const impotMicroBIC =
    Math.max(0, loyersAnnuels * 0.5) * ((tmi + 17.2) / 100);

  const baseFoncierR = Math.max(
    0,
    loyersAnnuels - totalFraisAnnuels - interetsAnnuels
  );
  const impotFoncierR = baseFoncierR * ((tmi + 17.2) / 100);

  const impotMicroFonc =
    Math.max(0, loyersAnnuels * 0.7) * ((tmi + 17.2) / 100);

  return {
    depenseNette,
    sommeEmpruntee,
    mensualite,
    coutPretTotal,
    remboursementAnnuel,
    interetsAnnuels,
    loyersAnnuels,
    totalFraisAnnuels,
    amortissement,
    rendBrut:
      depenseNette > 0 ? (loyersAnnuels / depenseNette) * 100 : 0,
    regimes: {
      "SAS / SCI IS": mkRegime(ebe, impotIS),
      "LMNP Réel": mkRegime(ebe, impotLMNPReel),
      "LMNP Micro BIC": mkRegime(ebe, impotMicroBIC),
      "Foncier Réel": mkRegime(ebe, impotFoncierR),
      "Micro Foncier": mkRegime(ebe, impotMicroFonc),
    },
  };
}

function InputField({
  label,
  name,
  value,
  onChange,
  unit = "€",
  step = "1000",
  min = "0",
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          color: "#f9fafb",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <div
        style={{ display: "flex", alignItems: "center", gap: 6 }}
      >
        <input
          type="number"
          name={name}
          value={value}
          step={step}
          min={min}
          onChange={onChange}
          style={{
            width: "100%",
            background: "rgba(15,23,42,0.4)",
            border: "1px solid rgba(148,163,184,0.45)",
            borderRadius: 999,
            padding: "7px 12px",
            color: "#e5e7eb",
            fontSize: 13,
            backdropFilter: "blur(14px)",
          }}
        />
        {unit && (
          <span
            style={{
              color: "#e5e7eb",
              fontSize: 11,
              minWidth: 28,
              textAlign: "right",
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        color: "#c7d2fe",
        margin: "10px 0 4px",
      }}
    >
      {children}
    </div>
  );
}

function SimulationProjet() {
  const [inputs, setInputs] = useState({
    prixVente: "175000",
    fraisNotaire: "13300",
    travaux: "0",
    amenagements: "0",
    fraisAgencePct: "5",
    apport: "14000",
    tauxCredit: "4.2",
    dureeAnnees: "25",
    loyerMensuelHC: "1000",
    tauxOccupation: "11.5",
    chargesImmeubleAn: "250",
    taxeFonciereAn: "1400",
    assurancePNOAn: "0",
    gestionLocativePct: "0",
    provisionTravauxAn: "0",
    fraisBancairesAn: "300",
    expertComptableAn: "600",
    coefAmortissement: "4.75",
    tauxIS: "15",
    tmi: "11",
  });
  const [regimeActif, setRegimeActif] = useState("SAS / SCI IS");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setInputs((prev) => ({ ...prev, [name]: value }));
  };

  const result = useMemo(
    () => calculerSimulation(inputs),
    [inputs]
  );
  const regime = result.regimes[regimeActif];
  const couleurTreso =
    pf(regime.tresorerie) >= 0 ? "#22c55e" : "#f97316";
  const couleur70 =
    regime.regle70 != null && regime.regle70 < 0.7
      ? "#22c55e"
      : "#ef4444";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Formulaire glassmorphism en haut */}
      <div
        style={{
          borderRadius: 20,
          padding: 18,
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.75), rgba(30,64,175,0.85))",
          boxShadow:
            "0 22px 55px rgba(15,23,42,0.45), 0 0 0 1px rgba(148,163,184,0.4)",
          backdropFilter: "blur(24px)",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 10,
            color: "#e5e7eb",
          }}
        >
          Paramètres du projet
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",
            columnGap: 18,
            rowGap: 6,
          }}
        >
          <div>
            <SectionTitle>Achat</SectionTitle>
            <InputField
              label="Prix de vente"
              name="prixVente"
              value={inputs.prixVente}
              onChange={handleChange}
            />
            <InputField
              label="Frais de notaire"
              name="fraisNotaire"
              value={inputs.fraisNotaire}
              onChange={handleChange}
            />
            <InputField
              label="Travaux"
              name="travaux"
              value={inputs.travaux}
              onChange={handleChange}
            />
            <InputField
              label="Aménagements"
              name="amenagements"
              value={inputs.amenagements}
              onChange={handleChange}
            />
            <InputField
              label="Frais d'agence (%)"
              name="fraisAgencePct"
              value={inputs.fraisAgencePct}
              onChange={handleChange}
              unit="%"
              step="0.5"
            />
            <InputField
              label="Apport"
              name="apport"
              value={inputs.apport}
              onChange={handleChange}
            />
          </div>

          <div>
            <SectionTitle>Prêt & Fiscalité</SectionTitle>
            <InputField
              label="Taux crédit (%)"
              name="tauxCredit"
              value={inputs.tauxCredit}
              onChange={handleChange}
              unit="%"
              step="0.05"
            />
            <InputField
              label="Durée (années)"
              name="dureeAnnees"
              value={inputs.dureeAnnees}
              onChange={handleChange}
              unit="ans"
              step="1"
            />
            <InputField
              label="Coef amortissement (%)"
              name="coefAmortissement"
              value={inputs.coefAmortissement}
              onChange={handleChange}
              unit="%"
              step="0.25"
            />
            <InputField
              label="Taux IS (%)"
              name="tauxIS"
              value={inputs.tauxIS}
              onChange={handleChange}
              unit="%"
              step="1"
            />
            <InputField
              label="TMI (%)"
              name="tmi"
              value={inputs.tmi}
              onChange={handleChange}
              unit="%"
              step="1"
            />
          </div>

          <div>
            <SectionTitle>Exploitation</SectionTitle>
            <InputField
              label="Loyer mensuel HC total"
              name="loyerMensuelHC"
              value={inputs.loyerMensuelHC}
              onChange={handleChange}
              step="50"
            />
            <InputField
              label="Taux d'occupation (mois/an)"
              name="tauxOccupation"
              value={inputs.tauxOccupation}
              onChange={handleChange}
              unit="mois"
              step="0.5"
            />
            <InputField
              label="Charges immeuble/an"
              name="chargesImmeubleAn"
              value={inputs.chargesImmeubleAn}
              onChange={handleChange}
              step="100"
            />
            <InputField
              label="Taxe foncière/an"
              name="taxeFonciereAn"
              value={inputs.taxeFonciereAn}
              onChange={handleChange}
              step="100"
            />
            <InputField
              label="Assurance PNO/an (0=auto)"
              name="assurancePNOAn"
              value={inputs.assurancePNOAn}
              onChange={handleChange}
              step="50"
            />
            <InputField
              label="Gestion locative (%)"
              name="gestionLocativePct"
              value={inputs.gestionLocativePct}
              onChange={handleChange}
              unit="%"
              step="0.5"
            />
            <InputField
              label="Provision travaux/an"
              name="provisionTravauxAn"
              value={inputs.provisionTravauxAn}
              onChange={handleChange}
              step="100"
            />
            <InputField
              label="Frais bancaires/an"
              name="fraisBancairesAn"
              value={inputs.fraisBancairesAn}
              onChange={handleChange}
              step="50"
            />
            <InputField
              label="Expert-comptable + CFE/an"
              name="expertComptableAn"
              value={inputs.expertComptableAn}
              onChange={handleChange}
              step="50"
            />
          </div>
        </div>
      </div>

      {/* Résultats dessous */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* KPIs projet */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0,1fr))",
            gap: 12,
          }}
        >
          {[
            { label: "Dépense nette", value: fmtEur(result.depenseNette) },
            {
              label: "Somme empruntée",
              value: fmtEur(result.sommeEmpruntee),
            },
            {
              label: "Mensualité crédit",
              value: fmtEur(result.mensualite),
            },
            {
              label: "Coût total prêt",
              value: fmtEur(result.coutPretTotal),
            },
            { label: "Loyers annuels", value: fmtEur(result.loyersAnnuels) },
            {
              label: "Total frais/an",
              value: fmtEur(result.totalFraisAnnuels),
            },
            {
              label: "Amortissement/an",
              value: fmtEur(result.amortissement),
            },
            { label: "Rendement brut", value: fmtPct(result.rendBrut) },
          ].map((c) => (
            <div
              key={c.label}
              style={{
                background: "rgba(255,255,255,0.85)",
                borderRadius: 18,
                padding: "10px 12px",
                boxShadow:
                  "0 16px 40px rgba(15,23,42,0.18), 0 0 0 1px rgba(148,163,184,0.3)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#4b5563",
                  marginBottom: 4,
                }}
              >
                {c.label}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {c.value}
              </div>
            </div>
          ))}
        </div>

        {/* Sélecteur régime */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {Object.keys(result.regimes).map((r) => (
            <button
              key={r}
              onClick={() => setRegimeActif(r)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border:
                  regimeActif === r
                    ? "1px solid rgba(59,130,246,0.8)"
                    : "1px solid rgba(148,163,184,0.4)",
                background:
                  regimeActif === r
                    ? "rgba(59,130,246,0.15)"
                    : "rgba(15,23,42,0.35)",
                color:
                  regimeActif === r ? "#e5e7eb" : "#cbd5f5",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                backdropFilter: "blur(18px)",
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Bilan régime actif */}
        <div
          style={{
            background: "rgba(15,23,42,0.75)",
            borderRadius: 20,
            padding: 16,
            boxShadow:
              "0 20px 50px rgba(15,23,42,0.4), 0 0 0 1px rgba(148,163,184,0.4)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 12,
              color: "#e5e7eb",
            }}
          >
            Bilan — {regimeActif}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0,1fr))",
              gap: 12,
            }}
          >
            {[
              {
                label: "EBE",
                value: fmtEur(regime.ebe),
                color: "#38bdf8",
              },
              {
                label: "Fiscalité annuelle",
                value: fmtEur(regime.impot),
                color: "#facc15",
              },
              {
                label: "Trésorerie/an",
                value: fmtEur(regime.tresorerie),
                color: couleurTreso,
              },
              {
                label: "Rendement brut",
                value: fmtPct(regime.rendBrut),
                color: "#e5e7eb",
              },
              {
                label: "Rendement net",
                value: fmtPct(regime.rendNet),
                color: "#22c55e",
              },
              {
                label: "TRI",
                value: regime.tri ? fmt(regime.tri, 1) + " ans" : "—",
                color: "#e5e7eb",
              },
            ].map((c) => (
              <div
                key={c.label}
                style={{
                  background: "rgba(15,23,42,0.6)",
                  borderRadius: 16,
                  padding: "10px 12px",
                  border: "1px solid rgba(148,163,184,0.5)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#cbd5f5",
                    marginBottom: 4,
                  }}
                >
                  {c.label}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: c.color,
                  }}
                >
                  {c.value}
                </div>
              </div>
            ))}
          </div>

          {/* Règle 70% */}
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 16,
              background: "rgba(15,23,42,0.7)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: "1px solid rgba(148,163,184,0.5)",
            }}
          >
            <div
              style={{ fontSize: 12, color: "#e5e7eb", minWidth: 110 }}
            >
              Règle des 70 %
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: couleur70,
              }}
            >
              {regime.regle70 != null
                ? fmt(regime.regle70, 2)
                : "—"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: couleur70,
                minWidth: 120,
              }}
            >
              {regime.regle70 != null
                ? regime.regle70 < 0.7
                  ? "OK (< 0,70)"
                  : "Trop élevé (> 0,70)"
                : ""}
            </div>
            <div
              style={{
                flex: 1,
                background: "rgba(15,23,42,0.85)",
                borderRadius: 999,
                height: 7,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(
                    100,
                    (regime.regle70 || 0) * 100
                  )}%`,
                  background: couleur70,
                  height: 7,
                  borderRadius: 999,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        </div>

        {/* Tableau comparatif */}
        <div
          style={{
            background: "rgba(15,23,42,0.75)",
            borderRadius: 20,
            padding: 16,
            boxShadow:
              "0 18px 45px rgba(15,23,42,0.5), 0 0 0 1px rgba(148,163,184,0.5)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
              color: "#e5e7eb",
            }}
          >
            Comparatif des régimes fiscaux
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
            }}
          >
            <thead>
              <tr
                style={{
                  color: "#9ca3af",
                  borderBottom: "1px solid rgba(148,163,184,0.6)",
                }}
              >
                {[
                  "Régime",
                  "Tréso/an",
                  "Impôt/an",
                  "Rdt net",
                  "TRI",
                  "Règle 70%",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Régime" ? "left" : "right",
                      padding: "6px 8px",
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.regimes).map(([nom, r]) => (
                <tr
                  key={nom}
                  onClick={() => setRegimeActif(nom)}
                  style={{
                    borderBottom: "1px solid rgba(30,64,175,0.5)",
                    background:
                      regimeActif === nom
                        ? "rgba(59,130,246,0.18)"
                        : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <td
                    style={{
                      padding: "8px 8px",
                      fontWeight: 500,
                      color: "#e5e7eb",
                    }}
                  >
                    {nom}
                  </td>
                  <td
                    style={{
                      padding: "8px 8px",
                      textAlign: "right",
                      color:
                        r.tresorerie >= 0
                          ? "#4ade80"
                          : "#fb923c",
                      fontWeight: 600,
                    }}
                  >
                    {fmtEur(r.tresorerie)}
                  </td>
                  <td
                    style={{
                      padding: "8px 8px",
                      textAlign: "right",
                      color: "#facc15",
                    }}
                  >
                    {fmtEur(r.impot)}
                  </td>
                  <td
                    style={{
                      padding: "8px 8px",
                      textAlign: "right",
                      color: "#e5e7eb",
                    }}
                  >
                    {fmtPct(r.rendNet)}
                  </td>
                  <td
                    style={{
                      padding: "8px 8px",
                      textAlign: "right",
                      color: "#e5e7eb",
                    }}
                  >
                    {r.tri ? fmt(r.tri, 1) + " ans" : "—"}
                  </td>
                  <td
                    style={{
                      padding: "8px 8px",
                      textAlign: "right",
                      color:
                        r.regle70 != null && r.regle70 < 0.7
                          ? "#4ade80"
                          : "#f97316",
                      fontWeight: 600,
                    }}
                  >
                    {r.regle70 != null ? fmt(r.regle70, 2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Analyse Communes ─────────────────────────────────────────────────────────
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

  const loadCommunes = useCallback(async (force = false) => {
    if (!force) {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          setCommunes(JSON.parse(cached));
          setLoading(false);
          return;
        } catch {}
      }
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/communes`);
      if (!r.ok) throw new Error(`Erreur ${r.status}`);
      const d = await r.json();
      const list = d.communes || [];
      setCommunes(list);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(list));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommunes();
  }, [loadCommunes]);

  const fetchDetail = useCallback(async (nom) => {
    setLoadingDetail(true);
    setDetail(null);
    setOpenScore(null);
    try {
      const r = await fetch(
        `${API_BASE}/analyse/${encodeURIComponent(nom)}`
      );
      if (!r.ok) throw new Error(`Erreur ${r.status}`);
      setDetail(await r.json());
    } catch (e) {
      setDetail({ error: e.message });
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selected) fetchDetail(selected.nom);
  }, [selected, fetchDetail]);

  const filtered = useMemo(() => {
    return communes
      .filter((c) => {
        const g = sn(c.scores?.global);
        return (
          c.nom.toLowerCase().includes(search.toLowerCase()) &&
          (g == null || g >= filterMin)
        );
      })
      .sort((a, b) => {
        const va = sn(a.scores?.[sortKey]) ?? -1;
        const vb = sn(b.scores?.[sortKey]) ?? -1;
        return vb - va;
      });
  }, [communes, search, sortKey, filterMin]);

  const top10 = useMemo(() => filtered.slice(0, 10), [filtered]);

  const toggleCompare = (c) => {
    setCompareList((prev) =>
      prev.find((x) => x.nom === c.nom)
        ? prev.filter((x) => x.nom !== c.nom)
        : prev.length < 4
        ? [...prev, c]
        : prev
    );
  };

  const scoreKeys = [
    { key: "global", label: "Score global" },
    { key: "rendement", label: "Rendement" },
    { key: "demographie", label: "Démographie" },
    { key: "socio_eco", label: "Socio-éco" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Barre de recherche centrée, large, glassmorphism */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 800,
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 10,
            borderRadius: 999,
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(219,234,254,0.9))",
            boxShadow:
              "0 18px 45px rgba(15,23,42,0.18), 0 0 0 1px rgba(148,163,184,0.3)",
            backdropFilter: "blur(18px)",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "999px",
              background:
                "radial-gradient(circle at 30% 0%, #38bdf8, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f9fafb",
              fontSize: 16,
            }}
          >
            🔍
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une commune ou taper un nom (TOP 10)…"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 14,
              color: "#111827",
            }}
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            style={{
              background: "rgba(15,23,42,0.08)",
              border: "1px solid rgba(148,163,184,0.6)",
              borderRadius: 999,
              padding: "7px 10px",
              fontSize: 12,
              color: "#111827",
            }}
          >
            {scoreKeys.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
          <select
            value={filterMin}
            onChange={(e) => setFilterMin(Number(e.target.value))}
            style={{
              background: "rgba(15,23,42,0.08)",
              border: "1px solid rgba(148,163,184,0.6)",
              borderRadius: 999,
              padding: "7px 10px",
              fontSize: 12,
              color: "#111827",
            }}
          >
            <option value={0}>Tous les scores</option>
            <option value={5}>Score ≥ 5</option>
            <option value={6}>Score ≥ 6</option>
            <option value={7}>Score ≥ 7</option>
          </select>
        </div>
      </div>

      {/* Ligne boutons action */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 800,
          margin: "0 auto",
        }}
      >
        <div
          style={{ fontSize: 11, color: "#e5e7eb" }}
        >
          {filtered.length} communes matchent tes critères · Top 10
          affiché
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => loadCommunes(true)}
            style={{
              background:
                "linear-gradient(135deg,#38bdf8,#6366f1)",
              border: "none",
              borderRadius: 999,
              padding: "7px 12px",
              color: "#f9fafb",
              cursor: "pointer",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 12px 30px rgba(59,130,246,0.55)",
            }}
          >
            <span>↻</span>
            <span>Actualiser</span>
          </button>
          {compareList.length > 0 && (
            <button
              onClick={() => setShowCompare(true)}
              style={{
                background:
                  "linear-gradient(135deg,#a855f7,#ec4899)",
                border: "none",
                borderRadius: 999,
                padding: "7px 12px",
                color: "#fdf2ff",
                cursor: "pointer",
                fontSize: 12,
                boxShadow: "0 12px 30px rgba(168,85,247,0.55)",
              }}
            >
              Comparer ({compareList.length})
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 18 }}>
        {/* Liste communes TOP 10 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading && (
            <div
              style={{
                color: "#e5e7eb",
                padding: 40,
                textAlign: "center",
              }}
            >
              Chargement des communes…
            </div>
          )}
          {error && (
            <div style={{ color: "#fecaca", padding: 20 }}>
              Erreur : {error}
            </div>
          )}

          {!loading && !error && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(230px, 1fr))",
                gap: 12,
              }}
            >
              {top10.map((c) => {
                const g = sn(c.scores?.global);
                const isSelected = selected?.nom === c.nom;
                const isCompared = !!compareList.find(
                  (x) => x.nom === c.nom
                );
                return (
                  <div
                    key={c.nom}
                    onClick={() =>
                      setSelected(isSelected ? null : c)
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      toggleCompare(c);
                    }}
                    style={{
                      background: "rgba(15,23,42,0.75)",
                      borderRadius: 18,
                      padding: "12px 14px",
                      boxShadow: isSelected
                        ? "0 20px 45px rgba(59,130,246,0.55)"
                        : "0 14px 35px rgba(15,23,42,0.6)",
                      border: isSelected
                        ? "1px solid rgba(59,130,246,0.8)"
                        : isCompared
                        ? "1px solid rgba(244,114,182,0.9)"
                        : "1px solid rgba(148,163,184,0.55)",
                      cursor: "pointer",
                      transition: "all 0.18s",
                      backdropFilter: "blur(16px)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: "#f9fafb",
                        }}
                      >
                        {c.nom}
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: nc(g),
                        }}
                      >
                        {g != null ? g.toFixed(1) : "—"}
                      </div>
                    </div>
                    {c.population && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#cbd5f5",
                          marginBottom: 6,
                        }}
                      >
                        {c.population.toLocaleString("fr-FR")} hab.
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {["rendement", "demographie", "socio_eco"].map(
                        (k) => {
                          const v = sn(c.scores?.[k]);
                          return (
                            <div
                              key={k}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#cbd5f5",
                                  width: 80,
                                }}
                              >
                                {k === "rendement"
                                  ? "Rendement"
                                  : k === "demographie"
                                  ? "Démographie"
                                  : "Socio-éco"}
                              </div>
                              <ProgressBar value={v} />
                              <div
                                style={{
                                  fontSize: 11,
                                  color: nc(v),
                                  minWidth: 28,
                                  textAlign: "right",
                                }}
                              >
                                {v != null ? v.toFixed(1) : "—"}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panneau détail */}
        {selected && (
          <div
            style={{
              width: 360,
              minWidth: 320,
              background: "rgba(15,23,42,0.85)",
              borderRadius: 20,
              padding: 16,
              boxShadow:
                "0 20px 50px rgba(15,23,42,0.7), 0 0 0 1px rgba(148,163,184,0.7)",
              backdropFilter: "blur(26px)",
            }}
          >
            {loadingDetail && (
              <div
                style={{
                  color: "#e5e7eb",
                  textAlign: "center",
                  marginTop: 40,
                }}
              >
                Chargement…
              </div>
            )}
            {detail?.error && (
              <div style={{ color: "#fecaca" }}>
                Erreur : {detail.error}
              </div>
            )}
            {detail && !detail.error && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        color: "#f9fafb",
                      }}
                    >
                      {detail.commune}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#cbd5f5",
                      }}
                    >
                      {detail.code_insee} · Zone {detail.zonage_abc}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelected(null);
                      setDetail(null);
                      setOpenScore(null);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#9ca3af",
                      cursor: "pointer",
                      fontSize: 18,
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Scores cliquables */}
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#cbd5f5",
                      fontWeight: 500,
                      marginBottom: 6,
                    }}
                  >
                    Scores (clic sur une jauge pour le détail)
                  </div>
                  {[
                    {
                      key: "global",
                      label: "Global",
                      v: sn(detail.scores?.global),
                    },
                    {
                      key: "rendement",
                      label: "Rendement",
                      v: sn(detail.scores?.rendement),
                    },
                    {
                      key: "demographie",
                      label: "Démographie",
                      v: sn(detail.scores?.demographie),
                    },
                    {
                      key: "socio_eco",
                      label: "Socio-éco",
                      v: sn(detail.scores?.socio_eco),
                    },
                  ].map(({ key, label, v }) => {
                    const clickable = key !== "global";
                    const isOpen = openScore === key;
                    return (
                      <div key={key} style={{ marginBottom: isOpen ? 4 : 6 }}>
                        <div
                          onClick={() =>
                            clickable &&
                            setOpenScore(isOpen ? null : key)
                          }
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: clickable ? "pointer" : "default",
                            padding: "3px 0",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              width: 80,
                              color: "#e5e7eb",
                            }}
                          >
                            {label}
                          </div>
                          <ProgressBar
                            value={v}
                            clickable={clickable}
                          />
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: nc(v),
                              minWidth: 32,
                              textAlign: "right",
                            }}
                          >
                            {v != null ? v.toFixed(1) : "—"}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: nc(v),
                              minWidth: 42,
                            }}
                          >
                            {nLabel(v)}
                          </div>
                          {clickable && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#9ca3af",
                              }}
                            >
                              {isOpen ? "▲" : "▼"}
                            </div>
                          )}
                        </div>
                        {isOpen && clickable && (
                          <ScoreDetail
                            scoreKey={key}
                            detail={detail}
                            onClose={() => setOpenScore(null)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Prix au m² */}
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#cbd5f5",
                      fontWeight: 500,
                      marginBottom: 6,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Prix au m²
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    {[
                      {
                        label: "Appartement",
                        value: detail.prix?.appartement_m2
                          ? `${detail.prix.appartement_m2.toLocaleString(
                              "fr-FR"
                            )} €/m²`
                          : "—",
                        sub: detail.prix?.nb_ventes_apt
                          ? `${detail.prix.nb_ventes_apt} ventes`
                          : "",
                      },
                      {
                        label: "Maison",
                        value: detail.prix?.maison_m2
                          ? `${detail.prix.maison_m2.toLocaleString(
                              "fr-FR"
                            )} €/m²`
                          : "—",
                        sub: detail.prix?.nb_ventes_mai
                          ? `${detail.prix.nb_ventes_mai} ventes`
                          : "",
                      },
                    ].map((x) => (
                      <div
                        key={x.label}
                        style={{
                          background: "rgba(15,23,42,0.7)",
                          borderRadius: 14,
                          padding: "9px 10px",
                          border:
                            "1px solid rgba(148,163,184,0.6)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: "#cbd5f5",
                            marginBottom: 2,
                          }}
                        >
                          {x.label}
                        </div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: "#f9fafb",
                          }}
                        >
                          {x.value}
                        </div>
                        {x.sub && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "#9ca3af",
                            }}
                          >
                            {x.sub}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Loyer avec 1 décimale */}
                {detail.loyer?.appartement_m2 != null && (
                  <div
                    style={{
                      marginBottom: 12,
                      background:
                        "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(129,140,248,0.35))",
                      borderRadius: 14,
                      padding: "8px 10px",
                      border: "1px solid rgba(129,140,248,0.7)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "#e0e7ff",
                        marginBottom: 2,
                      }}
                    >
                      Loyer médian
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#f9fafb",
                      }}
                    >
                      {Number(
                        detail.loyer.appartement_m2
                      ).toFixed(1)}{" "}
                      €/m²/mois
                    </div>
                  </div>
                )}

                {/* Rentabilité brute */}
                {detail.rentabilite_brute_pct && (
                  <div
                    style={{
                      marginBottom: 12,
                      background:
                        "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(52,211,153,0.35))",
                      borderRadius: 14,
                      padding: "8px 10px",
                      border: "1px solid rgba(34,197,94,0.7)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "#bbf7d0",
                        marginBottom: 2,
                      }}
                    >
                      Rentabilité brute estimée
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#f9fafb",
                      }}
                    >
                      {detail.rentabilite_brute_pct} %
                    </div>
                  </div>
                )}

                {/* Socio-éco */}
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#cbd5f5",
                      fontWeight: 500,
                      marginBottom: 6,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Données socio-éco
                  </div>
                  {[
                    {
                      label: "Revenu médian",
                      value: detail.socio_eco?.revenu_median
                        ? `${detail.socio_eco.revenu_median.toLocaleString(
                            "fr-FR"
                          )} €`
                        : "—",
                    },
                    {
                      label: "Chômage",
                      value:
                        detail.socio_eco?.chomage_pct != null
                          ? `${detail.socio_eco.chomage_pct} %`
                          : "—",
                    },
                    {
                      label: "Taux pauvreté",
                      value:
                        detail.socio_eco?.taux_pauvrete_pct != null
                          ? `${detail.socio_eco.taux_pauvrete_pct} %`
                          : "—",
                    },
                    {
                      label: "Part cadres",
                      value:
                        detail.socio_eco?.part_cadres_pct != null
                          ? `${detail.socio_eco.part_cadres_pct} %`
                          : "—",
                    },
                  ].map((x) => (
                    <div
                      key={x.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "4px 0",
                        borderBottom:
                          "1px solid rgba(148,163,184,0.6)",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: "#cbd5f5" }}>
                        {x.label}
                      </span>
                      <span
                        style={{
                          fontWeight: 500,
                          color: "#f9fafb",
                        }}
                      >
                        {x.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Démographie */}
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#cbd5f5",
                      fontWeight: 500,
                      marginBottom: 6,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Démographie
                  </div>
                  {[
                    {
                      label: "Population",
                      value: detail.population
                        ? detail.population.toLocaleString(
                            "fr-FR"
                          ) + " hab."
                        : "—",
                    },
                    {
                      label: "Évolution/an",
                      value:
                        detail.demographie
                          ?.evolution_pop_pct_an != null
                          ? `${detail.demographie.evolution_pop_pct_an} %`
                          : "—",
                    },
                    {
                      label: "Vacance logements",
                      value:
                        detail.demographie?.vacance_pct != null
                          ? `${detail.demographie.vacance_pct} %`
                          : "—",
                    },
                    {
                      label: "Tension locative",
                      value:
                        detail.demographie
                          ?.tension_locative_pct != null
                          ? `${detail.demographie.tension_locative_pct} %`
                          : "—",
                    },
                  ].map((x) => (
                    <div
                      key={x.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "4px 0",
                        borderBottom:
                          "1px solid rgba(148,163,184,0.6)",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: "#cbd5f5" }}>
                        {x.label}
                      </span>
                      <span
                        style={{
                          fontWeight: 500,
                          color: "#f9fafb",
                        }}
                      >
                        {x.value}
                      </span>
                    </div>
                  ))}
                </div>

                {detail.prix?.avertissement_apt && (
                  <div
                    style={{
                      background: "rgba(251,191,36,0.15)",
                      borderRadius: 12,
                      padding: "8px 10px",
                      fontSize: 12,
                      color: "#fef3c7",
                      marginBottom: 10,
                      border:
                        "1px solid rgba(251,191,36,0.7)",
                    }}
                  >
                    ⚠ {detail.prix.avertissement_apt}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    marginTop: 4,
                  }}
                >
                  Sources : {detail.prix?.source} ·{" "}
                  {detail.loyer?.source}
                </div>
              </>
            )}
          </div>
        )}

        {/* Modal comparaison (inchangé sauf couleurs déjà futuristes) */}
        {showCompare && compareList.length > 0 && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.65)",
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={() => setShowCompare(false)}
          >
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,64,175,0.95))",
                borderRadius: 20,
                padding: 20,
                minWidth: 520,
                maxWidth: 840,
                maxHeight: "80vh",
                overflowY: "auto",
                boxShadow:
                  "0 22px 55px rgba(15,23,42,0.8), 0 0 0 1px rgba(148,163,184,0.7)",
                backdropFilter: "blur(28px)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 14,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#f9fafb",
                  }}
                >
                  Comparaison de communes
                </div>
                <button
                  onClick={() => setShowCompare(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#9ca3af",
                    cursor: "pointer",
                    fontSize: 18,
                  }}
                >
                  ✕
                </button>
              </div>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ color: "#cbd5f5" }}>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "6px 8px",
                        fontWeight: 500,
                      }}
                    >
                      Critère
                    </th>
                    {compareList.map((c) => (
                      <th
                        key={c.nom}
                        style={{
                          textAlign: "right",
                          padding: "6px 8px",
                          fontWeight: 500,
                          color: "#f9fafb",
                        }}
                      >
                        {c.nom}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: "Score global",
                      fn: (c) =>
                        sn(c.scores?.global)?.toFixed(1) ?? "—",
                    },
                    {
                      label: "Rendement",
                      fn: (c) =>
                        sn(c.scores?.rendement)?.toFixed(1) ?? "—",
                    },
                    {
                      label: "Démographie",
                      fn: (c) =>
                        sn(c.scores?.demographie)?.toFixed(1) ?? "—",
                    },
                    {
                      label: "Socio-éco",
                      fn: (c) =>
                        sn(c.scores?.socio_eco)?.toFixed(1) ?? "—",
                    },
                    {
                      label: "Population",
                      fn: (c) =>
                        c.population?.toLocaleString("fr-FR") ??
                        "—",
                    },
                  ].map(({ label, fn }) => (
                    <tr
                      key={label}
                      style={{ borderBottom: "1px solid rgba(148,163,184,0.6)" }}
                    >
                      <td
                        style={{
                          padding: "7px 8px",
                          color: "#e5e7eb",
                        }}
                      >
                        {label}
                      </td>
                      {compareList.map((c) => (
                        <td
                          key={c.nom}
                          style={{
                            padding: "7px 8px",
                            textAlign: "right",
                            fontWeight: 500,
                            color: "#f9fafb",
                          }}
                        >
                          {fn(c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: "#9ca3af",
                }}
              >
                Clic droit sur une commune dans le TOP 10 pour
                l’ajouter/retirer.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App principale ───────────────────────────────────────────────────────────
export default function App() {
  const [onglet, setOnglet] = useState("analyse");
  const navItems = [
    { id: "analyse", label: "Analyse communes", icon: "📊" },
    { id: "simulation", label: "Simulation projet", icon: "💼" },
  ];

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #bae6fd 0, transparent 55%), radial-gradient(circle at top right,#fce7f3 0, transparent 55%), radial-gradient(circle at bottom,#d1fae5 0, #0b1120 55%)",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      <aside
        style={{
          width: 220,
          minWidth: 220,
          background: "rgba(15,23,42,0.85)",
          borderRight: "1px solid rgba(148,163,184,0.6)",
          padding: "18px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          boxShadow:
            "0 18px 45px rgba(15,23,42,0.85), 0 0 0 1px rgba(15,23,42,0.9)",
          backdropFilter: "blur(24px)",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#f9fafb",
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 999,
              background:
                "conic-gradient(from 140deg, #38bdf8, #6366f1, #f97316, #22c55e, #38bdf8)",
              color: "#0b1120",
              fontSize: 15,
              marginRight: 8,
              boxShadow: "0 0 16px rgba(96,165,250,0.9)",
            }}
          >
            R
          </span>
          Radar Immo 76
        </div>
        {navItems.map((n) => (
          <button
            key={n.id}
            onClick={() => setOnglet(n.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              textAlign: "left",
              width: "100%",
              background:
                onglet === n.id
                  ? "linear-gradient(135deg, rgba(59,130,246,0.85), rgba(129,140,248,0.9))"
                  : "transparent",
              color:
                onglet === n.id ? "#f9fafb" : "#e5e7eb",
              boxShadow:
                onglet === n.id
                  ? "0 14px 35px rgba(59,130,246,0.7)"
                  : "none",
            }}
          >
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div
          style={{
            fontSize: 11,
            color: "#9ca3af",
            marginTop: 12,
          }}
        >
          Sources : DVF · ANIL · INSEE
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          padding: 20,
          overflowY: "auto",
          minWidth: 0,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#f9fafb",
              margin: 0,
              textShadow: "0 8px 24px rgba(15,23,42,0.9)",
            }}
          >
            {onglet === "analyse"
              ? "Analyse investissement — Seine-Maritime"
              : "Simulation de rentabilité"}
          </h1>
          <p
            style={{
              fontSize: 12,
              color: "#e5e7eb",
              margin: "4px 0 0",
            }}
          >
            {onglet === "analyse"
              ? "TOP 10 des communes selon tes filtres · Clic = détail · Clic sur une jauge = détail du score · Clic droit = comparer"
              : "Renseigne les paramètres du projet et visualise trésorerie, rendements et règle des 70 % en temps réel."}
          </p>
        </div>
        {onglet === "analyse" && <AnalyseCommunes />}
        {onglet === "simulation" && <SimulationProjet />}
      </main>
    </div>
  );
}
