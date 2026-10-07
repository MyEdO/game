import { nommerChamps, nommerNoeud, nomDeNoeud } from '../grammaire/meta';
/**
 * EFFETS DE SCÈNE — les 57 variantes de l'union `Effect` (`src/state/scene.ts`) en zod, plus le
 * `Flow<Effect>` de scène. Avec la feuille `ops` (`EffectOp`, possédée par la grammaire), l'union
 * compte 58 membres — le compte que porte le doc généré `docs/campagne-effects.md`. C'est la DÉFINITION : `state/scene.ts` en dérive ses alias par
 * `z.infer` ; seules les deux variantes qui portent un `Flow` (`delayedEffect`, `petitePriere`)
 * gardent un corps manuscrit, parce qu'`Effect` et `Flow<Effect>` sont MUTUELLEMENT récursifs et
 * qu'une récursion mutuelle en deux `discriminatedUnion` inférés ne compile pas (TS7022) : le
 * montage qui tient est `z.ZodType<T> = z.lazy(…)`, où le type manuscrit est l'ANNOTATION.
 *
 * Le `flowSchema` de la grammaire (`grammaire/mecanique.ts`) reste `Flow<EffectOp>` : sa feuille
 * `do` est la seule op mécanique. `sceneFlowSchema` ci-dessous est le MÊME arbre paramétré sur
 * l'union `Effect` complète (transition/dialogue/combat…) — `conditionSchema` est partagé et le nœud
 * `test` vient de la fabrique `noeudTest` de la grammaire, aucune structure n'est recopiée.
 */
import { z } from 'zod';
import { ouverts } from '../grammaire/descente';
import { champAdapteDe, champsProse, proseNommee, refineAdapteDe, refineProse, META_PROSE, META_ADAPTE_DE } from '../grammaire/prose';
import { chaosAlignSchema, enumNomme, exposureLevelSchema, hitLocationSchema, moneyPartialSchema, refTestDeCorruption, surchargePaletteSchema } from '../grammaire/valeurs';
import { conditionSchema, effectOpSchema, extendedTestSchema, gameOpSchema, noeudTest } from '../grammaire/mecanique';
import { idDe, refOuSpec } from '../grammaire/ref';
import { INSTANCIABLE_PAR_ID } from '../grammaire/sousListes';
import { listeCle } from '../grammaire/collection-cle';
import { customStatblockSchema, ptSchema, wallSideSchema } from './communs';
import { waterAppliesToSchema } from '../defs/water-exposure';
import type { Effect } from '../../../state/scene';
import type { Flow } from '../../../engine/flowCore';
import { dataLabel } from '../../index';
import type { PlayerText } from '../../../i18n/playerText';

// ── Vocabulaire des effets ──────────────────────────────────────────────────────────────────────

/** `DayPhaseId` (`engine/clock.ts`) — phases d'AFFICHAGE de la journée. */
export const dayPhaseIdSchema = z.enum(['aube', 'matin', 'midi', 'apresmidi', 'crepuscule', 'soir', 'nuit']);
/** Cible d'un effet de scène : tout le groupe, ou UN héros (`heroId`, défaut le premier). */
export const effectTargetSchema = z.enum(['party', 'hero']);
/** `LivingRef` (`engine/possession.ts`) — bestiaire (édition Codex vivante) OU statbloc custom
 *  d'éditeur (le snapshot EST son identité). */
export const idDeCreature: z.ZodType<string, string> = idDe('creature');
export const livingRefSchema = z.union([
  nommerChamps(z.strictObject({ creatureId: idDeCreature }), { creatureId: { label: "créature" } }),
  nommerChamps(z.strictObject({ custom: customStatblockSchema }), { custom: { label: "profil personnalisé" } }),
]);
/** `ChaosAlign` (`engine/corruption.ts`) — Puissance du Chaos d'une table de mutation alignée. MÊME
 *  vocabulaire que la charge de l'op `corruption` : la const NOMMÉE de la grammaire est partagée (#1694). */
export { chaosAlignSchema };
/** `WaterExposureMode` (`src/data/index.ts`) — `MSRC 16` : boire, ou être immergé. MÊME vocabulaire
 *  que `waterExposure.modifiers[].appliesTo` : la const NOMMÉE du def de règle est partagée (#1694). */
export const waterExposureModeSchema = waterAppliesToSchema;
/** LDB 23 l.145-151 */
export const favorLevelSchema = enumNomme({
  mineure: 'Faveur Mineure',
  majeure: 'Faveur Majeure',
  importante: 'Faveur Importante',
});
/** `CrewHire` (`engine/crewMorale.ts`) — un rôle d'équipage salarié et son effectif. */
export const crewHireSchema = nommerChamps(z.strictObject({ roleId: z.string(), count: z.number() }), { roleId: { label: "rôle" }, count: { label: "nombre" } });
/** `PursuitFoeRef` (`state/pursuitFlow.ts`) — adversaire de poursuite : une RÉFÉRENCE de vivant
 *  (`livingRefSchema` — bestiaire ou statbloc d'éditeur), jamais des stats recopiées. Son Mouvement et
 *  sa valeur de Test de Mouvement se LISENT sur la fiche référencée, résolus au démarrage
 *  (`state/pursuitFlow`). `id` est posé à l'ouverture quand l'auteur n'en écrit pas — il sert aux
 *  décisions de camp (`PursuitPolicy.prioritaires`). */
