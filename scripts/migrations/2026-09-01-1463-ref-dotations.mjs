/**
 * Migration L-ref-1 (#1463) — les DOTATIONS qui NOMMENT une possession du catalogue cessent d'être
 * du texte : `{text:"Outils professionnels (Maréchal-ferrant)"}` devient `{id, spec}`,
 * `{text:"Cartes"}` devient `{id:'carte'}`. AUCUN changement de schéma : `trappingRefSchema`
 * (`src/data/schemas/grammaire/reference.ts`) accepte déjà `{id, spec?, count?}` et `{choice:[…]}`.
 *
 * MOTIF AU SOURCE — la tête de parenthèse est la POSSESSION, la parenthèse sa spécialisation :
 *   `Source/Warhammer v4 - Livre de base version corrigee/08 - Statut.md` l.1130 : « **Possessions :**
 *   veste en cuir, chemise de mailles, cheval de selle avec selle et harnais, bouclier, outils de la
 *   profession (Maréchal-ferrant) » — la possession est « Outils professionnels » (catalogue,
 *   `trappings.json › outils-professionnels`), « Maréchal-ferrant » en désigne la déclinaison.
 * Les 441 entrées de `trappings.json` ne déclarent AUCUN catalogue de spécialisations : `spec` y est
 * une chaîne libre, jamais une clé étrangère (patron `skill: {id, spec}`, #1548).
 *
 * GRAPHIES NON LITTÉRALES (pluriel du livre, quantité indéterminée) — chacune relue à sa ligne de
 * Source, et chacune INSTANCE d'un cas que la donnée porte DÉJÀ en `{id}` ailleurs. Le livre n'y donne
 * AUCUN nombre : aucun `count` n'est posable, et aucun pluriel n'est inventé — la référence est à
 * l'entrée de catalogue, le nombre reste hors donnée :
 *   - « Cartes » → `carte` (LDB `08 - Statut.md` l.1620 « parc de diligences et de chevaux, cartes » ;
 *     l.3188 « sac de couchage, cartes, tente… » ; `Warhammer v4 - Les archives de l'Empire volume 1/
 *     07 - Annexe I.md` l.172 « 4 apprentis Coureurs des forts, cartes, souvenirs ») — POLYSÉMIE
 *     tranchée : ce sont des cartes GÉOGRAPHIQUES (Maître des routes, Chasseur de trésors, Arpenteur
 *     des karak), pas le `paquet-de-cartes` de jeu que le livre écrit « paquet de cartes » (l.1099,
 *     l.2977, l.3694) et que la donnée pose déjà en `{id:'paquet-de-cartes'}` (cavalier-4, charlatan-1) ;
 *     `{id:'carte'}` est déjà posé par emissaire-3, soldat-4, eclaireur-3, artilleur-4 ;
 *   - « Clefs » → `clef` (l.914 « clefs, lanterne, huile de lampe, livrée ») ;
 *   - « Chiffon » → `chiffons` (l.238 « craie, pourpoint en cuir, 1d10 chiffons ») ;
 *   - « Tatouages » → `tatouage` (l.1474 « flasque d'alcool, hache, honte, tatouages ») ;
 *   - « Bougies » / « Epingles » → `bougie` / `epingle` (l.3325 « bougies, craie, poupée, épingles » ;
 *     `{id:'bougie'}` est déjà posé par la classe `roublards`) ;
 *   - « Carreaux » → `carreau` (l.1435 « arbalète avec dix carreaux » ; l.1543 et
 *     `WH - V4 - La Mer de Griffe/09 - La classe Cotier.md` l.401 « arbalète et dix carreaux » ;
 *     l.2826, l.3239, l.3396 « arbalète de poing avec dix carreaux ») — HOMONYMIE tranchée : deux
 *     entrées de `trappings.json` portent le libellé « Carreau », `carreau` (munition d'arbalète,
 *     LDB folio 296) et `carreau-de-baliste` (munition de siège, MDG folio 106, que MDG
 *     `12 - Navires et construction navale.md` l.379 distingue explicitement : « une baliste ne peut
 *     pas tirer de carreaux d'arbalète »). La liaison vise `carreau`, celui que la donnée pose déjà
 *     en `{id:'carreau', count:{fixed:10}}` (patrouilleur-routier-1, l.1836 « arbalète et 10 carreaux ») ;
 *   - « Haches de lancer » → `hache-de-lancer` (l.1492 « tête de géant, haches de lancer ») ;
 *   - « Cure-oreille (Multiple) » → `cure-oreille` (`05 - _gjdgxs.md` l.556 « **Courtisans :** costume
 *     luxueux, dague, bourse contenant une pince à épiler, des cure-oreilles et un peigne ») : la
 *     parenthèse n'y est pas une spécialisation mais le pluriel du livre — MÊME cas que « Clefs » ou
 *     « Bougies », et `spec:'Multiple'` aurait posé une spécialisation qui n'existe pas.
 *
 * EXCLUSIONS NOMINATIVES (6) — la parenthèse n'y est pas une spécialisation, le texte reste `text` :
 *   1-3. « Bijoux (50 CO) » / « (200 CO) » / « (500 CO) » (noble-2/3/4) : un PRIX ;
 *   4. « Grimoire (souvent sous forme d'os ou de dents gravés) » (chamane-1) : de la PROSE ;
 *   5. « Outils professionnels (même spécialisation que Métier) » (gardechamps-1) : un RENVOI DE RÈGLE ;
 *   6. « Outils professionnels (Au choix) » (nonne-2) : la SENTINELLE d'emplacement non désigné (#1457).
 *
 * ENTRÉES : `src/data/careerLevels.json` et `src/data/classes.json` — les seuls objets de la clé
 * `trappings` (y compris sous un `choice`) dont la clé `text` figure dans la TABLE CLOSE ci-dessous ;
 * `src/data/trappings.json` et `src/data/_ids.generated.ts` sont LUS (jamais écrits) pour
 * valider les ids produits et l'exhaustivité. Cardinal ASSERTÉ par sous-famille, total 51 :
 *  - 34 `{text:"Tête (Spéc.)"}` → `{id, spec}` (32 `careerLevels` + 2 `classes`) ;
 *  - 1 « Atelier (Ingénierie ou Magie) » → `{choice:[{id,spec},{id,spec}]}` (alchimiste-4) ;
 *  - 16 graphies non littérales → `{id}` (9 sites, 6 « Carreaux » `count` PRÉSERVÉ, 1 `classes`).
 * EXHAUSTIVITÉ : après écriture, tout `{text}` de dotation restant dont le libellé — entier, tête de
 * parenthèse, ou SINGULIER mot à mot (`-aux`→`-al`, `-s`/`-x` tombés : c'est la seule sonde qui
 * voyait « Haches de lancer ») — est le `label` d'une entrée de `trappings.json` hors des 6
 * exclusions est une anomalie → sortie 1.
 * IDEMPOTENT : rejouée sur l'état final, elle ne trouve plus aucun porteur et sort 0.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` exact (LF), constaté AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIERS = ['src/data/careerLevels.json', 'src/data/classes.json'];

/** TABLE CLOSE `texte EXACT → forme cible`, avec le cardinal attendu par fichier. */
const LIAISONS = [
  // A — tête de parenthèse = SPÉCIALISATION (LDB 08 l.1130).
  ['Outils professionnels (Maréchal-ferrant)', { id: 'outils-professionnels', spec: 'Maréchal-ferrant' }],
  ["Outils professionnels (Fabricant d'arcs)", { id: 'outils-professionnels', spec: "Fabricant d'arcs" }],
  ['Outils professionnels (Bricoleur)', { id: 'outils-professionnels', spec: 'Bricoleur' }],
  ['Outils professionnels (Cartographe)', { id: 'outils-professionnels', spec: 'Cartographe' }],
  ['Outils professionnels (Maçonnerie)', { id: 'outils-professionnels', spec: 'Maçonnerie' }],
  ['Outils professionnels (Boucher)', { id: 'outils-professionnels', spec: 'Boucher' }],
  ['Outils professionnels (Voleur)', { id: 'outils-professionnels', spec: 'Voleur' }],
  ['Outils professionnels (Ecriture)', { id: 'outils-professionnels', spec: 'Ecriture' }],
  ['Outils professionnels (Astrologie)', { id: 'outils-professionnels', spec: 'Astrologie' }],
  ['Arme simple (Hache)', { id: 'arme-simple', spec: 'Hache' }],
  ['Arme simple (Gaffe)', { id: 'arme-simple', spec: 'Gaffe' }],
  ['Arme simple (Epée)', { id: 'arme-simple', spec: 'Epée' }],
  ['Arme simple (Faucille)', { id: 'arme-simple', spec: 'Faucille' }],
  ['Arme simple (Pioche)', { id: 'arme-simple', spec: 'Pioche' }],
  ['Atelier (Remèdes)', { id: 'atelier', spec: 'Remèdes' }],
  ['Atelier (Magie)', { id: 'atelier', spec: 'Magie' }],
  ['Symbole religieux (Myrmidia)', { id: 'symbole-religieux', spec: 'Myrmidia' }],
  ['Symbole religieux (Ulric)', { id: 'symbole-religieux', spec: 'Ulric' }],
  ['Flasque (Alcool)', { id: 'flasque', spec: 'Alcool' }],
  // B — « A ou B » : un EMPLACEMENT de choix, forme `choice` (récursive au schéma).
  [
    'Atelier (Ingénierie ou Magie)',
    { choice: [{ id: 'atelier', spec: 'Ingénierie' }, { id: 'atelier', spec: 'Magie' }] },
    1,
  ],
  // C — graphies NON LITTÉRALES (cf. en-tête : chacune relue à sa ligne de Source).
  ['Cartes', { id: 'carte' }],
  ['Clefs', { id: 'clef' }],
  ['Chiffon', { id: 'chiffons' }],
  ['Tatouages', { id: 'tatouage' }],
  ['Bougies', { id: 'bougie' }],
  ['Epingles', { id: 'epingle' }],
  ['Carreaux', { id: 'carreau' }],
  ['Haches de lancer', { id: 'hache-de-lancer' }],
  ['Cure-oreille (Multiple)', { id: 'cure-oreille' }],
];

