/**
 * Résolveur de Blessures critiques sur une STRUCTURE de siège (Aux Armes p.120-121) — CODE GÉNÉRIQUE lisant
 * la DONNÉE verbatim (`structure-criticals.json` via `data/structureCriticals`). Module FRÈRE de `shipCritical.ts`
 * (navire) et `critical.ts` (personnage) : il tire le d100 sur la table des Structures et rend une issue
 * STRUCTURÉE et PURE (ne mute rien — l'appelant applique). RAW : « Les Blessures Critiques ont un impact sur
 * une Structure de la même manière que les Blessures Critiques affectent un Personnage » (AA 10 l.114).
 *
 * Réutilisation stricte (pas de mécanique parallèle) :
 *  - les Blessures SUPPLÉMENTAIRES perdues par la Structure sont rendues en **`GameOp`** (`wounds`, mode par
 *    défaut → ignore BE/PA, comme un Critique de personnage), appliquées par `applyOps` ;
 *  - `findTableEntry` pour le lookup d100 (même brique que `critical.ts`/`shipCritical.ts`).
 * Les effets sur les PERSONNES présentes sur/sous la Structure (débris = Bonus d'Endurance, Tests
 * d'Athlétisme, perte de couvert) sont RENDUS verbatim en `note` (la boucle de combat connaît occupants/couvert).
 */
import { d100, type RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';
import type { GameOp } from './ops';
import { STRUCTURE_CRITICALS, type StructureCritEntry } from '../data/structureCriticals';
import { t } from '../i18n';

export interface StructureCriticalResolved {
  entry: StructureCritEntry;
  /** id STABLE du Critique (slug) — pour toute logique/réf ; `label` reste l'affichage. */
  id: string;
  label: string;
  /** Jet d100 effectif. */
  roll: number;
  /** Blessures SUPPLÉMENTAIRES perdues par la Structure, en langue unique `GameOp` (`wounds`, ignore BE/PA).
   *  Vide pour une Blessure Triviale (« T », 0 Blessure) ou un Effondrement (la destruction passe par `destroyed`). */
  ops: GameOp[];
  /** « Effondrement » (96+) : la Structure entière s'écroule → destruction (BRÈCHE côté appelant). */
  destroyed: boolean;
  /** Effets verbatim sur les PERSONNES (débris, Tests d'Athlétisme, couvert) — journalisés, non simulés ici. */
  note: string;
  log: string[];
}

/** Résout un Critique de Structure (AA 10 l.112-127) : tire le d100 sur `STRUCTURE_CRITICALS`, dérive les
 *  Blessures supplémentaires en `GameOp` et le drapeau d'Effondrement. `forcedRoll` = d100 imposé (tests). PUR. */
export function rollStructureCritical(rng: RNG = defaultRNG, forcedRoll?: number): StructureCriticalResolved {
  const roll = forcedRoll ?? d100(rng);
  const entry = findTableEntry(STRUCTURE_CRITICALS, roll);
  const extra = entry.wounds ?? 0;
  // Blessures supplémentaires → op `wounds` en MODE PAR DÉFAUT (ignore BE+PA) : c'est une perte de PB issue de
  // la table de Critiques, pas un coup d'arme. Rien pour une Triviale (0) ni un Effondrement (destruction directe).
  const ops: GameOp[] = !entry.destroyed && extra > 0 ? [{ op: 'wounds', amount: extra }] : [];
  const log = [
    t('structCrit.line', {
      label: entry.label,
      suite: entry.trivial ? t('structCrit.fragTrivial') : extra ? t('structCrit.fragWounds', { n: extra }) : '',
      collapse: entry.destroyed ? t('structCrit.fragCollapse') : '',
    }),
  ];
  return { entry, id: entry.id, label: entry.label, roll, ops, destroyed: !!entry.destroyed, note: entry.note, log };
}

/** Ligne de journal de l'Effondrement d'une Structure (AA 10 l.127) → BRÈCHE franchissable. Construite dans la
 *  couche MOTEUR (comme les `log` de `shipCritical`) pour que la narration ne soit pas un littéral FR brut
 *  dans `state/combatFlow` (garde-fou i18n). */
export function structureCollapseLog(name: string): string {
  return t('structCrit.collapse', { name });
}
