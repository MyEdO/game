/** Interactions d'exploration : offres d'un décor ou d'un PNJ (`actionsDe`), leur exécuteur unique,
 *  l'assise et la fouille de pièce (#1687). */
import { type ActionOfferte, type CapaciteId, cleActionJouee, actionsDe, actionsAuthorees, estCapacite } from './monde/usable';
import { type SceneEntity, Scene } from './monde/scene';
import { ouvrirDialogue } from './dialogue';
import { placesJouables, RANG_MENEUR, seatPoseOf, releaseSeat, memeCase, type SeatPose, assignSeat } from './monde/seating';
import { meneurDuMonde, poserCapDuGroupe } from './monde/combatants';
import { t, trous } from '../i18n';
import { bus, EVT } from './bus';
import { cloturer, runFlow, flowRestant } from './combatEffects';
import { removeEntity } from './combatPlacement';
import { aPorteeDe } from './monde/exploreNav';
import { nomDEntite } from './monde/sceneNpc';
import { presetDuNarratif } from './monde/resolveursDuNarratif';
import { TIME_COST } from '../engine/timeCost';
import { refuserGeste } from './refusVisible';
import { porteurDExploration } from './gesteDArete';
import { roomFocusAt } from './monde/rooms';
import { fouilleDeLaPiece } from './monde/decouvertePorteSecrete';
import { rule } from '../engine/policy';
import type { Get, Set } from './flowTypes';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { FragmentDeTables } from './tablesPosees';
import type { ActionGate } from './actionRegistry';
import type { Jeu } from './etat';
import type { RefusGeste } from './gesteDArete';
import type { RoomFocus } from './monde/rooms';

/**
 * EXÉCUTEURS des capacités d'instance (#1687) — table TOTALE keyée par le MÊME `CapaciteId` que
 * `CAPACITES` (`noyau/monde/usable.ts`) : une capacité N+1 ne compile pas sans son OFFRE *et* son
 * exécuteur, et il n'existe pas de `if (actionId === …)` pour en ajouter une.
 */
const JOUER_CAPACITE: Readonly<Record<CapaciteId, (get: Get, set: Set, ent: SceneEntity, scene: Scene) => void>> = {
  parler: (get, set, ent, scene) => {
    const dlg = scene.dialogues.find((d) => d.id === ent.dialogueId);
    if (dlg) set({ dialogue: ouvrirDialogue(get(), dlg, ent.id) });
  },
  commercer: (get, _set, ent) => get().openMerchant(ent.id),
};

/** Places JOUABLES d'une entité : la géométrie vit sur le TYPE de décor, donc seule une instance de
 *  décor en porte (`placesJouables`, `noyau/monde/seating.ts`). */
function placesDe(scene: Scene, entityId: string) {
  const ent = scene.entities.find((e) => e.id === entityId);
  return ent?.kind === 'prop' ? placesJouables(scene, entityId) : [];
}

/** Les places JOUABLES de CE meuble qu'aucun occupant ne tient : le verdict de l'offre d'assise (`porteDOffre`) et
 *  le geste d'assise (`sasseoirA`) les lisent. */
function placesLibres(scene: Scene, entityId: string) {
  return placesDe(scene, entityId).filter((p) => !scene.seatAssignments?.[entityId]?.[p.slotId]);
}

/** Un ennemi d'embuscade n'offre rien et ne s'interpelle pas en exploration. */
const enEmbuscade = (ent: SceneEntity): boolean => !!ent.combat?.hiddenUntilCombat;

/** Verdict d'une offre d'exploration : la pastille le peint, le clic s'en sert pour savoir ce qu'il peut jouer sans
 *  rien demander. Ouverte par défaut (`actionsDe` a déjà retiré l'injouable) ; seule l'assise sans place libre se
 *  refuse, avec sa raison (arbitrage 2026-08-24 : la raison au survol). */
export function porteDOffre(scene: Scene, ent: SceneEntity, origine: ActionOfferte['origine']): ActionGate {
  if (origine !== 'assise' || placesLibres(scene, ent.id).length) return { ok: true };
  return { ok: false, reason: t('seating.occupied') };
}

/** Une offre d'exploration : l'offre d'`actionsDe` et son verdict (`porteDOffre`). */
interface OffreDExploration extends ActionOfferte {
  gate: ActionGate;
}

