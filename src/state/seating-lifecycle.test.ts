/**
 * CYCLE DE VIE DE L'ASSISE DU GROUPE — un héros du groupe (`kind:'party'`) ne reste jamais assis là
 * où son corps n'est plus : changement de meneur, retrait du groupe, transition de scène, ouverture
 * de combat. Le pendant `kind:'entity'` (PNJ authoré) vit dans `combat-entity-reconcile.test.ts` ; le
 * volet persistance (save/reload, élagage au chargement) dans `seating-persistence`/`sceneInstance`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { emptyScene, type Scene, type SceneEntity } from './scene';
import { seatPoseOf, type SeatOccupant } from './seating';
import { notifySlain, releaseSeatsOfDowned } from './combatFlow';
import { TIME_COST } from '../engine/timeCost';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
const ABORD_NORD = { x: 5, y: 4 };

const hero = (id: string): Combatant =>
  ({ id, label: id.toUpperCase(), kind: 'hero', xp: 0, wounds: { current: 12, max: 12 }, conditions: [], movement: 4 }) as unknown as Combatant;

const place = (rang: number): SeatOccupant => ({ kind: 'party', rang });
const poseDe = (rang: number) => seatPoseOf(useGame.getState().scene!, place(rang));

function scèneDeTaverne(id: string): Scene {
  const s = emptyScene(12, 12);
  s.id = id;
  s.entities.push({ id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, ref: TABLE, facing: 'N', usable: { assise: true } });
  return s;
}

/** Assoit `party[0]` à la place « nord » par le geste RÉEL (`interactEntity`), jamais à la main. */
function meneurAssis(party: Combatant[], sceneId = 'taverne'): void {
  useGame.setState({ party, scene: null, mode: 'exploration', journal: [], battle: null, dialogue: null });
  useGame.getState().startScene(scèneDeTaverne(sceneId));
  useGame.setState({ partyPos: { ...ABORD_NORD } });
  useGame.getState().interactEntity(PROP);
}

describe('composition du groupe — le corps qui sort quitte sa place', () => {
  it('party[0] REMPLACÉ : l’ancien meneur ne garde pas sa chaise', () => {
    meneurAssis([hero('h'), hero('b')]);
    expect(poseDe(1)).not.toBeNull();
    useGame.getState().partyReplaceHero('h', hero('neuf'));
    expect(poseDe(1)).toBeNull(); // l'emplacement 1 est vide : ni l'ancien ni le remplaçant ne l'occupe
    expect(useGame.getState().scene!.seatAssignments).toEqual({});
  });

  it('un remplacement À MÊME ID (édition en place) ne fait PAS lever le meneur', () => {
    meneurAssis([hero('h')]);
    useGame.getState().partyReplaceHero('h', { ...hero('h'), label: 'Retouché' } as Combatant);
    expect(poseDe(1)).toMatchObject({ slotId: 'place-1' });
  });

  it('héros RETIRÉ du groupe : sa place est rendue', () => {
    meneurAssis([hero('h'), hero('b')]);
    useGame.getState().partyRemoveHero('h');
    expect(poseDe(1)).toBeNull();
    expect(useGame.getState().scene!.seatAssignments).toEqual({});
  });

  it('retirer un AUTRE héros ne touche pas la place du meneur, ni la référence de scène', () => {
    meneurAssis([hero('h'), hero('b')]);
    const avant = useGame.getState().scene!;
    useGame.getState().partyRemoveHero('b');
    expect(poseDe(1)).toMatchObject({ slotId: 'place-1' });
    expect(useGame.getState().scene).toBe(avant); // aucune écriture inutile
  });
});

describe('transition de scène — une scène quittée ne garde pas un héros absent', () => {
  it('le groupe entier est levé AVANT la capture de mutation : le revisit ne rassoit personne', () => {
    const a = scèneDeTaverne('scene-a');
    const b = emptyScene(8, 8);
    b.id = 'scene-b';
    b.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    useGame.setState({ party: [hero('h')], battle: null, journal: [] });
    useGame.getState().loadProject([a, b], 'scene-a', undefined);
    useGame.setState({ partyPos: { ...ABORD_NORD } });
    useGame.getState().interactEntity(PROP);
    expect(poseDe(1)).not.toBeNull();

    useGame.getState().transitionTo('scene-b');
    expect(useGame.getState().scene!.id).toBe('scene-b');
    // Retour : la scène quittée a été capturée SANS le meneur assis.
    useGame.getState().transitionTo('scene-a');
    expect(poseDe(1)).toBeNull();
    expect(useGame.getState().scene!.seatAssignments).toEqual({});
  });
});

