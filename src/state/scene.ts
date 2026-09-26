/**
 * Schéma de Scène/Niveau — contrat UNIQUE partagé par :
 *  - l'éditeur de niveau (lecture/écriture),
 *  - le runtime (exploration + combat),
 *  - le contenu de campagne (livré comme documents de scène à ce format).
 *
 * Aucune scène n'est codée « en dur » : la campagne est de la donnée.
 */
import type { AuthoredShipPoste, NavalTraitRef } from '../engine/types';
import type { EntityAppearance } from '../engine/authoringAppearance';
import { sanitizeFlow, type Flow, type EffectOp } from './flow';
import { type ScheduleSpec } from '../engine/clock';
// Les FORMES des 57 variantes d'`Effect` vivent en zod (`data/schemas/defs-scenes/effets.ts`) ;
// l'union ci-dessous les compose par `z.infer`. Import de TYPE seul — aucun cycle runtime.
import type { z } from 'zod';
import type {
  setFlagSchema, setObjectiveSchema, clearObjectiveSchema, giveTrappingSchema, givePossessionSchema,
  giveMoneySchema, giveXpSchema, startCombatSchema, startMassBattleSchema, transitionSchema,
  transitionBackSchema, startDialogueSchema, journalSchema, documentSchema, revealClueSchema,
  discreditClueSchema, forceDoorSchema, setTimeSchema, openMerchantSchema,
  openPortSchema, medicalAidSchema, restoreFortuneSchema, restSchema, mealPartySchema,
  inflictNightmaresSchema, ambitionLostSchema, inflictPsychologySchema, inflictDiseaseSchema,
  inflictHungerSchema, inflictThirstSchema, exposureNightSchema, inflictTraumaSchema,
  zoneBlastSchema, fallSchema, setLightSchema, setDoorSchema, moveEntitySchema, playSfxSchema,
  giveSinSchema, corruptionExposureSchema, waterExposureSchema, learnSpellSchema, castSpellSchema,
  sessionEndSchema, openCharacterCreatorSchema, interludeSchema, grantFavorSchema,
  startPursuitSchema, openTavernGamesSchema, openWorldMapSchema, setVesselSchema,
  adjustManannSchema, adjustVesselSchema, endDialogueSchema,
} from '../data/schemas/defs-scenes/effets';
import type { extendedTestSchema } from '../data/schemas/grammaire/mecanique';
// Idem pour les FORMES de la scène elle-même : le schéma zod (`data/schemas/defs-scenes/scene.ts`)
// les DÉCLARE — champs, optionalités, mécanique, réfs RAW —, les types ci-dessous les nomment.
import type {
  architectureBodySchema, architectureEdgeRefSchema, architecturePartSchema, architectureRectSchema,
  architectureStoreySchema, buildingMassSchema, dialogueChoiceSchema, dialogueNodeSchema,
  dialogueSchema, encounterDefSchema, encounterMemberSchema, entityKindSchema, facadeFeatureSchema,
  facadeSectionSchema, layerSchema, roofDefaultsSchema, sceneStationAnchorSchema, triggerSchema,
  victoryConditionSchema, wallClimbSchema, wallSegSchema, zoneAreaSchema,
} from '../data/schemas/defs-scenes/scene';
import type { wallSideSchema } from '../data/schemas/defs-scenes/communs';
import type { Dir8 } from './dir8';
import type { Pt } from './path';
import { terrainWalkable } from './terrain';
import { entityBlockedAt } from './sceneRules';
import { type Grade, gradeBetween } from './relief';

/** Un terrain est un id de catalogue (cf. src/state/terrain.ts). */
export type Terrain = string;

export type Facing = 'N' | 'S' | 'E' | 'O';

export type EntityKind = z.infer<typeof entityKindSchema>;

/** Statbloc personnalisé (PNJ/bête custom d'éditeur) — moteur pur, `engine/statblock.ts` (#614) :
 *  `LivingRef` (`engine/possession.ts`) porte la même dualité bestiaire|custom que ce type. */
import type { CustomStatblock } from '../engine/statblock';
import { chebyshev } from '../engine/grid';
import type { SeatAssignments } from './seating';
export type { CustomStatblock };

/** RESTE MANUSCRIT (les 22 autres formes de la scène sont des `z.infer` de
 *  `data/schemas/defs-scenes/scene.ts`) — deux écarts MESURÉS avec `sceneEntitySchema` :
 *  `foot` n'existe QUE sur le schéma (fossile toléré au parse, dépouillé par `stripLegacyFoot`,
 *  gaté `@fossile` — il n'a jamais eu de champ ici) ; `appearance` porte ici `EntityAppearance`
 *  (`engine/authoringAppearance`) là où le schéma compose `entityAppearanceSchema`, nœud-FRONTIÈRE
 *  du vocabulaire partagé. */