/** Les offres d'exploration d'un porteur, et son nom à l'écran. */
interface OffresDExplorationParPorteur {
  porteurId: string;
  porteurLabel?: string;
  offres: OffreDExploration[];
}

/** Les offres d'exploration du champ : un porteur par entité qui offre quelque chose (`actionsDe`) à portée du groupe
 *  (`aPorteeDe`, la portée de `jouerAction`), hors embuscade ; aucune pendant un dialogue. */
export function offresDExploration(s: Pick<Jeu, 'scene' | 'dialogue' | 'partyPos' | 'flags' | 'campaignNarratif'>): OffresDExplorationParPorteur[] {
  const { scene } = s;
  if (!scene || s.dialogue) return [];
  const porteurs: OffresDExplorationParPorteur[] = [];
  for (const ent of scene.entities) {
    if (enEmbuscade(ent) || !aPorteeDe(s.partyPos, ent)) continue;
    const offres = actionsDe(scene, ent, s.flags).map((o) => ({ ...o, gate: porteDOffre(scene, ent, o.origine) }));
    if (offres.length) porteurs.push({ porteurId: ent.id, porteurLabel: nomDEntite(ent, presetDuNarratif(s.campaignNarratif)), offres });
  }
  return porteurs;
}

/** Le meneur occupe-t-il CE meuble ? Alors il s'en relève, et le dit. Rend `true` s'il s'est levé —
 *  c'est la bascule du même intent, prioritaire sur toute autre affordance du meuble. */
function seLeverDe(get: Get, set: Set, entityId: string): boolean {
  const { scene } = get();
  if (!scene || !meneurDuMonde(get())) return false;
  const occupant = { kind: 'party', rang: RANG_MENEUR } as const;
  if (!placesDe(scene, entityId).length) return false;
  if (seatPoseOf(scene, occupant)?.propId !== entityId) return false;
  set({ scene: releaseSeat(scene, occupant) });
  get().log(t('seating.stood'));
  bus.emit(EVT.SCENE_DIRTY);
  return true;
}

/** Le meneur prend place à CE meuble, ou lit la raison française du refus. SOURCE UNIQUE du geste
 *  d'assise : `interactEntity` l'ordonne parmi les autres affordances, `jouerAction` le joue NU
 *  quand le joueur a choisi l'offre `sasseoir`. */
function sasseoirA(get: Get, set: Set, entityId: string): void {
  const { scene, partyPos } = get();
  const leaderId = meneurDuMonde(get())?.id;
  if (!scene || !leaderId) return;
  const places = placesDe(scene, entityId);
  if (!places.length) return;
  const occupant = { kind: 'party', rang: RANG_MENEUR } as const;
  const cible = placesLibres(scene, entityId).find((p) => memeCase(p.approach, partyPos));
  if (cible) {
    // REVALIDATION ATOMIQUE dans le callback `set` : entre le choix de la place ci-dessus et
    // l'écriture, un autre siège coop a pu prendre la dernière — un seul gagnant en sort. La place
    // ET son abord y sont RE-RÉSOLUS sur l'état courant : l'abord lu au clic peut avoir bougé (un
    // décor posé sur la case déclarée bascule la place sur son repli).
    const gagnee: { pose: SeatPose | null } = { pose: null };
    set((s) => {
      if (!s.scene || meneurDuMonde(s)?.id !== leaderId) return {};
      const place = placesJouables(s.scene, entityId).find((p) => p.slotId === cible.slotId);
      if (!place || !memeCase(s.partyPos, place.approach)) return {};
      const res = assignSeat(s.scene, entityId, place.slotId, occupant, s.party.length);
      if (!res.ok) return {};
      gagnee.pose = res.pose;
      return { scene: res.scene };
    });
    if (gagnee.pose) {
      get().log(t('seating.sat'));
      // POSE UNIQUE : le cap du GROUPE suit celui de la place — le corps, la vue subjective et tout
      // ce qui lit le regard d'exploration regardent la table, pas la direction d'où l'on venait.
      set((s) => ({ facing: poserCapDuGroupe(s.facing, gagnee.pose!.facing) }));
      bus.emit(EVT.SCENE_DIRTY);
      return;
    }
  }
  // UN SEUL message par situation : la place visée est partie (course perdue) ou toutes sont
  // prises → « occupé » ; il en reste une, mais pas sous les pieds → « rejoindre la place ».
  const apres = get().scene;
  get().log(t(apres && placesLibres(apres, entityId).length ? 'seating.mustReachApproach' : 'seating.occupied'));
}

