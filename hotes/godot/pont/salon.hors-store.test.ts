/**
 * LE PONT HÉBERGE UN SALON (#3009, lot E3sa) : la méthode `salon` (zones, héberger, sièges, quitter), la méthode
 * `nouvelles`, les levées du réseau hors appel dites à `erreursGlobales`, et `quitter` qui ferme le salon. Un pont par
 * test, le pair joué par `FakeSocket`, les minuteurs factices.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { erreurDe, suiteDe, table, type Reponse } from './pont.testkit';
import type { ReseauDuPont } from './pont';
import { FakeSocket, compressionFactice, instantanesAuSiege1, minuterieDuTest, roomOuverte, stockageEnMap } from '../../../src/hote/coop/relay.testkit';
import { BUFFER_MAX, type ReponseDuRelais } from '../../../src/hote/coop/salon';
import { PROTOCOL_VERSION, serializeMessage } from '../../../src/hote/coop/protocol';
import { buildDeLaCoop, type LigneDuJournal } from '../../../src/noyau/index';
import type { ZonesDuSalon } from '../../../src/hote/salon';
import type { Bouton } from '../../../src/hote/elements';
import { t } from '../../../src/i18n';

type Appel = ReturnType<typeof table>['appel'];

/** Un réseau de test, ses ports remplacés par `sur`. */
const reseau = (sur: Partial<ReseauDuPont> = {}): ReseauDuPont => ({
  relais: () => 'http://localhost:8787',
  fetch: roomOuverte,
  socket: (url) => new FakeSocket(url),
  minuterie: minuterieDuTest,
  compression: compressionFactice,
  stockage: stockageEnMap().stockage,
  ...sur,
});

/** Le pont du test dont la partie est ouverte, que `afterEach` quitte. */
let courant: Appel | null = null;
beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
});
afterEach(() => {
  if (courant) expect(courant('quitter'), 'la partie du test ne se quitte pas').toEqual({ ok: true });
  courant = null;
  vi.useRealTimers();
});

/** Un pont sur le réseau `r`, une partie ouverte. */
function ouvert(r: ReseauDuPont | null = reseau()): Appel {
  const { appel } = table(undefined, r);
  courant = appel;
  expect(appel('ouvrir', { graine: 1 })).toMatchObject({ ok: true });
  return appel;
}

/** Les zones que `salon` rend. */
const zones = (r: Reponse): ZonesDuSalon => {
  expect(r.ok, JSON.stringify(r)).toBe(true);
  return (r as unknown as { zones: ZonesDuSalon }).zones;
};
const zonesDe = (appel: Appel) => zones(appel('salon'));
const textes = (z: ZonesDuSalon) => z['salon.etat'].map((l) => l.texte);
const gestes = (z: ZonesDuSalon) => z['salon.gestes'].map((g) => g.id);
/** La valeur `id` d'un choix de `salon.sieges`. */
const valeur = (z: ZonesDuSalon, id: string): Bouton => {
  const v = z['salon.sieges'].flatMap((c) => c.valeurs).find((b) => b.id === id);
  if (!v) throw new Error(`aucune valeur ${id}`);
  return v;
};
const textesDuJournal = (journal: LigneDuJournal[]) => journal.flatMap((l) => (l.de === 'journal' ? [l.texte] : []));
const RIEN = { ok: true, rien: true };

/** Un pont dont la partie ouverte héberge la room `ABC234`, l'ouverture déjà dite. */
async function enSession(r: ReseauDuPont = reseau()) {
  const appel = ouvert(r);
  appel('salon', { type: 'heberger', args: ['Hôte'] });
  await vi.advanceTimersByTimeAsync(0);
  suiteDe(appel('nouvelles'));
  return { appel, ws: FakeSocket.last! };
}

/** Anna s'assoit au siège 1 de la socket hôte `ws`, son handshake accompli. */
async function asseoirAnna(ws: FakeSocket) {
  ws.open();
  ws.receive(JSON.stringify({ evt: 'join', seat: 1, name: 'Anna' }));
  ws.receive(JSON.stringify({ from: 1, data: serializeMessage({ kind: 'hello', protocol: PROTOCOL_VERSION, build: buildDeLaCoop(), label: 'Anna' }) }));
  await vi.advanceTimersByTimeAsync(0);
}

