/**
 * ACCÈS RÉSERVÉ d'un porteur de la carte du monde — la route (`worldMap.routes[]`) et l'établissement d'un lieu
 * (`worldMap.places[].services[]`, `defs-scenes/worldmap.ts`) : la Condition qui l'ouvre (`when`) et la raison JOUEUR de
 * sa fermeture (`refus`), exigée dès que `when` est posé (`refuserLAccesMuet`). #684 #4277
 */
import { z } from 'zod';
import { nommerChamps } from './meta';
import { proseNommee } from './prose';
import { conditionCondCtxSchema } from './campagne';

/** `refus` d'un accès réservé : la raison du refus dite au joueur. */
export const refusDAccesSchema = proseNommee(nommerChamps(z.strictObject({}), {}), 'acces.refus.texte');

/** Les champs d'un accès réservé, que la route et l'établissement composent : absent, `when` laisse le porteur ouvert. */
export const champsDAcces = {
  when: conditionCondCtxSchema.optional(),
  refus: refusDAccesSchema.optional(),
};

/** Les libellés des champs d'un accès réservé (`champsDAcces`). */
export const META_DE_L_ACCES = { when: { label: 'condition' }, refus: { label: 'refus' } } as const;

/** Refuse un accès réservé muet : `when` posé sans `refus`, le joueur ne saurait pas pourquoi `porteur` lui est fermé. */
export function refuserLAccesMuet(acces: { when?: unknown; refus?: { texte: string } }, ctx: z.RefinementCtx, porteur: string): void {
  if (acces.when !== undefined && !acces.refus?.texte.trim()) {
    ctx.addIssue({ code: 'custom', path: ['refus'], message: `« when » posé sans « refus » — ${porteur} fermable doit dire au JOUEUR pourquoi il l'est.` });
  }
}
