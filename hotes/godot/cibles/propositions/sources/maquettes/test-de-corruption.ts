/**
 * Le Test de Corruption (#4411) : Berta face à une Influence corruptrice modérée, hors combat (LDB 19 l.29, l.47-53),
 * la nature de l'Influence avant le dé, le jet tombé sans puis avec le Talent Résistance (Corruption) (LDB 10
 * l.1016-1020), puis le résultat choisi par la Résilience (LDB 17 l.68), sur la cour vidée de ses adversaires
 * (`../../combat-suite.md`, sections `test-de-corruption`).
 */
import { apresLeDe, avantLeDe, COMBATTANTS, RESERVES, reserves } from './dome.ts';
import type { Cour, Ecran, Enjeu, EtatDeCombat, Fenetre, JetTombe } from './maquette.ts';

/** Ce qu'une exposition modérée décide (LDB 19 l.47-53), la ligne tombée à son rang. */
const decide = <T extends number | null>(tombee: T): Enjeu & { tombee: T } => ({
  libelle: 'Ce que le Test décide', tombee,
  issues: [{ issue: 'Échec', effet: '+2 Points' }, { issue: 'Succès Minime, 0 ou 1 DR', effet: '+1 Point' }, { issue: 'Succès, 2 DR et plus', effet: 'aucun' }],
});
const COUR: Cour = { etat: 'fin-victoire', videe: true };
const CORRUPTION = { points: 2, seuil: 6 };
const etat = (nom: string, fenetre: Fenetre): EtatDeCombat => ({ nom, gabarit: 'fenetre-du-bas', cour: COUR, combattants: COMBATTANTS, combat: null, fenetre });
/** Le jet tombé, sous `test`, son modificateur, les Points gagnés, la phrase, la ligne tombée ; la Résistance que le
 *  Talent ouvre ou non sur un échec. */
const tombe = (nom: string, test: string, jet: JetTombe, modificateur: string | null, gain: number, issue: string, tombee: number, resistance: boolean | null, resilience: number): EtatDeCombat => etat(nom, {
  titre: 'Corruption',
  heros: { role: 'testeur', qui: 'berta', test, seuil: 45, jet, ...(modificateur ? { modificateurs: [{ nom: modificateur }] } : {}) },
  centre: { role: 'corruption', influence: 'Influence physique', corruption: CORRUPTION, gain, issue, enjeu: decide(tombee) },
  gestes: [...apresLeDe({ ...RESERVES.berta, resilience }, { echec: !jet.reussite }), ...(resistance === null ? [] : [resistance ? { libelle: 'Résistance' } : { libelle: 'Résistance', refus: 'Aucune Résistance disponible contre cette menace.' }])],
  reserves: reserves({ ...RESERVES.berta, resilience }),
});
const ECHEC: JetTombe = { des: [70, 2], dr: -3, reussite: false };
const CEDE = 'Berta cède à l’Influence corruptrice : 4 Points de Corruption sur 6.';

export default {
  etats: [
    etat('test-de-corruption', {
      titre: 'Corruption',
      heros: { role: 'expose', qui: 'berta', exposition: 'Exposition modérée', corruption: CORRUPTION },
      centre: {
        role: 'nature', libelle: 'Nature de la Corruption', enjeu: decide(null),
        cartes: [{ nom: 'Résistance', detail: [{ test: 'Influence physique', seuil: 45 }], choisie: true }, { nom: 'Calme', detail: [{ test: 'Corruption spirituelle', seuil: 40 }] }],
      },
      gestes: avantLeDe(RESERVES.berta), reserves: reserves(RESERVES.berta),
    }),
    tombe('test-de-corruption-tombe', 'Résistance · Exposition modérée', ECHEC, null, 2, CEDE, 0, false, RESERVES.berta.resilience),
    tombe('test-de-corruption-resistance', 'Résistance · Exposition modérée', ECHEC, 'Résistance (Corruption)', 2, CEDE, 0, true, RESERVES.berta.resilience),
    tombe('test-de-corruption-resilience', 'Résistance · Je ne faillirai pas !', { des: [0, 1], dr: 4, reussite: true, reglable: true }, null, 0, 'Berta choisit son résultat : l’Influence corruptrice ne la marque pas.', 2, null, RESERVES.berta.resilience - 1),
  ],
} satisfies Ecran;
