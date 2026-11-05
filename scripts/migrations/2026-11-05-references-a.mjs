/**
 * Migration #3012 (#1463) R2 — les objets de RÉFÉRENCE re-tapés sous une clé `<x>Id` prennent la
 * graphie de la grammaire, `ref(type, extra)` : l'identité passe sous `id`, la charge reste à côté.
 *
 * GESTE : toute liste `prosthesis` : `{ trappingId, cancels }` devient `{ id, cancels }`
 * (`protheseSchema`, `src/data/schemas/defs/traumas.ts`) — `traumas.json`, et la référence figée des
 * Critiques, qui porte la séquelle (`Trauma.prosthesis`) telle que le moteur la rend.
 * `SceneEntity.tavernGame` (`offreDeTaverneSchema`) : 0 graphie dans les scènes commitées, rien à écrire.
 *
 * ENTRÉES : écrites — `src/data/traumas.json`, `src/engine/crit-rng-invariance.fixture.json`.
 * IDEMPOTENT : rejouée sur l'état final, aucun objet ne porte plus l'ancienne clé ; rien ne s'écrit.
 * FAIL-FAST — sortie 1 avant toute écriture : un fichier hors de son formatage ; un objet qui porte
 * déjà `id` à côté de l'ancienne clé, ou un id qui n'est pas une chaîne.
 * FORMATAGE : `serializeDataset` (la fixture, suivie de sa fin de ligne).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** Chaque fichier, et la fin de ligne que son formatage ajoute à `serializeDataset`. */
const FICHIERS = [
  ['src/data/traumas.json', ''],
  ['src/engine/crit-rng-invariance.fixture.json', '\n'],
];

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fautes = [];
let gestes = 0;

/** `o`, son ancienne clé `cle` passée sous `id`, en tête et les autres clés dans leur ordre. */
function versId(o, cle, ou) {
  if (!estObjet(o) || !Object.hasOwn(o, cle)) return o;
  if (Object.hasOwn(o, 'id') || typeof o[cle] !== 'string') {
    fautes.push(`${ou} : référence ambiguë ${JSON.stringify(o)}`);
    return o;
  }
  const { [cle]: id, ...reste } = o;
  gestes += 1;
  return { id, ...reste };
}

/** `noeud`, chaque `prosthesis` de toute profondeur migrée. */
function marcher(noeud, ou) {
  if (Array.isArray(noeud)) return noeud.map((v, i) => marcher(v, `${ou}[${i}]`));
  if (!estObjet(noeud)) return noeud;
  return Object.fromEntries(Object.entries(noeud).map(([k, v]) => {
    const ici = `${ou}.${k}`;
    if (k === 'prosthesis' && Array.isArray(v)) return [k, v.map((p, i) => versId(p, 'trappingId', `${ici}[${i}]`))];
    return [k, marcher(v, ici)];
  }));
}

const ecritures = [];
for (const [rel, fin] of FICHIERS) {
  const cible = path.join(ROOT, rel);
  const avant = fs.readFileSync(cible, 'utf8');
  const doc = JSON.parse(avant);
  if (serializeDataset(doc) + fin !== avant) {
    fautes.push(`${rel} : formatage non canonique`);
    continue;
  }
  const apres = serializeDataset(marcher(doc, rel)) + fin;
  if (apres !== avant) ecritures.push([cible, apres]);
}

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [cible, apres] of ecritures) fs.writeFileSync(cible, apres);
console.log(`migration 3012 références A : ${gestes ? `${gestes} référence(s) migrée(s)` : 'aucun geste'}.`);
