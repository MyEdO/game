// La pile des couches résolue au montage (#3842) : la couche du dessous cède à celle qui la couvre.
import { describe, expect, it } from 'vitest';
import { ENTRAINEMENT, HALO_M, JEU_M, PERCEE_M, PORTEE_DE_COUVERTURE_M, SERRAGE_M, resoudreLaPile, type MaillageDePile, type PieceDePile } from './pile.ts';

/** Une nappe carrée de `cote` mètres centrée en (`cx`, 0) à la hauteur `z`, en grille de `n` × `n` mailles, tournée vers
 *  +Z. Elle est tout entière sur l'os `os`, ou, avec `vers`, passe de `os` à `vers` par des poids tous différents d'un
 *  sommet à l'autre. */
function nappe(z: number, os: string, cote = 0.2, n = 8, cx = 0, vers?: string): MaillageDePile {
  const positions: number[] = [], indices: number[] = [], poids: number[] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    positions.push(cx + (i / n - 0.5) * cote, (j / n - 0.5) * cote, z);
    const part = vers ? 0.05 + (0.8 * i + 0.1 * j / (n + 1)) / n : 0;
    poids.push(1 - part, part, 0, 0);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i;
    indices.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1);
  }
  const sommets = positions.length / 3;
  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices), os: Uint16Array.from({ length: sommets * 4 }, (_, k) => (k % 4 === 1 ? 1 : 0)), poids: Float32Array.from(poids), noms: vers ? [os, vers] : [os, os] };
}
const piece = (...maillages: MaillageDePile[]): PieceDePile => ({ maillages });
/** Le poids du sommet `s` de `m` sur l'os `nom`. */
const poidsSur = (m: MaillageDePile, s: number, nom: string): number =>
  [0, 1, 2, 3].reduce((t, k) => t + (m.noms[m.os[s * 4 + k]] === nom ? m.poids[s * 4 + k] : 0), 0);
/** Le sommet de `m` le plus proche de (`x`, `y`). */
const sommetEn = (m: MaillageDePile, x: number, y = 0): number => {
  let proche = 0;
  for (let s = 1; s < m.positions.length / 3; s++) {
    if (Math.hypot(m.positions[s * 3] - x, m.positions[s * 3 + 1] - y) < Math.hypot(m.positions[proche * 3] - x, m.positions[proche * 3 + 1] - y)) proche = s;
  }
  return proche;
};
/** Les parents des os des fixtures. */
const PARENTS = new Map([['manche', 'bras'], ['avant_bras', 'bras'], ['bras', 'epaule'], ['epaule', 'torse'], ['jupe_1', 'bassin'], ['jupe_2', 'jupe_1'], ['jambe', 'bassin']]);
/** La pile de `pieces`, de la plus intérieure à la plus extérieure. */
const empiler = (pieces: readonly PieceDePile[], osDeChaine: readonly string[] = []) =>
  resoudreLaPile(pieces, (e, f) => pieces.indexOf(e) > pieces.indexOf(f), { parents: PARENTS, osDeChaine: new Set(osDeChaine) });

