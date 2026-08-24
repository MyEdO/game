/**
 * ICÔNE d'une case de capacité — habillage PARTAGÉ du descripteur pur (`state/poolsDeCapacites`) par
 * ses deux consommateurs : les alvéoles de la console et les entrées de l'écran des capacités. Le
 * modèle ne connaît aucun ReactNode et ne franchit pas la frontière de couche (règle 3 : `src/state`
 * n'importe jamais `src/gameIso`) — il porte l'ID d'icône, l'OBJET dont l'art fait l'icône, ou la
 * CARACTÉRISTIQUE dont l'icône se déduit (`charIcon`, source unique de cette table).
 */
import type { ReactNode } from 'react';
import type { CaseDeCapacite } from '../state/poolsDeCapacites';
import { charIcon } from '../gameIso/effectIcons';
import { Icon } from './Icon';
import { ItemIcon } from './ItemIcon';
import type { IconIdInput } from './icons';

export function caseIcone(c: CaseDeCapacite, size?: 'sm' | 'lg'): ReactNode {
  if (c.item) return <ItemIcon item={c.item} size={size} />;
  const id = c.iconChar ? charIcon(c.iconChar) : (c.iconId as IconIdInput);
  return <Icon id={id} size={size} />;
}
