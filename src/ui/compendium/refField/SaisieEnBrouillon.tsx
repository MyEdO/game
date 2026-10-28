import { useState } from 'react';
import { SaisieSuggeree, type SuggestionsPartagees } from './RefField';

type Controle =
  | { lignes?: undefined; suggestions?: readonly string[] | SuggestionsPartagees }
  | { lignes: number; suggestions?: never };

/** Saisie EN CHAÎNE d'une valeur structurée, tenue en BROUILLON local : la frappe ne s'émet pas, elle se
 *  relit UNE fois à la fin de la saisie (blur, et Entrée hors `lignes`) par `relire` contre la valeur
 *  courante. La chaîne normalisée (`afficher`) ne réécrit donc jamais le texte sous les doigts, et aucun
 *  état intermédiaire n'atteint la valeur. Le brouillon ne déclare PAS de saisie en cours au porteur du
 *  geste d'enregistrement : il se pose toujours, et tout geste vers ce bouton passe par le blur qui le
 *  pose. Le pilote est la valeur AFFICHÉE : quand elle change sous un brouillon (un porteur réutilisé
 *  pour un autre objet), le brouillon tombe. `lignes` : un `<textarea>` de ce nombre de rangées, sinon
 *  la `SaisieSuggeree`. */
export function SaisieEnBrouillon<T>(
  { value, afficher, relire, onChange, ariaLabel, placeholder, lignes, suggestions }:
  Controle & {
    value: T; afficher: (v: T) => string; relire: (texte: string, avant: T) => T; onChange: (v: T) => void;
    ariaLabel?: string; placeholder?: string;
  },
) {
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const affiche = afficher(value);
  const [vu, setVu] = useState(affiche);
  if (vu !== affiche) {
    setVu(affiche);
    setBrouillon(null);
  }
  const poser = () => {
    if (brouillon === null) return;
    setBrouillon(null);
    onChange(relire(brouillon, value));
  };
  const texte = brouillon ?? affiche;
  if (lignes !== undefined) {
    return (
      <textarea
        rows={lignes} value={texte} aria-label={ariaLabel} placeholder={placeholder}
        onChange={(e) => setBrouillon(e.target.value)} onBlur={poser} />
    );
  }
  return (
    <SaisieSuggeree
      suggestions={suggestions} value={texte} ariaLabel={ariaLabel} placeholder={placeholder}
      onChange={setBrouillon} onValider={poser} />
  );
}
