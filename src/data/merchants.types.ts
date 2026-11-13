import type { EntreeDe } from './datasets';
import type * as merchantsDef from './schemas/defs/merchants';

/** Catégorie d'unité ACHETABLE chez un marchand (#619) : le navire n'en est pas (#748). */
export type UniteAchetable = 'bete' | 'vehicule-terrestre';

/** Archétype de marchand (#2). */
export type MerchantArchetypeDef = EntreeDe<typeof merchantsDef>;
