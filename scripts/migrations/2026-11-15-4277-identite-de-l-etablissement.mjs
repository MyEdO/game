/**
 * Migration #4277 B1 — l'identité de l'établissement : un service de lieu porte un `id` STABLE, unique dans son lieu
 * (`src/noyau/worldMap.ts` › `PlaceService.id`), et un point d'intérêt vise un service RÉSOLU du lieu par cet id
 * (`PlacePoi.service`), dont il prend le nom (`nomDuPoi`) : il ne porte plus de `label`.
 *
 *   porteur                                   avant                                   après
 *   `worldMap.places[].services[]`            `{ kind: { id: K }, … }`                `{ id: K, kind: { id: K }, … }`
 *   `worldMap.places[].poi[]` (service)       `{ id, label: L, pos, serviceKind: S }` `{ id, pos, service: S }`
 *
 * Le `label` d'un point d'intérêt qui vise un établissement DÉCLARÉ sans `label` passe à cet établissement, sauf s'il
 * égale le libellé de son entrée du catalogue (`lieux-services.json`) ; celui d'un point d'intérêt qui vise un service
 * AUTOMATIQUE (port, marché) tombe : le nom se lit au catalogue. `id = kind.id` garde la clé de stock marchand
 * (`placeServiceMerchantId`).
 *
 * ENTRÉES : écrites — les quatre projets de `projets/jeu-de-role/campagnes/` ; lue — `src/data/lieux-services.json`.
 * CARDINAL ASSERTÉ : `PAR_PROJET` gestes au premier passage. Deux services d'un même type dans un lieu, un fichier
 * hors de son formatage : ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré : 0 geste, rien ne
 * s'écrit, sortie 0.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const PROJETS = [
  'projets/jeu-de-role/campagnes/arene/arene-projet.json',
  'projets/jeu-de-role/campagnes/barge-du-sel/barge-du-sel-projet.json',
  'projets/jeu-de-role/campagnes/diligence/diligence-projet.json',
  'projets/jeu-de-role/campagnes/loup-et-saumure/loup-et-saumure-projet.json',
];

/** Gestes du premier passage par projet (6 services, 8 points d'intérêt), mesurés le 2026-11-15 sur `ff1698a58a`. */
const PAR_PROJET = { 'projets/jeu-de-role/campagnes/loup-et-saumure/loup-et-saumure-projet.json': 14 };

const serialiser = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
const libelleDuCatalogue = new Map(JSON.parse(readFileSync(join(ROOT, 'src/data/lieux-services.json'), 'utf8')).map((e) => [e.id, e.label]));

/** L'objet `o` où la clé `de` devient `vers` (valeur `valeur`) à son rang, sans les clés `sans`. */
const renommer = (o, de, vers, valeur, sans = []) =>
  Object.fromEntries(Object.entries(o).flatMap(([k, v]) => (sans.includes(k) ? [] : [[k === de ? vers : k, k === de ? valeur : v]])));

/** Le service `s` où `label` est posé juste après `kind`. */
const avecLibelle = (s, label) => Object.fromEntries(Object.entries(s).flatMap(([k, v]) => (k === 'kind' ? [[k, v], ['label', label]] : [[k, v]])));

const arrets = [];
const aEcrire = [];
const gestesPar = {};
for (const rel of PROJETS) {
  const chemin = join(ROOT, rel);
  const brut = readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== serialiser(doc)) { arrets.push(`${rel} : formatage non canonique`); continue; }
  let gestes = 0;
  for (const lieu of doc.worldMap?.places ?? []) {
    if (lieu.services) {
      const kinds = lieu.services.filter((s) => s.id === undefined).map((s) => s.kind.id);
      const doublon = kinds.find((k, i) => kinds.indexOf(k) !== i);
      if (doublon) { arrets.push(`${rel} › ${lieu.id} : deux services « ${doublon} » sans id`); continue; }
      lieu.services = lieu.services.map((s) => {
        if (s.id !== undefined) return s;
        gestes += 1;
        return { id: s.kind.id, ...s };
      });
    }
    if (lieu.poi) {
      lieu.poi = lieu.poi.map((p) => {
        if (p.serviceKind === undefined) return p;
        gestes += 1;
        const cible = p.serviceKind.id;
        const i = (lieu.services ?? []).findIndex((s) => s.id === cible);
        const s = lieu.services?.[i];
        if (s && p.label !== undefined && s.label === undefined && p.label !== libelleDuCatalogue.get(s.kind.id)) lieu.services[i] = avecLibelle(s, p.label);
        return renommer(p, 'serviceKind', 'service', { id: cible }, ['label']);
      });
    }
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
console.log(`migration 4277 B1 (identité de l'établissement) : ${Object.values(gestesPar).reduce((a, b) => a + b, 0)} geste(s) ${JSON.stringify(gestesPar)}.`);
