// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGame, type BattleState } from '../../state/store';
import { emptyScene, sceneMetresPerTile } from '../../state/scene';
import type { Combatant } from '../../engine/types';
import { MondeDeCampagne } from './MondeDeCampagne';
import { setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise, scènes, viderCaptures } from './banc-volumique';
import { ACTIVE_HALO_TINT, ENGAGE_TINT } from '../highlightTints';
import { ENEMY_RING, HERO_RING, teamShape } from '../teamColors';
import { COMBAT_TOKEN_BASE, PARTY_TOKEN_BASE, TETHER_DASH_PX, TETHER_GAP_PX, dashPattern, teamRingRadiusK } from '../builders/dynamicMarks';
import { combatantTokenScale } from '../sizeScale';
import { ringDashes } from './dynamicMarkPose';
import { TH, TW } from '../../geometry/iso';
import { PARTY_FRAME_K } from '../backends/webgl/dynamicMarkMeshes';
import { RING_FRAME_K } from '../backends/webgl/highlightMeshes';

/**
 * MARQUES DYNAMIQUES posées par le monde volumique (#1176, P3-0d) : le lien d'ENGAGEMENT, le contour
 * de l'ACTIF, le repère du GROUPE et les anneaux d'ÉQUIPE. Tous descendent de la MÊME dérivation pure
 * (`builders/dynamicMarks`) ; cette sonde mesure que le monde la consomme jusqu'au bout (pools montés,
 * instances écrites, comptes dessinés).
 *
 * ORACLE RE-DÉRIVÉ (C5a). Le second terme était la voie AFFINE, qui traçait ces repères en SVG
 * (les jetons SVG du monde) ; elle est morte. Ce qu'elle
 * fournissait — l'ALLURE attendue — se re-dérive des mêmes constantes partagées, qui, elles, vivent :
 *   - le pointillé du lien : `TETHER_DASH_PX`/`TETHER_GAP_PX` sur la longueur écran d'un pas de case,
 *     à la sémantique du `stroke-dasharray` (un tiret est peint dès que son début tombe avant la fin) ;
 *   - le rayon d'un anneau : `teamRingRadiusK(échelle du jeton)`, la formule même dont l'ellipse affine
 *     tirait son `rx`.
 * Aucune valeur figée à la main : ce sont les lois du dessin, pas des mesures recopiées.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: { 'capacite-de-combat': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

/** Deux combattants au CONTACT, mutuellement Engagés — l'état que le lien de mêlée dessine. */
function combatEngagé(): BattleState {
  return {
    combatants: [
      { ...hero('h1', { x: 3, y: 3 }), engagedWith: ['e1'] },
      { ...hero('e1', { x: 4, y: 3 }), kind: 'enemy', engagedWith: ['h1'] },
    ],
    order: ['h1', 'e1'],
    turn: 0,
    round: 1,
    over: false,
    action: null,
    acted: true,
    movementUsed: 0,
    preview: null,
    reachable: new Map<string, number>(),
    zones: [],
    log: [],
  } as unknown as BattleState;
}

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

/** État de combat (les deux Engagés) ou d'exploration (le groupe sur sa case). */
function étatDe(mode: 'battle' | 'exploration'): Record<string, unknown> {
  return {
    scene: emptyScene(10, 10),
    mode,
    partyPos: { x: 6, y: 6 },
    party: [hero('h1', { x: 6, y: 6 })],
    battle: mode === 'battle' ? combatEngagé() : null,
    dialogue: null,
    flags: {},
    hovered: null,
    pendingAttack: null,
  };
}

function monter(mode: 'battle' | 'exploration', retouche: Record<string, unknown> = {}): HTMLDivElement {
  useGame.setState({ ...étatDe(mode), ...retouche } as never);
  viderCaptures();
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<MondeDeCampagne />));
  return conteneur;
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

/** Ce que le SVG monté par-dessus le monde peint encore de ces repères : RIEN — il porte seulement
 *  les overlays d'interaction. Mesuré pour que le retour d'une double peinture se voie. */
function comptesSvg(el: HTMLElement): Record<string, number> {
  const liens = [...el.querySelectorAll('svg.iso-stage line')].filter((l) => l.getAttribute('stroke') === ENGAGE_TINT);
  const contours = [...el.querySelectorAll('svg.iso-stage path')].filter(
    (p) => p.getAttribute('stroke') === ACTIVE_HALO_TINT && p.getAttribute('stroke-width') === '3',
  );
  const groupe = [...el.querySelectorAll('svg.iso-stage path')].filter(
    (p) => p.getAttribute('stroke') === ACTIVE_HALO_TINT && p.getAttribute('stroke-width') === '1.5',
  );
  const bagues = [...el.querySelectorAll('svg.iso-stage ellipse')].filter(
    (e) => e.getAttribute('fill') === 'none' && new Set<string>([...HERO_RING, ENEMY_RING]).has(e.getAttribute('stroke') ?? ''),
  );
  return { tether: liens.length, actif: contours.length, groupe: groupe.length, anneau: bagues.length };
}

