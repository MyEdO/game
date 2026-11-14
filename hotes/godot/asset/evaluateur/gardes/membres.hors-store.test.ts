// La garde des membres dans le tronc (#3806) : en clip, un avant-bras ou une main n'entre pas dans le tronc.
import { describe, expect, it } from 'vitest';
import { BoxGeometry, BufferAttribute, BufferGeometry, Mesh } from 'three';
import type { Echantillon } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { gardeMembres, mesurerMembres } from './membres.ts';

/** Un tronc cubique de 0,2 m de côté centré à l'origine ; sans sa face du haut si `ouvert`, comme un cou. */
function tronc(ouvert = false): Mesh {
  const g = new BoxGeometry(0.2, 0.2, 0.2).toNonIndexed();
  if (!ouvert) return new Mesh(g);
  const p = g.attributes.position.array;
  const garde = Array.from({ length: p.length / 9 }, (_, t) => t).filter((t) => ![0, 1, 2].every((k) => p[t * 9 + k * 3 + 2] > 0.099));
  const h = new BufferGeometry();
  h.setAttribute('position', new BufferAttribute(Float32Array.from(garde.flatMap((t) => Array.from(p.slice(t * 9, t * 9 + 9)))), 3));
  return new Mesh(h);
}
const positionsDe = (m: Mesh) => Float32Array.from(m.geometry.attributes.position.array);
/** Une main d'un seul sommet en (x, y, z). */
const main = new Mesh(new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(3), 3)));
main.name = 'main_d';
const libelle = (m: Mesh) => m.name;
const echantillon = (t: Mesh, point: readonly number[], instant = 0.5): Echantillon =>
  ({ clip: 'Lourde_Repos_Loop', t: instant, positions: new Map([[t, positionsDe(t)], [main, Float32Array.from(point)]]), os: new Map() });

describe('membres', () => {
  const ferme = tronc();

  it('dehors, ou contre la peau dans la tolérance : aucun écart', () => {
    expect(mesurerMembres([main], [ferme], echantillon(ferme, [0, -0.15, 0]))).toEqual([]);
    expect(mesurerMembres([main], [ferme], echantillon(ferme, [0.15, 0, 0]))).toEqual([]);
    expect(mesurerMembres([main], [ferme], echantillon(ferme, [0, -0.1 + ECART_DE_SUIVI_M * 0.9, 0]))).toEqual([]);
  });

  it('un tronc ouvert au cou garde son dedans, et rien au-dessus de l’ouverture', () => {
    const cou = tronc(true);
    expect(mesurerMembres([main], [cou], echantillon(cou, [0, 0, 0.12]))).toEqual([]);
    expect(mesurerMembres([main], [cou], echantillon(cou, [0, 0, 0.05]))).toHaveLength(1);
  });

  it('ROUGE : la main entre dans le tronc, un écart à son instant le plus profond', () => {
    const mesures = [[0, -0.07, 0], [0, -0.04, 0.02]].flatMap((p, k) => mesurerMembres([main], [ferme], echantillon(ferme, p, k)));
    const ecarts = gardeMembres(mesures, libelle);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toMatchObject({ garde: 'membres', code: 'membre-dans-le-tronc', mesh: 'main_d', clip: 'Lourde_Repos_Loop', t: 1, seuil: -ECART_DE_SUIVI_M });
    expect(ecarts[0].valeur).toBeCloseTo(-0.06, 6);
  });
});
