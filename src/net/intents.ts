/**
 * Allowlist des actions de store qu'un INVITÉ peut demander (intents) — périmètre : LE COMBAT
 * (portée V1 : seule la partie combat est jouée côté invité ; l'exploration est un miroir de
 * l'hôte) + la COMPOSITION DU GROUPE (chaque joueur remplit les emplacements que l'hôte lui a
 * attribués) + les ACTIVITÉS D'INTERLUDE de SES héros (audit POC→produit M7 : « Entre deux
 * aventures » est par nature individuel — chaque joueur mène les Activités de ses personnages ;
 * ouvrir/CLORE l'interlude reste l'hôte) + TOUT FLUX DE JET MONO à porteur (#1017) : dès que le
 * porteur d'un jet peut être le héros d'un autre siège, ses verbes d'influence lui sont ouverts,
 * qu'il roule en combat, en voyage, à l'auberge ou chez le marchand — c'est la POSSESSION qui
 * tranche la dépense (`netOwnership.intentAllowedFor`), jamais la liste. Tout le reste (sauvegarde,
 * voyage, ÉCRANS marchand/éditeur, persistance) est refusé par l'hôte.
 *
 * `COMBAT_INTENTS` a DEUX parts :
 *  - les délégués `<prefix><Verbe>` des flux de jet ET leurs actions de `resolution`, DÉRIVÉS de
 *    `FLOW_VERBS` (`coopFlowIntents`) : un flux mono ajouté à la table n'a AUCUNE ligne à écrire ici
 *    (un flux multi s'y ajoute par son marqueur `coop: true`, résolutions comprises depuis #1050) ;
 *  - `MANUAL_COMBAT_INTENTS` ci-dessous : les actions de store qui ne sont PAS des verbes de flux
 *    (gestes de tour/hotbar, paramètres pré-jet, OUVREURS de flux) — chacune est un choix conscient.
 *    Le test `rollFlowWiring.test.ts` échoue si un nom DÉRIVABLE y est recopié ; `intents.test.ts`
 *    échoue si un nom (dérivé ou manuel) n'existe pas dans le store ; `guest-flow-surface.test.ts`
 *    échoue si une action `<prefix><Maj>` d'un flux (mono OU multi) n'est ni exposée ici, ni portée
 *    par sa liste d'exclusions justifiée ; `guest-surface-class.test.ts` échoue si un site d'écran
 *    (`src/ui`/`src/gameIso`) émet une action de store absente de l'allowlist sans exclusion motivée.
 */
import { coopFlowIntents } from '../state/flowVerbs';

