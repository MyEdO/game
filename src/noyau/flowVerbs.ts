/**
 * SOURCE UNIQUE du câblage des flux de jet différé — table de DONNÉES PURE (aucun import runtime).
 *
 * Elle vit à part de `rollFlowSpecs.ts` parce que ses consommateurs ne veulent PAS le graphe du store :
 * `noyau/intentionsDeSiege.ts` et `netOwnership` en DÉRIVENT la surface d'intents invité et sa possession, et
 * `rollFlowSpecs` (donc `FLOWS`, donc le store) n'est pas importable depuis là sans cycle d'initialisation.
 *
 * `FLOW_VERBS` porte, par flux, son type (mono/multi) et le SOUS-ENSEMBLE des verbes de jet qu'il accepte — MAIS PAS
 * le handler : le handler `FLOWS.x` référence `Get`/`Set` → `Jeu`, donc l'inclure dans la source du TYPE créerait un
 * CYCLE (`FLOWS` deviendrait `any`). `FLOW_HANDLERS` (rollFlowSpecs) associe le handler pour le seul RUNTIME, avec
 * exhaustivité garantie. Un geste de jet est UN verbe du noyau par verbe de `VERBES_DE_JET` (`jet<Verbe>`), le flux
 * en premier argument (`NOM_DU_VERBE_DE_JET`, `VerbesDeJet`) : la table dit quels flux il accepte (`FluxDuVerbe`).
 */

/** Les verbes du cycle de jet différé (cf. `RollFlowHandlers`). `resist` = Résistance (Menace),
 *  LDB 10 — exposé par les seuls flux à `caps.resist` (Tests qui « résistent à une menace »).
 *  `cancel` = « Annuler » unifié (cascade-aware + `onCancel` métier) — exposé par les flux annulables ;
 *  sans `pid` (annuler ferme la modale/cascade entière, pas un slot). */
export const VERBES_DE_JET = ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist', 'determine', 'cancel', 'reverse'] as const;
export type RollVerb = (typeof VERBES_DE_JET)[number];

interface FlowVerbsBase {
  verbs: readonly RollVerb[];
}
/** Où vit, DANS l'état, l'id du combattant qui TIENT le jet d'un flux mono (`s[pending][field]`) —
 *  donnée pure, résolue par `netOwnership.intentAllowedFor`. `pending` reste `string` ICI : importer
 *  `PendingKey` (type de `Jeu`) rendrait `FLOWS` `any` — le cycle que l'en-tête de ce module
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
  /** MULTI : `pidIsActor` déclare à QUI appartient la rangée que vise un geste de jet (`pid`) — `true` = l'id
   *  du COMBATTANT du slot (la possession du jet suit son propriétaire, `netOwnership`), `false` = un id
   *  de slot SANS acteur propre (Round, étape) → la possession retombe sur le owner de la modale.
   *  OBLIGATOIRE : tout flux multi tranche, aucun défaut silencieux.
   *  `resolution` OBLIGATOIRE (#1050) : les actions de store MANUSCRITES qui résolvent/closent CETTE
   *  fenêtre (Appliquer / Annuler / avancer). Elles sont DÉRIVÉES dans la surface invité. Liste VIDE = ce flux n'a aucune action de clôture propre (sa
   *  fenêtre est close par la cascade hôte). Leur POSSESSION est celle de la FENÊTRE (repli
   *  `modalOwnerOf`) et non d'un porteur : ce sont des décisions de GROUPE qui agrègent TOUTES les
   *  rangées — router `oppositionConfirm` sur le lanceur rendrait un Sort ENNEMI inapplicable dès
   *  qu'aucun siège ne porte le rôle MJ (mesuré, `surface-1050-intent-path.hors-store.test.ts`). */
  | (FlowVerbsBase & { kind: 'multi'; pidIsActor: boolean; resolution: readonly string[] });

