/**
 * Possession réseau (Jalon 7) — l'HÔTE valide les INTENTS reçus : un invité ne pilote que SES
 * combattants. Le « qui est concerné » vient du REGISTRE des modales (`modalArbiter.MODAL_DEFS`,
 * source unique partagée avec le gating d'affichage UI) — ajouter une modale n'exige RIEN ici.
 */
import type { GameState } from './store';
import type { Combatant } from '../engine/types';
import type { CombatEvent } from './combatLog';
import { modalOwnerOf, horsModalOwnedIntents, horsModalByPending, type HorsModalDef } from './modalArbiter';
import { inBattleId } from './combatants';
import { targetingHolder } from './targetingHolder';
import { cadenceAuto, cadenceAutoCombat } from '../engine/cadence';
import { desFixes } from '../engine/fixedDie';
import { FLOW_VERBS, jetOwnedIntents, participantOwnedIntents, type JetOwnerRef } from './flowVerbs';
import type { PendingKey } from './stateFields';

export { modalOwnerOf } from './modalArbiter';
import { WORLD_STEP_OWNER, MJ_STEP_OWNER } from './pendings';
export { WORLD_STEP_OWNER, MJ_STEP_OWNER } from './pendings';

/** Intents de JET dont le 1ᵉʳ argument est l'id du combattant qui tient le slot — DÉRIVÉS de
 *  `FLOW_VERBS` (`kind:'multi'` + `pidIsActor`), jamais énumérés à la main. */
const PARTICIPANT_OWNED_INTENTS: ReadonlySet<string> = new Set(participantOwnedIntents());

/** Intents de JET dont la possession suit le PORTEUR du jet (`s[pending][field]`) — DÉRIVÉS de
 *  `FLOW_VERBS` (`kind:'mono'` + `jetOwner`), jamais énumérés à la main. */
const JET_OWNED_INTENTS: Readonly<Record<string, JetOwnerRef>> = jetOwnedIntents();

/** Intents adossés à une fenêtre HORS registre de modales (`HORS_MODAL`, #1016) — DÉRIVÉS de ce
 *  registre, jamais énumérés à la main. */
const HORS_MODAL_OWNED_INTENTS: Readonly<Record<string, HorsModalDef>> = horsModalOwnedIntents();

/** Fenêtres HORS-modale indexées par leur `pending*` (#1016) — la possession du CLIC DE CARTE s'y
 *  prend quand `targetingHolder` désigne l'une d'elles. */
const HORS_MODAL_BY_PENDING: Readonly<Record<string, HorsModalDef>> = horsModalByPending();

/**
 * VERROU DE COMPILATION (#1005) : toute clé `pending` déclarée par un `jetOwner` de `FLOW_VERBS` doit
 * être un `pending*` RÉEL de l'état (`PendingKey`, dérivé — cf. `stateFields.ts`). Le verrou vit ICI et
 * pas dans la table : `flowVerbs.ts` ne peut pas importer un type de `GameState` sans rendre `FLOWS`
 * `any` (cf. son en-tête). Une coquille (`pendingCastX`) ne lèverait AUCUNE erreur au site de la table
 * et fermerait en silence TOUS les verbes du flux — elle s'affiche ici en litige (patron
 * `modalArbiter._pendingOwnerCoverage`).
 */
type _JetOwnerPending = {
  [K in keyof typeof FLOW_VERBS]: (typeof FLOW_VERBS)[K] extends { jetOwner: { pending: infer P } } ? P : never;
}[keyof typeof FLOW_VERBS];
type _JetOwnerPendingReal = [Exclude<_JetOwnerPending, PendingKey>] extends [never]
  ? true
  : ['jetOwner.pending inconnu de PendingKey', Exclude<_JetOwnerPending, PendingKey>];
const _jetOwnerPendingCheck: _JetOwnerPendingReal = true;
void _jetOwnerPendingCheck;

/**
 * 2ᵉ VERROU DE COMPILATION (#1015) : le `field` d'un `jetOwner` doit être un champ RÉEL du pending
 * déclaré, et de type `string` (l'id d'un combattant). Le verrou de `pending` seul laissait passer une
 * coquille de `field` (`attackerId2`) ou un champ non-id (`result`) : `intentAllowedFor` n'y lirait
 * jamais d'`ownerId` et FERMERAIT en silence tous les verbes du flux. Le litige est NOMINATIF —
 * l'erreur affiche le tuple `[clé de flux, field fautif]`. ANGLE MORT ASSUMÉ : un champ ÉCHANGÉ de
 * même type (`moverId`→`foeId`) compile ; c'est la confrontation table⇄spec runtime qui le rattrape
 * (`jet-owner-vs-spec.test.ts`).
 */
type _NonNull<T> = Exclude<T, null | undefined>;
type _StringFieldsOf<K extends PendingKey> = Extract<
  { [F in keyof _NonNull<GameState[K]>]-?: _NonNull<GameState[K]>[F] extends string | undefined ? F : never }[keyof _NonNull<GameState[K]>],
  string
>;
type _JetOwnerFieldBad = {
  [K in keyof typeof FLOW_VERBS]: (typeof FLOW_VERBS)[K] extends { jetOwner: { pending: infer P; field: infer F } }
    ? P extends PendingKey
      ? F extends _StringFieldsOf<P>
        ? never
        : [K, F]
      : never // clé de pending fautive : déjà en litige au verrou ci-dessus
    : never;
}[keyof typeof FLOW_VERBS];
type _JetOwnerFieldReal = [_JetOwnerFieldBad] extends [never]
  ? true
  : ['jetOwner.field inconnu du pending (ou non-string)', _JetOwnerFieldBad];
const _jetOwnerFieldCheck: _JetOwnerFieldReal = true;
void _jetOwnerFieldCheck;

/**
 * LE SIÈGE DU MONDE — celui qui tient l'environnement (météo, périls, marché, désertion) : le siège
 * MJ quand il existe (bac-à-sable), l'hôte (siège 0) sinon. Il existe TOUJOURS, et il est humain :
 * c'est ce qui rend un jet de monde surfaçable au même titre que celui d'un héros (`rollSeam.surfaceOf`).
 */
export function worldSeat(s: GameState): number {
  return s.net.gmSeat ?? 0;
}

