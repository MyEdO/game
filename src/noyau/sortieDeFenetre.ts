/**
 * LA SORTIE D'UNE FENÊTRE (#3367) : un seul verbe, `fenetreFermer(fenetre)`, la fenêtre en argument. Chaque fenêtre qui
 * se ferme le déclare dans son registre (`sortie`, `modalArbiter.ts`) ; son corps vit dans la table totale
 * `SortiesDeFenetre`, assemblée par `fabriquesDuNoyau.ts`. Une sortie à quorum (`quorum`) suit le chemin des fenêtres à
 * quorum (`jouerOuMarquer`, #3369), que la validation (`validationDeFenetre.ts`) partage.
 */
import { t } from '../i18n';
import { garanti } from '../lib/garanti';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { Jeu } from './etat';
import type { Get, PatchDeFlux, Set } from './flowTypes';
import { libelleDeLaFermeture } from './libelles';
import { estFenetreQuiSeFerme, sortieDeLaFenetre, type FenetreQuiSeFerme, type GesteDeFenetreDeclare, type QuiValideLaFenetre } from './modalArbiter';
import { decidingSeat, quorumAtteint } from './netOwnership';
import { refuserGesteDuSiege } from './refusVisible';
import type { FermetureDuJet } from './rollFlowFactory';

/** Le corps de la sortie de chaque fenêtre qui se ferme, que seul `fenetreFermer` appelle : une fenêtre qui déclare sa
 *  `sortie` sans corps ne compile pas. */
export type SortiesDeFenetre = { readonly [F in FenetreQuiSeFerme]: () => void };

type GesteDeclare = GesteDeFenetreDeclare<QuiValideLaFenetre>;

/** Le geste se joue-t-il au quorum : chaque siège requis s'y dit prêt (`quorum`, `hoteAuQuorum`). */
const auQuorum = (g: GesteDeclare): boolean => g.qui === 'quorum' || g.qui === 'hoteAuQuorum';

/** Les sièges que le pending de la fenêtre à quorum `g` marque prêts. */
const marquesDe = (s: Jeu, g: GesteDeclare): Readonly<Record<number, boolean>> =>
  (g.marques ? (s as unknown as Record<string, { readyBySeat?: Record<number, boolean> } | null>)[g.marques]?.readyBySeat : undefined) ?? {};

/** Le geste à quorum `g` se joue-t-il maintenant, au siège qui décide (`decidingSeat`), sur les sièges prêts
 *  `marques` : les sièges requis le sont (`quorumAtteint`), hors de l'état d'un invité, et pour `hoteAuQuorum` à l'appel
 *  de l'hôte. */
function seJoueAuQuorum(s: Jeu, g: GesteDeclare, marques: Readonly<Record<number, boolean>>): boolean {
  if (s.net.mode === 'invite' || !quorumAtteint(s, marques)) return false;
  return g.qui === 'quorum' || decidingSeat(s) === 0;
}

/** Ce qui ferme maintenant le geste à quorum `g` : le siège qui décide s'y est déjà dit prêt, et le geste ne se joue pas
 *  encore (`quorumAttendu`) ; `null` hors quorum. */
export function fermetureDuQuorum(s: Jeu, g: GesteDeclare): FermetureDuJet | null {
  if (!auQuorum(g)) return null;
  const marques = marquesDe(s, g);
  return marques[decidingSeat(s)] && !seJoueAuQuorum(s, g, marques) ? 'quorumAttendu' : null;
}

/** Joue le geste `corps` de la fenêtre déclarée `g` ; à quorum, marque d'abord prêt le siège qui décide, et ne le joue
 *  qu'au quorum (`seJoueAuQuorum`). En solo, le quorum est l'hôte seul : le geste se joue d'un appel. */
export function jouerOuMarquer(get: Get, set: Set, g: GesteDeclare, corps: () => void): void {
  if (auQuorum(g) && g.marques) {
    const pending = (get() as unknown as Record<string, object | null>)[g.marques];
    if (!pending) return;
    const marques = { ...marquesDe(get(), g), [decidingSeat(get())]: true };
    set({ [g.marques]: { ...pending, readyBySeat: marques } } as PatchDeFlux<Jeu>);
    if (!seJoueAuQuorum(get(), g, marques)) return;
  }
  corps();
}

/** Ce qui ferme la sortie de `fenetre` maintenant : son verdict (`sortieFermee`), puis son quorum (`fermetureDuQuorum`). */
export function fermetureDeLaSortie(s: Jeu, fenetre: FenetreQuiSeFerme): FermetureDuJet | null {
  const sortie = sortieDeLaFenetre(fenetre);
  return sortie ? sortie.fermee(s) ?? fermetureDuQuorum(s, sortie) : null;
}

/** Ce qui refuse la sortie de `fenetre` venue d'une frontière (JSON d'un hôte, intention d'un siège) : une fenêtre qui
 *  ne se ferme pas, une fenêtre fermée, la sortie de l'hôte dans l'état d'un invité, ce qui ferme sa sortie maintenant
 *  (`fermetureDeLaSortie`) ; `null` : elle se joue. */
export function refusDeLaSortie(s: Jeu, fenetre: unknown): string | null {
  return estFenetreQuiSeFerme(fenetre) ? refusDeLaSortieNommee(s, fenetre) : t('sortie.refus.inconnue');
}

/** Ce qui refuse la sortie de `fenetre` maintenant (`refusDeLaSortie`) ; `null` : elle se joue. */
export function refusDeLaSortieNommee(s: Jeu, fenetre: FenetreQuiSeFerme): string | null {
  const sortie = garanti(sortieDeLaFenetre(fenetre), fenetre, 'sortie déclarée');
  if (!sortie.ouverte(s)) return t('sortie.refus.fermee');
  if (sortie.qui === 'hote' && s.net.mode === 'invite') return t('sortie.refus.hoteSeul');
  const fermee = fermetureDeLaSortie(s, fenetre);
  return fermee && libelleDeLaFermeture(fermee);
}

/** Le verbe de sortie du noyau sur `get`/`set` : il refuse, et le dit, la sortie que `refusDeLaSortie` refuse, sinon
 *  joue le corps de la fenêtre (`sorties`), au quorum pour une sortie à quorum. */
export function creerSortieDeFenetre(get: Get, set: Set, sorties: SortiesDeFenetre): Pick<ActionsDuNoyau, 'fenetreFermer'> {
  return {
    fenetreFermer: (fenetre) => {
      const refus = refusDeLaSortie(get(), fenetre);
      if (refus) { refuserGesteDuSiege(get, set, refus); return; }
      jouerOuMarquer(get, set, sortieDeLaFenetre(fenetre)!, sorties[fenetre]);
    },
  };
}
