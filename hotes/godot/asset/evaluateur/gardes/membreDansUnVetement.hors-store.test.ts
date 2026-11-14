// La garde du membre dans un vêtement (#3842) : un sommet du corps ne passe pas derrière la face d'un vêtement d'une zone ni la sienne ni voisine.
import { describe, expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Mesh, SkinnedMesh } from 'three';
import type { Echantillon } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { endroitDe, PORTEE_DE_COUVERTURE_M } from '../../pile.ts';
import { TOLERANCE_JUMEAUX_POSITION_M } from './poids.ts';
import { gardeMembreDansUnVetement, mesurerMembresDansUnVetement, pairesHorsDeZone, zonesVoisines } from './membreDansUnVetement.ts';

/** Un carré de 0,2 m de côté à la hauteur `z`, en grille 3 × 3, décalé de `dx` en X. */
function carre(z: number, dx = 0): Float32Array {
  return Float32Array.from([-1, 0, 1].flatMap((y) => [-1, 0, 1].flatMap((x) => [x * 0.1 + dx, y * 0.1, z])));
}
/** Le mesh de `Type` sur `positions`, ses triangles tournés vers +Z, nommé `nom`. */
function maillage<M extends Mesh>(Type: new (g: BufferGeometry) => M, positions: Float32Array, nom: string): M {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions.slice(), 3));
  g.setIndex([0, 1, 3, 4].flatMap((i) => [i, i + 1, i + 3, i + 1, i + 4, i + 3]));
  const m = new Type(g);
  m.name = nom;
  return m;
}
const libelle = (m: Mesh) => m.name;
const triangles = (m: Mesh) => m.geometry.index!.array;
const echantillon = (positions: Map<Mesh, Float32Array>, t = 0.5): Echantillon => ({ clip: 'Coup', t, positions, os: new Map() });

