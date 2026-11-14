import { describe, it, expect } from 'vitest';
import { scanMarcheursDeFlow, marcheurLabel } from '../scripts/guards/lib/marcheursDeFlow.mjs';
import { readCorpus, sAppliqueA } from '../scripts/guards/lib/sourceCorpus.mjs';

/**
 * UN SEUL MARCHEUR DE FLOW (#1874 DoD 4). Exécuter un Flow, c'est `executerFlow` : la marche décide `sequence`
 * et `si`, ses hôtes (`runFlow`, `runCombatFlow`, `runPureFlowLines`, le consommable) ne décident que ce
 * qu'elle leur délègue. Le parcours de TOUT l'arbre (validation, chemins de nœud) est `walkFlow`. Les deux
 * vivent dans le module du Flow, le FOYER ; hors de lui, aucun marcheur, sans exception.
 * Empreinte et angles morts : en tête de `scripts/guards/lib/marcheursDeFlow.mjs`.
 */
const FOYER = 'src/engine/flowCore.ts';
const MARCHE = { foyer: FOYER };

const corpus = () => readCorpus(['src']).map(({ rel, text }) => ({ rel, text }));
const horsFoyer = (fichiers: { rel: string; text: string }[]) =>
  scanMarcheursDeFlow(fichiers.filter((f) => sAppliqueA(f, MARCHE))).map(marcheurLabel);

describe('marcheurs-de-flow-guard — un seul marcheur de Flow (#1874)', () => {
  it('`src/` de production : aucun marcheur de Flow hors du foyer', { timeout: 60_000 }, () => {
    expect(horsFoyer(corpus()), 'étendre l’hôte d’`executerFlow` au lieu d’écrire un marcheur parallèle').toEqual([]);
  });

  it('contrat positif : le foyer porte la marche d’exécution et le parcours', { timeout: 60_000 }, () => {
    const auFoyer = scanMarcheursDeFlow(corpus().filter((f) => f.rel === FOYER)).map((s) => s.fn);
    expect(auFoyer.sort()).toEqual(['executerFlow', 'walkFlow']);
  });
});

describe('marcheurs-de-flow-guard — l’empreinte sépare le MARCHEUR du PRÉDICAT', () => {
  const scan = (text: string, rel = 'src/noyau/x.ts') => horsFoyer([{ rel, text }]);

  it('marcheur à PILE : vu', () => {
    expect(scan([
      'export function marche(flow: Flow): void {',
      '  const stack = [flow];',
      '  while (stack.length) {',
      '    const node = stack.shift()!;',
      "    switch (node.kind) { case 'sequence': stack.unshift(...node.etapes); break; case 'effet': applique(node); break; }",
      '  }',
      '}',
    ].join('\n'))).toEqual(['src/noyau/x.ts [marche]']);
  });

  it('marcheur RÉCURSIF par fermeture interne : vu sous la déclaration de module', () => {
    expect(scan([
      'export function lignes(flow: Flow): string[] {',
      '  const out: string[] = [];',
      "  const walk = (f: Flow): void => { switch (f.kind) { case 'sequence': f.etapes.forEach(walk); break; case 'effet': out.push('x'); break; } };",
      '  walk(flow);',
      '  return out;',
      '}',
    ].join('\n'))).toEqual(['src/noyau/x.ts [lignes]']);
  });

  it('PRÉDICAT (patron `flowHasChoiceSeulement`) : clause `seq` qui rend — non vu', () => {
    expect(scan([
      'function aDesChoix(flow: Flow): boolean {',
      "  switch (flow.kind) { case 'effet': return true; case 'sequence': return flow.etapes.every(aDesChoix); default: return false; }",
      '}',
    ].join('\n'))).toEqual([]);
  });

  it('le foyer est exempt, tout autre module de `src/` est vu', () => {
    const marcheur = "export function m(f: Flow): void { switch (f.kind) { case 'sequence': f.etapes.forEach(m); break; } }";
    expect(scan(marcheur, FOYER)).toEqual([]);
    expect(scan(marcheur, 'src/engine/autre.ts')).toEqual(['src/engine/autre.ts [m]']);
  });
});
