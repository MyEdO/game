/**
 * Migration #1897 — l'arme d'une entité de scène (`scenes[].entities[].weapon`) passe du libellé à l'id,
 * volet `src/scenes`.
 *
 * UN geste, et le document passe en `schema: 18` : chaque `weapon` de la table GELÉE est réécrit par la
 * primitive `armesDEntiteEnIds` (`src/data/armesDEntiteEnIds.ts`) — la MÊME que celle du migrateur de
 * chargement, jamais un second calcul.
 *
 * Pendant de DÉPÔT du migrateur de chargement `PROJECT_MIGRATIONS[17]` (`src/state/worldMap.ts`), qui
 * rattrape les `.json` de bibliothèque utilisateur : ce que le chargement réécrit, ce script le réécrit ;
 * ce que le chargement laisse à `parseProject` pour qu'il le refuse (un `weapon` hors table qui n'est pas
 * un id de trapping), ce script le refuse. Parité mesurée par
 * `src/state/projet-migration-17-vers-18.test.ts`, qui joue la MÊME fixture par les deux.
 *
 * ENTRÉES : les `src/scenes/<campagne>/<campagne>-projet.json` ; `src/data/armesDEntiteEnIds.ts` (la
 * primitive, chargée par Node nu) ; `src/data/trappings.json` (les ids admis).
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 1) + '\n'`, vérifié AVANT toute écriture — non
 * canonique = sortie 1, jamais un reflow silencieux. `schema` et `weapon` gardent leur POSITION.
 * IDEMPOTENT : rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * BORNE HAUTE CLOSE (`schema` ∈ {17, 18}) : DERNIÈRE de la chaîne dans l'ordre lexical, elle NOMME un
 * `schema` futur.
 * FAIL-FAST : `schema` absent, non numérique ou ∉ {17, 18}, `scenes` non-tableau, `weapon` qui n'est ni
 * dans la table ni un id de `trappings.json`, périmètre vide → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { armesDEntiteEnIds } from '../../src/data/armesDEntiteEnIds.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-27-1897-projet-armes-d-entite-ids';
const RACINE = path.join(ROOT, 'src/scenes');

/** Forme du document AVANT et APRÈS ce bump — la borne haute est CLOSE (cf. en-tête). */
const SCHEMA_AVANT = 17;
const SCHEMA_APRES = 18;

const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
const IDS_DE_TRAPPING = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/trappings.json'), 'utf8')).map((t) => t.id));

/** Les `weapon` de `doc` qui ne sont pas un id de trapping, nommés par leur chemin. */
const armesMortes = (doc) => doc.scenes.flatMap((s, i) => (Array.isArray(s?.entities) ? s.entities : []).flatMap((e, j) => (
  e && typeof e === 'object' && e.weapon !== undefined && !IDS_DE_TRAPPING.has(e.weapon)
    ? [`scenes[${i}].entities[${j}].weapon : ${JSON.stringify(e.weapon)} n'est pas un id de trapping`]
    : []
)));

const echecs = [];
const cibles = fs.existsSync(RACINE)
  ? fs
    .readdirSync(RACINE, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(RACINE, d.name, `${d.name}-projet.json`))
    .filter((p) => fs.existsSync(p))
  : [];

const rapports = [];
for (const abs of cibles) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);

  if (canonique(doc) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE`); continue; }
  if (doc.schema !== SCHEMA_AVANT && doc.schema !== SCHEMA_APRES) {
    echecs.push(`${rel} : \`schema\` inattendu ${JSON.stringify(doc.schema)} (${SCHEMA_AVANT} ou ${SCHEMA_APRES} attendus)`);
    continue;
  }
  if (!Array.isArray(doc.scenes)) { echecs.push(`${rel} : \`scenes\` absent ou non-tableau`); continue; }

  const remappe = armesDEntiteEnIds(doc);
  const mortes = armesMortes(remappe);
  if (mortes.length) { for (const m of mortes) echecs.push(`${rel} ${m}`); continue; }
  rapports.push({ rel, abs, brut, doc, sortie: { ...remappe, schema: SCHEMA_APRES }, remappe: canonique(remappe) !== brut });
}

if (!cibles.length) echecs.push('aucun projet de scène trouvé — périmètre déplacé');

if (echecs.length) {
  console.error(`[${NOM}] ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const r of rapports) {
  const out = canonique(r.sortie);
  if (out !== r.brut) fs.writeFileSync(r.abs, out, 'utf8');

  // PREUVE post-écriture : la primitive n'a plus rien à réécrire, et le document s'annonce au format d'après.
  const apres = JSON.parse(out);
  if (canonique(armesDEntiteEnIds(apres)) !== out || apres.schema !== SCHEMA_APRES) {
    console.error(`[${NOM}] VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : schema=${apres.schema}, arme d'entité en libellé restante`);
    process.exit(1);
  }
  console.log(`[${NOM}] ${r.rel} — schema ${r.doc.schema} → ${apres.schema}, armes d'entité réécrites : ${r.remappe ? 'oui' : 'aucune'} — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
}

console.log(`[${NOM}] TOTAL — ${cibles.length} projet(s), ${rapports.filter((r) => r.remappe).length} réécrit(s) par la primitive`);
