// La pile des couches résolue au montage (#3842) : la couche du dessous cède à celle qui la couvre.
import { describe, expect, it } from 'vitest';
import { couvertureDe, endroitDe, ENTRAINEMENT, HALO_M, JEU_M, PERCEE_M, PORTEE_DE_COUVERTURE_M, SAUT_D_ARETE, SERRAGE_M, ordreDesCouches, resoudreLaPile, type CoucheDePile, type MaillageDePile, type PieceDePile, visiterLaCouverture } from './pile.ts';

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
/** La nappe `m` retournée, tournée vers −Z. */
const retournee = (m: MaillageDePile): MaillageDePile => ({ ...m, indices: m.indices.map((_, i, t) => t[i - (i % 3) + [0, 2, 1][i % 3]]) });
/** La pile de `pieces`, de la plus intérieure à la plus extérieure, sur la peau de positions `peaux`. */
const empiler = (pieces: readonly PieceDePile[], osDeChaine: readonly string[] = [], peaux: readonly Float32Array[] = []) =>
  resoudreLaPile(pieces, (e, f) => pieces.indexOf(e) > pieces.indexOf(f), { parents: PARENTS, osDeChaine: new Set(osDeChaine) }, peaux);

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

  it('un point peu retenu suit son voisin le plus retenu, en fondu avec leur distance', () => {
    const lache = SERRAGE_M + 0.9 * (PORTEE_DE_COUVERTURE_M - SERRAGE_M), pas = 0.2 / 16;
    const dessous = nappe(0, 'bras', 0.2, 16, 0, 'avant_bras');
    const [tenu, voisin] = [sommetEn(dessous, 0), sommetEn(dessous, pas)];
    const [auteurTenu, auteurVoisin] = [poidsSur(dessous, tenu, 'avant_bras'), poidsSur(dessous, voisin, 'avant_bras')];
    empiler([piece(dessous), piece(nappe(SERRAGE_M, 'bras', 0.1, 8, -0.05 + pas / 2), nappe(lache, 'bras', 0.1, 8, 0.05 + pas / 2))]);
    const t = pas / HALO_M;
    expect(1 - poidsSur(dessous, tenu, 'avant_bras') / auteurTenu).toBeCloseTo(1, 6);
    expect(1 - poidsSur(dessous, voisin, 'avant_bras') / auteurVoisin).toBeCloseTo(1 - t * t * (3 - 2 * t), 4);
  });

  it('sur une arête plus longue que le halo, les voisins d’un point suivent les poids que sa couverture lui déplace, au saut près', () => {
    const pas = 0.1;
    const sous = (cx: number, sens: number) => {
      const dessous = nappe(0, 'bras', 4 * pas, 4, 0, 'avant_bras');
      const sommets = [sommetEn(dessous, cx), sommetEn(dessous, cx + sens * pas), sommetEn(dessous, cx + 2 * sens * pas)];
      const auteur = sommets.map((s) => poidsSur(dessous, s, 'avant_bras'));
      empiler([piece(dessous), piece(nappe(SERRAGE_M, 'bras', pas, 8, cx))]);
      return { deplace: auteur[0], suivi: sommets.map((s, k) => 1 - poidsSur(dessous, s, 'avant_bras') / auteur[k]) };
    };
    const beaucoup = sous(pas, -1);
    expect(pas).toBeGreaterThan(HALO_M);
    expect(beaucoup.deplace).toBeGreaterThan(SAUT_D_ARETE);
    expect(beaucoup.suivi[0]).toBeCloseTo(1, 5);
    expect(beaucoup.suivi[1]).toBeCloseTo(1 - SAUT_D_ARETE / beaucoup.deplace, 5);
    expect(beaucoup.suivi[2]).toBeCloseTo(0, 5);
    const peu = sous(-pas, 1);
    expect(peu.deplace).toBeLessThan(SAUT_D_ARETE);
    expect(peu.suivi[0]).toBeCloseTo(1, 5);
    expect(peu.suivi[1]).toBeCloseTo(0, 5);
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

  it('réduit à quatre os, un point perd sur chacun le poids de l’os écarté : deux points qui n’écartent pas le même gardent des poids voisins', () => {
    const surQuatre = (z: number, cote: number, quatrieme: string): MaillageDePile => ({
      ...nappe(z, 'bras', cote), noms: ['bras', 'epaule', 'torse', quatrieme],
      os: Uint16Array.from({ length: 81 * 4 }, (_, k) => k % 4), poids: Float32Array.from({ length: 81 * 4 }, (_, k) => [0.4, 0.3, 0.2, 0.1][k % 4]),
    });
    const sous = (z: number): MaillageDePile => { const dessous = surQuatre(0, 0.1, 'avant_bras'); empiler([piece(dessous), piece(surQuatre(z, 0.2, 'manche'))]); return dessous; };
    const milieu = (SERRAGE_M + PORTEE_DE_COUVERTURE_M) / 2;
    const [pres, loin] = [sous(milieu - 0.0002), sous(milieu + 0.0002)];
    expect(poidsSur(pres, 40, 'avant_bras')).toBe(0);
    expect(poidsSur(loin, 40, 'manche')).toBe(0);
    expect(poidsSur(pres, 40, 'manche')).toBeGreaterThan(0);
    expect(poidsSur(pres, 40, 'manche')).toBeLessThan(0.01);
    expect(poidsSur(loin, 40, 'avant_bras')).toBeLessThan(0.01);
    for (const nom of ['bras', 'epaule', 'torse']) expect(poidsSur(pres, 40, nom)).toBeCloseTo(poidsSur(loin, 40, nom), 2);
    expect(['bras', 'epaule', 'torse', 'manche'].reduce((t, nom) => t + poidsSur(pres, 40, nom), 0)).toBeCloseTo(1, 6);
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

  it('sous une couverture confondue avec lui, chaque point recule de même au bruit près, le long du faîte compris (#3842)', () => {
    /** La nappe de `cote` mètres sur l'os `os`, pliée en toit de faîte x = 0, chaque point déplacé de `bruit(s, axe)`. */
    const toit = (os: string, bruit: (s: number, axe: number) => number): MaillageDePile => {
      const m = nappe(0, os);
      for (let s = 0; s < m.positions.length / 3; s++) {
        m.positions[s * 3 + 2] = 0.5 * (0.1 - Math.abs(m.positions[s * 3]));
        for (let axe = 0; axe < 3; axe++) m.positions[s * 3 + axe] += bruit(s, axe);
      }
      return m;
    };
    /** Un bruit de `signe` × 1e-6 m, de signe tiré par sommet et par axe de la graine `graine`. */
    const bruite = (signe: number, graine: number) => (s: number, axe: number) => {
      const h = Math.sin(s * 12.9898 + axe * 78.233 + graine * 37.719) * 43758.5453;
      return signe * 1e-6 * (h - Math.floor(h) < 0.5 ? -1 : 1);
    };
    const resolu = (signe: number, graine: number) => {
      const sujet = toit('bras', () => 0);
      const avant = Float32Array.from(sujet.positions);
      empiler([piece(sujet), piece(toit('manche', bruite(signe, graine)))]);
      return { avant, apres: sujet.positions };
    };
    const [plus, moins] = [resolu(1, 1), resolu(-1, 2)];
    const sommets = plus.avant.length / 3;
    for (let s = 0; s < sommets; s++) {
      for (const { avant, apres } of [plus, moins]) {
        expect(Math.hypot(apres[s * 3] - avant[s * 3], apres[s * 3 + 1] - avant[s * 3 + 1], apres[s * 3 + 2] - avant[s * 3 + 2])).toBeGreaterThan(JEU_M / 2);
      }
      for (let axe = 0; axe < 3; axe++) expect(Math.abs(plus.apres[s * 3 + axe] - moins.apres[s * 3 + axe])).toBeLessThanOrEqual(1e-5);
    }
  });
});

describe('visiterLaCouverture', () => {
  const couverture = couvertureDe(Float32Array.from([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0]), [0, 1, 2]);
  /** Les triangles visités depuis le point au-dessus du sommet (0, 0) du triangle, décalé de `d` mètres vers son dehors. */
  const visites = (d: number) => {
    const t: number[] = [];
    visiterLaCouverture(-d / Math.SQRT2, -d / Math.SQRT2, 0.005, 0, 0, 1, couverture, (_e, triangle) => t.push(triangle));
    return t;
  };

  it('une projection à la soudure près d’un sommet, hors du triangle, y tombe ; au-delà, non (#3842)', () => {
    expect(visites(1e-6)).toEqual([0]);
    expect(visites(1e-3)).toEqual([]);
  });
});

describe('endroitDe', () => {
  const surface = nappe(0, 'bras');
  const triangles = surface.indices.length;
  /** Une peau faite des points de `surface`, décalés de `z` le long de sa normale. */
  const peauDecalee = (z: number) => nappe(z, 'bras').positions;

  it('une peau dans le plan de la nappe à la soudure près laisse tous ses triangles à l’endroit, de part et d’autre (#3842)', () => {
    expect(endroitDe(surface, [peauDecalee(1e-6)])).toHaveLength(triangles);
    expect(endroitDe(surface, [peauDecalee(-1e-6)])).toHaveLength(triangles);
  });

  it('une peau devant la nappe, du côté de sa normale, n’en laisse aucun à l’endroit', () => {
    expect(endroitDe(surface, [peauDecalee(1e-3)])).toHaveLength(0);
  });
});

describe('la double nappe', () => {
  const peau = nappe(0, 'bras');
  /** Une double nappe sur l'os `os` : sa doublure à la hauteur `z`, tournée vers le corps, son endroit `epaisseur` au-delà. */
  const doubleNappe = (z: number, epaisseur: number, os: string, cote?: number) => [retournee(nappe(z, os, cote)), nappe(z + epaisseur, os, cote)] as const;

  it('la doublure de la couverture ne couvre rien : celle du dessous, sous elle, ne recule pas ; l’endroit de la couverture retient les deux nappes du dessous', () => {
    const [doublure, endroit] = doubleNappe(0.004, 0.002, 'bras', 0.1), [envers, dessus] = doubleNappe(0.008, 0.004, 'manche');
    const bilan = empiler([piece(peau), piece(doublure, endroit), piece(envers, dessus)], [], [peau.positions]);
    for (let s = 0; s < doublure.positions.length / 3; s++) {
      expect(doublure.positions[s * 3 + 2]).toBeCloseTo(0.004, 6);
      expect(poidsSur(doublure, s, 'manche')).toBeCloseTo(1, 6);
      expect(poidsSur(endroit, s, 'manche')).toBeCloseTo(1, 6);
    }
    expect(bilan.recules).toBe(0);
    expect([doublure.indices.length, endroit.indices.length]).toEqual([0, 0]);
  });

  it('à couche égale, deux doubles nappes se votent de leurs endroits : la plus extérieure couvre', () => {
    const couche = (z: number): CoucheDePile => ({ rang: 1, accessoire: false, neutres: [...doubleNappe(z, 0.002, 'bras')] });
    const [dessous, dessus] = [couche(0.004), couche(0.01)];
    const couvre = ordreDesCouches([peau.positions]);
    expect([couvre(dessus, dessous), couvre(dessous, dessus)]).toEqual([true, false]);
    const sansPeau = ordreDesCouches([]);
    expect([sansPeau(dessus, dessous), sansPeau(dessous, dessus)]).toEqual([false, false]);
  });
});

describe('ordreDesCouches', () => {
  /** La couche de rang `rang` faite de nappes aux hauteurs `z`, chacune centrée en `cx`. */
  const couche = (rang: number, nappes: readonly (readonly [z: number, cx: number])[], accessoire = false): CoucheDePile =>
    ({ rang, accessoire, neutres: nappes.map(([z, cx]) => nappe(z, 'bras', 0.2, 8, cx)) });

  it('une couche plus extérieure couvre, même placée dessous ; une pièce ne se couvre pas elle-même', () => {
    const [dedans, dehors] = [couche(1, [[0.01, 0]]), couche(2, [[0, 0]])];
    const couvre = ordreDesCouches([]);
    expect([couvre(dehors, dedans), couvre(dedans, dehors), couvre(dehors, dehors)]).toEqual([true, false, false]);
  });

  it('à couche égale, un accessoire couvre ce qui n’en est pas un, quel que soit le côté', () => {
    const [accessoire, vetement] = [couche(1, [[0, 0]], true), couche(1, [[0.01, 0]])];
    const couvre = ordreDesCouches([]);
    expect([couvre(accessoire, vetement), couvre(vetement, accessoire)]).toEqual([true, false]);
  });

  it('à couche et catégorie égales, celle dont les sommets sont devant l’autre au repos neutre la couvre', () => {
    const [dessus, dessous] = [couche(1, [[0.01, 0]]), couche(1, [[0.005, 0]])];
    const couvre = ordreDesCouches([]);
    expect([couvre(dessus, dessous), couvre(dessous, dessus)]).toEqual([true, false]);
  });

  it('sans sommet de l’une à portée de l’autre, ou à égalité des voix, aucune ne couvre l’autre', () => {
    const couvre = ordreDesCouches([]);
    const [ici, loin] = [couche(1, [[0.01, 0]]), couche(1, [[0.01 - PORTEE_DE_COUVERTURE_M * 1.1, 0]])];
    expect([couvre(ici, loin), couvre(loin, ici)]).toEqual([false, false]);
    const [a, b] = [couche(1, [[0.01, 0], [0, 1]]), couche(1, [[0, 0], [0.01, 1]])];
    expect([couvre(a, b), couvre(b, a)]).toEqual([false, false]);
    expect(couvre(couche(1, [[0.01, 0]]), b)).toBe(true);
  });
});