/** L'intention `action(...args)` du siège 1, telle que la socket hôte la reçoit. */
const intentionDuSiege1 = (action: string, args: unknown[]) => JSON.stringify({ from: 1, data: serializeMessage({ kind: 'intent', action, args, seat: 0 }) });

describe('le pont héberge un salon', () => {
  it('S1 — héberger de bout en bout : ouverture, session, invité, choix de siège, diffusion sous contre-pression', async () => {
    const appel = ouvert();
    const pendant = zones(appel('salon', { type: 'heberger', args: ['Hôte'] }));
    expect(gestes(pendant)).toEqual(['quitter']);
    expect(textes(pendant)).toEqual([t('ecran.salon.enCours.heberger')]);
    await vi.advanceTimersByTimeAsync(0);
    suiteDe(appel('nouvelles'));
    expect(textes(zonesDe(appel))).toEqual([t('ecran.salon.code', { code: 'ABC234' }), `Hôte${t('party.slot.you')}`]);
    const ws = FakeSocket.last!;
    await asseoirAnna(ws);
    suiteDe(appel('nouvelles'));
    expect(zonesDe(appel)['salon.etat'].map((l) => l.id)).toContain('siege/1');
    const mj1 = valeur(zonesDe(appel), 'mj/1');
    expect(mj1.presse).toBe(false);
    const avant = instantanesAuSiege1(ws).length;
    expect(appel('salon', mj1.jeu)).toMatchObject({ ok: true });
    expect(valeur(zonesDe(appel), 'mj/1').presse, 'le choix ne pose pas ce qu’il annonce').toBe(true);
    suiteDe(appel('nouvelles'));
    await vi.advanceTimersByTimeAsync(200);
    expect(instantanesAuSiege1(ws).length, 'aucun instantané après le délai de diffusion').toBeGreaterThan(avant);
    const n = instantanesAuSiege1(ws).length;
    ws.bufferedAmount = BUFFER_MAX + 1;
    expect(appel('salon', valeur(zonesDe(appel), 'mj/0').jeu)).toMatchObject({ ok: true });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(instantanesAuSiege1(ws).length, 'parti malgré l’envoi saturé').toBe(n);
    ws.bufferedAmount = 0;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(instantanesAuSiege1(ws).length - n).toBe(1);
  });

  it('S2 — l’intention d’un invité sort chez l’hôte par la `Suite` de `nouvelles`, une fois', async () => {
    const { appel, ws } = await enSession();
    await asseoirAnna(ws);
    suiteDe(appel('nouvelles'));
    ws.receive(intentionDuSiege1('terminerLeTour', []));
    await vi.advanceTimersByTimeAsync(0);
    expect(textesDuJournal(suiteDe(appel('nouvelles')).journal)).toEqual([t('coop.intentRefused')]);
    expect(appel('nouvelles')).toEqual(RIEN);
  });
});

