import { P } from '../decorPalette';

/**
 * Ébénisterie partagée du décor — le TRACÉ commun de l'escalier de bois, moissonné des defs
 * `escalier-loge`/`escalier-bois` pour mutualiser l'invariant (credo). Ce fichier vit HORS de `defs/` : il
 * n'est PAS scanné par le registre (aucun `export const prop`). Chaque def appelle la fonction pure en
 * injectant ses tons : la variante loge passe des dorures, la variante générique reste en bois nu — même
 * géométrie, matériau distinct. Canvas local 120×150, ancré aux pieds (~y=147). Les tons de MARCHES/CORPS
 * restent fixes (le bois), seuls rampe et pommeaux varient.
 */

/** Volée de marches (1×1) montant vers l'arrière (haut-gauche) + rampe et pommeaux dans les tons fournis. */
export function woodStairSvg(opts: { railColor: string; knobColor: string }): string {
  const { railColor, knobColor } = opts;
  return (
    `<g><ellipse cx="60" cy="147" rx="46" ry="8" fill="${P.ombre}" opacity="0.2"/>` +
    [0, 1, 2, 3, 4, 5]
      .map((i) => {
        const w = 84 - i * 6;
        const x = 20 + i * 3;
        const y = 134 - i * 16;
        return (
          `<rect x="${x}" y="${y}" width="${w}" height="16" rx="2" fill="${P.boisFonce12}"/>` + // contremarche (face avant, sombre)
          `<rect x="${x - 3}" y="${y - 5}" width="${w + 6}" height="7" rx="2" fill="${P.boisFonce8}"/>` + // nez de marche (clair)
          `<rect x="${x - 3}" y="${y - 5}" width="${w + 6}" height="2" fill="${P.boisMoyen3}"/>` // reflet
        );
      })
      .join('') +
    `<path d="M16 140 L34 52" stroke="${railColor}" stroke-width="3" fill="none"/>` + // rampe
    `<g fill="${knobColor}"><circle cx="16" cy="140" r="3.4"/><circle cx="34" cy="52" r="3.8"/></g></g>`
  );
}
