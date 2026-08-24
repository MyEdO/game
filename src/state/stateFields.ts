/**
 * Manifeste des CHAMPS TRANSITOIRES du store (pendings, modales de jet, files de révélation,
 * vue éphémère…) — SOURCE UNIQUE de leur valeur initiale ET des contextes qui les réinitialisent.
 *
 * Avant ce manifeste, chaque champ `pending*` était re-listé À LA MAIN sur plusieurs sites de reset
 * (état initial `create()`, `transitionTo` = changement de scène, `startCombat` = ouverture de combat),
 * soit ~3 copies hand-tunées et désynchronisables (un pending remis à null dans un site mais pas
 * l'autre = régression silencieuse). Ici : UN tableau, deux dérivés.
 *
 * - `initialFields()` : le bloc `{ champ: init }` complet — l'état `create()` le spread (forme à plat
 *   IDENTIQUE : `snapshotSave`/coop itèrent `Object.keys(getInitialState())`, indépendant de l'ordre).
 * - `resetFields(scope)` : le sous-ensemble `{ champ: init }` des champs dont `resetOn` inclut `scope`.
 *   Les sites de reset font `set({ ...resetFields('scene'), …spécifique })` au lieu de re-lister.
 *
 * INVARIANT : `resetFields(scope)` reproduit EXACTEMENT le patch (clés + valeurs) que le site faisait
 * à la main. Un champ réinitialisé à une valeur ≠ `init` reste EXPLICITE hors `resetFields`, sur son site.
 */
import type { GameState } from './store';

/** Contextes de réinitialisation. `scene` = changement de scène (`transitionTo`) ;
 *  `combatStart` = ouverture de combat (`startCombat`). */
export type ResetScope = 'scene' | 'combatStart';

/** TOUTES les clés `pending*` de `GameState` — DÉRIVÉ (jamais une re-liste manuelle). Borne à la
 *  fois `STATE_FIELDS` ci-dessous (couverture reset, `satisfies` en pied) et le registre d'owner
 *  coop (`modalArbiter.ts` MODAL_DEFS.covers / HORS_MODAL) : un `pending*` ajouté à `GameState`
 *  qui n'apparaît nulle part dans l'un des deux casse tsc, à l'endroit qui l'oublie (#284). */
export type PendingKey = { [K in keyof GameState]-?: K extends `pending${string}` ? K : never }[keyof GameState];

/** Le manifeste : pour chaque champ transitoire, sa valeur initiale et les contextes qui le
 *  réinitialisent. SOURCE UNIQUE des clés — `FieldKey` en est DÉRIVÉ (fin de la double-liste). Le
 *  `satisfies` borne chaque clé à `keyof GameState` ET lie `init` au type du champ : bidirectionnel
 *  (clé fantôme ou `init` mal typé = compile rouge). */