describe('S3 — aucune levée du réseau hors appel ne se perd', () => {
  it('(a) un écouteur de la socket qui lève : la minuterie lève à l’ouverture', async () => {
    let leve = false;
    const { appel, ws } = await enSession(reseau({
      minuterie: { programmer: (suite, delai) => { if (leve) throw new Error('minuterie'); return minuterieDuTest.programmer(suite, delai); } },
    }));
    leve = true;
    expect(() => ws.open()).not.toThrow();
    leve = false;
    expect(appel('erreursGlobales')).toEqual({ ok: true, erreurs: [{ message: 'minuterie', source: 'reseau' }] });
  });

  it('(b) une suite de la minuterie qui lève : `send` lève à l’échéance du ping', async () => {
    class SocketQuiLeve extends FakeSocket {
      override send(d: string): void {
        if (d === 'ping') throw new Error('send');
        super.send(d);
      }
    }
    const { appel, ws } = await enSession(reseau({ socket: (url) => new SocketQuiLeve(url) }));
    ws.open();
    await expect(vi.advanceTimersByTimeAsync(10_000)).resolves.not.toThrow();
    expect(appel('erreursGlobales')).toEqual({ ok: true, erreurs: [{ message: 'send', source: 'reseau' }] });
  });

  it('(c) le port `socket` lève à la construction : l’ouverture finit en échec, un second héberger aboutit', async () => {
    let leve = true;
    const appel = ouvert(reseau({ socket: (url) => { if (leve) { leve = false; throw new Error('socket'); } return new FakeSocket(url); } }));
    appel('salon', { type: 'heberger', args: ['Hôte'] });
    await vi.advanceTimersByTimeAsync(0);
    suiteDe(appel('nouvelles'));
    const z = zonesDe(appel);
    expect(textes(z)).toEqual([t('coop.hote.erreur')]);
    expect(z['salon.etat'][0].ton).toBe('echec');
    expect(appel('erreursGlobales')).toEqual({ ok: true, erreurs: [{ message: 'socket', source: 'reseau' }] });
    expect(gestes(z)).toEqual(['heberger', 'rejoindre']);
    appel('salon', { type: 'heberger', args: ['Hôte'] });
    await vi.advanceTimersByTimeAsync(0);
    suiteDe(appel('nouvelles'));
    expect(textes(zonesDe(appel))[0]).toBe(t('ecran.salon.code', { code: 'ABC234' }));
  });

  it('(d) l’intention d’un invité dont le verbe lève : le message suivant du même invité est appliqué', async () => {
    const { appel, ws } = await enSession();
    await asseoirAnna(ws);
    suiteDe(appel('nouvelles'));
    ws.receive(intentionDuSiege1('marquerLesIndices', [[null]]));
    ws.receive(intentionDuSiege1('terminerLeTour', []));
    await vi.advanceTimersByTimeAsync(0);
    const { erreurs } = appel('erreursGlobales') as unknown as { erreurs: { source: string }[] };
    expect(erreurs.map((e) => e.source)).toEqual(['reseau']);
    expect(textesDuJournal(suiteDe(appel('nouvelles')).journal)).toEqual([t('coop.intentRefused')]);
  });
});

describe('S4 — `nouvelles`', () => {
  it('sans partie, puis partie locale sans rien de neuf : `{ rien: true }`', () => {
    const { appel } = table(undefined, reseau());
    expect(appel('nouvelles')).toEqual(RIEN);
    expect(appel('ouvrir', { graine: 1 })).toMatchObject({ ok: true });
    courant = appel;
    expect(appel('nouvelles')).toEqual(RIEN);
  });

  it('une présence qui passe à `absent`, sans événement ni ligne : une `Suite`, puis `{ rien: true }`', async () => {
    const { appel, ws } = await enSession();
    await asseoirAnna(ws);
    suiteDe(appel('nouvelles'));
    expect(appel('nouvelles')).toEqual(RIEN);
    ws.receive(JSON.stringify({ evt: 'gone', seat: 1 }));
    const s = suiteDe(appel('nouvelles'));
    expect(s.journal).toEqual([]);
    expect(textes(zonesDe(appel))).toContain(`Anna${t('ecran.salon.absent')}`);
    expect(appel('nouvelles')).toEqual(RIEN);
  });

  it('une écriture du réseau puis `regarder` : sa `Suite` porte les lignes, `nouvelles` ensuite `{ rien: true }`', async () => {
    const { appel, ws } = await enSession();
    await asseoirAnna(ws);
    suiteDe(appel('nouvelles'));
    ws.receive(intentionDuSiege1('terminerLeTour', []));
    await vi.advanceTimersByTimeAsync(0);
    expect(textesDuJournal(suiteDe(appel('regarder', { regard: 'tactique' })).journal)).toEqual([t('coop.intentRefused')]);
    expect(appel('nouvelles')).toEqual(RIEN);
  });
});

