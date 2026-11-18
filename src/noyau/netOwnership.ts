/**
 * Possession réseau (Jalon 7) — l'HÔTE valide les INTENTS reçus : un invité ne pilote que SES
 * combattants. Le « qui est concerné » vient du REGISTRE des modales (`modalArbiter.MODAL_DEFS`,
 * source unique partagée avec le gating d'affichage UI) — ajouter une modale n'exige RIEN ici.
 */
import type { Jeu } from './etat';
import type { Combatant } from '../engine/types';
import {
  fenetreDuRegistre,
  modalOwnerOf,
  horsModalByPending,
  sortieDeLaFenetre,
  validationDeLaFenetre,
  type GesteDeFenetreDeclare,
  type HorsModalDef,
  type QuiValideLaFenetre,
} from './modalArbiter';
import { inBattleId, porteurParId } from './monde/combatants';
import { porteurDeLObjet } from './monde/carrier';
import { seatOwns, jetSurfaced, siegeDuHeros, worldSeat } from './sieges';
import { targetingHolder } from './targetingHolder';
import { cadenceAuto, cadenceAutoCombat } from '../engine/cadence';
import { desFixes } from '../engine/fixedDie';
import {
  FLOW_VERBS,
  NOM_DU_VERBE_DE_JET,
  VERBES_DE_JET,
  estVerbeDeFenetre,
  fluxAccepte,
  rangeeFacultative,
  type FlowVerbs,
  type JetOwnerRef,
  type NomDeVerbeDeJet,
  type RollVerb,
} from './flowVerbs';
import type { ActionDeClasse } from './intentionsDeSiege';
import type { PendingKey } from './stateFields';
import { declarationDuReglage, estFluxRegle } from './reglagesDuJet';
import { declarationDuChoix } from './choixDesFenetres';
import { WORLD_STEP_OWNER } from './pendings';
import type {
  CascadeStep,
  PendingAuContact,
  PendingBargain,
  PendingCast,
  PendingDefense,
  PendingDisengage,
  PendingDistraire,
  PendingGrapple,
} from './pendings';

/** Fenêtres HORS-modale indexées par leur `pending*` (#1016) — la possession du CLIC DE CARTE s'y
 *  prend quand `targetingHolder` désigne l'une d'elles. */
const HORS_MODAL_BY_PENDING: Readonly<Record<string, HorsModalDef>> = horsModalByPending();

/**
 * VERROU DE COMPILATION (#1005) : toute clé `pending` déclarée par un `jetOwner` de `FLOW_VERBS` doit
 * être un `pending*` RÉEL de l'état (`PendingKey`, dérivé — cf. `stateFields.ts`). Le verrou vit ICI et
 * pas dans la table : `flowVerbs.ts` ne peut pas importer un type de `Jeu` sans rendre `FLOWS`
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
  { [F in keyof _NonNull<Jeu[K]>]-?: _NonNull<Jeu[K]>[F] extends string | undefined ? F : never }[keyof _NonNull<Jeu[K]>],
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
 * SIÈGES REQUIS par un READY-CHECK (source UNIQUE : pause de Round, écran de Victoire, nuit de repos).
 * Deux conditions, et rien d'autre :
 *  - le siège HÔTE (0) est toujours requis — c'est lui qui applique le geste unanime ;
 *  - tout siège NOMMÉ (présent dans `net.seatNames`) qui tient au moins un héros ENCORE EN JEU (ni
 *    mort, ni hors rencontre).
 * Un siège nommé sans héros vivant n'a rien à valider : l'attendre bloquerait la table, l'afficher en
 * « en attente » mentirait. Le verdict est le MÊME pour les trois dispatchers et pour la rangée qui
 * les montre (`ReadyRow`) — afficher et décider ne peuvent pas répondre différemment.
 */
export function siegesRequis(s: Pick<Jeu, 'party' | 'net'>): number[] {
  const requis = new Set<number>([0]);
  for (const h of s.party) {
    if (h.dead || h.outOfRencontre) continue;
    const owner = s.net.ownership[h.id] ?? 0;
    if (s.net.seatNames[owner] != null) requis.add(owner);
  }
  return [...requis].sort((a, b) => a - b);
}

/** Tous les sièges requis ont-ils validé ? (même quorum, une seule lecture) */
export function quorumAtteint(s: Pick<Jeu, 'party' | 'net'>, readyBySeat: Record<number, boolean> = {}): boolean {
  return siegesRequis(s).every((seat) => readyBySeat[seat]);
}

/**
 * SIÈGE AGISSANT (#1017) — quel siège joue le geste EN COURS. Normalement `net.mySeat` (le joueur
 * devant l'écran) ; mais l'HÔTE exécute aussi les gestes des AUTRES sièges quand il applique un
 * intent reçu (`appliquerLIntentionDUnSiege`), et il les exécute DANS SON PROPRE store. Sans ce contexte,
 * toute garde d'action bâtie sur « le siège local possède-t-il ce combattant ? » (les ~30
 * `controlsCombatant` de `combatSlice`, dont `faireUnBattement`/`rompreLEngagement`) répondait NON
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

/** Un siège agit-il MAINTENANT (application d'un intent reçu, `withActingSeat`) ? */
export function unSiegeAgit(): boolean {
  return actingSeat != null;
}

