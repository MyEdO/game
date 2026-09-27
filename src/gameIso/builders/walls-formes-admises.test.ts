import { describe, it, expect } from 'vitest';
import { BAR_HALF_T, buildWalls, hauteurDeBaie, wallEnds } from './walls';
import { WALL_H_M } from '../iso';
import { emptyScene, setDoorOpen, type Scene, type WallSeg } from '../../state/scene';
import { structureAppearances } from '../../data';
import { formesAdmises, type FormeArete } from '../../state/formeArete';

/**
 * GARDE (#1883) : une forme que `formesAdmises` déclare habillée SE DESSINE — la règle se lit sur le
 * RENDU (`buildWalls`), en SURFACE (le long de l'arête × en hauteur), pour chaque apparence de
 * `structureAppearance.json` × chaque forme admise. La couverture se CALCULE (union exacte de
 * rectangles, `trous`), jamais par échantillon :
 *  - mur nu : les parties pleines (hors montants et couronne crénelée) couvrent `[0,1] × [0, h]` ; une
 *    claire-voie y compte pour sa bande, si elle tient son ESPACEMENT (`claireVoieTenue`) ;
 *  - mur fenêtré : une vitre, dans la hauteur du mur ;
 *  - baie fermée : vantail ou barreaux, et jambages ou linteau ; l'obturation couvre l'OUVERTURE que le
 *    rendu tire de l'apparence (`hauteurDeBaie`), `[0,1] × [0, hauteurDeBaie]`, et ce qui la surmonte
 *    repose sur elle ;
 *  - porte ouverte : l'ouverture est vide.
 *
 * ESPACEMENT d'une claire-voie, tiré du rendu (`wallFaces`) : `bars` intervalles, un barreau de largeur
 * `2·BAR_HALF_T` à chaque borne — le JOUR DÉCLARÉ entre deux barreaux vaut `1/bars − 2·BAR_HALF_T`. Une
 * grille est TENUE quand ses barreaux montent tous sur la bande qu'elle barre et qu'aucun jour ne dépasse
 * le jour déclaré, bords de l'arête compris.
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
const EPS = 1e-9;
const ARETE = { x: 1, y: 1, side: 'N' as const };

type Zone = { t0: number; t1: number; lo: number; hi: number };
type Rect = Zone & { part: string; montant: boolean };

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

/** Parties de `zone` qu'AUCUN rectangle ne couvre — calcul EXACT par balayage : la zone est découpée aux
 *  bords des rectangles le long de l'arête ; sur chaque tranche, l'union des intervalles de hauteur qui
 *  la traversent doit couvrir `[lo, hi]`. Vide = couverte. */
function trous(rects: readonly Zone[], zone: Zone): Zone[] {
  const bords = [...new Set([zone.t0, zone.t1, ...rects.flatMap((r) => [r.t0, r.t1])])]
    .filter((t) => t >= zone.t0 && t <= zone.t1).sort((a, b) => a - b);
  const out: Zone[] = [];
  for (let i = 0; i + 1 < bords.length; i++) {
    const t0 = bords[i], t1 = bords[i + 1];
    if (t1 - t0 <= EPS) continue;
    const hauteurs = rects.filter((r) => r.t0 <= t0 + EPS && r.t1 >= t1 - EPS && r.hi > r.lo)
      .map((r) => [r.lo, r.hi] as const).sort((a, b) => a[0] - b[0]);
    let h = zone.lo;
    for (const [lo, hi] of hauteurs) {
      if (lo > h + EPS) break;
      h = Math.max(h, hi);
    }
    if (h < zone.hi - EPS) out.push({ t0, t1, lo: h, hi: zone.hi });
  }
  return out;
}

/** Jour DÉCLARÉ entre deux barreaux d'une claire-voie de `bars` intervalles (fraction d'arête). */
const jourDeclare = (bars: number) => 1 / bars - 2 * BAR_HALF_T;

/** La grille `barreaux` barre-t-elle `[0,1] × [lo, hi]` en tenant son espacement ? Rend la faute, ou
 *  `undefined`. */
function claireVoieTenue(barreaux: readonly Rect[], bars: number, lo: number, hi: number): string | undefined {
  const courts = barreaux.filter((r) => r.lo > lo + EPS || r.hi < hi - EPS);
  if (courts.length) return `${courts.length} barreau(x) ne montent pas de ${lo} à ${hi} m`;
  const jours = trous(barreaux.map((r) => ({ ...r, lo, hi })), { t0: 0, t1: 1, lo, hi });
  const large = jours.find((j) => j.t1 - j.t0 > jourDeclare(bars) + EPS);
  return large ? `jour de ${(large.t1 - large.t0).toFixed(4)} entre deux barreaux, au-delà du jour déclaré ${jourDeclare(bars).toFixed(4)}` : undefined;
}

/** Les rectangles de `rects`, où une claire-voie TENUE compte pour sa bande pleine ; la faute
 *  d'espacement sinon. */
function avecGrille(rects: readonly Rect[], bars: number | undefined): { pleins: Zone[]; faute?: string } {
  const barreaux = rects.filter((r) => r.part === 'barreau');
  const autres = rects.filter((r) => r.part !== 'barreau');
  if (!barreaux.length) return { pleins: autres };
  if (bars === undefined) return { pleins: autres, faute: 'barreaux sans claire-voie déclarée' };
  const lo = Math.min(...barreaux.map((r) => r.lo)), hi = Math.max(...barreaux.map((r) => r.hi));
  const faute = claireVoieTenue(barreaux, bars, lo, hi);
  return { pleins: faute ? autres : [...autres, { t0: 0, t1: 1, lo, hi }], faute };
}

const dire = (z: readonly Zone[]) => z.map((r) => `[${r.t0.toFixed(3)},${r.t1.toFixed(3)}]×[${r.lo.toFixed(3)},${r.hi.toFixed(3)}]`).join(' ');

describe('une forme ADMISE se DESSINE (garde de `formesAdmises`, lue sur le rendu)', () => {
  for (const app of structureAppearances)
    for (const forme of formesAdmises(app))
      it(`${app.id} × ${forme}`, () => {
        const rects = rendu(app.id, forme);
        const parts = new Set(rects.map((f) => f.part));
        const h = app.wallHeightM ?? WALL_H_M;
        if (forme === 'mur-nu') {
          const { pleins, faute } = avecGrille(rects.filter((f) => !f.montant && !COURONNE.has(f.part)), app.claireVoie?.bars);
          expect(faute, `${app.id} : claire-voie du mur nu`).toBeUndefined();
          const vides = trous(pleins, { t0: 0, t1: 1, lo: 0, hi: h });
          expect(vides, `${app.id} : le mur nu laisse des trous ${dire(vides)}`).toEqual([]);
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
          const ouverture = { t0: 0, t1: 1, lo: 0, hi: hauteurDeBaie(app, h) };
          const { pleins, faute } = avecGrille(rects.filter((f) => OBTURATION.has(f.part)), app.claireVoie?.bars);
          expect(faute, `${app.id} : claire-voie de la baie`).toBeUndefined();
          const vides = trous(pleins, ouverture);
          expect(vides, `${app.id} : l’obturation laisse des jours dans l’ouverture ${dire([ouverture])} : ${dire(vides)}`).toEqual([]);
          const dessus = rects.filter((f) => !f.montant && (f.part === 'linteau' || f.part === 'face') && f.hi > ouverture.hi + EPS);
          expect(Math.min(...dessus.map((f) => f.lo)), `${app.id} : ce qui surmonte la baie ne repose pas sur son ouverture`).toBeCloseTo(ouverture.hi, 9);
        }
      });
});
