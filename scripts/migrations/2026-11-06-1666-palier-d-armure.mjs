/**
 * Migration #1666 (#1463) — le palier de PA d'un Groupe d'armure prend la forme canonique `palierSchema`
 * (`src/data/schemas/grammaire/valeurs.ts`) : son seuil s'écrit `seuil`, lu par `findTierEntry`
 * (`src/engine/tables.ts`), et un Groupe sans palier n'écrit pas la clé.
 *
 * GESTE : sur chaque Groupe d'armure de `weaponGroups.json`, `palierPA` numérique devient `seuil`, à la même
 * position, valeur inchangée ; `palierPA: null` est retiré.
 *
 * ENTRÉES : `src/data/weaponGroups.json` (la seule donnée lue et écrite).
 * IDEMPOTENT : un Groupe sans `palierPA` n'a aucun geste ; rejouée sur l'état final, rien ne s'écrit.
 * FAIL-FAST — sortie 1 avant toute écriture : fichier hors de son formatage, `palierPA` hors d'un Groupe
 * d'armure, ni nombre ni `null`, ou porté avec `seuil` ; au résultat, aucun Groupe d'armure au seuil 0.
 * FORMATAGE : `serializeDataset`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const REL = 'src/data/weaponGroups.json';
const chemin = path.join(fileURLToPath(new URL('../../', import.meta.url)), REL);
const texte = fs.readFileSync(chemin, 'utf8');
const doc = JSON.parse(texte);

const fautes = [];
if (serializeDataset(doc) !== texte) fautes.push(`${REL} : formatage non canonique`);
let gestes = 0;
const migre = doc.map((g) => {
  if (!Object.hasOwn(g, 'palierPA')) return g;
  const v = g.palierPA;
  if (g.kind !== 'armour') fautes.push(`${REL} « ${g.id} » : \`palierPA\` hors d'un Groupe d'armure (« ${g.kind} »)`);
  else if (Object.hasOwn(g, 'seuil')) fautes.push(`${REL} « ${g.id} » : \`palierPA\` ET \`seuil\``);
  else if (v !== null && !Number.isInteger(v)) fautes.push(`${REL} « ${g.id} » : \`palierPA\` ni entier ni \`null\``);
  gestes++;
  return Object.fromEntries(Object.entries(g).flatMap(([k, x]) => (k !== 'palierPA' ? [[k, x]] : v === null ? [] : [['seuil', x]])));
});
if (!migre.some((g) => g.kind === 'armour' && g.seuil === 0)) fautes.push(`${REL} : aucun Groupe d'armure au seuil 0 au résultat`);

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
const sortie = serializeDataset(migre);
if (sortie !== texte) fs.writeFileSync(chemin, sortie);
console.log(`migration 1666 palier d'armure : ${gestes} geste(s).`);
