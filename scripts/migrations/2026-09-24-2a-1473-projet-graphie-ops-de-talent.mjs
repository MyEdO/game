/**
 * Migration #1473 (train 2a) — la référence de Talent des ops `grantTalent` / `grantCareerTalent` prend la
 * graphie `talent: { id, spec? }`, volet `src/scenes`.
 *
 * UN geste, et le document passe en `schema: 17` : toute op de Talent du document est réécrite par la
 * primitive `graphieOpsDeTalentDeep` (`src/data/graphieOpsDeTalent.ts`) — la MÊME que celle du migrateur
 * de chargement, jamais un second calcul.
 *
 * Pendant de DÉPÔT du migrateur de chargement `PROJECT_MIGRATIONS[16]` (`src/data/migrationsDeProjet.ts`), qui
 * rattrape les `.json` de bibliothèque utilisateur. Parité mesurée par
 * `src/state/projet-migration-16-vers-17.test.ts`, qui joue la MÊME fixture par les deux.
 *
 * ENTRÉES : les `src/scenes/<campagne>/<campagne>-projet.json` ; `src/data/graphieOpsDeTalent.ts` (la
 * primitive, chargée par Node nu).
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 1) + '\n'`, vérifié AVANT toute écriture — non
 * canonique = sortie 1, jamais un reflow silencieux. `schema` garde sa POSITION.
 * IDEMPOTENT : rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * BORNE HAUTE OUVERTE (`schema` ∈ {16, ≥ 17}) : la DERNIÈRE migration de la chaîne dans l'ordre
 * lexical est la seule à nommer un `schema` futur (`DERNIERE`, dérivée par
 * `src/scenes/migrations-format-projet.test.ts`). Le document sort donc d'ici en `schema` =
 * max(le sien, 17) : une migration amont ne RABAISSE jamais une forme.
 * FAIL-FAST : `schema` absent, non entier ou < 16, `scenes` non-tableau, op de Talent à DEUX graphies
 * (levée de la primitive), périmètre vide → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { graphieOpsDeTalentDeep } from '../../src/data/graphieOpsDeTalent.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-24-2a-1473-projet-graphie-ops-de-talent';
const RACINE = path.join(ROOT, 'src/scenes');

/** Forme du document AVANT et APRÈS ce bump — la borne haute est OUVERTE (cf. en-tête). */
const SCHEMA_AVANT = 16;
const SCHEMA_APRES = 17;

const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

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
  if (typeof doc.schema !== 'number' || !Number.isInteger(doc.schema) || doc.schema < SCHEMA_AVANT) {
    echecs.push(`${rel} : \`schema\` inattendu ${JSON.stringify(doc.schema)} (${SCHEMA_AVANT} ou plus récent attendu)`);
    continue;
  }
  if (!Array.isArray(doc.scenes)) { echecs.push(`${rel} : \`scenes\` absent ou non-tableau`); continue; }

  let remappe;
  try { remappe = graphieOpsDeTalentDeep(doc); } catch (e) { echecs.push(`${rel} : ${e.message}`); continue; }
  rapports.push({ rel, abs, brut, doc, sortie: { ...remappe, schema: Math.max(doc.schema, SCHEMA_APRES) }, remappe: canonique(remappe) !== brut });
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
  if (canonique(graphieOpsDeTalentDeep(apres)) !== out || !(apres.schema >= SCHEMA_APRES)) {
    console.error(`[${NOM}] VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : schema=${apres.schema}, op de Talent à l’ancienne graphie restante`);
    process.exit(1);
  }
  console.log(`[${NOM}] ${r.rel} — schema ${r.doc.schema} → ${apres.schema}, ops de Talent réécrites : ${r.remappe ? 'oui' : 'aucun'} — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
}

console.log(`[${NOM}] TOTAL — ${cibles.length} projet(s), ${rapports.filter((r) => r.remappe).length} réécrit(s) par la primitive`);
