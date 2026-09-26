/**
 * Schémas zod des formes d'une SCÈNE (`src/state/scene.ts`) — racine de documents `src/scenes`.
 *
 * ORDRE DU SEAM : ces schémas voient la scène telle qu'elle arrive du JSON, AVANT `normalizeScene`
 * (`src/state/scene.ts`, appelée en fin de `parseProject`). Les collections que `normalizeScene`
 * comble (`layers`/`entities`/`dialogues`/`triggers`/`encounters`/`flags`) sont donc OPTIONNELLES
 * ici, alors que le type manuscrit les déclare requises : un document ancien n'en porte pas.
 *
 * `Effect` et son `Flow` vivent dans `./effets.ts` (les 57 variantes) ; le vocabulaire feuille
 * partagé avec elles vit dans `./communs.ts`. Import de TYPE seul depuis `src/state` — aucun import
 * runtime de la couche state.
 *
 * Une scène est un DOCUMENT EMBARQUÉ du document de projet : elle S'ANNONCE dans la donnée
 * (`type: 'scene'`) et le schéma l'EXIGE (#1552) — même régime que le statbloc embarqué
 * (`./communs.ts` `customStatblockSchema`, `type: 'statblock'`). Son identité est NOMINALE, jamais
 * positionnelle : mesuré sur les 2 racines de `src/scenes` (4 projets, 28 scènes), 28/28 portent
 * `id` ET `label`, et le jeu résout une scène PAR ID — `sceneRegistry` (`src/state/store.ts:182-183`,
 * `registerScene`), le delta d'instance persisté par `sceneId` (`src/state/sceneInstance.ts:9`),
 * l'effet `transition: { scene }` et `worldMap.places[].scene`. Le `type` est posé sur la donnée
 * existante par `PROJECT_MIGRATIONS[6]` (`src/state/worldMap.ts`, `schema` 6 → 7).
 */
import { z } from 'zod';
import { difficultySchema, dir8Schema, entityAppearanceSchema, enumNomme, moneyPartialSchema } from '../grammaire/valeurs';
import { conditionSchema, flowTestSchema, gameOpSchema } from '../grammaire/mecanique';
import { refIndiceSchema } from '../grammaire/reference';
import { competenceChiffreeSchema, customStatblockSchema, ptSchema, wallSideSchema } from './communs';
import { sceneFlowSchema } from './effets';
import { idDe, porteLeMarqueur, refs } from '../grammaire/ref';
import { listeCle } from '../grammaire/collection-cle';
import { capDecorAdmis } from '../../props.types';
import { PARTS_RELIEF, type PartRelief } from '../../materials.types';
import type { AuthoredShipPoste } from '../../../engine/types';
import type { OptionalEntry } from '../../../engine/statEntry';

/** `Dir8` (`state/dir8.ts`) — orientation MONDE éditable, projetée au rendu. MÊME vocabulaire que le cap
 *  d'une place assise de décor (`defs/props.ts`) : la const NOMMÉE de la grammaire est partagée (#1694). */
export { dir8Schema };
/** Rectangle de zone/déclencheur — `z` = étage (défaut 0). */
export const rectSchema = z.strictObject({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), z: z.number().optional() });
/** Offre de couchage d'une scène/zone (`RestPlaces` sans `bord`, réservé au navire de campagne). */
export const restPlacesSchema = z.strictObject({ auberge: z.boolean().optional(), maison: z.boolean().optional(), camp: z.boolean().optional() });

/** `AuthoredShipPoste` (`engine/types.ts`) — pièce d'artillerie MONTÉE, hydratée au spawn. T3-b. */
export const authoredShipPosteSchema = z.custom<AuthoredShipPoste>();
/** `NavalTraitRef` (`engine/types.ts`) — Amélioration d'INSTANCE d'un navire (MDG 12). C'est la
 *  référence INDICÉE de la grammaire (`refIndiceSchema`), pas une seconde graphie de sa signature. */
export const navalTraitRefSchema = refIndiceSchema;
/** `OptionalEntry` (`engine/statEntry.ts`) — `TraitInstance` OU note composée. T3-b. */
export const optionalEntrySchema = z.custom<OptionalEntry>();
/** `SeatOccupant` (`state/seating.ts:53`) — un RANG du groupe (jamais un id de héros) ou un PNJ de la scène. */
export const seatOccupantSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('party'), rang: z.number() }),
  z.strictObject({ kind: z.literal('entity'), entityId: z.string() }),
]);

// ── Entité de scène ─────────────────────────────────────────────────────────────────────────────

/** Rôle d'une entité de scène. `personnage` = tout être animé (apparence libre via `ref` +
 *  dialogue/quête optionnel) — fusion des anciens `pnj`/`ennemi`, que le combat (encounters) et
 *  l'interaction (dialogueId) ne distinguaient pas. */
export const entityKindSchema = enumNomme({ heroStart: 'Départ héros', personnage: 'Personnage', prop: 'Décor' });

/** Sous-liste des décors à recette VOLUMIQUE : le marqueur `volume` de `defs/props.ts`. */
const estVolumique = porteLeMarqueur('prop', 'volume');

/** Une ACTION AUTHORÉE sur une instance de décor (#1687) — le vocabulaire OUVERT des gestes qu'un
 *  auteur pose. `id` : identité STABLE et non vide, unique sur l'entité (`listeCle`) ; `label` :
 *  surcharge d'AFFICHAGE, absent le libellé vient du catalogue i18n à la clé `usable.<id>` ; `consume` : l'entité est retirée après ;
 *  `unique` : jouable une fois (drapeau `__action_<entId>_<id>`), absent ou `false` = REJOUABLE ;
 *  `minutes` : ce que l'action coûte à l'horloge, absent = `TIME_COST.search` (`engine/timeCost.ts`). */
export const actionAuthoreeSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().optional(),
  flow: sceneFlowSchema,
  consume: z.boolean().optional(),
  unique: z.boolean().optional(),
  minutes: z.number().min(0).optional(),
});