export interface SceneEntity {
  id: string;
  kind: EntityKind;
  pos: { x: number; y: number };
  /** Couche d'empilement (cf. `layers`). 0 ou absent = couche de base ; >0 = posée sur une couche
   *  supérieure, rendue soulevée à la hauteur métrique de sa case, triée par-dessus la couche inférieure. */
  z?: number;
  /** Orientation MONDE (8 directions) — éditable, projetée au rendu (project + camRot). */
  facing?: Dir8;
  label?: string;
  /** Référence au bestiaire (personnage) ou au catalogue de décor (prop, cf. PROPS). */
  ref?: string;
  /** Profil personnalisé (sinon on utilise `ref`). */
  statblock?: CustomStatblock;
  /** Id d'un preset de PNJ nommé du bloc `narratif.presetsPnj` (#671). Présent = l'entité est
   *  INSTANCIÉE « base globale + surcharges embarquées » (le preset porte `base`/`profil`/`apparence`),
   *  et non depuis `ref`/`statblock` — frontière RÉFÉRENCE vs NARRATIF (le PNJ nommé vit dans le
   *  paquet de campagne, réfère la règle globale par id). Résolu par `resolvePresetCreature`. */
  presetId?: string;
  /** Coque/navire : `id`s des entités d'ÉQUIPAGE exposées à bord (MDG 14) — posés sur le Combattant au spawn. */
  crewIds?: string[];
  /** Coque/navire : pièces d'artillerie MONTÉES (postes AUTHORÉS par réf catalogue, MDG 12-13) —
   *  HYDRATÉES au spawn (`hydratePoste`) sur le Combattant-coque, puis `applyShipPostes` sert chaque poste
   *  à son chef de pièce. La base n'est PAS matérialisée dans la scène (#222). */
  postes?: AuthoredShipPoste[];
  /** Coque/navire : **Améliorations d'INSTANCE** (MDG 12, réfs par id ex. `{ id: 'blindage-fer' }`) —
   *  s'ajoutent aux Traits du TYPE et modifient ce navire-ci (PA de coque, M, couvert…). Posées au spawn. */
  upgrades?: NavalTraitRef[];
  dialogueId?: string;
  /** Décor INTERACTIF (fouille/ramassage). Absent = décor pur. `flow` exécuté une fois (un butin de
   *  feuilles `do` est ramassable un à un — cf. entityPickables ; un `test` en fait une fouille à risque) ;
   *  `consume:true` → le décor disparaît quand pris, sinon il reste (marqué `__fouille_<id>`). */
  interact?: { flow: Flow; consume?: boolean };
  /** Apparence (calques) : override éditeur ; sinon auto-variée au seed de l'id. */
  appearance?: EntityAppearance;
  /** Animation d'ambiance en boucle (clé de AMBIENT_CLIPS) — rend l'entité via le rig. */
  anim?: string;
  /** Arme ÉQUIPÉE : `trappingId` STABLE du catalogue d'armes — affichée par le rig (tenue prête si à
   *  distance). Ex. `'arbalete'`. Résolue par `weaponFromId` (lookup exact, warn si hors catalogue). */
  weapon?: string;
  /** Source de lumière (brouillard de guerre) : rayon d'éclairage en cases. Override de l'instance ;
   *  sinon le rayon vient du TYPE de prop (`props.json` `light`). Absent + type sans `light` = pas de lumière.
   *  `tone` (#1245, L4) : id d'un `lightTones` — APPARENCE seule (couleur/intensité/vacillement),
   *  résolue au bord du rendu, hérité du type de prop s'il n'est pas posé ici ; absent = `flamme`. */
  light?: { radiusTiles: number; tone?: string };
  /** Marchand (#2) : ce PNJ ouvre un panneau d'achat/vente (référence un archétype de `state/merchants`).
   *  `settlement`/`resaleRate`/`buyMarkup` surchargent l'archétype pour cette entité (prix paramétrables :
   *  resaleRate = rachat à la vente, buyMarkup = majoration à l'achat). */
  /** OVERRIDES par-entité des 3 règles maison Marché (LDB 59/60, `market-guild`/`market-mode`/
   *  `market-tenir-comptes`) — mêmes domaines de valeurs que la règle globale correspondante. Absent =
   *  HÉRITAGE du global (`engine/policy` `rule(...)`), jamais un 3ᵉ état ambigu. Lus par `marketRule`
   *  (state/merchantFlow, couture UNIQUE). */
  merchant?: { archetype: string; settlement?: import('../engine/disponibilite').Settlement; resaleRate?: number; buyMarkup?: number; restockDays?: number;
      guild?: boolean; marketMode?: 'complet' | 'sans-disponibilite' | 'sans-marchandage' | 'simplifie'; tenirComptes?: boolean };
  /** JOUEUR de taverne (#1279 S4) : présent = ce personnage PROPOSE une partie, et il la joue de SA
   *  fiche (`TavernOpponent` `kind:'npc'` — ses Caractéristiques et ses Compétences avec avances,
   *  jamais une valeur recopiée). RÔLE optionnel, au même titre que `dialogue`/`merchant`.
   *
   *  Le patron est AUTHORÉ dans la source, pas inventé : `NADJ 04 l.72` — « Elle jouera une partie de
   *  L'Impératrice écarlate avec quiconque lui propose, la mise de départ étant d'1 pistole par
   *  partie. » Un jeu, une mise de départ : c'est exactement ce que ces deux champs portent.
   *  `EDO 01 l.202` en donne le second exemple (Phillipe Descartes, « quelle que soit la mise, mais
   *  considère comme une perte de temps de jouer pour moins de 2/- »).
   *
   *  `gameId` = id d'une entrée de `tavernGames.json`. `stakeBrass` = mise de DÉPART en sous de
   *  cuivre (la modale reste libre de la changer — l'auteur pose le défaut, pas une contrainte) ;
   *  absente, la table s'accorde sans mise. */
  tavernGame?: { gameId: string; stakeBrass?: number };
  /** RÔLE combat optionnel (au même titre que dialogue/marchand) : présent = ce personnage peut être
   *  enrôlé dans une rencontre (cf. EncounterMember). Porte les choix d'auteur qui DÉCRIVENT la
   *  personne au combat — son profil (ref/statblock) et son apparence vivent déjà sur l'entité. */
  combat?: {
    /** OPTIONNELS choisis (LDB 76 l.45) : `TraitInstance` fusionnés au spawn OU notes composées
     *  (joker « tous les traits », variante « swap » retirant des Traits + octroyant un bonus, ZI). */
    optionals?: import('../engine/statEntry').OptionalEntry[];
    /** Sorts connus (ids de spells.json, créature `ref`) — choix d'auteur (la donnée bestiaire n'en liste pas). */
    spells?: string[];
    /** Caractéristiques aléatoires au spawn (LDB 77 l.108 : −10 + 2d10, graine stable par id). */
    randomChars?: boolean;
    /** Compétences d'AUTEUR ajoutées (réfs `SkillRef`) — fusionnées par-dessus celles du bestiaire au spawn.
     *  Qualifie p.ex. un servant de pièce pour le Groupe de Projectiles APPROPRIÉ à son engin (AA 10 p.122 l.3900). */
    skills?: import('../data').SkillRef[];
    /** Invisible en EXPLORATION (embuscade) : n'apparaît qu'au combat. `false`/absent = PNJ visible
     *  qui devient hostile au déclenchement. */
    hiddenUntilCombat?: boolean;
  };
}

export type ArchitectureRect = z.infer<typeof architectureRectSchema>;
export type ArchitectureEdgeRef = z.infer<typeof architectureEdgeRefSchema>;
export type ArchitecturePart = z.infer<typeof architecturePartSchema>;
export type ArchitectureStorey = z.infer<typeof architectureStoreySchema>;
export type FacadeFeature = z.infer<typeof facadeFeatureSchema>;
export type FacadeSection = z.infer<typeof facadeSectionSchema>;
export type BuildingMass = z.infer<typeof buildingMassSchema>;
export type RoofDefaults = z.infer<typeof roofDefaultsSchema>;
export type ArchitectureBody = z.infer<typeof architectureBodySchema>;

