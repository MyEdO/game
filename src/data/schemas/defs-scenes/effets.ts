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
import { proseDeScene } from '../grammaire/prose';
import { chaosAlignSchema, enumNomme, exposureLevelSchema, hitLocationSchema, moneyPartialSchema, refTestDeCorruption, surchargePaletteSchema } from '../grammaire/valeurs';
import { conditionSchema, effectOpSchema, extendedTestSchema, gameOpSchema, noeudTest } from '../grammaire/mecanique';
import { idDe, refOuSpec } from '../grammaire/ref';
import { customStatblockSchema, ptSchema, wallSideSchema } from './communs';
import { waterAppliesToSchema } from '../defs/water-exposure';
import type { Effect } from '../../../state/scene';
import type { Flow } from '../../../engine/flowCore';

// ── Vocabulaire des effets ──────────────────────────────────────────────────────────────────────

/** `DayPhaseId` (`engine/clock.ts`) — phases d'AFFICHAGE de la journée. */
export const dayPhaseIdSchema = z.enum(['aube', 'matin', 'midi', 'apresmidi', 'crepuscule', 'soir', 'nuit']);
/** Cible d'un effet de scène : tout le groupe, ou UN héros (`heroId`, défaut le premier). */
export const effectTargetSchema = z.enum(['party', 'hero']);
/** `LivingRef` (`engine/possession.ts`) — bestiaire (édition Codex vivante) OU statbloc custom
 *  d'éditeur (le snapshot EST son identité). */
const idDeCreature: z.ZodType<string, string> = idDe('creature');
export const livingRefSchema = z.union([
  z.strictObject({ creatureId: idDeCreature }),
  z.strictObject({ custom: customStatblockSchema }),
]);
/** `ChaosAlign` (`engine/corruption.ts`) — Puissance du Chaos d'une table de mutation alignée. MÊME
 *  vocabulaire que la charge de l'op `corruption` : la const NOMMÉE de la grammaire est partagée (#1694). */
export { chaosAlignSchema };
/** `WaterExposureMode` (`src/data/index.ts`) — `MSRC 16` : boire, ou être immergé. MÊME vocabulaire
 *  que `waterExposure.modifiers[].appliesTo` : la const NOMMÉE du def de règle est partagée (#1694). */
export const waterExposureModeSchema = waterAppliesToSchema;
/** `FavorLevel` (`engine/favor.ts`) — Niveau d'une Faveur due (`LDB 23 l.145-151`). */
export const favorLevelSchema = enumNomme({
  mineure: 'Faveur Mineure',
  majeure: 'Faveur Majeure',
  importante: 'Faveur Importante',
});
/** `CrewHire` (`engine/crewMorale.ts`) — un rôle d'équipage salarié et son effectif. */
export const crewHireSchema = z.strictObject({ roleId: z.string(), count: z.number() });
/** `PursuitFoeRef` (`state/pursuitFlow.ts`) — adversaire de poursuite : une RÉFÉRENCE de vivant
 *  (`livingRefSchema` — bestiaire ou statbloc d'éditeur), jamais des stats recopiées. Son Mouvement et
 *  sa valeur de Test de Mouvement se LISENT sur la fiche référencée, résolus au démarrage
 *  (`state/pursuitFlow`). `id` est posé à l'ouverture quand l'auteur n'en écrit pas — il sert aux
 *  décisions de camp (`LDB 15 l.94`, `PursuitPolicy.prioritaires`). */
export const pursuitFoeSchema = z.strictObject({
  id: z.string().optional(),
  ref: livingRefSchema,
});
/** `PursuitPolicy` (`engine/pursuit.ts`) — décisions de camp PNJ que le `RAW l.94` laisse aux camps. */
export const pursuitPolicySchema = z.strictObject({
  sacrifice: z.enum(['jamais', 'toujours', 'si-ecart']).optional(),
  /** Écart de Mouvement qui déclenche le sacrifice en mode `si-ecart`. */
  ecartM: z.number().optional(),
  arret: z.enum(['le-plus-lent', 'aucun']).optional(),
  /** Ids des CIBLES PRIORITAIRES (`LDB 15 l.94`) — absente/vide = personne n'est ignoré. */
  prioritaires: z.array(z.string()).optional(),
});
/** `MassBattleSpec` (`engine/massBattle.ts`) — spec d'amorçage d'une bataille (`ADE II 8`). */
export const massBattleSpecSchema = z.strictObject({
  allyName: z.string().optional(),
  enemyName: z.string().optional(),
  allyMight: z.number(),
  enemyMight: z.number(),
  /** Rounds prévus (défaut 1 = escarmouche). */
  plannedRounds: z.number().optional(),
  terrain: proseDeScene('massBattle.terrain').optional(),
  /** Catalogue de Scènes (défaut : tout le catalogue) — la pioche des situations. */
  scenes: z.array(z.string()).optional(),
  /** Situations authorées par Round (l.128) : chacune un ENSEMBLE de Scènes du moment. */
  situations: z.array(z.array(z.string())).optional(),
  /** Taille du tirage d'une situation par défaut (si non authorée). Défaut 3. */
  situationSize: z.number().optional(),
  /** Rencontres à démarrer pour les Scènes de COMBAT/MENACE (par id de Scène → id d'encounter). */
  sceneEncounters: z.record(z.string(), z.string()).optional(),
  /** Modificateur de Planification permanent (l.81). */
  allyMod: z.number().optional(),
});