/**
 * LE PORTEUR EST-IL CONDUIT PAR LE SIÈGE DU MONDE ? (#1479) — les deux routes que `seatOwns`
 * distingue depuis toujours, NOMMÉES : un porteur de l'ENVIRONNEMENT (sentinelle `WORLD_STEP_OWNER` :
 * désertion, Moral, météo) et un ennemi du bac-à-sable MJ reviennent au `worldSeat` ; tout autre
 * porteur est ATTRIBUÉ à un siège par `net.ownership` (réservé aux héros).
 *
 * Un seul site pour cette route : `seatOwns` la consomme pour dire QUI possède, `rollSeam` pour dire
 * qui VOIT (un héros dont le siège est aussi le siège MJ — hôte-MJ solo — reste tenu par SON joueur,
 * il n'est pas « conduit par le monde »).
 */
export function conduitParLeSiegeDuMonde(s: GameState, combatantId: string | undefined): boolean {
  if (combatantId === WORLD_STEP_OWNER) return true;
  return conduitParLeMJ(s, combatantId);
}

/**
 * LA ROUTE MJ (#700) — un porteur que le siège MJ conduit, ssi ce siège existe : un ennemi (bac-à-sable)
 * ou le porteur MJ (`MJ_STEP_OWNER`, le dé que le RAW fait lancer par le MJ), qui est cette MÊME route
 * sans combattant. Consommée par `conduitParLeSiegeDuMonde` (possession), `jetSurfaced`/`tenuParUnHumain`
 * (tenue) et `seatInfluences` (influence) : une seule table de vérité. Sans siège MJ, `seatOwns` replie
 * l'ACTION à l'hôte (siège 0) pour les deux, sans que personne ne TIENNE le dé.
 * `porteur` : le combattant déjà résolu par l'appelant qui le tient (sinon lu dans la file de combat,
 * seul univers où vit un ennemi).
 */
export function conduitParLeMJ(s: GameState, porteurId: string | undefined, porteur: Combatant | undefined = porteurId ? inBattleId(s.battle, porteurId) : undefined): boolean {
  if (s.net.gmSeat == null || !porteurId) return false;
  return porteurId === MJ_STEP_OWNER || porteur?.kind === 'enemy';
}

/** Le siège possède-t-il ce combattant ? (héros non attribué → hôte, siège 0). */
export function seatOwns(s: GameState, seat: number, combatantId: string | undefined): boolean {
  if (conduitParLeSiegeDuMonde(s, combatantId)) return seat === worldSeat(s);
  if (!combatantId) return seat === 0;
  return (s.net.ownership[combatantId] ?? 0) === seat;
}

/**
 * SIÈGES REQUIS par un READY-CHECK (source UNIQUE : pause de Round, écran de Victoire, nuit de repos).
 * Deux conditions, et rien d'autre :
 *  - le siège HÔTE (0) est toujours requis — c'est lui qui applique le geste unanime ;
 *  - tout siège NOMMÉ (présent dans `net.seatNames`) qui tient au moins un héros ENCORE EN JEU (ni
 *    mort, ni hors rencontre).
 * Un siège nommé sans héros vivant n'a rien à valider : l'attendre bloquerait la table, l'afficher en
 * « en attente » mentirait. Le verdict est le MÊME pour les trois dispatchers et pour la rangée qui
 * les montre (`ReadyRow`) — afficher et décider ne peuvent pas répondre différemment.
 */
export function siegesRequis(s: Pick<GameState, 'party' | 'net'>): number[] {
  const requis = new Set<number>([0]);
  for (const h of s.party) {
    if (h.dead || h.outOfRencontre) continue;
    const owner = s.net.ownership[h.id] ?? 0;
    if (s.net.seatNames[owner] != null) requis.add(owner);
  }
  return [...requis].sort((a, b) => a - b);
}

/** Tous les sièges requis ont-ils validé ? (même quorum, une seule lecture) */
export function quorumAtteint(s: Pick<GameState, 'party' | 'net'>, readyBySeat: Record<number, boolean> = {}): boolean {
  return siegesRequis(s).every((seat) => readyBySeat[seat]);
}

/**
 * SIÈGE AGISSANT (#1017) — quel siège joue le geste EN COURS. Normalement `net.mySeat` (le joueur
 * devant l'écran) ; mais l'HÔTE exécute aussi les gestes des AUTRES sièges quand il applique un
 * intent reçu (`netFlow.applyIntent`), et il les exécute DANS SON PROPRE store. Sans ce contexte,
 * toute garde d'action bâtie sur « le siège local possède-t-il ce combattant ? » (les ~30
 * `controlsCombatant` de `combatSlice`, dont `battleBattement`/`battleDisengage`) répondait NON
 * chez l'hôte pour le héros d'un invité : l'intent était accepté par `intentAllowedFor` puis
 * l'action refusait EN SILENCE, sans journal ni erreur (mesuré : `pendingBattement` jamais posé).
 * Le contexte est posé UNIQUEMENT autour de l'appel synchrone de l'action, jamais pendant un rendu.
 */
let actingSeat: number | null = null;

/**
 * Exécute `fn` AU NOM de `seat` (application d'un intent reçu). CONTRAT : le contexte couvre l'appel
 * SYNCHRONE — un travail différé par l'action (timer de cadence, animation) le relira retombé, donc
 * il retrouve le siège local, comme avant. Réentrant (restaure la valeur précédente, pas `null`).
 */
export function withActingSeat<T>(seat: number, fn: () => T): T {
  const prev = actingSeat;
  actingSeat = seat;
  try {
    return fn();
  } finally {
    actingSeat = prev;
  }
}

/** Le siège au nom duquel on décide MAINTENANT : celui qui agit s'il y en a un, sinon le siège local.
 *  Exporté pour les gestes qui MARQUENT leur siège dans l'état partagé (demande de pause de Round) :
 *  le siège vient du TRANSPORT (`withActingSeat`, posé par `netFlow.applyIntent`), jamais des arguments
 *  de l'émetteur — un siège ne peut donc marquer ni démarquer que lui-même. */
export function decidingSeat(s: GameState): number {
  return actingSeat ?? s.net.mySeat;
}

