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
export const VERBES_DE_JET = ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist', 'cancel', 'reverse', 'confirm'] as const;
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
   *  à la compilation (`netOwnership._jetOwnerPendingCheck` / `_jetOwnerFieldCheck`). */
  | (FlowVerbsBase & { kind: 'mono'; jetOwner: JetOwnerRef })
  /** MULTI : `pidIsActor` déclare à QUI appartient la rangée que vise un geste de jet (`pid`) — `true` = l'id
   *  du COMBATTANT du slot (la possession du jet suit son propriétaire, `netOwnership`), `false` = un id
   *  de slot SANS acteur propre (Round, étape) → la possession retombe sur le owner de la modale.
   *  OBLIGATOIRE : tout flux multi tranche, aucun défaut silencieux. */
  | (FlowVerbsBase & { kind: 'multi'; pidIsActor: boolean });

export const FLOW_VERBS = {
  attack:       { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'cancel', 'forceSuccess', 'setForcedRoll', 'reverse', 'confirm'], jetOwner: { pending: 'pendingAttack', field: 'attackerId' } },
  defense:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse', 'confirm'], jetOwner: { pending: 'pendingDefense', field: 'defenderId' } },
  cast:         { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'], jetOwner: { pending: 'pendingCast', field: 'casterId' } },
  disengage:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'], jetOwner: { pending: 'pendingDisengage', field: 'moverId' } },
  // « Fuir » : MULTI hétérogène (coup dans le dos du frappeur + Test `fuite` du fuyard) — `setForcedRoll`
  // sert le dé CHOISI du coup dans le dos (double 11 → Coup Critique, LDB 13 l.183).
  flee:         { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'confirm'] },
  auContact:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'], jetOwner: { pending: 'pendingAuContact', field: 'moverId' } },
  grapple:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'], jetOwner: { pending: 'pendingGrapple', field: 'actorId' } },
  battement:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse', 'cancel', 'confirm'], jetOwner: { pending: 'pendingBattement', field: 'attackerId' } },
  distraire:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'], jetOwner: { pending: 'pendingDistraire', field: 'moverId' } },
  // Manœuvre de créature : la modale n'influence QUE le jet de l'ATTAQUANT (les jets des défenseurs
  // vivent dans `jetValider('maneuver')`) — le porteur est donc `attackerId`, jamais la cible.
  maneuver:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'], jetOwner: { pending: 'pendingManeuver', field: 'attackerId' } },
  run:          { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel', 'confirm'], jetOwner: { pending: 'pendingRun', field: 'combatantId' } },
  // Chute VOLONTAIRE (clic sur une arête de capacité `chute`, ouverte par `cliquerLaCaseDuCombat`).
  fall:         { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel', 'confirm'] },
  reload:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'], jetOwner: { pending: 'pendingReload', field: 'actorId' } },
  handGate:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'], jetOwner: { pending: 'pendingHandGate', field: 'attackerId' } },
  recover:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'], jetOwner: { pending: 'pendingStateRecovery', field: 'actorId' } },
  focus:        { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'], jetOwner: { pending: 'pendingFocus', field: 'casterId' } },
  // Contre-magie : `casterId` = le DISSIPEUR qui roule (le sort visé porte son propre `spellCasterId`,
  // qui ne dépense rien ici).
  dispel:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'], jetOwner: { pending: 'pendingDispel', field: 'casterId' } },
  frenzy:       { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel', 'confirm'], jetOwner: { pending: 'pendingFrenzy', field: 'combatantId' } },
  approach:     { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact', 'reverse', 'cancel', 'confirm'], jetOwner: { pending: 'pendingApproach', field: 'combatantId' } },
  ward:         { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel', 'confirm'], jetOwner: { pending: 'pendingWard', field: 'attackerId' } },
  // Soin / Chirurgie : le SOIGNEUR roule et dépense (le patient ne lance rien) — `targetId` ne porte
  // aucun jet.
  heal:         { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse', 'cancel', 'confirm'], jetOwner: { pending: 'pendingHeal', field: 'healerId' } },
  surgery:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'], jetOwner: { pending: 'pendingSurgery', field: 'healerId' } },
  corruption:   { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist', 'confirm'], jetOwner: { pending: 'pendingCorruption', field: 'heroId' } },
  // Test générique : `actorId` est MUTABLE (réglage `test.testeur` — le Test change de testeur en place) ; la
  // possession se résout À LA LECTURE de l'état, donc sur le testeur COURANT.
  test:         { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'reverse', 'confirm'], jetOwner: { pending: 'pendingTest', field: 'actorId' } },
  steamSave:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'confirm'], jetOwner: { pending: 'pendingSteamSave', field: 'actorId' } },
  activity:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'reverse', 'confirm'], jetOwner: { pending: 'pendingActivity', field: 'heroId' } },
  bargain:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'], jetOwner: { pending: 'pendingBargain', field: 'playerId' } },
  appraise:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'], jetOwner: { pending: 'pendingAppraise', field: 'actorId' } },
  shanty:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel', 'confirm'], jetOwner: { pending: 'pendingShanty', field: 'singerId' } },
  counterspell: { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'] },
  // `pid` = id d'ÉTAPE (`CascadeStep.id`), pas un combattant : la possession d'un geste de cascade
  // vient du owner de la modale (`modalArbiter` : acteur de l'étape courante / '*' / siège MONDE).
  // `resist` et `reverse` font exception : ils DÉPENSENT la ressource de l'acteur de l'étape (talent,
  // jeton d'inversion), donc ils sont routés sur LUI (`netOwnership`, `acteurDEtape`),
  // jamais sur la fenêtre — une étape de GROUPE ('*') laissait sinon n'importe quel siège brûler la
  // ressource d'autrui. `confirm` valide l'étape courante, quelle que soit son interaction.
  cascade:      { kind: 'multi', pidIsActor: false, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist', 'reverse', 'confirm'] },
  opposition:   { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist', 'confirm'] },
  // `pid` = id de ROUND (`ExtendedTestRound.id`), pas un combattant : même politique que `cascade`.
  extendedTest: { kind: 'multi', pidIsActor: false, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse', 'cancel', 'confirm'] },
  // LOT DE DÉS d'un étal (#1426) : des dés du MONDE, déjà tombés — le seul verbe est la POSE
  // (`setForcedRoll`). Ni `roll` (rien à lancer), ni Chance/Pacte/Résilience (on n'influence pas la
  // marchandise d'un étal). `pidIsActor: false` : un `pid` est un DÉ, jamais un combattant.
  etalLot:      { kind: 'multi', pidIsActor: false, verbs: ['setForcedRoll', 'confirm'] },
  forceDoor:    { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'confirm'] },
  shipManeuver: { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel', 'confirm'] },
  shipBattery:  { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'cancel', 'confirm'] },
  // Étape « batch » DANS une cascade : aucune action de clôture propre — la cascade valide l'étape (`jetValider('cascade')`).
  // PARITÉ de verbes avec l'étape MONO `cascade` : une bande met en jeu les MÊMES règles qu'une étape
  // seule — `resist` (LDB 10 l.1016-1020) s'y joue PAR RANGÉE, routé par le porteur du participant
  // (`pidIsActor:true`), jamais sur la fenêtre partagée.
  cascadeBatch: { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact', 'resist', 'reverse'] },
  // Dé d'une étape de cascade, sur une table ou nu (#942, #1508) : un tirage, pas un Test — ni influence ni clôture
  // propre, la cascade valide l'étape. `pid` = id d'ÉTAPE.
  cascadeTirage: { kind: 'multi', pidIsActor: false, verbs: ['roll', 'setForcedRoll'] },
  // Maladresse (LDB 14) : le tirage sur le Tableau des Oups ! de l'étape, puis son application. `pid` = id d'ÉTAPE.
  fumble:       { kind: 'multi', pidIsActor: false, verbs: ['roll', 'confirm'] },
} as const satisfies Record<string, FlowVerbs>;

export type FlowKey = keyof typeof FLOW_VERBS;

/** Les actions des verbes de jet, `jet<Action>…` (#3371 §3.1) : celles de `NOM_DU_VERBE_DE_JET`, et `regler` (`VerbeDeReglage`). */
export type ActionDeJet = 'lancer' | 'relancer' | 'ajouter' | 'pactiser' | 'forcer' | 'imposer' | 'resister'
  | 'annuler' | 'inverser' | 'valider' | 'regler';

/** Le verbe du noyau de chaque verbe de jet, le flux en premier argument (`VerbesDeJet`) : la seule source de son nom. */
export const NOM_DU_VERBE_DE_JET = {
  roll: 'jetLancer', reroll: 'jetRelancer', bonusSL: 'jetAjouterUnDR', darkPact: 'jetPactiser', forceSuccess: 'jetForcerLaReussite',
  setForcedRoll: 'jetImposerLeResultat', resist: 'jetResister', cancel: 'jetAnnuler',
  reverse: 'jetInverser', confirm: 'jetValider',
} as const satisfies { [V in RollVerb]: `jet${Capitalize<ActionDeJet>}${string}` };
export type NomDeVerbeDeJet = (typeof NOM_DU_VERBE_DE_JET)[RollVerb];

/** Le verbe de jet que nomme le verbe du noyau `nom`, `null` hors des verbes de jet. */
export const verbeDeJetDe = (nom: string): RollVerb | null => VERBES_DE_JET.find((v) => NOM_DU_VERBE_DE_JET[v] === nom) ?? null;

/** Les flux qui acceptent le verbe de jet `V`. */
export type FluxDuVerbe<V extends RollVerb> = { [K in FlowKey]: V extends (typeof FLOW_VERBS)[K]['verbs'][number] ? K : never }[FlowKey];

/** Le flux `flux` (une donnée de frontière : JSON d'un hôte, intention d'un siège) accepte-t-il le verbe `verbe` ? */
export function fluxAccepte<V extends RollVerb>(flux: unknown, verbe: V): flux is FluxDuVerbe<V> {
  return typeof flux === 'string' && Object.prototype.hasOwnProperty.call(FLOW_VERBS, flux) && (FLOW_VERBS[flux as FlowKey].verbs as readonly RollVerb[]).includes(verbe);
}

/** Les verbes de jet qui agissent sur la fenêtre entière, jamais sur une rangée : l'annulation et la clôture. */
export const estVerbeDeFenetre = (verbe: RollVerb): boolean => verbe === 'cancel' || verbe === 'confirm';

/** Le geste de jet `verbe` sur `flux` vise-t-il une rangée (`pid`) ? Sur un flux à plusieurs jets, toujours, sauf un
 *  verbe de fenêtre (`estVerbeDeFenetre`) ; sur un flux à un jet, jamais. */
export const viseUneRangee = (flux: FlowKey, verbe: RollVerb): boolean => FLOW_VERBS[flux].kind === 'multi' && !estVerbeDeFenetre(verbe);

/** Le geste de jet `verbe` sur `flux` se joue-t-il aussi sans rangée ? Le jet d'un flux à plusieurs jets : sans `pid`,
 *  chaque rangée que le siège qui le joue doit lancer (« Tout lancer »). */
export const rangeeFacultative = (flux: FlowKey, verbe: RollVerb): boolean => FLOW_VERBS[flux].kind === 'multi' && verbe === 'roll';

/**
 * Surface d'intents invité DÉRIVÉE de la table — aucun flux n'a de ligne à écrire dans
 * `noyau/intentionsDeSiege.ts` : les verbes de jet (`NOM_DU_VERBE_DE_JET`), clôture comprise. Le porteur d'un jet peut
 * être le héros d'un autre siège ; la surface ne décide donc rien, elle suit la POSSESSION (`netOwnership.intentAllowedFor`,
 * route de chaque verbe de jet par son flux).
 */
export function coopFlowIntents(): string[] {
  return Object.values(NOM_DU_VERBE_DE_JET);
}