/** Champs PARTAGÉS par les trois `kind` d'une entité de scène — le `ref`, lui, est propre à chaque branche. */
const baseDEntiteSchema = z.strictObject({
  id: z.string(),
  pos: z.strictObject({ x: z.number(), y: z.number() }),
  /** Couche d'empilement (cf. `layers`) : 0/absent = couche de base. */
  z: z.number().optional(),
  facing: dir8Schema.optional(),
  label: z.string().optional(),
  statblock: customStatblockSchema.optional(),
  /** Id d'un preset de `narratif.presetsPnj` — FK intra-document (vérifiée par `projetSchema`). */
  presetId: z.string().optional(),
  crewIds: z.array(z.string()).optional(),
  postes: z.array(authoredShipPosteSchema).optional(),
  upgrades: z.array(navalTraitRefSchema).optional(),
  dialogueId: z.string().optional(),
  appearance: entityAppearanceSchema.optional(),
  /** Animation d'ambiance en boucle (clé de `AMBIENT_CLIPS`). */
  anim: z.string().optional(),
  /** Arme ÉQUIPÉE — `trappingId` STABLE du catalogue d'armes, résolue par `weaponFromId`. */
  weapon: z.string().optional(),
  /** Empreinte D'INSTANCE d'un projet pré-migration : fossile TOLÉRÉ au parse, DÉPOUILLÉ au
   *  chargement par `stripLegacyFoot` (`src/state/scene.ts`) — jamais une donnée de scène, jamais
   *  lue par le moteur (la physique d'un décor vient de `PropData.foot`). Meurt au reset des saves.
   *  La garde #841 lit ce tag, GATÉ par sa liste nominative (`FOSSILES`, `sceneFieldEditability.mjs`) :
   *  le champ est hors périmètre éditable, et un tag posé sans entrée au registre est ROUGE.
   *  @fossile */
  foot: z.strictObject({ w: z.number(), h: z.number() }).optional(),
  /** Source de lumière : `radiusM` = rayon en MÈTRES (même unité qu'au catalogue, #1507) ;
   *  `tone` = id d'un `lightTones` (apparence seule). */
  light: z.strictObject({ radiusM: z.number(), tone: z.string().optional() }).optional(),
  /** Marchand : archétype + surcharges de prix et des 3 règles maison Marché (LDB 59/60). */
  merchant: z
    .strictObject({
      archetype: z.string(),
      settlement: z.enum(['village', 'ville', 'cite']).optional(),
      resaleRate: z.number().optional(),
      buyMarkup: z.number().optional(),
      restockDays: z.number().optional(),
      guild: z.boolean().optional(),
      marketMode: z.enum(['complet', 'sans-disponibilite', 'sans-marchandage', 'simplifie']).optional(),
      tenirComptes: z.boolean().optional(),
    })
    .optional(),
  /** JOUEUR de taverne (`NADJ 04 l.72`) : `gameId` de `tavernGames.json`, mise de DÉPART en sous. */
  tavernGame: z.strictObject({ gameId: z.string(), stakeBrass: z.number().optional() }).optional(),
  /** DÉCOR UTILISABLE — deux faits NOMMÉS que l'auteur pose sur CETTE instance : `assise` ouvre les
   *  places que le TYPE porte (`seatSlots` → `placesJouables`, `state/seating.ts` — la seule capacité
   *  qui vive sur le TYPE, donc la seule qu'un opt-in d'instance ait à ouvrir), `actions` porte les
   *  gestes AUTHORÉS. Les autres capacités (dialogue, marchand, jeu de taverne) vivent DÉJÀ sur
   *  l'instance et se dérivent sans lui (`actionsDe`, `state/usable.ts`). */
  usable: z
    .strictObject({
      assise: z.literal(true).optional(),
      actions: listeCle(actionAuthoreeSchema, 'id').optional(),
    })
    .optional(),
  /** RÔLE combat optionnel : ce que l'auteur choisit pour CETTE personne au combat. */
  combat: z
    .strictObject({
      /** OPTIONNELS choisis (`LDB 76 l.45`). */
      optionals: z.array(optionalEntrySchema).optional(),
      spells: refs('spell').optional(),
      /** Caractéristiques aléatoires au spawn (`LDB 77 l.108`). */
      randomChars: z.boolean().optional(),
      skills: z.array(competenceChiffreeSchema).optional(),
      /** Invisible en EXPLORATION (embuscade) : n'apparaît qu'au combat. */
      hiddenUntilCombat: z.boolean().optional(),
    })
    .optional(),
});

/** Branche d'une entité de scène : les champs partagés, son `kind` et sa `ref`. Le littéral
 *  DISCRIMINE la branche, `entityKindSchema` en NOMME la valeur (vocabulaire à libellés). */
const brancheDEntite = <R extends z.ZodType>(kind: EntityKindId, ref: R) =>
  z.strictObject({ ...baseDEntiteSchema.shape, kind: z.literal(kind).pipe(entityKindSchema), ref });

type EntityKindId = z.infer<typeof entityKindSchema>;

/** `SceneEntity` (`state/scene.ts:98`). `id` = identité STABLE partagée avec le `Combatant` au spawn.
 *  Union DISCRIMINÉE par `kind` : la `ref` d'un DÉCOR résout au registre `props.json` (`idDe('prop')`,
 *  #877) ; celle d'un personnage est une chaîne libre (#1882). Le `superRefine` de la branche `prop`
 *  porte ses deux invariants CROSS-CHAMP : la `ref` présente, et le cap d'un décor volumique. */
export const sceneEntitySchema = z.discriminatedUnion('kind', [
  brancheDEntite('heroStart', z.string().optional()),
  brancheDEntite('personnage', z.string().optional()),
  brancheDEntite('prop', idDe('prop').optional()).superRefine((ent, ctx) => {
    // REF DE DÉCOR — verrou AU PARSE (#877) : le type est REQUIS ; sa résolution au registre est celle
    // de la feuille `idDe('prop')`. Une ref absente se DIT ici.
    if (ent.ref === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['ref'],
        message: '« ref » absente — un décor NOMME son type au catalogue (props.json)',
      });
    }
    // CAP D'UN DÉCOR VOLUMIQUE — verrou AU PARSE (#1680 ligne 3) : un décor dont le TYPE porte une
    // recette ne prend qu'un cap CARDINAL. Sa recette tourne (`rotatePropLocal`) là où son empreinte
    // solide ne tourne pas (#1509) : une diagonale poserait son corps en travers de cases restées
    // traversables. La sous-liste se lit au régime vif, sinon au registre généré (`porteLeMarqueur`).
    if (capDecorAdmis(ent.ref !== undefined && estVolumique(ent.ref), ent.facing)) return;
    ctx.addIssue({
      code: 'custom',
      path: ['facing'],
      message: `décor volumique « ${ent.ref} » au cap ${ent.facing} — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)`,
    });
  }),
]);

// ── Architecture ────────────────────────────────────────────────────────────────────────────────

