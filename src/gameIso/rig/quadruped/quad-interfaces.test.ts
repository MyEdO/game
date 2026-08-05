import { describe, it, expect } from 'vitest';
import { QUAD_SPECIES, WINGED_SPECIES } from '../creatures';
import { buildQuadSkeleton, groundQuad, quadSkeletonForView, type QuadProps } from './quadSkeleton';
import { quadInterfaces, artLine, type QuadInterface, type QuadInterfaceId } from './quadInterfaces';
import { quadHeadBone, quadHeadDef } from './heads';
import { worldTransformsG, type Matrix } from '../kinematics';
import type { View } from '../facing';

/**
 * Contrat du module d'INTERFACES (`quadInterfaces.ts`) : les cinq lignes de rencontre du gabarit
 * quadrupède sont des FONCTIONS de l'espèce, lues sur les pivots RÉELS du squelette.
 * Ce que la garde mesure :
 *  1. TOUTES les espèces du registre (quad + ailées) rendent cinq interfaces exploitables ;
 *  2. chacune tombe DANS le corps (boîte de rendu, jamais sous le sol) ;
 *  3. MONOTONIE par scalaire dominant — l'interface SUIT l'axe de gabarit qui la commande ;
 *  4. les deux cas déclarés du module (encolure quasi nulle, cluster multi-cous).
 */

const ESPECES: [string, QuadProps][] = [
  ...Object.entries(QUAD_SPECIES),
  ...Object.entries(WINGED_SPECIES),
];
const VUES: View[] = ['profile', 'front', 'back'];
const IDS: QuadInterfaceId[] = ['gorge', 'garrot', 'epaule', 'hanche', 'naissanceQueue'];

/** Point MONDE d'une interface : son point local traversé par le transform de son os. */
function monde(p: QuadProps, i: Pick<QuadInterface, 'os' | 'x' | 'y'>, view: View = 'profile'): { x: number; y: number } {
  const sk = groundQuad(quadSkeletonForView(buildQuadSkeleton(p), view), {});
  const m = (worldTransformsG(sk, {}) as Record<string, Matrix>)[i.os];
  return { x: m[0] * i.x + m[2] * i.y + m[4], y: m[1] * i.x + m[3] * i.y + m[5] };
}

/** Props de référence : un gabarit neutre dont on ne bouge QU'UN scalaire à la fois. */
const BASE = {
  sl: 1, build: 'equine', girth: 1, bodyLen: 1, neckLen: 1, neckAngle: -40, legLen: 1,
  head: 'cheval', tail: 'crin', mane: 'crin', ears: 'courtes', foot: 'sabot', stored: {},
} as unknown as QuadProps;

/** Suite des valeurs d'un axe → coordonnée mondiale d'une interface, dans l'ordre du balayage. */
function balayage(axe: keyof QuadProps, valeurs: number[], id: QuadInterfaceId, coord: 'x' | 'y'): number[] {
  return valeurs.map((v) => {
    const p = { ...BASE, [axe]: v } as QuadProps;
    const i = quadInterfaces(p)[id];
    if (!i) throw new Error(`interface ${id} absente du gabarit de référence`);
    return monde(p, i)[coord];
  });
}
const strictementCroissant = (xs: number[]) => xs.every((v, k) => k === 0 || v > xs[k - 1]);
const strictementDecroissant = (xs: number[]) => xs.every((v, k) => k === 0 || v < xs[k - 1]);

