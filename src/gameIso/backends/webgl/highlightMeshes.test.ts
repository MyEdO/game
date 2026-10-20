import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile } from '../../../noyau/monde/scene';
import { buildHighlights, type HighlightEl, type HighlightsView } from '../../builders/highlights';
import type { BattleState } from '../../../noyau/etat';
import type { Combatant } from '../../../engine/types';
import { gpToWorld } from './worldTris';
import { SPECKLE_LIFT_M } from './groundAccents';
import { tileTint } from '../../teamColors';
import { RING_TARGET_TINT, WALK_TINT, ZONE_SMOKE_TINT } from '../../highlightTints';
import { DYN_MARK_SLOTS, buildDynamicMarkMesh } from './dynamicMarkMeshes';
import { HALO_SLOTS, buildHaloMesh } from './interactHaloMeshes';
import { FOG_GAMMA_DEFINE, applyFogGamma } from './sceneMeshes';
import {
  HIGHLIGHT_SLOTS,
  SLOT_OPACITY,
  TILE_INSET_K,
  buildHighlightMesh,
  groupHighlights,
  highlightMatrix,
  highlightSlot,
  highlightTint,
  slotCapacity,
  slotLiftM,
  writeHighlightInstances,
  type HighlightSlot,
} from './highlightMeshes';

/**
 * MARQUES DE CASES du monde volumique (#1176, P3-0c) — la moitié PURE : ce que le builder produit doit
 * se retrouver instance pour instance dans les pools, à la bonne place monde et au bon rang de
 * superposition. Aucun contexte GPU n'est requis (un `InstancedMesh` se construit et s'écrit hors
 * renderer).
 */
const SCENE = emptyScene(8, 8);
const MPT = sceneMetresPerTile(SCENE);

const cbt = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }): Combatant =>
  ({ id, label: id, kind, pos, size: 'moyenne', conditions: [], wounds: { current: 10, max: 10 } } as unknown as Combatant);

const BATTLE = {
  combatants: [cbt('h1', 'hero', { x: 2, y: 2 }), cbt('e1', 'enemy', { x: 5, y: 5 })],
  order: ['h1', 'e1'],
  turn: 0,
  zones: [{ id: 'z1', blocksLoS: true, tiles: [{ x: 1, y: 1 }, { x: 1, y: 2 }] }],
} as unknown as BattleState;

const VUE: HighlightsView = {
  myTurn: true,
  walkReach: new Map([['3,2', 1], ['4,2', 2], ['3,3', 2]]),
  runReach: new Map([['3,2', 1], ['5,2', 3]]),
  intentReach: new Map(),
  activeId: 'h1',
  eligibleIds: new Set(['e1']),
  crowdIds: null,
  candidates: null,
  rangeBandSource: null,
};

const ELS = buildHighlights(SCENE, BATTLE, VUE);

/** Compte d'éléments par slot, mesuré sur la sortie du builder. */
function comptesAttendus(els: readonly HighlightEl[]): Map<HighlightSlot, number> {
  const out = new Map<HighlightSlot, number>();
  for (const el of els) out.set(highlightSlot(el), (out.get(highlightSlot(el)) ?? 0) + 1);
  return out;
}