/** `ArchitectureRect` — emprise rectangulaire d'une part/masse. */
export const architectureRectSchema = z.strictObject({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
/** `ArchitectureEdgeRef` — arête porteuse d'une façade/d'un ornement. */
export const architectureEdgeRefSchema = z.strictObject({ x: z.number(), y: z.number(), side: wallSideSchema, z: z.number().optional() });
/** `ArchitecturePart` — empreinte nommée d'un étage. */
export const architecturePartSchema = z.strictObject({ id: z.string(), foot: architectureRectSchema });
/** `ArchitectureStorey` — un étage : ses parts et les zones-pièces qu'il couvre. */
export const architectureStoreySchema = z.strictObject({
  id: z.string(),
  z: z.number(),
  parts: listeCle(architecturePartSchema, 'id'),
  roomZoneIds: z.array(z.string()),
});
/** Nature d'un ornement de façade — les trois `KINDS_DE_DECOR` (`builders/walls.ts`) portent le libellé
 *  du prop que le catalogue de façades leur pose (`data/props.json`). */
export const facadeFeatureKindSchema = enumNomme({
  gable: 'Pignon',
  'stone-entry': 'Entrée de pierre',
  chimney: 'Cheminée',
  sign: 'Enseigne',
  'window-band': 'Bande de fenêtres',
  belfry: 'Clocheton',
});
/** `FacadeFeature` — ornement posé sur une arête de façade. */
export const facadeFeatureSchema = z.strictObject({
  id: z.string(),
  kind: facadeFeatureKindSchema,
  edge: architectureEdgeRefSchema,
  offset: z.number().optional(),
  width: z.number().optional(),
  appearance: z.string().optional(),
});
/** `FacadeSection` — pan de façade d'un étage. */
export const facadeSectionSchema = z.strictObject({
  id: z.string(),
  z: z.number(),
  edges: z.array(architectureEdgeRefSchema),
  appearance: z.string(),
  roomZoneIds: z.array(z.string()).optional(),
  features: listeCle(facadeFeatureSchema, 'id').optional(),
});
/** Profil de toiture d'une masse/d'une intention de toiture. */
export const roofProfileSchema = enumNomme({
  hip: 'Croupe (hip) — 4 pans',
  gable: 'Pignon (gable) — 2 pans + faîte',
  shed: 'Appentis (shed) — 1 pan',
  flat: 'Terrasse (flat) — plat',
});
/** Météo AUTHORÉE d'une Scène (`Scene.weather`, `LDB 14 l.68-82`) — lue par `sceneCombatModifiers` et
 *  nommée à l'écran par le hub de ville. */
export const sceneWeatherSchema = enumNomme(
  {
    clair: 'Ciel clair',
    pluie: 'Pluie',
    brouillard: 'Brouillard',
    neige: 'Haute épaisseur de neige',
    tempete: 'Tempête',
  },
  {
    brouillard: '−20 aux tirs (LDB 14 l.75)',
    tempete: '−20 aux attaques (LDB 14 l.76)',
    neige: '−30 à l’attaque et à l’esquive (LDB 14 l.82)',
  },
);
/** Côté d'égout bas (OBLIGATOIRE pour `shed`, ignoré sinon). */
export const eaveSideSchema = z.enum(['N', 'E', 'S', 'O']);
/**
 * Matière de COUVERTURE d'une masse : la porte est la fabrique canonique (`idDe('material', 'roof')`),
 * qui refine l'id AU PARSE contre la sous-liste `roof` de `materials.json` — une matière de décor ou de
 * relief posée sur un toit n'entre pas. La FORME DE SORTIE, elle, est DÉCLARÉE `string` et non inférée
 * (même patron que `RefASpecialisation`, `grammaire/ref.ts`) : `BuildingMass`/`RoofDefaults` sont des
 * `z.infer` LUS par l'éditeur et par la dérivation, où la matière est une valeur de `<select>` et un
 * littéral d'authoring — y faire remonter la marque de type imposerait un `as` à chaque site de saisie.
 * Que la matière COUVRE vraiment un pan (champ `couverture`) reste un sous-filtre de SCÈNE, dit par
 * `state/validateScene.ts` : le domaine `roof` porte aussi le « plan » vu du dessus.
 */
const couvertureSchema: z.ZodType<string, string> = idDe('material', 'roof');
/**
 * TYPE de bâtiment d'un corps architectural (`buildings.json`) : même porte et MÊME patron de sortie
 * que `couvertureSchema` ci-dessus — `ArchitectureBody` est un `z.infer` LU par l'éditeur, où le type
 * est une valeur de `<select>`, et par l'authoring TS des scénarios.
 */
const typeDeBatimentSchema: z.ZodType<string, string> = idDe('building');
/** Matière de RELIEF — même porte que `couvertureSchema`, sur la sous-liste `relief` de
 *  `materials.json` : une couverture de toit ou une matière de décor posée sur une falaise n'entre pas. */
const matiereReliefSchema: z.ZodType<string, string> = idDe('material', 'relief');
/**
 * MATIÈRES DE RELIEF de la scène, UNE par PARTIE émise (#1691) : falaise, rampe, dalle de tablier,
 * pilier. Les clés sont EXACTEMENT le vocabulaire `PARTS_RELIEF` de la couche donnée — celui que
 * `gameIso/builders/floors.ts` pose en `MaterialRef.part`, jamais une traduction.
 *
 * Le champ est EXIGÉ sur la scène : le builder n'a plus AUCUN choix de matière à faire, donc aucun
 * repli à offrir — une scène qui n'en porte pas est refusée AU PARSE, nommément, plutôt que rendue
 * avec une valeur devinée. La face d'un terrain à BLOC PLEIN, elle, tient sa matière du TERRAIN
 * (`terrains.json › matiere`) : ce record ne couvre que le relief du sol lui-même.
 */
export const reliefDefaultsSchema = z.strictObject(
  Object.fromEntries(PARTS_RELIEF.map((part) => [part, matiereReliefSchema])) as Record<
    PartRelief,
    typeof matiereReliefSchema
  >,
);
/**
 * AMBIANCE d'une scène — dedans/dehors, ce qui décide si l'éclairage suit l'horloge du monde.
 * Source UNIQUE de la liste : le champ `Scene.ambiance` ci-dessous ET la semence d'une scène neuve
 * (`schemas/defs/semences-de-scene.ts`) la lisent ici ; deux énumérations séparées laisseraient la
 * semence admettre une ambiance que la scène refuse.
 */
export const ambianceSchema = z.enum(['interieur', 'exterieur']);
/**
 * PLAGE de pente d'une toiture, en DEGRÉS — source UNIQUE des deux portes qui la tiennent : le PARSE
 * (`sceneRoofDefaultsSchema` et `roofDefaultsSchema` ci-dessous, une pente authorée hors plage est
 * refusée nommément) et la VALIDATION d'une masse matérialisée (`validateScene.ts`, qui SIGNALE au
 * lieu de refuser : une masse dérivée tient sa pente de `fittedPitchDeg`, rabattue par la portée).
 * Deux littéraux séparés laisseraient les deux portes diverger sans le dire.
 */
export const PENTE_TOIT_DEG = { min: 5, max: 75 } as const;
/**
 * TOITURE PAR DÉFAUT de la scène (#1715) — les trois valeurs que la dérivation des masses LIT quand
 * ni le corps ni le TYPE de bâtiment ne les surchargent (`toitureEffective`, `state/sceneEdit.ts`).
 *
 * Le champ est EXIGÉ sur la scène : la dérivation n'a plus AUCUN choix de toiture à faire, donc aucun
 * repli à offrir — une scène qui n'en porte pas est refusée AU PARSE, nommément. Pas de `profile`
 * ici : un profil non posé se choisit par PORTÉE (`ROOF_GABLE_SPAN_MAX_M`), c'est le socle qui le
 * résout ; un `profile` de scène serait soit mort, soit une seconde vérité face à la portée.
 */
export const sceneRoofDefaultsSchema = z.strictObject({
  /** Matière de COUVERTURE de dernier recours — même porte que `BuildingMass.material`. Le TYPE de
   *  bâtiment du corps (`buildings.json › roofMaterial`) et le corps lui-même passent avant. */
  material: couvertureSchema,
  /** Pente de RÉFÉRENCE en DEGRÉS : la plus RAIDE que la dérivation pose. `fittedPitchDeg`
   *  (`state/sceneEdit.ts`) la rabat jusqu'à ce que le comble tienne dans `riseMaxStoreys`. Bornée à
   *  `PENTE_TOIT_DEG` — la MÊME plage que celle dont `validateScene.ts` signale la sortie sur une
   *  masse matérialisée : une toiture plate ou verticale n'est pas une toiture. */
  pitchDeg: z.number().min(PENTE_TOIT_DEG.min).max(PENTE_TOIT_DEG.max),
  /** BORNE de comble en hauteurs d'ÉTAGE (`METRES_PER_LEVEL`) — c'est elle qui fait s'adapter la
   *  pente à la portée (#947). */
  riseMaxStoreys: z.number().int().min(1),
});
/** MASSE de bâtiment (#823, remplace `RoofSection` authoré à la main) : l'INTENTION, jamais la
 *  géométrie du toit — `gameIso/builders/roofs.ts` DÉRIVE pans/faîte/noues/croupes par une formule
 *  UNIQUE (`hauteur(case) = hauteurÉgout + distance(case, bord de la masse) × métresParCase ×
 *  tan(pente)`), et `roomZoneIds` par intersection avec `Scene.effectZones` (plus de redistribution
 *  manuelle). `z` = étage du PLANCHER SOMMET couvert par le toit (le dessous immédiat de la masse) ;
 *  c'est la COUCHE sur laquelle se lit la cote du plancher, jamais l'altitude elle-même : l'égout vaut
 *  la cote la plus HAUTE que `heightAt` porte sous l'emprise à cet étage + `WALL_H_M` — le toit
 *  s'assoit sur le sommet des murs, qui s'assoient sur le relief de LEUR case (cf. `resolveMass`,
 *  `buildWalls`). `levels` = nombre de niveaux couverts DEPUIS `z`
 *  en descendant : il désigne la PLAGE d'étages que la masse coiffe (`roomZoneIds`, couverture,
 *  chevauchement), jamais une hauteur. `footprint` doit être CONTIGU (4-connexe) et
 *  coïncider EXACTEMENT avec le plancher intérieur réel à l'étage `z` — fail-fast dans `buildScene`
 *  sinon (`validateBuildingMasses`, `state/mapSpec.ts`), pas une redevance silencieuse.
 *
 *  Note #829 : `ArchitectureBody.masses` déclarées ici sont des SURCHARGES, plus la règle. Par défaut,
 *  `buildScene` DÉRIVE les masses manquantes depuis le plancher réel (`deriveArchitectureMasses`,
 *  `state/sceneEdit.ts`) — éditer un mur/une pièce fait suivre la toiture sans redéclaration. Une masse
 *  authorée ici CORRIGE la dérivation là où elle se trompe (passage couvert, appentis,
 *  cour à ne pas coiffer via `ArchitectureBody.roofExclusions`, encorbellement voulu). */
export const buildingMassSchema = z.strictObject({
  id: z.string(),
  z: z.number(),
  footprint: z.array(architectureRectSchema),
  levels: z.number(),
  profile: roofProfileSchema,
  /** Pente en DEGRÉS (jamais des mètres par case — c'est cette unité qui a écrasé les toits d'un
   *  facteur deux, #825). */
  pitchDeg: z.number(),
  material: couvertureSchema,
  /** Axe de faîtage (gable/hip) — optionnel, défaut = le long axe de la masse ; OBLIGATOIRE si la
   *  masse est carrée (ambigu, fail-fast plutôt que deviner). Sans effet sur `shed`/`flat`. */
  ridge: z.enum(['x', 'y']).optional(),
  /** Côté d'égout bas — OBLIGATOIRE pour `shed` (aucun défaut deviné), ignoré sinon. */
  eaveSide: eaveSideSchema.optional(),
  /** Masse POSÉE par la dérivation (`deriveArchitectureMasses`, `state/sceneEdit.ts`) et non par un
   *  auteur : re-calculable à volonté — toute re-dérivation jette ces masses et les refait depuis le
   *  plan et `ArchitectureBody.roofDefaults`. Une masse SANS ce drapeau est une SURCHARGE authorée,
   *  jamais écrasée. C'est ce qui rend la dérivation IDEMPOTENTE, donc rejouable dans l'éditeur
   *  (#841) : l'intention de toiture y produit un effet immédiat sur le rendu, qui ne lit QUE les
   *  masses matérialisées. */
  derived: z.literal(true).optional(),
});
/** Intention de toiture pour les masses DÉRIVÉES d'un corps (#829) — réglée dans l'outil Architecture
 *  de l'éditeur. SURCHARGE PARTIELLE de la toiture de la SCÈNE (`Scene.roofDefaults`, #1715) : chaque
 *  champ absent se résout par `toitureEffective` (`sceneEdit.ts`) — type de bâtiment du corps puis
 *  scène pour la matière, corps puis scène pour la borne de comble ; la pente de RÉFÉRENCE, elle,
 *  reste celle de la scène (un `pitchDeg` de corps POSE une pente qui ne s'adapte jamais, il ne
 *  surcharge pas la référence) ; un profil absent se choisit par PORTÉE.
 *  Cette intention s'applique telle quelle à CHAQUE corps : le plancher réel se décompose en
 *  composantes 4-connexes, et chacune reçoit UNE masse (`deriveArchitectureMasses`, `sceneEdit.ts`),
 *  faîtage le long de sa plus grande dimension. Le profil déclaré ici PRIME sur la lecture de portée
 *  (`ROOF_GABLE_SPAN_MAX_M`) qui, à défaut, choisit entre pignon et croupe. */
export const roofDefaultsSchema = z.strictObject({
  /** Profil POSÉ par l'auteur : il PRIME sur la lecture de portée. ABSENT : la portée tranche entre
   *  pignon et croupe (`ROOF_GABLE_SPAN_MAX_M`, `sceneEdit.ts`) — la scène n'en porte aucun. */
  profile: roofProfileSchema.optional(),
  /** Pente en DEGRÉS POSÉE par l'auteur : elle ne s'adapte JAMAIS à la portée. ABSENTE : la
   *  dérivation calcule la pente de CHAQUE masse par `fittedPitchDeg` (`sceneEdit.ts`) — pente de
   *  référence rabattue jusqu'à ce que le comble tienne dans `riseMaxStoreys` (#947). Bornée à
   *  `PENTE_TOIT_DEG`, la même plage que la pente de référence de la scène. */
  pitchDeg: z.number().min(PENTE_TOIT_DEG.min).max(PENTE_TOIT_DEG.max).optional(),
  /** Matière de COUVERTURE des masses DÉRIVÉES — même porte que `BuildingMass.material`. SURCHARGE :
   *  absente = celle du TYPE de bâtiment du corps (`buildings.json › roofMaterial`) si le corps en
   *  porte un, sinon celle de la scène (`Scene.roofDefaults.material`). */
  material: couvertureSchema.optional(),
  /** Côté d'égout bas des masses dérivées — OBLIGATOIRE dès que `profile` vaut `shed` (le côté bas
   *  d'un appentis est une intention d'AUTEUR, aucun défaut deviné ; même contrat que
   *  `BuildingMass.eaveSide`, que la dérivation recopie depuis ici). Ignoré par les autres profils. */
  eaveSide: eaveSideSchema.optional(),
  /** BORNE de comble des masses dérivées, en hauteurs d'ÉTAGE (`METRES_PER_LEVEL`) : c'est elle qui
   *  fait s'adapter la PENTE à la portée (#947) — un corps profond porte un toit plus PLAT, sa
   *  couverture ne se découpe jamais. Absente = celle de la scène (`Scene.roofDefaults`). Sans effet
   *  dès que `pitchDeg` est posé : l'intention de l'auteur passe avant la borne. */
  riseMaxStoreys: z.number().int().min(1).optional(),
});
/** `ArchitectureBody` — corps architectural authoré (volumes, façades, toitures). */
export const architectureBodySchema = z.strictObject({
  id: z.string(),
  label: z.string().optional(),
  /** TYPE de bâtiment du corps (`buildings.json`) : il porte la couverture de référence du type et
   *  ses ornements d'identité (`buildingFeatures`, `gameIso/builders/props.ts`). ABSENT =
   *  corps sans identité de bâtiment (un bourg, un hameau : plusieurs bâtiments sous UN corps) — la
   *  dérivation le coiffe, aucun ornement n'est émis. */
  style: typeDeBatimentSchema.optional(),
  storeys: listeCle(architectureStoreySchema, 'id'),
  facades: listeCle(facadeSectionSchema, 'id'),
  /** SURCHARGES (#829, cf. doc `buildingMassSchema`) — jamais l'obligation de couvrir tout le bâti à
   *  la main : la dérivation couvre le reste. */
  masses: listeCle(buildingMassSchema, 'id'),
  /** Intention des masses DÉRIVÉES (#829) — SURCHARGE de `Scene.roofDefaults`, champ par champ. */
  roofDefaults: roofDefaultsSchema.optional(),
  /** Cases à NE JAMAIS couvrir par la dérivation par défaut (cour intérieure à ciel ouvert…), par
   *  étage — surcharge NÉGATIVE (#829), symétrique des `masses` (surcharge positive). */
  roofExclusions: z.array(z.strictObject({ z: z.number(), rect: architectureRectSchema })).optional(),
});

// ── Dialogue ────────────────────────────────────────────────────────────────────────────────────

/** `DialogueChoice` — `when` gate l'AFFICHAGE, `cost` est débité AVANT le flow. */
export const dialogueChoiceSchema = z.strictObject({
  /** LIBELLÉ du choix — rôle libellé de l'enveloppe (`label`), pas de la prose : c'est l'étiquette
   *  du bouton que le joueur clique, et l'archive de dialogue la stocke comme telle. */
  label: z.string(),
  /** Icône d'affordance (registre `src/ui/icons/`, rendue par `<Icon>` dans `DialogueBox`) — jamais
   *  un emoji collé au `label` (#290, doctrine anti-emoji). Id de string brute (couture UI hors de
   *  `src/state`, cf. CLAUDE.md : la logique reste pure, `<Icon>` valide l'id au rendu). */
  icon: z.string().optional(),
  /** Condition d'AFFICHAGE du choix (algèbre `Condition`, cf. `evalCondition`). Absente = toujours visible. */
  when: conditionSchema.optional(),
  /** Prix de l'option (service payant : auberge, péage, pot-de-vin…). Le choix est RÉPÉTABLE mais
   *  désactivé si on ne peut pas payer ; à la sélection, le montant est débité AVANT le flow. */
  cost: moneyPartialSchema.optional(),
  /** LOGIQUE exécutée à la sélection : séquence d'effets + branches `if`/`test` (exécutée par `runFlow`). */
  flow: sceneFlowSchema.optional(),
  /** Id du nœud suivant. */
  next: z.string().optional(),
});
/** `DialogueNode` — `speakerId` = entité de la scène dont le portrait/nom porte CE nœud. */
export const dialogueNodeSchema = z.strictObject({
  id: z.string(),
  /** Id d'une `SceneEntity` de la scène courante → son PORTRAIT et son NOM (label) pour CE nœud.
   *  Permet d'alterner les interlocuteurs dans une même conversation. À défaut, l'interlocuteur de
   *  SESSION (`state.dialogue.speakerId`, posé par `interactEntity` ou `startDialogue.speakerId`). */
  speakerId: z.string().optional(),
  desc: z.string(),
  choices: z.array(dialogueChoiceSchema),
});
/** `Dialogue` — arbre de nœuds, `start` = id du nœud d'entrée. */
export const dialogueSchema = z.strictObject({
  id: z.string(),
  start: z.string(),
  nodes: listeCle(dialogueNodeSchema, 'id'),
});

// ── Déclencheur ─────────────────────────────────────────────────────────────────────────────────

/** `Trigger` — `rect` (avec son étage `z`, #803) ET `when` en ET, évalués à l'entrée dans la zone. */
export const triggerSchema = z.strictObject({
  id: z.string(),
  /** Zone du déclencheur — son étage est `rect.z` (défaut 0, rez), comme `SceneEffectZone.z` (#782) :
   *  sans lui, un trigger posé au rez se déclenche depuis/vers l'étage au-dessus (`checkTriggers`, #803). */
  rect: rectSchema,
  once: z.boolean().optional(),
  /** Condition d'ENTRÉE (algèbre `Condition`, cf. `evalCondition`) — combinée en ET avec le `rect` et
   *  évaluée à l'entrée dans la zone. Absente = pas de garde (un pur événement horaire sans position =
   *  `delayedEffect`). Remplace les anciens `condition`/`temporalCondition`. */
  when: conditionSchema.optional(),
  /** LOGIQUE exécutée à l'entrée : séquence d'effets + branches `if`/`test` (exécutée par `runFlow`). */
  flow: sceneFlowSchema,
});

// ── Rencontre ───────────────────────────────────────────────────────────────────────────────────

/** Camp d'un membre/d'une circonstance de rencontre. */
export const campSchema = z.enum(['party', 'enemies']);
/** `ThreatTier` (`engine/advantagePool.ts`) — palier de Menace (`AA 11 l.53-65`). */
export const threatTierSchema = z.enum(['dangereuse', 'tresDangereuse', 'extreme']);

/** OBJECTIF de victoire d'une rencontre (#197) — AUTHORABLE en donnée, lu par `checkBattleOver`.
 *  Absent = `allEnemiesDead` (comportement HISTORIQUE, tous les scénarios existants inchangés).
 *  `destroyStructure` référence l'arête par son identifiant STABLE (x/y/side/z), le même couple que
 *  `structureIsDown`/`Combatant.structureEdge` (bélier-porte, `AA 10 l.94-102`) — la victoire se déclenche
 *  à la BRÈCHE, indépendamment du sort des combattants. `surviveRounds` : victoire posée au début du
 *  Round `rounds + 1` (le groupe a tenu N Rounds complets). `reachZone` réutilise le rectangle de zone
 *  des `Trigger`/`SceneEffectZone` (`inRect`, `combatGeometry.ts`) — aucun 2e mécanisme de zone.
 *  `woundsThreshold` (#215) : REDDITION à seuil de dommage partiel — `targetId` référence l'id
 *  STABLE d'une entité de scène (`SceneEntity.id` = `Combatant.id` au spawn, identité unifiée).
 *  Le RAW ne chiffre AUCUN seuil de reddition (silence confirmé) ; seul précédent chiffré, la
 *  reddition d'un monstre marin à mi-Blessures (`MDG 15 l.143`, `l.166-168`). `belowPercent` reste
 *  une valeur ÉDITABLE par rencontre, sans seuil RAW imposé (CLAUDE.md règle 7).
 *  `firstBlood` (#471) : DUEL JUDICIAIRE — « le premier sang est la première attaque qui cause une
 *  perte de plus de 3 Blessures […] ; un adversaire est incapable de continuer lorsqu'il est réduit
 *  à 0 Blessure » (`NADJ 06 l.175-177`) — les DEUX fins restent actives en parallèle, la seconde étant
 *  la fin standard (0 Blessure, `isOutOfAction`) déjà couverte hors `VictoryCondition`. `threshold`
 *  reste ÉDITABLE (défaut 3, seule valeur chiffrée par le RAW) — sévérité de la charge, CLAUDE.md
 *  règle 7. Testé PAR-COUP (`resolveFirstBlood`, combatFlow.ts) — pas un seuil cumulatif comme
 *  `woundsThreshold`. */
export const victoryConditionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('allEnemiesDead') }),
  z.strictObject({ type: z.literal('destroyStructure'), edge: architectureEdgeRefSchema }),
  z.strictObject({ type: z.literal('surviveRounds'), rounds: z.number() }),
  z.strictObject({
    type: z.literal('reachZone'),
    rect: z.strictObject({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
    camp: campSchema.optional(),
  }),
  /** Reddition à seuil de dommage partiel (#215) — `targetId` = `SceneEntity.id`. */
  z.strictObject({ type: z.literal('woundsThreshold'), targetId: z.string(), belowPercent: z.number() }),
  /** Duel judiciaire (`NADJ 06 l.175-177`) — `threshold` ÉDITABLE, défaut 3. */
  z.strictObject({ type: z.literal('firstBlood'), threshold: z.number().optional() }),
]);

