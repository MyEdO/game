import { describe, it, expect } from 'vitest';
import { reliefMaterial } from '../../noyau/monde/volume/matieres';
import { matieresDe } from '../../data';
import { shade } from '../shade';
import { MISSING_ID, MISSING_TONE } from '../../noyau/monde/volume/missing';

/** Distance max par canal entre deux hex `#rrggbb`. */
function hexDist(a: string, b: string): number {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ca, cb] = [p(a), p(b)];
  return Math.max(...ca.map((v, i) => Math.abs(v - cb[i])));
}

describe('apparence de relief (JSON pur iso/POV)', () => {
  // CONTRAT POSITIF, une entrée = un cas : chaque matière que la donnée POSE se résout et rend sa
  // face. Aucun cardinal du magasin partagé n'est asserté ici — une matière de plus est un ajout
  // légitime d'auteur, pas une régression, et son absence se dirait sur SON cas.
  it.each([
    ['pierre', '#6b6f76'],
    ['terre', '#5a4a33'],
    ['pilier', '#565a61'],
  ])('« %s » est au registre et se résout sur sa face', (id, face) => {
    expect(matieresDe('relief').map((m) => m.id)).toContain(id);
    expect(reliefMaterial(id).id).toBe(id);
    expect(reliefMaterial(id).face).toBe(face);
  });

  it('id absent du registre → entrée de REPLI VISIBLE au ton d’alarme (#877)', () => {
    const missing = reliefMaterial('inconnu');
    expect(missing.id).toBe(MISSING_ID);
    expect(missing.face).toBe(MISSING_TONE);
    expect(matieresDe('relief').map((m) => m.id)).not.toContain(MISSING_ID); // hors registre : jamais posable
  });

  it('ombrage data-driven : shade(face, shadeDark) reproduit les tons sombres hand-tunés (±3/canal)', () => {
    const pierre = reliefMaterial('pierre');
    expect(hexDist(shade(pierre.face, pierre.shadeDark!), '#494d54')).toBeLessThanOrEqual(3); // ton sombre de référence : face `pierre`, calé à la main
    expect(hexDist(shade(pierre.foot!, pierre.shadeDark!), '#34373c')).toBeLessThanOrEqual(3); // ton sombre de référence : pied `pierre`, calé à la main
    const terre = reliefMaterial('terre');
    expect(hexDist(shade(terre.face, terre.shadeDark!), '#33291c')).toBeLessThanOrEqual(3); // ton sombre de référence : face `terre`, calé à la main
    expect(hexDist(shade(terre.foot!, terre.shadeDark!), '#241c12')).toBeLessThanOrEqual(3); // ton sombre de référence : pied `terre`, calé à la main
  });
});
