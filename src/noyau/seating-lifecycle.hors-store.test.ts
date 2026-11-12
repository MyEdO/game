/**
 * CYCLE DE VIE DE L'ASSISE DU GROUPE — un héros du groupe (`kind:'party'`) ne reste jamais assis là
 * où son corps n'est plus : changement de meneur, retrait du groupe, transition de scène, ouverture
 * de combat. Le pendant `kind:'entity'` (PNJ authoré) vit dans `combat-entity-reconcile.hors-store.test.ts` ; le
 * volet persistance (save/reload, élagage au chargement) dans `seating-persistence`/`sceneInstance`.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emptyScene, type Scene, type SceneEntity } from './monde/scene';
import { seatPoseOf, type SeatOccupant } from './monde/seating';
import { notifySlain, releaseSeatsOfDowned } from './combatFlow';
import { TIME_COST } from '../engine/timeCost';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { engage } from './creation/engagement.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
const ABORD_NORD = { x: 5, y: 4 };

const hero = (id: string): Combatant =>
  combattantDeTest({ id, label: id.toUpperCase(), kind: 'heros', xp: 0, wounds: blessuresDeBase(12), conditions: [], movement: 4 });

const place = (rang: number): SeatOccupant => ({ kind: 'groupe', rang });
const poseDe = (rang: number) => seatPoseOf(banc.getState().scene!, place(rang));

function scèneDeTaverne(id: string): Scene {
  const s = emptyScene('scene-test', 12, 12);
  s.id = id;
  s.entities.push({ id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, decor: { id: TABLE }, facing: 'N', usable: { assise: true } });
  return s;
}

/** Assoit `party[0]` à la place « nord » par le geste RÉEL (`interagirAvecLEntite`), jamais à la main. */
function meneurAssis(party: Combatant[], sceneId = 'taverne'): void {
  banc.setState({ party, scene: null, mode: 'exploration', journal: [], battle: null, dialogue: null });
  banc.getState().lancerLaScene(scèneDeTaverne(sceneId));
  banc.setState({ partyPos: { ...ABORD_NORD } });
  banc.getState().interagirAvecLEntite(PROP);
}

describe('composition du groupe — le corps qui sort quitte sa place', () => {
  it('party[0] REMPLACÉ : l’ancien meneur ne garde pas sa chaise', () => {
    meneurAssis([hero('h'), hero('b')]);
    expect(poseDe(1)).not.toBeNull();
    banc.getState().remplacerLeHeros('h', engage('neuf'));
    expect(poseDe(1)).toBeNull(); // l'emplacement 1 est vide : ni l'ancien ni le remplaçant ne l'occupe
    expect(banc.getState().scene!.seatAssignments).toEqual({});
  });

  it('un remplacement À MÊME ID (édition en place) ne fait PAS lever le meneur', () => {
    meneurAssis([hero('h')]);
    banc.getState().remplacerLeHeros('h', engage('h', 'Retouché'));
    expect(poseDe(1)).toMatchObject({ slotId: 'place-1' });
  });

  it('héros RETIRÉ du groupe : sa place est rendue', () => {
    meneurAssis([hero('h'), hero('b')]);
    banc.getState().renvoyerLeHeros('h');
    expect(poseDe(1)).toBeNull();
    expect(banc.getState().scene!.seatAssignments).toEqual({});
  });

  it('retirer un AUTRE héros ne touche pas la place du meneur, ni la référence de scène', () => {
    meneurAssis([hero('h'), hero('b')]);
    const avant = banc.getState().scene!;
    banc.getState().renvoyerLeHeros('b');
    expect(poseDe(1)).toMatchObject({ slotId: 'place-1' });
    expect(banc.getState().scene).toBe(avant); // aucune écriture inutile
  });
});

describe('transition de scène — une scène quittée ne garde pas un héros absent', () => {
  it('le groupe entier est levé AVANT la capture de mutation : le revisit ne rassoit personne', () => {
    const a = scèneDeTaverne('scene-a');
    const b = emptyScene('scene-test', 8, 8);
    b.id = 'scene-b';
    b.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    banc.setState({ party: [hero('h')], battle: null, journal: [] });
    banc.getState().chargerLeProjet({ scenes: [a, b], entryId: 'scene-a', projet: null });
    banc.setState({ partyPos: { ...ABORD_NORD } });
    banc.getState().interagirAvecLEntite(PROP);
    expect(poseDe(1)).not.toBeNull();

    banc.getState().quitterLaScene('scene-b');
    expect(banc.getState().scene!.id).toBe('scene-b');
    // Retour : la scène quittée a été capturée SANS le meneur assis.
    banc.getState().quitterLaScene('scene-a');
    expect(poseDe(1)).toBeNull();
    expect(banc.getState().scene!.seatAssignments).toEqual({});
  });
});

