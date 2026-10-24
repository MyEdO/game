import { describe, expect, it } from 'vitest';
import { figerVueDEquipement } from './equipement';
import { findTeinteById } from '../../../src/noyau/index';

describe('vue figée de la recette native (#2948 L3-b)', () => {
  it('parcourt les cas publiés, dont le squelette armé et l’objet teinté', () => {
    const vue = figerVueDEquipement();
    const ids = vue.projection.combat!.voisins.liste.map(c => c.id);
    expect(ids).toEqual(['squelette-arme', 'variante-repliee', 'sans-modele', 'chevalier-sans-arme', 'objet-teinte']);
    expect(Object.keys(vue.equipements)).toEqual(ids);
    for (const equip of Object.values(vue.equipements)) {
      for (const tenue of equip.tenues) expect(['main', 'off']).toContain(tenue.arme.hand);
      for (const rangee of equip.rangees) expect(rangee.arme).not.toHaveProperty('hand');
    }
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
  it('publie la palette de l’objet tenu et rangé, avec une autre instance du même composant intacte', () => {
    const vue = figerVueDEquipement();
    const teinte = vue.equipements['objet-teinte'];
    const intact = vue.equipements['variante-repliee'];
    expect(teinte.tenues[0].palette).toEqual(findTeinteById('aethyrique')!.palette);
    expect(teinte.rangees[0].palette).toEqual(teinte.tenues[0].palette);
    expect(teinte.tenues[0].modele).toEqual(intact.tenues[0].modele);
    expect(intact.tenues[0].palette).toBeNull();
  });

  it('laisse une absence au rapport et un chevalier sans arme', () => {
    const vue = figerVueDEquipement();
    expect(vue.equipements['sans-modele'].tenues[0].modele).toBeNull();
    expect(vue.couverture.absences).toEqual([{ porteur: 'sans-modele', emplacement: 'tenues', position: 0, candidats: ['hache_naine', 'hache'] }]);
    expect(vue.equipements['chevalier-sans-arme']).toEqual({ tenues: [], rangees: [] });
  });
});
