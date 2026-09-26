/**
 * Types des jets/flux DIFFÉRÉS du store + récompenses de victoire et
 * monnaie — types PURS, sans logique, tenus hors du store.
 * Le store les ré-exporte (les imports existants `from './store'` restent valides).
 */
import type { CharKey, Difficulty, HitLocation, Weapon, FireArc, Combatant, EffectSource } from '../engine/types';
import type { DiceSpec } from '../engine/dice';
import type { PorteurDeFiche } from '../engine/statblock';
import type { ConjureForm } from '../engine/conjuredWeapons';
import type { Pt } from './path';
import type { Dir8 } from './dir8';
import type { Effect, Dialogue } from './scene';
import type { Flow } from './flow';
import type { GameOp, OpsCtx, OpsCtxGele, PairedSense } from '../engine/ops';
import type { TestResult, OpposedResult } from '../engine/tests';
import type { AttackResult, DefenseMode, DifficultyComposition, ModLine } from '../engine/combat';
import type { AttackKind } from '../engine/creatureAttacks';
import type { CriticalResolved } from '../engine/critical';
import type { OupsResolved } from '../engine/oups';
import type { StakeRef, SpellData } from '../data';
import type { CastResult, MissileResult, FocusResult, CounterspellOutcome } from '../engine/magic';
import type { HealMode } from '../engine/healing';
import type { PsychType } from '../engine/psychology';
import type { RecoverOpposition } from './combat/recover';
import type { RecapLine } from './recapLine';
import type { RollParticipant, MultiPending, PendingBase } from './rollFlowFactory';
import type { PlayerText } from '../i18n/playerText';
import type { Money } from '../engine/money';
import type { SupportDetail } from '../engine/skills';
/** Résultat du jet d'UN contributeur à un Test d'équipage par rôle (MDG 14). Défini ICI (neutre,
 *  avec les autres types de pending) pour que ce module ne dépende de RIEN du domaine naval —
 *  `shipManeuver.ts` le RÉ-IMPORTE (quarantaine d'import #328). */
export interface CrewRoleRoll { roll: number; target: number; sl: number }

export type { Money };
/** Une ligne de butin d'équipement (giveTrapping) ATTRIBUABLE par portrait — partagée entre
 *  l'écran de victoire et la fenêtre de loot (fouille/Test/dialogue). `magic` = qualités cachées
 *  ou ajoutées, révélables par Évaluation. L'Effet d'origine est conservé tel quel. */
export interface LootGear {
  label: string;
  magic: boolean;
  effect: Extract<Effect, { type: 'giveTrapping' }>;
}
/** Butin HORS victoire (fouille d'un décor, branche de Test, dialogue…) : fenêtre d'attribution
 *  « qui l'emporte ? » — même brique que l'écran de victoire. `gold` est DÉJÀ crédité à la bourse
 *  (affichage), `messages` = textes d'ambiance (Effets `journal` du même lot). */
export interface PendingLoot {
  title: string;
  messages?: string[];
  gold?: Money;
  gear: LootGear[];
}
/** Reconstitution DIFFÉRÉE programmée à la mort (Gardien éternel) : à l'échéance d'un `ScheduledEffect`,
 *  ré-invoque la fiche `summon.porteur` (celle du défunt pour `ref:'self'`, #1882) près de `caster.pos`,
 *  dans le camp de `caster.kind` (cf. `summonFlow.applySummon`). `caster` est un INSTANTANÉ minimal du
 *  défunt — les seuls champs lus par `applySummon` (id/name/kind/pos). */
export interface ScheduledRespawn {
  caster: { id: string; label: string; kind: Combatant['kind']; pos: Pt };
  summon: { porteur: PorteurDeFiche; count: number; allyOfCaster?: boolean };
}
/** Entrée de la file d'effets PROGRAMMÉS (runtime, Lot 0), déclenchée quand l'horloge atteint `executeAt`
 *  (minute absolue `gameTime`), sauf si `cancelFlag` a été posé entre-temps. Deux charges possibles : un
 *  `flow` (minuterie `delayedEffect` : exécuté via runFlow → branches/Test possibles) OU un `respawn`
 *  (reconstitution d'une créature à la mort — résolu par `applySummon`). */
export interface ScheduledEffect {
  executeAt: number;
  flow?: Flow;
  cancelFlag?: string;
  respawn?: ScheduledRespawn;
}
/** Récompenses capturées à la victoire (pour l'écran de fin de combat) : XP de groupe gagnée, or récupéré,
 *  butin (noms d'objets, dans l'inventaire de groupe, assignables à un héros), ennemis vaincus (groupés). */
export interface PendingVictory {
  xp: number;
  gold: Money;
  /** Équipement (giveTrapping) du butin — ATTRIBUABLE par portrait sur l'écran (qualités/skin
   *  conservés), au lieu d'aller d'office au 1er héros. Non attribué → 1er héros à la fermeture. */
  gear?: LootGear[];
  defeated: { label: string; count: number; creatureId?: string }[];
  /** Créatures déjà récoltées (« Précieuses Entrailles », ZI) sur cet écran — grise le bouton (par id). */
  harvested?: string[];
  /** Messages de journal de la victoire (Effets `journal` de onVictory) — affichés DANS l'écran (#9). */
  messages?: string[];
  /** Effets DIFFÉRÉS au clic « Continuer » (téléport/dialogue/combat) — sinon ils masquent l'écran (#9). */
  onContinue?: Effect[];
  /** COOP (spec §4bis) : ✓ de chaque siège — l'écran est synchronisé, l'hôte ferme à l'unanimité. */
  readyBySeat?: Record<number, boolean>;
}
/** Avancée d'un dialogue une fois un Test suspendu résolu : transition vers un nœud (dialogue
 *  conservé), ou clôture de la conversation. */
export type DialogueTransition = { dialogue: Dialogue; nodeId: string; speakerId?: string } | 'close';

/** Test de compétence interactif en attente d'acquittement par le joueur. */
export interface PendingTest {
  actorId: string;
  actorName: string;
  /** Intitulé de la SITUATION (« Esquiver les piques de la dalle ») → titre de la modale. */
  label: string;
  /** Compétence/Caractéristique RÉELLE testée (« Athlétisme », « Dextérité ») → libellé du cadre de
   *  jet (RollLine), comme « Calme » pour la Psychologie. À défaut, on retombe sur `label`. */
  skill?: string;
  /** Réf STRUCTURÉE du Test (≠ `skill` libellé d'affichage) : id de Compétence + spec, ou Caractéristique —
   *  lue par `talentTestSLBonus` (LDB 10 : +DR de Talent par id, jamais un match par libellé). Threadée du
   *  `FlowTest` (skill/spec/characteristic) au build du pending. */
  skillId?: string;
  spec?: string;
  /** RÔLE tenu (id stable de `crew-roles`) — PROVENANCE de la rangée, jamais son libellé de ligne :
   *  la ligne NOMME la Compétence lancée (Z5), le rôle dit d'où vient le jet (#1117). */
  roleId?: string;
  char?: CharKey;
  skillValue: number;
  difficulty: Difficulty;
  requireSL: number;
  target: number;
  /** LIGNE MONTÉE du Test, transportée telle quelle depuis le monteur canonique (`rollSeam.rollStep`,
   *  posée par `openSkillTest`) — MÊME couple que `CascadeStepBase.base`/`.mods` : `base` = Niveau de
   *  Compétence NU (`LDB 09 l.17`), `mods` = TOUT l'écart nommé (États, Encombrement, passifs, Soutien
   *  `LDB 12`, malus psy `LDB 21`, Statut `LDB 08`, météo `MDG 13`), chaque ligne portant la `famille`
   *  et la fiche posées À L'ÉMISSION. L'affichage les REND, il ne les recompose pas : une ligne
   *  re-dérivée à la modale pourrait contredire celle qui a servi à la cible.
   *  Change avec le lanceur choisi (`testSetActor` recopie celles du candidat). */
  base?: number;
  mods?: ModLine[];
  /** Malus psy de Sociabilité de l'acteur (Animosité −20 / Préjugé −10 envers l'interlocuteur, LDB 21) —
   *  déjà intégré à `skillValue`/`target` ; conservé pour l'affichage en modale. */
  psychMod?: number;
  /** Libellé lisible du malus psy social (« Animosité −20 envers Elfe ») pour la modale de Test. */
  psychDetail?: string;
  /** Mod d'ENVIRONNEMENT (météo maritime — Précipitations, MDG 13 l.187-201) — déjà intégré à
   *  `target` (PAS à `skillValue`, comme la Difficulté : `seaWeatherTestMod`, POINT UNIQUE dans
   *  `openSkillTest`) ; conservé À PART pour l'afficher comme une ligne de mod dédiée dans la modale. */
  envMod?: number;
  /** Libellé de la source du mod d'environnement (« Abondantes ») pour la modale de Test. */
  envLabel?: string;
  /** d10 de Capricieux tiré par l'interlocuteur (MSRC 15 l.149-159), UNE fois par Test, seedé —
   *  porté pour l'affichage (la table est celle de la créature, pas un mod de l'acteur). */
  capriciousRoll?: number;
  /** Delta de DR de la table Capricieux (`capriciousDR`, MSRC 15 l.149-159) : appliqué au DR du Test
   *  RÉSOLU (`FLOWS.test.resolve`), jamais à `skillValue`/`target`. */
  capriciousDR?: number;
  /** Outil utilisé (uid résolu sur l'acteur) : sa qualité d'artisanat module l'issue / casse l'objet (Phase C2a). */
  itemUid?: string;
  /** Jet double (Maladresse si en plus c'est un échec) — pour casser un outil Bâclé hors combat. */
  isDouble?: boolean;
  /** Membres du GROUPE pouvant tenter ce Test (le défaut `actorId` = le meilleur) — le joueur CHOISIT
   *  qui lance via `testSetActor` (au lieu d'une désignation automatique). Chaque entrée porte sa
   *  valeur/cible/malus ET sa LIGNE MONTÉE (`base`/`mods` — le Soutien et les États diffèrent d'un
   *  candidat à l'autre), pour re-cibler le Test sans recalcul. Absent/≤1 → pas de choix. */
  candidates?: { id: string; label: string; value: number; target: number; clamped?: number; base?: number; mods?: ModLine[]; psychMod?: number; psychDetail?: string; itemUid?: string; support?: SupportDetail }[];
  /** ÉCRÊTAGE réellement subi par `target` (bornes de `TestPolicy`, `engine/tests.clampTarget`) —
   *  informatif : la modale NOMME « plafond 99 : −N » au lieu de le déduire de la valeur de la cible. */
  clamped?: number;
  /** SOUTIEN (LDB 12 l.187-200) du candidat COURANT, déjà FONDU dans `skillValue`/`target` — porté
   *  pour l'AFFICHAGE (ligne de mod nommée, `ui/breakdown.supportSplit`), comme `PendingActivity.support`.
   *  Change avec le lanceur choisi (`testSetActor` recopie celui du candidat). */
  support?: SupportDetail;
  /** La Difficulté a été ALLÉGÉE (`FlowTest.easierIf`) : libellé de la compétence/du talent qui l'a
   *  permise — affiché SUR le chip de difficulté (« Facile (allégée : Crochetage) »). */
  easedBy?: string;
  /** Rempli après « Lancer » ; null tant que le jet n'a pas eu lieu (Chance possible ensuite). */
  roll: number | null;
  success: boolean;
  sl: number;
  /** Réussite forcée par Résilience AVANT le jet (LDB 17 l.68) : affichage « garanti », sans dé. */
  forced?: boolean;
  /** Dé FIXÉ par le joueur (option « Dés fixés », `PendingBase.fixed`) — jamais posé sur ce flux :
   *  sans cible dérivable, la saisie y est refusée (garde `fixed-die-inventaire.test.ts`). */
  fixed?: boolean;
  /** Relance par Chance déjà effectuée (LDB 12 l.40 : 1 relance max par Test). */
  rerolled?: boolean;
  /** Ce Test EST le sous-Test d'un `onOwnTestFailed` (FM de palier 2 des Crampes routé en modale hors
   *  combat, MSRC 16) : sa résolution NE ré-émet PAS le trigger (garde de ré-entrance, `resolveTest`). */
  noOwnTestFailed?: boolean;
  /** Test SUBI (porte `routeTriggeredTest`) : sa branche parle le vocabulaire `target`/`caster`, que
   *  seul le marcheur d'ACTEUR honore (`runCombatFlow`, `combat/triggeredTest.ts`) ; le marcheur de
   *  SCÈNE parle `party`/`hero`+`heroId`, que `runCombatFlow` n'honore pas. Ce marqueur NOMME le
   *  vocabulaire de la branche : `resolveTest` la confie à `reprendreTestSubi`, qui la rejoue sur le
   *  sujet (`actorId`). Du SÉRIALISABLE seul, jamais de référence — un pending traverse JSON (save, coop).
   *  `casterId` = le porteur quand il DIFFÈRE du sujet ; `label` = le libellé de la source (lu par
   *  `nomDeSource`) ; `source` = l'entité porteuse. Jumeaux de `CascadeStepMeta.casterId`/`sourceKind`/
   *  `sourceEntityId` ; `label` et `source` sont deux champs d'`OPS_CTX_GELES` (`engine/ops.ts`).
   *
   *  FRONTIÈRE : `subi` ne transporte que du GELÉ ou ce qui se RÉSOUT PAR ID depuis l'état. Les deux autres
   *  contextes par référence d'`OPS_CTX_PAR_REFERENCE` (`engine/ops.ts`) — `hull`, `crew` — ne
   *  franchissent pas la modale : leur porte est `bandeTriggeredTest`, qui les tient au site. Une
   *  branche qui les exige (op `fall` d'un Critique de coque) lève à la reprise plutôt que de tirer
   *  une hauteur sur une coque absente. */
  subi?: { casterId?: string; label?: string; source?: EffectSource };
  /** Branches du Test : des FLOWS (le nœud `test` du Flow ; `Effect.test` y est normalisé). */
  onSuccess?: Flow;
  onFailure?: Flow;
  /** Continuation : le Flow à reprendre APRÈS la branche (suite du `seq` parent d'un nœud `test`). */
  after?: Flow;
  /** Action de COMBAT « cumuler l'Avantage » (LDB 09 l.305-308 : Intuition/Savoir/Survie/Prière) : sur
   *  RÉUSSITE, octroie +1 Avantage au combattant `combatantId`, plafonné à `cap` (= Bonus de la
   *  Caractéristique — Int pour Intuition/Savoir/Survie, Soc pour Prière). Appliqué par `resolveTest`
   *  (via `gainAdvantage`, qui respecte AUSSI le plafond général d'Avantage). Consomme l'Action, réussi
   *  ou non (« Chaque Round que vous passez à… »). Absent = Test ordinaire. */
  combatAdvantage?: { combatantId: string; cap: number };
  /** Avancée de DIALOGUE différée : quand `chooseDialogue` lance un `choice.flow` qui SUSPEND sur ce
   *  Test, l'avancée (`choice.next` → nœud, ou clôture) est portée ici et appliquée par `resolveTest`
   *  APRÈS la branche + continuation — sinon le nœud suivant coexiste sous la modale de jet. */
  dialogueNext?: DialogueTransition;
  /** Test initié en COMBAT (Cumuler l'Avantage…) : annulable pré-jet (« Annuler » referme la cascade ;
   *  l'Action n'est pas encore dépensée, rien à rembourser). Absent = test de dialogue/scène → NON
   *  annulable (la branche onSuccess/onFailure doit se résoudre). */
  cancellable?: boolean;
}
/** Sauvegarde d'Initiative d'une PANNE DE VAPEUR « Fuite de vapeur » (MDG 12 l.326-328) : la personne
 *  qui s'occupe du moteur teste l'Initiative sous peine d'être ébouillantée. Modale INFLUENÇABLE
 *  (Chance/Résilience) — l'ÉCHEC applique `scaldOps` (déjà roulés : 1d10−5 Dégâts min 1, ignorent
 *  l'Armure) via `steamSaveConfirm`, puis la boucle maritime reprend. */
export interface PendingSteamSave {
  actorId: string;
  actorName: string;
  skillValue: number;
  target: number;
  difficulty: Difficulty;
  /** Dégâts d'ébouillantage à appliquer sur ÉCHEC — `GameOp[]` au montant DÉJÀ roulé (min 1). */
  scaldOps: GameOp[];
  roll: number | null;
  success: boolean;
  sl: number;
  forced?: boolean;
  rerolled?: boolean;
}
/** Rechargement en attente (LDB 62 l.335 : Test étendu de Projectiles, Indice DR).
 *  La modale affiche « Lancer », le DR, puis Chance avant d'acquitter (cumul vers `reload`). */
export interface PendingReload {
  actorId: string;
  actorName: string;
  weaponUid: string; // arme de rechargement (loadout) — résolue en NOM à l'affichage
  reload: number; // Indice DR cible
  progressBefore: number; // DR déjà cumulés (Test étendu)
  skillValue: number; // combatValue(active, 'ranged')
  difficulty: Difficulty; // 'intermediaire' (le canon ne spécifie pas → défaut)
  /** Rempli après « Lancer » ; null tant que le jet n'a pas eu lieu (Chance possible ensuite). */
  roll: number | null;
  target: number; // cible effective après difficulté
  sl: number; // DR du jet
  success: boolean;
  /** Relance par Chance déjà effectuée (1 max/Test, LDB 12 l.40). */
  rerolled?: boolean;
  /** Recharge d'un POSTE de navire (MDG 12) : la pièce visée (`ShipPoste.item.uid`) + sa coque (`shipId`).
   *  Présents → l'application écrit le DR cumulé sur le POSTE (pas le champ `loaded` du marin) et occupe son équipage. */
  posteUid?: string;
  shipId?: string;
  /** Soutien générique (LDB 12) déjà FONDU dans `skillValue` : nb de servants assistants + bonus total (affichage). */
  soutien?: SupportDetail;
}
/** « Se libérer » / « se rouler au sol » en attente (LDB 16 l.66 Empêtré / l.84 En flammes) :
 *  une Action pour retirer l'État via un Test ; succès ⇒ 1 + DR pions retirés. Empêtré = Test OPPOSÉ
 *  de Force contre la source ; En flammes = Test d'Athlétisme simple. Modale Lancer → DR → Chance. */
export interface PendingStateRecovery {
  actorId: string;
  actorName: string;
  /** ÉTAT en cours de récupération — un id de `etats.json` : c'est la DONNÉE de l'État (`recover`)
   *  qui dit s'il se récupère par une Action, jamais une union gravée ici. */
  state: string;
  skillLabel: string; // 'Force' | 'Athlétisme'
  skillValue: number;
  /** Valeur NUE de l'acteur (`LDB 09 l.17`) — grandeur du départage à DR égal (`LDB 12 l.160`). */
  skillBase: number;
  difficulty: Difficulty;
  /** Empêtré opposé à son entrave ; absente : Test simple. */
  opposition?: RecoverOpposition;
  /** Seuil de DR exigé sur un Test NON opposé (Filets, Zoo Impérial p.29 : DR ≥ Indice du filet). */
  requireSl?: number;
  /** Aggravation sur ÉCHEC (Filets, Zoo Impérial p.29 : « gagne un État Empêtré supplémentaire »). */
  entangleOnFail?: boolean;
  /** Dégâts ignorant l'armure à CHAQUE tentative, réussie ou ratée (Filets barbelés, Zoo Impérial p.29). */
  struggleDamage?: number;
  stacks: number; // pions présents (max retirables)
  /** Jet de l'acteur ; null tant que pas lancé (Chance possible ensuite). */
  roll: TestResult | null;
  /** Jet de la source, figé au 1ᵉʳ lancer (les relances Chance ne re-roulent que l'acteur). */
  opponentRoll: TestResult | null;
  netSL: number; // DR net (après opposition le cas échéant)
  success: boolean;
  rerolled?: boolean;
}
/** Marchandage en attente (LDB 59 l.43) : Test OPPOSÉ Marchandage (joueur) vs Marchandage (marchand).
 *  La modale affiche « Lancer » (2 jets), puis le verdict + Chance ; gagner réduit le prix de 10 %
 *  (20 % avec Succès Stupéfiant DR≥6 ou le talent Négociateur). 1 jet verrouillé par visite. */
