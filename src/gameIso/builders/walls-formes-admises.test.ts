import { describe, it, expect } from 'vitest';
import { buildWalls } from './walls';
import { WALL_H_M } from '../iso';
import { emptyScene, setDoorOpen, type Scene, type WallSeg } from '../../state/scene';
import { structureAppearances } from '../../data';
import { formesAdmises, type FormeArete } from '../../state/formeArete';

/**
 * GARDE (#1883) : une forme que `formesAdmises` déclare habillée SE DESSINE — la règle se lit sur le
 * RENDU (`buildWalls`), pour chaque apparence de `structureAppearance.json` × chaque forme admise.
 *  - mur nu : les parties pleines (hors montants et couronne crénelée) couvrent la hauteur du mur ;
 *  - mur fenêtré : une vitre, dans la hauteur du mur ;
 *  - baie fermée : vantail ou barreaux, et jambages ou linteau ;
 *  - porte ouverte : l'ouverture est vide.
 */

const SEG: Record<FormeArete, { seg: Partial<WallSeg>; open?: boolean }> = {
  'mur-nu': { seg: { structure: 'mur-en-bois' } },
  'mur-fenetre': { seg: { structure: 'mur-en-bois', window: true } },
  'porte-fermee': { seg: { structure: 'porte', door: true }, open: false },
  'porte-ouverte': { seg: { structure: 'porte', door: true }, open: true },
  'fermeture-fixe': { seg: { structure: 'porte' } },
};

/** Parties de la COURONNE crénelée, posées AU-DESSUS du mur (`crownFaces`). */
const COURONNE = new Set(['parapet', 'bande', 'arase', 'merlon']);
const EPS = 1e-6;

function rendu(id: string, forme: FormeArete) {
  const v = SEG[forme];
  let s: Scene = emptyScene(4, 4);
  s.walls = [{ x: 1, y: 1, side: 'N', ...v.seg, appearance: id }];
  if (v.open !== undefined) s = setDoorOpen(s, 1, 1, 'N', 0, v.open);
  const [el] = buildWalls(s);
  expect(el.forme, `${id} : l’arête posée ne prend pas la forme ${forme}`).toBe(forme);
  return el.faces.map((f) => {
    const hs = f.poly.map((p) => p.h);
    return { part: f.material.part ?? '', montant: f.poly.length === 2, lo: Math.min(...hs), hi: Math.max(...hs) };
  });
}

/** Les intervalles `[lo,hi]` couvrent-ils `[0,h]` sans trou ? */
function couvre(intervalles: { lo: number; hi: number }[], h: number): boolean {
  let atteint = 0;
  for (const { lo, hi } of [...intervalles].sort((a, b) => a.lo - b.lo)) {
    if (lo > atteint + EPS) return false;
    atteint = Math.max(atteint, hi);
  }
  return atteint >= h - EPS;
}

describe('une forme ADMISE se DESSINE (garde de `formesAdmises`, lue sur le rendu)', () => {
  for (const app of structureAppearances)
    for (const forme of formesAdmises(app))
      it(`${app.id} × ${forme}`, () => {
        const faces = rendu(app.id, forme);
        const parts = new Set(faces.map((f) => f.part));
        const h = app.wallHeightM ?? WALL_H_M;
        if (forme === 'mur-nu') {
          const pleines = faces.filter((f) => !f.montant && !COURONNE.has(f.part));
          expect(couvre(pleines, h), `${app.id} : le mur nu laisse un trou dans [0, ${h}] m`).toBe(true);
        } else if (forme === 'mur-fenetre') {
          const vitres = faces.filter((f) => f.part === 'vitre');
          expect(vitres.length, `${app.id} : aucune vitre`).toBeGreaterThan(0);
          for (const v of vitres) expect(v.lo >= -EPS && v.hi <= h + EPS, `${app.id} : vitre hors de la hauteur du mur`).toBe(true);
        } else if (forme === 'porte-ouverte') {
          for (const p of ['vantail', 'vantail-planche', 'poignee', 'barreau', 'traverse', 'vitre'])
            expect(parts.has(p), `${app.id} : l’ouverture porte « ${p} »`).toBe(false);
        } else {
          expect(parts.has('vantail') || parts.has('barreau'), `${app.id} : baie fermée sans vantail ni barreaux`).toBe(true);
          expect(parts.has('jambage') || parts.has('linteau'), `${app.id} : baie fermée sans jambages ni linteau`).toBe(true);
        }
      });
});
