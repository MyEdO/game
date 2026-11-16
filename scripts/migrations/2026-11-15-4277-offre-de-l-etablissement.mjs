/**
 * Migration #4277 B2b — l'offre de l'établissement : la qualité et l'offre de repos d'un lieu qui déclare un établissement
 * d'hébergement ont UN porteur, `PlaceService.rest` (`src/noyau/worldMap.ts`) ; la scène liée à ce lieu ne les porte plus
 * (`validateScene`).
 *
 *   porteur                              avant                               après
 *   `scenes[].rest` (scène d'un lieu     `{ auberge: true, … }`              sans `auberge` ni `quality` ; `rest` vide retiré
 *   à établissement d'hébergement)
 *
 * ENTRÉES : écrites — les quatre projets de `src/scenes/` ; lue — `src/data/lieux-services.json`.
 * CARDINAL ASSERTÉ : `PAR_PROJET` gestes au premier passage. Une scène qui porte une `quality` (arbitrage de l'auteur à
 * reporter sur l'établissement), un fichier hors de son formatage : ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée
 * sur l'arbre migré : 0 geste, rien ne s'écrit, sortie 0.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const PROJETS = [
  'src/scenes/arene/arene-projet.json',
  'src/scenes/barge-du-sel/barge-du-sel-projet.json',
  'src/scenes/diligence/diligence-projet.json',
  'src/scenes/loup-et-saumure/loup-et-saumure-projet.json',
];

/** Gestes du premier passage par projet (les scènes `ls-quai-salzenmund` et `ls-quai-erengrad`), mesurés le 2026-11-15. */
const PAR_PROJET = { 'src/scenes/loup-et-saumure/loup-et-saumure-projet.json': 2 };

const serialiser = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
const hebergements = new Set(JSON.parse(readFileSync(join(ROOT, 'src/data/lieux-services.json'), 'utf8')).filter((e) => e.hebergement === true).map((e) => e.id));

const arrets = [];
const aEcrire = [];
const gestesPar = {};
for (const rel of PROJETS) {
  const chemin = join(ROOT, rel);
  const brut = readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== serialiser(doc)) { arrets.push(`${rel} : formatage non canonique`); continue; }
  let gestes = 0;
  const scenesAHebergement = new Set((doc.worldMap?.places ?? []).filter((p) => (p.services ?? []).some((s) => hebergements.has(s.kind.id))).map((p) => p.scene.id));
  for (const scene of doc.scenes ?? []) {
    if (!scenesAHebergement.has(scene.id) || !scene.rest) continue;
    if (scene.rest.quality !== undefined) { arrets.push(`${rel} › ${scene.id} : qualité de repos « ${scene.rest.quality} » à reporter sur l'établissement`); continue; }
    if (scene.rest.auberge === undefined) continue;
    gestes += 1;
    const { auberge: _auberge, ...reste } = scene.rest;
    if (Object.keys(reste).length) scene.rest = reste;
    else delete scene.rest;
  }
  const attendu = PAR_PROJET[rel] ?? 0;
  if (gestes && gestes !== attendu) arrets.push(`${rel} : ${gestes} geste(s), ${attendu} attendu(s)`);
  if (gestes) { gestesPar[rel] = gestes; aEcrire.push([chemin, serialiser(doc)]); }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [chemin, sortie] of aEcrire) writeFileSync(chemin, sortie, 'utf8');
console.log(`migration 4277 B2b (offre de l'établissement) : ${Object.values(gestesPar).reduce((a, b) => a + b, 0)} geste(s) ${JSON.stringify(gestesPar)}.`);
