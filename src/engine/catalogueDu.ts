/**
 * FOSSILE 6 du catalogue en valeur (#5069, `docs/plans/2026-11-25-composition-d-un-jeu.md`) : le catalogue d'un
 * contexte du moteur (`OpsCtx`, `ContexteDuTest`), le fossile 1 quand le contexte n'en porte pas.
 */
import { catalogueDuProcessus } from '../data/catalogueDuProcessus';
import type { Catalogue } from '../data/schemas/catalogue/catalogue';

export const catalogueDu = (ctx: { readonly catalogue?: Catalogue }): Catalogue => ctx.catalogue ?? catalogueDuProcessus();
