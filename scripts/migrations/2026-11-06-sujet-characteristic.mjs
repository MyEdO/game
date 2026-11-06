/**
 * Migration #3012 (#1463, L4 « Test ») — le SUJET d'un Test se nomme `characteristic`, la graphie de
 * `sujetDuJetSchema` (`src/data/schemas/grammaire/mecanique.ts`), jamais `char`.
 *
 * GESTE, par porteur de `CIBLES` : la clé `char` devient `characteristic`, à son rang (les autres clés
 * gardent le leur). Porteurs : `talents.json › [].test.matches[]`, `spells.json › [].opposed`,
 * `tavernGames.json › [].combined.second` et `[].fastSkill`, et toute op `grantReverseToken` de
 * `src/data/*.json` et des projets de `src/scenes/`, à toute profondeur.
 *
 * ENTRÉES : `src/data/*.json`, `src/scenes/<projet>/*.json` (les seules données lues et écrites).
 * IDEMPOTENT : un porteur sans `char` n'a aucun geste ; rejouée sur l'état final, rien ne s'écrit.
 * FAIL-FAST — sortie 1 avant toute écriture : fichier à réécrire hors de son formatage, ou porteur qui
 * porte à la fois `char` et `characteristic`.
 * FORMATAGE : `serializeDataset` (`src/data/serialize.ts`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Porteur `char` → `characteristic`, à son rang. Rend le nombre de gestes (0 ou 1). */
function renommer(porteur, ou, fautes) {
  if (!estObjet(porteur) || !Object.hasOwn(porteur, 'char')) return 0;
  if (Object.hasOwn(porteur, 'characteristic')) { fautes.push(`${ou} : \`char\` ET \`characteristic\``); return 0; }
  const entrees = Object.entries(porteur).map(([k, v]) => [k === 'char' ? 'characteristic' : k, v]);
  for (const k of Object.keys(porteur)) delete porteur[k];
  Object.assign(porteur, Object.fromEntries(entrees));
  return 1;
}

/** Les ops `grantReverseToken` de `valeur`, à toute profondeur, avec leur adresse. */
function jetonsDInversion(valeur, ou, acc = []) {
  if (Array.isArray(valeur)) valeur.forEach((v, i) => jetonsDInversion(v, `${ou}[${i}]`, acc));
  else if (estObjet(valeur)) {
    if (valeur.op === 'grantReverseToken') acc.push([valeur, ou]);
    for (const [k, v] of Object.entries(valeur)) jetonsDInversion(v, `${ou}.${k}`, acc);
  }
  return acc;
}

const SITES_NOMMES = {
  'src/data/talents.json': (d) => d.flatMap((t) => (t.test?.matches ?? []).map((m, i) => [m, `${t.id} › test.matches[${i}]`])),
  'src/data/spells.json': (d) => d.flatMap((s) => (s.opposed ? [[s.opposed, `${s.id} › opposed`]] : [])),
  'src/data/tavernGames.json': (d) => d.flatMap((g) => [
    ...(g.combined?.second ? [[g.combined.second, `${g.id} › combined.second`]] : []),
    ...(g.fastSkill ? [[g.fastSkill, `${g.id} › fastSkill`]] : []),
  ]),
};

const jsonDe = (dossier) => fs.readdirSync(path.join(ROOT, dossier), { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => `${dossier}/${e.name}`);
const projets = fs.readdirSync(path.join(ROOT, 'src/scenes'), { withFileTypes: true })
  .filter((e) => e.isDirectory()).flatMap((e) => jsonDe(`src/scenes/${e.name}`));
const CIBLES = [...jsonDe('src/data'), ...projets].sort();

const fautes = [];
const aEcrire = [];
const bilan = [];
for (const rel of CIBLES) {
  const chemin = path.join(ROOT, rel);
  const texte = fs.readFileSync(chemin, 'utf8');
  if (!texte.includes('"char"')) continue;
  const doc = JSON.parse(texte);
  const porteurs = [...(SITES_NOMMES[rel]?.(doc) ?? []), ...jetonsDInversion(doc, '')];
  if (!porteurs.length) continue;
  const canonique = serializeDataset(doc) === texte;
  let gestes = 0;
  for (const [porteur, ou] of porteurs) gestes += renommer(porteur, `${rel} › ${ou}`, fautes);
  if (!gestes) continue;
  if (!canonique) { fautes.push(`${rel} : formatage non canonique`); continue; }
  bilan.push(`${rel} : ${gestes} geste(s) sur ${porteurs.length} porteur(s)`);
  aEcrire.push([chemin, serializeDataset(doc)]);
}

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [chemin, sortie] of aEcrire) fs.writeFileSync(chemin, sortie);
console.log(`migration 3012 sujet characteristic : ${aEcrire.length} fichier(s) réécrit(s).\n${bilan.join('\n')}`);
