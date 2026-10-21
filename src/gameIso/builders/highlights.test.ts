import { describe, it, expect } from 'vitest';
import { emptyScene } from '../../noyau/monde/scene';
import type { BattleState } from '../../noyau/etat';
import { Combatant } from '../../engine/types';
import { buildHighlights, rangeBandTone, type HighlightEl, type HighlightsView } from './highlights';

function cbt(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number; z?: number }, extra: Partial<Combatant> = {}): Combatant {
  return { id, name: id, kind, pos, size: 'moyenne', conditions: [], wounds: { current: 10, max: 10 }, ...extra } as unknown as Combatant;
}

const VIEW: HighlightsView = {
  myTurn: true,
  walkReach: new Map(),
  runReach: new Map(),
  intentReach: new Map(),
  activeId: null,
  eligibleIds: null,
  crowdIds: null,
  candidates: null,
  rangeBandSource: null,
};

describe('buildHighlights — surbrillances sémantiques (clés historiques stables)', () => {
  const scene = () => emptyScene('scene-test', 6, 6);

  it('grilles de Marche/Course : clés z-aware, la Course exclut les cases déjà en Marche', () => {
    const b = { combatants: [], zones: [] } as unknown as BattleState;
    const els = buildHighlights(scene(), b, {
      ...VIEW,
      walkReach: new Map([['1,1', 1], ['2,1,1', 2]]),
      runReach: new Map([['1,1', 1], ['3,1', 3]]),
    });
    expect(els.map((e) => e.key)).toEqual(['h1,1', 'h2,1,1', 'r3,1']);
    expect(els[1].cell).toEqual({ x: 2, y: 1, z: 1 });
    expect(els[0].h).toBe(0); // scène sans relief : la surface de toute case est à 0 m
  });

  it('hors de mon tour (coop) : AUCUNE grille, mais les teintes d’équipe restent', () => {
    const b = { combatants: [cbt('h1', 'hero', { x: 0, y: 0 }), cbt('e1', 'enemy', { x: 3, y: 3 })], zones: [] } as unknown as BattleState;
    const els = buildHighlights(scene(), b, { ...VIEW, myTurn: false, walkReach: new Map([['1,1', 1]]), activeId: 'h1' });
    expect(els.every((e) => e.kind === 'team')).toBe(true);
    expect(els.find((e) => e.key === 'tth1-0-0')).toMatchObject({ kind: 'team', hero: true, active: true });
    expect(els.find((e) => e.key === 'tte1-0-0')).toMatchObject({ kind: 'team', hero: false, active: false });
  });

  it('teintes d’équipe : cavalier exclu (représenté par sa monture), empreinte N×N couverte, monture du cavalier actif « active »', () => {
    const rider = cbt('h1', 'hero', { x: 0, y: 0 }, { mountId: 'm1' });
    const mount = cbt('m1', 'enemy', { x: 0, y: 0 }, { riderId: 'h1', size: 'grande' } as Partial<Combatant>);
    const b = { combatants: [rider, mount], zones: [] } as unknown as BattleState;
    const els = buildHighlights(scene(), b, { ...VIEW, activeId: 'h1' });
    expect(els.find((e) => e.key.startsWith('tth1'))).toBeUndefined(); // pas de pastille 1×1 du cavalier
    const mTiles = els.filter((e) => e.key.startsWith('ttm1'));
    expect(mTiles).toHaveLength(4); // Grande créature → empreinte 2×2
    expect(mTiles[0]).toMatchObject({ kind: 'team', active: true }); // monture du cavalier actif
  });

  it('zones persistantes : fumée vs feu, au sol', () => {
    // La clé porte l'id STABLE de la zone (`BattleZone.id`, propagé de la zone authorée), JAMAIS son
    // libellé (#598) ; une zone créée au RUNTIME (op `zone` d'un sort, sans id) retombe sur son RANG.
    const b = { combatants: [], zones: [{ id: 'fumee-1', label: 'Fumée', blocksLoS: true, tiles: [{ x: 1, y: 1 }] }, { label: 'Feu', tiles: [{ x: 2, y: 2 }] }] } as unknown as BattleState;
    const els = buildHighlights(scene(), b, VIEW);
    expect(els.find((e) => e.key === 'zone-fumee-1-1-1-0')).toMatchObject({ kind: 'zone', smoke: true, cell: { x: 1, y: 1, z: 0 } });
    expect(els.find((e) => e.key === 'zone-1-2-2-0')).toMatchObject({ kind: 'zone', smoke: false, cell: { x: 2, y: 2, z: 0 } });
    // Le libellé ne sert plus d'identité : renommer la zone ne change AUCUNE clé.
    expect(els.some((e) => e.key.includes('Fumée') || e.key.includes('Feu'))).toBe(false);
  });

  it('zone à l’étage (t.z) : peinte à SA hauteur réelle, jamais ramenée au sol', () => {
    const b = { combatants: [], zones: [{ id: 'braise-1', blocksLoS: false, tiles: [{ x: 1, y: 1, z: 1 }] }] } as unknown as BattleState;
    const els = buildHighlights(scene(), b, VIEW);
    const el = els.find((e) => e.key === 'zone-braise-1-1-1-1');
    expect(el).toMatchObject({ kind: 'zone', smoke: false, cell: { x: 1, y: 1, z: 1 } });
  });

  it('anneaux : cibles d’attaque (target), tirer-dans-le-tas (crowd), candidats soin/cochés (ally)', () => {
    const b = {
      combatants: [cbt('e1', 'enemy', { x: 1, y: 1 }), cbt('e2', 'enemy', { x: 2, y: 2 }), cbt('a1', 'hero', { x: 3, y: 3 })],
      zones: [],
    } as unknown as BattleState;
    const els = buildHighlights(scene(), b, {
      ...VIEW,
      eligibleIds: new Set(['e1']),
      crowdIds: new Set(['e2']),
      candidates: { ids: ['a1', 'e2'], friendly: false, checkedIds: new Set(['a1']) },
    });
    expect(els.find((e) => e.key === 'tgt-e1')).toMatchObject({ kind: 'ring', tone: 'target' });
    expect(els.find((e) => e.key === 'crowd-e2')).toMatchObject({ kind: 'ring', tone: 'crowd' });
    expect(els.find((e) => e.key === 'cand-a1')).toMatchObject({ kind: 'ring', tone: 'ally' }); // déjà coché → vert
    expect(els.find((e) => e.key === 'cand-e2')).toMatchObject({ kind: 'ring', tone: 'target' });
  });
});

