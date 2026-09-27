/**
 * #1064 — PARITÉ du contexte d'incantation : le PREMIER jet (`castRoll`) et la RELANCE
 * (`FLOWS.cast.reresolve`) lisent le MÊME contexte (`castContextMods`) — « N'écoutez point la
 * Sorcière » (LDB 42), attribut de Domaine (LDB 48 l.157) et bonus d'ENVIRONNEMENT de Domaine
 * (Ghyran, LDB 48 l.690). Avant ce lot, le bonus d'environnement n'était appliqué QU'À LA RELANCE :
 * relancer un Sort de Vie en zone rurale changeait la cible sous le joueur.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { castingValue } from '../engine/magic';
import { castContextMods } from './combatFlow';
import { domainEnvironmentBonus } from '../engine/domainAttributes';
import { findSpellById } from '../data';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

const SPELL = 'ecorce'; // Domaine Vie (Ghyran), NI 3, portée Contact

describe('Incantation — le contexte est le MÊME au premier jet et à la relance', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const mage = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'M', seed: 3 });
    useGame.setState({ party: [mage] });
    useGame.getState().startScene({ ...testScene(), environment: 'rural' } as never);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const M = b.combatants.find((c) => c.label === 'M')!;
    M.spells = [SPELL];
    M.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 10 });
    M.characteristics.intelligence = 40;
    M.advantage = 0;
    M.fortune = 3; // de quoi relancer
    useGame.setState({
      battle: { ...useGame.getState().battle! },
      pendingCast: { casterId: M.id, targetId: M.id, spellId: SPELL, missile: false, focused: false, result: null },
    });
    return M;
  }

  it('scène `rural` + Domaine Vie : le bonus d’environnement est DÉJÀ dans la cible du premier jet', () => {
    const M = setup();
    const spell = findSpellById(SPELL)!;
    expect(domainEnvironmentBonus(spell, 'rural')).toBe(10); // la donnée porte bien le bonus
    useGame.getState().castRoll();
    const first = useGame.getState().pendingCast!.result!;
    expect(first.target).toBe(castingValue(M as Combatant, 'langue', 'magick') + 10);
  });

  it('la RELANCE rend la même cible que le premier jet (aucun mod n’apparaît/disparaît)', () => {
    setup();
    useGame.getState().castRoll();
    const first = useGame.getState().pendingCast!.result!.target;
    useGame.getState().castReroll();
    expect(useGame.getState().pendingCast!.result!.target).toBe(first);
  });

  it('SOURCE UNIQUE : `castContextMods` porte les trois lignes NOMMÉES et leur total', () => {
    const M = setup();
    const spell = findSpellById(SPELL)!;
    const ctx = castContextMods(useGame.getState(), M as Combatant, M as Combatant, spell);
    expect(ctx.env).toBe(10);
    expect(ctx.total).toBe(ctx.ward + ctx.domain + ctx.env);
    expect(ctx.mods.map((m) => m.label)).toContain('Environnement');
  });
});
