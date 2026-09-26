/**
 * Migration #1882 — la FICHE d'un personnage se NOMME, volet `src/scenes`.
 *
 * UN geste, et le document passe en `schema: 13` : toute entité `kind:'personnage'` qui ne porte ni
 * `ref`, ni `statblock`, ni `presetId` reçoit `ref` = le profil standard de son espèce authorée
 * (`LDB 77 l.7`, `species.json › profilStandard`).
 *
 * POURQUOI : depuis ce lot, un porteur de fiche est REQUIS sur un personnage
 * (`PORTEURS_DU_TYPE`, `src/data/schemas/defs-scenes/scene.ts`). Sans ce passage, une campagne livrée
 * serait REFUSÉE au parse dès son premier personnage sans fiche.
 *
 * Une entité qui porte DÉJÀ un porteur traverse INTACTE, y compris si sa ref est MORTE : une ref hors
 * registre n'est pas du ressort d'une migration, la porte `parseProject` la REFUSE en la nommant. Un
 * porteur VIDE (`ref: ''`) n'est pas un porteur : il est retiré et la fiche se nomme.
 *
 * SANS PROFIL STANDARD (espèce absente, id de rig, espèce qui n'en porte pas) : ce script n'ÉCRIT RIEN
 * et sort « ARBITRAGE REQUIS » en nommant l'entité. Le migrateur de CHARGEMENT
 * (`PROJECT_MIGRATIONS[12]`, `src/state/worldMap.ts`), lui, est TOTAL : il y écrit le statbloc de la
 * branche `!ref` de `spawnEnemy` d'avant #1882 (`FICHE_DU_SPAWN_AVANT_1882`), en `statblock`
 * explicite — un projet de bibliothèque utilisateur ne peut pas attendre un arbitrage ; un projet du
 * dépôt, si.
 *
 * PÉRIMÈTRE RÉEL — les artefacts MANUSCRITS. Un `*-projet.json` PRODUIT par un générateur
 * (`scripts/<campagne>/generate.mjs`) n'a pas sa donnée ici : sa SOURCE la porte à 100 %
 * (`src/scenes/generateurs-byte-stables.test.ts`, #1522), et c'est là que la fiche se nomme
 * (`NPC`, `scripts/campagne/lib.mjs`). Ce script reste la voie des documents que personne ne
 * regénère (au dépôt : `diligence`) et le PENDANT du migrateur de chargement.
 *
 * ENTRÉES : les `src/scenes/<campagne>/<campagne>-projet.json` ; `src/data/species.json` (profils).
 * Le cardinal est RAPPORTÉ, jamais confronté (#1812) : une Scène neuve en ajoute.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 1) + '\n'`, vérifié AVANT toute écriture : non
 * canonique = sortie 1, jamais un reflow silencieux.
 * POSITION : `ref` va en QUEUE de l'entité — la place que l'éditeur donne à un champ posé sur une
 * entité existante (`editEntity`), et celle que pose `poseSurChaqueEntite` (`src/state/worldMap.ts`).
 * Parité avec `PROJECT_MIGRATIONS[12]` mesurée par `src/state/projet-migration-12-vers-13.test.ts`.
 * IDEMPOTENT : rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * BORNE HAUTE OUVERTE (`schema` ≥ 12) : `2026-09-24-1882-refs-vivantes-semees.mjs` porte le document
 * plus loin ; un document déjà au-delà de 13 traverse, jamais rabaissé.
 * FAIL-FAST : `schema` absent, non numérique ou < 12, `scenes` non-tableau, personnage sans
 * profil standard, périmètre vide → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-23-1882-fiche-de-personnage-nommee';
const RACINE = path.join(ROOT, 'src/scenes');
const SPECIES = path.join(ROOT, 'src/data/species.json');

/** Forme du document AVANT et APRÈS ce bump — la borne haute est OUVERTE (cf. en-tête). */
const SCHEMA_AVANT = 12;
const SCHEMA_APRES = 13;

/** Forme canonique d'un document de projet de scène. */
const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

const echecs = [];

/** Un porteur absent ou VIDE (`''`) — même politique que `typeNonNomme`. */
const vide = (v) => v === undefined || v === '';

/** Un personnage qui ne NOMME aucune fiche — la seule population de ce passage. */
const sansFiche = (ent) =>
  !!ent && typeof ent === 'object' && ent.kind === 'personnage'
  && vide(ent.ref) && ent.statblock === undefined && vide(ent.presetId);

