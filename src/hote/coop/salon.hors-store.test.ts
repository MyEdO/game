/**
 * LE SALON COOP (#3556) sur ports factices (`relay.testkit.ts`) et le banc du noyau : création et échec de la room,
 * format du code et délai de connexion, reprise par jeton, grâce et présence, diffusion lissée sous backpressure,
 * enrobage des intentions de l'invité ; le rappel d'intention de l'hôte, la panne des chaînes, une ouverture à la fois et
 * son abandon par `quitter` (#3009).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUFFER_MAX, GRACE_MS, cleDuJeton, creerLeSalon, type AppliquerLIntention, type PortsDuSalon, type ReponseDuRelais, type Salon } from './salon';
import { FakeSocket, portsDuTest } from './relay.testkit';
import { PROTOCOL_VERSION, parseMessage, serializeMessage } from './protocol';
import { ouvrirLeBanc, type Banc } from '../../noyau/banc.testkit';
import { appliquerLInstantane, buildDeLaCoop, instantaneDeLaCoop } from '../../noyau/coop';
import { etatInitialDuJeu, initialNet } from '../../noyau/etat';
import { appliquerLIntentionDUnSiege } from '../../noyau/intentionsDeSiege';
import { t } from '../../i18n';

const BASE = 'http://localhost:8787';

/** Les ports factices d'un salon, et ce qu'ils ont vu. */
function ports(banc: Banc, fetch: PortsDuSalon['fetch'], panne?: PortsDuSalon['panne']) {
  const stocke = new Map<string, string>();
  const p: PortsDuSalon = {
    ...portsDuTest(undefined, panne),
    relais: () => BASE,
    fetch,
    stockage: () => ({ getItem: (k) => stocke.get(k) ?? null, setItem: (k, v) => { stocke.set(k, v); } }),
    abonner: (ecouteur) => banc.subscribe(ecouteur),
  };
  return { p, stocke };
}

const roomOuverte = async (): Promise<ReponseDuRelais> => ({ ok: true, json: async () => ({ code: 'ABC234', hostToken: 'HT' }) });

/** Le rappel d'intention de l'hôte web. */
const appliquerDuBanc: AppliquerLIntention = (action, args, siege) => { appliquerLIntentionDUnSiege(banc.getState, siege, action, args); };

/** Une intention du siège 1, telle que la socket hôte la reçoit. */
const intentionDuSiege1 = (action: string, args: unknown[]) => JSON.stringify({ from: 1, data: serializeMessage({ kind: 'intent', action, args, seat: 0 }) });

/** Un instantané de l'hôte au temps `gameTime`, tel que la socket de l'invité le reçoit (`z` : compressé). */
const instantaneRecu = (gameTime: number, champ: 'data' | 'z' = 'data') => {
  const texte = serializeMessage({ kind: 'snapshot', data: JSON.parse(JSON.stringify(instantaneDeLaCoop({ ...etatInitialDuJeu(), gameTime }))) });
  return JSON.stringify(champ === 'z' ? { z: `z:${texte}` } : { data: texte });
};

/** Les instantanés que la socket hôte a envoyés au siège 1. */
const instantanesAuSiege1 = (ws: FakeSocket) => ws.sent.flatMap((raw) => {
  if (raw === 'ping') return [];
  const env = JSON.parse(raw) as { to?: number; data?: string; z?: string };
  const texte = env.data ?? env.z?.slice(2);
  return env.to === 1 && texte && (JSON.parse(texte) as { kind: string }).kind === 'snapshot' ? [texte] : [];
});

