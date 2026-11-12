/**
 * INTERACTION D'ASSISE — le meneur s'assoit et se relève par le MÊME `interagirAvecLEntite` (aucune route
 * `sit`/`seat`, aucun second pending). Ce que ces tests tiennent : la BASCULE, la condition d'abord
 * EXACT, l'unicité de l'occupant sur la dernière place, et les libérations de la marche.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { capDuGroupe, poserCapDuGroupe } from './monde/combatants';
import { emptyScene, type Scene } from './monde/scene';
import { seatPoseOf, seatSlotsOf, type SeatOccupant } from './monde/seating';
import { flowFromEffects } from './monde/flow';
import type { Combatant } from '../engine/types';
import { poserLeGroupe } from './marcheDuGroupe';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
/** Table en (5,5) au cap N : abords déclarés nord (5,4), est (6,5), sud (5,6), ouest (4,5). */
const ABORD_NORD = { x: 5, y: 4 };
const MENEUR: SeatOccupant = { kind: 'groupe', rang: 1 };

const hero = (id = 'h'): Combatant =>
  combattantDeTest({ id, label: id.toUpperCase(), kind: 'heros', xp: 0, wounds: blessuresDeBase(12), conditions: [], movement: 4 });

function scèneDeTaverne(): Scene {
  const s = emptyScene('scene-test', 12, 12);
  s.id = 'taverne';
  s.entities = [
    { id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } },
    { id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, decor: { id: TABLE }, facing: 'N', usable: { assise: true } },
    { id: 'pnj-1', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 6, y: 5 } },
  ];
  return s;
}

/** Pose la scène, le groupe, et place le meneur sur `pos`. */
function poser(pos: { x: number; y: number }, seatAssignments?: Scene['seatAssignments']) {
  banc.setState({ party: [hero()], scene: null, mode: 'exploration', journal: [], battle: null, dialogue: null, pendingInteract: null });
  const sc = scèneDeTaverne();
  if (seatAssignments) sc.seatAssignments = seatAssignments;
  banc.getState().lancerLaScene(sc);
  banc.setState({ partyPos: { ...pos } });
}

const poseDuMeneur = () => seatPoseOf(banc.getState().scene!, MENEUR);
const dernierJournal = () => { const j = banc.getState().journal; return j[j.length - 1] ?? ''; };
const journalEntier = () => banc.getState().journal.join(' | ');
const occupants = (sc: Scene) => Object.values(sc.seatAssignments ?? {}).flatMap((m) => Object.values(m));

describe('interagirAvecLEntite sur un meuble à places — bascule s’asseoir / se relever', () => {
  beforeEach(() => poser(ABORD_NORD));

  it('assoit puis relève party[0] par le même interagirAvecLEntite', () => {
    banc.getState().interagirAvecLEntite(PROP);
    expect(poseDuMeneur()).toMatchObject({ propId: PROP, slotId: 'place-1' });
    expect(dernierJournal()).toContain('Vous prenez place');

    banc.getState().interagirAvecLEntite(PROP);
    expect(poseDuMeneur()).toBeNull();
    expect(dernierJournal()).toContain('Vous vous levez');
  });

  it('la place prise porte l’ANCRE et le CAP de la place, pas la case du groupe', () => {
    banc.getState().interagirAvecLEntite(PROP);
    const pose = poseDuMeneur()!;
    expect(pose.facing).toBe('S');                       // assis au nord de la table, on regarde le sud
    expect(pose.anchor.x).toBeCloseTo(5, 5);
    expect(pose.anchor.y).toBeCloseTo(4.52, 5);
    expect(pose.approach).toMatchObject(ABORD_NORD);     // la position LOGIQUE reste l'abord
    expect(banc.getState().partyPos).toMatchObject(ABORD_NORD);
  });

  it('refuse la transaction si le groupe n’est pas exactement sur l’approche du slot', () => {
    poser({ x: ABORD_NORD.x + 1, y: ABORD_NORD.y });
    banc.getState().interagirAvecLEntite(PROP);
    expect(poseDuMeneur()).toBeNull();
    expect(dernierJournal()).toContain('Vous devez rejoindre la place');
  });

  it('toutes les places prises → refus explicite, aucune écriture', () => {
    const pris = (id: string): SeatOccupant => ({ kind: 'entite', entityId: id });
    poser(ABORD_NORD, { [PROP]: { 'place-1': pris('pnj-1'), 'place-2': pris('pnj-2'), 'place-3': pris('pnj-3'), 'place-4': pris('pnj-4') } });
    const avant = banc.getState().scene!;
    banc.getState().interagirAvecLEntite(PROP);
    expect(poseDuMeneur()).toBeNull();
    expect(dernierJournal()).toContain('Toutes les places sont occupées');
    expect(banc.getState().scene).toBe(avant); // aucune écriture de scène
  });

  it('un seul gagnant sur la DERNIÈRE place : celle que tient déjà un corps ne se redonne pas', () => {
    // « nord » (le seul abord sous les pieds du groupe) est déjà tenu par un PNJ.
    poser(ABORD_NORD, { [PROP]: { 'place-1': { kind: 'entite', entityId: 'pnj-1' } } });
    banc.getState().interagirAvecLEntite(PROP);
    expect(poseDuMeneur()).toBeNull();
    const sc = banc.getState().scene!;
    expect(occupants(sc)).toHaveLength(1);
    expect(occupants(sc)[0]).toMatchObject({ kind: 'entite', entityId: 'pnj-1' });
  });

  it('un meuble SANS place suit le chemin d’interaction historique (aucune branche d’assise)', () => {
    banc.setState({ party: [hero()], scene: null, mode: 'exploration', journal: [] });
    const sc = emptyScene('scene-test', 12, 12);
    sc.id = 'sans-places';
    sc.entities = [{ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } }, { id: 'caisse', kind: 'prop', pos: { x: 5, y: 5 }, decor: { id: 'comptoir-droit' } }];
    banc.getState().lancerLaScene(sc);
    banc.setState({ partyPos: { x: 5, y: 4 } });
    banc.getState().interagirAvecLEntite('caisse');
    expect(banc.getState().scene!.seatAssignments).toBeUndefined();
    expect(dernierJournal()).not.toContain('Vous prenez place');
  });
});

