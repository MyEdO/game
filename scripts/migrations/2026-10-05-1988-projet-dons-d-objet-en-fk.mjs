/**
 * Migration #1988 B4a — les dons d'objet d'un document de projet ne désignent plus un objet que par son
 * id, volet `src/scenes`.
 *
 * UN geste, et le document passe en `schema: 18` : tout Effet ou op `giveTrapping` et toute Condition
 * `hasItem` du document sont réécrits par la primitive `donsDObjetEnFKDeep` (`src/data/donsDObjet.ts`) —
 * la MÊME que celle du migrateur de chargement, jamais un second calcul.
 *
 * Pendant de DÉPÔT du migrateur de chargement `PROJECT_MIGRATIONS[17]` (`src/data/migrationsDeProjet.ts`), qui
 * rattrape les `.json` de bibliothèque utilisateur. Parité mesurée par
 * `src/state/projet-migration-17-vers-18.test.ts`, qui joue la MÊME fixture par les deux.
 *
 * RÉSOLVEURS DU DÉPÔT : les IDS des catalogues, lus sur disque. La couture label→id
 * (`src/data/index.ts`) ne se charge pas sous Node nu : une qualité absente des ids, un `custom`, une
 * Condition `hasItem` qui nomme un libellé sont refusés ici par le résolveur, qui DIT ne pas résoudre un
 * libellé (`refusDeLibelle`, sortie 1) — le chargement, lui, les résout ou les refuse.
 *
 * ENTRÉES : les `src/scenes/<campagne>/<campagne>-projet.json` ; `src/data/donsDObjet.ts` (la primitive,
 * chargée par Node nu) ; `src/data/qualities.json` et `src/data/trappings.json` (leurs ids).
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 1) + '\n'`, vérifié AVANT toute écriture — non
 * canonique = sortie 1, jamais un reflow silencieux. `schema` garde sa POSITION.
 * IDEMPOTENT : rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * BORNE HAUTE CLOSE (`schema` ∈ {17, 18}) : DERNIÈRE de la chaîne dans l'ordre lexical, elle NOMME un
 * `schema` futur.
 * FAIL-FAST : `schema` absent, non numérique ou ∉ {17, 18}, `scenes` non-tableau, don ou Condition que
 * les résolveurs du dépôt ne résolvent pas (levée de la primitive), périmètre vide → rien n'est écrit,
 * sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { donsDObjetEnFKDeep } from '../../src/data/donsDObjet.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-10-05-1988-projet-dons-d-objet-en-fk';
const RACINE = path.join(ROOT, 'src/scenes');

/** Forme du document AVANT et APRÈS ce bump — la borne haute est CLOSE (cf. en-tête). */
const SCHEMA_AVANT = 17;
const SCHEMA_APRES = 18;

const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
const idsDe = (fichier) => new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', fichier), 'utf8')).map((e) => e.id));
const QUALITES = idsDe('qualities.json');
const OBJETS = idsDe('trappings.json');

/** Le refus d'une valeur que seul un LIBELLÉ résoudrait : le dépôt ne charge pas la couture label→id. */
function refusDeLibelle(valeur) {
  throw new Error(`le dépôt ne résout pas un libellé (« ${valeur} ») : charger le projet par l'éditeur (\`parseProject\`), qui le résout ou le refuse.`);
}

/** Les résolveurs du dépôt pour `doc` : par id seulement (cf. en-tête). */
function resolveurs(doc) {
  const duProjet = new Set((doc.narratif?.objets ?? []).map((o) => o.id));
  return {
    qualite: (q) => (QUALITES.has(q) ? q : refusDeLibelle(q)),
    objets: refusDeLibelle,
    objetConnu: (id) => duProjet.has(id) || OBJETS.has(id),
  };
}

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

  let remappe;
  try { remappe = donsDObjetEnFKDeep(doc, resolveurs(doc)); } catch (e) { echecs.push(`${rel} : ${e.message}`); continue; }
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
  if (canonique(donsDObjetEnFKDeep(apres, resolveurs(apres))) !== out || apres.schema !== SCHEMA_APRES) {
    console.error(`[${NOM}] VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : schema=${apres.schema}, don d’objet hors FK restant`);
    process.exit(1);
  }
  console.log(`[${NOM}] ${r.rel} — schema ${r.doc.schema} → ${apres.schema}, dons d’objet réécrits : ${r.remappe ? 'oui' : 'aucun'} — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
}

console.log(`[${NOM}] TOTAL — ${cibles.length} projet(s), ${rapports.filter((r) => r.remappe).length} réécrit(s) par la primitive`);
