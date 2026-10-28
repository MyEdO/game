/**
 * Migration #1467 L1b V-FLIP-RECORD — `names.json` passe du RECORD `RaceKey → NamePool` à une LISTE
 * de 7 DOCUMENTS `{id, type, label, …banques}`.
 *
 * MOTIF : la famille `record` sert les cartes clé → VALEUR SCALAIRE ; ici chaque valeur porte une
 * charge utile structurée (4 champs de banques), browsée et éditée entrée par entrée au Codex — un
 * dataset de 7 documents, pas une carte. L'`id` de chaque document est la clé actuelle (`RaceKey`,
 * inchangée) ; le `label` est AUTHORÉ, égal au libellé de la race de rig correspondante — l'affichage
 * du Codex ne change donc pas d'un octet, et il se lit sur le document lui-même.
 *
 * CHARGE À PLAT : les 4 banques restent des champs de PREMIER NIVEAU du document (la fabrique
 * `document()` exige une méta d'édition par champ de premier niveau : les nicher sous un `banques`
 * rendrait 4 sous-champs invisibles de l'atelier).
 *
 * PAS DE PROVENANCE : `names` est inscrit à `SANS_LIVRE` (banques de noms reprises du projet
 * WarhammerV2 de l'utilisateur, aucun folio) — aucun `source` ni `maison` n'est ajouté.
 *
 * ENTRÉES : `src/data/names.json` (seule donnée lue et écrite).
 *
 * FORME D'AVANT SEULE : seule une racine RECORD est migrée ; une racine déjà TABLEAU (la forme d'après,
 * révisée ou non depuis) est laissée telle quelle ; rejouée sur l'état final, la migration n'écrit rien et
 * sort 0.
 * FAIL-FAST : clé de la racine RECORD inconnue de la table des labels, banque de forme inattendue
 * → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/names.json');

/** `RaceKey` → libellé AUTHORÉ du document (mesuré sur `raceAppearance.json`, même race). */
const LABELS = {
  humain: 'Humain',
  halfling: 'Halfling',
  'haut-elfe': 'Haut-Elfe',
  'elfe-sylvain': 'Elfe sylvain',
  nain: 'Nain',
  gnome: 'Gnome',
  ogre: 'Ogre',
};

const echecs = [];
const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);

if (serializeDataset(data) !== brut) {
  console.error('names.json : FORME NON CANONIQUE (pas `JSON.stringify(doc, null, 2)`)');
  process.exit(1);
}

const documents = [];

if (Array.isArray(data)) {
  console.log(`names → documents : no-op (déjà migré, ${data.length} document(s))`);
  process.exit(0);
}

for (const [cle, pool] of Object.entries(data)) {
  const label = LABELS[cle];
  if (!label) {
    echecs.push(`${cle} : aucune race connue sous cette clé — label AUTHORÉ requis`);
    continue;
  }
  if (!pool || typeof pool !== 'object' || Array.isArray(pool)) {
    echecs.push(`${cle} : banque de forme inattendue (objet attendu)`);
    continue;
  }
  // ENVELOPPE en tête, puis les champs de banque DANS LEUR ORDRE EXISTANT.
  documents.push({ id: cle, type: 'names', label, ...pool });
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const out = serializeDataset(documents);
fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : 7 documents, ids distincts et égaux aux clés d'origine, charge INTACTE.
const apres = JSON.parse(out);
const clesAvant = Object.keys(data);
if (apres.length !== clesAvant.length) echecs.push(`POST — ${apres.length} document(s) ≠ ${clesAvant.length} clé(s)`);
if (apres.map((d) => d.id).join(',') !== clesAvant.join(',')) echecs.push('POST — ordre/ids des documents ≠ ordre des clés');
if (new Set(apres.map((d) => d.id)).size !== apres.length) echecs.push('POST — ids en collision');
for (const d of apres) {
  if (Object.keys(d).slice(0, 3).join(',') !== 'id,type,label') echecs.push(`POST — ${d.id} : tête ≠ id,type,label`);
  const { id: _id, type: _type, label: _label, ...charge } = d;
  if (JSON.stringify(charge) !== JSON.stringify(data[d.id])) echecs.push(`POST — ${d.id} : la charge utile a été ALTÉRÉE`);
}

if (echecs.length) {
  console.error(`ÉCHEC POST-ÉCRITURE — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`names → LISTE de ${apres.length} documents : ${apres.map((d) => `${d.id} (« ${d.label} »)`).join(', ')}`);
