/**
 * Les actes hors combat, joués par le noyau dans une partie d'exploration : achats aux PX, niveau de carrière, objet
 * équipé ou utilisé, prière.
 */
import { arena } from '../../../../src/scenes/test-scenarios/_shared';
import type { Combatant } from '../../../../src/engine/types';
import { gestesDeLObjet, type GesteDuNoyau, type Jeu } from '../../../../src/noyau';
import { lignesDuJournal, ouvrirEnAuto } from './partie';

/** Un geste du noyau : un verbe de `ActionsDuNoyau` et ses arguments, ou ce qu'une vue du noyau rend sur l'état de la
 *  partie au moment de le jouer (`gestesDeLObjet`), rien s'il n'y en a pas. */
export type Geste = { verbe: string; args: unknown[] } | ((s: Jeu) => GesteDuNoyau | null | undefined);
/** Le geste `quoi` de l'objet `uid` du porteur `porteurId`, lu de la vue du noyau (`gestesDeLObjet`) au moment de le
 *  jouer. */
export const gesteDeLObjet = (porteurId: string, uid: string, quoi: 'porter' | 'utiliser'): Geste => (s) => gestesDeLObjet(s, porteurId, uid)?.[quoi]?.geste;
export interface IssueAuHameau { groupe: Combatant[]; journal: string[] }

/** Joue `gestes` sur le `groupe` dans une partie du noyau ouverte hors combat (une place dégagée, en exploration) :
 *  achats aux PX, changement de niveau de carrière, objet utilisé, prière ou sort lancé. Rend le groupe tel que le
 *  noyau le laisse, et les lignes que son journal a écrites (refus compris). */
export function auHameau(groupe: readonly Combatant[], gestes: readonly Geste[], graine: number): IssueAuHameau {
  const journal: string[] = [];
  const { partie, envoyer, pomper } = ouvrirEnAuto(
    graine,
    () => ({ party: groupe.map((h) => structuredClone(h)), scene: arena({ id: 'hameau', label: 'Grisefosse', w: 8, h: 8 }), projet: null }),
    (r) => { journal.push(...lignesDuJournal(r)); },
  );
  pomper();
  for (const g of gestes) {
    const joue = typeof g === 'function' ? g(partie.etat() as Jeu) : g;
    if (joue) envoyer(joue.verbe, joue.args);
    pomper();
  }
  const rendu = partie.etat().party.map((c) => structuredClone(c));
  partie.fermer();
  return { groupe: rendu, journal };
}