/**
 * Le siège LOCAL possède-t-il ce combattant ? Prédicat d'AFFICHAGE (qui rend la fenêtre, qui voit le
 * bandeau spectateur) — il DÉLÈGUE à `seatOwns`, source unique du routage siège→combattant employée par
 * la validation d'intent : afficher et agir ne peuvent pas répondre différemment. Un ennemi / une étape
 * MONDE appartient donc au siège MJ (`gmSeat`) quand il existe, pas « à l'hôte par défaut ».
 * Solo (`mode:'local'`) : toujours vrai. Sans combattant concerné : l'hôte.
 * Pendant l'application d'un intent, « local » = le siège AGISSANT (cf. `withActingSeat`) — c'est ce
 * qui permet aux gardes d'action de `combatSlice` de servir l'invité sans une ligne de code par flux.
 */
export function ownsLocally(state: GameState, combatantId: string | undefined): boolean {
  const { mode, mySeat } = state.net;
  if (mode === 'local') return true;
  if (actingSeat != null) return seatOwns(state, actingSeat, combatantId); // `seatOwns` traite l'absence d'acteur
  if (!combatantId) return mode === 'host';
  return seatOwns(state, mySeat, combatantId);
}

/**
 * DÉCISION DE GROUPE — le geste qui n'appartient à AUCUN combattant : le jeton unique d'exploration
 * (dialogue, interaction d'entité). Son routage d'intent est `seat === (net.gmSeat ?? 0)` (`ROUTES` :
 * `chooseDialogue`/`closeDialogue`/`interactEntity`) — exactement ce que `seatOwns` rend sur le
 * sentinel MONDE (`WORLD_STEP_OWNER` : le siège MJ quand il existe, l'hôte sinon). Le prédicat
 * DÉLÈGUE donc au même routage au lieu de recopier la formule : afficher le choix, l'exécuter au
 * clic et l'exécuter à la touche répondent par la même table de vérité. SOLO : toujours vrai.
 *
 * Il vit ICI, avec le routage, parce que ses DEUX consommateurs sont de couches différentes : la
 * fenêtre (`ui/ownership`, qui le ré-expose en hook) et les raccourcis `dialogue-choice-N`
 * (`state/keybindings`) — `src/state` ne peut pas lire `src/ui`.
 *
 * COUPLAGE ASSUMÉ : l'égalité route-du-dialogue ⇄ sentinel MONDE est une COÏNCIDENCE de formule, pas
 * une dépendance déclarée — si la route du dialogue divergeait, l'affordance suivrait le sentinel, pas
 * la route. `ui/ownership.test.tsx` verrouille cette égalité sur les 3 intents du jeton, siège par siège.
 */
export function ownsGroupDecision(s: GameState): boolean {
  return ownsLocally(s, WORLD_STEP_OWNER);
}

/**
 * Le siège qui tient la décision de groupe (0 = l'hôte) — pour NOMMER celui qu'on attend dans
 * l'affordance de spectateur ; le verdict, lui, se demande à `ownsGroupDecision`.
 */
export function groupDecisionSeat(s: GameState): number {
  return s.net.gmSeat ?? 0;
}

/**
 * Le JET de ce combattant doit-il être SURFACÉ (fenêtre influençable) plutôt que roulé en silence ?
 * INVARIANT : un jet se surface dès qu'un siège humain QUELCONQUE possède son porteur — le pilote de
 * l'ADVERSAIRE n'entre pas dans la condition ; un porteur surfacé n'est JAMAIS roulé en silence.
 * SEAT-AGNOSTIQUE (≠ `pilotedByHuman`, qui décide de l'AFFORDANCE LOCALE) : le héros d'un AUTRE siège
 * surface aussi — c'est SON joueur qui roulera. Les gardes RAW restent au site appelant (Défense :
 * portée de mêlée, `rangedDefenseModes` — un tir sans mode de défense RAW reste NON OPPOSÉ, LDB 13
 * l.125 ; Contre-sort : éligibilité `counterspellCandidates`, LDB 46 l.156).
 * SOURCE UNIQUE du surfaçage RÉACTIF : Défense (#989) et Contre-sort (#1028).
 */
export function jetSurfaced(s: GameState, c: Combatant): boolean {
  if (c.kind === 'hero') return !c.aiControlled;
  return conduitParLeMJ(s, c.id, c);
}

/**
 * Le porteur d'un dé, résolu par ID dans TOUT l'univers de jeu : la file de combat ET le groupe.
 * DISTINCT d'`actorIn`, qui choisit l'un OU l'autre (`battle?.combatants ?? party`) : un héros du
 * groupe resté HORS de la file d'un combat ouvert (allié en réserve, héros non engagé) y est
 * introuvable, et un porteur introuvable ne se surface pas — son dé se résoudrait d'office alors
 * qu'un siège le tient. La possession, elle, ne connaît pas cette frontière : `net.ownership` est
 * keyée par id, sans égard au combat en cours.
 *
 * EXPORTÉ (#1426) pour la porte des jets (`rollSeam`), qui résout les MÊMES porteurs : le côté d'une
 * requête (`resolveMonoSide`) et le porteur d'une rangée de bande (`rowSurfacee`). Possession, surface
 * et valeur d'un dé ne peuvent pas répondre depuis deux univers différents.
 */
export function porteurParId(s: GameState, id: string): Combatant | undefined {
  return inBattleId(s.battle, id) ?? s.party.find((c) => c.id === id);
}

/**
 * UN SIÈGE HUMAIN TIENT-IL CE PORTEUR ? (#1426) — LE prédicat de possession HUMAINE, keyé par ID, pour
 * TOUT porteur de dé : héros (en combat COMME hors combat), ennemi, et le MONDE (`WORLD_STEP_OWNER`).
 * C'est `jetSurfaced` ci-dessus, atteint par id plutôt que par objet ; le surfaçage d'un jet
 * (`rollSeam.surfaceOf`) n'y ajoute que la cadence.
 *
 * « TENU PAR UN HUMAIN » N'EST PAS « POSSÉDÉ » : `seatOwns(s, 0, ennemi)` rend vrai par REPLI quand
 * aucun siège MJ n'existe — ce repli sert l'ACTION (l'hôte exécute pour l'automate qui conduit cet
 * ennemi), pas la TENUE du dé. Un ennemi sans siège MJ, un héros `aiControlled`, un porteur inconnu
 * ne tiennent donc aucune fenêtre : leur étape se résout d'office et se montre au bilan.
 * Le MONDE fait exception par construction : `worldSeat` existe TOUJOURS et est humain — la
 * résolution de ce siège reste ici (`seatOwns` route déjà la sentinelle vers lui), jamais recopiée
 * chez un appelant.
 */