describe('resoudreLaPile', () => {
  it('un point couvert reprend les poids de sa couverture, et son triangle ne se dessine plus', () => {
    const dessous = nappe(0, 'bras', 0.1), dessus = nappe(SERRAGE_M, 'manche');
    const bilan = empiler([piece(dessous), piece(dessus)]);
    for (let s = 0; s < dessous.positions.length / 3; s++) expect(poidsSur(dessous, s, 'manche')).toBeCloseTo(1, 6);
    expect(dessous.indices).toHaveLength(0);
    expect(dessus.indices).toHaveLength(8 * 8 * 6);
    expect(poidsSur(dessus, 0, 'manche')).toBe(1);
    expect(bilan).toMatchObject({ couverts: 81, recules: 0, flottants: 0, masques: 128 });
  });

  it('entre le serrage et la portée, sa couverture le retient de moins en moins, et son triangle se dessine', () => {
    const dessous = nappe(0, 'bras', 0.1), dessus = nappe((SERRAGE_M + PORTEE_DE_COUVERTURE_M) / 2, 'manche');
    expect(empiler([piece(dessous), piece(dessus)])).toMatchObject({ couverts: 81, masques: 0 });
    expect(poidsSur(dessous, 40, 'manche')).toBeCloseTo(0.5, 6);
    expect(poidsSur(dessous, 40, 'bras')).toBeCloseTo(0.5, 6);
    expect(dessous.indices).toHaveLength(8 * 8 * 6);
  });

  it('un point devant sa couverture, ou à moins du jeu derrière elle, recule au jeu', () => {
    for (const z of [PERCEE_M / 2, -JEU_M / 3]) {
      const dessous = nappe(z, 'bras', 0.1), dessus = nappe(0, 'manche');
      const bilan = empiler([piece(dessous), piece(dessus)]);
      for (let s = 0; s < dessous.positions.length / 3; s++) expect(dessous.positions[s * 3 + 2]).toBeCloseTo(-JEU_M, 6);
      expect(bilan.recules).toBe(81);
    }
  });

  it('au-delà de la portée derrière sa couverture, ou de la percée devant elle, un point n’est pas couvert', () => {
    for (const z of [-PORTEE_DE_COUVERTURE_M * 1.5, PERCEE_M * 2]) {
      const dessous = nappe(z, 'bras', 0.1), dessus = nappe(0, 'manche');
      const avant = Float32Array.from(dessous.positions);
      expect(empiler([piece(dessous), piece(dessus)])).toMatchObject({ couverts: 0, suiveurs: 0, recules: 0, masques: 0 });
      expect(poidsSur(dessous, 40, 'bras')).toBe(1);
      expect(dessous.positions).toEqual(avant);
    }
  });

  it('au bord du recouvrement, les voisins suivent en fondu jusqu’au halo, et gardent leurs triangles', () => {
    const dessous = nappe(0, 'bras', 0.4, 32, 0, 'avant_bras'), dessus = nappe(SERRAGE_M, 'bras', 0.1);
    const [dedans, pres, loin] = [sommetEn(dessous, 0), sommetEn(dessous, 0.05 + HALO_M / 2), sommetEn(dessous, 0.05 + HALO_M * 1.5)];
    const [auteurPres, auteurLoin] = [poidsSur(dessous, pres, 'avant_bras'), poidsSur(dessous, loin, 'avant_bras')];
    const bilan = empiler([piece(dessous), piece(dessus)]);
    expect(poidsSur(dessous, dedans, 'avant_bras')).toBeCloseTo(0, 6);
    expect(poidsSur(dessous, pres, 'avant_bras')).toBeGreaterThan(0);
    expect(poidsSur(dessous, pres, 'avant_bras')).toBeLessThan(auteurPres);
    expect(poidsSur(dessous, pres, 'bras') + poidsSur(dessous, pres, 'avant_bras')).toBeCloseTo(1, 6);
    expect(poidsSur(dessous, loin, 'avant_bras')).toBe(auteurLoin);
    expect(bilan.suiveurs).toBeGreaterThan(0);
    const dessines = new Set(dessous.indices);
    expect(dessines.has(pres)).toBe(true);
    expect(dessines.has(dedans)).toBe(false);
  });

  it('un bloc que son auteur lie aux mêmes poids ne cède qu’autant que le moins retenu de ses points', () => {
    const lache = (SERRAGE_M + PORTEE_DE_COUVERTURE_M) / 2;
    const dessous = nappe(0, 'bras', 0.08), dessus = piece(nappe(SERRAGE_M, 'manche', 0.1, 8, -0.05), nappe(lache, 'manche', 0.1, 8, 0.05));
    empiler([piece(dessous), dessus]);
    for (let s = 0; s < dessous.positions.length / 3; s++) expect(poidsSur(dessous, s, 'manche')).toBeCloseTo(0.5, 6);
    const decouvert = nappe(0, 'bras', 0.4, 32);
    empiler([piece(decouvert), piece(nappe(SERRAGE_M, 'manche', 0.1))]);
    for (let s = 0; s < decouvert.positions.length / 3; s++) expect(poidsSur(decouvert, s, 'bras')).toBe(1);
  });

  it('une couverture portée par une chaîne ne retient pas ce qu’une chaîne ne porte pas', () => {
    const dessous = nappe(0, 'jambe', 0.1), dessus = nappe(SERRAGE_M, 'jupe_1');
    const bilan = empiler([piece(dessous), piece(dessus)], ['jupe_1']);
    expect(poidsSur(dessous, 40, 'jambe')).toBe(1);
    expect(dessous.indices).toHaveLength(8 * 8 * 6);
    expect(bilan).toMatchObject({ couverts: 0, flottants: 81, masques: 0 });
  });

  it('une couverture portée par une chaîne retient ce que la même chaîne porte', () => {
    const dessous = nappe(0, 'jupe_1', 0.1), dessus = nappe(SERRAGE_M, 'jupe_2');
    empiler([piece(dessous), piece(dessus)], ['jupe_1', 'jupe_2']);
    expect(poidsSur(dessous, 40, 'jupe_2')).toBeCloseTo(1, 6);
  });

  it('une couverture ne retient pas un point d’une autre partie du corps, ni des siens ni de leurs parents', () => {
    const dessous = nappe(0, 'jambe', 0.1), dessus = nappe(SERRAGE_M, 'manche');
    const bilan = empiler([piece(dessous), piece(dessus)]);
    expect(poidsSur(dessous, 40, 'jambe')).toBe(1);
    expect(bilan).toMatchObject({ couverts: 0, flottants: 81, masques: 0 });
  });

  it('sous deux couvertures qui le retiennent, un point reprend les poids de la plus extérieure', () => {
    const peau = nappe(0, 'bras', 0.1), chemise = nappe(SERRAGE_M / 2, 'epaule', 0.15), pourpoint = nappe(SERRAGE_M, 'avant_bras');
    empiler([piece(peau), piece(chemise), piece(pourpoint)]);
    expect(poidsSur(chemise, sommetEn(chemise, 0), 'epaule')).toBe(1);
    expect(poidsSur(peau, sommetEn(peau, 0), 'avant_bras')).toBeCloseTo(1, 6);
  });

  it('les sommets confondus de deux maillages d’une pièce restent liés pareil', () => {
    const gauche = nappe(0, 'bras', 0.1, 8, -0.05), droite = nappe(0, 'torse', 0.1, 8, 0.05), dessus = nappe(SERRAGE_M, 'manche', 0.1, 8, -0.05);
    empiler([piece(gauche, droite), piece(dessus)]);
    const [g, d] = [sommetEn(gauche, 0, 0), sommetEn(droite, 0, 0)];
    expect(gauche.positions.slice(g * 3, g * 3 + 3)).toEqual(droite.positions.slice(d * 3, d * 3 + 3));
    for (const nom of ['bras', 'torse', 'manche']) expect(poidsSur(gauche, g, nom)).toBeCloseTo(poidsSur(droite, d, nom), 6);
    expect(poidsSur(droite, d, 'manche')).toBeGreaterThan(0);
  });

  it('entre un point qui recule et son voisin, l’écart de recul ne dépasse pas la moitié de la hauteur de leur triangle', () => {
    const dessous = nappe(0.002, 'bras', 0.4, 64), dessus = nappe(0, 'manche', 0.1);
    const avant = Float32Array.from(dessous.positions), triangles = Uint32Array.from(dessous.indices);
    empiler([piece(dessous), piece(dessus)]);
    const recul = (s: number) => dessous.positions[s * 3 + 2] - avant[s * 3 + 2];
    expect(recul(sommetEn(dessous, 0))).toBeCloseTo(-0.002 - JEU_M, 6);
    const hauteur = 0.4 / 64 / Math.SQRT2;
    for (let t = 0; t < triangles.length; t += 3) for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      expect(Math.abs(recul(triangles[t + a]) - recul(triangles[t + b]))).toBeLessThanOrEqual(ENTRAINEMENT * hauteur + 1e-5);
    }
    expect(recul(sommetEn(dessous, 0.19))).toBe(0);
  });
});
