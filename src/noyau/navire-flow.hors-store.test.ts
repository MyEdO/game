import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './monde/scene';
import type { WorldMap } from './worldMap';
import { applyEffects, jouerFlowEntier, runFlow } from './combatEffects';
import { buildSeaPlan, finalizePortArrivalTo, portCareenVessel, runSeaDay } from './seaVoyageFlow';
import { avanceEtapeCascade, draineCascade } from './cascade.testkit';
import { applierDe } from './cascade';
import { creditBourse } from './bourseFlow';
import { MINUTES_PER_DAY } from '../engine/clock';
import type { ModificateurDuNavire } from '../engine/seaVoyage';
import type { Jeu } from './etat';
import { fixtureText } from '../i18n/fixtureText';
import { setDataset, resetData } from '../data/overrides';
import { BOARD_EVENTS, PORT_EVENTS } from '../engine/seaVoyage';
import type { Flow } from '../engine/flowCore';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import type { Combatant } from '../engine/types';
import { itemFromTrappingById } from '../engine/items';
import { shipboardSouls } from './shipCrew';
import { t } from '../i18n';
import { weeklyCrewWageBrass } from '../engine/crewMorale';
import type { GameOp } from '../engine/ops';
import { rule, setRule, resetRule } from '../engine/policy';
import { checkBattleOver } from './combatFlow';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);

const carte: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois-mer'] } },
  ],
  routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

function etatFrais(): void {
  seedBattleRng(1);
  set({
    party: makePregens().slice(0, 3),
    scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null, worldMap: carte, lieu: 'A', travelPlan: null, pendingCascade: null, suspendedCascades: [],
    flags: {}, journal: [],
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
  });
}

const drapeau = (flag: string): Flow => ({ kind: 'do', effect: { type: 'setFlag', flag, value: true } as Effect as never });

describe('runFlow — nœud `choice` (#1652 G1)', () => {
  beforeEach(etatFrais);

  const flux: Flow = {
    kind: 'seq',
    steps: [{ kind: 'choice', prompt: 'Payer', yes: drapeau('oui'), no: drapeau('non') }, drapeau('suite')],
  };

  it('ouvre une décision au meneur ; la suite attend la décision', () => {
    jouerFlowEntier(runFlow(get, set, flux, 'Décision'));
    const etape = get().pendingCascade?.participants[0];
    expect(etape?.kind).toBe('flowChoice');
    expect(etape?.actorId).toBe(get().party[0].id);
    expect(get().flags).toEqual({});
  });

  it.each([['yes', 'oui', 'non'], ['no', 'non', 'oui']])('« %s » joue sa branche, puis la suite du Flow', (cle, joue, ecarte) => {
    jouerFlowEntier(runFlow(get, set, flux, 'Décision'));
    avanceEtapeCascade(get, undefined, () => cle);
    expect(get().pendingCascade).toBeNull();
    expect(get().flags[joue]).toBe(true);
    expect(get().flags[ecarte]).toBeUndefined();
    expect(get().flags.suite).toBe(true);
  });

  it('un coût d’Avantage n’est pas offert hors combat (LDB 14 l.219) : la branche « non » se joue', () => {
    jouerFlowEntier(runFlow(get, set, { kind: 'choice', prompt: 'Payer', advantageCost: 1, yes: drapeau('oui'), no: drapeau('non') }, 'Décision'));
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
    expect(() => applyEffects(get, set, [{ type: 'ops', on: 'party', ops: [{ op: 'shipMorale', delta: { sign: 1, dice: { n: 1, sides: 10 } } }] } as never]))
      .toThrow(/shipMorale ne vise que le navire/);
  });
});