/** Effet PROGRAMMÉ (Lot 0, étendu #668) — l'une des DEUX variantes dont le corps reste manuscrit :
 *  elle porte un `Flow<Effect>`, donc elle est MUTUELLEMENT récursive avec l'union ci-dessous, et
 *  ce corps est l'ANNOTATION de `delayedEffectSchema` (`data/schemas/defs-scenes/effets.ts`, où
 *  vivent sa mécanique et ses réfs). */
export type DelayedEffect = { type: 'delayedEffect'; flow: Flow; cancelFlag?: string } & ScheduleSpec;

/** « Petites Prières » — seconde variante récursive (son `reward` est un `Flow<Effect>`) ; ANNOTE
 *  `petitePriereSchema` (`data/schemas/defs-scenes/effets.ts`). */
export type PetitePriere = { type: 'petitePriere'; heroId?: string; reward: Flow };

/**
 * Union des 57 variantes d'effet de scène + la feuille `ops` = 58 membres. La FORME de chaque
 * variante — champs, optionalités, mécanique, réfs RAW — vit dans
 * `src/data/schemas/defs-scenes/effets.ts` ; ici on ne compose que les noms. `EffectOp`
 * (`type:'ops'`) est le membre POSSÉDÉ par le moteur (feuille par défaut du `Flow<E>` générique).
 */
export type Effect =
  | z.infer<typeof setFlagSchema>
  | z.infer<typeof setObjectiveSchema>
  | z.infer<typeof clearObjectiveSchema>
  | z.infer<typeof giveTrappingSchema>
  | z.infer<typeof givePossessionSchema>
  | z.infer<typeof giveMoneySchema>
  | z.infer<typeof giveXpSchema>
  | z.infer<typeof startCombatSchema>
  | z.infer<typeof startMassBattleSchema>
  | z.infer<typeof transitionSchema>
  | z.infer<typeof transitionBackSchema>
  | z.infer<typeof startDialogueSchema>
  | z.infer<typeof journalSchema>
  | z.infer<typeof documentSchema>
  | z.infer<typeof revealClueSchema>
  | z.infer<typeof discreditClueSchema>
  | z.infer<typeof extendedTestSchema>
  | z.infer<typeof forceDoorSchema>
  | z.infer<typeof setTimeSchema>
  | DelayedEffect
  | z.infer<typeof openMerchantSchema>
  | z.infer<typeof openPortSchema>
  | z.infer<typeof medicalAidSchema>
  | z.infer<typeof restoreFortuneSchema>
  | z.infer<typeof restSchema>
  | z.infer<typeof mealPartySchema>
  | z.infer<typeof inflictNightmaresSchema>
  | z.infer<typeof ambitionLostSchema>
  | z.infer<typeof inflictPsychologySchema>
  | z.infer<typeof inflictDiseaseSchema>
  | z.infer<typeof inflictHungerSchema>
  | z.infer<typeof inflictThirstSchema>
  | z.infer<typeof exposureNightSchema>
  | z.infer<typeof inflictTraumaSchema>
  | EffectOp
  | z.infer<typeof zoneBlastSchema>
  | z.infer<typeof fallSchema>
  | z.infer<typeof setLightSchema>
  | z.infer<typeof setDoorSchema>
  | z.infer<typeof moveEntitySchema>
  | z.infer<typeof playSfxSchema>
  | z.infer<typeof giveSinSchema>
  | z.infer<typeof corruptionExposureSchema>
  | z.infer<typeof waterExposureSchema>
  | z.infer<typeof learnSpellSchema>
  | z.infer<typeof castSpellSchema>
  | PetitePriere
  | z.infer<typeof sessionEndSchema>
  | z.infer<typeof openCharacterCreatorSchema>
  | z.infer<typeof interludeSchema>
  | z.infer<typeof grantFavorSchema>
  | z.infer<typeof startPursuitSchema>
  | z.infer<typeof openTavernGamesSchema>
  | z.infer<typeof openWorldMapSchema>
  | z.infer<typeof setVesselSchema>
  | z.infer<typeof adjustManannSchema>
  | z.infer<typeof adjustVesselSchema>
  | z.infer<typeof endDialogueSchema>;

export type DialogueChoice = z.infer<typeof dialogueChoiceSchema>;

export type DialogueNode = z.infer<typeof dialogueNodeSchema>;

export type Dialogue = z.infer<typeof dialogueSchema>;

/** Nom AFFICHÉ du locuteur d'un nœud : override par nœud puis speaker de session, résolu en label
 *  d'entité de la scène (jamais un nom en clair stocké, #669). `undefined` si aucun speaker. */
export function speakerLabel(
  entities: SceneEntity[],
  node: { speakerId?: string },
  dialogue: { speakerId?: string }
): string | undefined {
  const id = node.speakerId ?? dialogue.speakerId;
  return id ? entities.find((e) => e.id === id)?.label : undefined;
}

/** Fenêtre horaire d'un trigger (heure-du-jour, `before` EXCLUSIF). Champs absents = borne ouverte ;
 *  objet vide = toujours vrai. Combinée en ET avec `rect`/`condition` : le déclencheur ne se produit
 *  qu'en entrant dans la zone PENDANT cette fenêtre (spot-check « au bon endroit au bon moment »).
 *  DÉCLARÉE dans le noyau engine (`engine/flowCore`, zéro dépendance) ; ré-exportée ici pour les
 *  importeurs historiques de `./scene` (ConditionEditor, tests). */
export type { TemporalCondition } from '../engine/flowCore';

export type Trigger = z.infer<typeof triggerSchema>;

// Évaluation des conditions (flag/temporelle) : SOURCE UNIQUE `evalCondition` (src/state/flow.ts).
// Les anciens `condMet`/`temporalConditionMet` ont fondu dedans (algèbre de Conditions unifiée).

export type EncounterMember = z.infer<typeof encounterMemberSchema>;

export type EncounterDef = z.infer<typeof encounterDefSchema>;

export type Layer = z.infer<typeof layerSchema>;

export type ZoneArea = z.infer<typeof zoneAreaSchema>;

/** ZONE D'EFFET authorée (piège/hasard/aura environnementale). Payload = `GameOp[]` partagé avec les
 *  zones de Sort (vocabulaire unique, appliqué par `applyOps`). `onCross` se déclenche à la TRAVERSÉE
 *  (une case du chemin est dans l'aire), `perRound` au franchissement de Round pour qui STATIONNE dedans.
 *  Tous les champs mécaniques (`onCross`/`perRound`/`crossTest`/`barrier`/`blocksLoS`) sont OPTIONNELS —
 *  une zone `{id,label,area}` sans aucun d'eux est DESCRIPTIVE (nom de pièce, #782) : inerte au combat,
 *  affichée seulement (`isDescriptiveZone`). */
