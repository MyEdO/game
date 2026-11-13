import { nommerChamps, metaDesChamps, nommerNoeud, type MetaDesChamps } from '../grammaire/meta';
/**
 * Schémas zod des formes d'une SCÈNE (`src/noyau/monde/scene.ts`) — racine de documents `src/scenes`.
 *
 * ORDRE DU SEAM : ces schémas voient la scène telle qu'elle arrive du JSON, AVANT `normalizeScene`
 * (`src/noyau/monde/scene.ts`, appelée en fin de `parseProject`). Les collections que `normalizeScene`
 * comble (`layers`/`entities`/`dialogues`/`triggers`/`encounters`/`flags`) sont donc OPTIONNELLES
 * ici, alors que le type manuscrit les déclare requises : un document ancien n'en porte pas.
 *
 * `Effect` et son `Flow` vivent dans `./effets.ts` (les 59 variantes) ; le vocabulaire feuille
 * partagé avec elles vit dans `./communs.ts`.
 *
 * Une scène est un DOCUMENT EMBARQUÉ du document de projet : elle S'ANNONCE dans la donnée
 * (`type: 'scene'`) et le schéma l'EXIGE (#1552) — même régime que le statbloc embarqué
 * (`./communs.ts` `customStatblockSchema`, `type: 'statblock'`). Son identité est NOMINALE, jamais
 * positionnelle : mesuré sur les 2 racines de `src/scenes` (4 projets, 28 scènes), 28/28 portent
 * `id` ET `label`, et le jeu résout une scène PAR ID — `sceneRegistry` (`src/noyau/monde/registreDesScenes.ts`,
 * `registerScene`), le delta d'instance persisté par `sceneId` (`src/noyau/monde/sceneInstance.ts:9`),
 * l'effet `transition: { scene }` et `worldMap.places[].scene`.
 */
import { tableTotale } from '../../../lib/tableTotale';
import { z } from 'zod';
import { ouReserve, roleAmbiantSchema } from '../grammaire/valeurs';
import {
  amateurSchema,
  cell2Schema,
  deckCoverSchema,
  difficultySchema,
  dir8Schema,
  entityAppearanceSchema,
  enumNomme,
  equipeSchema,
  idDIconeSchema,
  moneyPartialSchema,
  pointDuPlanSchema,
  settlementSchema,
} from '../grammaire/valeurs';
import { joursDeReassortSchema, majorationDAchatSchema, tauxDeRachatSchema } from '../defs/merchants';
import { conditionSchema, executeesDe, flowTestSchema, variante } from '../grammaire/mecanique';
import { navalTraitRefSchema, optionalSwapSchema, traitInstanceSchema } from '../grammaire/reference';
import {
  competenceChiffreeSchema,
  couvreSchema,
  customStatblockSchema,
  DIALOGUES_DE_LA_SCENE,
  PERSONNAGES_DE_LA_SCENE,
  PORTEES_DE_LA_SCENE,
  ptSchema,
  wallSideSchema,
} from './communs';
import { sceneFlowSchema } from './effets';
import { idDe, porteLeMarqueur, recordDIds, ref, refOuSpec, refs, type PorteeLocale } from '../grammaire/ref';
import { champsDeChoix } from '../grammaire/choixDeCreation';
import { parcoursDe, refusDuParcours, type ParcoursDeCarriere } from '../../../engine/pnjDeCarriere';
import { CIBLE_D_APPARTENANCE, DECLARABLE_PAR_UN_PORTEUR, INSTANCIABLE_PAR_ID } from '../grammaire/sousListes';
import { listeCle, ouvrirPortees } from '../grammaire/collection-cle';
import { proseNommee } from '../grammaire/prose';
import { estUnNavireAPonts, findTrappingById, siegeEngines } from '../../index';
import { chargeLArme } from '../../../engine/items';
import { capDecorAdmis } from '../../props.types';
import { estCardinal } from '../../../geometry/dir8';
import { PARTS_RELIEF } from '../../materials.types';
import { posteSideSchema } from '../defs/vehicles';

/** Un terrain est un id de catalogue (cf. src/noyau/monde/terrain.ts). L'intersection vide garde l'alias
 *  VISIBLE au checker (type contextuel d'un littéral) sans rien refuser à `string` (#1789). */
export type Terrain = string & {};

/** Les nœuds du dialogue, que désignent `start` et `choices[].next`. */
const NOEUDS = { collection: 'nodes', catalogue: 'nœuds du dialogue' } as const satisfies PorteeLocale;
/** Les membres de la rencontre, que désigne la cible de son objectif `woundsThreshold`. #3606 */
export const MEMBRES_DE_LA_RENCONTRE = { collection: 'members', catalogue: 'membres de la rencontre' } as const satisfies PorteeLocale;
/** Les montures de la rencontre, ses membres qui portent `mount`, que désigne la monture chevauchée d'un membre. #3606 */
export const MONTURES_DE_LA_RENCONTRE = { collection: 'members', catalogue: 'montures de la rencontre', retient: [{ champ: 'mount' }] } as const satisfies PorteeLocale;

/** `Dir8` (`geometry/dir8.ts`) — orientation MONDE éditable, projetée au rendu. MÊME vocabulaire que le cap
 *  d'une place assise de décor (`defs/props.ts`) : la const NOMMÉE de la grammaire est partagée (#1694). */
export { dir8Schema };
/** Rectangle de zone/déclencheur — `z` = étage (défaut 0). */
export const rectSchema = nommerChamps(z.strictObject({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), z: z.number().optional() }), { x: { label: "abscisse" }, y: { label: "ordonnée" }, w: { label: "largeur" }, h: { label: "hauteur" }, z: { label: "étage" } });
/** Offre de couchage d'une scène/zone (`RestPlaces` sans `bord`, réservé au navire de campagne). */
export const restPlacesSchema = nommerChamps(z.strictObject({ auberge: z.boolean().optional(), maison: z.boolean().optional(), camp: z.boolean().optional() }), { auberge: { label: "auberge" }, maison: { label: "chez soi" }, camp: { label: "camp" } });

/** `AuthoredShipPoste` (`engine/types.ts`) — pièce d'artillerie MONTÉE, hydratée au spawn (`hydratePoste`, #222). MDG 12-13 */
export const authoredShipPosteSchema = nommerChamps(z.strictObject({
  trappingId: idDe('trapping', INSTANCIABLE_PAR_ID, { nue: true }),
  /** Absent : pivot libre (`inFireArc`). */
  side: posteSideSchema.optional(),
  cover: deckCoverSchema.optional(),
  /** `crewIds[0]` : le chef de pièce. */
  crewIds: z.array(z.string()).optional(),
  /** LDB 62 l.229/231 */
  chambered: z.number().optional(),
  /** MDG 12 / LDB 62 l.333 */
  loaded: z.boolean().optional(),
  /** LDB 62 l.335 */
  reloadProgress: z.number().optional(),
  /** Le coffre de la pièce : chaque munition du catalogue par son id, sa quantité. MDG 12 l.410-424 */
  ammo: recordDIds('trapping', nommerNoeud(z.number().int().min(1), { nom: 'quantité' }), 'ammunition').optional(),
  /** L'une des munitions du coffre. MDG 12 l.410-424 */
  selectedAmmo: ref('trapping', undefined, 'ammunition').optional(),
  anchor: ptSchema.optional(),
}), { trappingId: { label: "pièce", texte: { regime: "technique" } }, side: { label: "côté" }, cover: { label: "couvert" }, crewIds: { label: "servants", texte: { regime: "technique" } }, chambered: { label: "munitions chambrées" }, loaded: { label: "chargée" }, reloadProgress: { label: "progression de la recharge" }, ammo: { label: "munitions", texte: { regime: "technique" } }, selectedAmmo: { label: "munition choisie" }, anchor: { label: "ancre" } });
/** `SeatOccupant` (`noyau/monde/seating.ts:53`) — un RANG du groupe (jamais un id de héros) ou un PNJ de la scène. */
export const seatOccupantSchema = z.discriminatedUnion('kind', [
  nommerChamps(z.strictObject({ kind: z.literal('groupe'), rang: z.number() }), { kind: { label: "type"  }, rang: { label: "rang" } }),
  nommerChamps(z.strictObject({ kind: z.literal('entite'), entityId: z.string() }), { kind: { label: "type"  }, entityId: { label: "entité" , texte: { regime: "technique"} } }),
]);

// ── Entité de scène ─────────────────────────────────────────────────────────────────────────────

/** Rôle d'une entité de scène. `personnage` = tout être animé (apparence libre via `ref` +
 *  dialogue/quête optionnel) — fusion des anciens `pnj`/`ennemi`, que le combat (encounters) et
 *  l'interaction (dialogueId) ne distinguaient pas. */
export const entityKindSchema = enumNomme({ heroStart: 'Départ héros', personnage: 'Personnage', prop: 'Décor' });

/** Sous-liste des décors à recette VOLUMIQUE : le marqueur `volume` de `defs/props.ts`. */
const estVolumique = porteLeMarqueur('prop', 'volume');

/** Les PORTEURS du type d'une entité, par `kind` (#877, #1882) : une entité NOMME son type, ou elle est
 *  refusée. La PRÉSENCE se juge au parse (`superRefine` de sa branche de `sceneEntitySchema`) et dans
 *  `validateScene` ; la RÉSOLUTION, au parse, par la `ref` de chaque corps (`decor`, `CLES_DU_CORPS`). Une chaîne
 *  vide n'est pas un porteur. Un personnage porte un corps au plus (`refusDeLEntite`) ; l'exclusivité de ses autres porteurs
 *  est #1892. */
