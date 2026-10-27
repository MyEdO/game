/**
 * REGISTRE des modales de combat (R2 + coop) — une entrée par modale, l'ORDRE du tableau est la
 * priorité d'affichage. Chaque entrée déclare :
 *  - `when`  : le pending qui l'active ;
 *  - `owner` : le combattant CONCERNÉ (gating coop « chacun voit SES modales » + validation des
 *              intents côté hôte) — `'*'` = tout le monde (sort ennemi : Contre-sort multi),
 *              `undefined` = aucun acteur joueur → l'HÔTE seul.
 *  - `auto`  : POLITIQUE d'automatisation « Cadence de combat » (cf. `combatAuto.ts`) — REQUISE :
 *              ajouter une modale FORCE à déclarer comment elle s'auto-résout (le commit ne compile
 *              pas sinon → exhaustivité garantie). `self` = jet propre (drive = actions à enchaîner),
 *              `choice` = vrai choix joueur (Rapide laisse ; l'IA tranche en Auto-combat), `partial` =
 *              pilote dédié (cascade pas-à-pas, révélation auto-acquittée), `hostOnly` = hors-combat / jamais auto.
 *
 * AJOUTER UNE MODALE = UNE entrée ici (+ son composant dans `ui/ActiveModal.COMPONENT`).
 * `pickActiveModalKey` et `modalOwnerOf` sont DÉRIVÉS du registre — rien d'autre à toucher.
 */
import type { Jeu } from './etat';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { FlowKey } from './flowVerbs';
import { WORLD_STEP_OWNER } from './pendings';
import type { PendingKey } from './stateFields';
import { sansCorps } from './slotsDeJet';
import { rangeesDuesDeChute } from './fallMove';

/** État partiel accepté par l'arbitre (les tests passent des objets minces). */
export type ArbiterState = Partial<Jeu>;

/** Verbes qu'un joueur JOUE dans une fenêtre (jet, choix, confirmation, refus) : des actions de la partie. */
export type VerbesDeFenetre = readonly (keyof ActionsDuNoyau)[];

/** La déclaration EXPLICITE d'une fenêtre sans verbe de joueur à elle (pur affichage, ou geste de l'hôte seul) :
 *  une liste vide anonyme ne la vaut pas (`fenetres-nomment-leurs-verbes.hors-store.test.ts`). */
export const AUCUN_VERBE_DE_JOUEUR: VerbesDeFenetre = Object.freeze([]);

/** Une rangée d'une fenêtre à plusieurs jets : l'id que ses verbes prennent en premier argument (`pid`). */
export interface RangeeDeFenetre { id: string; interactive?: boolean; result?: unknown }

/**
 * Politique d'auto-résolution d'une modale (Cadence Rapide/Auto). Les noms d'actions de `drive` sont
 * des résolveurs RÉELS du store (typés `keyof Jeu`, vérifiés par `modalAuto.valid.test.ts`) —
 * jamais une dérivation (le mapping clé→action n'est PAS 1:1 : `stateRecovery`→`recover*`,
 * `corruption`→`resolveCorruption`…). Les jets de COMBAT (attaque/défense/cast/…) sont des étapes de la
 * `cascade` (`partial`), pilotées via `JET_AUTO` dans `combatAuto`.
 */
export type AutoPolicy =
  | { mode: 'self'; drive: readonly (keyof Jeu)[] }                  // jet propre : enchaîner roll → confirm
  | { mode: 'choice'; autoDrive?: readonly (keyof Jeu)[] }           // vrai choix : Rapide LAISSE (joueur) ;
                                                                            // Auto-combat tranche — `autoDrive` = actions à
                                                                            // enchaîner si l'IA doit le résoudre (ex. cast)
  | { mode: 'partial' }                                                    // cascade / révélation : pilote dédié (combatAuto)
  | { mode: 'hostOnly' };                                                  // hors-combat / hôte : jamais auto-résolu

export interface ModalDef {
  key: string;
  /** Le pending de cette modale est-il posé ? (condition d'ÉLECTION : la fenêtre à RENDRE) */
  when: (s: ArbiterState) => boolean;
  /** La situation TIENT-ELLE LA MAIN, même sans fenêtre rendue ? Défaut : `when`. Une modale peut
   *  déléguer son geste à la CARTE (désignation de cibles d'un sort) : plus de fenêtre à élire, mais
   *  les gestes qui ENGAGENT ou QUITTENT le tour restent fermés (#1852) — la situation, elle, dure.
   *  Lu par `modalHolds` (gardes clavier/manette), jamais par le rendu. */
  tientLaMain?: (s: ArbiterState) => boolean;
  /** Combattant concerné ('*' = tous ; undefined = hôte seul). */
  owner: (s: ArbiterState) => string | undefined | '*';
  /** Politique d'automatisation (Cadence de combat) — REQUISE. */
  auto: AutoPolicy;
  /** Clé(s) `pending*` que CETTE modale possède/rend — REQUISE (patron `auto` ci-dessus, #284). Une
   *  entrée normale porte SA seule clé (`'fateSave'` → `['pendingFateSave']`) ; `cascade`/`medic`
   *  couvrent en plus les pendings COEXISTANTS qu'elles rendent (porteurs de données d'une étape —
   *  `pendingAttack`/`pendingCast`/… sont rendus par elles, cf. commentaires ci-dessous). Preuve
   *  exhaustive AU COMPILATEUR : `_pendingOwnerCoverageCheck` (fin de fichier) exige que l'union
   *  `covers` + `HORS_MODAL` reproduise EXACTEMENT `PendingKey` — un `pending*` oublié ne compile pas. */
  covers: readonly PendingKey[];
  /** Les flux de jet (`FLOW_VERBS`) que la fenêtre rend : leurs verbes et leurs clôtures sont les siens. */
  flux?: readonly FlowKey[];
  /** Les verbes du joueur que ni `auto` ni `flux` ne nomment. La fenêtre nomme ce qu'on y joue
   *  (`fenetreDuJeu`, `verbesDeLaFenetre`). */
  verbes?: VerbesDeFenetre;
  /** Les rangées que ses verbes désignent par leur id (`pid`) — REQUISES quand un de ses `flux` est multi : la fenêtre
   *  rend l'id de la rangée due (`fenetreDuJeu`). */
  rangees?: (s: ArbiterState) => readonly RangeeDeFenetre[] | undefined;
}

