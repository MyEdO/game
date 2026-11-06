/**
 * Migration #1467 L1b V-UNION — `oups.json` reçoit la clé d'ENVELOPPE `type` sur chacune de ses 8
 * entrées, en DEUXIÈME position (juste après `id`).
 *
 * MÊME patron que les vagues 11a/11b/12a/12b (`2026-08-28-l1b-12b-entite-type.mjs`), même contrat :
 * `document()` pose `type: z.literal('oups')` en clé REQUISE de l'enveloppe, donc l'adoption du def
 * et la migration de sa donnée sont indissociables.
 *
 * ACCORD def ⇄ donnée : le `type` écrit ici est celui que le def déclare à `document()`, et c'est le
 * NOM DE BASE du dataset. L'accord n'est pas gardé par une seconde table mais par le SCHÉMA lui-même :
 * `z.literal('oups')` rend rouge toute entrée dont le `type` diverge.
 *
 * ENTRÉES : `src/data/oups.json` (seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP SÉMANTIQUE : le no-op se décide sur le CARDINAL de ce que ce script POSSÈDE —
 * la pose de `type`. Zéro `type` à poser = rien n'est écrit et la sortie est 0, quel que soit l'ordre
 * des autres clés des entrées : la promotion de `id` et `type` en tête est une normalisation
 * d'enveloppe, et une égalité à l'octet en ferait une réécriture à elle seule.
 * FAIL-FAST : cardinal ≠ 8 (porte de lecture SEULE, avant toute écriture), racine non-tableau, entrée
 * sans `id` de chaîne, `id` ailleurs qu'en tête (cette vague ne promeut PAS `id`), `type` déjà présent
 * mais DIVERGENT → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT toute
 * écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estMonoTable } from './lib/monoTable.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const FICHIER = 'oups.json';
const TYPE = 'oups';
/** CARDINAL IMPOSÉ PAR LA TABLE, et c'est pourquoi il reste (#1812) : le « Tableau des Oups ! » est
 *  CLOS — 7 bandes d100 (LDB 14 l.21-30, la référence que porte chaque entrée) plus l'Incident de
 *  Tir. Une rangée n'y entre pas par croissance de contenu, mais par une RÈGLE de livre. */
const CARDINAL = 8;

const echoue = (msg) => {
  console.error(`✗ ${FICHIER} — ${msg}`);
  process.exit(1);
};

const chemin = path.join(ROOT, 'src/data', FICHIER);
const brut = fs.readFileSync(chemin, 'utf8');
const doc = JSON.parse(brut);

// Document mono-table (`lib/monoTable.mjs`) : ses rangées ne portent pas `type`, ce geste n'y a plus d'objet.
if (estMonoTable(doc)) {
  console.log(`${FICHIER} — document mono-table, rien à poser`);
  process.exit(0);
}
if (!Array.isArray(doc)) echoue('racine non-tableau');
if (doc.length !== CARDINAL) echoue(`cardinal ${doc.length}, attendu ${CARDINAL} — table des Oups CLOSE, LDB 14 l.21-30`);
if (brut !== `${JSON.stringify(doc, null, 2)}\n` && brut !== JSON.stringify(doc, null, 2))
  echoue('forme non canonique (≠ JSON.stringify(doc, null, 2)) — refus de reflower en silence');

/** Suffixe de fin de fichier tel qu'il est, pour le réécrire à l'identique. */
const finDeLigne = brut.endsWith('\n') ? '\n' : '';

let poses = 0;
const sortie = doc.map((e, i) => {
  if (typeof e?.id !== 'string' || !e.id) echoue(`entrée ${i} sans \`id\` de chaîne`);
  const rangId = Object.keys(e).indexOf('id');
  if (rangId !== 0) echoue(`entrée ${i} (${e.id}) porte \`id\` au rang ${rangId} — aucune promotion de \`id\` n'est déclarée par cette vague`);
  if (e.type !== undefined && e.type !== TYPE) echoue(`entrée ${i} (${e.id}) porte type « ${e.type} », attendu « ${TYPE} »`);
  if (!('type' in e)) poses++;
  const { id, type: _ignore, ...reste } = e;
  return { id, type: TYPE, ...reste };
});

if (poses === 0) {
  console.log(`= ${FICHIER} — no-op (0 \`type\` à poser sur ${CARDINAL} entrées)`);
  process.exit(0);
}

const texte = `${JSON.stringify(sortie, null, 2)}${finDeLigne}`;
fs.writeFileSync(chemin, texte);
console.log(`✓ ${FICHIER} — type « ${TYPE} » posé en 2ᵉ clé sur ${CARDINAL} entrées`);