/** RESTE MANUSCRIT : `crossTest` NOMME ici le type moteur `FlowTest` (`engine/flowCore`), là où le
 *  schéma compose `flowTestSchema`, nœud-FRONTIÈRE du vocabulaire partagé ; `tiles` NOMME de même
 *  `Pt` (`state/path`), là où le schéma compose `ptSchema` — divergence NOMINALE seule, assignabilité
 *  mutuelle intacte dans les deux sens. */
export interface SceneEffectZone {
  id: string;
  label: string;
  area: ZoneArea;
  presentation?: 'interior' | 'exterior';
  /** EMPRISE EXACTE, quand la zone n'est pas pleine : la liste des cases qui lui appartiennent VRAIMENT
   *  (pièce en L, cour découpée). `area` n'en est alors que la boîte englobante — c'est `tiles` qui fait
   *  foi (`sceneZoneTiles`). Absent = la zone occupe TOUTE son aire. Écrit par le calque `zoneMap` de
   *  l'authoring ASCII (un char = un ensemble libre de cases) et par le découpage cellulaire de
   *  l'inspecteur. */
  tiles?: Pt[];
  blocksLoS?: boolean;
  onCross?: import('../engine/ops').GameOp[];
  perRound?: import('../engine/ops').GameOp[];
  /** GATE de Test à la traversée (cf. `BattleZone.crossTest`, zones.ts) — même sémantique pour une
   *  zone authorée (piège/hasard de scène). */
  crossTest?: import('../engine/flowCore').FlowTest;
  /** BARRIÈRE infranchissable : aucune créature ne peut PÉNÉTRER dans l'aire (mur magique, cercle de
   *  ward). `blockGroups` vide/absent = bloque TOUT le monde ; sinon ne bloque que les créatures dont
   *  un Groupe correspond (ids, ex. `['demon', 'mort-vivant']` = barrière sacrée, profanes tenus à l'écart —
   *  Protection de Phâ / Octogramme). Une créature DÉJÀ à l'intérieur peut sortir, pas re-rentrer. */
  barrier?: { blockGroups?: string[] };
  /** Étage de la zone — défaut 0 (plan de combat). Les zones DESCRIPTIVES de pièce portent le z de leur
   *  étage pour l'affichage/atteignabilité par niveau ; le combat (2D) l'ignore. */
  z?: number;
}

/** Une zone d'effet est DESCRIPTIVE (nom de pièce) quand elle ne porte AUCUN champ mécanique — filtre
 *  UNIQUE (#782) partagé par `sceneZonesToBattle` (zones.ts) et le calque de zones de l'éditeur
 *  (`EditorCanvas`, le SEUL rendu qui affiche le nom d'une pièce). */
export function isDescriptiveZone(ez: SceneEffectZone): boolean {
  return !ez.onCross && !ez.perRound && !ez.crossTest && !ez.barrier && !ez.blocksLoS;
}

/** RESTE MANUSCRIT : le SEAM diverge en OPTIONALITÉ. `sceneSchema` voit le document AVANT
 *  `normalizeScene` — `layers`/`entities`/`dialogues`/`triggers`/`encounters`/`flags` y sont
 *  optionnels (un document ancien n'en porte pas), REQUIS ici (après normalisation, tout
 *  consommateur les lit sans garde). */
