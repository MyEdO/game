/**
 * INTERACTION D'ASSISE — le meneur s'assoit et se relève par le MÊME `interactEntity` (aucune route
 * `sit`/`seat`, aucun second pending). Ce que ces tests tiennent : la BASCULE, la condition d'abord
 * EXACT, l'unicité de l'occupant sur la dernière place, et les libérations de la marche.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { capDuGroupe, poserCapDuGroupe } from './combatants';
import { emptyScene, type Scene } from './scene';
import { seatPoseOf, seatSlotsOf, type SeatOccupant } from './seating';
import { flowFromEffects } from './flow';
import { interactionHalos } from '../gameIso/builders/interactHalos';
import type { BillboardPropEl } from '../gameIso/builders/types';
import type { Combatant } from '../engine/types';

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
/** Table en (5,5) au cap N : abords déclarés nord (5,4), est (6,5), sud (5,6), ouest (4,5). */
const ABORD_NORD = { x: 5, y: 4 };
const MENEUR: SeatOccupant = { kind: 'party', rang: 1 };

const hero = (id = 'h'): Combatant =>
  ({ id, label: id.toUpperCase(), kind: 'hero', xp: 0, wounds: { current: 12, max: 12 }, conditions: [], movement: 4 }) as unknown as Combatant;

function scèneDeTaverne(): Scene {
  const s = emptyScene(12, 12);
  s.id = 'taverne';
  s.entities = [
    { id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } },
    { id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, ref: TABLE, facing: 'N', usable: { assise: true } },
    { id: 'pnj-1', kind: 'personnage', ref: 'humain', pos: { x: 6, y: 5 } },
  ];
  return s;
}

/** Pose la scène, le groupe, et place le meneur sur `pos`. */
function poser(pos: { x: number; y: number }, seatAssignments?: Scene['seatAssignments']) {
  useGame.setState({ party: [hero()], scene: null, mode: 'exploration', journal: [], battle: null, dialogue: null, pendingInteract: null });
  const sc = scèneDeTaverne();
  if (seatAssignments) sc.seatAssignments = seatAssignments;
  useGame.getState().startScene(sc);
  useGame.setState({ partyPos: { ...pos } });
}

const poseDuMeneur = () => seatPoseOf(useGame.getState().scene!, MENEUR);
const dernierJournal = () => { const j = useGame.getState().journal; return j[j.length - 1] ?? ''; };
const journalEntier = () => useGame.getState().journal.join(' | ');
const occupants = (sc: Scene) => Object.values(sc.seatAssignments ?? {}).flatMap((m) => Object.values(m));

