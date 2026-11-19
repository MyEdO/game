/**
 * La dissipation d'un Sort durable (#4411) : Ilyanwe choisit, pour son Action, le Sort du Chamane gobelin à dissiper
 * (LDB 46 l.158-160), puis son Test étendu de Langue (Magick) avant et après le dé, le cumul de ses DR sur le Niveau
 * d'incantation, sur la cour (`../../combat-suite.md`, sections `dissipation`).
 */
import { apresLeDe, avantLeDe, COMBATTANTS, DIT, RESERVES, reserves } from './dome.ts';
import type { Combat, Cour, Ecran, EtatDeCombat } from './maquette.ts';

/** Le premier tour du round 2, dont le journal dit `journal`. */
const tour = (journal: string[]): Combat => ({ round: 2, tour: { rang: 1, sur: 4 }, ordre: ['ilyanwe', 'berta', 'chamane', 'orc'], suivant: ['ilyanwe', 'berta'], journal });
const DOME = 'Chamane gobelin s’abrite sous un Dôme.';
const COUR: Cour = { etat: 'incantation', marques: ['vise', 'dome'] };
/** Le Test étendu, tombé ou non, et le cumul qu'il porte. */
const etendu = (nom: string, tombe: boolean): EtatDeCombat => ({
  nom, gabarit: 'fenetre-du-bas', cour: COUR, combattants: COMBATTANTS, combat: tour([DOME, DIT.defensive, 'Ilyanwe la Voilée entame la Dissipation du Dôme.']),
  fenetre: {
    titre: 'Dissipation',
    heros: { role: 'testeur', qui: 'ilyanwe', test: 'Langue (Magick) · coûte l’Action', seuil: 85, ...(tombe ? { jet: { des: [50, 1], dr: 3, reussite: true } } : {}) },
    centre: { role: 'etendu', ni: 7, sort: 'Dôme', cumul: tombe ? 5 : 2, phrase: tombe ? 'Le Dôme vacille : encore 2 DR pour le dissiper.' : 'Encore 5 DR pour dissiper le Dôme.' },
    autre: { role: 'vise', qui: 'chamane', comme: 'Lanceur du Sort visé' },
    gestes: tombe ? apresLeDe(RESERVES.ilyanwe) : avantLeDe(RESERVES.ilyanwe, { annuler: true }), reserves: reserves(RESERVES.ilyanwe),
  },
});

export default {
  etats: [
    {
      nom: 'dissipation-entree', gabarit: 'fenetre-du-bas', cour: COUR, combattants: COMBATTANTS, combat: tour(['Chamane gobelin lance Arme aethyrique.', DOME, DIT.defensive]),
      fenetre: {
        titre: 'Dissipation',
        heros: { role: 'heros', qui: 'ilyanwe', mise: { test: 'Langue (Magick)', seuil: 85 }, cout: 'Coûte l’Action' },
        centre: {
          role: 'choix', groupes: [{
            cartes: [
              { nom: 'Dôme', detail: [{ ni: 7 }, { aCumuler: 7 }], choisie: true },
              { nom: 'Arme aethyrique', detail: [{ ni: 2 }, { aCumuler: 2 }] },
            ],
          }],
        },
        autre: { role: 'vise', qui: 'chamane', comme: 'Porteur désigné' },
        gestes: [{ libelle: 'Dissiper', principal: true }, { libelle: 'Annuler' }], reserves: [],
      },
    },
    etendu('dissipation-avant-le-de', false),
    etendu('dissipation', true),
  ],
} satisfies Ecran;