/** Intents qui ne sont PAS des verbes de flux (`<prefix><Verbe>` de `FLOW_VERBS`) — non dérivables. */
export const MANUAL_COMBAT_INTENTS: readonly string[] = [
  // tour, ciblage, déplacement tactique
  // `armEndTurn` = 1er temps du garde-fou « tour gâché » : l'armement vit dans `battle` (état d'hôte),
  // donc l'invité le DEMANDE comme tout geste de son tour — sinon son 1er appui serait sans effet.
  'battleClickEntity', 'battleClickTile', 'battleEndTurn', 'armEndTurn', 'cancelMove', 'battleSelectAction',
  // actions de la hotbar — rendues dès `controlsCombatant` (le combattant ACTIF), et autorisées par
  // le REPLI universel de `intentAllowedFor` (aucune modale ouverte → le propriétaire de l'actif).
  'battleAim', 'battleDefendTotal', 'battleDisengage', 'battleRun', 'battleTrample',
  'battleFrenzy', 'battleFocusSpell', 'battleHeal', 'battleReload', 'battleRecoverState',
  'battleStandUp', 'battlePickup', 'battleUseItem', 'battleSelectSpell', 'battleSelectAmmo',
  'battleSpendResolve', 'battleTogglePushback', 'battleToggleStance', 'battleSwitchLoadout', 'battleMount',
  'battleDismount', 'battleResolveIgnoreCrit', 'battleResolvePsychImmune',
  'battleSelfManeuver', 'battleGainAdvantage', 'battleSelectAttack', 'battleManeuverArea',
  // Postes de bord / arme d'équipe / engin de siège : même hotbar, même possession (l'actif).
  'battleShipReload', 'battleManPoste', 'battleLeavePoste', 'battleWater', 'battlePushEngine',
  'battleAidTeam',
  'spendResolveCondition',
  // Escalade d'une arête (capacité `escalade`) : jumeau de `fallAcross`, même possession (l'actif).
  'climbAcross',
  // Enjambement d'une croisée (capacité `fenetre`, #700) : même possession (l'actif), aucun jet.
  'windowAcross',
  // attaque : paramètres de la modale différée + jet/appliquer propres au flux d'attaque
  'attackSetLocation', 'attackSetWeapon', 'attackSetDualMode',
  'attackSetWithhold', 'attackSetHarpoonRopeCut', 'attackSetGrapple',
  'attackSetCritLocation', 'attackRoll', 'attackConfirm',
  // défense réactive : choix de mode/arme/réaction de bouclier + appliquer
  'defenseSetMode', 'defenseSetParryWeapon', 'defenseSetShieldReaction', 'defenseConfirm',
  // incantation / prière : options d'incantation + jet/appliquer/annuler
  'castRoll', 'castSetCritChoice', 'castSetConjureForm', 'castSetDiscreet',
  'castAllocOvercast', 'castSetChosenTableRolls', 'castToggleExtraTarget', 'castPickTargets',
  'castPlaceZone', 'castConfirm', 'castCancel',
  // Contre-sort / opposition de cible : « tout lancer » des rangées de CE siège (verbe NULLAIRE du
  // drive d'auto-cadence, `combatAuto.STEP_WINDOW_AUTO`). Les résolutions (`xConfirm`/`xCancel`) sont
  // DÉRIVÉES de `FLOW_VERBS.resolution` (#1050), plus recopiées ici.
  'counterspellRollAll', 'oppositionRollAll',
  // PHASE 1 du Contre-sort (#1042/#1059) : chaque candidat DÉCLARE depuis SA RANGÉE (contrer seul /
  // s'unir / passer) — contribution de table routée par la possession de son porteur (patron #1050) ;
  // `counterspellDeclareAll` est le verbe NULLAIRE du drive d'auto-cadence, comme `counterspellRollAll`.
  'counterspellDeclare', 'counterspellDeclareAll',
  // Cascade séquentielle (jets de nuit / voyage influençables) : choix / SAISIE d'une quantité
  // (#1279 Sf, jumeau du choix) / tirage sur table (avance et clôture = `resolution` du flux, dérivées).
  'cascadeChoose', 'cascadeAmount', 'cascadeTableRoll',
  // Mode table (#942 L3) : poser le dé d'une étape à table (champ ou clic sur une ligne) — autorisé par la
  // possession du siège ÉMETTEUR (`intentAllowedFor`) ; l'option « Dés fixés » est CLIENT-SIDE.
  'cascadeTableSetForcedRoll',
  // DÉ NU (#1508) : les deux mêmes verbes pour l'autre lecture du même dé — même routage de possession.
  'cascadeDieRoll', 'cascadeDieSetForcedRoll',
  // désengagement : ouverture, jet, appliquer/fuir/annuler
  'disengageConfirmA', 'disengageRoll', 'disengageConfirm', 'disengageFlee', 'disengageCancel',
  // « Au Contact » (LDB 62 l.176) : ouverture, jet, choix du vainqueur
  'battleAuContact', 'auContactRoll', 'auContactConfirm', 'auContactChoose', 'auContactCancel',
  // Empoignade (LDB 14 l.161) : ouverture, « Briser », jet, choix du vainqueur
  'battleGrapple', 'grappleBreak', 'grappleRoll', 'grappleConfirm', 'grappleChoose', 'grappleCancel',
  // combat monté
  'mountTargetSelect', 'mountTargetCancel',
  // résolutions/annulations des flux de jet en combat (le verbe de jet est dérivé, pas l'appliquer)
  'trampleConfirm', 'trampleCancel',
  'maneuverConfirm', 'maneuverCancel', 'maneuverSetAvantage',
  // Tour de NAVIRE (couche Mer, MDG 13-14) : le contrôleur de la coque OUVRE ; CHAQUE participant
  // (héros à un rôle) roule SA rangée, routée par la possession de son id (cf. `intentAllowedFor`,
  // primitive multi `RollParticipant`). Les résolutions sont DÉRIVÉES (`FLOW_VERBS.resolution`).
  'battleShipManeuver', 'shipManeuverSetTurn',
  'battleShipBattery',
  'battleCrewTest',
  'runConfirm', 'runCancel', 'focusConfirm', 'focusCancel',
  'wardConfirm', 'wardCancel',
  'frenzyConfirm', 'frenzyCancel', 'reloadConfirm', 'reloadCancel',
  'handGateConfirm', 'handGateCancel', 'recoverConfirm', 'recoverCancel',
  'healSetMode', 'healConfirm', 'healCancel',
  // Corruption (LDB 19 l.29) : choix Résistance/Calme AVANT le jet (le jet et son influence sont dérivés).
  'corruptionSetSkill',
  // Manoeuvres d'arme et de mouvement (#1017) : OUVREUR + paramètre pré-jet + résolution ; le jet et
  // ses verbes d'influence sont dérivés de `FLOW_VERBS` (mono → routés par le porteur).
  'battleBattement', 'battementSetFoe', 'battementConfirm', 'battementCancel',
  'battleDistraire', 'distraireSetFoe', 'distraireConfirm', 'distraireCancel',
  // Chute volontaire (ouverte par `battleClickTile`) : trajet, DÉCLARATION de rangée (routée par le siège
  // du tombant, `netOwnership`). Les résolutions sont DÉRIVÉES (`FLOW_VERBS.resolution`).
  'fallAcross', 'fallChoose',
  // Approche d'une source de Peur (ouverte par `battleClickTile`/`battleClickEntity`) : résolution.
  'approachConfirm', 'approachCancel',
  // Contre-magie (LDB 46) : OUVREUR (réaction au sort adverse) + résolution du jet de dissipation.
  'battleDispelSpell', 'dispelConfirm', 'dispelCancel',
  // Chanson de marin (MDG 09) : OUVREUR + choix de la chanson + résolution.
  'battleSingShanty', 'shantySetSong', 'shantyConfirm', 'shantyCancel',
  // Test de scène/compétence (`pendingTest`) : choix du LANCEUR parmi les candidats + application de
  // la branche réussite/échec. L'ouverture reste interne (`openSkillTest`, jamais une action de store).
  'testSetActor', 'resolveTest',
  // Fuite de vapeur (MDG 12 l.326-328) : résolution de la sauvegarde d'Initiative.
  'steamSaveConfirm',
  // Infirmerie (hors combat) : patients / actes / chirurgie + fermeture — l'hôte valide.
  // Chirurgie : openSurgeryPass POSE la passe, les verbes surgery* dérivés l'influencent,
  // surgeryNext applique, surgeryPassCancel annule la passe, surgeryCancel l'opération — une passe
  // n'a AUCUN verbe de résolution inline.
  'medicSelectPatient', 'medicAct', 'medicSetWound', 'closeMedic',
  'openSurgeryPass', 'surgeryNext', 'surgeryPassCancel', 'surgeryCancel',
  // Repos (nuit) : chacun règle SES héros (restSet vise un héros, 1er argument) + ready-check.
  'restSet', 'restReady',
  // (Psychologie de COMBAT et à la rencontre : passent par les intents `cascade*` dérivés.)
  'fateNegate', 'fateSurvive', 'fateAccept', 'fumbleRoll', 'fumbleConfirm',
  'cleaveAttack', 'cleaveEnd', 'dualStrikeAttack', 'dualStrikeSkip',
  'roundStartPromote', 'confirmRoundStart', 'roundStartReady', 'renounceResolve',
  // Tir rapide (Talent « Tir rapide ») pendant la pause de début de Round : ARMER la visée depuis la
  // frise, puis le tir lui-même (appelé par `battleClickEntity` chez l'hôte — exposé en défense en
  // profondeur). Les deux sont routés sur le TIREUR : pendant la pause il n'y a AUCUN combattant
  // actif (`turn: -1`), donc le repli universel les refusait à tout siège invité.
  'armPreempt', 'preemptRangedShot',
  'resolveCorruption',
  // (dismissVictory volontairement ABSENT : un invité passe par victoryReady — l'hôte ferme à l'unanimité.)
  // Demande de pause au prochain Round : POSER et RETIRER passent par le même chemin (interrupteur
  // de la frise) — une bascule dont un seul sens serait répliqué laisserait la table bloquée.
  'victoryReady', 'assignVictoryGear', 'raiseHand', 'lowerHand',
];

