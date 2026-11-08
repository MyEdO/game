import { fabriqueLocale } from './fabriqueDId';

/** La fabrique d'ids des tests (#2907) : une par fichier de test, ses ids à l'écart de ceux d'un état de partie. */
export const idsDeTest = fabriqueLocale('test');
