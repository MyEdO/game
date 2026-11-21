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

  it('admet la spécialisation de l’instance ou une spécialisation à exclure', () => {
    expect(schema.safeParse(avec({ raw: RAW, matches: [{ skill: { id: 'corps-a-corps' }, specFromInstance: true }] })).success).toBe(true);
    expect(schema.safeParse(avec({ raw: RAW, matches: [{ skill: { id: 'corps-a-corps', spec: 'bagarre' }, sauf: true }] })).success).toBe(true);
  });

  it.each([
    ['la spécialisation du Talent et celle de la Compétence sont renseignées', { ...SPEC_FIXE.matches[0], specFromInstance: true }, /corps-a-corps \(bagarre\).*specFromInstance/],
    ['le champ exclu ne désigne aucune spécialisation', { skill: { id: 'corps-a-corps' }, sauf: true }, /Choisir la spécialisation à exclure/],
    ['la compétence ne résout pas', { skill: { id: 'introuvable', spec: 'bagarre' }, sauf: true }, /introuvable/],
    ['une spécialisation existe pour une autre compétence', { skill: { id: 'langue', spec: 'bagarre' }, sauf: true }, /absente des spécialisations de « langue »/],
    ['la référence a une spécialisation déclarée à plat', { skill: { id: 'langue' }, exceptSpec: 'magick' }, /exceptSpec/],
  ])('refuse le test si %s', (_cas, match, message) => {
    const result = schema.safeParse(avec({ raw: RAW, matches: [match] }));
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((issue) => issue.message).join('\n')).toMatch(message);
  });
});
