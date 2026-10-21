/**
 * Garde de la CLASSE « catalogues à id RÉEL » (#401) : les 11 datasets éditoriaux dont l'identité de
 * navigation Codex était naguère DÉRIVÉE du libellé au build (`uniqueSlugId`, b9196398) portent
 * un champ `id` STABLE en donnée : chaque entrée a un `id` non vide ; son unicité dans le catalogue est
 * refusée au parse (collection à clé, `schemas/grammaire/collection-cle.ts`). Le libellé s'édite sans
 * toucher l'id (fiche `user-doctrine-ids-stables-labels-affichage`).
 *
 * Catalogue distinct d'`id-collisions.test.ts` (jeu de catalogues FIXE traits/talents/… + assertion
 * de collisions INTER-catalogue) : ici les cross-collisions sont bénignes et VOULUES (« noir » dans
 * eyes ET hairs) — les y verser ferait rougir sa liste `KNOWN_CROSS`.
 */
import { describe, it, expect } from 'vitest';
import {
  eyes, hairs, calendarMonths, calendarIntercalary, calendarWeekdays,
  oups, interludeEvents, peripeties, pregens, massBattleHazards,
} from './index';
import { OBSESSIONS } from './obsessions';

/** Chaque catalogue normalisé en `{ id, label }[]`. */
const CATALOGS: Record<string, { id: string; label: string }[]> = {
  eyes: eyes.map((e) => ({ id: e.id, label: e.label })),
  hairs: hairs.map((e) => ({ id: e.id, label: e.label })),
  calendarMonths: calendarMonths.map((e) => ({ id: e.id, label: e.label })),
  calendarIntercalary: calendarIntercalary.map((e) => ({ id: e.id, label: e.label })),
  calendarWeekdays: calendarWeekdays.map((e) => ({ id: e.id, label: e.label })),
  oups: oups.map((e) => ({ id: e.id, label: e.label })),
  interludeEvents: interludeEvents.map((e) => ({ id: e.id, label: e.label })),
  peripeties: peripeties.map((e) => ({ id: e.id, label: e.label })),
  pregens: pregens.map((e) => ({ id: e.id, label: e.label })),
  obsessions: OBSESSIONS.map((e) => ({ id: e.id, label: e.label })),
  massBattleHazards: massBattleHazards.map((e) => ({ id: e.id, label: e.label })),
};

describe('#401 — catalogues éditoriaux à id RÉEL en donnée', () => {
  for (const [name, entries] of Object.entries(CATALOGS)) {
    it(`${name} — id non vide sur chaque entrée`, () => {
      const ids = entries.map((e) => e.id);
      expect(ids.filter((id) => !id || !id.trim()), `${name} : entrée(s) sans id`).toEqual([]);
    });

  }
});
