/**
 * AUDIT « une couche non-espèce ne déclare aucune clé de sorte PORTEUR » (#583 chair, #599 chevelure,
 * #1903 table des clés) — définition UNIQUE, partagée par la garde
 * `src/gameIso/rig/parts/no-porteur-in-palette.test.ts` (et ses morsures).
 *
 * Les clés porteur (`PORTEUR` : peau, cheveux, yeux, avec leur ombre et leur lumière) appartiennent au
 * PERSONNAGE (espèce + personnalisation, `raceAppearance.json`). Une tenue, une arme ou une armure
 * qui les déclare écrase, dans sa couche, la valeur du porteur (`couchesDuRig`, `buildTokenMap`).
 */
import { PORTEUR } from '../../../src/data/palette.types';

/** Les clés porteur et leur gamme : base, `O`, `H`. */
const CLES_PORTEUR: readonly string[] = PORTEUR.flatMap((k) => [k, `${k}O`, `${k}H`]);

/** `{ id, keys }` pour chaque def dont la `palette` déclare au moins une clé porteur. */
export function auditClesPorteur(defs: readonly { id: string; palette?: Record<string, string> }[]): { id: string; keys: string[] }[] {
  return defs
    .map((def) => ({ id: def.id, keys: CLES_PORTEUR.filter((k) => def.palette != null && k in def.palette) }))
    .filter((o) => o.keys.length > 0);
}
