// Corpus PARTAGÉ de détection de consommateurs d'ENTITÉS de catalogue — consommé par
// `scripts/docs/build-entity-orphans.mjs` (générateur du rapport) ET `src/data/entity-orphans.test.ts`
// (garde cliquet). Généralise le patron mesuré dans `tableConsumerStock.mjs`/`tables.test.ts` (#734)
// à tout catalogue `src/data/*.json` adressé par `id` (le même ensemble que `id-collisions.test.ts`
// nomme « catégories » : `traits`, `talents`, `qualities`, `maneuvers`, `skills`, `props`, `vehicles`,
// `creatures` — cf. en-tête de `scripts/docs/build-entity-orphans.mjs` pour le périmètre RETENU/ÉCARTÉ).
//
// SÉMANTIQUE DE « ORPHELINE » (écrite ICI parce que c'est elle qui décide ce qui compte comme
// consommateur, #1553 L3) : une entité est ORPHELINE quand AUCUN CHEMIN DE JEU ne la convoque — ni
// un document de scène, ni une autre donnée, ni le code de PRODUCTION. Ce qui n'est PAS un chemin de
// jeu : l'ATELIER d'authoring. La palette de l'éditeur de scène énumère des candidats à POSER À LA
// MAIN (`ui/editor/Editor.tsx:168`, `creatures.filter((c) => typeof c.char.B === 'number')` — mesuré
// 487 des 493 entrées de `creatures.json`, 2026-09) : la compter rendrait tout le catalogue
// « atteignable » et viderait l'instrument (une entité qu'aucune scène ne pose reste une mécanique
// curée sans jeu). Elle est aujourd'hui rejetée fail-closed par la grammaire MODE 2 (`typeof`, champ
// à deux niveaux, aucun `.map((c) => c.id)` enchaîné) — ce rejet est un ACCIDENT de grammaire, PAS la
// raison. Toute extension future de MODE 2 qui la ferait entrer dans la grammaire doit l'EXCLURE
// explicitement au titre de cette sémantique, jamais la « corriger » en consommateur.
//
// DEUX modes de consommation, tous deux mesurés indépendamment puis UNIS par le générateur/la garde :
//
// MODE 1 — citation littérale (`isConsumed`) : l'id de l'entité apparaît comme jeton de chaîne CITÉ
// complet (`"<id>"` ou `'<id>'`) dans (a) un AUTRE `src/data/*.json` (catalogue cible ou non — un
// maneuver peut citer un autre maneuver, un trapping peut citer une qualité…), (b) le code de prod
// `src/**/*.ts(x)` hors tests ET hors fichiers GÉNÉRÉS (`isGeneratedFile`, cf. plus bas), COMMENTAIRES
// retirés, (c) les documents de PROJET DE SCÈNE `src/scenes/*/*-projet.json` (`sceneConsumerCorpus`,
// 2026-09 — le CONTENU JOUÉ cite des entités par id : `entities[].ref`, `statblock.traits[].id`,
// `flow.test.skill.id`, `effect.trappingId`… ; frontière « déclaré SIEN » vs « référencé » et bruit
// mesuré : cf. le JSDoc de `stripSceneOwnIdentities`). Jamais une sous-chaîne nue (prose, id plus
// long, mention non citée en commentaire).
//
// MODE 2 — sélection dynamique par PRÉDICAT DE CHAMP (`computeFieldPredicateConsumers`) : un
// consommateur qui ne cite JAMAIS l'id, mais SÉLECTIONNE le catalogue par ses champs (ex.
// `qualities.filter((q) => q.polarite === 'atout' && q.subType === 'objet')` bâtit le pool d'un picker —
// toute entité qui satisfait le prédicat est atteinte, sans que son id apparaisse en toutes lettres
// nulle part). Mesuré : `qualities:laid` (défaut d'Objet, LDB 60) est exactement ce cas — surfacé au
// picker d'Artisanat (`ui/InterludeScreen.tsx:52-53`, chaîne `.filter(...).map((q) => q.id)`) SANS
// jamais être cité littéralement. Restreint, par construction FAIL-CLOSED, à
// `<catalogueTopLevel>.filter((param) => <prédicat>)` (jamais `.find`/`.some` — qui ne garantissent
// pas que TOUTE entrée matchée soit réellement atteinte, une seule étant retenue par appel) où
// `<prédicat>` est soit une comparaison d'ÉGALITÉ sur littéral (`param.champ === 'valeur'`), soit une
// VÉRACITÉ de champ (`param.champ`) ou sa NÉGATION (`!param.champ`) — un seul niveau de champ à chaque
// fois — ces trois formes de terme étant COMBINABLES entre elles par `&&`/`||` (jamais les deux dans le
// même prédicat — ambiguïté de précédence non résolue). Mesuré : `vehicles.filter((v) => v.purchase &&
// !v.ship)` (`state/merchantFlow.ts:130`, catalogue de vente du Maquignon, `unitKinds:
// ['vehicule-terrestre']` dans `merchants.json`) combine véracité et négation, chaîne bien à
// `.map((v) => v.id)` (`unitIdsOfKind`) : c'est ce cas qui a fait étendre la grammaire (2026-07-27).
// Toute parenthèse de groupement, tout chaînage optionnel (`x?.y`), tout niveau de champ multiple
// (`x.a.b`), tout appel de fonction reste HORS grammaire — rejeté fail-closed.
//
// RÈGLE SUPPLÉMENTAIRE (durcissement mesuré) — un filtre n'est CONSOMMATEUR que si son résultat est
// ensuite EXPLOITÉ PAR ID : la chaîne doit se terminer par `.map((param) => param.id)` (chaîné
// directement ou après d'autres `.filter(...)` intermédiaires). Fondement (doctrine du dépôt, CLAUDE.md
// « on ne manipule que des IDs ; le `label` est de l'AFFICHAGE ») : un filtre qui sélectionne mais ne
// mène nulle part par id (`.map((q) => q.label)`, ou pas de `.map` du tout) ne prouve AUCUN chemin
// d'accès à l'entité — SÉLECTIONNER n'est pas la même chose que MENER À. Mesuré : `qualities.filter((q)
// => q.polarite === 'atout')` dans `falseQualities()` (`src/state/interludeFlow.ts:1069`) sélectionne bien
// par champ, mais nourrit une liste de RUMEURS FAUSSES (Particularités que le personnage croit à tort
// déceler après un jet raté — ADE II) affichées par LABEL, jamais appliquées : la qualité sélectionnée
// n'est précisément PAS atteinte. Rejeté par cette règle générale (aucune exception codée sur ce
// fichier). Tout filtre hors grammaire OU dont la chaîne ne mène pas à `.id` est IGNORÉ (l'entrée reste
// orpheline si aucun autre consommateur ne la couvre) et remonté par l'appelant.
//
// Amélioration sur `tableConsumerStock.mjs` : au lieu d'une regex fragile sur l'ORDRE des clés
// (`"id": "…", (?="label")`), la déclaration de l'entité dans SON PROPRE catalogue est retirée par
// PARSE JSON (suppression de la seule clé top-level `id` avant re-sérialisation) — robuste à
// n'importe quel ordre/forme de champs, généralisable aux 8 catalogues sans regex par fichier.
import { readFileSync } from 'node:fs';
import { listerArbre, listerDossier } from './lister.mjs';
import { join } from 'node:path';
import { estFichierVitest } from './fichierVitest.mjs';

