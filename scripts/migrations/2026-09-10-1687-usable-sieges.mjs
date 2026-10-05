/**
 * Migration #1687 — l'ASSISE d'un décor s'ACTIVE à l'éditeur, volet `src/scenes`.
 *
 * DEUX gestes, un seul passage : chaque entité dont le TYPE de décor porte des `seatSlots` reçoit
 * `usable: {}`, et le document passe en `schema: 10` — la FORME du document change (un champ neuf sur
 * l'entité), et un projet antérieur se rattrape au chargement par `PROJECT_MIGRATIONS[9]`
 * (`src/data/migrationsDeProjet.ts`), pendant applicatif de ce script.
 *
 * POURQUOI : depuis ce lot, l'utilisabilité d'une entité se DÉRIVE de ce qu'elle offre
 * (`estUtilisable(scene, ent) = actionsDe(scene, ent).length > 0`, `src/state/usable.ts`), et
 * l'assise est la seule capacité qui vive sur le TYPE (`PropData.seatSlots`) : c'est donc la seule
 * qu'un opt-in d'INSTANCE ouvre — verbatim utilisateur 2026-09-09, « on doit pouvoir s'assoire sur
 * une chaise si dans l'éditeur on l'active ». Les meubles à places DÉJÀ LIVRÉS étaient assis-ables
 * avant le lot : sans ce passage ils deviendraient muets. Zéro régression est le contrat.
 *
 * ENTRÉES : les `src/scenes/<campagne>/<campagne>-projet.json`, et `src/data/props.json` en LECTURE
 * SEULE (les TYPES qui portent des places — jamais une liste d'ids récitée ici).
 * CARDINAL ATTENDU, mesuré sur l'arbre au moment de l'écriture (2026-09-10) : 4 projets, 28 Scènes,
 * 5 entités de type à places (les tables de la Diligence). Les autres capacités (dialogue, marchand,
 * fouille, jeu de taverne) vivent sur l'instance et se dérivent SANS activation : rien à migrer.
 * FORMATAGE PRÉSERVÉ : les documents de scène ont leur PROPRE sérialiseur —
 * `JSON.stringify(doc, null, 1) + '\n'`. Forme vérifiée AVANT toute écriture : non canonique =
 * sortie 1, jamais un reflow silencieux.
 * POSITION : `usable` va en QUEUE de l'entité — la place que l'éditeur donne à un champ posé sur une
 * entité existante (`editEntity`, `src/state/sceneEdit.ts`), donc celle que `PROJECT_MIGRATIONS[9]`
 * écrit aussi (parité mesurée par `src/state/projet-migration-9-vers-10.test.ts`).
 * IDEMPOTENT : une entité portant déjà `usable` est reconnue activée et son enveloppe est laissée
 * telle quelle ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * BORNE HAUTE OUVERTE (`schema` ∈ {9, ≥ 10}) : la DERNIÈRE migration de la chaîne dans l'ordre
 * lexical est la seule à nommer un `schema` futur (`DERNIERE`, dérivée par
 * `src/scenes/migrations-format-projet.test.ts`). Un document déjà plus récent traverse donc ici
 * sans être RABAISSÉ : le document sort en `schema` = max(le sien, 10).
 * FAIL-FAST : `usable` présent mais de forme inattendue, `schema` absent, non numérique ou < 9,
 * aucun type à places au catalogue → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-09-10-1687-usable-sieges';
const RACINE = path.join(ROOT, 'src/scenes');
const PROPS = path.join(ROOT, 'src/data/props.json');

/** Forme d'entrée et CIBLE de ce bump — la borne haute est OUVERTE (cf. en-tête). */
const SCHEMA_AVANT = 9;
const SCHEMA_APRES = 10;

/** Forme canonique d'un document de projet de scène. */
const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

/** Les TYPES de décor qui portent des places assises — LUS au catalogue, jamais récités. */
function typesAPlaces() {
  const doc = JSON.parse(fs.readFileSync(PROPS, 'utf8'));
  const entrees = Array.isArray(doc) ? doc : Object.values(doc).find(Array.isArray);
  if (!Array.isArray(entrees)) return null;
  return new Set(entrees.filter((p) => Array.isArray(p?.seatSlots) && p.seatSlots.length).map((p) => p.id));
}

