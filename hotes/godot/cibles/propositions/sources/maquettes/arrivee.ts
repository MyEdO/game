/**
 * L'arrivée (#4411) : l'écran du lieu où le trajet s'achève, dont la première ligne est le récit du trajet, ses services
 * et le départ qu'il offre (`../../voyage.md`, section `arrivee`). Récit : composé par `recitDuVoyage` (`src/hote/ecran.ts`) ; un seul départ :
 * `src/noyau/worldMap.ts:176` ; place de diligence : LDB 51 l.184, `src/engine/travel.ts:170`, EDO 01 l.142. Un état par
 * enceinte du lieu, le reste de l'écran inchangé : mur de bois ou de pierre, ou aucun, EDO 01 l.27.
 */
import { BOURSES, groupe, type Id } from './compagnie.ts';
import type { Commerce, Ecran } from './maquette.ts';

/** L'arrivée aux Sept Rayons, derrière l'enceinte `enceinte` que nomme `sous`. */
const arrivee = (enceinte: NonNullable<Commerce['enceinte']>, sous: string): Commerce => ({
  nom: `arrivee-${enceinte}`, gabarit: 'lieu-et-voyage', decor: 'relais', enceinte,
  titre: { nom: 'Auberge des Sept Rayons', sous: `Auberge-relais · ${sous}`, meteo: { temps: 'beau', ciel: 'temps sec' } },
  arrivee: { lieu: 'Auberge des Sept Rayons', heures: 5 },
  recit: 'Une auberge-relais liée aux Lignes du Rochet, disposée comme La Diligence. Trois diligences s’y sont arrêtées pour la nuit et les lieux sont bondés ; on y colporte toutes les rumeurs de la route.',
  scene: [{ role: 'service', id: 'auberge', nom: 'Auberge', accueil: { dit: '« Trois voitures ce soir ! Il reste de la paille au dortoir, et du ragoût tant qu’il y en a. »', gestes: [{ id: 'entrer', libelle: 'Entrer' }, { id: 'dormir', libelle: 'Dormir' }, { id: 'informations', libelle: 'Recueillir des informations' }] } }],
  carte: {
    trajet: { titre: 'La route d’Altdorf', de: 'Sept Rayons', vers: 'Altdorf', part: 0 }, ouvrir: 'Ouvrir la carte',
    departs: [{ vers: 'Altdorf', par: 'la grand-route', distance: 115, unite: 'km', moyens: [{ id: 'pied', jours: 5 }, { id: 'diligence', jours: 2 }], place: { prix: 115, classe: 'à l’extérieur' } }],
  },
  retour: 'Explorer',
  groupe: groupe({
    bjorn: { texte: 'descend du toit, les reins moulus' },
    mira: { texte: 'compte trois attelages dans la cour' },
    aldric: { texte: 'couve un « Rhume commun »', mal: true },
    greta: { texte: 'garde un œil sur les bagages' },
  }).map((h) => ({ ...h, bourse: BOURSES[h.id as Id] })),
});

export default {
  etats: [arrivee('aucune', 'sans enceinte'), arrivee('palissade', 'palissade de bois'), arrivee('rempart', 'rempart de pierre')],
} satisfies Ecran;
