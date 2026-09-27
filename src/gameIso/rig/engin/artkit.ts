/**
 * Boîte à outils PARTAGÉE des arts d'engin de siège — type de def + palette à jetons + roues réutilisables.
 * Un art d'engin = 1 fichier `engin/defs/<id>.ts` (registre auto-chargé par `scripts/gen-registry.mjs`,
 * MÊME pattern que les armes/créatures/tenues : « dépose un fichier → intégré », routé par id, jamais de
 * name-matcher ni de table à la main). Coords LOCALES : origine = contact sol au centre, l'objet monte en
 * y NÉGATIF (cf. `groundedBody`). Jetons : `@bois` (charpente), `@fonte`/`@fer` (tube/ferrures), `@corde`
 * (cordage) — les variantes d'ombre/lumière (`@boisO`/`@boisH`/`@ferH`/`@cordeO`/`@cordeH`/`@fonteH`/
 * `@fonteO`) sont dérivées automatiquement par `buildTokenMap`.
 */
import type { PaletteDeclaree } from '../palette';
import type { ViewArt } from '../viewArt';

/** Def d'ART d'engin = id d'espèce (clé de `appearance.species` / `siegeRig`) + son art ORIENTÉ (contrat
 *  PARTAGÉ `ViewArt` : face / profil / dos, chacune un fragment SVG en coords locales). 1 def = 1 fichier
 *  `engin/defs/<id>.ts`. Les trois vues sont déclarées (couverture pleine — les engins sont dessinés sous
 *  les trois angles) ; le repli/sélection vit dans la machinerie (`composeEngin`, via `pickView`). */
export interface EnginArtDef extends ViewArt {
  id: string;
}

/** Palette par défaut d'un engin (bases CUSTOM, ≠ slots créature). */
export const ENGIN_DEFAULT: PaletteDeclaree = { bois: '#6e4a28', fonte: '#3e3a35', fer: '#2c2822', corde: '#c2a86e' };

/** Roue à rayons vue de FACE (cercle), centrée à l'origine locale. */
export const wheelFace = (r: number): string =>
  `<g><circle r="${r}" fill="@bois" stroke="@fer" stroke-width="${r * 0.22}"/>`
  + `<circle r="${r}" fill="none" stroke="@ferH" stroke-width="1.5"/>`
  + `<path d="M0 ${-r + 2} L0 ${r - 2} M${-r + 2} 0 L${r - 2} 0 M${-(r - 3) * 0.7} ${-(r - 3) * 0.7} L${(r - 3) * 0.7} ${(r - 3) * 0.7} M${-(r - 3) * 0.7} ${(r - 3) * 0.7} L${(r - 3) * 0.7} ${-(r - 3) * 0.7}" stroke="@boisO" stroke-width="2.5"/>`
  + `<circle r="${r * 0.24}" fill="@fer"/></g>`;

/** Roue vue de PROFIL/DOS (de bout, fine) — bandage de fer épais. */
export const wheelEdge = (h: number): string =>
  `<g><ellipse rx="${h * 0.27}" ry="${h * 0.5}" fill="@bois" stroke="@fer" stroke-width="3"/>`
  + `<ellipse rx="${h * 0.27}" ry="${h * 0.5}" fill="none" stroke="@ferH" stroke-width="1"/>`
  + `<circle r="3" fill="@fer"/></g>`;
