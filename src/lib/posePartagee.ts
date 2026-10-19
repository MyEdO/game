/** POSE PARTAGÉE (#1806) : des écouteurs posés à la PREMIÈRE prise et retirés à la DERNIÈRE rendue,
 *  quel que soit le nombre de preneurs. Composée par la porte d'Échap de la pile
 *  (`ui/clavier/couches/porteEchap.ts`) et par la délégation de la couche d'infobulle (`Infobulle`). */
export interface PosePartagee {
  /** Prend la pose (la pose au premier preneur) ; rend sa remise, qui n'agit qu'une fois. */
  prendre(): () => void;
  /** Retire la pose si elle est posée et oublie tout preneur : les remises antérieures n'agissent plus. */
  vider(): void;
}

/** `poser` pose les écouteurs et rend leur retrait. */
export function posePartagee(poser: () => () => void): PosePartagee {
  let preneurs = 0;
  let generation = 0;
  let retirer: () => void = () => {};
  return {
    prendre() {
      if (preneurs++ === 0) retirer = poser();
      const sienne = generation;
      let rendue = false;
      return () => {
        if (rendue || sienne !== generation) return;
        rendue = true;
        if (--preneurs === 0) retirer();
      };
    },
    vider() {
      if (preneurs > 0) retirer();
      preneurs = 0;
      generation++;
    },
  };
}