export interface PendingBargain {
  playerId: string;
  playerName: string;
  merchantName: string;
  merchantValue: number; // valeur Marchandage du marchand (opposant)
  playerSkill: number; // valeur Marchandage du meilleur négociateur du groupe (Soutien FONDU)
  /** SOUTIEN (LDB 12) des conseillers du groupe, déjà fondu dans `playerSkill` — porté pour l'affichage. */
  support?: SupportDetail;
  /** NIVEAU DE COMPÉTENCE NU du négociateur (`LDB 09 l.17`) — la grandeur que `resolveOpposed`
   *  compare à DR égal (`LDB 12 l.160`). Posé à l'accesseur canon (`skillBaseValue`) par le site qui
   *  SAIT quelle Compétence est testée (`merchantFlow.startBargain`), jamais reconstitué à partir de
   *  `playerSkill` : celle-ci porte le Soutien et TOUS les modificateurs de la valeur de Test
   *  (inventaire exhaustif : `skills.testValueParts`). */
  playerBase: number;
  mode: 'buy' | 'sell';
  /** Le négociateur possède-t-il le talent Négociateur (−20 % même sans Succès Stupéfiant) ? */
  negotiator: boolean;
  /** Jet du joueur ; null tant que pas lancé (Chance possible ensuite). */
  roll: TestResult | null;
  /** Jet du marchand, figé au 1ᵉʳ lancer (les relances Chance ne re-roulent que le joueur). */
  merchantRoll: TestResult | null;
  /** Résultat opposé (joueur = attaquant). */
  result: OpposedResult | null;
  /** Relance par Chance déjà effectuée (1 max/Test, LDB 12 l.40). */
  rerolled?: boolean;
}
/** Évaluation en attente (LDB 59 l.41 : « estimer les prix … à ±10 % ») — Test d'Évaluation (Int) ;
 *  un succès RÉVÈLE l'objet (`identified = true`, ses qualités cachées deviennent visibles) et donne
 *  une fourchette de prix. OU Détection d'artefact (`mode:'detect'`, LDB 10 l.336) — Test
 *  d'Intuition au toucher : succès = l'objet est senti MAGIQUE, chaque DR apprend une règle (qualité) ;
 *  une seule tentative par artefact. Même modale (« Lancer », résultat, Chance, acquittement). */
export interface PendingAppraise {
  actorId: string;
  actorName: string;
  /** Objet d'un héros (uid d'inventaire)… */
  itemUid?: string;
  /** …ou ligne de butin ENCORE en fenêtre (loot/victoire) — révélation AVANT attribution. */
  gear?: { scope: 'loot' | 'victory'; index: number };
  itemName: string;
  /** 'evaluate' (défaut) = Évaluation marchande ; 'detect' = Détection d'artefact (Intuition). */
  mode?: 'evaluate' | 'detect';
  /** Libellé de la compétence affiché en modale (« Évaluation » / « Intuition »). */
  skillLabel?: string;
  truePriceBrass: number; // valeur réelle de base (catalogue) en sous de cuivre
  availability: string | null; // Disponibilité (Rare/Exotique → estimation ±10 %)
  skillValue: number;
  /** SOUTIEN (LDB 12) déjà FONDU dans `skillValue` — porté pour l'affichage (ligne de mod nommée). */
  support?: SupportDetail;
  difficulty: Difficulty;
  target: number;
  /** Rempli après « Lancer » ; null tant que le jet n'a pas eu lieu (Chance possible ensuite). */
  roll: number | null;
  success: boolean;
  sl: number;
  /** Relance par Chance déjà effectuée (1 max/Test, LDB 12 l.40). */
  rerolled?: boolean;
}
/** Attaque en attente : la modale affiche « Lancer », puis le résultat + Chance. */
export interface PendingAttack {
  attackerId: string;
  targetId: string;
  location: HitLocation | null;
  /** Arme choisie pour cette attaque (uid d'ItemInstance du loadout actif) ; absent = auto-choix. */
  weaponUid?: string;
  /** Arme RÉELLEMENT tirée, figée AU JET (#1153) — comme `PendingDefense.weapon` fige celle de
   *  l'attaquant. Un uid ne suffit pas : `Combatant.weapons` ne porte que le loadout ACTIF
   *  (`recomputeLoadout`), donc un uid désignant une arme possédée mais non tenue est INTROUVABLE et
   *  l'auto-choix reprend la main (la mêlée gagne dès qu'elle est à portée). Toute influence de la
   *  ligne résolue (Chance, Relance, dé choisi, Résilience) re-dérive AVEC cette arme-là. */
  weapon?: Weapon;
  /** Contexte du jet FIGÉ à la résolution (#1153), pour que toute re-dérivation retrouve la même
   *  opposition : distance de tir (bande de portée) et pénalité d'ESQUIVE du contexte
   *  (`defenseDodgeMod` — neige `LDB 14 l.82`, défenseur monté `l.184`). Un défaut forgé (0, ou une
   *  distance recalculée) ferait dire au résultat une autre Difficulté que le jet d'origine. */
  distanceTiles?: number;
  dodgeMod?: number;
  result: AttackResult | null; // null = pas encore lancé
  /** Relance par Chance déjà effectuée (1 max/Test, LDB 12 l.40). */
  rerolled?: boolean;
  fromCharge?: boolean; // issue d'une Charge → l'attaque est engagée dès le 1ᵉʳ jet (LDB 15 l.35)
  /** Undo PRÉ-JET d'une Charge (jeu vidéo : annuler un misclic comme on annule un déplacement/une attaque) :
   *  état d'AVANT la charge pour restaurer positions/orientation/Mouvement/Avantage/chargedThisTurn si on
   *  Annule AVANT tout jet (`result === null`). Une fois le dé lancé, la charge est engagée (RAW). Capturé à
   *  la déclaration de charge (targetingModes), rejoué par `attackCancel`. */
  chargeUndo?: { pos: Record<string, Pt>; facing: Record<string, Dir8>; movedPreAction: boolean; movementUsed: number; advGained: number; gainedAdvBefore: boolean; chargedBefore: boolean };
  /** Victime réelle si le tir a dévié dans la mêlée vers un allié (LDB 14 l.116) — sinon = targetId. */
  victimId?: string;
  /** Attaque d'enchaînement d'un balayage (Frappe Mortelle) : son acquittement fait avancer le `pendingCleave`. */
  cleave?: boolean;
  /** « Tirer dans le tas » (LDB 14 l.106) : option de tir — bonus selon la taille du groupe, mais
   *  un combattant au contact de la cible (les DEUX camps, tir fratricide possible) est touché au hasard ;
   *  0 DR si le succès est dû au seul bonus. */
  intoCrowd?: boolean;
  /** Tir IMMOBILE (option de tir) : le héros décide de ne pas bouger ce Tour → annule la pénalité −10 « Tir
   *  en bougeant » (LDB 14 l.70) MAIS consomme son Mouvement (cf. attackConfirm). Proposé seulement s'il
   *  n'a pas déjà bougé. */
  heldGround?: boolean;
  /** Mode de tir « corde séparée » (Lance-harpon, ADE II 02 l.677) : le joueur choisit de tirer sans la
   *  corde AVANT le jet — `weaponContextOf` en dérive `WeaponContext.harpoonRopeCut` (Portée 60, perte de
   *  l'Atout Immobilisante, cf. `effectiveWeapon`). Proposé seulement si l'arme tirée porte la capacité
   *  `ItemCapabilities.ropeMode` (arbitrage user « mode de tir choisi », #476). */
  harpoonRopeCut?: boolean;
  /** Réussite FORCÉE via « Je ne faillirai pas ! » (Résilience, LDB 17 l.68) : débloque, sur un Coup
   *  Critique, le choix de la Localisation (cf. `critLocation` du résultat). */
  forced?: boolean;
  /** Dé FIXÉ par le joueur (option « Dés fixés », `PendingBase.fixed`). */
  fixed?: boolean;
  /** Tir rapide (talent, LDB 10) : cette attaque est une INTERRUPTION hors de l'ordre (déclarée à
   *  `pendingRoundStart`, tireur NON-actif). `attackConfirm` applique le tir mais ne fait PAS avancer le
   *  tour ; il épuise le tour NORMAL du tireur (`loseNextAction` + `loseNextMovement`). */
  interrupt?: boolean;
  /** « Retenir ses coups » (Aux Armes 07 l.59-61) : déclaré AVANT le jet — maîtriser sans tuer. En
   *  MÊLÉE seulement, jamais avec une arme *En flammes*. Le moteur (`applyHit`) ignore le drapeau hors
   *  mêlée ; il retire Empaleuse/Percutante/Perforante + l'Atout Taille et supprime le Critique sauf mise à 0. */
  withhold?: boolean;
  /** « Empoignade » (LDB 14 l.159) : déclarée AVANT le lancer pour toucher — sur une touche, « au lieu
   *  d'infliger des Dégâts », pose l'Empoignade (les deux) + l'État *Empêtré* (cible), sans Dégâts. MAINS
   *  NUES seulement (cf. `SuiteDeCoup.grapple`). */
  grapple?: boolean;
  /** La défense SURFACÉE du défenseur a déjà été jouée (fenêtre `pendingDefense` refermée, `defenseConfirm`
   *  rend la main à `attackConfirm` avec le résultat OPPOSÉ) : l'interposition ne se repose pas. */
  defended?: boolean;
  /** Attaque-Action en mode « des deux armes » (main directrice) : chaîne une 2ᵉ frappe si elle touche (LDB 10 l.767-773). */
  dualMode?: boolean;
  /** Cette attaque EST la 2ᵉ frappe (off-hand) d'un Maniement de deux armes : jet imposé, pas de relance. */
  dualSecond?: boolean;
  /** Attaque GRATUITE de MANŒUVRE de mêlée (Morsure/Attaque caudale/Tentacules — trait de créature
   *  qu'un héros active : mutation/polymorphie) : ne consomme pas l'Action ; effets onHit propres à la
   *  manœuvre appliqués à la confirmation (cf. attackConfirm). `tentacules` = limiteur 1/tour (mutation). */
  freeKind?: AttackKind;
  /** PILONNAGE INDIRECT (« viser une case », AA 10 l.169/171) : POINT D'IMPACT choisi au sol. Présent → la
   *  touche DÉTONE sur cette case (Explosion/Tir de zone uniforme sur le rayon, RAW LDB 62 l.254), AUCUNE touche
   *  directe « primaire » ni Critique par victime ; `targetId` n'est que la cible-REPÈRE de la bande de
   *  portée/du DR (l'ennemi le plus proche de l'impact). Absent → tir direct (STRICTEMENT inchangé). */
  center?: Pt;
  /** Marqueur de pilonnage indirect (cf. `center`) — `attackConfirm` résout l'aire au lieu d'une touche directe. */
  siege?: boolean;
}
/** Test de Dextérité (+20) PAR ACTION de « Main ensanglantée » (Aux Armes bras 46-50, l.2569), posé AVANT
 *  l'ouverture d'une Action d'attaque quand l'arme employée est tenue dans une main gatée (`attackHandGate`).
 *  Modale INFLUENÇABLE (Chance/Pacte/Résilience — `FLOWS.handGate`, calque `reload`). Sur RÉUSSITE, l'Action
 *  déclarée s'ouvre (le `pa`/`title`/`icon` FIGÉS — la cascade d'attaque reprend telle quelle) ; sur ÉCHEC,
 *  l'objet glisse (op `disarm`) et l'Action est consommée. Chemin IA = jet inline forcé côté `doAttack`. */
export interface PendingHandGate {
  attackerId: string;
  actorName: string;
  /** Main gatée (loadout actif) — pour le `disarm` sur Échec (convention DROITIER `main`/`off`). */
  hand: 'main' | 'off';
  skillValue: number; // Dextérité BAKÉE (valeur effective de l'attaquant)
  difficulty: Difficulty; // 'accessible' (+20 « Accessible »)
  /** Rempli après « Lancer » ; null tant que le jet n'a pas eu lieu (Chance possible ensuite). */
  roll: number | null;
  target: number; // cible effective après difficulté
  sl: number;
  success: boolean;
  rerolled?: boolean;
  /** Réussite forcée par Résilience (LDB 17 l.68). */
  forced?: boolean;
  /** Dé FIXÉ par le joueur (option « Dés fixés », `PendingBase.fixed`). */
  fixed?: boolean;
  /** Action d'attaque FIGÉE à rouvrir sur RÉUSSITE (le porteur de données `pendingAttack` + le titre/icône
   *  de la cascade des 3 sites de déclaration : flux normal / Tir rapide / Pilonnage). Sérialisable (coop). */
  pa: PendingAttack;
  title: string;
  icon: string;
}
/** Pilonnage INDIRECT EN COURS (« viser une case », AA 10 l.169/171) : une pièce indirecte SERVIE attend le
 *  POINT D'IMPACT au sol — placeur de zone PARTAGÉ (`placingZoneOf` source 'siege', même gabarit que les
 *  sorts de zone). Le clic-case → `siegeAimCommit` ouvre la modale de tir (`pendingAttack` siège). */
export interface PendingSiegeAim {
  gunnerId: string;
  /** uid de l'arme de la pièce servie (canon ÉPINGLÉ) — re-dérivée par `firedWeapon` à la résolution. */
  weaponUid: string;
  /** Rayon de l'aire (Explosion/Tir de zone) en CASES — gabarit du placeur (`blastRadiusTiles`). */
  radius: number;
  /** Portée chiffrée (cases) du placeur depuis le servant — `null` = pas de cap dur (la bande de portée du
   *  Test de tir gère l'éloignement) ; seule la Ligne de Vue au point est requise (`placedZoneValidAt`). */
  rangeTiles: number | null;
}
/** Balayage en attente (Frappe Mortelle d'un HÉROS plus grand, LDB 14 l.9 / 85 l.299) : après une
 *  touche de mêlée, le joueur enchaîne sur d'autres adversaires adjacents (jusqu'à BCC), via le flux
 *  `pendingAttack` standard. `count` = enchaînements déjà résolus ; `hitIds` = cibles déjà frappées ce balayage. */
export interface PendingCleave {
  attackerId: string;
  hitIds: string[];
  count: number;
  /** Mode Frappe Mortelle (option, hors Taille) : la poursuite EXIGE de tuer chaque cible (LDB 14
   *  l.9). Absent/false = balayage de Taille (enchaîne sur une simple touche, LDB 85 l.362). */
  fm?: boolean;
}
/** Sélection de la 2ᵉ cible du Maniement de deux armes (LDB 10 l.767-773), après une 1ʳᵉ frappe RÉUSSIE.
 *  Calqué sur PendingCleave : le joueur clique une cible (ou renonce via `dualStrikeSkip`). `mainRoll` = jet
 *  conservé de la 1ʳᵉ frappe ; `critValue` = valeur du tableau des Critiques si la 1ʳᵉ était un Critique.
 *  Avantage : +1 UNIQUE accordé si les DEUX frappes touchent (l.638) — son existence prouve que la 1ʳᵉ a touché. */
export interface PendingDualStrike {
  attackerId: string;
  offWeaponUid: string;
  mainRoll: number;
  critValue?: number;
}
/** Piétinement en attente (LDB 85 l.387) : modale interactive — Lancer (resolveTrample) →
 *  Chance → Appliquer (dépense 1 Avantage, action gratuite). */
export interface PendingTrample {
  attackerId: string;
  targetId: string;
  result: AttackResult | null; // null = pas encore lancé
  rerolled?: boolean;
  /** Réussite forcée par Résilience (LDB 17 l.68) → le joueur peut CHOISIR la valeur du dé. */
  forced?: boolean;
  /** Dé FIXÉ par le joueur (option « Dés fixés », `PendingBase.fixed`). */
  fixed?: boolean;
}
/** Battement en attente (LDB 10 l.103 / AA 13 l.17) : Action, Test de Corps à corps NON opposé.
 *  Modale MONO calquée sur `PendingTrample` — Lancer (jet de CC figé) → Chance/Pacte/Résilience →
 *  Appliquer (`resolveBattement` retire de l'Avantage adverse). Consomme l'Action. */
export interface PendingBattement {
  attackerId: string;
  foeId: string;
  result: TestResult | null; // jet de Corps à corps de l'attaquant ; null = pas encore lancé
  rerolled?: boolean;
  /** Réussite forcée par Résilience (LDB 17 l.68) → le joueur peut CHOISIR la valeur du dé. */
  forced?: boolean;
}
/** Distraire en attente (LDB 10 l.364 / AA 13 l.51) : Mouvement, Test OPPOSÉ Athlétisme (mover) vs
 *  Calme (foe). Modale OPPOSÉE calquée sur `PendingDisengage`/`PendingAuContact` : le jet de Calme du
 *  foe (`defRoll`) est FIGÉ à l'ouverture ; seul le jet d'Athlétisme du mover (`atk`) se (re)joue.
 *  Sur victoire, `resolveDistraire` pose `distractedRounds`. Consomme le MOUVEMENT (pas l'Action). */
export interface PendingDistraire {
  moverId: string; // héros qui distrait (actif)
  foeId: string; // adversaire distrait
  atk: TestResult | null; // jet d'Athlétisme du mover (mover = « attaquant » du Test opposé) — null = pas lancé
  defRoll: TestResult; // jet de Calme du foe, figé à l'ouverture (jamais relancé)
  result: 'success' | 'failure' | 'tie' | null; // 'success' = le mover l'emporte ; 'tie' = statu quo
  /** Relance par Chance de l'Athlétisme déjà effectuée (1 max/Test, LDB 12 l.40). */
  rerolled?: boolean;
  /** Réussite forcée par Résilience (LDB 17 l.68) → l'emporte simplement (issue binaire). */
  forced?: boolean;
}
/** Manœuvre de créature en attente (Souffle/Vomi/Langue/Regard/Étreinte — LDB 85) qu'un héros active.
 *  La modale n'influence QUE le jet de l'attaquant (`result` : son TestResult CC/CT figé) ; l'apply
 *  (`applyMan<X>`) roule les défenseurs et résout l'opposition dans le feed. `avantageSpent` = Avantage
 *  dépensé (Regard variable : choisi 1..advantage → +N DR). Hurlement n'ouvre PAS de pending (pas de
 *  jet d'attaquant). */
export interface PendingManeuver {
  attackerId: string;
  kind: AttackKind;
  /** Id STABLE de la `ManeuverDef` résolue (`grantsManeuvers`/`pickGranted`) — DISTINGUE les variantes
   *  partageant un `kind` (6 souffles, 2 étreintes) ; `kind` reste pour l'icône/le compteur partagé. */
  maneuverId: string;
  /** Cible DÉSIGNÉE au clic (victime pour Langue/Regard/Étreinte ; point d'impact de la zone pour
   *  Souffle/Vomi — LDB 85 « choisit une cible visible »). Absent côté IA (cible auto la plus proche). */
  targetId?: string;
  /** Avantage dépensé (coût RAW ; Regard : choisi par le joueur, +1 DR/Av — LDB 85 l.290). */
  avantageSpent: number;
  result: TestResult | null; // null = pas encore lancé
  rerolled?: boolean;
  /** Réussite forcée par Résilience (LDB 17 l.68). */
  forced?: boolean;
}
/** Course en attente (LDB 15 l.41) : Test d'Athlétisme (+20) ; succès → déplacement
 *  étendu (Marche + Course + DR). Lancer → Chance/Résilience → Appliquer (ouvre le déplacement étendu). */
export interface PendingRun {
  combatantId: string;
  /** Destination demandée (clic dans la zone de Course) : à l'application, on avance le long du chemin
   *  jusqu'au dernier point que le budget du jet (Marche + Course + DR) permet. */
  dest?: Pt;
  path?: Pt[];
  cost?: number;
  /** `target` absent sur un résultat synthétique (Résilience pré-jet) — la RollLine retombe sur la base. */
  result: { success: boolean; roll: number; target?: number; dr: number; bonusCases: number } | null;
  rerolled?: boolean;
}
/** Chute VOLONTAIRE en attente (LDB 15 l.82) : posée par `fallAcross` (case de départ en bordure d'une
 *  falaise, `state/fallMove.planFall`) vers `to` (case d'arrivée, au pied), hauteur RÉELLE `metres`
 *  (relief). `attempt` = choix RAW (« vous pouvez TENTER un Test d'Athlétisme ») : `null` = pas encore
 *  choisi (deux boutons pré-jet), `false` = saut direct → chute PLEINE (résolue IMMÉDIATEMENT par
 *  `fallChoose`, jamais de `result`), `true` = Test d'Athlétisme Accessible (+20) ouvert (Lancer →
 *  Chance/Pacte/Résilience → Appliquer, patron `pendingRun`). */
export interface PendingFall {
  combatantId: string;
  to: Pt;
  metres: number;
  attempt: boolean | null;
  /** PHASE de la fenêtre — champ d'ÉTAT, jamais une constante de rendu (#1117) : la modale ne déduit
   *  plus sa phase d'un `attempt === null` lu au site UI. `'choice'` = le menu Sauter / Tenter ;
   *  `'roll'` = le Test d'Athlétisme ouvert. C'est la moitié « phase » de l'id de jet `{flow, phase}`. */
  phase: 'choice' | 'roll';
  /** `target` absent sur un résultat synthétique (Résilience pré-jet) — la RollLine retombe sur la base. */
  result: { success: boolean; roll: number; target?: number; dr: number; effectiveMetres: number } | null;
  rerolled?: boolean;
}
/** Un contributeur au Test d'équipage de MANŒUVRE (MDG 14) : un marin à un rôle, son jet propre. PJ →
 *  interactif (Chance/Résilience sur SON jet) ; marin PNJ → témoin (`interactive:false`, auto-roulé à l'ouverture). */
export interface ShipManeuverParticipant extends RollParticipant {
  /** Rôle tenu (crew-roles.json) — sa meilleure compétence décide la valeur du jet. */
  roleId: string;
  /** Rôle ESSENTIEL du Test (son DR compte double, MDG 14 l.19). */
  essential: boolean;
  /** Marin déjà engagé dans un AUTRE Test d'équipage ce Round → cumul à +2 crans de Difficulté (Manque de bras, l.53). */
  cumul?: boolean;
  /** Sens NARRATIVEMENT sollicité par CE Test précis (ex. Vigie du phare, MDG 13 l.337 — visuel), posé
   *  À LA CONSTRUCTION de l'étape par l'appelant qui connaît le contexte (`buildVoyageCrewStep`, kind
   *  `'phare'`, `seaVoyageFlow.ts`). Restreint les `skillMod` sense-scopés (Surdité, LDB 18) via
   *  `crewRoleValue`/`testValue`. Absent pour les Tests d'équipage sans sens narratif dédié
   *  (manœuvre, bordée…) = comportement historique. */
  sense?: PairedSense;
  result: CrewRoleRoll | null;
}
/** Contributeur ARTILLEUR d'un Tir de batterie (MDG 14) — MÊME forme qu'un rôle de manœuvre (un rôle,
 *  son DR) : alias du contributeur de Test d'équipage (une seule structure pour les 3 flux jumeaux). */
