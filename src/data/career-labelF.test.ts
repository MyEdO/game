import { describe, it, expect } from 'vitest';
import { careers, careerLevels, careerLabelFor, displayLabelForSex } from './index';

// #242 — formes féminines d'AFFICHAGE des carrières (MAISON : le LDB n'imprime que le masculin).
describe('careers/careerLevels — labelF (forme féminine d’affichage)', () => {
  it('tout labelF présent est non vide et DIFFÈRE du label (les épicènes l’omettent)', () => {
    for (const c of [...careers, ...careerLevels]) {
      if (c.labelF === undefined) continue;
      expect(c.labelF.length, c.label).toBeGreaterThan(0);
      expect(c.labelF, c.label).not.toBe(c.label);
    }
  });

  it('échantillon de féminisation curée (careers)', () => {
    const byId = (id: string) => careers.find((c) => c.id === id)!;
    expect(byId('soldat').labelF).toBe('Soldate');
    expect(byId('sorcier').labelF).toBe('Sorcière');
    expect(byId('serviteur').labelF).toBe('Servante'); // irrégulier ≠ *Servitrice
    expect(byId('pretre').labelF).toBe('Prêtresse');
    expect(byId('chasseur').labelF).toBe('Chasseuse');
  });

  it('formes épicènes : pas de labelF', () => {
    const byId = (id: string) => careers.find((c) => c.id === id)!;
    expect(byId('artiste').labelF).toBeUndefined();
    expect(byId('medecin').labelF).toBeUndefined(); // « une médecin »
    expect(byId('marin').labelF).toBeUndefined();
  });

  it('careerLabelFor : féminin si sexe F et labelF présent, masculin sinon', () => {
    expect(careerLabelFor({ career: 'soldat', appearance: { sex: 'F' } })).toBe('Soldate');
    expect(careerLabelFor({ career: 'soldat', appearance: { sex: 'M' } })).toBe('Soldat');
    expect(careerLabelFor({ career: 'soldat' })).toBe('Soldat'); // sexe absent → masculin
    expect(careerLabelFor({ career: 'artiste', appearance: { sex: 'F' } })).toBe('Artiste'); // épicène
    expect(careerLabelFor({ career: undefined })).toBe('');
  });

  it('displayLabelForSex : accord d’un niveau de carrière', () => {
    expect(displayLabelForSex('F', 'Sergent', 'Sergente')).toBe('Sergente');
    expect(displayLabelForSex('M', 'Sergent', 'Sergente')).toBe('Sergent');
    expect(displayLabelForSex('F', 'Artiste', undefined)).toBe('Artiste');
  });
});