export function tenuParUnHumain(s: GameState, porteurId: string | undefined): boolean {
  if (!porteurId) return false;
  if (porteurId === WORLD_STEP_OWNER) return seatOwns(s, worldSeat(s), porteurId);
  const c = porteurParId(s, porteurId);
  return c ? jetSurfaced(s, c) : conduitParLeMJ(s, porteurId);
}

/**
 * UNE TRACE EST-ELLE VISIBLE À CE SIÈGE ? (#700) — une ligne sans `audience` l'est partout ; une ligne
 * d'audience (l'id du porteur qui tient le dé) ne l'est qu'au siège qui TIENT ce porteur, et à aucun
 * siège quand aucun humain ne le tient. Arbitrage utilisateur 2026-09-29 (#700, option « Invisible
 * sans siège MJ ») : la ligne reste dans l'état. Prédicat UNIQUE de tous les lecteurs d'AFFICHAGE du
 * journal.
 */
export function traceVisible(s: GameState, seat: number, ligne: { audience?: string }): boolean {
  if (ligne.audience == null) return true;
  return tenuParUnHumain(s, ligne.audience) && seatOwns(s, seat, ligne.audience);
}

/** Vue au siège LOCAL de `traceVisible` — celui qui regarde l'écran (`net.mySeat`). */
export function traceVisibleIci(s: GameState, ligne: { audience?: string }): boolean {
  return traceVisible(s, s.net.mySeat, ligne);
}

/** Le journal de combat que CE siège voit — lecture UNIQUE des surfaces d'affichage (tiroir, bandeau). */
export function journalDeCombatVisible(s: GameState, log: readonly CombatEvent[]): CombatEvent[] {
  return log.filter((l) => traceVisibleIci(s, l));
}

/** Surfaçage de la DÉFENSE (#989) — nom de domaine des sites d'attaque (`maybeOpenDefense`,
 *  `resolveAttack`, `surfacedDefensePending`), qui DÉLÈGUE au prédicat général ci-dessus : une seule
 *  implémentation du surfaçage réactif, jamais deux tables de vérité. */
export function defenseSurfaced(s: GameState, defender: Combatant): boolean {
  return jetSurfaced(s, defender);
}

/**
 * Le combattant `c` est-il piloté À LA MAIN par un humain ? — CADENCE-AGNOSTIQUE (vrai même en Rapide/
 * Auto : décrit QUI possède le contrôle, pas s'il est déféré à un automate). Un HÉROS non-`aiControlled`
 * contrôlé localement → vrai ; un ENNEMI → vrai ssi un siège porte le rôle MJ (`gmSeat` — bac-à-sable ;
 * les jets du monde remontent au siège MJ) ; un PNJ neutre → faux. Prédicat de l'AFFORDANCE LOCALE
 * (qui a la main ICI) ; le SURFAÇAGE d'une défense, lui, passe par `defenseSurfaced` ci-dessus.
 */
export function pilotedByHuman(s: GameState, c: Combatant): boolean {
  if (c.kind === 'hero') return !c.aiControlled && ownsLocally(s, c.id);
  if (c.kind === 'enemy') return s.net.gmSeat != null; // conduit par le MJ (bac-à-sable) sinon IA
  return false;
}

/**
 * Ce siège a-t-il produit CE jet lui-même ? — prédicat de PRÉSENTATION (#990) : un siège ne se masque
 * jamais son propre dé. COMPOSE l'existant : contrôle humain LOCAL (`pilotedByHuman`, qui encode déjà
 * l'affordance de siège) ET possession locale (`ownsLocally`). Distinct de `ownsLocally` seul (vrai
 * pour TOUS en solo — un masque bâti dessus serait mort en solo) et de `controlsCombatant` (faux pour
 * mon propre héros en Auto-combat — son jet reste le mien). `ownerId` absent = adversaire ABSTRAIT
 * (table de taverne, aucun Combatant) : jamais produit par ce siège.
 */
export function rolledLocally(s: GameState, ownerId: string | undefined): boolean {
  if (!ownerId) return false;
  const c = porteurParId(s, ownerId);
  return !!c && pilotedByHuman(s, c) && ownsLocally(s, c.id);
}

/**
 * Le combattant `c` est-il piloté par l'IA ? — base AGNOSTIQUE AU CAMP de l'orchestrateur de tour.
 * Un ENNEMI l'est SAUF si un siège porte le rôle MJ (`gmSeat`, bac-à-sable). Un HÉROS l'est en mode
 * Auto-combat ET contrôlé LOCALEMENT (coop : on ne joue jamais le héros d'un autre siège), ou s'il porte
 * le drapeau `aiControlled` (PNJ allié IA). Un PNJ neutre ne l'est jamais. NB : `aiDriven` ne change PAS
 * le `kind` du combattant. (Vit ICI, avec les primitives d'« qui pilote quoi » : `controlsActive`/
 * `controlsCombatant` en dépendent ; `combatGate` le ré-exporte pour ses consommateurs historiques.)
 */
export function aiDriven(s: GameState, c: Combatant): boolean {
  if (c.kind === 'enemy') return s.net.gmSeat == null; // ennemi = IA SAUF si un siège MJ le conduit
  // PNJ allié IA (`Combatant.aiControlled`, ex. défenseur de siège) : agit SEUL même en jeu MANUEL — sans
  // attendre l'Auto-combat global. On ne pilote jamais le combattant d'un AUTRE siège (`ownsLocally`).
  if (c.kind === 'hero' && c.aiControlled) return ownsLocally(s, c.id);
  return c.kind === 'hero' && cadenceAutoCombat() && ownsLocally(s, c.id);
}