/** Les 6 textes que la migration LAISSE en `{text}` — cf. en-tête pour la raison de chacun. */
const EXCLUSIONS = [
  'Bijoux (50 CO)',
  'Bijoux (200 CO)',
  'Bijoux (500 CO)',
  "Grimoire (souvent sous forme d'os ou de dents gravés)",
  'Outils professionnels (même spécialisation que Métier)',
  'Outils professionnels (Au choix)',
];

/** Ids de `trappings.json` tels que `idDe('trapping')` les refine — le registre généré lui-même
 *  (`src/data/schemas/grammaire/ref.ts` › `idsDe`, `cibleDe('trapping') === 'trappings.json'`). */
const registre = fs.readFileSync(path.join(ROOT, 'src/data/_ids.generated.ts'), 'utf8');
const ligneRegistre = /'trappings\.json':\s*\[([^\]]*)\]/.exec(registre);
if (!ligneRegistre) {
  console.error("REGISTRE ILLISIBLE — `IDS_PAR_DATASET['trappings.json']` introuvable ; AUCUNE écriture.");
  process.exit(1);
}
const IDS_TRAPPING = new Set([...ligneRegistre[1].matchAll(/'([^']*)'/g)].map((m) => m[1]));
assert.ok(IDS_TRAPPING.size > 400, `registre des ids de trapping suspect (${IDS_TRAPPING.size} ids)`);

/** Index `libellé normalisé → ids` de `trappings.json` SEUL — le catalogue DU SITE. */
const normaliser = (s) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** SINGULIER mot à mot d'un libellé normalisé : « haches de lancer » et « hache de lancer » ont la
 *  même forme. Sans elle, un pluriel du livre n'est vu par AUCUNE des deux autres portes. */
const singulier = (s) =>
  normaliser(s)
    .split(' ')
    .map((mot) => mot.replace(/aux$/, 'al').replace(/[sx]$/, ''))
    .join(' ');
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/trappings.json'), 'utf8'));
const PAR_LABEL = new Map();
const PAR_SINGULIER = new Map();
for (const t of catalogue) {
  if (typeof t?.label !== 'string') continue;
  const k = normaliser(t.label);
  if (!PAR_LABEL.has(k)) PAR_LABEL.set(k, []);
  PAR_LABEL.get(k).push(t.id);
  const s = singulier(t.label);
  if (!PAR_SINGULIER.has(s)) PAR_SINGULIER.set(s, []);
  PAR_SINGULIER.get(s).push(t.id);
}

/** Tout id produit par la table existe au registre. */
const idsProduits = LIAISONS.flatMap(([, vers]) => (vers.choice ? vers.choice.map((b) => b.id) : [vers.id]));
const inconnus = idsProduits.filter((id) => !IDS_TRAPPING.has(id));
if (inconnus.length) {
  console.error(`ID(S) ABSENT(S) de trappings.json — AUCUNE écriture : ${[...new Set(inconnus)].join(', ')}`);
  process.exit(1);
}

/** Tête de parenthèse d'un texte (« Atelier (Magie) » → « Atelier »), sinon undefined. */
const teteDeParenthese = (texte) => {
  const m = /^(.*?)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$/.exec(texte);
  return m ? m[1] : undefined;
};

/** Un `{text}` de dotation NOMME-t-il une possession du catalogue ? (contrôle d'exhaustivité) */
const nommeUnePossession = (texte) => {
  if (EXCLUSIONS.includes(texte)) return false;
  if (PAR_LABEL.has(normaliser(texte))) return true;
  if (PAR_SINGULIER.has(singulier(texte))) return true;
  const tete = teteDeParenthese(texte);
  return tete != null && (PAR_LABEL.has(normaliser(tete)) || PAR_SINGULIER.has(singulier(tete)));
};

/** Une dotation et ses branches `choice` (récursives au schéma), jamais un `choice` d'un autre concept. */
function* branches(liste) {
  yield liste;
  for (const e of liste) if (e && typeof e === 'object' && Array.isArray(e.choice)) yield* branches(e.choice);
}

/** Parcourt les dotations d'un document : rend chaque tableau `trappings`, branches comprises. */
function* dotations(noeud) {
  if (Array.isArray(noeud)) {
    for (const e of noeud) yield* dotations(e);
    return;
  }
  if (noeud == null || typeof noeud !== 'object') return;
  for (const [k, v] of Object.entries(noeud)) {
    if (k === 'trappings' && Array.isArray(v)) {
      yield* branches(v);
      continue;
    }
    yield* dotations(v);
  }
}

const documents = [];
for (const fichier of FICHIERS) {
  const abs = path.join(ROOT, fichier);
  const brut = fs.readFileSync(abs, 'utf8');
  const data = JSON.parse(brut);
  if (JSON.stringify(data, null, 2) !== brut) {
    console.error(`FORME NON CANONIQUE — ${fichier} n'est pas un JSON indenté à 2 ; AUCUNE écriture.`);
    process.exit(1);
  }
  documents.push({ fichier, abs, brut, data });
}

/** SITES relevés AVANT toute écriture : `{ fichier, liste, index, texte, vers }`. */
const sites = [];
for (const { fichier, data } of documents)
  for (const liste of dotations(data))
    for (const [index, e] of liste.entries()) {
      if (!e || typeof e !== 'object' || typeof e.text !== 'string') continue;
      const liaison = LIAISONS.find(([texte]) => texte === e.text);
      if (liaison) sites.push({ fichier, liste, index, texte: e.text, vers: liaison[1] });
    }

if (sites.length === 0) {
  console.log('RIEN À FAIRE — aucune dotation `{text}` ne nomme une possession du catalogue.');
  process.exit(0);
}

// FORME, jamais cardinal (#1812) : chaque porteur relevé nomme un texte de la table de LIAISONS —
// c'est la table qui délimite le périmètre, pas un compte mesuré un jour d'écriture.
const TEXTES_LIES = new Set(LIAISONS.map(([t]) => t));
for (const s of sites) {
  assert.ok(TEXTES_LIES.has(s.texte), `${s.fichier} : « ${s.texte} » relevé hors table de LIAISONS`);
}

for (const { liste, index, vers } of sites) {
  const avant = liste[index];
  liste[index] = vers.choice
    ? { choice: vers.choice.map((b) => ({ ...b })) }
    : { ...vers, ...(avant.count === undefined ? {} : { count: avant.count }) };
}

// SEULES les valeurs relevées ont changé : le document d'entrée, aux SEULS sites relevés remplacés,
// est deep-equal au document écrit.
for (const { fichier, brut, data } of documents) {
  const temoin = JSON.parse(brut);
  for (const liste of dotations(temoin))
    for (const [index, e] of liste.entries()) {
      if (!e || typeof e !== 'object' || typeof e.text !== 'string') continue;
      const liaison = LIAISONS.find(([texte]) => texte === e.text);
      if (!liaison) continue;
      const vers = liaison[1];
      liste[index] = vers.choice
        ? { choice: vers.choice.map((b) => ({ ...b })) }
        : { ...vers, ...(e.count === undefined ? {} : { count: e.count }) };
    }
  assert.deepEqual(data, temoin, `${fichier} : la migration a changé autre chose que les dotations relevées`);
}

/** EXHAUSTIVITÉ sur l'état FINAL : plus aucun `{text}` de dotation ne nomme une possession. */
const restants = [];
for (const { fichier, data } of documents)
  for (const liste of dotations(data))
    for (const e of liste)
      if (e && typeof e === 'object' && typeof e.text === 'string' && nommeUnePossession(e.text))
        restants.push(`${fichier} : « ${e.text} » nomme une possession du catalogue`);
if (restants.length) {
  console.error(`ANOMALIES (${restants.length}) — AUCUNE écriture :`);
  for (const a of restants) console.error(`  - ${a}`);
  process.exit(1);
}

for (const { abs, data } of documents) fs.writeFileSync(abs, JSON.stringify(data, null, 2));
console.log(`${sites.length} dotation(s) liée(s) au catalogue :`);
for (const [texte, vers] of LIAISONS)
  console.log(`  ${sites.filter((s) => s.texte === texte).length} × « ${texte} » → ${JSON.stringify(vers)}`);