export interface Scene {
  /** Type de document EMBARQUÉ (#1552) : la scène s'annonce dans la donnée, jamais hydratée en
   *  mémoire — même régime que `CustomStatblock.type` (`engine/statblock.ts`). */
  type: 'scene';
  id: string;
  label: string;
  desc?: string;
  dimensions: { w: number; h: number };
  /** Échelle métrique d'une CASE (m/case) — défaut 2 (person-scale). Une Scène MER (combat naval, MDG 13)
   *  vaut ~10 (1 pt de Distance = 10 m, `ch.13 l.362`) → le M des navires et les portées canon (50/75/150 m)
   *  tombent en nombres de cases jouables. Lue via `sceneMetresPerTile` ; consommée par les bandes de portée
   *  (`rangeBandAt`, engine/combat.ts, #249) et l'avance des navires. N'altère AUCUNE géométrie de rendu —
   *  seul le SENS d'une case change. */
  metresPerTile?: number;
  /** Décor : 'interieur' (éclairé en permanence, l'horloge ne l'assombrit pas) vs 'exterieur'
   *  (jour/nuit = horloge). Absent = extérieur. */
  ambiance?: 'interieur' | 'exterieur';
  /** Classification écologique de la Scène (éditable) — lue par les attributs de Domaine liés à
   *  l'environnement (LDB 48 l.690 : la Vie/Ghyran gagne +10 à Incanter/Focaliser en zone rurale ou
   *  sauvage). Absent = non spécifié (aucun bonus d'environnement). */
  environment?: 'rural' | 'urbain' | 'sauvage';
  /** Météo (LDB 14 l.68-82) — orthogonal à `ambiance`. Défaut 'clair'. Pénalise le combat
   *  (brouillard/tempête/neige) ; lu par `sceneCombatModifiers`. */
  weather?: 'clair' | 'pluie' | 'brouillard' | 'neige' | 'tempete';
  /** Niveau de lumière ambiante (brouillard de guerre) : `id` d'un `lightLevels` (jour/nuit/ténèbres…)
   *  ou `'auto'`/absent = suit l'horloge via `ambiance` (extérieur de nuit = sombre). Lu par `ambientScalar`. */
  ambientLight?: string;
  /** NORD de la carte — rotation HORAIRE (degrés, `[0,360[`) du nord réel par rapport au nord IMPLICITE
   *  du plan, qui est `−y` (la forme canonique de `WallSeg.side:'N'` ci-dessous). Absent = 0 = le nord
   *  implicite. Ne change AUCUNE géométrie ni aucun cap de jeu : seule la course du soleil s'y oriente
   *  (rendu volumique, `gameIso/backends/webgl/sunJeu.ts`) — deux scènes voisines à la même heure y
   *  gagnent des ombres cohérentes entre elles. Posé par `setNorthDeg` (qui le ramène dans `[0,360[`). */
  northDeg?: number;
  /** OFFRE DE REPOS de la scène (bouton de Repos en exploration → modale de Repos) : lieux disponibles
   *  (auberge/chez soi/camp, combinables) + qualité (piètre = ½ prix, nourriture à risque).
   *  Absent = camp seulement ; tout à false = repos interdit ici. La météo ci-dessus donne la
   *  sévérité d'Exposition d'une nuit dehors (engine/exposure). */
  rest?: { auberge?: boolean; maison?: boolean; camp?: boolean; quality?: 'normale' | 'pietre' };
  /** Offre de repos PAR ZONE (prioritaire sur `rest` là où le groupe se tient) — « paramétrable
   *  sur la zone » : le quartier de l'auberge offre des chambres, la place du marché non. */
  restZones?: { rect: { x: number; y: number; w: number; h: number; z?: number }; places: { auberge?: boolean; maison?: boolean; camp?: boolean }; quality?: 'normale' | 'pietre' }[];
  /** ZONES D'EFFET posées sur la carte (éditeur) — PIÈGES / hasards / brasiers : tout combattant qui
   *  TRAVERSE (`onCross` : pic, flaque acide, glyphe) ou STATIONNE (`perRound` : nuage de poison,
   *  brasier) y subit l'effet (Dégâts/soin/États en `GameOp[]`). Converties en `BattleZone`
   *  PERMANENTES au début du combat — même runtime que les zones de Sort (Mur de feu, Grands feux).
   *  `blocksLoS` masque la Ligne de Vue (fumée, ténèbres). Contenu 100 % donnée : aucune zone codée en dur. */
  effectZones?: SceneEffectZone[];
  /** Musique de la scène — ids de pistes du registre audio (defs `music`). Champ absent/undefined
   *  = AUTOMATIQUE (intérieur/extérieur pour l'ambiance, piste de combat générique en combat) ;
   *  `null` = SILENCE forcé. Éditable dans l'éditeur (onglet Scène). */
  music?: { ambient?: string | null; combat?: string | null };
  /** Couches d'empilement de la scène. Au moins une ; `z:0` = couche de base. Chaque couche a sa propre
   *  grille aplatie w×h + ses hauteurs métriques (`Layer.height`). Les couches z>0 sont des surfaces
   *  superposées (ponts, passerelles, étages) : on marche DESSUS et DESSOUS. Le franchissement vertical
   *  s'auto-dérive du delta de hauteur entre voisines (`surfaceLink`) — aucun escalier explicite. */
  layers: Layer[];
  /** Murs sur ARÊTES de case (cloisons fines entre deux cases adjacentes) — bloquent le passage sans
   *  occuper de tuile, contrairement au terrain `mur`. Forme canonique : `side:'N'` = arête entre (x,y)
   *  et (x,y-1) ; `side:'E'` = arête entre (x,y) et (x+1,y). `door` = arête franchissable (porte). */
  walls?: WallSeg[];
  entities: SceneEntity[];
  /** OCCUPATION des places assises offertes par le mobilier posé : `propId → slotId → occupant`
   *  (`state/seating.ts`, source UNIQUE de sa résolution et de sa mutation). Absent = personne
   *  n'est assis ; `{}` explicite dit la même chose, et se distingue de l'absence à la CAPTURE de
   *  mutation (un effacement complet ne doit pas ressusciter l'assise authorée). */
  seatAssignments?: SeatAssignments;
  /** Corps architecturaux authorés : volumes, façades et toitures intentionnels. */
  architecture?: ArchitectureBody[];
  dialogues: Dialogue[];
  triggers: Trigger[];
  encounters: EncounterDef[];
  /** Ancres AUTHORÉES des Scènes de bataille sur le plan (S2) — chaque `sceneId` de la pioche de
   *  Puissance de Bataille (`MassBattleState.pool`) reçoit un emplacement sur la carte. La PUISSANCE
   *  des armées reste une abstraction NON rendue ; seul l'emplacement de l'ACTION cinématique (la
   *  Scène du moment que résout un PJ) est posé, pour que `battleScenesToStations` en fasse des
   *  Stations spatiales. Non peuplé = repli déterministe (le consommateur étale les Scènes). */
  stations?: SceneStationAnchor[];
  flags: Record<string, boolean>;
  /** Points d'arrivée nommés (pour les transitions depuis une autre scène). `z` = étage visé (défaut 0,
   *  cf. `normalizeScene`) — une transition vers un étage doit pouvoir NOMMER cet étage (#835 FU-5). */
  entryPoints?: Record<string, { x: number; y: number; z?: number }>;
  /** Scène de départ pour la campagne enchaînée. */
  startMessage?: string;
}

export type SceneStationAnchor = z.infer<typeof sceneStationAnchorSchema>;

/** Échelle métrique d'une case (m/case) — défaut 2 (person-scale, LDB). Source UNIQUE pour la couche Mer. PUR. */
export function sceneMetresPerTile(scene: { metresPerTile?: number } | null | undefined): number {
  return scene?.metresPerTile ?? 2;
}

/** La scène est-elle à l'échelle MER (combat naval OPÉRATIONNEL : navire-unité, équipage abstrait/passager) ?
 *  Proxy = case ≥ 4 m (vs 2 m person-scale du Pont/sol). Pilote le modèle navire-unité (cf. couche Mer ⇄ Pont). PUR. */
export function isMerScene(scene: { metresPerTile?: number } | null | undefined): boolean {
  return sceneMetresPerTile(scene) >= 4;
}

/** Grille de tuiles d'une couche (défaut z=0 = base). Repli sur la 1ʳᵉ couche si `z` absent. */
export function layerTiles(scene: Scene, z = 0): Terrain[] {
  return (scene.layers.find((l) => l.z === z) ?? scene.layers[0]).tiles;
}

/** Ids des `SceneEntity` ENRÔLÉES dans une rencontre (membres d'un `EncounterDef`) — une entité enrôlée
 *  est un combattant : elle affiche son équipement de combat. SOURCE UNIQUE (rendu iso ET POV). */
export function enrolledEntityIds(scene: Scene): Set<string> {
  return new Set(scene.encounters.flatMap((e) => (e.members ?? []).map((m) => m.entityId)));
}

export function tileAt(scene: Scene, x: number, y: number, z = 0): Terrain {
  if (x < 0 || y < 0 || x >= scene.dimensions.w || y >= scene.dimensions.h) return 'mur';
  return layerTiles(scene, z)[y * scene.dimensions.w + x] ?? 'sol';
}

/** Hauteur RÉELLE (mètres) de la surface de la case (x,y) sur la couche `z` : >0 surélevée, <0 en
 *  contrebas. Hors-grille ou sans tableau `height` → 0. Repli sur la 1ʳᵉ couche si `z` absent, comme
 *  `tileAt`. PORTEUSE : pilote rampe/falaise (`surfaceLink`), distance verticale et chute. */
