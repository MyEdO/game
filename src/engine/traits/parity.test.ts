import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TRAITS } from './registry';
import { parseTrait, formatTrait } from './dispatch';
import type { TraitInstance } from '../statEntry';
import { slugId } from '../../data/slug';

/**
 * Parité des Traits de créature (LDB 85). Le registre `TRAITS` est désormais DÉRIVÉ 1:1 de la donnée
 * (`traits.json`) — il n'y a plus de `defs/` mécaniques. Ce garde-fou vérifie donc :
 *  1. la DÉRIVATION est totale : chaque trait de `traits.json` est présent dans `TRAITS` (par id) ;
 *  2. la mécanique de CHAQUE trait est portée par un sous-système identifié — soit `dispatch`
 *     (capabilities/passive lus par les helpers), soit un AUTRE sous-système (creatureAttacks /
 *     psychology / disease / corruption), soit journal/MJ en conscience. Les maps ci-dessous
 *     DOCUMENTENT cette propriété (qui porte quoi) ; une nouvelle donnée non listée fait échouer (2).
 */

// Traits dont la mécanique vit AILLEURS que dans les helpers de `dispatch` (la raison est documentée).
const COUVERT_AILLEURS = new Map<string, string>([
  // Environnement aquatique (MSRC 15 l.137-139 / MDG 16 l.14-19 / LDB 85 l.19-21) — op passive `offTerrainMod` (terrain d’election `eau`) :
  // (1) le drapeau positionnel `Combatant.offTerrain`, re-derive par `placeCombatant` selon la tuile, module le M
  // (encumbrance) et le DR de TOUS les Tests (combat/magic/rollFlows) hors de l’eau ; (2) `eau` est TRAVERSABLE en
  // pathing (`MoveEnv.swim` <- `requiredTerrains`, path.ts). Mecanise + teste (off-terrain.test.ts / path-swim.test.ts).
  ['Aquatique', 'ne peut aller a terre (M->0, offTerrainMod mSet:0) + traverse l’eau a pleine vitesse (MoveEnv.swim)'],
  ['Amphibie', 'full M en eau + eau traversable (offTerrainMod{eau} sans malus + MoveEnv.swim) ; +BAg au DR des Tests de Natation = residuel (pas de Test de Natation authore)'],
  ['Créature marine', 'hors de l’eau M->1 + -2 DR a tous les Tests (offTerrainMod, positionnel via placeCombatant) + eau traversable (MoveEnv.swim) ; aspersion/suffocation narrees'],
  // Attaques naturelles et armement — engine/creatureAttacks.ts + spawn.weaponsFromTraits (grantsManeuvers)
  ['À distance', 'arme dérivée au spawn (weaponsFromTraits)'],
  ['Arme', 'arme dérivée au spawn (weaponsFromTraits)'],
  ['Attaque caudale', 'attaque gratuite (creatureAttacks.ts)'],
  ['Cornes', 'attaque gratuite à la Charge (creatureAttacks.ts)'],
  ['Morsure', 'attaque gratuite (creatureAttacks.ts)'],
  ['Souffle', 'attaque de zone (creatureAttacks.ts + combatFlow)'],
  ['Tentacules', 'attaques gratuites par tentacule, count× à coût 0 (creatureAttacks.ts + aiCreatureFreeAttacks)'],
  ['Étreinte glaciale', 'attaque-Action magique (creatureAttacks.ts + combatFlow)'],
  ['Langue préhensile', 'attaque gratuite à distance (creatureAttacks.ts)'],
  ['Hurlement fantomatique', 'cri de zone (creatureAttacks.ts + combatFlow)'],
  ['Regard pétrifiant', 'attaque-Action (creatureAttacks.ts + combatFlow)'],
  ['Vomissement', 'attaque de zone (creatureAttacks.ts + combatFlow)'],
  ['Hurlement de la Bête indomptable', 'cri de zone — manœuvre gratuite 1 Avantage, 3 Assourdi + Calme→3 Brisé (creatureAttacks.ts + combatFlow)'],
  ['Frisson paralysant', 'attaque-Action de mêlée magique, 1 Sonné/DR sans dégât (creatureAttacks.ts + combatFlow)'],
  ['Venin', 'Empoisonné sur PB infligés — `effects` AUTHORÉ du trait (Test de Résistance paramétré par l’arg, fireTriggers onHit)'],
  ['Constricteur', 'Empêtré sur touche — `effects` AUTHORÉ du trait (condition empetre, escapeStrength=Force, fireTriggers onHit)'],
  ['Contagieux', 'transmet au TOUCHER la maladie hébergée (`$arg`) — `effects` AUTHORÉ onHit on:victim → op `exposeDisease{difficultyShift:-2, incubation:\'instant\'}` (ops.ts:1576), moissonnée par `applyAttackResult` (combatFlow.ts:2127) et résolue au bilan de fin de combat (`decideCombatEndHeroTests`, combatFlow.ts:5032) ; cf. `state/contagieux.test.ts`'],
  ['Absorption', 'engloutissement de fin de Round MÉCANISÉ 100% data-driven (`absorption.effects` : onRoundEnd Empêtré×BF + Empoigné + Digéré ; digestion drain BF ignore PA/BE + créature guérit ; redirection onWoundLoss ; un/Round ; purge à la mort) — dispatché par `fireTriggers`, cf. `absorption.test.ts` (EDO 11 l.222)'],
  ['Vampirique', 'drain de PB sur Morsure (combatFlow.applyFreeAttackEffects — gating « kind=morsure » sans Condition Flow)'],
  ['Se cabrer', 'couvert par le Piétinement existant (LDB 85 — trampleTarget)'],
  // Bestiaire fluvial (MSRC 15) — mécanique AUTHORÉE en `effects` (fireTriggers), comme Constricteur/Venin.
  ['S\'accrocher pour se nourrir', 'attache post-Morsure + drain 1 PB/Round — `effects` AUTHORÉ (condition empetre grapple onHit + wounds onRoundStart on grappled, fireTriggers)'],
  ['Engloutir', 'engloutit à la touche : Empêtré Force=créature + drain 1 PB/Round — `effects` AUTHORÉ (fireTriggers onHit + onRoundStart)'],
  ['Salive anticoagulante', 'Hémorragique sur Morsure — `effects` AUTHORÉ (condition hemorragique, fireTriggers onHit)'],
  ['Hallucinogène', 'aura 2 m au début du Round → Test de FM → Sonné — `effects` AUTHORÉ (déclencheur onRoundStart near, fireTriggers)'],
  ['Forme de guerrière naïade', 'socle Peur 2 + Armure 2 à onCombatStart (grantTrait, `effects`) ; les 4 aspects tournants restent en desc (choix par Round = hook IA à câbler)'],
  ['Capricieux', 'DR d’un Test de Sociabilité ENVERS la créature ±d10 (MSRC 15 l.151) MÉCANISÉ : modulateur `vsCapricieux` du Test social → `capriciousDR` (delta de DR, d10 seedé UNE fois dans `openSkillTest`, appliqué au DR du Test résolu par `FLOWS.test`) ; authoré sur le Test d’un dialogue mené avec la créature, comme vsGroups (Animosité) / vsStatus (Statut) le sont (le contexte social de l’interlocuteur est authoré, pas auto-injecté depuis l’entité)'],
  // Psychologie — engine/psychology.ts (parsePsychTraits)
  ['Peur', 'causesPeur (parsePsychTraits)'],
  ['Terreur', 'causesTerreur (parsePsychTraits)'],
  ['Frénésie', 'isFrenzyCapable + flux de Frénésie'],
  ['Animosité', 'trait psy ciblé (parsePsychTraits)'],
  ['Haine', 'trait psy ciblé (parsePsychTraits)'],
  ['Préjugé', 'trait psy ciblé (parsePsychTraits)'],
  ['Effrayé', 'trait psy ciblé ≈ Peur 0 (parsePsychTraits)'],
  ['Amour', 'trait psy ciblé (parsePsychTraits)'],
  ['Camaraderie', 'trait psy ciblé (parsePsychTraits)'],
  ['Phobie', 'trait psy ciblé ≈ Peur 1 (parsePsychTraits)'],
  ['Immunité Psychologique', 'psychImmune (parsePsychTraits)'],
  // Afflictions transmises — engine/disease.ts + state/corruptionFlow.ts
  ['Maladie', 'contraction post-combat (disease.ts — Lot D) ; arg = la maladie (rats/skavens : fievre-du-rongeur)'],
  ['Infecté', 'Blessure Purulente post-combat (disease.ts — Lot D)'],
  ['Corruption', 'exposition du groupe (corruptionFlow — Lot E)'],
  // Invocation à la mort — op `summon` du Flow `onSlain`, moissonnée par notifySlain → summonFlow.applySummon
  ['Charnier', 'death-spawn : 3d10 Zombies à la mort (op summon onSlain → resolveTriggerImpureOps/applySummon)'],
  // Reconstitution différée — op `scheduleRespawn` du Flow `onSlain` : programme la ré-invocation à
  // gameTime + d10 j (file scheduledEffects, horloge) ; fireScheduledEffects → applySummon ; précautions = cancelFlag.
  ['Gardien éternel', 'reconstitution d10 j si tué (op scheduleRespawn onSlain → resolveTriggerImpureOps → fireScheduledEffects/applySummon ; précautions = cancelFlag), #19'],
  // Désespoir (VDM 09 l.280) : mécanique AUTHORÉE en `effects`, comme Venin/Constricteur — le
  // déclencheur d'HORLOGE `onWake` est dispatché par `fireClockTriggers` (state/clockHooks, bus-owned),
  // cadencé par `runDailyUpkeep` le jour d'une nuit JOUÉE.
  ['Désespoir', 'État Exténué au réveil pendant une semaine — `effects` AUTHORÉ (onWake → op condition extenue, fireClockTriggers/clockHooks) ; la borne d’une semaine est la durée d’horloge du Trait accordé (`grantTrait.durationHours` du sort Aperçu de la mort, purgée par purgeClockEffects), cf. `state/clock-triggers.test.ts`'],
  // Dressé (Magie) : trait MARQUEUR sans effet propre — lu par le gate `startleCause` de Nerveux
  // (Condition Flow `has dresse-magie` → exemption de l'effarouchement magique, LDB 85 l.110, données).
  ['Dressé (Magie)', 'marqueur lu par le gate `startleCause` de Nerveux (exemption magie, données)'],
]);

