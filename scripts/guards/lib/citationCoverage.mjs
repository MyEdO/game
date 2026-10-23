// Mécanique de mesure « citation par ENTRÉE » (#309, suite #278/#281). #278 a posé la garde de
// FORME (`sourceRefInline.mjs` — aucune réinvention de `sourceRefSchema`) ; #309 mesure la
// COUVERTURE réelle : chaque dataset de `src/data/*.json` porte-t-il `source: {book,page}` sur CHACUNE
// de ses entrées RÉELLES ? Le piège signalé au ticket : un comptage brut (tout id trouvé, y compris les ids
// imbriqués — `specs`/`ranges`/`levels`…) gonfle le dénominateur. Ici on ne compte QUE les entrées
// de PREMIER niveau (item d'un tableau racine, ou item d'un tableau de catégorie type
// `criticals.json.tete`/`mass-battle.json.powerEstimate`) — jamais les sous-objets d'une entrée.
// Module ESM pur, exécutable par `node` nu — consommé par `scripts/data/audit-citations.mjs`
// (rapport) ET par `src/data/citation-coverage-guard.test.ts` (verrou cliquet).

/** Une entrée cite sa source si `source.book` (forme `sourceRefSchema`, `src/data/schemas/grammaire/valeurs.ts:38`),
 *  le champ `maison` non vide top-level (il porte SA justification : rationale +
 *  réfs dans le texte même, ex. `proue-idole-de-stromfels` #221, EST la source de l'entrée), ou
 *  `alsoIn` porte au moins un emplacement bien formé (forme `secondarySourceRefSchema`, `src/data/schemas/grammaire/valeurs.ts:66`
 *  — #563 : l'ancre `source` reste la forme retenue, mais un `alsoIn` seul ne doit JAMAIS compter
 *  « non cité » si un futur schéma le rend co-porteur ; réfuté par `!Array.isArray(rec.source)` qui
 *  ne voit QUE l'ancre — trou permissif inverse : une entrée sans ancre valide mais avec des
 *  emplacements `alsoIn` complets serait comptée non citée à tort). Morsure : #563 Lot 1 item 1.
 *  @param {unknown} item @returns {boolean} */
export function isCitedItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const rec = /** @type {Record<string, unknown>} */ (item);
  if (rec.source && typeof rec.source === 'object' && !Array.isArray(rec.source) && typeof (/** @type {Record<string, unknown>} */ (rec.source)).book === 'string') return true;
  if (typeof rec.maison === 'string' && rec.maison.length > 0) return true;
  if (Array.isArray(rec.alsoIn) && rec.alsoIn.some((ref) => isPlainObject(ref) && typeof (/** @type {Record<string, unknown>} */ (ref)).book === 'string' && typeof (/** @type {Record<string, unknown>} */ (ref)).page === 'number')) return true;
  return false;
}

