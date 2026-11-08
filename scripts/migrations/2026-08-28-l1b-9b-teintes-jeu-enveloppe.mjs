/**
 * Migration #1467 L1b V-FLIP-RECORD — `teintesJeu.json` reçoit son ENVELOPPE de document : la carte
 * `id → #rrggbb` descend sous `entries`, la racine porte `id`/`type`/`label`.
 *
 * MOTIF : la fabrique `document()` (`src/data/schemas/grammaire/document.ts`) pose l'enveloppe sur
 * TOUT document, et la famille `record` y range sa charge sous `entries` — un record est un document
 * comme un autre. AUCUNE teinte ne change : les 29 paires clé→valeur sont recopiées telles quelles,
 * dans leur ordre.
 *
 * ENTRÉES : `src/data/teintesJeu.json` (seule donnée lue et écrite).
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
const CIBLE = path.join(ROOT, 'src/data/teintesJeu.json');
const IDENTITE = { id: 'teintes-jeu', type: 'teintesJeu', label: 'Teintes de jeu' };

const brut = fs.readFileSync(CIBLE, 'utf8');
const data = JSON.parse(brut);
const echecs = [];

if (JSON.stringify(data, null, 2) !== brut) {
  console.error('teintesJeu.json : FORME NON CANONIQUE (pas `JSON.stringify(doc, null, 2)`)');
  process.exit(1);
}
if (!estObjet(data)) {
  console.error('teintesJeu.json : racine de forme inattendue (objet attendu)');
  process.exit(1);
}

const dejaEnveloppe = data.entries !== undefined;
const divergents = ['id', 'type', 'label'].filter((k) => data[k] !== undefined && data[k] !== IDENTITE[k]);
if (divergents.length) {
  console.error(`teintesJeu.json : ${divergents.map((k) => `\`${k}\` = ${JSON.stringify(data[k])} ≠ ${JSON.stringify(IDENTITE[k])}`).join(', ')} — arbitrage requis`);
  process.exit(1);
}

const entries = dejaEnveloppe ? data.entries : Object.fromEntries(Object.entries(data).filter(([k]) => !['id', 'type', 'label'].includes(k)));
const sortie = { ...IDENTITE, entries };
const out = JSON.stringify(sortie, null, 2);
if (out !== brut) fs.writeFileSync(CIBLE, out, 'utf8');

// PREUVE post-écriture : les 4 clés de racine, dans l'ordre, et les teintes INTACTES une à une.
const apres = JSON.parse(out);
if (Object.keys(apres).join(',') !== 'id,type,label,entries') echecs.push(`POST — racine ${Object.keys(apres).join(',')} ≠ id,type,label,entries`);
if (JSON.stringify(apres.entries) !== JSON.stringify(entries)) echecs.push('POST — la carte des teintes a été ALTÉRÉE');

if (echecs.length) {
  console.error(`ÉCHEC POST-ÉCRITURE — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`${out === brut ? 'no-op' : 'migré'} teintesJeu.json — enveloppe ${IDENTITE.id}, ${Object.keys(apres.entries).length} teinte(s) sous \`entries\``);
