import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './monde/scene';
import type { WorldMap } from './worldMap';
import { applyEffects, jouerFlowEntier, runFlow } from './combatEffects';
import {
  applyVesselCritical,
  buildSeaPlan,
  continueSeaDayAfterCascade,
  finalizePortArrivalTo,
  installerLAmelioration,
  portCareenVessel,
  portRepairVessel,
  runSeaDay,
  vesselManann,
} from './seaVoyageFlow';
import { rollPortRepair } from '../engine/shipBuild';
import { REPARATION } from '../engine/seaNavigation';
import { findVehicleById } from '../data';
import { rollShipCritical } from '../engine/shipCritical';
import { makeRNG, rollDice, type RNG } from '../engine/dice';
import { imposerLesD100 } from './battleRng.testkit';
import { avanceEtapeCascade, draineCascade } from './cascade.testkit';
import { acheterAuMarche } from './cargaison.testkit';
import { applierDe } from './cascade';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { MINUTES_PER_DAY } from '../engine/clock';
import type { ModificateurDuNavire } from '../engine/seaVoyage';
import type { Jeu } from './etat';
import { fixtureText } from '../i18n/fixtureText';
import { setDataset, resetData } from '../data/overrides';
import { BOARD_EVENTS, FAST_VOYAGE_PALIERS, PORT_EVENTS } from '../engine/seaVoyage';
import { lierLesTirages, tiragesDuFlow, type Flow } from '../engine/flowCore';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import type { Combatant } from '../engine/types';
import { itemFromTrappingById } from '../engine/items';
import { shipboardSouls } from './shipCrew';
import { t } from '../i18n';
import { weeklyCrewWageBrass } from '../engine/crewMorale';
import { applyOps, nomDeSource, type GameOp } from '../engine/ops';
import { findSeaHazard } from '../engine/seaPerils';
import { gameOpSchema } from '../data/schemas/grammaire/mecanique';
import { formatMoney, fromBrass, toBrass } from '../engine/money';
import { rule, setRule, resetRule } from '../engine/policy';
import { checkBattleOver } from './combatFlow';
import { humanizeFlow } from './codex/humanize';
import { currentPort, devisDAchatEnPort, ouvrirLePort, vivresAchetables } from './portFlow';
import { CAMPAIGN_VESSEL_CARRIER_ID } from './carriers';
import type { VivresDeCale } from '../engine/provisions';
import { setVesselSchema, adjustVesselSchema } from '../data/schemas/defs-scenes/effets';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);

const carte: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: { id: 'port-a' } },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: { id: 'port-b' }, port: { taille: 3, richesse: 3, production: ['bois-mer'] } },
  ],
  routes: [{ id: 'r1', a: { id: 'A' }, b: { id: 'B' }, km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

function etatFrais(): void {
  seedBattleRng(1);
  set({
    party: tousLesHerosDeScenario(idsDeTest).slice(0, 3),
    scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null, worldMap: carte, lieu: 'A', travelPlan: null, pendingCascade: null, suspendedCascades: [],
    flags: {}, journal: [],
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
  });
}

const FRAIS = 'nourriture-courses-journee', PRESERVEE = 'ration-nourriture-preservee', BISCUITS = 'ration-biscuits-de-mer';
const vivres = (v: Record<string, number>) => v as VivresDeCale;

const drapeau = (flag: string): Flow => ({ kind: 'effet', effet: { type: 'setFlag', flag, value: true } as Effect as never });

describe('runFlow — nœud `choice` (#1652 G1)', () => {
  beforeEach(etatFrais);

  const flux: Flow = {
    kind: 'sequence',
    etapes: [{ kind: 'choix', invite: 'Payer', oui: drapeau('oui'), non: drapeau('non') }, drapeau('suite')],
  };

  it('ouvre une décision au meneur ; la suite attend la décision', () => {
    jouerFlowEntier(runFlow(get, set, flux, 'Décision'));
    const etape = get().pendingCascade?.participants[0];
    expect(etape?.kind).toBe('choixDeFlux');
    expect(etape?.actorId).toBe(get().party[0].id);
    expect(get().flags).toEqual({});
  });

  it.each([['oui', 'oui', 'non'], ['non', 'non', 'oui']])('« %s » joue sa branche, puis la suite du Flow', (cle, joue, ecarte) => {
    jouerFlowEntier(runFlow(get, set, flux, 'Décision'));
    avanceEtapeCascade(get, undefined, () => cle);
    expect(get().pendingCascade).toBeNull();
    expect(get().flags[joue]).toBe(true);
    expect(get().flags[ecarte]).toBeUndefined();
    expect(get().flags.suite).toBe(true);
  });

  it('un coût d’Avantage n’est pas offert hors combat (LDB 14 l.219) : la branche « non » se joue', () => {
    jouerFlowEntier(runFlow(get, set, { kind: 'choix', invite: 'Payer', coutEnAvantage: 1, oui: drapeau('oui'), non: drapeau('non') }, 'Décision'));
    expect(get().pendingCascade).toBeNull();
    expect(get().flags).toEqual({ non: true });
  });
});

describe('cible `navire` d’un EffectOp (#1652 G2 — MDG 15 l.83-125, l.152-153)', () => {
  beforeEach(etatFrais);

  const surLeNavire = (ops: unknown[]): Effect => ({ type: 'ops', on: 'navire', ops } as never);

  it('à quai : Blessures, Moral et Coup critique sur le navire de campagne, persistés sur `vessel`', () => {
    applyEffects(get, set, [surLeNavire([
      { op: 'wounds', amount: 5 },
      { op: 'shipMorale', delta: { sign: -1, dice: { n: 0, sides: 10, plus: 3 } } },
      { op: 'manann', delta: { sign: 1, dice: { n: 0, sides: 10, plus: 4 } } },
      { op: 'shipCritical', location: 'coque', count: 1 },
    ])]);
    const v = get().vessel!;
    expect(v.wounds!.max - v.wounds!.current).toBe(5);
    expect(v.morale.score).toBe(72);
    expect(v.manann!.score).toBe(4);
    expect(v.criticals).toHaveLength(1);
  });

  it('en voyage : la coque de TRAJET subit, et `vessel.wounds` la suit', () => {
    set({ travelPlan: buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0])! });
    const avant = (get().travelPlan!.vehicle as Combatant).wounds.current;
    applyEffects(get, set, [surLeNavire([{ op: 'wounds', amount: 4 }])]);
    expect((get().travelPlan!.vehicle as Combatant).wounds.current).toBe(avant - 4);
    expect(get().vessel!.wounds!.current).toBe(avant - 4);
  });

  it('une op de navire hors de la cible `navire` lève, nommée', () => {
    expect(() => applyEffects(get, set, [{ type: 'ops', on: 'groupe', ops: [{ op: 'shipMorale', delta: { sign: 1, dice: { n: 1, sides: 10 } } }] } as never]))
      .toThrow(/shipMorale ne vise que le navire/);
  });
});

describe('Présages divins : seul un Prêtre ou une Nonne de Manann prie (MDG 15 l.197-198, l.230-232)', () => {
  beforeEach(etatFrais);
  afterEach(() => resetData());

  function jour(evenement: string): void {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: evenement } } });
    runSeaDay(get, set);
  }
  const prier = (talents: Combatant['talents']): void => {
    const [h, ...reste] = get().party;
    set({ party: [{ ...h, skills: [...(h.skills ?? []), { id: 'priere', characteristic: 'sociabilite', advances: 20 }], talents: [...h.talents, ...talents] }, ...reste] });
  };
  const etapeDePriere = () => get().pendingCascade?.participants.find((s) => s.stake && 'key' in s.stake && s.stake.key?.kind === 'mer-priere-manann');

  it('albatros, sans Prêtre de Manann (Prière seule) : aucun Test, l’Humeur et le Moral tombent', () => {
    prier([]);
    jour('presage-divin-albatros');
    expect(etapeDePriere()).toBeUndefined();
    expect(get().vessel!.manann!.score).toBeLessThan(0);
    expect(get().vessel!.morale.score).toBeLessThan(75);
  });

  it('albatros, avec un Prêtre de Manann (Béni (Manann)) : le Test de Prière s’ouvre, rien n’est encore appliqué', () => {
    prier([{ talentId: 'beni', spec: 'manann', times: 1 }]);
    jour('presage-divin-albatros');
    expect(etapeDePriere()).toBeDefined();
    expect(get().vessel!.manann?.score ?? 0).toBe(0);
    expect(get().vessel!.morale.score).toBe(75);
  });

  it('feu bleu, sans Prêtre de Manann : rien ne change', () => {
    prier([{ talentId: 'beni', spec: 'sigmar', times: 1 }]);
    jour('presage-divin-feu-bleu');
    expect(etapeDePriere()).toBeUndefined();
    expect(get().vessel!.manann?.score ?? 0).toBe(0);
    expect(get().vessel!.morale.score).toBe(75);
  });

  it('la donnée porte la RAW : albatros −2d10 / −1d10, feu bleu +2d10 / +1d10, Prière Complexe', () => {
    const ops = (id: string) => JSON.stringify(BOARD_EVENTS.find((e) => e.id === id)?.consequence);
    expect(ops('presage-divin-albatros')).toContain('"difficulty":"complexe"');
    expect(ops('presage-divin-albatros')).toContain('{"op":"manann","delta":{"sign":-1,"dice":{"n":2,"sides":10}}}');
    expect(ops('presage-divin-albatros')).toContain('{"op":"shipMorale","delta":{"sign":-1,"dice":{"n":1,"sides":10}}}');
    expect(ops('presage-divin-feu-bleu')).toContain('{"op":"manann","delta":{"sign":1,"dice":{"n":2,"sides":10}}}');
    expect(ops('presage-divin-feu-bleu')).toContain('{"op":"shipMorale","delta":{"sign":1,"dice":{"n":1,"sides":10}}}');
  });
});

describe('Escale : une `consequence` qui suspend reprend AVANT l’arrivée au lieu (#1652 §7)', () => {
  beforeEach(etatFrais);
  afterEach(() => resetData());

  it('le choix de l’événement se tranche, PUIS le groupe arrive au port', () => {
    const choix: Flow = { kind: 'choix', invite: 'Payer', oui: drapeau('paye') };
    setDataset('seaPortEvents', PORT_EVENTS.map(({ min, max, id, label, desc }) => ({ min, max, id, label, desc, consequence: choix })) as never);
    finalizePortArrivalTo(get, set, carte.places[1], true);
    expect(get().pendingCascade?.participants[0].kind).toBe('choixDeFlux');
    expect(get().lieu).toBe('A');
    avanceEtapeCascade(get, undefined, () => 'oui');
    expect(get().flags.paye).toBe(true);
    expect(get().lieu).toBe('B');
  });
});

