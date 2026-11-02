import type { JSX } from 'react';
// @vitest-environment jsdom
/**
 * BILLBOARDS EN PREMIÈRE PERSONNE (#1176) — l'art des quads suit enfin le regard de l'œil.
 * Trois faits, chacun réfutable seul :
 *
 *  1. la VUE d'un décor se prend au CAP Dir8 du meneur (branche `perspective` de `billboardView`),
 *     et à lui seul : un pivot redemande sa planche, une frame de marche ne la redemande PAS (le
 *     patron anti-recuisson qu'`artRot` documente pour la vue de plateau) ;
 *  2. le CRAN d'art des PROPS se dérive du même cap (`povArtRot`) — l'atlas de décor n'existe qu'aux
 *     quarts de tour, et sans cette dérivation les props gardent le cran de la dernière vue affine ;
 *  3. la RELATION entre les deux regards est MESURÉE : au cap qu'un cran affine regarde, la branche
 *     perspective rend exactement ce que rend `project(·, cran)` sur les huit orientations — c'est
 *     d'elle que `povYawDeg` tient son décalage de 45°.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../noyau/monde/scene';
import { DIR8_ORDER, type Dir8 } from '../../geometry/dir8';
import { createHero } from '../../engine/character';
import type { Rot } from '../../geometry/iso';
import type { BillboardPropEl } from '../builders/types';
import type { SceneBillboardEls, TintAt } from '../backends/webgl/sceneMeshes';
import { billboardView } from '../backends/webgl/billboardMath';
import { project, type View } from '../facing';
import { dir8Basis } from '../pov/camera';
import * as svgTexture from '../backends/webgl/svgTexture';
import { artRot, GameStage3D, setStageRendererFactory, type StageFrame } from './GameStage3D';
import { BancRenderer, brancherArdoise } from './banc-volumique';
import { povArtRot, povYawDeg } from './regard';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
const CRANS: Rot[] = [0, 1, 2, 3];

/** Le cap que la caméra AFFINE d'un cran regarde (la relation dont `povYawDeg` se dérive). */
const capDuCran = (rot: Rot): Dir8 => DIR8_ORDER[(7 + 2 * rot) % 8];

/** La vue perspective d'une entité vue depuis un cap donné — la branche que le lot branche. */
const vueDepuis = (cap: Dir8, ent: Dir8) => billboardView({ kind: 'perspective', ...dir8Basis(cap) }, ent);

describe('POV — la relation entre les deux regards (parité mesurée)', () => {
  it('au cap qu’un cran regarde, la branche perspective rend ce que rend `project` sur les 8 caps', () => {
    for (const rot of CRANS)
      for (const ent of DIR8_ORDER)
        expect(vueDepuis(capDuCran(rot), ent), `cran ${rot} / entité ${ent}`).toEqual(project(ent, rot));
  });

  it('`povYawDeg` place chaque cran à son lacet, et les huit caps tous les 45°', () => {
    for (const rot of CRANS) expect(povYawDeg(capDuCran(rot)), `cran ${rot}`).toBe(rot * 90);
    expect(DIR8_ORDER.map(povYawDeg)).toEqual([45, 90, 135, 180, 225, 270, 315, 0]);
  });

  it('`povArtRot` PLANCHÉRISE comme `artRot` : le cap d’un cran y reste, un cap cardinal prend le cran du dessous', () => {
    for (const rot of CRANS) expect(povArtRot(capDuCran(rot)), `cap ${capDuCran(rot)}`).toBe(rot);
    // Cardinaux (entre deux crans) : N→0, E→1, S→2, O→3.
    expect((['N', 'E', 'S', 'O'] as Dir8[]).map(povArtRot)).toEqual([0, 1, 2, 3]);
    // …et les huit caps couvrent bien les quatre crans (aucun cran figé).
    expect(new Set(DIR8_ORDER.map(povArtRot))).toEqual(new Set(CRANS));
  });
});

// ————————————————————————————————————————————————————————————————
// BANC DE MONTAGE — le vrai écran, ses clés de texture pour seule trace
// ————————————————————————————————————————————————————————————————

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

const SCENE: Scene = emptyScene('scene-test', 12, 12);
const MPT = sceneMetresPerTile(SCENE);
const TINT: TintAt = () => 1;
const KEEP = () => true;
const HÉROS = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });

/** Un décor orienté au cap SUD : sa clé de texture porte la vue et le cran d'atlas que l'écran choisit. */
const TONNEAU: BillboardPropEl = {
  kind: 'prop', source: 'entity', key: 'prop:tonneau', entId: 'tonneau', span: { w: 1, h: 1 }, ref: 'tonneau', facing: 'S',
  cell: { x: 6, y: 4, z: 0 }, foot: { offX: 0, offY: 0, scale: 1 },
  states: { visible: true },
};
const ELS: SceneBillboardEls = { props: [TONNEAU] };

