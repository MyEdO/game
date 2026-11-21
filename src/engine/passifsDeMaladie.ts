import { findSymptomById, SYMPTOM_SEVERITIES } from '../data';
import type { DiseaseSymptom } from '../data/schemas/defs/maladies';
import type { Disease } from './disease';
import type { GameOp, OpPassive, PassiveMod } from './ops';
import type { CodexTarget } from './ruleRefs';
import { sourceSuspended } from './suspension';
import type { Combatant } from './types';

/** LDB 20 l.12-13 */
export const maladieDeclaree = (d: Pick<Disease, 'phase'>): boolean => d.phase === 'active';

/** LDB 20 l.157 */
export function symptomPassive(inst: DiseaseSymptom, severity: 'moderee' | 'grave' | undefined = inst.severity): OpPassive[] {
  const s = findSymptomById(inst.symptomId);
  if (!s) return [];
  const out: OpPassive[] = [...(s.passive ?? [])];
  if (!severity) return out;
  for (const palier of SYMPTOM_SEVERITIES) {
    for (const op of s.passiveBySeverity?.[palier] ?? []) {
      const i = out.findIndex((o) => memeCible(o, op));
      if (i >= 0) out[i] = op;
      else out.push(op);
    }
    if (palier === severity) break;
  }
  return out;
}

/** Deux ops de magnitude visent-elles la MÊME Caractéristique (palier ABSOLU, `symptomPassive`) ? */
function memeCible(a: GameOp, b: GameOp): boolean {
  return (a.op === 'testMod' || a.op === 'charMod') && a.op === b.op && a.characteristic != null && a.characteristic === (b as typeof a).characteristic;
}

/** Identité Codex d'un symptôme — forme SOURCE du mécanisme général de suspension. */
export const srcSymptome = (symptomId: string): CodexTarget => ({ category: 'symptoms', id: symptomId });

/** Le symptôme `symptomId` est-il SUSPENDU chez `c` ? SPÉCIALISATION mince de `sourceSuspended`
 *  (`engine/suspension.ts`) : ses canaux `passive`/`onTick` sont ignorés tant que l'effet dure ;
 *  restitués d'office à l'expiration (l'effet quitte la liste). */
export function symptomSuppressed(c: Combatant, symptomId: string): boolean {
  return sourceSuspended(c, srcSymptome(symptomId));
}

const ECHELON_INFERIEUR: Record<'moderee' | 'grave', 'moderee' | undefined> = { grave: 'moderee', moderee: undefined };

/** Nombre d'ÉCHELONS d'atténuation ACTIFS sur l'instance `symptomId` de `diseaseId` — un par effet
 *  `attenuatedSymptom` en cours (op `attenuateSymptom`, dose UNIQUE : 0 ou 1). Miroir de `symptomSuppressed`. */
export function attenuationEchelons(c: Combatant, diseaseId: string, symptomId: string): number {
  return (c.activeEffects ?? []).filter((e) => !!e.attenuatedSymptom && e.attenuatedSymptom.disease === diseaseId && e.attenuatedSymptom.symptomId === symptomId).length;
}

/** LDB 20 l.159 */
export function severiteEffective(c: Combatant, diseaseId: string, inst: DiseaseSymptom): 'moderee' | 'grave' | undefined {
  let sev = inst.severity;
  for (let n = attenuationEchelons(c, diseaseId, inst.symptomId); n > 0 && sev; n--) sev = ECHELON_INFERIEUR[sev];
  return sev;
}

/** Passifs de TOUTES les maladies ACTIVES (collecte unifiée, reprise telle quelle par `passiveMods`).
 *  Un symptôme SUSPENDU (`suppressSymptom`) n'émet rien. Les `visiblePassive` (Vers du Reik −10 Soc) ne
 *  s'émettent que si la lésion tirée (`blisterLocation`) est dans les `visibleLocations` `maison` du symptôme.
 *  Chaque op sort emballée en `PassiveMod` kind `maladie`, `src` = le SYMPTÔME émetteur : c'est lui qui
 *  nomme la pénalité à l'écran (« −20 Crampes abdominales »), jamais un « Maladie » générique. */
export function diseasePassiveOps(c: Combatant): PassiveMod[] {
  const out: PassiveMod[] = [];
  for (const dz of (c.diseases ?? []).filter(maladieDeclaree)) {
    for (const inst of dz.symptoms) {
      if (symptomSuppressed(c, inst.symptomId)) continue;
      const src = { category: 'symptoms', id: inst.symptomId };
      for (const op of symptomPassive(inst, severiteEffective(c, dz.id, inst))) out.push({ op, kind: 'maladie', src });
      const sd = findSymptomById(inst.symptomId);
      if (sd?.visiblePassive?.length && dz.blisterLocation && (sd.visibleLocations ?? []).includes(dz.blisterLocation)) {
        for (const op of sd.visiblePassive) out.push({ op, kind: 'maladie', src, visible: true });
      }
    }
  }
  return out;
}
