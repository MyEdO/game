import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../../state/store';
import { resolvePresetCreature } from '../../state/campaignData';
import { creatureToCombatant } from '../../state/spawn';
import { testValue } from '../../engine/skills';
import { savoirVoiesFluvialesBonus } from '../../engine/riverNavigation';
import { scenario } from './96-presets-edo';
import type { Combatant } from '../../engine/types';
const scenarioConstruit = scenario.construire();

/** Preset authoré → `CreatureData` résolue → `Combatant`, par la chaîne RÉELLE du spawn. */
function spawnPreset(presetId: string): Combatant {
  const r = resolvePresetCreature(presetId);
  expect(r, `preset ${presetId} introuvable`).toBeDefined();
  return creatureToCombatant(r!.creature, presetId, { x: 0, y: 0 });
}

describe('Presets EDO — specs de Compétence keyées par ID (MSRC 7 l.13)', () => {
  beforeEach(() => {
    useGame.setState({ campaignNarratif: scenarioConstruit.narratif ?? null });
  });

  it('Josef Quartjin : Savoir (Voies fluviales) est INTERROGEABLE par son id', () => {
    const josef = spawnPreset('edo-josef-quartjin');
    expect(testValue(josef, 'savoir', undefined, 'voies-fluviales'))
      .not.toBe(testValue(josef, 'savoir', undefined, 'zzz-inexistant'));
  });

  it('Josef Quartjin : le +1 DR de Navigation fluviale part (MSRC 7 l.13)', () => {
    const josef = spawnPreset('edo-josef-quartjin');
    expect(savoirVoiesFluvialesBonus(josef)).toBeGreaterThan(0);
  });

  it('Phillipe Descartes : Projectiles (Poudre noire) est interrogeable par son id', () => {
    const phillipe = spawnPreset('edo-phillipe-descartes');
    expect(testValue(phillipe, 'projectiles', undefined, 'poudre-noire'))
      .not.toBe(testValue(phillipe, 'projectiles', undefined, 'zzz-inexistant'));
  });
});
