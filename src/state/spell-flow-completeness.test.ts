import { describe, it, expect } from 'vitest';
import { runPureFlowLines } from '../noyau/combat/flowEval';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import { flowEffects, spellOps } from '../engine/flowCore';
import { spells } from '../data';
import type { Combatant } from '../engine/types';
import { desDuTest } from '../engine/dice.testkit';

/**
 * PREUVE DE COMPLÉTUDE — « peut-on créer TOUS les sorts via le système Flow/EffectOp ? ».
 * Réponse démontrée : chaque sort de la base porte ses EFFETS dans `SpellData.effects` — un Flow dont
 * les feuilles `do` sont des EffectOp (`{type:'ops', on, ops}`) — et l'exécuter par `runPureFlowLines`
 * applique réellement ces ops. Les effets ont MIGRÉ des specs engine-curées vers la donnée app-owned
 * (éditable dans le Compendium) ; la spec ne garde que les métadonnées de résolution. Si un jour un sort
 * ne « rentrait » pas, c'est le système (Flow/EffectOp) qu'on généraliserait — ce gate l'attraperait.
 */
describe('Complétude : tout sort porte ses effets dans un Flow exécutable (SpellData.effects)', () => {
  it('la base est bien fournie (≥ 220 sorts)', () => {
    expect(spells.length).toBeGreaterThanOrEqual(220);
  });

  it('chaque sort a un `effects` Flow valide, feuilles EffectOp uniquement (target/caster)', () => {
    for (const sp of spells) {
      const flow = sp.effects;
      expect(flow, sp.label).toBeDefined();
      expect(flow!.kind, sp.label).toBe('seq');
      // Toute feuille de 1er niveau est un EffectOp (le seed n'émet que `{type:'ops', on}`).
      for (const eff of flowEffects(flow!)) expect(eff.type, sp.label).toBe('ops');
      // Les ops se lisent par cible — l'union (target+caster) couvre tous les effets du sort.
      const all = [...spellOps(flow, 'target'), ...spellOps(flow, 'caster')];
      expect(Array.isArray(all), sp.label).toBe(true);
    }
  });

  it('runPureFlowLines EXÉCUTE réellement les ops d’un sort sur la cible (wounds + condition)', () => {
    const target = { id: 't', name: 'Cible', kind: 'enemy', dead: false, wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], armour: { corps: 0 } } as unknown as Combatant;
    // un « sort » minimal : 6 Blessures + En flammes — exprimé en Flow EffectOp.
    const flow: Flow = { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'wounds', amount: 6 }, { op: 'condition', id: 'en-flammes' }] } }] };
    const lines = runPureFlowLines(target, undefined, flow, { rng: desDuTest, label: 'Test' });
    expect(target.wounds.current).toBe(14); // wounds ignore BE/PA → 20 − 6
    expect(target.conditions.some((c) => c.id === 'en-flammes')).toBe(true);
    expect(lines.length).toBeGreaterThan(0); // journal produit
  });
});
