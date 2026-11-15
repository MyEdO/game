// La garde des membres dans le tronc (#3806, #3810) : en clip, un avant-bras ou une main n'entre pas dans le tronc,
// les demi-droites menées vers l'avant et l'arrière du tronc, quelle que soit sa posture.
import { describe, expect, it } from 'vitest';
import { Bone, BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, Mesh, Object3D, Quaternion, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { poseDeRepos, type Echantillon } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { gardeMembres, mesurerMembres, troncDe } from './membres.ts';

/** Une scène : un tronc de géométrie `g` (au repos, avant +z, haut +y) skinné à parts égales sur les os `noms`, tous à
 *  l'origine, et une main d'un seul sommet. */
function scene(g: BufferGeometry, noms: readonly string[] = ['colonne']) {
  const racine = new Object3D();
  const n = g.attributes.position.count;
  g.setAttribute('skinIndex', new BufferAttribute(Uint16Array.from({ length: n * 4 }, (_, i) => (i % 4 < noms.length ? i % 4 : 0)), 4));
  g.setAttribute('skinWeight', new BufferAttribute(Float32Array.from({ length: n * 4 }, (_, i) => (i % 4 < noms.length ? 1 / noms.length : 0)), 4));
  const tronc = new SkinnedMesh(g);
  const osDuTronc = noms.map((nom) => Object.assign(new Bone(), { name: nom }));
  for (const b of osDuTronc) racine.add(b);
  racine.add(tronc);
  tronc.bind(new Skeleton(osDuTronc));
  const main = new Mesh(new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(3), 3)));
  main.name = 'main_d';
  racine.add(main);
  const meshes = [tronc, main];
  return {
    tronc: troncDe([tronc], poseDeRepos(racine, meshes)),
    os: osDuTronc,
    main,
    /** L'échantillon, la main en `point` (monde). */
    echantillon: (point: readonly number[], t = 0.5): Echantillon => {
      main.position.fromArray(point);
      return { clip: 'Lourde_Repos_Loop', t, ...poseDeRepos(racine, meshes) };
    },
  };
}

const libelle = (m: Mesh) => m.name;

/** Un tube de 0,1 m de rayon, haut de 0,4 m, ouvert en haut et en bas : un cou et des cuisses. */
const tube = () => new CylinderGeometry(0.1, 0.1, 0.4, 32, 4, true);

/** Un profil latéral (y, z) extrudé sur x, sans ses faces du haut, du bas ni des côtés : un dos, une poitrine qui
 *  surplombe un creux, un ventre. */
function surplomb(): BufferGeometry {
  const profil: [number, number][] = [[0.3, -0.1], [-0.3, -0.1], [-0.3, 0.15], [-0.1, 0.15], [-0.1, 0.02], [0.1, 0.02], [0.1, 0.15], [0.3, 0.15]];
  const coordonnees: number[] = [];
  for (let k = 0; k + 1 < profil.length; k++) {
    const [[y0, z0], [y1, z1]] = [profil[k], profil[k + 1]];
    coordonnees.push(-0.2, y0, z0, 0.2, y0, z0, 0.2, y1, z1, -0.2, y0, z0, 0.2, y1, z1, -0.2, y1, z1);
  }
  return new BufferGeometry().setAttribute('position', new BufferAttribute(Float32Array.from(coordonnees), 3));
}

describe('membres', () => {
  it('dehors, ou contre la peau dans la tolérance : aucun écart', () => {
    const { tronc, echantillon, main } = scene(new BoxGeometry(0.2, 0.2, 0.2));
    expect(mesurerMembres([main], tronc, echantillon([0, -0.15, 0]))).toEqual([]);
    expect(mesurerMembres([main], tronc, echantillon([0.15, 0, 0]))).toEqual([]);
    expect(mesurerMembres([main], tronc, echantillon([0, 0, -0.1 + ECART_DE_SUIVI_M * 0.9]))).toEqual([]);
  });

  it('ROUGE : la main entre dans le tronc, un écart à son instant le plus profond', () => {
    const { tronc, echantillon, main } = scene(new BoxGeometry(0.2, 0.2, 0.2));
    const mesures = [[0, 0, -0.07], [0, 0.02, -0.04]].flatMap((p, k) => mesurerMembres([main], tronc, echantillon(p, k)));
    const ecarts = gardeMembres(mesures, libelle);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toMatchObject({ garde: 'membres', code: 'membre-dans-le-tronc', mesh: 'main_d', clip: 'Lourde_Repos_Loop', t: 1, seuil: -ECART_DE_SUIVI_M });
    expect(ecarts[0].valeur).toBeCloseTo(-0.06, 6);
  });

  describe('un tronc ouvert en haut et en bas : dedans sur son axe, dehors au-delà de l’ouverture et devant lui', () => {
    const verdicts = (couche: Quaternion) => {
      const { tronc, echantillon, main, os } = scene(tube());
      os[0].quaternion.copy(couche);
      const en = (x: number, y: number, z: number) => mesurerMembres([main], tronc, echantillon(new Vector3(x, y, z).applyQuaternion(couche).toArray()));
      return { axe: en(0, 0.05, 0).length, auDessus: en(0, 0.25, 0).length, devant: en(0, 0, 0.15).length };
    };
    it('debout', () => expect(verdicts(new Quaternion())).toEqual({ axe: 1, auDessus: 0, devant: 0 }));
    it('couché, l’os du tronc tourné de 90° depuis son repos', () => {
      expect(verdicts(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2))).toEqual({ axe: 1, auDessus: 0, devant: 0 });
    });
  });

  it('un point dans le creux devant un tronc à surplomb en est dehors', () => {
    const { tronc, echantillon, main } = scene(surplomb());
    expect(mesurerMembres([main], tronc, echantillon([0, 0, 0.08]))).toEqual([]);
    expect(mesurerMembres([main], tronc, echantillon([0, 0.2, 0.05]))).toHaveLength(1);
  });

  it('la posture du tronc est la rotation moyenne de ses os, pondérée : deux os égaux à 0° et 60°, posture à 30°', () => {
    // Sur l'axe du tube, près de son ouverture : une demi-droite menée à 0° ou à 60° sort par l'ouverture, à 30° non.
    const { tronc, echantillon, main, os } = scene(tube(), ['droit', 'plie']);
    const axe = new Vector3(1, 0, 0);
    os[1].quaternion.setFromAxisAngle(axe, Math.PI / 3);
    const pres = new Vector3(0, 0.14, 0).applyQuaternion(new Quaternion().setFromAxisAngle(axe, Math.PI / 6)).toArray();
    expect(mesurerMembres([main], tronc, echantillon(pres))).toHaveLength(1);
  });
});
