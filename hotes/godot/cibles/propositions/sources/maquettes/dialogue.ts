/**
 * Le dialogue (#4411) : Mira au comptoir de La Diligence, les réponses qu'elle peut faire à gauche, l'aubergiste et sa
 * réplique à droite ; une réponse demande un Test, une autre coûte (`../../exploration-et-recit.md`, section `dialogue`).
 */
import { combattants } from './compagnie.ts';
import { GUSTAV, LA_DILIGENCE, SOIREE } from './exploration.ts';
import type { Ecran } from './maquette.ts';

export default {
  etats: [{
    nom: 'dialogue', gabarit: 'lieu-et-voyage', decor: 'salle', titre: LA_DILIGENCE, groupeEn: 'comptoir',
    journal: [...SOIREE, 'Mira s’adresse à Gustav Fondleburger.'],
    combattants: combattants({ gustav: GUSTAV }),
    fenetre: {
      titre: 'Dialogue',
      heros: { role: 'heros', qui: 'mira', mise: { testeur: true } },
      centre: { role: 'dialogue', reponses: [
        { texte: 'Et cet avis placardé au mur, ce prince qui recrute ?' },
        { texte: 'À quel prix cèdent-ils leurs places, entre nous ?', test: { competence: 'Charme', difficulte: 'Intermédiaire' }, survol: true },
        { texte: 'Servez-nous quatre chopes, et parlons.', prix: 4 },
        { texte: 'Nous verrons cela avec eux. Bonsoir.' },
      ] },
      autre: { role: 'interlocuteur', qui: 'gustav', comme: 'Propriétaire de La Diligence',
        dit: '« La diligence d’Altdorf ? Elle repart demain à l’aube, si ses cochers tiennent debout d’ici là. Voyez ça avec eux, moi je ne vends que la bière et les lits. »' },
      gestes: [], reserves: [],
    },
  }],
} satisfies Ecran;
