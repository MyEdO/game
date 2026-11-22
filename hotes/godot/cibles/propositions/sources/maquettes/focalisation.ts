/**
 * La Focalisation (#4411) : Ilyanwe focalise la magie du Dôme en Test étendu, avant le dé, tombée, le Niveau
 * d'incantation atteint, puis sur un Critique (LDB 46 l.128-136), et ce que la Focalisation ouvre, sur la cour
 * (`../../combat-suite.md`, sections `focalisation`).
 */
import { apresLeDe, avantLeDe, COMBATTANTS, DIT, RESERVES, reserves, TOUR_D_ILYANWE } from './dome.ts';
import type { Ecran, EtatDeCombat, JetTombe } from './maquette.ts';

/** Ce que la Focalisation ouvre (LDB 46 l.132, l.136). */
const OUVRE = [
  { issue: '7 DR cumulés', effet: 'NI 0 au prochain Round' },
  { issue: 'Critique', effet: 'lançable au prochain Round' },
  { issue: 'Incantation manquée', effet: 'magie perdue' },
];
/** L'état `nom` : le jet tombé ou avant le dé, le cumul, la phrase, la ligne atteinte, ce que dit le journal. */
const focaliser = (nom: string, jet: JetTombe | null, cumul: number, phrase: string, tombee: number | null, dit: string): EtatDeCombat => ({
  nom, gabarit: 'fenetre-du-bas', cour: { etat: 'incantation' }, combattants: COMBATTANTS, combat: TOUR_D_ILYANWE([DIT.orc, DIT.defensive, dit]),
  fenetre: {
    titre: 'Focalisation',
    heros: { role: 'testeur', qui: 'ilyanwe', test: 'Focalisation', seuil: 62, ...(jet ? { jet } : {}) },
    centre: jet
      ? { role: 'issue', sorte: 'etendu', sur: 'Dôme · Niveau d’incantation 7', verdict: jet.critique ? 'critique' : jet.reussite ? 'reussite' : 'echec', dr: jet.dr, cumul: { dr: cumul, vise: 7 }, consequences: [], phrase, enjeu: { libelle: 'Ce que la Focalisation ouvre', issues: OUVRE, tombee } }
      : { role: 'etendu', ni: 7, sort: 'Dôme', cumul, phrase, enjeu: { libelle: 'Ce que la Focalisation ouvre', issues: OUVRE, tombee } },
    gestes: jet ? apresLeDe(RESERVES.ilyanwe) : avantLeDe(RESERVES.ilyanwe, { annuler: true }), reserves: reserves(RESERVES.ilyanwe),
  },
});
const FOCALISE = 'Ilyanwe la Voilée focalise la magie du Dôme.';

export default {
  etats: [
    focaliser('focalisation-avant-le-de', null, 0, 'Focalisation : 0/7 DR.', null, FOCALISE),
    focaliser('focalisation', { des: [20, 4], dr: 4, reussite: true }, 4, 'Focalisation : 4/7 DR.', null, FOCALISE),
    focaliser('focalisation-atteinte', { des: [30, 1], dr: 3, reussite: true }, 7, 'Focalisation complète — le NI du Sort est atteint.', 0, 'Ilyanwe la Voilée a focalisé assez de magie pour lancer Dôme (NI 0).'),
    focaliser('focalisation-critique', { des: [30, 3], dr: 3, reussite: true, critique: true }, 3, 'Dôme est lançable au prochain Round (NI 0) !', 1, 'Ilyanwe la Voilée — Focalisation CRITIQUE : Dôme est lançable au prochain Round (NI 0) !'),
  ],
} satisfies Ecran;
