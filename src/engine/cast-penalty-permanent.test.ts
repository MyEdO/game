/**
 * Interdiction PERMANENTE de compétence magique (MDG 7 l.250) : « Le Personnage ne peut jamais
 * utiliser les Compétences Langue (Magick) et Focalisation, sauf pour dissiper un sort. » — `castPenalty
 * {blocked:true}` posable en PASSIF (Trait/mutation), sans expiration (aucun `rounds`/`minutes`/`hours`/
 * `days`, contrairement au contrecoup temporisé posé par `applyOps`). Le porteur DONNÉE (Trait de créature)
 * est posé par le lot données ; ce test prouve le mécanisme via un `Mutation.passive` inline (SOURCE
 * catalogue-free, `Mutation.passive` est copié sur l'instance à l'attache — même canal de lecture que
 * les Traits dans `passiveCastPenalties`).
 */
import { describe, it, expect } from 'vitest';
import { castBlockedBy, castPenaltyMod } from './magic';
import type { Combatant } from './types';
import type { Mutation } from './corruption';

/** `skill` absent = TOUTE magie (l'idiome d'absence de l'op, `src/engine/ops.ts`). */
const banMutation = (skill?: 'langue' | 'focalisation' | 'priere'): Mutation => ({
  id: 'test-ban', type: 'mutations', label: 'Interdiction (test)', desc: '', kind: 'physique', roll: 0,
  passive: [{ op: 'castPenalty', ...(skill ? { skill: { id: skill } } : {}), blocked: true }],
});

describe('castPenalty passif — interdiction PERMANENTE (MDG 07 l.250)', () => {
  it('0 excédent : sans la capacité, rien n’est bloqué', () => {
    const c = { mutations: [] } as unknown as Combatant;
    expect(castBlockedBy(c, 'langue')).toBeNull();
    expect(castBlockedBy(c, 'focalisation')).toBeNull();
  });

  it('cas nominal : Langue (Magick) ET Focalisation bloquées, jamais purgées (aucun `rounds`/`untilTime`)', () => {
    const c = { mutations: [banMutation('langue'), banMutation('focalisation')] } as unknown as Combatant;
    expect(castBlockedBy(c, 'langue')).toBe('Interdiction (test)');
    expect(castBlockedBy(c, 'focalisation')).toBe('Interdiction (test)');
    expect(castBlockedBy(c, 'priere')).toBeNull(); // seules Langue/Focalisation sont visées (l.250)
  });

  it('scope : ne touche PAS la Prière (portée du RAW = « Langue (Magick) et Focalisation » seules)', () => {
    const c = { mutations: [banMutation('langue')] } as unknown as Combatant;
    expect(castPenaltyMod(c, 'priere')).toBe(0);
    expect(castBlockedBy(c, 'priere')).toBeNull();
  });
});
