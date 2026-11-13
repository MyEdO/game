/**
 * LE PONT REJOINT UN SALON (#3009, lot E3sb) : la jonction (`salon { type: 'rejoindre' }`), la partie miroir nourrie
 * par les instantanés de l'hôte, et la clôture unique de toute fin d'un miroir, dite une fois par `nouvelles`
 * (`quittee`). Un pont hôte joue d'abord une campagne lancée et garde ses trames, puis se quitte : une partie par
 * contexte. Le pair joué par `FakeSocket`, les minuteurs factices.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drainer, erreurDe, suiteDe, table, type Reponse } from './pont.testkit';
import type { ReseauDuPont } from './pont';
import { FakeSocket, compressionFactice, minuterieDuTest, roomOuverte, stockageEnMap, instantanesAuSiege1 } from '../../../src/hote/coop/relay.testkit';
import { PROTOCOL_VERSION, serializeMessage } from '../../../src/hote/coop/protocol';
import { buildDeLaCoop, etatInitialDuJeu, OPTIONAL_RULES, pointDeRepriseAGarder, poserLesReglesMaisonPersistees, ruleOverrides, type LigneDuJournal } from '../../../src/noyau/index';
import { appliquerLInstantane } from '../../../src/noyau/coop';
import { AUTO_SLOT, cleDEmplacement } from '../../../src/hote/sauvegardes';
import { stockageEnMemoire } from '../../../src/lib/stockage.testkit';
import type { ZonesDuSalon } from '../../../src/hote/salon';
import type { Bouton, Element, Entite, Ligne } from '../../../src/hote/elements';
import { t } from '../../../src/i18n';

type Appel = ReturnType<typeof table>['appel'];

const reseau = (sur: Partial<ReseauDuPont> = {}): ReseauDuPont => ({
  relais: () => 'http://localhost:8787',
  fetch: roomOuverte,
  socket: (url) => new FakeSocket(url),
  minuterie: minuterieDuTest,
  compression: compressionFactice,
  stockage: stockageEnMap().stockage,
  ...sur,
});

const PLAFOND = OPTIONAL_RULES.find((r) => r.id === 'combat-plafond-avantage')!;
const RIEN = { ok: true, rien: true };
const OCTETS_DU_JOUEUR = '{"emplacement":"du joueur"}';

/** Le pont du test dont une partie est ouverte ou se rejoint, que `afterEach` ramène sans partie. */
let courant: Appel | null = null;
beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
});
afterEach(() => {
  if (courant) courant('quitter');
  if (courant) courant('salon', { salon: 'quitter' });
  courant = null;
  poserLesReglesMaisonPersistees({});
  vi.useRealTimers();
});

const zonesDe = (appel: Appel): ZonesDuSalon => (appel('salon') as unknown as { zones: ZonesDuSalon }).zones;
const gestes = (z: ZonesDuSalon) => z['salon.gestes'].map((g) => g.id);
const textesDuJournal = (journal: LigneDuJournal[]) => journal.flatMap((l) => (l.de === 'journal' ? [l.texte] : []));
/** Les lignes de la `quittee` de `r`. */
const lignesDeQuittee = (r: Reponse): Ligne[] => {
  const q = (r as unknown as { quittee?: { lignes: Ligne[] } }).quittee;
  if (!q) throw new Error(`aucune quittee : ${JSON.stringify(r).slice(0, 200)}`);
  return q.lignes;
};
const estUneDate = (l: Ligne) => l.id.startsWith('journal/jour/');
/** Les textes de la `quittee` de `r`, hors la date d'un jour (`lignesDuJournal`). */
const quitteeDe = (r: Reponse): string[] => lignesDeQuittee(r).filter((l) => !estUneDate(l)).map((l) => l.texte);
const bouton = (entites: Entite[], id: string, prefixe: string): Bouton =>
  entites.find((e) => e.id === id)!.elements.find((e): e is Bouton => e.type === 'bouton' && e.id.startsWith(`${prefixe}/`))!;