/** Les clés de texture DEMANDÉES par le montage — la seule trace lisible de ce que l'écran peint. */
let clés: string[] = [];

/** Découpe une clé (`identity|view|mirror|px`) — l'identité d'un décor porte elle-même des `|`. */
function découper(clé: string): { identity: string; view: View; mirror: boolean } {
  const p = clé.split('|');
  return { identity: p.slice(0, -3).join('|'), view: p[p.length - 3] as View, mirror: p[p.length - 2] === 'm' };
}

const clésDe = (préfixe: string) => clés.filter((k) => k.startsWith(préfixe)).map(découper);

function monter(facing: Dir8, partyPos: { x: number; y: number }): Promise<void> {
  return monterCadre(cadrePov(facing, partyPos));
}

async function monterCadre(frame: StageFrame): Promise<void> {
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  await act(async () => { root!.render(écran(frame)); });
}

const cadrePov = (facing: Dir8, partyPos: { x: number; y: number }): StageFrame =>
  ({ mode: 'pov', partyPos, facing, indoor: false, cid: HÉROS.id });

/** Le cadre de PLATEAU au cran `rot` — l'autre branche de l'union, celle que le lot ne doit PAS avoir
 *  fait basculer dans le regard perspective. */
const cadreAffine = (rot: Rot): StageFrame =>
  ({ mode: 'plateau', dims: { ...SCENE.dimensions, rot, view: 'iso' }, cam: { x: 6, y: 6 }, zoom: 1 });

