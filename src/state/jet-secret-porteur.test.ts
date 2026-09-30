/**
 * #700 L1 — le socle du jet SECRET : un dé a un PORTEUR (qui le tient) et une AUDIENCE (qui en voit la
 * trace). Le secret est la COMPOSITION « porteur MJ + audience porteur ». Réf : #700 (2026-09-29),
 * LDB 25 l.24, LDB 46 l.181.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type GameState } from './store';
import { openRoll, resolveSurface, freeCons, type RollRequest } from './rollSeam';
import { registerCascadeApplier } from './cascade';
import { porteurResolu } from './pendings';
import { modalOwnerOf } from './modalArbiter';
import {
  MJ_STEP_OWNER, tenuParUnHumain, seatOwns, canFixDie, traceVisible, journalDeCombatVisible,
} from './netOwnership';
import { advanceTurn } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { setRule, resetRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';
import { pregen, PREGEN } from '../data/pregens';
import { windsOfMagicTable } from '../data';
import { fixtureText } from '../i18n/fixtureText';
import type { Combatant } from '../engine/types';

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const KIND = 'jet-secret-fixture';
registerCascadeApplier(KIND, () => ({ consequences: freeCons([fixtureText('conséquence du dé secret')]) }));

/** Le dé du MJ : un seuil pur du monde (LDB 25 l.24 « le MJ peut secrètement lancer 1d100 »). */
const REQUETE_SECRETE: RollRequest = {
  side: { worldSide: 'world' }, actionLabel: 'Petite Prière', test: {}, difficulty: 'intermediaire',
  evaluation: 'seuil', porteur: MJ_STEP_OWNER, audience: 'porteur',
};

function heros(secondeVue = false): Combatant {
  const w = pregen(PREGEN.sorcier);
  w.skills = [...(w.skills as Combatant['skills']), { id: 'perception', advances: 60 } as never];
  if (secondeVue) w.talents = [...w.talents, { talentId: 'seconde-vue', times: 1 }];
  return w;
}

function combat(secondeVue = false): void {
  set({ battle: null, pendingCascade: null, suspendedCascades: [], party: [heros(secondeVue)] });
  get().startScene(testScene());
  seedBattleRng(7);
  get().startCombat('enc-mutants');
}

/** Sièges : `gmSeat` null = pas de siège MJ ; `mySeat` = le siège qui regarde. */
function sieges(gmSeat: number | null, mySeat = 0): void {
  set({ net: { ...get().net, mode: gmSeat != null && gmSeat !== 0 ? 'host' : 'local', mySeat, gmSeat, ownership: {}, seatNames: gmSeat ? { 0: 'hôte', [gmSeat]: 'MJ' } : {} } } as Partial<GameState>);
}

const lignesSecretes = () => get().battle!.log.filter((l) => l.audience === MJ_STEP_OWNER);