/** LDB 15 l.94 */
export const pursuitFoeSchema = nommerChamps(z.strictObject({
  id: z.string().optional(),
  ref: livingRefSchema,
}), { id: { label: "identifiant" }, ref: { label: "référence" } });
/** LDB 15 l.94. */
export const pursuitPolicySchema = nommerChamps(z.strictObject({
  sacrifice: z.enum(['jamais', 'toujours', 'si-ecart']).optional(),
  /** LDB 15 l.94. */
  ecartM: z.number().optional(),
  arret: z.enum(['le-plus-lent', 'aucun']).optional(),
  /** LDB 15 l.94. */
  prioritaires: z.array(z.string()).optional(),
}), { sacrifice: { label: "sacrifice" }, ecartM: { label: "écart de Mouvement" }, arret: { label: "arrêt" }, prioritaires: { label: "cibles prioritaires" } });
/** ADE II 8. */
export const massBattleSpecSchema = proseNommee(nommerChamps(z.strictObject({
  allyName: z.string().optional(),
  enemyName: z.string().optional(),
  allyMight: z.number(),
  enemyMight: z.number(),
  /** ADE II 8 l.124. */
  plannedRounds: z.number().optional(),
  /** ADE II 8 l.128. */
  scenes: z.array(z.string()).optional(),
  /** ADE II 8 l.128. */
  situations: z.array(z.array(z.string())).optional(),
  situationSize: z.number().optional(),
  /** Rencontres à démarrer pour les Scènes de COMBAT/MENACE (par id de Scène → id d'encounter). */
  sceneEncounters: z.record(z.string(), z.string()).optional(),
  /** ADE II 8 l.81. */
  allyMod: z.number().optional(),
}), { allyName: { label: "nom des alliés" }, enemyName: { label: "nom des ennemis" }, allyMight: { label: "puissance alliée" }, enemyMight: { label: "puissance ennemie" }, plannedRounds: { label: "Rounds prévus" }, scenes: { label: "Scènes" }, situations: { label: "situations" }, situationSize: { label: "taille de situation" }, sceneEncounters: { label: "rencontres de scène" }, allyMod: { label: "modificateur allié" } }), 'massBattle.terrain');

/** `ScheduleSpec` (`engine/clock.ts`) — échéance d'horloge, résolue par `scheduleAt` (source unique
 *  de `delayedEffect` ET `setObjective`). Étalée en SHAPE : les deux variantes qui la portent sont
 *  des INTERSECTIONS `& ScheduleSpec` côté manuscrit. */
export const scheduleMeta = { afterMinutes: { label: 'délai en minutes' }, afterDays: { label: 'délai en jours' }, atDate: { label: 'date' }, atHour: { label: 'heure' }, atMinute: { label: 'minute' } };
export const scheduleShape = {
  afterMinutes: z.number().optional(),
  /** Dans N jours (à partir d'AUJOURD'HUI), à l'heure `atHour:atMinute` (défaut minuit). */
  afterDays: z.number().optional(),
  /** Date impériale ABSOLUE (année défaut = année courante de la partie). */
  atDate: nommerChamps(z
    .strictObject({
      year: z.number().optional(),
      month: z.number(),
      day: z.number(),
      hour: z.number().optional(),
      minute: z.number().optional(),
    }), { year: { label: "année" }, month: { label: "mois" }, day: { label: "jour" }, hour: { label: "heure" }, minute: { label: "minute" } })
    .optional(),
  atHour: z.number().optional(),
  atMinute: z.number().optional(),
} as const;

// ── Les variantes ───────────────────────────────────────────────────────────────────────────────

export const setFlagSchema = nommerChamps(z.strictObject({ type: z.literal('setFlag'), flag: z.string(), value: z.boolean().optional() }), { type: { label: "type" }, flag: { label: "drapeau" }, value: { label: "valeur" } });

/** Pose/met à jour un OBJECTIF courant (surface « je fais quoi maintenant ? », #238) sur la pile
 *  `store.objectives`, keyé par `id` STABLE : re-poser le même `id` MET À JOUR sa prose (`desc`). Le HUD
 *  affiche le plus récent. Archivé aussi au journal. Échéance optionnelle (même `ScheduleSpec` que
 *  `delayedEffect`) → pose `Objective.deadline` (minute absolue) → compte à rebours dans le bandeau. */
export const setObjectiveSchema = nommerChamps(z.strictObject({
  type: z.literal('setObjective'),
  id: z.string(),
  desc: z.string(),
  ...scheduleShape,
}), { type: { label: "type" }, id: { label: "identifiant" }, desc: { label: "texte" }, ...scheduleMeta });

/** Retire un objectif de la pile : `id` précis, ou TOUS si absent (fin d'acte). */
export const clearObjectiveSchema = nommerChamps(z.strictObject({ type: z.literal('clearObjective'), id: z.string().optional() }), { type: { label: "type" }, id: { label: "identifiant" } });

/** Objet donné par `giveTrapping` : feuille OUVERTE de `INSTANCIABLE_PAR_ID`, FORME DE SORTIE déclarée
 *  nue (patron `sortSchema`) — `Effect` est un `z.infer` écrit par l'éditeur et par la console. */
const objetDonneSchema: z.ZodType<string, string> = idDe('trapping', INSTANCIABLE_PAR_ID, { ouverte: true });

/** Donne un objet à un héros (défaut : le premier). `trappingId` = objet à stats de la campagne
 *  (`narratif.objets`) ou du catalogue, feuille OUVERTE de `INSTANCIABLE_PAR_ID` ; `custom` = objet HORS-base (nom libre — trinket/quête/pièces de monstre) sans
 *  stats. L'objet arrive NON équipé. Champs MAGIQUES optionnels (butin/quête) : `qualities` AJOUTÉES
 *  (Atout/Défaut), `identified:false` = qualités masquées jusqu'à Évaluation (#2), `skin` = recoloration. */
export const giveTrappingSchema = nommerChamps(z.strictObject({
  type: z.literal('giveTrapping'),
  trappingId: objetDonneSchema.optional(),
  custom: z.string().optional(),
  heroId: z.string().optional(),
  qualities: z.array(z.string()).optional(),
  identified: z.boolean().optional(),
  skin: surchargePaletteSchema.optional(),
  /** Aura détectée / Détection déjà tentée / jour de la
   *  dernière Évaluation ratée — posés par la fenêtre de loot AVANT attribution, propagés sur
   *  l'ItemInstance à la remise. */
  /** LDB 10 l.332-336 */
  magicKnown: z.boolean().optional(),
  detectTried: z.boolean().optional(),
  appraiseTriedDay: z.number().optional(),
  /** Valeur de marché propre posée sur l'instance (ex. pièces de monstre récoltées, `ZI`). */
  price: moneyPartialSchema.optional(),
}), { type: { label: "type" }, trappingId: { label: "objet" }, custom: { label: "profil personnalisé" }, heroId: { label: "héros" }, qualities: { label: "qualités" }, identified: { label: "identifié" }, skin: { label: "palette" }, magicKnown: { label: "magie connue" }, detectTried: { label: "détection tentée" }, appraiseTriedDay: { label: "jour de la dernière évaluation" }, price: { label: "prix" } });

