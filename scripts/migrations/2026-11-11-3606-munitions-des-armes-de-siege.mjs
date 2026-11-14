/**
 * Migration #3606 M1f — une arme de siège nomme TOUTES ses munitions, la représentative en tête, au lieu d'une
 * seule. AA 10 l.150 : une arme de siège ne tire que les munitions de son tableau.
 *
 *   forme d'avant                       forme d'après
 *   `defaultAmmo: { id }`               `munitions: [<id>, …]`, à la même place, `id` en tête
 *   (aucune, catapultes)                `munitions: [<id>, …]`, après `rendu`
 *
 * Les munitions de chaque arme, par son tableau (`MUNITIONS`) : MDG 12 l.413-424 ; AA 10 l.200-221.
 *
 * Entrées : `src/data/trappings.json`.
 *
 * Une arme nommée par `MUNITIONS` absente du catalogue passe sans faute (`scripts/migrations/lib/formeDAvant.mjs`).
 * Une `defaultAmmo` qui n'est pas la première munition de son arme, une `defaultAmmo` sur une arme hors de
 * `MUNITIONS`, ou un document non canonique sont un ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre
 * migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TRAPPINGS = join(ROOT, 'src/data/trappings.json');

const BALISTE = ['carreau-de-baliste', 'carreau-nain-norse']; // MDG 12 l.413-415 ; AA 10 l.202
const CANON = ['boulet-et-poudre', 'mitraille-et-poudre']; // MDG 12 l.416-418 ; AA 10 l.206-207
const MORTIER = ['bombe-de-mortier', 'bombe-incendiaire-mortier']; // MDG 12 l.419-421 ; AA 10 l.217-218
const PIERRIER = ['balles-et-poudre-pierrier', 'petites-munitions-et-poudre-pierrier']; // MDG 12 l.422-424 ; AA 10 l.220-221
const CATAPULTE = ['bombe-incendiaire-mortier']; // AA 10 l.212-213
const MUNITIONS = new Map([
  ['baliste', BALISTE], ['baliste-ade2', BALISTE],
  ['canon-petit', CANON], ['canon-moyen', CANON], ['canon-grand', CANON], ['canon-ade2', CANON],
  ['mortier', MORTIER], ['mortier-ade2', MORTIER],
  ['pierrier', PIERRIER],
  ['catapulte-petite', CATAPULTE], ['catapulte-moyenne', CATAPULTE], ['catapulte-grande', CATAPULTE],
]);

const brut = readFileSync(TRAPPINGS, 'utf8');
const doc = JSON.parse(brut);
const arrets = [];
if (brut !== `${JSON.stringify(doc, null, 2)}`) arrets.push('trappings.json : forme non canonique');
let gestes = 0;
for (const t of doc) {
  const munitions = MUNITIONS.get(t.id);
  if (t.defaultAmmo !== undefined && !munitions) { arrets.push(`« ${t.id} » : defaultAmmo hors du tableau des munitions`); continue; }
  if (!munitions || t.munitions !== undefined) continue;
  if (t.defaultAmmo !== undefined && t.defaultAmmo.id !== munitions[0]) arrets.push(`« ${t.id} » : defaultAmmo « ${t.defaultAmmo.id} » ≠ « ${munitions[0]} »`);
  const copie = Object.entries(t);
  for (const k of Object.keys(t)) delete t[k];
  for (const [k, v] of copie) {
    if (k === 'defaultAmmo') t.munitions = munitions;
    else t[k] = v;
    if (k === 'rendu' && !('defaultAmmo' in Object.fromEntries(copie))) t.munitions = munitions;
  }
  gestes++;
}
if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
const out = JSON.stringify(doc, null, 2);
if (out !== brut) writeFileSync(TRAPPINGS, out, 'utf8');
console.log(`migration 3606 (munitions des armes de siège) : ${gestes} arme(s).`);
