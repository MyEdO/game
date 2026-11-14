/**
 * Migration #3606 M1f — le coffre d'un poste d'artillerie désigne le catalogue au lieu de le recopier.
 *
 *   forme d'avant                                      forme d'après
 *   `ammo` : des `ItemInstance` (libellé, qualités,    `ammo: { <id>: <qty> }`, chaque munition par son id
 *   Dégâts, Enc… du trapping, un `uid`, une `qty`)
 *   `ammoUid` : l'uid de la munition choisie            `selectedAmmo: { id }`
 *
 * `hydratePoste` (`src/engine/items.ts`) matérialise au spawn. MDG 12 l.410-424
 *
 * Entrées : chaque `src/scenes/<c>/<c>-projet.json`, et `src/data/trappings.json`.
 *
 * Une munition hors du catalogue des munitions (`categorie` `ammunition`), d'un libellé autre que le sien, deux
 * munitions d'un même id, une `qty` non entière positive, un `ammoUid` hors du coffre, un poste qui porte
 * `loadedAmmoUid` ou `enchants` (que la forme d'après ne porte plus) sont un ARRÊT nominatif (exit 1), AUCUNE
 * écriture. Un coffre déjà en record passe. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCENES = join(ROOT, 'src/scenes');
const MUNITIONS = new Map(JSON.parse(readFileSync(join(ROOT, 'src/data/trappings.json'), 'utf8')).filter((t) => t.categorie === 'ammunition').map((t) => [t.id, t]));

const arrets = [];
let gestes = 0;

/** Le document sérialisé dans la forme de son texte d'origine : indentation de sa 2e ligne, saut final. */
function reserialise(doc, texte) {
  const indent = /^\n?[[{]\r?\n( +)/.exec(texte)?.[1].length ?? 2;
  return `${JSON.stringify(doc, null, indent)}${texte.endsWith('\n') ? '\n' : ''}`;
}

/** Le poste `p` à la forme d'après, ses clés à leur rang : `ammo` en record, `ammoUid` en `selectedAmmo`. */
function migrerLePoste(p, ou) {
  if (!Array.isArray(p.ammo)) return;
  for (const cle of ['loadedAmmoUid', 'enchants']) if (cle in p) arrets.push(`${ou} : \`${cle}\` que la forme d'après ne porte plus`);
  const coffre = {};
  for (const a of p.ammo) {
    const munition = MUNITIONS.get(a?.trappingId);
    if (!munition) { arrets.push(`${ou} : munition « ${a?.uid} » hors du catalogue des munitions`); continue; }
    if (a.label !== munition.label) arrets.push(`${ou} : munition « ${a.uid} » libellée « ${a.label} » au lieu de « ${munition.label} »`);
    if (!Number.isInteger(a.qty) || a.qty <= 0) arrets.push(`${ou} : munition « ${a.uid} » en quantité ${a.qty}`);
    if (a.trappingId in coffre) arrets.push(`${ou} : munition « ${a.trappingId} » deux fois au coffre`);
    coffre[a.trappingId] = a.qty;
  }
  const choisie = p.ammoUid === undefined ? undefined : p.ammo.find((a) => a.uid === p.ammoUid);
  if (p.ammoUid !== undefined && !choisie) arrets.push(`${ou} : ammoUid « ${p.ammoUid} » hors du coffre`);
  const copie = Object.entries(p);
  for (const k of Object.keys(p)) delete p[k];
  for (const [k, v] of copie) {
    if (k === 'ammo') p.ammo = coffre;
    else if (k === 'ammoUid') { if (choisie) p.selectedAmmo = { id: choisie.trappingId }; }
    else p[k] = v;
  }
  gestes++;
}

const projets = readdirSync(SCENES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(SCENES, d.name, `${d.name}-projet.json`))
  .filter((f) => existsSync(f));
const ecritures = [];
for (const fichier of projets) {
  const brut = readFileSync(fichier, 'utf8');
  if (!brut.includes('"postes"')) continue;
  const doc = JSON.parse(brut);
  const nom = fichier.slice(SCENES.length + 1);
  if (brut !== reserialise(doc, brut)) { arrets.push(`${nom} : forme non canonique`); continue; }
  const parcourir = (noeud, chemin) => {
    if (Array.isArray(noeud)) { noeud.forEach((v, i) => parcourir(v, `${chemin}[${i}]`)); return; }
    if (!noeud || typeof noeud !== 'object') return;
    if (Array.isArray(noeud.postes)) noeud.postes.forEach((p, i) => migrerLePoste(p, `${nom} ${chemin}.postes[${i}]`));
    for (const [k, v] of Object.entries(noeud)) parcourir(v, `${chemin}.${k}`);
  };
  parcourir(doc, '');
  const out = reserialise(doc, brut);
  if (out !== brut) ecritures.push([fichier, out, nom]);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [fichier, out] of ecritures) writeFileSync(fichier, out, 'utf8');
console.log(`migration 3606 (coffre du poste en référence) : ${gestes} poste(s)${ecritures.length ? `, réécrit(s) : ${ecritures.map(([, , nom]) => nom).join(', ')}` : ''}.`);
