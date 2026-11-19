/**
 * Le combat naval (#4411) : la grille sur l'eau, les navires en pièces du champ ; la Manœuvre et le Tir de batterie en
 * Test d'équipage, la Chanson de marin, le tour d'un héros qui sert une pièce du bord (`../../voyage.md`, sections
 * `combat-naval*`, `meuble-piece-de-bord`). Manœuvre : MDG 13 l.119, en Test d'équipage MDG 14 l.74-76, Mousse MDG 14
 * l.15, Peu maniable MDG 12 ; Tir de batterie : MDG 14 l.126-130 ; pièce servie et munition : LDB 13 l.106, MDG 12 ;
 * Chanson de marin : MDG 09 l.32-40 ; `src/noyau/combatSlice.ts:1131-1250`, `src/noyau/modalArbiter.ts:178-179`.
 */
import { avantLeDe, reserves } from './dome.ts';
import { combattants, RESERVES } from './compagnie.ts';
import type { ActionDuTour, Case, Combat, EtatDeCombat, Ecran, Fenetre, MerDuCombat } from './maquette.ts';

const COMBATTANTS = combattants({
  cogue: { nom: 'Cogue pirate', buste: 'navire', ennemi: true, blessures: 50, max: 50, etats: [] },
  pirate: { nom: 'Pirate', buste: 'bjorn', ennemi: true, blessures: 12, max: 12, etats: [] },
});
const JOURNAL: Combat['journal'] = [{ round: 1, commence: true }, 'Aldric relève le cap de la Cogue pirate.', 'La bordée de la Cogue pirate manque la Cogue des aventuriers.'];
/** La cogue des héros cap à l'est, la Cogue pirate en travers ; où la cogue peut porter, où porte la batterie adverse. */
const MER: MerDuCombat = {
  navires: [{ case: [9.5, 5], cap: 1 }, { case: [8.5, 11], cap: -1, ennemi: true }],
  avance: [[12, 5], [13, 5], [14, 5], [15, 5]],
  batterie: [7, 8, 9, 10].flatMap((i): Case[] => [[i, 8], [i, 9]]),
};
/** Le tour de Mira, le deuxième des six du round. */
const TOUR_DE_MIRA: Combat = { round: 1, tour: { rang: 2, sur: 6 }, ordre: ['mira', 'cogue', 'pirate', 'bjorn', 'greta'], suivant: ['aldric'], journal: JOURNAL };
const fenetre = (nom: string, f: Fenetre): EtatDeCombat => ({ nom, gabarit: 'fenetre-du-bas', cour: MER, combattants: COMBATTANTS, combat: TOUR_DE_MIRA, fenetre: f });
const ROLE_ESSENTIEL = [{ nom: 'Rôle essentiel', facteur: 2 }];
const action = (id: string, libelle: string, o: Partial<ActionDuTour> = {}): ActionDuTour => ({ id, libelle, ...o });

export default {
  etats: [
    fenetre('combat-naval', {
      titre: 'Manœuvre',
      heros: { role: 'testeur', qui: 'mira', poste: 'Timonier', test: 'Voile', seuil: 41, modificateurs: ROLE_ESSENTIEL },
      centre: { role: 'equipage', fait: 'la cogue', reglage: { libelle: 'Virage', valeurs: ['Bâbord 45°', 'Cap tenu', 'Tribord 45°'], tenue: 2 }, notes: [{ nom: 'Man de la cogue', dr: -1 }, { nom: 'Peu maniable', dr: -1 }] },
      autre: { role: 'rangees', rangees: [
        { qui: 'greta', poste: 'Capitaine', competence: 'Commandement', seuil: 44 },
        { qui: 'aldric', poste: 'Navigateur', competence: 'Orientation', seuil: 52 },
        { qui: 'bjorn', poste: 'Mousse', competence: 'Voile ou Ramer', seuil: 31 }] },
      gestes: avantLeDe(RESERVES.mira), reserves: reserves(RESERVES.mira),
    }),
    fenetre('combat-naval-bordee', {
      titre: 'Tir de batterie',
      heros: { role: 'testeur', qui: 'bjorn', poste: 'Artilleur', test: 'Projectiles (Poudre noire)', seuil: 47, modificateurs: ROLE_ESSENTIEL },
      centre: { role: 'equipage', fait: 'bordée de bâbord', cible: 'cogue', reglage: { libelle: 'Munition des pièces qui portent', valeurs: ['Boulet et poudre', 'Mitraille et poudre'], tenue: 0 }, notes: [{ pieces: 2, bord: 'bâbord' }, 'Un DR pour toutes'] },
      autre: { role: 'rangees', rangees: [
        { qui: 'greta', poste: 'Capitaine', competence: 'Commandement', seuil: 44 },
        { qui: 'mira', poste: 'Timonier', competence: 'Voile', seuil: 41 }] },
      gestes: avantLeDe(RESERVES.bjorn), reserves: reserves(RESERVES.bjorn),
    }),
    fenetre('combat-naval-chanson', {
      titre: 'Chanson de marin',
      heros: { role: 'testeur', qui: 'aldric', poste: 'Chansonnier', test: 'Divertissement (Chant)', seuil: 43 },
      centre: { role: 'simple', sur: 'La Sterne · une seule chanson par quart', phrase: 'L’effet dure trois minutes plus un nombre de minutes égal au DR.' },
      autre: { role: 'choix', libelle: 'Chanson', cartes: [
        { nom: 'Naviguons tous ensemble, ho hisse, ho hisse…', detail: ['+10 sur les Tests individuels d’un Test d’équipage'], choisie: true },
        { nom: 'Jacques Bret a rencontré notre acier sur les mers !', detail: ['+1 DR sur tout Test de Corps à corps réussi'] }] },
      gestes: avantLeDe(RESERVES.aldric), reserves: reserves(RESERVES.aldric),
    }),
    {
      nom: 'meuble-piece-de-bord', gabarit: 'combat', cour: MER, combattants: COMBATTANTS,
      combat: { round: 1, tour: { rang: 4, sur: 6 }, ordre: ['bjorn', 'greta'], suivant: ['aldric', 'mira', 'cogue', 'pirate'], journal: JOURNAL },
      barre: {
        qui: 'bjorn', arme: 'Canon (petit) de bâbord', charge: { reste: 1, sur: 1 }, action: true, avantage: 0, determination: RESERVES.bjorn.determination, ouverte: 'gestes', outils: [],
        familles: [
          { id: 'action', nom: 'Action', actions: [action('manoeuvre-du-navire', 'Manœuvrer'), action('bordee', 'Bordée'), action('attaque', 'Attaque')] },
          { id: 'situation', nom: 'Situation', actions: [action('rechargement-piece', 'Recharger', { fermee: true }), action('direction-equipe', 'Diriger l’équipe'), action('chanson-de-marin', 'Chanson de marin'), action('abandon-poste', 'Quitter la pièce')] },
          { id: 'gestes', nom: 'Gestes', actions: [action('munition', 'Munition', { ouverte: true }), action('avantage', 'Compétence'), action('usage-objet', 'Objet'), action('panoplie', 'Armes')] }],
      },
      liste: { titre: 'Approvisionner la pièce', lignes: [{ nom: 'Boulet et poudre', enSoute: 6 }, { nom: 'Mitraille et poudre', enSoute: 4 }], choisie: 0 },
    },
  ],
} satisfies Ecran;
