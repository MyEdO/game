/**
 * Gabarit MANQUANT — corps d'ERREUR d'une espèce d'auteur hors du domaine de saisie
 * (`resolveRender`, `src/data/schemas/grammaire/art.ts`) : la silhouette de repli visible (#223,
 * `MISSING_ART`), ancrée au sol par `groundedBody` sur le patron de l'engin (`engin/composeEngin.ts`),
 * jamais l'art d'une AUTRE espèce (#877).
 */
import type { BodyPlan } from '../bodyPlan';
import { groundedBody } from '../staticBody';
import { MISSING_ART, pickView } from '../viewArt';

export const manquantPlan: BodyPlan = {
  id: 'manquant',
  resolve: (_species, view, _pose, opts) => groundedBody(pickView(MISSING_ART, view)(), {}, opts?.colors, { id: 'manquant' }),
  speciesNames: () => [],
  portraitBox: '25 80 70 70',
  restPose: () => ({}),
  walkPose: () => ({}),
  attackPose: () => ({}),
  deathPose: () => ({}),
  hasView: () => true,
};