/** Donne une POSSESSION (bête/serviteur/véhicule — le SOCLE POSSESSIONS #615, registre
 *  `GameState.possessions`) à un héros propriétaire (défaut : le premier — même patron que
 *  `giveTrapping.heroId`, §4.3). `ref` réutilise `LivingRef` (bête/serviteur, bestiaire OU statbloc
 *  custom) ou `{vehicleId}` (véhicule, catalogue `vehicles.json`). */
const idDeVehicule: z.ZodType<string, string> = idDe('vehicle');
export const givePossessionSchema = nommerChamps(z.strictObject({
  type: z.literal('givePossession'),
  nature: z.enum(['bete', 'serviteur', 'vehicule']),
  ref: z.union([livingRefSchema, nommerChamps(z.strictObject({ vehicleId: idDeVehicule }), { vehicleId: { label: "véhicule" } })]),
  heroId: z.string().optional(),
}), { type: { label: "type" }, nature: { label: "nature" }, ref: { label: "référence" }, heroId: { label: "héros" } });

/** Donne (ou RETIRE, montant négatif) de l'argent au groupe. La charge porte son NOM comme toute
 *  autre action du vocabulaire (`giveXp.amount`, `givePossession.ref`) : `montant` est une somme
 *  `Money` PARTIELLE — un coût authoré n'écrit que les dénominations qu'il chiffre. */
export const giveMoneySchema = nommerChamps(z.strictObject({
  type: z.literal('giveMoney'),
  montant: moneyPartialSchema,
}), { type: { label: "type" }, montant: { label: "montant" } });

/** Octroie des Points d'Expérience à TOUT le groupe (XP de session, identique pour tous). Support
 *  générique de l'attribution événementielle par scénario (`PDT 13 l.5`) : chaque scénario/campagne
 *  authore ses propres octrois via cette action, à tout point narratif (victoire, objectif, dialogue…). */
export const giveXpSchema = nommerChamps(z.strictObject({ type: z.literal('giveXp'), amount: z.number() }), { type: { label: "type" }, amount: { label: "quantité" } });

export const startCombatSchema = nommerChamps(z.strictObject({ type: z.literal('startCombat'), encounter: z.string() }), { type: { label: "type" }, encounter: { label: "rencontre" } });

/** Combat de masse / Puissance de Bataille : ouvre l'écran de bataille sur le
 *  `MassBattleSpec` AUTHORÉ (armées, Rounds prévus, situations de Scènes par Round, rencontres des
 *  Scènes de combat, modificateur permanent). Appliqué par le store `startMassBattle` (state/massBattleFlow). */
/** ADE II 8 */
export const startMassBattleSchema = nommerChamps(z.strictObject({ type: z.literal('startMassBattle'), battle: massBattleSpecSchema }), { type: { label: "type" }, battle: { label: "bataille" } });

export const transitionSchema = nommerChamps(z.strictObject({ type: z.literal('transition'), scene: z.string(), entry: z.string().optional() }), { type: { label: "type" }, scene: { label: "scène" }, entry: { label: "entrée" } });

/** Retour à la scène précédente (sortie d'intérieur), à la case d'entrée. */
export const transitionBackSchema = nommerChamps(z.strictObject({ type: z.literal('transitionBack') }), { type: { label: "type" } });

/** Ouvre le dialogue scripté `dialogue`. `speakerId` (optionnel) = id d'une `SceneEntity` de la
 *  scène courante → son PORTRAIT et son NOM (label) pour toute la session de dialogue, tant qu'un
 *  nœud ne porte pas son propre `speakerId` (cf. `DialogueNode.speakerId`). */
export const startDialogueSchema = nommerChamps(z.strictObject({
  type: z.literal('startDialogue'),
  dialogue: z.string(),
  speakerId: z.string().optional(),
}), { type: { label: "type" }, dialogue: { label: "dialogue" }, speakerId: { label: "locuteur" } });

/** Ligne de journal : `descRef` (verbatim) ⊕ `adapteDe` (`grammaire/prose.ts`). */
export const journalSchema = nommerChamps(z
  .strictObject({ type: z.literal('journal'), ...champsProse(), ...champAdapteDe() })
  .superRefine(refineProse({ type: 'projet', exigeProse: true }))
  .superRefine(refineAdapteDe), { type: { label: "type" }, ...META_PROSE, ...META_ADAPTE_DE });

/** Remet au joueur un document du narratif (#679) : `documentId` → `narratif.documents`, résolu au parse
 *  du projet (`refsNarrativesPendantes`, `./refs-narratives.ts`). */
export const documentSchema = nommerChamps(z.strictObject({ type: z.literal('document'), documentId: z.string() }), { type: { label: "type" }, documentId: { label: "document" } });

/** Mécanique MAISON du carnet d'enquête (#670, aucune règle RAW) : révèle/avance un `Indice` de
 *  `campaignNarratif`. `stade` omis → `revealClue` (`state/clues.ts`). */
export const revealClueSchema = nommerChamps(z.strictObject({
  type: z.literal('revealClue'),
  indiceId: z.string(),
  stade: z.string().optional(),
}), { type: { label: "type" }, indiceId: { label: "indice" }, stade: { label: "stade" } });

/** Écarte un indice comme fausse piste (barré, relisible au carnet) — mécanique MAISON (#670). */
export const discreditClueSchema = nommerChamps(z.strictObject({ type: z.literal('discreditClue'), indiceId: z.string() }), { type: { label: "type" }, indiceId: { label: "indice" } });

/** Enfoncer une PORTE/objet à PLUSIEURS (`EDO Appendice 2`) : objet (BE = Bonus d'Endurance, B =
 *  Blessures) ; chaque héros frappe (Bagarre, dégâts = DR + BF − BE). `flag` posé quand l'objet cède. */
export const forceDoorSchema = nommerChamps(z.strictObject({
  type: z.literal('forceDoor'),
  label: z.string(),
  doorBE: z.number(),
  doorB: z.number(),
  flag: z.string().optional(),
}), { type: { label: "type" }, label: { label: "libellé" }, doorBE: { label: "Bonus d’Endurance de la porte" }, doorB: { label: "Blessures de la porte" }, flag: { label: "drapeau" } });

/** Règle l'horloge par SAUT EN AVANT (le temps ne recule jamais) : soit sur une `phase` de la
 *  journée (« passe à l'aube/…/nuit »), soit sur une heure précise (`hour`[`:minute`]) — jamais les
 *  deux, jamais aucune des deux. Le XOR est porté ici : `minute` n'a de sens qu'avec `hour`. */
