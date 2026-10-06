/**
 * SOURCE UNIQUE du câblage des flux de jet différé — table de DONNÉES PURE (aucun import runtime).
 *
 * Elle vit à part de `rollFlowSpecs.ts` parce que ses consommateurs ne veulent PAS le graphe du store :
 * `net/intents.ts` en DÉRIVE la surface d'intents invité, et `rollFlowSpecs` (donc `FLOWS`, donc le store)
 * n'est pas importable depuis là sans cycle d'initialisation. `rollFlowSpecs` la ré-exporte pour ses
 * propres consommateurs.
 *
 * `FLOW_VERBS` porte, par flux (clé = PRÉFIXE des délégués `<prefix><Verbe>` du store), son type
 * (mono/multi) et le SOUS-ENSEMBLE de verbes exposés — MAIS PAS le handler. C'est délibéré :
 * le handler `FLOWS.x` référence `Get`/`Set` → `GameState` → `RollFlowActionsMap`, donc l'inclure dans la
 * source du TYPE créerait un CYCLE (`FLOWS` deviendrait `any`). `FLOW_VERBS` (sans handler) est donc la
 * source du TYPE (`RollFlowActionsMap`, dans `rollFlowSpecs`) ET des verbes runtime/intents ;
 * `FLOW_HANDLERS` associe le handler pour le seul RUNTIME (`buildRollFlowActions`), avec exhaustivité
 * garantie. Le préfixe est DÉCORRÉLÉ de la clé `FLOWS` (2 cas : shipBattery→FLOWS.battery,
 * opposition→FLOWS.castOpposition).
 * La surface d'intents invité se DÉRIVE (`coopFlowIntents`) : tout flux MONO expose TOUS ses verbes
 * (#1017 — la garde de dépense est `netOwnership.intentAllowedFor`, routage par porteur) ; un flux
 * MULTI l'expose sur `coop:true`.
 */

/** Les verbes du cycle de jet différé (cf. `RollFlowHandlers`). `resist` = Résistance (Menace),
 *  LDB 10 — exposé par les seuls flux à `caps.resist` (Tests qui « résistent à une menace »).
 *  `cancel` = « Annuler » unifié (cascade-aware + `onCancel` métier) — exposé par les flux annulables ;
 *  sans `pid` (annuler ferme la modale/cascade entière, pas un slot). */
export type RollVerb = 'roll' | 'reroll' | 'bonusSL' | 'darkPact' | 'forceSuccess' | 'setForcedRoll' | 'resist' | 'determine' | 'cancel' | 'reverse';

interface FlowVerbsBase {
  verbs: readonly RollVerb[];
}
/** Où vit, DANS l'état, l'id du combattant qui TIENT le jet d'un flux mono (`s[pending][field]`) —
 *  donnée pure, résolue par `netOwnership.intentAllowedFor`. `pending` reste `string` ICI : importer
 *  `PendingKey` (type de `GameState`) rendrait `FLOWS` `any` — le cycle que l'en-tête de ce module
 *  décrit (585 erreurs `TS2339` mesurées). Le VERROU de compilation qui exige un `pending*` réel vit
 *  donc chez le consommateur (`netOwnership._jetOwnerPendingCheck`), où `PendingKey` est importable. */
export interface JetOwnerRef { pending: string; field: string }

