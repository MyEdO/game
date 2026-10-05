/**
 * GARDE ABSOLUE (#2219) — tout drapeau LU par un paquet livré a son PRODUCTEUR (`setFlag`) dans ce paquet.
 *
 * Lecteurs : `when` des lieux et des routes de la carte, `when` de la clôture, `when` des déclencheurs,
 * conditions des dialogues (`when` des choix, `if` de leurs flows). Le parse de `expr` est celui du
 * moteur (`flagTerms`, `src/engine/flowCore.ts`). Skill `adapter-une-campagne`, étape 7.
 *
 * ABSOLUE : aucun stock, aucune exemption — la garde NOMME ses sites.
 */
import { describe, it, expect } from 'vitest';
import { listerProjetsLivres } from '../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../scripts/source/projetLivre.mjs';
import { parseProject } from '../state/worldMap';
import { flagTerms } from '../engine/flowCore';
import type { ProjectDoc } from '../state/worldMap';

type Paquet = Omit<ProjectDoc, 'schema'>;

/** Drapeaux NOMMÉS par toute Condition `flag` sous `x`, à toute profondeur. */
function lus(x: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(x)) x.forEach((v) => lus(v, out));
  else if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (o.kind === 'flag' && typeof o.expr === 'string') for (const t of flagTerms(o.expr)) out.add(t.flag);
    Object.values(o).forEach((v) => lus(v, out));
  }
  return out;
}

/** Drapeaux POSÉS par un Effet `setFlag`, n'importe où sous `x`. */
function poses(x: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(x)) x.forEach((v) => poses(v, out));
  else if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (o.type === 'setFlag' && typeof o.flag === 'string') out.add(o.flag);
    Object.values(o).forEach((v) => poses(v, out));
  }
  return out;
}

/** Sites LECTEURS d'un paquet, chacun nommé. */
function lecteurs(p: Paquet): [string, unknown][] {
  return [
    ...(p.worldMap?.places ?? []).map((l): [string, unknown] => [`carte › lieu ${l.id}`, l.when]),
    ...(p.worldMap?.routes ?? []).map((r): [string, unknown] => [`carte › route ${r.id}`, r.when]),
    ['narratif › clôture', p.narratif?.cloture?.when],
    ...p.scenes.flatMap((s) => [
      ...(s.triggers ?? []).map((t): [string, unknown] => [`${s.id} › déclencheur ${t.id}`, t.when]),
      ...(s.dialogues ?? []).map((d): [string, unknown] => [`${s.id} › dialogue ${d.id}`, d.nodes]),
    ]),
  ];
}

/** `site : drapeau` pour chaque drapeau lu sans `setFlag` dans le paquet. */
function drapeauxSansProducteur(p: Paquet): string[] {
  const pose = poses(p);
  return lecteurs(p).flatMap(([site, x]) => [...lus(x)].filter((f) => !pose.has(f)).map((f) => `${site} : ${f}`));
}

describe('#2219 — drapeau lu → producteur, sur chaque paquet livré', () => {
  for (const rel of listerProjetsLivres())
    it(rel, () => {
      expect(drapeauxSansProducteur(parseProject(lireProjetLivre(rel))), 'drapeau lu sans aucun `setFlag` dans le paquet').toEqual([]);
    });
});

// COUVERTURE du détecteur, sur un paquet jouet : sans elle, le vert ci-dessus ne dirait rien des sites
// qu'aucun paquet livré ne peuple.
describe('#2219 — chaque site lecteur est lu', () => {
  const flag = (expr: string) => ({ kind: 'flag', expr });
  const pose = (f: string) => ({ kind: 'seq', steps: [{ kind: 'do', effect: { type: 'setFlag', flag: f } }] });
  const jouet = {
    scenes: [{
      id: 's',
      triggers: [{ id: 't', rect: { x: 0, y: 0, w: 1, h: 1 }, when: { kind: 'all', of: [flag('dec')] }, flow: pose('produit') }],
      dialogues: [{ id: 'd', start: 'n', nodes: [{ id: 'n', desc: '…', choices: [
        { label: 'a', when: flag('choix') },
        { label: 'b', flow: { kind: 'if', cond: flag('si'), then: { kind: 'seq', steps: [] } } },
      ] }] }],
    }],
    worldMap: { places: [{ id: 'l', when: flag('lieu,!produit') }], routes: [{ id: 'r', when: flag(' route ') }] },
    narratif: { cloture: { when: flag('clos') } },
  } as unknown as Paquet;

  it('lieu, route, clôture, déclencheur (sous un `all`), choix et `if` de dialogue sont NOMMÉS ; le drapeau posé ne l’est pas', () => {
    expect(drapeauxSansProducteur(jouet)).toEqual([
      'carte › lieu l : lieu',
      'carte › route r : route',
      'narratif › clôture : clos',
      's › déclencheur t : dec',
      's › dialogue d : choix',
      's › dialogue d : si',
    ]);
  });
});
