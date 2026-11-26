/**
 * Migration #4930 — le Trait `immunite-attaques-ordinaires` du *Bestiaire non officiel* (BNO p.7) reçoit la forme
 * `passive` du Trait officiel `ethere` (LDB 85 l.134). laurent, 2026-11-24 : « Pas de code supplémentaire pour du
 * contenu fan sauf si ça se règle facilement avec nos ops existants ». Fiche `user-arbitrage-contenu-fan-sans-code-neuf`.
 *
 * GESTE, joué une seule fois (NO-OP dès que le Trait porte sa mécanique) : `traits.json`, `passive` posé.
 *
 * ENTRÉES : écrite — `src/data/traits.json`.
 * FORME D'AVANT SEULE (`scripts/migrations/lib/formeDAvant.mjs`) : la `passive` n'est posée que si elle est absente ;
 * un Trait absent ou révisé depuis passe sans faute.
 * FAIL-FAST — avant toute écriture, sortie 1 : document hors `serializeDataset`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/schemas/serialize.ts';

const FICHIER = path.join(fileURLToPath(new URL('../../', import.meta.url)), 'src/data/traits.json');
const ID = 'immunite-attaques-ordinaires';
const PASSIVE = [{ op: 'mitigateIncoming', mode: 'nullify', unlessKeyword: 'magic' }];

const texte = fs.readFileSync(FICHIER, 'utf8');
const traits = JSON.parse(texte);
if (serializeDataset(traits) !== texte) {
  console.error("#4930 — rien n'est écrit : traits.json hors serializeDataset");
  process.exit(1);
}
const trait = traits.find((x) => x.id === ID);
if (trait && trait.passive === undefined) trait.passive = PASSIVE;
const apres = serializeDataset(traits);
if (apres !== texte) fs.writeFileSync(FICHIER, apres);
console.log(`#4930 — ${apres !== texte ? 1 : 0} document écrit.`);
