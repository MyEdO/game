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

/**
 * MARQUES DE CASES — ÉCRITURE EN PLACE (#1176, P3-0c). La parité (`marques-parite.test.tsx`) mesure la
 * POPULATION peinte ; celle-ci mesure le COÛT du pas : un pool d'instances naît une fois et se réécrit,
 * il ne se démonte pas à chaque événement de combat. Trois faits, mesurés sur la scène three réellement
 * rendue et sur les appels à `InstancedMesh.setMatrixAt` des seuls pools `marques:*` :
 *  - un PAS de l'actif (la portée de Marche change, même palier de capacité) garde l'IDENTITÉ des pools
 *    (`uuid`) ET leur TAMPON (`instanceMatrix.array`) — rien n'est réalloué ;
 *  - ce pas réécrit bien des instances (sinon « en place » signifierait « rien ne s'affiche ») ;
 *  - une mise à jour SANS RAPPORT (survol d'un combattant qui ne porte aucune marque) n'écrit RIEN.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: {}, advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

/** Témoin SANS arme à distance : le survol n'a alors aucune incidence sur les marques (pas de bande de
 *  portée), ce qui en fait la mise à jour « sans rapport » du troisième fait. */
function combatTémoin(reach: [string, number][]): BattleState {
  return {
    combatants: [hero('h1', { x: 3, y: 3 }), { ...hero('e1', { x: 6, y: 6 }), kind: 'enemy' }],
    order: ['h1', 'e1'],
    turn: 0,
    round: 1,
    over: false,
    action: null,
    acted: true, // aucun anneau d'attaque : ce banc mesure le coût d'écriture, pas l'éligibilité
    movementUsed: 0,
    preview: null,
    reachable: new Map(reach),
    zones: [{ id: 'z1', blocksLoS: true, tiles: [{ x: 1, y: 1 }] }],
    log: [],
  } as unknown as BattleState;
}

const PAS_AVANT: [string, number][] = [['4,3', 1], ['5,3', 2], ['3,4', 1], ['4,4', 2]];
const PAS_APRÈS: [string, number][] = [...PAS_AVANT, ['2,3', 1]];

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

/** État d'un pool tel que le mesure ce banc : identité, tampon, compte dessiné. */
interface ÉtatPool { uuid: string; tampon: ArrayLike<number>; count: number }

function pools(): Map<string, ÉtatPool> {
  const scene = scènes[scènes.length - 1];
  const out = new Map<string, ÉtatPool>();
  scene.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (!m.isInstancedMesh || !m.name.startsWith('marques:')) return;
    out.set(m.name, { uuid: m.uuid, tampon: m.instanceMatrix.array, count: m.count });
  });
  return out;
}

/** Compteur d'écritures d'instances, borné aux pools de marques. */
function espionnerÉcritures(): { noms: string[]; rendre: () => void } {
  const noms: string[] = [];
  const vrai = THREE.InstancedMesh.prototype.setMatrixAt;
  THREE.InstancedMesh.prototype.setMatrixAt = function (this: THREE.InstancedMesh, i: number, m: THREE.Matrix4) {
    if (this.name?.startsWith('marques:')) noms.push(this.name);
    return vrai.call(this, i, m);
  };
  return { noms, rendre: () => { THREE.InstancedMesh.prototype.setMatrixAt = vrai; } };
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

describe('Marques de cases — le pas ne remonte AUCUN pool (#1176 P3-0c)', () => {
  it('un PAS réécrit les instances en place : mêmes pools, même tampon, comptes à jour', () => {
    const espion = espionnerÉcritures();
    try {
      useGame.setState({
        scene: emptyScene(10, 10), mode: 'battle', partyPos: { x: 3, y: 3 },
        party: [hero('h1', { x: 3, y: 3 })], battle: combatTémoin(PAS_AVANT),
        dialogue: null, flags: {}, hovered: null,
      } as never);
      viderCaptures();
      conteneur = document.createElement('div');
      document.body.appendChild(conteneur);
      root = createRoot(conteneur);
      act(() => root!.render(<MondeDeCampagne />));

      const avant = pools();
      expect(avant.get('marques:walk')?.count, 'le témoin doit VRAIMENT peindre une portée').toBe(4);
      expect(avant.get('marques:zoneSmoke')?.count).toBe(1);
      expect(espion.noms.length, 'le montage écrit les instances qu’il vient d’allouer').toBeGreaterThan(0);

      // PAS de l'actif : une case de plus dans la portée (même palier de capacité, 32).
      const écritesAvantLePas = espion.noms.length;
      act(() => { useGame.setState({ battle: combatTémoin(PAS_APRÈS) } as never); });
      const après = pools();
      expect(après.get('marques:walk')?.count, 'la marque neuve est bien dessinée').toBe(5);
      for (const [nom, état] of avant) {
        expect(après.get(nom)?.uuid, `pool ${nom} REMONTÉ par un simple pas`).toBe(état.uuid);
        expect(après.get(nom)?.tampon, `tampon de ${nom} RÉALLOUÉ par un simple pas`).toBe(état.tampon);
      }
      expect(espion.noms.length - écritesAvantLePas, 'un pas doit RÉÉCRIRE les instances').toBeGreaterThan(0);
      expect(espion.noms.slice(écritesAvantLePas)).toContain('marques:walk');

      // Mise à jour SANS RAPPORT : le survol d'un combattant qui ne porte aucune marque.
      const écritesAvantSurvol = espion.noms.length;
      act(() => { useGame.setState({ hovered: 'e1' } as never); });
      expect(espion.noms.length - écritesAvantSurvol, 'un survol sans rapport ne doit RIEN réécrire').toBe(0);
      for (const [nom, état] of avant) expect(pools().get(nom)?.uuid).toBe(état.uuid);
    } finally {
      espion.rendre();
    }
  });
});