describe('Marques volumiques — le compte d’instances est celui des éléments du builder', () => {
  it('la scène témoin produit bien les quatre natures mesurées (sinon la sonde ne pèse rien)', () => {
    const c = comptesAttendus(ELS);
    expect(c.get('walk')).toBe(3);
    expect(c.get('run')).toBe(1); // `5,2` seul : `3,2` est déjà en Marche
    expect(c.get('teamActive')).toBe(1);
    expect(c.get('team')).toBe(1);
    expect(c.get('zoneSmoke')).toBe(2);
    expect(c.get('ringContour')).toBe(1);
  });

  it('un pool par slot : `count` == le nombre d’éléments de ce slot, capacité en réserve', () => {
    const lots = groupHighlights(ELS);
    for (const slot of HIGHLIGHT_SLOTS) {
      const els = lots.get(slot) ?? [];
      const capacité = slotCapacity(els.length);
      if (!capacité) {
        expect(els).toHaveLength(0);
        continue;
      }
      const mesh = buildHighlightMesh(slot, capacité);
      expect(mesh.count).toBe(0); // un pool naît vide : c'est l'écriture qui le remplit
      expect(writeHighlightInstances(mesh, els, MPT), 'remplir un pool vide CHANGE le dessin').toBe(true);
      expect(mesh.count).toBe(els.length);
      expect(mesh.instanceMatrix.count).toBe(capacité);
      expect((mesh.material as THREE.MeshBasicMaterial).opacity).toBe(SLOT_OPACITY[slot]);
    }
  });

  it('réécriture EN PLACE : le pool ne change pas d’identité quand les marques changent', () => {
    const mesh = buildHighlightMesh('walk', slotCapacity(3));
    const tampon = mesh.instanceMatrix.array;
    writeHighlightInstances(mesh, ELS.filter((e) => e.kind === 'walk'), MPT);
    writeHighlightInstances(mesh, ELS.filter((e) => e.kind === 'walk').slice(0, 1), MPT);
    expect(mesh.count).toBe(1);
    expect(mesh.instanceMatrix.array).toBe(tampon); // même tampon : rien n'a été réalloué
  });

  it('le retour est un signal de CHANGEMENT : muet à l’identique, vrai au déplacement comme à l’effacement', () => {
    const marches = ELS.filter((e) => e.kind === 'walk');
    const mesh = buildHighlightMesh('walk', slotCapacity(marches.length));
    expect(writeHighlightInstances(mesh, marches, MPT)).toBe(true);
    const version = mesh.instanceMatrix.version; // `needsUpdate` n'a QUE son mutateur : la version en tient le compte
    expect(writeHighlightInstances(mesh, marches, MPT), 'rien n’a bougé : rien à repeindre').toBe(false);
    expect(mesh.instanceMatrix.version, 'ni tampon à re-téléverser').toBe(version);
    const bougée = marches.map((e, i) => (i === 0 ? { ...e, cell: { ...e.cell, x: e.cell.x + 1 } } : e));
    expect(writeHighlightInstances(mesh, bougée, MPT), 'même COMPTE, autre case').toBe(true);
    expect(mesh.count).toBe(marches.length);
    expect(writeHighlightInstances(mesh, [], MPT), 'effacer est un changement').toBe(true);
    expect(mesh.count).toBe(0);
  });

  it('capacité par PALIER : plancher 32, puissances de deux, 0 quand il n’y a rien', () => {
    expect(slotCapacity(0)).toBe(0);
    expect(slotCapacity(1)).toBe(32);
    expect(slotCapacity(32)).toBe(32);
    expect(slotCapacity(33)).toBe(64);
    expect(slotCapacity(120)).toBe(128);
  });

  it('un pool SATURÉ écrit ce qu’il peut, sans déborder son tampon', () => {
    const mesh = buildHighlightMesh('walk', 2);
    expect(writeHighlightInstances(mesh, ELS.filter((e) => e.kind === 'walk'), MPT)).toBe(true);
    expect(mesh.count).toBe(2);
  });
});