export type ShipBatteryParticipant = ShipManeuverParticipant;
/** TIR DE BATTERIE en Test d'équipage (MDG 14 l.128) : les Artilleurs lancent, DR sommés (essentiel ×2) + Moral →
 *  un **DR PARTAGÉ** qui remplace le jet de touche de chaque pièce du bord `side` qui porte sur `targetId`. */
export interface PendingShipBattery extends MultiPending<ShipBatteryParticipant> {
  shipId: string;
  targetId: string;
  /** Bord qui porte (dérivé de la cible via `targetArc`) — détermine les pièces qui tirent. */
  side: FireArc;
  essentialRoleId?: string;
  moraleScore: number;
  /** Manque de bras global (MDG 14 l.55) : −2 DR/tranche de 10 % manquant + plafond Succès Minime. */
  undercrew?: { dr: number; capSuccesMinime: boolean };
  /** Sabotage (MDG 14 l.45-47) : −1..−5 DR plats au total du Test d'équipage (`shipSaboteurDR`). */
  extraDR?: number;
}
/** Manœuvre navale en TEST D'ÉQUIPAGE (MDG 13-14) : chaque rôle tenu lance son Test, les DR sont sommés (rôle
 *  essentiel ×2) + la bande de Moral ; le total tient lieu de DR de Navigation. La direction (`turnSteps`, choisie
 *  au pré-jet OptionChooser) s'applique à la confirmation (`shipManeuverConfirm`). */
export interface PendingShipManeuver extends MultiPending<ShipManeuverParticipant> {
  shipId: string;
  /** Virage choisi : >0 tribord, <0 bâbord, 0 tout droit (crans d'octant — ±1 = 45°, ±2 = 90°). */
  turnSteps: number;
  /** id du rôle essentiel (DR ×2) — lu du type de Test 'manoeuvre'. */
  essentialRoleId?: string;
  /** Moral du navire → bande ±DR au total (MDG 14). */
  moraleScore: number;
  /** Manque de bras global (MDG 14 l.55) : −2 DR/tranche de 10 % manquant + plafond Succès Minime. */
  undercrew?: { dr: number; capSuccesMinime: boolean };
  /** Sabotage (MDG 14 l.45-47) : −1..−5 DR plats au total du Test d'équipage (`shipSaboteurDR`). */
  extraDR?: number;
}
/** TEST D'ÉQUIPAGE GÉNÉRIQUE en COMBAT (MDG 14, « Types de Test d'équipage ») — 3ᵉ jumeau de la
 *  manœuvre/bordée : chaque rôle tenu lance SON Test (multi-jets), DR sommés (essentiel ×2) + Moral +
 *  Manque de bras + sabotage. L'ISSUE dépend du type (`crewTestConfirm`) : **Rude épreuve** (l.106-114)
 *  → un total NÉGATIF réduit le Moral d'autant (l.110), PERSISTÉ sur `CampaignVessel.morale`. Les Tests
 *  d'équipage de VOYAGE (Progression, Poursuite, Perception, Orientation…) sont des ÉTAPES
 *  `CascadeStep` À PARTICIPANTS de la cascade du jour (#275 Ronde 2, `seaVoyageFlow.ts`) — CE
 *  pending sert UNIQUEMENT au combat (Rude épreuve, arme d'équipe). */
export interface PendingCrewTest extends MultiPending<ShipManeuverParticipant> {
  shipId: string;
  /** Type de Test d'équipage (`crew-test-types.json`) — décide des rôles, du rôle essentiel et de l'issue. */
  testTypeId: string;
  essentialRoleId?: string;
  moraleScore: number;
  undercrew?: { dr: number; capSuccesMinime: boolean };
  extraDR?: number;
}
/** CHANSON DE MARIN en attente (Talent, MDG 09 l.32-40) : le chanteur choisit sa chanson CONNUE (pré-jet,
 *  OptionChooser — specs du Talent) puis lance son Test de **Divertissement (Chant)** ; sur un succès,
 *  l'effet (`crewOps`/`captainOps` de `sea-shanties.json`) est posé sur TOUT l'équipage pour
 *  « trois minutes plus un nombre de minutes égal au DR » (l.38). Une chanson par QUART (l.40). */
export interface PendingShanty {
  shipId: string;
  singerId: string;
  /** Chanson choisie (id `sea-shanties.json`) — null tant que le chanteur n'a pas choisi (pré-jet). */
  shantyId: string | null;
  result: { roll: number; target: number; success: boolean; sl: number } | null;
  rerolled?: boolean;
  forced?: boolean;
}
/** Approche d'une source de PEUR (LDB 21 l.27 : « incapable de vous rapprocher … à moins de réussir un
 *  Test de Calme Intermédiaire (+0) ») : le clic d'approche est DIFFÉRÉ derrière ce Test sec. Succès →
 *  l'intention est relancée (approches libres ce Tour) ; échec → aucune approche ce Tour (battle.fearGate). */
export interface PendingApproach {
  combatantId: string;
  /** Source de Peur la plus proche dont le déplacement RAPPROCHE. */
  sourceId: string;
  /** Son nom, FIGÉ au geste qui ouvre le Test. */
  sourceName: string;
  /** Intention différée, relancée après un succès — avec le VERDICT D'ARMEMENT du geste d'origine
   *  (`courseArmee`/`approche`, spec HUD § ARBITRAGE 2026-08-19). Il est CAPTURÉ ici parce que le clic
   *  qui a ouvert ce gate a déjà dissous l'intention : le relire au store à la relance refuserait le
   *  geste que le joueur vient de gagner (« armez la Charge » après un Test de Calme réussi). */
  intent: { kind: 'tile'; pt: Pt; courseArmee?: boolean } | { kind: 'entity'; id: string; approche?: boolean };
  result: { success: boolean; roll: number; target?: number; sl: number } | null;
  rerolled?: boolean;
}
/** Bénédiction de Protection (LDB 41 l.142 : « Les ennemis doivent effectuer un Test de Force Mentale
 *  Accessible (+20) pour attaquer votre cible […]. Sur un échec, ils doivent choisir une cible ou une
 *  Action différente. ») : la DÉCLARATION d'attaque d'un héros sur une cible bénie est DIFFÉRÉE derrière
 *  ce Test de FM. Succès → l'attaque est relancée (`battleClickEntity(targetId, {confirm, wardCleared})`) ;
 *  échec → l'attaque n'a pas lieu (rien n'est consommé). Modelé sur `PendingApproach` (gate pré-attaque). */
export interface PendingWard {
  attackerId: string;
  /** Cible bénie (porte le drapeau `attackWardFM`). */
  targetId: string;
  /** Son nom, FIGÉ au geste qui ouvre le Test. */
  targetName: string;
  /** VERDICT D'ARMEMENT capturé au clic qui a ouvert ce gate (même raison que `PendingApproach`). */
  approche?: boolean;
  result: { success: boolean; roll: number; target?: number; sl: number } | null;
  rerolled?: boolean;
}
/** Focalisation en attente (LDB — Test étendu) : Lancer (resolveFocus) → Chance → Appliquer (cumule le DR). */
export interface PendingFocus {
  casterId: string;
  spellId: string;
  result: FocusResult | null;
  rerolled?: boolean;
}
/** Dissipation permanente en attente (LDB 46 l.158-160 : Test étendu de Langue (Magick) → NI). Un Round =
 *  un jet (Lancer → Chance → Appliquer) ; le DR cumule sur `caster.dispel` jusqu'au NI. Le Soutien « même
 *  Domaine » (l.162) est déjà fondu dans `value`. Calque `PendingFocus`. */
export interface PendingDispel {
  casterId: string;
  /** Sort DURABLE visé (id + son lanceur), pour retirer ses effets à la réussite (`dissipateSpell`). */
  spellId: string;
  spellCasterId: string;
  label: string;
  ni: number; // NI du sort = DR cumulé cible
  value: number; // valeur de Langue (Magick) du lanceur, Soutien « même Domaine » inclus
  support?: SupportDetail; // détail du Soutien (affichage)
  result: { roll: number; target: number; sl: number; success: boolean } | null;
  rerolled?: boolean;
}
// Psychologie de COMBAT (Peur/Terreur/Traits ciblés, LDB 21) : CASCADE de Round — étapes
//  `kind:'combatPsych'` (cf. CascadeStep.combatPsych) ; Traits/Terreur au DÉBUT de Round, Peur
//  (Test étendu) à la FIN.
/** Entrée en Frénésie en attente (LDB 21 l.31) : Test de FM. Lancer → Chance → Appliquer (entre si succès). */
export interface PendingFrenzy {
  combatantId: string;
  /** `target`/`sl` absents sur un résultat synthétique (Résilience pré-jet) — la RollLine retombe sur la base. */
  result: { success: boolean; roll: number; target?: number; sl?: number } | null;
  rerolled?: boolean;
}
/** CHARGE d'une étape d'AFFICHAGE de cascade (`CascadeStep.reveal`) : un jet SUBI / sur table /
 *  d'entretien dont le résultat (graine fixe) est montré au joueur après coup — il MONTRE le dé puis
 *  acquitte (pas de Chance). Le `kind` route le RENDU (`ui/RevealBody.tsx`) ; la fenêtre se ferme au
 *  clic, sauf cadence DÉCLARÉE par le site (`CascadeStep.autoCloseMs`, arbitrage #1270). */
export interface RevealEntry {
  kind: 'miscast' | 'critical' | 'round' | 'mutation' | 'effet' | 'sceneEntry';
  title: string;
  dice?: number; // d100/d10 à afficher (le jet), si pertinent
  lines: string[]; // détail (résultat, effets)
  /** Gravité de ce qui est révélé : 'minor' = informative (entretien, interruptions…), 'grave' =
   *  critique/mutation sur un héros. Elle QUALIFIE la révélation (rendu, cadence choisie quand un site
   *  déclare une auto-fermeture) ; elle n'en arme aucune d'elle-même (#1270). */
  severity?: 'minor' | 'grave';
  /** Combattant CONCERNÉ par la révélation (victime du critique, lanceur de la Colère…) → portrait
   *  + nom dans la modale (« on sait toujours à qui ça s'applique »). Absent pour les entretiens de Round. */
  subjectId?: string;
  /** Auteur du coup (Coup Critique « infligé PAR ») → portrait + nom dans la modale (qui → arme → cible). */
  actorId?: string;
  /** Arme employée (Coup Critique). */
  weapon?: string;
  /** Effets détaillés (table des Critiques) AVEC leur explication RAW — pour qu'on sache « à quoi ça
   *  correspond » (plus de simple texte gris). */
  details?: { text: string; note?: string }[];
  /** Données du Coup Critique pour une modale COMPLÈTE : localisation (FR), Blessures infligées (ignore
   *  Endurance + Armure), États appliqués. */
  crit?: { location: string; woundsLost: number; conditions?: { id: string; value: number }[] };
}
/** Exposition à une Influence corruptrice (LDB 19 l.23-75) : Test de Résistance (Influence
 *  physique) ou de Calme (spirituelle), Intermédiaire (+0) ; Points de Corruption selon le
 *  niveau et le DR (mineure 0/1 · modérée 0/1/2 · majeure 0/1/2/3). Lancer → Chance
 *  (+1 DR utile : les seuils de DR réduisent le gain) → Appliquer (gainCorruption). */
export interface PendingCorruption {
  heroId: string;
  /** 'exposition' (défaut — LDB 19 l.23-75 : Test pour ne pas GAGNER de Points) ou
   *  'seuil' (l.80 : Test de Résistance au franchissement — échec → « Je te renie ! »/mutation). */
  kind?: 'exposition' | 'seuil';
  /** Niveau d'exposition — EXPOSITION seulement (absent au seuil). */
  level?: import('../engine/corruption').ExposureLevel;
  skill: 'resistance' | 'calme'; // skillId stable (libellé dérivé par refLabel à l'affichage)
  /** Compétence déterminée en amont (source ou seuil) → pas de choix joueur. Absent/false = nature
   *  indéterminée (LDB 19 l.29) → la modale propose Résistance/Calme (cf. `corruptionSetSkill`). */
  skillLocked?: boolean;
  /** Alignement de la SOURCE (Puissance du Chaos) posé par l'éditeur de niveau → table EDOC à tirer
   *  si une mutation survient (sinon la règle globale décide). Voyage exposition → seuil → mutation. */
  align?: import('../engine/corruption').ChaosAlign;
  roll?: number;
  target?: number;
  sl?: number;
  success?: boolean;
  rerolled?: boolean;
  /** Menace du talent « Résistance (Menace) » (LDB 10) couverte par CE Test : `corruption` (exposition,
   *  l.23-75 — résister au GAIN de Points) ou `mutation` (seuil, l.80 — l'échec fait MUTER). Posé à
   *  l'ouverture ; offre l'auto-succès via `corruptionResist`. */
  menace?: string;
}
/** Contexte d'un Critique (qui l'inflige + l'arme/sort en libellé) — modale enrichie + B. de Sauvagerie.
 *  Forme identique au `ctx` d'`applyCriticalToTarget` : source UNIQUE du type. */
export interface DeviationCtx {
  attackerId?: string;
  attackerKind?: Combatant['kind'];
  weapon?: string;
  /** Arme RÉELLE de l'attaquant (≠ `weapon`, son libellé d'affichage) — permet au bus d'émettre `onCrit`
   *  d'un Critique OPPOSÉ / dévié avec les Atouts d'arme du porteur (Taillade → Hémorragique, #316). */
  weaponObj?: Weapon;
  critTwice?: boolean;
}

/** Déviation Critique en attente (LDB 63 l.30) : une victime a subi une Blessure Critique — Coup
 *  Critique sur double OU dépassement — à une localisation où elle porte de la PA ; elle choisit
 *  Dévier (sacrifie 1 PA, ignore le Critique, subit les Blessures recalculées PA−1) ou Subir.
 *  Union discriminée par `mode` :
 *  - `melee` : `res`/`weapon` figés → le résolveur REJOUE `applyAttackResult` avec la décision (son
 *    « tail » décision-indépendant — riposte/triggers/ammo… — tourne ainsi une seule fois).
 *  - `self` : auto-contenu (opposé/tir/magie n'ont pas de tail) → le résolveur applique directement
 *    déflexion vs Critique pré-tiré, sans rejouer aucune attaque.
 *  Le Critique PRÉ-TIRÉ (`crit`, graine figée) est affiché sur la modale ET appliqué tel quel sur Subir. */
export type PendingDeviation =
  | {
      mode: 'melee';
      attackerId: string;
      targetId: string; // victime du Critique (cible réelle, y compris un tir dévié)
      weapon: Weapon;
      res: AttackResult;
      crit: CriticalResolved;
      reveal: RevealEntry;
      resumeAfter: boolean;
      /** Ce que l'appelant fera APRÈS le coup (#1508) : la DÉVIATION est une fenêtre DE PLUS sur le même
       *  coup, et cette donnée porte jusqu'à la reprise d'après-déviation la chaîne de balayage en cours
       *  et l'Action d'une frappe gratuite. */
      suite?: SuiteDeCoup;
    }
  | {
      mode: 'self';
      attackerId: string;
      targetId: string;
      location: HitLocation; // loc du Critique : re-tirée pour un double, loc de touche pour un dépassement
      crit: CriticalResolved;
      isCoupCritique: boolean; // double (true) vs dépassement (false) → applique le bon Critique au Subir
      overkill: number; // dépassement (−20 à la table si > BE, LDB 18 l.30)
      deflectExtraWounds: number; // Blessures ajoutées au Dévier (recalcul PA−1 ; 0 pour un critique « sec »)
      woundsBefore: number; // PB avant CE coup → restauration Destin correcte au Subir
      reveal: RevealEntry;
      resumeAfter: boolean;
      ctx: DeviationCtx;
      /** LA TOUCHE de Projectile magique que cette fenêtre suspend (#1508) — présente pour le seul
       *  chemin du Projectile. Ce que l'appelant fera APRÈS la touche (son `rebond`) voyage ainsi
       *  jusqu'à la reprise : c'est la DERNIÈRE fenêtre fermée qui le joue, sur des PB frais. */
      touche?: ToucheDeProjectile;
    };

/** FENÊTRE de POSE du d100 de SÉVÉRITÉ d'une Blessure Critique (#942 L4) : le dé de la table de
 *  Blessures est resté à poser (option « Dés fixés » + siège qui contrôle la victime), donc la
 *  résolution de l'attaque est SUSPENDUE. La charge est sérialisable (coop) et rejoue le MÊME chemin
 *  que la déviation : l'applier re-entre dans `applyAttackResult` avec le Critique construit sur le dé
 *  posé (`prerolledCrit`) — aucune mécanique parallèle. */
export interface PendingCritSeverity {
  attackerId: string;
  targetId: string;
  weapon: Weapon;
  res: AttackResult;
  location: HitLocation; // loc du Critique : re-tirée pour un double, loc de touche pour un dépassement
  overkill: number; // dépassement (−20 à la table si > BE, LDB 18 l.17) — porté en `mod` par la déclaration
  twice?: boolean; // LDB 41 l.170 — pose `keepHighest: 2` sur la déclaration et garde la bifurcation AA
  suite?: SuiteDeCoup; // ce que l'appelant fera APRÈS le coup (#1508) : le PLI post-dé la reconduit dans la `PendingDeviation` qu'il forme
}
/**
 * LE REBOND d'un Projectile « Attaques en chaîne » (op `chain`, `LDB 47 l.340`) en DONNÉE (#1508) : ce
 * que l'appelant fera APRÈS la touche, porté PAR la touche. Une fenêtre ouverte sur la cible (sauvegarde
 * `LDB 85 l.98`, Déviation Critique `LDB 63 l.30`) l'emporte dans sa charge, et c'est la reprise qui le
 * JOUE — sur les PB que cette fenêtre vient de fixer, jamais sur ceux d'avant elle.
 *
 * `res` est le jet ORIGINAL du lancement : chaque maillon RÉ-ÉVALUE ses Dégâts depuis lui
 * (`evaluateMissile`), jamais depuis le résultat déjà atténué de la cible précédente (Résistance à la
 * Magie, re-localisation d'un Critique). `prev` n'est pas un champ : c'est le `targetId` de la touche
 * qui porte ce rebond. `hopTiles`/`initialRange` sont en CASES (résolues à l'ouverture). Tout est
 * JSON-sérialisable : le rebond voyage sur l'étape.
 */
export interface RebondDeChaine {
  /** Cibles déjà touchées par ce lancement — « il rebondit sur une AUTRE cible ». */
  hitIds: string[];
  /** Rebonds DÉJÀ joués (0 pour la touche initiale). */
  bounce: number;
  maxBounces: number;
  hopTiles: number;
  initialRange: number | null;
  res: CastResult & Partial<MissileResult>;
}

/**
 * LA TOUCHE d'un Projectile magique, en DONNÉE (#1508) — tout ce que l'application d'une touche de sort
 * lit APRÈS la sauvegarde. Calquée sur `PendingCritSeverity` ci-dessus : le sort y voyage entier (comme
 * l'arme y voyage), parce qu'un lancement peut porter un sort qui n'est dans aucun dataset (Souffle de
 * créature, sort monté par un test). `zoneTalentMod` est le modificateur de DR du TALENT Résistance à la
 * Magie de la ZONE du lancement (`LDB 10 l.1026`), figé à l'ouverture : sans lui, la reprise devrait
 * rebâtir cette zone, qui n'est pas une donnée de la cible. Le DR subi (`spellSLFor`) s'en dérive.
 */
export interface ToucheDeProjectile {
  casterId: string;
  targetId: string;
  spell: SpellData;
  mres: CastResult & Partial<MissileResult>;
  /** Modificateur de DR du TALENT de la zone du lancement. Une cible touchée HORS de cette zone
   *  (rebond d'« Attaques en chaîne ») est SA propre zone : elle porte alors son propre Talent. */
  zoneTalentMod: number;
  /** Le REBOND qui suit CETTE touche (#1508) — absent si le Sort n'enchaîne pas. */
  rebond?: RebondDeChaine;
  /** Blessure Critique choisie par le lanceur (LDB 46 l.30) — `crit && choice === 'critique'`, tranché à l'ouverture. */
  critWound: boolean;
  overcastDamageSteps: number;
  overcastDurationSteps: number;
  chosenTableRolls?: number;
  conjureForm?: ConjureForm;
  /** IDENTITÉ du Sort source pour la dissipation (LDB 46 l.158-160), composée à l'ouverture du
   *  lancement (`applyCast`) : donnée pure, elle voyage telle quelle plutôt que d'être recomposée à la
   *  reprise — une 2ᵉ composition serait une 2ᵉ vérité. */
  sourceSpell?: OpsCtx['sourceSpell'];
}

