/** Le rédacteur commun du journal du noyau : la phrase qu'un hôte affiche pour une entrée (#4574). */
import { t } from '../i18n';
import type { EntreeDuJournal } from '../noyau/index';

export function redigerLEntree(e: EntreeDuJournal): string {
  const texte = redigerSansRattache(e);
  return e.rattache ? t('journal.rattache', { texte }) : texte;
}

/** La phrase d'une entrée sans la marque de son rattachement : celle qu'un hôte range sous l'entrée qu'elle détaille. */
export function redigerSansRattache(e: EntreeDuJournal): string {
  switch (e.sorte) {
    case 'ligne':
      return e.deFixe ? `${e.texte} ${t('journal.deFixe')}` : e.texte;
  }
}