export const setTimeSchema = nommerChamps(z
  .strictObject({
    type: z.literal('setTime'),
    phase: dayPhaseIdSchema.optional(),
    hour: z.number().optional(),
    minute: z.number().optional(),
  })
  .superRefine((v, ctx) => {
    const parPhase = v.phase !== undefined;
    const parHeure = v.hour !== undefined;
    if (parPhase === parHeure) {
      ctx.addIssue({
        code: 'custom',
        message: "setTime : exactement l'un de `phase` ou `hour` (jamais les deux, jamais aucun)",
        path: parPhase ? ['hour'] : ['phase'],
      });
    }
    if (v.minute !== undefined && !parHeure) {
      ctx.addIssue({ code: 'custom', message: 'setTime : `minute` ne se pose qu\'avec `hour`', path: ['minute'] });
    }
  }), { type: { label: "type" }, phase: { label: "phase" }, hour: { label: "heure" }, minute: { label: "minute" } });

/** Ouvre la boutique d'une entité marchande (par son id) — permet d'inclure le Marchand dans un
 *  dialogue (ex. choix « Montrez-moi vos marchandises »). L'entité doit porter `merchant` (#2). */
export const openMerchantSchema = nommerChamps(z.strictObject({ type: z.literal('openMerchant'), entityId: z.string() }), { type: { label: "type" }, entityId: { label: "entité" } });

/** Ouvre le PORT d'un lieu de la carte du monde — SCRIPTÉ (arrivée mise en scène, cinématique
 *  de quête) sur le MÊME chemin que l'accostage en mer (`openPortAt`, state/seaVoyageFlow) : avec profil
 *  de port → relâche à terre en attente de décision (`pendingShoreLeave`) ; sans profil → transition
 *  directe. `placeId` = id d'un `MapPlace` de `state.worldMap`. */
/** MDG 15 l.127-129 */
export const openPortSchema = nommerChamps(z.strictObject({ type: z.literal('openPort'), placeId: z.string() }), { type: { label: "type" }, placeId: { label: "lieu" } });

/** LDB 75 l.19 */
export const medicalAidSchema = nommerChamps(z.strictObject({
  type: z.literal('medicalAid'),
  acts: z
    .array(nommerChamps(z.strictObject({ act: z.enum(['wounds', 'bleed', 'trauma', 'surgery']), cost: moneyPartialSchema.optional() }), { act: { label: "acte" }, cost: { label: "coût" } }))
    .optional(),
  entityId: z.string(),
}), { type: { label: "type" }, acts: { label: "actes" }, entityId: { label: "entité" } });

/** LDB 17 l.41 */
export const restoreFortuneSchema = nommerChamps(z.strictObject({ type: z.literal('restoreFortune') }), { type: { label: "type" } });

/** LDB 18 l.296 ; LDB 66 ; LDB 21 l.95 */
export const restSchema = nommerChamps(z.strictObject({
  type: z.literal('rest'),
  days: z.number().optional(),
  lodging: z.enum(['auberge', 'maison', 'camp']).optional(),
  quality: z.enum(['normale', 'pietre']).optional(),
}), { type: { label: "type" }, days: { label: "jours" }, lodging: { label: "couchage" }, quality: { label: "qualité" } });

/** LDB 18 l.338 */
export const mealPartySchema = nommerChamps(z.strictObject({ type: z.literal('mealParty') }), { type: { label: "type" } });

/** LDB 21 l.95 */
export const inflictNightmaresSchema = nommerChamps(z.strictObject({ type: z.literal('inflictNightmares'), heroId: z.string().optional() }), { type: { label: "type" }, heroId: { label: "héros" } });

/** ADE II 9 l.21 */
export const ambitionLostSchema = nommerChamps(z.strictObject({ type: z.literal('ambitionLost'), heroId: z.string().optional() }), { type: { label: "type" }, heroId: { label: "héros" } });

/** LDB 21 l.25-27, l.54-56 */
export const inflictPsychologySchema = nommerChamps(z.strictObject({
  type: z.literal('inflictPsychology'),
  kind: z.enum(['peur', 'terreur']),
  indice: z.number(),
  label: z.string(),
  target: effectTargetSchema.optional(),
  heroId: z.string().optional(),
}), { type: { label: "type" }, kind: { label: "type" }, indice: { label: "indice" }, label: { label: "libellé" }, target: { label: "cible" }, heroId: { label: "héros" } });

/** Inflige une Maladie à un héros (défaut : le premier) — nourriture avariée, contact infecté,
 *  morsure… L'auteur choisit la maladie (diseaseDefs()) ; incubation/durée sont tirées à la contraction. */
/** LDB 20 */
export const inflictDiseaseSchema = nommerChamps(z.strictObject({
  type: z.literal('inflictDisease'),
  disease: z.string(),
  heroId: z.string().optional(),
}), { type: { label: "type" }, disease: { label: "maladie" }, heroId: { label: "héros" } });

/** LDB 18 l.338-343 */
export const inflictHungerSchema = nommerChamps(z.strictObject({
  type: z.literal('inflictHunger'),
  days: z.number().optional(),
  target: effectTargetSchema.optional(),
  heroId: z.string().optional(),
}), { type: { label: "type" }, days: { label: "jours" }, target: { label: "cible" }, heroId: { label: "héros" } });

/** LDB 18 l.338-343 */
export const inflictThirstSchema = nommerChamps(z.strictObject({
  type: z.literal('inflictThirst'),
  days: z.number().optional(),
  target: effectTargetSchema.optional(),
  heroId: z.string().optional(),
}), { type: { label: "type" }, days: { label: "jours" }, target: { label: "cible" }, heroId: { label: "héros" } });

/** LDB 18 l.326-334 */
export const exposureNightSchema = nommerChamps(z.strictObject({
  type: z.literal('exposureNight'),
  kind: z.enum(['froid', 'chaleur']),
  count: z.number().optional(),
  target: effectTargetSchema.optional(),
  heroId: z.string().optional(),
}), { type: { label: "type" }, kind: { label: "type" }, count: { label: "nombre" }, target: { label: "cible" }, heroId: { label: "héros" } });

export const inflictTraumaSchema = nommerChamps(z.strictObject({
  type: z.literal('inflictTrauma'),
  kind: z.enum(['dechirure', 'fracture', 'amputation']),
  severity: z.enum(['mineur', 'majeur']).optional(),
  location: hitLocationSchema,
  heroId: z.string().optional(),
}), { type: { label: "type" }, kind: { label: "type" }, severity: { label: "gravité" }, location: { label: "localisation" }, heroId: { label: "héros" } });