/** Ce que la voie VOLUMIQUE a posé : le `count` des trois pools de marques de la dernière frame rendue
 *  (l'anneau d'équipe se compte à part — un anneau y vaut un chapelet de cordes, cf. `anneaux`). */
function comptesVolumiques(): Record<string, number> {
  const scene = scènes[scènes.length - 1];
  const out: Record<string, number> = { tether: 0, actif: 0, groupe: 0 };
  scene.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (!m.isInstancedMesh || !m.name.startsWith('marquesDyn:')) return;
    const slot = m.name.slice('marquesDyn:'.length);
    if (slot in out) out[slot] = m.count;
  });
  return out;
}

/** Anneaux d'équipe posés en volumique, RANGÉS PAR CENTRE : chaque corde est rattachée au jeton dont
 *  elle entoure les pieds (le plus proche), et l'on rend, par centre, le compte de cordes. Le rayon
 *  ATTENDU (mètres) est fourni par l'appelant — il vient de la FORMULE (`teamRingRadiusK`), jamais de
 *  la mesure : une corde s'y confronte, elle ne s'y résume pas. */
function anneaux(centres: { x: number; z: number; rM: number }[]): { cordes: number }[] {
  const p = poolsVolumiques().anneau;
  const lots = centres.map(() => ({ cordes: 0 }));
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    p.getMatrixAt(i, m);
    pos.setFromMatrixPosition(m);
    let meilleur = 0;
    let d = Infinity;
    centres.forEach((c, k) => {
      const dk = Math.hypot(pos.x - c.x, pos.z - c.z);
      if (dk < d) {
        d = dk;
        meilleur = k;
      }
    });
    lots[meilleur].cordes++;
    expect(d, 'chaque corde est sur le cercle ATTENDU de son jeton').toBeCloseTo(centres[meilleur].rM, 4);
  }
  return lots;
}

/** Les pools volumiques de la dernière frame, par slot. */
function poolsVolumiques(): Record<string, THREE.InstancedMesh> {
  const out: Record<string, THREE.InstancedMesh> = {};
  scènes[scènes.length - 1].traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (m.isInstancedMesh && m.name.startsWith('marquesDyn:')) out[m.name.slice('marquesDyn:'.length)] = m;
  });
  return out;
}

/** Nombre de tirets qu'un pointillé de LONGUEUR `len` peint : un tiret est peint dès que son début
 *  tombe avant la fin du segment (le dernier étant clippé) — la sémantique du `stroke-dasharray` que
 *  `dynamicMarkPose.tetherDashCount` reproduit dans le monde volumique. */
function tiretsAttendus(len: number): number {
  return len > 0 ? Math.max(1, Math.ceil(len / (TETHER_DASH_PX + TETHER_GAP_PX))) : 0;
}

/** Rayon MONDE (mètres) de l'anneau d'un jeton de combat, par la formule partagée. */
const rayonCombat = (c: Combatant, mpt: number) => teamRingRadiusK(COMBAT_TOKEN_BASE * combatantTokenScale(c)) * mpt;
/** Rayon MONDE (mètres) de l'anneau du jeton de GROUPE. */
const rayonGroupe = (mpt: number) => teamRingRadiusK(PARTY_TOKEN_BASE) * mpt;

/** Épaisseur du cadre (fraction de case) lue DANS la géométrie d'un pool de contour : le gabarit va de
 *  ±0,5 (bord externe) à ±(0,5 − k) (bord interne, cf. `highlightMeshes.tileFrameGeometry`). Un quad
 *  PLEIN n'a pas de bord interne : il n'a qu'une abscisse, et l'épaisseur y vaut la demi-case. */
