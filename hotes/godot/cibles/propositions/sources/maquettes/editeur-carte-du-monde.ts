/**
 * L'éditeur de la carte du monde (#4411) : le même plan de travail, document « Carte du monde » ; les lieux, les routes
 * et leurs outils ; la carte « La route d'Altdorf », ses lieux à leur place du projet ; l'inspecteur du lieu choisi
 * (`src/scenes/diligence/diligence-projet.json`, `worldMap`) (`../../outils.md`, section `editeur-carte-du-monde`).
 */
import { CADRE, VALIDATION } from './editeur.ts';
import type { Ecran } from './maquette.ts';

const MODES = ['pied', 'diligence'];

export default {
  etats: [
    {
      ...CADRE, nom: 'editeur-carte-du-monde', gabarit: 'edition', document: 'Carte du monde',
      volets: ['Lieux', 'Routes', 'Outil'], volet: 'Lieux',
      outils: [{ id: 'selection', libelle: 'Sélection' }, { id: 'epingle', libelle: 'Lieu' }, { id: 'chemin', libelle: 'Route' }, { id: 'etoile', libelle: 'Point d’intérêt' }], outil: 'selection',
      carte: 'La route d’Altdorf',
      lieux: [
        { id: 'diligence', nom: 'Auberge La Diligence', genre: 'hameau', place: [302, 407] },
        { id: 'route-principale', nom: 'La route principale', genre: 'voyage', place: [395, 349] },
        { id: 'sept-rayons', nom: 'Auberge des Sept Rayons', genre: 'hameau', place: [484, 300] },
        { id: 'altdorf', nom: 'Altdorf', genre: 'village', place: [744, 175] },
      ],
      choisi: 'diligence',
      routes: [
        { de: 'diligence', vers: 'route-principale', km: 40, modes: MODES },
        { de: 'route-principale', vers: 'sept-rayons', km: 35, modes: MODES },
        { de: 'sept-rayons', vers: 'altdorf', km: 115, modes: MODES },
      ],
      validation: VALIDATION,
      lieu: { coordonnees: [26, 68], scene: 'La Diligence', plan: 'Aucun point d’intérêt désigné sur le plan.', etablissements: 0 },
    },
  ],
} satisfies Ecran;