const message = (m: Parameters<typeof serializeMessage>[0]) => JSON.stringify({ data: serializeMessage(m) });
const HELLO = message({ kind: 'hello', protocol: PROTOCOL_VERSION, build: buildDeLaCoop(), label: 'Hôte' });

/** La scène et la case du groupe de la projection de la vue de `appel`. */
const sceneEtGroupe = (appel: Appel) => {
  const { projection } = (appel('vue') as unknown as { vue: { projection: { scene: { id: string } | null; exploration: { groupe: unknown } | null } } }).vue;
  return [projection.scene?.id, projection.exploration?.groupe];
};

/** `appel` héberge la room `ABC234`, Anna assise au siège 1 ; la socket de l'hôte. */
async function hebergerAnna(appel: Appel) {
  appel('salon', { type: 'heberger', args: ['Hôte'] });
  await vi.advanceTimersByTimeAsync(0);
  const ws = FakeSocket.last!;
  ws.open();
  ws.receive(JSON.stringify({ evt: 'join', seat: 1, name: 'Anna' }));
  ws.receive(JSON.stringify({ from: 1, data: serializeMessage({ kind: 'hello', protocol: PROTOCOL_VERSION, build: buildDeLaCoop(), label: 'Anna' }) }));
  await vi.advanceTimersByTimeAsync(200);
  return ws;
}

/** L'hôte `appel` quitté, sans socket ni règle maison. */
function quitterLHote(appel: Appel) {
  expect(appel('quitter')).toEqual({ ok: true });
  FakeSocket.instances = [];
  poserLesReglesMaisonPersistees({});
}

/** Un hôte (règle maison PLAFOND à 12) qui a ouvert une partie et recruté deux prétirés : son `appel` et sa
 *  dernière `Suite`. */
function groupeDeLHote() {
  const { appel } = table(stockageEnMemoire(), reseau());
  appel('reglages', { type: 'regle', args: [PLAFOND.id, 12] });
  let s = suiteDe(appel('ouvrir', { graine: 7 }));
  s = suiteDe(appel('jouer', bouton(s.vue.zones['groupe.pretires'], 'pretire/harbull-piedvelu', 'recruter').jeu));
  s = suiteDe(appel('jouer', bouton(s.vue.zones['groupe.pretires'], 'pretire/werner-murrmann', 'recruter').jeu));
  return { appel, s };
}

/** Le dernier instantané envoyé au siège 1 par l'hôte de `groupeDeLHote`, Anna assise, sans campagne lancée : le
 *  lobby. L'hôte quitté ensuite. */
async function lobbyDeLHote() {
  const { appel } = groupeDeLHote();
  const instantanes = instantanesAuSiege1(await hebergerAnna(appel));
  quitterLHote(appel);
  return instantanes[instantanes.length - 1];
}

/** Les trames de l'hôte de `groupeDeLHote` qui a lancé `la-diligence`, Anna assise au siège 1, puis validé
 *  l'ouverture et déplacé le groupe : chaque instantané envoyé au siège 1, et la scène et la case du groupe de sa vue
 *  au départ de chacun. L'hôte quitté ensuite. */
async function tramesDeLHote() {
  const { appel, s } = groupeDeLHote();
  suiteDe(appel('lancer', bouton(s.vue.zones['groupe.campagnes'], 'campagne/la-diligence', 'lancer').jeu));
  const ws = await hebergerAnna(appel);
  const vues: unknown[][] = [];
  const noter = () => {
    while (vues.length < instantanesAuSiege1(ws).length) vues.push(sceneEtGroupe(appel));
  };
  noter();
  drainer(appel, appel('jouer', { type: 'fenetreValider', args: ['ouverture'] }));
  await vi.advanceTimersByTimeAsync(200);
  noter();
  const [x, y] = sceneEtGroupe(appel)[1] as number[];
  drainer(appel, appel('jouer', { type: 'cliquerLaCase', args: [{ x, y: y + 2 }] }));
  await vi.advanceTimersByTimeAsync(200);
  noter();
  const instantanes = instantanesAuSiege1(ws);
  expect(new Set(vues.map((v) => JSON.stringify(v))).size, 'témoin : la vue de l’hôte n’a pas changé d’un instantané à l’autre').toBeGreaterThan(1);
  quitterLHote(appel);
  return { instantanes, vues, dernier: JSON.parse(instantanes[instantanes.length - 1]).data as Record<string, unknown> };
}