describe('Marques volumiques — pose MONDE et rang de superposition', () => {
  it('une case connue tombe au point monde de sa case, décollée du lift de son slot', () => {
    const el = ELS.find((e) => e.kind === 'walk' && e.cell.x === 4 && e.cell.y === 2)!;
    const p = new THREE.Vector3();
    highlightMatrix(el, MPT).decompose(p, new THREE.Quaternion(), new THREE.Vector3());
    const attendu = gpToWorld({ x: 4, y: 2, h: 0 }, MPT); // la conversion du monde, `worldTris.ts`
    expect(p.x).toBeCloseTo(attendu.x, 9);
    expect(p.z).toBeCloseTo(attendu.z, 9);
    expect(p.y).toBeCloseTo(attendu.y + slotLiftM('walk'), 9);
  });

  it('le carré fait UNE case de côté (en monde, une case n’est plus un losange)', () => {
    const s = new THREE.Vector3();
    highlightMatrix(ELS[0], MPT).decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
    expect([s.x, s.z]).toEqual([MPT, MPT]);
  });

  it('rang de lift CROISSANT : walk < team < zone < ring (les coplanaires ne se z-fightent pas)', () => {
    const lifts = ['walk', 'team', 'zoneSmoke', 'ringContour'] as const;
    const suite = lifts.map(slotLiftM);
    expect(suite).toEqual([...suite].sort((a, b) => a - b));
    expect(new Set(suite).size).toBe(4);
    expect(slotLiftM('walk')).toBeCloseTo(SPECKLE_LIFT_M, 12); // le rang s'exprime en crans de ce lift
  });

  it('un anneau posé sur une teinte d’équipe est AU-DESSUS d’elle, sur la même case', () => {
    const anneau = ELS.find((e) => e.kind === 'ring')!;
    const equipe = ELS.find((e) => e.kind === 'team' && e.cell.x === anneau.cell.x && e.cell.y === anneau.cell.y)!;
    const y = (el: HighlightEl) => new THREE.Vector3().setFromMatrixPosition(highlightMatrix(el, MPT)).y;
    expect(y(anneau)).toBeGreaterThan(y(equipe));
  });

  it('le rang REPRODUIT l’ordre d’émission du builder (ce que le tri stable de l’affine départage)', () => {
    // L'affine trie par profondeur de façon STABLE (`stage/objs.sortByDepth`) : à case égale, le dernier
    // ÉMIS passe au-dessus. Les KINDS sortent du builder dans un ordre fixe (l'ordre des slots d'un même
    // kind, lui, suit la donnée — l'ordre des combattants, celui des zones) : chaque kind doit donc
    // occuper un BLOC de rangs contigu, et ces blocs se suivre dans l'ordre d'émission.
    const parKind = new Map<HighlightEl['kind'], number[]>();
    for (const el of buildHighlights(SCENE, BATTLE, { ...VUE, rangeBandSource: { pos: { x: 2, y: 2 }, rangeM: 4 } })) {
      const lot = parKind.get(el.kind);
      if (lot) lot.push(slotLiftM(highlightSlot(el)));
      else parKind.set(el.kind, [slotLiftM(highlightSlot(el))]);
    }
    const kinds = [...parKind.keys()];
    expect(kinds.length, 'la sonde doit VRAIMENT voir plusieurs natures').toBeGreaterThan(4);
    expect(kinds[kinds.length - 1], 'les bandes de portée sont émises EN DERNIER (donc au-dessus)').toBe('rangeBand');
    const bornes = [...parKind.values()].map((l) => [Math.min(...l), Math.max(...l)]);
    for (let i = 1; i < bornes.length; i++)
      expect(bornes[i][0], `le bloc de rangs du kind #${i} chevauche le précédent`).toBeGreaterThan(bornes[i - 1][1]);
  });

  it('deux slots d’un MÊME kind ne partagent pas leur rang (fumée + feu sur la même case)', () => {
    const même = (slot: 'zoneFire' | 'zoneSmoke' | 'team' | 'teamActive' | 'ringCrowd' | 'ringContour') => slotLiftM(slot);
    expect(même('zoneFire')).not.toBe(même('zoneSmoke'));
    expect(même('team')).not.toBe(même('teamActive'));
    expect(même('ringCrowd')).not.toBe(même('ringContour'));
  });
});

describe('Marques volumiques — l’anneau-contour est un CADRE, pas un quad plein', () => {
  /** Aire d'une géométrie triangulée, dans son plan XZ (le gabarit unité est horizontal). */
  function aire(geo: THREE.BufferGeometry): number {
    const p = geo.getAttribute('position');
    let s = 0;
    for (let i = 0; i < p.count; i += 3) {
      const ax = p.getX(i), az = p.getZ(i);
      const bx = p.getX(i + 1), bz = p.getZ(i + 1);
      const cx = p.getX(i + 2), cz = p.getZ(i + 2);
      s += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
    }
    return s;
  }

  it('le pool `ringContour` porte quatre bandes, jamais les deux triangles de la case pleine', () => {
    const cadre = buildHighlightMesh('ringContour', 32).geometry;
    const plein = buildHighlightMesh('ringCrowd', 32).geometry;
    expect(plein.getAttribute('position').count).toBe(6); // 2 triangles
    expect(cadre.getAttribute('position').count).toBe(24); // 4 bandes × 2 triangles
    // la case entière MOINS son liseré de grille, sur les quatre bords (`TILE_INSET_K`)
    expect(aire(plein)).toBeCloseTo((1 - 2 * TILE_INSET_K) ** 2, 6); // 6 décimales : la géométrie est en float32
    expect(aire(cadre)).toBeLessThan(0.5); // un liseré : l'intérieur reste vide
    expect(aire(cadre)).toBeGreaterThan(0);
  });

  it('le cadre est CREUX : aucun sommet à l’intérieur du liseré', () => {
    const cadre = buildHighlightMesh('ringContour', 32).geometry;
    const p = cadre.getAttribute('position');
    const bord = Math.max(...Array.from({ length: p.count }, (_, i) => Math.max(Math.abs(p.getX(i)), Math.abs(p.getZ(i)))));
    expect(bord).toBeCloseTo(0.5, 9); // le cadre touche bien le bord de la case
    let intérieurs = 0;
    for (let i = 0; i < p.count; i++)
      if (Math.max(Math.abs(p.getX(i)), Math.abs(p.getZ(i))) < 0.5 - 1e-9) intérieurs++;
    expect(intérieurs, 'un cadre a des sommets INTERNES (le bord de son liseré)').toBeGreaterThan(0);
    // …mais aucun au CENTRE : le trou du cadre est vide de géométrie.
    let centre = 0;
    for (let i = 0; i < p.count; i++)
      if (Math.max(Math.abs(p.getX(i)), Math.abs(p.getZ(i))) < 0.3) centre++;
    expect(centre).toBe(0);
  });
});