/** Catalogues `src/data/*.json` adressés par `id`, retenus pour la mesure d'orphelines — MÊME
 *  ensemble que `CATEGORIES` de `src/data/id-collisions.test.ts`, moins `spells`/`trappings`
 *  (écartés, cf. en-tête de `build-entity-orphans.mjs`). */
export const CATEGORY_FILES = {
  traits: 'traits.json',
  talents: 'talents.json',
  qualities: 'qualities.json',
  maneuvers: 'maneuvers.json',
  skills: 'skills.json',
  props: 'props.json',
  vehicles: 'vehicles.json',
  // Au périmètre depuis #1553 L3. Le chemin de JEU d'une créature est la CITATION de son id (un
  // document de scène — `entities[].ref`, `encounters[]` —, une autre donnée : `montures.json`,
  // `groups.json`, `careerLevels.json`…) ou la sélection MODE 2 `creatures.filter((c) => c.purchase)
  // .map((c) => c.id)` (`state/merchantFlow.ts:132`, bétail du Maquignon, 14 entrées). La palette de
  // l'éditeur n'en est PAS un — cf. SÉMANTIQUE en en-tête.
  creatures: 'creatures.json',
};

/** Les 2 catalogues ÉCARTÉS du périmètre (cause d'exclusion : en-tête de
 *  `build-entity-orphans.mjs`). Déclarés ici pour que le rapport DÉRIVE leurs comptes du même scan
 *  au lieu de les figer en dur dans sa sortie ; aucune garde ne les mesure. */
