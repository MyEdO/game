/**
 * L'historique d'édition (#3508) : un cran par geste, le glissé prolonge le cran ouvert, annuler et rétablir se
 * répondent, une écriture neuve efface le futur, au plus `CRANS_MAX` crans se gardent, la réécriture laisse le présent intact.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, type Scene } from '../monde/scene';
import { annuler, CRANS_MAX, historiqueDe, poser, reecrire, retablir } from './historique';

const scene = (id: string): Scene => emptyScene(id, 2, 2);

describe('historique d’édition', () => {
  it('un geste glissé : un cran à son premier pas, la scène prolongée sans cran aux suivants', () => {
    let h = historiqueDe(scene('a'));
    h = poser(h, scene('b1'), true);
    h = poser(h, scene('b2'), false);
    h = poser(h, scene('b3'), false);
    expect(h.present.id).toBe('b3');
    expect(annuler(h).present.id).toBe('a');
  });

  it('annuler puis rétablir ramène le même état ; sans cran, rien ne bouge', () => {
    const h = poser(historiqueDe(scene('a')), scene('b'), true);
    expect(retablir(annuler(h)).present.id).toBe('b');
    expect(annuler(historiqueDe(scene('a')))).toEqual(historiqueDe(scene('a')));
    expect(retablir(h)).toBe(h);
  });

  it('une écriture sur un cran neuf efface le futur', () => {
    const h = annuler(poser(historiqueDe(scene('a')), scene('b'), true));
    expect(poser(h, scene('c'), true).futur).toEqual([]);
  });

  it(`au-delà de ${CRANS_MAX} crans, le plus ancien s’oublie`, () => {
    let h = historiqueDe(scene('0'));
    for (let i = 1; i <= CRANS_MAX + 1; i++) h = poser(h, scene(String(i)), true);
    expect(h.passe).toHaveLength(CRANS_MAX);
    expect(h.passe[0].id).toBe('1');
  });

  it('la réécriture touche le passé et le futur, jamais le présent', () => {
    const h = annuler(poser(poser(historiqueDe(scene('a')), scene('b'), true), scene('c'), true));
    const r = reecrire(h, (s) => ({ ...s, label: 'renommé' }));
    expect(r.present).toBe(h.present);
    expect([...r.passe, ...r.futur].every((s) => s.label === 'renommé')).toBe(true);
  });
});