/**
 * L'ENCHAÎNEMENT qui suit un coup appliqué (#1508) — une DÉCLARATION du site d'origine, jamais un
 * défaut muet : chaque site dit LEQUEL des balayages il a tranché, y compris « aucun ». Qui pose quoi :
 *  - `hero` : Frappe Mortelle du héros interactif (LDB 14 l.9), posée par `attackConfirm` SEUL, et
 *    seulement quand ce site l'aurait appelée (ni Maniement de deux armes, ni manœuvre gratuite, ni
 *    Maladresse de l'attaquant). `wasChain` = ce coup était-il déjà un maillon d'un balayage en cours.
 *    Jugée sur la touche RÉELLE : l'enchaînement EXIGE une cible TUÉE, donc il se décide APRÈS le dé
 *    de sauvegarde, qui décide de la mort ;
 *  - `chaine` : maillon de balayage encore à jouer (`ChaineDeBalayage`), posé par `runCleaveChain` — y
 *    compris quand une fenêtre de défense s'interpose, qui le porte dans SA suite ;
 *  - `auto` : balayage de la MACHINE (LDB 85 l.362 : « Toutes les frappes réussies activent la règle
 *    optionnelle Frappe Mortelle »), gardé par `aiDriven` dans `autoCleave` ;
 *  - `aucun` : le site d'origine a tranché qu'AUCUN balayage ne suit ce coup — Maladresse de
 *    l'attaquant, frappe du Maniement de deux armes, manœuvre gratuite d'un héros.
 */
export type EnchainementDuCoup =
  | { mode: 'hero'; wasChain: boolean }
  | ({ mode: 'chaine' } & ChaineDeBalayage)
  | { mode: 'auto' }
  | { mode: 'aucun' };

/** État d'une chaîne de BALAYAGE en cours (Frappe Mortelle/Taille, LDB 14 l.9 / 85 l.299) : cibles
 *  déjà frappées, enchaînements consommés, borne BCC, mode (Taille vs Frappe Mortelle). */
export interface ChaineDeBalayage { hitIds: string[]; n: number; bcc: number; fm: boolean }

/**
 * CE QUE L'APPELANT FERA APRÈS LE COUP (#1508) — une DONNÉE, pas un geste d'après-coup. Elle entre PAR
 * LE HAUT (paramètre d'`applyAttackResult`) et voyage dans TOUTE charge de suspension (sauvegarde
 * `SauvegardeSuite`, Déviation `PendingDeviation`/`PendingCritSeverity`), si bien qu'une fenêtre de plus
 * ne la perd pas : la dernière reprise la joue UNE fois. La fenêtre qui s'ouvre n'a jamais à deviner
 * laquelle vient de s'ouvrir — elle reçoit la suite dans sa propre charge.
 *
 * Les champs sont ceux que la reprise lit déjà : deux DRAPEAUX DU COUP (l'Avantage différé du
 * Maniement de deux armes LDB 10 l.767-773, l'Empoignade LDB 14 l.159 — un coup repris sans eux ne
 * serait plus le même coup), l'attaque GRATUITE dont les effets attendent la touche et dont l'Action
 * doit être rendue (même donnée `{kind, prevActed}` que la fenêtre de défense), l'ouverture de la 2ᵉ
 * frappe du HÉROS, et l'ENCHAÎNEMENT (ci-dessous). Tous JSON-sérialisables : la suite voyage sur l'étape.
 */
export interface SuiteDeCoup {
  deferAttackerAdvantage?: boolean;
  grapple?: boolean;
  freeAttack?: { kind: string; prevActed: boolean };
  /** L'enchaînement d'après CE coup — DÉCLARÉ par le site d'origine, jamais déduit à la reprise. */
  enchainement?: EnchainementDuCoup;
  /** Ouverture de la 2ᵉ frappe du Maniement de deux armes (LDB 10 l.767-773) : posée seulement pour la
   *  main directrice d'un héros dont l'off-hand existe. `mainRoll` = le jet de la main directrice, que la
   *  2ᵉ frappe reprend. La valeur de Critique, elle, se lit sur l'ÉTAPE de Critique que l'application
   *  appende — elle n'existe donc qu'APRÈS le coup, jamais à l'ouverture. */
  dualMain?: { offWeaponUid: string; mainRoll: number };
}

/**
 * CE QUI SUIT LA FERMETURE D'UNE FENÊTRE DE DÉFENSE (#1858) — union par SITE DE REPRISE, patron
 * `SuiteDeCoup`/#1508 : posée par celui qui OUVRE la fenêtre, dans le littéral même du pending, lue par
 * le SEUL `defenseConfirm`. Deux reprises, donc deux variantes :
 *  - `pilotee` : l'attaque FIGÉE d'un siège humain (MJ ou héros) est rendue à `attackConfirm` avec le
 *    résultat OPPOSÉ — le chemin d'application de l'attaque (balayage, gratuites onHit, Maladresse, tir
 *    immobile…) reste UNIQUE ; le forçage de l'attaquant (LDB 17 l.68) voyage sur cette attaque ;
 *  - `machine` : le coup est appliqué ICI, et sa `SuiteDeCoup` est celle que le producteur aurait passée
 *    à `applyAttackResult` sur son chemin instantané — coup nu `{}`, maillon de balayage, ou gratuite.
 * JSON-sérialisable : elle voyage dans le snapshot coop avec le reste du pending.
 */
export type SuiteDeDefense =
  | { mode: 'pilotee'; pa: PendingAttack }
  | { mode: 'machine'; coup: SuiteDeCoup };

/** LA SUITE d'un coup dont la sauvegarde reste à jouer — union par SITE DE REPRISE, patron
 *  `PendingDeviation.mode` (`'melee'` ré-entre dans l'applier d'attaque, l'autre est auto-contenu).
 *  JSON-sérialisable : elle voyage sur l'étape. */
export type SauvegardeSuite =
  | {
    mode: 'melee';
    attackerId: string;
    targetId: string;
    weapon: Weapon;
    res: AttackResult;
    /** La valeur de `deviated` du coup suspendu : elle dit d'où vient la reprise (attaque standard,
     *  enchaînement, attaque gratuite) — elle ne se devine pas à la ré-entrée. */
    deviated?: boolean;
    /** Ce que l'appelant fera APRÈS le coup — entrée par le haut, jamais parquée après coup. */
    suite?: SuiteDeCoup;
  }
  | { mode: 'projectile'; touche: ToucheDeProjectile };

/** CHARGE d'une étape de SAUVEGARDE « 1d10 ≥ Indice » (#1508) : les seuils RESTANT à jouer (grappe
 *  dépendante — le N+1 ne s'ouvre que si le N a raté, `hitModifiers.seuilsDeSauvegarde`), le premier
 *  étant celui de CETTE étape, et la suite du coup, suspendue avant toute mutation de la cible. */
export interface PendingWardSave {
  seuils: SeuilDeSauvegarde[];
  suite: SauvegardeSuite;
}

/** Contexte SÉRIALISABLE des tirages CHAÎNÉS d'une mutation de Corruption (#942 L5, LDB 19 l.73-83) :
 *  nature (corps ou esprit) → Tableau de Corruption → sous-table éventuelle (« Tête bestiale », EDOC 12).
 *  `tableId` = la table de CETTE étape (absent sur l'étape de nature) ; `kind`/`natureRoll` = l'issue de
 *  l'étape de nature, reportée aux étapes suivantes (journal + Limites de Corruption). */
export interface PendingMutationStep {
  heroId: string;
  align?: import('../engine/corruption').ChaosAlign;
  tableId?: string;
  kind?: 'physique' | 'mentale';
  natureRoll?: number;
}
/** Contexte SÉRIALISABLE d'un tirage d'Incantation Imparfaite / Colère des dieux resté À POSER
 *  (#942 L6, LDB 46 / LDB 40) : la sévérité DÉCIDE la table (`miscastTableId`). AUCUN compteur n'y est
 *  recopié — le +10 par Point de Péché est déclaré en modificateur VIVANT sur la table
 *  (`CascadeTableDecl.modPerActor`, lu à l'instant du jet) et l'expiation de l.53 décrémente la valeur
 *  VIVANTE au dénouement. `rerollHigh` marque les étapes NÉES d'une relance bornée (« Multiplication
 *  d'infortune : […] en relançant tous les résultats entre 91-00 », LDB 46 l.54) : chez elles, un
 *  91-00 se relance sur la même table. */
export interface PendingMiscastStep {
  casterId: string;
  severity: import('../engine/miscast').MiscastSeverity;
  domainId?: string;
  sorceryCorruption?: boolean;
  suppressReveal?: boolean;
  rerollHigh?: boolean;
}
/** « Je te renie ! » (LDB 17 l.67) : le héros a échoué au Test de Résistance du seuil de Corruption —
 *  il choisit entre SUBIR la mutation et la REFUSER (1 Point de Résilience ; il ne perd alors aucun
 *  Point de Corruption). */
export interface PendingRenounce {
  heroId: string;
  /** Jet du Test de Résistance raté (affichage). */
  testRoll: number;
  testTarget: number;
  /** Alignement de la source (cf. PendingCorruption.align) — table EDOC si la mutation est subie. */
  align?: import('../engine/corruption').ChaosAlign;
}
/** Piège-lame (LDB 62 l.278-280) : le HÉROS défenseur a obtenu un Critique en parant avec une arme
 *  Piège-lame face à une arme à lame — il choisit entre le Coup Critique normal (LDB 14 l.3) et
 *  PIÉGER la lame (Test opposé de Force + DR de la défense ; victoire → désarme, Stupéfiant → brise
 *  sauf Incassable, échec → l'adversaire se libère). */
export interface PendingBladeTrap {
  defenderId: string; // le héros piégeur
  attackerId: string; // l'adversaire dont la lame est visée
  weapon: Weapon; // la lame de l'attaquant
  parryWeaponUid: string; // l'arme Piège-lame du défenseur — résolue en NOM à l'affichage
  /** DR du Test de Corps à corps (défense) — ajouté au Test opposé de Force (l.293). */
  defSL: number;
  /** d100 du jet de défense critique (localisation du Coup Critique si refusé). */
  roll: number;
}
/** Défense réactive : un ennemi (IA) a figé son jet d'attaque (`atk`) contre un héros ;
 *  le joueur choisit le mode, lance SA défense (`def`), peut la relancer (Chance = défense
 *  uniquement), puis applique. `atk` est figé et n'est JAMAIS relancé. Le tour de l'IA est
 *  suspendu tant que `pendingDefense` est non-null. */
export interface PendingDefense {
  attackerId: string; // ennemi
  defenderId: string; // héros
  weapon: Weapon; // arme active de l'attaquant, figée
  location: HitLocation | null; // visée par l'IA (absente tant qu'aucune localisation choisie → null)
  atk: TestResult; // jet d'attaque figé (rollMeleeAttacker)
  mode: DefenseMode; // réaction choisie (défaut = bestDefenseMode) ; 'social' = substitution sociale (mêlée)
  /** Arme de parade choisie (uid d'ItemInstance) ; absent = main principale (weapons[0]). */
  parryWeaponUid?: string;
  /** Substitution sociale (`mode:'social'`, LDB 09 l.207/287) : id de la Compétence substituée à Corps
   *  à corps (Intimidation/Dressage), figé au choix de l'option. Sa valeur de Test est re-dérivée à
   *  l'affichage/résolution (`skillBaseValue`) — le gate `fear` n'est vérifié qu'à l'OFFRE de l'option. */
  substituteSkillId?: string;
  /** TIR défendu (RAW LDB 14 l.40/44, 62 l.307) : modes de réaction AUTORISÉS — limite le segmented
   *  control de la modale (ex. Esquive seule à Bout Portant, Parade seule avec bouclier Protectrice 2+).
   *  Absent = mêlée (Parade/Esquive libres). `distanceTiles` sert au breakdown Projectiles (finishRanged). */
  modes?: ('parade' | 'esquive')[];
  distanceTiles?: number;
  /** Contexte d'OPPOSITION de l'attaque figée, transporté À L'IDENTIQUE de l'appel inline
   *  (`resolveAttack` → `resolveMelee`/`finishMelee`) : sans lui, la MÊME attaque n'infligerait pas les
   *  mêmes Dégâts selon qu'elle traverse ou non la fenêtre.
   *  `env` = modificateurs de scène/situation du breakdown d'attaque ; `withhold` = « Retenir ses coups »
   *  (AA 07 l.59-61) ; `dmgProxy` = Force (Bonus) + Taille de la MONTURE en Charge montée (LDB 14 l.183). */
  env?: ModLine[];
  withhold?: boolean;
  dmgProxy?: { sb: number; size: Combatant['size'] };
  /** Difficulté FIGÉE du jet d'attaque (#1153 L4) : le jet est roulé À L'OUVERTURE, avec un contexte
   *  (flanc/dos, distance) que la fenêtre ne rejoue pas — `flankRear` n'est même pas un champ du
   *  pending. Sans elle, la ligne d'attaque affichée après la défense annoncerait une autre
   *  Difficulté que celle qui a fait sa cible. */
  atkCompo?: DifficultyComposition;
  def: TestResult | null; // null = pas encore défendu ; écrasé par Chance
  result: AttackResult | null; // calculé par finishMelee après « Défendre »
  /** Relance par Chance déjà effectuée (1 max/Test, LDB 12 l.40). */
  rerolled?: boolean;
  /** Défense forcée par Résilience (LDB 17 l.68) → le joueur peut CHOISIR la valeur du dé. */
  forced?: boolean;
  /** Dé FIXÉ par le joueur (option « Dés fixés », `PendingBase.fixed`). */
  fixed?: boolean;
  /** Réaction de Porte-Bouclier (variante AA 13 l.84) déclarée par le défenseur pour CETTE défense au
   *  Bouclier : 'damage' = causer des Dégâts « comme s'il s'agissait de son Action » ; 'push' = repousser
   *  l'attaquant de 2 m et se désengager. Appliquée à l'Appliquer (`applyShieldReaction`), coût débité alors. */
  shieldReaction?: 'damage' | 'push';
  /** CE QUE LA FERMETURE JOUERA (#1858) : déclaré par le producteur qui ouvre la fenêtre, jamais patché
   *  après coup ni deviné à la fermeture. */
  suite: SuiteDeDefense;
}
/** Désengagement en attente (LDB 15 l.43-68) : un MENU de choix (phase 'choice') —
 *  Sacrifier l'Avantage / Esquiver / Fuir / Renoncer — puis le Test d'Esquive (phase 'esquive'). */
export interface PendingDisengage {
  moverId: string; // héros qui se désengage (actif)
  foeId: string; // adversaire de référence (meilleure CC) pour l'Esquive et la Fuite
  canSacrifice: boolean; // Avantage > tous les foes Engagés → option « Sacrifier l'Avantage » dispo
  /** Esquive/Fuite disponibles ? Faux si l'Action est déjà dépensée (elles la coûtent) → seule
   *  l'option A « Sacrifier l'Avantage » reste, ce qui évite la boucle infinie d'Esquive. */
  canEsquive?: boolean;
  phase: 'choice' | 'esquive' | 'fuir'; // 'choice' = menu ; 'esquive' = Test d'Esquive ; 'fuir' = coup dans le dos SUBI + Test de Calme influençable
  atk: TestResult | null; // Esquive : jet de Corps à corps du foe, figé (jamais relancé)
  def: TestResult | null; // Esquive : jet d'Esquive du mover
  result: 'success' | 'failure' | 'tie' | null; // 'tie' = égalité parfaite du Test opposé → statu quo
  /** « Fuir » (l.63-66) : les DEUX jets de la fuite, en slots du flux MULTI hétérogène `flee` —
   *  le coup dans le dos du FRAPPEUR (`backstab`) puis le Test de Calme du FUYARD (`calme`). Chaque
   *  slot porte son propre cycle d'influence et son `interactive` (le contrôleur de SON acteur).
   *  `fleeConfirm` applique le tout (attaque canonique + Brisé + libération/Course). */
  fuir?: { participants: FleeSlot[] };
  /** Relance par Chance de l'Esquive déjà effectuée (1 max/Test, LDB 12 l.40). */
  rerolled?: boolean;
}

/** Slot « coup dans le dos » (LDB 15 l.63) : attaque de Corps à corps NON opposée du FRAPPEUR,
 *  +20 (dos tourné). `result` = l'`AttackResult` COMPLET (Critique, localisation, Dégâts, Avantage,
 *  Frappe Mortelle) — appliqué par l'applicateur canonique d'attaque. */
export interface FleeBackstabSlot extends RollParticipant {
  kind: 'backstab';
  result: AttackResult | null;
}
/** Slot « Test de Calme » du FUYARD (LDB 15 l.66) : échec → États Brisés (1 + DR négatif). */
export interface FleeCalmeSlot extends RollParticipant {
  kind: 'calme';
  calme: { success: boolean; roll: number; target?: number; sl: number } | null;
}
export type FleeSlot = FleeBackstabSlot | FleeCalmeSlot;

/** Slot du coup dans le dos de la phase 'fuir' (undefined hors de cette phase). */
export function fleeBackstab(pd: PendingDisengage): FleeBackstabSlot | undefined {
  return pd.fuir?.participants.find((s): s is FleeBackstabSlot => s.kind === 'backstab');
}
/** Slot du Test de Calme du fuyard (retiré une fois le coup dans le dos résolu sans Blessure). */
export function fleeCalme(pd: PendingDisengage): FleeCalmeSlot | undefined {
  return pd.fuir?.participants.find((s): s is FleeCalmeSlot => s.kind === 'calme');
}
/** Le Test de Calme est-il dû ? LDB 15 l.66 : seulement si le coup dans le dos a fait perdre des PB. */
export function fleeNeedCalme(pd: PendingDisengage): boolean {
  const r = fleeBackstab(pd)?.result;
  return !!r?.hit && (r.woundsLost ?? 0) > 0;
}

/** « Au Contact » en attente (LDB 62 l.176, Option « Longueur d'arme », règle `combat-weapon-reach`) :
 *  Test opposé de Corps à corps `mover` vs `foe` pour entrer dans la longueur d'arme. Le VAINQUEUR
 *  choisit « combat normal » (retire l'état au contact) ou « au contact » (le pose). Calque
 *  `PendingDisengage` : le jet du foe (`atk`) est figé, seul le jet du mover (`def`, Corps à corps)
 *  se (re)joue. `phase 'roll'` = Test opposé influençable ; `phase 'choice'` = le vainqueur HÉROS
 *  tranche (un foe IA tranche par heuristique, sans phase de choix montrée). */
export interface PendingAuContact {
  moverId: string; // héros initiateur (actif)
  foeId: string; // adversaire ciblé (Engagé en mêlée)
  phase: 'roll' | 'choice';
  atk: TestResult | null; // jet de Corps à corps du foe, figé (jamais relancé)
  def: TestResult | null; // jet de Corps à corps du mover (influençable)
  result: 'success' | 'failure' | 'tie' | null; // 'success' = le mover (héros) l'emporte ; 'tie' = statu quo
  /** Relance par Chance du jet du mover déjà effectuée (1 max/Test, LDB 12 l.40). */
  rerolled?: boolean;
}

/** Action d'Empoignade en attente (LDB 14 l.161) : Test opposé de FORCE `actor` vs `foe` pour son
 *  Action, OU « Briser » (gratuit) si Avantage supérieur. Calque `PendingAuContact` : le jet de Force du
 *  foe (`atk`) est figé, seul le jet de l'acteur (`def`) se (re)joue. `phase 'roll'` = Test opposé
 *  influençable (+ bouton « Briser » si `canBreak`) ; `phase 'options'` = le vainqueur choisit Dégâts /
 *  Empêtrer l'adversaire / Se libérer (LDB 14 l.161). */
export interface PendingGrapple {
  actorId: string; // celui qui agit (Empoigné, à son tour)
  foeId: string; // l'autre Empoigné
  phase: 'roll' | 'options';
  canBreak: boolean; // Avantage STRICTEMENT supérieur → peut Briser l'Empoignade gratuitement
  atk: TestResult | null; // jet de Force du foe, figé (jamais relancé)
  def: TestResult | null; // jet de Force de l'acteur (influençable)
  result: 'success' | 'failure' | 'tie' | null; // 'success' = l'acteur l'emporte ; 'tie' = statu quo
  /** Relance par Chance du jet de l'acteur déjà effectuée (1 max/Test, LDB 12 l.40). */
  rerolled?: boolean;
}

/** Incantation en attente : flux par modale (sélection → « Lancer » jet figé → Chance → appliquer),
 *  comme l'attaque. Tous les jets méritent leur modale. */
