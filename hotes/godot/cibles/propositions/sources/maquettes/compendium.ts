/**
 * Le Compendium (#4411) : un plein écran de consultation, trois cadres fixes (`../../dispositions.md`, « Par type
 * d'écran », 9) : la barre (retour, recherche dans tout le Compendium, fil, bascule de l'atelier, croix), la liste de la
 * catégorie qui défile, la fiche et ses renvois (`../../outils.md`, section `compendium`). États : `consultation`, un
 * renvoi survolé et son aperçu ; `atelier`, son formulaire, « Supprimer » fermé tant que d'autres données la désignent ;
 * `index`, la surcouche des familles et de leurs catégories ; `recherche`, les résultats à la place de la liste.
 * Le talent Négociateur et sa description : `src/data/talents.json:3325` ; ses renvois : les entrées de
 * `src/data/careerLevels.json`, `creatures.json` et `species.json` qui le désignent ; la liste : `talents.json` dans
 * l'ordre alphabétique ; l'Index : le registre du Codex (`src/noyau/codex/registry`) ; les résultats de « marchand » :
 * les noms de `skills.json`, `careers.json`, `careerLevels.json`, `creatures.json` et `trappings.json` qui le portent.
 */
import type { Compendium, Ecran, EntreeDuCompendium, FamilleDeLIndex } from './maquette.ts';

const entrees = (noms: (string | [string, string])[]): EntreeDuCompendium[] =>
  noms.map((n) => (typeof n === 'string' ? { nom: n, livre: 'LDB' } : { nom: n[0], livre: n[1] }));
const TALENTS = entrees([
  'Mains agiles', 'Maître artisan', 'Maître en déguisement', 'Maîtrise des dés', 'Maîtrise du combat', 'Maniement de deux armes', 'Marinier',
  ['Massif', 'ADE II'], 'Menaçant', 'Menteur', 'Nageur endurant', 'Nanti', 'Négociateur', 'Noblesse', 'Noctambule', 'Nomade', 'Numismate',
  'Obstiné', 'Œil du chasseur', 'Orateur', 'Oreille absolue', 'Pansement de fortune', 'Pas de côté', 'Pêcheur', 'Perception de la magie',
  'Persévérant', 'Perspicace', 'Petit', 'Pharmacologie', 'Pied marin',
]).map((e) => (e.nom === 'Négociateur' ? { ...e, pointee: true as const } : e));
const DESCRIPTION = [
  'Vous êtes un homme d\'affaires expérimenté qui sait comment conclure un marché. Quand vous utilisez la Compétence Marchandage, vous réduisez ou augmentez le prix des produits de 10 % supplémentaires.',
  '**Remarque:** le MJ peut imposer une réduction inférieure des prix pour montrer qu\'un vendeur refuse de vendre à perte.',
];
const CARRIERES: [string, number, string?][] = [
  ['Apothicaire', 2], ['Arnaqueur', 3], ['Artisan', 2], ['Artiste de renom', 3], ['Bourgeois', 2], ['Brocanteur', 1], ['Capitaine Cavalier Léger', 4, 'AA'],
  ['Chef de bord', 3], ['Chef de troupe', 4], ['Colporteur', 2], ['Contrebandier', 2], ['Contremaître', 3], ['Diplomate', 3], ['Échevin', 3],
  ['Herboriste', 2], ['Magnat', 3], ['Maître Cartographe', 4, 'AA'], ['Maître cocher', 3], ['Maître des plages', 4, 'MDG'], ['Messager vétéran', 4],
  ['Nautonier', 2], ['Nautonier', 2, 'MDG'], ['Négociant', 1], ['Souteneur', 3],
];
const CREATURES = [
  'Alfric « Demi-nez » Brisenclume', 'Andrea Bruhn', 'Bourgmestre', 'Chef Contrebandier', 'Citadin', 'Fourgue', 'Gerdon Salzwed', 'Jaego Roth',
  'Le vieil Otto', 'Maistre Faussaire', 'Maistre Marchand', 'Maistre Marchand', 'Marchand', 'Marchand', 'Notable', 'Receleur', 'Ritta',
  'Roi du Trafic', 'Wulfric Tore',
];
/** Les familles du Codex, leur nombre de catégories ; « Tables », la plus fournie, ouverte à l'Index. */
const TABLES: FamilleDeLIndex = {
  nom: 'Tables',
  categories: [
    ['Disponibilité & Troc', 1], ['Tailles — barres par catégorie', 1], ['Diagramme de Dispersion', 10], ['Capricieux (Tableau)', 5],
    ['Réaction au Statut (Tableau)', 3], ['Ivresse (Tableau)', 5], ['Surchargé — Paliers d’Encombrement', 4], ['Empoignade — mécanique', 1],
    ['Enjeux de jet', 146], ['Niveaux de carrière', 432], ['Oups !', 8], ['Entre deux aventures', 31], ['Activités', 64], ['Semences de scène', 1],
    ['Défauts de compilation', 1], ['Obsessions (table)', 19], ['Talents aléatoires (table)', 1], ['Carrières aléatoires (table)', 27],
    ['Races aléatoires (table)', 4], ['Cargaisons aléatoires (table)', 8], ['Corps ou esprit de la mutation (table)', 7], ['Règles optionnelles', 105],
    ['Tableau de Surincantation', 7],
  ].map(([nom, entrees]) => ({ nom: nom as string, entrees: entrees as number })),
  groupes: Object.entries({
    'Création de personnage': [['Coût des Augmentations', 15], ['Couleur des yeux', 10], ['Couleur des cheveux', 10], ['Apparences', 21], ['Pré-tirés', 15], ['Détails de création', 1], ['Banque de noms', 7]],
    'Voyage terrestre': [['Accidents de Conduite d’attelage', 4], ['Météo de voyage', 4], ['Conditions météo', 6], ['Péripéties de voyage', 10], ['Incidents de monte', 4], ['Problèmes de véhicule', 4], ['Commerce terrestre et fluvial (Vin, Achat, Vente, Rumeurs)', 1]],
    'Mer & rivière': [['Navigation fluviale (Vent, Chavirage, Échouage)', 1], ['Humeur de Manann — Facteurs', 26], ['Événements de bord (mer)', 40], ['Événements de port (mer)', 18], ['Voyage rapide (mer)', 5], ['Exposition à l’eau (maladies hydriques)', 1], ['Progression de navire (DR de Navigation → Mouvement)', 5], ['Navigation maritime (Progression, Salissures, Orientation, Phares, Poursuite…)', 1], ['Périls en mer (Échouage, Icebergs, Détroits, Tourbillons)', 1], ['Météo de la Mer des Griffes', 1], ['Commerce maritime (Achat, Vente, Surcharge, Commerce d’opportunité)', 1]],
    Calendrier: [['Calendrier — Mois', 12], ['Calendrier — Jours intercalaires', 6], ['Calendrier — Jours de la semaine', 8], ['Calendrier — Phases du jour', 7]],
    'Bataille de masse': [['Bataille de masse — Estimation de Puissance', 5], ['Bataille de masse — Modificateurs de Puissance', 9], ['Bataille de masse — Machines de guerre', 10], ['Bataille de masse — Structures', 5], ['Bataille de masse — Aléas de bataille', 10]],
    Rencontres: [['Rencontres — Positives', 7], ['Rencontres — Fortuites', 10], ['Rencontres — Dangereuses', 9]],
    'Équipage & navire': [['Moral d’équipage — Facteurs', 28], ['Moral d’équipage — Effets', 4], ['Pannes de navire à vapeur', 6]],
  }).map(([nom, cats]) => ({ nom, categories: cats.map(([n, e]) => ({ nom: n as string, entrees: e as number })) })),
};

