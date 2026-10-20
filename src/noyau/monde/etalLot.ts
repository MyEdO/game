/**
 * LE LOT DE DÉS D'UN ÉTAL (#1426) — la génération d'un marché/port tire N dés d'un coup (marchand
 * présent, cargaison aléatoire, quantité de chaque lot, prix du Vin…). Ces dés sont des dés de MONDE :
 * le siège qui possède l'environnement doit pouvoir les POSER. Mais ils ne forment pas une séquence
 * jouée pas à pas — ils naissent tous ensemble, à l'ouverture de l'écran.
 *
 * D'où la FORME : une seule fenêtre à l'ouverture, qui liste tous les tirages de l'étal — une rangée
 * posable par dé — et se valide d'un bloc (la décision et sa citation vivent au ticket #1426). Ce
 * n'est pas une UI de plus : c'est une spec `spec.multi` de la fabrique existante, rendue par la
 * coquille `RollShell` (le mono = N=1).
 *
 * COMMENT, sans réécrire les générateurs : ils tirent déjà tout leur aléa d'UN `RNG` injecté. On les
 * exécute donc tels quels avec un rng ENREGISTREUR (le lot est le journal de ses dés), puis — si un dé
 * a été reposé — on les rejoue avec un rng REJOUEUR qui rend les dés posés et ne consomme AUCUN aléa
 * vivant. Les générateurs ne connaissent ni le lot, ni la fenêtre : ils déclarent seulement CE QUE
 * chaque dé décide (`phase`), parce qu'un dé sans nom n'est pas posable — le joueur doit savoir ce
 * qu'il pose.
 *
 * PARITÉ, l'invariant que ce module ne paie pas : option « Dés fixés » OFF, le générateur tourne UNE
 * fois, dans le même ordre, sur le même flux — l'étal est identique à l'octet. La fenêtre ne change
 * rien par sa seule existence : valider sans rien poser rejoue exactement les dés enregistrés.
 */
import { defaultRNG, type RNG } from '../../engine/dice';

/** UN dé du lot : ce qu'il décide, ses bornes, sa valeur courante. `id` stable = son rang de tirage. */
export interface EtalDraw {
  id: string;
  /** Ce que CE dé décide, en clair (« Marchand présent », « Quantité — Vin »). */
  label: string;
  min: number;
  max: number;
  value: number;
}

/** Libellé d'un dé que le générateur a OUBLIÉ de nommer — refusé par la garde du lot. */
export const DE_NON_NOMME = '(dé non nommé)';

/** Un rng ENREGISTREUR + le journal qu'il remplit. `phase` NOMME les dés qui suivent. */
export interface LotEnregistre {
  rng: RNG;
  draws: EtalDraw[];
  phase: (label: string) => void;
}

/**
 * Enveloppe un rng VIVANT : chaque tirage part au `base` (donc le flux d'aléa est celui d'avant) et
 * s'inscrit au journal sous le nom de la phase courante.
 */
export function lotEnregistreur(base: RNG = defaultRNG): LotEnregistre {
  const draws: EtalDraw[] = [];
  // Repli EXPLICITE : un dé que le générateur n'a pas nommé se VOIT (au lieu de se fondre dans un
  // libellé passe-partout) — c'est ce que la garde du lot refuse, et ce que le joueur ne doit
  // jamais avoir à poser à l'aveugle.
  let phase = DE_NON_NOMME;
  return {
    draws,
    phase: (label: string) => { phase = label; },
    rng: {
      int(min: number, max: number): number {
        const value = base.int(min, max);
        draws.push({ id: `de-${draws.length + 1}`, label: phase, min, max, value });
        return value;
      },
    },
  };
}

/**
 * Rng REJOUEUR : rend les dés du lot, dans l'ordre, SANS toucher à l'aléa vivant.
 *
 * DÉBORDEMENT ASSUMÉ ET DIT : poser un dé peut ouvrir une branche que le lot n'avait pas vue (rendre
 * présent un marchand qui était absent fait naître des tirages de quantité qui n'existaient pas). Le
 * rejeu manque alors de dés — il en tire de FRAIS au rng vivant (`secours`). C'est le seul
 * comportement qui ne mente pas : inventer des valeurs ou boucler sur les dés déjà posés fabriquerait
 * un hasard qui n'a jamais été tiré. Le compteur `deborde` le rend mesurable.
 */
export function lotRejoueur(draws: readonly EtalDraw[], secours: RNG = defaultRNG): { rng: RNG; deborde: () => number } {
  let i = 0;
  let deborde = 0;
  return {
    deborde: () => deborde,
    rng: {
      int(min: number, max: number): number {
        const d = draws[i++];
        if (!d) { deborde++; return secours.int(min, max); }
        // Le dé posé est ramené aux bornes RÉELLES du tirage courant : un dé saisi pour un d100 ne
        // peut pas servir tel quel à un d10 si la branche a changé sous lui.
        return Math.max(min, Math.min(max, d.value));
      },
    },
  };
}
