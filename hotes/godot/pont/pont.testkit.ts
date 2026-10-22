/**
 * LA TABLE DE TEST DU PONT (#2928, `CONTRAT.md`) : le pont appelé comme Godot l'appelle (le nom d'une méthode et une
 * chaîne JSON, une chaîne JSON en retour), les jetons programmés rejoués sur l'horloge virtuelle du module commun
 * (`horlogeVirtuelle`, `src/hote/partie.ts`), là où Godot arme ses minuteurs, et ce qu'il manque à une vue pour que
 * Godot dessine chaque verbe de sa fenêtre (`fautesDeLaFenetre`).
 */
import { expect } from 'vitest';
import { creerPont, type Pont, type Suite, type VueDuPont } from './pont';
import type { CategorieDuPont } from './pont';
import type { LigneDuJournal } from '../../../src/noyau/index';
import { horlogeVirtuelle } from '../../../src/hote/partie';
import type { ArgumentDuGeste, GesteDeLaFenetre } from '../../../src/hote/gestes';
import { VERBES } from '../../../src/hote/verbes.generated';

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

/** Rejoue tous les jetons d'une suite et de leurs reprises sur l'horloge virtuelle du module commun
 *  (`horlogeVirtuelle`), là où Godot arme ses minuteurs : la dernière suite, et toutes les lignes de journal, celles de
 *  `r` comprises. */
export function drainer(appel: ReturnType<typeof table>['appel'], r: Reponse): { suite: Suite; journal: LigneDuJournal[] } {
  let suite = suiteDe(r);
  const journal = [...suite.journal];
  horlogeVirtuelle(suite.programmes, (jeton) => {
    suite = suiteDe(appel('reprendre', { jeton }));
    journal.push(...suite.journal);
    return suite.programmes;
  });
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

/** Ce qu'il manque à la vue pour dessiner chaque verbe de la fenêtre qui tient la main : son geste, son libellé (jamais
 *  son id), chacun de ses paramètres (`VERBES`) en argument, l'id désigné posé, chaque argument saisi nommé
 *  (`fautesDeLArgument`), et le titre de la fenêtre. */
export function fautesDeLaFenetre(vue: VueDuPont): string[] {
  const f = vue.projection.fenetre;
  if (!f) return vue.fenetre ? ['une fenêtre dessinée sans fenêtre qui tient la main'] : [];
  if (!vue.fenetre) return [`la fenêtre ${f.cle} n’est pas dessinée`];
  const ids = new Set([f.cle, ...f.verbes]);
  const fautes = [
    ...(ids.has(vue.fenetre.titre) ? [`titre ${vue.fenetre.titre} : un id`] : []),
    ...(vue.fenetre.gestes.map((g) => g.verbe).join() === f.verbes.join() ? [] : [`gestes ${vue.fenetre.gestes.map((g) => g.verbe).join()} ≠ verbes ${f.verbes.join()}`]),
  ];
  for (const g of vue.fenetre.gestes) {
    const parametres = VERBES[g.verbe] ?? [];
    if (!g.libelle || ids.has(g.libelle)) fautes.push(`${g.verbe} : libellé ${g.libelle}`);
    if (g.arguments.map((a) => a.nom).join() !== parametres.map((p) => p.nom).join()) fautes.push(`${g.verbe} : arguments ${g.arguments.map((a) => a.nom).join()} ≠ paramètres ${parametres.map((p) => p.nom).join()}`);
    for (const a of g.arguments) {
      if (a.saisie === 'fixe' && a.valeur !== f.pid) fautes.push(`${g.verbe}.${a.nom} : posé à ${String(a.valeur)}, la fenêtre désigne ${String(f.pid)}`);
      fautes.push(...fautesDeLArgument(`${g.verbe}.${a.nom}`, a));
    }
  }
  return fautes;
}

/** Le geste du verbe `verbe` dans la fenêtre dessinée, ou l'échec qui la dit. */
export function gesteDe(vue: VueDuPont, verbe: string): GesteDeLaFenetre {
  const g = vue.fenetre?.gestes.find((x) => x.verbe === verbe);
  if (!g) throw new Error(`aucun geste ${verbe} dans ${JSON.stringify(vue.fenetre?.gestes.map((x) => x.verbe))}`);
  return g;
}

/** Les arguments d'un geste comme Godot les envoie : l'id posé par la fenêtre, puis les valeurs saisies, dans l'ordre. */
export function argsDe(g: GesteDeLaFenetre, ...saisies: unknown[]): unknown[] {
  const reste = [...saisies];
  return g.arguments.flatMap((a) => (a.saisie === 'fixe' ? [a.valeur] : reste.length ? [reste.shift()] : []));
}
