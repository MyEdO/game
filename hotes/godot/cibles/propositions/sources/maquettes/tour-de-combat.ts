/**
 * Le tour d'un combattant (#4411) : la barre de l'actif et ce qui s'y pose, sur la cour (`../../combat.md`, sections
 * `tour-adverse`, `journal-ouvert`, `fiche-au-clic`, `cible-survolee`, `meuble-*`, `cible-montee`, `visee-de-siege`).
 * Actions : ids de `src/data/actions.json` ; États : LDB 16 ; À Terre : LDB 15 l.45-49, LDB 16 l.35 ; Viser : LDB 14 ;
 * Recharger : LDB 62 ; pièce : LDB 13 l.106, MDG 09 l.44-46 ; cavalier ou monture : LDB 14 l.180 ; tir indirect : AA 10
 * l.169, l.171.
 */
import { COMBATTANTS, DIT, RESERVES, TOUR_DE_BERTA, TOUR_DE_L_ORC, TOUR_D_ILYANWE } from './dome.ts';
import type { ActionDuTour, BarreDeLActif, Combat, Combattant, Ecran, FamilleDActions, FicheDeSort } from './maquette.ts';

/** Les actions qui coûtent l'Action ; `attaque`, armée par la cible survolée ; `course`, fermée de sa raison. */
const action = ({ armee = false, course = null as string | null } = {}): FamilleDActions => ({
  id: 'action', nom: 'Action', actions: [
    { id: 'attaque', libelle: 'Attaque', ...(armee ? { armee: true } : {}) },
    { id: 'course', libelle: 'Course', ...(course ? { fermee: true, refus: course, survol: true } : {}) },
    { id: 'defensive', libelle: 'Défensive' },
  ],
});
const geste = (id: string, libelle: string, o: Partial<ActionDuTour> = {}): ActionDuTour => ({ id, libelle, ...o });
/** Les gestes qui ouvrent un choix. */
const gestes = (actions: ActionDuTour[]): FamilleDActions => ({ id: 'gestes', nom: 'Gestes', actions });
const situation = (actions: ActionDuTour[]): FamilleDActions => ({ id: 'situation', nom: 'Situation', actions });
const rapides = (sorts: (string | null)[], arme: number | null = null): FamilleDActions => ({ id: 'rapides', nom: 'Rapides', sorts, arme });
/** Les outils du tour, fermés tant que rien n'est à annuler ni à suspendre. */
const OUTILS: ActionDuTour[] = [geste('annulation-deplacement', 'Annuler le déplacement', { fermee: true }), geste('pause', 'Pause au prochain Round', { fermee: true })];
const COMMUNS = [geste('avantage', 'Compétence'), geste('usage-objet', 'Objet'), geste('depot', 'Poser au sol'), geste('panoplie', 'Armes')];

/** Les Sorts d'Ilyanwe, en emplacements rapides. */
const SORTS = ['Fléchette', 'Dôme', 'Bouclier', 'Lumière', null, null];
const FLECHETTE: FicheDeSort = { nom: 'Fléchette', ni: 0, portee: 'Force Mentale mètres', cibles: 1, duree: 'Instantanée', cout: 'l’Action', note: 'Un clic arme le sort, un second sur la cible le lance.' };

/** La barre d'Ilyanwe, la famille `ouverte` ; `sort`, la liste des Sorts ouverte ; `arme`, l'emplacement armé. */
const barreDIlyanwe = (ouverte: FamilleDActions['id'], { armee = false, sort = false, arme = null as number | null } = {}): BarreDeLActif => ({
  qui: 'ilyanwe', arme: 'Bâton de combat', mouvement: { reste: 4, sur: 4 }, action: true, avantage: 0, ouverte, outils: OUTILS,
  familles: [action({ armee }), gestes([geste('incantation', 'Sort', sort ? { ouverte: true } : {}), geste('focalisation', 'Focaliser'), geste('avantage', 'Compétence'), geste('depot', 'Poser au sol'), geste('panoplie', 'Armes')]), rapides(SORTS, arme)],
});
/** La barre de Berta, son arme, ses pas, ce que sa situation ouvre, ses gestes, la famille `ouverte`. */
const barreDeBerta = (arme: string, pas: number, familles: FamilleDActions[], ouverte: FamilleDActions['id']): BarreDeLActif => ({
  qui: 'berta', arme, mouvement: { reste: pas, sur: pas }, action: true, avantage: 0, determination: RESERVES.berta.determination, ouverte, outils: OUTILS,
  familles: [...familles, rapides(Array(6).fill(null))],
});