export const MODAL_DEFS = [
  { key: 'fateSave', when: (s) => !!s.pendingFateSave, owner: (s) => s.pendingFateSave?.heroId, auto: { mode: 'choice' }, covers: ['pendingFateSave'], verbes: ['fateNegate', 'fateSurvive', 'fateAccept'] },
  // (La Maladresse est une étape `jet:'fumble'` de la cascade `combat`, rendue par `cascade` ci-dessous
  //  (CascadeModal → useFumbleJetProps). La donnée (arme/résultat) vit SUR l'étape (`step.fumble`), source
  //  unique lue par `fumbleRoll` ; `fumbleConfirm` applique les Oups ! et enchaîne le curseur.)
  // (Le Renversement (Déstabilisante) n'ouvre AUCUNE modale et ne pose aucun `pending*` : il se résout
  //  dans l'attribution d'Avantage de `applyAttackResult` (`reversalStealOne`, `combat/advantagePool.ts`).)
  // LOT DE DÉS d'un étal (#1426) : aucun personnage n'est concerné — c'est le MONDE qui tire. Owner =
  // le sentinel `WORLD_STEP_OWNER` (siège MJ s'il existe, hôte sinon), comme toute étape de monde.
  { key: 'etalLot', when: (s) => !!s.pendingEtalLot, owner: () => WORLD_STEP_OWNER, auto: { mode: 'self', drive: ['etalLotConfirm'] }, covers: ['pendingEtalLot'], flux: ['etalLot'], rangees: (s) => s.pendingEtalLot?.participants },
  // DÉSIGNATION d'un héros pour un état de campagne (EDO 02 l.91) : décision de GROUPE, au siège du
  // MONDE (`WORLD_STEP_OWNER` — celui de `ownsGroupDecision`, comme le dialogue) ; jamais auto-résolue.
  { key: 'designationHeros', when: (s) => !!s.pendingDesignationHeros, owner: () => WORLD_STEP_OWNER, auto: { mode: 'hostOnly' }, covers: ['pendingDesignationHeros'], verbes: ['designerHerosChoisir'] },
  { key: 'renounce', when: (s) => !!s.pendingRenounce, owner: (s) => s.pendingRenounce?.heroId, auto: { mode: 'choice' }, covers: ['pendingRenounce'], verbes: ['renounceResolve'] },
  // Battement (LDB 10 l.103) : jet PROPRE de CC (non opposé) → 'self' (Lancer puis Appliquer).
  { key: 'battement', when: (s) => !!s.pendingBattement, owner: (s) => s.pendingBattement?.attackerId, auto: { mode: 'self', drive: ['battementRoll', 'battementConfirm'] }, covers: ['pendingBattement'], flux: ['battement'], verbes: ['battementSetFoe', 'battementCancel'] },
  // Distraire (LDB 10 l.364) : jet PROPRE d'Athlétisme opposé au Calme figé du foe → 'self' (le mover pilote son jet).
  { key: 'distraire', when: (s) => !!s.pendingDistraire, owner: (s) => s.pendingDistraire?.moverId, auto: { mode: 'self', drive: ['distraireRoll', 'distraireConfirm'] }, covers: ['pendingDistraire'], flux: ['distraire'], verbes: ['distraireSetFoe', 'distraireCancel'] },
  { key: 'maneuver', when: (s) => !!s.pendingManeuver, owner: (s) => s.pendingManeuver?.attackerId, auto: { mode: 'self', drive: ['maneuverRoll', 'maneuverConfirm'] }, covers: ['pendingManeuver'], flux: ['maneuver'], verbes: ['maneuverSetAvantage', 'maneuverCancel'] },
  // (Une RÉVÉLATION — jet subi / sur table / d'entretien — est une ÉTAPE d'AFFICHAGE de la cascade
  //  (`CascadeStep.reveal`), rendue par l'entrée `cascade` ci-dessous : son owner est celui de l'étape
  //  courante (`actorId` = le concerné), comme tout pas de séquence.)
  // (La Défense est une étape `jet:'defense'` de la cascade `combat`, rendue par `cascade` ci-dessous
  //  (CascadeModal → useDefenseJetProps) — `pendingDefense` coexiste comme porteur de données. La défense
  //  ET son Critique/Maladresse vivent dans UNE seule fenêtre. Owner = `actorId` (le défenseur) de l'étape.)
  // (La Psychologie, EN COMBAT comme À LA RENCONTRE, est une cascade à N étapes — une par héros — rendue
  //  par `cascade`. Combat : Traits/Terreur au DÉBUT de Round (`openRoundStartPsych`), Peur à la FIN
  //  (`openRoundEndCascade`). Rencontre : `openEncounterPsych` à l'entrée de scène.)
  // (Le Désengagement est une étape `jet:'disengage'` de la cascade, rendue par `cascade` ci-dessous
  //  (`DisengageModal` bespoke) — `pendingDisengage` coexiste comme porteur de données/phases.)
  // « Au Contact » (LDB 62 l.176) : Test opposé de Corps à corps PUIS choix du vainqueur → vrai CHOIX
  // (mode 'choice', comme `renounce`/`mountTarget`). Initiée par le joueur (jamais par l'IA) → aucun
  // auto-drive : en Rapide la modale reste au joueur, l'IA ne la déclenche pas (pas de hang).
  { key: 'auContact', when: (s) => !!s.pendingAuContact, owner: (s) => s.pendingAuContact?.moverId, auto: { mode: 'choice' }, covers: ['pendingAuContact'], flux: ['auContact'], verbes: ['auContactRoll', 'auContactConfirm', 'auContactChoose', 'auContactCancel'] },
  // Empoignade (LDB 14 l.161) : Test opposé de Force OU « Briser » PUIS choix du vainqueur → vrai CHOIX
  // (mode 'choice', comme `auContact`). Initiée par le joueur (jamais par l'IA) → pas d'auto-drive.
  { key: 'grapple', when: (s) => !!s.pendingGrapple, owner: (s) => s.pendingGrapple?.actorId, auto: { mode: 'choice' }, covers: ['pendingGrapple'], flux: ['grapple'], verbes: ['grappleRoll', 'grappleBreak', 'grappleConfirm', 'grappleChoose', 'grappleCancel'] },
  { key: 'mountTarget', when: (s) => !!s.pendingMountTarget, owner: (s) => (s.battle ? s.battle.order[s.battle.turn] : undefined), auto: { mode: 'choice' }, covers: ['pendingMountTarget'], verbes: ['mountTargetSelect', 'mountTargetCancel'] }, // l'attaquant actif qui a cliqué le couple
  { key: 'frenzy', when: (s) => !!s.pendingFrenzy, owner: (s) => s.pendingFrenzy?.combatantId, auto: { mode: 'self', drive: ['frenzyRoll', 'frenzyConfirm'] }, covers: ['pendingFrenzy'], flux: ['frenzy'], verbes: ['frenzyCancel'] },
  { key: 'approach', when: (s) => !!s.pendingApproach, owner: (s) => s.pendingApproach?.combatantId, auto: { mode: 'self', drive: ['approachRoll', 'approachConfirm'] }, covers: ['pendingApproach'], flux: ['approach'], verbes: ['approachCancel'] },
  { key: 'ward', when: (s) => !!s.pendingWard, owner: (s) => s.pendingWard?.attackerId, auto: { mode: 'self', drive: ['wardRoll', 'wardConfirm'] }, covers: ['pendingWard'], flux: ['ward'], verbes: ['wardCancel'] },
  { key: 'run', when: (s) => !!s.pendingRun, owner: (s) => s.pendingRun?.combatantId, auto: { mode: 'self', drive: ['runRoll', 'runConfirm'] }, covers: ['pendingRun'], flux: ['run'], verbes: ['runCancel'] },
  // Chute VOLONTAIRE (LDB 15 l.82) : initiée par le JOUEUR (clic sur une arête de capacité `chute`, jamais l'IA, cf. `fallAcross`)
  // → vrai CHOIX (mode 'choice', comme `auContact`/`grapple`) : Rapide/Auto-combat ne la déclenchent jamais.
  { key: 'fall', when: (s) => !!s.pendingFall, owner: (s) => s.pendingFall?.initiateurId, auto: { mode: 'choice' }, covers: ['pendingFall'], flux: ['fall'], verbes: ['fallChoose'], rangees: (s) => (s.pendingFall ? rangeesDuesDeChute(s.pendingFall) : undefined) },
  { key: 'shipManeuver', when: (s) => !!s.pendingShipManeuver, owner: (s) => s.pendingShipManeuver?.shipId, auto: { mode: 'choice' }, covers: ['pendingShipManeuver'], flux: ['shipManeuver'], verbes: ['shipManeuverSetTurn'], rangees: (s) => s.pendingShipManeuver?.participants }, // Test d'équipage MULTI : chaque PJ pilote SON jet (cf. RollRow), pas d'auto-drive mono
  { key: 'shipBattery', when: (s) => !!s.pendingShipBattery, owner: (s) => s.pendingShipBattery?.shipId, auto: { mode: 'choice' }, covers: ['pendingShipBattery'], flux: ['shipBattery'], rangees: (s) => s.pendingShipBattery?.participants }, // Tir de batterie MULTI (Artilleurs) — idem manœuvre
  { key: 'crewTest', when: (s) => !!s.pendingCrewTest, owner: (s) => s.pendingCrewTest?.shipId, auto: { mode: 'choice' }, covers: ['pendingCrewTest'], flux: ['crewTest'], rangees: (s) => s.pendingCrewTest?.participants }, // Test d'équipage GÉNÉRIQUE (Rude épreuve…) — idem manœuvre
  { key: 'shanty', when: (s) => !!s.pendingShanty, owner: (s) => s.pendingShanty?.singerId, auto: { mode: 'choice' }, covers: ['pendingShanty'], flux: ['shanty'], verbes: ['shantySetSong', 'shantyConfirm', 'shantyCancel'] }, // Chanson de marin : CHOIX de la chanson (pré-jet) — jamais auto-résolue
  { key: 'focus', when: (s) => !!s.pendingFocus, owner: (s) => s.pendingFocus?.casterId, auto: { mode: 'self', drive: ['focusRoll', 'focusConfirm'] }, covers: ['pendingFocus'], flux: ['focus'], verbes: ['focusCancel'] },
  { key: 'dispel', when: (s) => !!s.pendingDispel, owner: (s) => s.pendingDispel?.casterId, auto: { mode: 'self', drive: ['dispelRoll', 'dispelConfirm'] }, covers: ['pendingDispel'], flux: ['dispel'], verbes: ['dispelCancel'] },
  // Infirmerie OUVERTE : c'est ELLE qui rend les jets EMBARQUÉS (soin OU passe de Chirurgie) — la modale
  // autonome `heal` (entrée ci-dessous) ne sert qu'au combat, et la Chirurgie est toujours hors combat.
  // Owner : le soigneur/chirurgien du jet INFLUENÇABLE en cours (coop), sinon tous. `pendingSurgery` vit
  // DANS l'infirmerie (rendu par MedicModal), comme `pendingHeal` ici.
  // L'infirmerie CÈDE le devant à une CASCADE en cours (`!s.pendingCascade`) — le Test d'infection
  // post-opératoire (LDB 10 l.184) est un jet INFLUENÇABLE qui doit passer AU-DESSUS du panneau ; à sa
  // clôture l'infirmerie RÉAPPARAÎT (même patron que `heal` cédant à `medic`).
  { key: 'medic', when: (s) => !!s.medic && !s.pendingCascade, owner: (s) => s.pendingHeal?.healerId ?? s.pendingSurgery?.healerId ?? '*', auto: { mode: 'hostOnly' }, covers: ['pendingSurgery'], flux: ['heal', 'surgery'], verbes: ['medicSelectPatient', 'medicSetWound', 'medicAct', 'healSetMode', 'healConfirm', 'healCancel', 'openSurgeryPass', 'surgeryNext', 'surgeryPassCancel', 'surgeryCancel', 'closeMedic'] }, // pendingHeal COUVERT par 'heal' ci-dessous (l'infirmerie le lit aussi, mais n'en est pas l'unique propriétaire)
  // Repos (nuit) : chacun règle SES héros, ready-check, l'hôte dort — modale chez tous.
  { key: 'rest', when: (s) => !!s.pendingRest, owner: () => '*', auto: { mode: 'hostOnly' }, covers: ['pendingRest'], verbes: ['restSet', 'restSleep', 'restReady', 'restCancel'] },
  // Conseil de bord (paie hebdomadaire + Moral, #229) : décision de bourse PARTAGÉE → l'hôte seul (comme
  // les autres actions à l'argent du groupe) ; hors-combat, jamais auto (la cadence auto ne l'ouvre pas).
  // Limitation coop posée sans routage d'intent (aucune décision partagée invité) — traçabilité #254,
  // doc `docs/architecture.md` §Coop ; lever = router `pendingCouncil` en intent coop (travail futur).
  { key: 'council', when: (s) => !!s.pendingCouncil, owner: () => undefined, auto: { mode: 'hostOnly' }, covers: ['pendingCouncil'], verbes: ['councilPay', 'councilClose'] },
  { key: 'heal', when: (s) => !!s.pendingHeal && !s.medic, owner: (s) => s.pendingHeal?.healerId, auto: { mode: 'self', drive: ['healRoll', 'healConfirm'] }, covers: ['pendingHeal'], flux: ['heal'], verbes: ['healSetMode', 'healCancel'] },
  // (Le Contre-sort (Dissipation) est une RÉACTION au Sort figé dans `pendingCast`, rendue DANS la
  //  modale `cast` ci-dessous : une rangée `RollRow` par contre-lanceur (`pendingCounterspell
  //  .participants`), comme l'opposition de cible. « Le contre-sort, c'est le lancement d'un sort qui
  //  peut être opposé → pas une modale différente. » L'owner du Sort ennemi est déjà '*' (cf. `cast`).)
  // (L'enfoncement de porte est une étape `jet:'forceDoor'` (groupOwner) de la cascade, rendue par
  //  `cascade` ci-dessous (`ForceDoorModal` bespoke) — `pendingForceDoor` coexiste comme porteur de
  //  données/participants ; chacun ne pilote que ses héros (gating per-participant côté UI).)
  // (Le Test étendu est une cascade `jet:'extended'` rendue par `cascade` ci-dessous (CascadeModal →
  //  useExtendedTestJetProps) — `pendingExtendedTest` coexiste comme porteur de données, comme `pendingAttack`.)
  // CASCADE séquentielle (jets de nuit/voyage) : l'étape COURANTE a son héros → modale chez son
  // propriétaire (coop : chaque contrôleur influence ses propres jets, l'un après l'autre).
  // Le CIBLAGE CARTE d'une incantation (`pickingTargets` / pose de zone) EFFACE la fenêtre : la carte
  // prend la main, le joueur y désigne ses cibles. C'est une condition d'ÉLECTION (#1852) : l'arbitre
  // n'élit jamais une modale dont le corps serait vide. La cascade reste OUVERTE (le curseur ne bouge
  // pas) et la SITUATION tient toujours la main (`tientLaMain` ci-dessous, gardes clavier) : la
  // fenêtre revient dès la pose faite.
  { key: 'cascade', when: (s) => {
    if (!s.pendingCascade) return false;
    const cur = s.pendingCascade.participants[s.pendingCascade.cursor];
    if (sansCorps(s, cur)) return false;
    if (cur?.jet !== 'cast') return true;
    return !s.pendingCast?.pickingTargets && !s.pendingCast?.zone?.placing;
  }, tientLaMain: (s) => !!s.pendingCascade, owner: (s) => {
    // Étape de GROUPE (enfoncer une porte) → '*' (chacun pilote ses héros) ; étape MONDE sans acteur
    // (`worldOwner`, seam #275 Décision 3 — désertion/Moral) → sentinel routé au siège MJ par
    // `sieges.seatOwns` ; sinon le héros de l'étape.
    const cur = s.pendingCascade?.participants[s.pendingCascade.cursor];
    if (cur?.groupOwner) return '*';
    if (!cur?.actorId && cur?.worldOwner) return WORLD_STEP_OWNER;
    return cur?.actorId;
  }, auto: { mode: 'partial' },
  covers: [
    'pendingCascade',
    // Porteurs de données des étapes-jet (cf. `CascadeStep.jet`), rendues par CETTE entrée :
    'pendingTest', 'pendingAttack', 'pendingDefense', 'pendingDisengage', 'pendingCast',
    'pendingExtendedTest', 'pendingForceDoor',
    // Coexistent DANS l'étape `jet:'cast'` (Contre-sort/opposition de cible, rendus par CastModal) :
    'pendingCounterspell', 'pendingCastOpposition',
  ] },
  // (L'incantation — la situation « lancer un sort » : jet → opposition de cible → Contre-sort →
  //  Surincantation/pose de zone → Critique → effets — est une étape `jet:'cast'` de la cascade, rendue
  //  par `cascade` ci-dessus (`CastModal` bespoke). `pendingCast` coexiste comme porteur de données ; ses
  //  résolveurs ferment LES DEUX. OWNER équivalent : un Sort ENNEMI ouvre la cascade avec `groupOwner:true`
  //  → l'entrée `cascade` met l'owner à '*' (moment partagé + Contre-sort multi en coop) ; un Sort de HÉROS
  //  sans `groupOwner` → owner = `actorId` (le lanceur). Le ciblage CARTE (pickingTargets / pose de zone)
  //  efface la modale via le `return null` du renderer `cast` dans CascadeModal.)
  { key: 'reload', when: (s) => !!s.pendingReload, owner: (s) => s.pendingReload?.actorId, auto: { mode: 'self', drive: ['reloadRoll', 'reloadConfirm'] }, covers: ['pendingReload'], flux: ['reload'], verbes: ['reloadCancel'] },
  // Main ensanglantée (AA 07 l.117) : Test de Dextérité PAR ACTION — jet PROPRE de l'attaquant (`self`) ;
  // en cadence Rapide/Auto le driver le résout (Lancer → Appliquer), comme `reload`.
  { key: 'handGate', when: (s) => !!s.pendingHandGate, owner: (s) => s.pendingHandGate?.attackerId, auto: { mode: 'self', drive: ['handGateRoll', 'handGateConfirm'] }, covers: ['pendingHandGate'], flux: ['handGate'], verbes: ['handGateCancel'] },
  { key: 'stateRecovery', when: (s) => !!s.pendingStateRecovery, owner: (s) => s.pendingStateRecovery?.actorId, auto: { mode: 'self', drive: ['recoverRoll', 'recoverConfirm'] }, covers: ['pendingStateRecovery'], flux: ['recover'], verbes: ['recoverCancel'] },
  // Sauvegarde d'Initiative « Fuite de vapeur » (MDG 12 l.326-328) : jet PROPRE de la personne au moteur.
  { key: 'steamSave', when: (s) => !!s.pendingSteamSave, owner: (s) => s.pendingSteamSave?.actorId, auto: { mode: 'self', drive: ['steamSaveRoll', 'steamSaveConfirm'] }, covers: ['pendingSteamSave'], flux: ['steamSave'] },
  // (L'attaque est une étape `jet:'attack'` de la cascade `combat`, rendue par `cascade` ci-dessus
  //  (CascadeModal → useAttackJetProps) — `pendingAttack` coexiste comme porteur de données. TOUS les
  //  chemins d'attaque (Charge / normale / gratuite + balayage/dual qui réutilisent) ouvrent une cascade.
  //  L'auto-résolution passe donc par `JET_AUTO['attack']` (combatAuto).)
  // (Le Test de scène est une cascade `jet:'test'` rendue par `cascade` ci-dessus (CascadeModal →
  //  useTestJetProps) — `pendingTest` coexiste comme porteur de données, comme `pendingAttack` pour l'attaque.)
  // Jet d'Activité d'interlude (LDB 23) — hors combat, même règle coop qu'en combat : le PROPRIÉTAIRE
  // du héros joue, les autres voient « X joue… ».
  { key: 'activity', when: (s) => !!s.pendingActivity, owner: (s) => s.pendingActivity?.heroId, auto: { mode: 'hostOnly' }, covers: ['pendingActivity'], flux: ['activity'], verbes: ['activityConfirm'] },
  { key: 'corruption', when: (s) => !!s.pendingCorruption, owner: (s) => s.pendingCorruption?.heroId, auto: { mode: 'self', drive: ['corruptionRoll', 'resolveCorruption'] }, covers: ['pendingCorruption'], flux: ['corruption'], verbes: ['corruptionSetNature'] },
] as const satisfies readonly ModalDef[];

