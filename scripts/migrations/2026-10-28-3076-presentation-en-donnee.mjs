/**
 * Migration #3076 (#1463) — la présentation d'équipement passe des tables de code à l'entrée de donnée.
 *
 * GESTES :
 *  1. `weaponGroups.json` : un Groupe d'armure reçoit `couche` (rang de la couche affichée) et `palierPA` (PA
 *     d'une armure de statbloc dessinée dans sa matière, `null` : aucune) ; un Groupe d'arme reçoit `forme` (racine d'apparence dessinée sans forme propre, `null` : rien
 *     en main) et `maniement` ; un Groupe d'arme ou de munition à poudre reçoit le marqueur `poudre`
 *     (LDB 62 l.99 ; LDB 62 l.129).
 *  2. `apparences.json` : une racine de forme d'arme reçoit son `maniement`.
 *  3. `qualities.json` : Raffiné et Laid reçoivent le marqueur `aspect` (LDB 60 l.24 ; LDB 60 l.52).
 *
 * ENTRÉES : écrites — `src/data/weaponGroups.json`, `src/data/apparences.json`, `src/data/qualities.json`.
 * FORME D'AVANT SEULE : une entrée reçoit ses champs quand elle n'en porte AUCUN ; une entrée qui en porte déjà
 * un (révisée après la migration), ou absente, est laissée telle quelle.
 * FAIL-FAST — avant toute écriture, sortie 1, sur une entrée à poser : un fichier hors de son formatage ; une
 * `forme` qui n'est pas une racine de `apparences.json` ; un `maniement` posé sur une variante ; une entrée
 * d'un `kind` autre que celui du geste.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ : un dataset est EXACTEMENT `JSON.stringify(doc, null, 2)` (sans saut de ligne final) ; les
 * champs posés s'insèrent avant `source`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const F = {
  groupes: 'src/data/weaponGroups.json',
  apparences: 'src/data/apparences.json',
  qualites: 'src/data/qualities.json',
};

const ARMURES = {
  'cuir-souple': { couche: 0 },
  'cuir-bouilli': { couche: 1 },
  mailles: { couche: 2 },
  plate: { couche: 3 },
  'armure-du-chaos': { couche: 4 },
};
const PALIERS_PA = { 'cuir-souple': 0, 'cuir-bouilli': null, mailles: 2, plate: 4, 'armure-du-chaos': null };
const GROUPES_A_POUDRE = { 'poudre-noire': 'weapon', ingenierie: 'weapon', 'poudre-noire-et-ingenierie': 'ammo' };
const forme = (id) => ({ id });
const ARMES = {
  base: { forme: forme('epee'), maniement: 'lame1m' },
  escrime: { forme: forme('rapiere'), maniement: 'escrime' },
  cavalerie: { forme: forme('lance_cavalerie'), maniement: 'lance_cav' },
  'deux-mains': { forme: forme('epee_batarde'), maniement: 'lourde2m' },
  'armes-d-hast': { forme: forme('lance'), maniement: 'hampe' },
  fleau: { forme: forme('fleau'), maniement: 'fleau' },
  parade: { forme: forme('main_gauche'), maniement: 'parade' },
  bagarre: { forme: null, maniement: 'poings' },
  arc: { forme: forme('arc'), maniement: 'arc' },
  arbalete: { forme: forme('arbalete'), maniement: 'arbalete' },
  'poudre-noire': { forme: forme('pistolet'), maniement: 'arme_feu' },
  fronde: { forme: forme('fronde'), maniement: 'fronde' },
  lancer: { forme: forme('javelot'), maniement: 'jet' },
  entraves: { forme: forme('fouet'), maniement: 'entraves' },
  explosifs: { forme: forme('bombe'), maniement: 'explosif' },
  ingenierie: { forme: forme('pistolet_rep'), maniement: 'arme_feu' },
  catapulte: { forme: null, maniement: 'poings' }, // MDG 12 l.373-375
  'armes-de-siege': { forme: null, maniement: 'poings' }, // MDG 12 l.373-375
  'machine-de-guerre': { forme: null, maniement: 'poings' }, // MDG 12 l.373-375
  munitions: { forme: null, maniement: 'poings' },
  'munition-de-siege': { forme: null, maniement: 'poings' },
};
const MANIEMENT_DES_RACINES = {
  couteau: 'lame1m', dague: 'lame1m', improvisee: 'lame1m', bec_de_corbin: 'lame1m', fleuret: 'escrime',
  rapiere: 'escrime', epee_batarde: 'lourde2m', grande_hache: 'lourde2m', marteau_guerre: 'lourde2m',
  pioche_2m: 'lourde2m', zweihander: 'lourde2m', baton: 'hampe', hallebarde: 'hampe', lance: 'hampe',
  pique: 'hampe', lance_cavalerie: 'lance_cav', fleau: 'fleau', fleau_grain: 'fleau', fleau_armes: 'fleau',
  brise_epee: 'parade', main_gauche: 'parade', poing: 'poings', arc: 'arc', arc_court: 'arc',
  arc_elfique: 'arc', arc_long: 'arc', arbalete: 'arbalete', arbalete_poing: 'arbalete',
  arbalete_lourde: 'arbalete', arquebuse: 'arme_feu', hochland: 'arme_feu', pistolet: 'arme_feu',
  tromblon: 'arme_feu', arquebus_rep: 'arme_feu', pistolet_rep: 'arme_feu', fronde: 'fronde',
  fustibale: 'fronde', bolas: 'jet', couteau_lancer: 'jet', flechette: 'jet', hache_lancer: 'jet',
  javelot: 'jet', rocher: 'jet', fouet: 'entraves', lasso: 'entraves', bombe: 'explosif',
  bombe_incendiaire: 'explosif',
};
const QUALITES_D_ASPECT = ['raffine', 'laid'];

const fautes = [];
const docs = new Map();
for (const rel of Object.values(F)) {
  const texte = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const doc = JSON.parse(texte);
  if (serializeDataset(doc) !== texte) fautes.push(`${rel} : formatage non canonique`);
  docs.set(rel, { doc, avant: texte });
}
const doc = (rel) => docs.get(rel).doc;
const racines = new Set(doc(F.apparences).filter((a) => a.forme === undefined).map((a) => a.id));

/** L'entrée `e` augmentée des `champs`, insérés avant `source` (ou en fin d'entrée). */
function avecChamps(e, champs) {
  const out = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === 'source') Object.assign(out, champs);
    out[k] = v;
  }
  return 'source' in e ? out : { ...out, ...champs };
}

