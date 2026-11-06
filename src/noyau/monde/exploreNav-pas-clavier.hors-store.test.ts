/**
 * Le PAS clavier d'exploration (`exploreStepDest`, `exploreNav.ts`) : contrat déclaré, la surface voisine CONNECTÉE la
 * mieux alignée sur la direction poussée, `null` si aucune n'atteint le seuil d'alignement (0.6). L'alignement est la
 * projection de l'hôte, ici une fonction fabriquée.
 */
import { describe, it, expect } from 'vitest';
import { exploreStepDest } from './exploreNav';
import { emptyScene } from './scene';
import type { Pt } from './path';

const scene = () => emptyScene('scene-pas', 5, 5);
/** L'alignement d'un voisin sur le vecteur unitaire (dx, dy). */
const vers = (from: Pt, dx: number, dy: number) => (n: Pt) => {
  const vx = n.x - from.x, vy = n.y - from.y;
  return (vx * dx + vy * dy) / (Math.hypot(vx, vy) * Math.hypot(dx, dy));
};

describe('exploreStepDest — pas clavier vers la surface voisine la mieux alignée', () => {
  const from = { x: 2, y: 2 };

  it('champ libre : le voisin pile dans la direction poussée', () => {
    expect(exploreStepDest(scene(), from, vers(from, 1, 0))).toMatchObject({ x: 3, y: 2 });
    expect(exploreStepDest(scene(), from, vers(from, 1, 1))).toMatchObject({ x: 3, y: 3 });
  });

  it('le voisin idéal non marchable : le meilleur voisin restant au-dessus du seuil', () => {
    const s = scene();
    s.layers[0].tiles[3 * 5 + 3] = 'vide';
    const pas = exploreStepDest(s, from, vers(from, 1, 1));
    expect([{ x: 3, y: 2 }, { x: 2, y: 3 }]).toContainEqual({ x: pas!.x, y: pas!.y });
  });

  it('aucun voisin assez aligné (seuil 0.6) : le pas est bloqué, jamais rabattu sur un voisin latéral', () => {
    const s = scene();
    for (const [x, y] of [[3, 1], [3, 2], [3, 3]]) s.layers[0].tiles[y * 5 + x] = 'vide';
    expect(exploreStepDest(s, from, vers(from, 1, 0))).toBeNull();
    expect(exploreStepDest(scene(), from, (n) => (n.x === 3 && n.y === 2 ? 0.59 : 0))).toBeNull();
    expect(exploreStepDest(scene(), from, (n) => (n.x === 3 && n.y === 2 ? 0.6 : 0))).toMatchObject({ x: 3, y: 2 });
  });

  it('un alignement nul ou négatif partout ne choisit rien', () => {
    expect(exploreStepDest(scene(), from, () => 0)).toBeNull();
    expect(exploreStepDest(scene(), from, () => -1)).toBeNull();
  });
});
