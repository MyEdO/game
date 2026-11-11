// La garde du membre dans un vêtement (#3842) : un sommet du corps ne passe pas derrière la face d'un vêtement d'une zone ni la sienne ni voisine.
import { describe, expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Mesh, SkinnedMesh } from 'three';
import type { Echantillon } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { PORTEE_DE_COUVERTURE_M } from '../../pile.ts';
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
const echantillon = (positions: Map<Mesh, Float32Array>, t = 0.5): Echantillon => ({ clip: 'Coup', t, positions, os: new Map() });

describe('membreDansUnVetement', () => {
  const main = maillage(Mesh, carre(0), 'main'), poignet = maillage(Mesh, carre(0, 0.2), 'poignet'), torse = maillage(Mesh, carre(0, 0.2 + TOLERANCE_JUMEAUX_POSITION_M * 10), 'torse');
  const manche = maillage(SkinnedMesh, carre(0.01), 'manche');
  const zones = new Map<Mesh, string>([[main, 'main_d'], [poignet, 'avant_bras_d'], [torse, 'torse'], [manche, 'bras_haut_g']]);
  const zoneDe = (m: Mesh) => zones.get(m);

  it('deux zones dont les meshes du corps se touchent au repos sont voisines ; séparées, non', () => {
    const voisines = zonesVoisines([main, poignet, torse], zoneDe, { positions: new Map([[main, carre(0)], [poignet, carre(0, 0.2)], [torse, carre(0, 0.2 + TOLERANCE_JUMEAUX_POSITION_M * 10)]]) });
    expect([...voisines].sort()).toEqual(['avant_bras_d|main_d', 'main_d|avant_bras_d']);
  });

  it('une paire n’unit que des zones ni égales ni voisines', () => {
    const autreMain = maillage(SkinnedMesh, carre(0.01), 'gant');
    zones.set(autreMain, 'main_d');
    const paires = pairesHorsDeZone([main, poignet], [manche, autreMain, maillage(SkinnedMesh, carre(0), 'sans zone')], zoneDe, new Set(['main_d|bras_haut_g']));
    expect(paires.map((p) => [p.membre.name, p.zone, p.vetement.name])).toEqual([['poignet', 'avant_bras_d', 'manche'], ['poignet', 'avant_bras_d', 'gant']]);
  });

  /** La main inclinée de pente `pente` en X, sa hauteur `z` au centre. */
  const inclinee = (z: number, pente: number) => carre(z).map((v, i, p) => (i % 3 === 2 ? v + p[i - 2] * pente : v));
  const mesurer = (main_: Float32Array, manche_: Float32Array, t = 0.5, vetement: Mesh = manche) =>
    mesurerMembresDansUnVetement([{ membre: main, zone: 'main_d', vetement }], echantillon(new Map([[main, main_], [vetement, manche_]]), t));

  it('ROUGE : la main traverse la manche, des sommets de chaque côté ; un écart par (zone, mesh, clip) à son pire instant', () => {
    const mesures = [mesurer(inclinee(0.01, 0.2), carre(0.01), 0), mesurer(inclinee(0.01, 0.25), carre(0.01), 1)].flat();
    expect(mesures.map((m) => m.sommets)).toEqual([3, 3]);
    const ecarts = gardeMembreDansUnVetement(mesures, libelle);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toMatchObject({ garde: 'membreDansUnVetement', code: 'membre-dans-un-vetement', mesh: 'manche', clip: 'Coup', t: 1, seuil: ECART_DE_SUIVI_M });
    expect(ecarts[0].valeur).toBeCloseTo(0.025, 6);
  });

  it('VERT : la main entièrement sous la nappe, entièrement devant, dans la tolérance, hors de portée ou ailleurs', () => {
    expect(mesurer(carre(0), carre(0.01))).toEqual([]);
    expect(mesurer(carre(0.02), carre(0.01))).toEqual([]);
    expect(mesurer(inclinee(0.01, ECART_DE_SUIVI_M * 9), carre(0.01))).toEqual([]);
    expect(mesurer(carre(0.01 - PORTEE_DE_COUVERTURE_M * 1.1), carre(0.01))).toEqual([]);
    expect(mesurer(inclinee(0.01, 0.2).map((v, i) => (i % 3 === 0 ? v + 0.5 : v)), carre(0.01))).toEqual([]);
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
});
