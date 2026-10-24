import { describe, expect, it } from 'vitest';
import { figerVueDEquipement } from './equipement';

describe('vue figée de la recette native (#2948 L3-b)', () => {
  it('parcourt les quatre cas publiés, dont le squelette armé', () => {
    const vue = figerVueDEquipement();
    const ids = vue.projection.combat!.voisins.liste.map(c => c.id);
    expect(ids).toEqual(['squelette-arme', 'variante-repliee', 'sans-modele', 'chevalier-sans-arme']);
    expect(Object.keys(vue.equipements)).toEqual(ids);
  });
  it('publie un squelette armé et son arme rangée depuis les lecteurs réels', () => {
    const vue = figerVueDEquipement();
    const dessin = vue.equipements['squelette-arme'];
    expect(dessin.tenues[0].arme.candidats).toEqual(['zweihander']);
    expect(dessin.tenues[0].modele?.apparence).toBe('zweihander');
    expect(dessin.rangees[0].modele).toEqual(dessin.tenues[0].modele);
  });
  it('garde la variante sans modèle et le choix de sa racine faits par le pont', () => {
    const dessin = figerVueDEquipement().equipements['variante-repliee'].tenues[0];
    expect(dessin.arme.candidats).toEqual(['epee_ebrechee', 'epee']);
    expect(dessin.modele?.apparence).toBe('epee');
  });
  it('laisse une absence au rapport et un chevalier sans arme', () => {
    const vue = figerVueDEquipement();
    expect(vue.equipements['sans-modele'].tenues[0].modele).toBeNull();
    expect(vue.couverture.absences).toEqual([{ porteur: 'sans-modele', emplacement: 'tenues', position: 0, candidats: ['hache_naine', 'hache'] }]);
    expect(vue.equipements['chevalier-sans-arme']).toEqual({ tenues: [], rangees: [] });
  });
});