export const COMBAT_INTENTS: ReadonlySet<string> = new Set([...MANUAL_COMBAT_INTENTS, ...coopFlowIntents()]);

/** Composition du groupe (écran d'équipe coop) : un invité remplit/retire SES emplacements.
 *  L'hôte injecte le siège autoritaire dans `partyAddHero` (netFlow) — jamais celui de l'invité.
 *  `toggleCluePin` (carnet d'enquête, #670) : état CAMPAGNE-scopé partagé par tout le groupe,
 *  hors-combat — même niveau d'autorisation que la composition du groupe. */
export const PARTY_INTENTS: ReadonlySet<string> = new Set(['partyAddHero', 'partyRemoveHero', 'partyReplaceHero', 'toggleCluePin']);

/** Activités d'interlude (LDB 23) : chacune vise un héros (1er argument ou pending/dépôt) —
 *  l'hôte valide la possession dans `intentAllowedFor`. `startInterlude`/`interludeEnd`
 *  restent HORS allowlist (l'hôte seul ouvre et clôt la période). */
export const INTERLUDE_INTENTS: ReadonlySet<string> = new Set([
  // `interludeActivity` = chemin UNIQUE de toutes les Activités à jet (Revenus/Artisanat/Apprentissage/
  // Identification + catalogue) ; `interludeCraftStart` engage l'ouvrage (setup, sans jet).
  'interludeActivity', 'interludeCraftStart',
  'interludeOrder', 'interludeBank', 'interludeWithdraw',
  // Jet d'Activité : verbes DÉRIVÉS (flux mono `activity`, cf. `coopFlowIntents`) ; seules
  // l'application et l'annulation restent manuscrites (actions de store, hors `FLOW_VERBS`).
  'activityConfirm', 'activityCancel',
]);

/** Allowlist complète côté hôte / interception côté invité. */
export const GUEST_INTENTS: ReadonlySet<string> = new Set([...COMBAT_INTENTS, ...PARTY_INTENTS, ...INTERLUDE_INTENTS]);

/** Args JSON-sûrs pour un intent : les handlers React passent parfois l'ÉVÉNEMENT en argument
 *  (`onClick={action}`) — circulaire, il ferait échouer la sérialisation et PERDRAIT l'intent
 *  (bug trouvé à l'audit coop : « Appliquer » d'invité muet). On TRONQUE la queue non
 *  sérialisable (l'événement est toujours en dernier) sans toucher aux vrais arguments. */
export function sanitizeIntentArgs(args: unknown[]): unknown[] {
  const jsonSafe = (v: unknown) => {
    try {
      JSON.stringify(v);
      return true;
    } catch {
      return false;
    }
  };
  const out = [...args];
  while (out.length && (!jsonSafe(out[out.length - 1]) || typeof out[out.length - 1] === 'function')) out.pop();
  return out;
}
