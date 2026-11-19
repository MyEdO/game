/**
 * Le chapitre (#4411), sur son carton : `ouverture`, l'auberge-relais à la nuit tombante, le texte du chapitre et la
 * compagnie ; `fin`, Altdorf au petit matin, ce que le chapitre laisse (`src/noyau/chapitreRecap.ts:34-68`) et la fin de
 * séance qu'il ouvre. Titres, texte, objectifs et lieux : `src/scenes/diligence/diligence-projet.json:3755-3789`
 * (`narratif`, `setObjective`, `worldMap.places`) (`../../accueil-et-systeme.md`, sections `ouverture-de-chapitre` et
 * `fin-de-chapitre`).
 */
import { groupe } from './compagnie.ts';
import type { Ecran } from './maquette.ts';
import { seance } from './systeme.ts';

export default {
  etats: [
    {
      nom: 'ouverture', gabarit: 'ouverture', decor: 'relais', sur: 'Une campagne pour Warhammer Fantasy Roleplay',
      campagne: { nom: 'L’Ennemi Intérieur', tome: 'Tome 1 — L’Ennemi dans l’Ombre' }, chapitre: 'Chapitre 1 — On recherche : aventuriers courageux',
      texte: [
        'Nos héros forment un groupe hétéroclite que la soif d’aventures a conduit à prendre la direction d’Altdorf, tout comme de nombreux habitants des campagnes et des bourgades de l’Empire. Altdorf, l’immense et trépidante capitale, où les rues sont pavées d’or et où tout est possible.',
        'Certains Personnages se connaissent peut-être déjà ; les autres se rencontreront pour la première fois lorsqu’ils approcheront de l’auberge-relais la plus proche, nommée La Diligence.',
      ],
      groupe: groupe().map((h) => ({ ...h, blessures: h.max })),
      gestes: [{ libelle: 'Commencer', principal: true }],
    },
    {
      nom: 'fin', gabarit: 'ouverture', decor: 'altdorf', sur: 'L’Ennemi Intérieur · Fin de chapitre', chapitre: 'Chapitre 1 — la route d’Altdorf',
      cloture: {
        sous: 'Le reste du trajet n’a rien de remarquable : la compagnie arrive à Altdorf.', px: 140,
        objectifs: ['Trouver une place à bord d’une diligence pour Altdorf.', 'Examiner les lieux de l’embuscade.', 'Se rendre à Altdorf.'],
        lieux: ['Auberge La Diligence', 'La route principale', 'Auberge des Sept Rayons', 'Altdorf'], tombes: [],
        seance: seance('Chance restaurée à la prochaine séance'),
      },
      gestes: [{ libelle: 'Clore le chapitre', principal: true }, { libelle: 'Plus tard' }],
    },
  ],
} satisfies Ecran;
