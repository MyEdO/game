import { diseaseLabel, nightStakeRef } from '../data';
import { contractionDue } from '../engine/disease';
import type { Difficulty } from '../engine/types';
import { t } from '../i18n';
import { battleRng } from './battleRng';
import type { CascadeApplier } from './cascade';
import type { Get, Set } from './flowTypes';
import { buildBand, freeCons, resultLines, stepPrecision } from './rollSeam';
import { contracterABord, porteursABord, type PorteurABord } from './shipCrew';
import type { BuiltCascadeStep } from './stepBrand';

export interface ContagionSpec {
  porteurId: string;
  diseaseName: string;
  difficulty: Difficulty;
  nombre: number;
}

/** LDB 20 l.206 ; MDG 14 l.208 */
function bandeDeContagion(
  get: Get,
  porteurs: readonly PorteurABord[],
  id: string,
  diseaseName: string,
  vague: number,
  dues: Iterable<ContagionSpec>,
): BuiltCascadeStep | undefined {
  const rangees = [...dues].flatMap(({ porteurId, difficulty, nombre }) => {
    if (nombre <= 0) return [];
    const aLui = porteurs.find((p) => p.id === porteurId);
    if (!aLui || !contractionDue(aLui.porteur, diseaseName)) return [];
    return [{
      ...aLui.contraction(diseaseName),
      difficulty,
      meta: { contagionRestante: nombre - 1 },
    }];
  });
  if (!rangees.length) return undefined;
  return buildBand(get, {
    id: vague === 0 ? id : `${id}#w${vague}`,
    kind: 'contagion',
    icon: 'medical/infection',
    label: stepPrecision(t('step.contagion'), diseaseLabel(diseaseName)),
    stake: nightStakeRef('contagion'),
    meta: { diseaseName, vagueContagion: vague },
    difficulty: rangees[0].difficulty,
    porteurs: rangees,
  });
}

export function bandesDeContagion(get: Get, set: Set, dues: readonly ContagionSpec[]): BuiltCascadeStep[] {
  if (!dues.length) return [];
  const maladies = new Map<string, Map<string, ContagionSpec>>();
  for (const due of dues) {
    let rangs = maladies.get(due.diseaseName);
    if (!rangs) {
      rangs = new Map();
      maladies.set(due.diseaseName, rangs);
    }
    const precedent = rangs.get(due.porteurId);
    rangs.set(due.porteurId, precedent ? { ...precedent, nombre: precedent.nombre + due.nombre } : due);
  }

  const porteurs = porteursABord(get, set);
  return [...maladies].flatMap(([maladie, rangs]) =>
    bandeDeContagion(get, porteurs, `contagion-${maladie}-${get().gameTime}`, maladie, 0, rangs.values()) ?? []);
}

export const appliquerContagion: CascadeApplier = (get, set, step) => {
  const diseaseName = step.meta?.diseaseName;
  if (typeof diseaseName !== 'string' || !step.participants) return;
  const dues: ContagionSpec[] = [];
  for (const row of step.participants) {
    const verdict = contracterABord(get, set, row, diseaseName, battleRng());
    row.outcome = verdict ? resultLines(freeCons(verdict.lignes)) : [];
    for (const l of row.outcome) get().ecrireAuJournal(l.text);
    const nombre = row.meta?.contagionRestante;
    if (typeof nombre === 'number' && nombre > 0 && row.difficulty) {
      dues.push({ porteurId: row.id, diseaseName, difficulty: row.difficulty, nombre });
    }
  }
  if (!dues.length) return { consequences: [] };
  const vague = Number(step.meta?.vagueContagion ?? 0) + 1;
  const suivante = bandeDeContagion(get, porteursABord(get, set), String(step.id).split('#w')[0], diseaseName, vague, dues);
  return { consequences: [], insert: suivante ? [suivante] : [] };
};