/** `ScheduleSpec` (`engine/clock.ts`) — échéance d'horloge, résolue par `scheduleAt` (source unique
 *  de `delayedEffect` ET `setObjective`). Étalée en SHAPE : les deux variantes qui la portent sont
 *  des INTERSECTIONS `& ScheduleSpec` côté manuscrit. */
export const scheduleShape = {
  afterMinutes: z.number().optional(),
  /** Dans N jours (à partir d'AUJOURD'HUI), à l'heure `atHour:atMinute` (défaut minuit). */
  afterDays: z.number().optional(),
  /** Date impériale ABSOLUE (année défaut = année courante de la partie). */
  atDate: z
    .strictObject({
      year: z.number().optional(),
      month: z.number(),
      day: z.number(),
      hour: z.number().optional(),
      minute: z.number().optional(),
    })
    .optional(),
  atHour: z.number().optional(),
  atMinute: z.number().optional(),
} as const;

// ── Les variantes ───────────────────────────────────────────────────────────────────────────────

export const setFlagSchema = z.strictObject({ type: z.literal('setFlag'), flag: z.string(), value: z.boolean().optional() });

/** Pose/met à jour un OBJECTIF courant (surface « je fais quoi maintenant ? », #238) sur la pile
 *  `store.objectives`, keyé par `id` STABLE : re-poser le même `id` MET À JOUR sa prose (`desc`). Le HUD
 *  affiche le plus récent. Archivé aussi au journal. Échéance optionnelle (même `ScheduleSpec` que
 *  `delayedEffect`) → pose `Objective.deadline` (minute absolue) → compte à rebours dans le bandeau. */
export const setObjectiveSchema = z.strictObject({
  type: z.literal('setObjective'),
  id: z.string(),
  desc: z.string(),
  ...scheduleShape,
});

/** Retire un objectif de la pile : `id` précis, ou TOUS si absent (fin d'acte). */
export const clearObjectiveSchema = z.strictObject({ type: z.literal('clearObjective'), id: z.string().optional() });

/** Donne un objet à un héros (défaut : le premier). `trappingId` = objet de CATALOGUE à stats (réf
 *  `TrappingData.id`) ; `custom` = objet HORS-base (nom libre — trinket/quête/pièces de monstre) sans
 *  stats. L'objet arrive NON équipé. Champs MAGIQUES optionnels (butin/quête) : `qualities` AJOUTÉES
 *  (Atout/Défaut), `identified:false` = qualités masquées jusqu'à Évaluation (#2), `skin` = recoloration. */
export const giveTrappingSchema = z.strictObject({
  type: z.literal('giveTrapping'),
  trappingId: z.string().optional(),
  custom: z.string().optional(),
  heroId: z.string().optional(),
  qualities: z.array(z.string()).optional(),
  identified: z.boolean().optional(),
  skin: surchargePaletteSchema.optional(),
  /** Aura détectée / Détection déjà tentée (Talent Détection d'artefact, `LDB 10`) / jour de la
   *  dernière Évaluation ratée — posés par la fenêtre de loot AVANT attribution, propagés sur
   *  l'ItemInstance à la remise. */
  magicKnown: z.boolean().optional(),
  detectTried: z.boolean().optional(),
  appraiseTriedDay: z.number().optional(),
  /** Valeur de marché propre posée sur l'instance (ex. pièces de monstre récoltées, `ZI`). */
  price: moneyPartialSchema.optional(),
});

/** Donne une POSSESSION (bête/serviteur/véhicule — le SOCLE POSSESSIONS #615, registre
 *  `GameState.possessions`) à un héros propriétaire (défaut : le premier — même patron que
 *  `giveTrapping.heroId`, §4.3). `ref` réutilise `LivingRef` (bête/serviteur, bestiaire OU statbloc
 *  custom) ou `{vehicleId}` (véhicule, catalogue `vehicles.json`). */
