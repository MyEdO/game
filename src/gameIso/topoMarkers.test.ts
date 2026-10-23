import { describe, it, expect } from 'vitest';
import { stationMarker, stationTint, wedgePath, ARC_DIR, MARKER_R, colocationOffsets } from './topoMarkers';
import { tileCenter, type Dims } from '../geometry/iso';
import { ALLY_TINT, ENEMY_TINT, NEUTRAL_TINT } from './teamColors';
import type { Station } from '../noyau/stations';
import type { FireArc } from '../engine/types';

/**
 * Géométrie PURE des marqueurs top-down : le disque tombe sur le `tileCenter` de la case (projection
 * partagée), la teinte suit la faction (source unique `teamColors`), l'anneau n'apparaît que pour la
 * station sélectionnée, le badge compte les équipiers assignés, et le wedge d'arc diffère par `side`.
 */

const dims: Dims = { w: 8, h: 8, view: 'top' };

function station(over: Partial<Station> = {}): Station {
  return {
    id: 's1',
    kind: 'poste',
    pos: { x: 3, y: 2 },
    label: 'Baliste',
    icon: 'action/serve-engine',
    faction: 'ally',
    assignedIds: [],
    manned: false,
    ref: { kind: 'poste', hullId: 'h1', posteUid: 'p1' },
    ...over,
  };
}

describe('stationTint — faction → teinte (source unique teamColors)', () => {
  it('allié/ennemi/neutre', () => {
    expect(stationTint('ally')).toBe(ALLY_TINT);
    expect(stationTint('enemy')).toBe(ENEMY_TINT);
    expect(stationTint('neutral')).toBe(NEUTRAL_TINT);
  });
});

describe('stationMarker — centre au tileCenter de la case', () => {
  it('cx/cy = projection top-down de pos (z compris)', () => {
    const m = stationMarker(station({ pos: { x: 3, y: 2 } }), dims);
    const c = tileCenter(3, 2, dims, 0);
    expect(m.cx).toBe(c.cx);
    expect(m.cy).toBe(c.cy);
  });
  it('z>0 : soulevé comme tileCenter', () => {
    const m = stationMarker(station({ pos: { x: 3, y: 2, z: 1 } }), dims);
    expect(m.cy).toBe(tileCenter(3, 2, dims, 1).cy);
  });
});

describe('stationMarker — teinte, anneau, badge', () => {
  it('teinte = faction', () => {
    expect(stationMarker(station({ faction: 'enemy' }), dims).tint).toBe(ENEMY_TINT);
  });
  it('anneau vrai UNIQUEMENT si sélectionnée', () => {
    expect(stationMarker(station({ id: 'a' }), dims, 'a').ring).toBe(true);
    expect(stationMarker(station({ id: 'a' }), dims, 'b').ring).toBe(false);
    expect(stationMarker(station({ id: 'a' }), dims).ring).toBe(false);
  });
  it('badge = nombre d’équipiers assignés (absent si 0)', () => {
    expect(stationMarker(station({ assignedIds: ['x', 'y'] }), dims).badge).toBe(2);
    expect(stationMarker(station({ assignedIds: [] }), dims).badge).toBeUndefined();
  });
});

describe('stationMarker / wedgePath — arc d’orientation par side', () => {
  it('wedge absent sans side, présent avec side', () => {
    expect(stationMarker(station(), dims).wedge).toBeUndefined();
    expect(stationMarker(station({ side: 'proue' }), dims).wedge).toBeDefined();
  });
  it('la pointe du wedge suit la convention proue=haut/poupe=bas/tribord=droite/babord=gauche', () => {
    const cx = 100, cy = 100;
    const tip = (side: FireArc): [number, number] => {
      // Le 2e sommet du path `M.. L.. L.. Z` est la POINTE (cf. wedgePath).
      const m = wedgePath(cx, cy, ARC_DIR[side]).match(/L([\d.-]+),([\d.-]+)/);
      return [parseFloat(m![1]), parseFloat(m![2])];
    };
    expect(tip('proue')[1]).toBeLessThan(cy - MARKER_R); // vers le haut
    expect(tip('poupe')[1]).toBeGreaterThan(cy + MARKER_R); // vers le bas
    expect(tip('tribord')[0]).toBeGreaterThan(cx + MARKER_R); // vers la droite
    expect(tip('babord')[0]).toBeLessThan(cx - MARKER_R); // vers la gauche
    // GABARIT DE STATION par DÉFAUT : la généralisation du triangle (une DIRECTION en paramètre, un
    // gabarit en option — le pion du plateau y passe le sien) ne bouge pas ce tracé d'un pixel.
    expect(wedgePath(cx, cy, ARC_DIR.proue))
      .toBe(wedgePath(cx, cy, ARC_DIR.proue, { r: MARKER_R, len: 22, half: 8 }));
    // Les quatre pointes diffèrent.
    const all = (['proue', 'poupe', 'tribord', 'babord'] as FireArc[]).map((s) => tip(s).join(','));
    expect(new Set(all).size).toBe(4);
  });
});

describe('colocationOffsets — évitement des stations d’une même case', () => {
  it('station seule → offset nul (reste au centre)', () => {
    const off = colocationOffsets([station({ id: 'a' })], dims);
    expect(off.get('a')).toEqual({ dx: 0, dy: 0 });
  });
  it('deux pièces du même bord (même case) → deux offsets distincts et non nuls', () => {
    const a = station({ id: 'a', pos: { x: 3, y: 2 }, side: 'tribord' });
    const b = station({ id: 'b', pos: { x: 3, y: 2 }, side: 'tribord' });
    const off = colocationOffsets([a, b], dims);
    const oa = off.get('a')!, ob = off.get('b')!;
    expect(oa).not.toEqual({ dx: 0, dy: 0 });
    expect(oa).not.toEqual(ob);
    // Appliqués, les deux marqueurs ne se superposent plus.
    const ma = stationMarker(a, dims, undefined, oa), mb = stationMarker(b, dims, undefined, ob);
    expect(ma.cx !== mb.cx || ma.cy !== mb.cy).toBe(true);
  });
  it('cases DISTINCTES → chacune à offset nul (pas d’éventail parasite)', () => {
    const off = colocationOffsets([station({ id: 'a', pos: { x: 1, y: 1 } }), station({ id: 'b', pos: { x: 5, y: 5 } })], dims);
    expect(off.get('a')).toEqual({ dx: 0, dy: 0 });
    expect(off.get('b')).toEqual({ dx: 0, dy: 0 });
  });
});