/** Membre d'une rencontre : RÉFÉRENCE une `SceneEntity` (kind 'personnage') de la scène — c'est
 *  ELLE qui porte le profil (ref/statblock/apparence/arme/label/facing/combat). Le membre n'ajoute
 *  que le contexte propre à CETTE rencontre (camp, monture). */
export const encounterMemberSchema = z.strictObject({
  /** id de la `SceneEntity` enrôlée. */
  entityId: z.string(),
  /** Camp au spawn : 'ally' pose un combattant du côté des héros (ex. monture prêtée). Défaut 'enemy'. */
  side: z.enum(['enemy', 'ally']).optional(),
  /** PNJ allié piloté par l'IA (`Combatant.aiControlled`) : un allié qui AGIT SEUL (défenseur de siège,
   *  équipage d'une pièce…) au lieu d'être contrôlé par le joueur. Sans effet sur un membre 'enemy'. */
  ai: z.boolean().optional(),
  /** Combat monté (`LDB 14`) : cet acteur est une MONTURE rideable (peut être enfourché). */
  mount: z.boolean().optional(),
  /** id d'entité de la monture chevauchée au spawn (pré-monté) — réf stable (≠ ancien index `rides`). */
  ridesEntityId: z.string().optional(),
});

/** `EncounterDef` — les circonstances d'Avantage initial (`AA 11 l.53-65`) et la fin de combat. */
export const encounterDefSchema = z.strictObject({
  id: z.string(),
  /** Membres référençant des entités de la scène (peuplés par l'éditeur, ou à l'authoring via
   *  `buildEncounter`). SOURCE UNIQUE lue par le runtime — chaque membre pointe une `SceneEntity`
   *  'personnage' qui porte tout le profil (ref/statblock/apparence/arme/`combat.hiddenUntilCombat`). */
  members: listeCle(encounterMemberSchema, 'entityId').optional(),
  /** Scène/flag déclenché à la victoire — Flow (UN seul format avec `Trigger.flow`/`DialogueChoice.flow`).
   *  Aplati en `Effect[]` par `finishVictory` (la déférence transition/dialogue + la mesure de récompense
   *  restent sur la séquence plate). */
  onVictory: sceneFlowSchema.optional(),
  /** Objectif de victoire (#197). Absent = `allEnemiesDead` (défaut historique). */
  victoryCondition: victoryConditionSchema.optional(),
  /** Surprise (`LDB 13 l.52-81`) : camp pris en EMBUSCADE au début du combat. Les combattants de ce camp
   *  font un Test opposé de Perception vs la meilleure Discrétion des embusqueurs ; les vaincus gagnent
   *  l'État `Surpris`. Absent = personne n'est surpris. */
  surprise: campSchema.optional(),
  /** Avantage initial — Manœuvrabilité (`AA 11 l.53-65`) : le camp indiqué possède un avantage de
   *  mouvement au début du combat (monté, terrain arboricole/aérien favorable…) → +2 à sa réserve
   *  d'Avantage en mode « Avantage de groupe » (`startAdvantagePools`). Absent = pas de circonstance. */
  maneuverability: campSchema.optional(),
  /** Avantage initial — Menace (`AA 11 l.53-65`) : le camp `camp` représente une menace notoire pour
   *  l'autre camp (`tier` : dangereuse +1, très dangereuse +3, extrême +5) → crédite sa réserve
   *  d'Avantage en mode groupe. Absent = pas de circonstance. */
  threat: z.strictObject({ camp: campSchema, tier: threatTierSchema }).optional(),
  /** Avantage initial — Terrain (`AA 11 l.53-65`) : le camp `camp` tient une position avantageuse
   *  (fortification/couvert léger/hauteur → +1 ; `heavy` : couvert lourd/position décisive type pont
   *  → +2) → crédite sa réserve d'Avantage en mode groupe. Absent = pas de circonstance. */
  terrain: z.strictObject({ camp: campSchema, heavy: z.boolean().optional() }).optional(),
  /** Restriction d'armes à DISTANCE (#471) — Duel judiciaire (`NADJ 06 l.181`) : « les parties concernées
   *  […] ont normalement le libre choix des armes bien que la plupart des lois locales interdisent de
   *  faire appel à des projectiles. » DÉFAUT SÉMANTIQUE (#471 défaut 1) : « la plupart » = interdit PAR
   *  DÉFAUT quand `victoryCondition.type === 'firstBlood'` — champ ABSENT sur un duel = armes à distance
   *  INTERDITES ; l'auteur DÉROGE explicitement en posant `banRanged: false` (« pas toutes »). Champ
   *  SÉPARÉ de `victoryCondition` (une variante locale peut l'imposer à une rencontre qui n'est pas un
   *  `firstBlood`, valeur explicite `true`). Hors `firstBlood`, champ absent = armes à distance autorisées
   *  (défaut historique). Défaut résolu par `banRangedActive` (SEUL point), consommé par
   *  `resolveAttack`/`firedAttackBlock` (joueur ET IA). */
  banRanged: z.boolean().optional(),
  /** Rencontre de SIÈGE — FOYER de l'arbitrage utilisateur du 2026-09-04 (#1680, réponses verbatim à
   *  deux questions AskUserQuestion) : « Structures ciblables en siège seul », puis, à la question de ce
   *  qui fait d'un combat un siège, « Un drapeau de RENCONTRE, éditable ». Les STRUCTURES destructibles de la
   *  scène (porte, mur) entrent dans le choix de cible de l'IA ennemie. Défaut LITTÉRAL `false` —
   *  absent = pas de siège, AUCUNE dérivation depuis un autre champ (une rencontre
   *  `victoryCondition: destroyStructure` ne l'active pas d'elle-même). Résolu par `siegeActif`
   *  (SEUL point), consommé par `buildAiInput`. Le drapeau ne change ni les dégâts ni l'immunité
   *  (`structureImmune`), ni le ciblage JOUEUR. HOMONYMES sans rapport : `siegesRequis` (sièges de
   *  coop, `state/netOwnership.ts`), le décor `siege` (fauteuil), l'Atout d'arme `siege`
   *  (`ADE II 08 l.292`). */
  siege: z.boolean().optional(),
});