describe('Navire et climat en grammaire (#1652 lot 2 — MDG 15)', () => {
  beforeEach(etatFrais);
  afterEach(() => resetData());

  function jour(evenement: string): void {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: evenement } } });
    runSeaDay(get, set);
  }
  const etape = (kind: string) => get().pendingCascade?.participants.find((s) => s.kind === kind);
  const ilYA = (jours: number) => get().gameTime + jours * MINUTES_PER_DAY;
  /** Remplace la `consequence` de la rangée de bord `id` (une durée constante rend l'échéance lisible). */
  const consequenceDeBord = (id: string, consequence: Flow) =>
    setDataset('seaBoardEvents', BOARD_EVENTS.map((e) => (e.id === id ? { ...e, consequence } : e)) as never);
  const surLeNavire = (ops: unknown[]): Flow => ({ kind: 'effet', effet: { type: 'ops', on: 'navire', ops } as never });
  /** Échéances d'horloge des effets actifs du héros. */
  const echeances = (h: Combatant): number[] => (h.activeEffects ?? []).flatMap((e) => (e.duration.scale === 'clock' ? [e.duration.until] : []));

  it('Ouragan : Test d’équipage d’Affaler Difficile (–20) ; raté, 3 Coups Critiques au Gréement (l.144-145)', () => {
    jour('ouragan');
    expect(etape('testDEquipage')?.label).toBe('Affaler les voiles');
    avanceEtapeCascade(get, () => 99);
    expect(get().vessel!.criticals).toHaveLength(3);
  });

  it('Ouragan : la difficulté Difficile (–20) descend au Test d’équipage en −2 DR plats (l.144 ; MDG 14 l.13)', () => {
    const ouragan = BOARD_EVENTS.find((e) => e.id === 'ouragan')!.consequence as Extract<Flow, { kind: 'test' }>;
    expect(ouragan.test).toMatchObject({ crewTestType: 'affaler', difficulty: 'difficile' });
    const drPlats = (difficulty: string): number => {
      etatFrais();
      consequenceDeBord('ouragan', { ...ouragan, test: { ...ouragan.test, difficulty } } as Flow);
      jour('ouragan');
      return Number(etape('testDEquipage')?.meta?.aggregateFlatDR ?? 0);
    };
    expect(drPlats('difficile')).toBe(drPlats('intermediaire') - 2);
  });

  it('Ouragan : l’équipage affale à temps, aucun Coup Critique (l.144-145)', () => {
    jour('ouragan');
    avanceEtapeCascade(get, () => 1);
    expect(get().vessel!.criticals ?? []).toHaveLength(0);
  });

  it('Ouragan sans équipage apte à tenter le Test : personne n’affale, les 3 Coups Critiques tombent (l.144-145 ; LDB 09 l.30)', () => {
    set({ party: get().party.map((h) => ({ ...h, outOfRencontre: true })) });
    jour('ouragan');
    expect(etape('testDEquipage')).toBeUndefined();
    expect(get().vessel!.criticals).toHaveLength(3);
  });

  it('Crabes boxeurs : M −1 et Man −1 DR jusqu’au carénage (l.184-185)', () => {
    jour('infestation-de-crabes-boxeurs');
    expect(get().vessel!.modificateurs).toEqual([expect.objectContaining({ m: -1, manDR: -1, jusqua: 'carenage' })]);
  });

  it('un modificateur `navireMod` du navire abaisse le M du jour à la Progression', () => {
    const progression = (modificateurs: ModificateurDuNavire[]): number | undefined => {
      etatFrais();
      set({ vessel: { ...get().vessel!, modificateurs } });
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0])!;
      // Légère brise, vent arrière : aucun pourcentage de vent, le M du jour est le M de base.
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, weather: { ...plan.sea!.weather, vent: 'legere-brise' }, windFrom: 'ouest' } } });
      applierDe('equipage-progression')!(get, set, { id: 'p', kind: 'equipage-progression', label: fixtureText('Progression'), result: { roll: 0, target: 0, sl: 2, success: true } }, undefined, { steps: [], index: 0 });
      return get().travelPlan!.sea!.effMToday;
    };
    const sans = progression([]);
    expect(progression([{ label: 'Crabes', m: -1, jusqua: 'carenage' }])).toBe(sans! - 1);
    expect(progression([{ label: 'Détour', m: -2, jusqua: get().gameTime - 1 }])).toBe(sans);
  });

  it('le carénage lève les modificateurs « jusqu’au carénage », pas les autres (l.185)', () => {
    set({ vessel: { ...get().vessel!, modificateurs: [{ label: 'Crabes', m: -1, manDR: -1, jusqua: 'carenage' }, { label: 'Détour', m: -2, jusqua: ilYA(1) }] } });
    creditBourse(get, set, get().party[0].id, { gold: 100, silver: 0, brass: 0 });
    portCareenVessel(get, set);
    expect(get().vessel!.modificateurs).toEqual([expect.objectContaining({ label: 'Détour' })]);
  });

  it.each([
    ['oui', (v: NonNullable<Jeu['vessel']>, t0: number) => expect(v.modificateurs).toEqual([expect.objectContaining({ m: -2, jusqua: t0 + MINUTES_PER_DAY })])],
    ['non', (v: NonNullable<Jeu['vessel']>) => { expect(v.modificateurs ?? []).toEqual([]); expect(v.morale.score).toBeLessThan(75); }],
  ])('Vaisseau fantôme (littéralement), « %s » : changer de cap (M −2 un jour) ou perdre 2d10 Moral (l.187-188)', (cle, verifie) => {
    jour('vaisseau-fantome-litteralement');
    expect(etape('choixDeFlux')).toBeDefined();
    const t0 = get().gameTime;
    avanceEtapeCascade(get, undefined, () => cle);
    verifie(get().vessel!, t0);
  });

  it('Calme plat : la météo imposée tient au lendemain, puis expire (l.189)', () => {
    consequenceDeBord('calme-plat', surLeNavire([{ op: 'meteoImposee', jours: 3, meteo: { vent: 'calme-plat' } }]));
    jour('calme-plat');
    expect(get().vessel!.meteosImposees).toEqual([expect.objectContaining({ jusqua: ilYA(3), meteo: { vent: 'calme-plat' } })]);
    draineCascade(get);
    expect(get().travelPlan!.sea!.weather.vent).toBe('calme-plat');
  });

  it('une météo imposée au navire tient dès l’appareillage, et pas au-delà de son échéance', () => {
    const vent = (jusqua: number) => {
      etatFrais();
      set({ vessel: { ...get().vessel!, meteosImposees: [{ label: 'Calme plat', jusqua, meteo: { vent: 'calme-plat' } }] } });
      return buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0])!.sea!.weather.vent;
    };
    expect(vent(ilYA(2))).toBe('calme-plat');
    expect(vent(get().gameTime)).not.toBe('calme-plat');
  });

  it('Tempête : chaque matin, 1d10 ≥ 8 aggrave en Violente tempête (l.248)', () => {
    const vent = (de: number) => {
      etatFrais();
      set({ vessel: { ...get().vessel!, meteosImposees: [{ label: 'Tempête', jusqua: ilYA(2), meteo: { vent: 'vent-violent' }, aggravation: { de, seuil: 8, meteo: { vent: 'violente-tempete' } } }] } });
      return buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0])!.sea!.weather.vent;
    };
    expect(vent(8)).toBe('violente-tempete');
    expect(vent(7)).toBe('vent-violent');
  });

  it('Vents inhabituels : les vents dominants soufflent de l’est au lieu de l’ouest (l.196-197 ; MDG 13 l.253-255)', () => {
    const directions = (ventInverse: boolean) => Array.from({ length: 40 }, (_, i) => {
      etatFrais();
      seedBattleRng(i + 1);
      if (ventInverse) set({ vessel: { ...get().vessel!, meteosImposees: [{ label: 'Vents inhabituels', jusqua: ilYA(2), ventInverse: true }] } });
      return buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0])!.sea!.windFrom;
    });
    const compte = (ds: string[], d: string) => ds.filter((x) => x === d).length;
    const normaux = directions(false);
    const inverses = directions(true);
    expect(compte(normaux, 'ouest')).toBeGreaterThan(compte(normaux, 'est'));
    expect(compte(inverses, 'est')).toBeGreaterThan(compte(inverses, 'ouest'));
    // Même graine : seul le résultat « dominant » change de bord (rose des vents, MDG 13 l.252).
    normaux.forEach((d, i) => { if (inverses[i] !== d) expect([d, inverses[i]]).toEqual(['ouest', 'est']); });
  });

  it('Rafale de Ghyran : +2 DR pendant 1d10 jours, échéance d’horloge sur chaque héros (l.211-212)', () => {
    const t0 = get().gameTime;
    jour('rafale-de-ghyran');
    for (const h of get().party) {
      const fins = echeances(h);
      expect(fins).toHaveLength(3);
      expect(new Set(fins).size).toBe(1);
      const jours = (fins[0] - t0) / MINUTES_PER_DAY;
      expect(Number.isInteger(jours) && jours >= 1 && jours <= 10).toBe(true);
    }
  });

  it('Chance du navigateur : seul le Capitaine gagne Chanceux, pour 1d10 jours (l.233-234)', () => {
    const [a, b, c] = get().party;
    set({ party: [a, { ...b, shipRole: 'capitaine' }, c] });
    const talentsAvant = get().party.map((h) => h.talents);
    jour('chance-du-navigateur');
    const chanceux = get().party.map((h) => (h.activeEffects ?? []).some((e) => e.grantedTalent?.talentId === 'chanceux' && e.duration.scale === 'clock'));
    expect(chanceux).toEqual([false, true, false]);
    expect(get().party.map((h) => h.talents)).toEqual(talentsAvant);
  });

  it('Chance du navigateur sans Capitaine : personne ne la reçoit, et le journal le dit', () => {
    jour('chance-du-navigateur');
    expect(get().party.some((h) => (h.activeEffects ?? []).some((e) => e.grantedTalent?.talentId === 'chanceux'))).toBe(false);
    expect(get().journal.some((l) => l.includes('Capitaine'))).toBe(true);
  });
});