export type ModalKey = (typeof MODAL_DEFS)[number]['key'];

/** PURE : la définition de la modale ACTIVE (1ʳᵉ entrée active du registre). `undefined` = aucune. */
export const modaleActive = (s: ArbiterState): ModalDef | undefined => (MODAL_DEFS as readonly ModalDef[]).find((d) => d.when(s));

/** PURE : la modale à afficher MAINTENANT (`modaleActive`). `null` = aucune.
 *  Frappe Mortelle / 2ᵉ frappe / Surincantation « +Cible » = ciblages CARTE (pas de modale). */
export function pickActiveModalKey(s: ArbiterState): ModalKey | null {
  return (modaleActive(s)?.key as ModalKey | undefined) ?? null;
}

/** Combattant concerné par la MODALE ACTIVE (ou '*' / undefined). null = aucune modale. */
export function modalOwnerOf(s: ArbiterState): string | undefined | '*' | null {
  const def = modaleActive(s);
  return def ? def.owner(s) : null;
}

/** Politique d'auto-résolution de la modale ACTIVE (cf. `combatAuto.ts`). null = aucune modale. */
export function autoPolicyOf(s: ArbiterState): AutoPolicy | null {
  return modaleActive(s)?.auto ?? null;
}

/** Une modale du registre tient-elle la MAIN ? — verdict des gardes de PILOTAGE (fin de tour, barre
 *  d'action, menu système), DISTINCT de l'élection d'une fenêtre (`pickActiveModalKey`) : une modale
 *  qui a délégué son geste à la CARTE n'a plus de fenêtre à rendre et tient pourtant la main
 *  (`tientLaMain`). (Le verdict « la carte est-elle inerte ? » y ajoute l'exception des interludes
 *  pilotés par la carte : `state/mapHover.ts`.) */
