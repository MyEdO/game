// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useGame } from '../../state/store';
import { emptyScene } from '../../state/scene';
import type { Combatant } from '../../engine/types';
import type { Dims } from '../../geometry/iso';
import type { Dir8 } from '../../state/dir8';
import { TokenChromeOverlay } from './TokenChromeOverlay';
import { tokenChrome, tokenChromes, type TokenChromeMark } from '../builders/tokenChrome';
import { CAP_GROUPE, poserCapDuGroupe } from '../../state/combatants';
import { combatantBodyTopFrac, combatantTokenScale } from '../sizeScale';
import { discCapPath, discR, teamRingDecor } from '../builders/dynamicMarks';
import { NEUTRAL_TINT } from '../teamColors';

/**
 * LE CAP DU PION SE LIT — DANS LES HUIT DIRECTIONS, ET SANS ÉQUIPE (#1176, P3-5c).
 *
 * Deux contrats, tous deux mesurés sur l'arbre RENDU (jamais sur le seul tracé pur) :
 *
 * 1. APPARTENANCE. Le cap est un composant du PION : il ne lit que `store.facing`, que porte tout
 *    jeton posté. L'anneau, lui, est la décoration d'ÉQUIPE. Un pion hors groupe (un cheval de scène)
 *    porte donc son cap, à la teinte neutre de la palette d'identité, et pas d'anneau.
 *
 * 2. LISIBILITÉ. La SURFACE VISIBLE du cap — sa surface moins ce que le disque lui prend, l'ORDRE DE
 *    PEINTURE de l'arbre rendu faisant foi — se mesure ici direction par direction. Deux choses en
 *    sortent : elle est du même ordre pour une diagonale que pour une cardinale, et elle reste au-delà
 *    d'un plancher. Un cap peint SOUS le fond du disque tombe à la seule pointe qui dépasse : c'est
 *    cette chute que le plancher attrape.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DIRS: readonly Dir8[] = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

/** Plancher de surface visible du cap, en R² (le quartier entier en vaut ~0,258 ; la seule pointe hors
 *  du disque, ~0,026). */
const AIRE_VISIBLE_MIN = 0.15;
/** Écart RELATIF toléré entre la direction la mieux lue et la moins bien lue. */
const ECART_MAX = 0.1;

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 9, max: 12 }, weapons: [],
    characteristics: { 'capacite-de-combat': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

/** La marque d'un jeton posté ; `team = null` = un jeton d'ambiance, qui n'appartient à aucun camp. */
function marque(c: Combatant, team: TokenChromeMark['team']): TokenChromeMark {
  return {
    id: c.id,
    capKey: c.id,
    cell: { x: c.pos!.x, y: c.pos!.y, z: 0 },
    n: 1,
    scaleK: combatantTokenScale(c),
    bodyTopFrac: combatantBodyTopFrac(c),
    team,
    subject: { kind: 'combatant', combatant: c },
    ...tokenChrome(c, { ghostIds: new Set<string>(), hoveredId: null }),
  };
}

const H1 = hero('h1', { x: 3, y: 3 });
const DIMS_TOP: Dims = { ...emptyScene(10, 10).dimensions, rot: 0, view: 'top', edge: false } as Dims;

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

/** Monte la surcouche sous le régime des PIONS, cap `dir`, avec (ou sans) équipe. */
function monter(dir: Dir8, team: TokenChromeMark['team']): HTMLDivElement {
  useGame.setState({ facing: { h1: dir } } as never);
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() =>
    root!.render(
      <svg className="iso-stage">
        <TokenChromeOverlay
          chromes={[marque(H1, team)]}
          dims={DIMS_TOP}
          liftAt={() => 0}
          pions
          walkPosAt={() => (_id, x, y) => ({ x, y, walking: false })}
        />
      </svg>,
    ),
  );
  return conteneur!;
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

afterEach(démonter);

/** Le `<path>` du cap dans l'arbre rendu, et l'ordre de peinture de ses voisins opaques. */
function capRendu(el: HTMLElement, dir: Dir8): { cap: SVGPathElement; auDessusDuDisque: boolean } {
  const g = el.querySelector('g[data-pion-cid="h1"]')!;
  const attendu = discCapPath(dir, 1, DIMS_TOP);
  const cap = [...g.querySelectorAll('path')].find((p) => p.getAttribute('d') === attendu) as SVGPathElement | undefined;
  expect(cap, `un cap tracé pour ${dir}`).toBeTruthy();
  const frères = [...cap!.parentElement!.children];
  const iCap = frères.indexOf(cap!);
  const R = discR(1);
  // Ce qui masque le cap : le FOND du disque, et le portrait clippé dedans — tous deux opaques au
  // rayon du disque. Le dernier des deux fixe le rang à dépasser.
  const iFond = frères.findIndex((n) => n.tagName === 'circle' && n.getAttribute('fill') !== 'none' && n.getAttribute('r') === String(R));
  const iPortrait = frères.findIndex((n) => n.tagName === 'g' && n.hasAttribute('clip-path'));
  expect(iFond, 'témoin : le fond du disque est bien dans la fratrie du cap').toBeGreaterThanOrEqual(0);
  expect(iPortrait, 'témoin : le portrait clippé est bien dans la fratrie du cap').toBeGreaterThanOrEqual(0);
  return { cap: cap!, auDessusDuDisque: iCap > Math.max(iFond, iPortrait) };
}

/** Les trois sommets d'un tracé `M x,y L x,y L x,y Z`. */
function sommets(d: string): [number, number][] {
  const n = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  expect(n.length, 'un triangle : trois sommets').toBe(6);
  return [[n[0], n[1]], [n[2], n[3]], [n[4], n[5]]];
}

function dansTriangle(p: [number, number], t: [number, number][]): boolean {
  const côté = (a: [number, number], b: [number, number]): number => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const s = [côté(t[0], t[1]), côté(t[1], t[2]), côté(t[2], t[0])];
  return s.every((v) => v >= 0) || s.every((v) => v <= 0);
}

/** SURFACE VISIBLE du cap, en R² : échantillonnage régulier de son tracé, un point comptant s'il tombe
 *  hors du disque, ou dedans quand le cap est peint AU-DESSUS de lui. */
function aireVisible(d: string, auDessusDuDisque: boolean): number {
  const t = sommets(d);
  const R = discR(1);
  const pas = R / 80;
  const xs = t.map((p) => p[0]);
  const ys = t.map((p) => p[1]);
  let aire = 0;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += pas)
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += pas) {
      if (!dansTriangle([x, y], t)) continue;
      if (auDessusDuDisque || Math.hypot(x, y) > R) aire += pas * pas;
    }
  return aire / (R * R);
}

