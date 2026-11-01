import { useGame } from '../state/store';
import { campOf } from '../engine/relations';
import { PortraitTile, type PortraitTileProps } from './PortraitTile';
import { combatantRingDecor } from '../gameIso/builders/dynamicMarks';
import { viewPolicy } from '../gameIso/stage/viewPolicy';

/**
 * Identité CONNECTÉE : décoration partagée avec les repères du sol, nom et état de fin.
 */
export function CharFrame({ c, nom, ...rest }: Omit<PortraitTileProps, 'ring' | 'title' | 'team'> & {
  /** NOM ACCESSIBLE de la tuile (« Retirer Hilda de Pont ») — porté par `PortraitTile` en `aria-label`
   *  ET en infobulle. Nommé `nom` et non `title` : un attribut `title` écrit chez un APPELANT est une
   *  info qui ne vit que dans l'infobulle native (mur `murs/console-sans-title`) ; ici la valeur
   *  traverse la primitive, qui la pose dans l'arbre d'accessibilité. */
  nom?: string;
}) {
  const party = useGame((s) => s.party);
  const battle = useGame((s) => s.battle);
  const mode = useGame((s) => s.mode);
  const viewMode = useGame((s) => s.viewMode);
  const pov = useGame((s) => s.mode === 'exploration' && s.povActive);
  const population = mode === 'battle' && battle ? battle.combatants : party;
  const { montesDissocies } = viewPolicy({ view: pov ? 'iso' : viewMode });
  const camp = campOf(c);
  const team = camp === 'party' ? 'ally' : camp === 'hostile' ? 'enemy' : undefined;
  return <PortraitTile c={c} team={team} ring={combatantRingDecor(c, party.map((h) => h.id), population, montesDissocies)} title={nom} {...rest} />;
}
