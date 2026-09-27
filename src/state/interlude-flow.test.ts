/**
 * Interlude « Entre deux aventures » (LDB 22-23) : ouverture (événements d100, Activités =
 * min(3, semaines)), clôture (« Avec le pouvoir », Argent à gaspiller, Revenus, le temps passe),
 * Effet d'éditeur `interlude`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { draineCascade } from './cascadeTestKit';
import { applyEffects } from './combatFlow';
import { interludeEventFor } from '../data/interludeEvents';
import { toBrass, fromBrass } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { setRule, resetRule } from '../engine/policy';

/** Événement d'un héros, dé EXIGÉ : sans l'option « Dés fixés », le dé tombe à l'ouverture (#942 L7)
 *  — un `eventRoll` absent ici signifierait un tirage resté en attente, jamais un défaut de type. */
function eventOf(st: { eventRoll?: number }) {
  expect(st.eventRoll, 'dé d’Événement non tiré à l’ouverture').toBeDefined();
  return interludeEventFor(st.eventRoll!);
}
describe('Interlude — flux start/end', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    const b = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 2 });
    useGame.setState({ party: [a, b], battle: null, interlude: null, bank: [], pendingOrders: [], journal: [] });
    useGame.getState().startScene(testScene);
    vi.clearAllTimers();
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, fromBrass(1000)); // bourse perso de départ (#531)
    useGame.getState().seedRng(11);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('startInterlude : événements tirés par héros, Activités = min(3, semaines), écran dédié', () => {
    useGame.getState().startInterlude(2);
    draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    const itl = useGame.getState().interlude!;
    expect(itl).toBeTruthy();
    expect(useGame.getState().screen).toBe('interlude');
    const states = Object.values(itl.perHero);
    expect(states).toHaveLength(2);
    for (const st of states) {
      expect(st.eventRoll).toBeGreaterThanOrEqual(1);
      expect(st.eventRoll).toBeLessThanOrEqual(100);
      const ev = eventOf(st);
      // Activités : 2 semaines → 2, moins l'éventuelle perte d'événement (cohérence roll↔fx).
      expect(st.left).toBe(Math.max(0, 2 - (ev.fx?.loseActivity ? 1 : 0)));
      // Le journal porte l'événement (verbatim).
      expect(useGame.getState().journal.join('\n')).toContain(ev.label);
    }
  });

  it('startInterlude : 5 semaines → max 3 Activités (« maximum de trois », LDB 23 l.5)', () => {
    useGame.getState().startInterlude(5);
    draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    for (const st of Object.values(useGame.getState().interlude!.perHero)) {
      const ev = eventOf(st);
      expect(st.left).toBe(Math.max(0, 3 - (ev.fx?.loseActivity ? 1 : 0)));
    }
  });

  it('interludeEnd : Argent à gaspiller (bourse → Revenus seuls), retour campagne, le temps passe', () => {
    useGame.getState().startInterlude(1);
    draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    const itl = useGame.getState().interlude!;
    const heroId = Object.keys(itl.perHero)[0];
    itl.perHero[heroId].revenueBrass = 120; // Revenus simulés (l'Activité arrive en P2)
    const t0 = useGame.getState().gameTime;
    useGame.getState().interludeEnd();
    expect(useGame.getState().interlude).toBeNull();
    expect(useGame.getState().screen).toBe('campaign');
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(120); // tout le reste a été gaspillé, seuls les Revenus perso subsistent
    expect(useGame.getState().gameTime).toBeGreaterThan(t0); // 7 jours de repos écoulés
  });

  // #897 : `startInterlude` reconstruit `perHero` À NEUF (`InterludeState.perHero`, doc ci-dessus) —
  // un Artisanat/Rituel en cours doit donc vivre AILLEURS pour survivre à la clôture. Sonde chiffrée :
  // entamer (mutation directe, comme `craftStart`/`openRitualFocus`), clôturer, rouvrir, constater la
  // reprise au MÊME point (`Combatant.craft`/`Combatant.ritual`, `engine/types.ts`).
  it('#897 : un Artisanat/Rituel en cours SURVIT à la clôture ET à la réouverture d’un interlude', () => {
    useGame.getState().startInterlude(1);
    draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    const h = useGame.getState().party[0];
    h.craft = { trappingId: 'dague', tier: 'bronze', avail: 'Commune', atouts: [], defauts: [], drDone: 3, drTarget: 5, difficulty: 'accessible' };
    h.ritual = { spellId: 'graver-une-pierre-d-ogham', drDone: 7, drTarget: 25 };
    useGame.getState().interludeEnd();
    expect(useGame.getState().interlude).toBeNull(); // clôture EFFECTIVE (`interlude` reconstruit à neuf au prochain `startInterlude`)
    expect(useGame.getState().party[0].craft).toEqual({ trappingId: 'dague', tier: 'bronze', avail: 'Commune', atouts: [], defauts: [], drDone: 3, drTarget: 5, difficulty: 'accessible' });
    expect(useGame.getState().party[0].ritual).toEqual({ spellId: 'graver-une-pierre-d-ogham', drDone: 7, drTarget: 25 });
    useGame.getState().startInterlude(1); // réouverture : `perHero` neuf, `craft`/`ritual` restent au héros
    draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    expect(useGame.getState().party[0].craft?.drDone).toBe(3);
    expect(useGame.getState().party[0].ritual?.drDone).toBe(7);
  });

  it('la clôture NOURRIT le groupe (vie en ville payée par le gaspillage) — pas de famine sur 3 semaines', () => {
    useGame.getState().startInterlude(3);
    draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    const before = useGame.getState().party.map((h) => h.wounds.current);
    useGame.getState().interludeEnd(); // 21 jours — sans le couvert, la Faim RAW tuerait le groupe
    const party = useGame.getState().party;
    party.forEach((h, i) => expect(h.wounds.current, h.label).toBeGreaterThanOrEqual(before[i]));
    expect(useGame.getState().journal.join('\n')).not.toMatch(/dépérit|Faim :/);
  });

  it('« Avec le pouvoir » : Niveau 3 sans Revenus → retombe au Niveau 2 (LDB 23 l.33)', () => {
    useGame.getState().startInterlude(1);
    draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    const hero = useGame.getState().party[0];
    hero.careerLevel = 3;
    useGame.getState().interludeEnd();
    expect(useGame.getState().party[0].careerLevel).toBe(2);
    expect(useGame.getState().journal.join('\n')).toMatch(/néglig/);
  });

  it('Effet d’éditeur interlude : applyEffects ouvre l’interlude', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'interlude', weeks: 2 }]);
    expect(useGame.getState().interlude?.weeks).toBe(2);
    expect(useGame.getState().screen).toBe('interlude');
  });

  it('en combat : refusé', () => {
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    useGame.getState().startInterlude(1);
    draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    expect(useGame.getState().interlude).toBeNull();
  });

  it('règle interlude-enabled OFF : l’effet interlude est ignoré silencieusement', () => {
    setRule('interlude-enabled', false);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'interlude', weeks: 2 }]);
    expect(useGame.getState().interlude).toBeNull();
    resetRule('interlude-enabled');
  });

  it('interlude-elf-duty (défaut) : un elfe ≥3 semaines perd 1 Activité (devoir)', () => {
    const elf = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'E', seed: 3 });
    elf.species = 'Haut Elfe';
    useGame.setState({ party: [elf], interlude: null });
    useGame.getState().startInterlude(3);
    draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    const st = useGame.getState().interlude!.perHero[elf.id];
    const ev = eventOf(st);
    expect(st.left).toBe(Math.max(0, 3 - (ev.fx?.loseActivity ? 1 : 0) - 1)); // −1 devoir elfique
  });

  it('interlude-elf-duty OFF : l’elfe garde son Activité', () => {
    setRule('interlude-elf-duty', false);
    const elf = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'E', seed: 3 });
    elf.species = 'Haut Elfe';
    useGame.setState({ party: [elf], interlude: null });
    useGame.getState().startInterlude(3);
    draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    const st = useGame.getState().interlude!.perHero[elf.id];
    const ev = eventOf(st);
    expect(st.left).toBe(Math.max(0, 3 - (ev.fx?.loseActivity ? 1 : 0))); // pas de devoir
    resetRule('interlude-elf-duty');
  });
});
