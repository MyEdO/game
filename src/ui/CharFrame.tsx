import { useGame } from '../state/store';
import { PortraitTile, type CharSize, type CharVariant } from './PortraitTile';
import { HERO_RING, ENEMY_RING } from '../gameIso/teamColors';
import type { Combatant } from '../engine/types';

/**
 * Tuile-portrait CONNECTÉE — le point d'entrée normal hors HUD (modales, pickers, écrans) :
 * calcule le cadre (couleur d'IDENTITÉ du héros par position de groupe / anneau ennemi) et le
 * fond d'équipe depuis le store, puis rend PortraitTile. Les sites qui ont déjà leurs couleurs
 * sous la main (dock, frise, cadre actif) appellent PortraitTile directement.
 */
export function CharFrame({ c, nom, ...rest }: {
  c: Combatant;
  variant?: CharVariant;
  size?: CharSize;
  selected?: boolean;
  maxStates?: number;
  reserveStates?: boolean;
  onClick?: () => void;
  /** NOM ACCESSIBLE de la tuile (« Retirer Hilda de Pont ») — porté par `PortraitTile` en `aria-label`
   *  ET en infobulle. Nommé `nom` et non `title` : un attribut `title` écrit chez un APPELANT est une
   *  info qui ne vit que dans l'infobulle native (mur `murs/console-sans-title`) ; ici la valeur
   *  traverse la primitive, qui la pose dans l'arbre d'accessibilité. */
  nom?: string;
  /** Tuile DÉCORATIVE (cf. `PortraitTile.decoratif`) : `<span>` muet dans un contrôle englobant. */
  decoratif?: boolean;
}) {
  const party = useGame((s) => s.party);
  const idx = party.findIndex((h) => h.id === c.id);
  const team = idx >= 0 || c.kind === 'hero' ? 'ally' : c.kind === 'enemy' ? 'enemy' : undefined;
  return <PortraitTile c={c} ring={idx >= 0 ? HERO_RING[idx % HERO_RING.length] : ENEMY_RING} team={team} title={nom} {...rest} />;
}