describe('Ressources de bord en grammaire (#1652 lot 3 — MDG 15)', () => {
  beforeEach(etatFrais);
  afterEach(() => resetData());

  function jour(evenement: string): void {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: evenement } } });
    runSeaDay(get, set);
  }
  const consequence = (id: string) => BOARD_EVENTS.find((e) => e.id === id)?.consequence;
  const consequenceDeBord = (id: string, c: Flow) =>
    setDataset('seaBoardEvents', BOARD_EVENTS.map((e) => (e.id === id ? { ...e, consequence: c } : e)) as never);
  const surLeNavire = (ops: unknown[]): Effect => ({ type: 'ops', on: 'navire', ops } as never);
  const ration = (uid: string) => ({ ...itemFromTrappingById('ration', idsDeTest)!, uid });
  const rations = (h: Combatant): number => (h.items ?? []).filter((it) => it.trappingId === 'ration').length;

  it('la donnée porte la RAW : débris 1d100, épave 2d100 sur décision ; pénurie la moitié ; manne 1d10 jours et +2d10 Moral', () => {
    const navire = (ops: unknown[]) => ({ kind: 'effet', effet: { type: 'ops', on: 'navire', ops } });
    expect(consequence('debris-marins')).toEqual({ kind: 'choix', invite: 'Repêcher les caisses', oui: navire([{ op: 'cargaison', enc: { dice: { n: 1, sides: 100 } } }]) });
    expect(consequence('vaisseau-fantome-figurativement')).toEqual({ kind: 'choix', invite: 'Monter à bord', oui: navire([{ op: 'cargaison', enc: { dice: { n: 2, sides: 100 } } }]) });
    expect(consequence('penurie-de-nourriture')).toEqual(navire([{ op: 'provisions', gateesPct: 50 }]));
    expect(consequence('manne-de-manann')).toEqual(navire([
      { op: 'provisions', jours: { dice: { n: 1, sides: 10 } }, vivre: { id: FRAIS } },
      { op: 'shipMorale', delta: { sign: 1, dice: { n: 2, sides: 10 } } },
    ]));
  });

  it.each([['debris-marins'], ['vaisseau-fantome-figurativement']])('%s : repêcher charge une cargaison tirée, à son prix de base (l.209-210, l.224-225)', (id) => {
    const c = consequence(id) as Extract<Flow, { kind: 'choix' }>;
    consequenceDeBord(id, { ...c, oui: { kind: 'effet', effet: surLeNavire([{ op: 'cargaison', enc: 37 }]) as never } });
    jour(id);
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'choixDeFlux')).toBe(true);
    expect(get().vessel!.cargo ?? []).toHaveLength(0);
    avanceEtapeCascade(get, undefined, () => 'oui');
    expect(get().vessel!.cargo).toEqual([expect.objectContaining({ enc: 37, basePriceGold: expect.any(Number) })]);
    expect(get().vessel!.cargo![0].basePriceGold).toBeGreaterThan(0);
  });

  it('débris marins : renoncer ne charge rien (« Si vous les repêchez », l.209)', () => {
    jour('debris-marins');
    avanceEtapeCascade(get, undefined, () => 'non');
    expect(get().vessel!.cargo ?? []).toHaveLength(0);
  });

  it('pénurie de nourriture : la moitié des provisions à bord, chaque vivre de la cale ET les rations des héros, est gâtée, arrondie par vivre (l.169-170)', () => {
    const [a, b, c] = get().party;
    set({
      party: [{ ...a, items: [ration('r1'), ration('r2'), ration('r3'), ration('r4')] }, { ...b, items: [ration('r5'), ration('r6'), ration('r7')] }, { ...c, items: [] }],
      vessel: { ...get().vessel!, provisions: vivres({ [FRAIS]: 41, [PRESERVEE]: 7, [BISCUITS]: 1 }) },
    });
    applyEffects(get, set, [surLeNavire([{ op: 'provisions', gateesPct: 50 }])]);
    expect(get().vessel!.provisions).toEqual({ [FRAIS]: 21, [PRESERVEE]: 4, [BISCUITS]: 1 });
    expect(get().party.map(rations)).toEqual([2, 2, 0]);
  });

  it('pénurie de nourriture sans vivres d’équipage suivis : seules les rations des héros se gâtent', () => {
    const [a, ...reste] = get().party;
    set({ party: [{ ...a, items: [ration('r1'), ration('r2')] }, ...reste] });
    applyEffects(get, set, [surLeNavire([{ op: 'provisions', gateesPct: 50 }])]);
    expect(get().vessel!.provisions).toBeUndefined();
    expect(rations(get().party[0])).toBe(1);
  });

  it('manne de Manann : de quoi nourrir l’équipage N jours en vivres frais, une ration par marin et par jour (l.235-236 ; MDG 14 l.238)', () => {
    set({ vessel: { ...get().vessel!, provisions: vivres({ [PRESERVEE]: 5 }) } });
    const equipage = shipboardSouls(get()).crew;
    expect(equipage).toBeGreaterThan(0);
    applyEffects(get, set, [surLeNavire([{ op: 'provisions', jours: 3, vivre: { id: FRAIS } }])]);
    expect(get().vessel!.provisions).toEqual({ [PRESERVEE]: 5, [FRAIS]: 3 * equipage });
  });

  it('manne de Manann jouée en mer : des vivres frais entrent en cale et le Moral monte (l.235-236)', () => {
    set({ vessel: { ...get().vessel!, provisions: vivres({}) } });
    jour('manne-de-manann');
    const ligne = get().journal.find((l) => l.startsWith('Provisions de bord'));
    expect(ligne).toContain('Nourriture, courses/journée');
    expect(get().vessel!.morale.score).toBeGreaterThan(75);
  });

  it('un vivre hors de la liste de la cale est refusé au parse, op comme effet de scène (MDG 14 l.245-252)', () => {
    expect(gameOpSchema.safeParse({ op: 'provisions', jours: 2, vivre: { id: FRAIS } }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'provisions', jours: 2, vivre: { id: 'tonneau-d-eau-douce' } }).success).toBe(false);
    expect(gameOpSchema.safeParse({ op: 'provisions', rations: 2, vivre: { id: 'ration' } }).success).toBe(false);
    expect(gameOpSchema.safeParse({ op: 'provisions', rations: 2 }).success).toBe(false);
    expect(setVesselSchema.safeParse({ type: 'setVessel', vehicleId: 'cogue', vivre: { id: BISCUITS }, provisions: 10 }).success).toBe(true);
    expect(setVesselSchema.safeParse({ type: 'setVessel', vehicleId: 'cogue', vivre: { id: 'tonneau-d-eau-douce' }, provisions: 10 }).success).toBe(false);
    expect(setVesselSchema.safeParse({ type: 'setVessel', vehicleId: 'cogue', vivre: { id: 'biscuits-de-mre' }, provisions: 10 }).success).toBe(false);
    expect(adjustVesselSchema.safeParse({ type: 'adjustVessel', vivre: { id: 'tonneau-d-eau-douce' }, provisions: 10 }).success).toBe(false);
    expect(setVesselSchema.safeParse({ type: 'setVessel', vehicleId: 'cogue', vivre: { id: 'ration' }, provisions: 10 }).success).toBe(false);
    expect(gameOpSchema.safeParse({ op: 'provisions', jours: 3, vivre: { id: 'nourriture-course-journee' } }).success).toBe(false);
  });

  it('un effet de navire pose un vivre ET ses rations : l’un sans l’autre est refusé et nomme le champ manquant (MDG 14 l.245-252)', () => {
    const sansVivre = setVesselSchema.safeParse({ type: 'setVessel', vehicleId: 'cogue', provisions: 40 });
    expect(sansVivre.success).toBe(false);
    expect(sansVivre.error!.issues.map((i) => i.message).join(' ')).toContain('« vivre »');
    const sansRations = adjustVesselSchema.safeParse({ type: 'adjustVessel', vivre: { id: FRAIS } });
    expect(sansRations.success).toBe(false);
    expect(sansRations.error!.issues.map((i) => i.message).join(' ')).toContain('« provisions »');
    expect(adjustVesselSchema.safeParse({ type: 'adjustVessel', provisions: 3 }).success).toBe(false);
    expect(setVesselSchema.safeParse({ type: 'setVessel', vehicleId: 'cogue', vivre: { id: BISCUITS } }).success).toBe(false);
  });

  it('une op `provisions` hors de sa forme est refusée au parse, et `jours` sans `vivre` nomme le champ manquant', () => {
    const sansVivre = gameOpSchema.safeParse({ op: 'provisions', jours: 3 });
    expect(sansVivre.success).toBe(false);
    expect(sansVivre.error!.issues.map((i) => i.message).join(' ')).toContain('« vivre »');
    expect(gameOpSchema.safeParse({ op: 'provisions', gateesPct: 50, vivre: { id: BISCUITS } }).success).toBe(false);
    expect(adjustVesselSchema.safeParse({ type: 'adjustVessel', vivre: { id: BISCUITS }, provisions: 'dix' }).success).toBe(false);
    expect(adjustVesselSchema.safeParse({ type: 'adjustVessel', vivre: { id: BISCUITS }, provisions: { [BISCUITS]: 30 } }).success).toBe(false);
  });

  it('les vivres posés par setVessel/adjustVessel sont des rations entières, jamais négatives (MDG 14 l.245-252)', () => {
    expect(setVesselSchema.safeParse({ type: 'setVessel', vehicleId: 'cogue', vivre: { id: BISCUITS }, provisions: 0 }).success).toBe(true);
    expect(setVesselSchema.safeParse({ type: 'setVessel', vehicleId: 'cogue', vivre: { id: BISCUITS }, provisions: -5 }).success).toBe(false);
    expect(setVesselSchema.safeParse({ type: 'setVessel', vehicleId: 'cogue', vivre: { id: BISCUITS }, provisions: 2.5 }).success).toBe(false);
    expect(adjustVesselSchema.safeParse({ type: 'adjustVessel', vivre: { id: FRAIS }, provisions: -1 }).success).toBe(false);
  });

  it('setVessel pose un vivre, l’op `rations` en ajoute un autre, adjustVessel pose la valeur du seul vivre nommé', () => {
    applyEffects(get, set, [
      { type: 'setVessel', vehicleId: 'cogue', vivre: { id: BISCUITS }, provisions: 40 } as never,
      { type: 'ops', on: 'navire', ops: [{ op: 'provisions', rations: 12, vivre: { id: FRAIS } }] } as never,
    ]);
    expect(get().vessel!.provisions).toEqual({ [BISCUITS]: 40, [FRAIS]: 12 });
    applyEffects(get, set, [{ type: 'adjustVessel', vivre: { id: FRAIS }, provisions: 3 } as never]);
    expect(get().vessel!.provisions).toEqual({ [BISCUITS]: 40, [FRAIS]: 3 });
    expect(get().journal).toContain(t('eff.navireModifie', { parts: t('eff.navireProvisions', { n: 43 }) }));
  });

  it('adjustVessel sur une cale non suivie active le suivi du vivre nommé', () => {
    expect(get().vessel!.provisions).toBeUndefined();
    applyEffects(get, set, [{ type: 'adjustVessel', vivre: { id: PRESERVEE }, provisions: 8 } as never]);
    expect(get().vessel!.provisions).toEqual({ [PRESERVEE]: 8 });
  });

  it('manne de Manann sans vivres d’équipage suivis : le journal le dit, le Moral monte quand même', () => {
    jour('manne-de-manann');
    expect(get().vessel!.provisions).toBeUndefined();
    expect(get().journal).toContain(t('eff.provisionsSansSuivi'));
    expect(get().vessel!.morale.score).toBeGreaterThan(75);
  });
});

describe('Équipage recueilli et pertes au port (#1652 lot 3 — MDG 15, valeurs maison du 2026-11-07)', () => {
  beforeEach(etatFrais);
  afterEach(() => resetData());

  function jour(evenement: string): void {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: evenement } } });
    runSeaDay(get, set);
  }
  const consequence = (id: string, table: 'boardEvents' | 'portEvents' = 'boardEvents') => (table === 'boardEvents' ? BOARD_EVENTS : PORT_EVENTS).find((e) => e.id === id)?.consequence;
  const surLeNavire = (ops: unknown[]): Effect => ({ type: 'ops', on: 'navire', ops } as never);
  const perdus = (n: number) => set({ vessel: { ...get().vessel!, crewLost: n } });
  /** Lance le Test ouvert par le flux, en pose l'issue, puis le valide. */
  const joueLeTest = (reussi: boolean) => {
    get().jetLancer('test');
    set({ pendingTest: { ...get().pendingTest!, roll: reussi ? 1 : 99, success: reussi, sl: reussi ? 1 : -3 } });
    get().jetValider('test');
  };

  it('Message dans une bouteille : secourir le naufragé, un marin de plus (l.202-204)', () => {
    perdus(3);
    jour('message-dans-une-bouteille');
    avanceEtapeCascade(get, undefined, () => 'oui');
    expect(get().vessel!.crewLost).toBe(2);
  });

  it('Message dans une bouteille : renoncer ne change rien', () => {
    perdus(3);
    jour('message-dans-une-bouteille');
    avanceEtapeCascade(get, undefined, () => 'non');
    expect(get().vessel!.crewLost).toBe(3);
  });

  it('un recueilli ne dépasse pas l’effectif nominal, et le journal le dit', () => {
    applyEffects(get, set, [surLeNavire([{ op: 'equipage', delta: 1 }])]);
    expect(get().vessel!.crewLost ?? 0).toBe(0);
    expect(get().journal).toContain(t('eff.equipageComplet'));
  });

  it('une perte d’équipage retire des marins à l’effectif', () => {
    applyEffects(get, set, [surLeNavire([{ op: 'equipage', delta: -2 }])]);
    expect(get().vessel!.crewLost).toBe(2);
  });

  it('Canot de sauvetage : la donnée porte les rescapés du livre et leur rôle maison (l.213-218)', () => {
    const c = consequence('canot-de-sauvetage') as Extract<Flow, { kind: 'choix' }>;
    expect(c.invite).toBe('Recueillir les rescapés');
    const table = (c.oui as Extract<Flow, { kind: 'effet' }>).effet.ops[0] as Extract<GameOp, { op: 'rollTable'; entries: unknown }>;
    expect(table.die).toBe('1d10');
    expect(table.entries.map((r) => [r.min, r.max, r.ops])).toEqual([
      [1, 3, [{ op: 'equipage', delta: 2 }]],
      [4, 6, [{ op: 'equipage', delta: 1 }]],
      [7, 7, [{ op: 'equipage', delta: 1 }]],
      [8, 8, [{ op: 'equipage', delta: 1, role: { id: 'navigateur' }, sansSolde: 'jusquAuPort' }]],
      [9, 9, [{ op: 'equipage', delta: 1, role: { id: 'chirurgien' }, sansSolde: 'jusquAuPort' }]],
      [10, 10, [{ op: 'narrative', text: 'un chat de navire' }]],
    ]);
  });

  it('une table d’ops de navire se tire à la portée du navire (l.213-218)', () => {
    perdus(5);
    applyEffects(get, set, [surLeNavire([{ op: 'rollTable', die: '1d10', entries: [{ min: 1, max: 10, ops: [{ op: 'equipage', delta: 2 }] }] }])]);
    expect(get().vessel!.crewLost).toBe(3);
  });

  it('Canot : le rescapé au rôle sert sans solde jusqu’au prochain port, puis rejoint l’équipage payé (l.216-217)', () => {
    perdus(2);
    applyEffects(get, set, [surLeNavire([{ op: 'equipage', delta: 1, role: { id: 'navigateur' }, sansSolde: 'jusquAuPort' }])]);
    expect(get().vessel!.recueillisSansSolde).toEqual([{ roleId: 'navigateur', count: 1 }]);
    expect(weeklyCrewWageBrass(get().vessel!.crew)).toBe(0);
    finalizePortArrivalTo(get, set, carte.places[1], true);
    expect(get().vessel!.recueillisSansSolde).toBeUndefined();
    expect(get().vessel!.crew).toEqual([{ roleId: 'navigateur', count: 1 }]);
    expect(weeklyCrewWageBrass(get().vessel!.crew)).toBeGreaterThan(0);
  });

  it('Passager clandestin repéré (Perception Complexe réussie) : le garder à bord l’engage (l.258)', () => {
    perdus(2);
    setDataset('seaPortEvents', PORT_EVENTS.map(({ min, max, id, label, desc }) => ({ min, max, id, label, desc, consequence: consequence('passager-clandestin', 'portEvents') })) as never);
    finalizePortArrivalTo(get, set, carte.places[1], true);
    joueLeTest(true);
    expect(get().lieu).toBe('A');
    avanceEtapeCascade(get, undefined, () => 'oui');
    expect(get().vessel!.crewLost).toBe(1);
    expect(get().lieu).toBe('B');
  });

  it('Passager clandestin non repéré : sa présence se découvre après 1d10 jours de voyage, et il rejoint l’équipage alors (l.258)', () => {
    perdus(2);
    setDataset('seaPortEvents', PORT_EVENTS.map(({ min, max, id, label, desc }) => ({ min, max, id, label, desc, consequence: consequence('passager-clandestin', 'portEvents') })) as never);
    finalizePortArrivalTo(get, set, carte.places[1], true);
    joueLeTest(false);
    expect(get().lieu).toBe('B');
    expect(get().vessel!.crewLost).toBe(2);
    const [{ executeAt }] = get().scheduledEffects;
    const jours = (executeAt - get().gameTime) / MINUTES_PER_DAY;
    expect(jours).toBeGreaterThanOrEqual(1);
    expect(jours).toBeLessThanOrEqual(10);
    setDataset('seaPortEvents', PORT_EVENTS.map(({ min, max, id, label, desc }) => ({ min, max, id, label, desc })) as never);
    set({ travelPlan: buildSeaPlan(get, 'r1', 'B', 'A', carte.routes[0], { cadence: 'jourParJour' })! });
    get().avancerLHorloge(executeAt - get().gameTime - 1);
    expect(get().vessel!.crewLost).toBe(2);
    get().avancerLHorloge(1);
    draineCascade(get);
    expect(get().vessel!.crewLost).toBe(1);
    expect(get().journal).toContain('vous découvrez sa présence');
  });

  it('Gangs des quais : 2d10 Enc perdus au prochain déchargement, levés à l’accostage suivant (l.250)', () => {
    expect(consequence('gangs-des-quais', 'portEvents')).toEqual({ kind: 'effet', effet: { type: 'ops', on: 'navire', ops: [{ op: 'cargaison', perteAuDechargement: { dice: { n: 2, sides: 10 } } }] } });
    applyEffects(get, set, [surLeNavire([{ op: 'cargaison', perteAuDechargement: 7 }])]);
    expect(get().vessel!.perteAuDechargement).toBe(7);
    setDataset('seaPortEvents', PORT_EVENTS.map(({ min, max, id, label, desc }) => ({ min, max, id, label, desc })) as never);
    finalizePortArrivalTo(get, set, carte.places[1], true);
    expect(get().vessel!.perteAuDechargement).toBeUndefined();
  });
});

