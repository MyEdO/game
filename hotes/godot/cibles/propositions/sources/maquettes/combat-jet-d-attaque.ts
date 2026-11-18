/**
 * Le jet d'attaque tombé (#4411) : Ilyanwe la Voilée charge l'Orc au Bâton de combat et rate, l'Orc pare et rate aussi,
 * le DR net donne l'Avantage à l'Orc. Sa fenêtre de jet, ses gestes après le dé et les réserves qu'ils dépensent
 * (`../../combat.md`), sur la cour.
 */
import { bouton, ligne, type Jet, type Puce } from '../../../../../../src/hote/elements';
import type { CombattantProjete } from '../../../../../../src/hote/projection';
import { SANS_JEU, reponsesDeLEcran, type Maquette } from './maquette';

const combattant = (id: string, nom: string, camp: CombattantProjete['camp'], pb: [number, number], pos: [number, number, number]): CombattantProjete => ({
  id, nom, camp, pb, avantage: 0, pos, distance: 1, engage: true, etats: [], horsCombat: false, portee: null, vehicule: null,
});
const ILYANWE = combattant('ilyanwe', 'Ilyanwe la Voilée', 'heros', [17, 17], [13, 6, 0]);
const ORC = combattant('orc', 'Orc', 'ennemi', [14, 14], [14, 6, 0]);

const jet = (id: string, qui: string, combattant: string, libelle: string, cible: string, resultat: string, dr: string, modificateurs: Puce[]): Jet => ({
  type: 'jet', id, ton: 'echec', qui, combattant, libelle, cible, resultat, dr, verdict: 'échec', modificateurs, detail: null,
});
const puce = (id: string, libelle: string, valeur: string): Puce => ({ type: 'puce', id, ton: 'neutre', libelle, valeur, detail: null, jeu: null });
const geste = (id: string, libelle: string) => bouton(id, libelle, SANS_JEU);

export default {
  nom: 'combat-jet-d-attaque',
  titre: 'jet d’attaque tombé',
  gabarits: ['fenetre-du-bas'],
  decor: { scene: 'cour', variante: 'jet' },
  reponses: reponsesDeLEcran({
    disposition: 'cascade/attaque',
    zones: {
      'fenetre.titre': [ligne('titre', 'Attaque')],
      'fenetre.corps': [
        ligne('arme', 'Bâton de combat'),
        ligne('cible', 'Cible : Orc'),
        jet('jet', 'Ilyanwe la Voilée', 'ilyanwe', 'Corps à corps (Armes d’hast)', '≤ 48', '98', 'DR −5', [puce('jet/m0', 'Avantage', '+10')]),
        jet('defense', 'Orc', 'orc', 'Parade', '≤ 35', '70', 'DR −4', []),
        ligne('drNet', 'DR net +1'),
        ligne('issue', 'Ilyanwe la Voilée rate son attaque ; Orc gagne +1 Avantage.'),
      ],
      'fenetre.gestes': [
        { ...geste('appliquer', 'Appliquer'), focus: true },
        geste('relancer', 'Relancer'),
        geste('chance', 'Chance : +1 DR'),
        geste('pacte', 'Pacte'),
        geste('resilience', 'Résilience'),
      ],
      'fenetre.reserves': [puce('chance', 'Chance', '4'), puce('resilience', 'Résilience', '3'), puce('determination', 'Détermination', '3')],
    },
    journal: [],
    projection: {
      fenetre: { cle: 'attaque', proprietaire: { genre: 'porteur', nom: 'Ilyanwe la Voilée' }, gestes: [], fermes: {}, pid: null },
      exploration: null,
      combat: {
        round: 1, tour: 1, tours: 4, fin: null,
        actif: { ...ILYANWE, action: 'prise', mouvement: [0, 4] },
        apercu: null, barre: { forme: 'tenue', raison: null }, intention: null, finDeTourArmee: false,
        cibles: { liste: [], enPlus: 0 }, offres: null, voisins: { liste: [ILYANWE, ORC], enPlus: 0 },
      },
    },
  }),
} satisfies Maquette;
