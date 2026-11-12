import type { TriggeredEffect } from '../../data/schemas/defs-scenes/effets';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import { effectOnSchema } from '../../data/schemas/grammaire/mecanique';
import { t } from '../../i18n';

/** Libellé de la CIBLE d'un effet déclenché — chaîne simple (nœud `effectOnSchema`), géométrie
 *  (`{near, radiusMeters}`) ou sélection limitée d'un adversaire engagé (`{pick, sizeAtMost, max}`) :
 *  les deux formes OBJET n'ont pas d'univers de valeurs, elles se composent ici. */
export const onLabel = (on: TriggeredEffect['on']): string =>
  typeof on === 'object'
    ? 'pick' in on
      ? t(on.sizeAtMost === 'soi' ? 'codex.on.engagesTaille' : 'codex.on.engages', { n: on.max })
      : t(on.near === 'soi' ? 'codex.on.rayonSoi' : 'codex.on.rayonVictime', { m: on.radiusMeters })
    : libelleDeValeur(effectOnSchema, on);