describe('Périls et navires hostiles en grammaire (#1652 lot 4 — MDG 15, valeurs maison du 2026-11-07)', () => {
  beforeEach(etatFrais);
  afterEach(() => { resetData(); resetRule('cible-vulnerable-pct'); resetRule('abordage-taille-de-vague'); });

  /** Un jour de traversée neuf où se joue `evenement` ; la conduite du jour précédent est abandonnée. */
  function jour(evenement: string): void {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jourParJour' })!;
    set({ pendingCascade: null, travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: evenement } } });
    runSeaDay(get, set);
  }
  const consequence = (id: string) => BOARD_EVENTS.find((e) => e.id === id)?.consequence;
  const surLeNavire = (ops: unknown[]): Flow => ({ kind: 'effet', effet: { type: 'ops', on: 'navire', ops } as never });
  const hail = () => get().pendingCascade?.participants.find((s) => s.kind === 'merPiratesSommation');
  const journal = () => get().journal.join('\n');

  it('la donnée porte la RAW : tourbillons, Rocher, équipages et grands canons, Vents favorables M +1, Marsouin 1d10 jours', () => {
    expect(consequence('maelstrom')).toEqual(surLeNavire([{ op: 'perilDeMer', tourbillon: { id: 'maelstrom' } }])); // l.140-141
    expect(consequence('puissant-vortex')).toEqual(surLeNavire([{ op: 'perilDeMer', tourbillon: { id: 'puissant-vortex' } }])); // l.146
    expect(consequence('langskip-skaeling')).toEqual(surLeNavire([{ op: 'navireHostile', navire: { id: 'langskip' }, equipage: { id: 'humain', nombre: 45 } }])); // l.150-151
    expect(consequence('cogue-pirate')).toEqual(surLeNavire([{ // l.171-173
      op: 'navireHostile', navire: { id: 'cogue' }, equipage: { id: 'humain', nombre: 25 }, chef: { id: 'jaego-roth' }, grandsCanons: 6, exigence: 'fouille',
    }]));
    expect(consequence('nemesis')).toBeUndefined(); // l.148-149 : rencontre de scénario
    expect(consequence('vents-favorables')).toEqual(surLeNavire([{ op: 'navireMod', m: 1, jusqua: 'evenementDeBord' }])); // l.228
    expect(consequence('marsouin-amical')).toEqual(surLeNavire([{ op: 'navireMod', evite: ['rocher', 'bas-fonds'], jusqua: { jours: { dice: { n: 1, sides: 10 } } } }])); // l.229
  });

  it('Vents favorables : M +1, levé au prochain événement de bord (l.228)', () => {
    jour('vents-favorables');
    expect(get().vessel!.modificateurs).toEqual([expect.objectContaining({ m: 1, jusqua: 'evenementDeBord' })]);
    jour('nemesis');
    expect(get().vessel!.modificateurs ?? []).toEqual([]);
  });

  it('Marsouin amical : la Collision soudaine (Rocher) est évitée pendant 1d10 jours, puis ne l’est plus (l.229, l.181)', () => {
    jour('marsouin-amical');
    const [mod] = get().vessel!.modificateurs!;
    expect(mod).toMatchObject({ evite: ['rocher', 'bas-fonds'] });
    expect(mod.jusqua).toBeGreaterThan(get().gameTime);
    expect(mod.jusqua).toBeLessThanOrEqual(get().gameTime + 10 * MINUTES_PER_DAY);
    const blessures = () => get().vessel!.wounds;
    const avant = blessures();
    jour('collision-soudaine');
    expect(journal()).toContain(t('sv.perilEvite', { hazard: 'Rocher', label: mod.label }));
    expect(blessures()).toBe(avant);
    set({ gameTime: (mod.jusqua as number) + 1 });
    jour('collision-soudaine');
    expect(blessures()).not.toBe(avant);
  });

  it('Marsouin amical : un péril qu’il ne nomme pas (Iceberg) n’est pas évité', () => {
    jour('marsouin-amical');
    setDataset('seaBoardEvents', BOARD_EVENTS.map((e) => (e.id === 'collision-soudaine' ? { ...e, consequence: surLeNavire([{ op: 'perilDeMer', collision: { id: 'iceberg' } }]) } : e)) as never);
    jour('collision-soudaine');
    expect(journal()).not.toContain('évité');
    expect(journal()).toContain('Iceberg');
  });

  it.each([['maelstrom', 'maelstrom'], ['puissant-vortex', 'puissant-vortex']])('%s : la crise d’évasion du tourbillon s’ouvre (MDG 13 l.514-537)', (evenement, tourbillon) => {
    jour(evenement);
    expect(get().travelPlan!.sea!.crisis).toMatchObject({ kind: 'tourbillon', whirlpoolId: tourbillon, progress: 0 });
  });

  it('Cogue pirate : fuir, combattre ou se soumettre, fuir par défaut (l.171-173)', () => {
    jour('cogue-pirate');
    expect(hail()?.options?.map((o) => o.key)).toEqual(['fuir', 'combattre', 'soumettre']);
    expect(hail()?.defaultChoice).toBe('fuir');
  });

  it('Langskip skaeling : aucune extorsion, fuir ou combattre (l.150-151)', () => {
    jour('langskip-skaeling');
    expect(hail()?.options?.map((o) => o.key)).toEqual(['fuir', 'combattre']);
  });

  it('navire hostile moins nombreux et moins armé : il passe son chemin (seuil `cible-vulnerable-pct`, maison)', () => {
    const ames = shipboardSouls(get()).total;
    setRule('cible-vulnerable-pct', Math.min(300, Math.ceil((45 * 100) / ames / 10) * 10 + 10));
    jour('langskip-skaeling');
    expect(hail()).toBeUndefined();
    expect(journal()).toContain(t('sv.hostilePasse', { label: BOARD_EVENTS.find((e) => e.id === 'langskip-skaeling')!.label }));
  });

  it('navire hostile mieux armé en grands canons : il attaque quel que soit l’effectif (Cogue, 6 grands canons)', () => {
    setRule('cible-vulnerable-pct', 300);
    jour('cogue-pirate');
    expect(hail()).toBeDefined();
  });

  it('abordage : tout l’équipage RAW est en jeu, il monte par vagues de `abordage-taille-de-vague` à mesure que le pont se dégage (l.171)', () => {
    jour('cogue-pirate');
    get().jetRegler('cascade', 'choix', 'combattre', 'merPiratesSommation');
    get().jetValider('cascade');
    const coque = () => get().battle!.combatants.find((c) => c.id === 'enemy-enc-abordage-0')!;
    const vague = Number(rule('abordage-taille-de-vague'));
    // 25 marins, Jaego Roth compris : 24 marins, dont une première vague à bord.
    expect(coque().reserveDAbordage).toEqual({ ref: 'humain', restant: 24 - vague, vague });
    const aBord = coque().crewIds!.length;
    for (const id of coque().crewIds!) {
      const c = get().battle!.combatants.find((x) => x.id === id);
      if (c) c.dead = true;
    }
    expect(checkBattleOver(get, set)).toBe(false);
    expect(coque().crewIds!.length).toBe(aBord + vague);
    expect(coque().reserveDAbordage!.restant).toBe(24 - 2 * vague);
    expect(coque().exitReason).toBeUndefined();
    expect(JSON.stringify(get().battle!.log)).toContain(t('crew.vagueDAbordage', { ship: coque().label, n: vague, restant: 24 - 2 * vague }));
  });
});

describe('Voyage rapide en grammaire (#1652 lot 5 — MDG 15 l.33-37, l.49-51)', () => {
  beforeEach(etatFrais);

  const surLeNavire = (ops: unknown[]): Effect => ({ type: 'ops', on: 'navire', ops } as never);
  const opsDu = (id: string): GameOp[] => {
    const c = FAST_VOYAGE_PALIERS.find((p) => p.id === id)!.consequence;
    return c ? (c as Extract<Flow, { kind: 'effet' }>).effet.ops as GameOp[] : [];
  };
  const partDesBlessures = (tranche: number, num: number) => ({ parTranche: tranche, of: num === 1 ? { blessuresMax: true } : { times: { of: { blessuresMax: true }, factor: num } } });
  const pertes = (equipage: number, cargaison: number, coque: ReturnType<typeof partDesBlessures>, critiques: number) => [
    { op: 'equipage', perdusPct: equipage },
    { op: 'cargaison', perduePct: cargaison },
    { op: 'wounds', amount: coque, ignoreTB: true, ignoreAP: true },
    { op: 'shipCritical', location: 'aleatoire', count: critiques, equipageEpargne: true },
  ];

  it('la donnée porte la RAW : équipage, cargaison, Blessures et Critiques de chaque palier, l’équipage épargné par les Critiques', () => {
    expect(opsDu('desastreux')).toEqual(pertes(50, 75, partDesBlessures(4, 3), 3));
    expect(opsDu('ereintant')).toEqual(pertes(20, 50, partDesBlessures(2, 1), 2));
    expect(opsDu('difficile')).toEqual(pertes(10, 25, partDesBlessures(4, 1), 1));
    expect(opsDu('sans-encombre')).toEqual([{ op: 'cargaison', perduePct: 10 }]);
    expect(FAST_VOYAGE_PALIERS.find((p) => p.id === 'parfait')!.consequence).toBeUndefined();
  });

  it('`equipage.perdusPct` : la part des PNJ à bord, arrondie', () => {
    expect(shipboardSouls(get()).crew).toBe(15);
    applyEffects(get, set, [surLeNavire([{ op: 'equipage', perdusPct: 20 }])]);
    expect(get().vessel!.crewLost).toBe(3);
  });

  it('`cargaison.perduePct` : la part de l’Encombrement de la cale, répartie au fil des lots', () => {
    set({ vessel: { ...get().vessel!, cargo: [{ uid: 'a', cargoId: 'bois-mer', enc: 100, basePriceGold: 1 }, { uid: 'b', cargoId: 'bois-mer', enc: 20, basePriceGold: 1 }] } });
    applyEffects(get, set, [surLeNavire([{ op: 'cargaison', perduePct: 25 }])]);
    expect(get().vessel!.cargo!.reduce((s, l) => s + l.enc, 0)).toBe(90);
    expect(get().journal).toContain(t('eff.cargaisonPerdue', { pct: 25, enc: 30 }));
  });

  it('`{blessuresMax}` : les Blessures maximales de la coque visée, 75 % arrondis à l’inférieur', () => {
    set({ vessel: { ...get().vessel!, wounds: { current: 50, max: 50 } } });
    applyEffects(get, set, [surLeNavire([{ op: 'wounds', amount: partDesBlessures(4, 3) }])]);
    expect(get().vessel!.wounds!.current).toBe(50 - 37);
  });

  it('`shipCritical.equipageEpargne` : le Critique tombe sans Dégâts à l’équipage exposé (l.49-51)', () => {
    set({ travelPlan: buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0])!, party: get().party.map((h, i) => (i === 0 ? { ...h, shipStation: 'pont' } : h)) });
    const crit = () => rollShipCritical('coque', makeRNG(1), 3);
    expect(crit().crewHit, 'prémisse : « Coque dégradée » frappe le pont').toBeDefined();
    applyVesselCritical(get, set, crit(), true);
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.criticals).toHaveLength(1);
    applyVesselCritical(get, set, crit());
    expect(get().pendingCascade).not.toBeNull();
  });
});

