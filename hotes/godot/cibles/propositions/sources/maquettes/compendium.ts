/**
 * Le Compendium (#4411) : un registre relié, un signet par famille ; les catégories de la famille ouverte, la recherche
 * et les livres sur le volet ; la catégorie au feuillet de gauche, l'entrée pointée à droite (`../../outils.md`, section
 * `compendium`). États : `consultation`, sa fiche, ses renvois ; `atelier`, son formulaire, « Supprimer » fermé tant que
 * d'autres données la désignent. Le talent Négociateur et sa description : `src/data/talents.json:3325`.
 */
import type { Compendium, Ecran, EntreeDuCompendium } from './maquette.ts';

const TALENTS: EntreeDuCompendium[] = [
  ['Menaçant', 141], ['Menteur', 142], ['Nageur endurant', 142], ['Nanti', 142], ['Négociateur', 142], ['Noblesse', 142], ['Noctambule', 142],
  ['Nomade', 142], ['Numismate', 142], ['Obstiné', 142], ['Œil du chasseur', 142], ['Orateur', 142], ['Oreille absolue', 143],
].map(([nom, page]) => ({ nom: nom as string, source: { livre: 'LDB', page: page as number }, ...(nom === 'Négociateur' ? { pointee: true as const } : {}) }));
const DESCRIPTION = [
  'Vous êtes un homme d\'affaires expérimenté qui sait comment conclure un marché. Quand vous utilisez la Compétence Marchandage, vous réduisez ou augmentez le prix des produits de 10 % supplémentaires.',
  '**Remarque:** le MJ peut imposer une réduction inférieure des prix pour montrer qu\'un vendeur refuse de vendre à perte.',
];
const COMPENDIUM: Omit<Compendium, 'nom'> = {
  gabarit: 'gestion', decor: 'table', titre: { nom: 'Compendium', sous: 'Règles et données' },
  familles: ['Personnage', 'Compétences', 'Équipement', 'Effets', 'Magie', 'Monde', 'Tables'], famille: 'Compétences',
  categories: [{ nom: 'Compétences', entrees: 48 }, { nom: 'Talents', entrees: 187 }, { nom: 'Axes de forces', entrees: 9 }], categorie: 'Talents',
  recherche: '',
  livres: [['AA', 1], ['ADE I', 1], ['ADE II', 2], ['EDOC', 4], ['LDB', 168], ['MDG', 2], ['NADJ', 1], ['VDM', 8]].map(([sigle, entrees]) => ({ sigle: sigle as string, entrees: entrees as number })),
  feuillet: { n: 9, sur: 15, entrees: TALENTS }, genre: 'Talent',
};

export default {
  etats: [
    {
      ...COMPENDIUM, nom: 'consultation',
      fiche: {
        puces: [{ rubrique: 'Max', valeur: 'Bonus de Sociabilité' }, { rubrique: 'Test', valeur: 'Marchandage' }], description: DESCRIPTION, liens: ['Compétence Marchandage'],
        renvois: [
          { rubrique: 'Races', compte: 2, noms: ['Halflings (Piedfoin)', 'Halflings (Rumster)'] },
          { rubrique: 'Carrières (par rang)', compte: 24, noms: ['Apothicaire (N2)', 'Artisan (N2)', 'Artiste (N3)', 'Batelier (N3)', 'Bourgeois (N2)', 'Cartographe (N4)', 'Cavalier Léger (N4)', 'Charlatan (N3)', 'Cocher (N3)', 'Colporteur (N2)'] },
          { rubrique: 'Créatures', compte: 19, noms: ['Alfric « Demi-nez » Brisenclume', 'Andrea Bruhn', 'Bourgmestre', 'Chef Contrebandier', 'Citadin', 'Fourgue'] },
        ],
      },
    },
    {
      ...COMPENDIUM, nom: 'atelier',
      atelier: {
        paires: [
          [{ libelle: 'Nom', valeur: 'Négociateur', saisi: true }, { libelle: 'Identifiant', valeur: 'negociateur' }],
          [{ libelle: 'Maximum', valeur: 'Bonus de Sociabilité', aide: { texte: 'Nombre maximum d’achats du Talent' } }, { libelle: 'Test associé', valeur: 'Marchandage', aide: { texte: 'Correspondances :', lien: 'Compétence Marchandage' } }],
          [{ libelle: 'Description', valeur: DESCRIPTION.join('\n\n'), long: true }],
          [{ libelle: 'Livre', valeur: 'Livre de base' }, { libelle: 'Page', valeur: '142' }],
        ],
        absents: ['Spécialisations', 'Taille requise', 'Trait conféré', 'Effets passifs'],
        refus: 'D’autres données désignent cette entrée, elle ne se supprime pas : 2 races, 24 carrières, 19 créatures',
      },
    },
  ],
} satisfies Ecran;
