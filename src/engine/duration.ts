/**
 * Durée d'un effet — représentation UNIQUE et discriminée. Remplace le couple `roundsLeft` +
 * `untilTime` (+ la sentinelle `COMBAT_PERSIST = 9999`) qui portait DEUX chemins d'expiration sur la
 * même structure : le type ci-dessous rend ce mélange impossible à la compilation.
 *
 *  - `rounds`     : échelle tactique — décrémentée à chaque frontière de Round (combat + entretien
 *                   hors combat au prorata). RAW : sorts « qui durent N Rounds ».
 *  - `clock`      : échéance d'HORLOGE en minutes `gameTime` absolues — purgée par l'horloge
 *                   (`purgeClockEffects`). RAW LDB 47 : « (Bonus de FM) heures », « lever du soleil ».
 *  - `permanent`  : ne s'éteint pas seul (retiré explicitement : repos, soin, dissipation).
 *  - `adventure`  : « pour votre prochaine aventure » (LDB 23 l.209/218/234 : Entraînement au Combat,
 *                   Observer une cible, Réputation) — posée à la clôture d'un interlude (`interludeEnd`),
 *                   purgée à l'OUVERTURE de l'interlude SUIVANT (`purgeAdventureEffects`, appelée par
 *                   `startInterlude`) : la borne « fin d'aventure » n'a pas d'échéance CHIFFRABLE
 *                   (Rounds/horloge) à la pose, contrairement à `clock`.
 *
 * Les deux échelles sont MUTUELLEMENT EXCLUSIVES par construction (un sort a une durée en Rounds OU en
 * minutes/heures/jours, jamais les deux — cf. `combatFlow` : `clockMin` n'est calculé que si `rounds`
 * est absent), ce que l'union discriminée reflète exactement.
 */
export type Duration =
  | { scale: 'rounds'; left: number }
  | { scale: 'clock'; until: number }
  | { scale: 'permanent' }
  | { scale: 'adventure' };

/** Libellé CANONIQUE d'un compte de Rounds — vocabulaire UNIQUE de l'échelle tactique, posé auprès du
 *  modèle pour qu'aucun affichage ne réinvente l'unité (le Round contient le tour de chaque combattant :
 *  un suffixe « t »/« tour » y serait faux). « Round » capitalisé comme terme RAW, accord réel.
 *
 *  `short` : forme ABRÉGÉE « N R » (arbitrage user 2026-07-18) des surfaces COMPACTES — pastilles de
 *  la colonne aside, où « N Rounds » renvoie la pastille à la ligne. Même unité (R = Round), même
 *  source : une seule fonction porte les deux formes pour qu'aucune abréviation divergente n'apparaisse. */
export function roundsLabel(n: number, opts?: { short?: boolean }): string {
  if (opts?.short) return `${n} R`;
  return `${n} Round${n > 1 ? 's' : ''}`;
}

/** Libellé CANONIQUE d'un RESTE de durée d'HORLOGE, en minutes de `gameTime` — vocabulaire UNIQUE de
 *  l'échelle `clock`, posé auprès du modèle comme `roundsLabel` l'est pour l'échelle tactique. L'unité
 *  suit la grandeur (minutes < 1 h, heures < 1 j, sinon jours), arrondie au cran SUPÉRIEUR : une
 *  fenêtre « moins d'une minute » reste « 1 min » tant qu'elle n'est pas échue. À échéance ou au-delà :
 *  `undefined` (il n'y a plus de reste à dire — la purge d'horloge va l'emporter).
 *
 *  `exact` : forme DÉCOMPOSÉE d'une durée ÉCOULÉE ou estimée (« 2 h 40 min », « 1 j 6 h », « 3 j »),
 *  arrondie à la minute, l'unité de chaque part toujours dite (« 1 j 22 h 10 » se lirait comme une
 *  heure) — mêmes unités que la forme courte (le voyage : estimation d'avant départ et durée réelle du
 *  récapitulatif). Une seule fonction porte les deux formes, comme `roundsLabel`. */
export function clockLabel(minutesLeft: number, opts?: { exact?: boolean }): string | undefined {
  if (minutesLeft <= 0) return undefined;
  if (opts?.exact) return exactClockLabel(Math.max(1, Math.round(minutesLeft)));
  if (minutesLeft < 60) return `${Math.ceil(minutesLeft)} min`;
  if (minutesLeft < 24 * 60) return `${Math.ceil(minutesLeft / 60)} h`;
  return `${Math.ceil(minutesLeft / (24 * 60))} j`;
}

function exactClockLabel(minutes: number): string {
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;
  if (days === 0 && hours === 0) return `${mins} min`;
  const parts: string[] = [];
  if (days) parts.push(`${days} j`);
  if (hours) parts.push(`${hours} h`);
  if (mins) parts.push(`${mins} min`);
  return parts.join(' ');
}

/** Avance une durée d'UN Round. Les échelles `clock`/`permanent`/`adventure` sont inertes au tick de Round. */
export function tickRound(d: Duration): Duration {
  return d.scale === 'rounds' ? { scale: 'rounds', left: d.left - 1 } : d;
}