describe('Bourse du groupe et valeurs liées (#1652 lot 6 — MDG 15 l.245-247, valeurs maison du 2026-11-07)', () => {
  beforeEach(etatFrais);
  afterEach(() => resetData());

  const enSous = () => toBrass(partyMoneyTotal(get));
  const finance = (co: number) => creditBourse(get, set, get().party[0].id, { gold: co, silver: 0, brass: 0 });
  const surLeGroupe = (ops: unknown[]): Effect => ({ type: 'ops', on: 'groupe', ops } as never);
  const escale = (id: string) => {
    const c = PORT_EVENTS.find((e) => e.id === id)!.consequence;
    setDataset('seaPortEvents', PORT_EVENTS.map(({ min, max, id: rangee, label, desc }) => ({ min, max, id: rangee, label, desc, consequence: c })) as never);
    finalizePortArrivalTo(get, set, carte.places[1], true);
  };
  const choixOuvert = () => get().pendingCascade?.participants.find((s) => s.kind === 'choixDeFlux' && s.chosen == null);
  const tranche = (id: string, oui: boolean) => {
    expect(choixOuvert()?.id).toBe(`choixDeFlux-${id}`);
    avanceEtapeCascade(get, undefined, () => (oui ? 'oui' : 'non'));
  };
  const joueLeTest = (reussi: boolean) => {
    get().jetLancer('test');
    set({ pendingTest: { ...get().pendingTest!, roll: reussi ? 1 : 99, success: reussi, sl: reussi ? 1 : -3 } });
    get().jetValider('test');
  };
  const cale = (enc: number, basePriceGold: number) => set({ vessel: { ...get().vessel!, cargo: [{ uid: 'lot', cargoId: 'bois-mer', enc, basePriceGold }] } });
  const encEnCale = () => (get().vessel!.cargo ?? []).reduce((s, l) => s + l.enc, 0);

  it('une valeur liée se tire UNE fois : sa définition et ses relectures valent le même nombre', () => {
    const flow: Flow = { kind: 'sequence', etapes: [
      { kind: 'effet', effet: { type: 'ops', on: 'navire', ops: [{ op: 'equipage', delta: { tire: 'n', de: { dice: { n: 2, sides: 10 } } } }] } as never },
      { kind: 'effet', effet: { type: 'ops', on: 'navire', ops: [{ op: 'equipage', delta: { tire: 'n' } }] } as never },
    ] };
    let tirages = 0;
    expect(JSON.stringify(lierLesTirages(flow, () => { tirages++; return 7; }))).toBe(JSON.stringify({ kind: 'sequence', etapes: [
      { kind: 'effet', effet: { type: 'ops', on: 'navire', ops: [{ op: 'equipage', delta: 7 }] } },
      { kind: 'effet', effet: { type: 'ops', on: 'navire', ops: [{ op: 'equipage', delta: 7 }] } },
    ] }));
    expect(tirages).toBe(1);
    expect(() => tiragesDuFlow({ a: { tire: 'n', de: 1 }, b: { tire: 'n', de: 2 } })).toThrow(/deux fois/);
    expect(() => lierLesTirages({ kind: 'effet', effet: { type: 'ops', on: 'navire', ops: [{ op: 'equipage', delta: { tire: 'x' } }] } } as never, () => 0)).toThrow(/sans définition/);
  });

  it('`money.groupe` débite puis crédite la bourse du GROUPE, et le journal dit le mouvement', () => {
    finance(10);
    applyEffects(get, set, [surLeGroupe([{ op: 'money', montant: { brass: -480 }, groupe: true }])]);
    expect(enSous()).toBe(10 * 240 - 480);
    expect(get().journal).toContain(t('eff.bourseDuGroupe', { sens: '−', montant: '2 CO' }));
    applyEffects(get, set, [surLeGroupe([{ op: 'money', montant: { brass: 240 }, groupe: true }])]);
    expect(enSous()).toBe(9 * 240);
  });

  it('`money.groupe` est inerte dans `applyOps` (la bourse du groupe se résout à la feuille d’Effet)', () => {
    const h = get().party[0];
    expect(applyOps(h, [{ op: 'money', montant: { brass: 240 }, groupe: true }], { idNeuf: idsDeTest, rng: makeRNG(1) } as never)).toEqual([]);
  });

  it('Prêtre de Manann : la donnée porte la RAW (1d10 CO + Taille en pistoles, ou Humeur −4d10)', () => {
    const txt = JSON.stringify(PORT_EVENTS.find((e) => e.id === 'pretre-de-manann')!.consequence);
    expect(txt).toContain('{"tire":"benediction","de":{"sum":[{"times":{"of":{"dice":{"n":1,"sides":10}},"factor":240}},{"times":{"of":{"tailleDuNavire":true},"factor":12}}]}}');
    expect(txt).toContain('{"op":"manann","delta":{"sign":-1,"dice":{"n":4,"sides":10}}}');
  });

  it('Prêtre de Manann : payer débite 1d10 CO + 25 pistoles (cogue de 25 m, MDG 12 l.54), l’Humeur ne bouge pas', () => {
    finance(12);
    escale('pretre-de-manann');
    expect(choixOuvert()!.options![0].detail).toMatch(/bourse du groupe perd/);
    tranche('Payer la bénédiction', true);
    const paye = 12 * 240 - enSous();
    expect(paye % 240).toBe(25 * 12 % 240);
    expect(paye).toBeGreaterThanOrEqual(240 + 300);
    expect(paye).toBeLessThanOrEqual(2400 + 300);
    expect(get().vessel!.manann?.score ?? 0).toBe(0);
  });

  it('Prêtre de Manann : refuser coûte 4d10 d’Humeur, la bourse reste', () => {
    finance(12);
    escale('pretre-de-manann');
    tranche('Payer la bénédiction', false);
    expect(enSous()).toBe(12 * 240);
    expect(get().vessel!.manann!.score).toBeLessThanOrEqual(-4);
    expect(get().vessel!.manann!.score).toBeGreaterThanOrEqual(-40);
  });

  it('Prêtre de Manann : une bourse sous le moindre prix (2 CO < 1 CO + 25 pistoles) n’offre pas de payer', () => {
    finance(2);
    escale('pretre-de-manann');
    expect(choixOuvert()).toBeUndefined();
    expect(enSous()).toBe(2 * 240);
    expect(get().vessel!.manann!.score).toBeLessThan(0);
  });

  it('Embrigadement : la rançon payée ramène les MÊMES marins enlevés', () => {
    finance(30);
    escale('embrigadement');
    const enleves = get().vessel!.crewLost!;
    expect(enleves).toBeGreaterThanOrEqual(2);
    tranche('Tenter de récupérer l’équipage enlevé', true);
    joueLeTest(true);
    tranche('Payer la rançon', true);
    expect(get().vessel!.crewLost).toBe(0);
    const rancon = 30 * 240 - enSous();
    expect(rancon % 240).toBe(0);
    expect(rancon / 240).toBeGreaterThanOrEqual(2);
    expect(rancon / 240).toBeLessThanOrEqual(20);
  });

  /** 1d10 de plus, plafonnés à l'effectif nominal de la cogue (15). */
  const unD10DePlus = (avant: number) => {
    const apres = get().vessel!.crewLost!;
    expect(avant, 'prémisse : la cogue garde des marins à perdre').toBeLessThan(15);
    expect(apres).toBeGreaterThanOrEqual(avant + 1);
    expect(apres).toBeLessThanOrEqual(Math.min(15, avant + 10));
  };

  it('Embrigadement : sans payer, la Discrétion réussie les libère tous', () => {
    escale('embrigadement');
    tranche('Tenter de récupérer l’équipage enlevé', true);
    joueLeTest(true);
    tranche('Les libérer en douce', true);
    joueLeTest(true);
    expect(get().vessel!.crewLost).toBe(0);
  });

  it('Embrigadement : la Discrétion échouée coûte 1d10 marins de plus', () => {
    escale('embrigadement');
    const avant = get().vessel!.crewLost!;
    tranche('Tenter de récupérer l’équipage enlevé', true);
    joueLeTest(true);
    tranche('Les libérer en douce', true);
    joueLeTest(false);
    unD10DePlus(avant);
  });

  it('Embrigadement : le Ragot échoué coûte 1d10 marins de plus', () => {
    escale('embrigadement');
    const avant = get().vessel!.crewLost!;
    tranche('Tenter de récupérer l’équipage enlevé', true);
    joueLeTest(false);
    unD10DePlus(avant);
  });

  it('Embrigadement : renoncer ne coûte que les enlevés', () => {
    escale('embrigadement');
    const perte = get().vessel!.crewLost!;
    tranche('Tenter de récupérer l’équipage enlevé', false);
    expect(get().vessel!.crewLost).toBe(perte);
    expect(get().pendingCascade).toBeNull();
  });

  it('Contrôle à quai : les droits valent 10 % de la valeur de la cargaison (MDG 15 l.247, l.436)', () => {
    finance(50);
    cale(10, 10); // 10 Enc à 10 CO l’Enc : 100 CO
    escale('controle-a-quai');
    joueLeTest(false);
    tranche('Payer les droits de douane', true);
    expect(enSous()).toBe((50 - 10) * 240);
    expect(encEnCale()).toBe(10);
  });

  it('Contrôle à quai : refuser les droits, ou ne pas pouvoir les payer, fait saisir la cargaison', () => {
    finance(50);
    cale(10, 10);
    escale('controle-a-quai');
    joueLeTest(false);
    tranche('Payer les droits de douane', false);
    expect(encEnCale()).toBe(0);
    expect(enSous()).toBe(50 * 240);

    etatFrais();
    finance(5);
    cale(10, 10);
    escale('controle-a-quai');
    joueLeTest(false);
    expect(choixOuvert()).toBeUndefined();
    expect(encEnCale()).toBe(0);
  });

  it('Contrôle à quai : la Subornation réussie offre un pot-de-vin de 2d10 CO, la cargaison reste', () => {
    finance(50);
    cale(10, 10);
    escale('controle-a-quai');
    joueLeTest(true);
    tranche('Verser le pot-de-vin', true);
    const verse = 50 * 240 - enSous();
    expect(verse % 240).toBe(0);
    expect(verse / 240).toBeGreaterThanOrEqual(2);
    expect(verse / 240).toBeLessThanOrEqual(20);
    expect(encEnCale()).toBe(10);
  });

  it('Contrôle à quai : la Subornation réussie mais le pot-de-vin refusé, restent les droits', () => {
    finance(50);
    cale(10, 10);
    escale('controle-a-quai');
    joueLeTest(true);
    tranche('Verser le pot-de-vin', false);
    tranche('Payer les droits de douane', true);
    expect(enSous()).toBe((50 - 10) * 240);
  });
});

