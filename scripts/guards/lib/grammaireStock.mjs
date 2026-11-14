// STOCK NOMINATIF DATÉ (2026-08-25) des sites qui RE-TAPENT une forme de la grammaire, ou qui
// ÉTENDENT une de ses portes — le dénominateur de la garde `src/data/grammaire-guard.test.ts`
// (#1466 L1a). Patron whitelist-en-lib du dépôt (`horsStrateStock.mjs`).
//
// Clé = `<fichier>:<symbole>[.<champ>]|<motif>|<detail>` — jamais un numéro de ligne : une ligne
// bouge à chaque édition du module et ferait rougir la garde sans qu'aucune forme n'ait changé
// (même raison qu'en tête de `STRUCTURES_REDECLARATIONS`). Les trois motifs :
//   - `redeclaration` : le jeu de clés du littéral EST la signature d'un schéma de la grammaire ;
//   - `alias`         : le littéral porte une GRAPHIE HISTORIQUE de référence (`skillId`, `ref`…) ;
//   - `extend`        : `.extend(` posé sur une porte de la grammaire (zod 4.4.3 y perd registre
//                       et `.meta()`, cf. en-tête de `grammaire/ref.ts`).
//
// ANGLE MORT INVERSE (la garde est plus STRICTE que son en-tête ne le dit) : le `MODULES_GRAMMAIRE`
// de `grammaireGuard.mjs` compte `defs-scenes` comme un module DE GRAMMAIRE — un `.extend` dont le
// récepteur vient de `defs-scenes` serait donc relevé comme extension de porte, alors que
// `defs-scenes` n'est pas la grammaire. ZÉRO site aujourd'hui (aucune entrée `extend` du stock n'en
// vient) : la sur-stricture est INERTE, elle est déclarée ici pour n'être pas découverte au premier
// `.extend` posé dans `defs-scenes`.
//
// COMMENT UNE LIGNE SE SOLDE — jamais en la retirant seule : le site ADOPTE la forme de la
// grammaire (`ref(type)`, `specRef(type)`, `diceSpecSchema`, `cell2Schema`…) dans le LOT porté par
// la ligne, la garde rougit alors sur « entrée sans site », et la ligne part dans le MÊME commit.
// Le contrat est BIDIRECTIONNEL : un site hors stock = rouge (dérive neuve) ; une entrée sans site
// = rouge (entrée périmée). Ce stock ne fait que DÉCROÎTRE.
//
// Les LOTS reprennent ceux du dénominateur L0 (`structuresStock.mjs`, `STRUCTURES_REDECLARATIONS`)
// quand le site y correspond : concept Compétence → `L2 #1463`, Talent/Objet/Créature/Véhicule →
// `L3 #1463`, source → `L1d #1463`.

/** Graphie historique de référence à une COMPÉTENCE (`skill`/`skillId` + `spec`) — meurt quand le
 *  site adopte `specRef('skill')`. */
const L2 = 'L2 #1463';
/** Référence à une entité NOMMÉE autrement (Talent, Trait, Objet, Créature, Véhicule) — meurt quand
 *  le site adopte `ref(type)`/`specRef(type)`. */
const L3 = 'L3 #1463';
/** Concept SOURCE (`{book, page}` et ses dérivés) — chantier des réfs de source. */
const L1d = 'L1d #1463';
const DATE = '2026-08-25';

/** @param {string} raison @param {string} lot */
const e = (raison, lot) => ({ raison, lot, date: DATE });

export const GRAMMAIRE_STOCK = {
  // ── Graphies historiques de COMPÉTENCE (`skill`, `skillId`) ──────────────────────────────────
  // #1467 L1b V-FLIP-ENTITE-b : la ligne REVIT sous le binding `doc` — l'adoption de `document()`
  // l'avait fait sortir du scan (l'argument `champs` n'était pas visité), pas de la déclaration.
  // Le champ `skill` est toujours là, la donnée n'a pas bougé.
  'src/data/schemas/defs/miscast.ts:jsonOpSchema|alias|skill': e('Op de maléfice portant un test par `skill` (non migré).', L2),
  // AUCUNE entrée pour les graphies portées par `src/data/schemas/grammaire/` : ce module n'est scanné
  // que pour `.extend` (`PERIMETRE_FABRIQUES`, `sansRedeclaration`), ses littéraux ÉTANT le canon. La
  // liste nominative de ces graphies et son cardinal sont tenus par le test « les graphies de la
  // grammaire sont hors stock par construction » (`src/data/grammaire-guard.test.ts`), et la perte de
  // couverture qu'un déplacement vers la grammaire produit est déclarée en `GARDE.angleMort`.
  'src/data/schemas/defs-scenes/effets.ts:startPursuitSchema|alias|skill': e('Effet `startPursuit` désignant la Compétence de course par `skill`.', L2),

  // ── Graphies historiques de RÉFÉRENCE à une autre entité (`ref`, `talentId`, `trappingId`) ────
  'src/data/schemas/defs/reglesOptionnelles.ts:doc|alias|ref': e('Règle optionnelle désignant l’entité concernée par une enveloppe `ref`.', L3),
  'src/data/schemas/defs/river-perils.ts:doc.perils|alias|ref': e('Péril fluvial désignant son entité (créature/structure) par une enveloppe `ref`.', L3),
  'src/data/schemas/defs-scenes/scene.ts:authoredShipPosteSchema|alias|trappingId': e('Poste d’artillerie désignant sa pièce par `trappingId`, graphie persistée (scènes, `hydratePoste`) sortie de son `z.custom` (#3606 M1f).', L3),
  'src/data/schemas/defs-scenes/effets.ts:giveTrappingSchema|alias|trappingId': e('Effet `giveTrapping` désignant l’objet donné par `trappingId` (migration de LIBELLÉ soldée en T3-b, la graphie reste).', L3),
  'src/data/schemas/defs-scenes/effets.ts:pursuitFoeSchema|alias|ref': e('Adversaire de Poursuite désignant sa fiche (bête ou statbloc) par l’enveloppe `ref` — la MÊME `livingRefSchema` que `givePossession`.', L3),
  'src/data/schemas/defs-scenes/effets.ts:givePossessionSchema|alias|ref': e('Effet `givePossession` désignant la possession par une enveloppe `ref`.', L3),
  'src/data/schemas/defs-scenes/worldmap.ts:portProfileSchema|alias|ref': e('Profil de port désignant son entité par une enveloppe `ref`.', L3),

  // ── Formes POSSÉDÉES par la grammaire, re-tapées ou étendues ─────────────────────────────────
  'src/data/schemas/grammaire/valeurs.ts:secondarySourceRefSchema|extend|sourceRefSchema.extend(…)': e('Réf de source SECONDAIRE construite en ÉTENDANT `sourceRefSchema` — meurt avec la refonte du concept source.', L1d),
};
