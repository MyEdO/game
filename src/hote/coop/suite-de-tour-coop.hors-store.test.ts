/**
 * Suite du tour d'IA et frappe pilotée en coop (#3058, #3059, #3157, #3839).
 */
import { afterEach, describe, it, expect } from 'vitest';
import { FakeTransport } from './transport.testkit';
import { HostSession, GuestSession } from './session';
import { ENTREES_DU_BANC, ouvrirLeBanc, surUnBancHorsTest, type Banc } from '../../noyau/banc.testkit';
import { aiTurnLog, clearAiTurnLog, maybeRunEnemyTurn } from '../../noyau/combatFlow';
import { seedBattleRng } from '../../noyau/battleRng';
import { appliquerLInstantane, instantaneDeLaCoop } from '../../noyau/coop';
import { appliquerLIntentionDUnSiege } from '../../noyau/intentionsDeSiege';
import { controlsActive, withActingSeat } from '../../noyau/netOwnership';
import { creerPartie, type ResultatDeLAppel } from '../../noyau/partie';
import { horlogeVirtuelle } from '../../noyau/horlogeVirtuelle';
import { cadence, resetCadence, setCadence, type Cadence } from '../../engine/cadence';
import { gesteDuVerbe, SANS_PISTE } from '../geste';
import { tenueDesJetons } from '../partie';
import { etatInitialDuJeu, type BattleState, type NetState, type TourEnCours } from '../../noyau/etat';
import { creerActionsDuReseau } from '../../noyau/reseau';
import type { Set } from '../../noyau/flowTypes';
import { PSY } from '../../engine/psychology';
import { t } from '../../i18n';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant, Weapon } from '../../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';
import { nomDe } from '../../engine/nom';

afterEach(resetCadence);

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const mk = (id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [sword], advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(40),
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 }) as unknown as Combatant);

/** La table : l'hôte au siège 0, l'invité au siège 1, qui possède `h2`. */
const NET = (mode: 'hote' | 'invite', mySeat: number): NetState => ({
  mode, mySeat, roomCode: 'ABCDEF', seatNames: { 0: 'Hôte', 1: 'Antoine' }, presence: {},
  connection: 'connecte', hoteAbsent: false, ownership: { h2: 1 }, slots: [1, 1, 0, 0], rangs: {},
});

