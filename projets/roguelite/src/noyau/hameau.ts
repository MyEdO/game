/**
 * Les actes hors combat, joués par le noyau dans une partie d'exploration : achats aux PX, niveau de carrière, objet
 * équipé ou utilisé, prière.
 */
import { arena, gestesDeLObjet, gesteDeLaPanoplie, gesteDIncantation, type GesteDuNoyau, type Jeu } from '../../../../src/noyau';
import type { Combatant, Main } from '../../../../src/engine/types';
import { lignesDuJournal, ouvrirEnAuto } from './partie';

/** Un geste du noyau : ce qu'une offre du noyau rend sur l'état de la partie au moment de le jouer, rien s'il n'y en a
 *  pas. */
export type Geste = (s: Jeu) => GesteDuNoyau | null | undefined;
/** Le geste `quoi` de l'objet `uid` du porteur `porteurId`, lu de la vue du noyau (`gestesDeLObjet`) au moment de le
 *  jouer. */
export const gesteDeLObjet = (porteurId: string, uid: string, quoi: 'porter' | 'utiliser'): Geste => (s) => gestesDeLObjet(s, porteurId, uid)?.[quoi]?.geste;
/** Le geste qui met l'objet `uid` dans la main `main` du set `setId` du porteur `porteurId`, lu de la vue du noyau
 *  (`gestesDeLObjet`) au moment de le jouer. */
export const gesteDeLaMain = (porteurId: string, setId: string, main: Main, uid: string): Geste => (s) => gestesDeLObjet(s, porteurId, uid, setId)?.mains?.[main].geste;
/** Le geste qui fait prendre au héros `heroId` son set d'armes `loadoutId`, lu du noyau (`gesteDeLaPanoplie`) au
 *  moment de le jouer. */
export const gesteDePrendreLaPanoplie = (heroId: string, loadoutId: string): Geste => (s) => gesteDeLaPanoplie(s, heroId, loadoutId)?.geste;
/** Le geste qui fait incanter à `lanceurId` le sort `spellId` sur `cibleId`, lu du noyau (`gesteDIncantation`) au
 *  moment de le jouer. */
export const gesteDIncanter = (lanceurId: string, spellId: string, cibleId: string): Geste => (s) => gesteDIncantation(s, lanceurId, spellId, cibleId)?.geste;
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
    const joue = g(partie.etat() as Jeu);
    if (joue) envoyer(joue.verbe, joue.args);
    pomper();
  }
  const rendu = partie.etat().party.map((c) => structuredClone(c));
  partie.fermer();
  return { groupe: rendu, journal };
}