describe('Présages divins : seul un Prêtre ou une Nonne de Manann prie (MDG 15 l.197-198, l.230-232)', () => {
  beforeEach(etatFrais);
  afterEach(() => resetData());

  function jour(evenement: string): void {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: evenement } } });
    runSeaDay(get, set);
  }
  const prier = (talents: Combatant['talents']): void => {
    const [h, ...reste] = get().party;
    set({ party: [{ ...h, skills: [...(h.skills ?? []), { id: 'priere', characteristic: 'sociabilite', advances: 20 }], talents: [...h.talents, ...talents] }, ...reste] });
  };
  const etapeDePriere = () => get().pendingCascade?.participants.find((s) => s.stake && 'key' in s.stake && s.stake.key?.kind === 'sea-priere');

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
    const choix: Flow = { kind: 'choice', prompt: 'Payer', yes: drapeau('paye') };
    setDataset('seaPortEvents', PORT_EVENTS.map(({ min, max, id, label, desc }) => ({ min, max, id, label, desc, consequence: choix })) as never);
    finalizePortArrivalTo(get, set, carte.places[1], true);
    expect(get().pendingCascade?.participants[0].kind).toBe('flowChoice');
    expect(get().lieu).toBe('A');
    avanceEtapeCascade(get, undefined, () => 'yes');
    expect(get().flags.paye).toBe(true);
    expect(get().lieu).toBe('B');
  });
});

