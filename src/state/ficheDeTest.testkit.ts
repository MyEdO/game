/**
 * FICHE DE TEST des Tests nommés (#2779, #1173) : chaque Test de `TESTS_DE_REGLE` repointé sur une
 * compétence, une Difficulté et un libellé autres que ceux de `regles.json`, posée par le seam
 * (`setDataset('regles', …)`) et restaurée à l'identique. Un site qui écrit une valeur de la fiche du
 * jeu au lieu de lire le Test posé diffère d'elle, et rougit.
 */
import { regles, type RegleData } from '../data';
import { setDataset } from '../data/overrides';
import { TESTS_DE_REGLE } from '../engine/ruleRefs';
import type { Difficulty } from '../engine/types';

type Regle = keyof typeof TESTS_DE_REGLE;
type Cle<R extends Regle> = (typeof TESTS_DE_REGLE)[R][number];

export const FICHE_DE_TEST: { [R in Regle]: Record<Cle<R>, [string, Difficulty]> } = {
  course: { courir: ['esquive', 'tresDifficile'] },
  chute: { tenter: ['escalade', 'difficile'] },
  saut: { 'avec-elan': ['natation', 'complexe'], 'sans-elan': ['perception', 'tresDifficile'] },
  fuite: { 'touche-en-fuyant': ['intuition', 'tresDifficile'] },
  'calme-d-approche': { 'se-rapprocher': ['commandement', 'difficile'], 'source-se-rapproche': ['intimidation', 'complexe'] },
  'interruption-de-focalisation': { maintenir: ['charme', 'complexe'] },
  'influences-corruptrices': { physique: ['survie-en-exterieur', 'tresDifficile'], spirituelle: ['ragot', 'difficile'] },
  corrompu: { contenir: ['esquive', 'complexe'] },
};

/** La fiche en vigueur au moment de la pose, rendue par `restaurerFiche` — lue À LA POSE, jamais à
 *  l'import : les fichiers de test partagent leurs modules (`isolate: false`). */
let origine: RegleData[] | null = null;

/** Le Test `cle` de `regle` dans la fiche du jeu : celle d'avant la pose, ou la fiche en vigueur. */
export function testDuJeu<R extends Regle>(regle: R, cle: Cle<R>): [string, Difficulty] {
  const test = (origine ?? regles).find((r) => r.id === regle)!.tests!.find((x) => x.id === cle)!.test;
  return [test.skill.id, test.difficulty];
}

/** Le Test `cle` de `regle` dans la fiche de test : `{ skill, difficulty }`. */
export function testDeFiche<R extends Regle>(regle: R, cle: Cle<R>): { skill: { id: string }; difficulty: Difficulty } {
  const [skill, difficulty] = FICHE_DE_TEST[regle][cle] as [string, Difficulty];
  return { skill: { id: skill }, difficulty };
}

/** Le libellé d'un Test dans la fiche de test. */
export const libelleDeTest = (duJeu: string): string => `${duJeu} (fiche de test)`;

/** Pose la fiche de test au seam. */
export function poserFicheDeTest(): void {
  if (origine) throw new Error('poserFicheDeTest : fiche de test déjà posée, `restaurerFiche` d’abord.');
  const livre = structuredClone([...regles]);
  origine = livre;
  const posees = (Object.keys(FICHE_DE_TEST) as Regle[]).map((regle) => {
    const r = livre.find((x) => x.id === regle)!;
    return { ...r, tests: r.tests!.map((t) => ({ ...t, label: libelleDeTest(t.label), test: { ...t.test, ...testDeFiche(regle as Regle, t.id as never) } })) };
  });
  setDataset('regles', livre.map((r) => posees.find((p) => p.id === r.id) ?? r));
}

/** Restaure la fiche d'avant la pose ; sans pose, ne touche à rien. */
export function restaurerFiche(): void {
  if (!origine) return;
  setDataset('regles', origine);
  origine = null;
}
