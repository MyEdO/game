import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { useGame } from '../state/store';
import { runBindingById, type IdDeRaccourci } from '../state/clavier/keybindings';

/**
 * Croix directionnelle TACTILE de la vue subjective (POV). Ne crée AUCUN chemin d'entrée parallèle :
 * chaque bouton dispatche le MÊME id de raccourci que le clavier/la manette (`runBindingById`), dont la
 * garde `exploringPov` autorise l'action. Montée par `CampaignView` seulement en POV + exploration.
 * Responsive-first (cibles ≥ 52px, pointer coarse) ; grille 3×2 : pivot/avance/pivot puis strafe/recul/strafe.
 */
const BTN: CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 11,
  background: 'var(--panel2)',
  borderWidth: 1.5,
  borderStyle: 'solid',
  borderColor: 'var(--border)',
  color: 'var(--text)',
  fontSize: 24,
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  touchAction: 'none',
  userSelect: 'none',
  opacity: 0.92,
};

export function PovControls() {
  const press = (id: IdDeRaccourci) => (e: PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    runBindingById(id, useGame.getState);
  };
  const btn = (id: IdDeRaccourci, label: string, title: string): ReactNode => (
    <button key={id} type="button" title={title} style={BTN} onPointerDown={press(id)}>
      {label}
    </button>
  );
  // Le PLACEMENT du pavé vit chez l'écran qui le monte (`.stage-flot > .pov-controls`, hud.css) :
  // il s'ancre au bas de la RANGÉE DU MONDE, au-dessus du pont, sans en connaître la hauteur.
  return (
    <div className="pov-controls" onPointerDown={(e) => e.stopPropagation()}>
      {btn('subjectif-pivot-gauche', '⟲', 'Pivoter le regard à gauche (A)')}
      {btn('subjectif-avant', '▲', 'Avancer (Z)')}
      {btn('subjectif-pivot-droite', '⟳', 'Pivoter le regard à droite (E)')}
      {btn('subjectif-gauche', '◄', 'Pas de côté à gauche (Q)')}
      {btn('subjectif-arriere', '▼', 'Reculer (S)')}
      {btn('subjectif-droite', '►', 'Pas de côté à droite (D)')}
    </div>
  );
}
