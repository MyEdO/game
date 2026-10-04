/**
 * Migration #1691 — la matière de RELIEF passe en DONNÉE, volet `src/scenes`.
 *
 * DEUX gestes, un seul passage : chaque Scène reçoit `reliefDefaults`, et le document passe en
 * `schema: 8` — le champ étant EXIGÉ, la FORME du document change, et un projet antérieur se rattrape au
 * chargement par `PROJECT_MIGRATIONS[7]` (`src/data/migrationsDeProjet.ts`), pendant applicatif de ce script.
 *
 * Chaque Scène des projets livrés reçoit `reliefDefaults` : la matière de CHAQUE partie de relief que
 * le builder de sols émet (falaise, rampe, dalle de tablier, pilier). Le champ est EXIGÉ par le schéma
 * de Scène — un document qui n'en porte pas est refusé au parse, le rendu n'ayant plus aucune valeur à
 * deviner. Les valeurs posées sont EXACTEMENT celles que `floors.ts` choisissait en dur, si bien que
 * l'identité de rendu (hash des faces des 66 scènes) est le contrat de ce lot.
 *
 * La face d'un terrain à BLOC PLEIN ne passe PAS par ici : elle tient sa matière de son TERRAIN
 * (`terrains.json › matiere`, migration sœur `2026-09-07-1691-relief-en-donnee.mjs`).
 *
 * ENTRÉES : les `src/scenes/<campagne>/<campagne>-projet.json`.
 * CARDINAL ATTENDU, mesuré sur l'arbre au moment de l'écriture (2026-09-07) : 4 projets, 28 Scènes
 * embarquées. Les 38 autres Scènes du corpus sont fabriquées en TS (`state/mapSpec.buildScene`) et
 * tiennent le champ d'`emptyScene` : elles n'ont rien à migrer.
 * FORMATAGE PRÉSERVÉ : les documents de scène ont leur PROPRE sérialiseur —
 * `JSON.stringify(doc, null, 1) + '\n'` (précédent `2026-08-27-l1b-3g-scene-desc.mjs`). Forme
 * vérifiée AVANT toute écriture : non canonique = sortie 1, jamais un reflow silencieux.
 * IDEMPOTENT : une Scène portant déjà `reliefDefaults` est reconnue migrée ; rejouée sur l'état final,
 * la migration n'écrit rien et sort 0.
 * BORNE HAUTE OUVERTE (`schema` ∈ {7, ≥ 8}) : la DERNIÈRE migration de la chaîne dans l'ordre lexical
 * est la seule à nommer un `schema` futur (`DERNIERE`, dérivée par
 * `src/scenes/migrations-format-projet.test.ts`). Le document sort donc d'ici en `schema` =
 * max(le sien, 8) : une migration amont ne RABAISSE jamais une forme.
 * FAIL-FAST : `reliefDefaults` présent mais incomplet ou de forme inattendue, `schema` absent, non
 * numérique ou < 7 → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-07-1691-relief-defaults-scenes';
const RACINE = path.join(ROOT, 'src/scenes');

/** La matière de chaque PARTIE, telle que `floors.ts` la choisissait en dur avant ce lot. */
const POSE = { cliff: 'terre', ramp: 'terre', deck: 'pierre', pilier: 'pilier' };
const PARTIES = Object.keys(POSE);
/** Forme du document AVANT et APRÈS ce bump — la borne haute est CLOSE (cf. en-tête). */
const SCHEMA_AVANT = 7;
const SCHEMA_APRES = 8;

/** Forme canonique d'un document de projet de scène. */
const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

/**
 * La Scène, `reliefDefaults` inséré à la place que la CRÉATION lui donne (`emptyScene`,
 * `src/state/scene.ts`) : devant la première clé qui la SUIT là-bas — `roofDefaults` (#1715) si le
 * document la porte déjà, sinon `layers`. Les projets d'arène, de barge et de cogue sont
 * re-générables à l'octet (`src/scenes/generateurs-byte-stables.test.ts`) — poser la clé en queue
 * ferait diverger l'artefact committé de son `build()`. Sans aucune des deux (document ancien), la
 * clé va en queue : la position n'est alors contrainte par rien.
 */
function avecReliefDefaults(s) {
  const cles = Object.keys(s);
  const rang = ['roofDefaults', 'layers'].map((k) => cles.indexOf(k)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? -1;
  if (rang < 0) return { ...s, reliefDefaults: { ...POSE } };
  return Object.fromEntries([
    ...cles.slice(0, rang).map((k) => [k, s[k]]),
    ['reliefDefaults', { ...POSE }],
    ...cles.slice(rang).map((k) => [k, s[k]]),
  ]);
}

const cibles = fs
  .readdirSync(RACINE, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join(RACINE, d.name, `${d.name}-projet.json`))
  .filter((p) => fs.existsSync(p));

const echecs = [];
const rapports = [];
let scenesVues = 0;

for (const abs of cibles) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);

  if (canonique(doc) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE`); continue; }
  if (typeof doc.schema !== 'number' || doc.schema < SCHEMA_AVANT) {
    echecs.push(`${rel} : \`schema\` inattendu ${JSON.stringify(doc.schema)} (${SCHEMA_AVANT} ou \u2265 ${SCHEMA_APRES} attendus)`);
    continue;
  }
  if (!Array.isArray(doc.scenes)) { echecs.push(`${rel} : \`scenes\` absent ou non-tableau`); continue; }

  let migres = 0;
  let deja = 0;
  const scenes = doc.scenes.map((s, i) => {
    scenesVues++;
    const porte = s?.reliefDefaults;
    if (porte === undefined) { migres++; return avecReliefDefaults(s); }
    const manquantes = PARTIES.filter((p) => typeof porte?.[p] !== 'string');
    if (manquantes.length) echecs.push(`${rel} › scenes[${i}] (${s.id}) : \`reliefDefaults\` sans ${manquantes.join(', ')}`);
    else deja++;
    return s;
  });

  rapports.push({ rel, abs, brut, doc, scenes, migres, deja });
}

// FORME, jamais cardinal (#1812) : une Scène est une donnée ÉDITABLE — en créer une ne doit rien
// recaler ici. Ce qui arrête la migration, c'est un périmètre VIDE, pas un périmètre qui a grandi.
if (!cibles.length) echecs.push('aucun projet de scène trouvé — périmètre déplacé');
if (!scenesVues) echecs.push('aucune Scène embarquée — périmètre déplacé');

if (echecs.length) {
  console.error(`[${NOM}] ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const r of rapports) {
  const sortie = Object.fromEntries(
    Object.entries(r.doc).map(([k, v]) => (k === 'scenes' ? [k, r.scenes] : k === 'schema' ? [k, Math.max(v, SCHEMA_APRES)] : [k, v])),
  );
  const out = canonique(sortie);
  if (out !== r.brut) fs.writeFileSync(r.abs, out, 'utf8');

  // PREUVE post-écriture : chaque Scène porte les QUATRE parties, avec les valeurs posées.
  const apres = JSON.parse(out);
  const muettes = apres.scenes.filter((s) => PARTIES.some((p) => s.reliefDefaults?.[p] !== POSE[p])).map((s) => s.id);
  if (muettes.length || !(apres.schema >= SCHEMA_APRES)) {
    console.error(`[${NOM}] VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : schema=${apres.schema}, ${muettes.join(', ')}`);
    process.exit(1);
  }
  console.log(`[${NOM}] ${r.rel} — schema ${r.doc.schema} → ${apres.schema}, reliefDefaults posés : ${r.migres} (déjà migrées : ${r.deja}, scènes : ${apres.scenes.length}) — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
}
