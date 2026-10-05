/**
 * Migration #1552 — le document de PROJET et ses scènes S'ANNONCENT, et le projet dit sa PROVENANCE.
 *
 * Quatre gestes, sur les 4 documents committés :
 *  - `type: 'projet'` à la racine (l'enveloppe de `document()` l'exige désormais,
 *    `src/data/schemas/defs-scenes/projet.ts`), posé à la POSITION de la convention d'enveloppe :
 *    `id`, `type`, `label` en tête, dans cet ordre ;
 *  - `type: 'scene'` en PREMIÈRE clé de chaque scène embarquée (`sceneSchema` l'exige) ;
 *  - la PROVENANCE de la campagne — `source` OU `maison`, jamais ni l'un ni l'autre (refine de
 *    fabrique) — posée depuis la table NOMINATIVE ci-dessous, établie à la MESURE et non de mémoire ;
 *  - le `schema` passe de 6 à 7 (pendant committé de `PROJECT_MIGRATIONS[6]`, `src/data/migrationsDeProjet.ts`,
 *    qui porte le même geste au CHARGEMENT pour les projets de bibliothèque utilisateur).
 *
 * ENTRÉES : les 4 `src/scenes/<campagne>/<campagne>-projet.json`.
 *
 * IDEMPOTENT : un document en `schema` ≥ 7 est reconnu migré ; rejouée, la migration n'écrit rien. La
 * borne haute était CLOSE tant que cette migration était la DERNIÈRE de la chaîne ; #1691 a porté le
 * même document à 8 (`2026-09-07-1691-relief-defaults-scenes.mjs`), donc elle s'élargit — sans quoi le
 * rejeu sur l'arbre courant sortirait ROUGE (même retouche que `…-15b-…` en son temps). Le trou ainsi
 * ouvert (un `schema` FUTUR avalé en silence) est rattrapé, comme toujours, par la DERNIÈRE migration
 * de la chaîne, seule à savoir ce qui existe après elle et dont la borne haute est CLOSE.
 * FAIL-FAST : `schema` ∉ {6, ≥ 7} (absent ou non numérique), `type` racine déjà posé sur
 * un document en `schema: 6`, provenance déjà présente, ou campagne absente de la table de
 * provenance → sortie 1, AUCUNE écriture.
 * FORMATAGE PRÉSERVÉ : sérialiseur des scènes `JSON.stringify(doc, null, 1) + '\n'`, vérifié AVANT
 * toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RACINE = path.join(ROOT, 'src/scenes');
const canonique = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

/**
 * PROVENANCE par campagne — ÉTABLIE À LA MESURE le 2026-08-31, jamais de mémoire.
 *  - `la-diligence` : adaptation du chapitre 1 de « L'Ennemi dans l'Ombre ». Le document CITAIT déjà
 *    ce folio en profondeur (`narratif.ouverture.source`, `{ ennemi-dans-l-ombre, 12, EDO 01 l.5 ·
 *    l.13 }`) : la racine reprend cette référence À L'IDENTIQUE, aucune n'est inventée.
 *  - les 3 autres : `maison`. Mesuré — « L'Arène », « La Barge du Sel » et « Le Loup et la Saumure »
 *    n'apparaissent dans AUCUN fichier de `Source/` (recherche plein texte sur les titres et sur
 *    leurs noms propres : « Serpent-de-Sel », « Seconde Flotte »).
 */
const PROVENANCE = {
  arene: {
    maison:
      "bac à sable de combat authoré pour le jeu — aucun livre ne publie cette arène ; les créatures, armes et règles qu'elle compose portent chacune sa propre source",
  },
  'barge-du-sel': {
    maison:
      "scénario naval authoré pour le jeu — aucun livre ne le publie (mesuré : absent de `Source/`) ; il compose des règles de la Mer des Griffes, qui portent leur source à leur foyer",
  },
  'loup-et-saumure': {
    maison:
      "scénario naval authoré pour le jeu — aucun livre ne le publie (mesuré : absent de `Source/`) ; il compose des règles de la Mer des Griffes, qui portent leur source à leur foyer",
  },
  diligence: {
    source: { book: 'ennemi-dans-l-ombre', page: 12, note: 'EDO 01 l.5 · l.13' },
  },
};

/**
 * Sortie : `id`, `type`, `label` EN TÊTE dans cet ordre — la CONVENTION DE POSITION de l'enveloppe,
 * posée par la migration L1b des documents de configuration
 * (`scripts/migrations/2026-08-28-l1b-7a-config-enveloppe.mjs:11`, mesurable sur `src/data/crew-morale.json`).
 * Puis toutes les clés existantes dans leur ordre existant, la provenance juste après
 * `versionContenu`. Les scènes EMBARQUÉES, elles, gardent `type` en tête (patron `typeDeStatbloc` des
 * documents embarqués).
 */
const annonce = (doc, provenance) => {
  const sortie = { id: doc.id, type: 'projet', label: doc.label };
  for (const [k, v] of Object.entries(doc)) {
    if (k === 'id' || k === 'label') continue;
    if (k === 'schema') { sortie.schema = 7; continue; }
    if (k === 'scenes') { sortie.scenes = v.map((s) => ({ type: 'scene', ...s })); continue; }
    sortie[k] = v;
    if (k === 'versionContenu') Object.assign(sortie, provenance);
  }
  return sortie;
};