/** La fouille de la pièce : la scène et la pièce où le groupe se tient, ou le refus nommé. Le verbe `fouillerLaPiece`,
 *  sa touche et son bouton la lisent. */
export function fouilleOuverte(s: Jeu): { scene: Scene; piece: RoomFocus } | RefusGeste {
  if (!s.scene) return { refus: 'geste.refus.aucuneScene', vars: trous({}) };
  if (s.mode !== 'exploration') return { refus: 'fouille.refus.horsExploration', vars: trous({}) };
  const porteur = porteurDExploration(s);
  if ('refus' in porteur) return porteur;
  const piece = roomFocusAt(s.scene, s.partyPos);
  return piece ? { scene: s.scene, piece } : { refus: 'fouille.refus.horsPiece', vars: trous({}) };
}

export function creerActionsDInteraction(get: Get, set: Set) {
  return {
    interactEntity: (entityId) => {
      const { scene, partyPos } = get();
      if (!scene) return;
      const ent = scene.entities.find((e) => e.id === entityId);
      if (!ent || enEmbuscade(ent)) return;
      // ── MEUBLE À PLACES — les places AJOUTENT une affordance, elles n'en retirent AUCUNE : un buffet
      // à tabourets qui porte aussi une fouille reste fouillable. Ordre servi, et c'est le seul :
      //  1. le meneur occupe CE meuble → il se relève (bascule du même intent, priorité absolue) ;
      //  2. ce que le meuble a d'ACTIF à portée : dialogue, marchand, fouille NON épuisée ;
      //  3. une place LIBRE dont l'abord est exactement sous les pieds du groupe → il s'assoit ;
      //  4. sinon la raison française du refus (assise, ou fouille déjà épuisée).
      // On loote la table, PUIS on s'y attable : aucune des deux affordances n'est inatteignable.
      // La portée d'une place ne se mesure pas au meuble mais à son ABORD (`slot.approach`, seule
      // couture `noyau/monde/seating`), qui peut tomber hors du voisinage de la case d'ancrage.
      // Le MENEUR est l'emplacement 1 du groupe ; son id ne sert qu'à re-vérifier, à l'écriture, que
      // le meneur n'a pas changé entre le clic et le commit (coop).
      const leaderId = meneurDuMonde(get())?.id;
      // Places JOUABLES, pas la géométrie : un décor que l'auteur n'a pas ACTIVÉ n'offre pas l'assise
      // (#1687, `placesJouables`) — le clic y reste inerte au lieu de servir une raison de refus.
      const places = placesDe(scene, entityId);
      if (seLeverDe(get, set, entityId)) return;
      const horsPortee = !aPorteeDe(partyPos, ent);
      // Trop loin ou autre étage : la portée se lit à la SOURCE UNIQUE (`exploreNav.aPorteeDe`, qui
      // compte l'étage). Ici, aucune des affordances de proximité ne s'ouvre ; le déplacement-puis-fouille
      // est armé par l'UI (setPendingInteract).
      if (!horsPortee) {
        const offres = actionsDe(scene, ent, get().flags).filter((o) => o.origine !== 'assise');
        // UNE offre → on la joue ; N → rien ici : le PANNEAU borné de la pastille les sert (« Que faire ? »),
        // et deviner à la place du joueur serait le choisir pour lui ; zéro → la chaîne d'assise, puis rien.
        if (offres.length === 1) { get().jouerAction(entityId, offres[0].id); return; }
        if (offres.length > 1) return;
      }
      if (places.length && leaderId) { sasseoirA(get, set, entityId); return; }
      // Actions authorées toutes ÉPUISÉES et rien d'autre à offrir : on le dit (le halo, lui, s'est
      // déjà éteint). Le décor en PORTE (l'auteur en a posé), aucune n'est plus jouable.
      if (!horsPortee && ent.usable?.actions?.length && !actionsAuthorees(ent, get().flags).length)
        get().log(t('store.searchedAlready', { what: nomDEntite(ent, presetDuNarratif(get().campaignNarratif)) ?? t('store.searchedFallback') }));
    },
    /**
     * EXÉCUTEUR UNIQUE d'une offre d'exploration (#1687) : `actionsDe` DIT ce qui est offert, `jouerAction`
     * le JOUE — et le dispatch se fait sur l'ORIGINE de l'offre, jamais sur un champ de l'entité ni sur
     * son id. Une action authorée N+1 ne coûte AUCUNE ligne ici ; une capacité d'instance N+1 coûte une
     * ligne de `JOUER_CAPACITE`, que la table TOTALE exige pour compiler.
     *
     * Une offre inconnue ou épuisée ne fait RIEN : l'offre est recalculée ICI sur l'état courant, donc un
     * clic arrivé en retard (coop, marche-puis-geste) ne rejoue pas une action fermée entre-temps.
     */
    jouerAction: (entityId, actionId) => {
      const { scene } = get();
      if (!scene) return;
      const ent = scene.entities.find((e) => e.id === entityId);
      if (!ent) return;
      const offre = actionsDe(scene, ent, get().flags).find((o) => o.id === actionId);
      if (!offre) return;
      // PORTÉE, même source unique que la pastille et le clic (`exploreNav.aPorteeDe`, étage compris) :
      // un ordre arrivé de loin (coop, clic en retard, marche interrompue) ne joue rien sur place.
      // L'assise est dehors : sa portée se mesure à l'ABORD de la place (`slot.approach`), qui peut
      // tomber hors du voisinage de la case d'ancrage.
      if (offre.origine !== 'assise' && !aPorteeDe(get().partyPos, ent)) return;
      if (offre.origine === 'capacite') {
        if (estCapacite(actionId)) JOUER_CAPACITE[actionId](get, set, ent, scene);
        return;
      }
      if (offre.origine === 'assise') {
        if (!seLeverDe(get, set, entityId)) sasseoirA(get, set, entityId);
        return;
      }
      const action = (ent.usable?.actions ?? []).find((a) => a.id === actionId);
      if (!action) return;
      const nom = nomDEntite(ent, presetDuNarratif(get().campaignNarratif));
      get().log(t('store.actionJouee', { what: nom ?? t('store.searchPlaceFallback'), action: offre.label }));
      // Logique authorée (Flow) : butin → fenêtre d'attribution, test → geste à risque (modale).
      // CLÔTURES (#1508) : l'horloge (« tout est horodaté ») puis le sort du décor. L'horloge tire les
      // effets PROGRAMMÉS et les ticks — jouée devant un dé de chute, elle les tirerait sur des
      // Blessures qui n'ont pas encaissé. Le coût de temps est une DONNÉE d'auteur (`minutes`) ; absent,
      // c'est celui de la fouille.
      cloturer(get, set, runFlow(get, set, flowRestant(entityId, action, get().flags), nom ?? offre.label), [
        { verbe: 'avancerHorloge', minutes: action.minutes ?? TIME_COST.search },
        ...(action.consume ? [{ verbe: 'retirerEntite' as const, entityId }] : []),
        ...(action.unique ? [{ verbe: 'marquerActionJouee' as const, entityId, actionId }] : []),
      ]);
    },
    fouillerLaPiece: () => {
      const fouille = fouilleOuverte(get());
      if ('refus' in fouille) return void refuserGeste(get, set, t(fouille.refus, fouille.vars));
      // La MÊME ligne qu'il y ait des portes ou non, qu'un Test échoue ou non : seule une réussite parle.
      get().log(t('fouille.journal'));
      cloturer(get, set, runFlow(get, set, fouilleDeLaPiece(fouille.scene, fouille.piece), t('eff.flowTitleDiscovery')), [
        { verbe: 'avancerHorloge', minutes: rule('fouille-piece-minutes') as number },
      ]);
    },
    /** Arme (ou annule via null) un déplacement-puis-interaction : l'UI le pose au clic d'un décor
     *  éloigné AVEC la case d'arrivée du plan de marche, consommé par `moveParty` à CETTE case ;
     *  annulé sur tout autre clic. */
    setPendingInteract: (pending) => set({ pendingInteract: pending }),
  } satisfies Partial<ActionsDuNoyau>;
}

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  clotures: {
    retirerEntite: (get, set, c) => removeEntity(get, set, c.entityId),
    marquerActionJouee: (_get, set, c) => set((s) => ({ flags: { ...s.flags, [cleActionJouee(c.entityId, c.actionId)]: true } })),
  },
} satisfies FragmentDeTables;
