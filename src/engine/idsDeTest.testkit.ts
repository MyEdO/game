import { fabriqueLocale } from './fabriqueDId';

/** La fabrique d'ids des tests (#2907) : une par module chargé, partagée par les fichiers qu'un même worker joue sous
 *  `isolate: false` ; ses ids (`test-<genre>-N`) restent à l'écart de ceux d'un état de partie. */
export const idsDeTest = fabriqueLocale('test');
