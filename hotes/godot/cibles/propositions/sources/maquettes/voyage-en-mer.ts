/**
 * Le voyage en mer (#4411) : une journée sur la mer des Griffes et son Test d'équipage, puis les arrêts qui la suspendent
 * (la relâche au port, le conseil de bord et sa paie, la fuite de vapeur) (`../../voyage.md`, sections `voyage-en-mer`,
 * `mer-*`). Tests d'équipage : MDG 14 l.10-32, l.61-65 ; vent : MDG 13 l.276-287 ; progression : MDG 15 l.78 ; relâche :
 * MDG 15 l.245, MDG 14 l.159-202 ; conseil de bord : MDG 14 l.139-179 ; fuite de vapeur : MDG 12 l.322-328 ;
 * `src/noyau/seaVoyageFlow.ts`, `src/noyau/shipCrew.ts:402-605` ; cadence : `src/noyau/voyageEnVue.ts:56`.
 */
import { avantLeDe, reserves } from './dome.ts';
import { combattants, groupe, RESERVES } from './compagnie.ts';
import type { Ecran, Journee, Voyage } from './maquette.ts';

const GRIFFES = { titre: 'La mer des Griffes', de: 'Salzenmund', vers: 'Erengrad' };
const TROISIEME: Journee = { jour: 'Wellentag', date: { jour: 21, mois: 'Sigmarzeit' }, jourDeVoyage: 3, meteo: { temps: 'vent', ciel: 'Brise fraîche, vent latéral' }, lumiere: 'gris' };
/** Le huitième jour, une semaine à régler. */
const HUITIEME = (ciel: string): Journee => ({ jour: 'Aubentag', date: { jour: 26, mois: 'Sigmarzeit' }, jourDeVoyage: 8, meteo: { temps: 'vent', ciel }, lumiere: 'soir' });
const en = (nom: string, titre: Journee, part: number, o: Partial<Voyage>): Voyage => ({ nom, gabarit: 'lieu-et-voyage', decor: 'traversee', titre, trajet: { ...GRIFFES, part }, combattants: combattants(), ...o });
/** La part de la paie régulière que chaque héros règle, sur ce que sa bourse contient. */
const PART = 2808;

