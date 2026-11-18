/**
 * Le Test de Corruption (#4411) : Berta face à une Influence corruptrice modérée, hors combat (LDB 19 l.29, l.47-53 ;
 * `src/noyau/fenetreDeCorruption.ts:32`, `reglage.corruption.nature`), la nature de l'Influence avant le dé, le jet
 * tombé sans puis avec le Talent Résistance (Corruption) (LDB 10 l.1016-1020 ; `verbe.resister`,
 * `jet.ferme.sansResistance`), puis le résultat choisi par la Résilience (LDB 17 l.68), sur la cour vidée de ses
 * adversaires (`../../combat-suite.md`, sections `test-de-corruption`).
 */
import { ligne } from '../../../../../../src/hote/elements';
import { apresLeDe, avantLeDe, BERTA, cartes, enjeu, fenetreSurLeDome, geste, gesteDeJet, jet, reglageDe, RESERVES, reserves } from './dome';
import type { Ecran } from './maquette';

/** Ce qu'une exposition modérée décide (LDB 19 l.47-53), la ligne tombée à son rang. */
const decide = (tombee: number | null) => enjeu('Ce que le Test décide', [['Échec', '+2 Points'], ['Succès Minime, 0 ou 1 DR', '+1 Point'], ['Succès, 2 DR et plus', 'aucun']], tombee);
const SANS_RESISTANCE = 'Aucune Résistance disponible contre cette menace.';
/** Le jet tombé `tombe`, sous le libellé `libelle` et ses modificateurs, ce qu'il retire, sa phrase, la ligne tombée. */
const tombe = (nom: string, titre: string, libelle: string, jete: { resultat: string; dr: string; reussite: boolean }, modificateurs: [string, string][], points: string, phrase: string, tombee: number, resistance: boolean, resilience: number) =>
  fenetreSurLeDome(nom, titre, 'fin-victoire', null, {
    titre: 'Corruption',
    corps: [ligne('arme', 'Influence physique · Points de Corruption 2 / 6'), jet('jet', BERTA, libelle, '≤ 45', jete, modificateurs), ligne('drNet', points), ligne('issue', phrase), decide(tombee)],
    gestes: [...apresLeDe('corruption', { reussi: jete.reussite, chance: RESERVES.berta.chance, resilience }), ...(jete.reussite ? [] : [geste(gesteDeJet('resister', 'corruption'), 'Résistance', { refus: resistance ? null : SANS_RESISTANCE })])],
    reserves: reserves({ ...RESERVES.berta, resilience }),
  });

export default {
  etats: [
    fenetreSurLeDome('test-de-corruption', 'Test de Corruption avant le dé, la nature de l’Influence', 'fin-victoire', null, {
      titre: 'Corruption',
      corps: [ligne('arme', 'Exposition modérée · Points de Corruption 2 / 6'), jet('jet', BERTA, 'Résistance', '≤ 45'), decide(null)],
      reglages: [cartes(reglageDe('corruption', 'nature'), 'Nature de la Corruption', [['resistance', 'Résistance', 'Influence physique · ≤ 45'], ['calme', 'Calme', 'Corruption spirituelle · ≤ 40']], 0)],
      gestes: avantLeDe('corruption', { resilience: RESERVES.berta.resilience }), reserves: reserves(RESERVES.berta),
    }),
    tombe('test-de-corruption-tombe', 'Test de Corruption tombé', 'Résistance · Exposition modérée', { resultat: '72', dr: '−3', reussite: false }, [], '+2 Points', 'Berta cède à l’Influence corruptrice : 4 Points de Corruption sur 6.', 0, false, RESERVES.berta.resilience),
    tombe('test-de-corruption-resistance', 'Test de Corruption tombé, le Talent Résistance à opposer', 'Résistance · Exposition modérée', { resultat: '72', dr: '−3', reussite: false }, [['Résistance (Corruption)', '']], '+2 Points', 'Berta cède à l’Influence corruptrice : 4 Points de Corruption sur 6.', 0, true, RESERVES.berta.resilience),
    tombe('test-de-corruption-resilience', 'Test de Corruption, le résultat choisi par la Résilience', 'Résistance · Je ne faillirai pas !', { resultat: '01', dr: '+4', reussite: true }, [], 'Aucun Point', 'Berta choisit son résultat : l’Influence corruptrice ne la marque pas.', 2, false, RESERVES.berta.resilience - 1),
  ],
} satisfies Ecran;
