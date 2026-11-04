/**
 * LA TABLE DE TEST DU PONT (#2928, `CONTRAT.md`) : le pont appelé comme Godot l'appelle (le nom d'une méthode et une
 * chaîne JSON, une chaîne JSON en retour), les jetons programmés rejoués sur l'horloge virtuelle du module commun
 * (`horlogeVirtuelle`, `src/noyau/horlogeVirtuelle.ts`), là où Godot arme ses minuteurs, et ce qu'il manque à une vue pour que
 * Godot dessine chaque verbe de sa fenêtre (`fautesDeLaFenetre`).
 */
import { expect } from 'vitest';
import { creerPont, type Pont, type Suite, type VueDuPont } from './pont';
import type { CategorieDuPont } from './pont';
import { cleDuGeste, horlogeVirtuelle, type LigneDuJournal } from '../../../src/noyau/index';
import { parametresDuGeste, type ArgumentDuGeste, type GesteDeLaFenetre } from '../../../src/hote/gestes';

/** Une réponse décodée. */
export type Reponse = ({ ok: true } & Partial<Suite> & Record<string, unknown>) | { ok: false; erreur: { categorie: CategorieDuPont; message: string } };

/** Un pont neuf, et ses appels : `entree` passe en JSON, absente sans entrée. */
export function table() {
  const pont: Pont = creerPont();
  const appel = (methode: string, entree?: unknown): Reponse => {
    const brut = pont.appeler(methode, entree === undefined ? undefined : JSON.stringify(entree));
    expect(typeof brut, 'le pont rend une chaîne JSON').toBe('string');
    return JSON.parse(brut) as Reponse;
  };
  return { pont, appel };
}

/** La suite d'une réponse réussie, ou l'échec qui dit la réponse. */
export function suiteDe(r: Reponse): Suite {
  if (!r.ok || !r.vue || !r.programmes || !r.journal) throw new Error(`réponse sans suite : ${JSON.stringify(r).slice(0, 400)}`);
  return r as unknown as Suite;
}

/** L'erreur d'une réponse refusée : sa catégorie et son message. */
export function erreurDe(r: Reponse): { categorie: CategorieDuPont; message: string } {
  if (r.ok) throw new Error(`réponse acceptée, refus attendu : ${JSON.stringify(r).slice(0, 400)}`);
  return r.erreur;
}

/** Rejoue tous les jetons d'une suite et de leurs reprises sur l'horloge virtuelle du noyau
 *  (`horlogeVirtuelle`), là où Godot arme ses minuteurs : la dernière suite, et toutes les lignes de journal, celles de
 *  `r` comprises. */
export function drainer(appel: ReturnType<typeof table>['appel'], r: Reponse): { suite: Suite; journal: LigneDuJournal[] } {
  let suite = suiteDe(r);
  const journal = [...suite.journal];
  horlogeVirtuelle((jeton) => {
    suite = suiteDe(appel('reprendre', { jeton }));
    journal.push(...suite.journal);
    return suite.programmes;
  }, suite.programmes).vider();
  return { suite, journal };
}

/** Ce qu'il manque à un argument saisi pour se dessiner : son libellé (jamais son nom), chaque valeur d'un choix nommée,
 *  chaque champ d'un objet. */
function fautesDeLArgument(ou: string, a: ArgumentDuGeste): string[] {
  if (a.saisie === 'fixe') return [];
  return [
    ...(!a.libelle || a.libelle === a.nom ? [`${ou} : libellé ${String(a.libelle)}`] : []),
    ...(a.saisie === 'choix' && (!a.valeurs?.length || a.valeurs.some((v) => !v.libelle)) ? [`${ou} : un choix sans valeur nommée`] : []),
    ...(a.saisie === 'objet' ? (a.champs ?? []).flatMap((c) => fautesDeLArgument(`${ou}.${c.nom}`, c)) : []),
  ];
}

/** Ce qu'il manque à la vue pour dessiner chaque geste de la fenêtre qui tient la main : son geste, son libellé (jamais
 *  son id), chacun de ses paramètres (`parametresDuGeste`) en argument,
 *  le flux d'un geste de jet et l'id désigné posés, chaque argument saisi nommé (`fautesDeLArgument`), et le titre de
 *  la fenêtre. */
export function fautesDeLaFenetre(vue: VueDuPont): string[] {
  const f = vue.projection.fenetre;
  if (!f) return vue.fenetre ? ['une fenêtre dessinée sans fenêtre qui tient la main'] : [];
  if (!vue.fenetre) return [`la fenêtre ${f.cle} n’est pas dessinée`];
  const cles = f.gestes.map(cleDuGeste);
  const ids = new Set([f.cle, ...cles, ...f.gestes.map((g) => g.verbe)]);
  const fautes = [
    ...(ids.has(vue.fenetre.titre) ? [`titre ${vue.fenetre.titre} : un id`] : []),
    ...(vue.fenetre.gestes.map((g) => g.cle).join() === cles.join() ? [] : [`gestes ${vue.fenetre.gestes.map((g) => g.cle).join()} ≠ gestes de la fenêtre ${cles.join()}`]),
  ];
  for (const g of vue.fenetre.gestes) {
    const geste = f.gestes.find((x) => cleDuGeste(x) === g.cle);
    if (!geste) continue;
    const { flux } = geste;
    const parametres = parametresDuGeste(geste);
    if (!g.libelle || ids.has(g.libelle)) fautes.push(`${g.cle} : libellé ${g.libelle}`);
    if (g.arguments.map((a) => a.nom).join() !== parametres.map((p) => p.nom).join()) fautes.push(`${g.cle} : arguments ${g.arguments.map((a) => a.nom).join()} ≠ paramètres ${parametres.map((p) => p.nom).join()}`);
    for (const a of g.arguments) {
      const pose = a.nom === 'flux' ? flux : f.pid;
      if (a.saisie === 'fixe' && a.valeur !== pose) fautes.push(`${g.cle}.${a.nom} : posé à ${String(a.valeur)}, la fenêtre désigne ${String(pose)}`);
      fautes.push(...fautesDeLArgument(`${g.verbe}.${a.nom}`, a));
      if (a.saisie === 'choix' && (g.rendu === 'bouton' || ((g.rendu === 'choix' || g.rendu === 'liste') && g.aChoisir !== a.nom))) fautes.push(`${g.verbe}.${a.nom} : des valeurs nommées que le rendu ${g.rendu} ne fait pas dire`);
    }
  }
  return fautes;
}

/** Le geste d'identité `cle` (`cleDuGeste`) dans la fenêtre dessinée, ou l'échec qui la dit. */
export function gesteDe(vue: VueDuPont, cle: string): GesteDeLaFenetre {
  const g = vue.fenetre?.gestes.find((x) => x.cle === cle);
  if (!g) throw new Error(`aucun geste ${cle} dans ${JSON.stringify(vue.fenetre?.gestes.map((x) => x.cle))}`);
  return g;
}

/** Les arguments d'un geste comme Godot les envoie : l'id posé par la fenêtre, puis les valeurs saisies, dans l'ordre. */
export function argsDe(g: GesteDeLaFenetre, ...saisies: unknown[]): unknown[] {
  const reste = [...saisies];
  return g.arguments.flatMap((a) => (a.saisie === 'fixe' ? [a.valeur] : reste.length ? [reste.shift()] : []));
}
