// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGame } from '../../state/store';
import type { BattleState } from '../../noyau/etat';
import { emptyScene } from '../../noyau/monde/scene';
import type { Combatant } from '../../engine/types';
import { MondeDeCampagne } from './MondeDeCampagne';
import { setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise, scènes, viderCaptures } from './banc-volumique';
import { HIGHLIGHT_SLOTS, SLOT_OPACITY, type HighlightSlot } from '../backends/webgl/highlightMeshes';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

/**
 * MARQUES DE CASES posées par le monde volumique (#1176, P3-0c) — la population, nature par nature.
 * Le monde part du builder pur (`builders/highlights`) sur la vue assemblée
 * (`stage/highlightLayer.combatHighlightsView`) : ce que cette sonde mesure, c'est qu'il la CONSOMME
 * bien, et jusqu'au bout (pools montés, instances écrites, comptes dessinés).
 *
 * ORACLE FIGÉ (C5a). Le second terme était la voie AFFINE, montée sur le même état et comptée dans le
 * DOM (un `<path>` par élément, nature déduite de son couple teinte × opacité) ; elle est morte avec
 * la voie de jeu SVG. Les comptes ci-dessous sont ceux que l'égalité `volumique == affine` tenait
 * VERTE sur l'arbre d'avant le retrait (mesurés au même banc, mêmes témoins, 2026-08-14) : ils gardent
 * la population exacte, y compris ce qui ne doit PAS être peint.
 *
 * DEUX combats témoins, parce que les NEUF natures ne coexistent pas : les anneaux de cible demandent
 * un tour disponible SANS attaque en cours, tandis que l'anneau « tirer dans le tas » demande un
 * `pendingAttack.intoCrowd` — lequel éteint justement les anneaux de cible (`combatHighlightsView`).
 * Leur RÉUNION couvre les neuf slots, et la sonde le vérifie.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };

/** Arc de Portée 4 m : bandes de Bout Portant à Extrême sur 6 cases (1 case = 2 m). */
const ARC = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 4, qualities: [] };

function hero(id: string, pos: { x: number; y: number }, weapons: unknown[] = []): Combatant {
  return blessuresSurLeProfil({
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: blessuresDeBase(12), weapons,
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  }) as unknown as Combatant;
}

function ennemi(id: string, pos: { x: number; y: number }): Combatant {
  return { ...hero(id, pos), kind: 'enemy' } as unknown as Combatant;
}

/**
 * Le combat témoin : un actif héros ARCHER (teinte active, bandes de portée au survol, anneau sur sa
 * cible), deux ennemis dont un COLLÉ au premier (le voisinage qu'éclaire « tirer dans le tas »), une
 * zone de fumée et une zone de feu, et un tour ENTIER devant soi (`acted: false`, `reachable` vide) :
 * la Marche et la Course se dérivent alors du Mouvement (`computeMoveReach` / `computeRunReach`).
 */
function combatTémoin(over: Partial<BattleState> = {}): BattleState {
  return {
    combatants: [hero('h1', { x: 3, y: 3 }, [ARC]), ennemi('e1', { x: 5, y: 3 }), ennemi('e2', { x: 5, y: 4 })],
    order: ['h1', 'e1', 'e2'],
    turn: 0,
    round: 1,
    over: false,
    action: null,
    acted: false,
    movementUsed: 0,
    preview: null,
    reachable: new Map<string, number>(),
    zones: [
      { id: 'z1', blocksLoS: true, tiles: [{ x: 1, y: 1 }, { x: 1, y: 2 }] },
      { id: 'z2', blocksLoS: false, tiles: [{ x: 8, y: 8 }] },
    ],
    log: [],
    ...over,
  } as unknown as BattleState;
}

/** L'état de store qui arme « tirer dans le tas » : l'anneau de foule remplace les anneaux de cible. */
const TIR_DANS_LE_TAS = { pendingAttack: { attackerId: 'h1', targetId: 'e1', intoCrowd: true } };

/** L'état de store qui arme l'INTENTION de Charge (spec HUD zone 4) : la portée de Charge (M×2 cases)
 *  se peint EN PLUS des portées permanentes — c'est la réponse à « connaître la distance ». */
const INTENTION_CHARGE = { localIntent: { actionId: 'charge' } };

/** L'état de store qui arme l'INTENTION de Course : depuis la spec § ARBITRAGE 2026-08-19, c'est LUI
 *  — et lui seul — qui allume la zone de Course du champ (nature `run`). */
const INTENTION_COURSE = { localIntent: { actionId: 'course' } };

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

function monter(extra: Record<string, unknown> = {}): HTMLDivElement {
  useGame.setState({
    scene: emptyScene('scene-test', 10, 10),
    mode: 'battle',
    partyPos: { x: 3, y: 3 },
    party: [hero('h1', { x: 3, y: 3 }, [ARC])],
    battle: combatTémoin(),
    dialogue: null,
    flags: {},
    hovered: null, // le survol du tireur se pose APRÈS le montage (cf. plus bas)
    pendingAttack: null,
    ...extra,
  } as never);
  viderCaptures();
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<MondeDeCampagne />));
  // SURVOL POSÉ APRÈS LE MONTAGE (#1411, P0-A) : c'est ainsi qu'il arrive dans la partie — la souris
  // passe sur un tireur d'un écran déjà là. Le poser dans l'état de départ aurait mesuré un montage,
  // et laissait donc passer un survol que l'écran n'apprend jamais (même classe de défaut que
  // l'intention armée). Les oracles ci-dessous sont inchangés : la population est la même, c'est le
  // CHEMIN qui est désormais celui du jeu.
  act(() => { useGame.getState().setHovered('h1'); });
  return conteneur;
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