/** Le dernier instantané envoyé au siège 1 par un hôte qui a démarré le dôme et ouvert son premier round, puis
 *  affecté ses deux héros au siège 1 d'Anna : au tour de la sorcière, à elle. L'hôte quitté ensuite. */
async function combatDeLHote() {
  const { appel } = table(stockageEnMemoire(), reseau());
  appel('demarrer', { scenario: 'dome', graine: 7 });
  drainer(appel, appel('jouer', { type: 'fenetreValider', args: ['debutDuRound'] }));
  const ws = await hebergerAnna(appel);
  for (const id of ['heros/sorciere/1', 'heros/protegee/1']) appel('salon', zonesDe(appel)['salon.sieges'].flatMap((c) => c.valeurs).find((v) => v.id === id)!.jeu);
  await vi.advanceTimersByTimeAsync(200);
  const instantanes = instantanesAuSiege1(ws);
  quitterLHote(appel);
  return instantanes[instantanes.length - 1];
}

/** Un pont invité sur un stockage où le joueur a écrit son emplacement automatique et PLAFOND à 8. */
function invite(r: ReseauDuPont = reseau()) {
  const stockage = stockageEnMemoire();
  stockage.setItem(cleDEmplacement(AUTO_SLOT), OCTETS_DU_JOUEUR);
  const { appel } = table(stockage, r);
  appel('reglages', { type: 'regle', args: [PLAFOND.id, 8] });
  courant = appel;
  return { appel, stockage };
}

/** `appel` rejoint `ABC234` et s'assoit au siège 1, le hello de l'hôte reçu ; la socket de l'invité. */
async function assis(appel: Appel) {
  expect(appel('salon', { type: 'rejoindre', args: ['ABC234', 'Anna'] })).toMatchObject({ ok: true });
  const ws = FakeSocket.last!;
  ws.open();
  ws.receive(JSON.stringify({ evt: 'seated', seat: 1, token: 'TOK' }));
  await vi.advanceTimersByTimeAsync(0);
  ws.receive(HELLO);
  await vi.advanceTimersByTimeAsync(0);
  return ws;
}

/** La socket `ws` reçoit l'instantané `texte`. */
async function recevoir(ws: FakeSocket, texte: string) {
  ws.receive(JSON.stringify({ data: texte }));
  await vi.advanceTimersByTimeAsync(0);
}

/** Les intentions `[action, args]` que la socket `ws` de l'invité a envoyées, la chaîne d'envoi vidée d'abord. */
async function intentionsParties(ws: FakeSocket): Promise<[string, unknown[]][]> {
  await vi.advanceTimersByTimeAsync(0);
  return ws.sent.flatMap((raw) => {
    if (raw === 'ping') return [];
    const m = JSON.parse((JSON.parse(raw) as { data: string }).data) as { kind: string; action?: string; args?: unknown[] };
    return m.kind === 'intent' ? [[m.action!, m.args!] as [string, unknown[]]] : [];
  });
}

/** La valeur `id` d'un choix de `combat.offres`. */
const offre = (s: { vue: { zones: { 'combat.offres': Element[] } } }, id: string) =>
  s.vue.zones['combat.offres'].flatMap((c) => (c.type === 'choix' ? c.valeurs : [])).find((v) => v.id === id);

