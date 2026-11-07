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