describe('#700 — porteur DÉCLARÉ', () => {
  beforeEach(() => { vi.useFakeTimers(); resetDesFixes(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetDesFixes(); sieges(null); set({ battle: null, pendingCascade: null, suspendedCascades: [] }); });

  it("mono : l'étape porte `porteurId`, `porteurResolu` et l'arbitre des modales le rendent", () => {
    combat();
    set({ pendingCascade: null, suspendedCascades: [] });
    sieges(0);
    openRoll(get, set, { ...REQUETE_SECRETE, audience: undefined }, KIND, { baseValue: 1 });
    const st = get().pendingCascade!.participants[0];
    expect(st.porteurId).toBe(MJ_STEP_OWNER);
    expect(porteurResolu(st)).toBe(MJ_STEP_OWNER);
    expect(modalOwnerOf(get())).toBe(MJ_STEP_OWNER);
  });
});

describe('#700 — la route MJ (partagée avec la route ennemi)', () => {
  beforeEach(() => { vi.useFakeTimers(); resetDesFixes(); combat(); set({ pendingCascade: null, suspendedCascades: [] }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetDesFixes(); sieges(null); set({ battle: null, pendingCascade: null, suspendedCascades: [] }); });

  it('siège MJ : le porteur MJ est TENU, surface V, possédé par le seul siège MJ', () => {
    sieges(1);
    expect(tenuParUnHumain(get(), MJ_STEP_OWNER)).toBe(true);
    expect(resolveSurface(get, REQUETE_SECRETE, KIND)).toBe('V');
    expect(seatOwns(get(), 1, MJ_STEP_OWNER)).toBe(true);
    expect(seatOwns(get(), 0, MJ_STEP_OWNER)).toBe(false);
  });

  it('siège MJ : `canFixDie` VRAI au siège MJ, FAUX à un autre siège (option de pose active)', () => {
    setDesFixes(true);
    sieges(1, 1);
    expect(canFixDie(get(), MJ_STEP_OWNER)).toBe(true);
    sieges(1, 0);
    expect(canFixDie(get(), MJ_STEP_OWNER)).toBe(false);
  });

  it("sans siège MJ : personne ne tient le dé (surface I) ; l'ACTION se replie à l'hôte comme pour un ennemi", () => {
    sieges(null);
    expect(tenuParUnHumain(get(), MJ_STEP_OWNER)).toBe(false);
    expect(resolveSurface(get, REQUETE_SECRETE, KIND)).toBe('I');
    expect(seatOwns(get(), 0, MJ_STEP_OWNER)).toBe(true);
    const ennemi = get().battle!.combatants.find((c) => c.kind === 'enemy')!;
    expect(seatOwns(get(), 0, ennemi.id)).toBe(true);
    expect(tenuParUnHumain(get(), ennemi.id)).toBe(false);
  });
});

describe("#700 — l'AUDIENCE des traces", () => {
  beforeEach(() => { vi.useFakeTimers(); combat(); set({ pendingCascade: null, suspendedCascades: [] }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); sieges(null); set({ battle: null, pendingCascade: null, suspendedCascades: [] }); });

  it('sans siège MJ : la TRACE du dé existe dans l’état, invisible à tout siège ; la CONSÉQUENCE est publique', () => {
    sieges(null);
    const avant = get().battle!.log.length;
    openRoll(get, set, REQUETE_SECRETE, KIND, { baseValue: 1 });
    const [trace, consequence, ...reste] = get().battle!.log.slice(avant);
    expect(reste).toEqual([]);
    expect(trace.audience, 'la trace du dé est réservée à son porteur').toBe(MJ_STEP_OWNER);
    expect(traceVisible(get(), 0, trace)).toBe(false);
    expect(traceVisible(get(), 1, trace)).toBe(false);
    expect(consequence.text).toBe('conséquence du dé secret');
    expect(consequence.audience, 'ce qui ARRIVE n’est pas secret').toBeUndefined();
    expect(traceVisible(get(), 0, consequence)).toBe(true);
    expect(journalDeCombatVisible(get(), get().battle!.log)).toEqual([...get().battle!.log.slice(0, avant), consequence]);
  });

  it('avec siège MJ : la ligne est visible au SEUL siège MJ', () => {
    sieges(null);
    openRoll(get, set, REQUETE_SECRETE, KIND, { baseValue: 1 });
    const ligne = lignesSecretes()[0];
    sieges(1);
    expect(traceVisible(get(), 1, ligne)).toBe(true);
    expect(traceVisible(get(), 0, ligne)).toBe(false);
  });

  it('une ligne sans audience reste visible partout', () => {
    sieges(1);
    const publique = get().battle!.log[0];
    expect(publique.audience).toBeUndefined();
    expect(traceVisible(get(), 0, publique)).toBe(true);
    expect(traceVisible(get(), 1, publique)).toBe(true);
  });
});

describe('#700 — Vents Tourbillonnants par la porte (LDB 46 l.181)', () => {
  beforeEach(() => { vi.useFakeTimers(); sieges(null); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('vents-tourbillonnants'); sieges(null); set({ battle: null, pendingCascade: null, suspendedCascades: [] }); });

  it('sans siège MJ : le 1d10 se résout sur place ; la Perception du héros ouvre SA fenêtre', () => {
    setRule('vents-tourbillonnants', 'scene');
    combat(true);
    const b = get().battle!;
    expect(b.windsOfMagic).toMatchObject({ revealed: false });
    const vue = get().pendingCascade!.participants.find((st) => st.kind === 'windsOfMagicSight')!;
    const hero = b.combatants.find((c) => c.kind === 'hero')!;
    expect(vue.actorId).toBe(hero.id);
    expect(porteurResolu(vue)).toBe(hero.id);
    expect(vue.audience).toBeUndefined();
    expect(get().pendingCascade!.participants.some((st) => st.kind === 'windsOfMagic')).toBe(false);
  });

  it('la Perception réussie RÉVÈLE la force, sa ligne est publique', () => {
    setRule('vents-tourbillonnants', 'scene');
    let reussie = false;
    for (let seed = 1; seed <= 20 && !reussie; seed++) {
      combat(true);
      seedBattleRng(seed);
      get().cascadeResolveAll();
      const vue = get().pendingCascade?.participants.find((st) => st.kind === 'windsOfMagicSight');
      reussie = !!vue?.result?.success;
      expect(get().battle!.windsOfMagic!.revealed).toBe(reussie);
    }
    expect(reussie).toBe(true);
    const publique = get().battle!.log.find((l) => l.text.includes('perçoit les Vents'))!;
    expect(publique.audience).toBeUndefined();
  });

  it('siège MJ : la table ouvre la fenêtre du MJ, la Perception la SUIT dans la même séquence', () => {
    setRule('vents-tourbillonnants', 'scene');
    sieges(1);
    combat(true);
    const kinds = get().pendingCascade!.participants.map((st) => st.kind);
    expect(kinds.indexOf('windsOfMagic')).toBeGreaterThanOrEqual(0);
    expect(kinds.indexOf('windsOfMagicSight')).toBeGreaterThan(kinds.indexOf('windsOfMagic'));
    const table = get().pendingCascade!.participants.find((st) => st.kind === 'windsOfMagic')!;
    expect(porteurResolu(table)).toBe(MJ_STEP_OWNER);
    expect(table.audience).toBe('porteur');
  });

  it('grain `round` : UN tirage par franchissement de Round (site unique)', () => {
    setRule('vents-tourbillonnants', 'round');
    combat(false);
    get().confirmRoundStart();
    vi.clearAllTimers();
    const forces = new Set(windsOfMagicTable.map((e) => e.label));
    const tirages = () => get().battle!.log.filter((l) => forces.has(l.text)).length;
    const tiragesAvant = tirages();
    set({ battle: { ...get().battle!, windsOfMagic: { roll: 999, mod: 0, revealed: false } } });
    set({ battle: { ...get().battle!, turn: get().battle!.order.length - 1 } });
    advanceTurn(get, set);
    expect(get().battle!.windsOfMagic!.roll).toBeLessThanOrEqual(10);
    expect(tirages() - tiragesAvant, 'un seul site tire la force des Vents').toBe(1);
  });
});