describe('Nœuds hors combat (#1652 lot 7 — MDG 15 l.159-164, l.174-178, l.194-198, l.230-232)', () => {
  beforeEach(etatFrais);
  afterEach(() => resetData());

  const sansMarins = () => set({ vessel: { ...get().vessel!, crewLost: 99 } });
  const consequence = (id: string): Flow => BOARD_EVENTS.find((e) => e.id === id)!.consequence!;
  const bandeDeContraction = () => get().pendingCascade?.participants.find((s) => s.kind === 'maladieDeFinDeCombat');
  const jour = (evenement: string): void => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: evenement } } });
    runSeaDay(get, set);
  };

  it('Présage : le Test de Prière revient au Béni (Manann), même moins doué qu’un autre héros (l.197-198)', () => {
    const [h0, h1, ...reste] = get().party;
    set({ party: [
      { ...h0, skills: [...(h0.skills ?? []), { id: 'priere', characteristic: 'sociabilite', advances: 5 }], talents: [...h0.talents, { talentId: 'beni', spec: 'manann', times: 1 }] },
      { ...h1, skills: [...(h1.skills ?? []), { id: 'priere', characteristic: 'sociabilite', advances: 40 }] },
      ...reste,
    ] });
    jour('presage-divin-albatros');
    expect(get().pendingTest?.actorId).toBe(h0.id);
    expect((get().pendingTest?.candidates ?? []).map((c) => c.id)).not.toContain(h1.id);
  });

  it('la donnée réserve la Prière des deux Présages au Béni (Manann)', () => {
    for (const id of ['presage-divin-albatros', 'presage-divin-feu-bleu']) {
      expect(JSON.stringify(consequence(id))).toContain('"gate":{"kind":"talent","id":"beni","spec":"manann"}');
    }
  });

  it('une exposition HORS combat ouvre tout de suite la bande de Contraction, et consomme le marqueur (LDB 20)', () => {
    jouerFlowEntier(runFlow(get, set, { kind: 'effet', effet: { type: 'ops', on: 'groupe', ops: [{ op: 'exposeDisease', disease: 'peste-noire' }] } as never }, 'Puces'));
    const bande = bandeDeContraction();
    expect(bande?.meta).toEqual({ entry: 'contagion', disease: 'peste-noire' });
    expect(bande?.participants?.map((p) => [p.id, p.difficulty])).toEqual(get().party.map((h) => [h.id, 'accessible']));
    expect(get().party.every((h) => !h.diseaseExposure?.length)).toBe(true);
  });

  it('`membreAuHasard` : la feuille touche UN héros quand l’équipage PNJ est vide', () => {
    sansMarins();
    jouerFlowEntier(runFlow(get, set, { kind: 'effet', effet: { type: 'ops', on: 'membreAuHasard', ops: [{ op: 'exposeDisease', disease: 'fievre-du-rongeur' }] } as never }, 'Rats'));
    expect(bandeDeContraction()?.participants).toHaveLength(1);
  });

  it('`membreAuHasard` : un marin PNJ tiré ne touche aucun héros, le journal le dit', () => {
    set({ party: [] });
    jouerFlowEntier(runFlow(get, set, { kind: 'effet', effet: { type: 'ops', on: 'membreAuHasard', ops: [{ op: 'exposeDisease', disease: 'fievre-du-rongeur' }] } as never }, 'Rats'));
    expect(bandeDeContraction()).toBeUndefined();
    expect(get().journal.some((l) => String(l).includes(t('eff.membreAuHasardMarin', { label: 'Rats' })))).toBe(true);
  });

  it('Infestations : la donnée porte la RAW (Complexe 25 DR / 3d10 Enc / 30 % ; Intermédiaire 10 DR / 1d10 Enc / 15 %)', () => {
    const geants = JSON.stringify(consequence('infestation-de-rats-geants'));
    expect(geants).toContain('"crewTestType":{"id":"extermination-nuisibles"},"difficulty":"complexe","drCible":25');
    expect(geants).toContain('{"op":"cargaison","perdueEnc":{"dice":{"n":3,"sides":10}}}');
    expect(geants).toContain('{"min":1,"max":30,"ops":[{"op":"exposeDisease","disease":"fievre-du-rongeur"}]}');
    const rats = JSON.stringify(consequence('infestation-de-rats'));
    expect(rats).toContain('"crewTestType":{"id":"extermination-nuisibles"},"difficulty":"intermediaire","drCible":10');
    expect(rats).toContain('{"op":"cargaison","perdueEnc":{"dice":{"n":1,"sides":10}}}');
    expect(rats).toContain('{"min":1,"max":15,"ops":[{"op":"exposeDisease","disease":"fievre-du-rongeur"}]}');
  });

  it('Extermination : chaque étape cumule ses DR jusqu’au total, et l’infestation tombe (MDG 14 l.98-104)', () => {
    jouerFlowEntier(runFlow(get, set, consequence('infestation-de-rats'), 'Infestation de rats'));
    expect(get().vessel!.infestation?.drCible).toBe(10);
    set({ travelPlan: buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0])! });
    const appliquer = (sl: number) => applierDe('equipage-extermination')!(get, set, { id: 'equipage-extermination', kind: 'equipage-extermination', label: fixtureText('extermination'), result: { roll: 0, target: 0, sl, success: sl >= 0 } } as never, undefined, { steps: [], index: 0 });
    appliquer(6);
    expect(get().vessel!.infestation?.progres).toBe(6);
    appliquer(4);
    expect(get().vessel!.infestation).toBeUndefined();
  });

  it('nuit en mer : le Flow de nuit de l’infestation se joue', () => {
    jouerFlowEntier(runFlow(get, set, consequence('infestation-de-rats'), 'Infestation de rats'));
    set({ vessel: { ...get().vessel!, cargo: [{ uid: 'lot', cargoId: 'bois-mer', enc: 50, basePriceGold: 1 }] } });
    set({ travelPlan: buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0])! });
    continueSeaDayAfterCascade(get, set);
    expect((get().vessel!.cargo ?? []).reduce((n, l) => n + l.enc, 0)).toBeLessThan(50);
  });

  it('Infestation : chaque nuit, la cale perd 1d10 Enc', () => {
    jouerFlowEntier(runFlow(get, set, consequence('infestation-de-rats'), 'Infestation de rats'));
    const nuit = get().vessel!.infestation!.chaqueNuit;
    set({ vessel: { ...get().vessel!, cargo: [{ uid: 'lot', cargoId: 'bois-mer', enc: 50, basePriceGold: 1 }] } });
    jouerFlowEntier(runFlow(get, set, nuit, 'Infestation de rats'));
    const perdus = 50 - get().vessel!.cargo!.reduce((s, l) => s + l.enc, 0);
    expect(perdus).toBeGreaterThanOrEqual(1);
    expect(perdus).toBeLessThanOrEqual(10);
  });

  it('Vaisseau de pestiférés : l’abordage rapporte caisses, rations, eau et CO ; seul le volontaire est exposé (l.194-196)', () => {
    set({ vessel: { ...get().vessel!, provisions: vivres({}), waterLitres: 0 } });
    const bourse0 = toBrass(partyMoneyTotal(get));
    jouerFlowEntier(runFlow(get, set, consequence('vaisseau-de-pestiferes'), 'Vaisseau de pestiférés'));
    avanceEtapeCascade(get, undefined, () => 'oui');
    const v = get().vessel!;
    const caisses = (v.cargo ?? []).reduce((s, l) => s + l.enc, 0);
    expect(caisses).toBeGreaterThanOrEqual(2);
    expect(caisses).toBeLessThanOrEqual(20);
    expect(Object.keys(v.provisions!)).toEqual([BISCUITS]);
    expect(v.provisions![BISCUITS as keyof VivresDeCale]).toBeGreaterThanOrEqual(1);
    expect(v.provisions![BISCUITS as keyof VivresDeCale]).toBeLessThanOrEqual(100);
    expect(v.waterLitres! % 145).toBe(0);
    expect(v.waterLitres! / 145).toBeGreaterThanOrEqual(2);
    expect(v.waterLitres! / 145).toBeLessThanOrEqual(20);
    const co = (toBrass(partyMoneyTotal(get)) - bourse0) / 240;
    expect(Number.isInteger(co)).toBe(true);
    expect(co).toBeGreaterThanOrEqual(3);
    expect(co).toBeLessThanOrEqual(30);
    const [volontaire] = get().party;
    for (const h of get().party) {
      const etape = get().pendingCascade!.participants[get().pendingCascade!.cursor];
      expect(etape.kind).toBe('volontaireDeFlux');
      expect(etape.actorId).toBe(h.id);
      expect(etape.defaultChoice).toBe('non');
      avanceEtapeCascade(get, undefined, () => (h.id === volontaire.id ? 'oui' : 'non'));
    }
    expect(get().pendingCascade!.participants.filter((s) => s.kind === 'maladieDeFinDeCombat').flatMap((s) => s.participants!.map((p) => p.id))).toEqual([volontaire.id]);
  });

  it('Vaisseau de pestiférés : sans abordage, rien ne change', () => {
    jouerFlowEntier(runFlow(get, set, consequence('vaisseau-de-pestiferes'), 'Vaisseau de pestiférés'));
    avanceEtapeCascade(get, undefined, () => 'non');
    expect(get().vessel!.cargo ?? []).toEqual([]);
    expect(get().pendingCascade).toBeNull();
  });
});