export interface PendingCast {
  casterId: string;
  targetId: string;
  spellId: string;
  /** Projectile magique (résolution façon attaque) vs autre sort / prière. */
  missile: boolean;
  /** Sort focalisé à NI 0 (consommé à l'application). */
  focused: boolean;
  /** Résultat figé du jet d'incantation (null = pas encore lancé). */
  result: (CastResult & Partial<MissileResult>) | null;
  /** Relance par Chance déjà effectuée (1 max/Test, LDB 12 l.40). */
  rerolled?: boolean;
  /** Incantation forcée par Résilience (LDB 17 l.68) → le joueur peut CHOISIR la valeur du dé. */
  forced?: boolean;
  /** Dé FIXÉ par le joueur (option « Dés fixés », `PendingBase.fixed`). */
  fixed?: boolean;
  /** « Prêchez, ma sœur ! » (LDB 40 l.40-42, option `prayer-conviction`) : Prière entonnée
   *  DISCRÈTEMENT / sans conviction (murmurée) → Difficulté d'un cran plus dure (`discreetPrayerDifficulty`).
   *  Ne concerne que les Prières ; absent/faux = à voix haute (Intermédiaire, RAW). */
  discreet?: boolean;
  /** Incantation CRITIQUE (LDB 46 l.26-32) : choix du lanceur — Blessure Critique
   *  (Projectile à Dégâts) / Puissance totale (lancé quel que soit le NI, dissipable) /
   *  Force inéluctable (indissipable). ÉCRIT avant toute application : par le lanceur (modale) ou par
   *  le moteur pour un lanceur qu'il conduit (`castRoll`) — les gardes ne lisent QUE ce champ. */
  critChoice?: 'critique' | 'puissance' | 'ineluctable';
  /** Forme choisie pour une arme invoquée à forme libre (Arme aethyrique, op `grantWeapon` +
   *  `chooseForm`) — le lanceur sélectionne la Compétence de Corps à corps/profil d'arme. Défaut
   *  (absent) : sa meilleure Spé de Corps à corps. */
  conjureForm?: ConjureForm;
  /** Surincantation : nombre de PAS alloués à chaque axe (chaque pas = +2 DR du surplus). L'effet
   *  d'UN pas est SOURCE-AWARE (`engine/overcast.ts`) — Sort/Miracle : +valeur initiale (×initial,
   *  LDB 47 l.13-17 / 42 l.7-13) ; Bénédiction : +6 m Portée / +1 Cible / +6 Rounds (FIXE, LDB 41
   *  l.21-27, pas de ZdE). `range`/`zone`/`duration` étendent Portée/gabarit/durée ; `targets` débloque
   *  des cibles SUPPLÉMENTAIRES (`extraTargetIds`, capacité = `extraTargetCapacity`). `damage` regagne
   *  des Dégâts au Projectile magique sous le Tableau de Surincantation VDM (`VDM 02 l.198`) —
   *  absent des sources non-missile / hors option (`overcastAxes` ne l'expose alors pas). */
  overcast?: { range: number; zone: number; duration: number; targets: number; damage: number };
  /** Jets sur le Tableau CHOISIS par le lanceur, borné aux pas alloués à `overcast.duration` (EDOC 13
   *  l.276 : « vous POUVEZ » — le jet sur le Tableau est déclinable, jamais forcé). Absent = tous les pas
   *  (le paquet complet reste le geste zéro-clic) — clampé par `castAllocOvercast` si la Durée redescend. */
  chosenTableRolls?: number;
  extraTargetIds?: string[];
  /** Choix des cibles supplémentaires EN COURS sur le champ de bataille : la modale s'efface
   *  (bandeau TargetPrompt + clic carte → castToggleExtraTarget), « Valider » la restaure. */
  pickingTargets?: boolean;
  /** Sort à Zone d'Effet (LDB 47 l.28) — flux « jet PUIS pose » : la modale s'ouvre SANS cible
   *  (`center: null`, `targetId` = ancre lanceur), le jet et la Surincantation (+Zone via `r0m`,
   *  rayon initial en mètres) précèdent la pose ; `placing` = choix de la case en cours sur la
   *  carte (la modale s'efface). À la pose : tous les combattants dans `radius` (cases,
   *  Chebyshev) sont visés par le MÊME jet. */
  zone?: { center: { x: number; y: number } | null; radius: number; r0m?: number; placing?: boolean;
    /** ZdE d'un lanceur IA : CENTRE auto-choisi par l'IA pure (sur un paquet de héros, `ai.ts`
     *  `castArea.center`), MÉMORISÉ tant que `center` reste null. C'est l'ÉQUIVALENT du curseur souris
     *  d'un héros : `castConfirm` (chemin PARTAGÉ) le lit pour poser la zone tout seul quand le lanceur
     *  est `aiDriven` — exactement comme l'auto-combat fournit `castRoll`/`castConfirm`. La pose vit ainsi
     *  dans le `castConfirm` UNIQUE (gardée par `aiDriven`), pas dans un chemin spécial de Contre-sort.
     *  Absent = pose joueur classique (attend le clic réel). */
    autoCenter?: { x: number; y: number } };
  /** Lancé DEPUIS le grimoire porté (sort non mémorisé de son Domaine, LDB 47 l.21) :
   *  le NI est DOUBLÉ à la résolution (et le livre s'expose aux dégâts/au vol — narratif). */
  grimoire?: boolean;
  /** OPPOSITION de la cible RÉSOLUE (issue figée du flux `castOpposition`) : par cible, indique si
   *  le Sort a été RÉSISTÉ et la MARGE de DR (écart) pour les échelles `perSL`. Lu par `applyCast`
   *  qui saute les ops d'une cible résistante et passe la marge en `ctx.sl`. */
  opposedOutcome?: Record<string, { resisted: boolean; margin: number }>;
  /** Le MOMENT du Contre-sort est passé pour cette incantation (`routeCounterspell`) — la fenêtre
   *  s'ouvre UNE fois, au jet, quel que soit le lanceur. Posé même quand rien ne s'ouvre (Sort
   *  indissipable, aucun candidat) : c'est le moment qui est consommé, pas l'issue. */
  counterspellRouted?: boolean;
}

/** DÉCLARATION d'une rangée de Contre-sort : contrer SEUL, s'UNIR au Test Soutenu (LDB 46 l.162), ou
 *  PASSER. Source UNIQUE de la composition de la fenêtre — il n'y a pas d'autre drapeau d'union. */
export type CounterDeclaration = 'solo' | 'soutenu' | 'pass';

/** Un lanceur qui tente le Contre-sort : participant du flux MULTI (son propre jet + influence). */
export interface CounterParticipant extends RollParticipant {
  /** Résultat du Test opposé de Langue (Magick) de CE contre-lanceur, ou null = pas encore lancé.
   *  Rangée UNIE non meneuse : reste `null` — le groupe n'a qu'un jet, celui du meneur (LDB 12 l.189). */
  result: CounterspellOutcome | null;
  /** Déclaration de la rangée, `undefined` = pas encore déclarée (PHASE 1 : les jets sont verrouillés
   *  tant qu'une rangée ne l'a pas fait ; à la dernière déclaration la composition est FIGÉE — ni
   *  entrée, ni ralliement, ni retrait). Mix libre : chaque rangée choisit pour elle
   *  (arbitrages utilisateur 2026-08-04 [entériné 2026-08-04], verbatims aux tickets #1042/#1059). */
  declared?: CounterDeclaration;
}
/** Contre-sort (Dissipation, LDB 46 l.156) — flux multi-participants « réaction type défense ». Le
 *  jet d'incantation FIGÉ vit dans `pendingCast` ; ce pending porte les contre-lanceurs recensés par
 *  `routeCounterspell` — rangée INTERACTIVE pour ceux qu'un siège possède (héros, ennemi sous siège
 *  MJ), rangée TÉMOIN pour les autres. PLUSIEURS peuvent chanter contre la même incantation (#1040,
 *  cf. `counterspellConfirm` dans `src/state/combatSlice.ts`), qui agrège les issues à l'application.
 *  « Laisser passer » = personne n'a chanté → repli sur le meilleur candidat IA s'il en reste un,
 *  sinon le Sort se résout tel quel. */
export type PendingCounterspell = MultiPending<CounterParticipant>;

/** Issue du Test d'OPPOSITION d'UNE cible contre l'incantation figée (résist FM/Int ou contact Bagarre). */
export interface OppositionOutcome {
  /** Le Test opposé de la cible (FM / Intelligence / Corps à corps (Bagarre)). */
  oppose: TestResult;
  /** La cible l'emporte → le Sort est RÉSISTÉ. */
  resisted: boolean;
  /** Marge de DR (incantation − opposition) quand le LANCEUR l'emporte (échelle `perSL` des ops). */
  margin: number;
}
/** Une cible qui OPPOSE son Test à l'incantation : participant du flux MULTI (son jet + influence). */
export interface OppositionParticipant extends RollParticipant {
  result: OppositionOutcome | null;
}
/** Le Sort déclare une OPPOSITION (`spec.opposed`) : chaque cible oppose son Test (FM/Int/Bagarre) à
 *  l'incantation FIGÉE (`pendingCast.result`), avec son propre cycle Chance/Pacte/Résilience. L'agrégat
 *  (`oppositionConfirm`) écrit `pendingCast.opposedOutcome` par cible, puis `castConfirm` applique
 *  (cible résistante → aucune op ; sinon ops à la marge). « Réaction type défense » : cible IA = rangée
 *  témoin (jet auto + révélée dans la modale) ; cible héros = rangée interactive. */
export interface PendingCastOpposition extends MultiPending<OppositionParticipant> {
  kind: 'resist' | 'contact';
  skill?: string;
  char?: CharKey;
}

/** Un Round d'un Test Étendu : le jet de CE Round (slot du flux multi SÉQUENTIEL). */
export interface ExtendedTestRound extends RollParticipant {
  result: { roll: number; sl: number; success: boolean } | null;
}
/** Un héros qui frappe la porte : participant du flux MULTI PARALLÈLE (son propre jet + dégâts). */
export interface ForceDoorParticipant extends RollParticipant {
  /** Jet de Corps à corps (Bagarre) de CE héros + dégâts infligés à la porte, ou null = pas lancé. */
  result: { roll: number; target: number; sl: number; damage: number } | null;
}
/** Enfoncer une porte À PLUSIEURS (EDO Appendice 2, « Portes ») — flux multi PARALLÈLE : la porte est
 *  un OBJET (BE = Bonus d'Endurance, B = Blessures). Chaque héros frappe INDÉPENDAMMENT (Test de
 *  Corps à corps (Bagarre)), dégâts = max(0, DR + Bonus de Force − BE) — objets : PAS de minimum 1
 *  (l.92). Chacun son cycle Chance/+1 DR/Pacte/Résilience. La porte cède quand B ≤ 0 ; sinon un
 *  nouveau Round s'ouvre (chacun re-frappe). Hors combat comme en combat (acteurs via `actorIn`). */
export interface PendingForceDoor extends MultiPending<ForceDoorParticipant> {
  label: string; // « Porte de la cave »
  doorBE: number; // Bonus d'Endurance de l'objet
  doorB: number; // Blessures restantes (cède à ≤ 0)
  doorBmax: number; // Blessures initiales (jauge)
  /** Flag de scène posé quand la porte cède (ouverture en jeu) — optionnel. */
  flag?: string;
}

/** UN dé du lot d'étal : une rangée POSABLE, sans acteur — c'est le MONDE qui le lance. `value` est
 *  le dé courant (naturel à l'ouverture, reposé si le siège le fixe) ; `min`/`max` sont ses faces
 *  RÉELLES, pour que le champ ne propose pas un 73 sur un d10. */
export interface EtalLotRow extends RollParticipant {
  /** Ce que CE dé décide, en clair (« Marchand présent », « Quantité — Vin »). */
  label: string;
  min: number;
  max: number;
  value: number;
  /** Aucun jet à relancer : le dé est TOMBÉ, il se REPOSE (pas de cycle Chance/Pacte/Résilience). */
  result: null;
}

/** LE LOT DE DÉS D'UN ÉTAL (#1426) — flux multi PARALLÈLE dégénéré : N dés du MONDE, tous déjà tombés,
 *  chacun reposable, validés d'un bloc. `cible` dit QUEL étal se rejouera à la validation ; le lot ne
 *  connaît rien d'autre du domaine (le générateur, lui, est rejoué avec les dés posés). */
export interface PendingEtalLot extends MultiPending<EtalLotRow> {
  /** Titre de la fenêtre (« Halle de Grünburg », « Port de Marienburg »). */
  label: string;
  /** Quel générateur rejouer : la halle terrestre ou l'étal portuaire. */
  cible: 'land' | 'port';
}

/** Test Étendu (LDB 12 l.172-174 : « atteindre un certain DR … les DR obtenus à chaque Round sont
 *  additionnés jusqu'à atteindre une valeur cible … Si le DR total passe en dessous de 0, recommencer
 *  depuis le début »). Flux multi SÉQUENTIEL : un Round à la fois (chacun son cycle Chance/Pacte/
 *  Résilience), le DR de chaque Round CUMULÉ — la réussite d'un Round DÉPEND du total des précédents.
 *  Ex. enfoncer une porte renforcée (DR cible 20). Le câblage par Round vit dans `FLOWS.extendedTest`,
 *  la progression (cumul + Round suivant + réussite) dans `extendedTestNext`. */
export interface PendingExtendedTest extends PendingBase {
  actorId: string; // qui effectue le Test (solo)
  label: string; // « Enfoncer la porte »
  skillLabel: string; // « Force » / « Athlétisme » (affichage)
  target: number; // cible effective d'UN Round (difficulté déjà appliquée)
  targetDR: number; // DR CUMULÉ à atteindre (LDB 12 : « une valeur cible »)
  total: number; // DR cumulé courant (dépend des Rounds précédents → c'est ce qui rend le flux SÉQUENTIEL)
  rounds: ExtendedTestRound[];
  /** BORNE d'essais (Commerce d'opportunité, MDG 15 l.274-286 : « 10 DR en ≤ 3 tentatives ») — la
   *  borne ATTEINTE sans réussir est une ISSUE (résolue par `outcome`), jamais une boucle infinie.
   *  Absent = pas de plafond (crochetage/porte : on retente jusqu'à réussite ou renoncement). */
  maxAttempts?: number;
  /** Flag de scène posé à la RÉUSSITE (DR cumulé ≥ cible) — gate la suite (porte/serrure d'éditeur). */
  flag?: string;
  /** SOUTIEN (LDB 12 l.187-196) : le meneur (`actorId`) lance, +10 par soutien plafonné au Bonus de
   *  Caractéristique (`assistedTest`). Déjà FONDU dans `target` ; conservé pour l'affichage (« +20, 2 soutiens »). */
  support?: SupportDetail;
  /** Issue DISSIPATION (LDB 46 l.158-160) : à la réussite (DR cumulé ≥ NI), retire les effets du Sort
   *  (`dissipateSpell` sur les combattants) au lieu de poser un flag de scène. */
  dispel?: { spellId: string; casterId: string; label: string };
  /** Issue de DOMAINE en donnée (kind-agnostique — Commerce d'opportunité, artisanat futur…) : résolue
   *  par `extendedTestOutcomeAppliers[outcome.kind]` (calque `cascadeAppliers`) à la clôture du Test,
   *  qu'il ait ATTEINT sa cible ou buté sur `maxAttempts`. `meta` = paramètres sérialisables (jamais de
   *  closure — coop). Absent ⇒ comportement historique (`flag`/`dispel`, réussite seule). */
  outcome?: { kind: string; meta?: CascadeStepMeta };
  /** ENJEU du Round (#1117) — référence de donnée résolue par `resolveStake`, rendue par la modale. */
  stake?: StakeRef;
}

/** Paramètres SÉRIALISABLES de la conséquence d'une étape (jamais de closure — coop : le pending est
 *  snapshoté/transmis). Index primitif (`days`/`count`/`severity`/… lus par `String()`/`Number()`) +
 *  deux Flows OPTIONNELS pour l'étape GÉNÉRIQUE `triggeredTest` (la conséquence `onSuccess`/`onFail`
 *  voyage dans le `meta`, exécutée par l'applier — un Flow est pur-donnée, donc sérialisable). */
/** Jet ATTAQUANT FIGÉ d'une étape `triggeredTest` OPPOSÉE (Assommante : Force du porteur vs Résistance
 *  de la victime). Pré-jeté par `resolveFlowTest`, il voyage dans le `meta` (TestResult = pur-donnée,
 *  sérialisable/coop) et reste FIGÉ pendant que le défenseur (héros) influence SON jet ; chaque
 *  (re)résolution recalcule l'issue via `resolveOpposed(jetDéfenseur, aT)` — calque exact de `recover`. */
export interface OpposedFreeze {
  /** Jet COMPLET de l'attaquant (porteur), figé. */
  aT: TestResult;
  /** Id de l'attaquant, quand c'est un COMBATTANT réel (`actorIn`) — porte l'en-tête A→B (`VsHeader`).
   *  Absent pour un adversaire ABSTRAIT (table sans Combatant, ex. jeux de taverne contre la maison). */
  attackerId?: string;
  /** Nom de l'attaquant (affichage de la ligne d'opposition) — tout producteur a un adversaire nommé. */
  attackerName: string;
  /** CE QUE TESTE l'attaquant, en STRUCTURE (ids de Compétence/Caractéristique) : le libellé de sa
   *  ligne en est DÉRIVÉ par le rendu (`testSkillLabel`), jamais composé par le flux qui fige le jet —
   *  un flux déclare, le renderer écrit. */
  test?: { skill?: string; spec?: string; char?: CharKey };
  /** Libellé AUTHORÉ du côté attaquant, quand aucune structure ne peut le porter : une alternative
   *  écrite en donnée (`FlowTest.opposed.attackerLabel`, « Force/Athlétisme ») ou le nom de la
   *  manœuvre affrontée. Lu en second, quand `test` ne rend rien. */
  attackerLabel?: string;
  /** Bonus de DR ajouté au jet du DÉFENSEUR avant l'opposition (Piège-lame, LDB 62 l.280) — `FlowTest.
   *  opposed.bonusSL` figé : chaque (re)résolution oppose `def.sl + bonusSL` à `aT`. Absent/0 = Assommante. */
  bonusSL?: number;
  /** Difficulté de l'OPPOSITION (LDB 12 l.166 : « Dans la plupart des cas, ces modificateurs sont
   *  appliqués aux deux groupes ») — celle du `FlowTest`, appliquée au pré-jet de l'attaquant comme au
   *  jet du défenseur, et LUE par les deux lignes. Absente pour un freeze réhydraté sans elle. */
  difficulty?: Difficulty;
  /** Le DÉFENSEUR (le jeteur de CE Test) est le camp que le RAW nomme « vous », celui qui doit
   *  REMPORTER pour que la conséquence tombe (Piège-lame, LDB 62 l.280) — `FlowTest.opposed.
   *  defenderMustWin` figé. Absent : le jeteur RÉSISTE (Assommante, l.235). Lu au SEUL cas d'égalité
   *  parfaite (`opposedBranchSuccess`, LDB 12 l.160). */
  defenderMustWin?: boolean;
}

/** Ce qu'une RANGÉE lit du freeze pour trancher son issue (`stepOpposedFreeze` → `opposedCascadeRoll`) :
 *  le jet figé et les deux paramètres de verdict. L'identité/affichage de l'attaquant n'y entre pas. */
export type OpposedRowFreeze = Pick<OpposedFreeze, 'aT' | 'bonusSL' | 'defenderMustWin'>;
/** Contexte SÉRIALISABLE d'une DÉFENSE de manœuvre de ZONE (Souffle/Vomi/Regard/Étreinte/Langue, LDB 85)
 *  porté par une étape de cascade `maneuverDefense` : le héros ciblé JETTE sa réaction (Esquive/Initiative/
 *  Parade) opposée au jet d'attaquant FIGÉ (dans `meta.opposed.aT`), influençable (Chance/Résilience). À la
 *  validation, l'applier RE-oppose et applique les effets de la manœuvre (`findManeuverById(maneuverId).effects`)
 *  avec la marge nette + `indice`/`spent` — SOURCE partagée avec le chemin silencieux (`applyManeuverEffects`).
 *  Tout est primitif (ids/nombres) → snapshoté/transmis en coop, jamais de closure. */
export interface ManeuverDefenseFreeze {
  /** Créature attaquante (référent des effets/formules). */
  attackerId: string;
  /** Id de la manœuvre (`maneuvers.json`) → `findManeuverById` reconstruit `effects`/`advantageMode`. */
  maneuverId: string;
  /** Indice de la manœuvre (Dégâts = 4 + BF pour une arme naturelle, LDB 85). */
  indice: number;
  /** Avantage dépensé (marge des manœuvres à Avantage VARIABLE, ex. Regard +1 DR/Av, LDB 85 l.290). */
  spent: number;
}
/** Contexte SÉRIALISABLE d'une ATTAQUE GRATUITE de talent (op `grantFreeAttack`) porté par une étape de
 *  cascade : la CIBLE de la frappe (`targetId` — un TIERS : le chargeur pour Frappe réactive), le plafond
 *  /Round (`cap` = niveau du talent) et la `key` d'imputation (`freeAttacksThisTurn`). Reconstruit l'`exec`
 *  impur de l'applier (la frappe est ouverte via `runCombatFlow` + le hook `freeAttack`). */
export interface FreeAttackFreeze {
  targetId: string;
  cap: number;
  key: string;
}
/** Contexte SÉRIALISABLE de la CONSÉQUENCE d'un Test opposé de Piège-lame GAGNÉ (op `breakBlade`) porté par
 *  une étape de cascade : l'attaquant désarmé (`attackerId`), la lame visée (`weaponUid`, uid universel), le
 *  bonus de DR de la défense (`defSL`, LDB 62 l.280) et le DR FIGÉ de l'attaquant (`attackerSL`). La marge
 *  nette = `(DR du défenseur + defSL) − attackerSL` ≥ 6 → la lame est BRISÉE (sauf Incassable), sinon
 *  ARRACHÉE. Reconstruit l'`exec` impur de l'applier (le bris/désarmement passe par `runCombatFlow` + le
 *  hook `bladeTrap`). Tout est primitif → mirroir dans `meta.bladeTrap` pour la voie cascade (héros manuel). */
