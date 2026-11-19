/**
 * Garde — une Activité PROPOSÉE produit quelque chose (#735).
 *
 * Une Activité consomme un créneau du budget d'Activités (LDB 23 l.5). Une entrée sans issue
 * mécanique — ni `resolver`, ni `onSuccess`, ni bande d'`outcomes`, ni effet d'Étape/de Scène —
 * dépense donc ce créneau contre rien. Deux sorties, une seule porte : ou l'entrée porte son issue,
 * ou elle porte sa dette `blocked` (`ActivityDef.blocked`) et `activitiesFor` la retire de TOUS les
 * catalogues jouables. Aucune liste d'exception ici : le périmètre est DÉRIVÉ du catalogue.
 */
import { describe, it, expect } from 'vitest';
import { activitiesFor, type ActivityContext, type ActivityDef } from './activities';
import { ACTIVITIES } from '../data';

const CONTEXTS: ActivityContext[] = ['interlude', 'voyage', 'mer', 'bataille', 'bataille-round', 'auberge'];

/** L'Activité porte-t-elle une issue que le moteur sait jouer ? (issue de Personnage, d'Étape ou de
 *  Scène de bataille — `sceneKind`/`grantsFlag` sont résolus par `massBattleFlow`.) */
function produitQuelqueChose(def: ActivityDef): boolean {
  return !!(
    def.resolver ||
    def.onSuccess?.length ||
    def.outcomes?.length ||
    def.stageOutcome ||
    def.sceneKind ||
    def.grantsFlag
  );
}

describe('Activités — issue mécanique ou dette déclarée (#735)', () => {
  it('toute Activité proposée par `activitiesFor` porte une issue', () => {
    const muettes = CONTEXTS.flatMap((ctx) =>
      activitiesFor(ctx).filter((d) => !produitQuelqueChose(d)).map((d) => `${ctx}/${d.id}`),
    );
    expect(muettes).toEqual([]);
  });

  it('une Activité à dette `blocked` reste au catalogue mais n’est proposée dans AUCUN contexte', () => {
    const bloquees = ACTIVITIES.filter((a) => a.blocked);
    expect(bloquees.length).toBeGreaterThan(0);
    for (const def of bloquees) {
      expect(ACTIVITIES.some((a) => a.id === def.id), def.id).toBe(true);
      for (const ctx of CONTEXTS) {
        expect(activitiesFor(ctx).some((a) => a.id === def.id), `${ctx}/${def.id}`).toBe(false);
      }
    }
  });

  it('chaque dette `blocked` nomme son ticket et sa raison', () => {
    for (const def of ACTIVITIES.filter((a) => a.blocked)) {
      expect(def.blocked!.ticket, def.id).toMatch(/^#\d+$/);
      expect(def.blocked!.raison.trim().length, def.id).toBeGreaterThan(20);
    }
  });

  it('CÂBLAGE : le filtre vit dans `activitiesFor`, pas dans les appelants', () => {
    const brassage = ACTIVITIES.find((a) => a.id === 'brasser-une-potion')!;
    expect(brassage.contexts).toContain('interlude'); // le contexte curé reste en donnée…
    expect(activitiesFor('interlude').map((a) => a.id)).not.toContain('brasser-une-potion'); // …la porte tranche
  });
});
