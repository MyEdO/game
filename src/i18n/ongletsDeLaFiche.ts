import type { MsgKey } from './index';

/** Onglets de la fiche de personnage — id STABLE, jamais un libellé. */
export type SheetTab = 'etat' | 'possessions' | 'competences' | 'magie' | 'avancement' | 'histoire';

/** Libellé d'un onglet de la fiche : sa clé de catalogue `sheet.tab.<onglet>` — un texte qui NOMME un
 *  onglet (scénario de test, aide) lit la même clé, et ne peut donc pas mentir sur son nom. */
export const TAB_LABELS: Record<SheetTab, MsgKey> = {
  etat: 'sheet.tab.etat',
  possessions: 'sheet.tab.possessions',
  competences: 'sheet.tab.competences',
  magie: 'sheet.tab.magie',
  avancement: 'sheet.tab.avancement',
  histoire: 'sheet.tab.histoire',
};