describe('Cap du pion — appartenance et lisibilité (#1176 P3-5c)', () => {
  it('le pion porte son cap SANS équipe', () => {
    const el = monter('E', null);
    const g = el.querySelector('g[data-pion-cid="h1"]')!;
    const tracés = [...g.querySelectorAll('path')].map((p) => p.getAttribute('d'));
    expect(tracés, 'un jeton sans camp porte quand même son cap').toContain(discCapPath('E', 1, DIMS_TOP));
    const cap = [...g.querySelectorAll('path')].find((p) => p.getAttribute('d') === discCapPath('E', 1, DIMS_TOP))!;
    expect(cap.getAttribute('fill'), 'à la teinte NEUTRE de la palette d’identité').toBe(NEUTRAL_TINT);
    // …et il n'a PAS d'anneau : celui-là est la décoration d'ÉQUIPE.
    expect([...g.querySelectorAll('circle')].filter((c) => c.getAttribute('fill') === 'none'), 'aucun anneau d’équipe').toHaveLength(0);
    démonter();
    // TÉMOIN : avec une équipe, le même cap prend la couleur du camp — la teinte neutre n'est pas figée.
    const équipe = teamRingDecor(H1, 0);
    const avecÉquipe = monter('E', équipe);
    const gÉq = avecÉquipe.querySelector('g[data-pion-cid="h1"]')!;
    const capÉq = [...gÉq.querySelectorAll('path')].find((p) => p.getAttribute('d') === discCapPath('E', 1, DIMS_TOP))!;
    expect(capÉq.getAttribute('fill')).toBe(équipe.color);
    expect(équipe.color).not.toBe(NEUTRAL_TINT);
  });

  it('le disque du GROUPE tourne avec le cap du GROUPE, jamais avec celui de l’id du meneur', () => {
    // La marque telle que le builder la dérive pour le jeton de groupe : IDENTITÉ du meneur (bus,
    // chrome, caméra), CLÉ DE CAP du groupe (`partyTokenOf` → `capKey`).
    const groupe = tokenChromes([], { ghostIds: new Set<string>(), hoveredId: null }, { leader: H1, pos: { x: 3, y: 3 }, capKey: CAP_GROUPE })[0];
    expect(groupe.id, 'témoin : la marque porte bien l’id du meneur').toBe('h1');
    useGame.setState({ facing: poserCapDuGroupe({ h1: 'S' }, 'E') } as never); // le cap du héros CONTREDIT celui du groupe
    conteneur = document.createElement('div');
    document.body.appendChild(conteneur);
    root = createRoot(conteneur);
    act(() =>
      root!.render(
        <svg className="iso-stage">
          <TokenChromeOverlay chromes={[groupe]} dims={DIMS_TOP} liftAt={() => 0} pions walkPosAt={() => (_id, x, y) => ({ x, y, walking: false })} />
        </svg>,
      ),
    );
    const tracés = () => [...conteneur!.querySelectorAll('g[data-pion-cid="h1"] path')].map((p) => p.getAttribute('d'));
    expect(tracés(), 'le cap DESSINÉ est celui du groupe').toContain(discCapPath('E', 1, DIMS_TOP));
    expect(tracés(), 'et surtout pas celui keyé par le meneur').not.toContain(discCapPath('S', 1, DIMS_TOP));
    // …et il SUIT le groupe : un pivot repeint le quartier sans rien changer au cap du héros.
    act(() => { useGame.setState((s) => ({ facing: poserCapDuGroupe(s.facing, 'N') })); });
    expect(tracés()).toContain(discCapPath('N', 1, DIMS_TOP));
  });

  it('les HUIT directions se lisent : tracés distincts, et surface visible au même ordre', () => {
    const aires = new Map<Dir8, number>();
    const tracés = new Set<string>();
    for (const dir of DIRS) {
      const el = monter(dir, teamRingDecor(H1, 0));
      const { cap, auDessusDuDisque } = capRendu(el, dir);
      const d = cap.getAttribute('d')!;
      tracés.add(d);
      aires.set(dir, aireVisible(d, auDessusDuDisque));
      démonter();
    }
    expect(tracés.size, 'huit caps, huit tracés — aucun ne se replie sur un voisin').toBe(8);
    for (const [dir, aire] of aires)
      expect(aire, `${dir} : surface visible du cap (en R²)`).toBeGreaterThanOrEqual(AIRE_VISIBLE_MIN);
    const min = Math.min(...aires.values());
    const max = Math.max(...aires.values());
    expect((max - min) / max, 'une diagonale se lit au même poids qu’une cardinale').toBeLessThanOrEqual(ECART_MAX);
  });
});
