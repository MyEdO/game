/**
 * Migration #1897 — `gods.json › [].blessings`, `› miracles` et `› chaosSpells` passent de `{ id }` à
 * l'id NU.
 *
 * POURQUOI : les trois champs adoptent `refs('spell')` (`src/data/schemas/defs/gods.ts`), la graphie de
 * « liste de références » de la grammaire (`src/data/schemas/grammaire/ref.ts › refs`), comme
 * `creatures.json › spells` (`2026-09-23-1897-sorts-de-creature-ids-nus.mjs`). L'id y est refiné AU
 * PARSE contre `spells.json`. Les ids eux-mêmes ne bougent pas : seule l'ENVELOPPE `{ id }` tombe.
 *
 * ENTRÉES : `src/data/gods.json` (seule donnée lue et écrite).
 * PORTE DE FORME — lecture SEULE, avant toute écriture : `blessings` et `miracles` sont des tableaux,
 * `chaosSpells` un tableau ou absent ; chaque élément est soit la forme SOURCE (objet de clé unique
 * `id`, chaîne non vide), soit la forme CIBLE (chaîne non vide). Sinon rien n'est écrit, sortie 1,
 * porteurs nommés.
 * IDEMPOTENT : rejouée sur la forme cible, elle n'écrit rien et sort 0.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (sans saut de ligne
 * final), vérifié AVANT l'écriture — une forme non canonique fait sortir 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/gods.json');
const CHAMPS = [
  { cle: 'blessings', exige: true },
  { cle: 'miracles', exige: true },
  { cle: 'chaosSpells', exige: false },
];

const estSource = (s) => !!s && typeof s === 'object' && !Array.isArray(s)
  && Object.keys(s).length === 1 && typeof s.id === 'string' && s.id.length > 0;
const estCible = (s) => typeof s === 'string' && s.length > 0;

const brut = fs.readFileSync(CIBLE, 'utf8');
const doc = JSON.parse(brut);
const echecs = [];
if (!Array.isArray(doc)) echecs.push('gods.json : racine non-TABLEAU');
else if (brut !== JSON.stringify(doc, null, 2)) echecs.push('gods.json : forme non canonique (JSON.stringify(doc, null, 2))');
else {
  for (const g of doc) {
    for (const { cle, exige } of CHAMPS) {
      if (g?.[cle] === undefined && !exige) continue;
      if (!Array.isArray(g?.[cle])) { echecs.push(`${g?.id} : \`${cle}\` non-tableau`); continue; }
      g[cle].forEach((s, i) => {
        if (!estSource(s) && !estCible(s)) echecs.push(`${g.id} ${cle}[${i}] : ${JSON.stringify(s)} — ni \`{ id }\` ni id nu`);
      });
    }
  }
}
if (echecs.length) {
  console.error(`[${path.basename(fileURLToPath(import.meta.url))}] ARBITRAGE REQUIS, rien n'est écrit :\n  ${echecs.join('\n  ')}`);
  process.exit(1);
}

let poses = 0;
for (const g of doc) {
  for (const { cle } of CHAMPS) {
    if (g[cle] === undefined) continue;
    g[cle] = g[cle].map((s) => {
      if (estCible(s)) return s;
      poses++;
      return s.id;
    });
  }
}
if (poses === 0) {
  console.log('gods.json : no-op (0 `{ id }` de sort à dénuder)');
} else {
  fs.writeFileSync(CIBLE, JSON.stringify(doc, null, 2), 'utf8');
  console.log(`gods.json : ${poses} référence(s) de sort dénudée(s)`);
}
