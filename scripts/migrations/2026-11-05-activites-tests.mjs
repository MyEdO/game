/**
 * Migration #3012 (#1463, L4 « Test ») — le Test au choix d'une Activité devient une LISTE de Tests :
 * `tests: [test]`, où chaque Test est la forme unique du jet en donnée, `flowTestSchema`
 * (`src/data/schemas/grammaire/mecanique.ts`), sa Difficulté comprise.
 *
 * GESTE, par entrée d'Activité :
 *  - `skills` non vide : chaque Compétence devient le Test `{ skill, characteristic?, difficulty? }`,
 *    où `difficulty` est celle de la Compétence, à défaut celle de l'Activité, et `characteristic` la
 *    graphie `char` de l'Activité ; `tests` prend le rang de `skills`, et `char`/`difficulty`
 *    quittent l'Activité ;
 *  - `char` sans `skills` : le Test unique `{ characteristic, difficulty? }`, au rang de `char` ;
 *  - `skills` vide : la clé tombe (aucun Test) ;
 *  - sinon (compétence libre, résolveur qui dérive la sienne, Activité sans Test) : rien, la
 *    `difficulty` de l'Activité reste la sienne.
 * ENTRÉES : `src/data/activities.json` (la seule donnée lue et écrite).
 * IDEMPOTENT : une entrée sans `skills` ni `char` n'a aucun geste ; rejouée sur l'état final, rien ne s'écrit.
 * FAIL-FAST — sortie 1 avant toute écriture : fichier hors de son formatage, entrée à la fois `tests`
 * et `skills`/`char`, et, au RÉSULTAT, un Test qui ne nomme ni Compétence ni Caractéristique, ou une
 * Activité qui garde `tests` ET `difficulty`.
 * FORMATAGE : `serializeDataset` (`src/data/serialize.ts`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REL = 'src/data/activities.json';

/** Remplace les clés de `objet` par `entrees`, en place (l'objet garde son identité dans son parent). */
function reecrire(objet, entrees) {
  for (const k of Object.keys(objet)) delete objet[k];
  Object.assign(objet, Object.fromEntries(entrees));
}

/** Un Test, dans l'ordre de `jetSchema`. */
function unTest(skill, characteristic, difficulty) {
  return {
    ...(skill ? { skill } : {}),
    ...(characteristic ? { characteristic } : {}),
    ...(difficulty ? { difficulty } : {}),
  };
}

/** Activité à Test plat → `tests`. Rend le nombre de gestes (0 ou 1). */
function composer(a, fautes) {
  const plates = ['skills', 'char'].filter((k) => Object.hasOwn(a, k));
  if (!plates.length) return 0;
  if (Object.hasOwn(a, 'tests')) { fautes.push(`${a.id} : \`tests\` ET ${plates.join(', ')}`); return 0; }
  const skills = a.skills ?? [];
  const tests = skills.length
    ? skills.map(({ difficulty, ...skill }) => unTest(skill, a.char, difficulty ?? a.difficulty))
    : a.char ? [unTest(undefined, a.char, a.difficulty)] : [];
  const rang = Object.keys(a).find((k) => plates.includes(k));
  const quittent = new Set(tests.length ? ['skills', 'char', 'difficulty'] : ['skills']);
  const entrees = [];
  for (const [k, v] of Object.entries(a)) {
    if (k === rang && tests.length) entrees.push(['tests', tests]);
    if (!quittent.has(k)) entrees.push([k, v]);
  }
  reecrire(a, entrees);
  return 1;
}

/** L'Activité est-elle à la forme du résultat ? Rend la faute, ou `null`. */
function horsForme(a) {
  if (Object.hasOwn(a, 'skills') || Object.hasOwn(a, 'char')) return '`skills`/`char` restant';
  if (a.tests && Object.hasOwn(a, 'difficulty')) return '`tests` ET `difficulty`';
  if ((a.tests ?? []).some((t) => t.skill === undefined && t.characteristic === undefined)) return 'Test sans Compétence ni Caractéristique';
  return null;
}

const chemin = path.join(ROOT, REL);
const texte = fs.readFileSync(chemin, 'utf8');
const doc = JSON.parse(texte);
const fautes = [];
if (serializeDataset(doc) !== texte) fautes.push(`${REL} : formatage non canonique`);
let gestes = 0;
let compte = 0;
for (const a of doc) {
  gestes += composer(a, fautes);
  const faute = horsForme(a);
  if (faute) fautes.push(`${REL} › ${a.id} : au résultat, ${faute}`);
  compte += a.tests?.length ?? 0;
}
if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
const sortie = serializeDataset(doc);
if (sortie !== texte) fs.writeFileSync(chemin, sortie);
console.log(`migration 3012 Tests d'Activité : ${gestes} geste(s) sur ${doc.length} Activité(s), ${compte} Test(s) ; ${sortie !== texte ? 'réécrit' : 'inchangé'}.`);
