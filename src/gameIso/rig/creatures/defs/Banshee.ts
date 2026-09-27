import type { CreatureDef } from '../types';

// Banshee — gabarit spectral calé sur l'artwork officiel (art-ref/ldb/page329_img8028.png) :
// spectre féminin bleu-gris translucide à CHEVELURE ROUSSE flottante, visage humain hurlant
// mâchoire décrochée (face:'hurle' — LDB 82 l.13 « hurlements déchirants… arrêter leur cœur »,
// Terreur 3 l.17), épée brandie bras levé (arme:'epee'). Le roux + l'épée la distinguent du
// Fantôme (bleu-blanc nu, cri) et du Spectre (capuche verte + crâne). NB : hood:true
// masquerait cri et chevelure (la capuche ignore `face` et couvre `cheveux`).
export const creature: CreatureDef = {
  label: 'Banshee',
  id: "banshee",
  plan: 'spectral',
  spectre: {
    sl: 0.96, hood: false, face: 'hurle', cheveux: true, arme: 'epee',
    palette: { corps: '#8fa4b6', corpsO: '#232f3a', corpsH: '#dcebf5', cheveux: '#c25a28', cheveuxO: '#7c3418', cuir: '#4e5a68' },
  },
};
