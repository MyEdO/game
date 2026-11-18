/**
 * LA VALIDATION D'UNE FENÊTRE (#3369) : un seul verbe, `fenetreValider(fenetre)`, la fenêtre en argument. Chaque fenêtre
 * qui se valide le déclare dans son registre (`validation`, `modalArbiter.ts`) : l'hôte seul, le quorum (chaque siège
 * requis se dit prêt, le dernier la valide) ou l'hôte au quorum. Ce qui ferme sa validation vit dans
 * `FERMETURES_DE_LA_VALIDATION`, son corps dans la table totale `ValidationsDeFenetre`, assemblée par
 * `fabriquesDuNoyau.ts`.
 */
import { t } from '../i18n';
import { garanti } from '../lib/garanti';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { Jeu } from './etat';
import type { Get, Set } from './flowTypes';
import { libelleDeLaFermeture } from './libelles';
import { estFenetreAValider, seanceDuChapitre, validationDeLaFenetre, type FenetreAValider } from './modalArbiter';
import { refuserGesteDuSiege } from './refusVisible';
import type { FermetureDuJet } from './rollFlowFactory';
import { fermetureDuQuorum, jouerOuMarquer } from './sortieDeFenetre';
import { noteDAubergeCouverte } from './restFlow';
import { semaineAReprendre } from './choixDeFenetre';
import { interludeDrawPending } from './verdictsDInterlude';
import { fermetureDuRoundSuivant } from './massBattleFlow';

/** Le corps de la validation de chaque fenêtre qui se valide, que seul `fenetreValider` appelle : une fenêtre qui
 *  déclare sa `validation` sans corps ne compile pas. */
export type ValidationsDeFenetre = { readonly [F in FenetreAValider]: () => void };

/** Ce qui ferme maintenant la validation d'une fenêtre ouverte, au-delà de son quorum : la note de la halte que les
 *  bourses du groupe ne couvrent pas (LDB 66), les Événements de la période encore à tirer (LDB 22 l.5), une échoppe sans
 *  achat à répartir, la fin de séance que le récap de chapitre termine, la semaine en mer dont un choix n'est plus ouvert
 *  (`semaineAReprendre`), le Round de bataille dont le Test spectaculaire reste à jouer (`fermetureDuRoundSuivant`). */
export const FERMETURES_DE_LA_VALIDATION: { readonly [F in FenetreAValider]?: (s: Jeu) => FermetureDuJet | null } = {
  repos: (s) => (noteDAubergeCouverte(s) ? null : 'noteNonCouverte'),
  interlude: (s) => (interludeDrawPending(s) ? 'evenementsATirer' : null),
  marchand: (s) => (s.merchant?.pendingDistribution?.length ? null : 'rienARepartir'),
  finDeSeance: seanceDuChapitre,
  activitesEnMer: (s) => (semaineAReprendre(s) ? 'choixAReprendre' : null),
  batailleDeMasse: fermetureDuRoundSuivant,
};

/** Ce qui ferme la validation de `fenetre` maintenant : son verdict (`FERMETURES_DE_LA_VALIDATION`), puis son quorum
 *  (`fermetureDuQuorum`). */
export function fermetureDeLaValidation(s: Jeu, fenetre: FenetreAValider): FermetureDuJet | null {
  const validation = validationDeLaFenetre(fenetre);
  return validation ? FERMETURES_DE_LA_VALIDATION[fenetre]?.(s) ?? fermetureDuQuorum(s, validation) : null;
}

/** Ce qui refuse la validation de `fenetre` venue d'une frontière (JSON d'un hôte, intention d'un siège) : une fenêtre
 *  qui ne se valide pas, une fenêtre fermée, la validation de l'hôte dans l'état d'un invité, ce qui ferme sa validation
 *  maintenant (`fermetureDeLaValidation`) ; `null` : elle se joue. */
export function refusDeLaValidation(s: Jeu, fenetre: unknown): string | null {
  return estFenetreAValider(fenetre) ? refusDeLaValidationNommee(s, fenetre) : t('validation.refus.inconnue');
}

/** Ce qui refuse la validation de `fenetre` maintenant (`refusDeLaValidation`) ; `null` : elle se joue. */
export function refusDeLaValidationNommee(s: Jeu, fenetre: FenetreAValider): string | null {
  const validation = garanti(validationDeLaFenetre(fenetre), fenetre, 'validation déclarée');
  if (!validation.ouverte(s)) return t('validation.refus.fermee');
  if (validation.qui === 'hote' && s.net.mode === 'invite') return t('validation.refus.hoteSeul');
  const fermee = fermetureDeLaValidation(s, fenetre);
  return fermee && libelleDeLaFermeture(fermee);
}

/** Le verbe de validation du noyau sur `get`/`set` : il refuse, et le dit, la validation que `refusDeLaValidation`
 *  refuse, sinon joue le corps de la fenêtre (`validations`), au quorum pour une fenêtre à quorum (`jouerOuMarquer`). */
export function creerValidationDeFenetre(get: Get, set: Set, validations: ValidationsDeFenetre): Pick<ActionsDuNoyau, 'fenetreValider'> {
  return {
    fenetreValider: (fenetre) => {
      const refus = refusDeLaValidation(get(), fenetre);
      if (refus) { refuserGesteDuSiege(get, set, refus); return; }
      jouerOuMarquer(get, set, validationDeLaFenetre(fenetre)!, validations[fenetre]);
    },
  };
}
