import type { TriggeredEffect } from '../../data/schemas/defs-scenes/effets';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import { effectOnSchema } from '../../data/schemas/grammaire/mecanique';

/** Libellé de la CIBLE d'un effet déclenché — chaîne simple (nœud `effectOnSchema`), géométrie
 *  (`{near, radiusMeters}`) ou sélection limitée d'un adversaire engagé (`{pick, sizeAtMost, max}`) :
 *  les deux formes OBJET n'ont pas d'univers de valeurs, elles se composent ici. */
export const onLabel = (on: TriggeredEffect['on']): string =>
  typeof on === 'object'
    ? 'pick' in on
      ? `${on.max} adversaire(s) engagé(s)${on.sizeAtMost === 'self' ? ' de Taille ≤ la sienne' : ''}`
      : `les cibles à ≤ ${on.radiusMeters} m de ${on.near === 'self' ? 'soi' : 'la victime'}`
    : libelleDeValeur(effectOnSchema, on);
