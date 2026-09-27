import type { Combatant } from '../types';
import type { RefDesignee } from '../../data/schemas/grammaire/ref';

/** Famille d'incantation conférée par un Talent de lanceur (LDB 10) — pilote l'apprentissage
 *  des sorts (grimoire.ts). Source UNIQUE du type, partagée avec `CasterTalent`. */
export type CastingKind = 'mineure' | 'arcane' | 'invocation' | 'beni' | 'chaos';

/** Contexte lecture seule d'un hook de capacité (level = times du talent / Indice du trait). */
export interface CombatFeatureCtx {
  combatant: Combatant;
  level: number;
  /** Spécialisation du talent (« Sans Peur (Vampires) » → « Vampires ») — absente sur un
   *  talent accordé par sort (op grantTalent) ou non spécialisé. */
  spec?: string;
}

/**
 * Une capacité de combat/de jeu conférée par un TALENT (LDB 10) — registre `defs/` généré
 * (gen-registry.mjs), même patron que `engine/qualities`. Chaque champ décrit UN effet écrit de la
 * source ; les helpers de `dispatch.ts` les agrègent et les consommateurs (combat.ts, combatFlow,
 * rollFlows, store) les appellent aux moments de jeu. `level` = nombre de fois pris (times).
 *
 * Les talents de CRÉATION (+5 carac., compétence/talent ajouté aux carrières, Blessures/Chance/
 * Détermination/Mouvement) restent pilotés par les données via `talentEffects.ts` (ops `GameOp`) ;
 * les talents NARRATIFS sont allowlistés par le test de parité (`parity.test.ts`) — rien d'inventé.
 */