describe('le pont rejoint un salon', () => {
  it('M1, M2 — assis, après chaque instantané sa vue est celle de l’hôte, ses gestes émettent des intentions ; le journal de l’hôte arrive une fois', async () => {
    const { instantanes, vues } = await tramesDeLHote();
    const { appel } = invite();
    const ws = await assis(appel);
    suiteDe(appel('nouvelles'));
    const parInstantane: number[] = [];
    for (const [i, texte] of instantanes.entries()) {
      await recevoir(ws, texte);
      expect(sceneEtGroupe(appel), `la vue de l’invité n’est pas celle de l’hôte à l’instantané ${i}`).toEqual(vues[i]);
      parInstantane.push(textesDuJournal(suiteDe(appel('nouvelles')).journal).length);
    }
    expect(parInstantane, 'le journal de l’hôte n’est pas arrivé').toEqual([0, 0, 0, 1]);
    expect(ruleOverrides()[PLAFOND.id], 'témoin : les règles de l’hôte reçues').toBe(12);
    const [x, y] = vues[vues.length - 1][1] as number[];
    suiteDe(appel('jouer', { type: 'cliquerLaCase', args: [{ x, y: y + 1 }] }));
    expect(await intentionsParties(ws), 'le geste de l’invité n’est pas parti').toEqual([['cliquerLaCase', [{ x, y: y + 1 }]]]);
    await recevoir(ws, instantanes[instantanes.length - 1]);
    expect(textesDuJournal(suiteDe(appel('nouvelles')).journal), 'le même instantané redit le journal').toEqual([]);
  });

  it('M3 (a, b, c) — en combat, au tour du héros de son siège : l’attaque armée chez lui puis le clic du champ partent, un verbe `local` ne part pas, un verbe de l’hôte en `regle`', async () => {
    const instantane = await combatDeLHote();
    const { battle, net } = JSON.parse(instantane).data as { battle: { combatants: { id: string; pos: { x: number; y: number } }[] }; net: { ownership: Record<string, number> } };
    const ennemi = battle.combatants.find((c) => net.ownership[c.id] === undefined)!;
    const { appel } = invite();
    const ws = await assis(appel);
    await recevoir(ws, instantane);
    expect(suiteDe(appel('nouvelles')).vue.zones['combat.actif'].map((e) => e.id), 'témoin : le tour n’est pas au héros de l’invité').toEqual(['sorciere']);
    const armee = suiteDe(appel('jouer', { type: 'armerLAttaque', args: ['arme'] }));
    expect(offre(armee, 'attaque'), 'l’attaque ne s’est pas armée chez l’invité').toMatchObject({ presse: true });
    suiteDe(appel('jouer', { type: 'cliquerLaCase', args: [ennemi.pos, ennemi.id, { confirm: true }] }));
    const partiesEnA = [['armerLAttaque', ['arme']], ['cliquerLaCase', [ennemi.pos, ennemi.id, { confirm: true }]]];
    expect(await intentionsParties(ws), '(a)').toEqual(partiesEnA);
    expect(offre(suiteDe(appel('jouer', { type: 'armerLIntention', args: ['course'] })), 'course'), 'la course ne s’est pas armée chez l’invité').toMatchObject({ presse: true });
    expect(await intentionsParties(ws), '(b) le verbe `local` est parti').toEqual(partiesEnA);
    expect(erreurDe(appel('jouer', { type: 'ouvrirLaCarte', args: [] }))).toEqual({ categorie: 'regle', message: `ouvrirLaCarte : ${t('coop.hoteSeul')}` });
    expect(await intentionsParties(ws), '(c) le verbe de l’hôte est parti').toEqual(partiesEnA);
  });

  it('M3 (d) — le miroir d’un lobby : `lancer` et une règle maison en `regle` avec la raison du noyau, les règles et le stockage intacts', async () => {
    const instantane = await lobbyDeLHote();
    const { appel, stockage } = invite();
    const ws = await assis(appel);
    await recevoir(ws, instantane);
    suiteDe(appel('nouvelles'));
    const avant = [...stockage.contenu];
    expect(erreurDe(appel('lancer', { lancer: 'la-diligence' }))).toEqual({ categorie: 'regle', message: `lancer : ${t('party.guest.waiting')}` });
    expect(erreurDe(appel('reglages', { type: 'regle', args: [PLAFOND.id, 3] }))).toEqual({ categorie: 'regle', message: `reglages : ${t('houseRules.lockedForGuest')}` });
    expect(ruleOverrides()[PLAFOND.id], 'les règles de l’hôte ont changé').toBe(12);
    expect([...stockage.contenu], 'le stockage du joueur a changé').toEqual(avant);
  });

  it('M3 (e) — un invité : un geste qui porte `siege` ne part pas', async () => {
    const { instantanes } = await tramesDeLHote();
    const { appel } = invite();
    const ws = await assis(appel);
    await recevoir(ws, instantanes[instantanes.length - 1]);
    suiteDe(appel('nouvelles'));
    const envoyes = ws.sent.length;
    const refus = suiteDe(appel('jouer', { type: 'renvoyerLeHeros', args: ['pretire-harbull-piedvelu'], siege: 1 }));
    expect(textesDuJournal(refus.journal)).toEqual([t('coop.siegeHoteSeul')]);
    expect(refus.vue.zones['groupe.heros'].map((h) => h.id), 'l’intention du siège s’est jouée chez l’invité').toContain('heros/pretire-harbull-piedvelu');
    expect(ws.sent.length, 'l’intention du siège est partie').toBe(envoyes);
  });

  it('M4 — la room fermée par l’hôte : « aucune partie », `quittee` une fois avec la raison, emplacement et règles intacts', async () => {
    const { instantanes, dernier } = await tramesDeLHote();
    expect(pointDeRepriseAGarder(appliquerLInstantane(dernier, etatInitialDuJeu()).etat, 0), 'témoin : le miroir au siège 0 serait à garder').toBe(true);
    const { appel, stockage } = invite();
    const ws = await assis(appel);
    await recevoir(ws, instantanes[instantanes.length - 1]);
    suiteDe(appel('nouvelles'));
    expect(ruleOverrides()[PLAFOND.id]).toBe(12);
    ws.dropFromServer(4404, 'room fermée');
    expect(erreurDe(appel('vue')).message).toMatch(/^aucune partie/);
    expect(quitteeDe(appel('nouvelles'))).toEqual([t('coop.reason', { reason: 'room fermée' })]);
    expect(appel('nouvelles')).toEqual(RIEN);
    expect(ruleOverrides()[PLAFOND.id], 'les règles de l’hôte restent').toBe(8);
    expect(stockage.getItem(cleDEmplacement(AUTO_SLOT)), 'l’emplacement automatique du joueur écrasé').toBe(OCTETS_DU_JOUEUR);
    expect(gestes(zonesDe(appel))).toEqual(['heberger', 'rejoindre']);
  });

  it('M4 — `quitter` puis `{ salon: \'quitter\' }` : emplacement et règles intacts, `quitter` sans `quittee`', async () => {
    const { instantanes } = await tramesDeLHote();
    const { appel, stockage } = invite();
    for (const fin of [['quitter'], ['salon', { salon: 'quitter' }]] as [string, unknown?][]) {
      const ws = await assis(appel);
      await recevoir(ws, instantanes[instantanes.length - 1]);
      suiteDe(appel('nouvelles'));
      expect(appel(...fin), fin[0]).toMatchObject({ ok: true });
      expect(ws.closedWith, fin[0]).not.toBeNull();
      expect(ruleOverrides()[PLAFOND.id], fin[0]).toBe(8);
      expect(stockage.getItem(cleDEmplacement(AUTO_SLOT)), fin[0]).toBe(OCTETS_DU_JOUEUR);
      if (fin[0] === 'quitter') expect(appel('nouvelles'), '`quitter` laisse une `quittee`').toEqual(RIEN);
      else expect(quitteeDe(appel('nouvelles'))).toEqual([]);
      expect(vi.getTimerCount(), fin[0]).toBe(0);
    }
  });

  it('M4 — une clôture venue du réseau vue par un `salon`, puis une jonction ratée : `quittee` porte les deux, chaque ligne son id, la date une fois', async () => {
    const { appel } = invite();
    const ws = await assis(appel);
    ws.dropFromServer(4404, 'room fermée');
    expect(gestes(zonesDe(appel))).toEqual(['heberger', 'rejoindre']);
    appel('salon', { type: 'rejoindre', args: ['abc-23', 'Anna'] });
    await vi.advanceTimersByTimeAsync(0);
    const lignes = lignesDeQuittee(appel('nouvelles'));
    expect(lignes.filter((l) => !estUneDate(l)).map((l) => l.texte)).toEqual([t('coop.reason', { reason: 'room fermée' }), t('coop.badCode')]);
    expect(new Set(lignes.map((l) => l.id)).size, 'deux lignes de la `quittee` portent le même id').toBe(lignes.length);
    expect(lignes.filter(estUneDate), 'la date est dite plus d’une fois').toHaveLength(1);
    expect(appel('nouvelles')).toEqual(RIEN);
  });
});

