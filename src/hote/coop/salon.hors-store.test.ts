/**
 * LE SALON COOP (#3556) sur ports factices (`relay.testkit.ts`) et le banc du noyau : création et échec de la room,
 * format du code et délai de connexion, reprise par jeton, grâce et présence, diffusion lissée sous backpressure,
 * départ en intention d'une action d'invité (et élection locale), attribution des sièges au lobby.
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUFFER_MAX,
  GRACE_MS,
  cleDuJeton,
  creerLeSalon,
  emettreIntentInvite,
  netAssign,
  netAssignSlot,
  setGmSeat,
  type PortsDuSalon,
  type ReponseDuRelais,
  type Salon,
} from './salon';
import { FakeSocket, portsDuTest } from './relay.testkit';
import { PROTOCOL_VERSION, serializeMessage } from './protocol';
import { ouvrirLeBanc, type Banc } from '../../noyau/banc.testkit';
import { buildDeLaCoop } from '../../noyau/coop';
import { initialNet, type NetState } from '../../noyau/etat';
import { tableDeDissipation } from '../../noyau/tableDeDissipation.testkit';
import { applyEffects } from '../../noyau/combatEffects';
import { affichés, narratif, hero as heroDesIndices, fixtureScene } from '../../noyau/monde/clues.fixture';
import { tousLesHerosDeScenario } from '../../scenes/test-scenarios/_heros';
import { spawnEnemy } from '../../noyau/monde/spawn';
import { t } from '../../i18n';

const BASE = 'http://localhost:8787';

/** Les ports factices d'un salon, et ce qu'ils ont vu. */
function ports(banc: Banc, fetch: PortsDuSalon['fetch']) {
  const stocke = new Map<string, string>();
  const invite = { intercepter: vi.fn(), restaurer: vi.fn() };
  const p: PortsDuSalon = {
    ...portsDuTest(),
    relais: () => BASE,
    fetch,
    stockage: () => ({ getItem: (k) => stocke.get(k) ?? null, setItem: (k, v) => { stocke.set(k, v); } }),
    abonner: (ecouteur) => banc.subscribe(ecouteur),
    invite,
  };
  return { p, stocke, invite };
}

const roomOuverte = async (): Promise<ReponseDuRelais> => ({ ok: true, json: async () => ({ code: 'ABC234', hostToken: 'HT' }) });

/** Les instantanés que la socket hôte a envoyés au siège 1. */
const instantanesAuSiege1 = (ws: FakeSocket) => ws.sent.flatMap((raw) => {
  if (raw === 'ping') return [];
  const env = JSON.parse(raw) as { to?: number; data?: string; z?: string };
  const texte = env.data ?? env.z?.slice(2);
  return env.to === 1 && texte && (JSON.parse(texte) as { kind: string }).kind === 'snapshot' ? [texte] : [];
});

let banc: Banc;
let salon: Salon | null;
beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  banc = ouvrirLeBanc();
  salon = null;
});
afterEach(() => {
  salon?.quitter(banc.setState);
  vi.useRealTimers();
});

/** Un hôte dont la room est ouverte, le siège 1 assis et son handshake accompli. */
async function hoteAvecUnInvite() {
  const { p } = ports(banc, roomOuverte);
  salon = creerLeSalon(p);
  expect(await salon.heberger(banc.getState, banc.setState, 'Hôte')).toBe(true);
  const ws = FakeSocket.last!;
  ws.open();
  ws.receive(JSON.stringify({ evt: 'join', seat: 1, name: 'Anna' }));
  ws.receive(JSON.stringify({ from: 1, data: serializeMessage({ kind: 'hello', protocol: PROTOCOL_VERSION, build: buildDeLaCoop(), label: 'Anna' }) }));
  await vi.advanceTimersByTimeAsync(0);
  return ws;
}

