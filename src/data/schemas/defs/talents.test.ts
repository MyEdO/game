/**
 * `TestMatch` (`talents.json`, champ `test.matches[]`) — la SPÉCIALISATION visée se déclare d'UNE
 * façon : `skill.spec` fixe, `specFromInstance` (la spec élue de l'instance) ou `exceptSpec` (toutes
 * sauf). Le résolveur `matchApplies` (`src/engine/magic.ts`) fait ÉCRASER `skill.spec` par
 * `specFromInstance`, et rend `exceptSpec` inerte dès que la spec est épinglée : une donnée qui
 * combine les deux mentirait sur le Test qu'elle prétend reconnaître. La porte la refuse.
 */
import { describe, expect, it } from 'vitest';
import { schema } from './talents';
import talentsJson from '../../talents.json';
import { talents } from '../../index';

const TALENTS = talents;

/** Le document réel, avec le `test` d'UN talent porteur de spec fixe remplacé. */
const avec = (test: unknown) => TALENTS.map((t) => (t.id === 'combat-deloyal' ? { ...t, test } : t));

const RAW = 'Corps à corps (Bagarre)';
const SPEC_FIXE = { raw: RAW, matches: [{ skill: { id: 'corps-a-corps', spec: 'bagarre' } }] };

describe('talents.json — `TestMatch` : un seul régime de spécialisation', () => {
  it('la donnée réelle passe, et le témoin de ce fichier EST la donnée réelle', () => {
    expect(schema.safeParse(talentsJson).success).toBe(true);
    expect(schema.safeParse(avec(SPEC_FIXE)).success).toBe(true);
    expect(TALENTS.find((t) => t.id === 'combat-deloyal')?.test).toEqual(SPEC_FIXE);
  });

  it('les deux régimes SEULS restent admis (spec élue de l’instance, exception)', () => {
    expect(schema.safeParse(avec({ raw: RAW, matches: [{ skill: { id: 'corps-a-corps' }, specFromInstance: true }] })).success).toBe(true);
    expect(schema.safeParse(avec({ raw: RAW, matches: [{ skill: { id: 'corps-a-corps' }, exceptSpec: 'bagarre' }] })).success).toBe(true);
  });

  const refuses: [string, string, unknown][] = [
    ['`specFromInstance` AVEC `skill.spec`', 'specFromInstance', { raw: RAW, matches: [{ skill: { id: 'corps-a-corps', spec: 'bagarre' }, specFromInstance: true }] }],
    ['`exceptSpec` AVEC `skill.spec`', 'exceptSpec', { raw: RAW, matches: [{ skill: { id: 'corps-a-corps', spec: 'bagarre' }, exceptSpec: 'brutal' }] }],
  ];
  for (const [cas, cle, test] of refuses)
    it(`REFUSÉ : ${cas} — le message NOMME l’entrée fautive`, () => {
      const r = schema.safeParse(avec(test));
      expect(r.success).toBe(false);
      const msg = r.error!.issues.map((i) => i.message).join('\n');
      expect(msg).toContain('corps-a-corps (bagarre)');
      expect(msg).toContain(cle);
    });
});