/** Les intentions que la socket de l'invité a envoyées. */
const intentionsEmises = (ws: FakeSocket) => ws.sent.flatMap((raw) => {
  const env = JSON.parse(raw) as { data?: string; z?: string };
  const texte = env.data ?? env.z?.slice(2);
  const m = texte ? parseMessage(texte) : null;
  return m?.kind === 'intent' ? [m.action] : [];
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
async function hoteAvecUnInvite(appliquer: AppliquerLIntention = appliquerDuBanc, panne?: PortsDuSalon['panne']) {
  const { p } = ports(banc, roomOuverte, panne);
  salon = creerLeSalon(p);
  expect(await salon.heberger(banc.getState, appliquer, 'Hôte')).toBeNull();
  const ws = FakeSocket.last!;
  ws.open();
  ws.receive(JSON.stringify({ evt: 'join', seat: 1, name: 'Anna' }));
  ws.receive(JSON.stringify({ from: 1, data: serializeMessage({ kind: 'hello', protocol: PROTOCOL_VERSION, build: buildDeLaCoop(), label: 'Anna' }) }));
  await vi.advanceTimersByTimeAsync(0);
  return ws;
}

describe('salon — l’hôte', () => {
  it.each([
    ['fetch rejeté', async (): Promise<ReponseDuRelais> => { throw new TypeError('Failed to fetch'); }],
    ['réponse non ok', async (): Promise<ReponseDuRelais> => ({ ok: false, json: async () => ({}) })],
  ])('relay injoignable (%s) : héberger le dit, reste local, sans socket ni minuterie', async (_cas, repondre) => {
    const urls: string[] = [];
    salon = creerLeSalon(ports(banc, async (url) => { urls.push(url); return repondre(); }).p);
    expect(await salon.heberger(banc.getState, appliquerDuBanc, 'Anne')).toBe(t('coop.hote.erreur'));
    expect(urls).toEqual([`${BASE}/rooms`]);
    expect(banc.getState().net.mode).toBe('local');
    expect(FakeSocket.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('room créée : mode hôte, code de la room, socket hôte par jeton', async () => {
    salon = creerLeSalon(ports(banc, roomOuverte).p);
    expect(await salon.heberger(banc.getState, appliquerDuBanc, 'Hôte')).toBeNull();
    expect(banc.getState().net).toMatchObject({ mode: 'hote', roomCode: 'ABC234', seatNames: { 0: 'Hôte' } });
    const url = new URL(FakeSocket.last!.url);
    expect([url.origin, url.pathname, url.searchParams.get('token')]).toEqual(['ws://localhost:8787', '/room/ABC234', 'HT']);
  });

  it('coupure d’un invité : présence `absent`, siège réservé GRACE_MS ; reprise avant la fin, rien ne ferme', async () => {
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

  it('l’intention d’un siège arrive au rappel de `heberger`, et à lui seul : un rappel qui ne fait rien laisse l’état', async () => {
    const vues: [string, unknown[], number][] = [];
    const ws = await hoteAvecUnInvite((action, args, siege) => { vues.push([action, args, siege]); });
    const avant = banc.getState();
    ws.receive(intentionDuSiege1('terminerLeTour', [7]));
    await vi.advanceTimersByTimeAsync(0);
    expect(vues).toEqual([['terminerLeTour', [7], 1]]);
    expect(banc.getState()).toBe(avant);
  });

  it('le rappel d’intention lève sur la première : la panne la reçoit une fois, la seconde arrive au rappel', async () => {
    const vues: string[] = [];
    const pannes: unknown[] = [];
    const ws = await hoteAvecUnInvite((action) => {
      vues.push(action);
      if (vues.length === 1) throw new Error('rappel');
    }, (e) => pannes.push(e));
    ws.receive(intentionDuSiege1('A', []));
    ws.receive(intentionDuSiege1('B', []));
    await vi.advanceTimersByTimeAsync(0);
    expect(vues).toEqual(['A', 'B']);
    expect(pannes.map((e) => (e as Error).message)).toEqual(['rappel']);
  });

  it('en session, héberger le dit sans rien ouvrir', async () => {
    await hoteAvecUnInvite();
    expect(await salon!.heberger(banc.getState, appliquerDuBanc, 'Autre')).toBe(t('coop.alreadyInSession'));
    expect(FakeSocket.instances).toHaveLength(1);
  });
});

/** Un invité assis au siège 2 de la room `ABC234`, l'instantané reçu appliqué à son banc. */
async function inviteAssis() {
  salon = creerLeSalon(ports(banc, roomOuverte).p);
  const joining = salon.rejoindre(banc.getState, (data) => banc.setState(appliquerLInstantane(data, banc.getState()).etat), 'ABC234', 'Anna');
  const ws = FakeSocket.last!;
  ws.open();
  ws.receive(JSON.stringify({ evt: 'seated', seat: 2, token: 'TOK' }));
  expect(await joining).toBeNull();
  return ws;
}

/** La session de l'invité est finie : `net` initial, actions d'origine. */
function finie() {
  expect(banc.getState().net).toEqual(initialNet());
  expect(banc.getState().marquerLesIndices, 'les actions d’origine ne sont pas restaurées').toBe(banc.actions.marquerLesIndices);
}

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
    finie();
    expect(FakeSocket.instances[1].closedWith).not.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('premier instantané de l’hôte : appliqué, `net` invité au siège donné, l’action de l’allowlist part en intention', async () => {
    const ws = await inviteAssis();
    const hote = { ...etatInitialDuJeu(), gameTime: 4242, net: { ...initialNet(), mode: 'hote' as const, roomCode: 'ABC234' } };
    ws.receive(JSON.stringify({ data: serializeMessage({ kind: 'hello', protocol: PROTOCOL_VERSION, build: buildDeLaCoop(), label: 'Hôte' }) }));
    ws.receive(JSON.stringify({ data: serializeMessage({ kind: 'snapshot', data: JSON.parse(JSON.stringify(instantaneDeLaCoop(hote))) }) }));
    await vi.advanceTimersByTimeAsync(0);
    expect(banc.getState().gameTime, 'l’instantané n’est pas appliqué').toBe(4242);
    expect(banc.getState().net).toMatchObject({ mode: 'invite', mySeat: 2 });
    banc.getState().marquerLesIndices([]);
    await vi.advanceTimersByTimeAsync(0);
    expect(intentionsEmises(ws)).toEqual(['marquerLesIndices']);
  });

  it('fatal du relay une fois assis : la raison au journal, la session finie', async () => {
    const ws = await inviteAssis();
    ws.dropFromServer(4404, 'room inconnue');
    expect(banc.getState().journal).toContain(t('coop.reason', { reason: 'room inconnue' }));
    finie();
  });

  it('socket fermée une fois assis, sans reprise dans le délai de reconnexion : la session finie', async () => {
    await inviteAssis();
    for (let i = 0; i < 30 && banc.getState().net.mode === 'invite'; i++) {
      FakeSocket.last!.dropFromServer();
      await vi.advanceTimersByTimeAsync(10_000);
    }
    finie();
  });

  it('l’instantané qui lève au rappel : la panne la reçoit une fois, le second arrive au rappel', async () => {
    const pannes: unknown[] = [];
    const vus: number[] = [];
    salon = creerLeSalon(ports(banc, roomOuverte, (e) => pannes.push(e)).p);
    const joining = salon.rejoindre(banc.getState, (data) => {
      vus.push(data.gameTime as number);
      if (vus.length === 1) throw new Error('instantané');
    }, 'ABC234', 'Anna');
    const ws = FakeSocket.last!;
    ws.open();
    ws.receive(JSON.stringify({ evt: 'seated', seat: 2, token: 'TOK' }));
    expect(await joining).toBeNull();
    ws.receive(JSON.stringify({ data: serializeMessage({ kind: 'hello', protocol: PROTOCOL_VERSION, build: buildDeLaCoop(), label: 'Hôte' }) }));
    ws.receive(instantaneRecu(1));
    ws.receive(instantaneRecu(2));
    await vi.advanceTimersByTimeAsync(0);
    expect(vus).toEqual([1, 2]);
    expect(pannes.map((e) => (e as Error).message)).toEqual(['instantané']);
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

describe('salon — une ouverture à la fois, que `quitter` achève', () => {
  it('quitter pendant une jonction : abandonnée dans l’appel, sans minuterie ; un `seated` tardif n’assoit ni ne stocke ; héberger ensuite tient plus de 15 s', async () => {
    const { p, stocke } = ports(banc, roomOuverte);
    salon = creerLeSalon(p);
    const joining = salon.rejoindre(banc.getState, () => {}, 'ABC234', 'Anna');
    const ws = FakeSocket.last!;
    ws.open();
    let issue: string | null | undefined;
    void joining.then((i) => { issue = i; });
    salon.quitter(banc.getState);
    await Promise.resolve();
    expect(issue).toBe(t('coop.ouvertureAbandonnee'));
    expect(vi.getTimerCount()).toBe(0);
    ws.receive(JSON.stringify({ evt: 'seated', seat: 2, token: 'TARD' }));
    expect(stocke.has(cleDuJeton('ABC234'))).toBe(false);
    finie();
    expect(await salon.heberger(banc.getState, appliquerDuBanc, 'Anna')).toBeNull();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(banc.getState().net).toMatchObject({ mode: 'hote', roomCode: 'ABC234' });
  });

  it('un instantané décompressé après le `quitter` d’un invité assis n’arrive pas au rappel', async () => {
    const vus: unknown[] = [];
    salon = creerLeSalon(ports(banc, roomOuverte).p);
    const joining = salon.rejoindre(banc.getState, (data) => vus.push(data), 'ABC234', 'Anna');
    const ws = FakeSocket.last!;
    ws.open();
    ws.receive(JSON.stringify({ evt: 'seated', seat: 2, token: 'TOK' }));
    expect(await joining).toBeNull();
    ws.receive(JSON.stringify({ data: serializeMessage({ kind: 'hello', protocol: PROTOCOL_VERSION, build: buildDeLaCoop(), label: 'Hôte' }) }));
    ws.receive(instantaneRecu(5, 'z'));
    salon.quitter(banc.getState);
    await vi.advanceTimersByTimeAsync(0);
    expect(vus).toEqual([]);
  });

  it('un invité assis quitte, socket à fermeture différée : un seul `bye`, aucun envoi après `close()`', async () => {
    salon = creerLeSalon({ ...ports(banc, roomOuverte).p, socket: (url) => new FakeSocket(url, true) });
    const joining = salon.rejoindre(banc.getState, () => {}, 'ABC234', 'Anna');
    const ws = FakeSocket.last!;
    ws.open();
    ws.receive(JSON.stringify({ evt: 'seated', seat: 2, token: 'TOK' }));
    expect(await joining).toBeNull();
    const apresClose: string[] = [];
    ws.onSend = (d) => { if (ws.closedWith) apresClose.push(d); };
    salon.quitter(banc.getState);
    await vi.advanceTimersByTimeAsync(0);
    expect(ws.sent.filter((d) => d === JSON.stringify({ ctl: 'bye' }))).toHaveLength(1);
    expect(apresClose).toEqual([]);
  });

  it('quitter pendant le `fetch` de héberger, qui ne se règle jamais : abandonné dans l’appel', async () => {
    salon = creerLeSalon(ports(banc, () => new Promise<ReponseDuRelais>(() => {})).p);
    let issue: string | null | undefined;
    void salon.heberger(banc.getState, appliquerDuBanc, 'Hôte').then((i) => { issue = i; });
    salon.quitter(banc.getState);
    await Promise.resolve();
    expect(issue).toBe(t('coop.ouvertureAbandonnee'));
  });

  it('quitter pendant le `fetch` de héberger, qui répond après coup : ni socket, ni mode, ni abonnement', async () => {
    let repondre!: (r: ReponseDuRelais) => void;
    const abonnes: unknown[] = [];
    const { p } = ports(banc, () => new Promise<ReponseDuRelais>((r) => { repondre = r; }));
    salon = creerLeSalon({ ...p, abonner: (e) => { abonnes.push(e); return () => {}; } });
    const hebergement = salon.heberger(banc.getState, appliquerDuBanc, 'Hôte');
    salon.quitter(banc.getState);
    expect(await hebergement).toBe(t('coop.ouvertureAbandonnee'));
    repondre(await roomOuverte());
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeSocket.instances).toHaveLength(0);
    expect(banc.getState().net.mode).toBe('local');
    expect(abonnes).toEqual([]);
  });

  it('héberger pendant une jonction, rejoindre pendant une jonction : refusés sans socket ; la jonction aboutit', async () => {
    salon = creerLeSalon(ports(banc, roomOuverte).p);
    const joining = salon.rejoindre(banc.getState, () => {}, 'ABC234', 'Anna');
    const ws = FakeSocket.last!;
    expect(await salon.heberger(banc.getState, appliquerDuBanc, 'Anna')).toBe(t('coop.alreadyInSession'));
    expect(await salon.rejoindre(banc.getState, () => {}, 'XYZ789', 'Anna')).toBe(t('coop.alreadyInSession'));
    expect(FakeSocket.instances).toHaveLength(1);
    ws.open();
    ws.receive(JSON.stringify({ evt: 'seated', seat: 2, token: 'TOK' }));
    expect(await joining).toBeNull();
    expect(banc.getState().net).toMatchObject({ mode: 'invite', mySeat: 2 });
  });

  it('rejoindre pendant un héberger en vol : refusé sans socket ; l’hébergement aboutit', async () => {
    let repondre!: (r: ReponseDuRelais) => void;
    salon = creerLeSalon(ports(banc, () => new Promise<ReponseDuRelais>((r) => { repondre = r; })).p);
    const hebergement = salon.heberger(banc.getState, appliquerDuBanc, 'Hôte');
    expect(await salon.rejoindre(banc.getState, () => {}, 'ABC234', 'Anna')).toBe(t('coop.alreadyInSession'));
    expect(FakeSocket.instances).toHaveLength(0);
    repondre(await roomOuverte());
    expect(await hebergement).toBeNull();
    expect(banc.getState().net.mode).toBe('hote');
  });

  /** Des ports dont la première socket lève à la construction ; les suivantes sont saines. */
  function portsASocketQuiLeve(fetch: PortsDuSalon['fetch'] = roomOuverte) {
    const boom = new Error('socket');
    const pannes: unknown[] = [];
    const abonnes: unknown[] = [];
    let leve = true;
    const { p } = ports(banc, fetch, (e) => pannes.push(e));
    const sabotes: PortsDuSalon = {
      ...p,
      socket: (url) => {
        if (leve) { leve = false; throw boom; }
        return new FakeSocket(url);
      },
      abonner: (e) => { abonnes.push(e); return p.abonner(e); },
    };
    return { sabotes, boom, pannes, abonnes };
  }

  it('P11a — la socket de héberger lève : l’échec de héberger, la panne une fois, local sans abonnement ; héberger ensuite aboutit', async () => {
    const { sabotes, boom, pannes, abonnes } = portsASocketQuiLeve();
    salon = creerLeSalon(sabotes);
    expect(await salon.heberger(banc.getState, appliquerDuBanc, 'Hôte')).toBe(t('coop.hote.erreur'));
    expect(pannes).toEqual([boom]);
    expect(banc.getState().net.mode).toBe('local');
    expect(abonnes).toEqual([]);
    expect(await salon.heberger(banc.getState, appliquerDuBanc, 'Hôte')).toBeNull();
    expect(banc.getState().net).toMatchObject({ mode: 'hote', roomCode: 'ABC234' });
  });

  it('P11b — la socket de rejoindre lève : l’échec de rejoindre, la panne une fois, sans minuterie ; rejoindre ensuite aboutit', async () => {
    const { sabotes, boom, pannes } = portsASocketQuiLeve();
    salon = creerLeSalon(sabotes);
    expect(await salon.rejoindre(banc.getState, () => {}, 'ABC234', 'Anna')).toBe(t('coop.joinFailed'));
    expect(pannes).toEqual([boom]);
    expect(vi.getTimerCount()).toBe(0);
    const joining = salon.rejoindre(banc.getState, () => {}, 'ABC234', 'Anna');
    const ws = FakeSocket.last!;
    ws.open();
    ws.receive(JSON.stringify({ evt: 'seated', seat: 2, token: 'TOK' }));
    expect(await joining).toBeNull();
    expect(banc.getState().net).toMatchObject({ mode: 'invite', mySeat: 2 });
  });

  it.each(['', '   '])('nom vide ou fait d’espaces (%j) : héberger et rejoindre le disent, rien d’ouvert', async (nom) => {
    const urls: string[] = [];
    salon = creerLeSalon(ports(banc, async (url) => { urls.push(url); return roomOuverte(); }).p);
    expect(await salon.heberger(banc.getState, appliquerDuBanc, nom)).toBe(t('coop.nomRequis'));
    expect(await salon.rejoindre(banc.getState, () => {}, 'ABC234', nom)).toBe(t('coop.nomRequis'));
    expect(urls).toEqual([]);
    expect(FakeSocket.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
