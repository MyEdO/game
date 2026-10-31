export type Arete = readonly [number, number];

export interface Laplacien {
  readonly libres: readonly number[];
  readonly rang: readonly number[];
  readonly diagonale: readonly number[];
  readonly voisins: readonly (readonly number[])[];
  readonly bord: readonly Arete[];
  readonly isolees: readonly (readonly number[])[];
}

/** #3104 issuecomment-6543628310. */
export function preparerLaplacien(fixes: readonly boolean[], aretes: readonly Arete[]): Laplacien {
  const libres = fixes.flatMap((fixe, i) => fixe ? [] : [i]);
  const rang = fixes.map(() => -1);
  libres.forEach((sommet, i) => { rang[sommet] = i; });
  const diagonale = libres.map(() => 0);
  const voisins = libres.map((): number[] => []);
  const bord: Arete[] = [];
  for (const [i, j] of aretes) {
    if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= fixes.length || j >= fixes.length) throw new Error('laplacien : arête hors du maillage');
    for (const [a, b] of [[i, j], [j, i]]) {
      const p = rang[a], q = rang[b];
      if (p < 0) continue;
      diagonale[p]++;
      if (q >= 0) voisins[p].push(q);
      else bord.push([p, b]);
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
      for (const j of voisins[i]) if (!visites[j]) { visites[j] = true; composante.push(j); }
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
  const produit = (v: Float64Array): Float64Array => Float64Array.from(v, (x, i) => diagonale[i] * x - voisins[i].reduce((s, j) => s + v[j], 0));
  const dot = (a: Float64Array, b: Float64Array): number => a.reduce((s, x, i) => s + x * b[i], 0);
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
      const ap = produit(p);
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
