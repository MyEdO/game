/**
 * Le Marchandage (#4411) : à la conclusion de l'achat dans la halle, le jet opposé d'Aldric contre le négociant prend la
 * place du bandeau ; l'offre et la page du chargement restent lisibles au-dessus (LDB 59 l.43, MSRC 13 l.127-129)
 * (`../../commerce.md`, sections `marchandage-avant-le-de`, `marchandage`).
 */
import { avantLeDe, apresLeDe, reserves } from './dome.ts';
import { combattants, RESERVES } from './compagnie.ts';
import { chargement, laine, RAIL, TITRE } from './halle.ts';
import type { Commerce, Ecran, Fenetre, LotMarchande } from './maquette.ts';

const LOT: LotMarchande = { nom: 'Laine', enc: 25 };
/** La halle sous la fenêtre `fenetre`, le compte du chargement marchandé ou non. */
const marche = (nom: string, fenetre: Fenetre, marchande: boolean): Commerce => ({
  nom, gabarit: 'lieu-et-voyage', decor: 'halle', titre: TITRE, rail: RAIL,
  scene: [laine({ depliee: true })],
  page: chargement({ conclure: false, ...(marchande ? { marchande: { libelle: 'Marchandage gagné', detail: { pourcent: -10 }, valeur: { prix: -66 } } } : {}) }),
  retour: 'Quitter la halle',
  combattants: combattants({ negociant: { nom: 'Le négociant en laine', buste: 'drapier', ennemi: false, blessures: 12, max: 12, etats: [] } }),
  fenetre,
});

export default {
  etats: [
    marche('marchandage-avant-le-de', {
      titre: 'Marchander l’achat',
      heros: { role: 'testeur', qui: 'aldric', test: 'Marchandage', seuil: 45, modificateurs: [{ nom: 'Soutien du groupe' }] },
      autre: { role: 'testeur', qui: 'negociant', test: 'Marchandage', seuil: null },
      centre: { role: 'marchandage', lot: LOT, estimation: 660, enjeux: [
        { issue: 'Gagné', pourcent: -10 }, { issue: 'Succès Stupéfiant', pourcent: -20 }, { issue: 'Perdu', pourcent: 10 }, { issue: 'Négociateur', pourcent: 10, enPlus: true }] },
      gestes: avantLeDe(RESERVES.aldric, { annuler: true }), reserves: reserves(RESERVES.aldric),
    }, false),
    marche('marchandage', {
      titre: 'Marchander l’achat',
      heros: { role: 'testeur', qui: 'aldric', test: 'Marchandage', seuil: 45, jet: { des: [20, 7], dr: 2, reussite: true } },
      autre: { role: 'testeur', qui: 'negociant', test: 'Marchandage', seuil: null, jet: { des: [60, 1], dr: -2, reussite: false } },
      centre: { role: 'issue', sorte: 'oppose', sur: `${LOT.nom} · ${LOT.enc} Enc`, verdict: 'reussite', dr: 2, drNet: 4, consequences: [{ genre: 'prix', valeur: -10, ton: 'gain', detail: 'Prix conclu : 594 sous au lieu de 660' }], phrase: 'Marchandage gagné', survol: 0 },
      gestes: [...apresLeDe(RESERVES.aldric, { valider: 'Conclure' }), { libelle: 'Refuser le marché' }], reserves: reserves(RESERVES.aldric),
    }, true),
  ],
} satisfies Ecran;