/** Le siège au nom duquel on décide MAINTENANT : celui qui agit s'il y en a un, sinon le siège local.
 *  Exporté pour les gestes qui MARQUENT leur siège dans l'état partagé (demande de pause de Round) :
 *  le siège vient du TRANSPORT (`withActingSeat`, posé par `appliquerLIntentionDUnSiege`), jamais des arguments
 *  de l'émetteur — un siège ne peut donc marquer ni démarquer que lui-même. */
export function decidingSeat(s: Pick<Jeu, 'net'>): number {
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
export function ownsLocal(state: Jeu, combatantId: string | undefined): boolean {
  const { mode, mySeat } = state.net;
  if (mode === 'local') return true;
  if (actingSeat != null) return seatOwns(state, actingSeat, combatantId); // `seatOwns` traite l'absence d'acteur
  if (!combatantId) return mode === 'hote';
  return seatOwns(state, mySeat, combatantId);
}

/**
 * DÉCISION DE GROUPE — le geste qui n'appartient à AUCUN combattant : le jeton unique d'exploration
 * (dialogue, interaction d'entité). Son routage d'intent est `seat === (net.gmSeat ?? 0)` (`ROUTES` :
 * le choix `dialogue.reponse`/`interagirAvecLEntite`) — exactement ce que `seatOwns` rend sur le
 * sentinel MONDE (`WORLD_STEP_OWNER` : le siège MJ quand il existe, l'hôte sinon). Le prédicat
 * DÉLÈGUE donc au même routage au lieu de recopier la formule : afficher le choix, l'exécuter au
 * clic et l'exécuter à la touche répondent par la même table de vérité. SOLO : toujours vrai.
 *
 * Il vit ICI, avec le routage, parce que ses DEUX consommateurs sont de couches différentes : la
 * fenêtre (hook `useOwnsGroupDecision`, `ui/ownership`) et les raccourcis `dialogue-reponse-N`
 * (`state/clavier/keybindings`) — `src/state` ne peut pas lire `src/ui`.
 *
 * COUPLAGE ASSUMÉ : l'égalité route-du-dialogue ⇄ sentinel MONDE est une COÏNCIDENCE de formule, pas
 * une dépendance déclarée — si la route du dialogue divergeait, l'affordance suivrait le sentinel, pas
 * la route. `ui/ownership.test.tsx` verrouille cette égalité sur les 3 intents du jeton, siège par siège.
 */
export function ownsGroupDecision(s: Jeu): boolean {
  return ownsLocal(s, WORLD_STEP_OWNER);
}

/**
 * Le siège qui tient la décision de groupe (0 = l'hôte) — pour NOMMER celui qu'on attend dans
 * l'affordance de spectateur ; le verdict, lui, se demande à `ownsGroupDecision`.
 */
export function groupDecisionSeat(s: Jeu): number {
  return s.net.gmSeat ?? 0;
}

/** Surfaçage de la DÉFENSE (#989) — nom de domaine des sites d'attaque (`maybeOpenDefense`,
 *  `resolveAttack`, `surfacedDefensePending`), qui DÉLÈGUE au prédicat général `jetSurfaced` (`sieges`) : une seule
 *  implémentation du surfaçage réactif, jamais deux tables de vérité. */
export function defenseSurfaced(s: Jeu, defender: Combatant): boolean {
  return jetSurfaced(s, defender);
}

/**
 * Le combattant `c` est-il piloté À LA MAIN par un humain ? — CADENCE-AGNOSTIQUE (vrai même en Rapide/
 * Auto : décrit QUI possède le contrôle, pas s'il est déféré à un automate). Un HÉROS non-`aiControlled`
 * contrôlé localement → vrai ; un ENNEMI → vrai ssi un siège porte le rôle MJ (`gmSeat` — bac-à-sable ;
 * les jets du monde remontent au siège MJ) ; un PNJ neutre → faux. Prédicat de l'AFFORDANCE LOCALE
 * (qui a la main ICI) ; le SURFAÇAGE d'une défense, lui, passe par `defenseSurfaced` ci-dessus.
 */
export function pilotedByHuman(s: Jeu, c: Combatant): boolean {
  if (c.kind === 'heros') return !c.aiControlled && ownsLocal(s, c.id);
  if (c.kind === 'ennemi') return s.net.gmSeat != null; // conduit par le MJ (bac-à-sable) sinon IA
  return false;
}

/**
 * Ce siège a-t-il produit CE jet lui-même ? — prédicat de PRÉSENTATION (#990) : un siège ne se masque
 * jamais son propre dé. COMPOSE l'existant : contrôle humain LOCAL (`pilotedByHuman`, qui encode déjà
 * l'affordance de siège) ET possession locale (`ownsLocal`). Distinct de `ownsLocal` seul (vrai
 * pour TOUS en solo — un masque bâti dessus serait mort en solo) et de `controlsCombatant` (faux pour
 * mon propre héros en Auto-combat — son jet reste le mien). `ownerId` absent = adversaire ABSTRAIT
 * (table de taverne, aucun Combatant) : jamais produit par ce siège.
 */
export function rolledLocally(s: Jeu, ownerId: string | undefined): boolean {
  if (!ownerId) return false;
  const c = porteurParId(s, ownerId);
  return !!c && pilotedByHuman(s, c) && ownsLocal(s, c.id);
}

/** Participant d'un Test opposé à jet figé, réduit à ce que le calendrier #990 lit : id, rangée jouée
 *  ou témoin, jet posé. */
export interface ParticipantDeJetFige {
  id?: string;
  interactive?: boolean;
  result?: unknown;
}

/**
 * Le RÉPONDANT d'un Test opposé à jet figé a-t-il joué, vu de CE siège ? (#990). Formule unique, mono
 * comme multi (le mono = un participant) :
 *  - au moins une rangée de ce siège (jouée et produite ici) : toutes doivent porter leur jet (multi
 *    acteur : chacun joue à l'aveugle et ne voit qu'après SON jet) ;
 *  - aucune rangée de ce siège (spectateur tiers) : la première réponse posée suffit ;
 *  - aucun participant (jet non opposé) : rien à attendre.
 */
export function reponseDonnee(s: Jeu, participants: readonly ParticipantDeJetFige[]): boolean {
  if (!participants.length) return true;
  const miennes = participants.filter((p) => p.interactive && rolledLocally(s, p.id));
  return miennes.length ? miennes.every((p) => !!p.result) : participants.some((p) => !!p.result);
}

/** Le jet FIGÉ d'un Test opposé : son porteur (`undefined` : adversaire abstrait, sans combattant) et ses
 *  répondants. */
export interface JetFige {
  ownerId: string | undefined;
  participants: readonly ParticipantDeJetFige[];
}

/** Le jet figé est-il RÉVÉLÉ à ce siège ? (#990) Un siège ne se masque jamais son propre dé (`rolledLocally`) ;
 *  sinon la révélation suit la réponse (`reponseDonnee`). */
export function jetFigeRevele(s: Jeu, jet: JetFige): boolean {
  return rolledLocally(s, jet.ownerId) || reponseDonnee(s, jet.participants);
}

const repondant = (id: string, result: unknown): ParticipantDeJetFige[] => [{ id, interactive: true, result }];

/**
 * LE JET FIGÉ DE CHAQUE TEST OPPOSÉ À JET FIGÉ (#990), lu de son pending : la source unique de ses répondants,
 * lue par la fenêtre web qui le montre et par `jetsEnVue`.
 */
export const JET_FIGE = {
  defense: (pd: PendingDefense): JetFige => ({ ownerId: pd.attackerId, participants: repondant(pd.defenderId, pd.result) }),
  /** Les répondants de l'incantation : l'opposition de cible et le Contre-sort. */
  incantation: (s: Pick<Jeu, 'pendingCastOpposition' | 'pendingCounterspell'>, pc: PendingCast): JetFige => ({
    ownerId: pc.casterId,
    participants: [...(s.pendingCastOpposition?.participants ?? []), ...(s.pendingCounterspell?.participants ?? [])],
  }),
  desengagement: (pd: PendingDisengage): JetFige => ({ ownerId: pd.foeId, participants: repondant(pd.moverId, pd.def) }),
  auContact: (pd: PendingAuContact): JetFige => ({ ownerId: pd.foeId, participants: repondant(pd.moverId, pd.def) }),
  empoignade: (pd: PendingGrapple): JetFige => ({ ownerId: pd.foeId, participants: repondant(pd.actorId, pd.def) }),
  /** Le jet figé est le Calme du foe ; la réponse, l'Athlétisme du mover (`atk`). */
  distraire: (pd: PendingDistraire): JetFige => ({ ownerId: pd.foeId, participants: repondant(pd.moverId, pd.atk) }),
  /** L'opposant du Marchandage n'est pas un combattant. */
  marchandage: (pb: PendingBargain): JetFige => ({ ownerId: undefined, participants: repondant(pb.playerId, pb.roll ?? undefined) }),
  /** L'étape opposée d'une cascade (`meta.opposed`) : chaque rangée de sa bande, ou son acteur. */
  cascade: (step: CascadeStep): JetFige => ({
    ownerId: step.meta?.opposed?.attackerId,
    participants: step.participants
      ? step.participants.map((p) => ({ id: p.id, interactive: p.interactive !== false, result: p.result }))
      : [{ id: step.actorId, interactive: true, result: step.result }],
  }),
};

/**
 * Le combattant `c` est-il piloté par l'IA ? — base AGNOSTIQUE AU CAMP de l'orchestrateur de tour.
 * Un ENNEMI l'est SAUF si un siège porte le rôle MJ (`gmSeat`, bac-à-sable). Un HÉROS l'est en mode
 * Auto-combat ET contrôlé LOCALEMENT (coop : on ne joue jamais le héros d'un autre siège), ou s'il porte
 * le drapeau `aiControlled` (PNJ allié IA). Un PNJ neutre ne l'est jamais. NB : `aiDriven` ne change PAS
 * le `kind` du combattant. (Vit ICI, avec les primitives d'« qui pilote quoi » : `controlsActive`/
 * `controlsCombatant` en dépendent ; `combatGate` le ré-exporte pour ses consommateurs historiques.)
 */
export function aiDriven(s: Jeu, c: Combatant): boolean {
  if (c.kind === 'ennemi') return s.net.gmSeat == null; // ennemi = IA SAUF si un siège MJ le conduit
  // PNJ allié IA (`Combatant.aiControlled`, ex. défenseur de siège) : agit SEUL même en jeu MANUEL — sans
  // attendre l'Auto-combat global. On ne pilote jamais le combattant d'un AUTRE siège (`ownsLocal`).
  if (c.kind === 'heros' && c.aiControlled) return ownsLocal(s, c.id);
  return c.kind === 'heros' && cadenceAutoCombat() && ownsLocal(s, c.id);
}

/**
 * Le siège LOCAL pilote-t-il À LA MAIN ce combattant MAINTENANT ? — prédicat UNIQUE des affordances de TOUR
 * (grille de déplacement, réticule, barre d'action, hotbar). Héros manuel → vrai ; héros Auto-combat →
 * faux ; PNJ `aiControlled` → faux ; ennemi sans MJ → faux ; ENNEMI quand le siège LOCAL porte le rôle MJ
 * → vrai (coop : `gmSeat === mySeat`) ; invocation alliée (`kind:'heros'`) → comme un héros.
 */
export function controlsCombatant(s: Jeu, c: Combatant): boolean {
  if (!pilotedByHuman(s, c) || aiDriven(s, c)) return false;
  if (c.kind === 'heros') return true; // `pilotedByHuman` encode déjà `ownsLocal` (siège-aware)
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
export function humanControlled(s: Jeu, c: Combatant): boolean {
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
export function seatInfluences(s: Jeu, seat: number, ownerId: string | undefined): boolean {
  if (ownerId == null || ownerId === WORLD_STEP_OWNER) return seatOwns(s, seat, WORLD_STEP_OWNER);
  const c = porteurParId(s, ownerId);
  if (!c) return false;
  const solo = s.net.mode === 'local';
  if (c.kind === 'heros') return !c.aiControlled && (solo || seatOwns(s, seat, c.id));
  if (c.kind === 'ennemi') return s.net.gmSeat != null && (solo || s.net.gmSeat === seat);
  return false;
}

/**
 * Le siège LOCAL peut-il influencer ce jet ? Vue au siège local de `seatInfluences` ci-dessus (source
 * unique). Distinct de `ownsLocal` (vrai pour TOUS en solo : un gate bâti dessus laisse le joueur
 * dépenser la Résilience d'un ENNEMI) et de `rolledLocally` (calendrier de MASQUAGE, #990).
 * « Local » = le siège qui DÉCIDE maintenant (`decidingSeat`, patron `ownsLocal`) : pendant
 * l'application d'un intent, c'est le siège AGISSANT : le jet sans rangée d'un flux multi (`lancerSansRangee`) roule,
 * chez l'hôte, les rangées de l'invité émetteur. Hors application d'intent (rendu), `actingSeat` est nul.
 */
export function influencesLocally(s: Jeu, ownerId: string | undefined): boolean {
  return seatInfluences(s, decidingSeat(s), ownerId);
}

/**
 * Le joueur LOCAL peut-il FIXER lui-même la valeur du d100 de ce jet ? Prédicat UNIQUE de l'option de
 * confort « Dés fixés » (`engine/fixedDie.ts`) : l'option est active ET le siège local peut influencer
 * ce jet (`influencesLocally` ci-dessus — même routage porteur→siège, source unique).
 */
export function canFixDie(s: Jeu, ownerId: string | undefined): boolean {
  return desFixes() && influencesLocally(s, ownerId);
}

/** Le joueur LOCAL contrôle-t-il (À LA MAIN) le combattant ACTIF du combat ? Faux pendant le tour du héros
 *  d'un AUTRE joueur (hôte inclus), ET faux quand le héros actif est piloté par l'IA (Auto-combat) : l'UI
 *  traite alors ce tour comme un tour ennemi — AUCUNE affordance (grille de déplacement, réticule, barre
 *  d'action, raccourcis). Tour ennemi → vrai : l'IA tourne et l'UI est déjà inerte par ses propres verrous. */
export function controlsActive(state: Jeu): boolean {
  const b = state.battle;
  if (!b || b.over) return true;
  const activeId = b.order[b.turn];
  const active = inBattleId(b, activeId);
  if (!active) return true;
  if (active.kind !== 'heros') {
    // Actif non-héros : conduit par le siège MJ (bac-à-sable) → affordances si le siège qui DÉCIDE porte
    // le rôle MJ (le siège local, ou le siège AGISSANT pendant son intent). Sans MJ (`gmSeat` null) →
    // tour IA : vrai (l'UI est déjà inerte par ses propres verrous — inchangé). NB : le surfaçage FIN
    // des affordances passe par `controlsCombatant`.
    if (!pilotedByHuman(state, active)) return true;
    return state.net.mode === 'local' || state.net.gmSeat === decidingSeat(state);
  }
  if (aiDriven(state, active)) return false; // Auto-combat : l'IA pilote ce héros → pas d'affordance joueur
  return ownsLocal(state, activeId);
}

/** Emplacements de groupe encore à remplir par ce siège : slots attribués − héros possédés.
 *  (En mode local, slots = [0,0,0,0] → l'hôte garde les 4 emplacements, comme avant la coop.) */
export function seatSlotsRemaining(s: Pick<Jeu, 'net' | 'party'>, seat: number): number {
  const slots = (s.net.slots ?? [0, 0, 0, 0]).filter((x) => x === seat).length;
  const owned = s.party.filter((h) => siegeDuHeros(s.net, h.id) === seat).length;
  return slots - owned;
}

/**
 * ROUTE de possession d'un intent (#1051) — verdict à TROIS états : `true`/`false` TRANCHENT,
 * `null` = « cette route ne se prononce pas » et la décision revient au REPLI universel
 * (`repliUniversel`). `false` n'est donc JAMAIS relu comme une abstention.
 */
export interface Route {
  rule: (s: Jeu, seat: number, args: unknown[]) => boolean | null;
}

/** L'entrée d'une route, par nom de verbe (#3371 §3.5) : un verbe que l'invité joue. */
type EntreeDeRoute = readonly [ActionDeClasse<'invité'> | NomDeVerbeDeJet, Route];

/**
 * Assemble la table des routes en FAIL-FAST : une clé fournie deux fois lève un litige NOMINATIF au
 * chargement du module, jamais un écrasement silencieux. Les routes manuscrites et la famille dérivée des verbes de jet
 * sont disjointes aujourd'hui (`intent-routes.test.ts`) ; ce garde-fou verrouille
 * l'invariant — sans lui, un verbe qui migrerait d'une famille à l'autre changerait de route sans
 * qu'aucun test ne le voie.
 */
export function buildRoutes(...groupes: readonly (readonly EntreeDeRoute[])[]): ReadonlyMap<string, Route> {
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

/** Aucune possession en jeu, tout siège agit en tout temps : le geste marque le SIEN (siège lu au
 *  transport, `decidingSeat`, jamais dans les arguments) ou annote un état de GROUPE sans porteur ni
 *  effet de règle (épingle du carnet, #670). */
const TOUJOURS: Route = { rule: () => true };
/** Possession du combattant désigné par le 1ᵉʳ argument. */
const PAR_ARG0: Route = { rule: (s, seat, args) => seatOwns(s, seat, idArg(args[0])) };
/** Possession du porteur de l'objet désigné par le 1ᵉʳ argument, lu dans l'état (`porteurDeLObjet`) ; objet sans
 *  porteur → personne. */
const PAR_PORTEUR_DE_L_OBJET: Route = {
  rule: (s, seat, args) => {
    const uid = idArg(args[0]);
    const porteur = uid ? porteurDeLObjet(s, uid) : undefined;
    return !!porteur && seatOwns(s, seat, porteur);
  },
};

/**
 * CLIC DE CARTE pendant un ciblage détenu par une fenêtre HORS registre de modales (#1016) — c'est
 * LE chemin : le balayage et la 2ᵉ frappe (`frapperEnBalayage`/`frapperDeLaSecondeArme`) sont la machinerie du clic
 * (`targetingModes`, `MachinerieDuNoyau`), et le clic voyage par `cliquerLaCase`. Ce clic retombait sur
 * `modalOwnerOf`, qui ne consulte que `MODAL_DEFS` : sous un `destin` (1ʳᵉ entrée, priorité maximale) l'attaquant qui balaie était
 * REFUSÉ et la victime acceptée — son clic mourait ensuite dans les gardes de `cliquerLeCombattant`,
 * donc PERSONNE ne poursuivait le balayage. Tant qu'un pending hors-modale tient le ciblage
 * (`targetingHolder`, projection de `detenteurDuCiblage`, que l'aiguilleur projette aussi), le clic
 * appartient au PORTEUR de ce pending : l'attaquant du balayage / de la 2ᵉ frappe, l'artilleur du
 * pilonnage indirect. Aucun pending détenteur → `null` : le clic universel garde ses règles (repli).
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
 * ciblage ordinaire, il DÉCLENCHE le tir d'interruption du héros visant (`combatSlice.cliquerLeCombattant`
 * consulte `preemptAiming` AVANT toute autre garde) — la possession suit donc le TIREUR. Sans cela, la
 * pause de début de Round n'a AUCUN combattant actif (`turn: -1`) et le repli universel rendait l'hôte :
 * le clic de l'invité tireur était refusé. Hors visée armée : la route du clic de carte, inchangée.
 */
const CLIC_ENTITE: Route = {
  rule: (s, seat, args) => (s.preemptAiming ? seatOwns(s, seat, s.preemptAiming) : CLIC_CARTE.rule(s, seat, args)),
};

/** LE CLIC DU CHAMP (`cliquerLaCase(pt, entite?)`), par ce qu'il désigne : hors combat, la marche du groupe est une
 *  décision de GROUPE (#669), au siège du monde (`worldSeat`) ; en combat, un combattant désigné prend `CLIC_ENTITE`,
 *  une case libre `CLIC_CARTE`. */
const CLIC_DU_CHAMP: Route = {
  rule: (s, seat, args) => (!s.battle ? seat === worldSeat(s) : args[1] ? CLIC_ENTITE.rule(s, seat, args) : CLIC_CARTE.rule(s, seat, args)),
};

/**
 * Résistance (Menace) et inversion sur une étape de CASCADE : `pid` est l'id de l'ÉTAPE, pas un
 * combattant — mais ces verbes DÉPENSENT la ressource de l'acteur de cette étape (Talent, jeton
 * d'inversion), donc la possession le suit (même prédicat que l'affordance affichée, `seatInfluences`).
 * Le repli aurait rendu le owner de la MODALE, qui vaut `'*'` sur une étape de GROUPE : n'importe quel
 * siège aurait brûlé la ressource d'autrui (#1005).
 */
const acteurDEtape = (s: Jeu, seat: number, pid: string | undefined): boolean => {
  const step = s.pendingCascade?.participants.find((p) => p.id === pid);
  return !!step && seatInfluences(s, seat, step.actorId); // étape inconnue/fermée → personne
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
const routeJet = (jet: JetOwnerRef, depense: boolean): Route => ({
  rule: (s, seat) => {
    const pending = (s as unknown as Record<string, Record<string, unknown> | null | undefined>)[jet.pending];
    const ownerId = pending && typeof pending[jet.field] === 'string' ? (pending[jet.field] as string) : undefined;
    if (!ownerId) return false; // jet fermé/inconnu → personne
    // Un porteur qui n'est pas un combattant (le PNJ soigneur d'une scène) n'a aucune ressource à dépenser, et ne tient
    // aucun siège : le geste qui ne dépense rien retombe sur le repli universel, comme la rangée sans acteur propre.
    if (ownerId !== WORLD_STEP_OWNER && !porteurParId(s, ownerId)) return depense ? false : null;
    return seatInfluences(s, seat, ownerId);
  },
});

/** Le geste de jet `verbe` dépense-t-il une ressource du porteur ? Tous, sauf le lancer et les verbes de fenêtre
 *  (`estVerbeDeFenetre` : l'annulation et la clôture). */
const depenseDuPorteur = (verbe: RollVerb): boolean => verbe !== 'lancer' && !estVerbeDeFenetre(verbe);

/** La rangée (`pid`) d'un geste de jet : son dernier argument (`VerbesDeJet` : après le dé posé de `jetImposerLeResultat`). */
const rangeeDuGeste = (verbe: RollVerb, args: unknown[]): string | undefined => idArg(args[verbe === 'imposerLeResultat' ? 2 : 1]);

/**
 * Possession d'un geste de jet `verbe`, d'après le flux qu'il vise (1ᵉʳ argument) — un flux qui ne l'accepte pas :
 * personne.
 *  - flux MONO : le porteur du jet (`routeJet`) ; un porteur non combattant : le repli universel pour le lancer et les
 *    verbes de fenêtre, personne pour un verbe qui dépense (`depenseDuPorteur`) ;
 *  - Résistance et inversion d'une étape de `cascade` : l'acteur de l'étape (`acteurDEtape`) ;
 *  - flux MULTI dont la rangée porte SON acteur (`pidIsActor`) : le propriétaire de ce combattant ; le jet sans
 *    rangée (« Tout lancer », `rangeeFacultative`) : tout siège, il ne lance que les rangées du siège qui agit
 *    (`lancerSansRangee`, `influencesLocally`) ; un verbe de
 *    fenêtre (`estVerbeDeFenetre` : l'annulation et la clôture, qui agissent pour TOUS), et les flux dont la rangée n'a
 *    pas d'acteur propre (Round, étape, dé) retombent sur le repli universel (le owner de LEUR modale).
 */
const routeDuVerbeDeJet = (verbe: RollVerb): Route => ({
  rule: (s, seat, args) => {
    const flux = args[0];
    if (!fluxAccepte(flux, verbe)) return false;
    const w: FlowVerbs = FLOW_VERBS[flux];
    if (w.kind === 'mono') return routeJet(w.jetOwner, depenseDuPorteur(verbe)).rule(s, seat, args);
    if (flux === 'cascade' && (verbe === 'resister' || verbe === 'inverser')) return acteurDEtape(s, seat, rangeeDuGeste(verbe, args));
    if (!w.pidIsActor || estVerbeDeFenetre(verbe)) return null;
    const rangee = rangeeDuGeste(verbe, args);
    if (rangee === undefined && rangeeFacultative(flux, verbe)) return true;
    return seatOwns(s, seat, rangee);
  },
});

/**
 * Possession du réglage d'un jet (`jetRegler(flux, reglage, valeur, pid?)`), d'après sa déclaration (`REGLAGES_DU_JET`)
 * — un réglage que son flux ne déclare pas : personne.
 *  - le réglage de l'hôte seul (`qui`, l'abandon de la séquence) : l'hôte ;
 *  - le réglage que le siège d'un autre combattant joue (`porteurDeLaValeur` : les Bandages, LDB 74 l.41) : ce
 *    combattant ;
 *  - un réglage de rangée (l'arme d'enfoncement, EDO 11 l.93) : le combattant de la rangée (`pid`) ; sans rangée, un
 *    réglage `toutes` (la déclaration du Contre-sort) : le siège qui tient une de ses rangées encore à régler ; la
 *    rangée d'un flux dont elle n'est pas un combattant (l'étape de cascade) : le repli universel ;
 *  - sur un flux MONO : le porteur du jet (`routeJet`), comme son lancer — sur le Sort d'un ennemi, dont la
 *    fenêtre est à tous (`'*'`), le siège qui joue l'ennemi, jamais un autre ;
 *  - un réglage de fenêtre sur un flux MULTI (le virage d'une manœuvre navale) : le repli universel (le owner de sa
 *    modale).
 */
const ROUTE_DU_REGLAGE: Route = {
  rule: (s, seat, args) => {
    const [flux, reglage, valeur, pid] = args;
    const declaration = declarationDuReglage(flux, reglage);
    if (!declaration || !estFluxRegle(flux)) return false;
    if (declaration.qui === 'hote') return seatOwns(s, seat, undefined); // `undefined` → l'hôte (contrat de `seatOwns`)
    if (declaration.porteurDeLaValeur) return seatInfluences(s, seat, declaration.porteurDeLaValeur(s, valeur));
    const w: FlowVerbs = FLOW_VERBS[flux];
    if (declaration.portee === 'rangee') {
      if (w.kind === 'multi' && !w.pidIsActor) return null;
      return pid === undefined && declaration.toutes ? declaration.toutes(s).some((id) => seatInfluences(s, seat, id)) : seatInfluences(s, seat, idArg(pid));
    }
    return w.kind === 'mono' ? routeJet(w.jetOwner, false).rule(s, seat, args) : null;
  },
};

/**
 * La validation, la sortie ou un choix d'une fenêtre (`fenetreValider`, `fenetreFermer`, `fenetreChoisir`) : la fenêtre
 * est le 1ᵉʳ argument, et sa déclaration dit qui joue le geste — l'hôte seul, le siège du propriétaire de la fenêtre
 * nommée ('*' : tout siège), ou, à quorum, tout siège, qui ne marque prêt que le sien (lu au transport,
 * `decidingSeat`). Une fenêtre ou un choix inconnu, une fenêtre fermée : personne.
 */
const routeDuGesteDeFenetre = (declaration: (args: unknown[]) => GesteDeFenetreDeclare<QuiValideLaFenetre> | undefined): Route => ({
  rule: (s, seat, args) => {
    const geste = declaration(args);
    if (!geste?.ouverte(s)) return false;
    if (geste.qui === 'quorum' || geste.qui === 'hoteAuQuorum') return true;
    const owner = geste.qui === 'hote' ? undefined : geste.proprietaire(s);
    return owner === '*' || seatOwns(s, seat, owner); // `undefined` → l'hôte (contrat de `seatOwns`)
  },
});

const ROUTE_DU_GESTE_DE_CHOIX = routeDuGesteDeFenetre(([fenetre, axe, , pid]) => {
  const declaration = declarationDuChoix(fenetre, axe);
  const registre = fenetreDuRegistre(fenetre);
  if (!declaration || !registre) return undefined;
  const duHeros = declaration.portee === 'rangee' && declaration.qui === 'proprietaire';
  return { ...registre, qui: declaration.qui, ...(duHeros ? { proprietaire: () => idArg(pid) } : {}) };
});
const ROUTE_DU_CHOIX: Route = {
  rule: (s, seat, args) => {
    const ouvert = ROUTE_DU_GESTE_DE_CHOIX.rule(s, seat, args);
    const porteur = declarationDuChoix(args[0], args[1])?.porteurDeLaValeur;
    return porteur ? ouvert === true && seatInfluences(s, seat, porteur(s, args[2])) : ouvert;
  },
};

/**
 * TABLE UNIQUE intent → route (#1051), ÉNUMÉRABLE sans monter le store. Composition STATIQUE de maps
 * exportées par des modules FEUILLES (`flowVerbs`, `modalArbiter`) : aucun enregistrement à l'import
 * d'un module lourd, dont l'absence de chargement ferait retomber un geste sur le repli EN SILENCE
 * (classe de bug #1015/#1016/#1017). Ce qui N'EST PAS ici tombe sur `repliUniversel` — y compris tout
 * intent inconnu.
 */
export const ROUTES: ReadonlyMap<string, Route> = buildRoutes(
  [
    // Levée de main : le siège pose ou retire la SIENNE. `leverLaMain` ne prend que le sens et lit son siège au
    // transport (`decidingSeat`) : il n'y a aucun siège à valider ici.
    ['leverLaMain', TOUJOURS],
    // Carnet d'enquête (#670) : `epinglerLIndice` annote l'épingle de GROUPE ; `marquerLesIndices` marque la
    // nouveauté vue par le siège qui l'émet, lu au transport (`decidingSeat`).
    ['epinglerLIndice', TOUJOURS],
    ['marquerLesIndices', TOUJOURS],
    // Composition du groupe : tranchée par le geste, une fois — l'ajout par `refusDAjoutAuGroupe`, le retrait et le
    // remplacement par `refusDeComposerLeHeros` (`partyFlow.ts`).
    ['recruterLeHeros', TOUJOURS],
    ['renvoyerLeHeros', TOUJOURS],
    ['remplacerLeHeros', TOUJOURS],
    // Activités d'interlude (audit M7) : le 1er argument est le héros visé — son propriétaire agit ; composer et
    // pratiquer une Activité se choisit au siège du héros de la rangée (`fenetreChoisir('interlude', …)`).
    ['commanderLObjet', PAR_ARG0],
    ['deposerALaBanque', PAR_ARG0],
    ['solderLaFaveur', PAR_ARG0],
    ['menerLActionDeBataille', PAR_ARG0],
    // Retrait bancaire : le dépôt appartient à un héros — son propriétaire retire.
    ['retirerDeLaBanque', {
      rule: (s, seat, [depotId]) => {
        const dep = s.bank?.find((d) => d.uid === depotId);
        return dep ? seatOwns(s, seat, dep.heroId) : false; // dépôt inconnu → personne
      },
    }],
    // Les gestes d'un LANCEUR, en combat comme hors combat : le siège du lanceur (1ᵉʳ argument).
    ['incanterLeSort', PAR_ARG0],
    ['focaliserLeSort', PAR_ARG0],
    ['dissiperLeSort', PAR_ARG0],
    // La Détermination dépense le point de son porteur (1ᵉʳ argument), à sa barre comme dans la fenêtre d'un jet :
    // le siège qui influence ce combattant (`seatInfluences`), jamais celui qui tient la main.
    ['depenserLaDetermination', { rule: (s, seat, [id]) => typeof id === 'string' && seatInfluences(s, seat, id) }],
    // Les gestes d'un PORTEUR, en combat comme hors combat : le siège du porteur de l'objet, lu dans l'état.
    ['utiliserLObjet', PAR_PORTEUR_DE_L_OBJET],
    ['poserLObjet', PAR_PORTEUR_DE_L_OBJET],
    ['cliquerLaCase', CLIC_DU_CHAMP],
    // Le réglage d'un jet en attente (`routeDuReglage`).
    ['jetRegler', ROUTE_DU_REGLAGE],
    // La sortie et la validation d'une fenêtre, par ce que son registre déclare (`routeDuGesteDeFenetre`).
    ['fenetreFermer', routeDuGesteDeFenetre((args) => sortieDeLaFenetre(args[0]))],
    ['fenetreValider', routeDuGesteDeFenetre((args) => validationDeLaFenetre(args[0]))],
    // Le choix d'une fenêtre (`fenetreChoisir`), par ce que sa déclaration nomme (`CHOIX_DES_FENETRES`) : le siège du
    // propriétaire de la fenêtre nommée, pas celui de la modale prioritaire (`modalOwnerOf`), sur une rangée celui de
    // son héros (`pid`, 4ᵉ argument), et celui du combattant que la valeur nomme (`porteurDeLaValeur` : la Chance
    // dépensée à agir en premier, LDB 17 l.25 ; la visée du Tir rapide, LDB 11 l.97-103).
    ['fenetreChoisir', ROUTE_DU_CHOIX],
  ],
  // Les gestes de jet, clôture comprise, routés par le flux qu'ils visent (`routeDuVerbeDeJet`).
  VERBES_DE_JET.map((v) => [NOM_DU_VERBE_DE_JET[v], routeDuVerbeDeJet(v)] as const),
);

/**
 * REPLI UNIVERSEL — la règle de TOUT geste non routé, intent inconnu compris : modale ouverte → seul
 * son concerné agit ('*' = tous) ; sinon → seul le propriétaire du combattant ACTIF agit. Ce n'est PAS
 * une entrée de `ROUTES` (aucune clé ne le nomme) : c'est la décision par défaut, appliquée dès
 * qu'aucune route ne tranche.
 */
function repliUniversel(s: Jeu, seat: number): boolean {
  const main = quiTientLaMain(s);
  return main === '*' || seatOwns(s, seat, main);
}

/** QUI TIENT LA MAIN au repli universel : le concerné de la modale ouverte ('*' = tous), sinon le combattant actif ;
 *  `undefined` : personne (hors combat, aucune modale), donc l'hôte. */
export function quiTientLaMain(s: Jeu): string | undefined {
  const owner = modalOwnerOf(s);
  if (owner !== null) return owner;
  return s.battle ? s.battle.order[s.battle.turn] : undefined;
}

/** L'HÔTE accepte-t-il cet intent de `seat` ? UNE décision : la route de l'intent si elle TRANCHE
 *  (`true`/`false`), le repli universel si elle s'abstient (`null`) ou si l'intent n'est pas routé. */
export function intentAllowedFor(s: Jeu, seat: number, action: string, args: unknown[] = []): boolean {
  const verdict = ROUTES.get(action)?.rule(s, seat, args) ?? null;
  return verdict === null ? repliUniversel(s, seat) : verdict;
}