const STATE_FIELDS = {
  pendingTest: { init: null, resetOn: ['scene'] },
  pendingCorruption: { init: null, resetOn: ['scene'] },
  corruptionQueue: { init: [], resetOn: ['scene'] },
  pendingBargain: { init: null, resetOn: [] },
  pendingAppraise: { init: null, resetOn: [] },
  pendingAttack: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingHandGate: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingSiegeAim: { init: null, resetOn: ['scene', 'combatStart'] },
  actorAim: { init: null, resetOn: ['combatStart'] },
  actorMove: { init: null, resetOn: ['combatStart'] },
  actorAoe: { init: null, resetOn: ['combatStart'] },
  // Retour d'IHM du dernier geste refusé (`refusVisible.ts`) : per-combat/per-scène comme le
  // télégraphe `actorAim` ci-dessus — un refus prononcé dans un combat n'ouvre pas le suivant, et
  // n'entre pas dans le checkpoint d'entrée de scène (`transitionTo` → `autoSave`).
  refus: { init: null, resetOn: ['scene', 'combatStart'] },
  hoverDelta: { init: null, resetOn: [] },
  pendingReload: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingStateRecovery: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingSteamSave: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingDefense: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingRenounce: { init: null, resetOn: [] },
  pendingMountTarget: { init: null, resetOn: ['combatStart'] },
  pendingDisengage: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingAuContact: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingGrapple: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingInteract: { init: null, resetOn: ['scene'] },
  pendingCast: { init: null, resetOn: ['combatStart'] },
  pendingCounterspell: { init: null, resetOn: ['combatStart'] },
  pendingExtendedTest: { init: null, resetOn: [] },
  /** LOT DE DÉS d'un étal (#1426) : ouvert AVANT l'écran de marché/port, refermé à sa validation. */
  pendingEtalLot: { init: null, resetOn: ['scene'] },
  pendingForceDoor: { init: null, resetOn: [] },
  pendingCascade: { init: null, resetOn: ['scene', 'combatStart'] },
  // Pile de cascades SUSPENDUES (state/cascade.ts) : DOIT survivre à `scene`/`combatStart` (c'est
  // PRÉCISÉMENT à ces cadres que la suspension pousse une entrée — un reset ICI la perdrait aussitôt).
  suspendedCascades: { init: [], resetOn: [] },
  // Tests d'entretien du franchissement de jour mis en file pendant un combat (#253) — consommés par
  // `openCombatEndCascade`. Réinitialisés à chaque nouveau combat/scène (per-combat, jamais reportés).
  deferredUpkeepQueue: { init: [], resetOn: ['scene', 'combatStart'] },
  sequence: { init: null, resetOn: ['scene', 'combatStart'] },
  sessionEndOpen: { init: false, resetOn: ['scene'] },
  pendingCastOpposition: { init: null, resetOn: ['combatStart'] }, // MÊME portée que l'incantation qu'elle oppose (pendingCast/pendingCounterspell) : la fenêtre ne survit pas à son Sort
  pendingHeal: { init: null, resetOn: ['combatStart'] },
  pendingSurgery: { init: null, resetOn: [] }, // hors-combat, vit DANS l'infirmerie (medic, resetOn []) — purgé avec elle
  medic: { init: null, resetOn: [] },
  pendingRest: { init: null, resetOn: [] },
  pendingCouncil: { init: null, resetOn: [] },
  pendingCleave: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingDualStrike: { init: null, resetOn: ['scene'] },
  pendingLogQueue: { init: [], resetOn: ['scene', 'combatStart'] },
  scheduledEffects: { init: [], resetOn: [] },
  pendingTrample: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingBattement: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingDistraire: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingManeuver: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingRun: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingFall: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingShipManeuver: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingShipBattery: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingCrewTest: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingShanty: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingApproach: { init: null, resetOn: ['scene'] },
  pendingWard: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingFocus: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingDispel: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingFrenzy: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingRoundStart: { init: null, resetOn: [] },
  // ÉCRAN DES CAPACITÉS (spec HUD zone 6) : surface plein champ, état d'ÉCRAN du client. Elle ne
  // survit ni à un changement de scène ni à l'ouverture d'un combat (on ne reprend pas la main sous
  // un voile ouvert au combat précédent) ; elle ne voyage pas non plus au snapshot coop
  // (`netFlow.netSnapshot`, même famille que `localIntent`).
  ecranCapacitesOuvert: { init: false, resetOn: ['scene', 'combatStart'] },
  preemptAiming: { init: null, resetOn: ['scene', 'combatStart'] },
  pendingFateSave: { init: null, resetOn: [] },
  pendingVictory: { init: null, resetOn: ['combatStart'] },
  // Vol terrestre en cours (#327 A5.1) : marqueur SURVIVANT à l'ouverture de combat (posé APRÈS
  // startCombat), éteint explicitement au teardown (`resolveCargoRaid`). Transitoire — jamais persisté.
  cargoRaid: { init: false, resetOn: ['scene'] },
  pendingLoot: { init: null, resetOn: [] },
  document: { init: null, resetOn: ['scene'] },
  previousScene: { init: null, resetOn: [] },
  // Écran Port : fermé au changement de scène (on quitte le lieu portuaire). Activités en mer :
  // transient de voyage (ne survit à rien d'autre que la confirmation → halte de nuit).
  port: { init: null, resetOn: ['scene'] },
  pendingSeaActivities: { init: null, resetOn: [] },
  // Survit à `transitionTo` : posé JUSTE avant la transition vers la scène de port (resolvePortArrival),
  // il doit rester actif dans la nouvelle scène (comme pendingSeaActivities ci-dessus).
  pendingManannPriest: { init: null, resetOn: [] },
  // Posé à l'accostage AVANT toute transition de scène (celle-ci n'intervient qu'à la résolution du
  // choix, `resolveShoreLeave`) — aucune scène à survivre, mais transitoire de voyage comme les autres.
  pendingShoreLeave: { init: null, resetOn: [] },
  // Campagne publiée choisie au menu (PartyScreen) : survit jusqu'à la constitution du groupe, jamais
  // remis par un changement de scène/combat (posé AVANT toute scène de jeu).
  pendingCampaign: { init: null, resetOn: [] },
  // Document source du paquet de campagne chargé (#766) : posé par `loadProject`, SURVIT aux transitions
  // de scène (`resetOn: []`) — c'est lui qui, au chargement d'une save, ré-enregistre TOUTES les scènes
  // et re-dérive `campaignNarratif`. Entre au snapshot par ce manifeste (patron `pendingCampaign`).
  campaignDoc: { init: null, resetOn: [] },
  // Instances runtime de scène (#707) : delta capturé au départ (entités retirées, flags de porte/
  // structure) par `sceneId`, réappliqué au clone frais au revisit (`transitionTo`). SURVIT aux
  // transitions (`resetOn: []`), embarqué au snapshot par ce manifeste (patron `campaignDoc`) ;
  // vidé en nouvelle partie (`startScene` → reset à l'init).
  sceneInstances: { init: {}, resetOn: [] },
  // Commandes d'interlude (LDB 22-23) : purgées explicitement à l'ouverture du prochain interlude
  // (`startInterlude`), jamais par `resetFields` (elles doivent SURVIVRE au combat/aux scènes entre-temps).
  pendingOrders: { init: [], resetOn: [] },
  // Jet d'Activité d'interlude/bataille de masse : clos par `activityCancel`/`confirmActivity`, jamais
  // par un changement de scène/combat (l'interlude n'ouvre pas de combat pendant qu'une Activité est en cours).
  pendingActivity: { init: null, resetOn: [] },
  // Porte d'heure de départ (maison, #340) : posée sur la carte du monde, effacée en quittant la scène/carte.
  pendingDeparture: { init: null, resetOn: ['scene'] },
} satisfies { [K in keyof GameState]?: { readonly init: GameState[K]; readonly resetOn: readonly ResetScope[] } }
  & { readonly [K in PendingKey]: { readonly init: GameState[K]; readonly resetOn: readonly ResetScope[] } };

