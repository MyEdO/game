/**
 * Routage des révélations témoin (arbitrage 2026-06-11, spec coop §4bis) : une modale ne
 * s'affiche que si un HÉROS est concerné (il subit ou inflige) — un Coup Critique purement
 * ennemi↔ennemi reste au journal/bandeau.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyCriticalToTarget, advanceTurn } from './combatFlow';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const mkEnemy = (id: string): Combatant =>
  (blessuresSurLeProfil({
    id, name: id, kind: 'ennemi', size: 'moyenne',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), conditions: [], skills: [], talents: [], items: [],
    weapons: [], armour: {}, advantage: 0, traits: [], bodyShape: 'humanoide',
  })) as unknown as Combatant;

describe('routage des révélations (spec coop §4bis)', () => {
  beforeEach(() => { seedBattleRng(7); });

  it('Critique ennemi↔ennemi → AUCUNE modale (journal seul)', () => {
    const log: string[] = [];
    applyCriticalToTarget(mkEnemy('e1'), 'corps', 0, log, banc.setState,
      { ctx: { attackerId: 'e2', attackerKind: 'ennemi' }, get: banc.getState });
    expect(banc.getState().pendingCascade).toBeNull();
    expect(log.length).toBeGreaterThan(0); // le détail vit dans le journal
  });

  it('un HÉROS inflige le Critique à un ennemi → séquence inline', () => {
    const log: string[] = [];
    applyCriticalToTarget(mkEnemy('e1'), 'corps', 0, log, banc.setState,
      { ctx: { attackerId: 'h1', attackerKind: 'heros' }, get: banc.getState });
    const crit = banc.getState().pendingCascade?.participants.find((s) => s.kind === 'critique');
    expect(crit).toBeTruthy();
  });

  it('un HÉROS subit le Critique → séquence inline', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 3 });
    const log: string[] = [];
    applyCriticalToTarget(hero, 'corps', 0, log, banc.setState,
      { ctx: { attackerId: 'e1', attackerKind: 'ennemi' }, get: banc.getState });
    const crit = banc.getState().pendingCascade?.participants.find((s) => s.kind === 'critique');
    expect(crit).toBeTruthy();
  });
});

describe('entretien de fin de Round — partition héros/ennemis (spec coop §4bis)', () => {
  beforeEach(() => {
    seedBattleRng(7);
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
  });

  const crossRound = () => {
    const st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.id.startsWith('hero') || c.kind === 'heros')!;
    banc.setState({
      battle: { ...st.battle!, order: [H.id], turn: 0, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingRoundStart: null,
    });
    advanceTurn(banc.getState, banc.setState); // seul dans l'ordre → franchit le Round
    banc.avancer(3000);
  };

  it('États récurrents ENNEMIS seuls → pas de modale, mais le journal de combat les porte', () => {
    const st = banc.getState();
    for (const c of st.battle!.combatants) if (c.kind === 'ennemi') c.conditions.push({ id: 'hemorragique', value: 1 });
    crossRound();
    const steps = (banc.getState().pendingCascade?.participants ?? []).filter((s) => s.kind === 'round');
    expect(steps).toHaveLength(0);
    // Dégâts d'Hémorragique data-driven (effects onRoundEnd → wounds) : le journal porte la ligne
    // générique « subit N Blessure(s) (ignorant BE et PA) ».
    expect(banc.getState().battle!.log.some((e) => /subit \d+ Blessure/i.test(e.text))).toBe(true);
  });

  it('État récurrent sur un HÉROS → modale de Round avec SA ligne, sans les lignes ennemies', () => {
    const st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'heros')!;
    H.conditions.push({ id: 'hemorragique', value: 1 });
    for (const c of st.battle!.combatants) if (c.kind === 'ennemi') c.conditions.push({ id: 'hemorragique', value: 1 });
    crossRound();
    const reveal = banc.getState().pendingCascade?.participants.find((s) => s.kind === 'round')?.reveal;
    expect(reveal).toBeTruthy();
    expect(reveal!.lines.some((l) => l.includes(H.label))).toBe(true);
    expect(reveal!.lines.every((l) => l.includes(H.label) || !/Mutant/i.test(l))).toBe(true);
  });
});
