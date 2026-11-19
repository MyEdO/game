/**
 * L'accueil (#4411) : l'écran titre, la compagnie sur la crête au couchant ; les entrées de jeu, la dernière sauvegarde
 * que « Continuer » charge, les outils (`src/hote/accueil.ts:22-39`) (`../../accueil-et-systeme.md`, section `accueil`).
 */
import type { Ecran } from './maquette.ts';
import { MAINTENANT } from './systeme.ts';

export default {
  etats: [
    {
      nom: 'accueil', gabarit: 'ouverture', decor: 'couchant',
      titre: { sur: 'Jeu de rôle dans le Vieux Monde', nom: 'Warhammer Fantasy', campagne: 'L’Ennemi Intérieur' },
      entrees: [{ id: 'jouer', libelle: 'Continuer', principale: true }, { id: 'route', libelle: 'Jouer' }, { id: 'reseau', libelle: 'Jouer en ligne' }],
      derniere: MAINTENANT,
      outils: [{ id: 'epee', libelle: 'Combat' }, { id: 'enclume', libelle: 'Atelier' }, { id: 'plume', libelle: 'Éditeur' }, { id: 'livre', libelle: 'Compendium' }, { id: 'systeme', libelle: 'Options' }],
    },
  ],
} satisfies Ecran;