/**
 * COEXISTENCE — une place AJOUTE une affordance, elle n'en retire aucune. Un meuble à tabourets qui
 * porte AUSSI une fouille reste fouillable : on le loote d'abord, on s'y attable ensuite. Rien de ce
 * que le halo annonce n'est inatteignable.
 */
describe('meuble à places ET fouillable — les deux affordances restent atteignables', () => {
  const FOUILLE = { actions: [{ id: 'fouiller', flow: flowFromEffects([{ type: 'giveMoney', montant: { gold: 2 } }]), unique: true }] };

  function posrFouillable(pos: { x: number; y: number }, seatAssignments?: Scene['seatAssignments']) {
    banc.setState({ party: [hero()], scene: null, mode: 'exploration', journal: [], battle: null, dialogue: null, flags: {} });
    const sc = scèneDeTaverne();
    const table = sc.entities.find((e) => e.id === PROP)!;
    (table as { usable?: unknown }).usable = { assise: true, ...FOUILLE };
    if (seatAssignments) sc.seatAssignments = seatAssignments;
    banc.getState().lancerLaScene(sc);
    banc.setState({ partyPos: { ...pos }, flags: {} });
  }

  it('fouille D’ABORD, assise ENSUITE : les deux gestes passent par le même meuble', () => {
    posrFouillable(ABORD_NORD);
    banc.getState().interagirAvecLEntite(PROP);
    expect(journalEntier(), 'le journal NOMME le geste joué').toContain('Fouiller…');
    expect(poseDuMeneur(), 'la fouille ne fait pas asseoir').toBeNull();

    banc.getState().interagirAvecLEntite(PROP); // fouille épuisée → la place prend le relais
    expect(poseDuMeneur()).toMatchObject({ slotId: 'place-1' });
    expect(dernierJournal()).toContain('Vous prenez place');
  });

  it('assis à un meuble fouillable : le clic du meuble occupé RELÈVE, quoi que porte le meuble', () => {
    posrFouillable(ABORD_NORD);
    banc.getState().interagirAvecLEntite(PROP); // fouille consommée
    banc.getState().interagirAvecLEntite(PROP); // place prise
    expect(poseDuMeneur()).not.toBeNull();
    banc.getState().interagirAvecLEntite(PROP);
    expect(poseDuMeneur()).toBeNull();
  });

  it('TABLE PLEINE : la fouille reste atteignable (elle n’est jamais avalée par l’assise)', () => {
    const pris = (id: string): SeatOccupant => ({ kind: 'entite', entityId: id });
    posrFouillable(ABORD_NORD, { [PROP]: { 'place-1': pris('a'), 'place-2': pris('b'), 'place-3': pris('c'), 'place-4': pris('d') } });
    banc.getState().interagirAvecLEntite(PROP);
    expect(journalEntier(), 'le journal NOMME le geste joué').toContain('Fouiller…');
    // …et une fois épuisée, le meuble dit la seule chose qui reste vraie.
    banc.getState().interagirAvecLEntite(PROP);
    expect(dernierJournal()).toContain('Toutes les places sont occupées');
  });

  it('un meuble à places SANS fouille ne journalise jamais la fouille', () => {
    poser(ABORD_NORD);
    banc.getState().interagirAvecLEntite(PROP);
    expect(dernierJournal()).toContain('Vous prenez place');
  });
});