/** L'entité sans ses porteurs VIDES, avant que sa fiche se nomme en QUEUE. */
const sansPorteurVide = (ent) =>
  Object.fromEntries(Object.entries(ent).filter(([k, v]) => !((k === 'ref' || k === 'presetId') && v === '')));

const cibles = fs
  .readdirSync(RACINE, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join(RACINE, d.name, `${d.name}-projet.json`))
  .filter((p) => fs.existsSync(p));

/** Profil standard par id d'espèce — lu à l'instant de la migration. Entrée DÉCLARÉE : absente, elle
 *  se NOMME (sortie 1), jamais un catalogue vide silencieux. */
if (!fs.existsSync(SPECIES)) echecs.push('src/data/species.json absent — entrée déclarée des profils standard');
const PROFILS = new Map(
  (fs.existsSync(SPECIES) ? JSON.parse(fs.readFileSync(SPECIES, 'utf8')) : [])
    .filter((s) => typeof s?.profilStandard?.id === 'string')
    .map((s) => [s.id, s.profilStandard.id]),
);

const rapports = [];
let scenesVues = 0;
let nommesVus = 0;
/** Population STABLE : les personnages, toutes scènes confondues. MESURÉE pour le RAPPORT (#1812). */
let personnagesVus = 0;

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

  let nommes = 0;
  const scenes = doc.scenes.map((s) => {
    scenesVues++;
    if (!Array.isArray(s?.entities)) return s;
    const entities = s.entities.map((e) => {
      if (e && typeof e === 'object' && e.kind === 'personnage') personnagesVus++;
      if (!sansFiche(e)) return e;
      const espece = e.appearance?.species;
      const profil = PROFILS.get(espece);
      if (!profil) {
        echecs.push(`${rel} › ${s.id} › ${e.id} : personnage sans fiche, espèce ${JSON.stringify(espece)} sans profil standard (LDB 77 l.7) — poser sa fiche à la main`);
        return e;
      }
      nommes++;
      return { ...sansPorteurVide(e), ref: profil }; // QUEUE : la place de l'éditeur
    });
    return { ...s, entities };
  });

  nommesVus += nommes;
  rapports.push({ rel, abs, brut, doc, scenes, nommes });
}

// FORME, jamais cardinal (#1812) : une Scène et ses personnages sont des données ÉDITABLES — en créer
// ne doit rien recaler ici. Ce qui arrête la migration, c'est un périmètre VIDE.
if (!cibles.length) echecs.push('aucun projet de scène trouvé — périmètre déplacé');
if (!scenesVues) echecs.push('aucune Scène embarquée — périmètre déplacé');

if (echecs.length) {
  console.error(`[${NOM}] ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const r of rapports) {
  // Le document ne REDESCEND jamais : porté plus loin par un passage postérieur, il garde son numéro.
  const cible = Math.max(r.doc.schema, SCHEMA_APRES);
  const sortie = Object.fromEntries(
    Object.entries(r.doc).map(([k, v]) => (k === 'scenes' ? [k, r.scenes] : k === 'schema' ? [k, cible] : [k, v])),
  );
  const out = canonique(sortie);
  if (out !== r.brut) fs.writeFileSync(r.abs, out, 'utf8');

  // PREUVE post-écriture : plus AUCUN personnage sans fiche, et le document s'annonce au format d'après.
  const apres = JSON.parse(out);
  const restes = apres.scenes
    .flatMap((s) => (Array.isArray(s.entities) ? s.entities : []))
    .filter(sansFiche)
    .map((e) => e.id);
  if (restes.length || apres.schema < SCHEMA_APRES) {
    console.error(`[${NOM}] VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : schema=${apres.schema}, ${restes.join(', ')}`);
    process.exit(1);
  }
  const deja = r.doc.schema > SCHEMA_APRES ? ` — DÉJÀ MIGRÉ au-delà de ${SCHEMA_APRES}` : '';
  console.log(`[${NOM}] ${r.rel} — schema ${r.doc.schema} → ${apres.schema}${deja}, personnages dont la fiche se NOMME désormais : ${r.nommes} (scènes : ${apres.scenes.length}) — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
}

console.log(`[${NOM}] TOTAL — ${cibles.length} projet(s), ${scenesVues} Scène(s), ${nommesVus} personnage(s) nommé(s) ; population : ${personnagesVus} personnage(s)`);
