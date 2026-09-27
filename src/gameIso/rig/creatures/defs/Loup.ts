import type { CreatureDef } from '../types';

// Loup — fidélité à l'artwork officiel (art-ref/ldb/page317_img7353.png, LDB 78 p.317) : pelage
// brun/fauve/gris MÊLÉ (taches sombres + poitrail/ventre beige, plus la robe grise monochrome),
// gueule GRANDE OUVERTE babines retroussées à crocs multiples (tête 'loup-feroce' dédiée — les
// félins qui empruntent 'loup' gardent la gueule fermée), queue fournie portée BASSE derrière le
// corps ('touffe-basse', pointe sombre), tête portée en avant au ras du garrot (headPitch).
// Silhouette conservée : LONGUE SUR PATTES (≠ molosse trapu du Chien), poitrail profond, fraise
// hirsute au garrot.
export const creature: CreatureDef = {
  label: "Loup",
  id: "loup",
  plan: 'quadruped',
  quad: {
    sl: 0.82, build: 'canine', girth: 0.95, bodyLen: 0.98, neckLen: 0.66, neckAngle: -15,
    legLen: 0.98, head: 'loup-feroce', headScale: 1.14, headPitch: 4, tail: 'touffe-basse',
    tailLen: 1.15, ears: 'pointues', foot: 'patte', mane: 'hirsute', markings: 'taches',
    palette: {
      corps: '#7b6b52', corpsO: '#3f3427', corpsH: '#d4c39c', // robe brun-fauve, ombres brun sombre, beige du poitrail/dos
      cheveux: '#33291d', cheveuxO: '#1c150e', // fourrure sombre (fraise, épi, pointe de queue)
      cuir: '#2b241c', // coussinets/griffes
    },
  },
};