/**
 * Le siège LOCAL pilote-t-il À LA MAIN ce combattant MAINTENANT ? — prédicat UNIQUE des affordances de TOUR
 * (grille de déplacement, réticule, barre d'action, hotbar). Héros manuel → vrai ; héros Auto-combat →
 * faux ; PNJ `aiControlled` → faux ; ennemi sans MJ → faux ; ENNEMI quand le siège LOCAL porte le rôle MJ
 * → vrai (coop : `gmSeat === mySeat`) ; invocation alliée (`kind:'hero'`) → comme un héros.
 */
export function controlsCombatant(s: GameState, c: Combatant): boolean {
  if (!pilotedByHuman(s, c) || aiDriven(s, c)) return false;
  if (c.kind === 'hero') return true; // `pilotedByHuman` encode déjà `ownsLocally` (siège-aware)
  // Ennemi/monde conduit par le MJ : seul le siège MJ le pilote — comparé au siège qui DÉCIDE
  // maintenant (le siège local, ou le siège AGISSANT pendant l'application de son intent).
  return s.net.mode === 'local' || s.net.gmSeat === decidingSeat(s);
}

/**
 * Le Test d'un combattant doit-il REMONTER à un humain (modale/étape de cascade influençable) plutôt
 * qu'être résolu en silence ? SOURCE UNIQUE d'escalade des jets de FIN DE ROUND / entretien : contrôle
 * HUMAIN (`pilotedByHuman`) ET cadence MANUELLE (`!cadenceAuto` : en Rapide/Auto les jets se lancent
 * seuls, sans influence, donc résolus inline comme un monstre).
 */
export function humanControlled(s: GameState, c: Combatant): boolean {
  return !cadenceAuto() && pilotedByHuman(s, c);
}

/**
 * CE siège peut-il INFLUENCER ce jet — y dépenser des ressources (Chance, relance, +1 DR, Sombre Pacte,
 * Résilience) ou en fixer le dé ? Prédicat UNIQUE de l'affordance d'influence (#1005), routé par le
 * PORTEUR du jet, employé PAR L'AFFICHAGE (`influencesLocally`, siège local) ET par la VALIDATION
 * D'INTENT (`intentAllowedFor`, siège émetteur) : afficher et agir ne peuvent pas répondre différemment.
 *  - héros → il n'est pas conduit par l'IA (`aiControlled`) et le siège le possède (`seatOwns`) ;
 *  - ennemi → le siège porte le rôle MJ (bac-à-sable) ; sans siège MJ, l'ennemi est à l'IA (qui roule
 *    sans ces verbes) et personne — hôte compris — ne dépense ses ressources ;
 *  - PNJ neutre → jamais ;
 *  - étape MONDE (`WORLD_STEP_OWNER`) ou jet sans acteur → `seatOwns` (le siège MJ s'il existe, l'hôte
 *    sinon).
 * Un `ownerId` qui ne désigne aucun combattant connu → faux (jamais d'affordance sur un jet inconnu).
 * Solo (`mode:'local'`) : un seul siège, il tient tout ce qu'un humain pilote.
 */
export function seatInfluences(s: GameState, seat: number, ownerId: string | undefined): boolean {
  if (ownerId == null || ownerId === WORLD_STEP_OWNER) return seatOwns(s, seat, WORLD_STEP_OWNER);
  const c = porteurParId(s, ownerId);
  const solo = s.net.mode === 'local';
  if (c?.kind === 'hero') return !c.aiControlled && (solo || seatOwns(s, seat, c.id));
  if (conduitParLeMJ(s, ownerId, c)) return solo || s.net.gmSeat === seat;
  return false;
}

/**
 * Le siège LOCAL peut-il influencer ce jet ? Vue au siège local de `seatInfluences` ci-dessus (source
 * unique). Distinct de `ownsLocally` (vrai pour TOUS en solo : un gate bâti dessus laisse le joueur
 * dépenser la Résilience d'un ENNEMI) et de `rolledLocally` (calendrier de MASQUAGE, #990).
 * « Local » = le siège qui DÉCIDE maintenant (`decidingSeat`, patron `ownsLocally`) : pendant
 * l'application d'un intent, c'est le siège AGISSANT. Sans cela, une action de store bâtie dessus
 * (`rollAllOwnedRows` : les verbes NULLAIRES « tout lancer » du Contre-sort et de l'opposition)
 * roulait, chez l'hôte, SES rangées à lui au lieu de celles de l'invité émetteur — l'intent accepté
 * produisait le mauvais effet. Hors application d'intent (rendu), `actingSeat` est nul : inchangé.
 */
export function influencesLocally(s: GameState, ownerId: string | undefined): boolean {
  return seatInfluences(s, decidingSeat(s), ownerId);
}

/**
 * Le joueur LOCAL peut-il FIXER lui-même la valeur du d100 de ce jet ? Prédicat UNIQUE de l'option de
 * confort « Dés fixés » (`engine/fixedDie.ts`) : l'option est active ET le siège local peut influencer
 * ce jet (`influencesLocally` ci-dessus — même routage porteur→siège, source unique).
 */
export function canFixDie(s: GameState, ownerId: string | undefined): boolean {
  return desFixes() && influencesLocally(s, ownerId);
}

/** Le joueur LOCAL contrôle-t-il (À LA MAIN) le combattant ACTIF du combat ? Faux pendant le tour du héros
 *  d'un AUTRE joueur (hôte inclus), ET faux quand le héros actif est piloté par l'IA (Auto-combat) : l'UI
 *  traite alors ce tour comme un tour ennemi — AUCUNE affordance (grille de déplacement, réticule, barre
 *  d'action, raccourcis). Tour ennemi → vrai : l'IA tourne et l'UI est déjà inerte par ses propres verrous. */
export function controlsActive(state: GameState): boolean {
  const b = state.battle;
  if (!b || b.over) return true;
  const activeId = b.order[b.turn];
  const active = inBattleId(b, activeId);
  if (!active) return true;
  if (active.kind !== 'hero') {
    // Actif non-héros : conduit par le siège MJ (bac-à-sable) → affordances si le siège qui DÉCIDE porte
    // le rôle MJ (le siège local, ou le siège AGISSANT pendant son intent). Sans MJ (`gmSeat` null) →
    // tour IA : vrai (l'UI est déjà inerte par ses propres verrous — inchangé). NB : le surfaçage FIN
    // des affordances passe par `controlsCombatant`.
    if (!pilotedByHuman(state, active)) return true;
    return state.net.mode === 'local' || state.net.gmSeat === decidingSeat(state);
  }
  if (aiDriven(state, active)) return false; // Auto-combat : l'IA pilote ce héros → pas d'affordance joueur
  if (state.net.mode === 'local') return true;
  return ownsLocally(state, activeId);
}

