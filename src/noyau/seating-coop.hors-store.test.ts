/**
 * ASSISE EN COOP — le geste est le clic de la case (`cliquerLaCase`, décision de groupe, hôte/MJ) ; `interagirAvecLEntite`
 * est sa machinerie (`MachinerieDuNoyau`, #3370) :
 * aucun intent `sit`/`seat` n'est créé. Ce que ces tests tiennent : le clic voyage (`GUEST_INTENTS`, combat compris,
 * #3371) et sa route de possession le refuse à tout siège autre que celui du monde, l'unicité de l'occupant sur la
 * dernière place, et la parité hôte → invité par le snapshot.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emptyScene, type Scene } from './monde/scene';
import { assignSeat, seatPoseOf, type SeatOccupant } from './monde/seating';
import { intentAllowedFor, ROUTES } from './netOwnership';
import { GUEST_INTENTS } from './intentionsDeSiege';
import { appliquerLInstantane, instantaneDeLaCoop } from './coop';
import type { Combatant } from '../engine/types';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
const ABORD_NORD = { x: 5, y: 4 };
const MJ = 0;
const INVITE = 1;

const hero = (id: string): Combatant =>
  combattantDeTest({ id, label: id.toUpperCase(), kind: 'heros', xp: 0, wounds: blessuresDeBase(12), conditions: [], movement: 4 });

const pris = (id: string): SeatOccupant => ({ kind: 'entite', entityId: id });
const occupants = (sc: Scene) => Object.values(sc.seatAssignments ?? {}).flatMap((m) => Object.values(m));

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Table à 4 places dont TROIS sont déjà tenues : « nord » est la DERNIÈRE, sous les pieds du groupe. */
function derniereePlaceLibre(): void {
  const s = emptyScene('scene-test', 12, 12);
  s.id = 'taverne-coop';
  s.entities = [
    { id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, decor: { id: TABLE }, facing: 'N', usable: { assise: true } },
    { id: 'pnj-1', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 6, y: 5 } },
    { id: 'pnj-2', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 5, y: 6 } },
    { id: 'pnj-3', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 4, y: 5 } },
  ];
  s.seatAssignments = { [PROP]: { 'place-2': pris('pnj-1'), 'place-3': pris('pnj-2'), 'place-4': pris('pnj-3') } };
  banc.setState({ party: [hero('h1'), hero('h2')], battle: null, journal: [], dialogue: null, mode: 'exploration' });
  banc.getState().lancerLaScene(s);
  banc.setState({
    partyPos: { ...ABORD_NORD },
    net: { ...banc.getState().net, mode: 'hote', mySeat: MJ, gmSeat: MJ, ownership: { h1: MJ, h2: INVITE } },
  });
}

describe('route coop de l’assise — aucun intent dédié, la route du clic tranche', () => {
  it('aucune route ni intent « sit »/« seat » n’existe : le geste reste `cliquerLaCase`', () => {
    for (const nom of ['sit', 'seat', 'sitAt', 'seatAt', 'standPartyFromSeat']) {
      expect(ROUTES.has(nom), `route « ${nom} »`).toBe(false);
      expect(GUEST_INTENTS.has(nom), `intent invité « ${nom} »`).toBe(false);
    }
    expect(ROUTES.has('cliquerLaCase')).toBe(true);
    expect(ROUTES.has('interagirAvecLEntite'), 'la machinerie n’a pas de route').toBe(false);
  });

  it('le clic de la case voyage, sa machinerie jamais', () => {
    expect(GUEST_INTENTS.has('cliquerLaCase')).toBe(true);
    expect(GUEST_INTENTS.has('interagirAvecLEntite')).toBe(false);
  });

  it('la route refuse hors combat tout siège autre que celui du monde', () => {
    derniereePlaceLibre();
    const s = banc.getState();
    expect(intentAllowedFor(s, MJ, 'cliquerLaCase', [{ x: 5, y: 5 }, PROP])).toBe(true);
    expect(intentAllowedFor(s, INVITE, 'cliquerLaCase', [{ x: 5, y: 5 }, PROP])).toBe(false);
  });

  it('le siège du monde est celui du MJ (`gmSeat`), même hors de l’hôte : la route le lit, sans retomber au repli', () => {
    derniereePlaceLibre();
    banc.setState((s) => ({ net: { ...s.net, gmSeat: INVITE } }));
    const s = banc.getState();
    expect(intentAllowedFor(s, INVITE, 'cliquerLaCase', [{ x: 5, y: 5 }, PROP])).toBe(true);
    expect(intentAllowedFor(s, MJ, 'cliquerLaCase', [{ x: 5, y: 5 }, PROP])).toBe(false);
  });
});

