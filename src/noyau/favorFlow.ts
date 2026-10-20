/**
 * Système de Faveurs (LDB 23 l.139-151, « FAITES-MOI UNE FAVEUR ! ») — TRANSVERSAL : contrepartie
 * future acceptée en échange d'une aide immédiate (Activité à contrepartie — Consulter un expert,
 * l.120 — ou événement du Tableau — « Allié inculpé », LDB 22 l.10-12 — ou authoring de scène,
 * Effet `grantFavor`), acquittée par Activités (Mineure : 1, l.147 ; Majeure : 2+ consécutives,
 * l.149) ou jamais par Activité (Importante, l.151 — « jouées comme des aventures complètes »),
 * et rompable au prix d'un Niveau de Carrière (l.141, canal existant `interludeEnd`).
 */
import type { Get, Set } from './flowTypes';
import { rule } from '../engine/policy';
import { favorRequiredActivities, type Favor, type FavorLevel } from '../engine/favor';
import { t } from '../i18n';

let favorSeq = 0;
function newFavorId(): string {
  favorSeq += 1;
  return `favor-${Date.now().toString(36)}-${favorSeq}`;
}

/** Crée une Faveur — primitive de création UNIQUE (contrepartie d'Activité/événement du Tableau,
 *  ou Effet d'éditeur `grantFavor`). */
export function grantFavor(get: Get, set: Set, heroId: string, level: FavorLevel, owedTo: string, desc: string): Favor {
  const favor: Favor = { id: newFavorId(), heroId, level, owedTo, desc, progress: 0 };
  set({ favors: [...(get().favors ?? []), favor] });
  const h = get().party.find((x) => x.id === heroId);
  get().log(t('favor.granted', { name: h?.label ?? heroId, level, owedTo }));
  return favor;
}

/** « Acquitter une Faveur » (l.147/149) : consomme UNE Activité d'interlude du héros, avance
 *  `progress` — Faveur retirée dès le seuil du Niveau atteint. Importante : jamais acquittable
 *  par Activité (l.151) — no-op défensif (l'UI ne propose pas ce chemin). */
export function settleFavorActivity(get: Get, set: Set, heroId: string, favorId: string): void {
  const itl = get().interlude;
  const st = itl?.perHero[heroId];
  const h = get().party.find((x) => x.id === heroId);
  const favor = (get().favors ?? []).find((f) => f.id === favorId && f.heroId === heroId);
  if (!itl || !st || !h || st.left <= 0 || !favor) return;
  const required = favorRequiredActivities(favor.level);
  if (required == null) return;
  const progress = favor.progress + 1;
  const done = progress >= required;
  set({
    favors: done
      ? (get().favors ?? []).filter((f) => f.id !== favorId)
      : (get().favors ?? []).map((f) => (f.id === favorId ? { ...f, progress } : f)),
  });
  itl.perHero[heroId] = { ...st, left: st.left - 1, favorProgress: [...(st.favorProgress ?? []), favorId] };
  set({ interlude: { ...itl } });
  get().log(done
    ? t('favor.settled', { name: h.label, level: favor.level, owedTo: favor.owedTo })
    : t('favor.progressed', { name: h.label, level: favor.level, owedTo: favor.owedTo, progress, required }));
}

/** Remet à 0 la progression des Faveurs qui n'ont PAS reçu d'Activité cet interlude — appelé par
 *  `interludeEnd`, AVANT que l'interlude ne soit refermé. « Activités consécutives » est RAW
 *  (LDB 23 l.149) ; la rupture par CHOIX SEUL est maison (#509 ; arbitrage utilisateur 2026-08-03,
 *  verbatim au ticket #1040) [entériné 2026-08-03] : la chaîne ne casse que si le héros AVAIT au
 *  moins un emplacement d'Activité cet interlude (`InterludeHeroState.granted`) et ne l'a pas
 *  consacré à la Faveur. Un interlude qui ne lui en octroie AUCUN (événement, devoir elfique) ne
 *  rompt rien. */
export function resetInterruptedFavorProgress(get: Get, set: Set): void {
  const itl = get().interlude;
  if (!itl) return;
  const favors = get().favors ?? [];
  let changed = false;
  const next = favors.map((f) => {
    if (f.progress <= 0) return f;
    const st = itl.perHero[f.heroId];
    if (st?.favorProgress?.includes(f.id)) return f;
    if ((st?.granted ?? 0) <= 0) return f;
    changed = true;
    return { ...f, progress: 0 };
  });
  if (changed) set({ favors: next });
}

/** Rompt une Faveur (choix explicite du joueur, avec confirmation côté UI) — « votre Niveau est
 *  toujours réduit de 1, jusqu'à un minimum de 0, si la rumeur de la perfidie se répand » (l.141).
 *  La source (l.141) ne modélise aucune mécanique de propagation de rumeur (silence total) :
 *  arbitrage maison [entériné 2026-08-03] paramétrable (`favor-rumor-spreads`, défaut actif
 *  — au plus simple, la rumeur se répand toujours ; #509). */
export function breakFavor(get: Get, set: Set, heroId: string, favorId: string): void {
  const favor = (get().favors ?? []).find((f) => f.id === favorId && f.heroId === heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!favor || !h) return;
  set({ favors: (get().favors ?? []).filter((f) => f.id !== favorId) });
  if (rule('favor-rumor-spreads')) {
    h.careerLevel = Math.max(0, (h.careerLevel ?? 1) - 1);
    set({ party: [...get().party] });
    get().log(t('favor.brokenRumor', { name: h.label, level: favor.level, owedTo: favor.owedTo, lvl: h.careerLevel }));
  } else {
    get().log(t('favor.brokenSilent', { name: h.label, level: favor.level, owedTo: favor.owedTo }));
  }
}