/** Emplacements de groupe encore à remplir par ce siège : slots attribués − héros possédés.
 *  (En mode local, slots = [0,0,0,0] → l'hôte garde les 4 emplacements, comme avant la coop.) */
export function seatSlotsRemaining(s: GameState, seat: number): number {
  const slots = (s.net.slots ?? [0, 0, 0, 0]).filter((x) => x === seat).length;
  const owned = s.party.filter((h) => (s.net.ownership[h.id] ?? 0) === seat).length;
  return slots - owned;
}

/**
 * ROUTE de possession d'un intent (#1051) — verdict à TROIS états : `true`/`false` TRANCHENT,
 * `null` = « cette route ne se prononce pas » et la décision revient au REPLI universel
 * (`repliUniversel`). `false` n'est donc JAMAIS relu comme une abstention.
 */
export interface Route {
  rule: (s: GameState, seat: number, args: unknown[]) => boolean | null;
  /** Route CONSERVÉE bien que son intent soit hors `GUEST_INTENTS` (défense en profondeur : un futur
   *  ajout à l'allowlist ne doit pas ouvrir le geste à tous). La valeur porte la raison MESURÉE. */
  horsAllowlist?: string;
}

/**
 * Assemble la table des routes en FAIL-FAST : une clé fournie deux fois lève un litige NOMINATIF au
 * chargement du module, jamais un écrasement silencieux. Les familles dérivées (jet / participant /
 * hors-modale) sont disjointes aujourd'hui (`intent-routes.test.ts`) ; ce garde-fou verrouille
 * l'invariant — sans lui, un verbe qui migrerait d'une famille à l'autre changerait de route sans
 * qu'aucun test ne le voie.
 */
export function buildRoutes(...groupes: readonly (readonly (readonly [string, Route])[])[]): ReadonlyMap<string, Route> {
  const out = new Map<string, Route>();
  for (const groupe of groupes) {
    for (const [action, route] of groupe) {
      if (out.has(action)) throw new Error(`netOwnership.ROUTES : route dupliquée pour l'intent « ${action} »`);
      out.set(action, route);
    }
  }
  return out;
}

const idArg = (a: unknown): string | undefined => (typeof a === 'string' ? a : undefined);

/** Le siège agit toujours (marquage de SON propre siège). */
const TOUJOURS: Route = { rule: () => true };
/** Possession du combattant désigné par le 1ᵉʳ argument. */
const PAR_ARG0: Route = { rule: (s, seat, args) => seatOwns(s, seat, idArg(args[0])) };

/**
 * CLIC DE CARTE pendant un ciblage détenu par une fenêtre HORS registre de modales (#1016) — c'est
 * LE chemin vivant : l'invité ne demande jamais `cleaveAttack`/`dualStrikeAttack` (appelés en
 * INTERNE par `targetingModes`), il clique, et le clic voyage par `battleClickEntity`/
 * `battleClickTile`. Ces deux verbes retombaient sur `modalOwnerOf`, qui ne consulte que
 * `MODAL_DEFS` : sous un `fateSave` (1ʳᵉ entrée, priorité maximale) l'attaquant qui balaie était
 * REFUSÉ et la victime acceptée — son clic mourait ensuite dans les gardes de `battleClickEntity`,
 * donc PERSONNE ne poursuivait le balayage. Tant qu'un pending hors-modale tient le ciblage
 * (`targetingHolder`, source unique partagée avec l'aiguilleur), le clic appartient au PORTEUR de
 * ce pending : l'attaquant du balayage / de la 2ᵉ frappe, l'artilleur du pilonnage indirect. Aucun
 * pending détenteur → `null` : le clic universel garde ses règles (repli).
 */
const CLIC_CARTE: Route = {
  rule: (s, seat) => {
    const held = targetingHolder(s);
    const def = held ? HORS_MODAL_BY_PENDING[held] : undefined;
    if (!def) return null;
    const owner = def.owner(s);
    return owner === '*' || seatOwns(s, seat, owner); // `undefined` → l'hôte (contrat de `seatOwns`)
  },
};

/**
 * CLIC-TOKEN pendant une visée de TIR RAPIDE armée (Talent « Tir rapide ») : le clic n'ouvre pas un
 * ciblage ordinaire, il DÉCLENCHE le tir d'interruption du héros visant (`combatSlice.battleClickEntity`
 * consulte `preemptAiming` AVANT toute autre garde) — la possession suit donc le TIREUR. Sans cela, la
 * pause de début de Round n'a AUCUN combattant actif (`turn: -1`) et le repli universel rendait l'hôte :
 * le clic de l'invité tireur était refusé. Hors visée armée : la route du clic de carte, inchangée.
 */
const CLIC_ENTITE: Route = {
  rule: (s, seat, args) => (s.preemptAiming ? seatOwns(s, seat, s.preemptAiming) : CLIC_CARTE.rule(s, seat, args)),
};

/** Geste de la pause de début de Round visant un héros par son 1ᵉʳ argument (Tir rapide : armer la
 *  visée, tirer). Hors pause, la fenêtre n'existe pas : personne ne le joue. */
const PAUSE_DE_ROUND_PAR_ARG0: Route = {
  rule: (s, seat, args) => !!s.pendingRoundStart && seatOwns(s, seat, idArg(args[0])),
};

/**
 * « Tout lancer » d'une fenêtre MULTI réactive (verbe NULLAIRE du drive d'auto-cadence, #1030) : il
 * roule les rangées que le siège ÉMETTEUR influence (`rollAllOwnedRows`). La possession est donc
 * « posséder au moins une rangée encore due » — le repli aurait rendu la fenêtre au owner de la
 * MODALE, c'est-à-dire au lanceur pour un Sort de héros : le siège d'une cible (ou le MJ pilotant une
 * rangée ennemie) voyait son drive refusé et sa fenêtre restait suspendue.
 */