describe('membreDansUnVetement', () => {
  const main = maillage(Mesh, carre(0), 'main'), poignet = maillage(Mesh, carre(0, 0.2), 'poignet'), torse = maillage(Mesh, carre(0, 0.2 + TOLERANCE_JUMEAUX_POSITION_M * 10), 'torse');
  const manche = maillage(SkinnedMesh, carre(0.01), 'manche'), cuisse = maillage(Mesh, carre(0), 'cuisse');
  const zones = new Map<Mesh, string>([[main, 'main_d'], [poignet, 'avant_bras_d'], [torse, 'torse'], [manche, 'bras_haut_g']]);
  const zoneDe = (m: Mesh) => zones.get(m);

  it('deux zones dont les meshes du corps se touchent au repos sont voisines ; séparées, non', () => {
    const voisines = zonesVoisines([main, poignet, torse], zoneDe, { positions: new Map([[main, carre(0)], [poignet, carre(0, 0.2)], [torse, carre(0, 0.2 + TOLERANCE_JUMEAUX_POSITION_M * 10)]]) });
    expect([...voisines].sort()).toEqual(['avant_bras_d|main_d', 'main_d|avant_bras_d']);
  });

  it('une paire n’unit que des zones ni égales ni voisines', () => {
    const autreMain = maillage(SkinnedMesh, carre(0.01), 'gant');
    zones.set(autreMain, 'main_d');
    const paires = pairesHorsDeZone([main, poignet], [manche, autreMain, maillage(SkinnedMesh, carre(0), 'sans zone')], zoneDe, new Set(['main_d|bras_haut_g']), triangles);
    expect(paires.map((p) => [p.membre.name, p.zone, p.vetement.name, p.triangles])).toEqual([['poignet', 'avant_bras_d', 'manche', triangles(manche)], ['poignet', 'avant_bras_d', 'gant', triangles(autreMain)]]);
  });

  /** La main inclinée de pente `pente` en X, sa hauteur `z` au centre. */
  const inclinee = (z: number, pente: number) => carre(z).map((v, i, p) => (i % 3 === 2 ? v + p[i - 2] * pente : v));
  const mesurer = (main_: Float32Array, manche_: Float32Array, t = 0.5, vetement: Mesh = manche, cuisse_?: Float32Array) =>
    mesurerMembresDansUnVetement([{ membre: main, zone: 'main_d', vetement, triangles: triangles(vetement) }], cuisse_ ? [{ membre: main, zone: 'main_d', vetement: cuisse, triangles: triangles(cuisse) }] : [],
      echantillon(new Map([[main, main_], [vetement, manche_], ...(cuisse_ ? [[cuisse, cuisse_] as const] : [])]), t));

  it('ROUGE : la main traverse la manche, des sommets de chaque côté ; un écart par (zone, mesh, clip) à son pire instant', () => {
    const mesures = [mesurer(inclinee(0.01, 0.2), carre(0.01), 0), mesurer(inclinee(0.01, 0.25), carre(0.01), 1)].flat();
    expect(mesures.map((m) => m.sommets)).toEqual([3, 3]);
    const ecarts = gardeMembreDansUnVetement(mesures, libelle);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toMatchObject({ garde: 'membreDansUnVetement', code: 'membre-dans-un-vetement', mesh: 'manche', clip: 'Coup', t: 1, seuil: ECART_DE_SUIVI_M });
    expect(ecarts[0].valeur).toBeCloseTo(0.025, 6);
  });

  it('plafond : au compte admis du clip aucun écart, au-delà tous, en deçà `plafond-a-baisser`', () => {
    const mesures = mesurer(inclinee(0.01, 0.2), carre(0.01));
    expect(gardeMembreDansUnVetement(mesures, libelle, { Coup: 1 })).toEqual([]);
    expect(gardeMembreDansUnVetement(mesures, libelle, { Autre: 1 }).map((e) => [e.code, e.clip, e.valeur, e.seuil])).toEqual([
      ['membre-dans-un-vetement', 'Coup', expect.closeTo(0.02, 6), ECART_DE_SUIVI_M], ['plafond-a-baisser', 'Autre', 0, 1]]);
    expect(gardeMembreDansUnVetement(mesures, libelle, { Coup: 2 }).map((e) => [e.code, e.clip, e.valeur, e.seuil])).toEqual([['plafond-a-baisser', 'Coup', 1, 2]]);
  });

  it('VERT : la main entièrement sous la nappe, entièrement devant, dans la tolérance, hors de portée ou ailleurs', () => {
    expect(mesurer(carre(0), carre(0.01))).toEqual([]);
    expect(mesurer(carre(0.02), carre(0.01))).toEqual([]);
    expect(mesurer(inclinee(0.01, ECART_DE_SUIVI_M * 9), carre(0.01))).toEqual([]);
    expect(mesurer(carre(0.01 - PORTEE_DE_COUVERTURE_M * 1.1), carre(0.01))).toEqual([]);
    expect(mesurer(inclinee(0.01, 0.2).map((v, i) => (i % 3 === 0 ? v + 0.5 : v)), carre(0.01))).toEqual([]);
  });

  it('tissu pincé : la main derrière la nappe ne la traverse pas où la peau d’une autre zone est sous elle à portée de la nappe ; plus loin, si', () => {
    const [main_, nappe_] = [inclinee(0.01, 0.2), carre(0.01)];
    expect(mesurer(main_, nappe_, 0.5, manche, carre(0.01 - PORTEE_DE_COUVERTURE_M * 0.9))).toEqual([]);
    expect(mesurer(main_, nappe_, 0.5, manche, carre(0.01 - PORTEE_DE_COUVERTURE_M * 1.1)).map((m) => m.sommets)).toEqual([3]);
  });

  it('VERT : le côté d’un sommet est celui de son triangle couvrant le plus proche ; la main contre la face basse, devant, ne traverse pas', () => {
    const deuxFaces = new BufferGeometry();
    deuxFaces.setAttribute('position', new BufferAttribute(Float32Array.from([...carre(0.01), ...carre(0.035)]), 3));
    deuxFaces.setIndex([0, 9].flatMap((d) => [0, 1, 3, 4].flatMap((i) => [i, i + 1, i + 3, i + 1, i + 4, i + 3].map((s) => s + d))));
    const nappe = new SkinnedMesh(deuxFaces);
    nappe.name = 'manche';
    zones.set(nappe, 'bras_haut_g');
    expect(mesurer(inclinee(0.033, 0.17), Float32Array.from([...carre(0.01), ...carre(0.035)]), 0.5, nappe)).toEqual([]);
  });

  /** Les positions et le mesh de `Type` de deux carrés : l'un à `haut`, tourné vers +Z, l'autre à `bas`, vers -Z. */
  function deuxFaces<M extends Mesh>(Type: new (g: BufferGeometry) => M, haut: number, bas: number): [M, Float32Array, number[]] {
    const g = new BufferGeometry(), positions = Float32Array.from([...carre(haut), ...carre(bas)]);
    g.setAttribute('position', new BufferAttribute(positions.slice(), 3));
    const dessus = [0, 1, 3, 4].flatMap((i) => [i, i + 1, i + 3, i + 1, i + 4, i + 3]);
    g.setIndex([...dessus, ...[0, 1, 3, 4].flatMap((i) => [i + 9, i + 12, i + 10, i + 10, i + 12, i + 13])]);
    return [new Type(g), positions, dessus];
  }

  it('endroit : d’une double nappe, seule la face tournée à l’opposé de la peau ; sans peau, toutes', () => {
    const [nappe, positions, dessus] = deuxFaces(SkinnedMesh, 0.02, 0.018);
    expect([...endroitDe({ positions, indices: triangles(nappe) }, [carre(0)])]).toEqual(dessus);
    expect(endroitDe({ positions, indices: triangles(nappe) }, [])).toHaveLength(48);
  });

  it('VERT : la main posée devant l’endroit d’une double nappe ne la traverse pas ; contre sa doublure, sa paume passerait derrière', () => {
    const [nappe, drap, dessus] = deuxFaces(SkinnedMesh, 0.02, 0.018), [posee, dos] = deuxFaces(Mesh, 0.045, 0.03);
    const mesurer_ = (vus: ArrayLike<number>) => mesurerMembresDansUnVetement([{ membre: posee, zone: 'main_d', vetement: nappe, triangles: vus }], [], echantillon(new Map<Mesh, Float32Array>([[posee, dos], [nappe, drap]])));
    expect(mesurer_(dessus)).toEqual([]);
    expect(mesurer_(triangles(nappe)).map((m) => m.sommets)).toEqual([9]);
  });
});