// ── Couches, zones, murs ────────────────────────────────────────────────────────────────────────

/** Une COUCHE d'empilement de la scène : son index discret `z` (0 = couche de base) — identité
 *  d'empilement, clé de pathfinding ET clé de tri de profondeur — et sa grille de tuiles (w×h aplatie).
 *  `height[]` est PARALLÈLE à `tiles` (indexation y·w+x) : la hauteur RÉELLE de la surface, en MÈTRES
 *  (échelle RAW 2 m/case, `LDB 15 l.12`). Absent = tout à 0 m. PORTEUSE (plus cosmétique) : pilote la
 *  marchabilité (rampe/falaise via `surfaceLink`), la distance/−10 en combat et la chute. Le RENDU pose
 *  la tuile au lift métrique (`metricToLift(height)`) ; le TRI garde `z` (occlusion dessus/dessous). */
export const layerSchema = z.strictObject({
  z: z.number(),
  /** Ids de TERRAIN résolus contre `terrains.json` (#1690) : une tuile qui nomme un sol absent du
   *  dataset est refusée AU PARSE, nommément, au lieu de peindre le repli d'alarme en silence. */
  tiles: z.array(idDe('terrain')),
  height: z.array(z.number()).optional(),
  /** CRÉNELURE (RENDU PUR) : parallèle à `tiles` (`y·w+x`). `null` = pas de crénelure ; une chaîne = id de
   *  structure crénelée (`structureAppearance.json`) → le crest builder (`crestGeometry`) en dérive des MERLONS
   *  sur le PÉRIMÈTRE (arête dont le voisin même-z n'est pas crénelé) — jamais à l'intérieur. Marqueur de
   *  DÉCORATION seulement (comme un toit auto-dessiné) : n'affecte NI la passabilité NI la LdV plongeante. */
  crenellated: z.array(z.string().nullable()).optional(),
});

