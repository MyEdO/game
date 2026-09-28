/**
 * Contrat du harnais `scripts/qc/mesure-volume.mts`, en test POSITIF (#638 volet B) : la clause
 * quasi-blanc valide une matière à base haute par la PROFONDEUR D'OMBRE — sans rouvrir le trou
 * qu'elle corrige (une matière SOMBRE plate reste réfutée par le régime normal).
 */
import { describe, it, expect } from 'vitest';
import { computeVerdict, CONTRAT_QUASI_BLANC_BASE_MIN } from './qc-contrat';

describe('computeVerdict — clause quasi-blanc (#638 volet B)', () => {
  it('matière quasi-blanche AVEC ombre (fourrure/os qui tourne à l\'ombre) → NON-REFUTE', () => {
    const { verdict, raisons } = computeVerdict({
      pixels: 1000, matiere: 'fourrure', lBase: 93, lLumiere: 98,
      ecart: 57, partClaire: 1, partSombre: 30,
      p90SurBase: false, p10SurBase: false, slotHasTenueArt: true,
    });
    expect(verdict).toBe('NON-REFUTE');
    expect(raisons).toEqual([]);
  });

  it('matière quasi-blanche PLATE (aucune ombre) → ECHEC (écart + part sombre + ancrage)', () => {
    const { verdict, raisons } = computeVerdict({
      pixels: 1000, matiere: 'os', lBase: 93, lLumiere: 96,
      ecart: 4, partClaire: 0, partSombre: 0,
      p90SurBase: true, p10SurBase: true, slotHasTenueArt: true,
    });
    expect(verdict).toBe('ECHEC');
    expect(raisons).toContain('écart');
    expect(raisons).toContain('part sombre');
    expect(raisons).toContain('ancrage');
    expect(raisons).not.toContain('part claire');
  });

  it('matière SOMBRE plate → ECHEC par le régime NORMAL (la clause quasi-blanc ne rouvre pas le trou)', () => {
    const { verdict, raisons } = computeVerdict({
      pixels: 1000, matiere: 'cuir', lBase: 25, lLumiere: 40,
      ecart: 7, partClaire: 2, partSombre: 90,
      p90SurBase: true, p10SurBase: false, slotHasTenueArt: true,
    });
    expect(verdict).toBe('ECHEC');
    expect(raisons).toContain('écart');
    expect(raisons).toContain('part claire');
    expect(raisons).toContain('ancrage');
    expect(raisons).not.toContain('part sombre');
  });

  it('matière SOMBRE bien éclairée → NON-REFUTE (régime normal inchangé)', () => {
    const { verdict, raisons } = computeVerdict({
      pixels: 1000, matiere: 'cuir', lBase: 33, lLumiere: 55,
      ecart: 31, partClaire: 15, partSombre: 5,
      p90SurBase: false, p10SurBase: false, slotHasTenueArt: true,
    });
    expect(verdict).toBe('NON-REFUTE');
    expect(raisons).toEqual([]);
  });

  it('palette inversée → ECHEC palette inversée, quel que soit le régime', () => {
    const { verdict, raisons } = computeVerdict({
      pixels: 1000, matiere: 'metal', lBase: 90, lLumiere: 85,
      ecart: 50, partClaire: 20, partSombre: 20,
      p90SurBase: false, p10SurBase: false, slotHasTenueArt: true,
    });
    expect(verdict).toBe('ECHEC');
    expect(raisons).toEqual(['palette inversée']);
  });

  it('matière/masque absents, slot SANS art de tenue → NON MESURABLE légitime', () => {
    const { verdict, raisons } = computeVerdict({
      pixels: 0, matiere: null, lBase: null, lLumiere: null,
      ecart: 0, partClaire: null, partSombre: null,
      p90SurBase: false, p10SurBase: false, slotHasTenueArt: false,
    });
    expect(verdict).toBe('NON MESURABLE');
    expect(raisons).toEqual(["légitime: pas d'art de tenue au slot"]);
  });

  it('matière introuvable MAIS slot AVEC art de tenue (dégradé/littéral hors jetons) → ECHEC couverture', () => {
    const { verdict, raisons } = computeVerdict({
      pixels: 500, matiere: null, lBase: null, lLumiere: null,
      ecart: 0, partClaire: null, partSombre: null,
      p90SurBase: false, p10SurBase: false, slotHasTenueArt: true,
    });
    expect(verdict).toBe('ECHEC');
    expect(raisons).toEqual(['couverture']);
  });

  it('borne du seuil quasi-blanc : juste sous le seuil → régime normal (part claire, pas part sombre)', () => {
    const { raisons } = computeVerdict({
      pixels: 1000, matiere: 'x', lBase: CONTRAT_QUASI_BLANC_BASE_MIN - 1, lLumiere: 95,
      ecart: 4, partClaire: 0, partSombre: 90,
      p90SurBase: true, p10SurBase: false, slotHasTenueArt: true,
    });
    expect(raisons).toContain('part claire');
    expect(raisons).not.toContain('part sombre');
  });
});
