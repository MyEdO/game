import { describe, it, expect } from 'vitest';
import { farSide } from './parallax';

const arobases = (s: string) => s.split('@').length - 1;

describe('farSide : l’exemplaire lointain prend l’ombre de gamme (#1903)', () => {
  it('base et lumière d’une clé assombrie vont à l’ombre', () => {
    const loin = farSide('<path fill="@peauH" stroke="@cuir"/>');
    expect(loin).toContain('fill="@peauO"');
    expect(loin).toContain('stroke="@cuirO"');
  });

  it('un jeton hors des clés assombries reste', () => {
    expect(farSide('<path fill="@cuirAv"/>')).toContain('fill="@cuirAv"');
  });

  it('chaque jeton garde son `@`', () => {
    const proche = '<path fill="@peauH" stroke="@cuirO"/><path fill="@cuirAv" stroke="@metal"/>';
    expect(arobases(farSide(proche))).toBe(arobases(proche));
  });
});
