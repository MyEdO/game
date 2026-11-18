/**
 * La dissipation d'un Sort permanent (#4411) : Ilyanwe choisit, pour son Action, le Sort du Chamane gobelin à dissiper
 * et si elle s'unit à un lanceur du même Domaine (LDB 46 l.160-162 ; `ecran.offre.dissipation`), puis son Test étendu de
 * Langue (Magick) avant et après le dé, le cumul de ses DR sur le Niveau d'incantation (`src/noyau/pendings.ts:735`,
 * `cs.dispelRoll`), sur la cour (`../../combat-suite.md`, sections `dissipation`).
 */
import { ligne } from '../../../../../../src/hote/elements';
import {
  apresLeDe,
  avantLeDe,
  BERTA,
  cartes,
  CHAMANE,
  cumul,
  fenetreSurLeDome,
  heros,
  ILYANWE,
  jet,
  offre,
  ORC,
  RESERVES,
  reserves,
  type TourDuDome,
  visee,
} from './dome';
import type { Ecran } from './maquette';

/** Le premier tour du round 2, dont le journal dit `dit` en dernier. */
const tour = (dit: string): TourDuDome => ({
  tour: 'Round 2 · tour 1 sur 4', suite: [BERTA, ILYANWE], round: 'Round 3', ordre: [ORC, CHAMANE, BERTA, ILYANWE],
  journal: ['Chamane gobelin lance Arme aethyrique.', 'Chamane gobelin s’abrite sous un Dôme.', dit],
});
/** Le Test étendu, tombé ou non, et le cumul qu'il porte. */
const etendu = (nom: string, titre: string, tombe: boolean) => fenetreSurLeDome(nom, titre, 'incantation', tour('Ilyanwe la Voilée entame la Dissipation du Dôme.'), {
  titre: 'Dissipation',
  corps: [ligne('sort/ni', 'Test étendu · Niveau d’incantation 7'), jet('jet', ILYANWE, 'Langue (Magick) · coûte l’Action', '≤ 85', tombe ? { resultat: '51', dr: '+3', reussite: true } : undefined),
    ligne('sort', 'Dôme'), cumul(tombe ? 5 : 2, 7), ligne('issue', tombe ? 'Le Dôme vacille : encore 2 DR pour le dissiper.' : 'Encore 5 DR pour dissiper le Dôme.'), visee(CHAMANE, 'Lanceur du Sort visé')],
  gestes: tombe ? apresLeDe('dissipation', { reussi: true, chance: RESERVES.ilyanwe.chance, resilience: RESERVES.ilyanwe.resilience }) : avantLeDe('dissipation', { annuler: true, resilience: RESERVES.ilyanwe.resilience }),
  reserves: reserves(RESERVES.ilyanwe),
});

export default {
  etats: [
    fenetreSurLeDome('dissipation-entree', 'Dissipation, le Sort à dissiper et le soutien', 'incantation', tour('Berta se met en Défensive.'), {
      titre: 'Dissipation',
      corps: [heros(ILYANWE, ['Langue (Magick) ≤ 85'], { modificateurs: ['Coûte l’Action'] }), visee(CHAMANE, 'Porteur désigné')],
      reglages: [
        offre('dissipation', 'Sort à dissiper', [[`dissipation/dome/${CHAMANE}`, 'Dôme', 'Niveau d’incantation 7\nTest étendu : 7 DR à cumuler'], [`dissipation/arme-aethyrique/${CHAMANE}`, 'Arme aethyrique', 'Niveau d’incantation 2\nTest étendu : 2 DR à cumuler']], 0),
        cartes('offre/dissipation/soutien', 'Soutien', [[null, 'Seule', 'Test étendu sans soutien'], ['unir', 'S’unir', 'Test Soutenu, même Domaine', 'Aucun lanceur du même Domaine à portée.']], 0),
      ],
      gestes: [],
    }),
    etendu('dissipation-avant-le-de', 'Dissipation, le Test étendu avant le dé', false),
    etendu('dissipation', 'Dissipation, le Test étendu tombé', true),
  ],
} satisfies Ecran;
