/**
 * Migration #1665 (#1463) — `montures.json` devient une LISTE d'entités : ses profils de voyage
 * étaient les « rangées » d'un document `config` alors qu'aucune ne porte de borne et que le moteur
 * les lit par id et par créature (`src/engine/mountTravel.ts`).
 *
 * GESTE : le document `{ id, type, label, source, entries }` cède la place à la liste de ses
 * `entries`, chacune ouvrant sur l'enveloppe `id`, `type: 'montures'`, `label`, suivie de ses champs
 * dans leur ordre, puis de la `source` du document. L'identité du document (`montures-voyage`) meurt
 * avec lui.
 *
 * ENTRÉES : `src/data/montures.json` (la seule donnée lue et écrite).
 * IDEMPOTENT : une racine déjà LISTE n'a aucun geste à faire ; rien ne s'écrit.
 * FAIL-FAST — sortie 1 avant toute écriture : fichier hors de son formatage, racine ni liste ni
 * document à `entries`, rangée sans `id`/`label` de chaîne ou portant déjà `type`/`source`, ids en
 * double, entrée du résultat hors enveloppe. Aucun cardinal gelé : la liste est éditable (#1812).
 * FORMATAGE : `serializeDataset`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MONTURES = 'src/data/montures.json';
const TYPE = 'montures';

const fautes = [];
const cible = path.join(ROOT, MONTURES);
const avant = fs.readFileSync(cible, 'utf8');
const doc = JSON.parse(avant);
if (serializeDataset(doc) !== avant) fautes.push(`${MONTURES} : formatage non canonique`);

const sansClesDEnveloppe = (rangee) => Object.fromEntries(Object.entries(rangee).filter(([k]) => k !== 'id' && k !== 'label'));

let liste;
if (Array.isArray(doc)) liste = doc;
else if (estObjet(doc) && Array.isArray(doc.entries) && estObjet(doc.source)) {
  liste = doc.entries.map((rangee, i) => {
    if (!estObjet(rangee) || typeof rangee.id !== 'string' || typeof rangee.label !== 'string') {
      fautes.push(`${MONTURES} entries[${i}] : rangée sans \`id\`/\`label\` de chaîne`);
      return rangee;
    }
    for (const k of ['type', 'source']) if (Object.hasOwn(rangee, k)) fautes.push(`${MONTURES} ${rangee.id} : \`${k}\` déjà posé sur la rangée`);
    return { id: rangee.id, type: TYPE, label: rangee.label, ...sansClesDEnveloppe(rangee), source: doc.source };
  });
} else fautes.push(`${MONTURES} : racine ni liste ni document à \`entries\` et \`source\``);

if (liste) {
  const ids = liste.map((e) => e?.id);
  if (new Set(ids).size !== ids.length) fautes.push(`${MONTURES} : ids en double (${ids.join(', ')})`);
  for (const e of liste) {
    if (!estObjet(e) || typeof e.id !== 'string' || e.type !== TYPE || typeof e.label !== 'string' || !estObjet(e.source)) {
      fautes.push(`${MONTURES} ${e?.id} : entrée hors enveloppe (\`id\`, \`type: '${TYPE}'\`, \`label\`, \`source\`)`);
    }
  }
}

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
const apres = serializeDataset(liste);
if (apres !== avant) fs.writeFileSync(cible, apres);
console.log(`migration 1665 montures en liste : ${apres === avant ? 'aucun geste' : `${liste.length} entrée(s) posée(s)`}.`);
