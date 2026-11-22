/**
 * Les actes hors combat, joués par le noyau dans une partie d'exploration : achats aux PX, niveau de carrière, objet
 * équipé ou utilisé, prière.
 */
import { ouvrirLeLancement } from '../../../src/hote/partie';
import { arena } from '../../../src/scenes/test-scenarios/_shared';
import type { Combatant } from '../../../src/engine/types';
import type { Intention } from '../../../src/noyau/partie';
import { jouerLaFenetre, type Resultat } from './partie';


/** Un geste du noyau : un verbe de `ActionsDuNoyau` et ses arguments. */
export interface Geste { verbe: string; args: unknown[] }
export interface IssueAuHameau { groupe: Combatant[]; journal: string[] }

/** Joue `gestes` sur le `groupe` dans une partie du noyau ouverte hors combat (une place dégagée, en exploration) :
 *  achats aux PX, changement de niveau de carrière, objet utilisé, prière ou sort lancé. Rend le groupe tel que le
 *  noyau le laisse, et les lignes que son journal a écrites (refus compris). */
export function auHameau(groupe: readonly Combatant[], gestes: readonly Geste[], graine: number): IssueAuHameau {
  const { partie, jetons, lancement } = ouvrirLeLancement(
    { graine, regles: {}, cadence: 'auto', desFixes: false },
    () => ({ party: groupe.map((h) => structuredClone(h)), scene: arena({ id: 'hameau', label: 'Grisefosse', w: 8, h: 8 }), projet: null }),
    () => {},
  );
  const journal: string[] = [];
  const file: number[] = [];
  const recevoir = (r: Resultat) => {
    file.push(...jetons.programmes(r).map((p) => p.id));
    for (const l of r.journal) { const t = l.de === 'journal' ? l.texte : l.evenement.text; if (t) journal.push(t); }
  };
  const pomper = () => {
    for (let n = 0; n < 200; n++) {
      while (file.length) recevoir(jetons.reprendre(file.shift()!));
      if (!jouerLaFenetre(partie, recevoir)) return;
    }
  };
  recevoir(lancement);
  pomper();
  for (const g of gestes) {
    recevoir(partie.envoyer({ type: g.verbe, args: g.args } as unknown as Intention));
    pomper();
  }
  const rendu = partie.etat().party.map((c) => structuredClone(c));
  partie.fermer();
  return { groupe: rendu, journal };
}