// Journal/MJ EN CONSCIENCE : pas d'effet moteur câblable sans système support — la desc (verbatim)
// est affichée à l'inspecteur ; rien d'inventé.
const JOURNAL_MJ = new Map<string, string>([
  ['Arboricole', 'bonus Escalade/Discrétion en forêt — pas de biome forêt mécanisé'],
  ['Limicole', 'pas de terrain marécageux à pénalité de Mouvement'],
  ['Béni', 'Bénédictions de PNJ — pas de liste de prières dans la donnée (MJ)'],
  ['Miracles', 'Miracles de PNJ — pas de liste dans la donnée (MJ)'],
  // Dressé : chaque discipline est un trait à part entière (anti-pattern chaîne supprimé). Phase 1 =
  // STRUCTURE ; Phase 2 a CÂBLÉ Guerre/Magie (exemption Nerveux + CC) ; Phase 3 a CÂBLÉ Dompté (ignore
  // Bestial) et Garde (Territorial). Restent narratives/non modélisées : Monture, Cavalerie, Rapporteur…
  // Monture : la mountabilité réelle est posée par l'ENCOUNTER (`m.mount`/`ridesEntityId`, choix d'auteur
  // de scène) ; le trait reste le marqueur RAW. Cavalerie de choc : règle « charger en bon ordre » (Aux
  // Armes, formations d'unités) NON modélisée. Les deux = narratif/auteur, pas d'effet moteur isolé.
  ['Dressé (Monture)', 'marqueur RAW ; mountabilité posée par l’encounter (m.mount/ridesEntityId)'],
  ['Dressé (Cavalerie de choc)', 'charge en bon ordre (Aux Armes, formations) — non modélisé'],
  ['Dressé (Rapporteur)', 'discipline narrative (rapport) — arbitrage MJ'],
  ['Dressé (Revenir à la maison)', 'discipline narrative (retour au bercail) — arbitrage MJ'],
  ['Dressé (Trait)', 'discipline narrative (animal de trait : tire carrosse/chariot/charrue, LDB 85 l.118) — arbitrage MJ'],
  ['Increvable', 'recousue/ressuscitée post-combat — arbitrage MJ'],
  // Traits des Horreurs de Tzeentch (EDO) — flavor de statbloc sans système support, desc verbatim.
  ['Dédoublement', 'scission en 2 horreurs bleues à la mort/Critique — pas de spawn-on-death dans le moteur (MJ/auteur)'],
  ['Feu de Tzeentch', 'aura de feu entre Horreurs du même type — pas de système d’aura inter-créatures (MJ)'],
  // Traits de créature EDO (Appendice 2) — desc verbatim, mécaniques complexes sans système support.
  ['Amorphe', 'demi-Blessures hors feu/froid/magie + immunité aux Critiques — pas de réduction de dégâts typée (MJ)'],
  ['Décérébré', 'sans I/Int/FM/Soc, joue toujours en dernier — pas de système « sans Initiative » (MJ)'],
  ['Voleur de chair', 'revêt la peau d’un humain tué (trait de Gideon) — pas de système de déguisement (MJ)'],
  // Traits ZI sans système support (desc verbatim, MJ).
  ['Fouissement', 'déplacement par creusement de tunnel — pas de système de fouissement (positionnement MJ)'],
  ['Déstabilisant', 'aura ZI : une créature Instable à proximité compte ses Avantages −2 en fin de Round — pas de système d’aura inter-créatures modélisé (MJ ; cf. Feu de Tzeentch)'],
  // Traits homebrew frenchy.bzh — flavor d’aura/spawn sans système, desc verbatim.
  // Aura de Mort : aura de LANCEMENT conditionnelle au DOMAINE (Nécromancie/Shyish + ; Ghyran/Hysh/Azyr −).
  // Le câblage cast↔aura existe (cf. Aura de Dhar, DISPATCH) mais le GATING par Domaine du sort lancé n'est
  // pas exprimable (skillDRBonus n'est pas conditionnel au Domaine) → reste à bâtir.
  ['Aura de Mort', 'rayon 70 m : +DR Nécromancie/Shyish, −10 autres Domaines — gating par Domaine du cast à bâtir'],
  // Trait VDM sans SEAM de déclenchement — dette OUVERTE #862 (le dispatcher doit observer le TIERS) ;
  // la desc verbatim est affichée, rien n'est inventé. `raw.manifest.json` ne peut pas porter cette
  // dette : son intégrité (`validerDette`, scripts/raw/build-implemente.mjs) n'accepte qu'un topic
  // ou une fiche de `docs/raw/*.md`, or l'entité vit en catalogue.
  ['Siphonnage de sort', 'se déclenche quand un ENNEMI résout une incantation : `onCastResolved` est émis sur le LANCEUR (`self: caster`, combatFlow.ts:4274) et `emitCombatEvent` diffuse à `audience ?? [self]` (combatEvents.ts:32), aucun Trigger n\'observe le cast d\'autrui ; la table `vdm-siphonnage-de-sort` (tables.json) existe et reste à câbler — #862'],
]);

