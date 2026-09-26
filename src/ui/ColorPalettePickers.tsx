import type { Palette } from '../gameIso/rig/palette';
import { defautDe, projectionEditeur } from '../gameIso/rig/clesDePalette';

/** Emplacements de couleur exposés (ordre d'affichage) — HUMANOÏDE (héros/PNJ). */
const COLOR_SLOTS = projectionEditeur(['peau', 'cheveux', 'yeux', 'vet1', 'vet2', 'cuir', 'metal']);

/** Liste COMPLÈTE pour l'éditeur (PNJ humanoïde OU créature) : les 7 humanoïdes + corps
 *  (pelage/robe des créatures) + accent. Couvre tout ce que le rig sait recolorier. */
export const MONSTER_COLOR_SLOTS = projectionEditeur(
  ['peau', 'cheveux', 'yeux', 'vet1', 'vet2', 'cuir', 'metal', 'corps', 'accent'],
  { peau: 'Peau / museau', cheveux: 'Cheveux / crinière', cuir: 'Cuir / sabots' },
);

/**
 * Sélecteurs de couleur de palette. `slots` choisit le jeu d'emplacements (défaut = humanoïde ;
 * `MONSTER_COLOR_SLOTS` pour une créature). Partagé créateur héros ET éditeur (PNJ/créatures).
 * Une valeur absente = défaut de la table des clés de palette ; ✕ réinitialise le slot.
 */
export function ColorPalettePickers({
  colors,
  onColors,
  slots = COLOR_SLOTS,
}: {
  colors?: Palette;
  onColors: (patch: Partial<Palette>) => void;
  slots?: [label: string, slot: keyof Palette][];
}) {
  return (
    <div className="color-pickers">
      <span className="color-pickers-title">Couleurs</span>
      <div className="color-grid">
        {slots.map(([lbl, slot]) => (
          <label key={slot} className={`color-chip${colors?.[slot] ? ' custom' : ''}`} title={lbl}>
            <input type="color" value={colors?.[slot] ?? defautDe(slot)} onChange={(e) => onColors({ [slot]: e.target.value })} />
            <span className="color-chip-label">{lbl}</span>
            {colors?.[slot] && (
              <button
                type="button"
                className="color-chip-reset"
                title="Réinitialiser"
                onClick={(e) => {
                  e.preventDefault();
                  onColors({ [slot]: undefined });
                }}
              >
                ✕
              </button>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