export interface BladeTrapFreeze {
  attackerId: string;
  weaponUid: string;
  defSL: number;
  attackerSL: number;
}
/**
 * CLÔTURE d'un verbe, différée AVEC sa continuation (#1508) — ce que le site allait faire APRÈS son
 * Flow, écrit en DONNÉE plutôt qu'en instruction.
 *
 * Le socle portait déjà le patron sur un Test : `PendingTest.dialogueNext` est une clôture NOMMÉE,
 * rejouée après le jet. Elle est ici GÉNÉRALISÉE, parce que la même chose vaut d'un dé : l'horloge
 * d'une fouille tire les effets PROGRAMMÉS et les ticks (Hémorragique, Poison, agonie) — jouée devant
 * un dé de chute, elle les tire sur des Blessures qui n'ont pas encaissé.
 *
 * UNION FERMÉE de verbes SÉRIALISABLES, résolus par un REGISTRE (patron `cascadeAppliers`) : jamais
 * une fermeture JS. `pendingCascade` est SAUVEGARDÉ (`state/saves.ts`) et voyage sur le réseau — une
 * clôture qui serait une fonction ne survivrait ni à l'un ni à l'autre.
 */
export type Cloture =
  /** Avancée du dialogue (nœud suivant, ou fermeture) — la clôture de `chooseDialogue`/`resolveTest`. */
  | { verbe: 'dialogueSuivant'; transition: DialogueTransition }
  /** Avancée d'horloge d'un verbe (fouille, dialogue) : l'abonné `TIME_ADVANCED` en tire les effets
   *  PROGRAMMÉS et les ticks — donc APRÈS le dé, sur des Blessures encaissées. */
  | { verbe: 'avancerHorloge'; minutes: number }
  /** Décor consommé par sa fouille (`interact.consume`). */
  | { verbe: 'retirerEntite'; entityId: string }
  /** Action authorée `unique` JOUÉE sur un décor qui RESTE (drapeau `__action_<entId>_<actionId>`,
   *  `cleActionJouee`) : c'est l'ACTION qui s'épuise, pas le décor. */
  | { verbe: 'marquerActionJouee'; entityId: string; actionId: string }
  /** Seam `onOwnTestFailed` d'un Test RATÉ (MSRC 16 l.152) — il APPLIQUE des ops, il attend le dé. */
  | { verbe: 'testRateDeLActeur'; actorId: string; sl: number }
  /** Effets PROGRAMMÉS dus au même pas d'horloge et pas encore joués (`fireScheduledEffects`). */
  | { verbe: 'effetsProgrammes'; restants: ScheduledEffect[] }
  /** Écran de victoire (`finalizeBattle`), POSÉ après le dé : il ne doit pas s'ouvrir devant lui, et
   *  ses deltas de PX/bourse se LISENT après l'encaissement — d'où les deux bornes AVANT, pas un total. */
  | { verbe: 'ouvrirEcranDeVictoire'; ecran: Omit<PendingVictory, 'xp' | 'gold'>; xpAvant: number; laitonAvant: number }
  /** Teardown de fin de combat : reprise de la bataille de masse puis de la séquence parquée. */
  | { verbe: 'teardownDeVictoire'; kills: number; batailleDeMasse: boolean };

export interface CascadeStepMeta {
  [key: string]: number | string | boolean | string[] | Flow | GameOp[] | OpsCtxGele | Cloture[] | OpposedFreeze | FreeAttackFreeze | BladeTrapFreeze | ManeuverDefenseFreeze | undefined;
  /** DÉCLARE que cette étape fait ATTENDRE sa conséquence à un dé (#1508) : le lot/la pile qui l'a
   *  produite lui confie SA SUITE (`apresFlow`) au lieu de continuer par-dessus le dé en vol. Posé par
   *  les mints du canal (`opsDe`, `chuteDe`) ; lu par les DEUX walkers de Flow, qui n'ont ainsi aucune
   *  liste de `kind` à tenir — un troisième kind à dé déclare le même champ et il est servi. */
  differeLaSuite?: boolean;
  /** CLÔTURES confiées AVEC la continuation (#1508) — les verbes que le site allait jouer après son
   *  Flow, en donnée. Rejouées APRÈS `apresFlow`, dans l'ordre du site, à la DERNIÈRE étape de la
   *  grappe : si le Flow rouvre un dé, elles repartent avec lui. */
  apresClotures?: Cloture[];
  /** CONTINUATION confiée par le walker qui a différé — le reste de son lot/de sa pile, en Flow pur
   *  (sérialisable). Rejouée par l'applier de l'étape APRÈS la conséquence, jamais avant. */
  apresFlow?: Flow;
  /** QUEL walker rejoue `apresFlow` : `'scene'` (`runFlow` — lot d'Effets d'auteur) ou `'combat'`
   *  (`runCombatFlow` — pile d'un Flow d'effet déclenché, qui porte cible/lanceur et la cadence). C'est
   *  l'identité du PRODUCTEUR (`ExecCtx.mode`, déjà nommée par le socle), pas une classe de situation :
   *  un lot de scène rejoué par le walker de combat perdrait ses Effets non-`ops`, et l'inverse
   *  perdrait cible et lanceur. */
  apresMode?: 'scene' | 'combat';
  /** CONTEXTE de la feuille d'ops différée, part GELÉE (`engine/ops.gelerOpsCtx` — partition TOTALE
   *  `OPS_CTX_GELES`). Ce qui n'est pas gelable voyage à côté (`casterId`/`hullId`/`opsDeCrewIds`) ou se
   *  rebâtit (rng, hook de Corruption, dés). Sans lui, une reprise appliquait la feuille avec un
   *  contexte AMPUTÉ — `{woundsDealt}` (EDO 11 l.222) y tombait à 0. */
  opsDeCtx?: OpsCtxGele;
  /** ÉQUIPAGE (`OpsCtx.crew`) d'une feuille différée, en ids — résolus par `actorIn` à la reprise. */
  opsDeCrewIds?: string[];
  /** Modificateur PLAT au total d'une étape batch sommée — NEUTRE : le flux propriétaire y verse ses
   *  paramètres DÉJÀ chiffrés (le naval : bande de Moral + Manque de bras + sabotage, MDG 14). */
  aggregateFlatDR?: number;
  /** Plafond CHIFFRÉ du total sommé, versé par le flux propriétaire (naval : « jamais mieux qu'un
   *  Succès Minime », Manque de bras MDG 14 l.55 — `capToSuccesMinime`). Absent = aucun plafond. */
  aggregateCapTo?: number;
  /** Id du prédicat de SUCCÈS du total sommé (`registerCascadeSuccessRule`, naval : `crew-test` →
   *  `crewTestSuccess`, MDG 14 l.13). Chaîne, jamais une closure : le pending est snapshoté en JSON. */
  aggregateSuccessRule?: string;
  /** Marge adverse soustraite du total (`aggregate:'opposed'` — contresort). */
  aggregateOpposeSl?: number;
  /** Branche de réussite d'une étape `triggeredTest` (exécutée via `applyTriggeredTestBranch`). */
  onSuccess?: Flow;
  /** Branche d'échec d'une étape `triggeredTest`. */
  onFail?: Flow;
  /** Branche OUI d'une étape `triggeredChoice` (décision opt-in acceptée — Frappe réactive « tenter »). */
  choiceYes?: Flow;
  /** Branche NON d'une étape `triggeredChoice` (décision refusée — défaut = renoncer). */
  choiceNo?: Flow;
  /** Coût d'Avantage d'une étape `triggeredChoice` (dépensé sur OUI si payable) — absent = gratuit. */
  choiceCost?: number;
  /** CIBLE de la branche d'un `triggeredChoice` quand elle DIFFÈRE du décideur (`on:'victim'` : le décideur
   *  est le porteur/attaquant `caster`, mais la branche `yes` vise la VICTIME — Déstabilisante : Test opposé
   *  contre la cible touchée). Id sérialisable, restauré en `ctx.target` par l'applier. Absent ⇒ la cible =
   *  le décideur (Frappe réactive : Test sur soi, le tiers voyage dans `freeAttack`). */
  choiceTargetId?: string;
  /** CONTINUATION reprise APRÈS la branche d'un `triggeredTest`/`triggeredChoice` enfoui dans un Flow (le
   *  reste du `seq` qui suivait le nœud). Pur-donnée (voyage en coop) ; rejouée par l'applier via
   *  `runCombatFlow`. Absent (= EMPTY_FLOW) pour un nœud top-level (Mâchoires) → aucune suite. */
  after?: Flow;
  /** Jet ATTAQUANT FIGÉ d'un `triggeredTest` OPPOSÉ — présent ⇒ l'issue du défenseur vient de
   *  `resolveOpposed(jetDéfenseur, aT)` au lieu de `roll ≤ target` (Assommante). Absent ⇒ Test simple. */
  opposed?: OpposedFreeze;
  /** Contexte d'attaque gratuite (Frappe réactive : la branche success porte `grantFreeAttack`) — la frappe
   *  vise le tiers `targetId`. Reconstruit l'`exec` impur de l'applier. Absent ⇒ branche purement data. */
  freeAttack?: FreeAttackFreeze;
  /** Contexte de Piège-lame GAGNÉ (la branche success porte `breakBlade`) — désarme/brise la lame de
   *  l'attaquant ciblé. Reconstruit l'`exec` impur de l'applier. Absent ⇒ branche purement data. */
  bladeTrap?: BladeTrapFreeze;
  /** Contexte d'une DÉFENSE de manœuvre de zone (applier `maneuverDefense`) : l'attaquant + la manœuvre +
   *  l'indice/l'Avantage. Le jet d'attaquant FIGÉ voyage à côté dans `opposed.aT`. */
  maneuverDefense?: ManeuverDefenseFreeze;
  /** ENTITÉ SOURCE d'un Test déclenché (`effectSourcesOf` → `TriggeredEffect.source`) : le `kind` de
   *  source (`trait`/`talent`/`condition`/`symptom`/`quality`/`psychology`/`trapping`) et son id.
   *  Sérialisée pour que l'enjeu de l'étape (#1117) renvoie à l'entité qui EXIGE le Test — jamais à
   *  une fiche générique. Ces deux champs sont de l'AFFICHAGE : aucun applier n'en dépend. */
  sourceKind?: string;
  sourceEntityId?: string;
  /** RÉFÉRENT des Formules de la branche (« votre Force Mentale » — Forêt d'épines LDB 48 l.749) quand
   *  il DIFFÈRE du combattant qui jette (`hero`) — le LANCEUR d'un effet posé par un tiers (zone de
   *  Sort, Trait déclenché d'un attaquant). Id sérialisable, résolu par l'applier (`actorIn`, combat OU
   *  groupe) → `applyTriggeredTestBranch`. Absent ⇒ référent = `hero` lui-même (Mâchoires/Contrôle de
   *  la Frénésie : effet auto-porté). */
  casterId?: string;
  /** COQUE dont le Critique a ouvert cette bande (coup à l'ÉQUIPAGE, `MDG 13`) : les ops de la branche
   *  la lisent (`OpsCtx.hull` — la Taille du bateau donne la hauteur de chute, `MDG 13 l.684`). Id
   *  sérialisable, jumeau de `casterId`, résolu par l'applier (`coqueParId` : file de combat OU véhicule
   *  du trajet). Absent ⇒ la bande n'est pas née d'une coque, et une op qui l'exige le NOMME. */
  hullId?: string;
  /** Test ÉTENDU de Peur (LDB 21 l.25) : DR déjà cumulé AVANT ce jet, porté PAR LA RANGÉE d'une bande
   *  de Psychologie de combat (`BatchParticipant.meta`) — l'applier y ajoute le DR du jet. */
  prevDR?: number;
  /** « Sans Peur (Ennemi) » (LDB 10 l.1051) sur CETTE rangée : son Test est allégé (Accessible +20) et
   *  une réussite ignore la Peur d'emblée. Divergence PAR HÉROS d'une bande, jamais de l'étape. */
  sansPeur?: boolean;
  /** RANGÉE RÉSOLUE D'OFFICE (#1281) : aucune fenêtre ne s'ouvrira sur elle. POSÉE par le seul pilote
   *  qui roule sans surface — `cascade.runCascadeImmediate` (moitié auto d'une bande scindée par
   *  pilote, cadence rapide, reprise commandée). Le socle (`cascade.commitStep`) en émet la ligne de
   *  trace — porteur, libellé, dé/cible, issue — le journal étant SA SEULE surface. Étampe de RANGÉE
   *  (`BatchParticipant.meta`), jamais d'étape. */
  autoResolved?: boolean;
}
/** Le jet d'UNE étape de cascade (slot du flux multi SÉQUENTIEL `FLOWS.cascade`). */
export interface CascadeRoll {
  roll: number;
  target: number;
  sl: number;
  success: boolean;
  /** Test OPPOSÉ tranché sur une ÉGALITÉ PARFAITE (`LDB 12 l.160`) : arbitrage STATU QUO — la branche
   *  porteuse de la conséquence n'est pas prise, et ce n'est PAS un Test raté (aucun `onOwnTestFailed`).
   *  Posé par `opposedCascadeRoll` seul ; absent partout ailleurs. */
  statuQuo?: true;
}
/**
 * Une ÉTAPE influençable d'une CASCADE séquentielle (bilan de nuit, journée de voyage…). Le `kind`
 * détermine la CONSÉQUENCE (appliée à la validation par `cascadeAppliers[kind]`, cf. state/cascade.ts) ;
 * le jet lui-même est kind-agnostique (Test de `base`+difficulté sur `target`). `meta` porte les
 * paramètres sérialisables de la conséquence (ex. `days`, `count`) — PAS de closure (coop : le pending
 * est snapshoté/transmis). Une étape SANS `target` est un simple passage (rare) ; les notes en clair
 * vont dans `PendingCascade.log`, pas en étapes.
 */
/** Sentinel d'owner d'une étape `worldOwner` (seam de jet #275 Décision 3 — désertion, Moral) : aucun
 *  `actorId` à router — `netOwnership.seatOwns` le reconnaît pour router au siège MJ (`gmSeat`) quand
 *  il existe, à l'hôte sinon. Vit ICI (neutre) pour que `modalArbiter.ts` et `netOwnership.ts` (qui
 *  s'importent déjà l'un l'autre) n'aient pas à se réimporter en cycle. */
export const WORLD_STEP_OWNER = '__world-step__';

/** Agrégation d'une étape À PARTICIPANTS (batch multi — Test d'équipage, seam de jet #275 Décision 4
 *  cran 1). Canonique ICI (neutre, comme `WORLD_STEP_OWNER` ci-dessus) : `rollSeam.ts` importe déjà
 *  `CascadeStep` depuis ce module — la définir là-bas et l'importer ICI créerait un cycle.
 *  `'none'` (#351) : jets INDÉPENDANTS — aucun `CascadeRoll` scalaire n'est calculé/posé sur `step.result`,
 *  chaque `part.result` porte SEULE sa conséquence (patron `stagePosteBatch`/`weatherResistance`, arbitrage
 *  user 2026-07-11 : « jets INDÉPENDANTS, un par héros posté »). Sans cette valeur, `summed-dr` (le défaut)
 *  se calcule quand même — un calcul MORT, jamais lu par l'applier ni affiché (aucun `step.outcome`). */
export type CascadeAggregate = 'best' | 'opposed' | 'summed-dr' | 'none';

/**
 * SECONDE LECTURE d'un jet — Test COMBINÉ (`LDB 12 l.202-208`, verbatim l.206 : « Faire un seul Test,
 * en comparant donc un unique jet de pourcentage avec la valeur de ces deux Compétences »). Le jet est
 * celui de l'étape/de la rangée ; cette déclaration porte l'AUTRE valeur à laquelle le MÊME dé se
 * compare, et son nom. Aucun second tirage n'existe et le type l'interdit : il n'y a ici ni `roll` ni
 * `result` — l'issue est ÉVALUÉE (`secondReadOf`, `state/cascade.ts`, via `evaluateCombinedTest`).
 *
 * GÉNÉRIQUE : toute étape/rangée dont un dé unique tranche deux valeurs (le Cerevis en hérite,
 * `NADJ 16 l.90`). La CIBLE est EFFECTIVE (Difficulté déjà appliquée, comme `target`) — la
 * Difficulté déclarée n'est là que pour se LIRE sur la ligne.
 */
export interface CascadeSecondRead {
  /** Libellé de la seconde lecture — la Compétence/Caractéristique comparée, jamais la situation. */
  label: string;
  /** Cible EFFECTIVE de la seconde lecture (Difficulté déjà appliquée). */
  target: number;
  /** Valeur NUE de la seconde lecture (`skillBaseValue`, `LDB 09 l.17`) — même contrat que `base`. */
  base?: number;
  /** Difficulté du Test combiné, telle qu'elle se lit sur la ligne (elle est déjà dans `target`). */
  difficulty?: Difficulty;
}

/** Un CONTRIBUTEUR à une étape À PARTICIPANTS de cascade (batch multi). GÉNÉRIQUE, kind-agnostique : sa
 *  PRÉSENTATION (`label`/`base`/`mods`) et sa cible EFFECTIVE (`target`) sont RÉSOLUES à la CONSTRUCTION
 *  de l'étape par le flux propriétaire (le naval `buildVoyageCrewStep` dérive tout depuis `crewRoleValue`
 *  — le séquenceur et la modale n'y lisent QUE ces champs neutres, aucun concept de domaine). Le jet est
 *  un Test « déjà +0 » sur `target` (`evaluateTest`) ; sur une réussite s'ajoute `bonusSlOnSuccess` (le
 *  +DR de Talent baké à la construction). `essential` = contribue DOUBLE à l'agrégat sommé (générique). */
export interface BatchParticipant extends RollParticipant {
  /** Niveau de Compétence NU du contributeur (`skillBaseValue`, `LDB 09 l.17`) — MÊME contrat que
   *  `CascadeStepBase.base` : la ligne d'une rangée batch se lit comme celle d'un jet mono. */
  base: number;
  /** Cible EFFECTIVE (difficulté déjà appliquée) — l'auto-roll générique évalue le d100 contre elle. */
  target: number;
  /** Détail additif de la rangée (affichage) : Soutien, États, passifs — toutes NOMMÉES. */
  mods?: ModLine[];
  /** ÉCRÊTAGE réellement subi par `target` aux bornes de `TestPolicy` (`engine/tests.clampTarget`),
   *  mesuré à la construction — la rangée le NOMME (« plafond 99 ») au lieu de l'avouer « autres ». */
  clamped?: number;
  /** COMPÉTENCE réellement lancée par ce contributeur (résolue à la construction par le flux
   *  propriétaire — naval : `crewRoleValue().used`) : la ligne de jet NOMME la Compétence (Z5), le
   *  rôle tenu n'étant que la PROVENANCE. */
  skillId?: string;
  spec?: string;
  /** RÔLE tenu (id stable de `crew-roles`) — PROVENANCE de la rangée, jamais son libellé de ligne. */
  roleId?: string;
  /** Contribue DOUBLE à l'agrégat sommé (rôle essentiel MDG 14 l.19 — « compte double », générique). */
  essential?: boolean;
  /** +DR ajouté au DR d'un jet RÉUSSI (Talent baké à la construction — Commandant émérite MDG 09 l.54). */
  bonusSlOnSuccess?: number;
  /** Test ÉTENDU inter-Étapes porté PAR CETTE rangée (cartographie de voyage, EDOC 8 l.161) : progression
   *  cumulée AVANT ce jet (`extendedDrDone`) vers la cible (`extendedDrTarget`) — la barre de DR
   *  (`DrBar`) s'attache à la rangée et PERSISTE après validation (arbitrage user 2026-07-11). L'accumulation
   *  RÉELLE reste au pas d'agrégation (`stageAggregate`), ceci n'est que l'affichage. */
  extendedDrDone?: number;
  extendedDrTarget?: number;
  /** Conséquence appliquée à CETTE rangée (dérivée des ops, #295 ; ligne STRUCTURÉE #349) — rendue
   *  comme note de la rangée (le portrait porte l'attribution), PERSISTE dans les rangées-témoins/bilan. */
  outcome?: RecapLine[];
  result: CascadeRoll | null;
  /** Relance par Chance déjà effectuée (1 max/Test, LDB 12 l.40). */
  rerolled?: boolean;
  /** Réussite forcée par Résilience (LDB 17 l.68). */
  forced?: boolean;
  /** Paramètres CHIFFRÉS et SÉRIALISABLES de la conséquence de CETTE rangée (jamais de closure — coop),
   *  jumeau du `meta` d'étape (`CascadeStepMeta`) : une bande dont l'applier diverge PAR HÉROS
   *  (Psychologie : type, source, indice, DR déjà cumulé, difficulté allégée) porte ici ce qui lui est
   *  propre, l'étape gardant ce qui est COMMUN. Aucune BRANCHE ici (`onSuccess`/`onFail`/`opposed`
   *  restent à l'ÉTAPE : aucun lecteur PAR RANGÉE n'existe, un `Flow` versé ici serait silencieux).
   *  Aucun `stake` non plus : la CLÉ d'une bande EST l'entrée de règle mise en jeu (une fenêtre par
   *  règle), donc l'enjeu — et la fiche ⓘ — restent ceux de l'ÉTAPE (#1117). */
  meta?: CascadeStepMeta;
  /** DÉTERMINATION (LDB 17 l.59) dépensée SUR CETTE RANGÉE : l'applier de bande lit le flag DE LA RANGÉE
   *  pour ne pas lui appliquer la conséquence, les autres rangées de la bande gardant la leur. */
  immune?: boolean;
  /** SECONDE LECTURE du MÊME dé pour CETTE rangée (Test combiné, `LDB 12 l.202-208`) — cf.
   *  `CascadeSecondRead` : la rangée dit ses deux cibles, un seul jet les tranche. */
  second?: CascadeSecondRead;
}