export function heightAt(scene: Scene, x: number, y: number, z = 0): number {
  if (x < 0 || y < 0 || x >= scene.dimensions.w || y >= scene.dimensions.h) return 0;
  const layer = scene.layers.find((l) => l.z === z) ?? scene.layers[0];
  return layer.height?.[y * scene.dimensions.w + x] ?? 0;
}

/** Id de structure crénelée d'une case de chemin de ronde (couche `z`), ou `null`. Marqueur de RENDU PUR
 *  (le crest builder `crestGeometry` en dérive les merlons de PÉRIMÈTRE) — n'affecte NI passabilité NI LdV. PUR. */
export function crenellatedAt(scene: Scene, x: number, y: number, z = 0): string | null {
  if (x < 0 || y < 0 || x >= scene.dimensions.w || y >= scene.dimensions.h) return null;
  const layer = scene.layers.find((l) => l.z === z) ?? scene.layers[0];
  return layer.crenellated?.[y * scene.dimensions.w + x] ?? null;
}

/** La case (x,y,z) porte-t-elle une crénelure (marqueur de rendu) ? */
export function isCrenellated(scene: Scene, x: number, y: number, z = 0): boolean {
  return crenellatedAt(scene, x, y, z) !== null;
}

export function isWalkable(scene: Scene, x: number, y: number, z = 0, swim?: ReadonlySet<string>): boolean {
  if (z > 0 && tileCollapsed(scene, x, y, z)) return false; // passerelle effondrée → plus marchable
  if (entityBlockedAt(scene, x, y, z)) return false; // empreinte multi-cases d'un décor (foot {w,h}), SA couche seulement
  // Impassabilité de la MASSE = le TERRAIN (bloc plein `mur` = walkable:false) ; le sol du TUNNEL (`pierre`)
  // reste marchable, la herse INTACTE barrant la bouche via `wallBetween`. Aucune règle « rempart » ici.
  // `swim` : terrains d'ÉLECTION du mover (op passive `offTerrainMod` — `eau` pour Aquatique/Amphibie/
  // Créature marine) qu'il TRAVERSE bien que globalement `walkable:false` (RAW « se déplace à sa pleine
  // vitesse dans l'eau ») ; absent (exploration/décor) → walkabilité de terrain nue, byte-identique.
  const t = tileAt(scene, x, y, z);
  return terrainWalkable(t) || (swim !== undefined && swim.has(t));
}

/** Lien vertical entre deux cases ADJACENTES (Chebyshev : cardinale OU diagonale, grille 8-connexe cf.
 *  `path.ts` NEIGHBORS ; couches possiblement différentes) : compare leurs hauteurs métriques et classe
 *  le franchissement à pied — `flat`/`ramp` marchable, `cliff` infranchissable horizontalement (on y
 *  descend en chutant, on y monte par Escalade). SOURCE UNIQUE de l'auto-connexion du relief : remplace
 *  les escaliers explicites ET la machinerie de rempart. `drop` = hauteur de `b` moins celle de `a`
 *  (>0 = `b` plus haut). Renvoie null si `a` et `b` ne sont pas adjacentes en (x,y) (distance Chebyshev ≠ 1
 *  → même case ou ≥ 2). La marchabilité du terrain/des murs reste séparée (`isWalkable`/`wallBetween`). */
export function surfaceLink(
  scene: Scene,
  a: { x: number; y: number; z?: number },
  b: { x: number; y: number; z?: number },
): { grade: Grade; drop: number } | null {
  if (chebyshev(a, b) !== 1) return null; // adjacent (cardinal ou diagonal)
  const ha = heightAt(scene, a.x, a.y, a.z ?? 0);
  const hb = heightAt(scene, b.x, b.y, b.z ?? 0);
  return { grade: gradeBetween(ha, hb), drop: hb - ha };
}

/** Mur sur ARÊTE de case. `side:'N'` = arête entre (x,y) et (x,y-1) ; `side:'E'` = arête entre (x,y)
 *  et (x+1,y). Les DIAGONALES `'\\'` (coin NO→SE) et `'/'` (coin NE→SO) tracent une cloison OBLIQUE en
 *  travers de la case (x,y) — pour les parois en éventail / courbes (purement VISUELLES : le déplacement
 *  reste orthogonal, géré par le sol / les arêtes N-E). `door` = franchissable (porte). `z` = étage. */
export type WallSide = z.infer<typeof wallSideSchema>;
export type WallSeg = z.infer<typeof wallSegSchema>;

export type WallClimb = z.infer<typeof wallClimbSchema>;

/** Le segment ESCALADABLE sur l'arête (x,y,side,z), ou undefined. */
export function climbAt(scene: Pick<Scene, 'walls'>, x: number, y: number, side: WallSide, z = 0): WallSeg | undefined {
  return scene.walls?.find((w) => !!w.climb && w.x === x && w.y === y && w.side === side && (w.z ?? 0) === z);
}

/** Segment ESCALADABLE sur l'arête CANONIQUE (cardinale) séparant deux cases adjacentes `a`/`b`, ou
 *  undefined (non adjacentes cardinales, ou pas de grimpe posée). Réutilise `edgeOf` (arête canonique
 *  partagée avec `wallBetween`). PUR. */
export function climbEdgeBetween(
  scene: Pick<Scene, 'walls'>,
  a: { x: number; y: number; z?: number },
  b: { x: number; y: number; z?: number },
): WallSeg | undefined {
  const e = edgeOf(a.x, a.y, b.x, b.y);
  if (!e) return undefined;
  return climbAt(scene, e.x, e.y, e.side, a.z ?? 0);
}

/** Clé de flag d'état d'une porte (`scene.flags`) — `true` = OUVERTE, `false` = FERMÉE (override runtime
 *  de l'état authored `closed`). Absent du flag = défaut authored (`!closed`). */
export function doorKey(x: number, y: number, side: WallSide, z = 0): string {
  return `__door_${x}_${y}_${side}_${z}`;
}

/** Une porte est-elle OUVERTE ? Flag runtime (`scene.flags[doorKey]`) prioritaire, sinon défaut authored
 *  (`!seg.closed`). Une porte ouverte ne bloque ni la vue ni le passage ; fermée, elle bloque les deux. */
export function doorIsOpen(scene: Pick<Scene, 'flags'>, seg: WallSeg): boolean {
  const f = scene.flags?.[doorKey(seg.x, seg.y, seg.side, seg.z ?? 0)];
  return f !== undefined ? f : !seg.closed;
}

