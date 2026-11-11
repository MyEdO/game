/**
 * PROGRÈS d'un Test ÉTENDU après son jet (LDB 12 l.170-185) : UNE fonction par flux, lue par le geste qui
 * l'applique ET par la fenêtre qui l'annonce. Le pas est `extendedTestStep`.
 */
import type { PendingReload, PendingDispel, PendingFocus, BatchParticipant } from './pendings';
import type { PendingActivity } from './interludeFlow';
import { estJete, extendedTestStep, extendedTestSteps } from '../engine/tests';
import { reloadDRBonus } from '../engine/combatFeatures/dispatch';
import { pasDePeur } from '../engine/psychology';
import { dispelOwnSpellDR } from '../engine/magic';
import type { Combatant, Weapon } from '../engine/types';

/** L'arme que recharge `pr` aux mains de son `tireur` (`weaponUid` vide : l'arme sans objet, LDB 62 l.335). */
export function armeDuJetDeRecharge(pr: PendingReload, tireur: Combatant): Weapon | undefined {
  return tireur.weapons.find((w) => (w.uid ?? '') === pr.weaponUid);
}

/** Progrès d'un Rechargement après son jet : DR du jet + `reloadDRBonus` du tireur, vers la cible
 *  BAKÉE du pending (`pr.reload`). Lu par `jetValider('rechargement')` (arme et poste) et par la fenêtre.
 *  LDB 62 l.335 ; LDB 12 l.170-185 ; MDG 12 l.462 */
export function progresDeRecharge(pr: PendingReload, tireur: Combatant | undefined): ReturnType<typeof extendedTestStep> {
  const talent = pr.success && tireur ? reloadDRBonus(tireur, armeDuJetDeRecharge(pr, tireur)) : 0;
  return extendedTestStep(pr.progressBefore, { success: pr.success, sl: pr.sl + talent }, pr.reload);
}

/** Progrès d'une Dissipation après son jet, depuis le cumul du lanceur sur CE Sort. Lu par
 *  `jetValider('dissipation')` et par la fenêtre. LDB 46 l.160 ; VDM 02 l.182-186 ; LDB 12 l.170-185 */
export function progresDeDissipation(pd: PendingDispel, lanceur: Combatant): { prev: number; sl: number; step: ReturnType<typeof extendedTestStep> | null } {
  const prev = lanceur.dispel?.spellId === pd.spellId && lanceur.dispel.spellCasterId === pd.spellCasterId ? lanceur.dispel.total : 0;
  if (!pd.result) return { prev, sl: 0, step: null };
  const sl = pd.result.sl + dispelOwnSpellDR(pd.spellCasterId === pd.casterId);
  return { prev, sl, step: extendedTestStep(prev, { success: pd.result.success, sl }, pd.ni) };
}

/** Barre de DR d'une RANGÉE à Test étendu (Peur de combat, cartographie de voyage) : cumul APRÈS son
 *  jet par le pas que son résolveur applique, borné à la cible. Cumul propre : `pasDePeur` (Sans Peur de
 *  la rangée compris). Cumul COMMUN (`extendedDrPartage`) : les jets des rangées qui la précèdent dans
 *  `bande`, puis le sien, comme `etapeBilan`. LDB 12 l.170-185 ; LDB 21 l.25 ; LDB 10 l.1051 ; EDOC 8 l.161 */
export function cumulEtenduDeRangee(part: BatchParticipant, bande: readonly BatchParticipant[]): { cum: number; target: number } | undefined {
  const target = part.extendedDrTarget;
  if (target == null) return undefined;
  const avant = part.extendedDrDone ?? 0;
  if (part.extendedDrPartage) {
    const rangees = bande.slice(0, bande.indexOf(part) + 1).filter((p) => p.extendedDrPartage);
    const jets = rangees.map((p) => p.result).filter((r) => estJete(r));
    return { cum: Math.min(extendedTestSteps(avant, jets, target).total, target), target };
  }
  if (!estJete(part.result)) return { cum: avant, target };
  return { cum: Math.min(pasDePeur(avant, part.result, target, !!part.meta?.sansPeur).calmeDR, target), target };
}

/** Progrès d'une Activité à Test étendu (Artisanat, Rituel) après son jet, `null` sans cible. Lu par le
 *  résolveur (`interludeFlow`), la narration et la fenêtre. LDB 23 l.78, l.102 ; VDM 02 l.777 ; LDB 12 l.170-185 */
export function progresDActivite(pa: PendingActivity): (ReturnType<typeof extendedTestStep> & { cible: number }) | null {
  if (pa.drTarget == null) return null;
  return { ...extendedTestStep(pa.drBefore ?? 0, { success: !!pa.success, sl: pa.sl }, pa.drTarget), cible: pa.drTarget };
}

/** Progrès d'une Focalisation après son jet, depuis la réserve du lanceur sur CE Sort, vers son NI : une
 *  réussite cumule son `dr`, un échec son DR brut. Lu par `jetValider('focalisation')` et par la fenêtre.
 *  LDB 46 l.130 ; VDM 02 l.131 ; LDB 12 l.170-185 */
export function progresDeFocalisation(pf: PendingFocus, lanceur: Combatant, ni: number): { prev: number; step: ReturnType<typeof extendedTestStep> | null } {
  const prev = lanceur.focus?.spell === pf.spellId ? lanceur.focus.dr : 0;
  const r = pf.result;
  if (!r) return { prev, step: null };
  return { prev, step: extendedTestStep(prev, { success: r.success, sl: r.success ? r.dr : r.sl ?? 0 }, ni) };
}