describe('Navire et climat en grammaire (#1652 lot 2 — MDG 15)', () => {
  beforeEach(etatFrais);
  afterEach(() => resetData());

  function jour(evenement: string): void {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: evenement } } });
    runSeaDay(get, set);
  }
  const etape = (kind: string) => get().pendingCascade?.participants.find((s) => s.kind === kind);
  const ilYA = (jours: number) => get().gameTime + jours * MINUTES_PER_DAY;
  /** Remplace la `consequence` de la rangée de bord `id` (une durée constante rend l'échéance lisible). */
  const consequenceDeBord = (id: string, consequence: Flow) =>
    setDataset('seaBoardEvents', BOARD_EVENTS.map((e) => (e.id === id ? { ...e, consequence } : e)) as never);
  const surLeNavire = (ops: unknown[]): Flow => ({ kind: 'do', effect: { type: 'ops', on: 'navire', ops } as never });
  /** Échéances d'horloge des effets actifs du héros. */
  const echeances = (h: Combatant): number[] => (h.activeEffects ?? []).flatMap((e) => (e.duration.scale === 'clock' ? [e.duration.until] : []));

  it('Ouragan : Test d’équipage d’Affaler Difficile (–20) ; raté, 3 Coups Critiques au Gréement (l.144-145)', () => {
    jour('ouragan');
    expect(etape('flowCrewTest')?.label).toBe('Affaler les voiles');
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
      return Number(etape('flowCrewTest')?.meta?.aggregateFlatDR ?? 0);
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
    expect(etape('flowCrewTest')).toBeUndefined();
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
      applierDe('progression')!(get, set, { id: 'p', kind: 'progression', label: fixtureText('Progression'), result: { roll: 0, target: 0, sl: 2, success: true } }, undefined, { steps: [], index: 0 });
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
    ['yes', (v: NonNullable<Jeu['vessel']>, t0: number) => expect(v.modificateurs).toEqual([expect.objectContaining({ m: -2, jusqua: t0 + MINUTES_PER_DAY })])],
    ['no', (v: NonNullable<Jeu['vessel']>) => { expect(v.modificateurs ?? []).toEqual([]); expect(v.morale.score).toBeLessThan(75); }],
  ])('Vaisseau fantôme (littéralement), « %s » : changer de cap (M −2 un jour) ou perdre 2d10 Moral (l.187-188)', (cle, verifie) => {
    jour('vaisseau-fantome-litteralement');
    expect(etape('flowChoice')).toBeDefined();
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
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: evenement } } });
    runSeaDay(get, set);
  }
  const consequence = (id: string) => BOARD_EVENTS.find((e) => e.id === id)?.consequence;
  const consequenceDeBord = (id: string, c: Flow) =>
    setDataset('seaBoardEvents', BOARD_EVENTS.map((e) => (e.id === id ? { ...e, consequence: c } : e)) as never);
  const surLeNavire = (ops: unknown[]): Effect => ({ type: 'ops', on: 'navire', ops } as never);
  const ration = (uid: string) => ({ ...itemFromTrappingById('ration')!, uid });
  const rations = (h: Combatant): number => (h.items ?? []).filter((it) => it.trappingId === 'ration').length;

  it('la donnée porte la RAW : débris 1d100, épave 2d100 sur décision ; pénurie la moitié ; manne 1d10 jours et +2d10 Moral', () => {
    const navire = (ops: unknown[]) => ({ kind: 'do', effect: { type: 'ops', on: 'navire', ops } });
    expect(consequence('debris-marins')).toEqual({ kind: 'choice', prompt: 'Repêcher les caisses', yes: navire([{ op: 'cargaison', enc: { dice: { n: 1, sides: 100 } } }]) });
    expect(consequence('vaisseau-fantome-figurativement')).toEqual({ kind: 'choice', prompt: 'Monter à bord', yes: navire([{ op: 'cargaison', enc: { dice: { n: 2, sides: 100 } } }]) });
    expect(consequence('penurie-de-nourriture')).toEqual(navire([{ op: 'provisions', gateesPct: 50 }]));
    expect(consequence('manne-de-manann')).toEqual(navire([
      { op: 'provisions', jours: { dice: { n: 1, sides: 10 } } },
      { op: 'shipMorale', delta: { sign: 1, dice: { n: 2, sides: 10 } } },
    ]));
  });

  it.each([['debris-marins'], ['vaisseau-fantome-figurativement']])('%s : repêcher charge une cargaison tirée, à son prix de base (l.209-210, l.224-225)', (id) => {
    const c = consequence(id) as Extract<Flow, { kind: 'choice' }>;
    consequenceDeBord(id, { ...c, yes: { kind: 'do', effect: surLeNavire([{ op: 'cargaison', enc: 37 }]) as never } });
    jour(id);
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'flowChoice')).toBe(true);
    expect(get().vessel!.cargo ?? []).toHaveLength(0);
    avanceEtapeCascade(get, undefined, () => 'yes');
    expect(get().vessel!.cargo).toEqual([expect.objectContaining({ enc: 37, basePriceGold: expect.any(Number) })]);
    expect(get().vessel!.cargo![0].basePriceGold).toBeGreaterThan(0);
  });

  it('débris marins : renoncer ne charge rien (« Si vous les repêchez », l.209)', () => {
    jour('debris-marins');
    avanceEtapeCascade(get, undefined, () => 'no');
    expect(get().vessel!.cargo ?? []).toHaveLength(0);
  });

  it('pénurie de nourriture : la moitié des provisions à bord, cale ET rations des héros, est gâtée (l.169-170)', () => {
    const [a, b, c] = get().party;
    set({
      party: [{ ...a, items: [ration('r1'), ration('r2'), ration('r3'), ration('r4')] }, { ...b, items: [ration('r5'), ration('r6'), ration('r7')] }, { ...c, items: [] }],
      vessel: { ...get().vessel!, provisions: 41 },
    });
    applyEffects(get, set, [surLeNavire([{ op: 'provisions', gateesPct: 50 }])]);
    expect(get().vessel!.provisions).toBe(21);
    expect(get().party.map(rations)).toEqual([2, 2, 0]);
  });

  it('pénurie de nourriture sans vivres d’équipage suivis : seules les rations des héros se gâtent', () => {
    const [a, ...reste] = get().party;
    set({ party: [{ ...a, items: [ration('r1'), ration('r2')] }, ...reste] });
    applyEffects(get, set, [surLeNavire([{ op: 'provisions', gateesPct: 50 }])]);
    expect(get().vessel!.provisions).toBeUndefined();
    expect(rations(get().party[0])).toBe(1);
  });

  it('manne de Manann : de quoi nourrir l’équipage N jours, une ration par marin et par jour (l.235 ; MDG 14 l.238)', () => {
    set({ vessel: { ...get().vessel!, provisions: 5 } });
    const equipage = shipboardSouls(get()).crew;
    expect(equipage).toBeGreaterThan(0);
    applyEffects(get, set, [surLeNavire([{ op: 'provisions', jours: 3 }])]);
    expect(get().vessel!.provisions).toBe(5 + 3 * equipage);
  });

  it('manne de Manann jouée en mer : vivres de la cale et Moral montent (l.235-236)', () => {
    set({ vessel: { ...get().vessel!, provisions: 0 } });
    jour('manne-de-manann');
    const ligne = get().journal.find((l) => l.startsWith('Provisions de bord'));
    expect(ligne).toBeDefined();
    expect(get().vessel!.morale.score).toBeGreaterThan(75);
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
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jour-par-jour' })!;
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
    avanceEtapeCascade(get, undefined, () => 'yes');
    expect(get().vessel!.crewLost).toBe(2);
  });

  it('Message dans une bouteille : renoncer ne change rien', () => {
    perdus(3);
    jour('message-dans-une-bouteille');
    avanceEtapeCascade(get, undefined, () => 'no');
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
    const c = consequence('canot-de-sauvetage') as Extract<Flow, { kind: 'choice' }>;
    expect(c.prompt).toBe('Recueillir les rescapés');
    const table = (c.yes as Extract<Flow, { kind: 'do' }>).effect.ops[0] as Extract<GameOp, { op: 'rollTable'; entries: unknown }>;
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
    avanceEtapeCascade(get, undefined, () => 'yes');
    expect(get().vessel!.crewLost).toBe(1);
    expect(get().lieu).toBe('B');
  });

  it('Passager clandestin non repéré : il rejoint l’équipage quand même (l.258)', () => {
    perdus(2);
    setDataset('seaPortEvents', PORT_EVENTS.map(({ min, max, id, label, desc }) => ({ min, max, id, label, desc, consequence: consequence('passager-clandestin', 'portEvents') })) as never);
    finalizePortArrivalTo(get, set, carte.places[1], true);
    joueLeTest(false);
    expect(get().vessel!.crewLost).toBe(1);
    expect(get().lieu).toBe('B');
  });

  it('Gangs des quais : 2d10 Enc perdus au prochain déchargement, levés à l’accostage suivant (l.250)', () => {
    expect(consequence('gangs-des-quais', 'portEvents')).toEqual({ kind: 'do', effect: { type: 'ops', on: 'navire', ops: [{ op: 'cargaison', perteAuDechargement: { dice: { n: 2, sides: 10 } } }] } });
    applyEffects(get, set, [surLeNavire([{ op: 'cargaison', perteAuDechargement: 7 }])]);
    expect(get().vessel!.perteAuDechargement).toBe(7);
    setDataset('seaPortEvents', PORT_EVENTS.map(({ min, max, id, label, desc }) => ({ min, max, id, label, desc })) as never);
    finalizePortArrivalTo(get, set, carte.places[1], true);
    expect(get().vessel!.perteAuDechargement).toBeUndefined();
  });
});

