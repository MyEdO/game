/**
 * Migration #4930 — les règles propres du *Bestiaire non officiel* que la donnée seule exprime reçoivent leur
 * mécanique, par des formes déjà portées par des Traits officiels. laurent, 2026-11-24 : « Pas de code supplémentaire
 * pour du contenu fan sauf si ça se règle facilement avec nos ops existants ». Fiche
 * `user-arbitrage-contenu-fan-sans-code-neuf`.
 *
 * GESTES, joués une seule fois (NO-OP dès que chaque cible porte sa mécanique) :
 *  1. `traits.json` : `studieux-bno` (BNO p.8) reçoit la forme `passive` d'`intelligent` ; `enflammee` (BNO p.5) la
 *     forme `effects` de `toile`, l'État `en-flammes` à la place d'`empetre` ;
 *  2. `breath-types.json` : les Souffles `vapeur` et `pestilence` (BNO p.6 ; Unofficial Bestiary 2.0 l.336-337), par
 *     les champs de leurs voisins officiels (`feu`, `bave-gluante`) ;
 *  3. `creatures.json` :
 *     - l'arme « Dents à mâcher » du `charogneur` (BNO p.38, VO « Bonechewing Teeth have the Hack Quality ») reçoit
 *       l'Atout `taille` par `profilDArme`, forme de `chevalier-mort-vivant-revenant` ;
 *     - les Souffles imprimés « Vapeur » et « Pestilence », que la migration #4916 a posés sans `arg`, reçoivent leur
 *       type ;
 *     - la Maladie « Pourriture du sang » des chauves-souris (VO « Blood Rot », l.903, l.932) est l'`infection-du-sang`
 *       (CRB 039 l.37-39 ; LDB 20 l.74-76).
 *
 * ENTRÉES : écrites — `src/data/traits.json`, `src/data/breath-types.json`, `src/data/creatures.json`.
 * FAIL-FAST — avant toute écriture, sortie 1 : document hors `serializeDataset`, cible absente, cible qui porte déjà
 * une autre mécanique.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = (rel) => path.join(ROOT, 'src/data', rel);

const MECANIQUE_DES_TRAITS = {
  'studieux-bno': {
    passive: [
      { op: 'charMod', characteristic: 'force-mentale', mod: 20 },
      { op: 'charMod', characteristic: 'intelligence', mod: 20 },
    ],
  },
  enflammee: {
    effects: [{
      trigger: 'onHit', on: 'victime',
      flow: { kind: 'effet', effet: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: { id: 'en-flammes' }, value: 1 }] } },
    }],
  },
};
const SOURCE_DES_SOUFFLES = { book: 'bestiaire-non-officiel', page: 6 };
const SOUFFLES = [
  { id: 'vapeur', type: 'breath-types', label: 'Vapeur', source: SOURCE_DES_SOUFFLES, ignoreAP: true, etat: 'aveugle', rendu: { id: 'souffle-de-fumee' } },
  { id: 'pestilence', type: 'breath-types', label: 'Pestilence', source: SOURCE_DES_SOUFFLES, ignoreAP: true, rendu: { id: 'souffle-empoisonne' } },
];
const DENTS = { creature: 'charogneur', arg: 'Dents à mâcher', profilDArme: { qualites: [{ id: 'taille' }] } };
/** Instances posées sans `arg` qui reçoivent le leur : `statbloc:Trait` → `arg`. */
const ARGS = {
  'tortues-dragon:souffle': 'vapeur', 'geckomandre:souffle': 'vapeur',
  'mabrothrax:souffle': 'pestilence', 'dragons-zombies:souffle': 'pestilence',
  'chauves-souris-ordinaire:maladie': 'infection-du-sang', 'chauve-souris-geantes:maladie': 'infection-du-sang',
};

const fautes = [];
const docs = new Map();
function charger(rel) {
  const texte = fs.readFileSync(DATA(rel), 'utf8');
  const doc = JSON.parse(texte);
  if (serializeDataset(doc) !== texte) fautes.push(`${rel} : formatage hors serializeDataset`);
  docs.set(rel, { doc, avant: texte });
  return doc;
}
const memeForme = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const traits = charger('traits.json');
for (const [id, mecanique] of Object.entries(MECANIQUE_DES_TRAITS)) {
  const t = traits.find((x) => x.id === id);
  if (!t) { fautes.push(`traits.json : ${id} absent`); continue; }
  for (const [champ, valeur] of Object.entries(mecanique)) {
    if (t[champ] === undefined) t[champ] = valeur;
    else if (!memeForme(t[champ], valeur)) fautes.push(`traits.json : ${id}.${champ} porte déjà une autre mécanique`);
  }
}

const souffles = charger('breath-types.json');
for (const s of SOUFFLES) {
  const deja = souffles.find((x) => x.id === s.id);
  if (!deja) souffles.push(s);
  else if (!memeForme(deja, s)) fautes.push(`breath-types.json : ${s.id} existe sous une autre forme`);
}

const creatures = charger('creatures.json');
for (const [cle, arg] of Object.entries(ARGS)) {
  const [creature, trait] = cle.split(':');
  const poses = (c) => [...(c?.traits ?? []), ...(c?.optionals ?? [])].filter((x) => x.id === trait);
  const instances = poses(creatures.find((c) => c.id === creature));
  if (instances.length !== 1) { fautes.push(`creatures.json : ${cle}, ${instances.length} instance(s) au lieu d'une`); continue; }
  const [x] = instances;
  if (x.arg === undefined) x.arg = arg;
  else if (x.arg !== arg) fautes.push(`creatures.json : ${cle} porte déjà l'arg « ${x.arg} »`);
}
const arme = creatures.find((c) => c.id === DENTS.creature)?.traits?.find((x) => x.id === 'arme' && x.arg === DENTS.arg);
if (!arme) fautes.push(`creatures.json : ${DENTS.creature}, arme « ${DENTS.arg} » absente`);
else if (arme.profilDArme === undefined) arme.profilDArme = DENTS.profilDArme;
else if (!memeForme(arme.profilDArme, DENTS.profilDArme)) fautes.push(`creatures.json : ${DENTS.creature}, « ${DENTS.arg} » porte déjà un autre profil`);

if (fautes.length) {
  console.error(`#4930 — rien n'est écrit :\n  ${fautes.join('\n  ')}`);
  process.exit(1);
}
let ecrits = 0;
for (const [rel, { doc, avant }] of docs) {
  const apres = serializeDataset(doc);
  if (apres !== avant) { fs.writeFileSync(DATA(rel), apres); ecrits++; }
}
console.log(`#4930 — ${ecrits} document(s) écrit(s).`);
