import { segment } from '../segment';

/** Segment pressé, la valeur courante : une case d'or, liserée d'encre. */
export const cadre = segment('segment-presse', 'Segment pressé', ['--or-eclat', '--or-plein', '--or-ombre'], 1, '--shadow-ink', 0.9, '--ink');
