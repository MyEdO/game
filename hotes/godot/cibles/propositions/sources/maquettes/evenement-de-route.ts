/**
 * L'événement de route (#4411) : la péripétie « Voyage éreintant ! » sur la route d'Altdorf, son Test au bandeau du
 * jet, son échec, puis la route qui reprend (`../../voyage.md`, sections `evenement-de-route*`). Péripétie : LDB 51
 * l.208-221, l.215 ; `src/noyau/travelFlow.ts:1418` ; relance : LDB 17 l.23 ; cadence : `src/noyau/voyageEnVue.ts:56`.
 */
import { avantLeDe, apresLeDe, reserves } from './dome.ts';
import { combattants, groupe, RESERVES } from './compagnie.ts';
import type { Arret, Ecran, Geste, Journee, Testeur, Trajet, Voyage } from './maquette.ts';

const JOUR: Journee = { jour: 'Marktag', date: { jour: 14, mois: 'Pflugzeit' }, jourDeVoyage: 2, meteo: { temps: 'beau', ciel: 'Crépuscule, temps sec' }, lumiere: 'soir' };
const TRAJET: Trajet = { titre: 'La route d’Altdorf', de: 'Sept Rayons', vers: 'Altdorf', part: 0.55 };
const ERINTANT: Arret = {
  ruban: 'Péripétie de la route', titre: 'Voyage éreintant !', ou: 'Sur la route d’Altdorf', jour: true, vignette: 'pont',
  texte: 'La route est bloquée. Un pont peut être effondré, une rivière bloquée ou une route inondée, ou quelque autre obstacle insurmontable. Un Personnage effectue un Test de Survie en extérieur Accessible (+20) pour trouver un bon itinéraire de substitution, sinon tout le monde arrive un jour plus tard avec un État Exténué.',
  de: { valeur: 4, de: 'd10' },
};
const SINON = 'Sinon tout le monde arrive un jour plus tard avec un État Exténué.';
/** Bjorn au Test de Survie en extérieur. */
const BJORN: Testeur = { role: 'testeur', qui: 'bjorn', test: 'Survie en extérieur', seuil: 61, modificateurs: [{ nom: 'Accessible', valeur: 20 }] };
/** La route arrêtée devant le pont effondré, le Test ouvert au bandeau du jet. */
const arrete = (nom: string, heros: Testeur, centre: { dr?: number }, gestes: Geste[]): Voyage => ({
  nom, gabarit: 'lieu-et-voyage', decor: 'route', titre: JOUR, trajet: TRAJET, arret: ERINTANT, combattants: combattants(),
  fenetre: { titre: 'Test de Survie en extérieur', heros, centre: { role: 'simple', sur: 'Voyage éreintant !', ...centre, phrase: SINON }, gestes, reserves: reserves(RESERVES.bjorn) },
});

export default {
  etats: [
    arrete('evenement-de-route', { ...BJORN, parmi: ['bjorn', 'mira', 'aldric', 'greta'] }, {}, avantLeDe(RESERVES.bjorn)),
    {
      nom: 'evenement-de-route-issue', gabarit: 'lieu-et-voyage', decor: 'route', titre: { ...JOUR, cadence: 'jourParJour' }, trajet: TRAJET,
      recit: { rubrique: 'Sur la route d’Altdorf · Voyage éreintant !', texte: 'Le pont a cédé sous la crue. Bjorn trouve un gué en amont, et la diligence repasse la rivière avant la nuit.' },
      frise: { de: 'Auberge des Sept Rayons', vers: 'Altdorf', part: 0.55, nuits: [0.33], reste: 52, unite: 'km' },
      apercu: { role: 'jet', test: 'Survie en extérieur', qui: 'bjorn', difficulte: { nom: 'Accessible', valeur: 20 }, seuil: 61, de: 27, dr: 4, chance: RESERVES.bjorn.chance },
      combattants: combattants(),
      groupe: groupe({
        bjorn: { id: 'route', texte: 'trouve un gué en amont du pont' },
        mira: { texte: 'guide les chevaux dans le courant' },
        aldric: { texte: 'reporte le détour sur le vélin' },
        greta: { texte: 'pousse à la roue, de l’eau jusqu’aux genoux' },
      }),
    },
    arrete('evenement-de-route-echec', { ...BJORN, jet: { des: [70, 8], dr: -1, reussite: false } }, { dr: -1 }, apresLeDe(RESERVES.bjorn, { echec: true })),
  ],
} satisfies Ecran;