describe('interactEntity sur un meuble à places — bascule s’asseoir / se relever', () => {
  beforeEach(() => poser(ABORD_NORD));

  it('assoit puis relève party[0] par le même interactEntity', () => {
    useGame.getState().interactEntity(PROP);
    expect(poseDuMeneur()).toMatchObject({ propId: PROP, slotId: 'place-1' });
    expect(dernierJournal()).toContain('Vous prenez place');

    useGame.getState().interactEntity(PROP);
    expect(poseDuMeneur()).toBeNull();
    expect(dernierJournal()).toContain('Vous vous levez');
  });

  it('la place prise porte l’ANCRE et le CAP de la place, pas la case du groupe', () => {
    useGame.getState().interactEntity(PROP);
    const pose = poseDuMeneur()!;
    expect(pose.facing).toBe('S');                       // assis au nord de la table, on regarde le sud
    expect(pose.anchor.x).toBeCloseTo(5, 5);
    expect(pose.anchor.y).toBeCloseTo(4.52, 5);
    expect(pose.approach).toMatchObject(ABORD_NORD);     // la position LOGIQUE reste l'abord
    expect(useGame.getState().partyPos).toMatchObject(ABORD_NORD);
  });

  it('refuse la transaction si le groupe n’est pas exactement sur l’approche du slot', () => {
    poser({ x: ABORD_NORD.x + 1, y: ABORD_NORD.y });
    useGame.getState().interactEntity(PROP);
    expect(poseDuMeneur()).toBeNull();
    expect(dernierJournal()).toContain('Vous devez rejoindre la place');
  });

  it('toutes les places prises → refus explicite, aucune écriture', () => {
    const pris = (id: string): SeatOccupant => ({ kind: 'entity', entityId: id });
    poser(ABORD_NORD, { [PROP]: { 'place-1': pris('pnj-1'), 'place-2': pris('pnj-2'), 'place-3': pris('pnj-3'), 'place-4': pris('pnj-4') } });
    const avant = useGame.getState().scene!;
    useGame.getState().interactEntity(PROP);
    expect(poseDuMeneur()).toBeNull();
    expect(dernierJournal()).toContain('Toutes les places sont occupées');
    expect(useGame.getState().scene).toBe(avant); // aucune écriture de scène
  });

  it('un seul gagnant sur la DERNIÈRE place : celle que tient déjà un corps ne se redonne pas', () => {
    // « nord » (le seul abord sous les pieds du groupe) est déjà tenu par un PNJ.
    poser(ABORD_NORD, { [PROP]: { 'place-1': { kind: 'entity', entityId: 'pnj-1' } } });
    useGame.getState().interactEntity(PROP);
    expect(poseDuMeneur()).toBeNull();
    const sc = useGame.getState().scene!;
    expect(occupants(sc)).toHaveLength(1);
    expect(occupants(sc)[0]).toMatchObject({ kind: 'entity', entityId: 'pnj-1' });
  });

  it('un meuble SANS place suit le chemin d’interaction historique (aucune branche d’assise)', () => {
    useGame.setState({ party: [hero()], scene: null, mode: 'exploration', journal: [] });
    const sc = emptyScene(12, 12);
    sc.id = 'sans-places';
    sc.entities = [{ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } }, { id: 'caisse', kind: 'prop', pos: { x: 5, y: 5 }, ref: 'comptoir-droit' }];
    useGame.getState().startScene(sc);
    useGame.setState({ partyPos: { x: 5, y: 4 } });
    useGame.getState().interactEntity('caisse');
    expect(useGame.getState().scene!.seatAssignments).toBeUndefined();
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
    useGame.setState({ party: [hero()], scene: null, mode: 'exploration', journal: [], battle: null, dialogue: null, flags: {} });
    const sc = scèneDeTaverne();
    const table = sc.entities.find((e) => e.id === PROP)!;
    (table as { usable?: unknown }).usable = { assise: true, ...FOUILLE };
    if (seatAssignments) sc.seatAssignments = seatAssignments;
    useGame.getState().startScene(sc);
    useGame.setState({ partyPos: { ...pos }, flags: {} });
  }

  it('fouille D’ABORD, assise ENSUITE : les deux gestes passent par le même meuble', () => {
    posrFouillable(ABORD_NORD);
    useGame.getState().interactEntity(PROP);
    expect(journalEntier(), 'le journal NOMME le geste joué').toContain('Fouiller…');
    expect(poseDuMeneur(), 'la fouille ne fait pas asseoir').toBeNull();

    useGame.getState().interactEntity(PROP); // fouille épuisée → la place prend le relais
    expect(poseDuMeneur()).toMatchObject({ slotId: 'place-1' });
    expect(dernierJournal()).toContain('Vous prenez place');
  });

  it('TABLE PLEINE : la fouille reste atteignable (elle n’est jamais avalée par l’assise)', () => {
    const pris = (id: string): SeatOccupant => ({ kind: 'entity', entityId: id });
    posrFouillable(ABORD_NORD, { [PROP]: { 'place-1': pris('a'), 'place-2': pris('b'), 'place-3': pris('c'), 'place-4': pris('d') } });
    useGame.getState().interactEntity(PROP);
    expect(journalEntier(), 'le journal NOMME le geste joué').toContain('Fouiller…');
    // …et une fois épuisée, le meuble dit la seule chose qui reste vraie.
    useGame.getState().interactEntity(PROP);
    expect(dernierJournal()).toContain('Toutes les places sont occupées');
  });

  it('AUCUNE affordance morte : le halo n’est allumé que si un geste reste possible', () => {
    // Halo ALLUMÉ = fouille non épuisée OU place libre — exactement ce que le store sert.
    posrFouillable(ABORD_NORD);
    const el = { kind: 'prop', key: `prop:${PROP}`, cell: { x: 5, y: 5, z: 0 }, source: 'entity', entId: PROP,
      ref: TABLE, foot: { offX: 0, offY: 0, scale: 1 },states: { visible: true } } as unknown as BillboardPropEl;
    // RÉGIME de révélation (#1687) : Alt tenu, donc ce qui APPELLE est allumé — ce que le halo dit ici,
    // c'est l'appartenance à la liste des utilisables, pas la variante peinte.
    const sc = () => useGame.getState().scene!;
    const halos = () => interactionHalos([], [el], sc(), useGame.getState().flags, { survol: null, reveler: true });
    expect(halos()).toHaveLength(1);

    useGame.getState().interactEntity(PROP); // fouille consommée
    useGame.getState().interactEntity(PROP); // place prise
    expect(poseDuMeneur()).not.toBeNull();
    // Il reste 3 places : le halo appelle encore, et le clic sert encore (se relever).
    expect(halos()).toHaveLength(1);
    useGame.getState().interactEntity(PROP);
    expect(poseDuMeneur(), 'le clic du meuble occupé relève TOUJOURS, quoi que porte le meuble').toBeNull();
  });

  it('un meuble à places SANS fouille ne journalise jamais la fouille', () => {
    poser(ABORD_NORD);
    useGame.getState().interactEntity(PROP);
    expect(dernierJournal()).toContain('Vous prenez place');
  });
});