describe('quadInterfaces : les cinq lignes de rencontre du gabarit quadrupède', () => {
  it('couvre tout le registre quad + ailé', () => {
    expect(ESPECES.length).toBeGreaterThanOrEqual(25);
  });

  it('chaque espèce × vue rend cinq interfaces, os propriétaire ≠ os voisin, épaisseurs positives', () => {
    const defauts: string[] = [];
    for (const [id, p] of ESPECES) for (const view of VUES) {
      const it = quadInterfaces(p, view);
      for (const cle of IDS) {
        const i = it[cle];
        if (!i) { // seule absence admise : la gorge d'un cluster multi-cous (exemption structurelle)
          if (cle !== 'gorge' || quadHeadBone(quadHeadDef(p.head), view) !== 'encolure') defauts.push(`${id} ${view} ${cle} : absente`);
          continue;
        }
        if (i.os === i.voisin) defauts.push(`${id} ${view} ${cle} : os propriétaire = voisin (${i.os})`);
        if (!(i.epaisseurVoisin > 0)) defauts.push(`${id} ${view} ${cle} : épaisseur voisine ${i.epaisseurVoisin}`);
        if (!Number.isFinite(i.x) || !Number.isFinite(i.y)) defauts.push(`${id} ${view} ${cle} : point non fini`);
      }
    }
    expect(defauts).toEqual([]);
  });

  /**
   * Bornes du CORPS : la boîte de rendu est 120×150, pieds au sol à y=150. Les extrema MESURÉS sur
   * le parc (profil) : x de −0,6 (naissance de queue du basilic, dont le tronc remplit la boîte)
   * à 111,1 (gorge du cheval) ; y de 27,7 (gorge du grand cerf) à 132,2 (épaule du rat géant).
   * La borne x est donc la boîte débordée de 2 u — un franchissement franc (une interface qui part
   * hors cadre) rougit ; la borne y, elle, est DURE : aucune interface sous le sol.
   */
  it('chaque interface tombe DANS le corps (boîte de rendu, jamais sous le sol)', () => {
    const horsCorps: string[] = [];
    for (const [id, p] of ESPECES) for (const view of VUES) {
      const it = quadInterfaces(p, view);
      for (const cle of IDS) {
        const i = it[cle];
        if (!i) continue;
        const { x, y } = monde(p, i, view);
        if (x < -2 || x > 122 || y < 0 || y > 150) horsCorps.push(`${id} ${view} ${cle} : monde(${x.toFixed(1)}, ${y.toFixed(1)})`);
      }
    }
    expect(horsCorps).toEqual([]);
  });

  it('MONOTONIE par scalaire dominant : l’interface suit l’axe qui la commande', () => {
    // `neckLen` commande la GORGE : allonger l'encolure porte la gorge plus HAUT (y décroît).
    expect(strictementDecroissant(balayage('neckLen', [0.6, 0.9, 1.2, 1.5], 'gorge', 'y'))).toBe(true);
    // `bodyLen` commande le GARROT et l'ÉPAULE vers l'AVANT (x croît, le profil regarde à droite)…
    expect(strictementCroissant(balayage('bodyLen', [0.8, 1, 1.2, 1.4], 'garrot', 'x'))).toBe(true);
    expect(strictementCroissant(balayage('bodyLen', [0.8, 1, 1.2, 1.4], 'epaule', 'x'))).toBe(true);
    // … et recule d'autant HANCHE et NAISSANCE DE QUEUE (x décroît) : le corps s'allonge des deux bouts.
    expect(strictementDecroissant(balayage('bodyLen', [0.8, 1, 1.2, 1.4], 'hanche', 'x'))).toBe(true);
    expect(strictementDecroissant(balayage('bodyLen', [0.8, 1, 1.2, 1.4], 'naissanceQueue', 'x'))).toBe(true);
    // `legLen` commande la HAUTEUR de tout le corps : sur pattes plus longues, le garrot monte.
    expect(strictementDecroissant(balayage('legLen', [0.6, 0.9, 1.2, 1.5], 'garrot', 'y'))).toBe(true);
    // `neckAngle` commande le PORT d'encolure (le squelette pose l'angle à `-neckAngle`) : mesuré
    // sur le gabarit de référence, la gorge RECULE quand il remonte vers 0 — x 112,2 → 89,2 pour
    // −70 → −10, monotone sur les deux axes (y suit : 56,9 → 37,6).
    expect(strictementDecroissant(balayage('neckAngle', [-70, -50, -30, -10], 'gorge', 'x'))).toBe(true);
    expect(strictementDecroissant(balayage('neckAngle', [-70, -50, -30, -10], 'gorge', 'y'))).toBe(true);
    // Aucune interface ne dépend de la CARRURE : `girth` est une échelle d'OS (profondeur), il ne
    // déplace aucun pivot — mesuré identique sur tout le balayage.
    expect(new Set(balayage('girth', [0.8, 1, 1.2, 1.5], 'epaule', 'y')).size).toBe(1);
  });

  it('CAS DÉCLARÉ — encolure quasi nulle (crapaud) : gorge et garrot existent et se confondent presque', () => {
    const crapaud = QUAD_SPECIES.crapaud;
    expect(crapaud, 'espèce crapaud absente du registre').toBeTruthy();
    expect(crapaud.neckLen).toBeLessThan(0.1);
    const it = quadInterfaces(crapaud);
    expect(it.gorge).not.toBeNull();
    const g = monde(crapaud, it.gorge!), w = monde(crapaud, it.garrot);
    const ecart = Math.hypot(g.x - w.x, g.y - w.y);
    expect(ecart).toBeGreaterThan(0); // deux lignes distinctes, si peu que ce soit
    expect(ecart).toBeLessThan(5); // … et quasi confondues : c'est la donnée, le module ne corrige rien
  });

  it('CAS DÉCLARÉ — clusters multi-cous : pas de couture tête↔encolure en profil (exemption STRUCTURELLE)', () => {
    const clusters = ESPECES.filter(([, p]) => quadHeadBone(quadHeadDef(p.head), 'profile') === 'encolure');
    expect(clusters.length).toBeGreaterThanOrEqual(3); // hydre, chimère, déchiqueteur
    for (const [id, p] of clusters) {
      expect(quadInterfaces(p, 'profile').gorge, `${id} : gorge attendue nulle en profil`).toBeNull();
      // Vues de BOUT : leur art revient sur l'os `tete` → la couture existe de nouveau.
      for (const view of ['front', 'back'] as View[])
        if (quadHeadBone(quadHeadDef(p.head), view) !== 'encolure')
          expect(quadInterfaces(p, view).gorge, `${id} ${view} : gorge attendue présente`).not.toBeNull();
    }
    // Aucune espèce à tête portée par `tete` ne perd sa gorge.
    for (const [id, p] of ESPECES.filter(([, q]) => quadHeadBone(quadHeadDef(q.head), 'profile') !== 'encolure'))
      expect(quadInterfaces(p, 'profile').gorge, `${id} : gorge attendue présente`).not.toBeNull();
  });

  /**
   * Ligne d'ART (`artLine`) : le décalage est un littéral d'artiste, le point d'appui reste une
   * FONCTION de l'espèce. La preuve est la dispersion : le MÊME décalage, porté au monde, tombe
   * ailleurs sur chaque espèce — un littéral de coordonnée, lui, aurait une dispersion nulle.
   */
  it('artLine : décalage explicite depuis un pivot, qui SUIT le squelette d’une espèce à l’autre', () => {
    const OFF: [number, number] = [4, 6]; // ganache : sous la gorge, vers l'avant
    const mondes: number[] = [];
    for (const [id, p] of ESPECES) {
      const g = quadInterfaces(p, 'profile').gorge;
      if (!g) continue; // cluster multi-cous : pas de gorge en profil
      const l = artLine(g, ...OFF);
      expect(l.os, `${id} : repère de la ligne d'art`).toBe(g.os);
      expect([l.x - g.x, l.y - g.y], `${id} : décalage`).toEqual(OFF);
      mondes.push(+monde(p, l).x.toFixed(1));
    }
    expect(mondes.length).toBeGreaterThanOrEqual(20);
    expect(new Set(mondes).size, 'dispersion mondiale du MÊME décalage').toBeGreaterThan(10);
  });
});