const idDeVehicule: z.ZodType<string, string> = idDe('vehicle');
export const givePossessionSchema = z.strictObject({
  type: z.literal('givePossession'),
  nature: z.enum(['bete', 'serviteur', 'vehicule']),
  ref: z.union([livingRefSchema, z.strictObject({ vehicleId: idDeVehicule })]),
  heroId: z.string().optional(),
});

/** Donne (ou RETIRE, montant négatif) de l'argent au groupe. La charge porte son NOM comme toute
 *  autre action du vocabulaire (`giveXp.amount`, `givePossession.ref`) : `montant` est une somme
 *  `Money` PARTIELLE — un coût authoré n'écrit que les dénominations qu'il chiffre. */
export const giveMoneySchema = z.strictObject({
  type: z.literal('giveMoney'),
  montant: moneyPartialSchema,
});

/** Octroie des Points d'Expérience à TOUT le groupe (XP de session, identique pour tous). Support
 *  générique de l'attribution événementielle par scénario (`PDT 13 l.5`) : chaque scénario/campagne
 *  authore ses propres octrois via cette action, à tout point narratif (victoire, objectif, dialogue…). */
export const giveXpSchema = z.strictObject({ type: z.literal('giveXp'), amount: z.number() });

export const startCombatSchema = z.strictObject({ type: z.literal('startCombat'), encounter: z.string() });

/** Combat de masse / Puissance de Bataille (`ADE II 8`) : ouvre l'écran de bataille sur le
 *  `MassBattleSpec` AUTHORÉ (armées, Rounds prévus, situations de Scènes par Round, rencontres des
 *  Scènes de combat, modificateur permanent). Appliqué par le store `startMassBattle` (state/massBattleFlow). */
export const startMassBattleSchema = z.strictObject({ type: z.literal('startMassBattle'), battle: massBattleSpecSchema });

export const transitionSchema = z.strictObject({ type: z.literal('transition'), scene: z.string(), entry: z.string().optional() });

/** Retour à la scène précédente (sortie d'intérieur), à la case d'entrée. */
export const transitionBackSchema = z.strictObject({ type: z.literal('transitionBack') });

/** Ouvre le dialogue scripté `dialogue`. `speakerId` (optionnel) = id d'une `SceneEntity` de la
 *  scène courante → son PORTRAIT et son NOM (label) pour toute la session de dialogue, tant qu'un
 *  nœud ne porte pas son propre `speakerId` (cf. `DialogueNode.speakerId`). */
export const startDialogueSchema = z.strictObject({
  type: z.literal('startDialogue'),
  dialogue: z.string(),
  speakerId: z.string().optional(),
});

export const journalSchema = z.strictObject({ type: z.literal('journal'), desc: z.string() });

export const documentSchema = z.strictObject({ type: z.literal('document'), title: z.string(), desc: z.string() });

/** Mécanique MAISON du carnet d'enquête (#670, aucune règle RAW) : révèle/avance un `Indice` de
 *  `campaignNarratif`. `stade` omis → premier stade si l'indice est encore caché, sinon no-op. */
export const revealClueSchema = z.strictObject({
  type: z.literal('revealClue'),
  indiceId: z.string(),
  stade: z.string().optional(),
});

/** Écarte un indice comme fausse piste (barré, relisible au carnet) — mécanique MAISON (#670). */
export const discreditClueSchema = z.strictObject({ type: z.literal('discreditClue'), indiceId: z.string() });

/** Enfoncer une PORTE/objet à PLUSIEURS (`EDO Appendice 2`) : objet (BE = Bonus d'Endurance, B =
 *  Blessures) ; chaque héros frappe (Bagarre, dégâts = DR + BF − BE). `flag` posé quand l'objet cède. */
export const forceDoorSchema = z.strictObject({
  type: z.literal('forceDoor'),
  label: z.string(),
  doorBE: z.number(),
  doorB: z.number(),
  flag: z.string().optional(),
});

/** Règle l'horloge par SAUT EN AVANT (le temps ne recule jamais) : soit sur une `phase` de la
 *  journée (« passe à l'aube/…/nuit »), soit sur une heure précise (`hour`[`:minute`]) — jamais les
 *  deux, jamais aucune des deux. Le XOR est porté ici : `minute` n'a de sens qu'avec `hour`. */
export const setTimeSchema = z
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
  });

/** Ouvre la boutique d'une entité marchande (par son id) — permet d'inclure le Marchand dans un
 *  dialogue (ex. choix « Montrez-moi vos marchandises »). L'entité doit porter `merchant` (#2). */
export const openMerchantSchema = z.strictObject({ type: z.literal('openMerchant'), entityId: z.string() });