/** Souffle de ZONE (Lot 3) centré sur une case : tous les combattants à `radius` cases (Chebyshev)
 *  — en combat par position, hors combat le groupe (à partyPos) — subissent les `ops` (vocabulaire
 *  unique `GameOp`, appliquées par `applyOps` cible par cible). Bombe, grenade, piège de zone…
 *  Dégâts BRUTS par défaut (`op:'wounds'` ignore BE+PA) ; mitiger = `{ignoreTB:false, ignoreAP:false}`. */
export const zoneBlastSchema = nommerChamps(z.strictObject({
  type: z.literal('zoneBlast'),
  center: nommerChamps(z.strictObject({ x: z.number(), y: z.number() }), { x: { label: "abscisse" }, y: { label: "ordonnée" } }),
  radius: z.number(),
  ops: z.array(gameOpSchema),
}), { type: { label: "type" }, center: { label: "centre" }, radius: { label: "rayon" }, ops: { label: "opérations" } });

/** LDB 15 l.80-84 */
export const fallSchema = nommerChamps(z.strictObject({
  type: z.literal('fall'),
  target: effectTargetSchema,
  heroId: z.string().optional(),
  metres: z.number(),
  to: ptSchema.optional(),
}), { type: { label: "type" }, target: { label: "cible" }, heroId: { label: "héros" }, metres: { label: "mètres" }, to: { label: "destination" } });

/** Mise en scène (Lot L) : règle le niveau de LUMIÈRE de la scène (0 = noir, 1 = plein jour) — « les
 *  lumières baissent, le rideau se lève ». Lu par le rendu (overlay d'assombrissement). Générique :
 *  tout intérieur (donjon, salle, théâtre). null implicite = auto (horloge/ambiance) tant qu'aucun setLight. */
export const setLightSchema = nommerChamps(z.strictObject({ type: z.literal('setLight'), level: z.number() }), { type: { label: "type" }, level: { label: "niveau" } });

/** Porte dynamique (brouillard de guerre) : ouvre/ferme la porte de l'arête (x,y,side), et/ou RÉVÈLE
 *  une porte secrète (`setDoorRevealed`, `EDO 08 l.404`) — `revealed` s'applique AVANT `open` —, et/ou
 *  pose la marque de TENTATIVE de sa découverte (`attempted`, `setDoorTentee` ; arbitrage #700,
 *  2026-09-29). Une porte fermée bloque vue ET passage. Pour un levier/piège/scripted authored. */
export const setDoorSchema = nommerChamps(z.strictObject({
  type: z.literal('setDoor'),
  x: z.number(),
  y: z.number(),
  side: wallSideSchema,
  z: z.number().optional(),
  open: z.boolean().optional(),
  revealed: z.boolean().optional(),
  attempted: z.boolean().optional(),
}).superRefine((v, ctx) => {
  if (v.open === undefined && v.revealed === undefined && v.attempted === undefined) {
    ctx.addIssue({ code: 'custom', path: ['open'], message: "setDoor : au moins l'un de `open`, `revealed` ou `attempted`" });
  }
}), { type: { label: "type" }, x: { label: "abscisse" }, y: { label: "ordonnée" }, side: { label: "côté" }, z: { label: "étage" }, open: { label: "ouvert" }, revealed: { label: "révélé" }, attempted: { label: "tentative effectuée" } });

/** Repositionne (ANIMÉ) ou RETIRE une entité de scène posée — mise en scène scriptée (#701 : fuite,
 *  entrée, disparition d'un figurant). `to` = case cible (repositionnement) ; `remove` = l'entité
 *  quitte la scène (après `to` si fourni = fuite-puis-disparition). Entité introuvable = no-op. */
export const moveEntitySchema = nommerChamps(z.strictObject({
  type: z.literal('moveEntity'),
  id: z.string(),
  to: ptSchema.optional(),
  remove: z.boolean().optional(),
}), { type: { label: "type" }, id: { label: "identifiant" }, to: { label: "destination" }, remove: { label: "retirer" } });

/** Son PONCTUEL (cloche de minuit, cri hors-champ…) — id du registre audio (#701). */
export const playSfxSchema = nommerChamps(z.strictObject({ type: z.literal('playSfx'), id: z.string() }), { type: { label: "type" }, id: { label: "identifiant" } });

/** LDB 40 l.25-29, l.36, l.46 */
export const giveSinSchema = nommerChamps(z.strictObject({
  type: z.literal('giveSin'),
  amount: z.number().optional(),
  heroId: z.string().optional(),
}), { type: { label: "type" }, amount: { label: "quantité" }, heroId: { label: "héros" } });

/** LDB 19 l.25-75 */
export const corruptionExposureSchema = nommerChamps(z.strictObject({
  type: z.literal('corruptionExposure'),
  level: exposureLevelSchema,
  skill: refTestDeCorruption.optional(),
  align: chaosAlignSchema.optional(),
  heroId: z.string().optional(),
}), { type: { label: "type" }, level: { label: "niveau" }, skill: { label: "Compétence" }, align: { label: "Puissance du Chaos" }, heroId: { label: "héros" } });

/** Exposition HYDRIQUE (`MSRC 16` p.91 — « Maladies transmises par l'eau ») : Test de **Résistance
 *  Intermédiaire (+0)** modifié (tableau 1 « Source d'eau » = `source`, choix d'auteur de la zone
 *  d'eau ; tableau 2 « Blessures et États » DÉRIVÉ du héros, immersion seule) ; raté → d100 « +10
 *  pour chaque DR négatif » → maladie CONTRACTÉE directement (le Test d'exposition EST le test —
 *  jamais un second Test de Contraction). `mode` : `ingestion` (boire de l'eau non bouillie, l.5) /
 *  `immersion` (chute/nage, blessures ouvertes, l.7-9). Cible : `party` ou `hero` (+`heroId`). */
export const waterExposureSchema = nommerChamps(z.strictObject({
  type: z.literal('waterExposure'),
  mode: waterExposureModeSchema,
  source: z.string().optional(),
  target: effectTargetSchema.optional(),
  heroId: z.string().optional(),
}), { type: { label: "type" }, mode: { label: "mode" }, source: { label: "source" }, target: { label: "cible" }, heroId: { label: "héros" } });

