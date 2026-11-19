/**
 * La poursuite terrestre (#4411) : le groupe fuit trois Brigands dans la forêt. Le Test de Mouvement de la manche, puis,
 * rattrapé, ce que fait le groupe (LDB 15 l.88-108) (`../../combat-suite.md`, sections `poursuite-terrestre*`).
 */
import { avantLeDe, reserves } from './dome.ts';
import { combattants, RESERVES } from './compagnie.ts';
import type { Ecran, Fenetre, Poursuite } from './maquette.ts';

const ISSUES = [{ distance: 0, issue: 'rattrapés' }, { distance: 10, issue: 'semés' }];

/** La manche 2 de la fuite, à la Distance `distance`. */
const manche = (nom: string, distance: number, sous: string, recit: string, fenetre: Fenetre): Poursuite => ({
  nom, gabarit: 'lieu-et-voyage', decor: 'foret',
  titre: { nom: 'Poursuite', sous },
  recit: { rubrique: `Poursuite — ${sous.toLowerCase()}`, texte: recit },
  panneau: { role: 'poursuite', poursuivant: '3 Brigands', distance, sur: 10, manche: { libelle: 'Test de Mouvement', test: 'Athlétisme' }, issues: ISSUES, abandon: 'Abandonner la fuite' },
  combattants: combattants({ brigands: { nom: '3 Brigands', buste: 'bjorn', ennemi: true, blessures: 10, max: 10, etats: [] } }),
  fenetre,
});

export default {
  etats: [
    manche('poursuite-terrestre', 4, 'Manche 2', 'Le groupe prend la fuite. Trois Brigands dévalent le chemin derrière lui, leurs torches dansent entre les troncs.', {
      titre: 'Poursuite — manche 2',
      heros: { role: 'testeur', qui: 'mira', test: 'Athlétisme · Mouvement 5', seuil: 52 },
      centre: { role: 'tests', nom: 'Test de Mouvement', test: 'chacun son Athlétisme', lignes: [
        { qui: 'bjorn', test: 'Athlétisme', seuil: 45, attente: 'à lancer' },
        { qui: 'mira', test: 'Athlétisme', seuil: 52, attente: 'à lancer', bonus: { mouvement: 5, dr: 1 }, courant: true },
        { qui: 'aldric', test: 'Athlétisme', seuil: 31, attente: 'à lancer' },
        { qui: 'greta', test: 'Athlétisme', seuil: 40, attente: 'à lancer' },
        { qui: 'brigands', test: 'Athlétisme', seuil: 35, attente: 'à la clôture' }],
        regle: { texte: 'Le DR le plus bas du groupe contre le plus haut des Brigands', effet: '± Distance' } },
      gestes: [...avantLeDe(RESERVES.mira), { libelle: 'Tout lancer' }], reserves: reserves(RESERVES.mira),
    }),
    manche('poursuite-terrestre-rattrapes', 0, 'Rattrapés !', 'Manche 2 : les poursuivants gagnent du terrain (−4 → Distance 0/10). Aldric, à bout de souffle, traîne derrière les autres.', {
      titre: 'Rattrapés — que fait le groupe ?',
      heros: { role: 'heros', qui: 'bjorn', mise: { decidePour: 'le groupe' } },
      centre: { role: 'choix', groupes: [{ cartes: [
        { nom: 'Abandonner Aldric', qui: 'aldric', detail: ['Laissé derrière, il ralentit', 'les poursuivants'], funeste: true },
        { nom: 'S’arrêter et les affronter', detail: ['Le groupe fait face aux poursuivants'], choisie: true }] }] },
      gestes: [{ libelle: 'Faire face', principal: true }], reserves: [],
    }),
  ],
} satisfies Ecran;
