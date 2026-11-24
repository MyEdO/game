/**
 * Migration #4930 — les Traits psychologiques du *Bestiaire non officiel* dont la Cible imprimée n'est aucun Groupe
 * (« Non-Skaven », « Aventuriers », « Empire », « Chiens ») deviennent des Cibles au choix, que l'auteur désigne en
 * posant le PNJ. laurent, 2026-11-24 : « C est des haines au choix ». Fiche `user-arbitrage-bestiaire-non-officiel`.
 *
 * GESTE, joué une seule fois (NO-OP dès que ces instances portent leur joker) : `creatures.json`, sur chaque statbloc
 * cité au livre, chaque instance de Trait à Cible psy (`specsSource: ciblesPsy`) sans `arg`, en Trait ou en
 * optionnel, reçoit `arg: 'au choix'` (`ARG_JOKER`, `src/data/schemas/grammaire/reference.ts`). La migration #4916
 * les a posées sans `arg` (`ARG_DE_TRAIT`, `scripts/migrations/2026-11-24-4916-bestiaire-non-officiel.mjs`).
 *
 * ENTRÉES : écrite — `src/data/creatures.json` ; lue — `src/data/traits.json`.
 * FAIL-FAST — avant toute écriture, sortie 1 : document hors `serializeDataset`, instance hors de `ATTENDUES`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = (rel) => path.join(ROOT, 'src/data', rel);
const LIVRE = 'bestiaire-non-officiel';
const JOKER = 'au choix';

/** Les instances que le geste touche, `statbloc:Trait`, une par Cible imprimée : BNO p.35, p.45, p.20, p.28. */
const ATTENDUES = new Set([
  'verminarque-du-rat-cornu:haine', 'treekin:haine', 'chats-domestiques:effraye', 'chats-domestiques:animosite', 'zoats:prejuge',
]);

const texte = fs.readFileSync(DATA('creatures.json'), 'utf8');
if (serializeDataset(JSON.parse(texte)) !== texte) {
  console.error('#4930 — rien n\'est écrit : creatures.json hors serializeDataset');
  process.exit(1);
}
const creatures = JSON.parse(texte);
const ciblesPsy = new Set(JSON.parse(fs.readFileSync(DATA('traits.json'), 'utf8')).filter((t) => t.specsSource === 'ciblesPsy').map((t) => t.id));

const fautes = [];
let poses = 0;
for (const c of creatures) {
  if (c.source?.book !== LIVRE) continue;
  for (const x of [...(c.traits ?? []), ...(c.optionals ?? [])]) {
    if (!ciblesPsy.has(x.id) || x.arg !== undefined) continue;
    const cle = `${c.id}:${x.id}`;
    if (!ATTENDUES.has(cle)) fautes.push(`${cle} : instance sans Cible hors d'ATTENDUES`);
    x.arg = JOKER;
    poses++;
  }
}
if (fautes.length) {
  console.error(`#4930 — rien n'est écrit :\n  ${fautes.join('\n  ')}`);
  process.exit(1);
}
const apres = serializeDataset(creatures);
if (apres !== texte) fs.writeFileSync(DATA('creatures.json'), apres);
console.log(`#4930 — ${poses} Cible(s) au choix.`);