const echecs = [];
const ecritures = [];

for (const d of fs.readdirSync(RACINE, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const abs = path.join(RACINE, d.name, `${d.name}-projet.json`);
  if (!fs.existsSync(abs)) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);
  if (canonique(doc) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE`); continue; }
  if (typeof doc.schema === 'number' && doc.schema >= 7) { ecritures.push({ rel, abs, brut, out: brut, deja: true }); continue; }
  if (doc.schema !== 6) { echecs.push(`${rel} : \`schema\` inattendu ${JSON.stringify(doc.schema)} (6 ou ≥ 7 attendus)`); continue; }
  if ('type' in doc) { echecs.push(`${rel} : \`schema: 6\` mais la racine porte DÉJÀ un \`type\` — forme hybride`); continue; }
  if ('source' in doc || 'maison' in doc) { echecs.push(`${rel} : \`schema: 6\` mais la racine porte DÉJÀ une provenance — forme hybride`); continue; }
  if (!Array.isArray(doc.scenes)) { echecs.push(`${rel} : \`scenes\` absent ou non-tableau`); continue; }
  const dejaAnnoncee = doc.scenes.findIndex((s) => s && typeof s === 'object' && 'type' in s);
  if (dejaAnnoncee >= 0) { echecs.push(`${rel} : la scène d'index ${dejaAnnoncee} porte DÉJÀ un \`type\``); continue; }
  const provenance = PROVENANCE[d.name];
  if (!provenance) { echecs.push(`${rel} : aucune provenance DÉCLARÉE pour « ${d.name} » — elle s'établit à la mesure, jamais par défaut`); continue; }
  if (doc.versionContenu === undefined) { echecs.push(`${rel} : \`versionContenu\` absent — l'ancre de pose de la provenance manque`); continue; }
  if (typeof doc.id !== 'string' || !doc.id || typeof doc.label !== 'string' || !doc.label) {
    echecs.push(`${rel} : \`id\`/\`label\` absent(s) ou vide(s) — la convention de position les met en tête, elle n'en invente aucun`);
    continue;
  }
  ecritures.push({ rel, abs, brut, out: canonique(annonce(doc, provenance)), deja: false, provenance });
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

let migres = 0;
for (const e of ecritures) {
  if (e.out !== e.brut) { fs.writeFileSync(e.abs, e.out, 'utf8'); migres++; }
  const apres = JSON.parse(e.out);
  if (e.deja) {
    // Rejeu sur l'état final : rien n'a été écrit. La PREUVE est que la forme est celle d'arrivée.
    const scenesMuettes = apres.scenes.filter((s) => s.type !== 'scene').length;
    if (!(apres.schema >= 7) || apres.type !== 'projet' || scenesMuettes > 0 || (apres.source === undefined && apres.maison === undefined)) {
      console.error(`VÉRIFICATION ROUGE — ${e.rel} : reconnu « déjà migré » mais schema=${apres.schema}, type=${JSON.stringify(apres.type)}, ${scenesMuettes} scène(s) sans \`type\`, provenance ${apres.source ?? apres.maison ? 'présente' : 'ABSENTE'}`);
      process.exit(1);
    }
    console.log(`${e.rel} — schema ${apres.schema} (déjà migré, no-op)`);
    continue;
  }
  // PREUVE post-écriture : le document d'après, DÉPOUILLÉ des seuls ajouts DÉCLARÉS, rendu à son
  // `schema` d'origine et RELU DANS L'ORDRE D'AVANT, doit rendre l'octet d'avant — clé par clé. La
  // remontée en tête d'`id`/`label` étant le geste DÉCLARÉ de la convention de position, l'ordre
  // d'origine est celui du document d'AVANT : c'est lui qui pilote la relecture, si bien que la preuve
  // reste entière sur les VALEURS et sur la position de tout le reste.
  const avant = JSON.parse(e.brut);
  const { type: _t, ...sansType } = apres;
  const cles = Object.keys(e.provenance);
  const reconstitue = {};
  for (const k of Object.keys(avant)) {
    if (cles.includes(k)) continue;
    const v = sansType[k];
    reconstitue[k] = k === 'schema' ? 6 : k === 'scenes' ? v.map(({ type: _s, ...reste }) => reste) : v;
  }
  if (apres.type !== 'projet' || apres.schema !== 7 || canonique(reconstitue) !== e.brut) {
    console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE — ${e.rel} : type=${JSON.stringify(apres.type)}, schema=${apres.schema}, charge utile ${canonique(reconstitue) === e.brut ? 'intacte' : 'ALTÉRÉE'}`);
    process.exit(1);
  }
  console.log(`${e.rel} — schema 6 → 7, type: 'projet' + ${apres.scenes.length} scène(s) annoncée(s), provenance « ${cles.join(', ')} »`);
}
console.log(`TOTAL : ${migres} document(s) migré(s) sur ${ecritures.length}.`);
