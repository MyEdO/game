/**
 * Migration #4930 — le Trait `immunite-attaques-ordinaires` du *Bestiaire non officiel* (BNO p.7) reçoit la forme
 * `passive` du Trait officiel `ethere` (LDB 85 l.134). laurent, 2026-11-24 : « Pas de code supplémentaire pour du
 * contenu fan sauf si ça se règle facilement avec nos ops existants ». Fiche `user-arbitrage-contenu-fan-sans-code-neuf`.
 *
 * GESTE, joué une seule fois (NO-OP dès que le Trait porte sa mécanique) : `traits.json`, `passive` posé.
 *
 * ENTRÉES : écrite — `src/data/traits.json`.
 * FAIL-FAST — avant toute écriture, sortie 1 : document hors `serializeDataset`, Trait absent, Trait qui porte déjà
 * une autre `passive`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const FICHIER = path.join(fileURLToPath(new URL('../../', import.meta.url)), 'src/data/traits.json');
const ID = 'immunite-attaques-ordinaires';
const PASSIVE = [{ op: 'mitigateIncoming', mode: 'nullify', unlessKeyword: 'magic' }];

const echec = (faute) => { console.error(`#4930 — rien n'est écrit : ${faute}`); process.exit(1); };
const texte = fs.readFileSync(FICHIER, 'utf8');
const traits = JSON.parse(texte);
if (serializeDataset(traits) !== texte) echec('traits.json hors serializeDataset');
const trait = traits.find((x) => x.id === ID);
if (!trait) echec(`${ID} absent`);
if (trait.passive === undefined) trait.passive = PASSIVE;
else if (JSON.stringify(trait.passive) !== JSON.stringify(PASSIVE)) echec(`${ID} porte déjà une autre passive`);
const apres = serializeDataset(traits);
if (apres !== texte) fs.writeFileSync(FICHIER, apres);
console.log(`#4930 — ${apres !== texte ? 1 : 0} document écrit.`);
