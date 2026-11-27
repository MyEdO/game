/** Le rédacteur commun du journal du noyau : la phrase qu'un hôte affiche pour une entrée (#4574). */
import { t } from '../i18n';
import type { EntreeDuJournal } from '../noyau/index';

export function redigerLEntree(e: EntreeDuJournal): string {
  switch (e.sorte) {
    case 'ligne':
      return e.deFixe ? `${e.texte} ${t('journal.deFixe')}` : e.texte;
  }
}