export const PORTEURS_DU_TYPE = {
  prop: { porteurs: ['decor'], entite: 'décor', nomme: 'son type au catalogue (props.json)' },
  personnage: { porteurs: ['creature', 'vehicule', 'engin', 'statblock', 'presetId'], entite: 'personnage', nomme: 'sa fiche (bestiaire, coque, engin de siège, statbloc ou preset de PNJ)' },
} as const satisfies Partial<Record<z.infer<typeof entityKindSchema>, { porteurs: readonly PorteurDuType[]; entite: string; nomme: string }>>;

/** Le corps d'un personnage, chacun désigné dans son catalogue : une créature du bestiaire (`creature`), une coque
 *  (`vehicule`), un engin de siège (`engin`, `siegeEngines`). Un personnage en porte un au plus (#2968). */
type CorpsDuPersonnage = 'creature' | 'vehicule' | 'engin';
const CLES_DU_CORPS = ['creature', 'vehicule', 'engin'] satisfies CorpsDuPersonnage[];
type PorteurDuType = 'decor' | CorpsDuPersonnage | 'statblock' | 'presetId';

const regleDuType = (kind: string) =>
  (PORTEURS_DU_TYPE as Partial<Record<string, (typeof PORTEURS_DU_TYPE)[keyof typeof PORTEURS_DU_TYPE]>>)[kind];

/** La faute d'une entité qui ne porte AUCUN des porteurs de son `kind`, dite SANS nommer l'entité :
 *  au schéma, c'est le LIEU de la faute qui la nomme. `undefined` si elle porte un porteur, ou si son
 *  `kind` n'en exige aucun. Source unique du schéma et de `typeNonNomme`. */
export function porteurAbsent(ent: { kind: string } & Partial<Record<PorteurDuType, unknown>>): string | undefined {
  const regle = regleDuType(ent.kind);
  if (!regle || regle.porteurs.some((p: PorteurDuType) => ent[p] !== undefined && ent[p] !== '')) return undefined;
  const cles = regle.porteurs.map((p) => `« ${p} »`);
  const absence = cles.length === 1 ? `${cles[0]} absent` : `${cles.join(', ')} absents`;
  return `${absence} — un ${regle.entite} NOMME ${regle.nomme}`;
}

/** `porteurAbsent`, l'entité NOMMÉE : la faute dite hors de tout lieu (patch d'éditeur refusé, fiche
 *  absente au spawn, migration). */
export function typeNonNomme(ent: { id: string; kind: string } & Partial<Record<PorteurDuType, unknown>>): string | undefined {
  const faute = porteurAbsent(ent);
  return faute && `${regleDuType(ent.kind)!.entite} « ${ent.id} » : ${faute}`;
}

/** Une ACTION AUTHORÉE sur une instance de décor (#1687) — le vocabulaire OUVERT des gestes qu'un
 *  auteur pose. `id` : identité STABLE et non vide, unique sur l'entité (`listeCle`) ; `label` :
 *  surcharge d'AFFICHAGE, absent le libellé vient du catalogue i18n à la clé `usable.<id>` ; `consume` : l'entité est retirée après ;
 *  `unique` : jouable une fois (drapeau `__action_<entId>_<id>`), absent ou `false` = REJOUABLE ;
 *  `minutes` : ce que l'action coûte à l'horloge, absent = `TIME_COST.search` (`engine/timeCost.ts`). */