describe('la POSE est unique — le cap d’ÉTAT suit la place', () => {
  it('s’asseoir aligne le cap du GROUPE sur le cap du slot', () => {
    poser(ABORD_NORD);
    banc.setState((s) => ({ facing: poserCapDuGroupe(s.facing, 'N') })); // regard opposé avant l'assise
    banc.getState().interagirAvecLEntite(PROP);
    expect(poseDuMeneur()!.facing).toBe('S');
    expect(capDuGroupe(banc.getState()), 'le cap d’état, celui que lit la vue subjective').toBe('S');
  });

  it('chaque abord donne SON cap : l’état n’est jamais celui de la marche', () => {
    for (const place of seatSlotsOf(scèneDeTaverne(), PROP)) {
      poser(place.approach);
      banc.getState().interagirAvecLEntite(PROP);
      expect(capDuGroupe(banc.getState()), `place « ${place.slotId} »`).toBe(place.facing);
    }
  });
});

describe('marcher, c’est se lever — et le déplacement-puis-assise arrive sur l’ABORD', () => {
  it('deplacerLeGroupe libère la place du meneur AVANT de le déplacer', () => {
    poser(ABORD_NORD);
    banc.getState().interagirAvecLEntite(PROP);
    expect(poseDuMeneur()).not.toBeNull();
    poserLeGroupe(banc.getState, banc.setState, { x: 5, y: 3 });
    expect(poseDuMeneur()).toBeNull();
    expect(banc.getState().partyPos).toMatchObject({ x: 5, y: 3 });
  });

  it('une scène SANS assise ne produit aucun delta de scène au déplacement', () => {
    poser({ x: 0, y: 0 });
    const avant = banc.getState().scene!;
    poserLeGroupe(banc.getState, banc.setState, { x: 1, y: 0 });
    expect(banc.getState().scene).toBe(avant);
  });

  it('pendingInteract armé sur un meuble à places se consomme À L’ARRIVÉE sur l’abord', () => {
    poser({ x: 5, y: 2 });
    banc.getState().poserLInteraction({ id: PROP, at: ABORD_NORD });
    poserLeGroupe(banc.getState, banc.setState, { x: 5, y: 3 }); // hors de tout abord : rien ne se déclenche
    expect(banc.getState().pendingInteract).toMatchObject({ id: PROP });
    expect(poseDuMeneur()).toBeNull();

    poserLeGroupe(banc.getState, banc.setState, ABORD_NORD); // sur l'abord → assise automatique
    expect(banc.getState().pendingInteract).toBeNull();
    expect(poseDuMeneur()).toMatchObject({ slotId: 'place-1' });
  });

  /**
   * REPRO MESURÉE AU NAVIGATEUR (recette #1443, `la-diligence`) : le chemin vers l'abord d'une place
   * LONGE la table, et l'ancienne consommation « à l'arrivée ADJACENTE » ouvrait l'interaction à une
   * case voisine qui n'est PAS un abord — le meneur s'y voyait refuser l'assise (« Vous devez rejoindre
   * la place »), le pending était brûlé, et il fallait un SECOND clic une fois sur place.
   */
  it('une case ADJACENTE au meuble mais SANS place ne consomme pas le pending armé sur l’abord', () => {
    poser({ x: 4, y: 3 });
    const abords = seatSlotsOf(banc.getState().scene!, PROP).map((s) => `${s.approach.x},${s.approach.y}`);
    const CROISEE = { x: 4, y: 4 }; // diagonale de la table (5,5) — et AUCUN de ses abords
    expect(abords, 'la case croisée ne doit pas être un abord, sinon le test ne mord pas').not.toContain(`${CROISEE.x},${CROISEE.y}`);

    banc.getState().poserLInteraction({ id: PROP, at: ABORD_NORD });
    poserLeGroupe(banc.getState, banc.setState, CROISEE);
    expect(banc.getState().pendingInteract, 'le pending survit au passage').toMatchObject({ id: PROP });
    expect(journalEntier(), 'aucun refus d’assise en passant').not.toContain('Vous devez rejoindre la place');

    poserLeGroupe(banc.getState, banc.setState, ABORD_NORD);
    expect(poseDuMeneur(), 'un seul geste : le meneur est assis à l’arrivée').toMatchObject({ slotId: 'place-1' });
  });

  it('les 4 abords de la table mènent chacun à LEUR place', () => {
    for (const attendu of seatSlotsOf(scèneDeTaverne(), PROP)) {
      poser(attendu.approach);
      banc.getState().interagirAvecLEntite(PROP);
      expect(poseDuMeneur(), `abord de « ${attendu.slotId} »`).toMatchObject({ slotId: attendu.slotId });
    }
  });
});