export default {
  etats: [
    en('voyage-en-mer', { ...TROISIEME, cadence: 'commande' }, 0.3, {
      recit: { rubrique: 'En mer · Journée en mer', texte: 'Brise fraîche par le travers : la cogue vire de bord et garde son cap. L’équipage tient la cadence, la côte du Nordland s’efface.' },
      navire: { nom: 'La Sterne', etat: { coque: { blessures: 50, max: 50 }, moral: 75, eau: 2900, vivres: 735 } },
      ouvrir: [{ id: 'dossier', libelle: 'Dossier du navire' }, { id: 'postes', libelle: 'Postes de bord' }],
      frise: { de: 'Salzenmund', vers: 'Erengrad', part: 0.3, nuits: [0.1, 0.2], reste: 385, unite: 'milles' },
      apercu: { nom: 'Progression', test: 'Test d’équipage', lignes: [
        { qui: 'greta', poste: 'Capitaine', dr: 2, double: true }, { qui: 'mira', poste: 'Timonier', dr: 1 }, { qui: 'aldric', poste: 'Navigateur', dr: 1 }],
        chance: [{ qui: 'greta', valeur: RESERVES.greta.chance }, { qui: 'mira', valeur: RESERVES.mira.chance }, { qui: 'aldric', valeur: RESERVES.aldric.chance }] },
      groupe: groupe({
        bjorn: { id: 'vigie', texte: 'Vigie : rien que des mouettes à l’horizon' },
        mira: { id: 'timonier', texte: 'Timonier : vire de bord sans perdre le vent' },
        aldric: { id: 'navigateur', texte: 'Navigateur : fait le point à midi, le cap est bon' },
        greta: { id: 'capitaine', texte: 'Capitaine : tient l’équipage à la manœuvre' },
      }),
    }),
    en('mer-relache', HUITIEME('Brise légère, à quai'), 1, {
      arret: {
        ruban: 'Escale au port', titre: 'Relâche à terre', ou: 'Erengrad · à l’accostage', vignette: 'port',
        texte: 'Si l’équipage reçoit la permission de faire relâche à terre, lancez 1d100 pour chaque membre d’équipage. Sur un résultat de 04 ou moins, ce membre ne revient pas sur le bateau.',
        choix: {
          cartes: [
            { nom: 'Accorder la relâche', detail: ['Moral +1d10 au prochain conseil', 'désertion sur 04 ou moins'], choisie: true },
            { nom: 'Refuser la relâche', detail: ['Moral –2d10 au prochain conseil', 'l’équipage reste à bord'] }],
          geste: { libelle: 'Accorder la relâche', principal: true },
        },
      },
      groupe: groupe({
        bjorn: { texte: 'compte les marins au bastingage' },
        mira: { texte: 'amarre la cogue au quai des Kislévites' },
        aldric: { texte: 'range les cartes, le port est levé' },
        greta: { texte: 'Capitaine : l’équipage attend sa parole' },
      }),
    }),
    en('mer-conseil-de-bord', HUITIEME('Brise légère, vent arrière'), 0.8, {
      arret: {
        ruban: 'Conseil de bord', titre: 'La paie de la semaine', ou: 'La Sterne', marins: 15, jour: true, vignette: 'paie',
        texte: 'Un équipage bien dirigé, bien nourri, payé régulièrement et protégé contre le danger et la maladie va sans doute rester fidèle à son capitaine.',
        choix: {
          cartes: [
            { nom: 'La paie est régulière', detail: ['Moral +1d10', { prix: 11232 }], choisie: true },
            { nom: 'La paie est généreuse', detail: ['Moral +2d10', { prix: 22464 }], refus: 'Bourse insuffisante.', survol: true },
            { nom: 'La paie est chiche', detail: ['Moral –2d10', { prix: 5616 }] },
            { nom: 'Pas de paie', detail: ['Moral –3d10', 'rien'] }],
          geste: { libelle: 'Payer', principal: true },
          parts: [{ heros: 'bjorn', part: PART, avoir: 7200 }, { heros: 'mira', part: PART, avoir: 4320 }, { heros: 'aldric', part: PART, avoir: 6000 }, { heros: 'greta', part: PART, avoir: 2880 }],
        },
      },
      groupe: groupe({
        bjorn: { texte: 'compte les pistoles sur le tonneau' },
        mira: { texte: 'tient le rôle d’équipage' },
        aldric: { texte: 'inscrit la solde au livre de bord' },
        greta: { texte: 'Capitaine : préside le conseil' },
      }),
    }),
    en('mer-fuite-de-vapeur', TROISIEME, 0.3, {
      vapeur: true,
      arret: {
        ruban: 'Panne de vapeur', titre: 'Fuite de vapeur', ou: 'À la chaudière', jour: true, vignette: 'chaudiere',
        texte: 'Fuite de vapeur : un jet de vapeur jaillit de la chaudière. La personne qui s’occupe du moteur doit réussir un Test d’Initiative sous peine d’être ébouillantée et de subir 1d10–5 Dégâts (1 minimum), qui ignorent l’Armure.',
        de: { valeur: 47, de: 'd100' },
      },
      fenetre: {
        titre: 'Test d’Initiative',
        heros: { role: 'testeur', qui: 'aldric', poste: 'Au moteur', test: 'Initiative', seuil: 38, modificateurs: [{ nom: 'Intermédiaire', valeur: 0 }] },
        centre: { role: 'simple', sur: 'Fuite de vapeur', phrase: 'Sinon ébouillanté : 1d10–5 Dégâts (1 minimum), qui ignorent l’Armure.' },
        gestes: avantLeDe(RESERVES.aldric), reserves: reserves(RESERVES.aldric),
      },
    }),
  ],
} satisfies Ecran;
