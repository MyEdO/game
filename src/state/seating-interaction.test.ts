/**
 * INTERACTION D'ASSISE, côté web : le halo du meuble à places ET fouillable (`interactionHalos`) n'annonce aucune
 * affordance morte. La bascule s'asseoir / se relever se joue au banc du noyau
 * (`src/noyau/seating-interaction.hors-store.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import { emptyScene, type Scene } from '../noyau/monde/scene';
import { seatPoseOf, type SeatOccupant } from '../noyau/monde/seating';
import { flowFromEffects } from '../noyau/monde/flow';
import { interactionHalos } from '../gameIso/builders/interactHalos';
import type { BillboardPropEl } from '../gameIso/builders/types';
import type { Combatant } from '../engine/types';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
/** Table en (5,5) au cap N : abord nord déclaré (5,4). */
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

const poseDuMeneur = () => seatPoseOf(useGame.getState().scene!, MENEUR);

describe('meuble à places ET fouillable — les deux affordances restent atteignables', () => {
  const FOUILLE = { actions: [{ id: 'fouiller', flow: flowFromEffects([{ type: 'giveMoney', montant: { gold: 2 } }]), unique: true }] };

  function posrFouillable(pos: { x: number; y: number }, seatAssignments?: Scene['seatAssignments']) {
    useGame.setState({ party: [hero()], scene: null, mode: 'exploration', journal: [], battle: null, dialogue: null, flags: {} });
    const sc = scèneDeTaverne();
    const table = sc.entities.find((e) => e.id === PROP)!;
    (table as { usable?: unknown }).usable = { assise: true, ...FOUILLE };
    if (seatAssignments) sc.seatAssignments = seatAssignments;
    useGame.getState().lancerLaScene(sc);
    useGame.setState({ partyPos: { ...pos }, flags: {} });
  }

  it('AUCUNE affordance morte : le halo n’est allumé que si un geste reste possible', () => {
    // Halo ALLUMÉ = fouille non épuisée OU place libre — exactement ce que le store sert.
    posrFouillable(ABORD_NORD);
    const el: BillboardPropEl = { kind: 'prop', key: `prop:${PROP}`, cell: { x: 5, y: 5, z: 0 }, source: 'entity', entId: PROP,
      span: { w: 1, h: 1 }, ref: TABLE, foot: { offX: 0, offY: 0, scale: 1 }, states: { visible: true } };
    // RÉGIME de révélation (#1687) : Alt tenu, donc ce qui APPELLE est allumé — ce que le halo dit ici,
    // c'est l'appartenance à la liste des utilisables, pas la variante peinte.
    const sc = () => useGame.getState().scene!;
    const halos = () => interactionHalos([], [el], sc(), useGame.getState().flags, { survol: null, reveler: true });
    expect(halos()).toHaveLength(1);

    useGame.getState().interagirAvecLEntite(PROP); // fouille consommée
    useGame.getState().interagirAvecLEntite(PROP); // place prise
    expect(poseDuMeneur()).not.toBeNull();
    // Il reste 3 places : le halo appelle encore, et le clic sert encore (se relever).
    expect(halos()).toHaveLength(1);
    useGame.getState().interagirAvecLEntite(PROP);
    expect(poseDuMeneur(), 'le clic du meuble occupé relève TOUJOURS, quoi que porte le meuble').toBeNull();
  });
});
