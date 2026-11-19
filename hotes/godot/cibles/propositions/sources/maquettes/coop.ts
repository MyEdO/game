/**
 * La coop (#4411) : la tablée de l'auberge, un siège par joueur, l'hôte et jusqu'à trois invités (`../../outils.md`,
 * sections `coop-ouvrir` et `coop-salon`). États : `ouvrir`, aucune partie ouverte, rejoindre par le code ou héberger ;
 * `salon`, l'hôte en session partage le code et attribue les héros et le rôle de Maître du Jeu aux sièges.
 */
import type { Coop, Ecran } from './maquette.ts';

const COOP = { gabarit: 'gestion', decor: 'table' } as const;
const A_POURVOIR: Coop['sieges'][number] = { heros: [] };

export default {
  etats: [
    {
      ...COOP, nom: 'ouvrir', titre: { nom: 'Jouer en ligne', sous: 'Aucune partie ouverte' },
      sieges: [A_POURVOIR, A_POURVOIR, A_POURVOIR, A_POURVOIR], legende: 'Une tablée : l’hôte et jusqu’à trois invités',
      rejoindre: { code: 'K7M2QX', indice: 'Le code de room fait 6 caractères.', nom: 'Lena', geste: 'Rejoindre' },
      heberger: { aide: 'Le groupe se compose ensemble : vous attribuerez les emplacements aux joueurs connectés.', attente: 'Nom de joueur', geste: 'Héberger', refus: 'Ouvrez une partie pour l’héberger.' },
    },
    {
      ...COOP, nom: 'salon', titre: { nom: 'Salon — hôte', sous: 'Partie K7M2QX' },
      sieges: [
        { joueur: { nom: 'Karl', hote: true, vous: true, qualite: 'Hôte · vous' }, heros: ['bjorn', 'aldric'] },
        { joueur: { nom: 'Lena', qualite: 'Invitée' }, heros: ['mira'] },
        { joueur: { nom: 'Otto', absent: true, qualite: 'Reconnexion…' }, heros: ['greta'] },
        A_POURVOIR,
      ],
      legende: 'Le monde est tenu par l’hôte tant qu’aucun siège n’est Maître du Jeu',
      invitation: { code: 'K7M2QX', joueurs: [{ nom: 'Karl', hote: true, vous: true }, { nom: 'Lena' }, { nom: 'Otto', absent: true }], quitter: 'Quitter le salon' },
      attribution: {
        joueurs: ['Karl', 'Lena', 'Otto'],
        heros: [
          { id: 'bjorn', nom: 'Bjorn', carriere: 'Chasseur', joueur: 'Karl' }, { id: 'mira', nom: 'Mira', carriere: 'Éclaireuse', joueur: 'Lena' },
          { id: 'aldric', nom: 'Aldric', carriere: 'Érudit', joueur: 'Karl' }, { id: 'greta', nom: 'Greta Hartmann', carriere: 'Soldate', joueur: 'Otto' },
        ],
        maitre: { sans: 'IA (aucun meneur de jeu)', note: 'Un seul siège, ou personne' },
      },
    },
  ],
} satisfies Ecran;
