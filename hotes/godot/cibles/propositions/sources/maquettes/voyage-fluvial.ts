/**
 * Le voyage fluvial (#4411) : une journée de descente du Reik, le vent capté, puis le barrage de débris qui l'arrête
 * (`../../voyage.md`, sections `voyage-fluvial*`). Vent : MSRC 7 l.23-39 ; barrage de débris : MSRC 7 l.128 ;
 * `src/noyau/riverVoyageFlow.ts` ; cadence : `src/noyau/voyageEnVue.ts:56`.
 */
import { combattants, groupe, RESERVES } from './compagnie.ts';
import type { Ecran, Journee } from './maquette.ts';

const JOUR: Journee = { jour: 'Festag', date: { jour: 16, mois: 'Pflugzeit' }, jourDeVoyage: 1, meteo: { temps: 'vent', ciel: 'Vent modéré, de côté' }, lumiere: 'jour' };
const REIK = { titre: 'Le Reik', de: 'Grünburg', vers: 'Altdorf' };

export default {
  etats: [
    {
      nom: 'voyage-fluvial', gabarit: 'lieu-et-voyage', decor: 'fleuve', titre: { ...JOUR, cadence: 'commande' }, trajet: { ...REIK, part: 0.4 },
      recit: { rubrique: 'Sur le Reik · Journée de descente', texte: 'Le vent prend la barge par le travers. Mira louvoie et le capte : la voile porte, le courant fait le reste.' },
      frise: { de: 'Grünburg', vers: 'Altdorf', part: 0.4, nuits: [], reste: 27, unite: 'km' },
      apercu: { role: 'jet', test: 'Voile', qui: 'mira', poste: 'à la barre', difficulte: { nom: 'Accessible', valeur: 20 }, seuil: 54, de: 31, dr: 2, effet: { nom: 'Vent de côté capté', vitesse: 5 }, chance: RESERVES.mira.chance },
      combattants: combattants(),
      groupe: groupe({
        bjorn: { texte: 'sonde le chenal à la perche' },
        mira: { id: 'timonier', texte: 'Barre : louvoie et capte le vent de côté' },
        aldric: { texte: 'suit les bornes du chemin de halage' },
        greta: { texte: 'veille sur la cargaison, à l’avant' },
      }),
    },
    {
      nom: 'voyage-fluvial-peril', gabarit: 'lieu-et-voyage', decor: 'fleuve', titre: JOUR, trajet: { ...REIK, part: 0.62 },
      arret: {
        ruban: 'Péril du fleuve', titre: 'Barrage de débris', ou: 'Sur le Reik', jour: true, vignette: 'barrage',
        texte: 'Là où le cours d’eau est étroit ou l’eau est peu profonde, les débris se sont peut-être agglomérés et forment un barrage qui doit être dégagé avant de continuer.',
        choix: {
          cartes: [
            { nom: 'Forcer au bélier', detail: ['+10 Dégâts à la coque', { mesure: 'Coque', valeur: 60, sur: 60 }], choisie: true },
            { nom: 'Déblayer à la main', detail: ['Du temps perdu', 'la coque est épargnée'] }],
          geste: { libelle: 'Enfoncer le barrage', principal: true },
        },
      },
      combattants: combattants(),
      groupe: groupe({
        bjorn: { texte: 'jauge le courant à la perche' },
        mira: { texte: 'Barre : tient la barge bout au courant' },
        aldric: { texte: 'compte les troncs pris dans le barrage' },
        greta: { texte: 'a déjà ôté ses bottes' },
      }),
    },
  ],
} satisfies Ecran;