function épaisseurCadre(mesh: THREE.InstancedMesh): number {
  const xs = [...new Set(Array.from(mesh.geometry.getAttribute('position').array as ArrayLike<number>).filter((_, i) => i % 3 === 0).map(Math.abs))].sort((a, b) => b - a);
  return xs.length === 1 ? xs[0] : xs[0] - xs[1];
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

afterEach(() => démonter());

describe('Marques dynamiques — le monde volumique pose les repères (#1176 P3-0d)', () => {
  it('en COMBAT : le lien d’engagement et le contour de l’actif sont posés, aucun repère de groupe', () => {
    monter('battle');
    const volumique = comptesVolumiques();
    expect(volumique.tether, 'le lien d’engagement n’est pas posé en volumique').toBeGreaterThan(0);
    expect(volumique.actif, 'un contour par case d’empreinte').toBe(1);
    expect(volumique.groupe, 'aucun repère de groupe en combat').toBe(0);
  });

  it('HORS COMBAT : le repère de position du groupe est posé, et rien du combat', () => {
    monter('exploration');
    expect(comptesVolumiques()).toEqual({ tether: 0, actif: 0, groupe: 1 });
  });

  it('les quatre pools sont montés d’emblée (plus le jumeau de silhouette) et portent la teinte du catalogue', () => {
    monter('battle');
    const scene = scènes[scènes.length - 1];
    const teintes = new Map<string, string>();
    scene.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (!m.isInstancedMesh || !m.name.startsWith('marquesDyn:')) return;
      teintes.set(m.name, `#${(m.material as THREE.MeshBasicMaterial).color.getHexString()}`);
      expect(m.count, 'un compte dessiné borné par la capacité du pool').toBeLessThanOrEqual(m.instanceMatrix.count);
    });
    // Cinq objets pour quatre pools : l'anneau d'équipe est rendu DEUX fois, la seconde à travers la
    // géométrie du monde (jumeau de silhouette, #1297 LOT A).
    expect([...teintes.keys()].sort()).toEqual([
      'marquesDyn:actif',
      'marquesDyn:anneau',
      'marquesDyn:anneau:silhouette',
      'marquesDyn:groupe',
      'marquesDyn:tether',
    ]);
    expect(teintes.get('marquesDyn:tether')).toBe(ENGAGE_TINT.toLowerCase());
    expect(teintes.get('marquesDyn:actif')).toBe(ACTIVE_HALO_TINT.toLowerCase());
    expect(teintes.get('marquesDyn:groupe')).toBe(ACTIVE_HALO_TINT.toLowerCase());
    // L'anneau d'équipe change de couleur d'un combattant à l'autre : son matériau reste NEUTRE et la
    // teinte voyage PAR INSTANCE (`instanceColor`), comme les marques de case. Le jumeau partage ce
    // buffer, donc son matériau est neutre pour la même raison.
    expect(teintes.get('marquesDyn:anneau')).toBe('#ffffff');
    expect(teintes.get('marquesDyn:anneau:silhouette')).toBe('#ffffff');
    expect(poolsVolumiques().anneau.instanceColor, 'l’anneau porte sa teinte par instance').toBeTruthy();
  });
});