/** Id de `spells.json` : porte `idDe('spell')`, FORME DE SORTIE déclarée nue (patron `couvertureSchema`,
 *  `./scene.ts`) — `Effect` est un `z.infer` écrit par l'éditeur et par la console. */
const sortSchema: z.ZodType<string, string> = idDe('spell');

/** LDB 46 l.14-20 */
export const learnSpellSchema = nommerChamps(z.strictObject({
  type: z.literal('learnSpell'),
  spell: sortSchema,
  heroId: z.string().optional(),
}), { type: { label: "type" }, spell: { label: "sort" }, heroId: { label: "héros" } });

/** Incantation SCRIPTÉE (#98) : rituel scénique, piège magique, PNJ qui lance à un beat précis (dialogue,
 *  trigger, effet différé). `casterId`/`targetId` = id STABLE d'un combattant — un combattant EN COMBAT
 *  (`Combatant.id === SceneEntity.id`) ou un héros du GROUPE hors combat (`actorIn`, state/combatOrParty) ;
 *  un PNJ hors combat n'a pas de Combatant à faire incanter — pas de pseudo-combat inventé pour ce cas
 *  (le lanceur doit alors être en combat). `targetId` absent = le lanceur (soi/zone). `mode:'jet'`
 *  (défaut) route par le flux d'incantation STANDARD (`castSpell`, cadence-aware ; modale influençable
 *  si le lanceur est piloté par un humain — jamais un jet silencieux). `mode:'forceSuccess'` = arbitrage
 *  D'AUTEUR explicite (rituel garanti, sans jet) : applique directement les effets du sort (`GameOp`,
 *  `ctx.caster` = le lanceur) — dérogation VOULUE, jamais un défaut. */
export const castSpellSchema = nommerChamps(z.strictObject({
  type: z.literal('castSpell'),
  casterId: z.string(),
  spellId: sortSchema,
  targetId: z.string().optional(),
  mode: z.enum(['jet', 'forceSuccess']).optional(),
}), { type: { label: "type" }, casterId: { label: "lanceur" }, spellId: { label: "sort" }, targetId: { label: "cible" }, mode: { label: "mode" } });

/** LDB 05 l.793-841 ; LDB 17 l.81 */
export const sessionEndSchema = nommerChamps(z.strictObject({ type: z.literal('sessionEnd') }), { type: { label: "type" } });

/** CRÉATION DE PERSONNAGE (#83) : ouvre l'assistant EXISTANT (`src/ui/creator/`) pour un NOUVEAU héros
 *  (comme le bouton « + » de l'écran Groupe) — un remplaçant scénarisé, un compagnon rejoignant le groupe.
 *  Navigue vers l'écran `creator` (`setEditingHero(null)` + `setScreen('creator')`). */
export const openCharacterCreatorSchema = nommerChamps(z.strictObject({ type: z.literal('openCharacterCreator') }), { type: { label: "type" } });

/** LDB 22 l.5 ; LDB 23 l.5-19 */
export const interludeSchema = nommerChamps(z.strictObject({ type: z.literal('interlude'), weeks: z.number().optional() }), { type: { label: "type" }, weeks: { label: "semaines" } });

/** LDB 23 l.139-153 */
export const grantFavorSchema = nommerChamps(z.strictObject({
  type: z.literal('grantFavor'),
  heroId: z.string().optional(),
  level: favorLevelSchema,
  owedTo: z.string(),
  desc: z.string(),
}), { type: { label: "type" }, heroId: { label: "héros" }, level: { label: "niveau" }, owedTo: { label: "bénéficiaire" }, desc: { label: "texte" } });

/** LDB 15 l.88-108 */
export const startPursuitSchema = nommerChamps(z.strictObject({
  type: z.literal('startPursuit'),
  partyRole: z.enum(['fleeing', 'pursuing']).optional(),
  distance: z.number(),
  escapeAt: z.number().optional(),
  skill: refOuSpec('skill'),
  foes: listeCle(pursuitFoeSchema, 'id'),
  encounter: z.string().optional(),
  policy: pursuitPolicySchema.optional(),
}), { type: { label: "type" }, partyRole: { label: "rôle du groupe" }, distance: { label: "distance" }, escapeAt: { label: "distance de fuite" }, skill: { label: "Compétence" }, foes: { label: "adversaires" }, encounter: { label: "rencontre" }, policy: { label: "décisions de poursuite" } });

/** Ouvre les JEUX DE TAVERNE (`NADJ 16`, option `tavern-games`) — à poser sur un choix de dialogue
 *  d'aubergiste (« Une partie ? ») ou une entité de taverne. Sans effet si l'option est éteinte. */
export const openTavernGamesSchema = nommerChamps(z.strictObject({ type: z.literal('openTavernGames') }), { type: { label: "type" } });

/** Ouvre la CARTE DU MONDE (#T2) — à poser sur la porte/route d'un lieu (« partir en voyage »).
 *  Sans effet si le projet n'a pas de carte ou en combat. */
export const openWorldMapSchema = nommerChamps(z.strictObject({ type: z.literal('openWorldMap') }), { type: { label: "type" } });

/** Dote le groupe d'un NAVIRE DE CAMPAGNE (`state.vessel`, `MDG 13-15`) — à poser quand le groupe
 *  reçoit/achète un bateau (don d'un patron, chantier). `vehicleId` = un navire de `vehicles.json`
 *  (facette `ship`) ; Moral et Blessures de coque INITIAUX authorés (coque neuve = pas de `wounds`).
 *  Le navire survit aux jours et aux combats (le voyage maritime et le Port en repartent). */
export const setVesselSchema = nommerChamps(z.strictObject({
  type: z.literal('setVessel'),
  vehicleId: idDeVehicule,
  label: z.string().optional(),
  morale: z.number().optional(),
  hullCurrent: z.number().optional(),
  hullMax: z.number().optional(),
  saboteurDR: z.number().optional(),
  waterLitres: z.number().optional(),
  provisions: z.number().optional(),
  crew: z.array(crewHireSchema).optional(),
}), { type: { label: "type" }, vehicleId: { label: "véhicule" }, label: { label: "libellé" }, morale: { label: "moral" }, hullCurrent: { label: "coque actuelle" }, hullMax: { label: "coque maximale" }, saboteurDR: { label: "DR de sabotage" }, waterLitres: { label: "eau en litres" }, provisions: { label: "provisions" }, crew: { label: "équipage" } });

