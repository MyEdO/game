/**
 * La nouvelle partie (#4411) : composer le groupe et choisir la campagne, dans la salle commune d'une auberge-relais
 * (`src/hote/groupe.ts:83-93`, `src/data/pregens.json`, `projets/jeu-de-role/contenu.ts:171-182`) (`../../accueil-et-systeme.md`,
 * section `nouvelle-partie`). États : `pretires` ; `roster`, l'onglet « Mes personnages », « Exporter » et « Supprimer »
 * sous « Recruter » (`src/hote/groupe.ts:86-90`) ; `coop`, le siège de la place libre (`src/noyau/sieges.ts:143`).
 */
import { groupe } from './compagnie.ts';
import type { Ecran, NouvellePartie, Voyageur } from './maquette.ts';

const PRETIRES: Voyageur[] = [
  { id: 'wanda', nom: 'Wanda Weltschmertz', carriere: 'Sorcière' },
  { id: 'kirsten', nom: 'Kirsten Krank', carriere: 'Voleuse' },
  { id: 'harbull', nom: 'Harbull Piedvelu', carriere: 'Herboriste', vise: true },
  { id: 'sigrid', nom: 'Sigrid Sommerfeld', carriere: 'Prêtresse' },
  { id: 'malmir', nom: 'Malmir Giluviel', carriere: 'Saltimbanque' },
];
const MES_PERSONNAGES: Voyageur[] = [
  { id: 'kirsten', nom: 'Astrid Holz', carriere: 'Artiste' },
  { id: 'harbull', nom: 'Odo Brandebouc', carriere: 'Batelier', vise: true },
  { id: 'sigrid', nom: 'Greta Vogt', carriere: 'Soldate' },
];
const NOUVELLE_PARTIE: Omit<NouvellePartie, 'nom' | 'onglet' | 'salle' | 'libre'> = {
  gabarit: 'gestion', decor: 'compagnie', titre: { nom: 'La Compagnie', sous: 'Composer le groupe', places: { n: 3, sur: 4 } },
  campagne: {
    sur: 'On recherche : aventuriers courageux', nom: 'L’Ennemi Intérieur', chapitre: 'Chapitre 1 : la route d’Altdorf', genre: 'route',
    texte: 'Les Personnages se forment à l’auberge-relais La Diligence, à deux jours d’Altdorf, et cherchent une place à bord d’une diligence pour la capitale.',
  },
  campagnes: [
    { id: 'barge-du-sel', nom: 'La Barge du Sel', genre: 'fleuve' }, { id: 'loup-et-saumure', nom: 'Le Loup et la Saumure', genre: 'fleuve' },
    { id: 'arene', nom: 'L’Arène', genre: 'arene' }, { id: 'caves-de-weissbruck', nom: 'Les Caves de Weissbruck', genre: 'enquete' },
  ],
  groupe: groupe().slice(0, 3),
};
const LIBRE = { nom: 'Place libre', sous: 'Un voyageur, ou personne' };

export default {
  etats: [
    { ...NOUVELLE_PARTIE, nom: 'pretires', onglet: 'pretires', salle: { voyageurs: PRETIRES, total: 15 }, libre: { ...LIBRE, dit: 'Le groupe peut partir à trois.' } },
    { ...NOUVELLE_PARTIE, nom: 'roster', onglet: 'roster', salle: { voyageurs: MES_PERSONNAGES, total: 3 }, libre: { ...LIBRE, dit: 'Le groupe peut partir à trois.' }, modifier: true },
    { ...NOUVELLE_PARTIE, nom: 'coop', onglet: 'pretires', salle: { voyageurs: PRETIRES, total: 15 }, libre: { ...LIBRE, siege: { valeurs: ['Vous', 'Lena', 'Otto'], tenue: 1 } }, modifier: true },
  ],
} satisfies Ecran;