describe('Marques volumiques — teintes du catalogue partagé, jamais un littéral', () => {
  it('chaque nature prend la teinte que le catalogue partagé lui donne', () => {
    expect(highlightTint({ key: 'k', cell: { x: 0, y: 0, z: 0 }, h: 0, kind: 'walk' })).toBe(WALK_TINT);
    expect(highlightTint({ key: 'k', cell: { x: 0, y: 0, z: 0 }, h: 0, kind: 'zone', smoke: true })).toBe(ZONE_SMOKE_TINT);
    expect(highlightTint({ key: 'k', cell: { x: 0, y: 0, z: 0 }, h: 0, kind: 'ring', tone: 'target' })).toBe(RING_TARGET_TINT);
    expect(highlightTint({ key: 'k', cell: { x: 0, y: 0, z: 0 }, h: 0, kind: 'team', hero: true, active: false })).toBe(tileTint(true, false));
  });

  it('la teinte voyage PAR INSTANCE : deux équipes dans le même pool, deux couleurs', () => {
    const els = ELS.filter((e) => e.kind === 'team');
    const mesh = buildHighlightMesh('team', slotCapacity(4));
    writeHighlightInstances(mesh, els.slice(0, 1), MPT);
    const c = new THREE.Color();
    mesh.getColorAt(0, c);
    expect(`#${c.getHexString()}`).toBe(highlightTint(els[0]));
  });
});

/**
 * CHROME D'INTERFACE ≠ MATIÈRE DU MONDE (#1176 P3-1c, réf juge de design) — les trois familles de
 * pools au sol (surbrillances de combat, marques dynamiques, halos d'interaction) sont des affordances :
 * leur opacité est CHOISIE pour la lisibilité. La brume du POV (`povFog` + `applyFogGamma`) mangerait
 * cette opacité à distance — 71 % de facteur à 26 cases sur la courbe extérieure — et personne ne
 * l'aurait déclaré. Le banc parcourt TOUS les slots des trois builders, pas seulement ceux qu'une scène
 * donnée monte.
 */
describe('AFFORDANCES au sol — aucune ne prend la brume du monde', () => {
  const pools = [
    ...HIGHLIGHT_SLOTS.map((s) => buildHighlightMesh(s, 4)),
    ...DYN_MARK_SLOTS.map((s) => buildDynamicMarkMesh(s, 4)),
    ...HALO_SLOTS.map((s) => buildHaloMesh(s, 4)),
  ];

  it('les trois familles sont bien nommées `marques:` / `marquesDyn:` / `halos:`', () => {
    expect(pools.length).toBe(HIGHLIGHT_SLOTS.length + DYN_MARK_SLOTS.length + HALO_SLOTS.length);
    for (const mesh of pools) expect(mesh.name).toMatch(/^(marques|marquesDyn|halos):/);
  });

  it('AUCUN matériau d’affordance n’a `fog` — la brume ne délave pas le chrome', () => {
    const embrumés = pools.filter((m) => (m.material as THREE.Material & { fog?: boolean }).fog).map((m) => m.name);
    expect(embrumés, 'un pool d’affordance embrumé perdrait son opacité au loin').toEqual([]);
  });

  it('un matériau non embrumé ne reçoit AUCUN gamma de brume, même sous `applyFogGamma`', () => {
    const groupe = new THREE.Group();
    for (const mesh of pools) groupe.add(mesh);
    expect(applyFogGamma(groupe, 2), 'rien à changer : aucun de ces matériaux ne s’embrume').toBe(false);
    for (const mesh of pools) {
      expect((mesh.material as THREE.Material).defines?.[FOG_GAMMA_DEFINE], mesh.name).toBeUndefined();
    }
  });
});
