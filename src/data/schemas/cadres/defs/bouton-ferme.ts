import { plaque } from '../biseau';

/** Bouton fermé : une plaque de fer noirci dans un filet de fer, aucun laiton. */
export const cadre = plaque('bouton-ferme', 'Bouton fermé', ['--fer', '--fer-sombre'], '--shadow-ink', ['--fer-sombre', '--fer-clair', '--fer']);