describe('salon — l’hôte', () => {
  it('relay injoignable : héberger refuse, reste local, sans socket ni minuterie', async () => {
    const urls: string[] = [];
    salon = creerLeSalon(ports(banc, async (url) => { urls.push(url); throw new TypeError('Failed to fetch'); }).p);
    expect(await salon.heberger(banc.getState, banc.setState, 'Anne')).toBe(false);
    expect(urls).toEqual([`${BASE}/rooms`]);
    expect(banc.getState().net.mode).toBe('local');
    expect(FakeSocket.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('room créée : mode hôte, code de la room, socket hôte par jeton', async () => {
    salon = creerLeSalon(ports(banc, roomOuverte).p);
    expect(await salon.heberger(banc.getState, banc.setState, 'Hôte')).toBe(true);
    expect(banc.getState().net).toMatchObject({ mode: 'hote', roomCode: 'ABC234', seatNames: { 0: 'Hôte' } });
    const url = new URL(FakeSocket.last!.url);
    expect([url.origin, url.pathname, url.searchParams.get('token')]).toEqual(['ws://localhost:8787', '/room/ABC234', 'HT']);
  });

  it('coupure d’un invité : présence `away`, siège réservé GRACE_MS ; reprise avant la fin, rien ne ferme', async () => {
    const ws = await hoteAvecUnInvite();
    expect(banc.getState().net.presence[1]).toBe('present');
    ws.receive(JSON.stringify({ evt: 'gone', seat: 1 }));
    expect(banc.getState().net.presence[1]).toBe('absent');
    vi.advanceTimersByTime(GRACE_MS - 1);
    ws.receive(JSON.stringify({ evt: 'resume', seat: 1, name: 'Anna' }));
    expect(banc.getState().net.presence[1]).toBe('present');
    vi.advanceTimersByTime(GRACE_MS);
    expect(banc.getState().journal).not.toContain(t('coop.seatClosed'));
  });

  it('grâce écoulée : le siège ferme, ses héros reviennent à l’hôte', async () => {
    const ws = await hoteAvecUnInvite();
    banc.setState({ net: { ...banc.getState().net, ownership: { h: 1 } } });
    ws.receive(JSON.stringify({ evt: 'gone', seat: 1 }));
    vi.advanceTimersByTime(GRACE_MS);
    expect(banc.getState().journal).toContain(t('coop.seatClosed'));
    expect(banc.getState().net.ownership.h).toBe(0);
    expect(banc.getState().net.seatNames[1]).toBeUndefined();
  });

  it('diffusion : une rafale d’écritures = un instantané ; envoi saturé, il attend que le tampon se vide', async () => {
    const ws = await hoteAvecUnInvite();
    const auJoin = instantanesAuSiege1(ws).length;
    ws.bufferedAmount = BUFFER_MAX + 1;
    for (let i = 0; i < 3; i++) banc.setState({ clues: {} });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(instantanesAuSiege1(ws).length, 'parti malgré l’envoi saturé').toBe(auJoin);
    ws.bufferedAmount = 0;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(instantanesAuSiege1(ws).length - auJoin).toBe(1);
  });
});

describe('salon — l’invité', () => {
  it('un code hors format est refusé sans connexion', async () => {
    salon = creerLeSalon(ports(banc, roomOuverte).p);
    expect(await salon.rejoindre(banc.getState, banc.setState, () => {}, 'abc-23', 'Anne')).toBe(t('coop.badCode'));
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it('rejoindre expire après fermeture 1006 et retry, sans socket ni minuterie survivante', async () => {
    salon = creerLeSalon(ports(banc, roomOuverte).p);
    const joining = salon.rejoindre(banc.getState, banc.setState, () => {}, 'abc234', 'Anne & Bob');
    const first = FakeSocket.last!;
    const url = new URL(first.url);
    expect([url.origin, url.pathname, url.searchParams.get('name')]).toEqual(['ws://localhost:8787', '/room/ABC234', 'Anne & Bob']);
    first.dropFromServer();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeSocket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(14_000);
    expect(await joining).toBe(t('coop.joinFailed'));
    expect(banc.getState().net.mode).toBe('local');
    expect(FakeSocket.instances[1].closedWith).not.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('reprise : le jeton stocké de la room rejoint par token ; assis, le jeton reçu se stocke et l’enrobage se pose', async () => {
    const { p, stocke, invite } = ports(banc, roomOuverte);
    stocke.set(cleDuJeton('ABC234'), 'ANCIEN');
    salon = creerLeSalon(p);
    const joining = salon.rejoindre(banc.getState, banc.setState, () => {}, 'ABC234', 'Anna');
    const ws = FakeSocket.last!;
    expect(new URL(ws.url).searchParams.get('token')).toBe('ANCIEN');
    expect(new URL(ws.url).searchParams.get('name')).toBeNull();
    ws.open();
    ws.receive(JSON.stringify({ evt: 'seated', seat: 2, token: 'NEUF' }));
    expect(await joining).toBeNull();
    expect(stocke.get(cleDuJeton('ABC234'))).toBe('NEUF');
    expect(banc.getState().net).toMatchObject({ mode: 'invite', mySeat: 2, roomCode: 'ABC234' });
    expect(invite.intercepter).toHaveBeenCalledTimes(1);
    salon.quitter(banc.setState);
    expect(invite.restaurer).toHaveBeenCalled();
    expect(banc.getState().net).toEqual(initialNet());
  });
});

const caseDe = (id: string) => ({ ...banc.getState().battle!.combatants.find((c) => c.id === id)!.pos! });

describe('salon — l’action d’un invité part en intention, sauf l’élection locale', () => {
  it('Dissiper, porteur à 2 Sorts : l’élection se joue chez l’émetteur, rien ne part (LDB 46 l.158-162)', () => {
    banc.setState(tableDeDissipation('invite', { e1: 2 }));
    const envoyer = vi.fn();
    emettreIntentInvite(banc.getState, 'cliquerLaCase', banc.getState().cliquerLaCase as never, envoyer, [caseDe('e1'), 'e1']);
    expect(banc.getState().dispelCarrierId, 'l’élection n’a pas eu lieu chez l’ÉMETTEUR').toBe('e1');
    expect(envoyer, 'l’élection est partie chez l’hôte').not.toHaveBeenCalled();
    expect(banc.getState().pendingDispel).toBeNull();
  });

  it('Dissiper, porteur à 1 Sort : rien à élire, rien d’armé : le geste part tel quel', () => {
    banc.setState(tableDeDissipation('invite', { e1: 1 }));
    const envoyer = vi.fn();
    emettreIntentInvite(banc.getState, 'cliquerLaCase', banc.getState().cliquerLaCase as never, envoyer, [caseDe('e1'), 'e1']);
    expect(banc.getState().dispelCarrierId).toBeNull();
    expect(banc.getState().pendingDispel, 'le commit s’est joué EN LOCAL').toBeNull();
    expect(envoyer.mock.calls).toEqual([['cliquerLaCase', [caseDe('e1'), 'e1']]]);
  });

  it('carnet : `marquerLesIndices` part en intention et ne se joue pas localement (#2415)', () => {
    banc.setState({ party: [heroDesIndices()] });
    banc.getState().chargerLeProjet({ scenes: [fixtureScene('scene-o')], entryId: 'scene-o', narratif, projet: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    const envoyer = vi.fn();
    const vus = affichés(banc.getState().clues, ['ind-lettre']);
    emettreIntentInvite(banc.getState, 'marquerLesIndices', banc.getState().marquerLesIndices as never, envoyer, [vus]);
    expect(envoyer).toHaveBeenCalledWith('marquerLesIndices', [vus]);
    expect(banc.getState().clues['ind-lettre'].vuParSiège, 'le marquage s’est joué EN LOCAL').toBeUndefined();
  });

  it('clics du champ : la frappe d’un ennemi et le clic-sol partent, l’action locale ne joue pas', () => {
    const h = tousLesHerosDeScenario(idsDeTest)[0]; h.id = 'h1'; h.pos = { x: 6, y: 10 };
    const enemy = spawnEnemy({ ref: 'humain' }, 'e1', { x: 7, y: 10 });
    const w = 22, hh = 16;
    banc.setState({
      battle: { combatants: [h, enemy], order: ['h1', 'e1'], baseOrder: ['h1', 'e1'], turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as never,
      scene: { id: 's', dimensions: { w, h: hh }, layers: [{ z: 0, tiles: new Array(w * hh).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never,
      party: [h], mode: 'battle', net: { ...initialNet(), mode: 'invite', mySeat: 0, ownership: { h1: 0 } },
    });
    const local = vi.fn();
    const envoyer = vi.fn();
    emettreIntentInvite(banc.getState, 'cliquerLaCase', local, envoyer, [{ x: 7, y: 10 }, 'e1', { confirm: true }]);
    emettreIntentInvite(banc.getState, 'cliquerLaCase', local, envoyer, [{ x: 12, y: 4 }, undefined, { confirm: false }]);
    expect(envoyer.mock.calls.map(([action]) => action)).toEqual(['cliquerLaCase', 'cliquerLaCase']);
    expect(local, 'le geste s’est joué en local au lieu de partir à l’hôte').not.toHaveBeenCalled();
  });
});

describe('salon — le verbe de l’offre d’un invité : il part, l’attaque s’arme avant', () => {
  /** Le duel du héros `h1` de l'invité (siège 0 de la table) contre `e1`, à son tour. */
  function duel(): void {
    const h = tousLesHerosDeScenario(idsDeTest)[0]; h.id = 'h1'; h.pos = { x: 6, y: 10 };
    const enemy = spawnEnemy({ ref: 'humain' }, 'e1', { x: 7, y: 10 });
    const w = 22, hh = 16;
    banc.setState({
      battle: { combatants: [h, enemy], order: ['h1', 'e1'], baseOrder: ['h1', 'e1'], turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as never,
      scene: { id: 's', dimensions: { w, h: hh }, layers: [{ z: 0, tiles: new Array(w * hh).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never,
      party: [h], mode: 'battle', screen: 'campaign', net: { ...initialNet(), mode: 'invite', mySeat: 0, ownership: { h1: 0 } }, localIntent: null,
    });
  }

  it('un verbe de la barre (`terminerLeTour`) part tel quel et ne se joue pas chez l’émetteur', () => {
    duel();
    const local = vi.fn();
    const envoyer = vi.fn();
    emettreIntentInvite(banc.getState, 'terminerLeTour', local, envoyer, []);
    expect(envoyer.mock.calls).toEqual([['terminerLeTour', []]]);
    expect(local).not.toHaveBeenCalled();
    expect(banc.getState().localIntent).toBeNull();
  });

  it('`armerLAttaque`, joué chez l’hôte : son intention s’arme chez l’émetteur AVANT l’envoi', () => {
    duel();
    const local = vi.fn();
    const armeeALEnvoi: (string | null)[] = [];
    const envoyer = vi.fn(() => { armeeALEnvoi.push(banc.getState().localIntent?.actionId ?? null); });
    emettreIntentInvite(banc.getState, 'armerLAttaque', local, envoyer, ['arme']);
    expect(envoyer.mock.calls).toEqual([['armerLAttaque', ['arme']]]);
    expect(armeeALEnvoi, 'l’intention n’était pas armée quand l’offre est partie').toEqual(['attaque']);
    expect(local, 'le corps s’est joué chez l’émetteur').not.toHaveBeenCalled();
  });
});

describe('salon — lobby : une attribution refusée laisse `net` inchangé et dit son refus (#3059 F10)', () => {
  const hote = (): NetState => ({ ...initialNet(), mode: 'hote', roomCode: 'ABC234', seatNames: { 0: 'Hôte', 1: 'Anna' }, rangs: { h: 0 } });
  beforeEach(() => { banc.setState({ net: hote(), party: [{ ...tousLesHerosDeScenario(idsDeTest)[0], id: 'h' }], battle: null }); });

  it('netAssignSlot vers un emplacement occupé, puis hors de la table ; netAssign et setGmSeat hors de la table', () => {
    const avant = banc.getState().net;
    const journal = banc.getState().journal.length;
    netAssignSlot(banc.getState, banc.setState, 0, 1);
    netAssignSlot(banc.getState, banc.setState, 1, 7);
    netAssign(banc.getState, banc.setState, 'h', 7);
    netAssign(banc.getState, banc.setState, 'absent', 1);
    setGmSeat(banc.getState, banc.setState, 7);
    expect(banc.getState().net).toBe(avant);
    expect(banc.getState().journal.slice(journal)).toEqual([
      t('coop.assign.slotTaken'), t('coop.assign.seatUnknown'), t('coop.assign.seatUnknown'), t('coop.assign.heroAbsent'), t('coop.assign.seatUnknown'),
    ]);
  });

  it('les mêmes gestes vers un emplacement vide et un siège de la table s’appliquent', () => {
    netAssignSlot(banc.getState, banc.setState, 1, 1);
    netAssign(banc.getState, banc.setState, 'h', 1);
    setGmSeat(banc.getState, banc.setState, 1);
    expect(banc.getState().net).toMatchObject({ slots: [0, 1, 0, 0], ownership: { h: 1 }, gmSeat: 1 });
  });
});
