import { fabriqueLocale, type FabriqueDuRoster } from './fabriqueDId';

/** La fabrique d'ids des tests (#2907) : une par module chargé, partagée par les fichiers qu'un même worker joue sous
 *  `isolate: false` ; ses ids (`test-<genre>-N`) restent à l'écart de ceux d'un état de partie. */
export const idsDeTest = fabriqueLocale('test');

/** L'entropie de roster d'une session de test (#2907), telle qu'une plateforme la fournit : une source propre à la
 *  session, dont les ids (`<session>-<genre>-N`) ne croisent ceux d'aucune autre session. */
export const rosterDeTest = (session: string): FabriqueDuRoster => fabriqueLocale(session) as FabriqueDuRoster;