/** COMPTEUR de l'acteur lisible comme modificateur vivant d'un tirage — d'un dé NU comme d'un lancer
 *  sur TABLEAU (`modPerActor`) — union FERMÉE de champs numériques de `Combatant` : ajouter un
 *  compteur = une entrée ici, jamais un branchement. Aujourd'hui : les Points de Péché (LDB 40 l.46). */
export type CascadeActorCounter = 'sinPoints';

/**
 * LE DÉ D'UNE ÉTAPE DE CASCADE — la DÉCLARATION, sérialisable (coop) : quels dés (`spec`), quel
 * modificateur appliqué au naturel (`mod`, `modPerActor`), quel dé IMPOSÉ (`forcedRoll` — dé posé par
 * un siège, ou injection d'un résolveur moteur), combien de tirages dont on retient le meilleur
 * (`keepHighest`). `result` absent = dé non jeté (interaction `'de'`).
 *
 * FORME UNIQUE des deux LECTURES du dé : nue (le total EST la conséquence — hauteur de chute, unités
 * d'une amputation, dés de dégâts) et en TABLE (`CascadeTableDecl` ci-dessous, qui l'ÉTEND d'un
 * `tableId`). Le tirage est le même geste ; seule la lecture diffère.
 */
export interface CascadeDeTirage {
  /**
   * Les DÉS du tirage (`engine/dice.DiceSpec`, forme canonique partagée avec la Formula `{dice}`).
   *
   * OPTIONNEL ICI, REQUIS À LA PORTE — et la raison est la TABLE : une `TableStepDef` déclare déjà les
   * siens (`die`, d100 par défaut), et les ~20 déclarations de table du dépôt n'ont pas à les répéter
   * pour que la table reste la source de son propre dé (`cascade.tableSpec` : la déclaration l'emporte,
   * la table donne son défaut, d100 sinon). Un DÉ NU, lui, n'a aucune table où les prendre : sa porte
   * les EXIGE au type (`rollSeam.DieStepSpec.spec`, non optionnel) et REFUSE une déclaration non
   * tirable, et `roulerDe` lève plutôt que de replier en silence — il n'y a donc pas de d100 fantasmé
   * pour un dé nu, seulement pour une table qui a le sien.
   */
  spec?: DiceSpec;
  mod?: number;
  forcedRoll?: number;
  /** Modificateur VIVANT : `factor` × le COMPTEUR `counter` de l'ACTEUR de l'étape, lu à l'instant du
   *  TIRAGE et versé dans `mod` par `liveTableDecl` (le seul site qui compose une déclaration).
   *  Déclaré par les tables dont le RAW date le modificateur du LANCER — Colère des dieux, LDB 40
   *  l.53 : « Lorsque vous effectuez un lancer sur le tableau de la Colère des dieux, ajoutez-y +10
   *  pour chaque Point de Péché que vous avez déjà accumulé. » Figer cette valeur à l'OUVERTURE de
   *  l'étape ferait tirer une rafale de Colères au compteur périmé (la 1ʳᵉ expie, la 2ᵉ garderait
   *  l'ancien total). Le `mod` posé à la construction reste ADDITIF (les deux se cumulent). */
  modPerActor?: { counter: CascadeActorCounter; factor: number };
  /** N tirages NATURELS, dont l'étape retient le PLUS ÉLEVÉ (défaut 1). Déclaré par la situation qui
   *  multiplie le lancer : Bénédiction de Sauvagerie, LDB 41 l.170 — « Quand votre cible inflige par la
   *  suite des Blessures Critiques, effectuez deux lancers et choisissez le meilleur résultat. » Le RAW
   *  confie le tri au porteur béni ; « le plus élevé » est la POLITIQUE appliquée à un choix non
   *  surfacé (attaquant conduit par l'IA, cadence auto), et la surface joueur de ce choix est portée
   *  par #982. `forcedRoll` PRIME (un dé POSÉ n'est jamais re-tiré, cf. `roulerDe`). */
  keepHighest?: number;
  /** UNITÉ du total, pour la rangée qui le montre (« m », « jours », « Blessures ») — AFFICHAGE pur :
   *  aucune logique ne la lit. Absente = le total se lit nu. */
  unite?: string;
}

/** LE DÉ NU comme déclaration d'ÉTAPE : le tirage, plus SA lecture — ici la plus pauvre, aucune (le
 *  total EST la conséquence). `CascadeTableDecl` ci-dessous est l'autre lecture du MÊME tirage ; les
 *  deux ne divergent que par leur `result`, ce qui interdit une intersection naïve (le socle prend
 *  donc `CascadeDeTirage` en paramètre partout où il ROULE, jamais la déclaration complète). */
export interface CascadeDeDecl extends CascadeDeTirage {
  result?: CascadeDeResult | null;
  /** LECTURE EN SEUIL de ce tirage (#1508) — troisième lecture du MÊME dé, à côté de la nue (le total EST
   *  la conséquence) et de la table : le total est comparé à un INDICE. Déclaré SUR l'étape, comme
   *  `tableId` l'est pour une table, pour que la rangée MONTRE contre quoi le dé est tombé. */
  seuil?: SeuilDeSauvegarde;
}

/** LE SEUIL d'une sauvegarde « 1d10 ≥ Indice » (Démoniaque `LDB 85 l.98`, Protection `LDB 85 l.278`, et
 *  le Trait qu'un Dôme octroie `LDB 47 l.410`) : l'Indice à atteindre, le TRAIT qui l'offre (id stable —
 *  la graphie est rendue par `formatWardSave`) et sa PROVENANCE (le porteur, ou la zone qui le lui
 *  octroie). JSON-sérialisable : il voyage sur l'étape. */
export interface SeuilDeSauvegarde {
  indice: number;
  traitId: string;
  dome: boolean;
}

/** Issue d'un dé NU (posée par `roulerDe`) : le dé NATUREL (celui qu'un siège pose, celui que la
 *  rangée montre) et le TOTAL qui fait la conséquence (`naturel + spec.plus + mod`). */
export interface CascadeDeResult {
  roll: number;
  total: number;
}

/** TIRAGE SUR TABLE d'une étape de cascade — le MÊME dé (`CascadeDeDecl`), LU en table : le total
 *  sert de dé EFFECTIF au lookup de `tableId` (registre `tableStepDef` de `state/cascade.ts`).
 *  `result` absent = dé non jeté (interaction `'table'`). */
export type CascadeTableDecl = CascadeDeTirage & {
  tableId: string;
  /** PLANCHER : le dé effectif est ramené à la PREMIÈRE ligne de la table au lieu de lever. Déclaré
   *  par les tables dont le RAW borne LITTÉRALEMENT par le BAS — Blessures critiques, LDB 18 l.17 :
   *  « vous ôtez -20 à votre résultat sur le Tableau des Critiques avec un résultat minimum de 01 ».
   *  La borne HAUTE n'est PAS couverte (le RAW cité ne donne qu'un minimum) : un dé effectif au-dessus
   *  de la table reste un fail-fast, `clamp` ou non. */
  clamp?: boolean;
  result?: CascadeTableResult | null;
};

/** Issue d'un tirage sur table (posée par `rollTableStep`) : le dé NATUREL, le dé EFFECTIF qui a servi
 *  au lookup (`roll + mod`), l'id STABLE de la ligne trouvée (toute logique s'y attache — jamais le
 *  libellé) et les lignes de l'entrée (la 1ʳᵉ va sur la rangée `TableRollLine`). */
export interface CascadeTableResult {
  roll: number;
  die: number;
  id: string;
  lines: string[];
}

/** Déclaration de tirage DÉJÀ RÉSOLU — `result` requis (et non nul). Ce que RAPPORTE une surface qui
 *  montre un dé tombé (`revealToStep`), par opposition à la déclaration ouverte `CascadeTableDecl`
 *  qu'une étape à table fait JETER par sa fenêtre (`tableStep`). La distinction est au TYPE : une
 *  déclaration sans résultat passée à une surface de rapport rendrait `stepInteraction` `'table'` —
 *  un tirage à faire, ouvert par une porte qui n'en est pas une, et sans enjeu (#1262 V2 L6). */
export type CascadeTableDone = CascadeTableDecl & { result: CascadeTableResult };

/**
 * ÉTAPE de séquence. Étend `RollParticipant` : une étape MONO est le jet d'un porteur, avec les mêmes
 * drapeaux d'influence qu'une rangée.
 *
 * SAUF `interactive`, RETIRÉ du niveau ÉTAPE (#1262 V2 L4). Il avait UN lecteur — `rollFlowFactory`
 * `passive`, atteint par `FLOWS.cascade` dont les slots SONT les étapes, qui gardait cinq verbes
 * (Résilience, Résistance (Menace), les trois du renversement) — et UN producteur qui le posait à
 * `false` (`shipwreck`, jet pré-roulé d'un nageur non piloté). Ce couple est remplacé par une
 * définition DÉRIVÉE, non déclarable : un slot est passif quand son jet est POSÉ et que son porteur
 * n'est pas SURFACÉ (`rollSeam.surfaceOf`) — plus de booléen qu'un producteur pourrait oublier, ni
 * contredire. Le reste des lectures visait déjà des RANGÉES (`stepReady` batch, `interactiveOf` des
 * modales, `CascadeModal.rollAllRows`), la surface d'une étape se décidant par sa POSSESSION
 * (`modalArbiter`) et son INTERACTION (`stepInteraction`). Plus personne ne le lit ni ne l'écrit :
 * une sauvegarde de la version courante n'en porte plus.
 * Les RANGÉES gardent le leur (`BatchParticipant`, homonyme mais autre champ : il dit qui JOUE, et
 * c'est `surfaceRow` qui le pose).
 */
/** Les deux LECTURES d'un dé d'étape (#1426) — cf. `CascadeStep.evaluation`. */
export type StepEvaluation = 'test' | 'seuil';

export interface CascadeStepBase extends Omit<RollParticipant, 'interactive'> {
  /** Sous-titre de l'étape — CHAMP PILOTE du murage du texte joueur (#1318 V8a₀). RESSERRÉ ici et non
   *  sur `RollParticipant` : la marque entre par l'ÉTAPE de cascade, pas par toutes les rangées de tous
   *  les flux multi d'un coup.
   *
   *  LE MURAGE EST AUX PORTES, pas seulement ici : marquer CE champ ne mordait que sur la déclaration
   *  DIRECTE d'une étape — la voie canonique passe par les 7 constructeurs du seam (`rollSeam` :
   *  `monoStep`/`tableStep`/`choiceStep`/`quantityStep`/`displayStep`/`bandStep`/`hostStep`), dont le
   *  cast interne `as BuiltCascadeStep` BLANCHISSAIT le libellé (mesuré : ~45 sites de production
   *  posaient un littéral, `tsc` vert). Le `label` de leurs SPECS est donc marqué lui aussi : la marque
   *  est exigée EN AMONT, au paramètre, et le cast de sortie n'a plus rien à blanchir. Restent murés par
   *  le lint les deux voies de CONTENEUR (`Object.assign` sur une étape, `x as CascadeStep`).
   *
   *  `PlayerText` n'a que trois origines (`i18n.t`, `data.dataLabel`/`data.refLabel`,
   *  `rollSeam.composeRollLabel`) — un littéral ne s'y pose plus, et le stock d'avant est ÉTEINT : le
   *  fossile qui le gelait est mort, son cliquet reste en tripwire (`player-text-ratchet.test.ts`). */
  label?: PlayerText;
  /** Nature de la conséquence (clé de `cascadeAppliers`). Ex. 'recovery' | 'nightmare' | 'exposure'. */
  kind: string;
  /** Héros qui lance (résolu via `actorIn`). Absent → étape de groupe (rare). */
  actorId?: string;
  icon?: string;
  /** Étape-JET : le jet d'attaque/Piétinement/défense/magie/Test/désengagement/porte EST l'étape 0 de
   *  la séquence, rendu par `CascadeModal` via le hook ou la modale correspondante (`useAttackJetProps`/
   *  `useTrampleJetProps`/`useDefenseJetProps`/`useTestJetProps`/`useExtendedTestJetProps`/`CastModal`/
   *  `DisengageModal`/`ForceDoorModal`) → une seule fenêtre. Les données vivent dans `pendingAttack`/
   *  `pendingTrample`/`pendingDefense`/`pendingCast`/`pendingTest`/`pendingExtendedTest`/`pendingDisengage`/
   *  `pendingForceDoor` (coexistants — comme l'attaque), résolus par leur `xConfirm`/`xNext` qui ferme la cascade. */
  jet?: 'attack' | 'trample' | 'defense' | 'fumble' | 'cast' | 'test' | 'extended' | 'disengage' | 'forceDoor';
  /** Étape de GROUPE (action collective : enfoncer une porte à plusieurs) — l'arbitre coop lui donne
   *  l'owner '*' (chacun pilote ses héros) au lieu de `actorId` (une étape forceDoor n'a pas d'acteur
   *  unique). Absent sur les autres `kind` → repli sur `actorId` (identique à aujourd'hui). */
  groupOwner?: boolean;
  /** Étape SUBIE par le siège MONDE (côté `worldSide` du seam de jet, #275 Décision 3 — désertion,
   *  Moral, périls sans acteur unique) : aucun `actorId`, l'arbitre route l'owner au siège MJ (`gmSeat`)
   *  quand il existe, à l'hôte sinon (`netOwnership.seatOwns` via le sentinel `WORLD_STEP_OWNER`). */
  worldOwner?: boolean;
  /** Libellé du Test affiché (« Résistance », « Calme », « Survie en extérieur »…) — la COMPÉTENCE
   *  lancée, pas la situation. LIÉ À `target` par le TYPE (cf. `CascadeStep` en fin d'interface) : une
   *  étape qui lance en porte un, une étape sans jet n'en porte pas. */
  rollLabel?: string;
  /** ENJEU de l'étape (#331/#1117) : ce que le jet met en jeu — une RÉFÉRENCE de donnée (`StakeRef` :
   *  clé de dataset + valeurs calculées), JAMAIS un texte. Le résolveur UNIQUE (`resolveStake`) rend
   *  le texte ET la fiche de règle au moment de l'affichage : un producteur ne peut ni écrire l'enjeu
   *  ni nommer sa règle (arbitrage Z5 appliqué à sa propre zone). */
  stake?: StakeRef;
  /** Fiche de RÈGLE d'une étape SANS enjeu (choix de voie : la règle encadre le choix, aucun jet n'est
   *  encore mis en jeu). Une étape POURVUE d'un `stake` dérive sa règle du dataset — jamais ici. */
  stakeRule?: { category: string; id: string };
  /** Niveau de Compétence NU du Test (`skillBaseValue`, `LDB 09 l.17`) — affichage ET grandeur du
   *  départage à DR égal (`LDB 12 l.160`, `engine/tests.openValues`). CONTRAT UNIQUE : tout producteur
   *  d'étape (porte du seam `rollSeam.buildMonoStep` comme flux qui bâtit ses étapes à la main) y pose
   *  la NUE par l'accesseur, jamais une valeur fondue ni une soustraction ; les modificateurs — États,
   *  Encombrement, passifs, SOUTIEN (`soutienMod`) — vivent en lignes NOMMÉES de `mods`, et la
   *  Difficulté dans `difficulty`. La CIBLE (`target`), elle, dérive de la valeur fondue. */
  base?: number;
  /** Modificateurs circonstanciels NOMMÉS de la ligne (compris dans `target`) — un malus RAW qui n'est
   *  PAS une Difficulté (dérive MSRC 7 l.38, hors de contrôle l.41, −5 cumulatif du redressement l.40)
   *  se nomme ICI : aucun +N anonyme dans la cible. La Difficulté, elle, voyage dans `difficulty`. */
  mods?: ModLine[];
  /** Cible EFFECTIVE (difficulté déjà appliquée → Test « +0 » sur `target`). Absent → étape sans jet. */
  target?: number;
  /**
   * COMMENT le dé se LIT (#1426). Absent = `'test'` : la lecture WFRP complète — bandes automatiques
   * (LDB 12 l.28), Degrés de Réussite, écrêtage de la cible aux bornes de `TestPolicy`.
   *
   * `'seuil'` = POURCENTAGE PUR : `dé ≤ nombre visé`, RIEN d'autre. Aucune bande, aucun DR, aucun
   * écrêtage. C'est ce que le RAW décrit quand il écrit « Lancez un d100 : si le résultat est
   * inférieur ou égal au chiffre final, un acheteur est trouvé » (MSRC 13 l.146) ou « Lancez 1d100 et
   * si le résultat est inférieur ou égal au nombre visé, vous trouvez un acheteur » (MDG 15 l.362) —
   * les mêmes pages écrivent « Test de Ragot Complexe (–10) » trois lignes plus haut quand elles
   * veulent un Test. Un nombre visé de 100 vaut donc 100 %, et un 03 ne réussit pas d'office.
   *
   * Le champ est ABSENT partout où le comportement ne change pas : aucune étape existante à migrer.
   */
  evaluation?: StepEvaluation;
  /** ÉCRÊTAGE réellement subi par `target` aux bornes de `TestPolicy` (`engine/tests.clampTarget`) —
   *  une base SOUTENUE peut dépasser le plafond, et l'écart doit se NOMMER (« plafond 99 ») au lieu
   *  d'être avoué « autres » par le réconciliateur de `RollLine`. Mesuré à la construction. */
  clamped?: number;
  result?: CascadeRoll | null;
  /** Étape à TABLE (#942 L2) : un TIRAGE SUR TABLEAU est l'interaction `'table'` — le dé de l'étape se
   *  jette sur `table.tableId` (registre `tableStepDef`), `rollTableStep` pose `table.result` (dé
   *  naturel + dé effectif + id de ligne + lignes). Résolue → l'étape s'affiche comme les autres
   *  (rangée `TableRollLine` + lignes de l'entrée). Une étape peut porter `table` ET `reveal` (charge
   *  riche du Critique) : la déclaration du tirage et son rendu détaillé sont deux choses. */
  table?: CascadeTableDecl;
  /** Étape à DÉ NU (#1508) : un TIRAGE dont le TOTAL est la conséquence (hauteur d'une chute, unités
   *  d'une amputation, magnitude d'un effet, distance d'une dispersion) est l'interaction `'de'` —
   *  MÊME dé, MÊME pose, MÊME rangée qu'une table, sans lecture en table. `roulerDe` pose `de.result`
   *  (dé naturel + total). Le porteur du dé est UNIQUE sur l'étape : `de` et `table` sont deux
   *  LECTURES du même geste, jamais deux dés à jeter dans la même fenêtre. */
  de?: CascadeDeDecl;
  /** PROVENANCE du dé de cette étape : SAISI par le joueur (option de confort « Dés fixés »,
   *  `engine/fixedDie.ts`) et non tiré. Écrit par la fabrique de flux pour une étape-JET
   *  (`commit(..,{fixed:true})`) et par `setCascadeTableForcedRoll` pour une étape à TABLE. Lu par la
   *  rangée (`RollRow.fixedMark`) et par le marquage du journal (`fixedDieMark.slotFixed`, qui parcourt
   *  les `participants` des slots ouverts). */
  fixed?: boolean;
  /** Paramètres sérialisables de la conséquence (jamais de closure — coop) ; cf. `CascadeStepMeta`
   *  (primitives + Flows `onSuccess`/`onFail` de l'étape générique `triggeredTest`). */
  meta?: CascadeStepMeta;
  /** Étape déjà validée (conséquence appliquée). */
  committed?: boolean;
  /** Conséquence appliquée à la validation (journal) — gardée pour rester lisible dans la pile.
   *  Ligne STRUCTURÉE (#349) : `RecapLine[]`, rendue par le renderer partagé `ui/RecapLine.tsx`. */
  outcome?: RecapLine[];
  /** Charge RICHE d'une étape d'affichage (Coup Critique, entretien de Round, mutation, effet
   *  d'auteur, entrée de zone) — rendue par le panneau partagé `ui/RevealBody.tsx`, routé par `kind`. */
  reveal?: RevealEntry;
  /** AUTO-FERMETURE de l'étape d'AFFICHAGE (ms) : passé ce délai, la séquence avance d'elle-même
   *  (`CascadeModal`), le clic « Continuer » restant toujours servi. ABSENT par défaut — la fermeture
   *  d'une révélation est EXPLICITE (arbitrage #1270) ; un site qui veut le timer le DÉCLARE
   *  (`revealToStep`, option `autoClose`). Indépendant de la CADENCE de combat (une cadence manuelle
   *  auto-ferme quand même : c'est la propriété de l'étape, pas du pilote). */
  autoCloseMs?: number;
  /** Étape de CHOIX « déviation » (folding P3a) : porte le Critique pré-tiré + le contexte d'attaque
   *  (JSON-sérialisable) ; l'applier appelle `resolveDeviation(step.deviation, chosen)`. */
  deviation?: PendingDeviation;
  /** Étape à TABLE « sévérité du Critique » (#942 L4) : le d100 de la table de Blessures est resté à
   *  poser ; l'applier construit le Critique sur le dé posé et rejoue `applyAttackResult`. */
  critSeverity?: PendingCritSeverity;
  /** Étape de SAUVEGARDE « 1d10 ≥ Indice » (#1508) : les seuils restants + la suite du coup suspendu.
   *  L'applier lit le dé (`cascade.lireEnSeuil`) puis RÉ-ENTRE dans le site d'origine — patron de
   *  `critSeverity`, dont la charge rejoue `applyAttackResult` avec le Critique construit. */
  wardSave?: PendingWardSave;
  /** Étapes à TABLE de la MUTATION de Corruption (#942 L5) : les d100 des tirages chaînés (nature →
   *  Tableau → sous-table) sont restés à poser ; l'applier de chaque étape lit le dé posé, INSÈRE
   *  l'étape suivante s'il en reste une, et applique la mutation au dernier niveau. */
  mutation?: PendingMutationStep;
  /** Étape à TABLE de l'INCANTATION IMPARFAITE / Colère des dieux (#942 L6) : le d100 de la table est
   *  resté à poser ; l'applier lit le dé posé, INSÈRE l'étape de la relance prescrite s'il y en a une
   *  (LDB 46 l.54-55), et applique le contrecoup sur une ligne terminale. */
  miscast?: PendingMiscastStep;
  /** Étape de CHOIX « piège-lame » (folding P3b) : contexte du Test opposé ; l'applier appelle
   *  `resolveBladeTrap(step.bladeTrap, chosen === 'trap')`. */
  bladeTrap?: PendingBladeTrap;
  /** Étape de REPRISE « fuite » (LDB 15 l.68) : le coup dans le dos a SUSPENDU son application (choix
   *  de Déviation Critique du fuyard) ; une fois le Critique tranché, l'applier `fleeMove` complète la
   *  fuite (États Brisés + libération des Engagements + budget de Course) — jamais avant. */
  fleeMove?: { moverId: string; foeId: string; broken: number };
  /** Étape-JET « Maladresse » (LDB 14, Tableau des Oups !) : SOURCE UNIQUE de la maladresse — l'arme
   *  utilisée + le résultat tiré vivent ICI (l'acteur est `actorId`). Plus de `pendingFumble` top-level
   *  parallèle à désynchroniser : si l'étape existe la donnée existe, si la cascade ferme la maladresse
   *  s'en va — orphelin structurellement impossible. Flux : `fumbleRoll` (rollOups → result),
   *  `fumbleConfirm` (applyOups). */
  fumble?: { weapon: Weapon; result: OupsResolved | null };
  /** DÉCLARATION d'une BANDE de Psychologie À LA RENCONTRE (LDB 21) : l'entrée de règle mise en jeu
   *  — type psy + source + cible + Indice — face à laquelle les héros appelés à l'entrée de scène sont
   *  les RANGÉES (`participants`, `aggregate:'none'`). L'applier 'encounterPsych' pose le `psychState`
   *  RANGÉE PAR RANGÉE ; Détermination (LDB 17 l.59) jouée par rangée (`BatchParticipant.immune`). */
  encounterPsych?: { kind: PsychType; sourceId: string; sourceName: string; indice: number; cible?: string };
  /** DÉCLARATION d'une BANDE de Psychologie EN COMBAT (LDB 21) : l'entrée de règle mise en jeu — type
   *  psy + source + cible + Indice — face à laquelle les héros appelés sont les RANGÉES
   *  (`participants`, `aggregate:'none'`). Les Traits ciblés ET les NOUVELLES Terreurs se testent au
   *  DÉBUT du Round (l.14) ; la Peur est un Test ÉTENDU testé à la FIN de chaque Round (l.25), dont le
   *  DR déjà cumulé (`meta.prevDR`) et l'allègement Sans Peur (`meta.sansPeur`) vivent PAR RANGÉE.
   *  Distinct d'`encounterPsych` (simple) car la Peur de combat est ÉTENDUE. Détermination = immunité
   *  (LDB 17 l.59), jouée par rangée (`BatchParticipant.immune`). */
  combatPsych?: { kind: PsychType; sourceId: string; sourceName: string; indice: number; cible?: string };
  /** Étape « choix » : options présentées au joueur (l'option retenue pilote la conséquence). Leur
   *  `label` est du TEXTE JOUEUR marqué (#1318 V8a₁), comme celui de l'étape qui les porte. `refus` =
   *  la CAUSE d'indisponibilité de CETTE option (coût d'Avantage hors de portée…), rendue au survol/
   *  focus/tap par `OptionChooser`/`GatedAction` — jamais en texte inline (arbitrage 2026-08-24). */
  options?: { key: string; label: PlayerText; detail?: string; refus?: string }[];
  /** Option retenue (clé) — analogue de `result` pour une étape « choix ». */
  chosen?: string;
  /** Clé consommée par `runCascadeImmediate` (résolution immédiate) SEUL — SANS elle, une cascade
   *  immédiate s'arrête PENDANTE sur ce choix (#351) ; « Tout résoudre » (`resolveRemainingCascade`)
   *  s'arrête TOUJOURS sur un choix depuis 249e931f, ignore ce champ. */
  defaultChoice?: string;
  /** Étape « quantité » (6ᵉ interaction, #1279 Sf) : SAISIE NUMÉRIQUE BORNÉE — le joueur pose un
   *  NOMBRE entre `min` et `max` (pas `step`, défaut 1). Elle existe parce qu'une décision à plage
   *  large n'est pas une décision à options : « autant de points que vous le souhaitez, entre 1 et
   *  100 » (`NADJ 16 l.97`) sort en 100 boutons, complet et illisible. GÉNÉRIQUE : la plage est
   *  DÉCLARÉE par l'étape, aucun domaine n'est nommé ici. `unit` (pluriel, affichage) nomme ce qui se
   *  compte quand ce n'est pas évident. */
  quantity?: { min: number; max: number; step?: number; unit?: string };
  /** Nombre posé — analogue de `chosen` pour une étape « quantité ». Le mint (`rollSeam.quantityStep`)
   *  le pose À LA CONSTRUCTION à sa valeur d'ouverture : un compteur n'a pas d'état « vide », et une
   *  étape prête d'emblée reste jouable en résolution immédiate sans second champ de défaut. */
  amount?: number;
  /** SECONDE LECTURE du MÊME dé (Test combiné, `LDB 12 l.202-208`) — cf. `CascadeSecondRead`. */
  second?: CascadeSecondRead;
  /** Étape À PARTICIPANTS (batch multi, seam de jet #275 Décision 4 cran 1) : UNE rangée par
   *  contributeur GÉNÉRIQUE (`BatchParticipant`, résolu via le flux `cascadeBatch`), influençable
   *  INDÉPENDAMMENT. Prête quand tous les participants INTERACTIFS ont `result` (`stepReady`) ;
   *  `commitStep` agrège alors (`aggregate`, défaut `summed-dr` ; `'none'` = jets INDÉPENDANTS, RIEN
   *  d'agrégé, #351) dans `step.result` avant d'invoquer l'applier — l'applier lit `step.result` comme
   *  une étape mono, kind-agnostique (sauf `'none'` : chaque `participants[i].result`). `target`/`base` de
   *  l'ÉTAPE restent absents (le jet vit sur chaque participant). Les paramètres de la formule d'agrégat
   *  (`aggregateFlatDR`/`aggregateCapTo`/`aggregateOpposeSl`) sont posés en `meta` NEUTRE à la
   *  construction par le flux propriétaire (le naval y verse Moral/Manque de bras/sabotage déjà chiffrés). */
  participants?: BatchParticipant[];
  /** Agrégation de `participants` (défaut `summed-dr`, Test d'équipage MDG 14 l.13 ; `'none'` = jets
   *  indépendants, #351). */
  aggregate?: CascadeAggregate;
  /** MÉMO du PLI post-dé de CETTE étape, keyé par la valeur du dé (`cascade.tableStepResolved`) : ce que
   *  le `kind` a dérivé la PREMIÈRE fois que ce dé est tombé sur cette étape. Existe parce qu'un pli peut
   *  être IMPUR (la sévérité d'un Critique consomme du RNG) : sans mémo, re-poser le MÊME dé rendrait une
   *  AUTRE conséquence. Porté par l'ÉTAPE (jamais un cache global) — il naît et meurt avec elle, et
   *  survit au snapshot JSON (sauvegarde, coop) comme le reste de l'étape. */
  foldMemo?: Record<string, CascadeStep>;
}