describe('M5 — la jonction', () => {
  it('entre `rejoindre` et l’assise : sans partie, les ouvertures refusées, `salon` et `nouvelles` répondent ; quitter l’abandonne', async () => {
    const { appel } = invite();
    const z = (appel('salon', { type: 'rejoindre', args: ['ABC234', 'Anna'] }) as unknown as { zones: ZonesDuSalon }).zones;
    expect(gestes(z)).toEqual(['quitter']);
    for (const m of ['jouer', 'lancer', 'roster', 'creation', 'vue']) expect(erreurDe(appel(m, m === 'jouer' ? { type: 'terminerLeTour' } : m === 'lancer' ? { lancer: 'arene' } : undefined)).message, m).toMatch(/aucune partie/);
    for (const [m, e] of [['ouvrir', {}], ['charger', { charger: AUTO_SLOT }], ['demarrer', { scenario: 'voyage' }]] as const) expect(erreurDe(appel(m, e)).message, m).toBe(`${m} : un salon se rejoint ; quitter le salon d’abord`);
    expect(appel('nouvelles')).toEqual(RIEN);
    expect(gestes(zonesDe(appel))).toEqual(['quitter']);
    expect(gestes((appel('salon', { salon: 'quitter' }) as unknown as { zones: ZonesDuSalon }).zones)).toEqual(['heberger', 'rejoindre']);
    expect(quitteeDe(appel('nouvelles'))).toEqual([]);
    expect(appel('nouvelles')).toEqual(RIEN);
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeSocket.instances.every((s) => s.closedWith !== null), 'une socket reste ouverte').toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(appel('ouvrir', { graine: 1 }), 'une partie s’ouvre après la jonction abandonnée').toMatchObject({ ok: true });
  });

  it('le code refusé par le relay, le délai écoulé, le code mal formé : `quittee` avec son texte, les formulaires de nouveau', async () => {
    const { appel } = invite();
    for (const [code, finir, texte] of [
      ['ABC234', async () => { FakeSocket.last!.dropFromServer(4404, 'room inconnue'); }, 'room inconnue'],
      ['ABC234', () => vi.advanceTimersByTimeAsync(15_000), t('coop.joinFailed')],
      ['abc-23', async () => {}, t('coop.badCode')],
    ] as const) {
      appel('salon', { type: 'rejoindre', args: [code, 'Anna'] });
      await finir();
      await vi.advanceTimersByTimeAsync(0);
      expect(quitteeDe(appel('nouvelles')), code).toEqual([texte]);
      const z = zonesDe(appel);
      expect([gestes(z), z['salon.etat']], texte).toEqual([['heberger', 'rejoindre'], []]);
      expect(vi.getTimerCount(), texte).toBe(0);
    }
  });
});

