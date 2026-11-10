/**
 * Migration #2968 L18 (#1463) — une action armée le DIT (`armed: true`) au lieu de recopier son mode :
 * `"armed": "<mode>"` devient `"armed": true`, la valeur que l'action pose dans `battle.action` étant son
 * `mode` (`src/data/schemas/defs/actions.ts`).
 *
 * GESTE, à la clé `armed` d'une entrée de `actions.json` : une chaîne ÉGALE au `mode` de la même entrée devient
 * `true`, à son rang. `true` ou absent n'a aucun geste.
 * ENTRÉE : écrite — `src/data/actions.json`.
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, mesurés le 2026-11-09 sur `0a5f4a1071`.
 * FAIL-FAST — sortie 1 avant toute écriture : document hors de son formatage (`serializeDataset`), `armed` ni
 * chaîne ni `true`, chaîne différente du `mode` de l'entrée, compte de gestes ≠ `CARDINAL`.
 * IDEMPOTENT : rejouée sur l'état final, rien ne s'écrit et la sortie est 0.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const FICHIER = fileURLToPath(new URL('../../src/data/actions.json', import.meta.url));
const CARDINAL = 5;

const texte = readFileSync(FICHIER, 'utf8');
const actions = JSON.parse(texte);
const fautes = [];
if (serializeDataset(actions) !== texte) fautes.push('actions.json : formatage non canonique');
let gestes = 0;
const suite = actions.map((a) => {
  if (a.armed === undefined || a.armed === true) return a;
  if (typeof a.armed !== 'string') fautes.push(`actions.json › ${a.id} › armed : ni chaîne ni \`true\` (${JSON.stringify(a.armed)})`);
  else if (a.armed !== a.mode) fautes.push(`actions.json › ${a.id} › armed : « ${a.armed} » n'est pas le mode « ${a.mode} » de l'entrée`);
  else {
    gestes += 1;
    return { ...a, armed: true };
  }
  return a;
});
if (gestes && gestes !== CARDINAL) fautes.push(`${gestes} geste(s), ${CARDINAL} attendus — périmètre déplacé`);
if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
if (gestes) writeFileSync(FICHIER, serializeDataset(suite));
console.log(gestes ? `migration 2968 L18 action armée : ${gestes} geste(s) dans actions.json.` : `RIEN À FAIRE — les ${CARDINAL} actions armées le disent déjà par \`true\`.`);
