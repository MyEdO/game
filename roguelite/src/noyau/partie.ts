/**
 * La partie du noyau ouverte par l'hôte en cadence automatique, la pompe de ses jetons programmés, et la fenêtre qui
 * tient la main : son drive, à défaut sa validation.
 */
import { ouvrirLeLancement } from '../../../src/hote/partie';
import { fenetreDuJeu } from '../../../src/noyau/combatAuto';
import type { Intention } from '../../../src/noyau/partie';

export type PartieOuverte = ReturnType<typeof ouvrirLeLancement>['partie'];
export type Resultat = Parameters<ReturnType<typeof ouvrirLeLancement>['jetons']['programmes']>[0];
type Lancement = Parameters<typeof ouvrirLeLancement>[1];

/** Les lignes qu'un résultat écrit au journal, celles du journal et le texte des évènements. */
export const lignesDuJournal = (r: Resultat): string[] =>
  r.journal.flatMap((l) => { const t = l.de === 'journal' ? l.texte : l.evenement.text; return t ? [t] : []; });

/** Une partie ouverte par `ouvrirEnAuto`. `recevoir` file les jetons programmés d'un résultat et le passe à l'écoute ;
 *  `vider` reprend les jetons en file (`apres` suit chaque reprise) ; `envoyer` joue une intention et la reçoit ;
 *  `pomper` vide la file et joue la fenêtre qui tient la main jusqu'à ce qu'il n'y ait plus rien à jouer. */
export interface PartieEnAuto {
  partie: PartieOuverte;
  recevoir: (r: Resultat) => void;
  vider: (apres?: () => void) => void;
  envoyer: (type: string, args: readonly unknown[]) => void;
  pomper: () => void;
}

/** Les règles optionnelles du noyau que le roguelite pose sur chacune de ses parties (`ouvrirEnAuto`) : combat, hameau
 *  et épreuve. `CONCEPTION.md`. `magie-vdm-incantation` : VDM 02 l.5-7, `src/engine/magic.ts`. */
export const REGLES_DU_ROGUELITE: Readonly<Record<string, unknown>> = { 'magie-vdm-incantation': true };

/** Plafond de tours de `pomper` : une partie qui rend toujours la main s'arrête plutôt que de boucler. */
const PLAFOND_DE_POMPE = 200;

/** Ouvre la partie du noyau en cadence automatique à la graine `graine` sur ce que `lancement` construit
 *  (`ouvrirLeLancement`, `src/hote/partie.ts`). `ecouter` lit chaque résultat, celui du lancement compris. */
export function ouvrirEnAuto(graine: number, lancement: Lancement, ecouter: (r: Resultat) => void = () => {}): PartieEnAuto {
  const { partie, jetons, lancement: premier } = ouvrirLeLancement({ graine, regles: { ...REGLES_DU_ROGUELITE }, cadence: 'auto', desFixes: false }, lancement, () => {});
  const file: number[] = [];
  const recevoir = (r: Resultat) => {
    file.push(...jetons.programmes(r).map((p) => p.id));
    ecouter(r);
  };
  const vider = (apres: () => void = () => {}) => {
    while (file.length) {
      recevoir(jetons.reprendre(file.shift()!));
      apres();
    }
  };
  const envoyer = (type: string, args: readonly unknown[]) => recevoir(partie.envoyer({ type, args } as unknown as Intention));
  const pomper = () => {
    for (let n = 0; n < PLAFOND_DE_POMPE; n++) {
      vider();
      if (!jouerLaFenetre(partie, recevoir)) return;
    }
  };
  recevoir(premier);
  return { partie, recevoir, vider, envoyer, pomper };
}

/** Joue la fenêtre qui tient la main : son drive, à défaut sa validation. Faux s'il n'y a rien à jouer (aucune
 *  fenêtre, ou une fenêtre qui attend un choix sans défaut). `apres` suit chaque geste. */
export function jouerLaFenetre(partie: PartieOuverte, recevoir: (r: Resultat) => void, apres: () => void = () => {}): boolean {
  const f = fenetreDuJeu(partie.etat() as never);
  if (!f) return false;
  const suite = f.drive?.length ? f.drive : f.gestes.filter((g) => g.verbe === 'fenetreValider');
  if (!suite.length) return false;
  for (const g of suite) {
    recevoir(partie.envoyer({ type: g.verbe, args: g.flux ? [g.flux] : g.fenetre ? [g.fenetre] : [] } as unknown as Intention));
    apres();
  }
  return true;
}
