/**
 * Migration #2972 — le gabarit d'une race (`raceAppearance.json › gabarit`) devient une RÉFÉRENCE
 * `{ id }` vers `gabarits.json` (`ref('gabarit')`, `src/data/schemas/defs/raceAppearance.ts`) : un
 * champ référence s'écrit `ref(type)`, jamais en id nu (`.claude/rules/donnees.md`).
 *
 * GESTE : toute entrée dont `gabarit` est une chaîne reçoit `gabarit: { id: <la chaîne> }`, à la même
 * place parmi ses clés.
 *
 * ENTRÉES : écrite — `src/data/raceAppearance.json` ; aucun autre fichier n'est lu.
 * FAIL-FAST — avant toute écriture, sortie 1 : un fichier hors de son formatage ; un `gabarit` ni chaîne
 * ni `{ id }` à id chaîne.
 * IDEMPOTENT : rejouée sur l'état final, aucun `gabarit` n'est une chaîne et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (sans saut de ligne
 * final), constaté avant l'écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REL = 'src/data/raceAppearance.json';

const chemin = path.join(ROOT, REL);
const avant = fs.readFileSync(chemin, 'utf8');
const doc = JSON.parse(avant);
const fautes = [];
if (serializeDataset(doc) !== avant) fautes.push(`${REL} : formatage non canonique`);

let gestes = 0;
const apres = doc.map((e) => {
  const g = e.gabarit;
  if (typeof g === 'string') {
    gestes++;
    return Object.fromEntries(Object.entries(e).map(([k, v]) => [k, k === 'gabarit' ? { id: v } : v]));
  }
  if (g !== undefined && !(g && typeof g === 'object' && typeof g.id === 'string')) fautes.push(`${REL} › ${e.id} : gabarit ni chaîne ni { id }`);
  return e;
});

if (fautes.length) {
  process.stderr.write(`${fautes.join('\n')}\n`);
  process.exit(1);
}
if (gestes) {
  fs.writeFileSync(chemin, serializeDataset(apres));
  process.stdout.write(`${REL} : ${gestes} gabarit(s) en référence { id }.\n`);
} else process.stdout.write(`${REL} : rien à faire.\n`);