export function modalHolds(s: ArbiterState): boolean {
  return (MODAL_DEFS as readonly ModalDef[]).some((d) => (d.tientLaMain ?? d.when)(s));
}

/**
 * L'écran-hub de VOYAGE (`VoyageScreen`, #333) est-il la surface active ? Un voyage EN COURS (non
 * interrompu, hors recap d'arrivée), en exploration, carte fermée, hors combat → le hub plein-champ
 * HÉBERGE la cascade du jour (rendue EN SON CENTRE, `CascadeBody embedded`) au lieu d'une modale
 * flottante (le geste anti-tunnel). `ActiveModal` supprime alors la cascade flottante ; la porte de
 * consultation (Dossier navire, fiches) reste ouvrable par-dessus (règle GÉNÉRALE, pas par-écran). */
export function voyageHubActive(s: ArbiterState): boolean {
  return !!s.travelPlan && !s.travelPlan.interrupted && !s.travelRecap
    && s.mode === 'exploration' && !s.worldMapOpen && !s.battle;
}

/** Une ÉTAPE du hub de voyage attend (cascade du jour, nuit de halte OU relâche à terre d'accostage) —
 *  SOURCE UNIQUE pour forcer le hub ouvert (`CampaignView`) et choisir ce qu'incruster en son centre
 *  (`VoyageScreen`). La relâche (MDG 15) est une décision d'ACCOSTAGE intégrée au journal de voyage
 *  (arbitrage user 2026-07-11), plus une modale flottante quand le hub est actif. */
