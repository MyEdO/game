/**
 * Les actes hors combat, joués par le noyau dans une partie d'exploration : achats aux PX, niveau de carrière, objet
 * équipé ou utilisé, prière, nuit de repos, jour qui passe, repas du village.
 */
import {
  arena, gestesDExploration, gestesDeLObjet, gesteDeLaPanoplie, gesteDIncantation, gesteDuRepos, gesteDeLaisserPasserLeTemps, MINUTES_PER_DAY,
  fenetreDuJeu, type GesteDuJeu, type GesteFermable, type Jeu, type Combatant, type Main,
} from '../../../../src/noyau';
import { lignesDuJournal, ouvrirEnAuto } from './partie';

/** Un geste du noyau : l'offre du noyau sur l'état de la partie au moment de la jouer, et son refus ; rien s'il n'y en
 *  a pas. */
export type Geste = (s: Jeu) => GesteFermable | null | undefined;
/** Le geste `quoi` de l'objet `uid` du porteur `porteurId`, lu de la vue du noyau (`gestesDeLObjet`) au moment de le
 *  jouer. */
export const gesteDeLObjet = (porteurId: string, uid: string, quoi: 'porter' | 'utiliser'): Geste => (s) => gestesDeLObjet(s, porteurId, uid)?.[quoi];
/** Le geste qui met l'objet `uid` dans la main `main` du set `setId` du porteur `porteurId`, lu de la vue du noyau
 *  (`gestesDeLObjet`) au moment de le jouer. */
export const gesteDeLaMain = (porteurId: string, setId: string, main: Main, uid: string): Geste => (s) => gestesDeLObjet(s, porteurId, uid, setId)?.mains?.[main];
/** Le geste qui fait prendre au héros `heroId` son set d'armes `loadoutId`, lu du noyau (`gesteDeLaPanoplie`) au
 *  moment de le jouer. */
export const gesteDePrendreLaPanoplie = (heroId: string, loadoutId: string): Geste => (s) => gesteDeLaPanoplie(s, heroId, loadoutId);
/** Le geste qui fait incanter à `lanceurId` le sort `spellId` sur `cibleId`, lu du noyau (`gesteDIncantation`) au
 *  moment de le jouer. */
export const gesteDIncanter = (lanceurId: string, spellId: string, cibleId: string): Geste => (s) => gesteDIncantation(s, lanceurId, spellId, cibleId);
/** Le geste qui fait dormir le groupe une nuit là où il se tient (`gesteDuRepos`). LDB 18 l.296 */
export const gesteDeDormir: Geste = (s) => gesteDuRepos(s);
/** Le geste qui laisse passer un jour sans nuit de repos (`gesteDeLaisserPasserLeTemps`). LDB 20 */
export const gesteDUnJour: Geste = (s) => gesteDeLaisserPasserLeTemps(s, MINUTES_PER_DAY);

/** Où le groupe se tient sur la place. */
const DEPART = { x: 2, y: 4 };
/** La table commune du village, au contact du groupe, et son repas (`mealParty`) : le village nourrit chaque héros
 *  présent pour la journée. Valeur d'adaptation, MyEdO/game#5121. */
const TABLE_COMMUNE = {
  id: 'table-commune', kind: 'prop', decor: { id: 'table' }, pos: { x: DEPART.x + 1, y: DEPART.y },
  usable: { actions: [{ id: 'manger', label: 'Manger', flow: { kind: 'effet', effet: { type: 'mealParty' } }, minutes: 60 }] },
} as const;
const [REPAS] = TABLE_COMMUNE.usable.actions;
/** Le geste qui fait manger le groupe à la table commune, lu des gestes d'exploration du noyau (`gestesDExploration`). */
export const gesteDuRepas: Geste = (s) => {
  const g = gestesDExploration(s).find((x) => x.gestes.length === 1 && x.gestes[0].args[0] === TABLE_COMMUNE.id && x.gestes[0].args[1] === REPAS.id);
  return g && { geste: g.gestes[0], refus: g.refus ?? null };
};
/** Une journée au village : le repas à la table commune, puis le reste du jour sans nuit de repos. LDB 18 l.337-343 */
export const JOURNEE_AU_VILLAGE: readonly Geste[] = [gesteDuRepas, (s) => gesteDeLaisserPasserLeTemps(s, MINUTES_PER_DAY - REPAS.minutes)];

export interface IssueAuHameau { groupe: Combatant[]; journal: string[] }
/** Où la partie se tient : le nom de la place, le repos qu'elle offre (`Scene.rest`, le camp s'il est absent), et la
 *  table commune du village (`TABLE_COMMUNE`) si elle y est mise. */
export interface Place { label: string; rest?: ReturnType<typeof arena>['rest']; table?: true }
const HAMEAU: Place = { label: 'Grisefosse' };
/** Le hameau, la table commune mise : où le héros passe ses jours hors séjour (`JOURNEE_AU_VILLAGE`). */
export const VILLAGE: Place = { ...HAMEAU, table: true };

/** Joue `gestes` sur le `groupe` dans une partie du noyau ouverte hors combat sur la `place` (dégagée, en
 *  exploration) : achats aux PX, changement de niveau de carrière, objet utilisé, prière ou sort lancé, nuit de repos,
 *  jour qui passe. Une offre refusée ne se joue pas : son refus va au journal. Rend le groupe tel que le noyau le
 *  laisse, et les lignes que son journal a écrites. */
export function auHameau(groupe: readonly Combatant[], gestes: readonly Geste[], graine: number, place: Place = HAMEAU): IssueAuHameau {
  const journal: string[] = [];
  const place0 = arena({ id: 'hameau', label: place.label, w: 8, h: 8, heroStart: DEPART });
  const scene = { ...place0, ...(place.rest ? { rest: place.rest } : {}), ...(place.table ? { entities: [...place0.entities, structuredClone(TABLE_COMMUNE) as never] } : {}) };
  const { partie, envoyer, pomper, jouerDansLaFenetre } = ouvrirEnAuto(
    graine,
    () => ({ party: groupe.map((h) => structuredClone(h)), scene, projet: null }),
    (r) => { journal.push(...lignesDuJournal(r)); },
  );
  pomper();
  for (const g of gestes) {
    const offre = g(partie.etat() as Jeu);
    if (offre?.refus) journal.push(offre.refus);
    else if (offre) envoyer(offre.geste.verbe, offre.geste.args);
    pomper();
    fermerLeBilan(() => partie.etat() as Jeu, jouerDansLaFenetre, pomper);
  }
  const rendu = partie.etat().party.map((c) => structuredClone(c));
  partie.fermer();
  return { groupe: rendu, journal };
}

/** Plafond des bilans de cascade que `fermerLeBilan` ferme à la suite. */
const PLAFOND_DE_BILANS = 10;

/** Ferme le bilan de la cascade que le geste laisse au joueur, ses étapes résolues par la pompe (`combatAuto.ts`) : le
 *  geste de sa fenêtre, sa sortie, en dénoue la suite (la nuit, le réveil). */
function fermerLeBilan(etat: () => Jeu, jouerDansLaFenetre: (choisi: (g: GesteDuJeu) => boolean) => void, pomper: () => void): void {
  for (let n = 0; n < PLAFOND_DE_BILANS && fenetreDuJeu(etat() as never)?.cle === 'cascade'; n++) {
    jouerDansLaFenetre((g) => g.fenetre === 'cascade');
    pomper();
  }
}
