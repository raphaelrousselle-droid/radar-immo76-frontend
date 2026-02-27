import React, { useState, useEffect, useCallback } from "react";

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
const sn = (v) => (v != null && !isNaN(v) ? Number(v) : null);

const ProgressBar = ({ value }) => {
  const pct = Math.min(100, Math.max(0, ((sn(value) ?? 0) / 10) * 100));
  return (
    <div style={{ background: "#e5e7eb", borderRadius: 6, height: 10, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${pct}%`, background: nc(sn(value)), height: "100%", borderRadius: 6, transition: "width 0.5s ease" }} />
    </div>
  );
};

const CriteriaRow = ({ label, displayValue, note, info }) => {
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
};

const Gauge = ({ label, value, weight, onClick, active }) => {
  const v = sn(value);
  const color = nc(v);
  const r = 32, circ = 2 * Math.PI * 
