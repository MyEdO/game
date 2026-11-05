export type Arete = readonly [number, number];
type Voisin = readonly [rang: number, poids: number];
type Bord = readonly [rang: number, sommet: number, poids: number];

export interface Laplacien {
  readonly libres: readonly number[];
  readonly rang: readonly number[];
  readonly diagonale: readonly number[];
  readonly voisins: readonly (readonly Voisin[])[];
  readonly bord: readonly Bord[];
  readonly isolees: readonly (readonly number[])[];
}

function verifierAretes(nombreDeSommets: number, aretes: readonly Arete[]): void {
  if (aretes.some(([i, j]) => !Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= nombreDeSommets || j >= nombreDeSommets)) throw new Error('laplacien : arête hors du maillage');
}

/** #3104 issuecomment-6554320467. */
export function poidsRelatifsDesAretes(positions: readonly (readonly number[])[], aretes: readonly Arete[]): number[] {
  verifierAretes(positions.length, aretes);
  return aretes.map(([i, j]) => {
    const longueur2 = positions[i].reduce((s, v, c) => s + (v - positions[j][c]) ** 2, 0);
    if (longueur2 === 0) throw new Error(`laplacien : arete-de-longueur-nulle ${i}-${j}`);
    if (!Number.isFinite(longueur2)) throw new Error(`laplacien : longueur non finie ${i}-${j}`);
    return 1 / longueur2;
  });
}

/** #3104 issuecomment-6543628310. */
export function preparerLaplacien(fixes: readonly boolean[], aretes: readonly Arete[], poids: readonly number[]): Laplacien {
  verifierAretes(fixes.length, aretes);
  if (poids.length !== aretes.length || poids.some((w) => !Number.isFinite(w) || w <= 0)) throw new Error('laplacien : un poids positif fini par arête attendu');
  const libres = fixes.flatMap((fixe, i) => fixe ? [] : [i]);
  const rang = fixes.map(() => -1);
  libres.forEach((sommet, i) => { rang[sommet] = i; });
  const diagonale = libres.map(() => 0);
  const voisins = libres.map((): Voisin[] => []);
  const bord: Bord[] = [];
  for (const [e, [i, j]] of aretes.entries()) {
    const w = poids[e];
    for (const [a, b] of [[i, j], [j, i]]) {
      const p = rang[a], q = rang[b];
      if (p < 0) continue;
      diagonale[p] += w;
      if (q >= 0) voisins[p].push([q, w]);
      else bord.push([p, b, w]);
    }
  }
  const visites = libres.map(() => false);
  const appuyes = new Set(bord.map(([p]) => p));
  const isolees: number[][] = [];
  for (let p = 0; p < libres.length; p++) {
    if (visites[p]) continue;
    const composante = [p];
    visites[p] = true;
    let appui = false;
    for (let k = 0; k < composante.length; k++) {
      const i = composante[k];
      appui ||= appuyes.has(i);
      for (const [j] of voisins[i]) if (!visites[j]) { visites[j] = true; composante.push(j); }
    }
    if (!appui) isolees.push(composante);
  }
  return { libres, rang, diagonale, voisins, bord, isolees };
}

/** #3104 issuecomment-6543628310. */
export function resoudreLaplacien(laplacien: Laplacien, seconds: readonly (readonly number[])[]): number[][] {
  const { libres, diagonale, voisins, isolees } = laplacien;
  if (isolees.length) throw new Error('laplacien : composante sans appui');
  const n = libres.length;
  if (seconds.length !== n) throw new Error('laplacien : second membre de taille incorrecte');
  if (!n) return [];
  const colonnes = seconds[0].length;
  if (seconds.some((ligne) => ligne.length !== colonnes || ligne.some((v) => !Number.isFinite(v)))) throw new Error('laplacien : second membre non fini ou irrégulier');
  const resultat = libres.map(() => Array<number>(colonnes).fill(0));
  const debuts = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) debuts[i + 1] = debuts[i] + voisins[i].length;
  const indices = new Int32Array(debuts[n]), poids = new Float64Array(debuts[n]), diagonales = Float64Array.from(diagonale);
  for (let i = 0; i < n; i++) voisins[i].forEach(([j, w], k) => { indices[debuts[i] + k] = j; poids[debuts[i] + k] = w; });
  const ap = new Float64Array(n);
  const produit = (v: Float64Array): Float64Array => {
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = debuts[i]; k < debuts[i + 1]; k++) s += poids[k] * v[indices[k]];
      ap[i] = diagonales[i] * v[i] - s;
    }
    return ap;
  };
  const dot = (a: Float64Array, b: Float64Array): number => {
    let s = 0;
    for (let i = 0; i < n; i++) s += a[i] * b[i];
    return s;
  };
  for (let c = 0; c < colonnes; c++) {
    const x = new Float64Array(n);
    const r = Float64Array.from(seconds, (ligne) => ligne[c]);
    const z = Float64Array.from(r, (v, i) => v / diagonale[i]);
    const p = z.slice();
    let rz = dot(r, z);
    const tolerance = Math.max(1e-26, dot(r, r) * 1e-26);
    let tour = 0;
    while (dot(r, r) > tolerance) {
      if (tour++ >= Math.max(100, n * 4)) throw new Error('laplacien : résolution non convergée');
      produit(p);
      const alpha = rz / dot(p, ap);
      for (let i = 0; i < n; i++) { x[i] += alpha * p[i]; r[i] -= alpha * ap[i]; z[i] = r[i] / diagonale[i]; }
      const suivant = dot(r, z);
      const beta = suivant / rz;
      for (let i = 0; i < n; i++) p[i] = z[i] + beta * p[i];
      rz = suivant;
    }
    for (let i = 0; i < n; i++) resultat[i][c] = x[i];
  }
  return resultat;
}
