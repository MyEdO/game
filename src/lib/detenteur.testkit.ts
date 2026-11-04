/**
 * Détenteur PARESSEUX d'un fichier de test (#1801) : la valeur se bâtit au premier appel du lecteur,
 * se partage entre les cas, et se libère au `afterAll` de la portée qui a appelé `detenteur` (le
 * fichier, ou le `describe` qui l'enveloppe). Sous `isolate: false` (`vite.config.ts`), une valeur
 * tenue en portée de collection sans libération vit autant que le worker : sessions libérées par
 * `scripts/guards/lib/tsProgram.mjs`, garde `src/analyse-retention-guard.test.ts`, qui reconnaît un
 * appel de CETTE primitive, importée depuis ce module, en portée de collection d'un fichier de test.
 *
 * L'appel se fait DANS le fichier de test, à la COLLECTE (portée module ou rappel de `describe`) :
 *  - depuis un `it` ou un hook, l'`afterAll` enregistré ne s'exécute jamais et la valeur survit au
 *    fichier (mesuré vitest 2.1.9, #1801) : la primitive lève à l'appel ;
 *  - depuis un module importé (testkit partagé), l'`afterAll` s'accroche au PREMIER fichier qui
 *    l'importe, et une valeur rebâtie par un fichier suivant survit au worker (mesuré vitest 2.1.9) :
 *    le lecteur retient le fichier en collecte à l'appel et lève s'il est lu depuis un autre.
 */
import { afterAll } from 'vitest';

/** La tâche que le worker Vitest exécute : le fichier pendant sa collecte (sans `result`), la suite
 *  ou le test en cours d'exécution (avec `result`) ; `file` est le fichier de test qui la porte.
 *  État du runner, `vitest/dist/runners.js`. */
type TacheCourante = { type: string; result?: unknown; file?: { filepath: string } } | undefined;
const tacheCourante = (): TacheCourante =>
  (globalThis as { __vitest_worker__?: { current?: TacheCourante } }).__vitest_worker__?.current;

/** L'appel a-t-il lieu pendant la COLLECTE du fichier ? */
export const enCollecte = (): boolean => {
  const tache = tacheCourante();
  return tache?.type === 'suite' && tache.result === undefined;
};

/** Lecteur paresseux de `fabrique`, vidé en `afterAll`. */
export function detenteur<T>(fabrique: () => T, liberer?: (valeur: T) => void): () => T {
  if (!enCollecte())
    throw new Error(
      'detenteur : appel hors de la collecte (dans un `it` ou un hook) — son `afterAll` ne s’exécuterait ' +
        'jamais. Appeler `detenteur` en portée module ou dans le rappel d’un `describe`.',
    );
  const fichier = tacheCourante()?.file?.filepath;
  let tenu: { valeur: T } | undefined;
  afterAll(() => {
    const precedent = tenu;
    tenu = undefined;
    if (precedent) liberer?.(precedent.valeur);
  });
  return () => {
    const ici = tacheCourante()?.file?.filepath;
    if (ici !== fichier)
      throw new Error(
        `detenteur : lecteur créé à la collecte de ${fichier}, lu depuis ${ici} — son \`afterAll\` ne ` +
          'libérerait pas ce fichier-ci. Appeler `detenteur` dans le fichier de test qui le lit.',
      );
    return (tenu ??= { valeur: fabrique() }).valeur;
  };
}
