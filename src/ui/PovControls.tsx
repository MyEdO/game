import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { useGame } from '../state/store';
import { runBindingById } from '../state/keybindings';

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
  const press = (id: string) => (e: PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    runBindingById(id, useGame.getState);
  };
  const btn = (id: string, label: string, title: string): ReactNode => (
    <button key={id} type="button" title={title} style={BTN} onPointerDown={press(id)}>
      {label}
    </button>
  );
  // Le PLACEMENT du pavé est celui de sa zone dans la couche HUD (`[data-zone='camera']`, hud.css).
  return (
    <div className="pov-controls" onPointerDown={(e) => e.stopPropagation()}>
      {btn('pov-turn-l', '⟲', 'Pivoter le regard à gauche (A)')}
      {btn('pov-forward', '▲', 'Avancer (Z)')}
      {btn('pov-turn-r', '⟳', 'Pivoter le regard à droite (E)')}
      {btn('pov-strafe-l', '◄', 'Pas de côté à gauche (Q)')}
      {btn('pov-back', '▼', 'Reculer (S)')}
      {btn('pov-strafe-r', '►', 'Pas de côté à droite (D)')}
    </div>
  );
}
