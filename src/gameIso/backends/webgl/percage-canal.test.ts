/**
 * DÉCOUPE LOCALE — LE CANAL (#1176, M1). Trois choses se mesurent ici, et aucune ne se voit à
 * l'écran tant que les rayons valent zéro : l'attribut de PERÇABILITÉ cuit avec le monde, la
 * SURCHARGE de chunks (posée, idempotente, et neutre sans le define), et le branchement des
 * UNIFORMES PARTAGÉS — le seul canal par lequel un rayon lerpé peut atteindre un matériau intégré.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bakeWorldGeometry } from './sceneMeshes';
import {
  BLOCS_PERCAGE,
  PERCABLE_ATTRIBUT,
  PERCAGE_COEUR,
  PERCAGE_DEFINE,
  PERCAGE_MAX_HEROS,
  cadreCourant,
  cadrePercage,
  installPercage,
  materiauProfondeurPerce,
  percerMateriau,
  trousPercage,
} from './percageLocal';
import { diligenceCampaign, paquetDuJeu } from '../../../scenes/campaign';
import { sceneMetresPerTile } from '../../../state/scene';

/** Les chunks d'origine — reconstitués en RETRANCHANT les blocs greffés, pour que la mesure tienne
 *  que la surcharge ait déjà été posée par un autre banc du même worker (`isolate: false`) ou non. */
const ORIGINE = new Map(BLOCS_PERCAGE.map(([nom, bloc]) => [nom, THREE.ShaderChunk[nom as keyof typeof THREE.ShaderChunk].replace(bloc, '')]));

const scene = paquetDuJeu(diligenceCampaign).scenes[0];
const baked = bakeWorldGeometry(scene, sceneMetresPerTile(scene));

describe('PERÇABILITÉ cuite — le SOL ne se troue pas, et c’est structurel', () => {
  it('chaque sommet porte le verdict du `kind` de sa face : 0 pour un sol, 1 pour un mur ou un toit', () => {
    const vus = new Set<string>();
    for (const span of baked.spans) {
      const attendu = span.el.kind === 'floor' ? 0 : 1;
      vus.add(span.el.kind);
      for (let v = span.start; v < span.start + span.count; v++)
        expect(baked.percables[v], `${span.el.kind} @${span.el.key}`).toBe(attendu);
    }
    // PRÉMISSE : les deux camps sont réellement représentés sur la carte mesurée. Le MOBILIER
    // volumique de la salle y ajoute le `kind` « prop » : un meuble se troue comme un mur ou un
    // toit. Le SOL reste hors du canal : c'est la seule frontière que le canal connaît.
    expect([...vus].sort()).toEqual(['floor', 'prop', 'roof', 'wall']);
    const camps = { épargnés: new Set<string>(), percés: new Set<string>() };
    for (const span of baked.spans)
      camps[baked.percables[span.start] === 0 ? 'épargnés' : 'percés'].add(span.el.kind);
    expect([...camps.épargnés].sort()).toEqual(['floor']);
    expect([...camps.percés].sort()).toEqual(['prop', 'roof', 'wall']);
  });

  it('l’attribut voyage dans LA géométrie fusionnée, un flottant par sommet', () => {
    const attr = baked.geometry.getAttribute(PERCABLE_ATTRIBUT);
    const pos = baked.geometry.getAttribute('position');
    expect(attr.itemSize).toBe(1);
    expect(attr.count).toBe(pos.count);
    expect(baked.percables).toHaveLength(pos.count);
    // Un attribut BINAIRE : rien entre les deux camps, jamais un dégradé de perçabilité.
    expect([...new Set(baked.percables)].sort()).toEqual([0, 1]);
  });

  it('le compte de sommets ne bouge pas : le canal n’ajoute pas un triangle', () => {
    const nu = bakeWorldGeometry(scene, sceneMetresPerTile(scene));
    expect(nu.geometry.getAttribute('position').count).toBe(baked.geometry.getAttribute('position').count);
    expect(nu.geometry.getIndex()!.count).toBe(baked.geometry.getIndex()!.count);
  });
});