export const FLOW_VERBS = {
  attack:       { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'cancel', 'forceSuccess', 'setForcedRoll', 'reverse'], jetOwner: { pending: 'pendingAttack', field: 'attackerId' } },
  defense:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse'], jetOwner: { pending: 'pendingDefense', field: 'defenderId' } },
  cast:         { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], jetOwner: { pending: 'pendingCast', field: 'casterId' } },
  disengage:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], jetOwner: { pending: 'pendingDisengage', field: 'moverId' } },
  // « Fuir » : MULTI hétérogène (coup dans le dos du frappeur + Test `fuite` du fuyard) — `setForcedRoll`
  // sert le dé CHOISI du coup dans le dos (double 11 → Coup Critique, LDB 13 l.183).
  flee:         { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], resolution: ['fleeConfirm'] },
  auContact:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], jetOwner: { pending: 'pendingAuContact', field: 'moverId' } },
  grapple:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], jetOwner: { pending: 'pendingGrapple', field: 'actorId' } },
  battement:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse', 'cancel'], jetOwner: { pending: 'pendingBattement', field: 'attackerId' } },
  distraire:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], jetOwner: { pending: 'pendingDistraire', field: 'moverId' } },
  // Manœuvre de créature : la modale n'influence QUE le jet de l'ATTAQUANT (les jets des défenseurs
  // vivent dans `maneuverConfirm`) — le porteur est donc `attackerId`, jamais la cible.
  maneuver:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], jetOwner: { pending: 'pendingManeuver', field: 'attackerId' } },
  run:          { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel'], jetOwner: { pending: 'pendingRun', field: 'combatantId' } },
  // Chute VOLONTAIRE (clic sur une arête de capacité `chute`, ouverte par `battleClickTile`).
  fall:         { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel'], resolution: ['fallConfirm'] },
  reload:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], jetOwner: { pending: 'pendingReload', field: 'actorId' } },
  handGate:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], jetOwner: { pending: 'pendingHandGate', field: 'attackerId' } },
  recover:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], jetOwner: { pending: 'pendingStateRecovery', field: 'actorId' } },
  focus:        { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], jetOwner: { pending: 'pendingFocus', field: 'casterId' } },
  // Contre-magie : `casterId` = le DISSIPEUR qui roule (le sort visé porte son propre `spellCasterId`,
  // qui ne dépense rien ici).
  dispel:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], jetOwner: { pending: 'pendingDispel', field: 'casterId' } },
  frenzy:       { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel'], jetOwner: { pending: 'pendingFrenzy', field: 'combatantId' } },
  approach:     { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact', 'reverse', 'cancel'], jetOwner: { pending: 'pendingApproach', field: 'combatantId' } },
  ward:         { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel'], jetOwner: { pending: 'pendingWard', field: 'attackerId' } },
  // Soin / Chirurgie : le SOIGNEUR roule et dépense (le patient ne lance rien) — `targetId` ne porte
  // aucun jet.
  heal:         { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse', 'cancel'], jetOwner: { pending: 'pendingHeal', field: 'healerId' } },
  surgery:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], jetOwner: { pending: 'pendingSurgery', field: 'healerId' } },
  corruption:   { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist'], jetOwner: { pending: 'pendingCorruption', field: 'heroId' } },
  // Test générique : `actorId` est MUTABLE (`testSetActor` — le Test change de testeur en place) ; la
  // possession se résout À LA LECTURE de l'état, donc sur le testeur COURANT.
  // `determine` = Détermination (LDB 17 l.59) : même verbe que `cascadeBatch`, corps dans `FLOWS.test.caps`.
  test:         { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'determine', 'cancel', 'reverse'], jetOwner: { pending: 'pendingTest', field: 'actorId' } },
  steamSave:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingSteamSave', field: 'actorId' } },
  activity:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'reverse'], jetOwner: { pending: 'pendingActivity', field: 'heroId' } },
  // Marchandage / Évaluation : fenêtres rendues HORS `ActiveModal` (`CampaignView`), absentes de
  // `MODAL_DEFS` et hors combat — leurs `resolution` sont routées par le porteur, sans quoi il joue
  // son jet sans pouvoir le clore.
  bargain:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], jetOwner: { pending: 'pendingBargain', field: 'playerId' }, resolution: ['bargainConfirm'] },
  appraise:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], jetOwner: { pending: 'pendingAppraise', field: 'actorId' }, resolution: ['resolveAppraise'] },
  shanty:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel'], jetOwner: { pending: 'pendingShanty', field: 'singerId' } },
  counterspell: { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], resolution: ['counterspellConfirm'] },
  // `pid` = id d'ÉTAPE (`CascadeStep.id`), pas un combattant : la possession d'un geste de cascade
  // vient du owner de la modale (`modalArbiter` : acteur de l'étape courante / '*' / siège MONDE).
  // `resist` et `reverse` font exception : ils DÉPENSENT la ressource de l'acteur de l'étape (talent,
  // jeton d'inversion), donc ils sont routés sur LUI (`netOwnership`, `acteurDEtape`),
  // jamais sur la fenêtre — une étape de GROUPE ('*') laissait sinon n'importe quel siège brûler la
  // ressource d'autrui.
  cascade:      { kind: 'multi', pidIsActor: false, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist', 'reverse'], resolution: ['cascadeNext', 'cascadeResolveAll', 'cascadeFinish'] },
  opposition:   { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist'], resolution: ['oppositionConfirm'] },
  // `pid` = id de ROUND (`ExtendedTestRound.id`), pas un combattant : même politique que `cascade`.
  extendedTest: { kind: 'multi', pidIsActor: false, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse', 'cancel'], resolution: ['extendedTestNext'] },
  // LOT DE DÉS d'un étal (#1426) : des dés du MONDE, déjà tombés — le seul verbe est la POSE
  // (`setForcedRoll`). Ni `roll` (rien à lancer), ni Chance/Pacte/Résilience (on n'influence pas la
  // marchandise d'un étal). `pidIsActor: false` : un `pid` est un DÉ, jamais un combattant.
  etalLot:      { kind: 'multi', pidIsActor: false, verbs: ['setForcedRoll', 'cancel'], resolution: ['etalLotConfirm'] },
  forceDoor:    { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel'], resolution: ['forceDoorConfirm'] },
  shipManeuver: { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel'], resolution: ['shipManeuverConfirm'] },
  shipBattery:  { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel'], resolution: ['shipBatteryConfirm'] },
  crewTest:     { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel'], resolution: ['crewTestConfirm'] },
  // Étape « batch » DANS une cascade : aucune action de clôture propre — c'est la cascade qui avance.
  // PARITÉ de verbes avec l'étape MONO `cascade` : une bande met en jeu les MÊMES règles qu'une étape
  // seule — `resist` (LDB 10 l.1016-1020) s'y joue PAR RANGÉE, routé par le porteur du participant
  // (`pidIsActor:true`), jamais sur la fenêtre partagée ; `determine` (LDB 17 l.59) de même, la
  // Psychologie ne se testant qu'en bandes (déclaration sur l'ÉTAPE, immunité sur la RANGÉE).
  cascadeBatch: { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'resist', 'determine', 'reverse'], resolution: [] },
} as const satisfies Record<string, FlowVerbs>;

export type FlowKey = keyof typeof FLOW_VERBS;

/** Le verbe du noyau de chaque verbe de jet : `jet<Verbe>`, le flux en premier argument (`VerbesDeJet`). */
export const NOM_DU_VERBE_DE_JET = {
  roll: 'jetRoll', reroll: 'jetReroll', bonusSL: 'jetBonusSL', darkPact: 'jetDarkPact', forceSuccess: 'jetForceSuccess',
  setForcedRoll: 'jetSetForcedRoll', resist: 'jetResist', determine: 'jetDetermine', cancel: 'jetCancel', reverse: 'jetReverse',
} as const satisfies { [V in RollVerb]: `jet${Capitalize<V>}` };
export type NomDeVerbeDeJet = (typeof NOM_DU_VERBE_DE_JET)[RollVerb];

/** Le verbe de jet que nomme le verbe du noyau `nom`, `null` hors des verbes de jet. */
export const verbeDeJetDe = (nom: string): RollVerb | null => VERBES_DE_JET.find((v) => NOM_DU_VERBE_DE_JET[v] === nom) ?? null;

/** Les flux qui acceptent le verbe de jet `V`. */
export type FluxDuVerbe<V extends RollVerb> = { [K in FlowKey]: V extends (typeof FLOW_VERBS)[K]['verbs'][number] ? K : never }[FlowKey];

/** Le flux `flux` (une donnée de frontière : JSON d'un hôte, intention d'un siège) accepte-t-il le verbe `verbe` ? */
export function fluxAccepte<V extends RollVerb>(flux: unknown, verbe: V): flux is FluxDuVerbe<V> {
  return typeof flux === 'string' && Object.prototype.hasOwnProperty.call(FLOW_VERBS, flux) && (FLOW_VERBS[flux as FlowKey].verbs as readonly RollVerb[]).includes(verbe);
}

/** Le geste de jet `verbe` sur `flux` vise-t-il une rangée (`pid`) ? Sur un flux à plusieurs jets, toujours, sauf
 *  l'annulation qui ferme la fenêtre entière ; sur un flux à un jet, jamais. */
export const viseUneRangee = (flux: FlowKey, verbe: RollVerb): boolean => FLOW_VERBS[flux].kind === 'multi' && verbe !== 'cancel';

/**
 * Surface d'intents invité DÉRIVÉE de la table — aucun flux n'a de ligne à écrire dans
 * `noyau/intentionsDeSiege.ts` : les dix verbes de jet (`NOM_DU_VERBE_DE_JET`), PLUS les actions de `resolution` de
 * chaque flux. Le porteur d'un jet peut être le héros d'un autre siège ; la surface ne décide donc rien, elle suit la
 * POSSESSION, seule garde de dépense (`netOwnership.intentAllowedFor`, route de chaque verbe de jet par son flux).
 */
export function coopFlowIntents(): string[] {
  return [...Object.values(NOM_DU_VERBE_DE_JET), ...Object.values(FLOW_VERBS).flatMap((w: FlowVerbs) => w.resolution ?? [])];
}

/**
 * Actions de `resolution` des flux MONO, dont la possession suit le PORTEUR DU JET désigné en donnée (`jetOwner`) :
 * `netOwnership.intentAllowedFor` y route la possession sur `seatOwns(s[pending][field])` au lieu du owner de la
 * modale, par le MÊME porteur que les verbes de jet de ce flux — influencer et CLORE ne peuvent pas répondre
 * différemment.
 */
export function resolutionsDuPorteur(): Record<string, JetOwnerRef> {
  const out: Record<string, JetOwnerRef> = {};
  for (const w of Object.values(FLOW_VERBS) as FlowVerbs[]) {
    if (w.kind !== 'mono') continue;
    for (const a of w.resolution ?? []) out[a] = w.jetOwner;
  }
  return out;
}