/** Fait varier l'HUMEUR DE MANANN du navire de campagne (`MDG 15 l.83-125`) — à poser sur une
 *  bénédiction de prêtre, un sacrifice ou tout événement narratif d'auteur. `factorId` = un facteur
 *  du tableau « EFFET SUR L'HUMEUR DE MANANN » (`sea-events.json`, appliqué UNE SEULE FOIS par
 *  navire — `applyManannFactor`, l.85) ; `delta` = un ajustement chiffré libre hors-tableau (ex.
 *  « Fête de Manann » 2d10) — mutuellement exclusifs, `factorId` prioritaire si les deux sont posés.
 *  Sans navire de campagne → no-op journalisé. */
export const adjustManannSchema = nommerChamps(z.strictObject({
  type: z.literal('adjustManann'),
  factorId: z.string().optional(),
  delta: nommerChamps(z.strictObject({ flat: z.number(), d10: z.number(), sign: z.union([z.literal(1), z.literal(-1)]) }), { flat: { label: "valeur fixe" }, d10: { label: "dés à dix faces" }, sign: { label: "signe" } }).optional(),
}), { type: { label: "type" }, factorId: { label: "facteur" }, delta: { label: "variation" } });

/** AJUSTE le navire de campagne EXISTANT (#233) — patch des SEULS champs fournis, contrairement à
 *  `setVessel` (remplacement total : effacerait Humeur de Manann/dégâts/Moral accumulés). À poser
 *  sur un événement narratif qui touche PARTIELLEMENT le navire (ex. démasquage d'un saboteur qui
 *  remet `saboteurDR` à 0 sans réinitialiser le reste). Sans navire de campagne → no-op journalisé. */
export const adjustVesselSchema = nommerChamps(z.strictObject({
  type: z.literal('adjustVessel'),
  label: z.string().optional(),
  morale: z.number().optional(),
  hullCurrent: z.number().optional(),
  hullMax: z.number().optional(),
  saboteurDR: z.number().optional(),
  waterLitres: z.number().optional(),
  provisions: z.number().optional(),
  crew: z.array(crewHireSchema).optional(),
}), { type: { label: "type" }, label: { label: "libellé" }, morale: { label: "moral" }, hullCurrent: { label: "coque actuelle" }, hullMax: { label: "coque maximale" }, saboteurDR: { label: "DR de sabotage" }, waterLitres: { label: "eau en litres" }, provisions: { label: "provisions" }, crew: { label: "équipage" } });

export const endDialogueSchema = nommerChamps(z.strictObject({ type: z.literal('endDialogue') }), { type: { label: "type" } });

// ── Les deux variantes RÉCURSIVES (elles portent un `Flow<Effect>`) ──────────────────────────────

/** Effet PROGRAMMÉ (Lot 0, étendu #668) : `flow` est appliqué quand l'horloge atteint l'échéance,
 *  résolue par `scheduleAt` (`engine/clock`) selon la `ScheduleSpec` fournie — priorité `atDate`
 *  (date impériale absolue) > `afterDays` (« J+N », à `atHour:atMinute`, défaut minuit) >
 *  `afterMinutes` (compte à rebours relatif : mèche de bombe) > `atHour`/`atMinute` seuls (prochaine
 *  occurrence de cette heure du jour). Annulé si `cancelFlag` est posé avant l'échéance
 *  (désamorçage). Déclenché au FRANCHISSEMENT dans `advanceTime` (le temps avance par actions
 *  discrètes : un événement programmé entre deux pas se déclenche dès le pas qui le dépasse). */
export const delayedEffectSchema = z.strictObject({
  type: z.literal('delayedEffect'),
  get flow() {
    return sceneFlowSchema;
  },
  cancelFlag: z.string().optional(),
  ...scheduleShape,
});

/** LDB 25 l.22-24 */
export const petitePriereSchema = z.strictObject({
  type: z.literal('petitePriere'),
  heroId: z.string().optional(),
  get reward() {
    return sceneFlowSchema;
  },
});

// ── Les deux unions récursives ──────────────────────────────────────────────────────────────────

/** `Effect` (`state/scene.ts`) — l'union des 57 variantes. ANNOTÉE par le type manuscrit : la
 *  récursion mutuelle avec `sceneFlowSchema` n'est inférable ni dans un sens ni dans l'autre.
 *
 *  Ce schéma valide les DEUX racines authorées — `src/scenes` ET `src/data` (`effets.test.ts`) : il
 *  dit la FORME d'un Effet, pas le vocabulaire d'une scène. Ce qu'un Effet de SCÈNE peut viser se
 *  juge à la scène (`validateScene` → `EFFECT_HANDLERS.ops.refs`, `state/combatEffects.ts`). */
export const effectSchema: z.ZodType<Effect> = z.lazy(() =>
  z.discriminatedUnion('type', [
    setFlagSchema,
    setObjectiveSchema,
    clearObjectiveSchema,
    giveTrappingSchema,
    givePossessionSchema,
    giveMoneySchema,
    giveXpSchema,
    startCombatSchema,
    startMassBattleSchema,
    transitionSchema,
    transitionBackSchema,
    startDialogueSchema,
    journalSchema,
    documentSchema,
    revealClueSchema,
    discreditClueSchema,
    extendedTestSchema,
    forceDoorSchema,
    setTimeSchema,
    delayedEffectSchema,
    openMerchantSchema,
    openPortSchema,
    medicalAidSchema,
    restoreFortuneSchema,
    restSchema,
    mealPartySchema,
    inflictNightmaresSchema,
    ambitionLostSchema,
    inflictPsychologySchema,
    inflictDiseaseSchema,
    inflictHungerSchema,
    inflictThirstSchema,
    exposureNightSchema,
    inflictTraumaSchema,
    // La feuille `type:'ops'` (`EffectOp`, `engine/flowCore.ts`) est un membre de l'union `Effect` :
    // c'est le MÊME schéma que celui de la grammaire, jamais une seconde définition.
    effectOpSchema,
    zoneBlastSchema,
    fallSchema,
    setLightSchema,
    setDoorSchema,
    moveEntitySchema,
    playSfxSchema,
    giveSinSchema,
    corruptionExposureSchema,
    waterExposureSchema,
    learnSpellSchema,
    castSpellSchema,
    petitePriereSchema,
    sessionEndSchema,
    openCharacterCreatorSchema,
    interludeSchema,
    grantFavorSchema,
    startPursuitSchema,
    openTavernGamesSchema,
    openWorldMapSchema,
    setVesselSchema,
    adjustManannSchema,
    adjustVesselSchema,
    endDialogueSchema,
  ]),
);