describe('un seul gagnant sur la DERNIÈRE place', () => {
  it('la transaction s’écrit sur l’état COURANT : rejouée sur une scène périmée, elle ne double pas l’occupation', () => {
    derniereePlaceLibre();
    const perimee = banc.getState().scene!;
    banc.getState().interagirAvecLEntite(PROP);
    expect(seatPoseOf(banc.getState().scene!, { kind: 'groupe', rang: 1 })).toMatchObject({ slotId: 'place-1' });

    banc.setState({ scene: perimee }); // snapshot périmé remis en place (rattrapage réseau)
    banc.getState().interagirAvecLEntite(PROP);
    const sc = banc.getState().scene!;
    expect(occupants(sc)).toHaveLength(4);                       // 3 PNJ + UN seul corps de groupe
    expect(occupants(sc).filter((o) => o.kind === 'groupe')).toHaveLength(1);
    expect(sc.seatAssignments![PROP]['place-1']).toEqual({ kind: 'groupe', rang: 1 });
  });

  it('un second EMPLACEMENT ne peut pas s’y glisser : la place est prise', () => {
    derniereePlaceLibre();
    banc.getState().interagirAvecLEntite(PROP);
    // La place tenue l'est par un EMPLACEMENT (rang 1). Un autre emplacement du même groupe qui
    // tenterait la même place est refusé par la transaction elle-même, sur l'état COURANT.
    const sc = banc.getState().scene!;
    expect(assignSeat(sc, PROP, 'place-1', { kind: 'groupe', rang: 2 }, banc.getState().party.length))
      .toMatchObject({ ok: false, reason: 'slot-occupe' });
    expect(occupants(sc)).toHaveLength(4);
  });

  it('permuter l’ordre du groupe LÈVE la chaise : elle ne se transmet pas au corps qui prend le rang', () => {
    derniereePlaceLibre();
    banc.getState().interagirAvecLEntite(PROP);
    // Le siège invité pilote h2 ; le porter en tête change le corps présent au rang 1. La place se
    // lève — elle ne passe pas de main en main, et aucune seconde occupation de groupe n'apparaît.
    banc.setState((s) => ({ party: [s.party[1], s.party[0]] }));
    const sc = banc.getState().scene!;
    expect(occupants(sc).filter((o) => o.kind === 'groupe')).toEqual([]);
    expect(occupants(sc)).toHaveLength(3); // les trois PNJ authorés gardent la leur
    // …et la place ainsi rendue est de nouveau prenable par le geste du meneur.
    banc.getState().interagirAvecLEntite(PROP);
    expect(seatPoseOf(banc.getState().scene!, { kind: 'groupe', rang: 1 })).toMatchObject({ slotId: 'place-1' });
  });
});

describe('parité hôte → invité', () => {
  it('le snapshot de l’hôte porte l’assise, et l’invité qui l’applique voit la MÊME place unique', () => {
    derniereePlaceLibre();
    banc.getState().interagirAvecLEntite(PROP);
    const snap = instantaneDeLaCoop(banc.getState());

    // L'invité part d'un état DIVERGENT (personne d'assis) puis reçoit le snapshot.
    banc.setState((s) => ({ scene: { ...s.scene!, seatAssignments: {} } }));
    expect(seatPoseOf(banc.getState().scene!, { kind: 'groupe', rang: 1 })).toBeNull();

    banc.setState(appliquerLInstantane(snap, banc.getState()).etat);
    const sc = banc.getState().scene!;
    expect(seatPoseOf(sc, { kind: 'groupe', rang: 1 })).toMatchObject({ propId: PROP, slotId: 'place-1' });
    expect(occupants(sc)).toHaveLength(4);
  });
});
