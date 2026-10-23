/**
 * SONDE DE DIAGNOSTIC (#2907) : compte les passages d'un chemin qu'un test veut prouver emprunté ou évité. Son
 * porteur ne fait que `passer()` : il ne lit jamais le compte, qui ne peut donc rien produire (ni id, ni
 * décision). Seul un test le lit, par `passagesDe`, avant et après le geste qu'il observe : l'import de
 * `passagesDe` hors d'un `*.test.*` ou d'un `*.testkit.*` est refusé (`murs/sonde-lecture`, `oxlint.config.mjs`),
 * et le mur `murs/etat-de-module` n'admet une sonde de module que sous la forme `const X = sonde()` lue par
 * `X.passer()` seulement (`scripts/guards/lib/etatDeModuleLint.mjs`).
 */
export interface Sonde {
  /** Compte un passage. */
  readonly passer: () => void;
}

const PASSAGES = new WeakMap<Sonde, number>();

/** Une sonde neuve, à zéro passage. */
export function sonde(): Sonde {
  const s: Sonde = { passer: () => { PASSAGES.set(s, passagesDe(s) + 1); } };
  return s;
}

/** Le nombre de passages de `s` depuis sa création — lecture réservée aux tests (`murs/sonde-lecture`). */
export function passagesDe(s: Sonde): number {
  return PASSAGES.get(s) ?? 0;
}
