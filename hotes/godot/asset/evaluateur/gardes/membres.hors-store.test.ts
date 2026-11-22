// La garde des membres dans le tronc (#3806, #3810) : en clip, un avant-bras ou une main n'entre pas dans le tronc,
// les demi-droites menées vers l'avant et l'arrière du tronc, quelle que soit sa posture, pondérée sur ses sommets distincts.
import { describe, expect, it } from 'vitest';
import { Bone, BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, Mesh, Object3D, Quaternion, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { poseDeRepos, type Echantillon } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { gardeMembres, mesurerMembres, troncDe } from './membres.ts';

/** Une scène : un tronc de géométrie `g` (au repos, avant +z, haut +y) skinné sur les os `noms`, tous à l'origine, l'os
 *  `noms[k]` au slot de peau k de chaque sommet avec le poids `poids[k]`, et une main d'un seul sommet. */
function scene(g: BufferGeometry, noms: readonly string[] = ['colonne'], poids: readonly number[] = noms.map(() => 1 / noms.length)) {
  const racine = new Object3D();
  const n = g.attributes.position.count;
  g.setAttribute('skinIndex', new BufferAttribute(Uint16Array.from({ length: n * 4 }, (_, i) => (i % 4 < noms.length ? i % 4 : 0)), 4));
  g.setAttribute('skinWeight', new BufferAttribute(Float32Array.from({ length: n * 4 }, (_, i) => (i % 4 < noms.length ? poids[i % 4] : 0)), 4));
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

  const axe = new Vector3(1, 0, 0);
  /** Le point à `y` sur l'axe du tube tourné de `degres` autour de l'axe transverse. */
  const surLAxe = (y: number, degres: number) => new Vector3(0, y, 0).applyQuaternion(new Quaternion().setFromAxisAngle(axe, (degres * Math.PI) / 180)).toArray();

  it('la posture du tronc est la rotation moyenne de ses os, pondérée : os de poids 0,8 à 0° et 0,2 à 60°, posture à 12°', () => {
    // Sur l'axe du tube tourné de 12°, près de son ouverture : une demi-droite menée à 12° reste dans le tube, à la
    // moyenne sans poids, 30°, elle sort par l'ouverture.
    const { tronc, echantillon, main, os } = scene(tube(), ['droit', 'plie'], [0.8, 0.2]);
    os[1].quaternion.setFromAxisAngle(axe, Math.PI / 3);
    expect(mesurerMembres([main], tronc, echantillon(surLAxe(0.16, 12)))).toHaveLength(1);
  });

  it('la posture du tronc ne dépend pas de l’ordre de ses os : le signe s’aligne sur le plus lourd', () => {
    // Les os de poids 0,7, 0,2, 0,1 à 0°, 60°, 190° posent le tube tourné de 12°, réduit de 0,72 en travers. Le quaternion
    // de l'os léger est de signe opposé à celui du plus lourd : la posture alignée sur le plus lourd est à 0°, la
    // demi-droite reste dans le tube ; alignée sur l'os léger, elle est à −41° et la demi-droite sort par l'ouverture.
    const verdict = (ordre: readonly number[]) => {
      const [noms, poids, angles] = [['droit', 'plie', 'retourne'], [0.7, 0.2, 0.1], [0, 60, 190]].map((l) => ordre.map((k) => l[k]));
      const { tronc, echantillon, main, os } = scene(tube(), noms as string[], poids as number[]);
      os.forEach((o, k) => o.quaternion.setFromAxisAngle(axe, ((angles[k] as number) * Math.PI) / 180));
      return mesurerMembres([main], tronc, echantillon(surLAxe(0.11, 12))).length;
    };
    expect([verdict([0, 1, 2]), verdict([2, 1, 0])]).toEqual([1, 1]);
  });

  it('le tronc en deux meshes dédoublés à leur couture a les poids et la posture du même tronc en un seul mesh', () => {
    // Un tube de 6 étages sur les os `bas` et `haut`, le poids de `haut` croissant avec la hauteur, `haut` plié de 60° :
    // en un mesh, chaque sommet une fois ; en deux, l'anneau du 2e étage dans chacun et la colonne d'angle nul
    // dédoublée, comme une couture d'UV.
    const ETAGES = 6, COTES = 12;
    const anneaux = (debut: number, fin: number, couture: boolean): BufferGeometry => {
      const colonnes = couture ? COTES + 1 : COTES;
      const positions: number[] = [], indices: number[] = [], poids: number[] = [], faces: number[] = [];
      for (let k = debut; k <= fin; k++) for (let i = 0; i < colonnes; i++) {
        const a = (2 * Math.PI * (i % COTES)) / COTES;
        positions.push(0.1 * Math.cos(a), -0.2 + (0.4 * k) / ETAGES, 0.1 * Math.sin(a));
        indices.push(0, 1, 0, 0);
        poids.push(1 - k / ETAGES, k / ETAGES, 0, 0);
      }
      for (let k = 0; k < fin - debut; k++) for (let i = 0; i < COTES; i++) {
        const [a, b] = [k * colonnes + i, k * colonnes + ((i + 1) % colonnes)];
        faces.push(a, b, b + colonnes, a, b + colonnes, a + colonnes);
      }
      return new BufferGeometry().setAttribute('position', new BufferAttribute(Float32Array.from(positions), 3))
        .setAttribute('skinIndex', new BufferAttribute(Uint16Array.from(indices), 4))
        .setAttribute('skinWeight', new BufferAttribute(Float32Array.from(poids), 4)).setIndex(faces);
    };
    const mesurer = (geometries: readonly BufferGeometry[]) => {
      const racine = new Object3D();
      const os = ['bas', 'haut'].map((nom) => Object.assign(new Bone(), { name: nom }));
      for (const b of os) racine.add(b);
      const troncs = geometries.map((g) => new SkinnedMesh(g));
      for (const t of troncs) {
        racine.add(t);
        t.bind(new Skeleton(os));
      }
      const main = new Mesh(new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(3), 3)));
      racine.add(main);
      const meshes = [...troncs, main];
      const tronc = troncDe(troncs, poseDeRepos(racine, meshes));
      os[1].quaternion.setFromAxisAngle(axe, Math.PI / 3);
      const verdicts = [0.05, 0.11, 0.16, 0.19].map((y) => {
        main.position.fromArray(surLAxe(y, 20));
        return mesurerMembres([main], tronc, { clip: 'Lourde_Repos_Loop', t: 0, ...poseDeRepos(racine, meshes) }).map((m) => m.pire);
      });
      return { os: tronc?.os.map(({ nom, poids }) => [nom, poids]), verdicts };
    };
    const entier = mesurer([anneaux(0, ETAGES, false)]), scinde = mesurer([anneaux(0, 2, true), anneaux(2, ETAGES, true)]);
    expect(scinde.os).toHaveLength(2);
    scinde.os?.forEach(([nom, poids], k) => {
      expect(nom).toBe(entier.os?.[k][0]);
      expect(poids).toBeCloseTo(entier.os?.[k][1] as number, 6);
    });
    expect(scinde.verdicts).toEqual(entier.verdicts);
  });
});
