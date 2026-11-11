// La garde de la traversée des couches (#2972, #3319, #3842) : une couche ne passe pas devant celle qui la couvre.
import { describe, expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Mesh, SkinnedMesh } from 'three';
import type { Echantillon } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { gardePercementAuRepos, gardeTraversee, lierLesCouches, mesurerTraversee, sansLesZonesMasquees } from './traversee.ts';
import { RANG_DU_CORPS } from '../../element.ts';
import { ordreDesCouches, PORTEE_DE_COUVERTURE_M } from '../../pile.ts';

/** Un carré de 0,2 m de côté à la hauteur `z`, en grille 3 × 3, décalé de `dx` en X. */
function carre(z: number, dx = 0): Float32Array {
  return Float32Array.from([-1, 0, 1].flatMap((y) => [-1, 0, 1].flatMap((x) => [x * 0.1 + dx, y * 0.1, z])));
}
/** Le mesh de `Type` sur `positions`, ses triangles tournés vers +Z, ou vers −Z si `retourne`. */
function maillage<M extends Mesh>(Type: new (g: BufferGeometry) => M, positions: Float32Array, retourne = false): M {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions.slice(), 3));
  const faces = [0, 1, 3, 4].flatMap((i) => (retourne ? [i, i + 3, i + 1, i + 1, i + 3, i + 4] : [i, i + 1, i + 3, i + 1, i + 4, i + 3]));
  g.setIndex(faces);
  return new Type(g);
}
const decaler = (p: Float32Array, dz: number) => p.map((v, i) => (i % 3 === 2 ? v + dz : v));
const libelle = (m: Mesh) => m.name;
type Pose = { positions: Map<Mesh, Float32Array> };
/** L'élément de couche `rang` fait de `meshes`, dont l'ordre se vote dans la pose `neutre`. */
const element = (rang: number, meshes: SkinnedMesh[], neutre: Pose) => ({
  rang, accessoire: false, meshes,
  neutres: meshes.map((m) => ({ positions: neutre.positions.get(m) as Float32Array, indices: (m.geometry.index as BufferAttribute).array })),
});
/** Les liaisons de `sujet` sous l'élément du seul mesh `couverture`, dans la pose `positions`. */
const lierSous = (sujet: Mesh, couverture: SkinnedMesh, positions: Map<Mesh, Float32Array>) =>
  lierLesCouches([sujet], [element(1, [couverture], { positions })], { positions }, ordreDesCouches()).liaisons;
const echantillon = (positions: Map<Mesh, Float32Array>, t = 0.5): Echantillon => ({ clip: 'Coup', t, positions, os: new Map() });