describe('Marques dynamiques — ALLURE et EXCLUSIVITÉ (#1176 P3-0d)', () => {
  it('un lien d’UNE case : le chapelet volumique compte autant de tirets que le pointillé de la loi', () => {
    // h1 (3,3) et e1 (4,3) sont voisins d'EST en OUEST : le pas de case se projette sur 35,78 px.
    const tirets = tiretsAttendus(Math.hypot(TW / 2, TH / 2));
    expect(tirets).toBeGreaterThan(1);
    monter('battle');
    expect(comptesVolumiques().tether, 'même allure de pointillé que ce que la loi demande').toBe(tirets);
  });

  it('AUCUNE DOUBLE PEINTURE : le SVG posé par-dessus le monde ne peint aucun de ces repères', () => {
    monter('battle');
    expect(comptesSvg(conteneur!), 'le SVG ne doit peindre ni marques dynamiques ni anneaux d’équipe').toEqual({ tether: 0, actif: 0, groupe: 0, anneau: 0 });
    expect(comptesVolumiques().tether).toBeGreaterThan(0);
  });

  it('une empreinte 2×2 : quatre cases de contour BOUT À BOUT', () => {
    const gros = {
      ...combatEngagé(),
      combatants: [
        { ...hero('h1', { x: 3, y: 3 }), engagedWith: ['e1'], footprint: 2 },
        { ...hero('e1', { x: 5, y: 3 }), kind: 'enemy', engagedWith: ['h1'] },
      ],
    } as unknown as BattleState;
    monter('battle', { battle: gros });
    const p = poolsVolumiques();
    expect(p.actif.count).toBe(4);
    // BOUT À BOUT : quatre cases distinctes, chacune à l'échelle d'UNE case (aucun chevauchement).
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const coins = new Set<string>();
    let côté = 0;
    for (let i = 0; i < p.actif.count; i++) {
      p.actif.getMatrixAt(i, m);
      m.decompose(pos, q, s);
      coins.add(`${pos.x.toFixed(3)},${pos.z.toFixed(3)}`);
      côté = s.x;
    }
    expect(coins.size).toBe(4);
    const xs = [...coins].map((c) => Number(c.split(',')[0])).sort((a, b) => a - b);
    expect(xs[3] - xs[0], 'deux colonnes distantes d’UNE case').toBeCloseTo(côté, 5);
  });

  it('les trois pools portent chacun SA matière : deux épaisseurs de cadre, un quad plein, trois teintes', () => {
    monter('exploration');
    const p = poolsVolumiques();
    expect(épaisseurCadre(p.actif), 'contour d’actif : le cadre des anneaux').toBeCloseTo(RING_FRAME_K, 5);
    expect(épaisseurCadre(p.groupe), 'repère de groupe : la MOITIÉ (1,5 px contre 3 en trait)').toBeCloseTo(PARTY_FRAME_K, 5);
    expect(PARTY_FRAME_K).toBeCloseTo(RING_FRAME_K / 2, 12);
    // le lien n'est pas un cadre mais un quad PLEIN : aucun bord interne à mesurer
    expect(épaisseurCadre(p.tether)).toBe(0.5);
    const teinte = (m: THREE.InstancedMesh) => `#${(m.material as THREE.MeshBasicMaterial).color.getHexString()}`;
    expect([teinte(p.tether), teinte(p.actif), teinte(p.groupe)]).toEqual([
      ENGAGE_TINT.toLowerCase(), ACTIVE_HALO_TINT.toLowerCase(), ACTIVE_HALO_TINT.toLowerCase(),
    ]);
    const opacité = (m: THREE.InstancedMesh) => (m.material as THREE.MeshBasicMaterial).opacity;
    // Le LIEN est à PLEINE opacité côté volumique, là où le trait SVG le peignait à 0,6 : la scène y est
    // trois fois plus claire, et c'est l'effet PERÇU qui est mis en parité (`DYN_SLOT_OPACITY`).
    expect([opacité(p.tether), opacité(p.actif), opacité(p.groupe)]).toEqual([1, 1, 0.5]);
  });

  it('ANNEAUX D’ÉQUIPE : un par combattant posté, au rayon de la FORMULE et au pointillé de son équipe', () => {
    const scene = emptyScene(10, 10);
    const mpt = sceneMetresPerTile(scene);
    const combat = combatEngagé();
    const [h1, e1] = combat.combatants;
    monter('battle');
    // h1 (3,3) et e1 (4,3), à `mpt` mètres par case (`emptyScene` : la valeur par défaut).
    const rM = [rayonCombat(h1, mpt), rayonCombat(e1, mpt)];
    const lots = anneaux([{ x: 3 * mpt, z: 3 * mpt, rM: rM[0] }, { x: 4 * mpt, z: 3 * mpt, rM: rM[1] }]);
    expect(lots.map((l) => l.cordes > 0), 'CHAQUE jeton posté porte son anneau').toEqual([true, true]);
    lots.forEach((lot, i) => {
      // et le chapelet compte ce que le pointillé de CETTE équipe demande : plein pour le héros,
      // pointillé « 5 3 » pour l'ennemi (R9 : la FORME encode l'équipe).
      expect(lot.cordes).toBe(ringDashes(rM[i] / mpt, i === 0 ? null : dashPattern(teamShape(false)), 'iso').length);
    });
    // Le héros (trait PLEIN) porte STRICTEMENT plus de cordes que l'ennemi (pointillé) : la forme se voit.
    expect(lots[0].cordes).toBeGreaterThan(lots[1].cordes);
  });

  it('HORS COMBAT, le jeton de GROUPE porte lui aussi son anneau', () => {
    monter('exploration');
    const mpt = sceneMetresPerTile(emptyScene(10, 10));
    expect(anneaux([{ x: 6 * mpt, z: 6 * mpt, rM: rayonGroupe(mpt) }])[0].cordes).toBeGreaterThan(0);
  });

  it('un MENEUR non-héros ne teinte pas le jeton de groupe en ennemi', () => {
    // Le code de groupe s'en garde ailleurs (`state/partyFlow`), mais la DÉCORATION ne doit pas dépendre
    // de cette hypothèse : le jeton de groupe dit « le groupe est ici », pas « à quelle équipe ».
    const escorte = [{ ...hero('h1', { x: 6, y: 6 }), kind: 'npc' } as unknown as Combatant];
    monter('exploration', { party: escorte });
    const mpt = sceneMetresPerTile(emptyScene(10, 10));
    const rK = teamRingRadiusK(PARTY_TOKEN_BASE);
    const lot = anneaux([{ x: 6 * mpt, z: 6 * mpt, rM: rK * mpt }])[0];
    // trait PLEIN : un chapelet pointillé en compterait bien moins
    expect(lot.cordes).toBe(ringDashes(rK, null, 'iso').length);
    expect(lot.cordes).toBeGreaterThan(ringDashes(rK, dashPattern(teamShape(false)), 'iso').length);
    const teinte = new THREE.Color();
    poolsVolumiques().anneau.getColorAt(0, teinte);
    expect(`#${teinte.getHexString()}`).toBe(HERO_RING[0].toLowerCase());
  });

  it('un DIALOGUE ouvert coupe le repère du groupe', () => {
    monter('exploration', { dialogue: { id: 'd1' } });
    expect(comptesVolumiques()).toEqual({ tether: 0, actif: 0, groupe: 0 });
  });
});