/** `ZoneArea` — rectangle ou disque de Chebyshev (rayon en CASES). */
export const zoneAreaSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('rect'), x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  z.strictObject({ kind: z.literal('disc'), cx: z.number(), cy: z.number(), radius: z.number() }),
]);

/** `SceneEffectZone` — sans aucun champ mécanique la zone est DESCRIPTIVE (#782, `isDescriptiveZone`). */
export const sceneEffectZoneSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  area: zoneAreaSchema,
  presentation: z.enum(['interior', 'exterior']).optional(),
  /** EMPRISE EXACTE (pièce en L) : `area` n'est alors que la boîte englobante (`sceneZoneTiles`). */
  tiles: z.array(ptSchema).optional(),
  blocksLoS: z.boolean().optional(),
  /** Payload `GameOp[]` — vocabulaire UNIQUE partagé avec les zones de Sort (`applyOps`). */
  onCross: z.array(gameOpSchema).optional(),
  perRound: z.array(gameOpSchema).optional(),
  crossTest: flowTestSchema.optional(),
  /** BARRIÈRE : `blockGroups` vide/absent = bloque tout le monde ; sinon ids de Groupes. */
  barrier: z.strictObject({ blockGroups: z.array(z.string()).optional() }).optional(),
  z: z.number().optional(),
});