/**
 * MORT / INDISPONIBILITÉ — un corps mis hors d'action ne tient plus sa chaise. La couture est UNIQUE
 * (`combatFlow.releaseSeatsOfDowned`) et branchée aux deux endroits où la mise hors de combat est
 * ACTÉE : `notifySlain` (tous les chemins de mort d'un combattant) et l'entretien hors combat de
 * `avancerLeTemps` (agonie, Hémorragie, Poison, Flammes).
 */
describe('mort / indisponibilité d’un occupant', () => {
  it('la couture rend la place d’un héros MORT et celle d’un héros HORS D’ACTION', () => {
    for (const tuer of [
      (h: Combatant) => ({ ...h, dead: true }),
      (h: Combatant) => ({ ...h, conditions: [{ id: 'inconscient', value: 1 }] }) as Combatant,
    ]) {
      meneurAssis([hero('h')]);
      expect(poseDe(1)).not.toBeNull();
      banc.setState((s) => ({ party: s.party.map((x) => (x.id === 'h' ? tuer(x) : x)) }));
      releaseSeatsOfDowned(banc.getState, banc.setState);
      expect(poseDe(1)).toBeNull();
      expect(banc.getState().scene!.seatAssignments).toEqual({});
    }
  });

  it('un héros VIVANT et debout garde sa place, et la scène n’est pas réécrite', () => {
    meneurAssis([hero('h')]);
    const avant = banc.getState().scene!;
    releaseSeatsOfDowned(banc.getState, banc.setState);
    expect(poseDe(1)).toMatchObject({ slotId: 'place-1' });
    expect(banc.getState().scene).toBe(avant);
  });

  it('l’AGONIE hors combat (avancerLeTemps) déclenche la libération', () => {
    meneurAssis([hero('h')]);
    banc.setState((s) => ({ party: s.party.map((x) => ({ ...x, dead: true })), battle: null }));
    banc.getState().avancerLeTemps(TIME_COST.combatRound);
    expect(poseDe(1)).toBeNull();
  });

  it('un PNJ attablé mis hors de combat libère sa place par `notifySlain`', () => {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [h], battle: null, journal: [] });
    banc.getState().lancerLaScene(testScene());
    const sc = banc.getState().scene!;
    const badaud: SceneEntity = { id: 'badaud', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 5, y: 4 } };
    const entities: SceneEntity[] = [...sc.entities, { id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, decor: { id: TABLE }, facing: 'N', usable: { assise: true } }, badaud];
    const occupant: SeatOccupant = { kind: 'entite', entityId: 'badaud' };
    banc.setState({ scene: { ...sc, entities, seatAssignments: { [PROP]: { 'place-1': occupant } } } });
    expect(seatPoseOf(banc.getState().scene!, occupant)).not.toBeNull();

    // Le badaud est enrôlé au combat en cours et tombe : `notifySlain` acte la mise hors de combat.
    const mort = combattantDeTest({ id: 'badaud', label: 'Badaud', kind: 'ennemi', wounds: blessuresDeBase(8, 0), conditions: [], dead: true });
    banc.setState({ battle: { combatants: [mort], log: [], order: ['badaud'], turn: 0, round: 1 } as never });
    notifySlain(banc.getState, banc.setState, mort);
    expect(seatPoseOf(banc.getState().scene!, occupant)).toBeNull();
  });
});

describe('ouverture de combat — le MENEUR assis se lève avec les autres enrôlés', () => {
  it('sa place est libérée dans l’écriture de pose du combat', () => {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [h], battle: null });
    banc.getState().lancerLaScene(testScene());
    const sc = banc.getState().scene!;
    // Table au NORD du groupe, cap `N` : son abord SUD est exactement la case du groupe.
    const table = { x: banc.getState().partyPos.x, y: banc.getState().partyPos.y - 1 };
    const entities: SceneEntity[] = [...sc.entities, { id: PROP, kind: 'prop', pos: table, decor: { id: TABLE }, facing: 'N', usable: { assise: true } }];
    banc.setState({ scene: { ...sc, entities } });
    banc.getState().interagirAvecLEntite(PROP);
    expect(poseDe(1)).toMatchObject({ slotId: 'place-3' });

    banc.getState().lancerLeCombat('enc-mutants');
    expect(poseDe(1)).toBeNull();
  });
});