/** Étape qui LANCE un dé : `target` (cible effective) et `rollLabel` (compétence lancée) vont
 *  ENSEMBLE — la ligne de jet a besoin des deux (`RollLine`, contrat d'affichage `docs/charte-ui.md`). */
export type CascadeRollStep = CascadeStepBase & { target: number; rollLabel: string };

/**
 * UNE étape de cascade : elle LANCE (cible + libellé de ligne) ou elle ne lance pas (affichage, choix,
 * table, batch — ni l'un ni l'autre). Le lien est porté par le TYPE, pas par un repli d'affichage :
 * `CascadeModal` n'a plus de « Jet » de secours à écrire quand un constructeur oublie le libellé —
 * l'oubli ne compile pas (#1078 LOT C1).
 */
export type CascadeStep = CascadeRollStep | (CascadeStepBase & { target?: undefined; rollLabel?: undefined });
/**
 * CASCADE séquentielle influençable (régime choisi par l'utilisateur pour les jets de NUIT et de
 * VOYAGE — cf. docs/superpowers/specs/2026-06-14-multi-roll-modal-design.md, Étape 3) : on présente
 * UNE étape à la fois, chacune avec son cycle Chance/+1 DR/Pacte/Résilience, on valide, on enchaîne.
 * `participants` = les seules étapes INFLUENÇABLES (les notes en clair vont dans `log`). `cursor` =
 * l'étape courante. À la validation d'une étape, sa conséquence est appliquée (`cascadeAppliers`) et
 * elle peut INSÉRER des étapes suivantes (dépendance : abri → nombre de jets d'Exposition). `purpose`
 * pilote la FINALISATION (reprise de voyage…). Même fabrique que le Test Étendu — seule la sémantique
 * d'étape (conséquence par `kind` au lieu d'un cumul de DR) change. */
export interface PendingCascade extends MultiPending<CascadeStep> {
  title: string;
  icon?: string;
  /** Index de l'étape courante dans `participants`. */
  cursor: number;
  /**
   * COMPTEUR MONOTONE de poussées de cette séquence (#1508) — la source de l'IDENTITÉ des étapes
   * appendues (`cascade.pushStep` le sert à la fabrique, `rollSeam.pushDie` en fait son id).
   *
   * Un compteur, jamais `participants.length` : la longueur RECULE (troncature `stopSequence`, préfixe
   * d'une séquence suspendue), et un id déjà porté par un survivant serait re-servi — deux étapes de
   * même id, et la suite d'un dé accrochée au mauvais porteur. Sérialisé avec la cascade : il traverse
   * la sauvegarde et le réseau, comme les ids qu'il produit.
   *
   * Il vit chez le PILOTE pendant qu'une séquence se joue (`cascade.PiloteDuCommit.seq`) et revient ici
   * à chaque écriture du slot : le goulot ne le relit pas du store, qu'un pilote peut n'avoir pas encore
   * écrit — c'est ce qui le garde monotone sur les trois pilotes.
   */
  seq?: number;
  /** Journal de la cascade (entretien, conséquences validées) — affiché sous l'étape courante. */
  log: string[];
  /** Finalisation : 'night' (bilan de repos), 'travel' (halte → reprise), 'travelDay' (jets du JOUR de
   *  voyage — fluvial/… : à la clôture, le store recalcule la progression du jour puis enchaîne halte/
   *  arrivée via le handler du domaine), 'test' (autonome), 'combat' (conséquences d'un jet de combat —
   *  fermeture simple, pas de reprise), 'sequence' (manche d'une SÉQUENCE — poursuite terrestre, jeu de
   *  taverne opposé… : à la clôture le store passe la manche au réducteur du socle, qui rouvre ou dénoue,
   *  cf. state/sequenceCore) ; 'seaScorbut'/
   *  'seaExhaustion' : les BANDES de l'entretien-survie maritime (Scorbut MDG 14 l.230, Épuisement
   *  MDG 13 l.109-111) — une rangée par héros appelé, surfacée dès qu'un siège humain tient l'un d'eux
   *  (`rollSeam.surfaceDesEtapes`, #1479) ; à la clôture, le store enchaîne la phase suivante de la
   *  journée (`continueSeaDayAfterScorbut`/`continueSeaDayAfterExhaustion`) ;
   *  'seaActivities' (#273 Étape 2 : Activités en mer hebdomadaires, MDG 15 l.266-306)
   *  — à la clôture, le store enchaîne `continueSeaActivitiesAfterCascade` (Commerce d'opportunité
   *  séquencé puis halte de nuit, `seaActivities.ts`) ; 'riverExposure' (MSRC 16 : Exposition hydrique de
   *  la descente fluviale surfacée APRÈS le jour, avant la halte — la clôture enchaîne
   *  `continueRiverDayAfterExposure`, `riverVoyageFlow.ts`, pour DIFFÉRER la halte de nuit le temps du
   *  Test de Résistance, cf. #344). 'upkeep' (entretien quotidien d'une AVANCE D'HORLOGE hors repos/voyage
   *  — Faim/Soif/maladie/convalescence/dessoûlage différés ; clôture sans suite propre, `dispatchCascadeDone`
   *  n'a qu'à vérifier l'anéantissement). 'interlude' (#942 L7 : les d100 d'Événement « Entre deux
   *  aventures » restés à poser, un par héros, puis le dénouement de GROUPE des bourses en étape
   *  FINALE — la phase 'tirage' de `InterludeState` dure le temps de cette séquence ; clôture sans
   *  suite propre, le dénouement vit dans l'applier de sa dernière étape). 'affichage' (#942 L8 :
   *  séquence d'AFFICHAGE PUR — étapes sans jet ni choix, poussées hors combat par `pushReveal` quand
   *  aucune séquence n'est en vol ; clôture sans AUCUNE suite propre, `dispatchCascadeDone` n'a qu'à
   *  reprendre une éventuelle séquence parquée). */
  purpose: 'night' | 'travel' | 'travelDay' | 'test' | 'combat' | 'sequence' | 'seaScorbut' | 'seaExposure' | 'seaExhaustion' | 'seaActivities' | 'riverExposure' | 'upkeep' | 'interlude' | 'affichage';
  /** HALTE de voyage : la finalisation REPREND la route (continueTravelAfterNight). */
  travelHalt?: boolean;
  /** Cascade de PEUR de FIN de Round (combat) : à sa fermeture, le store ré-appelle `resolveRoundBoundary`
   *  pour enchaîner sur la pause de début de Round (la Peur est désormais marquée testée ce Round). */
  roundBoundary?: boolean;
  /** Cascade de FIN DE COMBAT (Tests de Résistance maladie/Corruption des héros survivants, LDB 18/19/20)
   *  ouverte AVANT l'écran de victoire : à sa fermeture, le store enchaîne sur `finishCombatEnd` (writeback
   *  + écran de victoire/défaite) au lieu de reprendre l'IA. */
  combatEndBoundary?: boolean;
  /** Cascade de DÉFENSE à une MANŒUVRE de zone IA (Souffle/Vomi/Regard/Étreinte/Langue, LDB 85) : chaque
   *  héros ciblé y jette sa réaction INFLUENÇABLE. À la fermeture, le store REPREND le tour de la créature
   *  `attackerId` (attaques gratuites restantes puis avance) au lieu du `resumeSuspendedAI` générique —
   *  `free` = la manœuvre était une attaque gratuite (ne re-déclenche pas les libres d'Arme post-Action). */
  maneuverResume?: { attackerId: string; free: boolean };
  /** ACCOSTAGE à finaliser À LA CLÔTURE (MDG 15 l.245) : une cascade dont la fermeture doit résoudre
   *  l'événement de port puis transitionner vers la scène du lieu — porté par la désertion à la relâche
   *  (`resolveShoreLeave`), surfacée au siège MJ (`travelPlan` déjà nul à l'accostage, hors de la branche
   *  générique `purpose:'test' && travelPlan.sea`). La clôture (`dispatchCascadeDone`) enchaîne
   *  `finalizePortArrival` — `resolvePortArrival` peut ouvrir SA propre cascade (`openEmbrigadementRecovery`)
   *  sans garde de synchro puisque `pendingCascade` est DÉJÀ null post-`advanceCascade` (#387, patron #383). */
  portArrival?: { toPlaceId: string; allow: boolean };
  /** Repos MULTI-JOURS authoré (#347, `state/restFlow.ts`) : nuits ENCORE à enchaîner après CETTE
   *  cascade + le contexte de repos (couchage/pitance par héros) nécessaire pour reconstruire la nuit
   *  suivante. La clôture ('night' purpose) enchaîne `continueRestNights` tant que `nightsLeft > 0` —
   *  CHAQUE nuit reste sa PROPRE cascade influençable (patron #253, jamais un jet pré-résolu) ; la nuit
   *  N+1 ne peut PAS être pré-construite avant que la nuit N soit validée (l'entretien du jour N+1 lit
   *  l'état MUTÉ par la nuit N — compteurs de faim/soif, jours de maladie…). */
  restNights?: { p: import('./restFlow').PendingRest; nightsLeft: number };
}

/** Soin de Guérison en attente (LDB 09-Compétences) : flux modale — « Lancer » (healRoll) → Chance
 *  (relance / +1 DR) → Résilience → « Appliquer » (healConfirm). Soigneur/cible résolus par `actorIn`
 *  (combat ⇄ groupe, cf. combatOrParty). `intBonus` figé à l'ouverture. La CHIRURGIE n'est PLUS un
 *  mode de pendingHeal : c'est une opération « armée » sur l'infirmerie (state/medicFlow). */
export interface PendingHeal {
  healerId: string;
  healerName: string;
  targetId: string;
  targetName: string;
  mode: HealMode; // 'wounds' | 'bleed' | 'trauma' | 'ammo' (jamais 'surgery'/'recovery' — cf. medicFlow)
  intBonus: number; // Bonus d'Intelligence du soigneur
  skillValue: number; // testValue(soigneur, 'Guérison') — Soutien FONDU
  /** SOUTIEN (LDB 12) des assistants de soin, déjà fondu dans `skillValue` — porté pour l'affichage. */
  support?: SupportDetail;
  difficulty: Difficulty; // 'intermediaire' (+0, LDB 09 l.243)
  target: number; // cible effective (affichage)
  roll: number | null; // null tant que pas lancé (Chance possible ensuite)
  success: boolean;
  sl: number; // DR
  rerolled?: boolean;
  /** Acte PAYANT d'un PNJ (infirmerie) : prix déjà débité — remboursé si Annuler AVANT le jet. */
  paidCost?: { gold?: number; silver?: number; brass?: number };
}

/** Chirurgie (Test ÉTENDU multi-passes, LDB 10 l.184 / 12 l.200) — le Test de Médecine d'UNE passe,
 *  DIFFÉRÉ en modale INFLUENÇABLE (« un jet = une modale ») : le chirurgien peut être un HÉROS, qui
 *  dépense Chance/Pacte/Résilience sur SON jet (PNJ → `actorIn` introuvable → influence no-op, comme
 *  `PendingHeal`). Calque `PendingHeal` (jet du soigneur) + `PendingExtendedTest` (cumul du DR). Le cumul
 *  et la sélection patient/Critique vivent sur `medic.surgery` (état de setup) ; chaque passe inflige
 *  1d10 PB + 1 Hémorragie à la validation (`surgeryNext`). `traumaIdx/targetDR/cumDR` sont recopiés de
 *  `medic.surgery` à l'ouverture de la passe (affichage DrBar dans la modale). */
export interface PendingSurgery extends PendingBase {
  healerId: string; // chirurgien (héros → influence ; PNJ → no-op)
  healerName: string;
  targetId: string; // patient opéré
  targetName: string;
  skillValue: number; // testValue(chirurgien, 'Guérison') — Soutien FONDU
  /** SOUTIEN (LDB 12) des assistants de chirurgie, déjà fondu dans `skillValue` — porté pour l'affichage. */
  support?: SupportDetail;
  intBonus: number; // Bonus d'Intelligence du chirurgien
  difficulty: Difficulty; // 'intermediaire' (+0)
  target: number; // cible effective d'une passe (affichage) = skillValue
  roll: number | null; // null tant que pas lancé (Chance possible ensuite)
  success: boolean;
  sl: number; // DR de la passe
  traumaIdx: number; // Blessure Critique visée (index dans surgeryTraumas) — figé de medic.surgery
  targetDR: number; // DR cumulé cible (LDB 10) — recopié de medic.surgery (DrBar)
  cumDR: number; // DR cumulé courant — recopié de medic.surgery (DrBar)
  /** Acte PAYANT d'un PNJ (infirmerie) : prix déjà débité — remboursé si on annule AVANT toute passe. */
  paidCost?: { gold?: number; silver?: number; brass?: number };
}
