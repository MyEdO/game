// @vitest-environment jsdom
/**
 * CÂBLAGE de la succession des corps (`successionDesCorps`, #2097, design n°11) dans `GameStage3D` :
 * l'identité d'un acteur change, le sortant reste à l'écran en sursis jusqu'au montage de l'entrant,
 * puis part avant sa première image. Un rejet de cuisson emporte le sortant. L'état d'un board vit sur le
 * board, celui d'un occupant sous son id espacé. Images RETENUES : le banc choisit l'instant de chaque
 * issue.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import { createHero } from '../../engine/character';
import type { Combatant, Weapon } from '../../engine/types';
import type { ActorPose, KeepEl, SceneBillboardEls, TintAt } from '../backends/webgl/sceneMeshes';
import { GameStage3D, setStageRendererFactory, type PercageEntrees, type StageFrame, type StageWalkAnim } from './GameStage3D';
import * as atlasBake from '../backends/webgl/atlasBake';
import * as spriteRaycast from '../backends/webgl/spriteRaycast';
import { targetUnderPointer } from './spritePicker';
import * as percageModule from './percage';
import { actorCapsuleOf } from './actorCapsule';
import { BancRenderer, PLAFOND_ATTENTE_MS, brancherArdoise, corpsDessines, quads, respirer, simulerRasterisation, viderCaptures, type Rasterisation } from './banc-volumique';
import { idsDeLActeur } from '../backends/webgl/sceneMeshes';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.setConfig({ testTimeout: PLAFOND_ATTENTE_MS + 10_000 });

const TAILLE = { w: 800, h: 600 };
const SCENE: Scene = emptyScene(12, 12);
const MPT = sceneMetresPerTile(SCENE);
const TINT: TintAt = () => 1;
const KEEP: KeepEl = () => true;
const ELS: SceneBillboardEls = { tokens: [], props: [] };
const CADRE: StageFrame = { mode: 'plateau', dims: { ...SCENE.dimensions, rot: 0, view: 'iso', yawDeg: 0 }, cam: { x: 6, y: 6 }, zoom: 1 };

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

/** Le même héros, tenant l'arme `trappingId` du catalogue : sa forme se résout au catalogue (#2113),
 *  changer d'arme change son dessin. */
const BASE = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 5 });
function héros(trappingId: string): Combatant {
  const arme = ({ uid: 'w1', trappingId, label: 'Arme', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] } satisfies Partial<Weapon>) as Weapon;
  return { ...BASE, id: 'h1', weapons: [arme] } as Combatant;
}
const pose = (c: Combatant): ActorPose[] => [{ c, x: 4, y: 4, z: 0, facing: 'S' }];

/** Monture réelle du bestiaire (id STABLE) et son cavalier `h1`. */
const CHEVAL = {
  id: 'm1', label: 'Cheval', kind: 'enemy', creatureId: 'cheval', pos: { x: 5, y: 4 }, size: 'grande',
  conditions: [], wounds: { current: 10, max: 10 },
} as unknown as Combatant;
const àPied = (): ActorPose[] => [{ c: héros('dague'), x: 4, y: 4, z: 0, facing: 'S' }, { c: CHEVAL, x: 5, y: 4, z: 0, facing: 'S' }];
const enSelle = (): ActorPose[] => [{ c: CHEVAL, rider: héros('dague'), x: 5, y: 4, z: 0, facing: 'S' }];

/** Épingles d'atlas posées au dernier appel (`setAtlasPins`) : les planches des boards montés. */
function dernièresÉpingles(espion: { mock: { calls: unknown[][] } }): Set<string> {
  const appels = espion.mock.calls;
  return new Set([...(appels[appels.length - 1]?.[0] as Iterable<string> ?? [])]);
}

/** Clé de planche des textures que le cache a servies (`getCachedAtlas`), par texture. */
function clésServies(espion: { mock: { calls: unknown[][]; results: { value: unknown }[] } }): Map<unknown, string> {
  const clés = new Map<unknown, string>();
  espion.mock.calls.forEach((appel, i) => {
    const servie = espion.mock.results[i]?.value as { texture?: unknown } | undefined;
    if (servie?.texture) clés.set(servie.texture, String(appel[0]));
  });
  return clés;
}

const COUPLE = 'acteur:m1+h1|';
const MONTURE_SEULE = 'acteur:m1|';

/** Planches de flipbook POSÉES sur le quad du couple (clés servies par le cache). */
function planchesDuCouple(espion: Parameters<typeof clésServies>[0]): string[] {
  const clés = clésServies(espion);
  return quads()
    .filter((m) => m.name.startsWith(COUPLE))
    .flatMap((m) => {
      const clé = clés.get((m.material as THREE.MeshBasicMaterial).map);
      return clé ? [clé] : [];
    });
}