export type FlowVerbs =
  /** MONO : `jetOwner` déclare le PORTEUR du jet — l'acteur dont ces verbes DÉPENSENT les ressources
   *  (Chance, Résilience, Corruption du Pacte, jeton d'inversion). La possession se route sur LUI, et
   *  non sur le owner de la FENÊTRE ACTIVE, qui n'est pas le porteur dans deux situations mesurées :
   *  fenêtre PARTAGÉE (owner '*' — Sort ennemi hébergeant opposition/Contre-sort, #1005) et fenêtre
   *  d'un AUTRE acteur ouverte par-dessus (Défense interposée, #1013 : le siège du DÉFENSEUR tenait
   *  les verbes `attack*`, celui de l'attaquant les `defense*`).
   *  OBLIGATOIRE (#1015) : tout flux mono tranche sa possession, aucun repli silencieux sur le owner
   *  de la modale. Le porteur se lit au SITE QUI DÉPENSE — `rollFlowSpecs.<flux>.actor`, l'acteur que
   *  `opReroll`/`opBonusSL`/`opForceSuccess`/`opDarkPact` débitent — jamais au registre des modales
   *  (`MODAL_DEFS` porte des covers de cascade et des owners partagés `'*'`). La confrontation
   *  table⇄spec est GARDÉE (`jet-owner-vs-spec.test.ts`), la clé `pending` et le `field` sont verrouillés
   *  à la compilation (`netOwnership._jetOwnerPendingCheck` / `_jetOwnerFieldCheck`).
   *  `resolution` : les actions de store MANUSCRITES qui closent ce jet (Conclure/Appliquer/Annuler),
   *  routées par le MÊME porteur et exposées avec ses verbes. À déclarer quand le repli
   *  `modalOwnerOf` ne désigne PAS le porteur : les fenêtres HORS registre de modales et HORS combat
   *  (Marchandage, Évaluation — `MODAL_DEFS` ne les porte pas, et sans combattant actif le repli rend
   *  l'hôte) laissaient le porteur invité jouer son jet sans pouvoir le CLORE : Conclure s'exécutait
   *  chez lui puis était écrasé au snapshot. */
  | (FlowVerbsBase & { kind: 'mono'; jetOwner: JetOwnerRef; resolution?: readonly string[] })
  /** MULTI : `pidIsActor` déclare à QUI appartient le 1ᵉʳ argument des délégués (`pid`) — `true` = l'id
   *  du COMBATTANT du slot (la possession du jet suit son propriétaire, `netOwnership`), `false` = un id
   *  de slot SANS acteur propre (Round, étape) → la possession retombe sur le owner de la modale.
   *  OBLIGATOIRE : tout flux multi tranche, aucun défaut silencieux.
   *  `coop` : verbes exposés comme intents invité. Il ne vit QUE sur cette branche (#1017) — un flux
   *  MONO n'a rien à décider, sa surface se DÉRIVE de sa possession (`coopFlowIntents`), et un
   *  `coop:true` reposé sur un mono ne compile plus.
   *  `resolution` OBLIGATOIRE (#1050) : les actions de store MANUSCRITES qui résolvent/closent CETTE
   *  fenêtre (Appliquer / Annuler / avancer). Elles sont DÉRIVÉES dans la surface invité comme les
   *  verbes — avant, chaque flux multi les recopiait à la main dans `net/intents.ts` (2 lignes que
   *  personne ne vérifiait : `oppositionConfirm` y manquait, et la cible invitée d'un sort opposé
   *  jetait sans pouvoir appliquer). Liste VIDE = ce flux n'a aucune action de clôture propre (sa
   *  fenêtre est close par la cascade hôte). Leur POSSESSION est celle de la FENÊTRE (repli
   *  `modalOwnerOf`) et non d'un porteur : ce sont des décisions de GROUPE qui agrègent TOUTES les
   *  rangées — router `oppositionConfirm` sur le lanceur rendrait un Sort ENNEMI inapplicable dès
   *  qu'aucun siège ne porte le rôle MJ (mesuré, `surface-1050-intent-path.test.ts`). */
  | (FlowVerbsBase & { kind: 'multi'; pidIsActor: boolean; coop?: boolean; resolution: readonly string[] });

