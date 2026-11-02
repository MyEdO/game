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
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

/**
 * LES MARQUES DE CASES SUIVENT LE STORE SUR UN ÉCRAN DÉJÀ MONTÉ (#1411, P0-A).
 *
 * `marques-parite` mesure la POPULATION des marques ; cette sonde-ci mesure leur VIVACITÉ. Le monde
 * volumique memoïse ses marques sur le CONTEXTE que l'hôte lui passe (`HighlightOpts`) : toute vérité
 * qui les nourrit sans vivre dans `battle` doit y entrer, sinon elle n'est lue qu'au MONTAGE, et
 * l'écran ment jusqu'au prochain changement de `battle`. Les deux vérités concernées :
 *  - l'INTENTION armée (`store.localIntent`) → marques `intent` (défaut de recette 2026-08-19) ;
 *  - le SURVOL d'un tireur (`store.hovered`) → marques `rangeBand` (même classe de défaut).
 * Le verrou est le MEMO, pas le rendu : forcer un re-rendu ne les ferait pas apparaître.
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

function combatTémoin(): BattleState {
  return {
    combatants: [hero('h1', { x: 3, y: 3 }, [ARC]), ennemi('e1', { x: 5, y: 3 }), ennemi('e2', { x: 5, y: 4 })],
    order: ['h1', 'e1', 'e2'],
    turn: 0, round: 1, over: false, action: null, acted: false, movementUsed: 0, preview: null,
    reachable: new Map<string, number>(), zones: [], log: [],
  } as unknown as BattleState;
}

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

/** Monte l'écran sur un état NEUTRE : rien d'armé, personne de survolé. */
function monter(): void {
  useGame.setState({
    scene: emptyScene('scene-test', 10, 10),
    mode: 'battle',
    partyPos: { x: 3, y: 3 },
    party: [hero('h1', { x: 3, y: 3 }, [ARC])],
    battle: combatTémoin(),
    dialogue: null,
    flags: {},
    hovered: null,
    pendingAttack: null,
    localIntent: null,
  } as never);
  viderCaptures();
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<MondeDeCampagne />));
}

/** Instances d'une NATURE de marque posées dans la DERNIÈRE scène rendue. */
function marques(slot: string): number {
  const scene = scènes[scènes.length - 1];
  let n = 0;
  scene.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (m.isInstancedMesh && m.name === `marques:${slot}`) n += m.count;
  });
  return n;
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
});

describe('Marques de cases — l’écran DÉJÀ MONTÉ suit le store (#1411 P0-A)', () => {
  it('INTENTION : armer peint N > 0 cellules `intent`, désarmer les retire', () => {
    monter();
    expect(marques('intent'), 'aucune intention armée au montage').toBe(0);
    act(() => { useGame.getState().battleArmIntent('charge'); });
    expect(useGame.getState().localIntent, 'l’intention n’est même pas armée').toEqual({ actionId: 'charge' });
    expect(marques('intent'), 'l’armement n’a peint AUCUNE case : la portée reste invisible').toBeGreaterThan(0);
    act(() => { useGame.getState().battleArmIntent(null); });
    expect(useGame.getState().localIntent).toBeNull();
    expect(marques('intent'), 'le désarmement laisse la portée à l’écran').toBe(0);
  });

  it('SURVOL : survoler un tireur peint N > 0 bandes de portée, le quitter les retire', () => {
    monter();
    expect(marques('rangeBand'), 'personne n’est survolé au montage').toBe(0);
    act(() => { useGame.getState().setHovered('h1'); });
    expect(useGame.getState().hovered).toBe('h1');
    expect(marques('rangeBand'), 'le survol du tireur n’a peint AUCUNE bande de portée').toBeGreaterThan(0);
    act(() => { useGame.getState().setHovered(null); });
    expect(marques('rangeBand'), 'les bandes de portée survivent au survol').toBe(0);
  });
});
