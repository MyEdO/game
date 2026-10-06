import type { CibleFigee } from '../../source/lieux.mjs';

export function migrerParAdressesFigees(brut: string, adresses: Readonly<Record<string, CibleFigee>>, fichier: string): {
  texte: string;
  gestes: { id: string; adresse: string }[];
  restantes: string[];
  echecs: string[];
};