function rendre(actors: ActorPose[], percage?: PercageEntrees): void {
  act(() => {
    root!.render(
      <GameStage3D lecture="jeu" scene={SCENE} mpt={MPT} frame={CADRE} tintAt={TINT} keepEl={KEEP} els={ELS}
        actors={actors} gameTime={720} lightLevel={1} lights={[]} anim={anim} percage={percage} />,
    );
  });
}

/** Corps VISIBLES de l'acteur `h1` (`corpsDeLActeur`). */
const corpsDeH1 = (): THREE.Mesh[] => corpsDessines('h1');

/** Sert toutes les images en vol, tour par tour, jusqu'à une file vide deux tours de suite. */
async function toutServir(àChaqueTour?: () => void): Promise<void> {
  let vides = 0;
  for (let tour = 0; tour < 200 && vides < 2; tour++) {
    await respirer(20, () => battre?.());
    if (ras.enAttente.length === 0) { vides += 1; continue; }
    vides = 0;
    await act(async () => { ras.résoudreUne(); });
    àChaqueTour?.();
  }
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
  rendre(pose(héros('dague')));
  await toutServir();
});
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
  battre = null;
});

describe('#2097 — identité d’acteur changée : un seul corps pendant la cuisson, et un rejet libère le sortant', () => {
  it('le sortant tient la case en sursis pendant la cuisson, et cède au montage de l’entrant', async () => {
    const [avant] = corpsDeH1();
    expect(avant, 'PRÉMISSE : le quad de l’acteur est monté').toBeDefined();

    rendre(pose(héros('rapiere')));
    await respirer(40, () => battre?.());
    expect(ras.enAttente.length, 'PRÉMISSE : la texture de l’entrant est en vol').toBeGreaterThan(0);
    expect(corpsDeH1().map((m) => m.name), 'pendant la cuisson, le sortant en sursis reste seul à l’écran').toEqual([avant.name]);

    const comptes: number[] = [];
    await toutServir(() => comptes.push(corpsDeH1().length));
    expect(comptes.every((n) => n === 1), `corps de l’acteur à chaque issue : ${comptes.join(',')}`).toBe(true);
    const après = corpsDeH1();
    expect(après.length).toBe(1);
    expect(après[0].name, 'l’entrant a remplacé le sortant').not.toBe(avant.name);
  });

  it('la texture de l’entrant rejetée emporte le sortant', async () => {
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    rendre(pose(héros('rapiere')));
    await respirer(40, () => battre?.());
    expect(ras.enAttente.length, 'PRÉMISSE : la texture de l’entrant est en vol').toBe(1);
    expect(corpsDeH1().length, 'PRÉMISSE : le sortant est en sursis').toBe(1);

    await act(async () => { ras.rejeterUne(); });
    await respirer(40, () => battre?.());

    expect(avertir, 'PRÉMISSE : le rejet a atteint le montage').toHaveBeenCalled();
    expect(quads().filter((m) => idsDeLActeur(m.name).includes('h1')), 'au rejet de l’entrant, le sortant en sursis est libéré').toEqual([]);
  });
});

