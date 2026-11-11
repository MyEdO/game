// La garde de la traversée des couches (#2972, #3319, #3842) : une couche ne passe pas devant celle qui la couvre.
import { describe, expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Mesh, SkinnedMesh } from 'three';
import type { Echantillon } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { gardePercementAuRepos, gardeTraversee, lierLesCouches, mesurerTraversee, ordreDesCouches, sansLesZonesMasquees } from './traversee.ts';
import { RANG_DU_CORPS } from '../../element.ts';
import { PORTEE_DE_COUVERTURE_M } from '../../pile.ts';

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
/** Les liaisons de `sujet` sous l'élément du seul mesh `couverture`, dans la pose `positions`. */
const lierSous = (sujet: Mesh, couverture: SkinnedMesh, positions: Map<Mesh, Float32Array>) =>
  lierLesCouches([sujet], [{ rang: 1, meshes: [couverture] }], { positions }, ordreDesCouches({ positions })).liaisons;
/** Lequel de deux éléments de même couche, de meshes `a` et `b`, couvre l'autre dans la pose `pose`. */
const ordreDeMemeRang = (a: SkinnedMesh[], b: SkinnedMesh[], pose: { positions: Map<Mesh, Float32Array> }): 'a' | 'b' | null => {
  const [ea, eb] = [{ rang: 1, meshes: a }, { rang: 1, meshes: b }];
  const couvre = ordreDesCouches(pose);
  return couvre(ea, eb) ? 'a' : couvre(eb, ea) ? 'b' : null;
};
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
    const { liaisons } = lierLesCouches([peau], [{ rang: 1, meshes: [tissu] }], { positions: repos }, ordreDesCouches({ positions: repos }));
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
    const perce = (z: number) => lierLesCouches([peau], [{ rang: 1, meshes: [tissu] }], auRepos(z), ordreDesCouches(auRepos(z))).percements;
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

    it('l’ordre suit le côté ; aucun sommet à portée, aucun ordre', () => {
      expect(ordreDeMemeRang([tissu], [autre], positions)).toBe('a');
      expect(ordreDeMemeRang([autre], [tissu], positions)).toBe('b');
      const loin = { positions: new Map<Mesh, Float32Array>([[tissu, carre(0.01)], [autre, carre(0.01 - PORTEE_DE_COUVERTURE_M * 1.1)]]) };
      expect(ordreDeMemeRang([tissu], [autre], loin)).toBeNull();
    });

    it('un accessoire couvre ce qui n’en est pas un, quel que soit le côté', () => {
      const [dessous, vetement] = [{ rang: 1, meshes: [autre], accessoire: true }, { rang: 1, meshes: [tissu] }];
      const couvre = ordreDesCouches(positions);
      expect(couvre(dessous, vetement)).toBe(true);
      expect(couvre(vetement, dessous)).toBe(false);
    });

    it('à égalité des voix, aucun ordre', () => {
      const [a1, a2, b1, b2] = [maillage(SkinnedMesh, carre(0.01)), maillage(SkinnedMesh, carre(0, 1)), maillage(SkinnedMesh, carre(0)), maillage(SkinnedMesh, carre(0.01, 1))];
      const croises = { positions: new Map<Mesh, Float32Array>([[a1, carre(0.01)], [a2, carre(0, 1)], [b1, carre(0)], [b2, carre(0.01, 1)]]) };
      expect(ordreDeMemeRang([a1, a2], [b1, b2], croises)).toBeNull();
      expect(ordreDeMemeRang([a1], [b1, b2], croises)).toBe('a');
    });

    it('le couvert se lie sous celui qui le couvre, jamais l’inverse ; un élément ne se couvre pas lui-même', () => {
      const liaisons = lierLesCouches([], [{ rang: 1, meshes: [tissu] }, { rang: 1, meshes: [autre] }], positions, ordreDesCouches(positions)).liaisons;
      expect(liaisons.map((l) => [l.sujet, l.couverture])).toEqual([[autre, tissu]]);
      expect(lierLesCouches([], [{ rang: 1, meshes: [tissu, autre] }], positions, ordreDesCouches(positions)).liaisons).toEqual([]);
      expect(lierLesCouches([], [{ rang: 2, meshes: [tissu] }, { rang: 1, meshes: [autre] }], positions, ordreDesCouches(positions)).liaisons.map((l) => [l.sujet, l.couverture])).toEqual([[autre, tissu]]);
    });

    it('l’ordre se prend au repos neutre, la liaison au repos de la passe', () => {
      const inverse = { positions: new Map<Mesh, Float32Array>([[tissu, carre(0)], [autre, carre(0.01)]]) };
      const couches = lierLesCouches([], [{ rang: 1, meshes: [tissu] }, { rang: 1, meshes: [autre] }], inverse, ordreDesCouches(positions));
      expect(couches.liaisons).toEqual([]);
      expect(couches.percements.map((p) => [p.sujet, p.couverture])).toEqual([[autre, tissu]]);
    });

    it('un élément de couche plus extérieure couvre, même placé dessous', () => {
      const dessous = { positions: new Map<Mesh, Float32Array>([[tissu, carre(0.01)], [autre, carre(0)]]) };
      expect(lierLesCouches([], [{ rang: 1, meshes: [tissu] }, { rang: 2, meshes: [autre] }], dessous, ordreDesCouches(dessous)).percements.map((p) => [p.sujet, p.couverture])).toEqual([[tissu, autre]]);
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
