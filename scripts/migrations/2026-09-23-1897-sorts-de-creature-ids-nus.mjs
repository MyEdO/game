/**
 * Migration #1897 — `creatures.json › [].spells` passe de `{ id }` à l'id NU.
 *
 * POURQUOI : le champ adopte `refs('spell')` (`src/data/schemas/defs/creatures.ts`), la graphie de
 * « liste de références » de la grammaire (`src/data/schemas/grammaire/ref.ts › refs`). L'id y est
 * refiné AU PARSE contre `spells.json`. Les ids eux-mêmes ne bougent pas : seule l'ENVELOPPE `{ id }`
 * tombe.
 *
 * ENTRÉES : `src/data/creatures.json` (seule donnée lue et écrite).
 * PORTE DE FORME — lecture SEULE, avant toute écriture : chaque élément de `spells` est soit la forme
 * SOURCE (objet de clé unique `id`, chaîne non vide), soit la forme CIBLE (chaîne non vide). Ni l'une
 * ni l'autre → rien n'est écrit, sortie 1, porteurs nommés.
 * IDEMPOTENT : rejouée sur la forme cible, elle n'écrit rien et sort 0.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (sans saut de ligne
 * final), vérifié AVANT l'écriture — une forme non canonique fait sortir 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/creatures.json');

const estSource = (s) => !!s && typeof s === 'object' && !Array.isArray(s)
  && Object.keys(s).length === 1 && typeof s.id === 'string' && s.id.length > 0;
const estCible = (s) => typeof s === 'string' && s.length > 0;

const brut = fs.readFileSync(CIBLE, 'utf8');
const doc = JSON.parse(brut);
const echecs = [];
if (!Array.isArray(doc)) echecs.push('creatures.json : racine non-TABLEAU');
else if (brut !== JSON.stringify(doc, null, 2)) echecs.push('creatures.json : forme non canonique (JSON.stringify(doc, null, 2))');
else {
  for (const c of doc) {
    if (!Array.isArray(c?.spells)) { echecs.push(`${c?.id} : \`spells\` non-tableau`); continue; }
    c.spells.forEach((s, i) => {
      if (!estSource(s) && !estCible(s)) echecs.push(`${c.id} spells[${i}] : ${JSON.stringify(s)} — ni \`{ id }\` ni id nu`);
    });
  }
}
if (echecs.length) {
  console.error(`[${path.basename(fileURLToPath(import.meta.url))}] ARBITRAGE REQUIS, rien n'est écrit :\n  ${echecs.join('\n  ')}`);
  process.exit(1);
}

let poses = 0;
for (const c of doc) {
  c.spells = c.spells.map((s) => {
    if (estCible(s)) return s;
    poses++;
    return s.id;
  });
}
if (poses === 0) {
  console.log('creatures.json : no-op (0 `{ id }` de sort à dénuder)');
} else {
  fs.writeFileSync(CIBLE, JSON.stringify(doc, null, 2), 'utf8');
  console.log(`creatures.json : ${poses} référence(s) de sort dénudée(s)`);
}