export function voyageStepPending(s: ArbiterState): boolean {
  return !!s.pendingCascade || !!s.pendingRest || !!s.pendingShoreLeave;
}

/**
 * Registre des pendings HORS-modale (#284) : pas d'entrée `MODAL_DEFS`, rendus par un ÉCRAN dédié
 * (`ScreenShell`/panneau de jeu) plutôt qu'une modale de combat — marché/butin/victoire/campagne/
 * ciblage carte… Chaque entrée déclare son OWNER coop, MÊME VOCABULAIRE que `ModalDef.owner`
 * ('*' = tous les sièges voient/agissent, `undefined` = hôte seul), et les INTENTS invités que cette
 * fenêtre arbitre (`intents`, #1016 — le « lot séparé » annoncé par #284 : le branchement effectif).
 */
export interface HorsModalDef {
  key: string;
  pendingKey: PendingKey;
  owner: (s: ArbiterState) => string | undefined | '*';
  /** Ce pending, posé, TIENT-IL LA MAIN (`surfaceTientLaMain`) ? REQUIS (patron `auto`) : chaque
   *  fenêtre se classe à sa déclaration. `false` = un pending SANS surface devant le joueur — un
   *  geste armé qui attend son arrivée, une file que le système draine, une commande en souffrance. */
  tientLaMain: boolean;
  /** Intents invités dont la possession suit l'OWNER de CE pending (#1016) — le geste vit DANS cette
   *  fenêtre et n'a pas d'autre porteur. Absent = aucun intent invité n'y est adossé, ou son porteur
   *  ne se lit pas dans le pending (il est alors routé nominativement par `intentAllowedFor`). */
  intents?: VerbesDeFenetre;
  /** Les flux de jet (`FLOW_VERBS`) que la fenêtre rend, comme `ModalDef.flux`. */
  flux?: readonly FlowKey[];
  /** Verbes du joueur que ni `intents` ni `flux` ne nomment — ce qu'un hôte nomme au joueur (`fenetreDuJeu`,
   *  #2898). Leur routage reste celui de `netOwnership`. Une fenêtre qui ne tient pas la main n'en a pas :
   *  `fenetreDuJeu` ne la rend jamais. */
  verbes?: VerbesDeFenetre;
}