describe('#2097 P2 — l’état d’un board vit sur le board : le couple ne lit que ce qu’il porte', () => {
  // Le couple composite n'a pas de couture de frame (`frameSvg`) : il ne joue aucun flipbook, et son
  // quad garde sa texture statique. Aucune planche d'un autre board ne doit y être posée.
  it('mise en selle : le quad du couple ne lit jamais la planche de la monture seule', async () => {
    const épingles = vi.spyOn(atlasBake, 'setAtlasPins');
    rendre(àPied());
    await toutServir();
    expect([...dernièresÉpingles(épingles)].some((k) => k.startsWith(MONTURE_SEULE)), 'PRÉMISSE : la monture seule joue des planches').toBe(true);
    const lues = vi.spyOn(atlasBake, 'getCachedAtlas');
    rendre(enSelle());
    const posées: string[] = [];
    await toutServir(() => posées.push(...planchesDuCouple(lues)));
    for (let i = 0; i < 10; i++) {
      await respirer(20, () => battre?.());
      posées.push(...planchesDuCouple(lues));
    }
    expect(quads().some((m) => m.visible && m.name.startsWith(COUPLE)), 'PRÉMISSE : le couple est à l’écran').toBe(true);
    expect(posées, 'le couple lit la planche d’un autre board').toEqual([]);
  });

  it('descente : le couple en sursis ne lit jamais la planche de la monture seule', async () => {
    rendre(àPied());
    await toutServir();
    rendre(enSelle());
    await toutServir();
    const lues = vi.spyOn(atlasBake, 'getCachedAtlas');
    // Un cavalier au dessin NEUF : sa cuisson court, la monture seule (au cache) se monte et attend
    // derrière le couple en sursis.
    rendre([{ c: héros('arme-simple'), x: 4, y: 4, z: 0, facing: 'S' }, àPied()[1]]);
    const posées: string[] = [];
    let coexistence = false;
    const observer = (): void => {
      posées.push(...planchesDuCouple(lues));
      const noms = quads().map((m) => m.name);
      if (noms.some((n) => n.startsWith(COUPLE)) && noms.some((n) => n.startsWith(MONTURE_SEULE))) coexistence = true;
    };
    for (let i = 0; i < 5; i++) {
      await respirer(20, () => battre?.());
      observer();
    }
    await toutServir(observer);
    expect(coexistence, 'PRÉMISSE : la monture seule est montée pendant que le couple est en sursis').toBe(true);
    expect(posées, 'le couple en sursis lit la planche d’un autre board').toEqual([]);
  });

  it('un board libéré emporte ses épingles : à la mise en selle, celles des deux corps à pied partent', async () => {
    const espion = vi.spyOn(atlasBake, 'setAtlasPins');
    rendre(àPied());
    await toutServir();
    const avant = [...dernièresÉpingles(espion)];
    expect(avant.some((k) => k.startsWith('acteur:h1|')) && avant.some((k) => k.startsWith(MONTURE_SEULE)), 'PRÉMISSE : les deux corps à pied tiennent des planches').toBe(true);
    rendre(enSelle());
    await toutServir();
    expect([...dernièresÉpingles(espion)].filter((k) => k.startsWith('acteur:h1|') || k.startsWith(MONTURE_SEULE)), 'un board libéré garde ses épingles').toEqual([]);
  });
});

describe('#2097 P3 — le perçage trouve l’occupant sur le board VISIBLE qui le couvre', () => {
  it('un héros CAVALIER est percé', async () => {
    act(() => root!.unmount());
    const créer = percageModule.creerPercage;
    const verdicts: { cle: string; acteurs: number }[] = [];
    vi.spyOn(percageModule, 'creerPercage').mockImplementation(() => {
      const découpe = créer();
      const majVerdict = découpe.majVerdict.bind(découpe);
      découpe.majVerdict = (e) => {
        verdicts.push({ cle: e.cle, acteurs: e.acteurs.length });
        return majVerdict(e);
      };
      return découpe;
    });
    root = createRoot(hôte!);
    const perçage: PercageEntrees = { cle: 'banc', lids: [], heros: [{ cid: 'h1', capsule: actorCapsuleOf({ x: 5, y: 4, h: 0 }, CADRE.dims), z: 0 }] };
    rendre(enSelle(), perçage);
    await toutServir();
    await respirer(40, () => battre?.());
    expect(quads().some((m) => m.visible && m.name.startsWith(COUPLE)), 'PRÉMISSE : le couple est à l’écran').toBe(true);
    const dernier = verdicts[verdicts.length - 1];
    expect(dernier, 'PRÉMISSE : le perçage a rendu un verdict').toBeDefined();
    expect(dernier.acteurs, 'le cavalier n’est pas percé').toBe(1);
    expect(dernier.cle).toBe('banc@h1|');
  });
});

describe('#2097 C3 — le pointeur ne voit que les boards VISIBLES', () => {
  it('descente : l’entrant masqué n’est pas une cible', async () => {
    rendre(enSelle());
    await toutServir();
    // Un cavalier au dessin NEUF : sa texture n'est pas au cache, sa cuisson court après le montage de
    // la monture — qui attend, masquée, derrière le couple en sursis.
    rendre([{ c: héros('fleau'), x: 4, y: 4, z: 0, facing: 'S' }, àPied()[1]]);
    for (let tour = 0; tour < 100 && !quads().some((m) => !m.visible); tour++) {
      await respirer(20, () => battre?.());
      if (ras.enAttente.length) await act(async () => { ras.résoudreUne(); });
    }
    const masqués = quads().filter((m) => !m.visible);
    expect(masqués.length, 'PRÉMISSE : un entrant monté attend, masqué').toBeGreaterThan(0);

    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
    const pointage = vi.spyOn(spriteRaycast, 'pickNearestTarget').mockReturnValue(null);
    targetUnderPointer(400, 300);
    const cibles = pointage.mock.calls[0]?.[1];
    expect(cibles, 'PRÉMISSE : le pointeur a interrogé ses cibles').toBeDefined();
    expect(cibles!.filter((c) => masqués.includes(c.object as THREE.Mesh)), 'un board masqué est pointable').toEqual([]);
  });
});
