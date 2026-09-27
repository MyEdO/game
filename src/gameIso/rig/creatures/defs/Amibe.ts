import type { CreatureDef } from '../types';

// Amibe (« diable gluant ») — gabarit amorphe, forme `gel`, fidèle à l'artwork ZI 5 p.48 : masse
// GÉLATINEUSE TRANSLUCIDE gris-turquoise dressée (plus haute que large), fine membrane rosâtre,
// SANS visage — son identité = les proies englouties visibles par transparence (squelette, épée,
// débris) au-dessus d'un socle de vase sombre où la digestion s'achève. « Sorte de gelée
// hostile » exsudant un acide digestif, « hautement inflammable » (ZI 44). Sans ce def + son
// nom-espèce, le record sans `appearance.species` retombait sur le bipède Humain par défaut
// (resolveRender). Réutilisé par Jetsam (« très grosse amibe intelligente ») via
// `appearance.species: "Amibe"`.
export const creature: CreatureDef = {
  label: 'Amibe',
  id: "amibe",
  plan: 'amorphous',
  // girth 0.95 : masse dressée, plus haute que large (l'artwork monte en colonne bosselée).
  // corps = gelée turquoise pâle (posée en fill-opacity par la forme `gel`), membrane = contour
  // rosâtre, corpsH = lumière/bulles, cheveux(+O) = vase sombre du socle et
  // silhouettes des objets engloutis, cuir = os du squelette digéré.
  hulk: {
    sl: 1.15, girth: 0.95, form: 'gel',
    palette: { corps: '#7cecc2', membrane: '#c8a8b2', corpsH: '#d9fff0', cheveux: '#3d534f', cheveuxO: '#22302d', cuir: '#8d968c' },
  },
};