describe('Combat en mer à issue (#1652 lot 8 — MDG 15 l.136-139, l.142-143, l.165-168)', () => {
  beforeEach(etatFrais);
  afterEach(resetData);

  const consequence = (id: string) => BOARD_EVENTS.find((e) => e.id === id)?.consequence;
  const surLeNavire = (ops: unknown[]): Flow => ({ kind: 'effet', effet: { type: 'ops', on: 'navire', ops } as never });
  const d = (n: number, sides: number) => ({ dice: { n, sides } });
  /** En mer, sur la route `r1` : la coque de campagne porte le pont. */
  const enMer = () => set({ travelPlan: buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jourParJour' })! });
  const ennemis = () => get().battle!.combatants.filter((c) => c.kind === 'ennemi');
  const aDemi = (c: Combatant) => { c.wounds = { ...c.wounds, current: Math.floor(c.wounds.max / 2) }; };
  const log = () => JSON.stringify(get().battle!.log);

  it('la donnée porte la RAW : Triton et son issue au 1d10, les monstres du livre repoussés à la moitié de leurs Blessures', () => {
    const combat = (id: string, nombre = 1, extra: object = {}) => ({ op: 'combatEnMer', adversaire: { id, nombre, ...extra }, repousseAPct: 50 });
    expect(consequence('triton')).toEqual(surLeNavire([{ // l.136-139
      op: 'combatEnMer', adversaire: { id: 'triton', nombre: 1 },
      victoire: surLeNavire([{ op: 'rollTable', die: '1d10', entries: [
        { min: 1, max: 5, ops: [{ op: 'manann', delta: { sign: 1, ...d(2, 10) } }] },
        { min: 6, max: 10, ops: [{ op: 'manann', delta: { sign: -1, ...d(2, 10) } }] },
      ] }]),
    }]));
    expect(consequence('puissant-monstre-marin')).toEqual(surLeNavire([{ op: 'rollTable', die: '1d10', entries: [ // l.142-143
      { min: 1, max: 3, ops: [combat('hydre-d-os')] },
      { min: 4, max: 5, ops: [combat('sangsue-des-abysses')] },
      { min: 6, max: 9, ops: [combat('gargantuan')] },
      { min: 10, max: 10, ops: [combat('leviathan-noir')] },
    ] }]));
    expect(consequence('monstre-marin')).toEqual(surLeNavire([{ op: 'rollTable', die: '1d10', entries: [ // l.165-168
      { min: 1, max: 3, ops: [combat('kharibde')] },
      { min: 4, max: 5, ops: [combat('anguille-macheprise', 1, { optionals: [{ id: 'nuee' }] })] },
      { min: 6, max: 9, ops: [combat('syrene-bleue', 3)] },
      { min: 10, max: 10, ops: [combat('wyrm-des-mers')] },
    ] }]));
  });

  it('Triton : le combat s’ouvre sur le pont, la traversée s’interrompt (l.136-137)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'triton' } } });
    runSeaDay(get, set);
    expect(ennemis().map((c) => c.creatureId)).toEqual(['triton']);
    expect(get().battle!.victoryCondition).toBeUndefined();
    expect(get().travelPlan!.interrupted).toBe(true);
  });

  it('Triton vaincu : 1d10, l’Humeur de Manann gagne ou perd 2d10 (l.137-139)', () => {
    enMer();
    const avant = vesselManann(get().vessel!).score;
    jouerFlowEntier(runFlow(get, set, consequence('triton')!, 'Triton !'));
    for (const c of ennemis()) c.dead = true;
    expect(checkBattleOver(get, set)).toBe(true);
    draineCascade(get);
    expect(get().battle!.over).toBe('victoire');
    const ecart = Math.abs(get().vessel!.manann!.score - avant);
    expect(ecart).toBeGreaterThanOrEqual(2);
    expect(ecart).toBeLessThanOrEqual(20);
    expect(get().journal.join('\n')).toContain('Humeur');
  });

  it('Triton non vaincu (défaite) : l’Humeur ne bouge pas', () => {
    enMer();
    const avant = vesselManann(get().vessel!).score;
    jouerFlowEntier(runFlow(get, set, consequence('triton')!, 'Triton !'));
    for (const c of get().battle!.combatants.filter((x) => x.kind === 'heros')) c.dead = true;
    expect(checkBattleOver(get, set)).toBe(true);
    expect(get().battle!.over).toBe('defaite');
    expect(vesselManann(get().vessel!).score).toBe(avant);
  });

  it('3 syrènes bleues : chacune est repoussée à la moitié de ses Blessures, la victoire vient quand aucune ne reste (l.166-168)', () => {
    enMer();
    jouerFlowEntier(runFlow(get, set, surLeNavire([{ op: 'combatEnMer', adversaire: { id: 'syrene-bleue', nombre: 3 }, repousseAPct: 50 }]), 'Monstre marin'));
    const [a, b, c] = ennemis();
    expect([a, b, c].map((x) => x.creatureId)).toEqual(['syrene-bleue', 'syrene-bleue', 'syrene-bleue']);
    aDemi(a);
    expect(checkBattleOver(get, set)).toBe(false);
    expect(a.outOfRencontre).toBe(true);
    expect(a.exitReason).toBe('repousse');
    expect(b.outOfRencontre).toBeFalsy();
    expect(log()).toContain(t('cf.repousse', { name: a.label }));
    aDemi(b);
    c.dead = true;
    expect(checkBattleOver(get, set)).toBe(true);
    draineCascade(get);
    expect(get().battle!.over).toBe('victoire');
  });

  it('une créature au-dessus de la moitié de ses Blessures reste au combat', () => {
    enMer();
    jouerFlowEntier(runFlow(get, set, surLeNavire([{ op: 'combatEnMer', adversaire: { id: 'kharibde', nombre: 1 }, repousseAPct: 50 }]), 'Monstre marin'));
    const [k] = ennemis();
    k.wounds = { ...k.wounds, current: Math.floor(k.wounds.max / 2) + 1 };
    expect(checkBattleOver(get, set)).toBe(false);
    expect(k.outOfRencontre).toBeFalsy();
  });

  it('nuée d’anguilles mâcheprises : le Trait facultatif Nuée est posé (l.166 ; MDG 16 l.67)', () => {
    enMer();
    jouerFlowEntier(runFlow(get, set, surLeNavire([{ op: 'combatEnMer', adversaire: { id: 'anguille-macheprise', nombre: 1, optionals: [{ id: 'nuee' }] } }]), 'Monstre marin'));
    const [anguille] = ennemis();
    expect(anguille.traits?.some((x) => x.id === 'nuee')).toBe(true);
  });

  it('sans navire de campagne en mer, aucun combat ne s’ouvre et le journal le dit', () => {
    jouerFlowEntier(runFlow(get, set, surLeNavire([{ op: 'combatEnMer', adversaire: { id: 'kharibde', nombre: 1 } }]), 'Monstre marin'));
    expect(get().battle).toBeNull();
    expect(get().journal.join('\n')).toContain(t('sv.combatEnMerSansPont', { label: 'Monstre marin' }));
  });

  it('la fiche Codex dit le combat, le repli et la suite de la victoire', () => {
    const triton = humanizeFlow(consequence('triton')!, []);
    expect(triton).toContain(t('codex.op.combatEnMer', { nombre: 1, adversaire: 'Triton' }));
    expect(triton).toContain(t('codex.op.combatEnMer.victoire', { victoire: '' }).trim());
    const monstre = humanizeFlow(consequence('monstre-marin')!, []);
    expect(monstre).toContain(t('codex.op.combatEnMer.repousse', { pct: 50 }));
    expect(monstre).toContain('Nuée');
  });

  it('`combatEnMer` est inerte dans `applyOps` (op de navire)', () => {
    const h = get().party[0];
    expect(applyOps(h, [{ op: 'combatEnMer', adversaire: { id: 'kharibde', nombre: 1 } }], { idNeuf: idsDeTest, rng: makeRNG(1) })).toEqual([]);
  });
});

describe('Événements laissés au MJ et marché du port (#1652 lot 9 — MDG 15, valeurs maison du 2026-11-07)', () => {
  beforeEach(etatFrais);
  afterEach(() => resetData());

  const deuxPorts: WorldMap = {
    ...carte,
    places: [
      { ...carte.places[0], port: { taille: 2, richesse: 2, production: ['poisson-sale'] } },
      { ...carte.places[1], port: { taille: 3, richesse: 3, production: ['bois-mer', 'commerce-mer'], surplus: { vin: 1 } } },
    ],
  };
  const deBord = (id: string) => BOARD_EVENTS.find((e) => e.id === id)!;
  const dEscale = (id: string) => PORT_EVENTS.find((e) => e.id === id)!;
  /** Accoste à Erengrad avec la seule rangée `id` à l'escale. */
  const escale = (id: string | null) => {
    const c = id ? dEscale(id).consequence : undefined;
    setDataset('seaPortEvents', PORT_EVENTS.map(({ min, max, id: rangee, label, desc }) => ({ min, max, id: rangee, label, desc, ...(c ? { consequence: c } : {}) })) as never);
    finalizePortArrivalTo(get, set, deuxPorts.places[1], true);
  };
  function jour(evenement: string): void {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: evenement } } });
    runSeaDay(get, set);
  }
  const joueLeTest = (reussi: boolean) => {
    get().jetLancer('test');
    set({ pendingTest: { ...get().pendingTest!, roll: reussi ? 1 : 99, success: reussi, sl: reussi ? 1 : -3 } });
    get().jetValider('test');
  };
  const profil = () => currentPort(get)!.port;
  beforeEach(() => set({ worldMap: deuxPorts }));

  it('aucune rangée ne porte plus de genre ni de paramètres', () => {
    for (const e of [...BOARD_EVENTS, ...PORT_EVENTS]) expect(Object.keys(e), e.id).not.toContain('kind');
    for (const e of [...BOARD_EVENTS, ...PORT_EVENTS]) expect(Object.keys(e), e.id).not.toContain('params');
  });

  it('Culte de la personnalité : l’allégeance du zélote se tire au d10 et se raconte (l.154-158)', () => {
    for (const graine of [1, 2, 3]) {
      seedBattleRng(graine);
      set({ journal: [] });
      jour('culte-de-la-personnalite');
      draineCascade(get);
      const j = get().journal.join('\n');
      expect(['millénarisme', 'contrebande', 'Stromfels', 'Tzeentch'].some((mot) => j.includes(mot)), j).toBe(true);
    }
  });

  it('Culte de la personnalité : le nombre d’initiés rassemblés se tire au second d10 et s’annonce (l.154-155)', () => {
    for (const graine of [1, 2, 3]) {
      seedBattleRng(graine);
      set({ journal: [] });
      jour('culte-de-la-personnalite');
      draineCascade(get);
      const annonces = get().journal.filter((l) => Array.from({ length: 10 }, (_, i) => t('op.nombreNarratif', { text: "combien d'initiés sensibles à ses paroles il a rassemblés", n: i + 1 })).some((a) => a === l));
      expect(annonces, get().journal.join('\n')).toHaveLength(1);
    }
  });

  it.each([['la-tache-noire', PORT_EVENTS]] as const)(
    '%s se raconte sans conséquence (omission dite au raw.manifest)', (id, table) => {
      expect(table.find((e) => e.id === id)!.consequence).toBeUndefined();
    });

  it('Offre de mission : accepter le colis le destine à un autre port, et 200 CO tombent à la bourse du groupe à l’accostage là-bas, pas ailleurs (l.261)', () => {
    escale('offre-de-mission');
    avanceEtapeCascade(get, undefined, () => 'oui');
    expect(get().vessel!.commissions).toEqual([{ label: expect.any(String), placeId: 'A', brass: 200 * 240 }]);
    const avant = toBrass(partyMoneyTotal(get));
    escale(null);
    expect(toBrass(partyMoneyTotal(get))).toBe(avant);
    expect(get().vessel!.commissions).toHaveLength(1);
    finalizePortArrivalTo(get, set, deuxPorts.places[0], true);
    expect(toBrass(partyMoneyTotal(get))).toBe(avant + 200 * 240);
    expect(get().vessel!.commissions).toBeUndefined();
  });

  it('Offre de mission : refuser le colis ne pose aucune commission', () => {
    escale('offre-de-mission');
    avanceEtapeCascade(get, undefined, () => 'non');
    expect(get().vessel!.commissions).toBeUndefined();
  });

  /** Les passes de `rollPortRepair` à `competence` jusqu'à `manquantes` Blessures, tirées de `rng`. */
  const passesDeReparation = (rng: RNG, competence: number, manquantes: number) => {
    const passes = [];
    for (let restaurees = 0; restaurees < manquantes; restaurees += passes[passes.length - 1].wounds) passes.push(rollPortRepair(competence, manquantes - restaurees, rng));
    return passes;
  };
  const reparer = (graine: number, manquantes: number) => {
    set({ vessel: { ...get().vessel!, wounds: { current: 50 - manquantes, max: 50 } } });
    creditBourse(get, set, get().party[0].id, { gold: 100, silver: 0, brass: 0 });
    const avant = { bourse: toBrass(partyMoneyTotal(get)), temps: get().gameTime };
    seedBattleRng(graine);
    const lignes = portRepairVessel(get, set);
    return { lignes, paye: avant.bourse - toBrass(partyMoneyTotal(get)), duree: get().gameTime - avant.temps };
  };
  /** La ligne de journal d'une réparation de 40 Blessures non lissée, faite des `passes` à `competence` en `duree`. */
  const ligneDeChantier = (passes: ReturnType<typeof passesDeReparation>, competence: number, duree: string) => t('sv.hullRefit', {
    ship: findVehicleById(get().vessel!.vehicleId)!.label, missing: 40, cost: 40 * REPARATION.portCostGoldPerWound, lissage: '', duree,
    competence, reussis: passes.filter((p) => p.success).length, tests: passes.length,
  });

  it('Réparation au port : le constructeur local teste à `constructeurLocal`, un Test raté ne restaure rien, la coque finit pleine au prix des Blessures restaurées (MDG 13 l.643)', () => {
    escale(null);
    const passes = passesDeReparation(makeRNG(4), REPARATION.constructeurLocal, 40);
    expect(passes.some((p) => !p.success && p.wounds === 0), 'la graine produit un Test raté').toBe(true);
    const { lignes, paye, duree } = reparer(4, 40);
    expect(get().vessel!.wounds).toEqual({ current: 50, max: 50 });
    expect(paye).toBe(toBrass({ gold: 40 * REPARATION.portCostGoldPerWound, silver: 0, brass: 0 }));
    const heures = passes.reduce((s, p) => s + p.hours, 0);
    expect(duree).toBe(heures * 60);
    expect(lignes).toEqual([ligneDeChantier(passes, REPARATION.constructeurLocal, t('sv.dureeHeures', { n: heures }))]);
  });

  it('Constructeur de navires itinérant : la réparation de l’escale se teste à Constructeur de navires 68 et prend 1d10 jours, tirés après ses Tests ; il part à l’appareillage (l.255)', () => {
    escale('constructeur-de-navires-itinerant');
    expect(get().vessel!.constructeurDEscale).toEqual({ competence: 68, duree: { dice: { n: 1, sides: 10 } } });
    const rng = makeRNG(4);
    const passes = passesDeReparation(rng, 68, 40);
    const jours = rollDice({ n: 1, sides: 10 }, rng);
    const { lignes, duree } = reparer(4, 40);
    expect(get().vessel!.wounds).toEqual({ current: 50, max: 50 });
    expect(duree).toBe(jours * MINUTES_PER_DAY);
    expect(lignes).toEqual([ligneDeChantier(passes, 68, t('sv.dureeJours', { n: jours }))]);
    set({ lieu: 'B' });
    get().partirEnVoyage('r1', 'mer');
    expect(get().vessel!.constructeurDEscale).toBeUndefined();
  });

  it('Constructeur de navires itinérant : chaque Amélioration qu’il pose tire ses 1d10 jours, même le Blindage (l.255)', () => {
    escale('constructeur-de-navires-itinerant');
    creditBourse(get, set, get().party[0].id, { gold: 100000, silver: 0, brass: 0 });
    const poser = (traitId: string, d100: number) => {
      imposerLesD100(d100);
      const avant = get().gameTime;
      const lignes = installerLAmelioration(get, set, traitId);
      vi.restoreAllMocks();
      return { lignes, jours: (get().gameTime - avant) / MINUTES_PER_DAY };
    };
    expect(poser('blindage-fer', 30)).toMatchObject({ jours: 3 });
    const ancre = poser('ancre', 70);
    expect(ancre.jours).toBe(7);
    expect(ancre.lignes[0]).toContain(t('sv.dureeJours', { n: 7 }));
  });

  /** À quai à Erengrad avec la seule rangée `id` à l'escale, cale suivie (10 rations-jour, 100 L), 10 CO de plus. */
  const aQuai = (id: string | null) => {
    escale(id);
    set({ vessel: { ...get().vessel!, provisions: vivres({ [PRESERVEE]: 10 }), waterLitres: 100 } });
    creditBourse(get, set, get().party[0].id, { gold: 10, silver: 0, brass: 0 });
  };
  const cale = () => ({ provisions: get().vessel!.provisions, eau: get().vessel!.waterLitres, bourse: toBrass(partyMoneyTotal(get)) });
  const RATION_PRESERVEE = 2 * 12, RATION_BISCUITS = 12, TONNEAU = 8 * 12 + 6;

  it('Avitaillement à quai : biscuits et préservée au prix du catalogue, tonneaux à 8/6, chaque vivre à sa part de la cale (MDG 14 l.242, l.248-252)', () => {
    aQuai(null);
    const avant = cale();
    get().avitaillerLeNavire(vivres({ [BISCUITS]: 3, [PRESERVEE]: 5 }), 2);
    expect(cale()).toEqual({
      provisions: { [PRESERVEE]: 15, [BISCUITS]: 3 },
      eau: avant.eau! + 2 * 145,
      bourse: avant.bourse - (3 * RATION_BISCUITS + 5 * RATION_PRESERVEE + 2 * TONNEAU),
    });
  });

  it('Avitaillement à quai : les vivres achetables sont ceux qui tiennent en mer, le frais n’en est pas (MDG 14 l.238)', () => {
    aQuai(null);
    expect(vivresAchetables(get().vessel!)).toEqual([
      { id: PRESERVEE, prix: { gold: 0, silver: 2, brass: 0 } },
      { id: BISCUITS, prix: { gold: 0, silver: 1, brass: 0 } },
    ]);
    set({ journal: [] });
    const avant = cale();
    get().avitaillerLeNavire(vivres({ [FRAIS]: 4 }), 0);
    expect(cale()).toEqual(avant);
    expect(get().journal).toEqual([t('port.vivreHorsVente', { vivre: 'Nourriture, courses/journée' })]);
  });

  it('Avitaillement hors quai : refus nommé, rien ne change', () => {
    set({ vessel: { ...get().vessel!, provisions: vivres({ [PRESERVEE]: 10 }), waterLitres: 100 }, journal: [] });
    const avant = cale();
    get().avitaillerLeNavire(vivres({ [PRESERVEE]: 5 }), 2);
    expect(cale()).toEqual(avant);
    expect(get().journal).toEqual([t('port.pasAQuai')]);
  });

  it('Avitaillement à bourse courte : refus nommé, rien ne change', () => {
    aQuai(null);
    set({ journal: [] });
    const avant = cale();
    const rations = Math.floor(avant.bourse / RATION_PRESERVEE) + 1;
    get().avitaillerLeNavire(vivres({ [PRESERVEE]: rations }), 0);
    expect(cale()).toEqual(avant);
    expect(get().journal).toEqual([t('port.avitaillementTropCher', { cost: formatMoney(fromBrass(rations * RATION_PRESERVEE)) })]);
  });

  it('Bonne pêche : le frais s’achète à 3 sous de cuivre la ration-jour à l’escale, plus après l’appareillage ; la préservée garde son prix (MDG 15 l.262)', () => {
    aQuai('bonne-peche');
    let avant = cale();
    get().avitaillerLeNavire(vivres({ [FRAIS]: 4, [PRESERVEE]: 1 }), 0);
    expect(cale()).toEqual({ ...avant, provisions: { [PRESERVEE]: 11, [FRAIS]: 4 }, bourse: avant.bourse - 4 * 3 - RATION_PRESERVEE });
    set({ lieu: 'B' });
    get().partirEnVoyage('r1', 'mer');
    set({ travelPlan: null });
    escale(null);
    set({ journal: [] });
    avant = cale();
    get().avitaillerLeNavire(vivres({ [FRAIS]: 4 }), 0);
    expect(cale()).toEqual(avant);
    expect(get().journal).toEqual([t('port.vivreHorsVente', { vivre: 'Nourriture, courses/journée' })]);
  });

  it('l’accostage met le navire à quai, l’appareillage l’en retire', () => {
    escale(null);
    expect(get().vessel!.escale).toBe('B');
    set({ lieu: 'B' });
    get().partirEnVoyage('r1', 'mer');
    expect(get().vessel!.escale).toBeUndefined();
  });

  it('Pénuries : au port de l’escale, la Production manque et le Surplus passe en Production, jusqu’au départ du navire (l.253)', () => {
    escale('penuries');
    expect(get().lieu).toBe('B');
    expect(profil().production).toEqual(['commerce-mer', 'vin']);
    expect(profil().surplus).toEqual({});
    get().partirEnVoyage('r1', 'mer');
    expect(get().alterationsDuMarche).toEqual([]);
  });

  it('Saturation de produits : la Production passe en Surplus à +1, le Surplus double (l.263)', () => {
    escale('saturation-de-produits');
    expect(profil().production).toEqual(['commerce-mer']);
    expect(profil().surplus).toEqual({ 'bois-mer': 1, vin: 2 });
  });

  it('Pénuries : l’étal du port n’offre plus la Production, la cargaison de commerce comprise (l.253, l.321)', () => {
    escale('penuries');
    for (const graine of [1, 2, 3, 4, 5]) {
      seedBattleRng(graine);
      ouvrirLePort(get, set);
      for (const o of get().port!.offers) expect(o.cargoId, `graine ${graine}`).toBe('vin');
    }
  });

  it('Trop beau pour être vrai : le client offre jusqu’à 500 Enc à −50 %, le lot embarqué garde son prix de base (l.256)', () => {
    expect(dEscale('trop-beau-pour-etre-vrai').consequence).toEqual({ kind: 'effet', effet: { type: 'ops', ops: [{ op: 'marcheDuPort', offre: { enc: 500, remisePct: 50 } }] } });
    escale('trop-beau-pour-etre-vrai');
    const [alteration] = get().alterationsDuMarche;
    expect(alteration).toMatchObject({ placeId: 'B', jusqua: 'escale', offre: { enc: 500, remisePct: 50 } });
    ouvrirLePort(get, set);
    const offre = get().port!.offers.find((o) => o.remisePct === 50)!;
    expect(offre).toMatchObject({ cargoId: alteration.offre!.cargoId, enc: 500 });
    const devis = devisDAchatEnPort(get(), CAMPAIGN_VESSEL_CARRIER_ID, offre.cargoId, 10);
    expect(devis.estimationGold).toBe(Math.round(10 * offre.basePrice / 2));
  });

  it('Trop beau : le lot acheté s’épuise dans l’offre, l’étal rouvert ne le remet pas', () => {
    creditBourse(get, set, get().party[0].id, { gold: 5000, silver: 0, brass: 0 });
    escale('trop-beau-pour-etre-vrai');
    ouvrirLePort(get, set);
    const offre = get().port!.offers.find((o) => o.remisePct === 50)!;
    expect(acheterAuMarche(get, 'port', CAMPAIGN_VESSEL_CARRIER_ID, offre.cargoId, 10)).toBeNull();
    draineCascade(get);
    const lot = get().vessel!.cargo!.find((l) => l.cargoId === offre.cargoId)!;
    expect(lot.basePriceGold).toBe(offre.basePrice);
    expect(get().alterationsDuMarche[0].offre!.enc).toBe(500 - lot.enc);
  });

  it('Trop beau : le lot épuisé rend à l’étal l’offre ordinaire de la même cargaison', () => {
    escale(null);
    set({ alterationsDuMarche: [{ placeId: 'B', jusqua: 'escale', offre: { cargoId: 'bois-mer', enc: 0, remisePct: 50 } }] });
    const bois = [1, 2, 3, 4, 5].map((graine) => {
      seedBattleRng(graine);
      ouvrirLePort(get, set);
      return get().port!.offers.find((o) => o.cargoId === 'bois-mer');
    }).filter((o) => o !== undefined);
    expect(bois.length).toBeGreaterThan(0);
    for (const o of bois) expect(o.remisePct).toBeUndefined();
  });

  it('Rumeurs commerciales : Ragot réussi, la Demande d’une cargaison croît de 2 dans l’autre port pour 10+2d10 jours (l.259)', () => {
    escale('rumeurs-commerciales');
    joueLeTest(true);
    const [a] = get().alterationsDuMarche;
    expect(a.placeId).toBe('A');
    expect(a.demande!.delta).toBe(2);
    const jours = ((a.jusqua as number) - get().gameTime) / MINUTES_PER_DAY;
    expect(jours).toBeGreaterThanOrEqual(12);
    expect(jours).toBeLessThanOrEqual(30);
    set({ lieu: 'A' });
    expect(profil().demande?.[a.demande!.cargoId]).toBe(2);
    set({ gameTime: a.jusqua as number });
    expect(profil().demande?.[a.demande!.cargoId]).toBeUndefined();
  });

  it('Rumeurs commerciales : Ragot raté, rien ne change', () => {
    escale('rumeurs-commerciales');
    joueLeTest(false);
    expect(get().alterationsDuMarche).toEqual([]);
  });

  it('Autres voyageurs : le laisser approcher apporte une rumeur et signale les périls pendant 1d10 jours (l.205-208)', () => {
    jour('autres-voyageurs');
    avanceEtapeCascade(get, undefined, () => 'oui');
    expect(get().alterationsDuMarche[0]?.demande?.delta).toBe(2);
    const [mod] = get().vessel!.modificateurs!;
    expect(mod.evite).toEqual(['iceberg', 'debris-marins', 'rocher', 'bas-fonds']);
    const jours = ((mod.jusqua as number) - get().gameTime) / MINUTES_PER_DAY;
    expect(jours).toBeGreaterThanOrEqual(0);
    expect(jours).toBeLessThanOrEqual(10);
  });

  it('Autres voyageurs : les dangers signalés font éviter la Collision soudaine qui suit', () => {
    jour('autres-voyageurs');
    avanceEtapeCascade(get, undefined, () => 'oui');
    set({ journal: [], pendingCascade: null });
    jour('collision-soudaine');
    draineCascade(get);
    expect(get().journal.join('\n')).toContain(t('sv.perilEvite', { hazard: findSeaHazard('rocher')!.label, label: deBord('autres-voyageurs').label }));
  });

  it('un `navireMod` qui évite un péril jusqu’au prochain événement de bord est refusé à la donnée', () => {
    expect(gameOpSchema.safeParse({ op: 'navireMod', evite: ['rocher'], jusqua: 'evenementDeBord' }).success).toBe(false);
    expect(gameOpSchema.safeParse({ op: 'navireMod', evite: ['rocher'], jusqua: { jours: 3 } }).success).toBe(true);
  });

  it('Autres voyageurs : le tenir à distance ne change rien', () => {
    jour('autres-voyageurs');
    avanceEtapeCascade(get, undefined, () => 'non');
    expect(get().alterationsDuMarche).toEqual([]);
    expect(get().vessel!.modificateurs ?? []).toEqual([]);
  });

  it('Île inconnue : accoster remplit les tonneaux et la cale, et les bancs de sable menacent sur 1-2 (l.221-223)', () => {
    expect(deBord('ile-inconnue').consequence).toEqual({
      kind: 'choix', invite: 'Accoster sur l’île',
      oui: { kind: 'effet', effet: { type: 'ops', on: 'navire', ops: [
        { op: 'provisions', eauTonneaux: { dice: { n: 2, sides: 10 } } },
        { op: 'provisions', jours: { dice: { n: 1, sides: 10 } }, vivre: { id: FRAIS } },
        { op: 'rollTable', die: '1d10', entries: [{ min: 1, max: 2, ops: [{ op: 'perilDeMer', collision: { id: 'bas-fonds' } }] }, { min: 3, max: 10, ops: [] }] },
      ] } },
    });
    set({ vessel: { ...get().vessel!, waterLitres: 0, provisions: vivres({}) } });
    jour('ile-inconnue');
    avanceEtapeCascade(get, undefined, () => 'oui');
    expect(get().vessel!.waterLitres).toBeGreaterThanOrEqual(2 * 145);
    expect(get().vessel!.provisions![FRAIS as keyof VivresDeCale]).toBeGreaterThan(0);
  });

  it('`marcheDuPort` est inerte dans `applyOps` (op du monde)', () => {
    const h = get().party[0];
    expect(applyOps(h, [{ op: 'marcheDuPort', colonnes: 'penurie' }], { idNeuf: idsDeTest, rng: makeRNG(1) })).toEqual([]);
  });

  it('hors escale, les colonnes ne changent nulle part et le journal le dit', () => {
    applyEffects(get, set, [{ type: 'ops', ops: [{ op: 'marcheDuPort', colonnes: 'saturation' }] } as never]);
    expect(get().alterationsDuMarche).toEqual([]);
    expect(get().journal.join('\n')).toContain(t('eff.marcheHorsPort', { label: nomDeSource(undefined) }));
  });

  it('la fiche Codex dit chaque altération', () => {
    expect(humanizeFlow(dEscale('penuries').consequence!, [])).toContain(t('codex.op.marcheDuPort.penurie'));
    expect(humanizeFlow(dEscale('trop-beau-pour-etre-vrai').consequence!, [])).toContain(t('codex.op.marcheDuPort.offre', { enc: '500', pct: 50 }));
    expect(humanizeFlow(dEscale('rumeurs-commerciales').consequence!, [])).toContain('Demande +2');
  });
});