const COMPENDIUM: Omit<Compendium, 'nom'> = {
  gabarit: 'consultation', decor: 'table', titre: 'Compendium', fil: ['Compétences', 'Talents'],
  categorie: { nom: 'Talents', entrees: 187 },
  livres: [['AA', 1], ['ADE I', 1], ['ADE II', 2], ['EDOC', 4], ['LDB', 168], ['MDG', 2], ['NADJ', 1], ['VDM', 8]].map(([sigle, entrees]) => ({ sigle: sigle as string, entrees: entrees as number })),
  liste: { lettres: 'ABCDEFGHILMNOŒPRSTV', entrees: TALENTS },
  entree: { nom: 'Négociateur', genre: 'Talent', source: { livre: 'LDB', page: 142 } },
  renvois: {
    onglet: 'Carrières',
    groupes: [
      { rubrique: 'Carrières', note: 'par rang', noms: CARRIERES.map(([nom, rang, livre]) => ({ nom, note: `N${rang}${livre ? ` · ${livre}` : ''}` })) },
      { rubrique: 'Créatures', noms: CREATURES.map((nom) => ({ nom })) },
      { rubrique: 'Races', noms: [{ nom: 'Halflings (Piedfoin)' }, { nom: 'Halflings (Rumster)' }] },
    ],
  },
};
const FICHE: Compendium['fiche'] = { puces: [{ rubrique: 'Max', valeur: 'Bonus de Sociabilité' }, { rubrique: 'Test', valeur: 'Marchandage', lien: true }], description: DESCRIPTION, liens: ['Marchandage'] };

export default {
  etats: [
    {
      ...COMPENDIUM, nom: 'consultation', fiche: FICHE,
      survol: { renvoi: 'Colporteur', nom: 'Colporteur', sous: 'Carrière, rang 2', texte: 'Plein de sagesse et à l\'abri de toute ingérence, vous voyagez à travers l\'Empire afin de vendre vos biens où bon vous semble, sans entraves.', source: { livre: 'LDB', page: 79 } },
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
        refus: 'D’autres données désignent cette entrée, elle ne se supprime pas : 24 carrières, 19 créatures, 2 races',
      },
    },
    {
      ...COMPENDIUM, nom: 'index', fiche: FICHE,
      index: {
        familles: [['Personnage', 6], ['Compétences', 3], ['Équipement', 8], ['Effets', 30], ['Magie', 10], ['Monde', 20], ['Tables', 63]].map(([nom, categories]) => ({ nom: nom as string, categories: categories as number })),
        ouverte: TABLES, entrees: 4774,
      },
    },
    {
      ...COMPENDIUM, nom: 'recherche', fiche: FICHE,
      recherche: {
        texte: 'marchand',
        groupes: [
          { categorie: 'Compétences', entrees: entrees(['Marchandage']) },
          { categorie: 'Carrières', entrees: entrees(['Marchand']) },
          { categorie: 'Niveaux de carrière', entrees: entrees(['Marchand', 'Maître Marchand', 'Prince Marchand']) },
          { categorie: 'Créatures', entrees: entrees([['Maistre Marchand', 'HCVM'], ['Maistre Marchand', 'HCVM'], ['Marchand', 'HCVM'], ['Marchand', 'HCVM']]) },
          { categorie: 'Possessions', entrees: entrees(['Marchandises']) },
        ],
      },
    },
  ],
} satisfies Ecran;
