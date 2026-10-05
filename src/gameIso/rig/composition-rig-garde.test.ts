/**
 * GARDE (#2097, A7) : une surface React qui compose un rig passe par `useCompositionRig`
 * (`composeRig.tsx`), abonné à la version des catalogues. Aucun `.tsx` de `src/` n'appelle
 * `rigComposition(` ni `resolveRig(` hors de `composeRig.tsx`, qui porte le hook.
 */
import { describe, expect, it } from 'vitest';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';

const PORTEUR = 'src/gameIso/rig/composeRig.tsx';
const APPEL_DIRECT = /\b(?:rigComposition|resolveRig)\(/;
const DECLARATION = /\bfunction\s+(?:rigComposition|resolveRig)\(/;

/** Lignes (1-based) d'un source `.tsx` qui appellent directement, hors déclarations et commentaires. */
function appelsDirects(source: string): number[] {
  return source.split(/\r?\n/).flatMap((ligne, i) => {
    const code = ligne.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
    return APPEL_DIRECT.test(code) && !DECLARATION.test(code) ? [i + 1] : [];
  });
}

const COMPOSANTS = readCorpus(['src'], { exts: ['.tsx'] });

describe('surfaces React : composition de rig par `useCompositionRig` seulement', () => {
  it('aucun composant `.tsx` n’appelle `rigComposition(` ni `resolveRig(` hors du porteur du hook', () => {
    const fautes = COMPOSANTS.filter((f) => f.rel !== PORTEUR).flatMap((f) => appelsDirects(f.text).map((l) => `${f.rel}:${l}`));
    expect(fautes).toEqual([]);
  });

  it('témoins : la garde voit un appel direct, ignore un commentaire et une déclaration, et le porteur en contient un', () => {
    expect(appelsDirects('function Neuve() {\n  const comp = rigComposition(a, e);\n}')).toEqual([2]);
    expect(appelsDirects('function Neuve() {\n  return resolveRig(a, e, {});\n}')).toEqual([2]);
    expect(appelsDirects('// rigComposition(a, e)\nexport function rigComposition(\n')).toEqual([]);
    const porteur = COMPOSANTS.find((f) => f.rel === PORTEUR);
    expect(porteur, 'PRÉMISSE : le porteur du hook est dans le corpus').toBeDefined();
    expect(appelsDirects(porteur!.text).length).toBeGreaterThan(0);
  });
});