export const HORS_MODAL = [
  { key: 'bargain', pendingKey: 'pendingBargain', tientLaMain: true, owner: (s) => s.pendingBargain?.playerId, flux: ['bargain'] }, // Marchandage (écran Marché, billet de la carte du monde)
  { key: 'appraise', pendingKey: 'pendingAppraise', tientLaMain: true, owner: (s) => s.pendingAppraise?.actorId, flux: ['appraise'] }, // Évaluation/Détection (écran Marché/Compendium)
  { key: 'loot', pendingKey: 'pendingLoot', tientLaMain: true, owner: () => '*', verbes: ['assignLootGear', 'appraiseGear', 'dismissLoot'] }, // Butin hors victoire : chacun voit qui l'emporte
  { key: 'victory', pendingKey: 'pendingVictory', tientLaMain: true, owner: () => '*', verbes: ['assignVictoryGear', 'harvestCreature', 'appraiseGear', 'victoryReady', 'dismissVictory'] }, // Écran de victoire : `readyBySeat`, unanimité
  { key: 'siegeAim', pendingKey: 'pendingSiegeAim', tientLaMain: true, owner: (s) => s.pendingSiegeAim?.gunnerId, verbes: ['siegeAimCommit', 'siegeAimCancel'] }, // Placeur de case (ciblage carte, pas de modale)
  { key: 'interact', pendingKey: 'pendingInteract', tientLaMain: false, owner: () => undefined }, // Interaction de décor : hôte (pas de héros structuré porté par le pending)
  { key: 'roundStart', pendingKey: 'pendingRoundStart', tientLaMain: true, owner: () => '*', verbes: ['confirmRoundStart', 'roundStartReady', 'roundStartPromote', 'armPreempt'] }, // Pause de début de Round (fenêtre Chance) : ready-check par siège
  { key: 'seaActivities', pendingKey: 'pendingSeaActivities', tientLaMain: true, owner: () => '*', verbes: ['seaActivitiesConfirm'] }, // Activités hebdomadaires en mer : décision de groupe
  { key: 'manannPriest', pendingKey: 'pendingManannPriest', tientLaMain: true, owner: () => '*', verbes: ['resolveManannPriest'] }, // Événement de port (MDG 15) : décision de groupe
  { key: 'shoreLeave', pendingKey: 'pendingShoreLeave', tientLaMain: true, owner: () => '*', verbes: ['resolveShoreLeave'] }, // Relâche à terre (MDG 15) : décision de groupe
  { key: 'campaign', pendingKey: 'pendingCampaign', tientLaMain: true, owner: () => undefined, verbes: ['setPendingCampaign', 'loadProject'] }, // Campagne choisie au menu : avant tout siège coop, hôte
  { key: 'orders', pendingKey: 'pendingOrders', tientLaMain: false, owner: () => undefined }, // Commandes d'interlude : dépense de bourse de groupe, hôte
  // Balayage / 2ᵉ frappe : ciblage carte (TargetPrompt), pas de modale — leurs gestes (enchaîner,
  // terminer, renoncer) sont ceux de l'ATTAQUANT qui les tient, et sont routés sur lui (#1016).
  { key: 'cleave', pendingKey: 'pendingCleave', tientLaMain: true, owner: (s) => s.pendingCleave?.attackerId, intents: ['cleaveAttack', 'cleaveEnd'] },
  { key: 'dualStrike', pendingKey: 'pendingDualStrike', tientLaMain: true, owner: (s) => s.pendingDualStrike?.attackerId, intents: ['dualStrikeAttack', 'dualStrikeSkip'] },
  { key: 'logQueue', pendingKey: 'pendingLogQueue', tientLaMain: false, owner: () => undefined }, // File de journal DIFFÉRÉE : système, drainée automatiquement (pas d'acteur)
  // Cadre de campagne (#717) : rideau d'ouverture et récap de fin de chapitre — des ÉCRANS
  // (`ScreenShell`), pas des modales de combat, et des gestes d'HÔTE (l'ouverture est un rideau, la
  // clôture de séance vit déjà chez l'hôte) : aucun ready-check, aucun intent invité.
  { key: 'ouverture', pendingKey: 'pendingOuverture', tientLaMain: true, owner: () => undefined, verbes: ['acquitterOuverture'] },
  { key: 'chapterRecap', pendingKey: 'pendingChapterRecap', tientLaMain: true, owner: () => undefined, verbes: ['cloreChapitre', 'ajournerChapterRecap'] },
  { key: 'departure', pendingKey: 'pendingDeparture', tientLaMain: true, owner: () => undefined, verbes: ['departWaitDawn', 'departCancel'] }, // Porte de départ de nuit (carte du monde) : l'hôte décide (#340)
] as const satisfies readonly HorsModalDef[];

