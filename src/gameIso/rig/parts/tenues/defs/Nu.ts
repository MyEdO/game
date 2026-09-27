import type { TenueDef } from '../types';
import { BODIES } from '../../bodies';

// Tenue « nue » (corps de chair, pas de vêtement) — torse/jambes du corps de base `BODIES.nu`
// (3 vues dédiées, jamais redessinées ici), pour les monstres sans habit (trolls, goules,
// snotlings). Le jeton @peau suit la palette d'espèce. Ne chausse pas : le repli du pied est le
// Nu de l'ESPÈCE (`race.extremites`, lisse par défaut — #736, décision 2026-07-21 #481).
// Sélectionnable via le sélecteur de tenue de l'éditeur (careerTenueFor traite 'Nu' à part).
export const tenue: TenueDef = {
  label: 'Nu',
  id: 'nu',
  set: {
    torse: { front: BODIES.nu.torseFront, back: BODIES.nu.torseBack, profile: BODIES.nu.torseProfile },
    jambes: BODIES.nu.jambe,
  },
};
