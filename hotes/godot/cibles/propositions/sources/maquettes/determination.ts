/**
 * La Détermination (#4411) : Berta, À Terre, dépense son Point de Détermination (LDB 17 l.57-61), pour l'Immunité à
 * la Psychologie puis pour retirer un État (LDB 16), sur la cour (`../../combat.md`, section `determination`).
 */
import { COMBATTANTS, DIT, RESERVES, TOUR_DE_BERTA } from './dome.ts';
import type { EtatDeCombat, Ecran } from './maquette.ts';

/** L'état `nom`, la carte choisie au rang `choisie` ; l'État retiré se presse dans l'ordre du tour. */
const depense = (nom: string, choisie: number): EtatDeCombat => ({
  nom, gabarit: 'fenetre-du-bas', cour: { etat: nom },
  combattants: {
    ...COMBATTANTS,
    berta: { ...COMBATTANTS.berta, blessures: 9, etats: [{ etat: 'aTerre', nom: 'À Terre', n: 1, ...(choisie === 2 ? { presse: true as const } : {}) }] },
    orc: { ...COMBATTANTS.orc, etats: [{ etat: 'hemorragique', nom: 'Hémorragique', n: 2 }] },
  },
  combat: TOUR_DE_BERTA([DIT.gobelin, DIT.orc, 'Berta est À Terre.']),
  fenetre: {
    titre: 'Détermination',
    heros: { role: 'heros', qui: 'berta', mise: { reserve: 'Détermination', valeur: RESERVES.berta.determination } },
    centre: {
      role: 'choix', groupes: [{
        cartes: [
          { nom: 'Immunité Psychologie', detail: ['jusqu’à la fin du prochain Round'] },
          { nom: 'Ignorer les modificateurs de critique', detail: ['jusqu’au début du prochain Round'] },
          { nom: 'Retirer un État', detail: ['À Terre (+1 PB en se relevant)'] },
        ].map((c, k) => (k === choisie ? { ...c, choisie: true as const } : c)),
      }],
    },
    gestes: [{ libelle: 'Dépenser', principal: true }, { libelle: 'Annuler' }],
    reserves: [{ id: 'determination', nom: 'Détermination', valeur: RESERVES.berta.determination, porteur: 'berta' }],
  },
});

export default {
  etats: [depense('determination', 0), depense('determination-etat', 2)],
} satisfies Ecran;