describe('traversee', () => {
  const peau = maillage(Mesh, carre(0)), tissu = maillage(SkinnedMesh, carre(0.01));
  peau.name = 'peau';
  tissu.name = 'tissu';
  const repos = new Map<Mesh, Float32Array>([[peau, carre(0)], [tissu, carre(0.01)]]);

  it('chaque sommet derrière la couverture, à portée, se lie ; devant ou hors de portée, aucun', () => {
    expect(lierSous(peau, tissu, repos).map((l) => l.sommets.length)).toEqual([9]);
    expect(lierSous(peau, tissu, new Map([[peau, carre(0.02)], [tissu, carre(0.01)]]))).toEqual([]);
    expect(lierSous(peau, tissu, new Map([[peau, carre(-PORTEE_DE_COUVERTURE_M)], [tissu, carre(0.01)]]))).toEqual([]);
  });

  it('une doublure tournée vers le corps ne couvre rien', () => {
    const doublure = maillage(SkinnedMesh, carre(0.01), true);
    expect(lierSous(peau, doublure, new Map([[peau, carre(0)], [doublure, carre(0.01)]]))).toEqual([]);
  });

  it('VERT : la couche suit sa couverture ; ROUGE : elle passe devant au-delà de la tolérance, un écart à son pire instant', () => {
    const { liaisons } = lierLesCouches([peau], [element(1, [tissu], { positions: repos })], { positions: repos }, ordreDesCouches());
    const suit = mesurerTraversee(liaisons, echantillon(new Map([[peau, decaler(carre(0), 0.3)], [tissu, decaler(carre(0.01), 0.3)]])));
    expect(suit).toEqual([]);
    const tolere = mesurerTraversee(liaisons, echantillon(new Map([[peau, carre(0.01 + ECART_DE_SUIVI_M * 0.9)], [tissu, carre(0.01)]])));
    expect(tolere).toEqual([]);
    const mesures = [0.02, 0.04].flatMap((z, k) => mesurerTraversee(liaisons, echantillon(new Map([[peau, carre(z)], [tissu, carre(0.01)]]), k)));
    const ecarts = gardeTraversee(mesures, libelle);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toMatchObject({ garde: 'traversee', code: 'couche-traversee', mesh: 'tissu', clip: 'Coup', t: 1, seuil: -ECART_DE_SUIVI_M });
    expect(ecarts[0].valeur).toBeCloseTo(-0.03, 6);
  });

  it('ROUGE : un sommet devant sa couverture au repos, au-delà de la tolérance, la perce ; VERT : dans la tolérance ou hors de portée', () => {
    const auRepos = (z: number) => ({ positions: new Map([[peau, carre(z)], [tissu, carre(0.01)]]) });
    const perce = (z: number) => lierLesCouches([peau], [element(1, [tissu], auRepos(z))], auRepos(z), ordreDesCouches()).percements;
    expect(perce(0.01 + ECART_DE_SUIVI_M * 0.9)).toEqual([]);
    expect(perce(0.01 + PORTEE_DE_COUVERTURE_M * 1.1)).toEqual([]);
    expect(perce(0)).toEqual([]);
    const percements = perce(0.025);
    expect(percements).toHaveLength(1);
    expect(percements[0]).toMatchObject({ sujet: peau, couverture: tissu, sommets: 9 });
    expect(percements[0].pire).toBeCloseTo(-0.015, 6);
    expect(gardePercementAuRepos(percements, libelle)).toEqual([expect.objectContaining({ garde: 'traversee', code: 'couche-percee-au-repos', mesh: 'tissu', seuil: -ECART_DE_SUIVI_M })]);
  });

  describe('même couche : celui dont les sommets sont devant l’autre au repos le couvre', () => {
    const autre = maillage(SkinnedMesh, carre(0.005));
    autre.name = 'autre';
    const positions = { positions: new Map<Mesh, Float32Array>([...repos, [autre, carre(0.005)]]) };

    it('le couvert se lie sous celui qui le couvre, jamais l’inverse ; un élément ne se couvre pas lui-même', () => {
      const liaisons = lierLesCouches([], [element(1, [tissu], positions), element(1, [autre], positions)], positions, ordreDesCouches()).liaisons;
      expect(liaisons.map((l) => [l.sujet, l.couverture])).toEqual([[autre, tissu]]);
      expect(lierLesCouches([], [element(1, [tissu, autre], positions)], positions, ordreDesCouches()).liaisons).toEqual([]);
      expect(lierLesCouches([], [element(2, [tissu], positions), element(1, [autre], positions)], positions, ordreDesCouches()).liaisons.map((l) => [l.sujet, l.couverture])).toEqual([[autre, tissu]]);
    });

    it('l’ordre se prend au repos neutre, la liaison au repos de la passe', () => {
      const inverse = { positions: new Map<Mesh, Float32Array>([[tissu, carre(0)], [autre, carre(0.01)]]) };
      const couches = lierLesCouches([], [element(1, [tissu], positions), element(1, [autre], positions)], inverse, ordreDesCouches());
      expect(couches.liaisons).toEqual([]);
      expect(couches.percements.map((p) => [p.sujet, p.couverture])).toEqual([[autre, tissu]]);
    });

    it('un élément de couche plus extérieure couvre, même placé dessous', () => {
      const dessous = { positions: new Map<Mesh, Float32Array>([[tissu, carre(0.01)], [autre, carre(0)]]) };
      expect(lierLesCouches([], [element(1, [tissu], dessous), element(2, [autre], dessous)], dessous, ordreDesCouches()).percements.map((p) => [p.sujet, p.couverture])).toEqual([[tissu, autre]]);
    });
  });

  it('un mesh de zone est masqué par un élément de couche plus extérieure qui couvre sa zone, pas par un de même couche', () => {
    const torse = new Mesh(), bras = new Mesh(), libre = new Mesh();
    const zones = new Map<Mesh, string | undefined>([[torse, 'torse'], [bras, 'bras'], [libre, undefined]]);
    const montre = sansLesZonesMasquees([{ rang: 1, couvre: ['torse'] }, { rang: 2, couvre: ['bras'] }], (m) => zones.get(m));
    expect(montre([torse, bras, libre], RANG_DU_CORPS)).toEqual([libre]);
    expect(montre([torse, bras, libre], 1)).toEqual([torse, libre]);
    expect(montre([torse, bras, libre], 2)).toEqual([torse, bras, libre]);
  });
});