// Traits dont la mécanique est portée par les helpers de `dispatch` (capabilities/passive/effects/
// grantsManeuvers de la donnée). Tout trait de traits.json qui n'est NI ici NI dans les maps ci-dessus
// échoue le test de couverture — on n'oublie aucun trait dans un trou.
const DISPATCH = new Set<string>([
  'À sang-froid', 'Affamé', 'Armure', 'Belliqueux', 'Bestial', 'Bond', 'Brutal', 'Champion', 'Coriace',
  // Dressé (Guerre) : passive +10 CC (charMod) + marqueur du gate Nerveux (bruits). Dompté : suppression
  // GÉNÉRIQUE du Trait Bestial (suppressesCapabilities, lue par traitCapability ; +2d10 Soc = profil cuit
  // à l'authoring). Garde : capability `territorial` (lue par isTerritorial). Tous DISPATCH (LDB 85 l.106/108/110).
  // Dressé (Divertir) : passive +10 aux Tests de Divertissement/Musicien/Représentation (skillMod ×3,
  // LDB 85 l.104) — même canal passive que Dressé (Guerre) +10 CC. DISPATCH.
  'Dressé (Guerre)', 'Dressé (Dompté)', 'Dressé (Garde)', 'Dressé (Divertir)',
  'Corruption mentale', 'Démoniaque', 'Élite', 'Endurant', 'Éthéré', 'Fabriqué', 'Foulée', 'Furtif',
  'Grand', 'Immunité', 'Infravision', 'Insensible à la douleur', 'Instable', 'Intelligent', 'Magique',
  'Meneur', 'Mutation', 'Nerveux', 'Nuée', 'Parasité', 'Perturbant', 'Protection', 'Rage', 'Rapide',
  // Rampant (MSRC 15) : capability `noRun` (donnée) → `runMultiplier`=0 (budget de Course nul), la Marche
  // reste intacte. Dispatché (capability lue par hasNoRun).
  'Rampant',
  // Salive analgésique (MSRC 15) : capability `wakelessBite` (donnée) → le modifier de touche `wake-sleeper`
  // NE réveille PAS une proie endormie (Inconscient magique) quand CETTE créature l'attaque (morsure indolore),
  // là où toute autre attaque la réveille. Dispatché (capability lue par le modifier).
  'Salive analgésique',
  // Métamorphose (Enfant d'Ulric, Middenheim p.116) : le trait `grantsManeuvers` DEUX manœuvres `targeting:'self'`
  // (forme hybride / forme humaine) portant les ops `transform`/`endTransform` — bascule de profil DELTA (tableau RAW
  // VERBATIM), Traits hybrides et apparence, PERSISTANTE et réversible, au prix de DEUX Actions (loseTurn). Activée
  // par le JOUEUR via `battleSelfManeuver` (hotbar). Dispatché (grantsManeuvers). Auto-transformation de l'IA à câbler.
  'Métamorphose',
  // Redoutable (ZI) : Avantage min = Indice au début du tour — effet `onTurnStart` en donnée (op
  // gainAdvantage, indice baké via withArg, gardé Empêtré/Surpris). Dispatché comme tout `effects`.
  'Redoutable',
  // Aura de Dhar (frenchy-bzh 295 l.233 / 313 l.341) : DEUX entrées, une par dieu — le texte filtre les
  // bénéficiaires par « de Slaanesh »/« de Nurgle » et n'a pas la même portée (10 m / 11 m). Aura
  // `affectsGroups:[dieu]` + `includesSelf`, ops `skillDRBonus` Focalisation/Langue lues au lancement par
  // `castTestTalentDR`. Dispatché (aura en donnée).
  'Aura de Dhar (Slaanesh)',
  'Aura de Dhar (Nurgle)',
  // Incantateur hasardeux (VDM 15 folio 214) : `effects` onRoundStart → op `rollTable` sur la table
  // référencée `vdm-incantateur-hasardeux-domaine` (tables.json). Dispatché comme tout `effects`. Le
  // gate RAW « lorsqu'il est attaqué » n'a pas de Trigger (aucun `onAttacked`) : la cadence retenue est
  // « une fois par Round », l'autre moitié de la phrase reste en desc. Aucun op ne LANCE un sort du
  // Domaine tiré → les rangées de la table sont narratives.
  'Incantateur hasardeux',
  // Mauvais œil (VDM 15 folio 217) : `passive` = `grantTalent` (Seconde vue) + `skillDRBonus` ×5
  // (Pistage/Orientation/Perception +2 DR, Langue (Magick)/Focalisation +1 DR). Dispatché (passive en
  // donnée). Deux clauses restent en desc : le « et autres » (liste ouverte de Compétences, non
  // énumérable) et l'échappatoire d'Incantation Imparfaite (aucun op n'ANNULE une Imparfaite).
  'Mauvais œil',
  // Manifestation de Ghur (#18) : capability `spellDomainImmunity:'bete'` (donnée), lue par id par
  // `immuneToSpellDomain` au chemin d'incantation (`applyCast`) → un Sort du Domaine de la Bête
  // n'applique aucun de ses effets au porteur. Clause RAW de vulnérabilité anti-démon/mort-vivant
  // (hors Bête) NON modélisée (pas de concept de créature « vulnérable comme un démon/mort-vivant » —
  // rien d'inventé) : documentée sur la capability `spellDomainImmunity`.
  'Manifestation de Ghur',
  'Régénération', 'Résistance à la Magie', 'Rusé', 'Sang corrosif', 'Stupide', 'Taille', 'Territorial',
  'Toile', 'Vision nocturne', 'Vol',
  // Atouts de STRUCTURE de siège (ADE II 8) : capabilities `structResistant`/`structImpenetrable`
  // (donnée), lues par `hasCapability` dans `engine/structures` (`structureImmune`) — canal dispatch.
  'Résistant', 'Impénétrable (structure)',
  // Marque de Khorne (MDG 07 l.250-252) : `capabilities.frenzyCapable` (Frénésie, même canal que le
  // trait « Frénésie ») + `capabilities.psychType:'animosite'`+`psychCible:'slaanesh'` (Animosité fixe,
  // parsePsychTraits — la réciproque Slaanesh→porteur est le MÊME canal `targetedTrigger`, posée côté
  // statblocs Slaanesh) + `passive` : `grantTalent` (Savoir-vivre (Suivants de Khorne), structurel —
  // `talentEffects.traitGrantedTalents`), `castPenalty{blocked}` ×2 (Langue (Magick)/Focalisation,
  // exemption dissipation STRUCTURELLE), `grantCareerTalent` ×10 (achats hors-Carrière au tarif normal
  // — `talentEffects.careerTalentAdditions`, étendu aux Traits).
  'Marque de Khorne',
  // Marque de Tzeentch (EDOC 13 l.522-524) : `capabilities.psychType:'animosite'`+`psychCible:'nurgle'`
  // (Animosité fixe, parsePsychTraits — la réciproque Nurgle→porteur est le MÊME canal `targetedTrigger`,
  // posée côté statblocs Nurgle) + `grantGroups:['tzeentch']` + `passive` : `grantTalent` (Savoir-vivre
  // (Disciples de Tzeentch), structurel — `talentEffects.traitGrantedTalents`), `grantCareerTalent` ×10
  // (achats hors-Carrière au tarif normal — `talentEffects.careerTalentAdditions`) + `capabilities.markMutations`
  // (tirage 1d10/3 Mutations alternées mental/phys, `state/spawn.spawnMutations` — PLUS LÉGER que Khorne :
  // ni Frénésie ni blocage d'incantation, non RAW pour Tzeentch).
  'Marque de Tzeentch',
  // Ogre (ADE II 2 l.708, folio 31) : `capabilities.encumbranceFactor`/`consumptionFactor` (donnée)
  // — lus par `combatFeatures/dispatch.traitEncumbranceFactor` (composé max talent/trait dans `items.maxEncumbrance`)
  // et `provisions.traitConsumptionFactor` (composé dans `dailyFoodUpkeep`/`provisioningManifest`). Canal
  // dispatch (capability lue par id, MÊME lecture ciblée `c.traits` que Marque de Khorne).
  'Ogre',
  // Pisteur (LDB 85 folio 341, #1011) : `passive` = `skillDRBonus{pistage, bonusOf:initiative}` — MÊME
  // canal que Furtif, lu par le collecteur `skillDRBonus` (ops.ts) que la couche de Test générique
  // applique (`rollFlowSpecs`, spec `test`). Dispatché (passive en donnée).
  'Pisteur',
  // Grimpant (LDB 85 l.160-162) : capabilities `autoClimb` + `climbFullSpeed` (donnée), lues par
  // `hasAutoClimb`/`hasClimbFullSpeed` (dispatch.ts:374/380) → traversée verticale du pathing
  // (`path.climbTraverseFor`), coût de Mouvement plein (`store.ts:2005/2023`) et décision d'IA
  // (`ai-climb.test.ts`). Canal dispatch.
  'Grimpant',
  // Lanceur de Sorts : capability `spellcaster` (donnée), lue par `knowsCastingSkill` (magic.ts:278) —
  // la créature peut incanter sans posséder la Compétence en propre. Les sorts CONNUS restent un choix
  // d'auteur (`spells` du statbloc/spawn), ce qui est une donnée de scène, pas un trou de câblage.
  'Lanceur de Sorts',
  // Mort-vivant : capability `undead` (donnée), lue par `traitCapability(c.traits,'undead')` — exclusion
  // des cibles d'une manœuvre de zone (`combatManeuvers.ts:433`), ciblage du Hurlement fantomatique, et
  // exemption des contractions de maladie. Canal dispatch (marqueur INTERROGÉ, pas narratif).
  'Mort-vivant',
  // Entêté (EDOC 07 folio 22) : `passive` = `charMod{force-mentale, +20}` — MÊME canal que Coriace/Élite/
  // Meneur, lu par le collecteur `passiveMods` (`traitPassiveMods`, trauma.ts:17). Le volet ACTIF (Test
  // opposé de maîtrise du cavalier/conducteur) est porté par #617, arbitrage #630 §1.
  'Entêté',
]);

