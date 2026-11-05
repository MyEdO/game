/**
 * Migration #1666 (#1463) — les tables à PALIERS prennent la forme canonique `palierSchema`
 * (`src/data/schemas/grammaire/valeurs.ts`) : le seuil de chaque palier s'écrit `seuil`, lu par
 * `findTierEntry` (`src/engine/tables.ts`).
 *
 * GESTE : dans chaque palier de `CIBLES`, la clé d'avant devient `seuil`, à la même position, valeur
 * inchangée.
 *
 * ENTRÉES : `src/data/surincantation.json`, `src/data/calendarPhases.json`,
 * `src/scenes/diligence/diligence-projet.json` (les seules données lues et écrites).
 * IDEMPOTENT : un palier qui porte déjà `seuil` sans la clé d'avant n'a aucun geste ; rejouée sur
 * l'état final, rien ne s'écrit.
 * FAIL-FAST — sortie 1 avant toute écriture : fichier hors de son formatage, palier sans l'une ni
 * l'autre clé ou portant les deux, seuil non numérique, cardinal de paliers du RÉSULTAT différent
 * de celui qu'IMPRIME le livre (table close, référence au refus). Les phases du jour, liste éditable,
 * n'ont aucun cardinal gelé (#1812).
 * FORMATAGE : `serializeDataset` pour `src/data`, `JSON.stringify(…, null, 1)` + saut de ligne pour
 * un projet de campagne (`src/ui/editor/Editor.tsx`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const serialiserProjet = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

/** Fichier → clé d'avant, paliers du document, cardinal imprimé par le livre (table close), sérialiseur. */
const CIBLES = [
  { rel: 'src/data/surincantation.json', avant: 'dr', paliers: (d) => d.entries, cardinal: { n: 7, ref: 'VDM 02 l.209-215' }, serialiser: serializeDataset },
  { rel: 'src/data/calendarPhases.json', avant: 'start', paliers: (d) => d, serialiser: serializeDataset },
  {
    rel: 'src/scenes/diligence/diligence-projet.json',
    avant: 'drMin',
    paliers: (d) => (d.worldMap?.routes ?? []).flatMap((r) => Object.values(r.billets ?? {}).flatMap((b) => b.marchandage?.paliers ?? [])),
    cardinal: { n: 2, ref: 'EDO 01 l.142' },
    serialiser: serialiserProjet,
  },
];

const fautes = [];
const aEcrire = [];
let gestes = 0;
for (const { rel, avant, paliers, cardinal, serialiser } of CIBLES) {
  const chemin = path.join(ROOT, rel);
  const texte = fs.readFileSync(chemin, 'utf8');
  const doc = JSON.parse(texte);
  if (serialiser(doc) !== texte) { fautes.push(`${rel} : formatage non canonique`); continue; }
  const liste = paliers(doc);
  if (!Array.isArray(liste)) { fautes.push(`${rel} : paliers introuvables`); continue; }
  for (let i = 0; i < liste.length; i++) {
    const p = liste[i];
    const aAvant = Object.hasOwn(p, avant);
    const aSeuil = Object.hasOwn(p, 'seuil');
    if (aAvant === aSeuil) { fautes.push(`${rel} palier ${p.id ?? i} : ${aAvant ? `\`${avant}\` ET \`seuil\`` : `ni \`${avant}\` ni \`seuil\``}`); continue; }
    if (aSeuil) continue;
    if (typeof p[avant] !== 'number') { fautes.push(`${rel} palier ${p.id ?? i} : \`${avant}\` non numérique`); continue; }
    const renomme = Object.fromEntries(Object.entries(p).map(([k, v]) => [k === avant ? 'seuil' : k, v]));
    for (const k of Object.keys(p)) delete p[k];
    Object.assign(p, renomme);
    gestes++;
  }
  const apres = paliers(doc);
  if (cardinal && apres.length !== cardinal.n) fautes.push(`${rel} : ${apres.length} palier(s) au résultat, ${cardinal.n} attendus — table CLOSE, ${cardinal.ref}`);
  if (!apres.every((p) => typeof p.seuil === 'number' && !Object.hasOwn(p, avant))) fautes.push(`${rel} : palier hors forme au résultat`);
  const sortie = serialiser(doc);
  if (sortie !== texte) aEcrire.push([chemin, sortie]);
}

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [chemin, sortie] of aEcrire) fs.writeFileSync(chemin, sortie);
console.log(`migration 1666 paliers : ${gestes} geste(s), ${aEcrire.length} fichier(s) réécrit(s).`);