function écran(frame: StageFrame): JSX.Element {
  return (
    <GameStage3D lecture="jeu"
      scene={SCENE}
      mpt={MPT}
      frame={frame}
      tintAt={TINT}
      keepEl={KEEP}
      els={ELS}
      actors={[]}
      gameTime={720}
      lightLevel={1}
      lights={[]}
    />
  );
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(() => {
  clés = [];
  // La rasterisation elle-même n'a rien à dire ici (jsdom ne peint pas) : ce banc mesure les CLÉS
  // demandées, donc la vue et le cran que l'écran a choisis pour chaque sujet.
  vi.spyOn(svgTexture, 'getBillboardTexture').mockImplementation((clé) => {
    clés.push(clé);
    return Promise.resolve(new THREE.CanvasTexture(document.createElement('canvas')));
  });
});
afterEach(() => {
  démonter();
  vi.restoreAllMocks();
});

describe('POV — le CRAN d’art du décor suit le cap du meneur (#1176 P3-1b)', () => {
  it('le CRAN d’art des props suit le même cap — les quatre crans sont atteints', async () => {
    const crans = new Set<string>();
    for (const cap of DIR8_ORDER) {
      clés = [];
      await monter(cap, { x: 4, y: 6 });
      const prop = clésDe('prop:');
      // Le décor est texturé au regard de MONTAGE en PREMIER ; la pré-chauffe des deux caps voisins
      // suit dans la même passe (contrat dédié plus bas, #1373).
      expect(prop.length, `cap ${cap} : le décor doit être texturé`).toBeGreaterThan(0);
      // L'identité d'un décor porte sa SIGNATURE DE DESSIN depuis #1176 (`prop:<clé>|<modèle>`,
      // puis le cran d'art) : c'est le CRAN, seul, que cette garde épingle.
      expect(prop[0].identity, `cap ${cap}`).toBe(`prop:prop:tonneau|tonneau|${TONNEAU.facing}|${TONNEAU.foot.scale}|r${povArtRot(cap)}`);
      crans.add(prop[0].identity);
      démonter();
    }
    expect(crans.size, 'un cran figé n’en donnerait qu’un').toBe(4);
  });
});

describe('POV — la planche ne se recuit qu’au PIVOT (patron anti-recuisson d’`artRot`)', () => {
  it('une frame de marche (l’œil glisse, le cap tient) ne redemande AUCUNE texture ; un pivot, si', async () => {
    await monter('N', { x: 4, y: 6 });
    // MONTAGE : le décor à sa vue de cap, plus sa pré-chauffe aux deux caps voisins (#1373) — trois clés.
    expect(clés.length, 'le montage doit avoir texturé le décor, et réchauffé les deux caps voisins').toBe(3);
    const auMontage = clés.length;

    // MARCHE : la position de l'œil est CONTINUE (`anim.glide`), donc un nouvel objet `frame` par
    // frame — celui-ci ne doit rien recuire.
    for (const t of [0.1, 0.25, 0.5, 0.75, 1]) {
      act(() => root!.render(écran(cadrePov('N', { x: 4, y: 6 - t }))));
    }
    expect(clés.length, 'cinq frames de marche : aucune texture redemandée').toBe(auMontage);

    // PIVOT : le cap change d'un cran de 45° — l'art du décor se redemande AU NOUVEAU CAP, par la
    // REPOSE (#1373) et sans remontage.
    clés = [];
    await act(async () => { root!.render(écran(cadrePov('NE', { x: 4, y: 5 }))); });
    const vm = vueDepuis('NE', 'S');
    expect(clésDe('prop:'), 'le pivot doit redemander l’art du décor au cap d’arrivée')
      .toContainEqual({ identity: `prop:prop:tonneau|tonneau|${TONNEAU.facing}|${TONNEAU.foot.scale}|r${povArtRot('NE')}`, view: vm.view, mirror: vm.mirror });
  });
});

/**
 * PRÉ-CHAUFFE des caps VOISINS (#1373) — le temps mort réchauffe les DEUX caps à ±45° du cap courant,
 * et eux seuls : un demi-tour progressif passe par eux, et les huit caps d'un coup coûteraient huit
 * rasterisations par décor.
 *
 * Elle court au montage ET à chaque changement de cap : sans ce second passage, un demi-tour
 * (N→NE→E→SE) ne réchaufferait que les voisins du cap de DÉPART, et un cap sur deux serait froid.
 */
describe('POV — la pré-chauffe porte sur les deux caps VOISINS', () => {
  /** L'art d'un décor vu d'un cap — la forme que le banc lit dans les clés demandées. */
  const attendu = (cap: Dir8) => {
    const vm = vueDepuis(cap, 'S');
    return { identity: `prop:prop:tonneau|tonneau|${TONNEAU.facing}|${TONNEAU.foot.scale}|r${povArtRot(cap)}`, view: vm.view, mirror: vm.mirror };
  };

  it('au cap N, le décor demande son art au cap N, puis aux caps NE et NO — à eux seuls', async () => {
    await monter('N', { x: 4, y: 6 });
    // PRÉMISSE — trois regards indiscernables ne prouveraient rien de la pré-chauffe.
    expect(new Set((['N', 'NE', 'NO'] as Dir8[]).map((c) => JSON.stringify(attendu(c)))).size).toBe(3);
    expect(clésDe('prop:')).toEqual([attendu('N'), attendu('NE'), attendu('NO')]);
  });

  it('le cap CHANGÉ réchauffe à son tour : après N→NE, les caps E et N passent en file', async () => {
    await monter('N', { x: 4, y: 6 });
    clés = [];

    await act(async () => { root!.render(écran(cadrePov('NE', { x: 4, y: 5 }))); });

    // La RELÈVE du cap d'arrivée d'abord (elle prend le rang de la vue courante), les deux voisins du
    // NOUVEAU cap derrière — dont E, que le montage au cap N n'avait jamais demandé.
    expect(clésDe('prop:')).toEqual([attendu('NE'), attendu('E'), attendu('N')]);
  });
});

describe('PLATEAU — la vue affine garde son regard ORTHO (l’autre branche de `bbCam`)', () => {
  it('au cran `r`, le décor prend `project(·, r)` et le cran d’`artRot` — jamais un cap', async () => {
    for (const rot of CRANS) {
      clés = [];
      await monterCadre(cadreAffine(rot));
      const prop = clésDe('prop:');
      expect(prop.length, `cran ${rot} : le décor doit être texturé`).toBeGreaterThan(0);
      // Branche ORTHO de `billboardView` : la MÊME planche que la vue de plateau a toujours servie.
      expect({ view: prop[0].view, mirror: prop[0].mirror }, `cran ${rot}`).toEqual(project('S', rot));
      expect(prop[0].identity, `cran ${rot}`).toBe(`prop:prop:tonneau|tonneau|${TONNEAU.facing}|${TONNEAU.foot.scale}|r${artRot({ ...SCENE.dimensions, rot, view: 'iso' })}`);
      démonter();
    }
  });

  it('un cap DE SECOURS en vue de plateau (le regard perspective au lieu de l’ortho) se voit', () => {
    // La mutation que ce banc doit mordre : `povFacing` valant un cap au lieu de `null` hors POV
    // ferait passer la vue de plateau par la branche perspective. Elle rend une planche FIXE, là où
    // les quatre crans en donnent quatre — au moins trois désaccords sur les quatre.
    const secours = vueDepuis('N', 'S');
    const désaccords = CRANS.filter((rot) => {
      const attendu = project('S', rot);
      return attendu.view !== secours.view || attendu.mirror !== secours.mirror;
    });
    expect(désaccords.length, 'un cap figé serait indiscernable de l’ortho').toBeGreaterThanOrEqual(3);
  });
});
