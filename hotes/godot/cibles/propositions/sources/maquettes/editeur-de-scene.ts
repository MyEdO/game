/**
 * L'éditeur de scène (#4411) : un plan de travail, pas un lieu (`src/hote/editeur.ts:190-689`) (`../../outils.md`,
 * sections `editeur-scene`, `editeur-outil-terrain`, `editeur-supprimer`). États : `porte`, une porte choisie et son
 * inspecteur ; `outil-terrain`, l'outil « Terrain » armé, ses options à la place de l'inspecteur ; `supprimer`, un
 * personnage choisi et son « Supprimer », « Retirer cette couche » fermée pour le rez. Le plan est une esquisse.
 */
import { CADRE, VALIDATION } from './editeur.ts';
import type { Ecran, EditeurDeScene } from './maquette.ts';

const OUTILS = [
  ['selection', 'Sélection'], ['terrain', 'Terrain'], ['hauteur', 'Hauteur'], ['murs', 'Murs'], ['volee', 'Volée'], ['crenelage', 'Crénelage'],
  ['decor', 'Décor'], ['personnage', 'Personnage'], ['navire', 'Navire'], ['baliste', 'Emplacement de siège'], ['depart', 'Départ'], ['porte', 'Entrée'],
  ['ville', 'Architecture'], ['zone', 'Zone'], ['gomme', 'Gomme'],
].map(([id, libelle]) => ({ id: id as string, libelle: libelle as string }));
const TERRAINS = ['Sous-bois', 'Boue', 'Cendre', 'Dallage', 'Eau', 'Fosse', 'Herbe', 'Lave', 'Marbre', 'Mur', 'Neige', 'Ossuaire', 'Pavés', 'Pierre', 'Plancher', 'Planches', 'Porte', 'Roche', 'Chemin', 'Sable', 'Sol ensanglanté', 'Sol nu', 'Terre battue', 'Tourbe', 'Vide (étage)'];
const SCENE: Omit<EditeurDeScene, 'nom' | 'volet' | 'outil' | 'plan' | 'inspecteur' | 'pointe'> = {
  ...CADRE, gabarit: 'edition', document: 'Scène', volets: ['Scènes', 'Outil'], outils: OUTILS,
  scenes: { noms: ['La Diligence', 'Altdorf — la porte sud', 'La route principale — le virage', 'Auberge des Sept Rayons'], ouverte: 'La Diligence', gestes: ['Nouvelle scène', 'Dupliquer la scène', 'Retirer la scène'] },
  couches: { noms: ['Couche 0', 'Couche 1'], tenue: 0, ajouter: 'Ajouter une couche' },
  nord: 0, taille: { cases: [32, 38], entites: 22 },
};

export default {
  etats: [
    {
      ...SCENE, nom: 'porte', volet: 'Scènes', outil: 'selection', plan: { porte: true },
      inspecteur: {
        genre: 'Porte', ou: 'Arête 14, 8 E · couche 0',
        proprietes: [
          { libelle: 'Type', valeurs: ['Cloison', 'Porte'], tenue: 1 }, { libelle: 'Fermée au départ', oui: true }, { libelle: 'Porte secrète', oui: false },
          { libelle: 'Difficulté de Perception', texte: '—', grise: true }, { libelle: 'Découvrable depuis', texte: '—', grise: true },
          { libelle: 'Matériau', texte: 'Mur à ossature en bois' }, { libelle: 'Apparence', texte: 'Dérivée de la structure' },
        ],
        renvois: { rubrique: 'Logique de la scène', noms: ['Déclencheurs (1)', 'Dialogues (0)', 'Rencontres (0)'] },
      },
      pointe: ['Arête 14, 8 E', 'couche 0', 'Porte', 'Mur à ossature en bois'],
      validation: VALIDATION,
    },
    {
      ...SCENE, nom: 'outil-terrain', volet: 'Outil', outil: 'terrain', plan: { pinceau: 3 },
      inspecteur: { genre: 'Terrain', options: 'Options de l’outil', pinceaux: { valeurs: ['1×1', '3×3', '5×5', 'Rectangle'], tenue: 1 }, terrains: TERRAINS, terrain: 'Pavés' },
      pointe: ['Case 10, 16', 'couche 0', 'Terre battue', '0 m'],
    },
    {
      ...SCENE, nom: 'supprimer', volet: 'Scènes', outil: 'selection', plan: { personnage: 'Gustav' },
      couches: { ...SCENE.couches, retirer: { libelle: 'Retirer cette couche', refus: 'Le rez ne se retire pas' } },
      inspecteur: {
        genre: 'Personnage', ou: 'Case 12, 8 · couche 0', nom: 'Gustav',
        proprietes: [{ libelle: 'Fiche', texte: 'Citadin' }, { libelle: 'Orientation', defile: 'Sud' }, { libelle: 'Couche', valeurs: ['0', '1'], tenue: 0 }],
        inventaire: { vide: 'Aucun objet dans l’inventaire.', ajouter: 'Ajouter un objet à l’inventaire' },
        troupe: [{ libelle: 'Copies', nombre: 3 }],
        renvois: { noms: ['Carrière', 'Rencontres (0)'] }, supprimer: 'Supprimer',
      },
      pointe: ['Personnage « Gustav »', 'case 12, 8', 'couche 0'],
    },
  ],
} satisfies Ecran;