/** Le segment de PORTE sur l'arête (x,y,side,z), ou undefined. */
export function doorAt(scene: Pick<Scene, 'walls'>, x: number, y: number, side: WallSide, z = 0): WallSeg | undefined {
  return scene.walls?.find((w) => !!w.door && w.x === x && w.y === y && w.side === side && (w.z ?? 0) === z);
}

/** Pose l'état OUVERT/FERMÉ d'une porte (flag runtime) — renvoie une NOUVELLE Scène (réf changée →
 *  recompute de la vue + re-rendu). No-op (même réf) si pas de porte à cette arête. PUR. */
export function setDoorOpen<S extends Pick<Scene, 'walls' | 'flags'>>(scene: S, x: number, y: number, side: WallSide, z: number, open: boolean): S {
  if (!doorAt(scene, x, y, side, z)) return scene;
  return { ...scene, flags: { ...scene.flags, [doorKey(x, y, side, z)]: open } };
}

/** Bascule une porte (ouverte ↔ fermée). PUR (nouvelle Scène). */
export function toggleDoorIn<S extends Pick<Scene, 'walls' | 'flags'>>(scene: S, x: number, y: number, side: WallSide, z = 0): S {
  const seg = doorAt(scene, x, y, side, z);
  if (!seg) return scene;
  return setDoorOpen(scene, x, y, side, z, !doorIsOpen(scene, seg));
}

/** Clé de flag d'état d'une structure d'arête (`scene.flags`) — présent & `true` = ABATTUE (brèche).
 *  Absent = défaut intact (une structure neuve tient ; pas de couche authored à inverser, à la différence
 *  d'une porte qui peut être `closed` au départ). */
export function structureDownKey(x: number, y: number, side: WallSide, z = 0): string {
  return `__struct_down_${x}_${y}_${side}_${z}`;
}

/** La structure de cette arête est-elle ABATTUE ? Flag runtime override ; absent = intacte (false). Une
 *  structure abattue ne bloque plus ni la vue ni le passage (la brèche est ouverte). */
export function structureIsDown(scene: Pick<Scene, 'flags'>, seg: WallSeg): boolean {
  return scene.flags?.[structureDownKey(seg.x, seg.y, seg.side, seg.z ?? 0)] === true;
}

export type VictoryCondition = z.infer<typeof victoryConditionSchema>;

/** Le segment portant une STRUCTURE sur l'arête (x,y,side,z), ou undefined. */
export function structureAt(scene: Pick<Scene, 'walls'>, x: number, y: number, side: WallSide, z = 0): WallSeg | undefined {
  return scene.walls?.find((w) => !!w.structure && w.x === x && w.y === y && w.side === side && (w.z ?? 0) === z);
}

/** Pose l'état ABATTU/INTACT d'une structure d'arête (flag runtime) — renvoie une NOUVELLE Scène. No-op
 *  (même réf) si aucune structure n'est posée sur l'arête. PUR. */
export function setStructureDown<S extends Pick<Scene, 'walls' | 'flags'>>(scene: S, x: number, y: number, side: WallSide, z: number, down: boolean): S {
  if (!structureAt(scene, x, y, side, z)) return scene;
  return { ...scene, flags: { ...scene.flags, [structureDownKey(x, y, side, z)]: down } };
}

/** Clé de flag d'effondrement d'une TUILE d'étage (`scene.flags`) — présent & `true` = la passerelle de
 *  la case (x,y,z) s'est effondrée (z>0). Absent = intacte. Calque le patron flag des portes/structures. */
export function collapsedTileKey(x: number, y: number, z: number): string {
  return `__tile_down_${x}_${y}_${z}`;
}

/** La tuile (x,y,z) est-elle EFFONDRÉE ? (passerelle d'étage abattue après destruction de la structure
 *  qui la portait). Flag runtime ; absent = intacte (false). */
export function tileCollapsed(scene: Pick<Scene, 'flags'>, x: number, y: number, z: number): boolean {
  return scene.flags?.[collapsedTileKey(x, y, z)] === true;
}

/** Marque la tuile (x,y,z) comme EFFONDRÉE (flag runtime) — renvoie une NOUVELLE Scène (réf changée →
 *  recompute de la vue + re-rendu). PUR. */
export function setTileCollapsed<S extends Pick<Scene, 'flags'>>(scene: S, x: number, y: number, z: number): S {
  return { ...scene, flags: { ...scene.flags, [collapsedTileKey(x, y, z)]: true } };
}

/** Une arête est-elle OUVERTE (ne bloque NI passage NI vue) ? Prédicat CANONIQUE unique des deux modes
 *  d'ouverture : porte ouverte OU structure abattue. Sinon l'arête bloque (mur plein, porte fermée,
 *  structure intacte). Les lecteurs de franchissabilité/transparence (`wallBetween`, `buildOpaque`) s'y
 *  branchent — pas de réimplémentation par site. */
export function wallIsOpen(scene: Pick<Scene, 'flags'>, seg: WallSeg): boolean {
  return (!!seg.door && doorIsOpen(scene, seg)) || (!!seg.structure && structureIsDown(scene, seg));
}

/** Arête CANONIQUE (cellule + side N/E) séparant deux cases ADJACENTES en cardinal — null si non
 *  adjacentes. L'arête entre (x,y) et (x,y+1) est le `N` de (x,y+1) ; entre (x,y) et (x+1,y) le `E` de (x,y). */
export function edgeOf(ax: number, ay: number, bx: number, by: number): { x: number; y: number; side: 'N' | 'E' } | null {
  if (by === ay && bx === ax + 1) return { x: ax, y: ay, side: 'E' };
  if (by === ay && bx === ax - 1) return { x: bx, y: by, side: 'E' };
  if (bx === ax && by === ay + 1) return { x: bx, y: by, side: 'N' };
  if (bx === ax && by === ay - 1) return { x: ax, y: ay, side: 'N' };
  return null;
}

/** Un mur sépare-t-il deux cases adjacentes du même étage ? (bloque le passage, pas la case). Un mur
 *  plein bloque toujours ; une PORTE bloque seulement si elle est FERMÉE, une STRUCTURE seulement tant
 *  qu'elle TIENT — les deux modes d'ouverture sont réunis par `wallIsOpen`. */
export function wallBetween(scene: Scene, ax: number, ay: number, bx: number, by: number, z = 0): boolean {
  if (!scene.walls?.length) return false;
  const e = edgeOf(ax, ay, bx, by);
  if (!e) return false;
  return scene.walls.some(
    (w) => w.x === e.x && w.y === e.y && w.side === e.side && (w.z ?? 0) === z && !wallIsOpen(scene, w),
  );
}

