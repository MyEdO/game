import { describe, it, expect } from 'vitest';
import { targetArc, inFireArc } from './fireArc';

/**
 * ARCS DE TIR / BORDÉES (MDG 12-13). Le RAW nomme le CÔTÉ relatif au cap (bâbord=gauche, tribord=droite,
 * proue=avant, poupe=arrière — l.262-271) + une portée, mais PAS un angle. Modèle BORDÉE retenu : proue/poupe
 * = chasse étroite (1 octant), bâbord/tribord = tout le travers (3 octants), conforme à « masser les pièces
 * d'un bord » (ch.12) et au canon de poupe de l'exemple (l.410). Dir8 horaire ⇒ +2 octants = tribord.
 */
const SHIP = { x: 5, y: 5 };

describe('targetArc — côté du navire vers lequel se trouve la cible (relatif au cap)', () => {
  it('cap Nord : avant→proue, droite(E)→tribord, gauche(O)→bâbord, arrière(S)→poupe', () => {
    expect(targetArc('N', SHIP, { x: 5, y: 0 })).toBe('proue'); // droit devant
    expect(targetArc('N', SHIP, { x: 9, y: 5 })).toBe('tribord'); // à droite (est)
    expect(targetArc('N', SHIP, { x: 0, y: 5 })).toBe('babord'); // à gauche (ouest)
    expect(targetArc('N', SHIP, { x: 5, y: 9 })).toBe('poupe'); // droit derrière
  });

  it('cap Nord : la BORDÉE couvre tout le travers (avant ET arrière de ce bord)', () => {
    expect(targetArc('N', SHIP, { x: 9, y: 0 })).toBe('tribord'); // avant-droite (NE)
    expect(targetArc('N', SHIP, { x: 9, y: 9 })).toBe('tribord'); // arrière-droite (SE)
    expect(targetArc('N', SHIP, { x: 0, y: 0 })).toBe('babord'); // avant-gauche (NO)
    expect(targetArc('N', SHIP, { x: 0, y: 9 })).toBe('babord'); // arrière-gauche (SO)
  });

  it('cap Est : le repère tourne avec le navire (tribord=sud, bâbord=nord, poupe=ouest)', () => {
    expect(targetArc('E', SHIP, { x: 9, y: 5 })).toBe('proue'); // droit devant (est)
    expect(targetArc('E', SHIP, { x: 5, y: 9 })).toBe('tribord'); // à droite (sud)
    expect(targetArc('E', SHIP, { x: 5, y: 0 })).toBe('babord'); // à gauche (nord)
    expect(targetArc('E', SHIP, { x: 0, y: 5 })).toBe('poupe'); // derrière (ouest)
  });
});

describe('inFireArc — un poste ne tire que vers son côté de montage ; virer le rend légal', () => {
  it('un poste TRIBORD touche une cible à tribord, pas à bâbord ; virer change tout', () => {
    const east = { x: 9, y: 5 };
    expect(inFireArc('tribord', 'N', SHIP, east)).toBe(true); // est = tribord d'un cap Nord
    expect(inFireArc('babord', 'N', SHIP, east)).toBe(false);
    // Le navire vire au Sud → l'est passe à BÂBORD ; le poste tribord ne peut plus tirer.
    expect(inFireArc('tribord', 'S', SHIP, east)).toBe(false);
    expect(inFireArc('babord', 'S', SHIP, east)).toBe(true);
  });
});