describe('rangeBandTone — teinte dérivée du SIGNE de rangeBandModifier', () => {
  it('bonus (Bout Portant/Courte, mod > 0), neutre (Moyenne, mod = 0), malus (Longue/Extrême, mod < 0), null au-delà', () => {
    const rangeM = 20;
    expect(rangeBandTone(1, rangeM)).toBe('bonus');
    expect(rangeBandTone(5, rangeM)).toBe('bonus');
    expect(rangeBandTone(10, rangeM)).toBe('neutre');
    expect(rangeBandTone(25, rangeM)).toBe('malus');
    expect(rangeBandTone(30, rangeM)).toBe('malus'); // borne Extrême (Portée×3 = 60 m = 30 cases)
    expect(rangeBandTone(31, rangeM)).toBeNull(); // au-delà : hors de portée
  });
});

describe('buildHighlights — bandes de portée du tireur survolé (rangeBandSource)', () => {
  const carte = () => emptyScene('scene-test', 40, 40);
  const horsCarte = (e: HighlightEl, w: number, h: number) => e.cell.x < 0 || e.cell.y < 0 || e.cell.x >= w || e.cell.y >= h;

  it('colore les cases autour du tireur selon la bande de portée (bonus/neutre/malus), rien au-delà de la portée max', () => {
    const b = { combatants: [], zones: [] } as unknown as BattleState;
    const rangeM = 20; // Portée×3 = 60 m = 30 cases (mpt = 2)
    const els = buildHighlights(carte(), b, { ...VIEW, rangeBandSource: { pos: { x: 0, y: 0 }, rangeM } });
    const rb = els.filter((e) => e.kind === 'rangeBand');
    const at = (dx: number, dy: number) => rb.find((e) => e.cell.x === dx && e.cell.y === dy);
    expect(at(1, 0)).toMatchObject({ tone: 'bonus' });
    expect(at(10, 0)).toMatchObject({ tone: 'neutre' });
    expect(at(25, 0)).toMatchObject({ tone: 'malus' });
    expect(at(31, 0)).toBeUndefined(); // hors de portée : aucun élément
  });

  it('le semis est BORNÉ à la carte : aucune case hors des dimensions, plafond = w×h', () => {
    const b = { combatants: [], zones: [] } as unknown as BattleState;
    // Tireur au centre d'une carte 40×40, Portée 150 m → rayon théorique 225 cases : sans borne le semis
    // émettait 203 401 éléments (451²) au lieu des 1 600 cases de la carte.
    const els = buildHighlights(carte(), b, { ...VIEW, rangeBandSource: { pos: { x: 20, y: 20 }, rangeM: 150 } });
    const rb = els.filter((e) => e.kind === 'rangeBand');
    expect(rb.filter((e) => horsCarte(e, 40, 40))).toHaveLength(0);
    expect(rb).toHaveLength(1600); // 40×40 : toute la carte est dans la bande, rien de plus
  });

  it('un tireur au BORD ne peint que le quart de bandes qui tombe sur la carte', () => {
    const b = { combatants: [], zones: [] } as unknown as BattleState;
    const els = buildHighlights(emptyScene('scene-test', 6, 6), b, { ...VIEW, rangeBandSource: { pos: { x: 5, y: 5 }, rangeM: 20 } });
    const rb = els.filter((e) => e.kind === 'rangeBand');
    expect(rb.filter((e) => horsCarte(e, 6, 6))).toHaveLength(0);
    expect(rb).toHaveLength(36);
  });

  it('empreinte N×N débordant le bord : seules les cases DE LA CARTE reçoivent la teinte d’équipe', () => {
    // Grande créature (empreinte 2×2) au coin bas-droit : 3 des 4 cases tombent hors carte.
    const g = cbt('g1', 'enemy', { x: 5, y: 5 }, { size: 'grande' } as Partial<Combatant>);
    const b = { combatants: [g], zones: [] } as unknown as BattleState;
    const els = buildHighlights(emptyScene('scene-test', 6, 6), b, VIEW);
    expect(els.filter((e) => horsCarte(e, 6, 6))).toHaveLength(0);
    expect(els.map((e) => e.key)).toEqual(['ttg1-0-0']);
  });

  it('rangeBandSource absent : aucun élément rangeBand', () => {
    const b = { combatants: [], zones: [] } as unknown as BattleState;
    const els = buildHighlights(emptyScene('scene-test', 6, 6), b, VIEW);
    expect(els.some((e) => e.kind === 'rangeBand')).toBe(false);
  });
});