/** Tuiles de PASSERELLE (z=1) marchables situées « au-dessus » d'une arête de structure de sol — la case
 *  porteuse `(seg.x,seg.y)` et sa voisine à travers l'arête (`N` → (x,y-1), `E` → (x+1,y)), prises à z=1
 *  et filtrées sur la marchabilité du terrain (`terrainWalkable`/`tileAt`). Quand la structure portant la
 *  passerelle est abattue, ces tuiles s'effondrent (cf. `collapseStructure`). Ne renvoie QUE celles
 *  réellement praticables (la passerelle réelle) ; les arêtes obliques (`\\`,`/`) n'ont pas de voisine. */
export function parapetTilesAbove(scene: Scene, seg: { x: number; y: number; side: WallSide; z?: number }): { x: number; y: number; z: number }[] {
  const z = 1; // une passerelle au-dessus d'une structure de sol est au 1ᵉʳ étage
  const cells = [{ x: seg.x, y: seg.y }];
  if (seg.side === 'N') cells.push({ x: seg.x, y: seg.y - 1 });
  else if (seg.side === 'E') cells.push({ x: seg.x + 1, y: seg.y });
  return cells
    .filter((c) => terrainWalkable(tileAt(scene, c.x, c.y, z)))
    .map((c) => ({ x: c.x, y: c.y, z }));
}

/** Scène neuve — pose les défauts EXPLICITES au lieu de laisser `undefined` : le contrôle d'inspecteur
 *  affiche alors la valeur RÉELLEMENT effective (2 m, horloge) au lieu d'un simple placeholder vide qui
 *  laisserait l'auteur deviner (#841 FU-A). `environment` reste absent : « non spécifié » (aucun bonus de
 *  Domaine) est une valeur légitime à part entière, pas un défaut caché. */
export function emptyScene(w = 20, h = 15): Scene {
  return {
    type: 'scene',
    id: `scene-${Date.now()}`,
    label: 'Nouvelle scène',
    dimensions: { w, h },
    ambiance: 'exterieur',
    metresPerTile: 2,
    ambientLight: 'auto',
    layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }],
    entities: [],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
  };
}

/** Assainit une feuille `Effect` d'un Flow de scène : recurse dans le Flow imbriqué d'un
 *  `delayedEffect` (le seul cas d'un Flow porté par une feuille, plutôt qu'un nœud de structure —
 *  `sanitizeFlow` de l'engine ne connaît que la forme générique `Flow<E>`, pas cette feuille state). */
function sanitizeEffectLeaf(e: Effect): Effect {
  return e.type === 'delayedEffect' ? { ...e, flow: sanitizeFlow(e.flow, sanitizeEffectLeaf) } : e;
}

/** Assainit un Flow de scène (purge des nœuds `null` inexprimables, cf. `sanitizeFlow`) — `undefined`
 *  passe tel quel (un Flow requis mais absent sur un document ANCIEN reste à la charge de la
 *  validation, jamais d'une invention silencieuse). */
function sanitizeSceneFlow(flow: Flow | undefined): Flow | undefined {
  return flow == null ? flow : sanitizeFlow(flow, sanitizeEffectLeaf);
}

/** Un projet sauvegardé avant la migration porte une empreinte D'INSTANCE (`foot`) : elle est
 *  DÉPOUILLÉE au chargement, jamais recopiée ni interprétée — la physique d'un décor vient du
 *  catalogue courant (`PropData.foot`), vérité unique de ses dimensions. */
function stripLegacyFoot(e: SceneEntity): SceneEntity {
  if (!('foot' in e)) return e;
  const { foot: _legacy, ...reste } = e as SceneEntity & { foot?: unknown };
  return reste;
}

/**
 * Complète les COLLECTIONS requises d'une Scène absentes sur un document ANCIEN (le schéma de
 * `ProjectDoc` — `worldMap.ts` `PROJECT_MIGRATIONS` — ne bump qu'aux ruptures de FORME du document ;
 * `Scene` a gagné des champs collection non-optionnels au fil du temps sans bump de schéma, un projet
 * sauvegardé avant ne les porte pas). Point d'entrée UNIQUE du chargement de projet (`parseProject`) :
 * jamais un `?? []` saupoudré côté consommateur (`validateScene` et le runtime supposent ces
 * collections présentes). Assainit aussi les FLOWS portés (triggers/dialogues/rencontres/entités) —
 * purge des nœuds `null` inexprimables (`sanitizeSceneFlow`) ; une réf pendante ou un Flow entièrement
 * absent reste rapportée par `validateScene`, jamais réparée en silence. PUR — ne mute pas `s`. */
export function normalizeScene(s: Scene): Scene {
  return {
    ...s,
    // La scène S'ANNONCE (#1552) : un enregistrement du filet de crash (`state/editorAutosave.ts`,
    // magasin SANS axe de version) écrit avant ce lot porte une `Scene` muette, que le
    // « Restaurer » puis un « Enregistrer » recoucheraient telle quelle dans un projet en `schema`
    // courant — donc SANS migration au rechargement, et refusée par `parseProject`.
    type: 'scene',
    layers: s.layers ?? emptyScene(s.dimensions?.w, s.dimensions?.h).layers,
    entities: (s.entities ?? []).map((e) => stripLegacyFoot(
      e.interact ? { ...e, interact: { ...e.interact, flow: sanitizeSceneFlow(e.interact.flow) as Flow } } : e)),
    dialogues: (s.dialogues ?? []).map((d) => ({
      ...d,
      nodes: (d.nodes ?? []).map((n) => ({
        ...n,
        choices: (n.choices ?? []).map((c) => (c.flow ? { ...c, flow: sanitizeSceneFlow(c.flow) } : c)),
      })),
    })),
    triggers: (s.triggers ?? []).map((t) => ({ ...t, flow: sanitizeSceneFlow(t.flow) as Flow })),
    encounters: (s.encounters ?? []).map((e) => (e.onVictory ? { ...e, onVictory: sanitizeSceneFlow(e.onVictory) } : e)),
    flags: s.flags ?? {},
  };
}

/** `ambiance` ne distingue qu'intérieur vs extérieur (le jour/nuit vient de l'horloge). Absent → extérieur. */
export function normalizeAmbiance(a: Scene['ambiance']): 'interieur' | 'exterieur' {
  return a === 'interieur' ? 'interieur' : 'exterieur';
}

/** Scène en intérieur (éclairée — l'obscurité de l'horloge ne s'y applique pas). */
export function isIndoor(scene: Pick<Scene, 'ambiance'>): boolean {
  return normalizeAmbiance(scene.ambiance) === 'interieur';
}
