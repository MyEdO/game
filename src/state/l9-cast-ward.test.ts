/**
 * « N'écoutez point la Sorcière » (LDB 42) : « Tous les Sorts qui ciblent quelque chose ou
 * quelqu'un dans les (Bonus de Sociabilité) mètres subissent une pénalité de -20 aux Tests de
 * Langue (Magick), en plus de toute autre pénalité. » — aura `castWard` du porteur, consommée
 * au CALCUL du Test d'incantation (castRoll/castReroll/castDarkPact).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { castingValue } from '../engine/magic';
import { findSpellById } from '../data';
import { previewCast } from './combatFlow';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

describe('castWard — pénalité −20 aux Sorts ciblant la zone du prêtre', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup(priestPos: { x: number; y: number }) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const priest = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'P', seed: 2 });
    useGame.setState({ party: [hero, priest] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.label === 'H')!;
    const P = b.combatants.find((c) => c.label === 'P')!;
    const E = b.combatants.filter((c) => c.kind === 'enemy')[0];
    // L'ennemi devient un lanceur de Sorts (Langue (Magick)).
    E.spells = ['flechette'];
    E.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 10 });
    E.characteristics.intelligence = 40;
    E.advantage = 0;
    H.pos = { x: 11, y: 10 };
    P.pos = priestPos;
    E.pos = { x: 15, y: 10 };
    // Aura du miracle posée sur le prêtre (rayon 4 m = 2 cases). `sourceSpellId` est stampé par `applyOps`
    // à tout effet durable issu d'un lancement (Prières comprises) : c'est LUI qui relie la chip à la fiche.
    P.activeEffects = [{ label: 'N’écoutez point la Sorcière', bonus: 0, duration: { scale: 'rounds', left: 5 }, castWard: { radiusMeters: 4 }, sourceSpellId: 'n-ecoutez-point-la-sorciere' }];
    useGame.setState({
      battle: { ...useGame.getState().battle! },
      pendingCast: { casterId: E.id, targetId: H.id, spellId: 'flechette', missile: true, focused: false, result: null },
    });
    return { H, P, E };
  }

  it('cible à portée de l’aura : le Test de Langue (Magick) prend −20', () => {
    const { E } = setup({ x: 10, y: 10 }); // prêtre adjacent à la cible (2 m ≤ 4 m)
    useGame.getState().castRoll();
    const res = useGame.getState().pendingCast!.result!;
    const base = castingValue(E as Combatant, 'langue', 'magick');
    expect(res.target).toBe(base - 20);
  });

  it('#1064 — le PRÉ-JET annonce la même cible que le jet : le ward entre dans `previewCast`', () => {
    const { E, H, P } = setup({ x: 10, y: 10 }); // cible dans l'aura
    const spell = findSpellById('flechette')!;
    const pv = previewCast(E as Combatant, spell, { missile: true, focused: false, ctx: { s: useGame.getState(), target: H as Combatant } });
    const base = castingValue(E as Combatant, 'langue', 'magick');
    expect(pv.target).toBe(base - 20); // la cible ANNONCÉE est celle que `castRoll` appliquera
    // …et NOMMÉE par l'entité qui a posé l'aura, avec son renvoi Codex et son PORTEUR en provenance.
    expect(pv.mods).toContainEqual({ label: 'N’écoutez point la Sorcière', value: -20, famille: 'jet', ref: { category: 'spells', id: 'n-ecoutez-point-la-sorciere' }, by: [{ id: P.id }] });
    // Contrôle : sans contexte de cible, l'aperçu ne peut pas connaître la protection de la victime.
    expect(previewCast(E as Combatant, spell, { missile: true, focused: false }).target).toBe(base);
  });

  it('cible hors du rayon : aucune pénalité', () => {
    const { E } = setup({ x: 2, y: 2 }); // prêtre loin de la cible
    useGame.getState().castRoll();
    const res = useGame.getState().pendingCast!.result!;
    const base = castingValue(E as Combatant, 'langue', 'magick');
    expect(res.target).toBe(base);
  });
});