/** Ouvre le PORT d'un lieu de la carte du monde (`MDG 15`) — SCRIPTÉ (arrivée mise en scène, cinématique
 *  de quête) sur le MÊME chemin que l'accostage en mer (`openPortAt`, state/seaVoyageFlow) : avec profil
 *  de port → relâche à terre en attente de décision (`pendingShoreLeave`) ; sans profil → transition
 *  directe. `placeId` = id d'un `MapPlace` de `state.worldMap`. */
export const openPortSchema = z.strictObject({ type: z.literal('openPort'), placeId: z.string() });

/** Soins PAYANTS d'un PNJ (médecin/guérisseur/temple — `LDB 75` « Docteur en médecine », l'aide
 *  médicale se paie À L'ACTE, 4-6 pistoles) : ouvre l'INFIRMERIE du PNJ (modale persistante,
 *  state/medicFlow) avec ses actes et leurs tarifs — `acts` liste {act, cost?} ; le débit a lieu
 *  au lancement de chaque acte (remboursé si annulé avant le jet). `entityId` = LE soigneur : une
 *  entité `personnage` de la scène, PORTEUSE UNIQUE de son nom ET de ses stats (sa réf de bestiaire ou
 *  son statbloc) — sa Guérison et son Bonus d'Intelligence se LISENT sur cette fiche (`state/medicFlow`
 *  applique le RAW Guérison/Chirurgie existant). Le joueur choisit les patients dans la modale. */
export const medicalAidSchema = z.strictObject({
  type: z.literal('medicalAid'),
  acts: z
    .array(z.strictObject({ act: z.enum(['wounds', 'bleed', 'trauma', 'surgery']), cost: moneyPartialSchema.optional() }))
    .optional(),
  entityId: z.string(),
});

/** Début de session (`LDB 17 l.41`) : chaque héros regagne tous ses Points de Chance,
 *  jusqu'à un maximum égal à son Destin actuel. Exposé dans l'éditeur (pas de hook caché). */
export const restoreFortuneSchema = z.strictObject({ type: z.literal('restoreFortune') });

/** Repos (`LDB 16/18/21`) : ouvre la MODALE DE NUIT (state/restFlow) — par héros : couchage +
 *  pitance, prix RAW calculés (`LDB 66` : commune 10 sc, privée 10 pa pour 2, repas 1 pa —
 *  débit dans la modale), puis bilan globalisé (Exposition dehors, récupération, cauchemars,
 *  contagion). `lodging` : contexte du lieu (auberge/chez soi/campement) ; `quality: 'pietre'`
 *  = ½ prix mais nourriture à risque (Courante galopante 10 %, ch.66 l.51). LEGACY : sans
 *  `lodging`, contexte « maison » (gratuit — prix porté par le choix de dialogue). */
export const restSchema = z.strictObject({
  type: z.literal('rest'),
  days: z.number().optional(),
  lodging: z.enum(['auberge', 'maison', 'camp']).optional(),
  quality: z.enum(['normale', 'pietre']).optional(),
});

/** Repas (#T2 — auberge, hôte généreux…) : nourrit TOUT le groupe pour la journée SANS consommer de
 *  ration — remet les compteurs/malus de Faim à zéro (`LDB 18 l.337-343`). Le prix éventuel (« Repas,
 *  auberge », `LDB 66` p.302) est porté par le CHOIX de dialogue (`DialogueChoice.cost`), pas par l'effet. */
export const mealPartySchema = z.strictObject({ type: z.literal('mealParty') });

/** Inflige le trauma « Cauchemars » (`LDB 21 l.95`) à un héros (défaut : le premier) après une scène
 *  marquante : chaque nuit, Test de Calme Facile (+40) ou Exténué. L'auteur l'assigne (pas inventé). */
export const inflictNightmaresSchema = z.strictObject({ type: z.literal('inflictNightmares'), heroId: z.string().optional() });

/** Trauma (`ADE II Annexe I` « Troubles psychologiques », règle facultative `psych-acquisition-optional`) :
 *  un héros TÉMOIN d'un événement rendant une de ses Ambitions complètement irréalisable → Test de Calme
 *  Accessible (+20) ; échec → Trait psychologique *Trauma*. Déclencheur NARRATIF (aucun hook mécanique),
 *  donc posé par l'auteur (défaut : le premier héros). Inerte si la règle facultative est éteinte. */
export const ambitionLostSchema = z.strictObject({ type: z.literal('ambitionLost'), heroId: z.string().optional() });

/** Source de PEUR/TERREUR scénique (`LDB 21`) — une apparition, un présage, une vision d'horreur mise en
 *  scène par l'auteur (PAS un PNJ de la scène : hors combat, la Peur/Terreur de créature ne se teste QUE
 *  scriptée, cf. `engine/encounterPsych`). Ouvre la MÊME cascade de Tests de Calme que la Psychologie de
 *  rencontre (`openScriptedPsych`, applier `'encounterPsych'` partagé) — jamais un jet silencieux. Cible :
 *  `party` ou `hero` (+`heroId`, défaut le premier). */