const TYPES = typesAPlaces();
if (!TYPES || TYPES.size === 0) {
  console.error(`[${NOM}] ARBITRAGE REQUIS — aucun type de décor à \`seatSlots\` dans src/data/props.json, AUCUNE écriture`);
  process.exit(1);
}

const cibles = fs
  .readdirSync(RACINE, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join(RACINE, d.name, `${d.name}-projet.json`))
  .filter((p) => fs.existsSync(p));

const echecs = [];
const rapports = [];
let scenesVues = 0;
let siegesVus = 0;

/** L'entité porte-t-elle un TYPE de décor à places ? */
const estSiege = (e) => e?.kind === 'prop' && TYPES.has(e?.ref);

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

  let migres = 0;
  let deja = 0;
  let sieges = 0;
  const scenes = doc.scenes.map((s, i) => {
    scenesVues++;
    if (!Array.isArray(s?.entities)) return s;
    const entities = s.entities.map((e) => {
      if (!estSiege(e)) return e;
      sieges++;
      siegesVus++;
      if (!('usable' in e)) { migres++; return { ...e, usable: {} }; }
      if (!e.usable || typeof e.usable !== 'object' || Array.isArray(e.usable)) {
        echecs.push(`${rel} › scenes[${i}] (${s.id}) › ${e.id} : \`usable\` de forme inattendue ${JSON.stringify(e.usable)}`);
        return e;
      }
      deja++;
      return e;
    });
    return { ...s, entities };
  });

  rapports.push({ rel, abs, brut, doc, scenes, migres, deja, sieges });
}

// FORME, jamais cardinal (#1812) : une Scène et son décor sont des données ÉDITABLES — en créer ne
// doit rien recaler ici. Ce qui arrête la migration, c'est un périmètre VIDE.
if (!cibles.length) echecs.push('aucun projet de scène trouvé — périmètre déplacé');
if (!scenesVues) echecs.push('aucune Scène embarquée — périmètre déplacé');
if (!siegesVus) echecs.push('aucune entité à places — périmètre déplacé');

if (echecs.length) {
  console.error(`[${NOM}] ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const r of rapports) {
  // Le document ne REDESCEND jamais : un projet déjà porté plus loin par un passage postérieur garde
  // son numéro, ce passage-ci n'ayant à garantir que le plancher de SA cible.
  const cible = Math.max(r.doc.schema, SCHEMA_APRES);
  const sortie = Object.fromEntries(
    Object.entries(r.doc).map(([k, v]) => (k === 'scenes' ? [k, r.scenes] : k === 'schema' ? [k, cible] : [k, v])),
  );
  const out = canonique(sortie);
  if (out !== r.brut) fs.writeFileSync(r.abs, out, 'utf8');

  // PREUVE post-écriture : plus AUCUNE entité à places sans activation, et le document s'annonce.
  const apres = JSON.parse(out);
  const muettes = apres.scenes
    .flatMap((s) => (Array.isArray(s.entities) ? s.entities : []))
    .filter((e) => estSiege(e) && !e.usable)
    .map((e) => e.id);
  if (muettes.length || apres.schema < SCHEMA_APRES) {
    console.error(`[${NOM}] VÉRIFICATION POST-ÉCRITURE ROUGE — ${r.rel} : schema=${apres.schema}, ${muettes.join(', ')}`);
    process.exit(1);
  }
  const deja = r.doc.schema > SCHEMA_APRES ? ` — DÉJÀ MIGRÉ au-delà de ${SCHEMA_APRES}` : '';
  console.log(`[${NOM}] ${r.rel} — schema ${r.doc.schema} → ${apres.schema}${deja}, usable posés : ${r.migres} (déjà activées : ${r.deja}, entités à places : ${r.sieges}, scènes : ${apres.scenes.length}) — fichier ${out !== r.brut ? 'réécrit' : 'INCHANGÉ'}`);
}