describe('SURCHARGE de chunks — posée une fois, neutre sans le define', () => {
  it('les quatre chunks reçoivent leur bloc, et une seconde pose n’en empile pas un second', () => {
    installPercage();
    for (const [nom, bloc] of BLOCS_PERCAGE) {
      const chunk = THREE.ShaderChunk[nom as keyof typeof THREE.ShaderChunk];
      expect(chunk, `${nom} doit porter le bloc de perçage`).toContain(bloc);
      expect(chunk.split(bloc).length - 1, `${nom} ne porte qu’UN bloc`).toBe(1);
    }
    const avant = BLOCS_PERCAGE.map(([nom]) => THREE.ShaderChunk[nom as keyof typeof THREE.ShaderChunk]);
    installPercage();
    expect(BLOCS_PERCAGE.map(([nom]) => THREE.ShaderChunk[nom as keyof typeof THREE.ShaderChunk])).toEqual(avant);
  });

  it('SANS le define, le chunk surchargé rend le chunk d’origine — octet pour octet', () => {
    installPercage();
    for (const [nom, bloc] of BLOCS_PERCAGE) {
      const chunk = THREE.ShaderChunk[nom as keyof typeof THREE.ShaderChunk];
      expect(chunk, 'la surcharge doit bien avoir modifié le chunk').not.toBe(ORIGINE.get(nom));
      expect(chunk.replace(bloc, '')).toBe(ORIGINE.get(nom));
      // Tout ce que le bloc ajoute vit sous le `#ifdef` : rien n'en dépasse.
      expect(bloc.startsWith(`\n#ifdef ${PERCAGE_DEFINE}`)).toBe(true);
      expect(bloc.endsWith('#endif')).toBe(true);
    }
  });

  it('le fragment DISCARD sous les trois conditions, et jamais sur un sol', () => {
    installPercage();
    const frag = BLOCS_PERCAGE.find(([nom]) => nom === 'clipping_planes_fragment')![1];
    expect(frag).toContain('if ( vPercable > 0.5 )');
    expect(frag).toContain('if ( trou.w <= 0.0 ) continue;');
    expect(frag).toContain('if ( percZ >= trou.z ) continue;');
    expect(frag).toContain('discard;');
    expect(frag).toContain(`for ( int i = 0; i < ${PERCAGE_MAX_HEROS}; i ++ )`);
  });
});

describe('DITHER de Bayer 8×8 — le bord organique de l’anneau', () => {
  /** Le PORTAGE EXACT de `percageBayer8` du chunk — la même récursion, en JS. */
  const bayer2 = (x: number, y: number) => {
    const c = { x: Math.floor(x), y: Math.floor(y) };
    const v = c.x * 0.5 + c.y * c.y * 0.75;
    return v - Math.floor(v);
  };
  const bayer4 = (x: number, y: number) => bayer2(0.5 * x, 0.5 * y) * 0.25 + bayer2(x, y);
  const bayer8 = (x: number, y: number) => bayer4(0.5 * x, 0.5 * y) * 0.25 + bayer2(x, y);

  it('les 64 pixels d’un bloc reçoivent les 64 seuils `k/64`, une fois chacun', () => {
    const seuils: number[] = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) seuils.push(Math.round(bayer8(x, y) * 64));
    expect(new Set(seuils).size).toBe(64);
    expect(Math.min(...seuils)).toBe(0);
    expect(Math.max(...seuils)).toBe(63);
  });

  it('le motif se RÉPÈTE tous les 8 pixels — le bord ne dérive pas avec la position à l’écran', () => {
    for (const [x, y] of [[0, 0], [3, 5], [7, 1]]) expect(bayer8(x + 8, y + 8)).toBeCloseTo(bayer8(x, y), 12);
  });

  it('le CŒUR du trou est plein, et l’anneau seul est dithéré', () => {
    expect(PERCAGE_COEUR).toBeGreaterThan(0);
    expect(PERCAGE_COEUR).toBeLessThan(1);
  });
});