export const inflictPsychologySchema = z.strictObject({
  type: z.literal('inflictPsychology'),
  kind: z.enum(['peur', 'terreur']),
  indice: z.number(),
  label: z.string(),
  target: effectTargetSchema.optional(),
  heroId: z.string().optional(),
});

/** Inflige une Maladie (`LDB 20`) à un héros (défaut : le premier) — nourriture avariée, contact infecté,
 *  morsure… L'auteur choisit la maladie (diseaseDefs()) ; incubation/durée sont tirées à la contraction. */
export const inflictDiseaseSchema = z.strictObject({
  type: z.literal('inflictDisease'),
  disease: z.string(),
  heroId: z.string().optional(),
});

/** Impose la Faim (`LDB 18 l.337-343`) : `days` échecs de Test de Faim déjà encaissés — 1ᵉʳ → −10 F/E ;
 *  2ᵉ+ → −10 aux autres Caractéristiques + 1d10 Dégâts (ignore les PA, min 1). Pour scénariser un groupe
 *  affamé (siège, cachot, traversée sans vivres). Cible : `party` ou `hero` (+`heroId`, défaut le premier). */
export const inflictHungerSchema = z.strictObject({
  type: z.literal('inflictHunger'),
  days: z.number().optional(),
  target: effectTargetSchema.optional(),
  heroId: z.string().optional(),
});

/** Impose la Soif (`LDB 18 l.340`, miroir de la Faim) : `days` échecs de Test de Soif déjà encaissés —
 *  1ᵉʳ → −10 Int/FM/Soc ; 2ᵉ+ → −10 aux autres Caractéristiques + 1d10 Dégâts (ignore les PA, min 1).
 *  Moteur partagé `applySoifTest` (engine/provisions), zéro logique nouvelle. Cible : `party` ou `hero`
 *  (+`heroId`, défaut le premier). */
export const inflictThirstSchema = z.strictObject({
  type: z.literal('inflictThirst'),
  days: z.number().optional(),
  target: effectTargetSchema.optional(),
  heroId: z.string().optional(),
});

/** Exposition au froid ou à la chaleur (`LDB 18 l.326-334`) : `count` Tests de Résistance (Intermédiaire),
 *  échecs en cascade (froid : −10 CT/Ag/Dex, puis −10 le reste, puis 1d10 Dégâts ignorant les PA, Inconscient
 *  à 0 PB ; chaleur : −10 Int/FM + Exténué, puis −10 le reste + Exténué, puis 1d10). Pour une nuit glaciale,
 *  un désert, une tempête. Cible : `party` ou `hero` (+`heroId`, défaut le premier). */
export const exposureNightSchema = z.strictObject({
  type: z.literal('exposureNight'),
  kind: z.enum(['froid', 'chaleur']),
  count: z.number().optional(),
  target: effectTargetSchema.optional(),
  heroId: z.string().optional(),
});

export const inflictTraumaSchema = z.strictObject({
  type: z.literal('inflictTrauma'),
  kind: z.enum(['dechirure', 'fracture', 'amputation']),
  severity: z.enum(['mineur', 'majeur']).optional(),
  location: hitLocationSchema,
  heroId: z.string().optional(),
});

/** Souffle de ZONE (Lot 3) centré sur une case : tous les combattants à `radius` cases (Chebyshev)
 *  — en combat par position, hors combat le groupe (à partyPos) — subissent les `ops` (vocabulaire
 *  unique `GameOp`, appliquées par `applyOps` cible par cible). Bombe, grenade, piège de zone…
 *  Dégâts BRUTS par défaut (`op:'wounds'` ignore BE+PA) ; mitiger = `{ignoreTB:false, ignoreAP:false}`. */
export const zoneBlastSchema = z.strictObject({
  type: z.literal('zoneBlast'),
  center: z.strictObject({ x: z.number(), y: z.number() }),
  radius: z.number(),
  ops: z.array(gameOpSchema),
});

/** Chute (`LDB 15 l.80-84`) : la cible tombe de `metres` mètres → 3 Dégâts/mètre + 1d10, réduits par
 *  le Bonus d'Endurance mais PAS par les PA ; si les Blessures subies dépassent le BE → État À Terre.
 *  `to` (optionnel) repositionne le GROUPE à l'arrivée (balcon→parterre, plancher de loge effondré). */
export const fallSchema = z.strictObject({
  type: z.literal('fall'),
  target: effectTargetSchema,
  heroId: z.string().optional(),
  metres: z.number(),
  to: ptSchema.optional(),
});

