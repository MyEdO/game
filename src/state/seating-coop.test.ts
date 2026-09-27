/**
 * ASSISE EN COOP — le geste passe par la route EXISTANTE `interactEntity` (décision de groupe, hôte/MJ) :
 * aucun intent `sit`/`seat` n'est créé. Ce que ces tests tiennent : les DEUX barrières de la défense en
 * profondeur (allowlist d'intents puis route de possession), l'unicité de l'occupant sur la dernière
 * place, et la parité hôte → invité par le snapshot.
 */
import { describe, it, expect } from 'vitest';
import { useGame, type GameState } from './store';
import { emptyScene, type Scene } from './scene';
import { assignSeat, seatPoseOf, type SeatOccupant } from './seating';
import { intentAllowedFor, ROUTES } from './netOwnership';
import { GUEST_INTENTS } from '../net/intents';
import { netSnapshot, applyNetSnapshot } from './netFlow';
import type { Combatant } from '../engine/types';

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
const ABORD_NORD = { x: 5, y: 4 };
const MJ = 0;
const INVITE = 1;

const hero = (id: string): Combatant =>
  ({ id, label: id.toUpperCase(), kind: 'hero', xp: 0, wounds: { current: 12, max: 12 }, conditions: [], movement: 4 }) as unknown as Combatant;

const pris = (id: string): SeatOccupant => ({ kind: 'entity', entityId: id });
const occupants = (sc: Scene) => Object.values(sc.seatAssignments ?? {}).flatMap((m) => Object.values(m));

/** Table à 4 places dont TROIS sont déjà tenues : « nord » est la DERNIÈRE, sous les pieds du groupe. */
function derniereePlaceLibre(): void {
  const s = emptyScene(12, 12);
  s.id = 'taverne-coop';
  s.entities = [
    { id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, ref: TABLE, facing: 'N', usable: { assise: true } },
    { id: 'pnj-1', kind: 'personnage', ref: 'humain', pos: { x: 6, y: 5 } },
    { id: 'pnj-2', kind: 'personnage', ref: 'humain', pos: { x: 5, y: 6 } },
    { id: 'pnj-3', kind: 'personnage', ref: 'humain', pos: { x: 4, y: 5 } },
  ];
  s.seatAssignments = { [PROP]: { 'place-2': pris('pnj-1'), 'place-3': pris('pnj-2'), 'place-4': pris('pnj-3') } };
  useGame.setState({ party: [hero('h1'), hero('h2')], battle: null, journal: [], dialogue: null, mode: 'exploration' });
  useGame.getState().startScene(s);
  useGame.setState({
    partyPos: { ...ABORD_NORD },
    net: { ...useGame.getState().net, mode: 'host', mySeat: MJ, gmSeat: MJ, ownership: { h1: MJ, h2: INVITE } },
  });
}

describe('route coop de l’assise — aucun intent dédié, deux barrières indépendantes', () => {
  it('aucune route ni intent « sit »/« seat » n’existe : le geste reste `interactEntity`', () => {
    for (const nom of ['sit', 'seat', 'sitAt', 'seatAt', 'standPartyFromSeat']) {
      expect(ROUTES.has(nom), `route « ${nom} »`).toBe(false);
      expect(GUEST_INTENTS.has(nom), `intent invité « ${nom} »`).toBe(false);
    }
    expect(ROUTES.has('interactEntity')).toBe(true);
  });

  it('barrière 1 — `interactEntity` n’est pas dans l’allowlist d’invité : l’intent ne part jamais', () => {
    expect(GUEST_INTENTS.has('interactEntity')).toBe(false);
  });

  it('barrière 2 — la route refuse par elle-même tout siège autre que le MJ/hôte', () => {
    derniereePlaceLibre();
    const s = useGame.getState() as GameState;
    expect(intentAllowedFor(s, MJ, 'interactEntity', [PROP])).toBe(true);
    expect(intentAllowedFor(s, INVITE, 'interactEntity', [PROP])).toBe(false);
  });
});

describe('un seul gagnant sur la DERNIÈRE place', () => {
  it('la transaction s’écrit sur l’état COURANT : rejouée sur une scène périmée, elle ne double pas l’occupation', () => {
    derniereePlaceLibre();
    const perimee = useGame.getState().scene!;
    useGame.getState().interactEntity(PROP);
    expect(seatPoseOf(useGame.getState().scene!, { kind: 'party', rang: 1 })).toMatchObject({ slotId: 'place-1' });

    useGame.setState({ scene: perimee }); // snapshot périmé remis en place (rattrapage réseau)
    useGame.getState().interactEntity(PROP);
    const sc = useGame.getState().scene!;
    expect(occupants(sc)).toHaveLength(4);                       // 3 PNJ + UN seul corps de groupe
    expect(occupants(sc).filter((o) => o.kind === 'party')).toHaveLength(1);
    expect(sc.seatAssignments![PROP]['place-1']).toEqual({ kind: 'party', rang: 1 });
  });

  it('un second EMPLACEMENT ne peut pas s’y glisser : la place est prise', () => {
    derniereePlaceLibre();
    useGame.getState().interactEntity(PROP);
    // La place tenue l'est par un EMPLACEMENT (rang 1). Un autre emplacement du même groupe qui
    // tenterait la même place est refusé par la transaction elle-même, sur l'état COURANT.
    const sc = useGame.getState().scene!;
    expect(assignSeat(sc, PROP, 'place-1', { kind: 'party', rang: 2 }, useGame.getState().party.length))
      .toMatchObject({ ok: false, reason: 'slot-occupe' });
    expect(occupants(sc)).toHaveLength(4);
  });

  it('permuter l’ordre du groupe LÈVE la chaise : elle ne se transmet pas au corps qui prend le rang', () => {
    derniereePlaceLibre();
    useGame.getState().interactEntity(PROP);
    // Le siège invité pilote h2 ; le porter en tête change le corps présent au rang 1. La place se
    // lève — elle ne passe pas de main en main, et aucune seconde occupation de groupe n'apparaît.
    useGame.setState((s) => ({ party: [s.party[1], s.party[0]] }));
    const sc = useGame.getState().scene!;
    expect(occupants(sc).filter((o) => o.kind === 'party')).toEqual([]);
    expect(occupants(sc)).toHaveLength(3); // les trois PNJ authorés gardent la leur
    // …et la place ainsi rendue est de nouveau prenable par le geste du meneur.
    useGame.getState().interactEntity(PROP);
    expect(seatPoseOf(useGame.getState().scene!, { kind: 'party', rang: 1 })).toMatchObject({ slotId: 'place-1' });
  });
});

describe('parité hôte → invité', () => {
  it('le snapshot de l’hôte porte l’assise, et l’invité qui l’applique voit la MÊME place unique', () => {
    derniereePlaceLibre();
    useGame.getState().interactEntity(PROP);
    const snap = netSnapshot(useGame.getState);

    // L'invité part d'un état DIVERGENT (personne d'assis) puis reçoit le snapshot.
    useGame.setState((s) => ({ scene: { ...s.scene!, seatAssignments: {} } }));
    expect(seatPoseOf(useGame.getState().scene!, { kind: 'party', rang: 1 })).toBeNull();

    applyNetSnapshot(useGame.setState, snap);
    const sc = useGame.getState().scene!;
    expect(seatPoseOf(sc, { kind: 'party', rang: 1 })).toMatchObject({ propId: PROP, slotId: 'place-1' });
    expect(occupants(sc)).toHaveLength(4);
  });
});
