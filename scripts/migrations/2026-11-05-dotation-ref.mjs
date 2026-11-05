/**
 * Migration #3012 (#1463) — la dotation de POSSESSION devient une référence typée : la graphie
 * `{ creatureId | vehicleId, count?, label? }` d'une `trappings` cède la place à `{ id, type, count?,
 * label? }`, où `type` (`creature` | `vehicle`) nomme le catalogue de l'id (`dotationDePossessionSchema`,
 * `src/data/schemas/grammaire/reference.ts`).
 *
 * GESTE : dans toute liste `trappings` (et les branches `choice` qu'elle porte), un élément qui porte
 * `creatureId` ou `vehicleId` devient `{ id, type, …ses autres clés dans leur ordre }`.
 *
 * ENTRÉES : écrites — `src/data/careerLevels.json`, `src/data/classes.json`, `src/data/creatures.json`.
 * IDEMPOTENT : rejouée sur l'état final, aucun élément ne porte plus l'ancienne clé ; rien ne s'écrit.
 * FAIL-FAST — sortie 1 avant toute écriture : un fichier hors de son formatage ; un élément qui porte
 * les deux clés, ou déjà `id`/`type` à côté de l'ancienne clé, ou un id qui n'est pas une chaîne.
 * FORMATAGE : `serializeDataset`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIERS = ['src/data/careerLevels.json', 'src/data/classes.json', 'src/data/creatures.json'];
/** L'ancienne clé de chaque type de possession. */
const ANCIENNES = { creatureId: 'creature', vehicleId: 'vehicle' };

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fautes = [];
let gestes = 0;

/** L'élément de dotation `t`, à la forme typée s'il porte une ancienne clé. */
function dotation(t, ou) {
  if (!estObjet(t)) return t;
  if (Array.isArray(t.choice)) return { ...t, choice: t.choice.map((x) => dotation(x, ou)) };
  const cles = Object.keys(ANCIENNES).filter((k) => Object.hasOwn(t, k));
  if (!cles.length) return t;
  if (cles.length > 1 || Object.hasOwn(t, 'id') || Object.hasOwn(t, 'type') || typeof t[cles[0]] !== 'string') {
    fautes.push(`${ou} : dotation ambiguë ${JSON.stringify(t)}`);
    return t;
  }
  const { [cles[0]]: id, ...reste } = t;
  gestes += 1;
  return { id, type: ANCIENNES[cles[0]], ...reste };
}

/** `noeud`, chaque liste `trappings` de toute profondeur migrée. */
function marcher(noeud, ou) {
  if (Array.isArray(noeud)) return noeud.map((v, i) => marcher(v, `${ou}[${i}]`));
  if (!estObjet(noeud)) return noeud;
  return Object.fromEntries(
    Object.entries(noeud).map(([k, v]) => [k, k === 'trappings' && Array.isArray(v) ? v.map((t, i) => dotation(t, `${ou}.${k}[${i}]`)) : marcher(v, `${ou}.${k}`)]),
  );
}

const ecritures = [];
for (const rel of FICHIERS) {
  const cible = path.join(ROOT, rel);
  const avant = fs.readFileSync(cible, 'utf8');
  const doc = JSON.parse(avant);
  if (serializeDataset(doc) !== avant) {
    fautes.push(`${rel} : formatage non canonique`);
    continue;
  }
  const apres = serializeDataset(marcher(doc, rel));
  if (apres !== avant) ecritures.push([cible, apres]);
}

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [cible, apres] of ecritures) fs.writeFileSync(cible, apres);
console.log(`migration 3012 dotation en référence typée : ${gestes ? `${gestes} dotation(s) migrée(s)` : 'aucun geste'}.`);
