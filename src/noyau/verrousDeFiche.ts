/**
 * Verdicts « EN COMBAT » des gestes de la FICHE, en module feuille : chaque famille de geste de la fiche
 * (inventaire, lanceur hors combat, background, Faveur, dépense de PX, soins) est refusée pendant un combat
 * par UN verdict, que le geste applique en tête (`refuseSi`) et que l'écran lit sans recalculer.
 * `refusEnCombat` est la SEULE source de la question « en combat ? » de ces verdicts.
 */
import { t, type MsgKey } from '../i18n';
import { refuserGeste } from './refusVisible';
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';

/** Un verdict de geste : la raison du refus dans cet état, ou `null`. */
export type VerdictDeGeste = (s: Pick<Jeu, 'battle'>) => string | null;

/** Le verdict « refusé en combat », dit par le message `cle`. */
export const refusEnCombat = (cle: MsgKey): VerdictDeGeste => (s) => (s.battle ? t(cle) : null);

/** Refus de toucher à un objet de la fiche (porter, ranger, donner, évaluer, utiliser, tenir une arme,
 *  gérer ses sets) : en combat, l'équipement se gère depuis la barre d'action. L'apparence d'un objet
 *  (`choisirApparence`), cosmétique et sans règle qui la ferme, ne l'est pas. */
export const refusDInventaire: VerdictDeGeste = refusEnCombat('pf.inventoryLocked');

/** Refus des lanceurs HORS COMBAT de la fiche (`oocCastSpell`, `oocFocusSpell`, `oocDispelSpell`) : en
 *  combat, le sort se lance depuis la console. */
export const refusDuLanceurDeFiche: VerdictDeGeste = refusEnCombat('cs.oocInCombat');

/** Refus d'éditer le background (Motivation, Ambitions) en combat : parité de l'écran d'avant (champs
 *  fermés en combat), sans appui au Source — le geste écrit pourtant les deux copies (`ecrireActeur`). */
export const refusDuBackground: VerdictDeGeste = refusEnCombat('pf.backgroundInCombat');

/** Refus de rompre une Faveur due en plein combat : parité de l'écran d'avant, sans appui au Source. */
export const refusDeRompreUneFaveur: VerdictDeGeste = refusEnCombat('favor.breakInCombat');

/** Applique `verdict` en tête d'un geste : rend `true` (le geste s'arrête) quand il refuse, et le refus se
 *  DIT (`refuserGeste`) ; `false` sinon. */
export function refuseSi(get: Get, set: Set, verdict: VerdictDeGeste): boolean {
  const refus = verdict(get());
  return refus ? refuserGeste(get, set, refus) : false;
}