/** Clés du manifeste — SOURCE des champs transitoires, dérivée de `STATE_FIELDS` (plus de double-liste). */
type FieldKey = keyof typeof STATE_FIELDS;

const FIELD_KEYS = Object.keys(STATE_FIELDS) as FieldKey[];

/** Clés des champs `pending*` — DÉRIVÉES du manifeste (jamais une seconde liste à tenir). Consommée par
 *  le marquage « dé fixé » du journal (`fixedDieMark.ts`), qui doit voir TOUS les jets ouverts. */
export const PENDING_FIELD_KEYS = FIELD_KEYS.filter((k) => k.startsWith('pending')) as PendingKey[];

/** Bloc complet `{ champ: init }` des champs transitoires — assemblé dans l'état initial du store. */
export function initialFields(): Pick<GameState, FieldKey> {
  const out = {} as Pick<GameState, FieldKey>;
  for (const k of FIELD_KEYS) {
    // `init` est une valeur PARTAGÉE du manifeste ; les array (`[]`) ET les objets (`{}`, ex.
    // `sceneInstances`) sont copiés pour qu'aucune instance de store ne mute la valeur du manifeste
    // (sinon fuite entre parties). Les primitives (bool/number/null) restent partagées sans risque.
    const v = STATE_FIELDS[k].init;
    (out as Record<FieldKey, unknown>)[k] =
      Array.isArray(v) ? [...v] : v !== null && typeof v === 'object' ? { ...v } : v;
  }
  return out;
}

/** Sous-ensemble `{ champ: init }` des champs dont `resetOn` inclut `scope` — patch de reset. */
export function resetFields(scope: ResetScope): Partial<Pick<GameState, FieldKey>> {
  const out: Partial<Record<FieldKey, unknown>> = {};
  for (const k of FIELD_KEYS) {
    // `satisfies` narrowit les `resetOn: []` en `never[]` → on relit via le type garanti par le satisfies.
    if (!(STATE_FIELDS[k].resetOn as readonly ResetScope[]).includes(scope)) continue;
    const v = STATE_FIELDS[k].init;
    out[k] = Array.isArray(v) ? [...v] : v;
  }
  return out as Partial<Pick<GameState, FieldKey>>;
}