export const actionAuthoreeSchema = nommerChamps(z.strictObject({
  id: z.string().min(1),
  label: z.string().optional(),
  flow: sceneFlowSchema,
  consume: z.boolean().optional(),
  unique: z.boolean().optional(),
  minutes: z.number().min(0).optional(),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, flow: { label: "enchaînement", transparent: true }, consume: { label: "consommer" }, unique: { label: "unique" }, minutes: { label: "minutes" } });

/** JOUEUR de taverne (`NADJ 04 l.72`, `SceneEntity.tavernGame`) : `id` du jeu de `tavernGames.json`, mise de DÉPART en sous,
 *  entière et jamais négative (invariant d'ingénierie). */
export const offreDeTaverneSchema = ref('tavernGame', { stakeBrass: nommerNoeud(z.number().int().min(0).optional(), { nom: 'mise en cuivre' }) });

/** Le système d'achat et de vente d'un marchand, qui surcharge la règle `marche-mode` (LDB 59 l.15). */
const marketModeSchema = enumNomme({
  complet: 'Complet (Disponibilité + Marchandage)',
  'sans-disponibilite': 'Sans Disponibilité (tout en stock)',
  'sans-marchandage': 'Sans Marchandage (prix fixes)',
  simplifie: 'Simplifié (les deux désactivés)',
});

/** Marchand d'une entité de scène : son archétype, et les surcharges de ses prix (`defs/merchants.ts`) et des 3 règles
 *  maison Marché (LDB 59/60). */
export const marchandDeSceneSchema = nommerChamps(z.strictObject({
  archetype: ref('merchant'),
  settlement: settlementSchema.optional(),
  resaleRate: tauxDeRachatSchema.optional(),
  buyMarkup: majorationDAchatSchema.optional(),
  restockDays: joursDeReassortSchema.optional(),
  guild: z.boolean().optional(),
  marketMode: marketModeSchema.optional(),
  tenirComptes: z.boolean().optional(),
}), { archetype: { label: "archétype" , texte: { regime: "technique"} }, settlement: { label: "localité"  }, resaleRate: { label: "taux de revente" }, buyMarkup: { label: "majoration d’achat" }, restockDays: { label: "jours de réapprovisionnement" }, guild: { label: "guilde" }, marketMode: { label: "régime de marché"  }, tenirComptes: { label: "tenir les comptes" } });

/** L'inventaire d'auteur d'un personnage : chaque objet du catalogue par son id, vrai s'il le porte (`isWearable` ;
 *  une arme se tient par les sets d'armes). Il devient les objets du combattant au spawn. LDB 77 l.7, #3684 */
export const inventaireDAuteurSchema = recordDIds('trapping', nommerNoeud(z.boolean(), { nom: 'porté' }), INSTANCIABLE_PAR_ID);
export type InventaireDAuteur = z.input<typeof inventaireDAuteurSchema>;

/** La faute d'un personnage porté à un parcours de carrière (`parcoursDe`), `undefined` s'il est admis ou n'en porte
 *  pas : un parcours part d'un profil du Bestiaire (`creature`), sans statbloc ni preset, et la carrière actuelle
 *  l'habille, sans tenue d'auteur (EDO 11 l.19) ; puis `refusDuParcours`. Des choix de carrière sans carrière
 *  sont refusés. */
export function refusDuPnjDeCarriere(ent: Partial<ParcoursDeCarriere> & { statblock?: unknown; presetId?: string; creature?: { id: string }; appearance?: { tenue?: string } }): string | undefined {
  const parcours = parcoursDe(ent);
  if (!parcours) return ent.talentsDeCarriere || ent.competencesDeCarriere || ent.dotationsDeCarriere ? 'choix de carrière sans carrière' : undefined;
  if (ent.statblock || ent.presetId || !ent.creature) return 'un PNJ de carrière part d’un profil du Bestiaire (« creature »), sans statbloc ni preset';
  if (ent.appearance?.tenue) return 'un PNJ de carrière porte la tenue de sa carrière actuelle, sans tenue d’auteur';
  return refusDuParcours(parcours);
}

/** Un élément de `combat.optionals` d'une entité de scène (`LDB 76 l.45`) : un Trait posé, ou une note « swap » du
 *  Bestiaire, posée entière. */
export const optionalDeSceneSchema = z.union([traitInstanceSchema, optionalSwapSchema]);
export type OptionalDeScene = z.output<typeof optionalDeSceneSchema>;

/** Champs PARTAGÉS par les trois `kind` d'une entité de scène — le corps, lui, est propre à chaque branche. */
const baseDEntiteSchema = nommerChamps(z.strictObject({
  id: z.string(),
  pos: cell2Schema,
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
  dialogueId: ref(DIALOGUES_DE_LA_SCENE).optional(),
  /** Contrepartie d'un Test de Sociabilité qui lit les jetons de Mécénat — arbitrage MAISON (ACE 12 l.60-62). */
  amateur: amateurSchema.optional(),
  appearance: entityAppearanceSchema.optional(),
  anim: roleAmbiantSchema.optional(),
  /** Inventaire d'auteur d'un personnage, objets du catalogue. */
  inventaire: inventaireDAuteurSchema.optional(),
  /** Parcours de carrière d'un personnage (`ParcoursDeCarriere`, `engine/pnjDeCarriere.ts`) : chaque carrière au
   *  Niveau atteint, la dernière actuelle ; les Talents choisis et les Compétences des emplacements à choix, par
   *  carrière ; les choix de dotation de la carrière actuelle. EDO 11 l.17-21 */
  carrieres: recordDIds('career', nommerNoeud(z.number().int().min(1), { nom: 'niveau' })).optional(),
  talentsDeCarriere: recordDIds('career', z.array(refOuSpec('talent'))).optional(),
  competencesDeCarriere: recordDIds('career', z.array(refOuSpec('skill'))).optional(),
  dotationsDeCarriere: champsDeChoix.trappingChoices,
  /** Source de lumière : `radiusM` = rayon en MÈTRES (même unité qu'au catalogue, #1507) ;
   *  `tone` = id d'un `lightTones` (apparence seule). */
  light: nommerChamps(z.strictObject({ radiusM: z.number(), tone: idDe('lightTone').optional() }), { radiusM: { label: "rayon en mètres" }, tone: { label: "ton" , texte: { regime: "technique"} } }).optional(),
  merchant: marchandDeSceneSchema.optional(),
  tavernGame: offreDeTaverneSchema.optional(),
  /** DÉCOR UTILISABLE — deux faits NOMMÉS que l'auteur pose sur CETTE instance : `assise` ouvre les
   *  places que le TYPE porte (`seatSlots` → `placesJouables`, `noyau/monde/seating.ts` — la seule capacité
   *  qui vive sur le TYPE, donc la seule qu'un opt-in d'instance ait à ouvrir), `actions` porte les
   *  gestes AUTHORÉS. Les autres capacités (dialogue, marchand, jeu de taverne) vivent DÉJÀ sur
   *  l'instance et se dérivent sans lui (`actionsDe`, `noyau/monde/usable.ts`). */
  usable: nommerChamps(z
    .strictObject({
      assise: z.literal(true).optional(),
      actions: listeCle(actionAuthoreeSchema, 'id').optional(),
    }), { assise: { label: "assise" }, actions: { label: "actions" } })
    .optional(),
  /** RÔLE combat optionnel : ce que l'auteur choisit pour CETTE personne au combat. */
  combat: nommerChamps(z
    .strictObject({
      /** OPTIONNELS choisis (`LDB 76 l.45`). */
      optionals: z.array(optionalDeSceneSchema).optional(),
      /** Sorts choisis par l'auteur (`sortsDuPnj`, `engine/sortsDuPnj.ts`). #3715 */
      spells: refs('spell').optional(),
      /** Caractéristiques aléatoires au spawn (`LDB 77 l.108`). */
      randomChars: z.boolean().optional(),
      skills: z.array(competenceChiffreeSchema).optional(),
      /** Invisible en EXPLORATION (embuscade) : n'apparaît qu'au combat. */
      hiddenUntilCombat: z.boolean().optional(),
    }), { optionals: { label: "options" }, spells: { label: "sorts" , texte: { regime: "technique"} }, randomChars: { label: "caractéristiques aléatoires" }, skills: { label: "Compétences" }, hiddenUntilCombat: { label: "caché jusqu’au combat" } })
    .optional(),
  couvre: couvreSchema.optional(),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, pos: { label: "position" }, z: { label: "étage" }, facing: { label: "orientation"  }, label: { label: "libellé" , texte: { regime: "designation"} }, statblock: { label: "profil" }, presetId: { label: "profil précomposé" , texte: { regime: "technique"} }, crewIds: { label: "membres d’équipage" , texte: { regime: "technique"} }, postes: { label: "postes" }, upgrades: { label: "améliorations" }, dialogueId: { label: "dialogue" , texte: { regime: "technique"} }, amateur: { label: "amateur des arts", hint: "arbitrage maison (ACE 12 l.60-62) : contrepartie d’un Test de Sociabilité, lue par les jetons de Mécénat" }, appearance: { label: "apparence" }, anim: { label: "animation" , texte: { regime: "technique"} }, inventaire: { label: "inventaire" , texte: { regime: "technique"} }, carrieres: { label: "carrières", texte: { regime: "technique" } }, talentsDeCarriere: { label: "Talents de carrière", texte: { regime: "technique" } }, competencesDeCarriere: { label: "Compétences de carrière", texte: { regime: "technique" } }, dotationsDeCarriere: { label: "dotations de carrière", texte: { regime: "technique" } }, light: { label: "lumière" }, merchant: { label: "marchand" }, tavernGame: { label: "jeu de taverne" }, usable: { label: "utilisable" }, combat: { label: "rôle au combat" }, couvre: { label: "entrées couvertes" , texte: { regime: "technique"} } });

/** Branche d'une entité de scène : les champs partagés, son `kind` et son corps. Le littéral
 *  DISCRIMINE la branche, `entityKindSchema` en NOMME la valeur (vocabulaire à libellés). */
const brancheDEntite = <C extends z.ZodRawShape>(kind: EntityKindId, corps: C, metaDuCorps: MetaDesChamps<C>) =>
  nommerChamps(z.strictObject({ ...baseDEntiteSchema.shape, kind: z.literal(kind).pipe(entityKindSchema), ...corps }), { ...metaDesChamps(baseDEntiteSchema, { exigees: true }), kind: { label: "type"  }, ...metaDuCorps });

/** Branche d'un DÉCOR : celle de toute entité, et sa POSE dans la case. `calage`, où son corps se tient dans le jeu libre
 *  de son empreinte, de -1 (ouest, nord) à +1 (est, sud) par axe du monde, absent = centré (`decalageDuCalage`) ; `sur`, l'id du décor qui le porte, son pied sur le dessus de
 *  celui-ci (`noyau/monde/poseDuDecor.ts`). L'empreinte, donc l'occupation de la grille, n'en dépend pas. */
const brancheDuDecor = (() => {
  const branche = brancheDEntite('prop', { decor: ref('prop').optional() }, { decor: { label: "décor", texte: { regime: 'technique' } } });
  return nommerChamps(branche.extend({ calage: pointDuPlanSchema.optional(), sur: z.string().optional() }), { ...metaDesChamps(branche, { exigees: true }), calage: { label: "calage dans la case" }, sur: { label: "posé sur", texte: { regime: "technique" } } });
})();

type EntityKindId = z.infer<typeof entityKindSchema>;

/** Une faute CROISÉE d'une entité de scène : le champ où elle se dit, et ce qu'elle dit. */
export interface FauteDEntite { chemin: readonly (string | number)[]; message: string }

/** Les fautes CROISÉES de l'entité `ent`, que le `superRefine` de sa branche de `sceneEntitySchema` dit au parse, et que
 *  l'éditeur refuse à l'écriture (`sceneAvecLaValeur`) : le type NOMMÉ (`porteurAbsent`, #877, #1882) ; d'un personnage,
 *  un corps au plus, un engin qui en est un (`siegeEngines`), le parcours de carrière (`refusDuPnjDeCarriere`) et le cap
 *  cardinal d'un navire à ponts (`estUnNavireAPonts`, #3772) ; d'un
 *  décor, son calage dans sa case (#3731), le cap d'un décor volumique (#1680 ligne 3 : `capDecorAdmis`, la sous-liste lue au régime vivant, sinon au
 *  registre généré, `porteLeMarqueur`). Source unique. */
export function refusDeLEntite(ent: Parameters<typeof refusDuPnjDeCarriere>[0] & Pick<z.output<typeof baseDEntiteSchema>, 'facing'> & Partial<Record<CorpsDuPersonnage | 'decor', { id: string }>> & { kind: string; calage?: { x: number; y: number }; postes?: readonly Pick<z.input<typeof authoredShipPosteSchema>, 'trappingId' | 'ammo' | 'selectedAmmo'>[] }): FauteDEntite[] {
  const absence = porteurAbsent(ent);
  const fautes: FauteDEntite[] = absence ? [{ chemin: [regleDuType(ent.kind)!.porteurs[0]], message: absence }] : [];
  if (ent.kind === 'personnage') {
    const corps = CLES_DU_CORPS.filter((k) => ent[k] !== undefined);
    if (corps.length > 1) fautes.push({ chemin: [corps[1]], message: `corps EXCLUSIFS — ${corps.map((k) => `« ${k} »`).join(', ')} : un personnage en porte un au plus` });
    const engin = ent.engin?.id;
    if (engin !== undefined && !siegeEngines().some((t) => t.id === engin)) fautes.push({ chemin: ['engin', 'id'], message: `« ${engin} » n'est pas un engin de siège` });
    const carriere = refusDuPnjDeCarriere(ent);
    if (carriere) fautes.push({ chemin: ['carrieres'], message: carriere });
    if (estUnNavireAPonts(ent.vehicule?.id) && ent.facing && !estCardinal(ent.facing))
      fautes.push({ chemin: ['facing'], message: `navire « ${ent.vehicule?.id} » au cap ${ent.facing} — un navire à ponts ne prend qu'un cap cardinal (N/E/S/O)` });
    ent.postes?.forEach((p, rang) => {
      const piece = { trappingId: p.trappingId, subType: findTrappingById(p.trappingId)?.subType?.id };
      for (const id of Object.keys(p.ammo ?? {})) {
        if (!chargeLArme({ trappingId: id, subType: findTrappingById(id)?.subType?.id }, piece)) fautes.push({ chemin: ['postes', rang, 'ammo', id], message: `munition « ${id} » que la pièce « ${p.trappingId} » ne charge pas` });
      }
      if (p.selectedAmmo && !(p.selectedAmmo.id in (p.ammo ?? {}))) fautes.push({ chemin: ['postes', rang, 'selectedAmmo'], message: `munition choisie « ${p.selectedAmmo.id} » hors du coffre du poste` });
    });
  }
  if (ent.kind === 'prop') {
    for (const axe of ['x', 'y'] as const)
      if (ent.calage && Math.abs(ent.calage[axe]) > 1) fautes.push({ chemin: ['calage', axe], message: `calage ${axe} = ${ent.calage[axe]} — de -1 à +1, la part du jeu libre du décor dans sa case` });
  }
  if (ent.kind === 'prop' && !capDecorAdmis(ent.decor !== undefined && estVolumique(ent.decor.id), ent.facing)) {
    fautes.push({ chemin: ['facing'], message: `décor volumique « ${ent.decor?.id} » au cap ${ent.facing} — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)` });
  }
  return fautes;
}

/** Le `superRefine` d'une branche d'entité : chaque faute de `refusDeLEntite`, dite à son champ. */
const fautesDeLaBranche = (ent: Parameters<typeof refusDeLEntite>[0], ctx: z.RefinementCtx) => {
  for (const f of refusDeLEntite(ent)) ctx.addIssue({ code: 'custom', path: [...f.chemin], message: f.message });
};

/** `SceneEntity` (`noyau/monde/scene.ts`). `id` = identité STABLE partagée avec le `Combatant` au spawn.
 *  Union DISCRIMINÉE par `kind` : un DÉCOR désigne son type (`decor`, #877), un personnage son corps
 *  (`CLES_DU_CORPS`, #1882, #2968). Le `superRefine` d'une branche dit ses fautes CROSS-CHAMP (`refusDeLEntite`). */
export const sceneEntitySchema = z.discriminatedUnion('kind', [
  brancheDEntite('heroStart', {}, {}),
  brancheDEntite('personnage', { creature: ref('creature').optional(), vehicule: ref('vehicle').optional(), engin: ref('trapping').optional() }, { creature: { label: "créature", texte: { regime: 'technique' } }, vehicule: { label: "coque", texte: { regime: 'technique' } }, engin: { label: "engin de siège", texte: { regime: 'technique' } } }).superRefine(fautesDeLaBranche),
  brancheDuDecor.superRefine(fautesDeLaBranche),
]);

// ── Architecture ────────────────────────────────────────────────────────────────────────────────

/** `ArchitectureRect` — emprise rectangulaire d'une part/masse. */
export const architectureRectSchema = nommerChamps(z.strictObject({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }), { x: { label: "abscisse" }, y: { label: "ordonnée" }, w: { label: "largeur" }, h: { label: "hauteur" } });
/** `ArchitectureEdgeRef` — arête porteuse d'une façade/d'un ornement. */
export const architectureEdgeRefSchema = nommerChamps(z.strictObject({ x: z.number(), y: z.number(), side: wallSideSchema, z: z.number().optional() }), { x: { label: "abscisse" }, y: { label: "ordonnée" }, side: { label: "côté"  }, z: { label: "étage" } });
/** `ArchitecturePart` — empreinte nommée d'un étage. */
export const architecturePartSchema = nommerChamps(z.strictObject({ id: z.string(), foot: architectureRectSchema }), { id: { label: "identifiant" , texte: { regime: "technique"} }, foot: { label: "emprise" } });
/** `ArchitectureStorey` — un étage : ses parts et les zones-pièces qu'il couvre. */
export const architectureStoreySchema = nommerChamps(z.strictObject({
  id: z.string(),
  z: z.number(),
  parts: listeCle(architecturePartSchema, 'id'),
  roomZoneIds: z.array(z.string()),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, z: { label: "étage" }, parts: { label: "parties" }, roomZoneIds: { label: "pièces" , texte: { regime: "technique"} } });
/** Nature d'un ornement de façade — les trois `KINDS_DE_DECOR` (`noyau/monde/facades`) portent le libellé
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
export const facadeFeatureSchema = nommerChamps(z.strictObject({
  id: z.string(),
  kind: facadeFeatureKindSchema,
  edge: architectureEdgeRefSchema,
  offset: z.number().optional(),
  width: z.number().optional(),
  appearance: z.string().optional(),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, kind: { label: "type"  }, edge: { label: "arête" }, offset: { label: "décalage" }, width: { label: "largeur" }, appearance: { label: "apparence" , texte: { regime: "technique"} } });
/** `FacadeSection` — pan de façade d'un étage. */
export const facadeSectionSchema = nommerChamps(z.strictObject({
  id: z.string(),
  z: z.number(),
  edges: z.array(architectureEdgeRefSchema),
  appearance: z.string(),
  roomZoneIds: z.array(z.string()).optional(),
  features: listeCle(facadeFeatureSchema, 'id').optional(),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, z: { label: "étage" }, edges: { label: "arêtes" }, appearance: { label: "apparence" , texte: { regime: "technique"} }, roomZoneIds: { label: "pièces" , texte: { regime: "technique"} }, features: { label: "détails" } });
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
 * Matière de COUVERTURE d'une masse : `ref('material')` sur la sous-liste `roof` de `materials.json` (une
 * matière de décor ou de relief posée sur un toit n'entre pas). La FORME DE SORTIE est DÉCLARÉE `{ id: string }`
 * et non inférée (même patron que `RefASpecialisation`, `grammaire/ref.ts`) : `BuildingMass`/`RoofDefaults`
 * sont des `z.infer` LUS par l'éditeur et par la dérivation, où la matière se pose depuis une valeur de
 * `<select>` et un littéral d'authoring. Que la matière COUVRE vraiment un pan (champ `couverture`) reste un
 * sous-filtre de SCÈNE, dit par `noyau/validateScene.ts` : le domaine `roof` porte aussi le « plan » vu du
 * dessus.
 */
const couvertureSchema: z.ZodType<{ id: string }, { id: string }> = ref('material', undefined, 'roof');
/** TYPE de bâtiment d'un corps architectural : `ref('building')`, sortie élargie comme `couvertureSchema`
 *  (`ArchitectureBody` est lu par l'éditeur et par l'authoring TS des scénarios). */
const typeDeBatimentSchema: z.ZodType<{ id: string }, { id: string }> = ref('building');
/** Matière de RELIEF — `ref('material')` sur la sous-liste `relief` de `materials.json` (une couverture de
 *  toit ou une matière de décor posée sur une falaise n'entre pas), sortie élargie comme `couvertureSchema`. */
const matiereReliefSchema: z.ZodType<{ id: string }, { id: string }> = ref('material', undefined, 'relief');
/**
 * MATIÈRES DE RELIEF de la scène, UNE par PARTIE émise (#1691) : falaise, rampe, dalle de tablier,
 * pilier. Les clés sont EXACTEMENT le vocabulaire `PARTS_RELIEF` de la couche donnée — celui que
 * `noyau/monde/volume/floors.ts` pose en `MaterialRef.part`, jamais une traduction.
 *
 * Le champ est EXIGÉ sur la scène : le builder n'a plus AUCUN choix de matière à faire, donc aucun
 * repli à offrir — une scène qui n'en porte pas est refusée AU PARSE, nommément, plutôt que rendue
 * avec une valeur devinée. La face d'un terrain à BLOC PLEIN, elle, tient sa matière du TERRAIN
 * (`terrains.json › matiere`) : ce record ne couvre que le relief du sol lui-même.
 */
export const reliefDefaultsSchema = nommerChamps(z.strictObject(
  tableTotale(PARTS_RELIEF, () => matiereReliefSchema),
), { cliff: { label: 'falaise', texte: { regime: 'technique', usage: 'id de matière du relief' } }, ramp: { label: 'rampe', texte: { regime: 'technique', usage: 'id de matière du relief' } }, deck: { label: 'tablier', texte: { regime: 'technique', usage: 'id de matière du relief' } }, pilier: { label: 'pilier', texte: { regime: 'technique', usage: 'id de matière du relief' } } });
/** `Scene.reliefDefaults` — la matière de chaque PARTIE de relief (#1691), clés = `PARTS_RELIEF`. */
export type ReliefDefaults = z.infer<typeof reliefDefaultsSchema>;
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
 * ni le corps ni le TYPE de bâtiment ne les surchargent (`toitureEffective`, `noyau/sceneEdit.ts`).
 *
 * Le champ est EXIGÉ sur la scène : la dérivation n'a plus AUCUN choix de toiture à faire, donc aucun
 * repli à offrir — une scène qui n'en porte pas est refusée AU PARSE, nommément. Pas de `profile`
 * ici : un profil non posé se choisit par PORTÉE (`ROOF_GABLE_SPAN_MAX_M`), c'est le socle qui le
 * résout ; un `profile` de scène serait soit mort, soit une seconde vérité face à la portée.
 */
export const sceneRoofDefaultsSchema = nommerChamps(z.strictObject({
  /** Matière de COUVERTURE de dernier recours — même porte que `BuildingMass.material`. Le TYPE de
   *  bâtiment du corps (`buildings.json › roofMaterial`) et le corps lui-même passent avant. */
  material: couvertureSchema,
  /** Pente de RÉFÉRENCE en DEGRÉS : la plus RAIDE que la dérivation pose. `fittedPitchDeg`
   *  (`noyau/sceneEdit.ts`) la rabat jusqu'à ce que le comble tienne dans `riseMaxStoreys`. Bornée à
   *  `PENTE_TOIT_DEG` — la MÊME plage que celle dont `validateScene.ts` signale la sortie sur une
   *  masse matérialisée : une toiture plate ou verticale n'est pas une toiture. */
  pitchDeg: z.number().min(PENTE_TOIT_DEG.min).max(PENTE_TOIT_DEG.max),
  /** BORNE de comble en hauteurs d'ÉTAGE (`METRES_PER_LEVEL`) — c'est elle qui fait s'adapter la
   *  pente à la portée (#947). */
  riseMaxStoreys: z.number().int().min(1),
}), { material: { label: "matériau" , texte: { regime: "technique"} }, pitchDeg: { label: "pente en degrés" }, riseMaxStoreys: { label: "élévation maximale" } });
/** `Scene.roofDefaults` — matière, pente de référence et borne de comble de la scène (#1715). */
export type SceneRoofDefaults = z.infer<typeof sceneRoofDefaultsSchema>;
/** MASSE de bâtiment (#823, remplace `RoofSection` authoré à la main) : l'INTENTION, jamais la
 *  géométrie du toit — `noyau/monde/volume/toits.ts` DÉRIVE pans/faîte/noues/croupes par une formule
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
 *  sinon (`validateBuildingMasses`, `noyau/mapSpec.ts`), pas une redevance silencieuse.
 *
 *  Note #829 : `ArchitectureBody.masses` déclarées ici sont des SURCHARGES, plus la règle. Par défaut,
 *  `buildScene` DÉRIVE les masses manquantes depuis le plancher réel (`deriveArchitectureMasses`,
 *  `noyau/sceneEdit.ts`) — éditer un mur/une pièce fait suivre la toiture sans redéclaration. Une masse
 *  authorée ici CORRIGE la dérivation là où elle se trompe (passage couvert, appentis,
 *  cour à ne pas coiffer via `ArchitectureBody.roofExclusions`, encorbellement voulu). */
export const buildingMassSchema = nommerChamps(z.strictObject({
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
  /** Masse POSÉE par la dérivation (`deriveArchitectureMasses`, `noyau/sceneEdit.ts`) et non par un
   *  auteur : re-calculable à volonté — toute re-dérivation jette ces masses et les refait depuis le
   *  plan et `ArchitectureBody.roofDefaults`. Une masse SANS ce drapeau est une SURCHARGE authorée,
   *  jamais écrasée. C'est ce qui rend la dérivation IDEMPOTENTE, donc rejouable dans l'éditeur
   *  (#841) : l'intention de toiture y produit un effet immédiat sur le rendu, qui ne lit QUE les
   *  masses matérialisées. */
  derived: z.literal(true).optional(),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, z: { label: "étage" }, footprint: { label: "empreinte" }, levels: { label: "niveaux" }, profile: { label: "profil"  }, pitchDeg: { label: "pente en degrés" }, material: { label: "matériau" , texte: { regime: "technique"} }, ridge: { label: "faîtage"  }, eaveSide: { label: "côté de l’égout"  }, derived: { label: "dérivé" } });
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
export const roofDefaultsSchema = nommerChamps(z.strictObject({
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
}), { profile: { label: "profil"  }, pitchDeg: { label: "pente en degrés" }, material: { label: "matériau" , texte: { regime: "technique"} }, eaveSide: { label: "côté de l’égout"  }, riseMaxStoreys: { label: "élévation maximale" } });
/** `ArchitectureBody` — corps architectural authoré (volumes, façades, toitures). */
export const architectureBodySchema = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string().optional(),
  /** TYPE de bâtiment du corps (`buildings.json`) : il porte la couverture de référence du type et
   *  ses ornements d'identité (`buildingFeatures`). ABSENT =
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
  roofExclusions: z.array(nommerChamps(z.strictObject({ z: z.number(), rect: architectureRectSchema }), { z: { label: "étage" }, rect: { label: "rectangle" } })).optional(),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, style: { label: "style" , texte: { regime: "technique"} }, storeys: { label: "étages" }, facades: { label: "façades" }, masses: { label: "toitures" }, roofDefaults: { label: "toit par défaut" }, roofExclusions: { label: "exclusions de toit" } });

// ── Dialogue ────────────────────────────────────────────────────────────────────────────────────

/** `DialogueChoice` — `when` gate l'AFFICHAGE, `cost` est débité AVANT le flow. */
export const dialogueChoiceSchema = nommerChamps(z.strictObject({
  /** Identité STABLE du choix, unique dans son nœud (`listeCle`) : c'est elle que le verbe qui choisit la réponse
   *  désigne, jamais son rang dans la liste. */
  id: z.string(),
  /** LIBELLÉ du choix — rôle libellé de l'enveloppe (`label`), pas de la prose : c'est l'étiquette
   *  du bouton que le joueur clique, et l'archive de dialogue la stocke comme telle. */
  label: z.string(),
  /** Icône d'affordance (registre `src/data/icons/`, rendue par `<Icon>` dans `DialogueBox`) — jamais
   *  un emoji collé au `label` (#290, doctrine anti-emoji). */
  icon: idDIconeSchema.optional(),
  /** Condition d'AFFICHAGE du choix (algèbre `Condition`, cf. `evalCondition`). Absente = toujours visible. */
  when: conditionSchema.optional(),
  /** Prix de l'option (service payant : auberge, péage, pot-de-vin…). Le choix est RÉPÉTABLE mais
   *  désactivé si on ne peut pas payer ; à la sélection, le montant est débité AVANT le flow. */
  cost: moneyPartialSchema.optional(),
  /** LOGIQUE exécutée à la sélection : séquence d'effets + branches `si`/`test` (exécutée par `runFlow`). */
  flow: sceneFlowSchema.optional(),
  next: ref(NOEUDS).optional(),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, icon: { label: "icône" , texte: { regime: "technique"} }, when: { label: "condition" }, cost: { label: "coût" }, flow: { label: "enchaînement", transparent: true }, next: { label: "nœud suivant" , texte: { regime: "technique"} } });
/** `DialogueNode` — `speakerId` = personnage de la scène dont le portrait/nom porte CE nœud. Réplique :
 *  `descRef` (verbatim) ⊕ `adapteDe` (`grammaire/prose.ts`). */
export const dialogueNodeSchema = proseNommee(nommerChamps(z.strictObject({
  id: z.string(),
  /** Un personnage de la scène courante → son PORTRAIT et son NOM (label) pour CE nœud.
   *  Permet d'alterner les interlocuteurs dans une même conversation. À défaut, l'interlocuteur de
   *  SESSION (`state.dialogue.speakerId`, posé par `interagirAvecLEntite` ou `startDialogue.speakerId`). */
  speakerId: ref(PERSONNAGES_DE_LA_SCENE).optional(),
  choices: listeCle(dialogueChoiceSchema, 'id'),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, speakerId: { label: "locuteur" , texte: { regime: "technique"} }, choices: { label: "réponses" } }), 'dialogues[].nodes[].desc');
/** `Dialogue` — arbre de nœuds, `start` le nœud d'entrée. */
export const dialogueSchema = nommerChamps(ouvrirPortees(z.strictObject({
  id: z.string(),
  start: ref(NOEUDS),
  nodes: listeCle(dialogueNodeSchema, 'id'),
  couvre: couvreSchema.optional(),
}), [NOEUDS]), { id: { label: "identifiant" , texte: { regime: "technique"} }, start: { label: "nœud de départ" , texte: { regime: "technique"} }, nodes: { label: "nœuds" }, couvre: { label: "entrées couvertes" , texte: { regime: "technique"} } });

// ── Déclencheur ─────────────────────────────────────────────────────────────────────────────────

/** `Trigger` — `rect` (avec son étage `z`, #803) ET `when` en ET, évalués à l'entrée dans la zone. */
export const triggerSchema = nommerChamps(z.strictObject({
  id: z.string(),
  /** Zone du déclencheur — son étage est `rect.z` (défaut 0, rez), comme `SceneEffectZone.z` (#782) :
   *  sans lui, un trigger posé au rez se déclenche depuis/vers l'étage au-dessus (`checkTriggers`, #803). */
  rect: rectSchema,
  once: z.boolean().optional(),
  /** Condition d'ENTRÉE (algèbre `Condition`, cf. `evalCondition`) — combinée en ET avec le `rect` et
   *  évaluée à l'entrée dans la zone. Absente = pas de garde (un pur événement horaire sans position =
   *  `delayedEffect`). */
  when: conditionSchema.optional(),
  /** LOGIQUE exécutée à l'entrée : séquence d'effets + branches `si`/`test` (exécutée par `runFlow`). */
  flow: sceneFlowSchema,
  couvre: couvreSchema.optional(),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, rect: { label: "rectangle" }, once: { label: "une seule fois" }, when: { label: "condition" }, flow: { label: "enchaînement", transparent: true }, couvre: { label: "entrées couvertes" , texte: { regime: "technique"} } });

// ── Rencontre ───────────────────────────────────────────────────────────────────────────────────

/** Camp d'un membre/d'une circonstance de rencontre. */
export const campSchema = z.enum(['groupe', 'ennemis']);
/** `ThreatTier` (`engine/advantagePool.ts`) — palier de Menace (`AA 11 l.53-65`). */
export const threatTierSchema = z.enum(['dangereuse', 'tresDangereuse', 'extreme']);

/** OBJECTIF de victoire d'une rencontre (#197) — AUTHORABLE en donnée, lu par `checkBattleOver`.
 *  Absent = `allEnemiesDead` (comportement HISTORIQUE, tous les scénarios existants inchangés).
 *  `destroyStructure` référence l'arête par son identifiant STABLE (x/y/side/z), le même couple que
 *  `structureIsDown`/`Combatant.structureEdge` (bélier-porte, `AA 10 l.94-102`) — la victoire se déclenche
 *  à la BRÈCHE, indépendamment du sort des combattants. `surviveRounds` : victoire posée au début du
 *  Round `rounds + 1` (le groupe a tenu N Rounds complets). `reachZone` réutilise le rectangle de zone
 *  des `Trigger`/`SceneEffectZone` (`inRect`, `combatGeometry.ts`) — aucun 2e mécanisme de zone.
 *  `woundsThreshold` (#215) : sortie à seuil de dommage partiel — une cible à `atOrBelowPercent` % de
 *  ses Blessures de départ OU MOINS sort du combat : `targetId` désigne un membre de la rencontre
 *  (`MEMBRES_DE_LA_RENCONTRE`, son `entityId` = `Combatant.id` au spawn) ; absent, CHAQUE adversaire sort
 *  ainsi, et la victoire vient quand aucun ne reste (`MDG 15 l.143`, `l.166-168`). Un navire amène son
 *  pavillon, une créature est repoussée. Le RAW ne chiffre AUCUN seuil de reddition ; seul précédent
 *  chiffré, le monstre marin à la moitié de ses Blessures (`MDG 15 l.143`, `l.166-168`).
 *  `atOrBelowPercent` reste une valeur ÉDITABLE par rencontre (AGENTS.md règle 7).
 *  `firstBlood` (#471) : DUEL JUDICIAIRE — « le premier sang est la première attaque qui cause une
 *  perte de plus de 3 Blessures […] ; un adversaire est incapable de continuer lorsqu'il est réduit
 *  à 0 Blessure » (`NADJ 06 l.175-177`) — les DEUX fins restent actives en parallèle, la seconde étant
 *  la fin standard (0 Blessure, `isOutOfAction`) déjà couverte hors `VictoryCondition`. `threshold`
 *  reste ÉDITABLE (défaut 3, seule valeur chiffrée par le RAW) — sévérité de la charge, AGENTS.md
 *  règle 7. Testé PAR-COUP (`resolveFirstBlood`, combatFlow.ts) — pas un seuil cumulatif comme
 *  `woundsThreshold`. */
export const victoryConditionSchema = z.discriminatedUnion('type', [
  variante('Tous les ennemis hors d’action', nommerChamps(z.strictObject({ type: z.literal('allEnemiesDead') }), { type: { label: "type"  } })),
  variante('Détruire une structure', nommerChamps(z.strictObject({ type: z.literal('destroyStructure'), edge: architectureEdgeRefSchema }), { type: { label: "type"  }, edge: { label: "arête" } })),
  variante('Survivre N Rounds', nommerChamps(z.strictObject({ type: z.literal('surviveRounds'), rounds: z.number() }), { type: { label: "type"  }, rounds: { label: "Rounds" } })),
  variante('Atteindre une zone', nommerChamps(z.strictObject({
    type: z.literal('reachZone'),
    rect: architectureRectSchema,
    camp: campSchema.optional(),
  }), { type: { label: "type"  }, rect: { label: "rectangle" }, camp: { label: "camp"  } })),
  /** Sortie à seuil de dommage partiel (#215) — `targetId` parmi les membres de la rencontre, absent = chaque adversaire. */
  variante('Sortie à seuil de dommage', nommerChamps(z.strictObject({ type: z.literal('woundsThreshold'), targetId: ref(MEMBRES_DE_LA_RENCONTRE).optional(), atOrBelowPercent: z.number() }), { type: { label: "type"  }, targetId: { label: "cible" , texte: { regime: "technique"} }, atOrBelowPercent: { label: "seuil en pourcentage" } })),
  /** Duel judiciaire (`NADJ 06 l.175-177`) — `threshold` ÉDITABLE, défaut 3. */
  variante('Duel judiciaire — premier sang', nommerChamps(z.strictObject({ type: z.literal('firstBlood'), threshold: z.number().optional() }), { type: { label: "type"  }, threshold: { label: "seuil" } })),
]);

/** Membre d'une rencontre : RÉFÉRENCE une `SceneEntity` (kind 'personnage') de la scène — c'est
 *  ELLE qui porte le profil (ref/statblock/apparence/arme/label/facing/combat). Le membre n'ajoute
 *  que le contexte propre à CETTE rencontre (camp, monture). */
export const encounterMemberSchema = nommerChamps(z.strictObject({
  /** id de la `SceneEntity` enrôlée. */
  entityId: z.string(),
  /** Camp au spawn : 'allie' pose un combattant du côté des héros (ex. monture prêtée). Défaut 'ennemi'. */
  side: equipeSchema.optional(),
  /** PNJ allié piloté par l'IA (`Combatant.aiControlled`) : un allié qui AGIT SEUL (défenseur de siège,
   *  équipage d'une pièce…) au lieu d'être contrôlé par le joueur. Sans effet sur un membre 'enemy'. */
  ai: z.boolean().optional(),
  /** Combat monté (`LDB 14`) : cet acteur est une MONTURE rideable (peut être enfourché). */
  mount: z.boolean().optional(),
  /** La monture chevauchée au spawn (pré-monté), parmi les montures de la rencontre. */
  ridesEntityId: ref(MONTURES_DE_LA_RENCONTRE).optional(),
}), { entityId: { label: "entité" , texte: { regime: "technique"} }, side: { label: "côté"  }, ai: { label: "intelligence artificielle" }, mount: { label: "monture" }, ridesEntityId: { label: "monture" , texte: { regime: "technique"} } });

/** `EncounterDef` — les circonstances d'Avantage initial (`AA 11 l.53-65`) et la fin de combat. */
export const encounterDefSchema = nommerChamps(ouvrirPortees(z.strictObject({
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
  threat: nommerChamps(z.strictObject({ camp: campSchema, tier: threatTierSchema }), { camp: { label: "camp"  }, tier: { label: "niveau"  } }).optional(),
  /** Avantage initial — Terrain (`AA 11 l.53-65`) : le camp `camp` tient une position avantageuse
   *  (fortification/couvert léger/hauteur → +1 ; `heavy` : couvert lourd/position décisive type pont
   *  → +2) → crédite sa réserve d'Avantage en mode groupe. Absent = pas de circonstance. */
  terrain: nommerChamps(z.strictObject({ camp: campSchema, heavy: z.boolean().optional() }), { camp: { label: "camp"  }, heavy: { label: "lourd" } }).optional(),
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
  /** Rencontre de SIÈGE — #1680, commentaire 5546039260 du 2026-09-04 : « Structures ciblables en
   *  siège seul », puis, à la question de ce qui fait d'un combat un siège, « Un drapeau de RENCONTRE,
   *  éditable ». Les STRUCTURES destructibles de la
   *  scène (porte, mur) entrent dans le choix de cible de l'IA ennemie. Défaut LITTÉRAL `false` —
   *  absent = pas de siège, AUCUNE dérivation depuis un autre champ (une rencontre
   *  `victoryCondition: destroyStructure` ne l'active pas d'elle-même). Résolu par `siegeActif`
   *  (SEUL point), consommé par `buildAiInput`. Le drapeau ne change ni les dégâts ni l'immunité
   *  (`structureImmune`), ni le ciblage JOUEUR. HOMONYMES sans rapport : `siegesRequis` (sièges de
   *  coop, `noyau/netOwnership.ts`), le décor `siege` (fauteuil), l'Atout d'arme `siege`
   *  (`ADE II 08 l.292`). */
  siege: z.boolean().optional(),
  couvre: couvreSchema.optional(),
}), [MEMBRES_DE_LA_RENCONTRE, MONTURES_DE_LA_RENCONTRE]), { id: { label: "identifiant" , texte: { regime: "technique"} }, members: { label: "participants" }, onVictory: { label: "à la victoire" }, victoryCondition: { label: "condition de victoire" }, surprise: { label: "surprise"  }, maneuverability: { label: "manœuvrabilité"  }, threat: { label: "menace" }, terrain: { label: "terrain" }, banRanged: { label: "interdire le tir" }, siege: { label: "siège" }, couvre: { label: "entrées couvertes" , texte: { regime: "technique"} } });

// ── Couches, zones, murs ────────────────────────────────────────────────────────────────────────

/** LDB 15 l.12. */
export const layerSchema = nommerChamps(z.strictObject({
  z: z.number(),
  /** Ids de TERRAIN résolus contre `terrains.json` (#1690) : une tuile qui nomme un sol absent du
   *  dataset est refusée AU PARSE, nommément, au lieu de peindre le repli d'alarme en silence. */
  tiles: refs('terrain'),
  height: z.array(z.number()).optional(),
  /** CRÉNELURE (RENDU PUR) : parallèle à `tiles` (`y·w+x`). `null` = pas de crénelure ; une chaîne = id de
   *  structure crénelée (`structureAppearance.json`) → la crénelure (`cretesDePerimetre`) en dérive des MERLONS
   *  sur le PÉRIMÈTRE (arête dont le voisin même-z n'est pas crénelé) — jamais à l'intérieur. Marqueur de
   *  DÉCORATION seulement (comme un toit auto-dessiné) : n'affecte NI la passabilité NI la LdV plongeante. */
  crenellated: z.array(z.string().nullable()).optional(),
}), { z: { label: "étage" }, tiles: { label: "cases" , texte: { regime: "technique"} }, height: { label: "hauteurs" }, crenellated: { label: "créneaux" , texte: { regime: "technique"} } });

/** `ZoneArea` — rectangle ou disque de Chebyshev (rayon en CASES). */
export const zoneAreaSchema = z.discriminatedUnion('kind', [
  nommerChamps(z.strictObject({ kind: z.literal('rect'), x: z.number(), y: z.number(), w: z.number(), h: z.number() }), { kind: { label: "type"  }, x: { label: "abscisse" }, y: { label: "ordonnée" }, w: { label: "largeur" }, h: { label: "hauteur" } }),
  nommerChamps(z.strictObject({ kind: z.literal('disc'), cx: z.number(), cy: z.number(), radius: z.number() }), { kind: { label: "type"  }, cx: { label: "centre horizontal" }, cy: { label: "centre vertical" }, radius: { label: "rayon" } }),
]);

/** `SceneEffectZone` — sans aucun champ mécanique la zone est DESCRIPTIVE (#782, `isDescriptiveZone`). */
export const sceneEffectZoneSchema = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  area: zoneAreaSchema,
  presentation: z.enum(['interior', 'exterior']).optional(),
  /** EMPRISE EXACTE (pièce en L) : `area` n'est alors que la boîte englobante (`sceneZoneTiles`). */
  tiles: z.array(ptSchema).optional(),
  blocksLoS: z.boolean().optional(),
  /** Payload `GameOp[]` — vocabulaire UNIQUE partagé avec les zones de Sort (`applyOps`). */
  onCross: executeesDe().optional(),
  perRound: executeesDe().optional(),
  crossTest: flowTestSchema.optional(),
  /** BARRIÈRE : `blockGroups` vide/absent = bloque tout le monde ; sinon ids de Groupes. */
  barrier: nommerChamps(z.strictObject({ blockGroups: refs('groupe', { sousListe: CIBLE_D_APPARTENANCE }).optional() }), { blockGroups: { label: "groupes bloqués" , texte: { regime: "technique"} } }).optional(),
  z: z.number().optional(),
  couvre: couvreSchema.optional(),
  /** #3834 : le rendu qui la montre tant qu'elle dure ; absent, la zone ne se voit pas (un piège caché). */
  rendu: ref('rendu').optional(),
}).superRefine((zone, ctx) => {
  // Une PIÈCE vit à l'étage `zone.z` (`noyau/monde/rooms.ts`, `roomTiles`) : une case d'un autre étage est refusée.
  if (zone.presentation !== 'interior') return;
  const etage = zone.z ?? 0;
  (zone.tiles ?? []).forEach((t, i) => {
    if (t.z !== undefined && t.z !== etage) ctx.addIssue({ code: 'custom', path: ['tiles', i, 'z'], message: `zone intérieure « ${zone.id} » : la case (${t.x},${t.y}) est à l'étage ${t.z}, la pièce à l'étage ${etage} (\`z\`) — une pièce vit à un seul étage` });
  });
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, area: { label: "surface" }, presentation: { label: "présentation"  }, tiles: { label: "cases" }, blocksLoS: { label: "bloquer la vue" }, onCross: { label: "à la traversée" }, perRound: { label: "par Round" }, crossTest: { label: "Test de traversée" }, barrier: { label: "barrière" }, z: { label: "étage" }, couvre: { label: "entrées couvertes" , texte: { regime: "technique"} }, rendu: { label: "rendu", hint: "Ce qui la montre tant qu’elle dure ; absent, la zone ne se voit pas" } });

/** Nature d'une arête grimpable (`WallSeg.climb`). */
export const wallClimbSchema = nommerChamps(z.strictObject({
  /** LDB 15 l.55/57. */
  kind: z.enum(['ladder', 'surface']),
  /** LDB 15 l.57. */
  difficulty: difficultySchema.optional(),
  /** LDB 15 l.57. */
  requiresGrimpeur: z.boolean().optional(),
}), { kind: { label: "type"  }, difficulty: { label: "difficulté"  }, requiresGrimpeur: { label: "Grimpeur requis" } });

/** Case(s) bordant une arête : la case PORTEUSE `(x,y)`, sa VOISINE à travers `side`, ou LES DEUX
 *  (`parapetTilesAbove`, `structureFaceCells`). */
export const faceDAreteSchema = enumNomme({
  porteuse: 'Case porteuse (x,y)',
  voisine: 'Case voisine (à travers l’arête)',
  'les-deux': 'Les deux faces',
});

/** Porte SECRÈTE (`WallSeg.secret`) — `EDO 08 l.404`, `LDB 09 l.399`. */
export const wallSecretSchema = nommerChamps(z.strictObject({
  /** Difficulté du Test de Perception qui la découvre — `LDB 12 l.137`, fixée par l'auteur (règle 7). */
  difficulty: difficultySchema,
  /** Face(s) depuis laquelle la porte peut être découverte — `EDO 07 l.263`. */
  face: faceDAreteSchema,
}), { difficulty: { label: "difficulté"  }, face: { label: "face"  } });

/** Ce qu'une cloison OBLIQUE (`\\`, `/`) ne porte jamais : elle est purement visuelle — déplacement,
 *  vision et grimpe ne résolvent que les arêtes cardinales (`edgeOf`, `noyau/monde/scene.ts`). `window`,
 *  `shuttered` et `appearance` y restent admis : ils ne sont que du rendu. */
const MUET_SUR_OBLIQUE = ['door', 'secret', 'crossable', 'allege', 'suspendu', 'climb', 'structure'] as const;

/** `WallSeg` — cloison sur ARÊTE. `door` = franchissable (porte) ; `z` = étage. */
export const wallSegSchema = nommerChamps(z.strictObject({
  x: z.number(),
  y: z.number(),
  side: wallSideSchema,
  z: z.number().optional(),
  door: z.boolean().optional(),
  /** Porte FERMÉE par défaut à l'ouverture de la scène (bloque vue+passage tant qu'on ne l'ouvre pas).
   *  Absent = ouverte par défaut (comportement historique : une porte est une ouverture franchissable). */
  closed: z.boolean().optional(),
  /** Structure destructible posée SUR l'arête. Tant
   *  qu'elle tient, l'arête bloque passage+vue comme un mur plein ; une fois ABATTUE (`structureIsDown`),
   *  l'arête devient une BRÈCHE franchissable et transparente. */
  structure: idDe('structure', undefined, { nue: true }).optional(),
  /** Apparence de rendu (`structureAppearance.json`) indépendante de `structure`. N'affecte ni
   *  résistance, ni couvert, ni collision : absent = apparence dérivée de la structure/façade. */
  appearance: z.string().optional(),
  /** L'arête porte une FENÊTRE (croisée) — arbitrage #1712 (2026-09-08). Lecteurs : `areteOcculte`
   *  (vue), `couvertDArete` (couvert, `AA 10 l.122`, maison) ; `wallIsOpen` ne la lit pas (passage). */
  window: z.boolean().optional(),
  /** Croisée aux VOLETS CLOS — arbitrage #1712 (2026-09-08). Exige `window`. */
  shuttered: z.boolean().optional(),
  /** Croisée FRANCHISSABLE — #700 ; `LDB 15 l.82`, `LDB 15 l.55` (maison). Exige `window`. Geste
   *  explicite (`noyau/fallMove.ts`), jamais un pas de pathfinding (arbitrage #1712, 2026-09-08). */
  crossable: z.boolean().optional(),
  /** Hauteur d'ALLÈGE (m) de la croisée, enjambée à mi-vitesse sans Test — `LDB 15 l.55` ; arbitrage #700
   *  (2026-10-04). Exigée par `crossable`, et l'exige. Lue par `noyau/fallMove.ts`. */
  allege: z.number().min(0).optional(),
  /** Hauteur de chute (m) de qui SE SUSPEND d'abord à la croisée — `EDO 01 l.231`. Exige `crossable`.
   *  Offerte par `noyau/fallMove.ts` seulement sous la hauteur géométrique du saut. */
  suspendu: z.number().positive().optional(),
  /** Porte SECRÈTE — `EDO 08 l.404`. Exige `door` ET `closed`. Masquée tant que non révélée
   *  (`porteEnJeu`, `setDoorRevealed`, `noyau/monde/scene.ts`). */
  secret: wallSecretSchema.optional(),
  /** ESCALADABLE (`LDB 15 l.53-57`) : l'arête sépare deux surfaces de hauteurs différentes (une FALAISE au
   *  sens `surfaceLink` — infranchissable à pied) qu'un Personnage peut GRIMPER.
   *  Bloque toujours passage+vue comme un mur PLEIN (une falaise n'est pas une ouverture) : la grimpe est
   *  un geste EXPLICITE, pas un franchissement de pathfinding. Résolu par `noyau/monde/climbMove`. */
  climb: wallClimbSchema.optional(),
}).superRefine((w, ctx) => {
  if (w.secret && !w.door) ctx.addIssue({ code: 'custom', path: ['secret'], message: 'porte secrète (`secret`) sans `door: true` — seule une porte peut être secrète' });
  if (w.secret && !w.closed) ctx.addIssue({ code: 'custom', path: ['secret'], message: 'porte secrète (`secret`) sans `closed: true` — une porte secrète est fermée au départ' });
  if (w.shuttered && !w.window) ctx.addIssue({ code: 'custom', path: ['shuttered'], message: 'volets clos (`shuttered`) sans `window: true` — seule une croisée a des volets' });
  if (w.crossable && !w.window) ctx.addIssue({ code: 'custom', path: ['crossable'], message: 'croisée franchissable (`crossable`) sans `window: true` — seule une croisée se franchit' });
  if (w.crossable && w.allege === undefined) ctx.addIssue({ code: 'custom', path: ['allege'], message: 'croisée franchissable (`crossable`) sans hauteur d’allège (`allege`) — chaque croisée franchissable porte la sienne' });
  if (w.allege !== undefined && !w.crossable) ctx.addIssue({ code: 'custom', path: ['allege'], message: 'hauteur d’allège (`allege`) sans `crossable: true` — seule une croisée franchissable s’enjambe' });
  if (w.suspendu !== undefined && !w.crossable) ctx.addIssue({ code: 'custom', path: ['suspendu'], message: 'hauteur de suspension (`suspendu`) sans `crossable: true` — on ne se suspend qu’à une croisée franchissable' });
  if (w.window && w.door) ctx.addIssue({ code: 'custom', path: ['window'], message: 'fenêtre (`window`) sur une porte (`door: true`) — une arête est porte OU croisée' });
  if (w.side === '\\' || w.side === '/') {
    for (const k of MUET_SUR_OBLIQUE) {
      if (w[k]) ctx.addIssue({ code: 'custom', path: [k], message: `cloison oblique (\`${w.side}\`) avec \`${k}\` — une arête oblique est purement visuelle, déplacement, vision et grimpe restent cardinaux` });
    }
  }
}), { x: { label: "abscisse" }, y: { label: "ordonnée" }, side: { label: "côté"  }, z: { label: "étage" }, door: { label: "porte" }, closed: { label: "fermé" }, structure: { label: "structure" , texte: { regime: "technique"} }, appearance: { label: "apparence" , texte: { regime: "technique"} }, window: { label: "créneau horaire" }, shuttered: { label: "volets fermés" }, crossable: { label: "franchissable" }, allege: { label: "hauteur de l’allège" }, suspendu: { label: "suspendu" }, secret: { label: "secret" }, climb: { label: "escalade" } });

/**
 * UNE arête, UN segment — verrou AU PARSE (#1624). L'index d'arêtes (`noyau/monde/wallIndex.ts`) est la
 * seule lecture de « quels segments tiennent cette arête ? », et ses consommateurs prennent le
 * PREMIER (`aretesA(...)[0]`, composé par `noyau/monde/volume/toits.ts`) : un second segment sur la
 * même clé `x,y,side,z` serait une donnée MUETTE, jamais rendue ni lue. `setEdgeWall`
 * (`noyau/sceneEdit.ts`) dédoublonne à la pose, mais l'authoring littéral, `asciiMap` et les
 * documents relus par la porte (`parseProject`, `parseSceneDeProjet`, `noyau/worldMap.ts`) ne passent
 * pas par lui : le verrou est ICI. La clé est la MÊME graphie que l'index d'arêtes.
 */
const cleDArete = { nom: 'x,y,side,z', de: (w: z.infer<typeof wallSegSchema>): string => `${w.x},${w.y},${w.side},${w.z ?? 0}` };

/** Ancre AUTHORÉE d'une Scène de bataille (S2) sur le plan : `MassBattleState.pool` = l'id d'une
 *  Scène de bataille, `ActivityDef` contexte 'bataille-round', posée sur une case de la carte. La
 *  Puissance des armées reste une abstraction NON rendue — seul l'emplacement de l'ACTION est posé.
 *  Consommé par `battleScenesToStations` (noyau/stations.ts) ; absence d'ancre → repli déterministe
 *  côté consommateur. */
export const sceneStationAnchorSchema = nommerChamps(z.strictObject({
  sceneId: z.string(),
  pos: ptSchema,
}), { sceneId: { label: "scène" , texte: { regime: "technique"} }, pos: { label: "position" } });

/** Les trois BLOCS DE LOGIQUE d'une scène, listes à clé : la scène les compose, et la modale « Avancé »
 *  de l'éditeur (`SCHEMA_BLOCS_AVANCES`) les reprend TELS QUELS — une seule déclaration de leur clé. */
export const dialoguesSchema = listeCle(dialogueSchema, 'id');
export const triggersSchema = listeCle(triggerSchema, 'id');
export const encountersSchema = listeCle(encounterDefSchema, 'id');

// ── La scène ────────────────────────────────────────────────────────────────────────────────────

/**
 * `Scene` (`noyau/monde/scene.ts:370`) — l'agrégat. Les collections `layers`/`entities`/`dialogues`/
 * `triggers`/`encounters`/`flags`, requises sur le type manuscrit, sont OPTIONNELLES ici : le
 * schéma voit le document AVANT `normalizeScene`, qui les comble aux portes (`parseProject`,
 * `parseSceneDeProjet`).
 */
export const messageIntroductionSchema = proseNommee(nommerChamps(z.strictObject({}), {}), 'scenes[].startMessage.texte');

export const sceneSchema = nommerChamps(ouvrirPortees(z.strictObject({
  type: z.literal('scene'),
  id: z.string(),
  label: z.string(),
  /** Prose de la Scène — `.min(1).optional()`, comme l'enveloppe de document
   *  (`grammaire/document.ts`) : une prose ABSENTE est une CLÉ ABSENTE, jamais une chaîne vide (le
   *  troisième état, vu « présent » par les uns et « absent » par les autres). */
  desc: z.string().min(1).optional(),
  dimensions: nommerChamps(z.strictObject({ w: z.number(), h: z.number() }), { w: { label: "largeur" }, h: { label: "hauteur" } }),
  /** Échelle métrique d'une CASE (m/case) — défaut 2 ; ≥ 4 = Scène MER (`isMerScene`). */
  metresPerTile: z.number().optional(),
  ambiance: ambianceSchema.optional(),
  /** Classification écologique lue par les attributs de Domaine (`LDB 48 l.690`). */
  environment: z.enum(['rural', 'urbain', 'sauvage']).optional(),
  /** Météo (`LDB 14 l.68-82`) — l'ABSENCE est une VALEUR : temps non spécifié, aucun modificateur de
   *  combat et aucune ambiance de météo. Lue SANS REPLI par `noyau/monde/sceneRules.ts`
   *  (`sceneCombatModifiers`) et par l'ambiance de rendu. */
  weather: sceneWeatherSchema.optional(),
  /** `'auto'`/absent = suit l'horloge via `ambiance`. */
  ambientLight: ouReserve(idDe('lightLevel', undefined, { nue: true }), 'auto').optional(),
  /** NORD de la carte — rotation horaire en degrés `[0,360[` du nord réel (posé par `setNorthDeg`). */
  northDeg: z.number().optional(),
  rest: nommerChamps(z
    .strictObject({
      auberge: z.boolean().optional(),
      maison: z.boolean().optional(),
      camp: z.boolean().optional(),
      quality: z.enum(['normale', 'pietre']).optional(),
    }), { auberge: { label: "auberge" }, maison: { label: "chez soi" }, camp: { label: "camp" }, quality: { label: "qualité"  } })
    .optional(),
  /** Offre de repos PAR ZONE — prioritaire sur `rest` là où le groupe se tient. */
  restZones: z
    .array(
      nommerChamps(z.strictObject({
        rect: rectSchema,
        places: restPlacesSchema,
        quality: z.enum(['normale', 'pietre']).optional(),
      }), { rect: { label: "rectangle" }, places: { label: "lieux" }, quality: { label: "qualité"  } }),
    )
    .optional(),
  effectZones: listeCle(sceneEffectZoneSchema, 'id').optional(),
  /** Ids de pistes du registre audio ; `null` = SILENCE forcé, absent = AUTOMATIQUE. */
  music: nommerChamps(z.strictObject({ ambient: idDe('son', undefined, { nue: true }).nullable().optional(), combat: idDe('son', undefined, { nue: true }).nullable().optional() }), { ambient: { label: "ambiance sonore" , texte: { regime: "technique"} }, combat: { label: "combat" , texte: { regime: "technique"} } }).optional(),
  /** Matière de chaque PARTIE de relief (#1691) — EXIGÉE : c'est la donnée que le builder LIT. */
  reliefDefaults: reliefDefaultsSchema,
  /** Toiture par défaut de la scène (#1715) — EXIGÉE : c'est la donnée que la dérivation LIT. */
  roofDefaults: sceneRoofDefaultsSchema,
  layers: listeCle(layerSchema, 'z').optional(),
  /** Cloisons sur arête — au plus UNE par clé `x,y,side,z` (`cleDArete`). */
  walls: listeCle(wallSegSchema, cleDArete).optional(),
  entities: listeCle(sceneEntitySchema, 'id').optional(),
  /** `SeatAssignments` (`noyau/monde/seating.ts:65`) — `propId → slotId → occupant` (rang du groupe ou entité). */
  seatAssignments: z.record(z.string(), z.record(z.string(), seatOccupantSchema)).optional(),
  architecture: listeCle(architectureBodySchema, 'id').optional(),
  dialogues: dialoguesSchema.optional(),
  triggers: triggersSchema.optional(),
  encounters: encountersSchema.optional(),
  stations: listeCle(sceneStationAnchorSchema, 'sceneId').optional(),
  flags: z.record(z.string(), z.boolean()).optional(),
  /** Points d'arrivée nommés — `z` = étage visé (défaut 0, #835 FU-5). */
  entryPoints: z.record(z.string(), ptSchema).optional(),
  startMessage: messageIntroductionSchema.optional(),
  couvre: couvreSchema.optional(),
  /** Groupes que porte le lieu, source psychologique de la scène (`etiquetteDeScene`). #3045 */
  groups: refs('groupe', { sousListe: DECLARABLE_PAR_UN_PORTEUR }).optional(),
}).superRefine((scene, ctx) => {
  // CARDINAL de la grille (#1789) : chaque tableau PARALLÈLE d'une couche porte EXACTEMENT `w×h`
  // entrées — la grille est aplatie, indexée `y·w+x` (`tiles`, et quand ils sont présents `height`
  // et `crenellated`) ; un tableau plus court rendrait des trous que les lectures devraient replier,
  // et le repli masquerait le document malformé. C'est ce qui permet à `tileAt` de n'avoir AUCUN
  // repli de tuile (`noyau/monde/scene.ts`) et à `heightAt` de ne replier que l'absence du tableau ENTIER.
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
}), PORTEES_DE_LA_SCENE), { type: { label: "type"  }, id: { label: "identifiant" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, desc: { label: "texte" , texte: { regime: "atelier",usage: "description de scène réservée à l’atelier"} }, dimensions: { label: "dimensions" }, metresPerTile: { label: "mètres par case" }, ambiance: { label: "ambiance"  }, environment: { label: "environnement"  }, weather: { label: "météo"  }, ambientLight: { label: "éclairage ambiant" , texte: { regime: "technique"} }, northDeg: { label: "orientation du nord" }, rest: { label: "repos" }, restZones: { label: "zones de repos" }, effectZones: { label: "zones d’effet" }, music: { label: "musique" }, reliefDefaults: { label: "relief par défaut" }, roofDefaults: { label: "toit par défaut" }, layers: { label: "couches" }, walls: { label: "murs" }, entities: { label: "entités" }, seatAssignments: { label: "places assignées" , texte: { regime: "technique"} }, architecture: { label: "bâtiments" }, dialogues: { label: "dialogues" }, triggers: { label: "déclencheur" }, encounters: { label: "rencontres" }, stations: { label: "présences" }, flags: { label: "drapeaux" , texte: { regime: "technique"} }, entryPoints: { label: "points d’entrée" , texte: { regime: "technique"} }, startMessage: { label: "message de départ" }, couvre: { label: "entrées couvertes" , texte: { regime: "technique"} }, groups: { label: "groupes du lieu" , texte: { regime: "technique"} } });

nommerNoeud(sceneSchema, { element: 'scène' });
nommerNoeud(triggerSchema, { element: 'déclencheur' });
nommerNoeud(dialogueSchema, { element: 'dialogue' });
nommerNoeud(dialogueNodeSchema, { element: 'nœud' });
nommerNoeud(dialogueChoiceSchema, { element: 'réponse' });
nommerNoeud(sceneEntitySchema, { element: 'entité' });