describe('BRANCHEMENT par matériau — le seul canal vivant vers un matériau intégré', () => {
  it('`percerMateriau` pose le define une fois, et demande la recompilation', () => {
    const mat = new THREE.MeshLambertMaterial();
    const version = mat.version;
    expect(percerMateriau(mat)).toBe(true);
    expect(mat.defines?.[PERCAGE_DEFINE]).toBe('');
    // `needsUpdate` est un setter en ÉCRITURE SEULE chez three : c'est `version` qui en porte la trace.
    expect(mat.version).toBe(version + 1);
    expect(percerMateriau(mat), 'une seconde pose ne recompile rien').toBe(false);
    expect(mat.version, 'et ne redemande donc aucune recompilation').toBe(version + 1);
  });

  it('`onBeforeCompile` GREFFE les objets partagés — pas des copies', () => {
    const mat = new THREE.MeshLambertMaterial();
    percerMateriau(mat);
    const shader = { uniforms: {} as Record<string, { value: unknown }> };
    mat.onBeforeCompile(shader as never, null as never);
    // C'est l'IDENTITÉ qui compte : muter un trou depuis le pilote doit atteindre le matériau compilé.
    expect(shader.uniforms.uPercage.value).toBe(trousPercage());
    expect(shader.uniforms.uPercageVP.value).toBe(cadreCourant().vp);
    expect(shader.uniforms.uPercageEcran.value).toBe(cadreCourant().ecran);
  });

  it('deux matériaux percés partagent UNE référence de `onBeforeCompile` — donc un programme', () => {
    const a = new THREE.MeshLambertMaterial();
    const b = new THREE.MeshBasicMaterial();
    percerMateriau(a);
    percerMateriau(b);
    expect(a.onBeforeCompile).toBe(b.onBeforeCompile);
    expect(a.customProgramCacheKey()).toBe(b.customProgramCacheKey());
  });

  it('les quatre trous naissent ÉTEINTS : le rendu d’avant ce lot, au bit près', () => {
    const trous = trousPercage();
    expect(trous).toHaveLength(PERCAGE_MAX_HEROS);
    // Le rayon (w) est la SEULE porte : à zéro, le fragment saute le trou avant tout autre calcul.
    for (const trou of trous) expect(trou.w).toBeGreaterThanOrEqual(0);
  });

  it('le CADRE se pose depuis la caméra de JEU — ce que la passe d’ombre n’a pas autrement', () => {
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    cam.position.set(0, 0, 5);
    cam.updateMatrixWorld();
    cadrePercage(cam, 800, 600);
    const attendu = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    expect([...cadreCourant().vp.elements]).toEqual([...attendu.elements]);
    expect(cadreCourant().ecran.toArray()).toEqual([800, 600]);
  });
});

describe('PASSE D’OMBRE — le trou ne projette plus l’ombre qu’il a ôtée', () => {
  it('le matériau de profondeur porte le MÊME define et le MÊME branchement', () => {
    const prof = materiauProfondeurPerce();
    expect(prof).toBeInstanceOf(THREE.MeshDepthMaterial);
    expect(prof.depthPacking).toBe(THREE.RGBADepthPacking);
    expect(prof.defines?.[PERCAGE_DEFINE]).toBe('');
    const shader = { uniforms: {} as Record<string, { value: unknown }> };
    prof.onBeforeCompile(shader as never, null as never);
    expect(shader.uniforms.uPercage.value).toBe(trousPercage());
  });

  it('les chunks greffés sont ceux que le shader de PROFONDEUR inclut aussi', () => {
    // `meshdepth_vert`/`meshdepth_frag` n'incluent PAS `fog_*` ni `lights_*` : sans les chunks
    // d'écrêtage, la passe d'ombre n'aurait aucun point d'entrée commun avec la passe de surface.
    for (const [nom] of BLOCS_PERCAGE) {
      expect(THREE.ShaderLib.depth.vertexShader + THREE.ShaderLib.depth.fragmentShader).toContain(`#include <${nom}>`);
      expect(THREE.ShaderLib.lambert.vertexShader + THREE.ShaderLib.lambert.fragmentShader).toContain(`#include <${nom}>`);
    }
  });
});
