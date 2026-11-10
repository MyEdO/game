/**
 * Migration #2968 L19 (#1463) — l'enjeu d'un jet n'a qu'une identité, son `id` : la clé de consommation
 * `cle` de `stakes.json` disparaît, et chaque clé d'enjeu écrite en donnée (`{ key: { dataset, kind } }`
 * d'une cascade) nomme l'id de l'enjeu (`src/data/schemas/defs/stakes.ts`).
 *
 * GESTES :
 *  1. `stakes.json` : la clé `cle` de chaque entrée est retirée, les autres clés gardent leur rang ;
 *  2. `sea-events.json` : `key.kind` d'une clé d'enjeu dont `key.dataset` est une cascade (`night`,
 *     `voyage`, `flow`, `combat`) passe de la `cle` à l'id de l'entrée de MÊME cascade qui la portait ;
 *     une clé qu'aucune `cle` lue ne nomme n'est pas la forme d'avant et passe (#3080).
 * ENTRÉES : écrites — `src/data/stakes.json`, `src/data/sea-events.json`.
 * CARDINAL ASSERTÉ : `CARDINAL_CLES` entrées portent une `cle` au premier passage, dont `CARDINAL_HOMONYMES`
 * ni égale à l'id ni à son camelCase, chacune NOMMÉE (`HOMONYMES`) ; `CARDINAL_CLES_EN_DONNEE` clés d'enjeu
 * de `sea-events.json` changent. Mesuré le 2026-11-09 sur `4c5d9f1b0b`.
 * FAIL-FAST — sortie 1 avant toute écriture : document hors de son formatage (`serializeDataset`), `cle` ni
 * chaîne, `cle` qui n'est ni l'id, ni son camelCase, ni l'homonyme nommé de son entrée, deux entrées d'une
 * cascade qui servent la même `cle`, compte de gestes ≠ cardinal.
 * IDEMPOTENT : rejouée sur l'état final (aucune `cle`, chaque clé en donnée un id de sa cascade), rien ne
 * s'écrit et la sortie est 0.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const STAKES = fileURLToPath(new URL('../../src/data/stakes.json', import.meta.url));
const SEA = fileURLToPath(new URL('../../src/data/sea-events.json', import.meta.url));
const CARDINAL_CLES = 141;
const CARDINAL_CLES_EN_DONNEE = 3;
/** Les `cle` mesurées qui ne dérivent pas de l'id de leur entrée, par id. */
const HOMONYMES = {
  'voyage-exposure': 'exposure',
  'crew-progression': 'progression',
  'crew-orientation': 'orientation',
  'crew-phare': 'phare',
  'crew-embuscade': 'embuscade',
  'crew-extermination': 'extermination',
  'crew-entretien': 'entretien',
  'crew-affaler': 'affaler',
  'crew-affaler-ouragan': 'sea-ouragan-affaler',
  'crew-voyage-rapide': 'voyage-rapide',
  'crew-poursuite': 'poursuite',
  'crew-tourbillon': 'tourbillon',
  'nav-progression': 'sea-progression-nav',
  'sea-shipwreck-swim': 'shipwreckSwim',
  'sea-priere-manann': 'sea-priere',
  'combat-fatigue': 'fatigue',
  'combat-aa-bleed': 'aaBleedUnconscious',
  'combat-spell-plus': 'spellPlusTest',
  'combat-maneuver-defense': 'maneuverDefense',
};
const CARDINAL_HOMONYMES = 19;

const camel = (id) => id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const fautes = [];
const lire = (fichier, nom) => {
  const texte = readFileSync(fichier, 'utf8');
  const doc = JSON.parse(texte);
  if (serializeDataset(doc) !== texte) fautes.push(`${nom} : formatage non canonique`);
  return { texte, doc };
};

const stakes = lire(STAKES, 'stakes.json');
const sea = lire(SEA, 'sea-events.json');

// 1. La `cle` de chaque entrée : son id, son camelCase, ou l'homonyme nommé — jamais une autre identité.
const idParCle = new Map();
let cles = 0;
let homonymes = 0;
const enjeux = stakes.doc.map((e) => {
  if (!('cle' in e)) return e;
  const ou = `stakes.json › ${e.id}`;
  if (typeof e.cle !== 'string') fautes.push(`${ou} › cle : pas une chaîne (${JSON.stringify(e.cle)})`);
  else if (e.cle !== e.id && e.cle !== camel(e.id) && HOMONYMES[e.id] !== e.cle) fautes.push(`${ou} › cle : « ${e.cle} » n'est ni l'id, ni son camelCase, ni l'homonyme nommé`);
  else {
    if (e.cle !== e.id && e.cle !== camel(e.id)) homonymes += 1;
    const cle = `${e.cascade}/${e.cle}`;
    if (idParCle.has(cle)) fautes.push(`${ou} › cle : « ${cle} » déjà servie par ${idParCle.get(cle)}`);
    idParCle.set(cle, e.id);
  }
  cles += 1;
  const { cle: _cle, ...reste } = e;
  return reste;
});
if (cles && cles !== CARDINAL_CLES) fautes.push(`${cles} entrée(s) à \`cle\`, ${CARDINAL_CLES} attendues — périmètre déplacé`);
if (cles && homonymes !== CARDINAL_HOMONYMES) fautes.push(`${homonymes} homonyme(s), ${CARDINAL_HOMONYMES} attendus`);

// 2. Les clés d'enjeu écrites en donnée nomment l'id de leur entrée.
let clesEnDonnee = 0;
const visiter = (v) => {
  if (v === null || typeof v !== 'object') return;
  const k = v.key;
  const id = k && typeof k === 'object' ? idParCle.get(`${k.dataset}/${k.kind}`) : undefined;
  if (id !== undefined && id !== k.kind) { k.kind = id; clesEnDonnee += 1; }
  Object.values(v).forEach(visiter);
};
visiter(sea.doc);
if (clesEnDonnee && clesEnDonnee !== CARDINAL_CLES_EN_DONNEE) fautes.push(`${clesEnDonnee} clé(s) d'enjeu en donnée, ${CARDINAL_CLES_EN_DONNEE} attendues — périmètre déplacé`);

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
if (cles) writeFileSync(STAKES, serializeDataset(enjeux));
if (clesEnDonnee) writeFileSync(SEA, serializeDataset(sea.doc));
console.log(cles || clesEnDonnee
  ? `migration 2968 L19 clé d'enjeu : ${cles} \`cle\` retirée(s) de stakes.json, ${clesEnDonnee} clé(s) d'enjeu nommée(s) par leur id dans sea-events.json.`
  : `RIEN À FAIRE — aucun enjeu ne porte de \`cle\`, chaque clé d'enjeu en donnée nomme son id.`);