let gestes = 0;
/** Pose `champs` sur l'entrée `id` de `rel` qui n'en porte aucun ; `kind` attendu s'il est donné, `faute` jugée
 *  sur l'entrée posée seule. */
function poser(rel, id, champs, kind, faute = () => undefined) {
  const liste = doc(rel);
  const i = liste.findIndex((e) => e.id === id);
  if (i < 0 || Object.keys(champs).some((k) => k in liste[i])) return;
  if (kind !== undefined && liste[i].kind !== kind) fautes.push(`${rel} : « ${id} » est « ${liste[i].kind} », pas « ${kind} »`);
  const f = faute(liste[i]);
  if (f) fautes.push(f);
  liste[i] = avecChamps(liste[i], champs);
  gestes++;
}

// 1. weaponGroups.json
for (const [id, champs] of Object.entries(ARMURES)) poser(F.groupes, id, champs, 'armour');
for (const [id, champs] of Object.entries(ARMES)) {
  poser(F.groupes, id, champs, 'weapon', () =>
    champs.forme && !racines.has(champs.forme.id) ? `${F.apparences} : « ${champs.forme.id} » n'est pas une racine` : undefined);
}
for (const [id, palierPA] of Object.entries(PALIERS_PA)) poser(F.groupes, id, { palierPA }, 'armour');
for (const [id, kind] of Object.entries(GROUPES_A_POUDRE)) poser(F.groupes, id, { poudre: true }, kind);
// 2. apparences.json
for (const [id, maniement] of Object.entries(MANIEMENT_DES_RACINES)) {
  poser(F.apparences, id, { maniement }, undefined, () => (racines.has(id) ? undefined : `${F.apparences} : « ${id} » n'est pas une racine`));
}
// 3. qualities.json
for (const id of QUALITES_D_ASPECT) poser(F.qualites, id, { aspect: true });

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [rel, { doc: d, avant }] of docs) {
  const apres = serializeDataset(d);
  if (apres !== avant) fs.writeFileSync(path.join(ROOT, rel), apres);
}
console.log(`migration 3076 présentation en donnée : ${gestes} geste(s).`);
