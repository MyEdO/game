import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Portant à costumes : tringle sur montants chargée de robes et habits suspendus à des cintres. Le
// mobilier des « Rangements des costumes » (24) et de l'atelier des « Couturières » (25) du théâtre.
// Cf. plan officiel NADJ 08 folio 38, image (tringles de vêtements alignées).
export const prop: PropViz = {
  id: 'portant-costumes',
  label: 'Portant à costumes',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="34" ry="8" fill="${P.ombre}" opacity="0.2"/>` +
    // montants + base
    `<rect x="32" y="56" width="5" height="90" fill="${P.boisFonce}"/><rect x="83" y="56" width="5" height="90" fill="${P.boisFonce}"/>` +
    `<path d="M28 146 L42 146 M78 146 L92 146" stroke="${P.boisSombre12}" stroke-width="4" stroke-linecap="round"/>` +
    // tringle
    `<rect x="32" y="56" width="56" height="5" rx="2.5" fill="${P.boisFonce34}"/>` +
    // robes/habits suspendus (drapés colorés)
    `<path d="M40 60 Q36 96 42 124 Q48 96 44 60 Z" fill="${P.sangFonce6}"/>` +
    `<path d="M52 60 Q48 100 54 128 Q60 100 56 60 Z" fill="${P.azurFonce3}"/>` +
    `<path d="M64 60 Q60 98 66 124 Q72 98 68 60 Z" fill="${P.feuillageFonce14}"/>` +
    `<path d="M76 60 Q72 96 78 122 Q84 96 80 60 Z" fill="${P.orFonce10}"/>` +
    // cintres (petits crochets sur la tringle)
    `<g stroke="${P.terreSombre6}" stroke-width="1.6" fill="none"><path d="M42 56 l0 4"/><path d="M54 56 l0 4"/><path d="M66 56 l0 4"/><path d="M78 56 l0 4"/></g></g>`,
};
