/**
 * L'hospice de Shallya : soins, plaies pansées, opération, Larmes de Shallya.
 */
import { blessuresARendre, plaiesASoigner, panserLesPlaies, opererLesBlessures, soigner, guerirDesSequelles, sequelles } from '../noyau';

import { GUERISON_DE_L_HOSPICE, PRIX_DE_L_HOSPICE, PRIX_DU_SOIN_PAR_BLESSURE, SEMAINE_DE_REPOS } from './valeurs';
import { Etat, Heros } from './etat';
import { heros, noter, refusDuPrix } from './outils';
import { sejourDit } from './expedition';

/** Le prix du soin par Blessure rendue au palier de l'hospice, `null` s'il est fermé. */
export const tarifDuSoin = (e: Etat): number | null => PRIX_DU_SOIN_PAR_BLESSURE[e.batiments.temple] ?? null;
/** Le prix du soin du héros : le tarif du palier par Blessure que le soin lui rend. */
export const prixDuSoin = (e: Etat, h: Heros): number | null => { const tarif = tarifDuSoin(e); return tarif == null ? null : tarif * blessuresARendre(h.c); };
export const prixDeSequelle = (e: Etat): number | null => [null, null, 40, 20][e.batiments.temple] ?? null;
export const blesse = (h: Heros): boolean => h.c.wounds.current < h.c.wounds.max || h.c.conditions.length > 0;
/** Le héros attend l'hospice : blessé, ou marqué d'une séquelle. */
export const aSoigner = (h: Heros): boolean => blesse(h) || sequelles(h.c).length > 0;
/** Les séquelles qu'une prière de Shallya peut guérir : celles qui ont une convalescence. */
export const sequellesGuerissables = (h: Heros): number => sequelles(h.c).filter((s) => s.jours != null).length;

export function soignerAuTemple(e: Etat, id: string): string | null {
  const h = heros(e, id);
  const prix = h ? prixDuSoin(e, h) : null;
  if (prix == null || !h) return 'L’hospice est fermé.';
  const refus = refusDuPrix(e.or, prix);
  if (refus) return refus;
  e.or -= prix;
  soigner(h.c, h.c.wounds.max);
  h.c.conditions = [];
  if (e.batiments.temple >= 3 && (h.c.fate ?? 0) === 0) h.c.fate = 1;
  return null;
}

export type ActeDHospice = keyof typeof PRIX_DE_L_HOSPICE;
/** Le prix de l'acte à l'hospice, `null` sous le palier qui le pratique (panser : 1, opérer : 2). */
export const prixDeLHospice = (e: Etat, acte: ActeDHospice): number | null =>
  e.batiments.temple < (acte === 'panser' ? 1 : 2) ? null : PRIX_DE_L_HOSPICE[acte] / (e.batiments.temple >= 3 ? 2 : 1);
/** Ce que l'hospice peut faire pour le héros. */
export const actesPossibles = (h: Heros): ActeDHospice[] => { const p = plaiesASoigner(h.c); return [...(p.panser ? ['panser' as const] : []), ...(p.operer ? ['operer' as const] : [])]; };

/** Pourquoi l'hospice refuse l'acte au héros (palier, séjour ailleurs, rien à soigner, or), `null` s'il l'accepte. */
export function refusDeLHospice(e: Etat, h: Heros, acte: ActeDHospice): string | null {
  const prix = prixDeLHospice(e, acte);
  if (prix == null) return 'L’hospice ne pratique pas encore cet acte.';
  const ailleurs = sejourDit(h);
  if (ailleurs) return ailleurs;
  if (!actesPossibles(h).includes(acte)) return acte === 'panser' ? 'Aucune plaie que les sœurs puissent panser.' : 'Rien à opérer.';
  return refusDuPrix(e.or, prix);
}

/** Confie le héros à l'hospice : les sœurs pansent ses plaies dans la journée ; opéré, il y reste une semaine. */
export function confierALHospice(e: Etat, id: string, acte: ActeDHospice): string | null {
  const h = heros(e, id);
  if (!h) return 'Héros introuvable.';
  const refus = refusDeLHospice(e, h, acte);
  if (refus) return refus;
  e.or -= prixDeLHospice(e, acte)!;
  const lignes = acte === 'panser' ? panserLesPlaies(h.c, GUERISON_DE_L_HOSPICE, e.graine++) : opererLesBlessures(h.c);
  if (acte === 'operer') h.sejour = { ou: 'temple', reste: SEMAINE_DE_REPOS, total: SEMAINE_DE_REPOS };
  noter(e, `${lignes.join(' ')}${acte === 'operer' ? ` ${h.c.label} reste une semaine à l’hospice.` : ''}`);
  return null;
}

export function guerirUneSequelle(e: Etat, id: string): string | null {
  const prix = prixDeSequelle(e);
  const h = heros(e, id);
  if (prix == null || !h) return 'Les Larmes de Shallya ne sont pas encore offertes ici.';
  if (!sequellesGuerissables(h)) return 'Aucune séquelle que la prière puisse guérir.';
  const refus = refusDuPrix(e.or, prix);
  if (refus) return refus;
  e.or -= prix;
  noter(e, guerirDesSequelles(h.c, 1).join(' '));
  return null;
}