/** Mise en scène (Lot L) : règle le niveau de LUMIÈRE de la scène (0 = noir, 1 = plein jour) — « les
 *  lumières baissent, le rideau se lève ». Lu par le rendu (overlay d'assombrissement). Générique :
 *  tout intérieur (donjon, salle, théâtre). null implicite = auto (horloge/ambiance) tant qu'aucun setLight. */
export const setLightSchema = z.strictObject({ type: z.literal('setLight'), level: z.number() });

/** Porte dynamique (brouillard de guerre) : ouvre/ferme la porte de l'arête (x,y,side) — une porte
 *  fermée bloque vue ET passage. Pour un levier/piège/scripted authored. */
export const setDoorSchema = z.strictObject({
  type: z.literal('setDoor'),
  x: z.number(),
  y: z.number(),
  side: wallSideSchema,
  z: z.number().optional(),
  open: z.boolean(),
});

/** Repositionne (ANIMÉ) ou RETIRE une entité de scène posée — mise en scène scriptée (#701 : fuite,
 *  entrée, disparition d'un figurant). `to` = case cible (repositionnement) ; `remove` = l'entité
 *  quitte la scène (après `to` si fourni = fuite-puis-disparition). Entité introuvable = no-op. */
export const moveEntitySchema = z.strictObject({
  type: z.literal('moveEntity'),
  id: z.string(),
  to: ptSchema.optional(),
  remove: z.boolean().optional(),
});

/** Son PONCTUEL (cloche de minuit, cri hors-champ…) — id du registre audio (#701). */
export const playSfxSchema = z.strictObject({ type: z.literal('playSfx'), id: z.string() });

/** Points de Péché (`LDB 40 l.30-36`) : l'auteur/MJ sanctionne une infraction aux commandements du dieu
 *  d'un Bienheureux — 1 à 3 selon la gravité (l.36). Défaut : le premier héros sachant Prier. Le dé des
 *  unités d'un Test de Prière ≤ Péchés déclenche la Colère des dieux même sur Test réussi (l.45) ;
 *  chaque jet de Colère en expie 1 (l.53). */
export const giveSinSchema = z.strictObject({
  type: z.literal('giveSin'),
  amount: z.number().optional(),
  heroId: z.string().optional(),
});

/** Exposition à une Influence corruptrice (`LDB 19 l.23-75`) : Test de Résistance (Influence physique)
 *  ou de Calme (spirituelle) par MODALE ; Points de Corruption selon le niveau et le DR. Cible : héros
 *  désigné, sinon le premier vivant. Au-delà de BFM+BE : Test de Résistance ou MUTATION.
 *
 *  `skill` ABSENT = le RAW laisse le choix ouvert — « comme déterminé par le MJ » (`LDB 19 l.29`) — et
 *  ici c'est le joueur qui tranche Résistance/Calme dans la modale ; PRÉSENT = déterminé en amont →
 *  verrouillé (pas de choix). `align` (Puissance du Chaos)
 *  facultatif : si la mutation survient, force la table `EDOC` alignée (sinon la règle globale décide).
 *  C'est à l'éditeur de niveau de le poser quand la source est dédiée. */
export const corruptionExposureSchema = z.strictObject({
  type: z.literal('corruptionExposure'),
  level: exposureLevelSchema,
  skill: refTestDeCorruption.optional(),
  align: chaosAlignSchema.optional(),
  heroId: z.string().optional(),
});

/** Exposition HYDRIQUE (`MSRC 16` p.91 — « Maladies transmises par l'eau ») : Test de **Résistance
 *  Intermédiaire (+0)** modifié (tableau 1 « Source d'eau » = `source`, choix d'auteur de la zone
 *  d'eau ; tableau 2 « Blessures et États » DÉRIVÉ du héros, immersion seule) ; raté → d100 « +10
 *  pour chaque DR négatif » → maladie CONTRACTÉE directement (le Test d'exposition EST le test —
 *  jamais un second Test de Contraction). `mode` : `ingestion` (boire de l'eau non bouillie, l.5) /
 *  `immersion` (chute/nage, blessures ouvertes, l.7-9). Cible : `party` ou `hero` (+`heroId`). */
export const waterExposureSchema = z.strictObject({
  type: z.literal('waterExposure'),
  mode: waterExposureModeSchema,
  source: z.string().optional(),
  target: effectTargetSchema.optional(),
  heroId: z.string().optional(),
});

/** Enseigne un sort SANS coût en PX (trouvaille de campagne : grimoire d'un maître, parchemin…) au
 *  héros que son Talent de lanceur rend éligible, désigné ou non — sinon refus NOMMÉ au journal
 *  (`LDB 46 l.14`). Cible : héros désigné, sinon le premier dont un Talent rend le sort apprenable ;
 *  la garde est celle de l'achat (`spellCost`). L'apprentissage PAYANT passe par l'onglet Avancement
 *  (buySpell, `LDB 46 l.44-47`). */