describe('S5 — quitter, sans socket ouverte ni minuterie restante', () => {
  it('`{ salon: \'quitter\' }` en session', async () => {
    const { appel, ws } = await enSession();
    await asseoirAnna(ws);
    expect(gestes(zones(appel('salon', { salon: 'quitter' })))).toEqual(['heberger', 'rejoindre']);
    expect(ws.closedWith).not.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pendant une ouverture dont le `fetch` n’est pas revenu : aucun échec montré, le `fetch` tardif ne fait rien', async () => {
    let repondre!: (r: ReponseDuRelais) => void;
    const appel = ouvert(reseau({ fetch: () => new Promise<ReponseDuRelais>((r) => { repondre = r; }) }));
    appel('salon', { type: 'heberger', args: ['Hôte'] });
    const apres = zones(appel('salon', { salon: 'quitter' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(textes(zonesDe(appel))).toEqual([]);
    expect(gestes(apres)).toEqual(['heberger', 'rejoindre']);
    repondre(await roomOuverte());
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeSocket.instances).toHaveLength(0);
    expect(textes(zonesDe(appel))).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('`quitter` de la partie en session, puis `ouvrir` : aucune session, `heberger` offert', async () => {
    const { appel, ws } = await enSession();
    await asseoirAnna(ws);
    expect(appel('quitter')).toEqual({ ok: true });
    expect(ws.closedWith).not.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(appel('ouvrir', { graine: 1 })).toMatchObject({ ok: true });
    const z = zonesDe(appel);
    expect(textes(z)).toEqual([]);
    const heberger = z['salon.gestes'].find((g) => g.id === 'heberger');
    expect(heberger?.refus).toBeNull();
  });

  it('le lien perdu : la ligne sort à la `Suite` de `nouvelles`, les zones reviennent aux formulaires', async () => {
    const { appel, ws } = await enSession();
    ws.open();
    ws.dropFromServer(4404, 'room inconnue');
    expect(textesDuJournal(suiteDe(appel('nouvelles')).journal)).toEqual([t('coop.hote.lienPerdu')]);
    expect(gestes(zonesDe(appel))).toEqual(['heberger', 'rejoindre']);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('S6 — les refus n’écrivent ni l’état ni l’ouverture', () => {
  it('sans réseau et sans partie, `heberger` en `regle` avec le texte du formulaire', () => {
    const { appel } = table(undefined, null);
    const avant = zonesDe(appel);
    expect(erreurDe(appel('salon', { type: 'heberger', args: ['Hôte'] }))).toEqual({ categorie: 'regle', message: `salon : ${t('ecran.salon.refus.sansReseau')}` });
    expect(zonesDe(appel)).toEqual(avant);
  });

  it('en session `heberger`, hors session `quitter`, un nom qui n’est pas une chaîne : `validation`', async () => {
    const appel = ouvert();
    const horsSession = zonesDe(appel);
    expect(erreurDe(appel('salon', { salon: 'quitter' })).categorie).toBe('validation');
    expect(erreurDe(appel('salon', { type: 'heberger', args: [3] })).categorie).toBe('validation');
    expect(zonesDe(appel)).toEqual(horsSession);
    expect(appel('nouvelles')).toEqual(RIEN);
    appel('salon', { type: 'heberger', args: ['Hôte'] });
    await vi.advanceTimersByTimeAsync(0);
    suiteDe(appel('nouvelles'));
    const enSessionZ = zonesDe(appel);
    expect(erreurDe(appel('salon', { type: 'heberger', args: ['Autre'] })).categorie).toBe('validation');
    expect(zonesDe(appel)).toEqual(enSessionZ);
    expect(appel('nouvelles')).toEqual(RIEN);
  });

  it('un choix de siège lu en session puis envoyé après un lien perdu, un choix jamais offert : `validation`', async () => {
    const { appel, ws } = await enSession();
    ws.open();
    const mj0 = valeur(zonesDe(appel), 'mj/0').jeu;
    expect(erreurDe(appel('salon', { type: 'affecterLEmplacementAuSiege', args: [99, 1] })).categorie).toBe('validation');
    expect(appel('nouvelles')).toEqual(RIEN);
    ws.dropFromServer(4404, 'room inconnue');
    suiteDe(appel('nouvelles'));
    expect(erreurDe(appel('salon', mj0)).categorie).toBe('validation');
    expect(appel('nouvelles'), 'le choix périmé a écrit l’état').toEqual(RIEN);
  });
});
