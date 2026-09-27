/**
 * BASCULE DE LA FORCE DU VENT — primitive PURE partagée par la mer (MDG 13 l.272) et le fleuve
 * (MSRC 07 l.21). Seuil et nombre de tirages sont des DONNÉES du dataset
 * appelant (`sea-weather.json`, `river-navigation.json`).
 */

/** Force au terme de `tirages` mises à jour sur l'échelle ORDONNÉE `forces` : un d10 égal à `seuil`
 *  fait basculer d'un cran (second d10 ≤ 5 → cran supérieur), les extrémités ne basculent que vers
 *  l'intérieur. `d10` est injecté par l'appelant. PUR. */
export function basculesDeForce<T>(forces: readonly T[], courante: T, seuil: number, tirages: number, d10: () => number): T {
  let force = courante;
  for (let n = 0; n < tirages; n++) {
    if (d10() !== seuil) continue;
    const i = forces.indexOf(force);
    const forcit = d10() <= 5;
    force = forces[i === 0 ? 1 : i === forces.length - 1 ? forces.length - 2 : i + (forcit ? 1 : -1)];
  }
  return force;
}