/** Comptes VOLUMIQUES par nature — mesurés sur les pools de la dernière scène three rendue. */
function comptesVolumiques(): Record<string, number> {
  const scene = scènes[scènes.length - 1];
  const out: Record<string, number> = {};
  scene.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (!m.isInstancedMesh || !m.name.startsWith('marques:')) return;
    const slot = m.name.slice('marques:'.length);
    if (m.count > 0) out[slot] = (out[slot] ?? 0) + m.count;
  });
  return out;
}

/**
 * L'ORACLE, nature par nature — ce que la voie affine peignait sur ces témoins, et que le monde
 * volumique posait à l'identique (mesuré à l'arbre d'avant le retrait de l'affine, 2026-08-14).
 * Une case de marche gagnée ou perdue, une bande de portée qui change de largeur, un anneau qui
 * disparaît : tout se voit ici.
 *
 * Tour ordinaire : « par défaut seule la zone de déplacement est affichée » (spec HUD § ARBITRAGE,
 * `docs/plans/2026-08-16-spec-hud-combat.md`, 2026-08-19). La zone de COURSE (`run`, 36 cases sur ce
 * témoin) ne se peint que sous l'intention de Course : 4ᵉ témoin ci-dessous.
 */
const ORACLE_NEUTRE: Record<string, number> = {
  walk: 62, rangeBand: 100, team: 2, teamActive: 1, zoneSmoke: 2, zoneFire: 1, ringContour: 2,
};
const ORACLE_FOULE: Record<string, number> = {
  walk: 62, rangeBand: 100, team: 2, teamActive: 1, zoneSmoke: 2, zoneFire: 1, ringCrowd: 2,
};
/** 3ᵉ témoin (lot intentions) : Charge ARMÉE depuis la console. Mouvement 4, aucun Trait de Course →
 *  portée de Charge = `chargeReach(4)` = 8 cases, qui couvre toute la carte 10×10 depuis (3,3) sauf
 *  les deux cases occupées par les ennemis : 98 marques `intent`, EN PLUS des portées permanentes
 *  (le joueur voit la Charge par-dessus sa Marche, pas à sa place). Le reste est l'oracle neutre. */
const ORACLE_INTENTION: Record<string, number> = { ...ORACLE_NEUTRE, intent: 98 };
/** 4ᵉ témoin (spec § 2026-08-19) : Course ARMÉE. Sa zone se peint en nature `run` — 36 cases sur ce
 *  témoin — et RIEN en `intent` : cette intention
 *  délègue son affichage au champ au lieu d'écrire deux fois la même vérité. */
const ORACLE_COURSE: Record<string, number> = { ...ORACLE_NEUTRE, run: 36 };

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

afterEach(() => {
  démonter();
});

describe('Marques de cases — le monde volumique pose la population entière (#1176 P3-0c)', () => {
  it('les QUATRE combats témoins portent bien TOUTES les natures (sinon la sonde ne pèse rien)', () => {
    // La RÉUNION des témoins couvre tous les slots : c'est ce qui rend la mesure non vide.
    expect(new Set([...Object.keys(ORACLE_NEUTRE), ...Object.keys(ORACLE_FOULE), ...Object.keys(ORACLE_INTENTION), ...Object.keys(ORACLE_COURSE)])).toEqual(new Set(HIGHLIGHT_SLOTS));
    expect(ORACLE_NEUTRE.intent, 'un tour neutre n’arme AUCUNE intention').toBeUndefined();
    expect(ORACLE_NEUTRE.run, 'un tour neutre ne peint PAS la zone de Course (spec § 2026-08-19)').toBeUndefined();
    expect(ORACLE_COURSE.intent, 'la Course armée peint sa zone en nature `run`, jamais une 2ᵉ fois en `intent`').toBeUndefined();
    expect(ORACLE_NEUTRE.ringCrowd, 'un tour neutre n’arme PAS le tir dans le tas').toBeUndefined();
    expect(ORACLE_FOULE.ringContour, 'un tir dans le tas éteint les anneaux de cible').toBeUndefined();
  });

  it('nature par nature, le volumique pose exactement l’oracle (tour neutre)', () => {
    monter();
    expect(comptesVolumiques()).toEqual(ORACLE_NEUTRE);
  });

  it('nature par nature, le volumique pose exactement l’oracle (tirer dans le tas)', () => {
    monter(TIR_DANS_LE_TAS);
    expect(comptesVolumiques()).toEqual(ORACLE_FOULE);
  });

  it('nature par nature, le volumique pose exactement l’oracle (INTENTION de Charge armée)', () => {
    monter(INTENTION_CHARGE);
    expect(comptesVolumiques()).toEqual(ORACLE_INTENTION);
  });

  it('nature par nature, le volumique pose exactement l’oracle (INTENTION de Course armée)', () => {
    monter(INTENTION_COURSE);
    expect(comptesVolumiques()).toEqual(ORACLE_COURSE);
  });

  it('en volumique, chaque pool monté porte l’opacité de sa nature et un `count` borné par sa capacité', () => {
    monter();
    const scene = scènes[scènes.length - 1];
    let pools = 0;
    scene.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (!m.isInstancedMesh || !m.name.startsWith('marques:')) return;
      pools++;
      const slot = m.name.slice('marques:'.length) as HighlightSlot;
      expect(HIGHLIGHT_SLOTS).toContain(slot);
      expect((m.material as THREE.MeshBasicMaterial).opacity).toBe(SLOT_OPACITY[slot]);
      expect(m.count).toBeLessThanOrEqual(m.instanceMatrix.count);
    });
    expect(pools).toBeGreaterThan(0);
  });
});
