import { describe, expect, it } from 'vitest';
import { domains, siegeEngines } from '../data';
import { sonsDEffet } from '../data/sons/registre';
import { vitrineDesEffets, type Effet } from './effetsDeLAppel';

const coupDe = (e: Effet) => {
  if (e.quoi !== 'coup') throw new Error(`un coup attendu, reçu ${e.quoi}`);
  return e;
};

describe('la vitrine des effets de l’atelier (#3777)', () => {
  const v = vitrineDesEffets();

  it('chaque engin de siège attaque par le rendu de son objet', () => {
    const sansRendu = siegeEngines().filter((t) => !t.rendu).map((t) => t.id);
    expect(sansRendu).toEqual([]);
    expect(Object.keys(v.attaques).sort()).toEqual(siegeEngines().map((t) => t.id).sort());
  });

  it('le tir d’un engin de siège est celui de son objet, sur la distance de la vitrine', () => {
    const canon = coupDe(v.attaques['canon-ade2']);
    expect(canon).toMatchObject({ de: v.de, vers: v.vers, issue: 'touche', depart: { visuel: 'eclair-de-bouche' }, trajet: { projectile: 'boulet' }, arrivee: { visuel: 'explosion' } });
    expect(canon.trajet!.dureeS).toBeCloseTo(v.distanceM / 90);
    expect(coupDe(v.attaques['trebuchet-ade2']).trajet!.projectile).toBe('pierre');
    expect(coupDe(v.attaques['canon-a-repetition-feu-d-enfer-ade2']).trajet!.projectile).toBe('balle');
    expect(coupDe(v.attaques['belier-ade2'])).toMatchObject({ trajet: null, arrivee: { visuel: 'poussiere' } });
  });

  it('une arme montre l’impact, le manque, et sa parade seulement quand son rendu en porte une', () => {
    const lame = v.armes.find((a) => a.id === 'arme-blanche')!;
    expect(lame.variantes.map((x) => x.variante)).toEqual(['touche', 'manque', 'pare']);
    expect(coupDe(lame.variantes[2].effet).arrivee?.visuel).toBe('etincelles');
    expect(v.armes.find((a) => a.id === 'arc')!.variantes.map((x) => x.variante)).toEqual(['touche', 'manque']);
  });

  it('chaque Domaine se teint de sa couleur, la Prière a son halo, aucun rendu de sort parmi les armes', () => {
    expect(v.sorts.map((s) => s.id)).toEqual([...domains.map((d) => d.id), 'sort-arcane', 'priere']);
    const feu = v.sorts.find((s) => s.id === 'feu')!;
    expect(feu.variantes.map((x) => x.variante)).toEqual(['touche', 'manque', 'incantation', 'incantation-ratee']);
    expect(coupDe(feu.variantes[0].effet)).toMatchObject({ couleur: '#ff5a2a', arrivee: { visuel: 'gerbe-de-flammes' } });
    expect(feu.variantes[3].effet).toMatchObject({ quoi: 'incantation', reussie: false, arrivee: null });
    expect(v.sorts.find((s) => s.id === 'priere')!.variantes[2].effet).toMatchObject({ arrivee: { visuel: 'halo' } });
    expect(v.armes.map((a) => a.id)).not.toContain('sort-de-feu');
  });

  it('chaque son d’effet du registre se joue, musique exclue', () => {
    expect(v.sons.map((s) => s.id)).toEqual(sonsDEffet.map((d) => d.id));
    expect(v.sons.every((s) => s.effet.quoi === 'son' && s.effet.son.fichiers.length > 0)).toBe(true);
  });
});
