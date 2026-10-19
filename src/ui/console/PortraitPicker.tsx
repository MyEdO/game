import type { ReactNode } from 'react';
import { CharFrame } from '../CharFrame';
import type { CharSize, CharVariant } from '../PortraitTile';
import type { Combatant } from '../../engine/types';

/** Un choix du picker : le combattant + une légende optionnelle (valeur/rôle) + infobulle. */
export interface PortraitChoice {
  c: Combatant;
  /** Légende sous le portrait (ex. « cible 46 », « Monture »). */
  caption?: ReactNode;
  /** NOM ACCESSIBLE du portrait (cf. `CharFrame.nom`) — jamais une infobulle écrite ici. */
  nom?: string;
  disabled?: boolean;
}

/**
 * Sélecteur de personnage PAR PORTRAIT — source UNIQUE de « montrer, pas écrire » : choisir un héros
 * en cliquant son portrait. Réutilisé par l'attribution de butin (`GearAssignList`), la cible montée
 * (`MountTargetModal`, cavalier/monture) et le choix du lanceur d'un Test (`useTestJetProps`). Rend
 * une grille de `CharFrame` cliquables (anneau d'identité + état `selected` mis en avant), légende
 * optionnelle. Le métier (que fait le clic) reste chez l'appelant via `onPick`.
 */
export function PortraitPicker({ choices, selectedId, onPick, variant = 'vital', size = 'sm' }: {
  choices: PortraitChoice[];
  /** Portrait mis en avant (choix courant). Absent = pas de sélection persistante (clic = action). */
  selectedId?: string;
  onPick: (id: string) => void;
  variant?: CharVariant;
  size?: CharSize;
}) {
  return (
    <div className="rm-loc-grid portrait-picker">
      {choices.map(({ c, caption, nom, disabled }) => (
        <span key={c.id} className="frame-pick">
          <CharFrame
            c={c}
            variant={variant}
            size={size}
            selected={selectedId != null && c.id === selectedId}
            onClick={disabled ? undefined : () => onPick(c.id)}
            nom={nom}
          />
          {caption != null && <span className="cap">{caption}</span>}
        </span>
      ))}
    </div>
  );
}
