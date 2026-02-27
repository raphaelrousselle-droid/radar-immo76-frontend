import { useState, useEffect, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════
   SCORING ENGINE
   Zone tendue: A/Abis/B1 = tendue (décret 2013 + arrêtés 2024)
   Vacance: taux logements vacants INSEE recensement 2021
   ═══════════════════════════════════════════════════════════════ */
function computeScores(c) {
  let sr;
  const rb = c.rb || 0;
  if (rb >= 10) sr = 10; else if (rb >= 8) sr = 8 + (rb - 8);
  else if (rb >= 6) sr = 5 + (rb - 6) * 1.5; else if (rb >= 4) sr = 2 + (rb - 4) * 1.5;
  else sr = Math.max(1, rb * 0.5);
  sr = Math.min(10, Math.max(1, sr));
  let sd = 5;
  const ep = c.ep || 0;
  if (ep >= 1.0) sd += 2.5; else if (ep >= 0.5) sd += 2.0;
  else if (ep >= 0.1) sd += 1.0; else if (ep >= 0) sd += 0;
  else if (ep >= -0.3) sd -= 1.0; else sd -= 2.0;
  const ne = c.et || 0;
  if (ne >= 40000) sd += 1.5; else if (ne >= 20000) sd += 1.0;
  else if (ne >= 10000) sd += 0.5; else if (ne >= 2000) sd += 0.2;
  // Tension: based on zonage ABC
  const zt = c.zt || "";
  if (zt === "Abis" || zt === "A") sd += 1.0;
  else if (zt === "B1") sd += 0.5;
  else if (zt === "C") sd -= 0.5;
  sd = Math.min(10, Math.max(1, sd));
  let se = 5;
  const tc = c.tc || 15;
  if (tc <= 12) se += 2.0; else if (tc <= 15) se += 1.0;
  else if (tc <= 18) se += 0; else if (tc <= 22) se -= 1.0; else se -= 2.0;
  const rm = c.rm || 20000;
  if (rm >= 22000) se += 1.5; else if (rm >= 20000) se += 0.5;
  else if (rm < 18000) se -= 1.0;
  const pc = c.pc || 10;
  if (pc >= 16) se += 1.0; else if (pc >= 12) se += 0.5; else se -= 0.5;
  const tp = c.tp || 18;
  if (tp <= 15) se += 1.0; else if (tp <= 20) se += 0;
  else if (tp <= 25) se -= 0.5; else se -= 1.5;
  se = Math.min(10, Math.max(1, se));
  const gl = sr * 0.4 + sd * 0.3 + se * 0.3;
  return { r: Math.round(sr*10)/10, d: Math.round(sd*10)/10, s: Math.round(se*10)/10, g: Math.round(gl*10)/10 };
}
function nc(n){return n>=8?"#34d399":n>=6?"#60a5fa":n>=4?"#fbbf24":"#f87171"}
function nl(n){return n>=8.5?"Excellent":n>=7?"Très bon":n>=5.5?"Bon":n>=4?"Correct":"Faible"}
function tensionLabel(z){return z==="Abis"?"Très forte (A bis)":z==="A"?"Très forte (A)":z==="B1"?"Forte (B1)":z==="B2"?"Modérée (B2)":"Faible (C)"}
function vacLabel(v){return v<=5?"Très faible":v<=8?"Faible":v<=11?"Moyen":v<=15?"Élevé":"Très élevé"}

const F1="'Outfit',sans-serif",F2="'Playfair Display',serif";

/* ═══════════════════════════════════════════
   COMPACT DATA — Normandie (+ quelques HdF)
   Fields: n=name, d=département, pop, pa=prix appart, pm=prix maison,
   lo=loyer m², rb=renta brute, ev=evol prix 12m,
   tc=taux chômage recens., ep=evol pop, rm=revenu médian,
   pc=part cadres, tp=taux pauvreté, et=étudiants,
   zt=zone tendue (Abis/A/B1/B2/C), vac=taux vacance %,
   tr=transports, pu=projets urbains
   ═══════════════════════════════════════════ */
const D = [
// === SEINE-MARITIME (76) ===
{n:"Rouen",d:"76",pop:117700,pa:2520,pm:2700,lo:13.2,rb:6.3,ev:0.4,tc:17.5,ep:1.1,rm:20500,pc:14.0,tp:20.0,et:30000,zt:"B1",vac:9.5,tr:"TER (1h20 Paris), Métrobus, TEOR",pu:"Écoquartier Flaubert, Axe Seine"},
{n:"Le Havre",d:"76",pop:166700,pa:1883,pm:2346,lo:11.5,rb:7.3,ev:-0.3,tc:19.5,ep:-0.3,rm:19200,pc:10.0,tp:24.0,et:12000,zt:"B1",vac:10.2,tr:"TER, Tram, Port maritime",pu:"Réinventer la ville, quartier gare"},
{n:"Dieppe",d:"76",pop:29080,pa:1650,pm:1850,lo:10.5,rb:7.6,ev:-0.8,tc:20.7,ep:-0.4,rm:18900,pc:7.5,tp:22.0,et:2500,zt:"C",vac:10.8,tr:"TER Rouen/Paris, port ferry",pu:"Réaménagement front de mer"},
{n:"Sotteville-lès-Rouen",d:"76",pop:29500,pa:2180,pm:2400,lo:12.0,rb:6.6,ev:0.5,tc:18.0,ep:0.0,rm:19800,pc:11.0,tp:19.5,et:1500,zt:"B1",vac:8.0,tr:"Métrobus, TEOR, TER",pu:"Rénovation quartier gare"},
{n:"Saint-Étienne-du-Rouvray",d:"76",pop:31200,pa:1850,pm:2100,lo:11.0,rb:7.1,ev:0.2,tc:21.0,ep:-0.2,rm:17800,pc:9.0,tp:26.0,et:8000,zt:"B1",vac:9.0,tr:"Métro, TEOR, TER",pu:"Technopôle du Madrillet"},
{n:"Le Grand-Quevilly",d:"76",pop:26800,pa:2050,pm:2300,lo:11.5,rb:6.7,ev:0.3,tc:17.5,ep:0.0,rm:20200,pc:12.0,tp:18.0,et:500,zt:"B1",vac:7.5,tr:"Métrobus, TER",pu:"Éco-quartier Seine Sud"},
{n:"Le Petit-Quevilly",d:"76",pop:22600,pa:1920,pm:2200,lo:11.5,rb:7.2,ev:0.4,tc:19.5,ep:0.1,rm:18500,pc:9.5,tp:24.0,et:500,zt:"B1",vac:8.5,tr:"Métrobus, TEOR",pu:"Rénovation urbaine"},
{n:"Mont-Saint-Aignan",d:"76",pop:20100,pa:2800,pm:3100,lo:13.0,rb:5.6,ev:0.6,tc:12.5,ep:1.1,rm:24500,pc:22.0,tp:12.0,et:15000,zt:"B1",vac:7.0,tr:"TEOR, Bus",pu:"Campus universitaire"},
{n:"Fécamp",d:"76",pop:18548,pa:1450,pm:1650,lo:9.5,rb:7.9,ev:-0.5,tc:19.5,ep:-0.5,rm:19100,pc:7.0,tp:21.0,et:500,zt:"C",vac:11.5,tr:"TER Rouen, Bus",pu:"Port de plaisance"},
{n:"Elbeuf",d:"76",pop:17200,pa:1550,pm:1750,lo:10.0,rb:7.7,ev:-0.2,tc:22.0,ep:-0.5,rm:17500,pc:7.0,tp:26.5,et:800,zt:"B1",vac:12.0,tr:"TER, Bus",pu:"Réhabilitation industrielle"},
{n:"Vernon",d:"27",pop:23800,pa:2200,pm:2450,lo:12.0,rb:6.5,ev:0.5,tc:16.0,ep:0.1,rm:21000,pc:13.0,tp:17.0,et:1500,zt:"B1",vac:8.5,tr:"TER (50min Paris), A13",pu:"ZAC Fieschi"},
{n:"Canteleu",d:"76",pop:14500,pa:1750,pm:2000,lo:10.5,rb:7.2,ev:0.1,tc:20.0,ep:-0.3,rm:18000,pc:8.0,tp:23.0,et:300,zt:"B1",vac:8.0,tr:"TEOR, Bus",pu:"Rénovation urbaine"},
{n:"Barentin",d:"76",pop:12500,pa:1680,pm:1900,lo:10.0,rb:7.1,ev:0.0,tc:17.5,ep:-0.2,rm:19500,pc:9.0,tp:18.5,et:200,zt:"C",vac:9.0,tr:"TER, Bus",pu:"Centre-ville rénové"},
{n:"Maromme",d:"76",pop:12000,pa:1850,pm:2100,lo:11.0,rb:7.1,ev:0.2,tc:18.5,ep:-0.1,rm:19200,pc:10.0,tp:20.0,et:200,zt:"B1",vac:8.5,tr:"TEOR, Bus",pu:"Requalification"},
{n:"Yvetot",d:"76",pop:12200,pa:1550,pm:1750,lo:9.5,rb:7.4,ev:-0.3,tc:18.0,ep:-0.3,rm:19000,pc:8.5,tp:19.5,et:500,zt:"C",vac:10.5,tr:"TER Rouen-Le Havre",pu:"Pôle commercial"},
{n:"Bolbec",d:"76",pop:11800,pa:1250,pm:1400,lo:8.5,rb:8.2,ev:-1.0,tc:21.5,ep:-0.7,rm:17800,pc:6.5,tp:23.0,et:200,zt:"C",vac:13.0,tr:"TER, Bus",pu:"Centre-bourg"},
{n:"Eu",d:"76",pop:6920,pa:1250,pm:1480,lo:8.5,rb:8.2,ev:-1.0,tc:21.0,ep:-0.7,rm:18500,pc:6.0,tp:20.0,et:300,zt:"C",vac:12.0,tr:"TER, proximité Tréport",pu:"Patrimoine royal"},
{n:"Le Tréport",d:"76",pop:4876,pa:1380,pm:1550,lo:8.8,rb:7.7,ev:-0.3,tc:20.5,ep:-0.5,rm:18200,pc:5.5,tp:21.5,et:100,zt:"C",vac:14.0,tr:"TER, funiculaire",pu:"Tourisme balnéaire"},
{n:"Bois-Guillaume",d:"76",pop:14200,pa:3050,pm:3300,lo:13.5,rb:5.3,ev:0.8,tc:11.0,ep:0.5,rm:27000,pc:28.0,tp:8.0,et:500,zt:"B1",vac:5.5,tr:"TEOR, Bus",pu:"Résidentiel premium"},
{n:"Darnétal",d:"76",pop:10200,pa:1950,pm:2200,lo:11.0,rb:6.8,ev:0.3,tc:17.0,ep:0.1,rm:19800,pc:10.5,tp:18.0,et:300,zt:"B1",vac:8.0,tr:"TEOR, Bus",pu:"Requalification vallée"},
{n:"Lillebonne",d:"76",pop:9200,pa:1350,pm:1550,lo:9.0,rb:8.0,ev:-0.5,tc:18.5,ep:-0.3,rm:19000,pc:8.0,tp:19.0,et:200,zt:"C",vac:11.0,tr:"TER, Bus",pu:"Zone industrielle"},
{n:"Caudebec-lès-Elbeuf",d:"76",pop:10100,pa:1650,pm:1850,lo:10.0,rb:7.3,ev:0.0,tc:19.5,ep:-0.2,rm:18500,pc:8.0,tp:21.0,et:200,zt:"B1",vac:9.5,tr:"TER, Bus",pu:"Axe Seine"},
// === CALVADOS (14) ===
{n:"Caen",d:"14",pop:109400,pa:2984,pm:3768,lo:14.0,rb:5.6,ev:1.5,tc:15.0,ep:0.6,rm:21800,pc:16.5,tp:18.0,et:35000,zt:"B1",vac:8.5,tr:"TER (2h Paris), Tram, Bus",pu:"Presqu'île, nouveau CHU"},
{n:"Hérouville-Saint-Clair",d:"14",pop:22400,pa:1950,pm:2300,lo:11.5,rb:7.1,ev:0.5,tc:19.0,ep:0.2,rm:18500,pc:10.0,tp:24.0,et:3000,zt:"B1",vac:9.0,tr:"Tram Caen",pu:"Rénovation quartiers"},
{n:"Lisieux",d:"14",pop:20200,pa:1550,pm:1750,lo:10.0,rb:7.7,ev:-0.5,tc:19.5,ep:-0.5,rm:18500,pc:8.0,tp:22.0,et:1200,zt:"C",vac:12.5,tr:"TER (1h45 Paris)",pu:"Centre historique"},
{n:"Bayeux",d:"14",pop:13600,pa:2350,pm:2600,lo:11.5,rb:5.9,ev:0.8,tc:14.0,ep:0.0,rm:21500,pc:14.0,tp:14.5,et:800,zt:"B1",vac:8.0,tr:"TER, Bus",pu:"Tourisme mémoriel"},
{n:"Ifs",d:"14",pop:12800,pa:2500,pm:2800,lo:12.0,rb:5.8,ev:1.0,tc:14.5,ep:0.8,rm:22000,pc:15.0,tp:15.0,et:500,zt:"B1",vac:5.5,tr:"Tram Caen, Bus",pu:"Extension urbaine"},
{n:"Mondeville",d:"14",pop:10500,pa:2200,pm:2500,lo:11.5,rb:6.3,ev:0.6,tc:16.5,ep:0.3,rm:20500,pc:12.0,tp:17.5,et:500,zt:"B1",vac:7.5,tr:"Tram Caen",pu:"Zone commerciale"},
{n:"Ouistreham",d:"14",pop:9800,pa:2800,pm:3200,lo:12.0,rb:5.1,ev:1.2,tc:13.0,ep:0.4,rm:22500,pc:15.0,tp:12.0,et:100,zt:"B1",vac:18.0,tr:"Ferry Angleterre, Bus",pu:"Tourisme balnéaire"},
{n:"Falaise",d:"14",pop:8200,pa:1350,pm:1550,lo:9.0,rb:8.0,ev:-0.5,tc:18.5,ep:-0.5,rm:18800,pc:7.5,tp:20.0,et:300,zt:"C",vac:11.5,tr:"TER, Bus",pu:"Patrimoine médiéval"},
{n:"Honfleur",d:"14",pop:7100,pa:3500,pm:3800,lo:13.0,rb:4.5,ev:1.5,tc:15.0,ep:-0.2,rm:20500,pc:11.0,tp:17.0,et:200,zt:"B1",vac:20.0,tr:"Bus, A29",pu:"Tourisme, patrimoine"},
{n:"Vire Normandie",d:"14",pop:11200,pa:1350,pm:1500,lo:8.5,rb:7.6,ev:-0.5,tc:16.5,ep:-0.4,rm:19200,pc:8.0,tp:18.5,et:500,zt:"C",vac:10.0,tr:"TER, Bus",pu:"Pôle industriel"},
{n:"Colombelles",d:"14",pop:7200,pa:2100,pm:2400,lo:11.0,rb:6.3,ev:0.5,tc:17.0,ep:0.5,rm:19800,pc:11.0,tp:18.5,et:300,zt:"B1",vac:7.0,tr:"Tram Caen",pu:"Éco-quartier"},
{n:"Blainville-sur-Orne",d:"14",pop:6200,pa:2350,pm:2650,lo:11.5,rb:5.9,ev:0.8,tc:14.0,ep:0.6,rm:21500,pc:14.0,tp:13.0,et:200,zt:"B1",vac:5.5,tr:"Tram, Bus",pu:"Extension résidentielle"},
{n:"Dives-sur-Mer",d:"14",pop:5800,pa:2200,pm:2500,lo:10.5,rb:5.7,ev:0.5,tc:16.0,ep:-0.1,rm:20000,pc:10.0,tp:17.0,et:100,zt:"C",vac:16.0,tr:"TER, Bus",pu:"Port Guillaume"},
{n:"Cabourg",d:"14",pop:3500,pa:3200,pm:3600,lo:12.0,rb:4.5,ev:1.0,tc:14.0,ep:0.0,rm:21000,pc:12.0,tp:14.0,et:100,zt:"B1",vac:55.0,tr:"TER, Bus",pu:"Station balnéaire"},
{n:"Deauville",d:"14",pop:3600,pa:5500,pm:6000,lo:16.0,rb:3.5,ev:1.5,tc:12.0,ep:0.2,rm:25000,pc:18.0,tp:12.0,et:500,zt:"B1",vac:60.0,tr:"TER (2h Paris), Bus",pu:"Tourisme luxe"},
{n:"Trouville-sur-Mer",d:"14",pop:4500,pa:4200,pm:4800,lo:14.0,rb:4.0,ev:1.0,tc:14.0,ep:-0.2,rm:22000,pc:14.0,tp:15.0,et:100,zt:"B1",vac:50.0,tr:"TER, Bus",pu:"Rénovation balnéaire"},
{n:"Douvres-la-Délivrande",d:"14",pop:5500,pa:2400,pm:2700,lo:11.0,rb:5.5,ev:0.5,tc:13.5,ep:0.3,rm:22000,pc:14.0,tp:12.0,et:200,zt:"B1",vac:6.0,tr:"Bus Caen",pu:"Résidentiel"},
// === EURE (27) ===
{n:"Évreux",d:"27",pop:48300,pa:1780,pm:2050,lo:11.0,rb:7.4,ev:-0.2,tc:19.0,ep:-0.3,rm:19500,pc:10.5,tp:22.0,et:5000,zt:"B2",vac:10.0,tr:"TER (1h Paris), Bus",pu:"Rénovation Madeleine"},
{n:"Louviers",d:"27",pop:18800,pa:1750,pm:2000,lo:10.5,rb:7.2,ev:0.0,tc:18.5,ep:-0.2,rm:19200,pc:9.0,tp:20.0,et:800,zt:"B2",vac:10.5,tr:"TER, Bus, A13/A154",pu:"Centre historique"},
{n:"Val-de-Reuil",d:"27",pop:14500,pa:1500,pm:1750,lo:10.0,rb:8.0,ev:-0.3,tc:22.0,ep:-0.5,rm:16500,pc:6.5,tp:30.0,et:500,zt:"B1",vac:8.5,tr:"TER, Bus",pu:"ANRU, Seine Normandie"},
{n:"Gisors",d:"27",pop:12000,pa:1850,pm:2100,lo:10.5,rb:6.8,ev:0.3,tc:16.0,ep:0.1,rm:20500,pc:10.0,tp:16.0,et:300,zt:"B2",vac:9.0,tr:"TER (1h Paris)",pu:"Patrimoine médiéval"},
{n:"Bernay",d:"27",pop:10200,pa:1250,pm:1450,lo:8.5,rb:8.2,ev:-0.8,tc:19.0,ep:-0.5,rm:18500,pc:7.5,tp:20.0,et:400,zt:"C",vac:13.5,tr:"TER, Bus",pu:"Centre ancien"},
{n:"Pont-Audemer",d:"27",pop:9500,pa:1550,pm:1750,lo:9.5,rb:7.4,ev:-0.3,tc:17.5,ep:-0.3,rm:19000,pc:8.5,tp:18.5,et:300,zt:"C",vac:11.0,tr:"Bus, A13",pu:"Tourisme fluvial"},
{n:"Les Andelys",d:"27",pop:8500,pa:1650,pm:1900,lo:10.0,rb:7.3,ev:-0.2,tc:17.0,ep:-0.3,rm:19500,pc:9.0,tp:17.5,et:200,zt:"C",vac:10.5,tr:"Bus, A13",pu:"Château Gaillard"},
{n:"Gaillon",d:"27",pop:7200,pa:1750,pm:2000,lo:10.0,rb:6.9,ev:0.2,tc:16.5,ep:0.1,rm:20000,pc:10.0,tp:16.0,et:200,zt:"B2",vac:8.5,tr:"TER, A13",pu:"Zone activités"},
// === MANCHE (50) ===
{n:"Cherbourg-en-Cotentin",d:"50",pop:79200,pa:2416,pm:2534,lo:11.5,rb:5.7,ev:1.0,tc:16.0,ep:-0.1,rm:20500,pc:12.0,tp:18.0,et:5000,zt:"B2",vac:9.5,tr:"TER, Aéroport, Port",pu:"Base navale, EPR Flamanville"},
{n:"Saint-Lô",d:"50",pop:19500,pa:1550,pm:1750,lo:9.5,rb:7.4,ev:-0.2,tc:15.5,ep:-0.3,rm:20000,pc:11.0,tp:17.5,et:2000,zt:"C",vac:11.0,tr:"TER, Bus",pu:"Reconstruction, préfecture"},
{n:"Granville",d:"50",pop:12800,pa:2200,pm:2500,lo:10.5,rb:5.7,ev:0.5,tc:15.0,ep:-0.2,rm:20500,pc:10.0,tp:16.5,et:500,zt:"C",vac:18.0,tr:"TER, Bus",pu:"Station balnéaire"},
{n:"Coutances",d:"50",pop:9200,pa:1650,pm:1850,lo:9.5,rb:6.9,ev:0.0,tc:14.0,ep:-0.3,rm:20500,pc:11.0,tp:15.0,et:600,zt:"C",vac:10.0,tr:"TER, Bus",pu:"Patrimoine cathédrale"},
{n:"Valognes",d:"50",pop:7200,pa:1550,pm:1750,lo:9.0,rb:7.0,ev:-0.2,tc:14.5,ep:-0.3,rm:20000,pc:9.5,tp:16.0,et:400,zt:"C",vac:10.5,tr:"TER, Bus",pu:"Patrimoine historique"},
{n:"Avranches",d:"50",pop:8000,pa:1500,pm:1700,lo:9.0,rb:7.2,ev:-0.3,tc:15.5,ep:-0.4,rm:19500,pc:9.0,tp:17.0,et:500,zt:"C",vac:11.0,tr:"TER, Bus, A84",pu:"Baie du Mont-Saint-Michel"},
{n:"Villedieu-les-Poêles",d:"50",pop:3800,pa:1200,pm:1400,lo:7.5,rb:7.5,ev:-0.5,tc:14.0,ep:-0.5,rm:19500,pc:7.0,tp:16.0,et:100,zt:"C",vac:12.0,tr:"Bus",pu:"Artisanat cuivre"},
{n:"Carentan-les-Marais",d:"50",pop:6200,pa:1350,pm:1550,lo:8.5,rb:7.6,ev:-0.3,tc:15.0,ep:-0.2,rm:19000,pc:7.5,tp:17.0,et:200,zt:"C",vac:11.5,tr:"TER, Bus",pu:"Tourisme mémoriel"},
// === ORNE (61) ===
{n:"Alençon",d:"61",pop:25500,pa:1350,pm:1550,lo:9.0,rb:8.0,ev:-0.5,tc:18.0,ep:-0.5,rm:19200,pc:10.0,tp:20.5,et:3000,zt:"C",vac:12.5,tr:"TER, Bus",pu:"Rénovation centre"},
{n:"Flers",d:"61",pop:14500,pa:1050,pm:1250,lo:7.5,rb:8.6,ev:-1.0,tc:19.5,ep:-0.7,rm:17800,pc:7.0,tp:22.0,et:800,zt:"C",vac:13.5,tr:"TER, Bus",pu:"Reconversion industrielle"},
{n:"Argentan",d:"61",pop:13800,pa:1150,pm:1350,lo:8.0,rb:8.3,ev:-0.8,tc:18.5,ep:-0.5,rm:18200,pc:7.5,tp:21.0,et:500,zt:"C",vac:13.0,tr:"TER (2h Paris), Bus",pu:"Patrimoine, haras"},
{n:"L'Aigle",d:"61",pop:7800,pa:1100,pm:1300,lo:7.5,rb:8.2,ev:-1.0,tc:18.0,ep:-0.6,rm:18000,pc:7.0,tp:20.0,et:300,zt:"C",vac:14.0,tr:"TER, Bus",pu:"Reconversion"},
{n:"Mortagne-au-Perche",d:"61",pop:3800,pa:1150,pm:1350,lo:7.5,rb:7.8,ev:-0.5,tc:16.0,ep:-0.5,rm:19000,pc:8.0,tp:17.0,et:200,zt:"C",vac:12.0,tr:"Bus",pu:"Perche attractif"},
{n:"La Ferté-Macé",d:"61",pop:5800,pa:950,pm:1150,lo:7.0,rb:8.8,ev:-1.2,tc:18.0,ep:-0.8,rm:17500,pc:6.5,tp:21.5,et:200,zt:"C",vac:14.5,tr:"Bus",pu:"Station thermale"},
{n:"Sées",d:"61",pop:4200,pa:1050,pm:1250,lo:7.5,rb:8.6,ev:-0.5,tc:16.5,ep:-0.4,rm:18500,pc:8.0,tp:18.0,et:400,zt:"C",vac:12.0,tr:"TER, Bus",pu:"Patrimoine cathédrale"},
// === VILLES HORS NORMANDIE (comparaison) ===
{n:"Rennes",d:"35",pop:222485,pa:3650,pm:3800,lo:14.8,rb:4.9,ev:0.8,tc:12.5,ep:1.2,rm:22800,pc:19.5,tp:14.5,et:68000,zt:"B1",vac:6.5,tr:"LGV (1h25 Paris), Métro",pu:"EuroRennes, ligne B métro"},
{n:"Compiègne",d:"60",pop:41007,pa:2350,pm:2600,lo:13.0,rb:6.6,ev:1.0,tc:14.0,ep:0.2,rm:21800,pc:16.0,tp:16.0,et:8000,zt:"B1",vac:7.5,tr:"TER (40min Paris), A1",pu:"UTC campus, Royallieu"},
{n:"Beauvais",d:"60",pop:56254,pa:1920,pm:2150,lo:12.0,rb:7.5,ev:0.5,tc:18.5,ep:0.1,rm:19200,pc:10.0,tp:23.0,et:5500,zt:"B1",vac:9.0,tr:"TER (1h15 Paris), Aéroport",pu:"Quartier gare"},
{n:"Senlis",d:"60",pop:16480,pa:3200,pm:3500,lo:15.0,rb:5.6,ev:1.5,tc:10.5,ep:0.4,rm:25000,pc:22.0,tp:11.0,et:2000,zt:"B1",vac:5.5,tr:"TER, A1, Roissy",pu:"Patrimoine médiéval"},
{n:"Creil",d:"60",pop:35520,pa:1750,pm:2000,lo:11.5,rb:7.9,ev:0.8,tc:21.0,ep:0.1,rm:17500,pc:7.0,tp:28.0,et:2000,zt:"B1",vac:8.5,tr:"TER (30min Paris)",pu:"ANRU, nouvelle gare"},
{n:"Amiens",d:"80",pop:135501,pa:2150,pm:2050,lo:12.5,rb:7.0,ev:0.8,tc:19.0,ep:-0.2,rm:19500,pc:11.5,tp:22.5,et:30000,zt:"B1",vac:9.5,tr:"TER (1h10 Paris), Bus",pu:"Citadelle, Intercampus"},
{n:"Abbeville",d:"80",pop:23042,pa:1350,pm:1500,lo:9.2,rb:8.2,ev:0.2,tc:20.0,ep:-0.4,rm:18800,pc:8.0,tp:22.0,et:1200,zt:"C",vac:12.0,tr:"TER Amiens/Paris, A28",pu:"Centre-ville"},
];

const DEPTS = {"76":"Seine-Maritime","14":"Calvados","27":"Eure","50":"Manche","61":"Orne","35":"Ille-et-Vilaine","60":"Oise","80":"Somme"};

/* ═══════════════════════════════════════════
   UI COMPONENTS
   ═══════════════════════════════════════════ */
function Gauge({s,l,c,sz=112}){const r=(sz-14)/2,ci=Math.PI*r,of=ci*(1-s/10);return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><svg width={sz} height={sz/2+14} viewBox={`0 0 ${sz} ${sz/2+14}`}><path d={`M 7 ${sz/2+7} A ${r} ${r} 0 0 1 ${sz-7} ${sz/2+7}`} fill="none" stroke="#141428" strokeWidth="5" strokeLinecap="round"/><path d={`M 7 ${sz/2+7} A ${r} ${r} 0 0 1 ${sz-7} ${sz/2+7}`} fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" strokeDasharray={ci} strokeDashoffset={of} style={{transition:"stroke-dashoffset .8s ease-out"}}/><text x={sz/2} y={sz/2+1} textAnchor="middle" fontSize="20" fontWeight="700" fill={c} fontFamily={F2}>{s.toFixed(1)}</text><text x={sz/2} y={sz/2+12} textAnchor="middle" fontSize="8" fill="#4a4a64" fontFamily={F1}>/ 10</text></svg><span style={{fontSize:9,color:"#5a5a78",fontFamily:F1,fontWeight:600,textTransform:"uppercase",letterSpacing:1.3}}>{l}</span></div>)}
function Row({i,l,v,s,h}){const[o,setO]=useState(false);return(<div onMouseEnter={()=>setO(true)} onMouseLeave={()=>setO(false)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",borderBottom:"1px solid rgba(255,255,255,0.02)",background:o?"rgba(255,255,255,0.01)":"transparent",transition:"background .1s"}}><div style={{display:"flex",alignItems:"center",gap:7,flex:1,minWidth:0}}><span style={{fontSize:12,width:16,textAlign:"center",flexShrink:0}}>{i}</span><span style={{fontSize:11.5,color:"#8a8aa8",fontFamily:F1}}>{l}</span></div><div style={{textAlign:"right",flexShrink:0,maxWidth:"55%",paddingLeft:6}}><span style={{fontSize:12,fontWeight:600,color:h||"#c8c8e0",fontFamily:F1,wordBreak:"break-word"}}>{v}</span>{s&&<div style={{fontSize:8.5,color:"#3a3a54",marginTop:1}}>{s}</div>}</div></div>)}
function Sec({t,i,c,s,ch}){return(<div style={{background:"linear-gradient(145deg,rgba(14,14,30,0.94),rgba(10,10,24,0.97))",borderRadius:13,border:`1px solid ${c}10`,overflow:"hidden",marginBottom:14}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 14px",borderBottom:`1px solid ${c}08`,background:`linear-gradient(90deg,${c}04,transparent)`}}><div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:15}}>{i}</span><span style={{fontSize:10.5,fontWeight:600,color:c,fontFamily:F1,textTransform:"uppercase",letterSpacing:1}}>{t}</span></div><div style={{background:`${c}0e`,borderRadius:14,padding:"1px 9px",fontSize:12,fontWeight:700,color:c,fontFamily:F2}}>{s}/10</div></div>{ch}</div>)}
function Chip({t,c="#60a5fa"}){return <span style={{display:"inline-block",padding:"2px 7px",borderRadius:4,fontSize:9.5,fontWeight:600,color:c,background:`${c}0c`,fontFamily:F1}}>{t}</span>}

/* ═══════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════ */
export default function App() {
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(null);
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [deptFilter, setDeptFilter] = useState("all");
  const [sortBy, setSortBy] = useState("score");
  const [apiResults, setApiResults] = useState([]);
  const [apiData,    setApiData]    = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [searching,  setSearching]  = useState(false);
  const API = "https://radar-immo76-1.onrender.com";

  useEffect(() => {
    if (!search || search.length < 2) { setApiResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`${API}/search?q=${encodeURIComponent(search)}`);
        if (r.ok) {
          const data = await r.json();
          setApiResults(data.map(c => ({
            n: c.nom, d: c.departement?.code || "?",
            pop: c.population || 0, _api: true
          })));
        }
      } catch(e) {}
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const enriched = useMemo(() => D.map(c => ({ ...c, sc: computeScores(c) })), []);

  const filtered = useMemo(() => {
    if (search && search.length >= 2) return apiResults;
    let list = enriched;
    if (deptFilter !== "all") list = list.filter(c => c.d === deptFilter);
    if (sortBy === "score") list = [...list].sort((a,b) => b.sc.g - a.sc.g);
    else if (sortBy === "renta") list = [...list].sort((a,b) => b.rb - a.rb);
    else if (sortBy === "pop") list = [...list].sort((a,b) => b.pop - a.pop);
    else if (sortBy === "prix") list = [...list].sort((a,b) => (a.pa||9999) - (b.pa||9999));
    return list;
  }, [enriched, deptFilter, search, sortBy, apiResults]);

  async function fetchCommune(nom) {
    setApiLoading(true); setApiData(null);
    try {
      const r = await fetch(`${API}/analyse/${encodeURIComponent(nom)}`);
      if (r.ok) { const json = await r.json(); setApiData(json); }
    } catch(e) { console.error("API error:", e); }
    setApiLoading(false);
  }

  function select(c) {
    setSel(c); setOpen(false); setSearch(""); setApiResults([]);
    setShow(false); setTimeout(() => setShow(true), 50);
    fetchCommune(c.n);
  }

  const city = sel;
  const apiSc = apiData?.scores ? {
    r: apiData.scores.rendement, d: apiData.scores.demographie,
    s: apiData.scores.socio_eco, g: apiData.scores.global
  } : null;
  const sc = apiSc || city?.sc;
  const gc = sc ? nc(sc.g) : "#818cf8";
  const pa = apiData?.prix?.appartement_m2 || city?.pa;
  const pm = apiData?.prix?.maison_m2 || city?.pm;
  const lo = apiData?.loyer?.appartement_m2 || city?.lo;
  const rb = apiData?.rentabilite_brute_pct || city?.rb;
  const prixSource = apiData?.prix?.source || "MeilleurAgents 02/2026";
  const loyerSource = apiData?.loyer?.source || "Carte loyers ANIL 2024";

    return (
    <div style={{minHeight:"100vh",background:"linear-gradient(170deg,#060610,#090918 40%,#0b0b20)",fontFamily:F1,color:"#c8c8e0"}}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box}input::placeholder{color:#3a3a50}select{background:#10102a;color:#a0a0c0;border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:5px 8px;font-size:11px;font-family:'Outfit',sans-serif;outline:none}`}</style>
      <div style={{position:"fixed",top:-150,right:-100,width:400,height:400,background:"radial-gradient(circle,rgba(129,140,248,0.035),transparent 70%)",pointerEvents:"none"}}/>
      
      {/* Header */}
      <div style={{padding:"32px 14px 4px",textAlign:"center",maxWidth:760,margin:"0 auto"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 11px",borderRadius:14,background:"rgba(129,140,248,0.04)",border:"1px solid rgba(129,140,248,0.08)",marginBottom:10}}>
          <span style={{fontSize:10}}>🏠</span>
          <span style={{fontSize:9,textTransform:"uppercase",letterSpacing:2.5,color:"#818cf8",fontWeight:600}}>Radar Investissement · {D.length} communes</span>
        </div>
        <h1 style={{fontSize:30,fontFamily:F2,fontWeight:700,margin:0,background:"linear-gradient(135deg,#e8e8ff,#a5b4fc 60%,#818cf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Radar Immobilier Normandie</h1>
        <p style={{fontSize:11.5,color:"#3a3a54",marginTop:6,lineHeight:1.6,maxWidth:440,margin:"6px auto 0"}}>
          Scoring multi-critères — prix DVF notarial 2024 (DGFiP), loyers ANIL 2024, zonage ABC officiel, données socio-éco INSEE.
        </p>
      </div>

      <div style={{maxWidth:760,margin:"0 auto",padding:"0 12px 50px"}}>
        {/* Filters */}
        <div style={{display:"flex",gap:8,marginTop:18,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
          <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)}>
            <option value="all">Tous les départements</option>
            <option value="76">Seine-Maritime (76)</option>
            <option value="14">Calvados (14)</option>
            <option value="27">Eure (27)</option>
            <option value="50">Manche (50)</option>
            <option value="61">Orne (61)</option>
            <option value="60">Oise (60)</option>
            <option value="80">Somme (80)</option>
            <option value="35">Ille-et-Vilaine (35)</option>
          </select>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)}>
            <option value="score">Trier par score</option>
            <option value="renta">Trier par rentabilité</option>
            <option value="pop">Trier par population</option>
            <option value="prix">Trier par prix (croissant)</option>
          </select>
          <span style={{fontSize:10,color:"#3a3a54"}}>{filtered.length} communes</span>
        </div>

        {/* Selector */}
        <div style={{position:"relative",marginBottom:6,zIndex:100}}>
          <div onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(12,12,30,0.85)",border:"1px solid rgba(129,140,248,0.08)",borderRadius:11,padding:"11px 14px",cursor:"pointer",backdropFilter:"blur(10px)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:15}}>🏙️</span>
              <span style={{fontSize:13,color:city?"#e0e0f0":"#3a3a58",fontWeight:city?600:400}}>{city?`${city.n}${city.d&&city.d!=="?"?" — "+(DEPTS[city.d]||"Dept "+city.d)+" ("+city.d+")":""}`:"Rechercher une commune..."}</span>
              {sc&&<span style={{background:`${gc}12`,color:gc,padding:"1px 8px",borderRadius:9,fontSize:11,fontWeight:700,fontFamily:F2}}>{sc.g}</span>}
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{transform:open?"rotate(180deg)":"",transition:"transform .15s"}}><path d="M3 4.5L6 7.5L9 4.5" stroke="#4a4a68" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          {open&&(
            <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"rgba(10,10,26,0.98)",border:"1px solid rgba(129,140,248,0.08)",borderRadius:11,overflow:"hidden",boxShadow:"0 14px 40px rgba(0,0,0,0.5)",maxHeight:360,zIndex:999}}>
              <div style={{padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.02)",display:"flex",alignItems:"center",gap:6}}>
                <input type="text" placeholder="Tapez le nom d'une commune..." value={search} onChange={e=>setSearch(e.target.value)} autoFocus style={{flex:1,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:6,padding:"8px 10px",color:"#e0e0f0",fontSize:12,outline:"none",fontFamily:F1}}/>
                {searching&&<span style={{fontSize:11,color:"#818cf8",flexShrink:0}}>⟳</span>}
              </div>
              {search.length<2&&<div style={{padding:"6px 14px",fontSize:10,color:"#2a2a40",borderBottom:"1px solid rgba(255,255,255,0.015)"}}>Tapez 2+ lettres pour chercher parmi les 676 communes Seine-Maritime</div>}
              <div style={{overflowY:"auto",maxHeight:300}}>
                {filtered.map((c,i)=>{
                  const cs=c._api?null:c.sc;
                  const cc=cs?nc(cs.g):"#818cf8";
                  return(
                  <div key={c.n+i} onClick={()=>select(c)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.015)",background:sel?.n===c.n?"rgba(129,140,248,0.05)":"transparent"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(129,140,248,0.03)"} onMouseLeave={e=>e.currentTarget.style.background=sel?.n===c.n?"rgba(129,140,248,0.05)":"transparent"}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:"#e0e0f0"}}>
                        {!c._api&&<span style={{color:"#3a3a54",fontSize:10,marginRight:5}}>#{i+1}</span>}
                        {c.n}
                      </div>
                      <div style={{fontSize:10,color:"#3a3a54",marginTop:1}}>{c._api?`Dépt ${c.d}`:(DEPTS[c.d]||c.d)} · {(c.pop||0).toLocaleString("fr-FR")} hab.</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {c._api
                        ?<span style={{fontSize:9,color:"#818cf8",background:"rgba(129,140,248,0.08)",padding:"2px 7px",borderRadius:4,fontWeight:600}}>DVF</span>
                        :<><span style={{fontSize:10,color:"#3a3a54"}}>{c.rb}%</span><span style={{fontFamily:F2,fontSize:14,fontWeight:700,color:cc}}>{cs?.g}</span></>
                      }
                    </div>
                  </div>
                );})}
                {filtered.length===0&&!searching&&<div style={{padding:16,textAlign:"center",color:"#3a3a54",fontSize:11}}>{search.length>=2?"Aucune commune trouvée.":"Aucun résultat."}</div>}
              </div>
            </div>
          )}
        </div>

        {/* Empty */}
        {!city&&<div style={{textAlign:"center",padding:"40px 14px"}}><div style={{fontSize:40,marginBottom:10,opacity:.1}}>📊</div><p style={{color:"#2a2a40",fontSize:12,lineHeight:1.7,maxWidth:340,margin:"0 auto"}}>Sélectionnez une commune pour afficher l'analyse.</p></div>}

        {/* Results */}
        {city&&sc&&(
          <div style={{opacity:show?1:0,transform:show?"translateY(0)":"translateY(14px)",transition:"all .5s ease-out",marginTop:4}}>
            {/* Hero */}
            <div style={{background:"linear-gradient(145deg,rgba(12,12,34,0.94),rgba(8,8,24,0.97))",borderRadius:16,padding:"28px 18px 22px",border:`1px solid ${gc}0c`,marginBottom:16,textAlign:"center",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-40,left:"50%",transform:"translateX(-50%)",width:280,height:280,background:`radial-gradient(circle,${gc}03,transparent 70%)`,pointerEvents:"none"}}/>
              <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:3.5,color:"#3a3a54",fontWeight:600}}>Note globale</div>
              <div style={{fontSize:62,fontFamily:F2,fontWeight:700,color:gc,lineHeight:1,marginTop:2}}>{sc.g}</div>
              <div style={{fontSize:12,color:gc,fontWeight:600,marginTop:2}}>{nl(sc.g)}</div>
              <div style={{fontSize:18,fontFamily:F2,color:"#e0e0ff",marginTop:8,fontWeight:600}}>{apiData?.commune||city.n}{apiLoading&&<span style={{fontSize:9,color:"#818cf8",marginLeft:8,fontFamily:F1,fontWeight:400,opacity:.7}}>⟳ chargement…</span>}</div>
              <div style={{fontSize:10.5,color:"#3a3a54",marginTop:2}}>{DEPTS[city.d]||city.d} · {(apiData?.population||city.pop||0).toLocaleString("fr-FR")} hab.{apiData?.code_postal?" · "+apiData.code_postal:""}</div>
              <div style={{display:"flex",justifyContent:"center",gap:14,marginTop:20,flexWrap:"wrap"}}>
                <Gauge s={sc.r} l="Rendement" c="#f472b6"/>
                <Gauge s={sc.d} l="Démographie" c="#60a5fa"/>
                <Gauge s={sc.s} l="Socio-éco" c="#34d399"/>
              </div>
              <div style={{marginTop:12,fontSize:9,color:"#24243a"}}>Rendement 40% · Démographie 30% · Socio-économique 30%</div>
            </div>

            <Sec t="Rendement Locatif" i="💰" c="#f472b6" s={sc.r}>
              <Row i="🏢" l="Prix m² appart." v={pa?`${Number(pa).toLocaleString("fr-FR")} €`:"—"} s={prixSource}/>
              <Row i="🏡" l="Prix m² maison" v={pm?`${Number(pm).toLocaleString("fr-FR")} €`:"—"}/>
              <Row i="🔑" l="Loyer moyen /m²" v={lo?`${Number(lo).toFixed(1)} €`:"—"} s={loyerSource}/>
              <Row i="📈" l="Rentabilité brute" v={rb?`${Number(rb).toFixed(1)} %`:"—"} h={rb>=8?"#34d399":rb>=6?"#60a5fa":"#fbbf24"}/>
              <Row i="📊" l="Évol. prix 12 mois" v={city.ev!=null?`${city.ev>0?"+":""}${city.ev.toFixed(1)} %`:"N/A"} h={city.ev!=null&&city.ev<=0?"#34d399":"#fbbf24"}/>
              <div style={{padding:"7px 14px",display:"flex",gap:5,flexWrap:"wrap"}}>
                <Chip t={`Zone ${city.zt} — ${tensionLabel(city.zt)}`} c={city.zt==="B1"||city.zt==="A"||city.zt==="Abis"?"#34d399":"#fbbf24"}/>
                <Chip t={`Vacance : ${city.vac}% — ${vacLabel(city.vac)}`} c={city.vac<=8?"#34d399":city.vac<=12?"#fbbf24":"#f87171"}/>
              </div>
            </Sec>

            <Sec t="Attractivité Démographique" i="👥" c="#60a5fa" s={sc.d}>
              <Row i="🏘️" l="Population" v={city.pop.toLocaleString("fr-FR")} s="INSEE 2023"/>
              <Row i="📈" l="Évolution annuelle" v={`${city.ep>0?"+":""}${city.ep.toFixed(1)} %`} h={city.ep>0?"#34d399":"#f87171"}/>
              <Row i="🎓" l="Étudiants" v={city.et.toLocaleString("fr-FR")}/>
              <Row i="🏷️" l="Zonage tension (ABC)" v={tensionLabel(city.zt)} s="Décret 2013 + arrêté 07/2024" h={city.zt==="B1"||city.zt==="A"?"#34d399":"#fbbf24"}/>
              <Row i="🏚️" l="Taux logements vacants" v={`${city.vac.toFixed(1)} %`} s="INSEE recensement" h={city.vac<=8?"#34d399":city.vac<=12?"#fbbf24":"#f87171"}/>
              <Row i="🚆" l="Transports" v={city.tr}/>
              <Row i="🏗️" l="Projets urbains" v={city.pu}/>
            </Sec>

            <Sec t="Solidité Socio-Économique" i="🏛️" c="#34d399" s={sc.s}>
              <Row i="📉" l="Chômage (recensement)" v={`${city.tc.toFixed(1)} %`} s="Recensement INSEE 2021" h={city.tc<=12?"#34d399":city.tc<=18?"#fbbf24":"#f87171"}/>
              <Row i="💶" l="Revenu médian" v={`${city.rm.toLocaleString("fr-FR")} €/an`} h={city.rm>=22000?"#34d399":"#60a5fa"}/>
              <Row i="👔" l="Part cadres" v={`${city.pc.toFixed(1)} %`} h={city.pc>=16?"#34d399":"#60a5fa"}/>
              <Row i="⚠️" l="Taux de pauvreté" v={`${city.tp.toFixed(1)} %`} h={city.tp<=15?"#34d399":city.tp<=20?"#fbbf24":"#f87171"}/>
            </Sec>

            <div style={{background:"rgba(8,8,18,0.4)",borderRadius:11,padding:"14px 16px",border:"1px solid rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:2,color:"#24243a",marginBottom:8,fontWeight:600}}>📋 Sources & Méthodologie</div>
              <div style={{fontSize:10.5,color:"#3a3a54",lineHeight:1.8}}>
                <strong style={{color:"#48486a"}}>Tension locative</strong> — Zonage ABC officiel (décret 2013-392 + arrêté 05/07/2024). A/Abis/B1 = zone tendue.<br/>
                <strong style={{color:"#48486a"}}>Vacance locative</strong> — Taux de logements vacants, recensement INSEE 2021.<br/>
                <strong style={{color:"#48486a"}}>Prix & loyers</strong> — DVF notarial 2024 (DGFiP) + Carte des loyers ANIL 2024. <strong style={{color:"#48486a"}}>Socio-éco</strong> — Dossiers complets INSEE.<br/>
                <span style={{color:"#1e1e34"}}>Indicatif uniquement. Ne constitue pas un conseil en investissement.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
