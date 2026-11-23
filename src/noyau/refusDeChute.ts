import { t } from '../i18n';
import type { Jeu } from './etat';
import { rangeesDuesDeChute } from './fallMove';
import type { PendingFall, TombantParticipant } from './pendings';
import { nomEnVue, porteurEnVue } from './visionDuGroupe';

/** Les tombants en vue avec l’id que prennent les verbes de la chute (#4017). */
export const tombantsNommes = (s: Jeu, rangees: readonly TombantParticipant[]): string =>
  rangees.map(({ id }) => {
    const nom = porteurEnVue(s, id) ? nomEnVue(s, id) : null;
    return nom === null ? t('vision.horsDeVue') : `${nom} (${id})`;
  }).join(', ');

/** Le refus d'un jet de chute en phase de choix : ce qui reste à déclarer (et s'il se suspend d'abord, quand la
 *  croisée l'offre). */
export function refusDesDeclarationsDues(s: Jeu, p: PendingFall): string {
  const tombants = tombantsNommes(s, rangeesDuesDeChute(p));
  return t(p.suspendu === undefined ? 'fall.refus.declarationsDues' : 'fall.refus.declarationsDuesSuspendu', { tombants });
}