const ILYANWE = TOUR_D_ILYANWE([{ round: 1, commence: true }, DIT.gobelin, DIT.orc]);
/** Berta À Terre au contact de l'Orc, qui saigne. */
const AU_SOL: Record<string, Combattant> = {
  ...COMBATTANTS,
  berta: { ...COMBATTANTS.berta, blessures: 9, etats: [{ etat: 'aTerre', nom: 'À Terre', n: 1 }] },
  orc: { ...COMBATTANTS.orc, etats: [{ etat: 'hemorragique', nom: 'Hémorragique', n: 2 }] },
};
const SE_DEFEND = 'Ilyanwe la Voilée se met en Défensive.';
/** Le tour de Berta à la pièce, dont le journal finit par `fin`. */
const A_LA_PIECE = (fin: string): Combat => TOUR_DE_BERTA([DIT.orc, SE_DEFEND, fin]);

export default {
  etats: [
    {
      nom: 'combat-rapides', gabarit: 'combat', cour: { etat: 'combat-rapides' }, combattants: COMBATTANTS, combat: ILYANWE,
      barre: barreDIlyanwe('rapides', { arme: 0 }), pose: { role: 'sort', sort: FLECHETTE, depuis: 'rapide' },
    },
    {
      nom: 'combat-liste', gabarit: 'combat', cour: { etat: 'combat-liste' }, combattants: COMBATTANTS, combat: ILYANWE,
      barre: barreDIlyanwe('gestes', { sort: true }), liste: { titre: 'Lancer ce sort', lignes: ['Dôme', 'Bouclier anti-flèches', 'Fléchette', 'Lumière'], choisie: 2 },
      pose: { role: 'sort', sort: FLECHETTE, depuis: 'liste' },
    },
    {
      nom: 'cible-survolee', gabarit: 'combat', cour: { etat: 'cible-survolee' }, combattants: COMBATTANTS, combat: ILYANWE,
      barre: barreDIlyanwe('action', { armee: true }),
      pose: { role: 'cible', qui: 'orc', arme: 'Bâton de combat', test: 'Corps à corps (Armes d’hast)', seuil: 48, avantage: 10, degats: 6, oppose: 'Parade', note: 'Charge : +1 Avantage. Un second clic confirme.' },
    },
    {
      nom: 'tour-adverse', gabarit: 'combat', cour: { etat: 'tour-adverse' }, combattants: COMBATTANTS,
      combat: TOUR_DE_L_ORC([DIT.defensive, DIT.tir, 'Orc s’avance vers Ilyanwe la Voilée.']),
      barre: { qui: 'orc', arme: 'Hache', adverse: true, familles: [action()], ouverte: 'action', outils: OUTILS },
    },
    {
      nom: 'journal-ouvert', gabarit: 'combat', cour: { etat: 'journal-ouvert' }, combattants: COMBATTANTS, combat: { round: 2, tour: { rang: 1, sur: 4 }, ordre: ['ilyanwe', 'berta', 'gobelin', 'orc'], suivant: ['ilyanwe', 'berta'], journal: [] },
      barre: barreDIlyanwe('action'),
      pose: {
        role: 'journal', rounds: [
          { round: 1, lignes: ['Le combat commence !', DIT.gobelin, DIT.orc, 'Ilyanwe la Voilée rate son incantation (Fléchette).', DIT.defensive, DIT.tir, 'Orc s’avance dans la cour.'] },
          { round: 2, lignes: [DIT.gobelin, DIT.orc] },
        ],
      },
    },
    {
      nom: 'fiche-au-clic', gabarit: 'combat', cour: { etat: 'fiche-au-clic' }, combattants: COMBATTANTS, combat: ILYANWE,
      barre: barreDIlyanwe('action'),
      pose: {
        role: 'fiche', fiche: {
          qui: 'berta', peuple: 'Humains (Reiklander)', carriere: 'Soldate',
          reserves: [{ nom: 'Destin', valeur: 2 }, { nom: 'Chance', valeur: RESERVES.berta.chance }, { nom: 'Résilience', valeur: RESERVES.berta.resilience }, { nom: 'Détermination', valeur: RESERVES.berta.determination }],
          caracteristiques: [['M', 4], ['CC', 41], ['CT', 33], ['F', 38], ['E', 35], ['I', 31], ['Ag', 34], ['Dex', 28], ['Int', 27], ['FM', 35], ['Soc', 30], ['B', 12]].map(([nom, valeur]) => ({ nom: String(nom), valeur: Number(valeur) })),
          sections: ['Attaques', 'Compétences', 'Talents', 'Possessions'], ouverte: 'Attaques',
          armes: [
            { id: 'epee', nom: 'Épée', test: 41, degats: { bonus: 4, total: 7 }, allonge: 'Moyenne', atouts: [] },
            { id: 'bouclier', nom: 'Bouclier', test: 41, degats: { bonus: 2, total: 5 }, allonge: 'Très courte', atouts: ['Bouclier 2', 'Défensive', 'Assommante'] },
          ],
        },
      },
    },
    {
      nom: 'meuble-engage-a-terre', gabarit: 'combat', cour: { etat: 'meuble-engage-a-terre' }, combattants: AU_SOL,
      combat: TOUR_DE_BERTA([DIT.gobelin, DIT.orc, 'Berta est À Terre.']),
      barre: barreDeBerta('Épée', 2, [
        action({ course: 'ne peut que ramper : se relever d’abord' }),
        situation([geste('desengagement', 'Se désengager'), geste('relevement', 'Se relever'), geste('battement', 'Battement'), geste('distraire', 'Distraire'), geste('frenesie', 'Frénésie')]),
        gestes(COMMUNS),
      ], 'action'),
    },
    {
      nom: 'meuble-tireur', gabarit: 'combat', cour: { etat: 'meuble-tireur' }, combattants: COMBATTANTS,
      combat: TOUR_DE_BERTA([DIT.gobelin, DIT.orc, SE_DEFEND]),
      barre: barreDeBerta('Arbalète', 4, [action(), situation([geste('visee', 'Viser'), geste('rechargement', 'Recharger', { fermee: true })]), gestes([geste('munition', 'Munition'), ...COMMUNS])], 'situation'),
      offres: [{ id: 'mise-en-selle', libelle: 'Monter', sur: 'monture' }, { id: 'service-poste', libelle: 'Servir', sur: 'piece' }],
    },
    {
      nom: 'meuble-chef-de-piece', gabarit: 'combat', cour: { etat: 'meuble-chef-de-piece' }, combattants: COMBATTANTS,
      combat: A_LA_PIECE('Berta sert la Baliste.'),
      barre: barreDeBerta('Baliste', 4, [action(), situation([geste('rechargement-piece', 'Recharger'), geste('direction-equipe', 'Diriger l’équipe'), geste('abandon-poste', 'Quitter la pièce')]), gestes(COMMUNS)], 'situation'),
      offres: [{ id: 'poussee', libelle: 'Pousser', sur: 'piece' }],
    },
    {
      nom: 'cible-montee', gabarit: 'fenetre-du-bas', cour: { etat: 'cible-montee' },
      combattants: { ...COMBATTANTS, cheval: { nom: 'Cheval', buste: 'cheval', ennemi: true, blessures: 22, max: 22, etats: [] } },
      combat: TOUR_DE_BERTA([DIT.gobelin, DIT.orc, SE_DEFEND]),
      fenetre: {
        titre: 'Combat monté', heros: { role: 'heros', qui: 'berta', mise: { arme: 'Épée' } },
        centre: { role: 'choix', groupes: [{ cartes: [{ qui: 'gobelin', detail: ['Cavalier'], marque: { nom: 'au Test', valeur: -10 }, choisie: true }, { qui: 'cheval', detail: ['Monture'] }] }] },
        gestes: [{ libelle: 'Cibler', principal: true }, { libelle: 'Annuler' }], reserves: [],
      },
    },
    {
      nom: 'visee-de-siege', gabarit: 'fenetre-du-bas', cour: { etat: 'visee-de-siege' }, combattants: COMBATTANTS,
      combat: A_LA_PIECE('Berta sert le Mortier.'),
      fenetre: {
        titre: 'Viser', heros: { role: 'heros', qui: 'berta', mise: { arme: 'Mortier' }, marque: 'Pilonnage' },
        centre: { role: 'consigne', consigne: 'Cliquez la case où poser la zone.' }, gestes: [{ libelle: 'Annuler' }], reserves: [],
      },
    },
  ],
} satisfies Ecran;