/**
 * Intents invités arbitrés par une fenêtre HORS-modale, indexés par NOM (#1016) — DÉRIVÉS de
 * `HORS_MODAL`, jamais énumérés ailleurs. `netOwnership.intentAllowedFor` y route la possession sur
 * l'owner du pending qui héberge le geste (patron `jetOwnedIntents`) au lieu du repli `modalOwnerOf`,
 * qui ne consulte que `MODAL_DEFS` : pendant un balayage, ce repli désigne la modale PRIORITAIRE
 * ouverte par-dessus (le `fateSave` de la victime) et non l'attaquant qui enchaîne.
 */
export function horsModalOwnedIntents(): Record<string, HorsModalDef> {
  const out: Record<string, HorsModalDef> = {};
  for (const d of HORS_MODAL as readonly HorsModalDef[]) for (const a of d.intents ?? []) out[a] = d;
  return out;
}

/** Les mêmes fenêtres indexées par leur `pending*` (#1016) — `netOwnership` y prend l'owner du CLIC
 *  DE CARTE quand `targetingHolder` désigne le pending qui DÉTIENT le ciblage (balayage, 2ᵉ frappe,
 *  pilonnage indirect) : le clic appartient au porteur du geste, pas à la modale prioritaire. */
export function horsModalByPending(): Record<string, HorsModalDef> {
  const out: Record<string, HorsModalDef> = {};
  for (const d of HORS_MODAL as readonly HorsModalDef[]) out[d.pendingKey] = d;
  return out;
}

