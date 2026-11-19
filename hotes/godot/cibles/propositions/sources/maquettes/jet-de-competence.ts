/**
 * Le Test de compétence (#4411) : la réponse de Mira demande un Test de Charme ; le jet tombé, les gestes qui le
 * suivent et les réserves qu'ils dépensent (LDB 17 l.23-24, l.68), l'aubergiste en face
 * (`../../exploration-et-recit.md`, section `jet-de-competence`).
 */
import { combattants, RESERVES } from './compagnie.ts';
import { apresLeDe, reserves } from './dome.ts';
import { GUSTAV, LA_DILIGENCE } from './exploration.ts';
import type { Ecran } from './maquette.ts';

export default {
  etats: [{
    nom: 'jet-de-competence', gabarit: 'lieu-et-voyage', decor: 'salle', titre: LA_DILIGENCE, groupeEn: 'comptoir',
    journal: ['Le groupe entre dans la salle commune.', 'Mira s’adresse à Gustav Fondleburger.', 'Mira tente de charmer Gustav Fondleburger.'],
    combattants: combattants({ gustav: GUSTAV }),
    fenetre: {
      titre: 'Test de Charme',
      heros: { role: 'testeur', qui: 'mira', test: 'Charme', seuil: 43, jet: { des: [20, 7], dr: 2, reussite: true } },
      centre: { role: 'simple', sur: 'Test de Charme', difficulte: { nom: 'Intermédiaire', valeur: 0 }, dr: 2, phrase: 'Gustav se laisse amadouer et baisse la voix.' },
      autre: { role: 'interlocuteur', qui: 'gustav', comme: 'Interlocuteur', dit: '« À quel prix cèdent-ils leurs places, entre nous ? »' },
      gestes: apresLeDe(RESERVES.mira), reserves: reserves(RESERVES.mira),
    },
  }],
} satisfies Ecran;
