import type { CreatureDef } from '../types';

// Happeur carnivore (Compagnon T1 ch.11) : « reptile bipède d'environ 3 mètres de long […]
// poids réparti autour des pattes arrière, lourde queue d'équilibre, membres antérieurs
// petits et presque inutiles ; corps tacheté du vert foncé au brun sombre sur le dos,
// ventre chamois ». Plan avian en mode THÉROPODE. Trait Taille (Grande) → ×1.45 au spawn.
// Stats = source de CAMPAGNE → CustomStatblock dans la scène, jamais creatures.json.
export const creature: CreatureDef = {
  label: 'Happeur carnivore',
  id: "happeur-carnivore",
  plan: 'avian',
  bird: {
    sl: 1.15, girth: 1.05, theropod: true, tailLen: 1.1,
    palette: { corps: '#556032', corpsO: '#2e3519', corpsH: '#cfba8c', cuir: '#8a7a4e' },
  },
};