function etatDeCharge(chargeur: Combatant, charge: Combatant) {
  chargeur.pos = { x: 4, y: 0 };
  charge.pos = { x: 0, y: 0 };
  // LDB 10 l.500
  charge.talents = [{ talentId: 'frappe-reactive', times: 1 }] as never;
  charge.characteristics.initiative = 99;
  const tiers = [chargeur, charge].some((c) => c.id === 'h2') ? 'allie' : 'h2';
  const combatants = [chargeur, charge, mk(tiers, 'heros', { x: 9, y: 9 })];
  const ids = combatants.map((c) => c.id);
  const battle = {
    combatants, order: ids, baseOrder: ids, turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  return {
    battle, mode: 'battle' as const, scene: testScene(), party: combatants.filter((c) => c.kind === 'heros'), net: NET('hote', 0),
  };
}

function poserLaCharge(banc: Banc, chargeur: Combatant, charge: Combatant, cadenceHote: Cadence) {
  setCadence(cadenceHote);
  clearAiTurnLog();
  seedBattleRng(2);
  banc.setState(etatDeCharge(chargeur, charge));
}

function relierLeBanc(banc: Pick<Banc, 'getState'>) {
  const recus: Record<string, unknown>[] = [];
  const intentions: string[] = [];
  const refus: string[] = [];
  let hoteOuvert = true;
  const host = new HostSession({
    build: 'test',
    applyIntent: (action, args, siege) => {
      intentions.push(action);
      if (!hoteOuvert) return;
      const geste = withActingSeat(siege, () => gesteDuVerbe(banc.getState(), { type: action, args }, SANS_PISTE));
      let texte: string | undefined;
      appliquerLIntentionDUnSiege(banc.getState, siege, geste.type, geste.args, (message) => { texte = message; });
      return texte;
    },
    getSnapshot: () => instantaneDeLaCoop(banc.getState()),
  });
  const [a, b] = FakeTransport.pair();
  const guest = new GuestSession({
    build: 'test', label: 'Antoine',
    applySnapshot: (data) => { recus.push(data); },
    onIntentRefused: (texte) => { refus.push(texte); },
  });
  host.addGuest(a, 1);
  guest.connect(b);

  return { host, guest, recus, intentions, refus, cloreLeBancHote: () => { hoteOuvert = false; } };
}

function jouerUnTour(banc: Banc, liaison: ReturnType<typeof relierLeBanc>, contesterLaFin = false) {
  const { host, guest } = liaison;
  const tours = [banc.getState().battle!.turn];
  const armements = new Set<number>();
  let defense: string | undefined;
  let diffuse: TourEnCours | undefined;
  let contestation: { avant: number; apres: number } | undefined;
  maybeRunEnemyTurn(banc.getState, banc.setState);
  for (let i = 0; i < 50 && banc.getState().battle!.turn === 0; i++) {
    if (!banc.jusquALaProchaine()) break;
    const s = banc.getState();
    const tour = s.battle!.tourEnCours;
    const suite = tour?.suite;
    defense ??= s.pendingDefense?.defenderId;
    if (suite?.geste.kind === 'frappe') armements.add(suite.n);
    diffuse ??= suite ? tour : undefined;
    if (contesterLaFin && !contestation && s.battle!.acted && suite?.geste.kind === 'avancer') {
      const avant = s.battle!.turn;
      guest.sendIntent('terminerLeTour', []);
      contestation = { avant, apres: banc.getState().battle!.turn };
    }
    const turn = banc.getState().battle!.turn;
    if (turn !== tours[tours.length - 1]) tours.push(turn);
    host.broadcastSnapshot();
  }
  return { defense, diffuse, armements: armements.size, tours, contestation };
}

const decisionsDuTour = (id: string) => aiTurnLog().filter((r) => r.id === id && r.round === 1).length;
const frappesDuTour = (id: string, log: BattleState['log']) => log.filter((l) => l.kind === 'attaque' && l.actorId === id).length;

function rejouerChezLInvite(liaison: ReturnType<typeof relierLeBanc>, cadenceInvite: Cadence) {
  const { guest, recus } = liaison;
  const miroir = creerPartie({ ...etatInitialDuJeu(), net: NET('invite', 1) }, { ...ENTREES_DU_BANC, cadence: cadenceInvite });
  const jetons = tenueDesJetons(miroir);
  const horloge = horlogeVirtuelle((id) => jetons.programmes(jetons.reprendre(id)));
  let programmes = 0;
  let reprises = 0;
  let ecritures = 0;
  let instantanesStables = true;
  const controles = [];
  try {
    miroir.etat().transmettreLesIntentions((action, args) => guest.sendIntent(action, args));
    for (const data of recus) {
      const reception = miroir.recevoir(data);
      const planifies = jetons.programmes(reception);
      programmes += planifies.length;
      horloge.armer(planifies);
      const avant = JSON.stringify(miroir.etat());
      controles.push(controlsActive(miroir.etat()));
      const desabonner = miroir.abonner(() => { ecritures++; });
      for (let i = 0; i < 50 && horloge.enAttente(); i++) reprises += horloge.jusquALaProchaine();
      desabonner();
      instantanesStables &&= JSON.stringify(miroir.etat()) === avant;
    }
    return { programmes, reprises, ecritures, instantanesStables, controles, pref: cadence(), etat: miroir.etat() };
  } finally {
    miroir.fermer();
    guest.close();
  }
}

describe('#3058 — coop : le tour d’IA de l’hôte charge un porteur de Frappe réactive', () => {
  for (const [nom, chargeur, charge] of [
    ['l’IA ennemie de l’hôte charge un héros de l’hôte', () => mk('e', 'ennemi', { x: 0, y: 0 }), () => mk('h', 'heros', { x: 0, y: 0 })],
    ['le héros de l’hôte, en Auto-combat, charge un ennemi', () => mk('h', 'heros', { x: 0, y: 0 }), () => mk('e', 'ennemi', { x: 0, y: 0 })],
  ] as const) {
    it(`${nom} (graine 2) : chez l’hôte, UNE décision, UNE frappe, le tour avance ; l’invité applique le tour d’IA diffusé`, () => {
      const c = chargeur();
      const banc = ouvrirLeBanc();
      poserLaCharge(banc, c, charge(), 'auto');
      const liaison = relierLeBanc(banc);
      const { defense, diffuse } = jouerUnTour(banc, liaison);
      const { recus, guest } = liaison;
      guest.close();
      const log = banc.getState().battle!.log;
      expect(defense, 'LDB 10 l.500').toBeDefined();
      expect(decisionsDuTour(c.id), 'une décision').toBe(1);
      expect(frappesDuTour(c.id, log), 'une frappe').toBe(1);
      expect(banc.getState().battle!.turn, 'le tour a avancé').toBe(1);

      expect(diffuse?.cle, 'chemin : un tour d’IA à suite a été diffusé').toBe(`1:0:${c.id}`);
      const chezLInvite = appliquerLInstantane(recus[recus.length - 1], { ...etatInitialDuJeu(), net: NET('invite', 1) }).etat;
      expect(chezLInvite.net.mode, 'l’instantané est appliqué chez l’invité').toBe('invite');
      expect(chezLInvite.battle?.tourEnCours, 'l’invité porte le tour d’IA de l’hôte').toEqual(banc.getState().battle!.tourEnCours);
    });
  }
});

describe('#3157 — l’hôte seul exécute le tour automatique', () => {
  it.each([
    { chargeur: 'h2', genre: 'heros', charge: 'e' },
    { chargeur: 'e', genre: 'ennemi', charge: 'h2' },
  ] as const)('charge de $chargeur sur $charge (graine 2)', ({ chargeur, genre, charge }) => {
    const { liaison, tour, decisions, frappes } = surUnBancHorsTest((banc) => {
      poserLaCharge(banc, mk(chargeur, genre, { x: 0, y: 0 }), mk(charge, genre === 'heros' ? 'ennemi' : 'heros', { x: 0, y: 0 }), 'auto');
      const liaison = relierLeBanc(banc);
      const tour = jouerUnTour(banc, liaison, genre === 'heros');
      liaison.cloreLeBancHote();
      return { liaison, tour, decisions: decisionsDuTour(chargeur), frappes: frappesDuTour(chargeur, banc.getState().battle!.log) };
    });
    expect(liaison.guest.joined).toBe(true);
    const miroir = rejouerChezLInvite(liaison, 'auto');
    expect({ decisions, armements: tour.armements, frappes, tours: tour.tours }, 'tour autoritaire').toEqual({
      decisions: 1, armements: 1, frappes: 1, tours: [0, 1],
    });
    expect(tour.defense, 'LDB 10 l.500').toBe('h2');
    if (genre === 'heros') {
      expect(tour.contestation, 'l’intention tardive ne termine pas le tour').toEqual({ avant: 0, apres: 0 });
      expect(liaison.refus).toHaveLength(1);
    }
    expect({
      programmes: miroir.programmes, reprises: miroir.reprises, ecritures: miroir.ecritures,
      decisions: decisionsDuTour(chargeur) - decisions, intentions: liaison.intentions,
      instantanesStables: miroir.instantanesStables,
    }, 'exécution chez le miroir').toEqual({
      programmes: 0, reprises: 0, ecritures: 0, decisions: 0,
      intentions: tour.contestation ? ['terminerLeTour'] : [], instantanesStables: true,
    });
    expect(miroir.etat.battle?.turn).toBe(1);
    expect(frappesDuTour(chargeur, miroir.etat.battle!.log)).toBe(1);
  });

  it.each([
    { hote: 'auto', invite: 'manuel', controle: false },
    { hote: 'manuel', invite: 'auto', controle: true },
    { hote: 'rapide', invite: 'auto', controle: true },
  ] as const)('hôte $hote, invité $invite : le premier instantané décide le contrôle du tour', ({ hote, invite, controle }) => {
    const liaison = surUnBancHorsTest((banc) => {
      poserLaCharge(banc, mk('h2', 'heros', { x: 0, y: 0 }), mk('e', 'ennemi', { x: 0, y: 0 }), hote);
      const liaison = relierLeBanc(banc);
      liaison.cloreLeBancHote();
      return liaison;
    });
    const miroir = rejouerChezLInvite(liaison, invite);
    expect({ controles: miroir.controles, preference: miroir.pref, programmes: miroir.programmes }).toEqual({
      controles: [controle], preference: invite, programmes: 0,
    });
  });
});

describe('#3839 — la suite du déplacement de combat appartient à l’hôte', () => {
  it.each([
    { chargeur: 'h2', genre: 'heros', charge: 'e' },
    { chargeur: 'e', genre: 'ennemi', charge: 'h2' },
  ] as const)('charge de $chargeur : le jeton passe dans l’horloge d’un hôte sans rendu', ({ chargeur, genre, charge }) => {
    clearAiTurnLog();
    const etat = etatDeCharge(mk(chargeur, genre, { x: 0, y: 0 }), mk(charge, genre === 'heros' ? 'ennemi' : 'heros', { x: 0, y: 0 }));
    const hote = creerPartie({ ...etatInitialDuJeu(), screen: 'campaign', ...etat }, { ...ENTREES_DU_BANC, graine: 2, cadence: 'auto' });
    const liaison = relierLeBanc({ getState: hote.etat });
    const jetons = tenueDesJetons(hote);
    const jetonsDeMarche: number[] = [];
    const reprisesDeMarche: number[] = [];
    const traiter = (resultat: ResultatDeLAppel) => {
      const programmes = jetons.programmes(resultat);
      for (const e of resultat.evenements) {
        if (e.type !== 'emis' || e.evt !== 'anim_move' || e.payload.id !== chargeur) continue;
        expect(e.payload.path.length).toBeGreaterThan(1);
        expect(hote.etat().battle!.tourEnCours?.suite?.geste.kind).toBe('frappe');
        expect(frappesDuTour(chargeur, hote.etat().battle!.log)).toBe(0);
        const lies = programmes.filter((p) => 'apresDeplacement' in p);
        expect(lies).toEqual([expect.objectContaining({ apresDeplacement: [chargeur] })]);
        jetonsDeMarche.push(lies[0].id);
      }
      liaison.host.broadcastSnapshot();
      return programmes;
    };
    const horloge = horlogeVirtuelle((id) => {
      if (jetonsDeMarche.includes(id)) reprisesDeMarche.push(id);
      return traiter(jetons.reprendre(id));
    });
    try {
      horloge.armer(traiter(hote.reprendreLaCadence()));
      for (let i = 0; i < 50 && hote.etat().battle!.turn === 0 && horloge.enAttente(); i++) horloge.jusquALaProchaine();
      expect(jetonsDeMarche).toHaveLength(1);
      expect(reprisesDeMarche).toEqual(jetonsDeMarche);
      expect(() => jetons.reprendre(jetonsDeMarche[0])).toThrow(/jeton inconnu/);
      expect([hote.etat().battle!.turn, decisionsDuTour(chargeur), frappesDuTour(chargeur, hote.etat().battle!.log)]).toEqual([1, 1, 1]);
    } finally {
      liaison.cloreLeBancHote();
      hote.fermer();
    }

    const miroir = rejouerChezLInvite(liaison, 'auto');
    expect([miroir.programmes, miroir.reprises, miroir.ecritures, decisionsDuTour(chargeur)]).toEqual([0, 0, 0, 1]);
    expect(liaison.intentions).toEqual([]);
    expect(miroir.instantanesStables).toBe(true);
    expect([miroir.etat.battle?.turn, frappesDuTour(chargeur, miroir.etat.battle!.log)]).toEqual([1, 1]);
  });
});

describe('#3059 — coop : seul l’hôte rejoue la frappe pilotée d’un invité', () => {
  it('l’invité charge par intent (graine 4) ; chez l’invité, la frappe parquée de l’instantané ne se rejoue pas, même fenêtre close', () => {
    const banc = ouvrirLeBanc({ cadence: 'manuel' });
    seedBattleRng(4);
    const h = mk('h', 'heros', { x: 4, y: 0 });
    const e = mk('e', 'ennemi', { x: 0, y: 0 });
    e.talents = [{ talentId: 'frappe-reactive', times: 1 }] as never;
    e.characteristics.initiative = 99;
    const ids = [h.id, e.id];
    const battle = {
      combatants: [h, e], order: ids, baseOrder: ids, turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as unknown as BattleState;
    banc.setState({ battle, mode: 'battle', scene: testScene(), party: [h], pendingDefense: null, pendingAttack: null, pendingCascade: null, suspendedCascades: [], net: { ...NET('hote', 0), ownership: { h: 1 } } } as never);
    expect(appliquerLIntentionDUnSiege(banc.getState, 1, 'cliquerLaCase', [{ x: 0, y: 0 }, 'e', { confirm: true, intentionId: 'charge' }]), 'chemin : l’intent est appliqué chez l’hôte').toBe('appliquee');
    banc.reprendreTout();
    const tour = banc.getState().battle!.tourEnCours;
    expect([tour?.suite?.geste.kind, tour?.parquee, !!banc.getState().pendingDefense], 'chemin : chez l’hôte, la frappe échue pendant la défense est parquée').toEqual(['frappePilotee', true, true]);
    const chezLInvite = appliquerLInstantane(instantaneDeLaCoop(banc.getState()), { ...etatInitialDuJeu(), net: { ...NET('invite', 1), ownership: { h: 1 } } }).etat;
    banc.setState({ ...chezLInvite, pendingDefense: null, pendingCascade: null, suspendedCascades: [] } as never);
    banc.getState().reprendreLaCadence();
    banc.reprendreTout();
    expect([banc.getState().net.mode, banc.getState().pendingAttack], 'l’invité n’ouvre aucune frappe de lui-même').toEqual(['invite', null]);
  });
});

describe('#3235 — le verdict de l’hôte revient au siège qui a joué', () => {
  it('dit une fois chaque refus à son auteur, même si son miroir diffère de l’état qui juge', () => {
    const h = mk('h2', 'heros', { x: 10, y: 10 });
    const proche = mk('proche', 'ennemi', { x: 11, y: 10 });
    const loin = mk('loin', 'ennemi', { x: 13, y: 10 });
    const ids = [h.id, proche.id, loin.id];
    const battle = {
      combatants: [h, proche, loin], order: ids, baseOrder: ids, turn: 0, round: 1,
      action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as BattleState;
    const banc = ouvrirLeBanc({
      cadence: 'manuel',
      etat: { battle, mode: 'battle', scene: testScene(), party: [h], net: NET('hote', 0) },
    });
    const get = banc.getState;
    const sieges: number[] = [];
    const host = new HostSession({
      build: 'test',
      applyIntent: (action, args, siege) => {
        sieges.push(siege);
        let refus: string | undefined;
        appliquerLIntentionDUnSiege(get, siege, action, args, (texte) => { refus = texte; });
        return refus;
      },
      getSnapshot: () => instantaneDeLaCoop(get()),
    });

    const inviter = (siege: number) => {
      const recus: string[] = [];
      const [a, b] = FakeTransport.pair();
      let miroir: ReturnType<typeof get> = {
        ...get(), ...etatInitialDuJeu(), net: NET('invite', siege),
        cliquerLaCase: () => {
          throw new Error('Le clic a été joué chez l’invité');
        },
      };
      const set: Set = (partiel) => { miroir = { ...miroir, ...(typeof partiel === 'function' ? partiel(miroir) : partiel) }; };
      const guest = new GuestSession({
        build: 'test', label: `Siège ${siege}`,
        applySnapshot: (data) => { miroir = { ...miroir, ...appliquerLInstantane(data, miroir).etat }; },
        onIntentRefused: (texte) => { recus.push(texte); },
      });
      creerActionsDuReseau(() => miroir, set).transmettreLesIntentions((action, args) => guest.sendIntent(action, args));
      host.addGuest(a, siege);
      guest.connect(b);
      return {
        cliquer: (...args: Parameters<ReturnType<typeof get>['cliquerLaCase']>) => { miroir.cliquerLaCase(...args); },
        recus,
        etat: () => miroir,
      };
    };
    const auteur = inviter(1);
    const tiers = inviter(2);
    const journal = [...get().journal];
    const verifier = (refusAuteur: string[], refusTiers: string[]) => {
      host.broadcastSnapshot();
      expect(get().refus).toBeNull();
      expect([auteur.recus, tiers.recus]).toEqual([refusAuteur, refusTiers]);
      expect([get().journal, auteur.etat().journal, tiers.etat().journal]).toEqual([journal, journal, journal]);
    };

    const course = { x: 4, y: 10 };
    const refusCourse = t('cs.refusCourseNonArmee');
    auteur.cliquer(course, undefined, { confirm: true });
    verifier([refusCourse], []);
    auteur.cliquer(course, undefined, { confirm: true });
    verifier([refusCourse, refusCourse], []);
    expect(h.pos).toEqual({ x: 10, y: 10 });

    const marche = { x: 9, y: 10 };
    auteur.cliquer(marche, undefined, { confirm: true });
    verifier([refusCourse, refusCourse], []);
    expect(auteur.etat().battle?.combatants[0].pos).toEqual(marche);
    expect(get().battle?.combatants[0].pos).toEqual(marche);

    expect(auteur.etat().battle?.combatants[0].psychState).toBeUndefined();
    h.psychState = [{ type: PSY.frenesie }];
    auteur.cliquer(loin.pos!, loin.id, { confirm: true });
    const refusAttaque = t('cs.frenzyMustAttack', { name: nomDe(h), foe: nomDe(proche) });
    const pourLAuteur = [refusCourse, refusCourse, refusAttaque];
    verifier(pourLAuteur, []);
    expect(get().pendingAttack).toBeNull();

    banc.setState({ net: { ...get().net, ownership: { [h.id]: 2 } } });
    host.broadcastSnapshot();
    banc.setState({ net: { ...get().net, ownership: { [h.id]: 1 } } });
    expect(tiers.etat().net.ownership[h.id]).toBe(2);
    tiers.cliquer(loin.pos!, loin.id, { confirm: true });
    const refusPossession = t('coop.intentRefused');
    verifier(pourLAuteur, [refusPossession]);
    expect(get().pendingAttack).toBeNull();

    banc.setState({ net: { ...get().net, ownership: { [h.id]: 0 } } });
    get().cliquerLaCase(loin.pos!, loin.id, { confirm: true });
    expect(get().refus?.texte).toBe(refusAttaque);
    host.broadcastSnapshot();
    expect([auteur.recus, tiers.recus]).toEqual([pourLAuteur, [refusPossession]]);
    expect([auteur.etat().refus, tiers.etat().refus]).toEqual([null, null]);
    expect(sieges).toEqual([1, 1, 1, 1, 2]);
  });
});
