import type { Combatant } from '../engine/types';
import type { Stockage } from '../lib/stockage';
import { stockageWeb } from '../web/stockageWeb';
import { mettreAJourLeRoster } from '../hote/roster';

/** Le stockage du roster web (#3041) : `localStorage`, relu à chaque appel. */
export const stockageDuRoster = (): Stockage | null => stockageWeb('localStorage');

/** Le service `persisterLeHeros` du web : la procédure roster (`hote/roster.ts`) sur son stockage. */
export const persisterLeHerosWeb = (hero: Combatant): void => mettreAJourLeRoster(stockageDuRoster(), hero);