/** Une entrée « objet simple » (ni tableau, ni null) — filtre des tableaux de catégorie exploitables. */
function isPlainObject(x) {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

/** Libellé d'une entrée pour le rapport (id si présent, sinon min/max, sinon index). */
function entryLabel(item, key, idx) {
  if (isPlainObject(item)) {
    if (typeof item.id === 'string') return key ? `${key}.${item.id}` : item.id;
    if (typeof item.min === 'number') return `${key ? key + '.' : ''}${item.min}-${item.max}`;
  }
  return `${key ? key + '.' : ''}#${idx}`;
}

/**
 * Résultat de mesure d'un dataset (fichier `.json` de `src/data`).
 * @typedef {{ total: number, cited: number, missing: string[], shape: 'array'|'array-of-documents'|'map-of-lists'|'single' }} DatasetCoverage
 */

/**
 * Le tableau racine est-il une LISTE DE DOCUMENTS PORTEURS (chacun avec sa charge `entries[]`) ?
 * Forme d'un document à `options.rangee` publié en famille `entite` (`document.ts`) :
 * `miscast.json` = 5 documents, 111 rangées. Sans ce bras, le scan ne compterait que les 5 documents
 * de premier niveau et les 111 rangées — qui portent CHACUNE sa `source` — sortiraient de toute
 * garde de couverture, en silence.
 *
 * Condition SYMETRIQUE de `map-of-lists` : au moins un document porte une charge non vide d'objets,
 * ET au moins une RANGÉE cite déjà sa source (signe que ce dataset suit la convention PAR ENTRÉE —
 * un dataset-liste ordinaire dont une entrée aurait un champ `entries` de sous-objets NON cités
 * reste en forme `array`, son dénominateur inchangé).
 * Mesuré le 2026-08-28 sur les 2 racines : `miscast.json` est le SEUL dataset-liste concerné.
 * @param {unknown[]} data @returns {boolean}
 */
function estListeDeDocumentsPorteurs(data) {
  const porteurs = data.filter((d) => isPlainObject(d) && Array.isArray(d.entries) && d.entries.length > 0 && d.entries.every(isPlainObject));
  if (!porteurs.length) return false;
  return porteurs.some((d) => /** @type {unknown[]} */ (d.entries).some(isCitedItem));
}

/**
 * Détecte la FORME d'un dataset et compte ses entrées RÉELLES + leur citation.
 * - `array` : le fichier racine EST le tableau d'entrées (`skills.json`, `talents.json`…).
 * - `array-of-documents` : le fichier racine est un tableau de DOCUMENTS PORTEURS, chacun avec sa
 *   charge `entries[]` (`options.rangee` de la fabrique, `miscast.json`) — on compte les documents ET
 *   leurs rangées, chaque manquant nommé `<id-du-document>.<id-de-la-rangée>`.
 * - `map-of-lists` : objet racine dont une ou plusieurs propriétés DIRECTES sont des tableaux
 *   d'objets ET dont AU MOINS UN item de ces tableaux cite déjà sa source individuellement —
 *   signe que ce dataset suit la convention PAR ENTRÉE (`sea-weather.json.table`,
 *   `mass-battle.json.powerEstimate`…) : chaque tableau est une CATÉGORIE de la même famille de
 *   table, les entrées sont les items de CES tableaux, jamais recursées plus profond (`ops`/
 *   `ranges` imbriqués ne comptent pas).
 * - `single` : objet de config unique — cité si sa RACINE porte `source` (convention
 *   documentée `src/data/schemas/grammaire/valeurs.ts:49-54` : "à la racine quand le dataset est un objet de config unique
 *   plutôt qu'une liste" — couvre alors TOUT le fichier, y compris les tableaux/sous-tables
 *   imbriqués, ex. `montures.json`/`river-criticals.json.tables`). Sans racine citée ET sans
 *   tableau à convention par-entrée, le fichier entier est UNE entrée non citée.
 * @param {unknown} data @returns {DatasetCoverage}
 */
export function auditDataset(data) {
  if (Array.isArray(data)) {
    if (estListeDeDocumentsPorteurs(data)) {
      const missing = [];
      let total = 0;
      let cited = 0;
      data.forEach((doc, i) => {
        total++;
        const etiquette = entryLabel(doc, '', i);
        if (isCitedItem(doc)) cited++;
        else missing.push(etiquette);
        if (!isPlainObject(doc) || !Array.isArray(doc.entries)) return;
        doc.entries.forEach((row, j) => {
          total++;
          if (isCitedItem(row)) cited++;
          else missing.push(entryLabel(row, etiquette, j));
        });
      });
      return { total, cited, missing, shape: 'array-of-documents' };
    }
    const total = data.length;
    const missing = [];
    let cited = 0;
    data.forEach((item, i) => {
      if (isCitedItem(item)) cited++;
      else missing.push(entryLabel(item, '', i));
    });
    return { total, cited, missing, shape: 'array' };
  }
  if (isPlainObject(data)) {
    // La RACINE citée prime (convention documentée `src/data/schemas/grammaire/valeurs.ts:49-54`) : elle couvre tout le
    // fichier, y compris les tableaux/sous-tables imbriqués (`montures.json`, `river-criticals.json.
    // tables`…) — même quand une valeur scalaire annexe (`crew-morale.json.base`) est la seule
    // réellement visée par cette réf précise, le fichier est considéré couvert.
    if (isCitedItem(data)) return { total: 1, cited: 1, missing: [], shape: 'single' };
    const categoryProps = Object.entries(data).filter(
      ([, v]) => Array.isArray(v) && v.length > 0 && v.every(isPlainObject),
    );
    if (categoryProps.length > 0) {
      const missing = [];
      let total = 0;
      let cited = 0;
      for (const [key, arr] of categoryProps) {
        arr.forEach((item, i) => {
          total++;
          if (isCitedItem(item)) cited++;
          else missing.push(entryLabel(item, key, i));
        });
      }
      return { total, cited, missing, shape: 'map-of-lists' };
    }
    return { total: 1, cited: 0, missing: ['(racine)'], shape: 'single' };
  }
  return { total: 0, cited: 0, missing: [], shape: 'single' };
}

/**
 * Liste d'EXEMPTION nominative — vocabulaires app-internes légitimement sans livre (aucune
 * mécanique CHIFFRÉE tirée du RAW, ou note de provenance libre déjà documentée comme survivance
 * unique). Chaque entrée porte SA raison ; jamais un motif générique. Établie depuis la mesure
 * réelle (#309, phase 1) — toute extension future nomme le fichier + justifie.
 *
 * Cette liste s'AUTO-PURGE (#1467 L1b V-Src) : un dataset intégralement cité n'a plus besoin d'être
 * exempté, et son entrée devient un mensonge dormant. `src/data/citation-coverage-guard.test.ts`
 * rougit sur toute entrée dont `auditDataset` rend `cited === total` (> 0). Trois sont mortes à ce
 * lot : `axes.json` (9/9, migré `source:'maison'` → `maison` par 2026-08-27-l1b-1c), et deux
 * PRÉEXISTANTES que personne ne relisait — les tables d'Aux Armes et `characteristics.json` (19/19,
 * curé depuis). Ces tables comptent 80/80 par entrée depuis #1467 L1b V-FLIP-CONFIG : leur note libre
 * `_source`, qui à elle seule les rendait « 1/1 cité », est morte avec le dernier porteur de
 * `freeSourceNoteSchema` — le bras `_source` d'`isCitedItem` avec elle. Elles vivent depuis #1657 B2a
 * dans `criticals.json`, mesurées par le bras `array-of-documents` (168/168 : 8 documents + 160 rangées).
 * @type {Record<string, string>}
 */
export const EXEMPT_DATASETS = {
  'books.json': 'catalogue des LIVRES eux-mêmes — pas de "source" au sens où un livre se cite lui-même.',
  'actions.json': "registre de ROUTAGE des actions de combat (id → icône, surface, gate/candidates/run) : aucune table CHIFFRÉE, la règle vit dans la fiche pointée par `rule` (référence `{ id, type }` : règle/talent/état/qualité/compétence/caractéristique) qui porte SA citation. `source` n'y est posée que sur les entrées dont le COÛT est adossé à un verbatim (LDB 13 l.106, 15 l.35-49, 14 « Viser »…).",
  'decorPalette.json': 'palette de couleurs de RENDU (hex), pas une donnée RAW.',
  'teintesJeu.json': "teintes de RENDU du terrain (surbrillances tactiques et identité d'unité, hex), pas une donnée RAW.",
  'ambiance.json': 'config de rendu (éclairage iso/POV), pas une donnée RAW.',
  'details.json': "`ageBase`/`ageRoll`/`heightBase`/`heightRoll` reprennent le verbatim direct de LDB `05` l.705-728 (folio 39) pour les 4 seules colonnes que le canon imprime (humain/nain/elfe/halfling) ; `gnome`/`ogre` y sont posés SANS source trouvée, et `texts` est de la prose d'application — aucune de ces strates n'est une table RAW autonome à citer par entrée.",
  'localisation.json': 'table de dé inversé (mapping résultat→zone de touche) — vocabulaire structurel du moteur, pas une table RAW à citer en tant que telle (les zones sont LDB, déjà couvertes par `hitLocationSchema`).',
  'names.json': "liste de PRÉNOMS d'authoring par race — pas une mécanique mesurable, aucune règle à sourcer.",
  'sizes.json': "3 tables, 3 provenances : `rangedMod` = LDB folio 162 (`14 - _GoBack.md` l.118-131), `shipboardEnc` = MDG folio 92 (`12` l.25-33), `footprintSide` = MAISON (aucune barre chiffrée au canon, cf. `src/engine/size.ts:40-49`). Aucune des trois n'est une entrée narrative sourçable individuellement : les deux tables RAW portent leur réf à leur foyer (`src/data/schemas/defs/sizes.ts:2-4`), la troisième n'a pas de folio à citer.",
  'speciesRace.json': "table de résolution race→défauts d'authoring (`default`/`rules`), pas une donnée RAW.",
  // (`reglesOptionnelles.json` n'est PAS exempté : sa dette de folios est un cliquet DÉCROISSANT,
  //  `BASELINES` de `src/data/citation-coverage-guard.test.ts` — E8 du programme #1318.)
  'renduMonte.json': "réglage MAISON du RENDU monté (id du set d'équipement servi par défaut à une monture portée) — inférence d'atelier #1128, pas une table RAW : les Possessions de carrière donnent la monture « avec selle et harnais » (LDB 08 l.557, ADE I 07 l.48), aucune règle n'attache la sellerie au fait d'être monté.",
  'groups.json': "vocabulaire app-interne de GROUPES de créatures (tags de regroupement/rencontre), pas une notion RAW nommée.",
  'props.json': "catalogue de props de décor (rendu iso), pas une donnée RAW.",
  'materials.json':
    'catalogue des MATIÈRES du monde (décor volumique, toiture, relief — couleur, réponse à la lumière, recettes de détail de surface) : apparence de rendu, aucune règle à citer.',
  'apparences.json':
    "catalogue des APPARENCES d'objet (formes et leurs variantes : id, libellé, étiquettes de naissance) : configuration de rendu, aucun folio n'imprime à quoi ressemble un objet.",
  'lightLevels.json': "niveaux de lumière (rendu iso/vision), vocabulaire moteur — pas une table RAW à citer par entrée (la RÈGLE de vision est ailleurs, sourcée).",
  'lightTones.json': "tons de lumière (#1245 : couleur, part d'intensité, vacillement d'une source ponctuelle) — APPARENCE de rendu, aucune règle à citer : le RAYON, la seule grandeur RAW d'une source (LDB 74), vit sur la source elle-même.",
  'raceAppearance.json': "presets d'apparence (rendu iso) par race — esthétique, pas une règle RAW.",
  'structureAppearance.json': "presets d'apparence de structure (rendu iso), pas une donnée RAW.",
  'breath-types.json': "vocabulaire de catégorisation (id+label uniquement, ex. « feu »/« poison ») — aucune valeur mécanique propre à sourcer, la RÈGLE (souffle de créature) est ailleurs.",
  'damage-types.json': "vocabulaire de catégorisation (id+label uniquement) — aucune valeur mécanique propre à sourcer.",
  'qualityTypes.json': "vocabulaire de catégorisation des Qualités/Défauts (id+label, Atout/Défaut) — aucune valeur mécanique propre.",
  'qualitySubtypes.json': "vocabulaire de catégorisation des Qualités/Défauts (id+label, Arme/Armure/Objet) — aucune valeur mécanique propre.",
  'pregens.json': "personnages PRÉ-GÉNÉRÉS d'authoring (fiches jouables), contenu app-inventé — pas une règle RAW à sourcer.",
  'calendarPhases.json': "les 7 phases de la journée (Aube→Nuit) sont un DÉCOUPAGE app-interne (minute de départ + icône, moteur de lumière/vision) — introuvable comme table RAW nommée dans le Calendrier Impérial (EDO Annexe 3, folio 149-150 : seuls mois/jours/jours intercalaires y sont RAW, #309 phase 3) ; aucune valeur mécanique à sourcer par entrée.",
  'primitives.manifest.json': "manifeste TOOLING (#298) des primitives partagées du code (label/fichier/concept/verrou) — vocabulaire app-interne, aucune mécanique RAW à sourcer.",
  'systemes.manifest.json': "manifeste TOOLING (#298) éditorial des systèmes implémentés (label/modules/état/ticket) — vocabulaire app-interne, aucune mécanique RAW à sourcer.",
  'lieux-services.json': "vocabulaire des SERVICES de lieu (#343 — auberge/temple/forgeron/guilde) : id/label/icône de routage d'écran (hub de lieu), aucune valeur mécanique propre à sourcer (port/marché portent leur propre schéma sourcé).",
  'raw.manifest.json': "manifeste TOOLING (#487) éditorial du champ Implémente de l'Atlas RAW (id/ticket/bloque, généré par scripts/raw/build-implemente.mjs) — vocabulaire app-interne, aucune mécanique RAW à sourcer.",
  'merchants.json': "archétypes de MARCHAND (#2) — config app-owned (taux de rachat/Marchandage/agglo par défaut/familles vendues), pas une table RAW à folio unique par entrée : les VALEURS RAW citées (½/¼ de revente, majoration, Disponibilité) vivent dans `engine/disponibilite.ts` (LDB 59) et `bargain.ts`, déjà sourcées à leur foyer ; le `boniment` est une réplique d'auteur, sans RAW à sourcer.",
  'merchantFamilies.json': "familles de PRÉSENTATION du stock marchand (onglets/colonnes de `ui/MerchantPanel.tsx`) — vocabulaire de mise en page app-interne, aucune valeur mécanique RAW à sourcer par entrée.",
  'donnees.manifest.json': "manifeste TOOLING (#903) éditorial de l'atlas des données (rangement par rubrique/description/homonymes de src/data/*.json, généré en docs/donnees.md par scripts/docs/build-donnees.mjs) — vocabulaire app-interne, aucune mécanique RAW à sourcer.",
  'progression-schemas.derived.json': "artefact GÉNÉRÉ (#905) par scripts/data/gen-progression-schemas.py : ce n'est pas une donnée CURÉE à citer, c'est la LECTURE du PDF elle-même — chaque bande porte déjà, MESURÉS sur la page, son `book`, sa `page` (le folio imprimé), sa page PDF et son ordonnée, soit l'ancrage même que `source: {book, page}` demande à une donnée authorée. La citer par entrée reviendrait à recopier à la main ce que le générateur relève.",
};