describe('la POSE est unique — le cap d’ÉTAT suit la place', () => {
  it('s’asseoir aligne le cap du GROUPE sur le cap du slot', () => {
    poser(ABORD_NORD);
    useGame.setState((s) => ({ facing: poserCapDuGroupe(s.facing, 'N') })); // regard opposé avant l'assise
    useGame.getState().interactEntity(PROP);
    expect(poseDuMeneur()!.facing).toBe('S');
    expect(capDuGroupe(useGame.getState()), 'le cap d’état, celui que lit la vue subjective').toBe('S');
  });

  it('chaque abord donne SON cap : l’état n’est jamais celui de la marche', () => {
    for (const place of seatSlotsOf(scèneDeTaverne(), PROP)) {
      poser(place.approach);
      useGame.getState().interactEntity(PROP);
      expect(capDuGroupe(useGame.getState()), `place « ${place.slotId} »`).toBe(place.facing);
    }
  });
});

describe('marcher, c’est se lever — et le déplacement-puis-assise arrive sur l’ABORD', () => {
  it('moveParty libère la place du meneur AVANT de le déplacer', () => {
    poser(ABORD_NORD);
    useGame.getState().interactEntity(PROP);
    expect(poseDuMeneur()).not.toBeNull();
    useGame.getState().moveParty({ x: 5, y: 3 });
    expect(poseDuMeneur()).toBeNull();
    expect(useGame.getState().partyPos).toMatchObject({ x: 5, y: 3 });
  });

  it('une scène SANS assise ne produit aucun delta de scène au déplacement', () => {
    poser({ x: 0, y: 0 });
    const avant = useGame.getState().scene!;
    useGame.getState().moveParty({ x: 1, y: 0 });
    expect(useGame.getState().scene).toBe(avant);
  });

  it('pendingInteract armé sur un meuble à places se consomme À L’ARRIVÉE sur l’abord', () => {
    poser({ x: 5, y: 2 });
    useGame.getState().setPendingInteract({ id: PROP, at: ABORD_NORD });
    useGame.getState().moveParty({ x: 5, y: 3 }); // hors de tout abord : rien ne se déclenche
    expect(useGame.getState().pendingInteract).toMatchObject({ id: PROP });
    expect(poseDuMeneur()).toBeNull();

    useGame.getState().moveParty(ABORD_NORD); // sur l'abord → assise automatique
    expect(useGame.getState().pendingInteract).toBeNull();
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
    const abords = seatSlotsOf(useGame.getState().scene!, PROP).map((s) => `${s.approach.x},${s.approach.y}`);
    const CROISEE = { x: 4, y: 4 }; // diagonale de la table (5,5) — et AUCUN de ses abords
    expect(abords, 'la case croisée ne doit pas être un abord, sinon le test ne mord pas').not.toContain(`${CROISEE.x},${CROISEE.y}`);

    useGame.getState().setPendingInteract({ id: PROP, at: ABORD_NORD });
    useGame.getState().moveParty(CROISEE);
    expect(useGame.getState().pendingInteract, 'le pending survit au passage').toMatchObject({ id: PROP });
    expect(journalEntier(), 'aucun refus d’assise en passant').not.toContain('Vous devez rejoindre la place');

    useGame.getState().moveParty(ABORD_NORD);
    expect(poseDuMeneur(), 'un seul geste : le meneur est assis à l’arrivée').toMatchObject({ slotId: 'place-1' });
  });

  it('les 4 abords de la table mènent chacun à LEUR place', () => {
    for (const attendu of seatSlotsOf(scèneDeTaverne(), PROP)) {
      poser(attendu.approach);
      useGame.getState().interactEntity(PROP);
      expect(poseDuMeneur(), `abord de « ${attendu.slotId} »`).toMatchObject({ slotId: attendu.slotId });
    }
  });
});