/** Nature d'une arête grimpable (`WallSeg.climb`). */
export const wallClimbSchema = z.strictObject({
  /** `ladder` = échelle ou surface facile (pas de Test, `LDB 15 l.53`) ; `surface` = paroi à prises
   *  (Test d'Escalade, `l.57`). */
  kind: z.enum(['ladder', 'surface']),
  /** Surface uniquement — difficulté du Test d'Escalade. `LDB 15 l.57` la laisse « définie par le MJ » ;
   *  sans MJ (règle 7) c'est un arbitrage ÉDITABLE par arête. Absent = `intermediaire` (défaut moteur). */
  difficulty: difficultySchema.optional(),
  /** Surface uniquement — paroi « bien trop compliquée » sans le Talent Grimpeur (`LDB 15 l.57`). */
  requiresGrimpeur: z.boolean().optional(),
});

/** `WallSeg` — cloison sur ARÊTE. `door` = franchissable (porte) ; `z` = étage. */
export const wallSegSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  side: wallSideSchema,
  z: z.number().optional(),
  door: z.boolean().optional(),
  /** Porte FERMÉE par défaut à l'ouverture de la scène (bloque vue+passage tant qu'on ne l'ouvre pas).
   *  Absent = ouverte par défaut (comportement historique : une porte est une ouverture franchissable). */
  closed: z.boolean().optional(),
  /** Structure destructible posée SUR l'arête (id de `structures.json`, ex. `porte-de-ville`). Tant
   *  qu'elle tient, l'arête bloque passage+vue comme un mur plein ; une fois ABATTUE (`structureIsDown`),
   *  l'arête devient une BRÈCHE franchissable et transparente. */
  structure: z.string().optional(),
  /** Apparence de rendu (`structureAppearance.json`) indépendante de `structure`. N'affecte ni
   *  résistance, ni couvert, ni collision : absent = apparence dérivée de la structure/façade. */
  appearance: z.string().optional(),
  /** L'arête porte une FENÊTRE (croisée vitrée). Un mur fenêtré reste un mur PLEIN pour le passage,
   *  la vue, la vision et la marchabilité (vitre SERTIE, pas une ouverture) : ni `wallIsOpen`, ni
   *  `vision`, ni `isWalkable` ne la lisent. La SEULE règle qui la lit est le COUVERT (`couvertDArete`,
   *  `state/lineOfSight.ts`) : la croisée coûte un cran à la Pénalité de Couvert de la Structure qui la
   *  porte — extrapolation MAISON du critique Percée (`AA 10 l.122`), qui dégrade d'un cran sans rendre
   *  transparent ; le canon ne chiffre pas la croisée. Côté rendu, apparence iso + POV (vitre ambrée). */
  window: z.boolean().optional(),
  /** ESCALADABLE (`LDB 15 l.53-57`) : l'arête sépare deux surfaces de hauteurs différentes (une FALAISE au
   *  sens `surfaceLink` — infranchissable à pied) qu'un Personnage peut GRIMPER.
   *  Bloque toujours passage+vue comme un mur PLEIN (une falaise n'est pas une ouverture) : la grimpe est
   *  un geste EXPLICITE, pas un franchissement de pathfinding. Résolu par `state/climbMove`. */
  climb: wallClimbSchema.optional(),
});

/**
 * UNE arête, UN segment — verrou AU PARSE (#1624). L'index d'arêtes (`state/wallIndex.ts`) est la
 * seule lecture de « quels segments tiennent cette arête ? », et ses consommateurs prennent le
 * PREMIER (`aretesA(...)[0]`, composé par `gameIso/builders/roofs.ts`) : un second segment sur la
 * même clé `x,y,side,z` serait une donnée MUETTE, jamais rendue ni lue. `setEdgeWall`
 * (`state/sceneEdit.ts`) dédoublonne à la pose, mais l'authoring littéral, `asciiMap`, les
 * migrations et l'import de projet ne passent pas par lui : le verrou est ICI. La clé est la MÊME
 * graphie que l'index d'arêtes.
 */
