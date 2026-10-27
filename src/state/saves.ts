import type { Stockage } from '../lib/stockage';
import { stockageWeb } from '../web/stockageWeb';

/** Le stockage des emplacements de sauvegarde du web (#3041) : `localStorage`, relu à chaque appel, sous la
 *  procédure `hote/sauvegardes.ts`. */
export const stockageDesSauvegardes = (): Stockage | null => stockageWeb('localStorage');