/** Surface PARTAGÉE qui NE vit PAS dans un `pending*` : un état de PARTIE que l'hôte arbitre et que
 *  tous les sièges ont sous les yeux, et qui couvre la scène. Déclarée ICI, à l'arbitre, à côté des deux
 *  registres de fenêtres. Une surface PAR SIÈGE (fiche, menu système, fenêtre Codex `codexOverlay`,
 *  inspection) n'y entre JAMAIS : elle vit dans la pile des couches de SON client (`dismissStack`), et
 *  l'écran de l'hôte ne doit pas refuser le geste d'un invité. L'ÉCRAN plein (`screen`, dont l'écran
 *  `compendium`) est, lui, PARTAGÉ : le snapshot de l'hôte écrase `screen` chez chaque invité
 *  (`coop.appliquerLInstantane`). */
export interface SurfaceHorsPendingDef {
  key: string;
  tientLaMain: (s: ArbiterState) => boolean;
}

export const SURFACES_HORS_PENDING = [
  { key: 'marche', tientLaMain: (s) => !!s.merchant },
  { key: 'jeuxDeTaverne', tientLaMain: (s) => !!s.tavernGames },
  { key: 'document', tientLaMain: (s) => !!s.document },
  // Montées en EXPLORATION seulement (`ui/CampaignView`) : hors de ce mode, le slot n'a pas d'écran.
  { key: 'carteDuMonde', tientLaMain: (s) => !!s.worldMapOpen && s.mode === 'exploration' },
  { key: 'port', tientLaMain: (s) => !!s.port && s.mode === 'exploration' },
  { key: 'marcheDeTerre', tientLaMain: (s) => !!s.landMarket && s.mode === 'exploration' },
  // Un ÉCRAN plein autre que celui du jeu (groupe, interlude, `compendium`…) : la scène n'est pas à l'écran.
  { key: 'ecranPlein', tientLaMain: (s) => s.screen !== 'campaign' },
] as const satisfies readonly SurfaceHorsPendingDef[];

/** Un pending est OUVERT s'il porte quelque chose : une collection vide est un slot au repos. */
export const pendingOuvert = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : !!v);

/**
 * UNE SURFACE PARTAGÉE TIENT-ELLE LA MAIN ? Verdict UNIQUE de « ce que TOUS les sièges ont sous les
 * yeux n'est pas la scène » : une modale du registre (`modalHolds`), une fenêtre HORS-modale ouverte
 * qui se déclare `tientLaMain`, ou une surface partagée hors `pending*` (`SURFACES_HORS_PENDING`).
 * Il garde le VERBE, là où il s'exécute (chez l'hôte) ; les surfaces PAR SIÈGE sont la pile des
 * couches du client (`dismissStack`). Dérivé des trois registres : une fenêtre neuve se classe à sa
 * déclaration, jamais dans une liste de consommateur.
 */
export function surfaceTientLaMain(s: ArbiterState): boolean {
  if (modalHolds(s)) return true;
  const etat = s as Record<string, unknown>;
  if ((HORS_MODAL as readonly HorsModalDef[]).some((d) => d.tientLaMain && pendingOuvert(etat[d.pendingKey]))) return true;
  return (SURFACES_HORS_PENDING as readonly SurfaceHorsPendingDef[]).some((d) => d.tientLaMain(s));
}

/** Toutes les clés `pending*` couvertes par `MODAL_DEFS` (owner MODALE, direct + coexistants). */
type ModalCoveredKey = (typeof MODAL_DEFS)[number]['covers'][number];
/** Toutes les clés `pending*` couvertes par `HORS_MODAL` (owner HORS-modale). */
export type HorsModalCoveredKey = (typeof HORS_MODAL)[number]['pendingKey'];

/**
 * VERROU DE COMPILATION (#284) : tout `pending*` de `Jeu` (`PendingKey`, dérivé — cf.
 * `stateFields.ts`) doit être couvert par `MODAL_DEFS.covers` OU `HORS_MODAL` — le TIERS n'existe
 * pas. Un `pending*` ajouté sans classer son owner coop casse tsc ICI : `_pendingOwnerCoverage`
 * n'accepte que `never` en 2ᵉ position ; toute clé manquante s'y affiche en litige (patron AutoPolicy).
 */
type _MissingPendingOwner = Exclude<PendingKey, ModalCoveredKey | HorsModalCoveredKey>;
type _pendingOwnerCoverage = [manquant: _MissingPendingOwner] extends [never] ? true : ['pending* sans owner coop déclaré (MODAL_DEFS.covers ni HORS_MODAL)', _MissingPendingOwner];
const _pendingOwnerCoverageCheck: _pendingOwnerCoverage = true;
void _pendingOwnerCoverageCheck;