const cleDArete = { nom: 'x,y,side,z', de: (w: z.infer<typeof wallSegSchema>): string => `${w.x},${w.y},${w.side},${w.z ?? 0}` };

/** Ancre AUTHORÉE d'une Scène de bataille (S2) sur le plan : `MassBattleState.pool` = l'id d'une
 *  Scène de bataille, `ActivityDef` contexte 'bataille-round', posée sur une case de la carte. La
 *  Puissance des armées reste une abstraction NON rendue — seul l'emplacement de l'ACTION est posé.
 *  Consommé par `battleScenesToStations` (state/stations.ts) ; absence d'ancre → repli déterministe
 *  côté consommateur. */
export const sceneStationAnchorSchema = z.strictObject({
  sceneId: z.string(),
  pos: z.strictObject({ x: z.number(), y: z.number(), z: z.number().optional() }),
});

/** Les trois BLOCS DE LOGIQUE d'une scène, listes à clé : la scène les compose, et la modale « Avancé »
 *  de l'éditeur (`SCHEMA_BLOCS_AVANCES`) les reprend TELS QUELS — une seule déclaration de leur clé. */
export const dialoguesSchema = listeCle(dialogueSchema, 'id');
export const triggersSchema = listeCle(triggerSchema, 'id');
export const encountersSchema = listeCle(encounterDefSchema, 'id');

// ── La scène ────────────────────────────────────────────────────────────────────────────────────

/**
 * `Scene` (`state/scene.ts:370`) — l'agrégat. Les collections `layers`/`entities`/`dialogues`/
 * `triggers`/`encounters`/`flags`, requises sur le type manuscrit, sont OPTIONNELLES ici : le
 * schéma voit le document AVANT `normalizeScene`, qui les comble au SEUL point d'entrée.
 */
export const sceneSchema = z.strictObject({
  type: z.literal('scene'),
  id: z.string(),
  label: z.string(),
  /** Prose de la Scène — `.min(1).optional()`, comme l'enveloppe de document
   *  (`grammaire/document.ts`) : une prose ABSENTE est une CLÉ ABSENTE, jamais une chaîne vide (le
   *  troisième état, vu « présent » par les uns et « absent » par les autres). */
  desc: z.string().min(1).optional(),
  dimensions: z.strictObject({ w: z.number(), h: z.number() }),
  /** Échelle métrique d'une CASE (m/case) — défaut 2 ; ≥ 4 = Scène MER (`isMerScene`). */
  metresPerTile: z.number().optional(),
  ambiance: ambianceSchema.optional(),
  /** Classification écologique lue par les attributs de Domaine (`LDB 48 l.690`). */
  environment: z.enum(['rural', 'urbain', 'sauvage']).optional(),
  /** Météo (`LDB 14 l.68-82`) — l'ABSENCE est une VALEUR : temps non spécifié, aucun modificateur de
   *  combat et aucune ambiance de météo. Lue SANS REPLI par `state/sceneRules.ts`
   *  (`sceneCombatModifiers`) et par `gameIso/catalog/ambiance.ts`. */
  weather: sceneWeatherSchema.optional(),
  /** Id d'un `lightLevels`, ou `'auto'`/absent = suit l'horloge via `ambiance`. */
  ambientLight: z.string().optional(),
  /** NORD de la carte — rotation horaire en degrés `[0,360[` du nord réel (posé par `setNorthDeg`). */
  northDeg: z.number().optional(),
  rest: z
    .strictObject({
      auberge: z.boolean().optional(),
      maison: z.boolean().optional(),
      camp: z.boolean().optional(),
      quality: z.enum(['normale', 'pietre']).optional(),
    })
    .optional(),
  /** Offre de repos PAR ZONE — prioritaire sur `rest` là où le groupe se tient. */
  restZones: z
    .array(
      z.strictObject({
        rect: rectSchema,
        places: restPlacesSchema,
        quality: z.enum(['normale', 'pietre']).optional(),
      }),
    )
    .optional(),
  effectZones: listeCle(sceneEffectZoneSchema, 'id').optional(),
  /** Ids de pistes du registre audio ; `null` = SILENCE forcé, absent = AUTOMATIQUE. */
  music: z.strictObject({ ambient: z.string().nullable().optional(), combat: z.string().nullable().optional() }).optional(),
  /** Matière de chaque PARTIE de relief (#1691) — EXIGÉE : c'est la donnée que le builder LIT. */
  reliefDefaults: reliefDefaultsSchema,
  /** Toiture par défaut de la scène (#1715) — EXIGÉE : c'est la donnée que la dérivation LIT. */
  roofDefaults: sceneRoofDefaultsSchema,
  layers: listeCle(layerSchema, 'z').optional(),
  /** Cloisons sur arête — au plus UNE par clé `x,y,side,z` (`cleDArete`). */
  walls: listeCle(wallSegSchema, cleDArete).optional(),
  entities: listeCle(sceneEntitySchema, 'id').optional(),
  /** `SeatAssignments` (`state/seating.ts:65`) — `propId → slotId → occupant` (rang du groupe ou entité). */
  seatAssignments: z.record(z.string(), z.record(z.string(), seatOccupantSchema)).optional(),
  architecture: listeCle(architectureBodySchema, 'id').optional(),
  dialogues: dialoguesSchema.optional(),
  triggers: triggersSchema.optional(),
  encounters: encountersSchema.optional(),
  stations: listeCle(sceneStationAnchorSchema, 'sceneId').optional(),
  flags: z.record(z.string(), z.boolean()).optional(),
  /** Points d'arrivée nommés — `z` = étage visé (défaut 0, #835 FU-5). */
  entryPoints: z.record(z.string(), z.strictObject({ x: z.number(), y: z.number(), z: z.number().optional() })).optional(),
  startMessage: z.string().optional(),
}).superRefine((scene, ctx) => {
  // CARDINAL de la grille (#1789) : chaque tableau PARALLÈLE d'une couche porte EXACTEMENT `w×h`
  // entrées — la grille est aplatie, indexée `y·w+x` (`tiles`, et quand ils sont présents `height`
  // et `crenellated`) ; un tableau plus court rendrait des trous que les lectures devraient replier,
  // et le repli masquerait le document malformé. C'est ce qui permet à `tileAt` de n'avoir AUCUN
  // repli de tuile (`state/scene.ts`) et à `heightAt` de ne replier que l'absence du tableau ENTIER.
  const attendu = scene.dimensions.w * scene.dimensions.h;
  (scene.layers ?? []).forEach((l, i) => {
    const paralleles: [string, number | undefined][] = [['tiles', l.tiles.length], ['height', l.height?.length], ['crenellated', l.crenellated?.length]];
    for (const [champ, n] of paralleles) {
      if (n === undefined || n === attendu) continue;
      ctx.addIssue({
        code: 'custom',
        path: ['layers', i, champ],
        message: `\`${champ}\` porte ${n} entrée(s) pour une grille ${scene.dimensions.w}×${scene.dimensions.h} — il en faut EXACTEMENT ${attendu}`,
      });
    }
  });
});
