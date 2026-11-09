/**
 * HORLOGE D'IMPACT (#3160) — l'unique émetteur d'`ANIM_IMPACT` : l'attaque ou le sort posté sur
 * `ANIM_ATTACK` atteint sa cible au tour de file suivant (délai nul, après la distribution de
 * l'attaque à tous ses abonnés), et les retours qui l'écoutent (`useCombatFx` : « -N », « Raté »,
 * « Paré », `state/audioWiring`) se jouent.
 *
 * SINGLETON de module : deux hôtes montés en même temps (fiche de station, éditeur) installent la même
 * horloge, et un seul abonnement court — deux abonnements doubleraient chaque impact.
 */
import { bus, EVT, type ChargeDAttaque } from '../../noyau/bus';

let installations = 0;
let off: (() => void) | null = null;

function onAttack(d: ChargeDAttaque): void {
  // CIBLE de l'échange : `to === from` n'en est PAS une (le souffle d'une créature,
  // `noyau/combatManeuvers.emitCreatureAttackAnim`, se poste sous cette forme) — un impact sur soi
  // serait un bruit de touche parasite.
  if (d.to === d.from) return;
  const impact = { to: d.to, result: d.result };
  queueMicrotask(() => bus.emit(EVT.ANIM_IMPACT, impact));
}

/** Installe l'horloge : le premier appel abonne, les suivants comptent seulement ; la dernière
 *  libération désabonne. Renvoie la libération de CET appel (idempotente). */
export function installImpactClock(): () => void {
  installations += 1;
  if (installations === 1) off = bus.on(EVT.ANIM_ATTACK, onAttack);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    installations -= 1;
    if (installations) return;
    off?.();
    off = null;
  };
}

/** Nombre d'installations actives — instrument de garde (double installation = un seul abonnement). */
export function impactClockInstalls(): number {
  return installations;
}
