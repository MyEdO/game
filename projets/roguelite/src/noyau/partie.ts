/**
 * La partie du noyau ouverte par l'hôte en cadence automatique, la pompe de ses jetons programmés, et la fenêtre qui
 * tient la main : son drive, à défaut sa validation.
 */
import { ouvrirLeLancement, type PartieOuverte as PartieDuLancement } from '../../../../src/hote/partie';
import {
  fenetreDuJeu,
  type Intention,
  poserLesReglesMaisonPersistees,
  ruleOverrides,
  VERBE_DE_CHOIX,
  VERBE_DE_VALIDATION,
  type GesteDuJeu,
} from '../../../../src/noyau';

export type PartieOuverte = PartieDuLancement['partie'];
export type Resultat = PartieDuLancement['lancement'];
type Lancement = Parameters<typeof ouvrirLeLancement>[1];
type Programme = ReturnType<PartieDuLancement['jetons']['programmes']>[number];

/** Les lignes qu'un résultat écrit au journal, celles du journal et le texte des évènements. */
export const lignesDuJournal = (r: Resultat): string[] =>
  r.journal.flatMap((l) => { const t = l.de === 'journal' ? l.texte : l.evenement.text; return t ? [t] : []; });

/** Une partie ouverte par `ouvrirEnAuto`. `envoyer` joue une intention et en file les jetons ; `pomper` reprend les
 *  jetons en file et joue la fenêtre qui tient la main jusqu'à ce qu'il n'y ait plus rien à jouer. */
export interface PartieEnAuto {
  partie: PartieOuverte;
  envoyer: (type: string, args: readonly unknown[]) => void;
  pomper: () => void;
  /** Joue le premier geste de la fenêtre qui tient la main que `choisi` retient (`fenetreDuJeu`), s'il y en a un. */
  jouerDansLaFenetre: (choisi: (g: GesteDuJeu) => boolean) => void;
}

/** Les règles optionnelles du noyau que le roguelite pose à son démarrage (`poserLesReglesDuRoguelite`), et sous
 *  lesquelles chacune de ses parties s'ouvre (`ouvrirEcoutee`) : création, combat, hameau et épreuve. MyEdO/game#4947.
 *  `creation-5e` : CRB 005, `src/noyau/creation/procedure.ts` ; `magie-vdm-incantation` : VDM 02 l.5-7,
 *  `src/engine/magic.ts` ; `armure-regles-rapides` : LDB 63 l.95-103, MyEdO/game#4966. */
export const REGLES_DU_ROGUELITE: Readonly<Record<string, unknown>> = { 'creation-5e': true, 'magie-vdm-incantation': true, 'armure-regles-rapides': true };

/** Pose `REGLES_DU_ROGUELITE` au registre des règles du noyau (`poserLesReglesMaisonPersistees`), aux `ecarts` près
 *  (une mesure qui compare le jeu avec et sans une règle) : le démarrage du roguelite, avant toute recrue. */
export function poserLesReglesDuRoguelite(ecarts: Readonly<Record<string, unknown>> = {}): void {
  poserLesReglesMaisonPersistees({ ...REGLES_DU_ROGUELITE, ...ecarts });
}

/** Le choix qui laisse venir la mutation d'un « Je te renie ! » ouvert (`pendingRenounce`) : le roguelite ne gère pas
 *  la Résilience (MyEdO/game#4947). LDB 17 l.67 */
const RENIER = { type: VERBE_DE_CHOIX, args: ['renier', 'renier', false] } as unknown as Intention;

/** Plafond de tours de `pomper` : une partie qui rend toujours la main s'arrête plutôt que de boucler. */
const PLAFOND_DE_POMPE = 200;

/** Ouvre la partie du noyau en cadence automatique à la graine `graine` sur ce que `lancement` construit
 *  (`ouvrirLeLancement`, `src/hote/partie.ts`), sous les règles en vigueur au registre (`poserLesReglesDuRoguelite`). Sa tenue des jetons passe chaque résultat
 *  qu'elle reçoit à `ecouter`, puis laisse venir la mutation d'un « Je te renie ! » ouvert (`RENIER`) et en programme
 *  aussi les jetons. */
export function ouvrirEcoutee(graine: number, lancement: Lancement, ecouter: (r: Resultat) => void = () => {}): PartieDuLancement {
  const o = ouvrirLeLancement({ graine, regles: ruleOverrides(), cadence: 'auto', desFixes: false }, lancement, () => {});
  const { partie, jetons } = o;
  const programmes = (r: Resultat): Programme[] => {
    ecouter(r);
    const suite = jetons.programmes(r);
    return partie.etat().pendingRenounce ? [...suite, ...programmes(partie.envoyer(RENIER))] : suite;
  };
  return { ...o, jetons: { ...jetons, programmes } };
}

/** Ouvre la partie écoutée (`ouvrirEcoutee`) et en file les jetons de son lancement. */
export function ouvrirEnAuto(graine: number, lancement: Lancement, ecouter: (r: Resultat) => void = () => {}): PartieEnAuto {
  const { partie, jetons, lancement: premier } = ouvrirEcoutee(graine, lancement, ecouter);
  const file: number[] = [];
  const recevoir = (r: Resultat) => { file.push(...jetons.programmes(r).map((p) => p.id)); };
  const vider = () => { while (file.length) recevoir(jetons.reprendre(file.shift()!)); };
  const envoyer = (type: string, args: readonly unknown[]) => recevoir(partie.envoyer({ type, args } as unknown as Intention));
  const pomper = () => {
    for (let n = 0; n < PLAFOND_DE_POMPE; n++) {
      vider();
      if (!jouerLaFenetre(partie, recevoir)) return;
    }
  };
  const jouerDansLaFenetre = (choisi: (g: GesteDuJeu) => boolean) => {
    const g = fenetreDuJeu(partie.etat() as never)?.gestes.find(choisi);
    if (g) recevoir(partie.envoyer(intentionDuGeste(g)));
  };
  recevoir(premier);
  return { partie, envoyer, pomper, jouerDansLaFenetre };
}

/** L'intention qui joue le geste `g` d'une fenêtre : son verbe, sur le flux ou la fenêtre qu'il vise. */
const intentionDuGeste = (g: GesteDuJeu): Intention => ({ type: g.verbe, args: g.flux ? [g.flux] : g.fenetre ? [g.fenetre] : [] }) as unknown as Intention;

/** Joue la fenêtre qui tient la main : son drive, à défaut sa validation. Faux s'il n'y a rien à jouer (aucune
 *  fenêtre, ou une fenêtre qui attend un choix sans défaut). */
function jouerLaFenetre(partie: PartieOuverte, recevoir: (r: Resultat) => void): boolean {
  const f = fenetreDuJeu(partie.etat() as never);
  if (!f) return false;
  const suite = f.drive?.length ? f.drive : f.gestes.filter((g) => g.verbe === VERBE_DE_VALIDATION);
  if (!suite.length) return false;
  for (const g of suite) recevoir(partie.envoyer(intentionDuGeste(g)));
  return true;
}
