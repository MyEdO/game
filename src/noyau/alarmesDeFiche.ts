/**
 * Les ALARMES de la fiche d'un héros et la règle d'atterrissage qu'elles servent (§3.2 design v4, #492) :
 * l'apparition d'une affliction NOUVELLE (empreinte jamais vue) ouvre la fiche sur l'onglet État. L'hôte
 * garde l'empreinte DÉJÀ VUE par héros, état d'écran éphémère jamais sérialisé (`sheetAlarmsSeen` du store
 * web) ; la projection, l'empreinte et le verdict viennent d'ici.
 */
import type { Combatant } from '../engine/types';
import { maxEncumbrance, totalEncumbrance } from '../engine/items';
import { diseaseLabel } from '../data';
import { isPsychAfflictionActive } from '../engine/psychology';
import { identiteDeCiblage, libelleDePsy, type NomDIndividu } from '../engine/psych/ciblage';

/** Une affliction du héros : `key` d'identité, `label` porteur du compte ou du degré. */
export interface SheetAlarm {
  key: string;
  label: string;
}

/** Afflictions du héros pour la règle d'atterrissage. Ne porte JAMAIS Blessures ni États bénins (déjà sur
 *  les vitals et les chips d'effets actifs). Le `label` inclut le compte ou le degré : sa variation (une
 *  Corruption qui monte, une Séquelle de plus) compte comme une affliction nouvelle. Le `label` d'une
 *  affliction ciblée nomme sa Cible (`libelleDePsy`, l'individu par `nomDIndividu`). */
export function sheetAlarms(hero: Combatant, nomDIndividu?: NomDIndividu): SheetAlarm[] {
  const out: SheetAlarm[] = [];

  const criticals = hero.criticalWounds ?? 0; // ACTIF (décompté au soin) — pas l'historique `critEntriesSuffered`
  if (criticals > 0) out.push({ key: 'critiques', label: `Critiques ${criticals}` });

  const corruption = hero.corruption ?? 0;
  if (corruption > 0) out.push({ key: 'corruption', label: `Corruption ${corruption}${hero.damned ? ' — DAMNÉ' : ''}` });

  for (const d of hero.diseases ?? []) {
    // `d.id` = id STABLE (`diseaseDefs()`), jamais l'affichage — `diseaseLabel` résout (repli sur l'id).
    out.push({ key: `maladie-${d.id}`, label: diseaseLabel(d.id) });
  }

  const mutationList = hero.mutations ?? [];
  if (mutationList.length > 0) out.push({ key: 'mutations', label: `Mutations ${mutationList.length}` });

  // Traumas COSMÉTIQUES (cicatrices, `cosmetic:true`) exclus — Blessure d'origine déjà guérie (types.ts:769-772).
  const activeTraumasList = (hero.traumas ?? []).filter((t) => !t.cosmetic);
  if (activeTraumasList.length > 0) out.push({ key: 'traumas', label: `Séquelles ${activeTraumasList.length}` });

  for (const p of hero.psychState ?? []) {
    if (!isPsychAfflictionActive(p)) continue;
    out.push({ key: `psych-${identiteDeCiblage(p.type, p.cible)}`, label: libelleDePsy(p.type, p.cible, nomDIndividu) });
  }

  if (totalEncumbrance(hero) > maxEncumbrance(hero)) out.push({ key: 'surcharge', label: 'Surchargé' });

  return out;
}

/** Empreinte STABLE d'une liste d'alarmes (keys+labels joints, triés) : compare deux relevés
 *  indépendamment de l'ordre de production. */
export function alarmsFingerprint(alarms: SheetAlarm[]): string {
  return alarms
    .map((a) => `${a.key}:${a.label}`)
    .sort()
    .join('|');
}

/** L'empreinte des alarmes courantes du héros, celle que l'hôte retient comme VUE. */
export const empreinteDeFiche = (hero: Combatant, nomDIndividu?: NomDIndividu): string =>
  alarmsFingerprint(sheetAlarms(hero, nomDIndividu));

/** La fiche s'ouvre-t-elle sur l'onglet État ? Oui ssi le héros porte une alarme et que leur empreinte
 *  diffère de l'empreinte `vue` (absente = jamais vue). */
export function atterritSurEtat(hero: Combatant, vue: string | undefined, nomDIndividu?: NomDIndividu): boolean {
  const alarmes = sheetAlarms(hero, nomDIndividu);
  return alarmes.length > 0 && alarmsFingerprint(alarmes) !== vue;
}