export const learnSpellSchema = z.strictObject({
  type: z.literal('learnSpell'),
  spell: z.string(),
  heroId: z.string().optional(),
});

/** Incantation SCRIPTÉE (#98) : rituel scénique, piège magique, PNJ qui lance à un beat précis (dialogue,
 *  trigger, effet différé). `casterId`/`targetId` = id STABLE d'un combattant — un combattant EN COMBAT
 *  (`Combatant.id === SceneEntity.id`) ou un héros du GROUPE hors combat (`actorIn`, state/combatOrParty) ;
 *  un PNJ hors combat n'a pas de Combatant à faire incanter — pas de pseudo-combat inventé pour ce cas
 *  (le lanceur doit alors être en combat). `targetId` absent = le lanceur (soi/zone). `mode:'jet'`
 *  (défaut) route par le flux d'incantation STANDARD (`castSpell`, cadence-aware ; modale influençable
 *  si le lanceur est piloté par un humain — jamais un jet silencieux). `mode:'forceSuccess'` = arbitrage
 *  D'AUTEUR explicite (rituel garanti, sans jet) : applique directement les effets du sort (`GameOp`,
 *  `ctx.caster` = le lanceur) — dérogation VOULUE, jamais un défaut. */
export const castSpellSchema = z.strictObject({
  type: z.literal('castSpell'),
  casterId: z.string(),
  spellId: z.string(),
  targetId: z.string().optional(),
  mode: z.enum(['jet', 'forceSuccess']).optional(),
});

/** FIN DE SÉANCE (`LDB 05` Ambitions l.793-841 + Détermination `LDB 17 l.81`) : ouvre l'écran de fin de
 *  séance EXISTANT (`SessionEndModal`) où le MJ/les joueurs cochent les Ambitions accomplies et les
 *  Motivations suivies — l'octroi (PX +50/+500, Détermination, Chance restaurée) passe par `endSession`
 *  (state/partyFlow), déjà câblé derrière cette modale. À poser en fin de chapitre par l'auteur (#83). */
export const sessionEndSchema = z.strictObject({ type: z.literal('sessionEnd') });

/** CRÉATION DE PERSONNAGE (#83) : ouvre l'assistant EXISTANT (`src/ui/creator/`) pour un NOUVEAU héros
 *  (comme le bouton « + » de l'écran Groupe) — un remplaçant scénarisé, un compagnon rejoignant le groupe.
 *  Navigue vers l'écran `creator` (`setEditingHero(null)` + `setScreen('creator')`). */
export const openCharacterCreatorSchema = z.strictObject({ type: z.literal('openCharacterCreator') });

/** « Entre deux aventures » (`LDB 22-23`, Jalon 5) : ouvre l'interlude — Événement d100 par héros,
 *  min(3, semaines) Activités chacun, puis Argent à gaspiller et le temps passe. À poser en fin
 *  de chapitre par l'auteur de campagne. */
export const interludeSchema = z.strictObject({ type: z.literal('interlude'), weeks: z.number().optional() });

/** Faveur (`LDB 23 l.139-153`, #509) : contrepartie future acceptée en échange d'une aide
 *  immédiate — Faveur de départ de campagne, ou octroi narratif hors flux d'Activité. Cible :
 *  héros désigné, sinon le premier héros vivant du groupe (la source parle au singulier « vous »,
 *  l.141 « votre Niveau » : la Faveur est due par UN héros, pas le groupe). */
export const grantFavorSchema = z.strictObject({
  type: z.literal('grantFavor'),
  heroId: z.string().optional(),
  level: favorLevelSchema,
  owedTo: z.string(),
  desc: z.string(),
});

/** Poursuite TERRESTRE jouable (`LDB 15 l.88-108`) — à poser sur un trigger/dialogue (« ils prennent la
 *  fuite », « rattrapez-les ! »). `partyRole` : le groupe FUIT (défaut) ou POURSUIT ; l'autre camp est
 *  décrit par `foes` (Mouvement + valeur de Test de Mouvement de chaque adversaire). `distance` de départ
 *  (1-8, l.500-504), `escapeAt` = seuil d'évasion (défaut 10, l.520). `skill` = Compétence de Mouvement
 *  testée (id : Athlétisme à pied / Chevaucher / Conduite d'attelages). `encounter` = rencontre ouverte au
 *  RATTRAPAGE (Distance ≤ 0 → combat). Jouée manche par manche par la cascade influençable (state/pursuitFlow),
 *  MÊME dramaturgie que la poursuite navale (`MDG 13`). */
