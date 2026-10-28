import { Combatant } from '../engine/types';
import { maxEncumbrance, totalEncumbrance } from '../engine/items';
import { diseaseLabel, psychologyLabel } from '../data';
import { isPsychAfflictionActive } from '../engine/psychology';

/** ids STABLES des rubriques de l'onglet État — ancres de scroll RENDUES par `EtatPanel.tsx`.
 *  (La Corruption est une jauge de la bande Constitution, pas une Section : elle n'en reçoit pas.) */
export const ETAT_ANCHOR_CRITIQUES = 'etat-critiques';
export const ETAT_ANCHOR_MALADIES = 'etat-maladies';
export const ETAT_ANCHOR_MUTATIONS = 'etat-mutations';
export const ETAT_ANCHOR_TRAUMAS = 'etat-traumas';
export const ETAT_ANCHOR_PSYCHOLOGIE = 'etat-psychologie';
export const ETAT_ANCHOR_ENCOMBREMENT = 'etat-encombrement';

/** Une affliction du héros, réduite à ce qui sert la RÈGLE D'ATTERRISSAGE (`key` d'identité + `label`
 *  porteur du compte/degré) : `alarmsFingerprint` ne lit que ces deux champs. L'AFFICHAGE (aside) ne
 *  passe plus par ici — il compose la primitive d'effets actifs des portraits (`EffectChips`). */
export interface SheetAlarm {
  key: string;
  label: string;
}

/** Afflictions du héros pour la RÈGLE D'ATTERRISSAGE (§3.2 design v4, #492) : l'apparition d'une
 *  affliction NOUVELLE (empreinte jamais vue) force l'onglet État à la première ouverture de la fiche.
 *  Ne porte JAMAIS Blessures/États bénins (déjà sur les vitals + les chips d'effets actifs de l'aside).
 *  Le `label` inclut le compte/degré : sa variation (une Corruption qui monte, une Séquelle de plus)
 *  compte comme une affliction nouvelle. */
export function sheetAlarms(hero: Combatant): SheetAlarm[] {
  const out: SheetAlarm[] = [];

  const criticals = hero.criticalWounds ?? 0; // ACTIF (décompté au soin) — pas l'historique `critEntriesSuffered`
  if (criticals > 0) out.push({ key: 'critiques', label: `Critiques ${criticals}` });

  const corruption = hero.corruption ?? 0;
  if (corruption > 0) out.push({ key: 'corruption', label: `Corruption ${corruption}${hero.damned ? ' — DAMNÉ' : ''}` });

  for (const d of hero.diseases ?? []) {
    // `d.name` = id STABLE (`diseaseDefs()`), jamais l'affichage — `diseaseLabel` résout (repli sur l'id).
    out.push({ key: `maladie-${d.id}`, label: diseaseLabel(d.id) });
  }

  const mutationList = hero.mutations ?? [];
  if (mutationList.length > 0) out.push({ key: 'mutations', label: `Mutations ${mutationList.length}` });

  // Traumas COSMÉTIQUES (cicatrices, `cosmetic:true`) exclus — Blessure d'origine déjà guérie (types.ts:769-772).
  const activeTraumasList = (hero.traumas ?? []).filter((t) => !t.cosmetic);
  if (activeTraumasList.length > 0) out.push({ key: 'traumas', label: `Séquelles ${activeTraumasList.length}` });

  for (const p of hero.psychState ?? []) {
    if (!isPsychAfflictionActive(p)) continue;
    out.push({ key: `psych-${p.type}-${p.cible ?? ''}`, label: psychologyLabel(p.type) });
  }

  if (totalEncumbrance(hero) > maxEncumbrance(hero)) out.push({ key: 'surcharge', label: 'Surchargé' });

  return out;
}

/** Empreinte STABLE d'une liste d'alarmes (keys+labels joints, triés) — compare deux relevés
 *  indépendamment de l'ordre de production ; sert la règle d'atterrissage (`sheetAlarmsSeen`). */
export function alarmsFingerprint(alarms: SheetAlarm[]): string {
  return alarms
    .map((a) => `${a.key}:${a.label}`)
    .sort()
    .join('|');
}
