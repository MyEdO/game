import type { PoseDuGabarit } from './gabarit.ts';

interface PositionDuGabarit<P> {
  y: number;
  clone(): P;
  copy(position: P): unknown;
}

interface MatriceDuGabarit<M> {
  clone(): M;
  copy(matrice: M): unknown;
  invert(): M;
  multiply(matrice: M): M;
}

interface NoeudDuGabarit<M, P> {
  readonly name: string;
  readonly isBone?: boolean;
  readonly parent: NoeudDuGabarit<M, P> | null;
  readonly children: readonly NoeudDuGabarit<M, P>[];
  readonly position: P;
  readonly matrix: M;
  readonly matrixWorld: M;
  matrixWorldNeedsUpdate: boolean;
  traverse(visiter: (noeud: NoeudDuGabarit<M, P>) => void): void;
  updateMatrixWorld(force: boolean): void;
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function poserEnfantsDuGabarit(enfants: readonly (readonly [{ readonly position: { y: number } }, number])[]): void {
  for (const [enfant, facteur] of enfants) enfant.position.y *= facteur;
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function enfantsDuGabarit<E extends { readonly position: { y: number }; readonly isBone?: boolean }>(
  pose: Pick<PoseDuGabarit, 'enfantsDe'>, trouver: (nom: string) => { readonly children: readonly E[] },
): readonly (readonly [E, number])[] {
  return Object.entries(pose.enfantsDe).flatMap(([nom, facteur]) =>
    trouver(nom).children.filter((enfant) => enfant.isBone === true).map((enfant) => [enfant, facteur] as const));
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function bindsAuGabarit<M extends MatriceDuGabarit<M>, P extends PositionDuGabarit<P>>(
  squelette: { readonly bones: readonly NoeudDuGabarit<M, P>[]; readonly boneInverses: readonly M[] },
  pose: Pick<PoseDuGabarit, 'enfantsDe'>,
): M[] {
  const enfants = enfantsDuGabarit(pose, (nom) => {
    const b = squelette.bones.find((b) => b.name === nom);
    if (!b) throw new Error(`gabarit : ${nom} n’est pas un os du squelette`);
    return b;
  });
  const racines = new Set(squelette.bones.map((b) => {
    let racine = b;
    while (racine.parent) racine = racine.parent;
    return racine;
  }));
  const matrices = new Map<NoeudDuGabarit<M, P>, { locale: M; monde: M; aMettreAJour: boolean }>();
  for (const racine of racines) racine.traverse((n) => matrices.set(n, { locale: n.matrix.clone(), monde: n.matrixWorld.clone(), aMettreAJour: n.matrixWorldNeedsUpdate }));
  const positions = enfants.map(([enfant]) => enfant.position.clone());
  try {
    for (const racine of racines) racine.updateMatrixWorld(true);
    const repos = squelette.bones.map((b) => b.matrixWorld.clone());
    poserEnfantsDuGabarit(enfants);
    for (const racine of racines) racine.updateMatrixWorld(true);
    return squelette.bones.map((b, i) => b.matrixWorld.clone().invert().multiply(repos[i]).multiply(squelette.boneInverses[i]));
  } finally {
    enfants.forEach(([enfant], i) => enfant.position.copy(positions[i]));
    for (const [n, matrice] of matrices) {
      n.matrix.copy(matrice.locale);
      n.matrixWorld.copy(matrice.monde);
      n.matrixWorldNeedsUpdate = matrice.aMettreAJour;
    }
  }
}
