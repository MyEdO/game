// @vitest-environment jsdom
/**
 * SONDE DE CORPS (#2198) : `__wfrp.corps` / `echantillonner('corps', id)` lisent l'image RENDUE par le
 * prédicat partagé (`corpsActeur.ts`), le banc aussi. Conformité de `ImageRendue` (écrite côté
 * `state/devtools.ts`), valeur ABSOLUE d'un corps par acteur sous le disque d'ombre de contact, mise en
 * selle et descente comprises, et parité sonde ↔ banc.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import { createHero } from '../../engine/character';
import type { Combatant, Weapon } from '../../engine/types';
import { buildApi } from '../../state/devtools';
import { idsDeLActeur, type ActorPose, type KeepEl, type SceneBillboardEls, type TintAt } from '../backends/webgl/sceneMeshes';
import { GameStage3D, setStageRendererFactory, type StageFrame, type StageWalkAnim } from './GameStage3D';
import { estCorps } from './corpsActeur';
import { BancRenderer, PLAFOND_ATTENTE_MS, brancherArdoise, corpsDessines, respirer, scènes, simulerRasterisation, viderCaptures, type Rasterisation } from './banc-volumique';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.setConfig({ testTimeout: PLAFOND_ATTENTE_MS + 10_000 });

const TAILLE = { w: 800, h: 600 };
const SCENE: Scene = emptyScene(12, 12);
const MPT = sceneMetresPerTile(SCENE);
const TINT: TintAt = () => 1;
const KEEP: KeepEl = () => true;
const ELS: SceneBillboardEls = { tokens: [], props: [] };
const CADRE: StageFrame = { mode: 'plateau', dims: { ...SCENE.dimensions, rot: 0, view: 'iso', yawDeg: 0 }, cam: { x: 6, y: 6 }, zoom: 1 };
/** Minuit : aucun soleil n'éclaire, le disque d'ombre de contact est posé (`wantsContactShadow`). */
const MINUIT = 0;

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;
let battre: (() => void) | null = null;
let ras!: Rasterisation;

brancherArdoise();

const anim: StageWalkAnim = {
  subscribe: (onFrame) => { battre = onFrame; return () => { battre = null; }; },
  glide: () => null,
  cam: () => ({ x: 6, y: 6 }),
};

const BASE = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 5 });
/** Le héros `h1` tenant l'arme `trappingId` du catalogue (#2113) : une arme neuve est un dessin neuf, donc une cuisson. */
function héros(trappingId: string): Combatant {
  const arme = ({ uid: 'w1', trappingId, label: 'Arme', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] } satisfies Partial<Weapon>) as Weapon;
  return { ...BASE, id: 'h1', weapons: [arme] } as Combatant;
}
const CHEVAL = {
  id: 'm1', label: 'Cheval', kind: 'enemy', creatureId: 'cheval', pos: { x: 5, y: 4 }, size: 'grande',
  conditions: [], wounds: { current: 10, max: 10 },
} as unknown as Combatant;
const àPied = (arme = 'dague'): ActorPose[] => [{ c: héros(arme), x: 4, y: 4, z: 0, facing: 'S' }, { c: CHEVAL, x: 5, y: 4, z: 0, facing: 'S' }];
const enSelle = (arme = 'dague'): ActorPose[] => [{ c: CHEVAL, rider: héros(arme), x: 5, y: 4, z: 0, facing: 'S' }];

function rendre(actors: ActorPose[]): void {
  act(() => {
    root!.render(
      <GameStage3D lecture="jeu" scene={SCENE} mpt={MPT} frame={CADRE} tintAt={TINT} keepEl={KEEP} els={ELS}
        actors={actors} gameTime={MINUIT} lightLevel={1} lights={[]} anim={anim} />,
    );
  });
}

async function toutServir(àChaqueTour?: () => void): Promise<void> {
  let vides = 0;
  for (let tour = 0; tour < 200 && vides < 2; tour++) {
    await respirer(20, () => battre?.());
    àChaqueTour?.();
    if (ras.enAttente.length === 0) { vides += 1; continue; }
    vides = 0;
    await act(async () => { ras.résoudreUne(); });
  }
}

/** Les disques d'ombre de contact de l'acteur `id` dans la dernière image (même identité, sans cadre). */
function disques(id: string): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  scènes[scènes.length - 1]?.traverse((o) => {
    if (!estCorps(o) && (o as THREE.Mesh).isMesh && idsDeLActeur(o.name).includes(id)) out.push(o as THREE.Mesh);
  });
  return out;
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(async () => {
  ras = simulerRasterisation('retenue');
  viderCaptures();
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  rendre(àPied());
  await toutServir();
});
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
  battre = null;
});

describe('décodeur d’identité d’acteur (`idsDeLActeur`)', () => {
  it('rend l’ensemble EXACT des ids : `h1` ≠ `h10`, et un couple monté rend ses deux ids', () => {
    expect(idsDeLActeur('acteur:h1|abc')).toEqual(['h1']);
    expect(idsDeLActeur('acteur:h10|abc')).not.toContain('h1');
    expect(idsDeLActeur('acteur:m1+h1|abc')).toEqual(['m1', 'h1']);
    expect(idsDeLActeur('decor:h1|abc')).toEqual([]);
  });
});

describe('__wfrp.corps — un corps visible par acteur, à chaque image rendue', () => {
  it('PRÉMISSE : le disque d’ombre de contact du héros est dans l’image', () => {
    expect(disques('h1').length).toBeGreaterThan(0);
  });

  // L'arrivée porte un dessin NEUF : sa cuisson court, et le sortant tient la case en sursis.
  const GESTES = [
    ['mise en selle', () => àPied(), () => enSelle('rapiere')],
    ['descente', () => enSelle(), () => àPied('fleau')],
  ] as const;
  for (const [geste, depart, arrivee] of GESTES) {
    it(`${geste} : 1 corps du héros et de la monture à chaque image, et la sonde égale le banc`, async () => {
      rendre(depart());
      await toutServir();
      const api = buildApi();
      api.echantillonner('corps', 'h1');
      const parite: string[] = [];
      const comptesMonture: number[] = [];
      rendre(arrivee());
      await respirer(40, () => battre?.());
      const cuissons = ras.enAttente.length;
      await toutServir(() => {
        if (api.corps('h1') !== corpsDessines('h1').length) parite.push(`${api.corps('h1')}≠${corpsDessines('h1').length}`);
        comptesMonture.push(corpsDessines('m1').length);
      });
      const echantillons = api.echantillons();
      expect(echantillons.length, 'PRÉMISSE : des images ont été rendues pendant le geste').toBeGreaterThan(1);
      expect(cuissons, 'PRÉMISSE : l’arrivée a cuit pendant le geste').toBeGreaterThan(0);
      expect(echantillons.map((e) => e.corps), `corps de h1 par image : ${JSON.stringify(echantillons)}`).toEqual(echantillons.map(() => 1));
      expect(new Set(echantillons.map((e) => e.image)).size, 'une entrée par image rendue').toBe(echantillons.length);
      expect(comptesMonture.every((n) => n === 1), `corps de m1 : ${comptesMonture.join(',')}`).toBe(true);
      expect(parite, 'sonde ↔ banc').toEqual([]);
      expect(api.echantillons(), 'le tampon relu est vidé').toEqual([]);
    });
  }
});