describe('Périls et navires hostiles en grammaire (#1652 lot 4 — MDG 15, valeurs maison du 2026-11-07)', () => {
  beforeEach(etatFrais);
  afterEach(() => { resetData(); resetRule('cibleVulnerablePct'); resetRule('boardingWaveSize'); });

  /** Un jour de traversée neuf où se joue `evenement` ; la conduite du jour précédent est abandonnée. */
  function jour(evenement: string): void {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jour-par-jour' })!;
    set({ pendingCascade: null, travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: evenement } } });
    runSeaDay(get, set);
  }
  const consequence = (id: string) => BOARD_EVENTS.find((e) => e.id === id)?.consequence;
  const surLeNavire = (ops: unknown[]): Flow => ({ kind: 'do', effect: { type: 'ops', on: 'navire', ops } as never });
  const hail = () => get().pendingCascade?.participants.find((s) => s.kind === 'sea-pirate-hail');
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

  it('navire hostile moins nombreux et moins armé : il passe son chemin (seuil `cibleVulnerablePct`, maison)', () => {
    const ames = shipboardSouls(get()).total;
    setRule('cibleVulnerablePct', Math.min(300, Math.ceil((45 * 100) / ames / 10) * 10 + 10));
    jour('langskip-skaeling');
    expect(hail()).toBeUndefined();
    expect(journal()).toContain(t('sv.hostilePasse', { label: BOARD_EVENTS.find((e) => e.id === 'langskip-skaeling')!.label }));
  });

  it('navire hostile mieux armé en grands canons : il attaque quel que soit l’effectif (Cogue, 6 grands canons)', () => {
    setRule('cibleVulnerablePct', 300);
    jour('cogue-pirate');
    expect(hail()).toBeDefined();
  });

  it('abordage : tout l’équipage RAW est en jeu, il monte par vagues de `boardingWaveSize` à mesure que le pont se dégage (l.171)', () => {
    jour('cogue-pirate');
    get().jetRegler('cascade', 'choix', 'combattre', 'sea-pirate-hail');
    get().jetValider('cascade');
    const coque = () => get().battle!.combatants.find((c) => c.id === 'enemy-enc-abordage-0')!;
    const vague = Number(rule('boardingWaveSize'));
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
