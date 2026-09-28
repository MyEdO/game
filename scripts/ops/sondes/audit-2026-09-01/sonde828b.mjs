// SONDE (lecture seule) — le stock de la famille TOMBSTONE d'ANCIEN NOM RAPPELÉ (`FAMILLE`
// ci-dessous) sur le corpus RÉEL de la garde comment-poison, et non sur un grep de surface :
// même périmètre (`corpusDesGardes()`, qui lit `PERIMETRE_DES_GARDES`), tests COMPRIS, et détection par
// `tombstonesIn` appliquée aux seuls COMMENTAIRES extraits (`extractComments`), jamais aux chaînes.
// La sonde rend aussi le CARDINAL du corpus et la présence de `commentPoison.mjs` lui-même :
// une garde qui ne se scanne pas elle-même rendrait 0 sans rien prouver.
// COMPTEUR : nombre de commentaires portant cette famille sur l'arbre.
// Usage : node scripts/ops/sondes/audit-2026-09-01/sonde828b.mjs
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RACINE } from './_socle.mjs';

/** Nom de la famille cherchée, tel que `tombstonesIn` le REND. Il vit en CHAÎNE, jamais en
 *  commentaire : la garde scanne les commentaires de `scripts/**` et cette sonde en fait partie. */
const FAMILLE = 'ex-Nom';

const lib = (nom) => pathToFileURL(join(RACINE, 'scripts', 'guards', 'lib', nom)).href;
const { corpusDesGardes, tombstonesIn, extractComments } = await import(lib('commentPoison.mjs'));

const corpus = corpusDesGardes();
console.log(
  'corpus',
  corpus.length,
  '| guards/lib',
  corpus.filter((f) => f.rel.startsWith('scripts/guards/lib/')).length,
  '| commentPoison scanné:',
  corpus.some((f) => f.rel === 'scripts/guards/lib/commentPoison.mjs'),
);

let n = 0;
for (const f of corpus) {
  for (const cm of extractComments(f.text)) {
    const texte = typeof cm === 'string' ? cm : (cm.text ?? String(cm));
    if (tombstonesIn(texte).includes(FAMILLE)) {
      n++;
      console.log(`${FAMILLE.toUpperCase()} EN COMMENTAIRE`, f.rel);
    }
  }
}
console.log(`${FAMILLE} EN COMMENTAIRE sur l'arbre :`, n);
