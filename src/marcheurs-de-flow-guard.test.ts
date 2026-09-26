import { describe, it, expect } from 'vitest';
import { scanMarcheursDeFlow, marcheurLabel } from '../scripts/guards/lib/marcheursDeFlow.mjs';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';

/**
 * CLIQUET des marcheurs de Flow sous `src/state` (#1874, ticket § Lot B : « posé avec C0 à 4, cible 1 »).
 * Empreinte, critère et angles morts : en tête de `scripts/guards/lib/marcheursDeFlow.mjs`.
 *
 * Le PLAFOND vit ICI, jamais dans la lib (`scripts/guards/lib/stock.mjs`, INTERDITS). Il se tient à
 * l'ÉGALITÉ : un marcheur fusionné fait rougir la garde jusqu'à ce que le plafond descende dans le
 * même geste.
 */
const PLAFOND = 4;

const marcheursReels = (): string[] =>
  scanMarcheursDeFlow(readCorpus(['src/state']).map(({ rel, text }) => ({ rel, text }))).map(marcheurLabel);

describe('cliquet `marcheursDeFlow` — un seul marcheur de Flow à terme (#1874)', () => {
  it(`au plus ${PLAFOND} marcheurs sous \`src/state\`, et le plafond suit la baisse`, () => {
    const vus = marcheursReels();
    expect(
      vus.length,
      `marcheurs mesurés :\n  ${vus.join('\n  ')}\n`
      + (vus.length > PLAFOND
        ? 'un marcheur de Flow NEUF : étendre un marcheur existant au lieu d’en écrire un parallèle.'
        : `un marcheur a disparu : abaisser PLAFOND à ${vus.length} dans ce fichier.`),
    ).toBe(PLAFOND);
  });
});

describe('cliquet `marcheursDeFlow` — l’empreinte sépare le MARCHEUR du PRÉDICAT', () => {
  const scan = (text: string) => scanMarcheursDeFlow([{ rel: 'src/state/x.ts', text }]).map(marcheurLabel);

  it('marcheur à PILE (patron `runFlow`) : vu', () => {
    expect(scan([
      'export function marche(flow: Flow): void {',
      '  const stack = [flow];',
      '  while (stack.length) {',
      '    const node = stack.shift()!;',
      "    switch (node.kind) { case 'seq': stack.unshift(...node.steps); break; case 'do': applique(node); break; }",
      '  }',
      '}',
    ].join('\n'))).toEqual(['src/state/x.ts [marche]']);
  });

  it('marcheur RÉCURSIF par fermeture interne (patron `runPureFlowLines`) : vu sous la déclaration de module', () => {
    expect(scan([
      'export function lignes(flow: Flow): string[] {',
      '  const out: string[] = [];',
      "  const walk = (f: Flow): void => { switch (f.kind) { case 'seq': f.steps.forEach(walk); break; case 'do': out.push('x'); break; } };",
      '  walk(flow);',
      '  return out;',
      '}',
    ].join('\n'))).toEqual(['src/state/x.ts [lignes]']);
  });

  it('PRÉDICAT (patron `flowHasChoiceSeulement`) : clause `seq` qui rend — non vu', () => {
    expect(scan([
      'function aDesChoix(flow: Flow): boolean {',
      "  switch (flow.kind) { case 'do': return true; case 'seq': return flow.steps.every(aDesChoix); default: return false; }",
      '}',
    ].join('\n'))).toEqual([]);
  });

  it('un 5ᵉ marcheur fait ROUGIR le cliquet', () => {
    const corpus = readCorpus(['src/state']).map(({ rel, text }) => ({ rel, text }));
    const cinquieme = {
      rel: 'src/state/cinquieme.ts',
      text: "export function cinquieme(f: Flow): void { switch (f.kind) { case 'seq': f.steps.forEach(cinquieme); break; } }",
    };
    expect(scanMarcheursDeFlow([...corpus, cinquieme]).length, 'le 5ᵉ marcheur n’est pas vu').toBe(PLAFOND + 1);
  });
});