/** Entrée BRUTE de `traits.json` — lue au fichier (le registre `TRAITS` est dérivé, il ne rend pas
 *  les champs de mécanique tels quels). */
type RawTrait = { label: string } & Partial<Record<(typeof MECHANIC_FIELDS)[number], unknown>>;

/** Les CINQ champs de `TraitData` qui portent une mécanique exécutable (cf. `src/data/index.ts`) :
 *  `passive` (GameOp continus), `effects` (TriggeredEffect), `aura` (projection `recompute-auras`),
 *  `capabilities` (drapeaux INTERROGÉS par `traitCapability`), `grantsManeuvers` (manœuvres octroyées).
 *  `desc`/`source`/`maison`/`standard`/`indice`/`specs*`/`appearance` n'en sont pas. */
const MECHANIC_FIELDS = ['passive', 'effects', 'aura', 'capabilities', 'grantsManeuvers'] as const;

function allTraits(): RawTrait[] {
  const path = fileURLToPath(new URL('../../data/traits.json', import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as RawTrait[];
}

function allTraitLabels(): string[] {
  return allTraits().map((t) => t.label);
}

/** Champs de mécanique NON VIDES portés par l'entrée (liste vide = aucune mécanique en donnée). */
function mechanicFieldsOf(t: RawTrait): string[] {
  return MECHANIC_FIELDS.filter((f) => {
    const v = t[f];
    if (v == null) return false;
    return Array.isArray(v) ? v.length > 0 : Object.keys(v as object).length > 0;
  });
}

describe('parité — registre des Traits dérivé de traits.json', () => {
  it('la dérivation est totale : chaque trait de traits.json est dans TRAITS (par id)', () => {
    const missing = allTraitLabels().filter((l) => !TRAITS()[slugId(l)]);
    expect(missing).toEqual([]);
  });

  it('chaque trait de traits.json est couvert par un sous-système identifié (dispatch / ailleurs / journal)', () => {
    const uncovered = allTraitLabels().filter(
      (l) => !DISPATCH.has(l) && !COUVERT_AILLEURS.has(l) && !JOURNAL_MJ.has(l),
    );
    expect(uncovered).toEqual([]);
  });

  // GARDE (#1011) : `JOURNAL_MJ` classe les traits SANS effet moteur câblable. Un trait qui porte un
  // champ de mécanique EST câblé — le laisser là verrouille un énoncé faux (et « arbitrage MJ » viole
  // la règle 7 : rien ne se reporte au MJ). Le classement se MESURE sur la donnée, il ne se déclare pas.
  it('une entrée JOURNAL_MJ ne porte AUCUNE mécanique en donnée (sinon son classement ment)', () => {
    const menteurs = allTraits()
      .filter((t) => JOURNAL_MJ.has(t.label))
      .map((t) => ({ label: t.label, champs: mechanicFieldsOf(t) }))
      .filter((o) => o.champs.length > 0)
      .map((o) => `${o.label} → ${o.champs.join('/')} (à reclasser en DISPATCH ou COUVERT_AILLEURS)`);
    expect(menteurs).toEqual([]);
  });

  it('une seule source de couverture par trait (pas de double-classement)', () => {
    const seen = new Map<string, number>();
    for (const l of [...DISPATCH, ...COUVERT_AILLEURS.keys(), ...JOURNAL_MJ.keys()]) {
      seen.set(l, (seen.get(l) ?? 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([l]) => l);
    expect(dupes).toEqual([]);
  });

  it('parseTrait normalise Indice/argument/casse', () => {
    expect(parseTrait('Démoniaque 8+')).toEqual({ id: 'demoniaque', indice: 8, arg: undefined });
    expect(parseTrait('Toile 40')).toEqual({ id: 'toile', indice: 40, arg: undefined });
    expect(parseTrait('Immunité (Poison)')).toEqual({ id: 'immunite', indice: undefined, arg: 'Poison' });
    expect(parseTrait('À Sang-froid')?.id).toBe('a-sang-froid'); // casse de la donnée ≠ id canonique
    expect(parseTrait('Vol 100')).toEqual({ id: 'vol', indice: 100, arg: undefined });
    expect(parseTrait('Nuée')?.id).toBe('nuee');
    expect(parseTrait('Taille (Énorme)')).toEqual({ id: 'taille', indice: undefined, arg: 'Énorme' });
    expect(parseTrait('Armure 4')).toEqual({ id: 'armure', indice: 4, arg: undefined });
    expect(parseTrait('Trait inconnu')).toBeNull();
  });

  // La nature d'affichage est DÉRIVÉE de la donnée (jamais une liste en dur) :
  //  attaque (grantsManeuvers mêlée OU capabilities.naturalWeapon, dont le tir) → « +Dégâts » ;
  //  wardSave → « N+ » ; sinon Indice nu « N ».
  it('formatTrait : nature « +N » dérivée de la donnée', () => {
    const fmt = (id: string, value?: number) => formatTrait({ id, ...(value != null ? { value } : {}) } as TraitInstance);
    expect(fmt('morsure', 9)).toBe('Morsure +9'); // attaque mêlée (grantsManeuvers)
    expect(fmt('a-distance', 8)).toBe('À distance +8'); // attaque à distance (naturalWeapon ranged)
    expect(fmt('vol', 100)).toBe('Vol 100'); // indice simple
    expect(fmt('demoniaque', 8)).toBe('Démoniaque 8+'); // sauvegarde (wardSave)
  });
});