const routeRollAll = (rows: (s: GameState) => readonly { id: string; interactive?: boolean; result: unknown }[] | undefined): Route => ({
  rule: (s, seat) => (rows(s) ?? []).some((p) => !p.result && p.interactive && seatInfluences(s, seat, p.id)),
});

/**
 * Résistance (Menace) sur une étape de CASCADE : `pid` est l'id de l'ÉTAPE, pas un combattant — mais
 * le verbe DÉPENSE le Talent de l'acteur de cette étape, donc la possession le suit (même prédicat que
 * l'affordance affichée, `seatInfluences`). Le repli aurait rendu le owner de la MODALE, qui vaut
 * `'*'` sur une étape de GROUPE : n'importe quel siège aurait brûlé la Résistance d'autrui (#1005).
 */
const CASCADE_RESIST: Route = {
  rule: (s, seat, args) => {
    const pid = idArg(args[0]);
    const step = s.pendingCascade?.participants.find((p) => p.id === pid);
    return !!step && seatInfluences(s, seat, step.actorId); // étape inconnue/fermée → personne
  },
};

/**
 * Flux MONO à fenêtre PARTAGÉE (`FLOW_VERBS.jetOwner`, #1005) : ces verbes DÉPENSENT les ressources du
 * porteur du jet (Chance, Résilience, Corruption du Pacte) — la possession suit ce porteur, désigné en
 * donnée, et par le MÊME prédicat que l'affordance affichée (`seatInfluences`). Sans cette route, un
 * Sort ENNEMI (étape `groupOwner` → owner de modale '*', pour que cible et contre-lanceurs voient la
 * fenêtre) accepterait la dépense de n'importe quel siège.
 * Portée : comme la route participant, elle court-circuite `modalOwnerOf` — un `pendingCast`
 * résiduel reste dépensable par son porteur pendant qu'une modale prioritaire d'un autre siège est
 * ouverte.
 */
const routeJet = (jet: JetOwnerRef): Route => ({
  rule: (s, seat) => {
    const pending = (s as unknown as Record<string, Record<string, unknown> | null | undefined>)[jet.pending];
    const ownerId = pending && typeof pending[jet.field] === 'string' ? (pending[jet.field] as string) : undefined;
    return !!ownerId && seatInfluences(s, seat, ownerId); // jet fermé/inconnu → personne ne dépense
  },
});

/**
 * Gestes TERMINAUX d'une fenêtre HORS registre de modales (`HORS_MODAL.intents`) : possession prise
 * au pending qui héberge le geste. `cleaveEnd`/`dualStrikeSkip` sont émis par le bandeau de phase de
 * la console (sortie d'interlude) ; `cleaveAttack`/`dualStrikeAttack` n'ont AUCUN émetteur d'UI
 * aujourd'hui (défense en profondeur pour un futur émetteur direct — table `EMISSION` de
 * `hors-modal-intent-path.test.ts`).
 */
const routeHorsModal = (def: HorsModalDef): Route => ({
  rule: (s, seat) => {
    if (!s[def.pendingKey]) return false; // fenêtre fermée → personne (le geste y est inerte)
    const owner = def.owner(s);
    return owner === '*' || seatOwns(s, seat, owner); // `undefined` → l'hôte (contrat de `seatOwns`)
  },
});

/**
 * TABLE UNIQUE intent → route (#1051), ÉNUMÉRABLE sans monter le store. Composition STATIQUE de maps
 * exportées par des modules FEUILLES (`flowVerbs`, `modalArbiter`) : aucun enregistrement à l'import
 * d'un module lourd, dont l'absence de chargement ferait retomber un geste sur le repli EN SILENCE
 * (classe de bug #1015/#1016/#1017). Ce qui N'EST PAS ici tombe sur `repliUniversel` — y compris tout
 * intent inconnu.
 */
