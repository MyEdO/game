// La garde de la traversée des couches (#2972, #3319) : en clip, une couche ne passe pas devant celle qui la couvre.
import { describe, expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Mesh, SkinnedMesh } from 'three';
import type { Echantillon } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { gardeTraversee, lierLesCouches, lierSous, mesurerTraversee, PORTEE_DE_COUVERTURE_M, sansLesZonesMasquees } from './traversee.ts';
import { RANG_DU_CORPS } from '../../element.ts';

/** Un carré de 0,2 m de côté à la hauteur `z`, en grille 3 × 3. */
function carre(z: number): Float32Array {
  return Float32Array.from([-1, 0, 1].flatMap((y) => [-1, 0, 1].flatMap((x) => [x * 0.1, y * 0.1, z])));
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
const echantillon = (positions: Map<Mesh, Float32Array>, t = 0.5): Echantillon => ({ clip: 'Coup', t, positions, os: new Map() });

describe('traversee', () => {
  const peau = maillage(Mesh, carre(0)), tissu = maillage(SkinnedMesh, carre(0.01));
  peau.name = 'peau';
  tissu.name = 'tissu';
  const repos = new Map<Mesh, Float32Array>([[peau, carre(0)], [tissu, carre(0.01)]]);

  it('chaque sommet derrière la couverture, à portée, se lie ; devant ou hors de portée, aucun', () => {
    expect(lierSous(peau, tissu, { positions: repos })?.sommets.length).toBe(9);
    expect(lierSous(peau, tissu, { positions: new Map([[peau, carre(0.02)], [tissu, carre(0.01)]]) })).toBeNull();
    expect(lierSous(peau, tissu, { positions: new Map([[peau, carre(-PORTEE_DE_COUVERTURE_M)], [tissu, carre(0.01)]]) })).toBeNull();
  });

  it('une doublure tournée vers le corps ne couvre rien', () => {
    const doublure = maillage(SkinnedMesh, carre(0.01), true);
    expect(lierSous(peau, doublure, { positions: new Map([[peau, carre(0)], [doublure, carre(0.01)]]) })).toBeNull();
  });

  it('VERT : la couche suit sa couverture ; ROUGE : elle passe devant au-delà de la tolérance, un écart à son pire instant', () => {
    const liaisons = lierLesCouches([peau], [{ rang: 1, meshes: [tissu] }], { positions: repos });
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

  it('un élément ne couvre que les couches plus intérieures : ni lui-même, ni un élément de même couche', () => {
    const autre = maillage(SkinnedMesh, carre(0.005));
    const positions = { positions: new Map<Mesh, Float32Array>([...repos, [autre, carre(0.005)]]) };
    const liaisons = lierLesCouches([], [{ rang: 1, meshes: [tissu] }, { rang: 1, meshes: [autre] }], positions);
    expect(liaisons).toEqual([]);
    expect(lierLesCouches([], [{ rang: 2, meshes: [tissu] }, { rang: 1, meshes: [autre] }], positions).map((l) => [l.sujet, l.couverture])).toEqual([[autre, tissu]]);
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