export const startPursuitSchema = z.strictObject({
  type: z.literal('startPursuit'),
  partyRole: z.enum(['fleeing', 'pursuing']).optional(),
  distance: z.number(),
  escapeAt: z.number().optional(),
  skill: refOuSpec('skill'),
  foes: z.array(pursuitFoeSchema),
  encounter: z.string().optional(),
  policy: pursuitPolicySchema.optional(),
});

/** Ouvre les JEUX DE TAVERNE (`NADJ 16`, option `tavern-games`) — à poser sur un choix de dialogue
 *  d'aubergiste (« Une partie ? ») ou une entité de taverne. Sans effet si l'option est éteinte. */
export const openTavernGamesSchema = z.strictObject({ type: z.literal('openTavernGames') });

/** Ouvre la CARTE DU MONDE (#T2) — à poser sur la porte/route d'un lieu (« partir en voyage »).
 *  Sans effet si le projet n'a pas de carte ou en combat. */
export const openWorldMapSchema = z.strictObject({ type: z.literal('openWorldMap') });

/** Dote le groupe d'un NAVIRE DE CAMPAGNE (`state.vessel`, `MDG 13-15`) — à poser quand le groupe
 *  reçoit/achète un bateau (don d'un patron, chantier). `vehicleId` = un navire de `vehicles.json`
 *  (facette `ship`) ; Moral et Blessures de coque INITIAUX authorés (coque neuve = pas de `wounds`).
 *  Le navire survit aux jours et aux combats (le voyage maritime et le Port en repartent). */
export const setVesselSchema = z.strictObject({
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
});

/** Fait varier l'HUMEUR DE MANANN du navire de campagne (`MDG 15 l.83-125`) — à poser sur une
 *  bénédiction de prêtre, un sacrifice ou tout événement narratif d'auteur. `factorId` = un facteur
 *  du tableau « EFFET SUR L'HUMEUR DE MANANN » (`sea-events.json`, appliqué UNE SEULE FOIS par
 *  navire — `applyManannFactor`, l.85) ; `delta` = un ajustement chiffré libre hors-tableau (ex.
 *  « Fête de Manann » 2d10) — mutuellement exclusifs, `factorId` prioritaire si les deux sont posés.
 *  Sans navire de campagne → no-op journalisé. */
export const adjustManannSchema = z.strictObject({
  type: z.literal('adjustManann'),
  factorId: z.string().optional(),
  delta: z.strictObject({ flat: z.number(), d10: z.number(), sign: z.union([z.literal(1), z.literal(-1)]) }).optional(),
});

/** AJUSTE le navire de campagne EXISTANT (#233) — patch des SEULS champs fournis, contrairement à
 *  `setVessel` (remplacement total : effacerait Humeur de Manann/dégâts/Moral accumulés). À poser
 *  sur un événement narratif qui touche PARTIELLEMENT le navire (ex. démasquage d'un saboteur qui
 *  remet `saboteurDR` à 0 sans réinitialiser le reste). Sans navire de campagne → no-op journalisé. */
export const adjustVesselSchema = z.strictObject({
  type: z.literal('adjustVessel'),
  label: z.string().optional(),
  morale: z.number().optional(),
  hullCurrent: z.number().optional(),
  hullMax: z.number().optional(),
  saboteurDR: z.number().optional(),
  waterLitres: z.number().optional(),
  provisions: z.number().optional(),
  crew: z.array(crewHireSchema).optional(),
});

export const endDialogueSchema = z.strictObject({ type: z.literal('endDialogue') });

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

/** « Petites Prières » (`LDB 25 l.22-24`, option `prayer-petites`) : posé sur un SITE SACRÉ (autel,
 *  sanctuaire). Un personnage NON Béni y prie : 1d100 secret, exaucé sur 01 (pourcentage relevé s'il
 *  possède la Compétence Prière). Exaucée → le `reward` (Flow authoré : bonus, don, flag…) s'applique ;
 *  sinon rien. Cible : `heroId`, sinon le premier héros vivant non Béni. Sans effet hors du toggle. */
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
    z.strictObject({ kind: z.literal('seq'), steps: z.array(sceneFlowSchema) }),
    z.strictObject({ kind: z.literal('do'), effect: effectSchema }),
    z.strictObject({ kind: z.literal('if'), cond: conditionSchema, then: sceneFlowSchema, else: sceneFlowSchema.optional() }),
    noeudTest(sceneFlowSchema),
    z.strictObject({
      kind: z.literal('choice'),
      prompt: z.string(),
      advantageCost: z.number().optional(),
      icon: z.string().optional(),
      yes: sceneFlowSchema,
      no: sceneFlowSchema.optional(),
    }),
  ]),
);
