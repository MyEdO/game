/**
 * LA TABLE DE TEST DU PONT (#2928, `CONTRAT.md`) : le pont appelé comme Godot l'appelle (le nom d'une méthode et une
 * chaîne JSON, une chaîne JSON en retour), et les jetons programmés rejoués sur l'horloge virtuelle du module commun
 * (`horlogeVirtuelle`, `src/hote/partie.ts`), là où Godot arme ses minuteurs.
 */
import { expect } from 'vitest';
import { creerPont, type Pont, type Suite } from './pont';
import type { CategorieDuPont } from './pont';
import type { LigneDuJournal } from '../../../src/noyau/index';
import { horlogeVirtuelle } from '../../../src/hote/partie';

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
