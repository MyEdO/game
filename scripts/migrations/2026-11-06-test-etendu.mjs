/**
 * Migration #3012 (#1463, L4 « Test », étape D) — la cible de DR d'un Test ÉTENDU (`LDB 12 l.174`) prend en
 * donnée son nom UNIQUE, `targetDR` (`cibleEtendueSchema`, `src/data/schemas/grammaire/valeurs.ts`), celui
 * que portaient déjà l'effet `extendedTest` des scènes et le moteur (`extendedTestStep`).
 *
 * GESTE, par porteur de `CIBLES` : la clé d'avant (`totalDR`, `extendedDR`, `restoreDR`) devient `targetDR`,
 * à son rang ; les autres clés ne bougent pas. Le gabarit d'enjeu `sea-degagement-debris` (`stakes.json`)
 * nomme la même valeur : son paramètre `{totalDR}` devient `{targetDR}`.
 *
 * ENTRÉES : `src/data/sea-perils.json`, `src/data/sea-cargo.json`, `src/data/sea-events.json`,
 * `src/data/steam-breakdown.json`, `src/data/criticals.json`, `src/data/stakes.json` (les seules données lues
 * et écrites).
 * IDEMPOTENT : un porteur qui porte déjà `targetDR` sans la clé d'avant n'a aucun geste ; rejouée sur l'état
 * final, rien ne s'écrit.
 * FAIL-FAST — sortie 1 avant toute écriture : fichier hors de son formatage, porteur qui porte à la fois la
 * clé d'avant et `targetDR`, ou aucune des deux là où la cible est exigée, gabarit qui garde `{totalDR}`.
 * FORMATAGE : `serializeDataset` (`src/data/serialize.ts`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lignesDe } from './lib/monoTable.mjs';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = 'drCible';

/** `avant` → `targetDR` sur `porteur`, au même rang. `exigee` : le porteur doit porter l'une des deux. */
function renommer(porteur, avant, ou, fautes, { exigee = true } = {}) {
  const a = Object.hasOwn(porteur, avant);
  const c = Object.hasOwn(porteur, CIBLE);
  if (a && c) { fautes.push(`${ou} : \`${avant}\` ET \`${CIBLE}\``); return 0; }
  if (!a) { if (exigee && !c) fautes.push(`${ou} : ni \`${avant}\` ni \`${CIBLE}\``); return 0; }
  const entrees = Object.entries(porteur).map(([k, v]) => [k === avant ? CIBLE : k, v]);
  for (const k of Object.keys(porteur)) delete porteur[k];
  Object.assign(porteur, Object.fromEntries(entrees));
  return 1;
}

/** Les porteurs d'une liste qui sont des objets, avec leur adresse. */
const porteurs = (liste, adresse) => liste.flatMap((p, i) => (p && typeof p === 'object' ? [[p, adresse(i)]] : []));

const GABARIT_AVANT = '{totalDR}';
const GABARIT_CIBLE = `{${CIBLE}}`;

/** Le gabarit de l'enjeu `sea-degagement-debris` : `{totalDR}` → `{targetDR}`. */
function gabarit(enjeu, ou, fautes) {
  if (typeof enjeu.template !== 'string') { fautes.push(`${ou} : gabarit absent`); return 0; }
  if (!enjeu.template.includes(GABARIT_AVANT)) {
    if (!enjeu.template.includes(GABARIT_CIBLE)) fautes.push(`${ou} : ni \`${GABARIT_AVANT}\` ni \`${GABARIT_CIBLE}\``);
    return 0;
  }
  enjeu.template = enjeu.template.replaceAll(GABARIT_AVANT, GABARIT_CIBLE);
  return 1;
}

const CIBLES = [
  { rel: 'src/data/sea-perils.json', sites: (d) => [
    ...porteurs(d.hazards.map((h) => h.freeTest), (i) => `hazards[${d.hazards[i].id}].freeTest`).map(([p, ou]) => [(f) => renommer(p, 'totalDR', ou, f), ou]),
    ...porteurs(d.tourbillons.map((w) => w.evasion), (i) => `tourbillons[${d.tourbillons[i].id}].evasion`).map(([p, ou]) => [(f) => renommer(p, 'totalDR', ou, f), ou]),
  ] },
  { rel: 'src/data/sea-cargo.json', sites: (d) => [[(f) => renommer(d.opportunite, 'totalDR', 'opportunite', f), 'opportunite']] },
  // `boardEvents.entries` : la forme que pose `2026-11-06-1667-evenements-de-bord-tires.mjs`, reconnue au rejeu.
  { rel: 'src/data/sea-events.json', sites: (d) => {
    const infestations = (Array.isArray(d.boardEvents) ? d.boardEvents : d.boardEvents.entries).filter((e) => e.kind === 'infestation');
    return porteurs(infestations.map((e) => e.params), (i) => `boardEvents[${infestations[i].id}].params`)
      .map(([p, ou]) => [(f) => renommer(p, 'totalDR', ou, f), ou]);
  } },
  { rel: 'src/data/steam-breakdown.json', sites: (d) =>
    lignesDe(d).flatMap((b) => porteurs(b.restart ?? [], (i) => `${b.id} › restart[${i}]`))
      .map(([p, ou]) => [(f) => renommer(p, 'extendedDR', ou, f, { exigee: false }), ou]) },
  { rel: 'src/data/criticals.json', sites: (d) =>
    d.flatMap((t) => porteurs((t.entries ?? []).map((e) => e.escalation?.medicalAidGate), (i) => `${t.id} › entries[${t.entries[i].id}].escalation.medicalAidGate`))
      .map(([p, ou]) => [(f) => renommer(p, 'restoreDR', ou, f), ou]) },
  { rel: 'src/data/stakes.json', sites: (d) =>
    porteurs(d.filter((s) => s.id === 'sea-degagement-debris'), () => 'sea-degagement-debris.template').map(([p, ou]) => [(f) => gabarit(p, ou, f), ou]) },
];

const fautes = [];
const aEcrire = [];
const bilan = [];
for (const { rel, sites } of CIBLES) {
  const chemin = path.join(ROOT, rel);
  const texte = fs.readFileSync(chemin, 'utf8');
  const doc = JSON.parse(texte);
  if (serializeDataset(doc) !== texte) { fautes.push(`${rel} : formatage non canonique`); continue; }
  const liste = sites(doc);
  let gestes = 0;
  for (const [geste] of liste) gestes += geste(fautes);
  bilan.push(`${rel} : ${gestes} geste(s) sur ${liste.length} porteur(s)`);
  const sortie = serializeDataset(doc);
  if (sortie !== texte) aEcrire.push([chemin, sortie]);
}

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [chemin, sortie] of aEcrire) fs.writeFileSync(chemin, sortie);
console.log(`migration 3012 test étendu : ${aEcrire.length} fichier(s) réécrit(s).\n${bilan.join('\n')}`);