describe('M6, M7, M8 — chez un invité', () => {
  it('M6 (a) — le stockage du jeton lève à l’assise : la levée dite, `coop.joinFailed` au délai, aucune minuterie', async () => {
    const { appel } = invite(reseau({ stockage: () => ({ getItem: () => null, setItem: () => { throw new Error('stockage plein'); } }) }));
    appel('salon', { type: 'rejoindre', args: ['ABC234', 'Anna'] });
    const ws = FakeSocket.last!;
    ws.open();
    ws.receive(JSON.stringify({ evt: 'seated', seat: 1, token: 'TOK' }));
    expect(appel('erreursGlobales')).toEqual({ ok: true, erreurs: [{ message: 'stockage plein', source: 'reseau' }] });
    expect(gestes(zonesDe(appel))).toEqual(['quitter']);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(quitteeDe(appel('nouvelles'))).toEqual([t('coop.joinFailed')]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('M6 (a) — le stockage du jeton lève à la lecture : la levée dite, `coop.joinFailed`, plus de jonction, `ouvrir` ensuite', async () => {
    const { appel } = invite(reseau({ stockage: () => ({ getItem: () => { throw new Error('lecture impossible'); }, setItem: () => {} }) }));
    expect(appel('salon', { type: 'rejoindre', args: ['ABC234', 'Anna'] })).toMatchObject({ ok: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(appel('erreursGlobales')).toEqual({ ok: true, erreurs: [{ message: 'lecture impossible', source: 'reseau' }] });
    expect(quitteeDe(appel('nouvelles'))).toEqual([t('coop.joinFailed')]);
    expect(gestes(zonesDe(appel))).toEqual(['heberger', 'rejoindre']);
    expect(vi.getTimerCount()).toBe(0);
    expect(appel('ouvrir', { graine: 1 }), 'la jonction tient encore').toMatchObject({ ok: true });
  });

  it('M6 (b) — un instantané que `recevoir` ne sait pas appliquer : la levée dite, le suivant appliqué', async () => {
    const { instantanes } = await tramesDeLHote();
    const { appel } = invite();
    const ws = await assis(appel);
    suiteDe(appel('nouvelles'));
    await recevoir(ws, serializeMessage({ kind: 'snapshot', data: { campaignDoc: { scenes: 3 } } }));
    expect((appel('erreursGlobales') as unknown as { erreurs: { source: string }[] }).erreurs.map((e) => e.source)).toEqual(['reseau']);
    await recevoir(ws, instantanes[instantanes.length - 1]);
    expect(suiteDe(appel('nouvelles')).vue.projection.scene, 'l’instantané suivant n’est pas appliqué').not.toBeNull();
  });

  it('M7 — un miroir clos qui a programmé un jeton : la partie que `ouvrir` ouvre numérote ses jetons à la suite', async () => {
    const instantane = await combatDeLHote();
    const { appel } = invite();
    appel('reglages', { type: 'preference', args: ['combat-cadence', 'auto'] });
    const ws = await assis(appel);
    await recevoir(ws, instantane);
    const programmes = suiteDe(appel('nouvelles')).programmes.map((j) => j.id);
    expect(programmes.length, 'témoin : l’auto-cadence du miroir n’a rien programmé').toBeGreaterThan(0);
    appel('salon', { salon: 'quitter' });
    quitteeDe(appel('nouvelles'));
    const ouverte = suiteDe(appel('ouvrir', { graine: 7 }));
    const recrue = suiteDe(appel('jouer', bouton(ouverte.vue.zones['groupe.pretires'], 'pretire/wanda-weltschmertz', 'recruter').jeu));
    expect(recrue.programmes.map((j) => j.id)[0]).toBe(Math.max(...programmes) + 1);
  });

  it('M7 — un second `rejoindre` ouvre un miroir neuf : son premier instantané ne dit aucune ligne', async () => {
    const { instantanes } = await tramesDeLHote();
    const { appel } = invite();
    let ws = await assis(appel);
    await recevoir(ws, instantanes[0]);
    suiteDe(appel('nouvelles'));
    appel('salon', { salon: 'quitter' });
    quitteeDe(appel('nouvelles'));
    ws = await assis(appel);
    await recevoir(ws, instantanes[instantanes.length - 1]);
    expect(suiteDe(appel('nouvelles')).journal).toEqual([]);
  });

  it('M8 — l’hôte absent, hors appel : `nouvelles` rend une `Suite`, `salon.etat` montre le lien', async () => {
    const { appel } = invite();
    const ws = await assis(appel);
    suiteDe(appel('nouvelles'));
    expect(appel('nouvelles')).toEqual(RIEN);
    ws.receive(JSON.stringify({ evt: 'host-down' }));
    suiteDe(appel('nouvelles'));
    expect(zonesDe(appel)['salon.etat'].map((l) => l.texte)).toContain(t('coop.invite.attente.hoteAbsent'));
  });
});