export const ROUTES: ReadonlyMap<string, Route> = buildRoutes(
  [
    // Ready-checks et levée de main : le siège marque le SIEN. `raiseHand`/`lowerHand` sont NULLAIRES et
    // lisent leur siège au transport (`decidingSeat`) : il n'y a aucun argument à valider ici.
    ['roundStartReady', TOUJOURS],
    ['victoryReady', TOUJOURS],
    ['raiseHand', TOUJOURS],
    ['lowerHand', TOUJOURS],
    // Butin de victoire : un siège n'attribue qu'à SES héros (le bénéficiaire est le 2ᵉ argument).
    ['assignVictoryGear', { rule: (s, seat, args) => seatOwns(s, seat, idArg(args[1])) }],
    // Composition du groupe : un siège remplit SES emplacements (quota attribué par l'hôte) et
    // ne retire que SES héros.
    ['partyAddHero', { rule: (s, seat) => seatSlotsRemaining(s, seat) > 0 }],
    ['partyRemoveHero', PAR_ARG0],
    // Remplacement EN PLACE : le siège doit posséder l'ANCIEN héros (1er arg). L'effectif ne change
    // pas (1 héros pour 1) → aucun check de quota d'emplacements.
    ['partyReplaceHero', PAR_ARG0],
    // Activités d'interlude (audit M7) : le 1er argument est le héros visé — son propriétaire agit
    // (`interludeActivity` = chemin UNIQUE des Activités à jet).
    ['interludeActivity', PAR_ARG0],
    ['interludeCraftStart', PAR_ARG0],
    ['interludeOrder', PAR_ARG0],
    ['interludeBank', PAR_ARG0],
    // Retrait bancaire : le dépôt appartient à un héros — son propriétaire retire.
    ['interludeWithdraw', {
      rule: (s, seat, args) => {
        const dep = typeof args[0] === 'number' ? s.bank?.[args[0]] : undefined;
        return dep ? seatOwns(s, seat, dep.heroId) : false; // dépôt inconnu → personne
      },
    }],
    ['battleClickEntity', CLIC_ENTITE],
    ['battleClickTile', CLIC_CARTE],
    // Pause de début de Round (`pendingRoundStart`) : la FENÊTRE est à tous ('*' — ready-check par
    // siège), ses gestes ne le sont pas.
    //  - `roundStartPromote` dépense la Chance du héros promu (LDB 17 l.25) → routé par le prédicat des
    //    dépenses sur CE héros. Sans cette route, aucun `pending*` du registre des modales n'étant ouvert,
    //    le repli tombait sur le combattant ACTIF — inexistant pendant la pause (`turn: -1`, cf.
    //    `combatFlow.enterRoundStartPause`) : la promotion était refusée à TOUT siège invité, et la Chance
    //    du héros devenait indépensable en coop.
    //  - `confirmRoundStart` lance le Round pour TOUS : l'invité marque son siège (`roundStartReady`)
    //    et l'hôte clôt à l'unanimité (`combatSlice.roundStartReady`).
    //  - Tir rapide : `armPreempt`/`preemptRangedShot` visent le TIREUR par leur 1ᵉʳ argument — même
    //    trou de repli que la promotion (pas d'actif pendant la pause).
    ['roundStartPromote', { rule: (s, seat, args) => !!s.pendingRoundStart && seatInfluences(s, seat, idArg(args[0])) }],
    ['confirmRoundStart', { rule: (s, seat) => seatOwns(s, seat, undefined) }],
    ['armPreempt', PAUSE_DE_ROUND_PAR_ARG0],
    ['preemptRangedShot', PAUSE_DE_ROUND_PAR_ARG0],
    // Fenêtres réactives de l'incantation : « tout lancer » appartient à qui possède une rangée due.
    ['counterspellRollAll', routeRollAll((s) => s.pendingCounterspell?.participants)],
    ['oppositionRollAll', routeRollAll((s) => s.pendingCastOpposition?.participants)],
    // DÉCLARATION de rangée (#1042/#1059) : le geste décide de l'engagement de la Dissipation du Round
    // de son porteur (consommée à l'engage) — même prédicat que l'affordance de la rangée
    // (`influencesLocally`), routé par l'id porté en 1ᵉʳ argument. Le verbe NULLAIRE « tout déclarer »
    // suit la règle de « tout lancer » : possède qui tient une rangée encore vierge.
    ['counterspellDeclare', { rule: (s, seat, args) => seatInfluences(s, seat, idArg(args[0])) }],
    // PORTE UNIQUE en phase 1 (#1042/#1059) : « Laisser passer » ferme la fenêtre de TOUS — refusé à
    // TOUT siège tant qu'une rangée n'a pas déclaré (2ᵉ bout de la garde d'effet, `counterspellCancel`
    // dans `combatSlice`) ; phase close → `null`, le repli universel décide comme avant. Prédicat
    // STRUCTUREL (une rangée sans `declared`) : `netOwnership` reste une feuille, sans import de flux.
    ['counterspellCancel', { rule: (s) => ((s.pendingCounterspell?.participants ?? []).some((p) => !p.declared) ? false : null) }],
    ['counterspellDeclareAll', {
      rule: (s, seat) => (s.pendingCounterspell?.participants ?? []).some((p) => !p.declared && p.interactive && seatInfluences(s, seat, p.id)),
    }],
    // Résistance (Menace) d'une étape de cascade : routée sur l'acteur de l'étape (cf. ci-dessus).
    ['cascadeResist', CASCADE_RESIST],
    // #669 — Dialogue = décision de GROUPE (jeton unique d'exploration, piloté par l'hôte/MJ) : l'hôte choisit
    // la réponse, les autres LISENT. Un Test social DANS un dialogue reste arbitré par le propriétaire du héros
    // testeur (`openSkillTest`→`pendingTest`→modalArbiter).
    ...(['chooseDialogue', 'closeDialogue', 'interactEntity'] as const).map(
      (a) => [a, {
        rule: (s: GameState, seat: number) => seat === (s.net.gmSeat ?? 0),
        horsAllowlist: 'DÉFENSE EN PROFONDEUR — deux barrières indépendantes : `HostSession` filtre `GUEST_INTENTS` AVANT toute possession (l’intent n’atteint pas cette règle), et cette règle refuse par elle-même tout siège autre que le MJ/hôte, sans dépendre du filtre amont. Le geste vit à l’écran d’EXPLORATION, miroir de l’hôte en V1 (émetteurs mesurés : `chooseDialogue` DialogueBox et les touches `dialogue-choice-N` (keybindings), `interactEntity` useStagePointer ; `closeDialogue` : aucun)',
      }] as readonly [string, Route],
    ),
  ],
  // Flux MULTI dont le slot porte SON acteur (`FLOW_VERBS.pidIsActor`) : le JET d'un participant est
  // piloté par le propriétaire de CE combattant (1ᵉʳ arg = son id). Les décisions de GROUPE (Confirm/
  // Cancel) restent ouvertes ('*' via le owner de la modale), et les flux à `pidIsActor:false`
  // (`cascade`, `extendedTest` : args[0] = id d'étape/de Round) tombent sur le owner de LEUR modale.
  [...PARTICIPANT_OWNED_INTENTS].map((a) => [a, PAR_ARG0] as const),
  Object.entries(JET_OWNED_INTENTS).map(([a, jet]) => [a, routeJet(jet)] as const),
  Object.entries(HORS_MODAL_OWNED_INTENTS).map(([a, def]) => [a, routeHorsModal(def)] as const),
);

/**
 * REPLI UNIVERSEL — la règle de TOUT geste non routé (172 des 417 intents invités, plus tout intent
 * inconnu) : modale ouverte → seul son concerné agit ('*' = tous) ; sinon → seul le propriétaire du
 * combattant ACTIF agit. Ce n'est PAS une entrée de `ROUTES` (aucune clé ne le nomme) : c'est la
 * décision par défaut, appliquée dès qu'aucune route ne tranche.
 */
function repliUniversel(s: GameState, seat: number): boolean {
  const owner = modalOwnerOf(s);
  if (owner === '*') return true;
  if (owner !== null) return seatOwns(s, seat, owner);
  const activeId = s.battle ? s.battle.order[s.battle.turn] : undefined;
  return seatOwns(s, seat, activeId);
}

/** L'HÔTE accepte-t-il cet intent de `seat` ? UNE décision : la route de l'intent si elle TRANCHE
 *  (`true`/`false`), le repli universel si elle s'abstient (`null`) ou si l'intent n'est pas routé. */
export function intentAllowedFor(s: GameState, seat: number, action: string, args: unknown[] = []): boolean {
  const verdict = ROUTES.get(action)?.rule(s, seat, args) ?? null;
  return verdict === null ? repliUniversel(s, seat) : verdict;
}