export interface CombatFeature {
  /** Pénalité de main secondaire transformée par niveau (Ambidextre, LDB 10 : -20 → -10 à 1×, 0 à `zeroAt`).
   *  DÉCLARATIF (`offHandPenalty(c)` l'interprète) — jamais une hook-fonction, 100 % donnée éditable. */
  offHandPenalty?: { perLevel: number; zeroAt: number };
  /** Modes d'attaque ajoutés par la capacité (Maniement de deux armes → ['dual-wield']). */
  attackModes?: string[];
  // ── Dégâts (× niveau) ──────────────────────────────────────────────────────
  /** Coup puissant : +niveau Dégâts avec les armes de Corps à corps. */
  meleeDamageBonus?: boolean;
  /** Tir précis : +niveau Dégâts avec les armes à distance. */
  rangedDamageBonus?: boolean;
  /** Combat déloyal : +niveau Dégâts avec Corps à corps (Bagarre). */
  brawlDamageBonus?: boolean;
  /** Charge berserk / Déterminé : +niveau Dégâts quand on Charge. */
  chargeDamageBonus?: boolean;
  /** Tueur : Bonus de Force = Bonus d'Endurance de la cible s'il est plus élevé. */
  slayer?: boolean;
  /** Robuste : réduit tous les Dégâts SUBIS de niveau (min 1 Blessure). */
  damageReduction?: boolean;
  /** Frappe blessante : +niveau Blessures quand on inflige une Blessure Critique. */
  critExtraWounds?: boolean;
  /** Tir sûr : ignore niveau PA de la cible au tir. */
  rangedAPIgnore?: boolean;
  // ── Modificateurs de Test d'attaque ────────────────────────────────────────
  /** Frappe assommante : pas de −20 de Localisation visée (Tête) avec une arme Assommante. */
  ignoreCalledShotHead?: boolean;
  /** Tir mortel : choisit la Localisation au tir — pas de −20 de Localisation visée à distance. */
  ignoreCalledShotRanged?: boolean;
  /** Tireur d'élite : ignore les modificateurs de Taille de la cible au tir. */
  ignoreSizeRangedMods?: boolean;
  /** Tireur embusqué : aucune pénalité à Longue portée, moitié à Portée extrême. */
  sniper?: boolean;
  // ── Initiative / économie d'action ─────────────────────────────────────────
  /** Combat instinctif : +10 × niveau à l'Initiative de combat. */
  initiativeBonus?: boolean;
  /** Tir rapide : tire hors de l'ordre d'Initiative si l'arme à distance est chargée (pré-emption gratuite). */
  strikeFirstRanged?: boolean;
  /** Vigilance : Test de Perception Intermédiaire (+0) pour ignorer la Surprise. */
  surpriseSave?: boolean;
  /** Rechargement rapide ('all') / Artilleur ('blackpowder') : +niveau DR aux Tests de rechargement. */
  reloadDR?: 'all' | 'blackpowder';
  /** Sprinter : Mouvement +1 quand on Court. */
  runBonus?: boolean;
  /** Fuite ! : Mouvement +1 quand on Fuit. */
  fleeBonus?: boolean;
  /** Fuite ! — variante « Nouveaux talents et talents mis à jour » (AA 13 l.68) : Mouvement +1 quand on
   *  est la Cible d'une Poursuite. Lu par la manche de poursuite terrestre (`state/pursuitFlow.ts`,
   *  `pursuedMovement`) au calcul du DR de vitesse (LDB 15 l.104-108). */
  pursuitTargetBonus?: boolean;
  // ── Défense / Avantage ─────────────────────────────────────────────────────
  /** Porte-Bouclier (LDB 10 l.972) : +niveau Avantage quand on se défend au Bouclier et qu'on PERD le
   *  Test opposé (consolation d'une situation désespérée — pas sur une défense gagnée). */
  shieldAdvantage?: boolean;
  /** Réaction défensive à coût d'Avantages de réserve (Porte-Bouclier variante « Avantage de groupe »,
   *  AA 13 l.84) : quand on se défend au Bouclier, 1×/Round, dépenser `cost` Avantages soit pour causer des
   *  Dégâts « comme s'il s'agissait de son Action », soit pour repousser l'attaquant de 2 m et se
   *  désengager. Déclarée en DONNÉE (variante `variants[].combat`, active en mode Avantage de groupe) ;
   *  offerte par le chooser de défense (`shieldReactionCost`), débitée par `campSpend`, résolue par
   *  `applyShieldReaction`. */
  advantageDefenseReaction?: { avantage: number };
  /** Contre-attaque en gagnant un Test opposé de défense en mêlée (Champion LDB 85 sans condition d'arme ;
   *  Riposte LDB 10 avec `counterRequiresFastParry`). GÉNÉRIQUE : tout talent/trait qui le déclare contre. */
  counterOnDefenseWin?: boolean;
  /** La contre-attaque exige une arme de PARADE Rapide (Riposte ; Champion ne l'exige pas). */
  counterRequiresFastParry?: boolean;
  /** Renversement : en gagnant le Test opposé de Corps à corps, prend TOUS les Avantages adverses au lieu de +1. */
  stealAdvantage?: boolean;
  /** Renversement — variante « Avantage de groupe » (AA 13 l.92-98) : prend 1 Avantage dans la réserve
   *  ADVERSE (au lieu de tout l'Avantage individuel de l'adversaire), l'ajoute à sa réserve, sans Dégât. */
  stealOne?: boolean;
  /** Coude-à-coude — variante « Avantage de groupe » (AA 13 l.43) : « compte comme deux combattants »
   *  au décompte de domination de fin de Round (transfert d'Avantage). Poids par défaut 1. */
  transferWeight?: number;
  /** Artilleur / Rechargement rapide — variante « Avantage de groupe » (AA 13 l.9/90) : recharger une
   *  arme pendant un combat compte comme une Action Évaluer → +1 Avantage supplémentaire au rechargement. */
  reloadAssessAdvantage?: boolean;
  /** Cavalier émérite — variante « Avantage de groupe » (AA 13 l.25) : Taille considérée égale à celle de
   *  la monture pour résister à la Peur/Terreur causée UNIQUEMENT par la Taille de l'adversaire. */
  fearSizeAsMount?: boolean;
  /** Impitoyable — variante « Avantage de groupe » (AA 13 l.74) : le coût d'Avantage d'une Retraite
   *  stratégique (Désengagement, défaut 2 Avantages, AA 11 l.37) tombe à cette valeur pour le porteur. */
  retreatCost?: number;
  /** Impitoyable (LDB 10 l.591) : au Désengagement « Sacrifier l'Avantage », GARDE niveau Avantages au
   *  lieu de tomber à 0 (× niveau). */
  keepAdvantageOnDisengage?: boolean;
  /** Impitoyable (LDB 10 l.591) : peut Sacrifier l'Avantage pour se Désengager MÊME avec moins d'Avantage
   *  que ses adversaires (relâche la garde de supériorité stricte). */
  disengageWithLessAdvantage?: boolean;
  /** Battement — variante « Avantage de groupe » (AA 13 l.17) : manœuvre d'Action retirant de l'Avantage
   *  à la réserve ADVERSE (−1 sur Succès de Corps à corps, −1 de plus à 6 DR). Le porteur peut la déclarer. */
  battement?: boolean;
  /** Distraire (LDB 10 / AA 13 l.51) : manœuvre de Mouvement — Test opposé Athlétisme/Calme ; sur Succès,
   *  la cible (mode groupe : sa réserve) ne gagne aucun Avantage jusqu'à la fin du prochain Round. */
  distraire?: boolean;
  /** Maîtrise du combat : compte pour 1+niveau personnes au calcul du surnombre. */
  outnumberCount?: boolean;
  // (Mâchoires d'acier n'est PLUS une CombatFeature : c'est un effet `onGainCondition` data-driven —
  //  talents.json `effects` + brique `state/combat/triggeredTest` — résolu cadence-aware.)
  /** Cœur vaillant : tente de retirer le Brisé même Engagé (Calme en fin de Round). */
  braveheart?: boolean;
  /** Sans peur (LDB 10 l.1051) : PAS une immunité — détecte que le porteur a le Talent contre
   *  l'Ennemi spécifié (`ctx.spec` ; sans spec — talent ACCORDÉ par Flambeau de Vertu/Cœurs
   *  ardents — toutes sources). L'effet réel (un seul Test de Calme Accessible (+20), qui PEUT
   *  échouer) est résolu par `sansPeurVs`/`resolvePeurTest`/`resolveTerreurTest` (psychology.ts). */
  fearImmune?: boolean;
  /** Endurci : ignore niveau Points de Blessure perdus par l'État Hémorragique. */
  bleedIgnore?: boolean;
  // ── Magie / psychologie ────────────────────────────────────────────────────
  /** Harmonisation aethyrique : pas d'Incantation Imparfaite sur un double RÉUSSI de Focalisation. */
  focusNoMiscastOnDouble?: boolean;
  /** Diction instinctive : pas d'Incantation Imparfaite sur un double RÉUSSI de Langue (Magick). */
  castNoMiscastOnDouble?: boolean;
  /** Effrayant : le porteur a un Indice de Peur égal à son niveau. */
  causesFear?: boolean;
  // ── Tests hors combat ──────────────────────────────────────────────────────
  // (Le +DR de Talent — Menaçant → Intimidation — est désormais la règle UNIVERSELLE `talentTestSLBonus`
  //  pilotée par `TalentData.test.matches`, jamais par un descripteur `testDR` par-libellé.)
  /** Inverse un Test RATÉ de la Compétence référencée s'il devient réussi (Sociable → Ragot, Studieux →
   *  Recherche…). Réfs STRUCTURÉES `{ id, spec? }` (jamais un match par libellé) ; `capDR` plafonne le DR
   *  (Pansement +1). TOUJOURS une LISTE : un Talent peut couvrir plusieurs Compétences en « ou »
   *  (Pilote → Ramer OU Voile, LDB 10 l.964). */
  reverseFailed?: { skills: RefDesignee[]; capDR?: number };
  // ── Économie / social ──────────────────────────────────────────────────────
  /** Négociateur (LDB 59 l.43) : un Marchandage GAGNÉ réduit le prix de 20 % (au lieu de 10 %) même
   *  sans Succès Stupéfiant (DR net ≥ 6). Lu par merchantFlow lors de la conclusion du Marchandage. */
  bargainBonus?: boolean;
  // ── Capacités diverses (hors combat direct) ──────────────────────────────────
  /** Costaud (LDB 10) : limite d'Encombrement +2 × niveau (items.maxEncumbrance). */
  encumbranceBonus?: boolean;
  /** Âme pure (LDB 10) : seuil de Corruption +niveau (corruption.corruptionThresholdExceeded). */
  corruptionThreshold?: boolean;
  /** Chirurgie (LDB 10) : débloque le mode de soin chirurgical (healing/partyFlow : fracture/amputation). */
  surgery?: boolean;
  // ── Incantation (apprentissage des sorts — grimoire.ts) ──────────────────────
  /** Talent de lanceur (LDB 10) : famille d'incantation qu'il ouvre (Magie mineure → 'mineure',
   *  Magie des Arcanes → 'arcane', Invocation → 'invocation', Béni → 'beni', Magie du Chaos → 'chaos').
   *  La spécialisation (Domaine/Culte) est portée par `ctx.spec`. Remplace le name-match de grimoire. */
  castingKind?: CastingKind;
  /** Commandant d'équipe (AA 13 l.29-35) : peut DIRIGER une équipe servant une Arme d'équipe « à portée
   *  de voix » (Test de Commandement Intermédiaire) — sur réussite, l'équipe tire au score de Projectiles
   *  du Personnage. Lu par `hasCommandTeam` (affordance + substitution `state/commandTeam`). */
  commandTeam?: boolean;
  /** Chanson de marin (MDG 09 l.32-40) : peut ENTONNER une chanson de marin connue (une spec du Talent =
   *  une chanson apprise, l.36) — Test de Divertissement (Chant), effet 3 min + DR sur tout l'équipage,
   *  une seule chanson par quart. Lu par `shantySingers` (affordance) + `battleSingShanty` (state). */
  seaShanty?: boolean;
  /** Frappe blessante — variante « Nouveaux talents et talents mis à jour » (AA 13 l.57) : au lieu de
   *  Blessures supplémentaires (`critExtraWounds`), lance deux fois le tableau de Blessures Critiques et
   *  garde le résultat préféré. Lu par la résolution de Critique (kind-agnostique, même primitive que le
   *  drapeau temporaire `critRollTwice` de Bénédiction de Sauvagerie, `engine/activeFlags.ts`). */
  critRollTwice?: boolean;
}