/**
 * MORT / INDISPONIBILITÉ — un corps mis hors d'action ne tient plus sa chaise. La couture est UNIQUE
 * (`combatFlow.releaseSeatsOfDowned`) et branchée aux deux endroits où la mise hors de combat est
 * ACTÉE : `notifySlain` (tous les chemins de mort d'un combattant) et l'entretien hors combat de
 * `advanceTime` (agonie, Hémorragie, Poison, Flammes).
 */
describe('mort / indisponibilité d’un occupant', () => {
  it('la couture rend la place d’un héros MORT et celle d’un héros HORS D’ACTION', () => {
    for (const tuer of [
      (h: Combatant) => ({ ...h, dead: true }),
      (h: Combatant) => ({ ...h, conditions: [{ id: 'inconscient', value: 1 }] }) as Combatant,
    ]) {
      meneurAssis([hero('h')]);
      expect(poseDe(1)).not.toBeNull();
      useGame.setState((s) => ({ party: s.party.map((x) => (x.id === 'h' ? tuer(x) : x)) }));
      releaseSeatsOfDowned(useGame.getState, useGame.setState);
      expect(poseDe(1)).toBeNull();
      expect(useGame.getState().scene!.seatAssignments).toEqual({});
    }
  });

  it('un héros VIVANT et debout garde sa place, et la scène n’est pas réécrite', () => {
    meneurAssis([hero('h')]);
    const avant = useGame.getState().scene!;
    releaseSeatsOfDowned(useGame.getState, useGame.setState);
    expect(poseDe(1)).toMatchObject({ slotId: 'place-1' });
    expect(useGame.getState().scene).toBe(avant);
  });

  it('l’AGONIE hors combat (advanceTime) déclenche la libération', () => {
    meneurAssis([hero('h')]);
    useGame.setState((s) => ({ party: s.party.map((x) => ({ ...x, dead: true })), battle: null }));
    useGame.getState().advanceTime(TIME_COST.combatRound);
    expect(poseDe(1)).toBeNull();
  });

  it('un PNJ attablé mis hors de combat libère sa place par `notifySlain`', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [h], battle: null, journal: [] });
    useGame.getState().startScene(testScene);
    const sc = useGame.getState().scene!;
    const badaud: SceneEntity = { id: 'badaud', kind: 'personnage', ref: 'humain', pos: { x: 5, y: 4 } };
    const entities: SceneEntity[] = [...sc.entities, { id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, ref: TABLE, facing: 'N', usable: { assise: true } }, badaud];
    const occupant: SeatOccupant = { kind: 'entity', entityId: 'badaud' };
    useGame.setState({ scene: { ...sc, entities, seatAssignments: { [PROP]: { 'place-1': occupant } } } });
    expect(seatPoseOf(useGame.getState().scene!, occupant)).not.toBeNull();

    // Le badaud est enrôlé au combat en cours et tombe : `notifySlain` acte la mise hors de combat.
    const mort = { id: 'badaud', label: 'Badaud', kind: 'enemy', wounds: { current: 0, max: 8 }, conditions: [], dead: true } as unknown as Combatant;
    useGame.setState({ battle: { combatants: [mort], log: [], order: ['badaud'], turn: 0, round: 1 } as never });
    notifySlain(useGame.getState, useGame.setState, mort);
    expect(seatPoseOf(useGame.getState().scene!, occupant)).toBeNull();
  });
});

describe('ouverture de combat — le MENEUR assis se lève avec les autres enrôlés', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('sa place est libérée dans l’écriture de pose du combat', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [h], battle: null });
    useGame.getState().startScene(testScene);
    const sc = useGame.getState().scene!;
    // Table au NORD du groupe, cap `N` : son abord SUD est exactement la case du groupe.
    const table = { x: useGame.getState().partyPos.x, y: useGame.getState().partyPos.y - 1 };
    const entities: SceneEntity[] = [...sc.entities, { id: PROP, kind: 'prop', pos: table, ref: TABLE, facing: 'N', usable: { assise: true } }];
    useGame.setState({ scene: { ...sc, entities } });
    useGame.getState().interactEntity(PROP);
    expect(poseDe(1)).toMatchObject({ slotId: 'place-3' });

    useGame.getState().startCombat('enc-mutants');
    expect(poseDe(1)).toBeNull();
  });
});