export const EXCLUDED_CATEGORY_FILES = {
  spells: 'spells.json',
  trappings: 'trappings.json',
};

/**
 * Les ORPHELINES MESURÉES, en SITES `{ file, ref }` : `file` = le dataset où l'entité est déclarée
 * (c'est lui que la porte de plage voit, et lui que l'auteur doit ouvrir), `ref` = l'id de l'entité.
 * UN assemblage de la mesure pour ses consommateurs — la garde `src/data/entity-orphans.test.ts` et
 * le régénérateur `scripts/data/regen-entity-orphan-stock.mts` : deux lectures divergentes de
 * « orpheline » laisseraient l'une écrire ce que l'autre refuse.
 * @param {string} dataDir @param {string} srcDir
 * @returns {{ file: string, ref: string }[]} dans l'ordre des catégories puis des ids du dataset.
 */
export function orphelinesMesurees(dataDir, srcDir) {
  const estConsommee = predicatDeConsommation(dataDir, srcDir);
  const ids = loadCategoryIds(dataDir);
  const sites = [];
  for (const [cat, catIds] of Object.entries(ids)) {
    for (const id of catIds) {
      if (estConsommee(cat, id)) continue;
      sites.push({ file: `src/data/${CATEGORY_FILES[cat]}`, ref: id });
    }
  }
  return sites;
}

/**
 * LE prédicat « cette entité est-elle consommée ? » — définition UNIQUE, les trois canaux réunis :
 * MODE 1 (id cité en toutes lettres), MODE 2 (sélection par prédicat de champ) et les entités MÉTA.
 * Le corpus et les consommateurs par prédicat sont scannés UNE fois, à la construction.
 * Consommé par `orphelinesMesurees` (garde + régénérateur) ET par le rapport
 * `scripts/docs/build-entity-orphans.mjs` : deux recopies du même test laisseraient le doc et le
 * stock diverger sur ce qu'est une orpheline.
 * @param {string} dataDir @param {string} srcDir
 * @returns {(cat: string, id: string) => boolean}
 */
export function predicatDeConsommation(dataDir, srcDir) {
  const corpus = buildConsumerCorpus(dataDir, srcDir);
  const { consumed } = computeFieldPredicateConsumers(dataDir, srcDir);
  return (cat, id) =>
    isConsumed(corpus, id) || !!consumed.get(cat)?.has(id) || META_CATALOG_ENTRIES.has(`${cat}:${id}`);
}