export const FLOW_VERBS = {
  attack:       { kind: 'mono',  verbs: ['reroll', 'bonusSL', 'darkPact', 'cancel', 'forceSuccess', 'setForcedRoll', 'reverse'], jetOwner: { pending: 'pendingAttack', field: 'attackerId' } },
  defense:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse'], jetOwner: { pending: 'pendingDefense', field: 'defenderId' } },
  cast:         { kind: 'mono',  verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingCast', field: 'casterId' } },
  disengage:    { kind: 'mono', verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingDisengage', field: 'moverId' } },
  // « Fuir » : MULTI hétérogène (coup dans le dos du frappeur + Calme du fuyard) — `setForcedRoll`
  // sert le dé CHOISI du coup dans le dos (double 11 → Coup Critique, LDB 13 l.183).
  flee:         { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true, resolution: ['fleeConfirm'] },
  auContact:    { kind: 'mono', verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingAuContact', field: 'moverId' } },
  grapple:      { kind: 'mono', verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingGrapple', field: 'actorId' } },
  trample:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingTrample', field: 'attackerId' } },
  battement:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingBattement', field: 'attackerId' } },
  distraire:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingDistraire', field: 'moverId' } },
  // Manœuvre de créature : la modale n'influence QUE le jet de l'ATTAQUANT (les jets des défenseurs
  // vivent dans `maneuverConfirm`) — le porteur est donc `attackerId`, jamais la cible.
  maneuver:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingManeuver', field: 'attackerId' } },
  run:          { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], jetOwner: { pending: 'pendingRun', field: 'combatantId' } },
  // Chute VOLONTAIRE (clic sur une arête de capacité `chute`, ouverte par `battleClickTile`).
  fall:         { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true, resolution: ['fallConfirm', 'fallCancel'] },
  reload:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingReload', field: 'actorId' } },
  handGate:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingHandGate', field: 'attackerId' } },
  recover:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingStateRecovery', field: 'actorId' } },
  focus:        { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingFocus', field: 'casterId' } },
  // Contre-magie : `casterId` = le DISSIPEUR qui roule (le sort visé porte son propre `spellCasterId`,
  // qui ne dépense rien ici).
  dispel:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingDispel', field: 'casterId' } },
  frenzy:       { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact'], jetOwner: { pending: 'pendingFrenzy', field: 'combatantId' } },
  approach:     { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact'], jetOwner: { pending: 'pendingApproach', field: 'combatantId' } },
  ward:         { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact'], jetOwner: { pending: 'pendingWard', field: 'attackerId' } },
  // Soin / Chirurgie : le SOIGNEUR roule et dépense (le patient ne lance rien) — `targetId` ne porte
  // aucun jet.
  heal:         { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingHeal', field: 'healerId' } },
  surgery:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingSurgery', field: 'healerId' } },
  corruption:   { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist'], jetOwner: { pending: 'pendingCorruption', field: 'heroId' } },
  // Test générique : `actorId` est MUTABLE (`testSetActor` — le Test change de testeur en place) ; la
  // possession se résout À LA LECTURE de l'état, donc sur le testeur COURANT.
  // `determine` = Détermination (LDB 17 l.59) : même verbe que `cascadeBatch`, corps dans `FLOWS.test.caps`.
  test:         { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'determine', 'cancel', 'reverse'], jetOwner: { pending: 'pendingTest', field: 'actorId' } },
  steamSave:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingSteamSave', field: 'actorId' } },
  activity:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingActivity', field: 'heroId' } },
  // Marchandage / Évaluation : fenêtres rendues HORS `ActiveModal` (`CampaignView`), absentes de
  // `MODAL_DEFS` et hors combat — leurs `resolution` sont routées par le porteur, sans quoi il joue
  // son jet sans pouvoir le clore.
  bargain:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingBargain', field: 'playerId' }, resolution: ['bargainConfirm', 'bargainCancel'] },
  appraise:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingAppraise', field: 'actorId' }, resolution: ['resolveAppraise', 'appraiseCancel'] },
  shanty:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], jetOwner: { pending: 'pendingShanty', field: 'singerId' } },
  counterspell: { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, resolution: ['counterspellConfirm', 'counterspellCancel'] },
  // `pid` = id d'ÉTAPE (`CascadeStep.id`), pas un combattant : la possession d'un geste de cascade
  // vient du owner de la modale (`modalArbiter` : acteur de l'étape courante / '*' / siège MONDE).
  // `resist` fait exception : il DÉPENSE le talent de l'acteur de l'étape, donc il est routé sur LUI
  // (`netOwnership.ROUTES.cascadeResist`), jamais sur la fenêtre — une étape de GROUPE ('*') laissait
  // sinon n'importe quel siège brûler la Résistance d'autrui.
  cascade:      { kind: 'multi', pidIsActor: false, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist'], coop: true, resolution: ['cascadeNext', 'cascadeResolveAll', 'cascadeFinish'] },
  opposition:   { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist'], coop: true, resolution: ['oppositionConfirm'] },
  // `pid` = id de ROUND (`ExtendedTestRound.id`), pas un combattant : même politique que `cascade`.
  extendedTest: { kind: 'multi', pidIsActor: false, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, resolution: ['extendedTestNext', 'extendedTestCancel'] },
  // LOT DE DÉS d'un étal (#1426) : des dés du MONDE, déjà tombés — le seul verbe est la POSE
  // (`setForcedRoll`). Ni `roll` (rien à lancer), ni Chance/Pacte/Résilience (on n'influence pas la
  // marchandise d'un étal). `pidIsActor: false` : un `pid` est un DÉ, jamais un combattant.
  etalLot:      { kind: 'multi', pidIsActor: false, verbs: ['setForcedRoll'], coop: true, resolution: ['etalLotConfirm', 'etalLotCancel'] },
  forceDoor:    { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, resolution: ['forceDoorConfirm', 'forceDoorCancel'] },
  shipManeuver: { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true, resolution: ['shipManeuverConfirm', 'shipManeuverCancel'] },
  shipBattery:  { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true, resolution: ['shipBatteryConfirm', 'shipBatteryCancel'] },
  crewTest:     { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true, resolution: ['crewTestConfirm', 'crewTestCancel'] },
  // Étape « batch » DANS une cascade : aucune action de clôture propre — c'est la cascade qui avance.
  // PARITÉ de verbes avec l'étape MONO `cascade` : une bande met en jeu les MÊMES règles qu'une étape
  // seule — `resist` (LDB 10 l.1016-1020) s'y joue PAR RANGÉE, routé par le porteur du participant
  // (`pidIsActor:true`), jamais sur la fenêtre partagée ; `determine` (LDB 17 l.59) de même, la
  // Psychologie ne se testant qu'en bandes (déclaration sur l'ÉTAPE, immunité sur la RANGÉE).
  cascadeBatch: { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'resist', 'determine'], coop: true, resolution: [] },
} as const satisfies Record<string, FlowVerbs>;

export type FlowKey = keyof typeof FLOW_VERBS;

/** Nom du délégué de store (= nom d'intent) d'un verbe de flux : `<prefix><Verbe>`. */
export const flowActionName = (prefix: string, verb: string): string =>
  `${prefix}${verb.charAt(0).toUpperCase()}${verb.slice(1)}`;

/**
 * Surface d'intents invité DÉRIVÉE de la table — aucun flux n'a de ligne à écrire dans
 * `net/intents.ts` :
 *  - MONO : TOUS ses verbes, `resist` et `cancel` compris (#1017), PLUS ses actions de `resolution`.
 *    Le porteur d'un flux mono peut être le héros d'un autre siège ; la surface ne décide donc rien,
 *    elle suit la POSSESSION, seule garde de dépense (`netOwnership.intentAllowedFor` →
 *    `jetOwnedIntents` → `seatInfluences`). Le porteur joue son flux ENTIER : influencer ET clore.
 *  - MULTI : sur `coop:true`, TOUS ses verbes (#1050 — `resist` compris) PLUS ses actions de
 *    `resolution`. Le filtre historique sur `resist` tenait à l'absence de route : un verbe multi
 *    retombe sur le owner de la modale (`'*'` sur une étape partagée), qui n'encadre pas l'auto-succès
 *    de Résistance. Les DEUX flux qui l'exposent ont désormais leur route par PORTEUR — `opposition`
 *    par participant (`participantOwnedIntents`, `pidIsActor`), `cascade` par l'acteur de l'étape
 *    (`netOwnership.ROUTES.cascadeResist`) — donc le filtre n'a plus d'objet, et l'affordance de
 *    Résistance affichée à l'invité (rangée `RollRow`, `CascadeModal`/`CastModal`) converge enfin chez
 *    l'hôte au lieu de muter son store local.
 */
export function coopFlowIntents(): string[] {
  const out: string[] = [];
  for (const [prefix, w] of Object.entries(FLOW_VERBS) as [string, FlowVerbs][]) {
    if (w.kind === 'mono') {
      for (const v of w.verbs) out.push(flowActionName(prefix, v));
      for (const a of w.resolution ?? []) out.push(a);
      continue;
    }
    if (!w.coop) continue;
    for (const v of w.verbs) out.push(flowActionName(prefix, v));
    for (const a of w.resolution) out.push(a);
  }
  return out;
}

/**
 * Intents (`<prefix><Verbe>`) dont le 1ᵉʳ argument EST l'id du combattant qui tient le jet — DÉRIVÉS
 * des flux `kind:'multi'` à `pidIsActor:true`. `netOwnership.intentAllowedFor` y route la possession
 * sur `seatOwns(args[0])` au lieu du owner de la modale. `cancel` en est exclu : il ferme la situation
 * entière, sans `pid` (cf. `MultiRollActions`).
 */
export function participantOwnedIntents(): string[] {
  const out: string[] = [];
  for (const [prefix, w] of Object.entries(FLOW_VERBS) as [string, FlowVerbs][]) {
    if (w.kind !== 'multi' || !w.pidIsActor) continue;
    for (const v of w.verbs) if (v !== 'cancel') out.push(flowActionName(prefix, v));
  }
  return out;
}

/**
 * Intents (`<prefix><Verbe>`) dont la possession suit le PORTEUR DU JET désigné en donnée — DÉRIVÉS
 * des flux `kind:'mono'` porteurs d'un `jetOwner`. `netOwnership.intentAllowedFor` y route la
 * possession sur `seatOwns(s[pending][field])` au lieu du owner de la modale (qui vaut `'*'` sur une
 * fenêtre PARTAGÉE et accepterait alors la dépense de N'IMPORTE quel siège). TOUS les verbes y
 * passent, `cancel` COMPRIS (#1017) : fermer le jet d'autrui par une fenêtre partagée était ouvert à
 * tous les sièges (sonde `testCancel` sur étape `groupOwner`). Les actions de `resolution` déclarées
 * y passent aussi, par le MÊME porteur : influencer et CLORE ne peuvent pas répondre différemment.
 */
export function jetOwnedIntents(): Record<string, JetOwnerRef> {
  const out: Record<string, JetOwnerRef> = {};
  for (const [prefix, w] of Object.entries(FLOW_VERBS) as [string, FlowVerbs][]) {
    if (w.kind !== 'mono' || !w.jetOwner) continue;
    for (const v of w.verbs) out[flowActionName(prefix, v)] = w.jetOwner;
    for (const a of w.resolution ?? []) out[a] = w.jetOwner;
  }
  return out;
}
