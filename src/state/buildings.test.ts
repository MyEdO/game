import { describe, it, expect } from 'vitest';
import { emptyScene, wallBetween, isWalkable, wallIsOpen, doorIsOpen, doorAt, type WallSeg } from './scene';
import { roofHidden } from './buildings';
import { lineOfSightCover } from './lineOfSight';

/**
 * Modèle « relief unifié » : un bâtiment n'est plus une entité monolithique (périmètre implicite +
 * porte + reveal). Il est COMPOSÉ — des `WallSeg` d'arête (destructibles) sur un sol de terrain, coiffés
 * d'une masse de toit. Le blocage d'intérieur passe donc par `wallBetween` (+ marchabilité du terrain),
 * et le cutaway du toit par `roofHidden(empreinte)` — plus aucune fonction `buildingBlockedAt`/`defaultDoor`.
 */

/** Maison 3×3 en (2,2) : cloisons `mur-en-bois` tout autour, une PORTE au sud (arête N de (3,5)). */
function houseScene() {
  const s = emptyScene(8, 8);
  const foot = { x: 2, y: 2, w: 3, h: 3 };
  const walls: WallSeg[] = [];
  for (let x = foot.x; x < foot.x + foot.w; x++) {
    walls.push({ x, y: foot.y, side: 'N', structure: 'mur-en-bois' });                 // cloison nord
    if (x === 3) walls.push({ x, y: foot.y + foot.h, side: 'N', door: true });          // PORTE au sud
    else walls.push({ x, y: foot.y + foot.h, side: 'N', structure: 'mur-en-bois' });    // cloison sud
  }
  for (let y = foot.y; y < foot.y + foot.h; y++) {
    walls.push({ x: foot.x - 1, y, side: 'E', structure: 'mur-en-bois' });              // cloison ouest
    walls.push({ x: foot.x + foot.w - 1, y, side: 'E', structure: 'mur-en-bois' });     // cloison est
  }
  s.walls = walls;
  return s;
}

describe('bâtiment COMPOSÉ — cloisons d’arête (wallBetween) + terrain', () => {
  it('l’intérieur reste MARCHABLE (terrain), mais les cloisons le SÉPARENT du dehors', () => {
    const s = houseScene();
    expect(isWalkable(s, 3, 3)).toBe(true);                 // le sol de l'intérieur est praticable
    expect(wallBetween(s, 3, 2, 3, 1)).toBe(true);         // cloison nord (intérieur ↔ dehors)
    expect(wallBetween(s, 2, 3, 1, 3)).toBe(true);         // cloison ouest
    expect(wallBetween(s, 4, 3, 5, 3)).toBe(true);         // cloison est
    expect(wallBetween(s, 2, 4, 2, 5)).toBe(true);         // cloison sud pleine (hors porte)
  });

  it('la PORTE de l’arête est franchissable (ouverte par défaut) — l’intérieur n’est pas scellé', () => {
    const s = houseScene();
    const door = doorAt(s, 3, 5, 'N')!;
    expect(door).toBeTruthy();
    expect(doorIsOpen(s, door)).toBe(true);                // porte non `closed` → ouverte
    expect(wallBetween(s, 3, 4, 3, 5)).toBe(false);        // on entre/sort par la porte
  });
});

/**
 * INVARIANT COMBAT de la FENÊTRE — arbitrage #1712 (2026-09-08) : la vue passe (`areteOcculte`), le
 * couvert descend d'un cran (`couvertDArete`, `AA 10 l.122`, maison) ; passage et marchabilité restent
 * ceux d'un mur plein. La vue : `state/vision.test.ts` (croisée #1712).
 */
describe('INVARIANT COMBAT — la fenêtre n’ouvre pas le passage, coûte un cran de couvert', () => {
  const plain = () => { const s = emptyScene(6, 6); s.walls = [{ x: 2, y: 2, side: 'N', structure: 'mur-de-chateau' }]; return s; };
  const win = () => { const s = emptyScene(6, 6); s.walls = [{ x: 2, y: 2, side: 'N', structure: 'mur-de-chateau', window: true }]; return s; };

  it('passage : IDENTIQUE à un mur plein (wallIsOpen, wallBetween, isWalkable)', () => {
    const [p, w] = [plain(), win()];
    expect(wallIsOpen(w, w.walls![0])).toBe(false);
    expect(wallIsOpen(w, w.walls![0])).toBe(wallIsOpen(p, p.walls![0]));
    expect(wallBetween(w, 2, 2, 2, 1)).toBe(true);
    expect(wallBetween(w, 2, 2, 2, 1)).toBe(wallBetween(p, 2, 2, 2, 1));
    expect(isWalkable(w, 2, 2)).toBe(isWalkable(p, 2, 2));
  });

  it('COUVERT : la croisée coûte un cran à la Structure qui la porte (AA 10 l.122)', () => {
    const tireur = { x: 1, y: 1 };
    const cible = { x: 2, y: 2 };
    expect(lineOfSightCover(plain(), tireur, cible, []).cover).toBe('totale');
    expect(lineOfSightCover(win(), tireur, cible, []).cover).toBe('moyenne');
  });
});

describe('roofHidden — cutaway du toit (empreinte)', () => {
  const roof = { x: 2, y: 2, w: 3, h: 3 };
  it('masque le toit dès qu’un allié se tient dans l’empreinte', () => {
    expect(roofHidden(roof, [{ x: 3, y: 3 }])).toBe(true);  // au cœur du bâti
    expect(roofHidden(roof, [{ x: 2, y: 2 }])).toBe(true);  // coin NO inclus (borne basse)
    expect(roofHidden(roof, [{ x: 4, y: 4 }])).toBe(true);  // coin SE inclus (borne haute)
  });
  it('laisse le toit posé si aucun allié n’est sous l’empreinte', () => {
    expect(roofHidden(roof, [{ x: 0, y: 0 }])).toBe(false);
    expect(roofHidden(roof, [{ x: 5, y: 5 }])).toBe(false); // juste hors empreinte (x/y = foot+ w/h)
    expect(roofHidden(roof, [])).toBe(false);
  });
});