/** `{ [category]: string[] }` — tous les ids de chaque catalogue de `files` (retenus par défaut). */
export function loadCategoryIds(dataDir, files = CATEGORY_FILES) {
  const out = {};
  for (const [cat, file] of Object.entries(files)) {
    const arr = JSON.parse(readFileSync(join(dataDir, file), 'utf8'));
    out[cat] = arr.map((e) => e.id);
  }
  return out;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Un fichier GÉNÉRÉ est un MIROIR de la donnée, pas un USAGE — un registre exhaustif cite
 *  structurellement chaque id de son catalogue source, ce qui viderait la garde si on le comptait
 *  comme consommateur (mesuré : `engine/qualities/ids.generated.ts` cite LES 59 ids de
 *  `qualities.json`, `audio/_registry.generated.ts` et `data/schemas/_registry.generated.ts` de même
 *  pour leurs registres). Détection par LES DEUX conventions déjà en usage dans `src/**` (mesurées
 *  identiques sur les 30 fichiers générés du dépôt, 2026-07) : suffixe `*.generated.ts(x)` ET/OU
 *  en-tête « GÉNÉRÉ … NE PAS ÉDITER À LA MAIN » dans les 5 premières lignes — jamais une liste de
 *  chemins en dur. Exclu du corpus MODE 1 (`buildConsumerCorpus`) ET du scan MODE 2
 *  (`computeFieldPredicateConsumers`) : un générateur qui écrirait un `.filter(...).map(id)` mécanique
 *  serait le même mal. */
function isGeneratedFile(path, text) {
  if (/\.generated\.tsx?$/.test(path)) return true;
  const head = text.split('\n', 5).join('\n');
  return /GÉNÉRÉ[\s\S]{0,120}?NE PAS ÉDITER/i.test(head);
}

/** Fichiers `.ts(x)` de PRODUCTION sous `srcDir`, chemins RELATIFS à `srcDir`, en ORDRE TOTAL :
 *  l'ordre décide de celui des sites `recognized`, donc du `.md` rendu. */
function fichiersDeProduction(srcDir) {
  return listerArbre(srcDir, { filtre: (rel) => /\.(ts|tsx)$/.test(rel) && !estFichierVitest(rel) });
}

/** Documents de PROJET de scène (`src/scenes/<projet>/<projet>-projet.json`), découverts par
 *  STRUCTURE (tout sous-dossier de `src/scenes`, tout fichier `*-projet.json`) — jamais une liste de
 *  chemins en dur : une liste à tenir manque le prochain projet en silence, fail-OPEN. */
function sceneProjectFiles(srcDir) {
  const dir = join(srcDir, 'scenes');
  return listerArbre(dir, {
    descendre: (rel) => !rel.includes('/'),
    filtre: (rel) => rel.includes('/') && rel.endsWith('-projet.json'),
  }).map((rel) => join(dir, rel));
}

/** FRONTIÈRE « déclaré SIEN » vs « référencé » d'un document de scène — symétrique du
 *  `{ ...e, id: undefined }` des catalogues : un objet que le document CRÉE porte son identité au
 *  champ `id`, qui n'est pas une citation. Retirés : l'`id` et le `label` de la RACINE (le projet
 *  se nomme lui-même), l'`id` de chaque `scenes[]`, et l'`id` de chaque élément des tableaux de
 *  DÉCLARATION d'une scène (`entities`, `architecture`, `dialogues`, `triggers`, `encounters` — les
 *  cinq TABLEAUX ; `entryPoints` en est absent parce qu'il est un RECORD dont les identités sont les
 *  CLÉS, que le scan par VALEURS ne collecte jamais). Un de ces cinq champs qui cesserait d'être un
 *  tableau fait CRASHER la garde (fail-loud) plutôt que passer le retrait en silence (fail-open).
 *  Tout le RESTE est référence potentielle — au premier chef `entities[].ref`, mais
 *  aussi `statblock.traits[].id`/`skills[].id`/`ammo[].qualities[].id`, `flow.test.skill.id`,
 *  `effect.trappingId`/`vehicleId`/`spell`, `weapon`… : ces `id`-là désignent une entrée de
 *  catalogue, ils ne la déclarent pas. Mesuré (2026-09) : sans ce retrait, `entities[].id` ferait
 *  consommer `vehicles:cogue`/`vehicles:chaland`/`creatures:medecin` et `architecture[].id`
 *  `vehicles:diligence` PAR LEUR PROPRE POSE. */
function stripSceneOwnIdentities(doc) {
  const clone = structuredClone(doc);
  delete clone.id;
  delete clone.label;
  for (const scene of clone.scenes ?? []) {
    if (!scene || typeof scene !== 'object') continue;
    delete scene.id;
    for (const key of ['entities', 'architecture', 'dialogues', 'triggers', 'encounters']) {
      for (const decl of scene[key] ?? []) if (decl && typeof decl === 'object') delete decl.id;
    }
  }
  return clone;
}

function collectStringValues(node, out) {
  if (typeof node === 'string') { out.add(node); return; }
  if (Array.isArray(node)) { for (const v of node) collectStringValues(v, out); return; }
  if (node && typeof node === 'object') for (const v of Object.values(node)) collectStringValues(v, out);
}

/** Fragment de corpus des documents de scène : les VALEURS de chaîne (jamais les CLÉS — mesuré :
 *  les clés `cloture`/`source`/`ouverture` du schéma de scène feraient consommer trois entrées de
 *  catalogue homonymes), parsées puis re-sérialisées une à une en jeton cité, dédupliquées. Le scan
 *  reste celui de `isConsumed` (valeur entière citée) : pas d'index de tokens par regex de chaînes,
 *  mesuré FAUX sur ce corpus (les apostrophes de la prose FR désynchronisent le lexeur). */
export function sceneConsumerCorpus(srcDir) {
  const values = new Set();
  for (const f of sceneProjectFiles(srcDir)) {
    collectStringValues(stripSceneOwnIdentities(JSON.parse(readFileSync(f, 'utf8'))), values);
  }
  return [...values].map((v) => JSON.stringify(v)).join('\n');
}

/** Corpus texte de tous les consommateurs possibles : `src/data/*.json` (catalogues cibles PRIVÉS de
 *  la déclaration `id` de LEURS PROPRES entités, sinon chaque entité « se consomme elle-même » via
 *  sa propre ligne JSON) + `src/**\/*.ts(x)` de PRODUCTION (hors tests, commentaires retirés) + les
 *  documents de PROJET DE SCÈNE (`sceneConsumerCorpus`, cf. sa frontière juste au-dessus).
 *  `files` = les catalogues ainsi privés de leur propre `id` (les retenus par défaut ; le rapport
 *  passe `EXCLUDED_CATEGORY_FILES` pour dériver les comptes bruts des écartés). */
export function buildConsumerCorpus(dataDir, srcDir, files = CATEGORY_FILES) {
  let corpus = '';
  const dataFiles = listerDossier(dataDir).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  const targetFiles = new Set(Object.values(files));
  for (const f of dataFiles) {
    const raw = readFileSync(join(dataDir, f), 'utf8');
    if (targetFiles.has(f)) {
      const arr = JSON.parse(raw);
      corpus += arr.map((e) => JSON.stringify({ ...e, id: undefined })).join('\n');
    } else {
      corpus += raw;
    }
  }
  for (const rel of fichiersDeProduction(srcDir)) {
    const p = join(srcDir, rel);
    const src = readFileSync(p, 'utf8');
    if (!isGeneratedFile(p, src)) corpus += stripComments(src);
  }
  corpus += `\n${sceneConsumerCorpus(srcDir)}`;
  return corpus;
}

/** Un id compte comme consommé s'il apparaît comme jeton de chaîne CITÉ complet. */
export const isConsumed = (corpus, id) => corpus.includes(`"${id}"`) || corpus.includes(`'${id}'`);

/** Entités de catalogue MÉTA — une ligne de TABLE RAW transcrite en entrée de catalogue pour son
 *  vocabulaire de tirage (ex. `talents:talent-aleatoire`, LDB 10 p.132 : motif « N Talent(s)
 *  aléatoire(s) » consommé par `resolveSpeciesTalents`, `src/engine/character.ts`), jamais une entité POSSÉDABLE. Source UNIQUE de ce fait
 *  structurel, consommée par LES DEUX gardes qui le traitaient jusqu'ici par deux déclarations
 *  séparées (`src/data/entity-orphans.test.ts` — via `entityOrphanStock.mjs` — ET
 *  `src/data/obtainability-guard.test.ts`) : ni l'une ni l'autre ne re-déclare le fait chez elle.
 *  Clé = `catégorie:id`, même convention que `entityOrphanStock.mjs`. Mesuré exhaustivement sur les
 *  7 catalogues d'alors (grep `aleatoire|au-choix|table-des|choix-libre` sur
 *  traits/talents/qualities/maneuvers/skills/props/vehicles, 2026-07) : SEULE `talents:talent-aleatoire`
 *  qualifie. Re-mesuré sur `creatures` à son entrée au périmètre (#1553 L3, 2026-09) : AUCUNE entrée
 *  MÉTA — une créature est toujours une entité posée, jamais un jeton de tirage.
 * @type {ReadonlySet<string>} */
export const META_CATALOG_ENTRIES = new Set(['talents:talent-aleatoire']);

/** Un seul niveau de champ par terme — égalité stricte sur littéral string (`param.champ === 'v'`),
 *  véracité (`param.champ`) ou négation (`!param.champ`) — cf. grammaire MODE 2 en en-tête. Retourne
 *  `null` (rejet fail-closed) si le prédicat sort de cette grammaire (parenthèses, chaînage optionnel,
 *  champ multi-niveaux, appel de fonction, mélange `&&`/`||`…). */
function parseFieldPredicate(param, predicateRaw) {
  const predicate = predicateRaw.trim();
  if (predicate.includes('(') || predicate.includes(')')) return null;
  const hasAnd = predicate.includes('&&');
  const hasOr = predicate.includes('||');
  if (hasAnd && hasOr) return null;
  const op = hasOr ? '||' : '&&';
  const parts = hasAnd || hasOr ? predicate.split(op).map((s) => s.trim()) : [predicate];
  const paramEsc = param.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const eqRe = new RegExp(`^${paramEsc}\\.([a-zA-Z_$][\\w$]*)\\s*===\\s*(['"])((?:(?!\\2).)*)\\2$`);
  const truthyRe = new RegExp(`^${paramEsc}\\.([a-zA-Z_$][\\w$]*)$`);
  const falsyRe = new RegExp(`^!${paramEsc}\\.([a-zA-Z_$][\\w$]*)$`);
  const terms = [];
  for (const part of parts) {
    let m = part.match(eqRe);
    if (m) { terms.push({ kind: 'eq', field: m[1], value: m[3] }); continue; }
    m = part.match(truthyRe);
    if (m) { terms.push({ kind: 'truthy', field: m[1] }); continue; }
    m = part.match(falsyRe);
    if (m) { terms.push({ kind: 'falsy', field: m[1] }); continue; }
    return null;
  }
  return { op, terms };
}

function evalFieldPredicate(parsed, entry) {
  const test = (t) => (t.kind === 'eq' ? entry[t.field] === t.value : t.kind === 'truthy' ? !!entry[t.field] : !entry[t.field]);
  return parsed.op === '||' ? parsed.terms.some(test) : parsed.terms.every(test);
}

/** RÈGLE SUPPLÉMENTAIRE (cf. en-tête) — depuis la position `pos` juste après la parenthèse fermante
 *  d'un `.filter(...)`, vérifie que la chaîne MÈNE PAR ID : elle peut enchaîner d'autres `.filter(...)`
 *  (peu importe leur prédicat, déjà couverts par cette même détection ou non), mais doit se terminer
 *  par `.map((param) => param.id)` — jamais `.label` ni aucun autre champ, jamais l'absence de `.map`. */
function chainLeadsToId(text, pos) {
  const skipWs = () => {
    let moved = true;
    while (moved) {
      moved = false;
      while (pos < text.length && /\s/.test(text[pos])) { pos++; moved = true; }
      if (text.startsWith('//', pos)) { while (pos < text.length && text[pos] !== '\n') pos++; moved = true; }
      else if (text.startsWith('/*', pos)) { const end = text.indexOf('*/', pos + 2); pos = end === -1 ? text.length : end + 2; moved = true; }
    }
  };
  skipWs();
  while (text.startsWith('.filter(', pos)) {
    pos += '.filter('.length;
    let depth = 1;
    while (pos < text.length && depth > 0) {
      if (text[pos] === '(') depth++;
      else if (text[pos] === ')') depth--;
      pos++;
    }
    skipWs();
  }
  if (!text.startsWith('.map(', pos)) return false;
  const mapStart = pos + '.map('.length;
  let depth = 1;
  let j = mapStart;
  for (; j < text.length && depth > 0; j++) {
    if (text[j] === '(') depth++;
    else if (text[j] === ')') depth--;
  }
  const mapInner = text.slice(mapStart, j - 1);
  const mapArrowM = mapInner.match(/^\(?\s*([a-zA-Z_$][\w$]*)\s*(?::[^,)=]+)?\)?\s*=>\s*([\s\S]*)$/);
  if (!mapArrowM) return false;
  const [, mapParam, mapBodyRaw] = mapArrowM;
  const mapBody = mapBodyRaw.trim().replace(/^\((.*)\)$/, '$1').trim();
  return mapBody === `${mapParam}.id`;
}

