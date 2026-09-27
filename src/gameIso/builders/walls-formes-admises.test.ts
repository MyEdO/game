import { describe, it, expect } from 'vitest';
import { buildWalls, wallEnds } from './walls';
import { WALL_H_M } from '../iso';
import { emptyScene, setDoorOpen, type Scene, type WallSeg } from '../../state/scene';
import { structureAppearances } from '../../data';
import { formesAdmises, type FormeArete } from '../../state/formeArete';

/**
 * GARDE (#1883) : une forme que `formesAdmises` déclare habillée SE DESSINE — la règle se lit sur le
 * RENDU (`buildWalls`), en SURFACE (le long de l'arête × en hauteur), pour chaque apparence de
 * `structureAppearance.json` × chaque forme admise.
 *  - mur nu : les parties pleines (hors montants et couronne crénelée) couvrent `[0,1] × [0, h]` ; une
 *    claire-voie couvre de sa grille (du premier au dernier barreau) ;
 *  - mur fenêtré : une vitre, dans la hauteur du mur ;
 *  - baie fermée : vantail ou barreaux, et jambages ou linteau ; l'obturation couvre l'ouverture en
 *    HAUTEUR (du seuil au bas de ce qui la surmonte) et sa bande CENTRALE `[¼, ¾]` en largeur ;
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
/** Parties qui BOUCHENT une baie fermée. */
const OBTURATION = new Set(['vantail', 'barreau']);
const EPS = 1e-6;
const ARETE = { x: 1, y: 1, side: 'N' as const };

type Rect = { part: string; montant: boolean; t0: number; t1: number; lo: number; hi: number };

function rendu(id: string, forme: FormeArete): Rect[] {
  const v = SEG[forme];
  let s: Scene = emptyScene(4, 4);
  s.walls = [{ ...ARETE, ...v.seg, appearance: id }];
  if (v.open !== undefined) s = setDoorOpen(s, 1, 1, 'N', 0, v.open);
  const [el] = buildWalls(s);
  expect(el.forme, `${id} : l’arête posée ne prend pas la forme ${forme}`).toBe(forme);
  const [A, B] = wallEnds(ARETE);
  const t = (p: { x: number; y: number }) =>
    ((p.x - A.x) * (B.x - A.x) + (p.y - A.y) * (B.y - A.y)) / ((B.x - A.x) ** 2 + (B.y - A.y) ** 2);
  return el.faces.map((f) => {
    const hs = f.poly.map((p) => p.h), ts = f.poly.map(t);
    return { part: f.material.part ?? '', montant: f.poly.length === 2, t0: Math.min(...ts), t1: Math.max(...ts), lo: Math.min(...hs), hi: Math.max(...hs) };
  });
}

/** Une claire-voie se lit comme UNE grille : du premier au dernier barreau, sur leur hauteur. */
function grilles(rects: Rect[]): Rect[] {
  const barreaux = rects.filter((r) => r.part === 'barreau');
  if (!barreaux.length) return rects;
  const grille: Rect = {
    part: 'barreau', montant: false,
    t0: Math.min(...barreaux.map((r) => r.t0)), t1: Math.max(...barreaux.map((r) => r.t1)),
    lo: Math.min(...barreaux.map((r) => r.lo)), hi: Math.max(...barreaux.map((r) => r.hi)),
  };
  return [...rects.filter((r) => r.part !== 'barreau'), grille];
}

/** Les rectangles couvrent-ils `[t0,t1] × [lo,hi]` ? Échantillonné en grille fine (40 × 40 points). */
function couvre(rects: Rect[], t0: number, t1: number, lo: number, hi: number): boolean {
  const N = 40;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const t = t0 + ((i + 0.5) / N) * (t1 - t0), h = lo + ((j + 0.5) / N) * (hi - lo);
      if (!rects.some((r) => r.t0 <= t + EPS && t <= r.t1 + EPS && r.lo <= h + EPS && h <= r.hi + EPS)) return false;
    }
  return true;
}

describe('une forme ADMISE se DESSINE (garde de `formesAdmises`, lue sur le rendu)', () => {
  for (const app of structureAppearances)
    for (const forme of formesAdmises(app))
      it(`${app.id} × ${forme}`, () => {
        const rects = rendu(app.id, forme);
        const parts = new Set(rects.map((f) => f.part));
        const h = app.wallHeightM ?? WALL_H_M;
        if (forme === 'mur-nu') {
          const pleines = grilles(rects.filter((f) => !f.montant && !COURONNE.has(f.part)));
          expect(couvre(pleines, 0, 1, 0, h), `${app.id} : le mur nu laisse un trou dans [0,1] × [0, ${h}] m`).toBe(true);
        } else if (forme === 'mur-fenetre') {
          const vitres = rects.filter((f) => f.part === 'vitre');
          expect(vitres.length, `${app.id} : aucune vitre`).toBeGreaterThan(0);
          for (const v of vitres) expect(v.lo >= -EPS && v.hi <= h + EPS, `${app.id} : vitre hors de la hauteur du mur`).toBe(true);
        } else if (forme === 'porte-ouverte') {
          for (const p of ['vantail', 'vantail-planche', 'poignee', 'barreau', 'traverse', 'vitre'])
            expect(parts.has(p), `${app.id} : l’ouverture porte « ${p} »`).toBe(false);
        } else {
          expect(parts.has('vantail') || parts.has('barreau'), `${app.id} : baie fermée sans vantail ni barreaux`).toBe(true);
          expect(parts.has('jambage') || parts.has('linteau'), `${app.id} : baie fermée sans jambages ni linteau`).toBe(true);
          const obturation = grilles(rects.filter((f) => OBTURATION.has(f.part)));
          // Haut de l'ouverture = le bas de ce qui la SURMONTE (linteau du corps de garde, pan de face au-dessus).
          const haut = Math.min(...rects.filter((f) => !f.montant && (f.part === 'linteau' || f.part === 'face') && f.lo > EPS).map((f) => f.lo));
          expect(couvre(obturation, 0.25, 0.75, 0, haut), `${app.id} : l’obturation ne couvre pas l’ouverture [¼,¾] × [0, ${haut}] m`).toBe(true);
        }
      });
});