/** `Flow<Effect>` (`engine/flowCore.ts`) — le MÊME arbre acyclique seq/do/if/test/choice que le
 *  `flowSchema` de la grammaire, mais dont la feuille `do` est l'union `Effect` de scène (et non le
 *  seul `EffectOp` mécanique). */
export const sceneFlowSchema: z.ZodType<Flow<Effect>> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    nommerChamps(z.strictObject({ kind: z.literal('seq'), steps: z.array(sceneFlowSchema) }), { kind: { label: "type" }, steps: { label: "étape" } }),
    nommerChamps(z.strictObject({ kind: z.literal('do'), effect: effectSchema }), { kind: { label: "type" }, effect: { label: "effet" } }),
    nommerChamps(z.strictObject({ kind: z.literal('if'), cond: conditionSchema, then: sceneFlowSchema, else: sceneFlowSchema.optional() }), { kind: { label: "type" }, cond: { label: "condition" }, then: { label: "alors" }, else: { label: "sinon" } }),
    noeudTest(sceneFlowSchema),
    nommerChamps(z.strictObject({
      kind: z.literal('choice'),
      prompt: z.string(),
      advantageCost: z.number().optional(),
      icon: z.string().optional(),
      yes: sceneFlowSchema,
      no: sceneFlowSchema.optional(),
    }), { kind: { label: "type" }, prompt: { label: "invite" }, advantageCost: { label: "coût en Avantage" }, icon: { label: "icône" }, yes: { label: "oui" }, no: { label: "non" } }),
  ]),
);

function nommerEffet<N extends z.ZodType>(noeud: N, label: string): N {
  return nommerNoeud(noeud, { label, nom: `effet ${label}` });
}

nommerEffet(journalSchema, "Journal");
nommerEffet(documentSchema, "Document");
nommerEffet(revealClueSchema, "Révéler un indice");
nommerEffet(discreditClueSchema, "Écarter un indice");
nommerEffet(startDialogueSchema, "Ouvrir un dialogue");
nommerEffet(endDialogueSchema, "Fermer le dialogue");
nommerEffet(setFlagSchema, "Définir un indicateur");
nommerEffet(setObjectiveSchema, "Objectif courant");
nommerEffet(clearObjectiveSchema, "Retirer un objectif");
nommerEffet(setLightSchema, "Lumière de scène");
nommerEffet(setDoorSchema, "Porte");
nommerEffet(moveEntitySchema, "Déplacer une entité");
nommerEffet(playSfxSchema, "Son ponctuel");
nommerEffet(giveTrappingSchema, "Donner un objet");
nommerEffet(givePossessionSchema, "Donner une possession");
nommerEffet(giveMoneySchema, "Donner ou retirer de l’argent");
nommerEffet(giveXpSchema, "Donner des PX");
nommerEffet(learnSpellSchema, "Apprendre un sort");
nommerEffet(petitePriereSchema, "Petites Prières");
nommerEffet(sessionEndSchema, "Fin de séance");
nommerEffet(openCharacterCreatorSchema, "Créer un personnage");
nommerEffet(restoreFortuneSchema, "Regagner la Chance");
nommerEffet(grantFavorSchema, "Accorder une Faveur");
nommerEffet(effectOpSchema, "Effets mécaniques");
nommerEffet(zoneBlastSchema, "Souffle de zone");
nommerEffet(fallSchema, "Chute");
nommerEffet(inflictDiseaseSchema, "Infliger une maladie");
nommerEffet(inflictHungerSchema, "Imposer la Faim");
nommerEffet(inflictThirstSchema, "Imposer la Soif");
nommerEffet(exposureNightSchema, "Exposition au froid ou à la chaleur");
nommerEffet(inflictTraumaSchema, "Infliger une Blessure Critique");
nommerEffet(inflictNightmaresSchema, "Infliger des cauchemars");
nommerEffet(ambitionLostSchema, "Ambition anéantie");
nommerEffet(inflictPsychologySchema, "Peur ou Terreur");
nommerEffet(corruptionExposureSchema, "Influence corruptrice");
nommerEffet(giveSinSchema, "Points de Péché");
nommerEffet(waterExposureSchema, "Exposition à l’eau souillée");
nommerEffet(restSchema, "Repos");
nommerEffet(mealPartySchema, "Repas");
nommerEffet(interludeSchema, "Entre deux aventures");
nommerEffet(setTimeSchema, "Régler l’heure");
nommerEffet(delayedEffectSchema, "Effet différé");
nommerEffet(transitionSchema, "Transition de scène");
nommerEffet(transitionBackSchema, "Retour à la scène précédente");
nommerEffet(openWorldMapSchema, "Ouvrir la carte du monde");
nommerEffet(setVesselSchema, "Doter le groupe d’un navire");
nommerEffet(adjustManannSchema, "Humeur de Manann");
nommerEffet(adjustVesselSchema, "Ajuster le navire");
nommerEffet(startCombatSchema, "Démarrer un combat");
nommerEffet(startPursuitSchema, "Poursuite terrestre");
nommerEffet(startMassBattleSchema, "Combat de masse");
nommerEffet(openMerchantSchema, "Ouvrir une boutique");
nommerEffet(openPortSchema, "Ouvrir un port");
nommerEffet(openTavernGamesSchema, "Jeux de taverne");
nommerEffet(medicalAidSchema, "Acte de soin payant");
nommerEffet(castSpellSchema, "Incanter un sort ou une prière");
nommerEffet(extendedTestSchema, "Test Étendu");
nommerEffet(forceDoorSchema, "Enfoncer une porte");
export function libelleEffet(type: Effect['type']): PlayerText {
  const noms = [...new Set(ouverts([effectSchema], { type }).map(nomDeNoeud).map(n => n?.label).filter((n): n is string => !!n))];
  if (noms.length !== 1) throw new Error('effet sans nom : ' + type);
  return dataLabel(noms[0]);
}

nommerChamps(delayedEffectSchema, { type: { label: "type" }, flow: { label: "enchaînement", transparent: true }, cancelFlag: { label: "drapeau d’annulation" }, ...scheduleMeta });
nommerChamps(petitePriereSchema, { type: { label: "type" }, heroId: { label: "héros" }, reward: { label: "récompense" } });