/** MODE 2 (cf. en-tête) — scanne `src/**\/*.ts(x)` de PRODUCTION (hors tests) pour les appels
 *  `<catalogueTopLevel>.filter((param) => <prédicat>)` sur l'un des 8 catalogues retenus. Retourne
 *  `{ consumed: Map<catégorie, Set<id>>, recognized: [{category, loc, predicate, matched}],
 *  skipped: [{category, loc, raw, reason}] }` — `skipped` liste tout filtre rencontré mais REJETÉ
 *  par la grammaire (fail-closed, JAMAIS traité comme consommateur). */
export function computeFieldPredicateConsumers(dataDir, srcDir) {
  const catalogData = {};
  for (const [cat, file] of Object.entries(CATEGORY_FILES)) {
    catalogData[cat] = JSON.parse(readFileSync(join(dataDir, file), 'utf8'));
  }
  const consumed = new Map(Object.keys(CATEGORY_FILES).map((cat) => [cat, new Set()]));
  const recognized = [];
  const skipped = [];

  const scanFile = (p, text) => {
    for (const cat of Object.keys(CATEGORY_FILES)) {
      const re = new RegExp(`(?<![.\\w$])${cat}\\s*\\.filter\\(`, 'g');
      let m;
      while ((m = re.exec(text))) {
        const start = m.index + m[0].length;
        let depth = 1;
        let i = start;
        for (; i < text.length && depth > 0; i++) {
          if (text[i] === '(') depth++;
          else if (text[i] === ')') depth--;
        }
        const inner = text.slice(start, i - 1);
        const line = text.slice(0, m.index).split('\n').length;
        const loc = `${p}:${line}`;
        re.lastIndex = i;
        const arrowM = inner.match(/^\(?\s*([a-zA-Z_$][\w$]*)\s*(?::[^,)=]+)?\)?\s*=>\s*([\s\S]*)$/);
        if (!arrowM) { skipped.push({ category: cat, loc, raw: inner.trim(), reason: 'forme non reconnue (pas une flèche à un seul paramètre)' }); continue; }
        const [, param, predicateRaw] = arrowM;
        const parsed = parseFieldPredicate(param, predicateRaw);
        if (!parsed) { skipped.push({ category: cat, loc, raw: predicateRaw.trim(), reason: 'prédicat hors grammaire MODE 2 (pas une égalité littérale simple)' }); continue; }
        if (!chainLeadsToId(text, i)) { skipped.push({ category: cat, loc, raw: predicateRaw.trim(), reason: "résultat non exploité par id (pas de `.map((param) => param.id)` enchaîné — sélectionner n'est pas mener à l'entité)" }); continue; }
        const ids = catalogData[cat].filter((entry) => evalFieldPredicate(parsed, entry)).map((entry) => entry.id);
        for (const id of ids) consumed.get(cat).add(id);
        recognized.push({ category: cat, loc, predicate: predicateRaw.trim(), matched: ids });
      }
    }
  };

  for (const rel of fichiersDeProduction(srcDir)) {
    const p = join(srcDir, rel);
    const src = readFileSync(p, 'utf8');
    if (!isGeneratedFile(p, src)) scanFile(p, src);
  }
  return { consumed, recognized, skipped };
}
