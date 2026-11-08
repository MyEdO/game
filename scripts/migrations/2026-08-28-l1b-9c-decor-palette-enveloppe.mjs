/**
 * Migration #1467 L1b V-FLIP-RECORD — `decorPalette.json` reçoit son ENVELOPPE de document : la carte
 * `ton → couleur` descend sous `entries`, la racine porte `id`/`type`/`label`.
 *
 * MOTIF : identique à `teintesJeu` (9b) — la fabrique `document()` pose l'enveloppe sur TOUT
 * document, la famille `record` range sa charge sous `entries`. AUCUN ton ne change : les 435 paires
 * sont recopiées telles quelles, dans leur ordre.
 *
 * ENTRÉES : `src/data/decorPalette.json` (seule donnée lue et écrite).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une racine portant déjà `entries` aux bonnes valeurs
 * d'identité est reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : identité présente et DIVERGENTE, racine non-objet → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT toute
 * écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/data/decorPalette.json');
const IDENTITE = { id: 'palette-decor', type: 'decorPalette', label: 'Palette du décor' };

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);
const echecs = [];

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('decorPalette.json : FORME NON CANONIQUE (pas `JSON.stringify(doc, null, 2)`)');
  process.exit(1);
}
if (!estObjet(data)) {
  console.error('decorPalette.json : racine de forme inattendue (objet attendu)');
  process.exit(1);
}

const dejaEnveloppe = data.entries !== undefined;
const divergents = ['id', 'type', 'label'].filter((k) => data[k] !== undefined && data[k] !== IDENTITE[k]);
if (divergents.length) {
  console.error(`decorPalette.json : ${divergents.map((k) => `\`${k}\` = ${JSON.stringify(data[k])} ≠ ${JSON.stringify(IDENTITE[k])}`).join(', ')} — arbitrage requis`);
  process.exit(1);
}

const entries = dejaEnveloppe ? data.entries : Object.fromEntries(Object.entries(data).filter(([k]) => !['id', 'type', 'label'].includes(k)));
const sortie = { ...IDENTITE, entries };
const out = JSON.stringify(sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : les 4 clés de racine, dans l'ordre, et les tons INTACTS un à un.
const apres = JSON.parse(out);
if (Object.keys(apres).join(',') !== 'id,type,label,entries') echecs.push(`POST — racine ${Object.keys(apres).join(',')} ≠ id,type,label,entries`);
if (JSON.stringify(apres.entries) !== JSON.stringify(entries)) echecs.push('POST — la palette a été ALTÉRÉE');

if (echecs.length) {
  console.error(`ÉCHEC POST-ÉCRITURE — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`${out === brut ? 'no-op' : 'migré'} decorPalette.json — enveloppe ${IDENTITE.id}, ${Object.keys(apres.entries).length} ton(s) sous \`entries\``);
