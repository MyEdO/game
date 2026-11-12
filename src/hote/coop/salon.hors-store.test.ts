/**
 * LE SALON COOP (#3556) sur ports factices (`relay.testkit.ts`) et le banc du noyau : création et échec de la room,
 * format du code et délai de connexion, reprise par jeton, grâce et présence, diffusion lissée sous backpressure,
 * enrobage des intentions de l'invité.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUFFER_MAX, GRACE_MS, cleDuJeton, creerLeSalon, type PortsDuSalon, type ReponseDuRelais, type Salon } from './salon';
import { FakeSocket, portsDuTest } from './relay.testkit';
import { PROTOCOL_VERSION, serializeMessage } from './protocol';
import { ouvrirLeBanc, type Banc } from '../../noyau/banc.testkit';
import { buildDeLaCoop } from '../../noyau/coop';
import { initialNet } from '../../noyau/etat';
import { t } from '../../i18n';

const BASE = 'http://localhost:8787';

/** Les ports factices d'un salon, et ce qu'ils ont vu. */
function ports(banc: Banc, fetch: PortsDuSalon['fetch']) {
  const stocke = new Map<string, string>();
  const p: PortsDuSalon = {
    ...portsDuTest(),
    relais: () => BASE,
    fetch,
    stockage: () => ({ getItem: (k) => stocke.get(k) ?? null, setItem: (k, v) => { stocke.set(k, v); } }),
    abonner: (ecouteur) => banc.subscribe(ecouteur),
  };
  return { p, stocke };
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
  salon?.quitter(banc.getState);
  vi.useRealTimers();
});

/** Un hôte dont la room est ouverte, le siège 1 assis et son handshake accompli. */
async function hoteAvecUnInvite() {
  const { p } = ports(banc, roomOuverte);
  salon = creerLeSalon(p);
  expect(await salon.heberger(banc.getState, 'Hôte')).toBe(true);
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
    expect(await salon.heberger(banc.getState, 'Anne')).toBe(false);
    expect(urls).toEqual([`${BASE}/rooms`]);
    expect(banc.getState().net.mode).toBe('local');
    expect(FakeSocket.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('room créée : mode hôte, code de la room, socket hôte par jeton', async () => {
    salon = creerLeSalon(ports(banc, roomOuverte).p);
    expect(await salon.heberger(banc.getState, 'Hôte')).toBe(true);
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
    expect(await salon.rejoindre(banc.getState, () => {}, 'abc-23', 'Anne')).toBe(t('coop.badCode'));
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it('rejoindre expire après fermeture 1006 et retry, sans socket ni minuterie survivante', async () => {
    salon = creerLeSalon(ports(banc, roomOuverte).p);
    const joining = salon.rejoindre(banc.getState, () => {}, 'abc234', 'Anne & Bob');
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
    const { p, stocke } = ports(banc, roomOuverte);
    stocke.set(cleDuJeton('ABC234'), 'ANCIEN');
    salon = creerLeSalon(p);
    const joining = salon.rejoindre(banc.getState, () => {}, 'ABC234', 'Anna');
    const ws = FakeSocket.last!;
    expect(new URL(ws.url).searchParams.get('token')).toBe('ANCIEN');
    expect(new URL(ws.url).searchParams.get('name')).toBeNull();
    ws.open();
    ws.receive(JSON.stringify({ evt: 'seated', seat: 2, token: 'NEUF' }));
    expect(await joining).toBeNull();
    expect(stocke.get(cleDuJeton('ABC234'))).toBe('NEUF');
    expect(banc.getState().net).toMatchObject({ mode: 'invite', mySeat: 2, roomCode: 'ABC234' });
    expect(banc.getState().marquerLesIndices, 'l’enrobage n’est pas posé').not.toBe(banc.actions.marquerLesIndices);
    salon.quitter(banc.getState);
    expect(banc.getState().marquerLesIndices, 'les actions d’origine ne sont pas restaurées').toBe(banc.actions.marquerLesIndices);
    expect(banc.getState().net).toEqual(initialNet());
  });
});
