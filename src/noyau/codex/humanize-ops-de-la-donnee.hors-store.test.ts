/**
 * Le texte joueur d'une op (`humanizeOp`, `humanize.ts`) sur les ops RÉELLES de la donnée : chaque op des familles
 * ci-dessous se dit en une phrase résolue (aucun gabarit `{…}` laissé, aucun `undefined`), et le sens d'un montant
 * choisit son verbe. `activities`, `mutations`, `maneuvers`, `maladies` et `trappings` portent des `GameOp` ; le
 * dialecte de `miscast.json` (terme `{ sinPoints }`, `engine/miscast.ts`) n'en devient un qu'au tirage
 * (`rollMiscast`), qui lie les Points de Péché du lanceur (LDB 40 l.58) : ses ops se lisent donc après ce tirage.
 */
import { describe, it, expect } from 'vitest';
import { humanizeOp } from './humanize';
import { t } from '../../i18n';
import type { GameOp } from '../../engine/ops';
import { makeRNG } from '../../engine/dice';
import { miscastTableId, miscastTableRows, rollMiscast, type MiscastSeverity } from '../../engine/miscast';
import activities from '../../data/activities.json';
import mutations from '../../data/mutations.json';
import { maneuvers } from '../../data';
import maladies from '../../data/maladies.json';
import trappings from '../../data/trappings.json';

const FAMILLES = new Set([
  'statusMod', 'removeTrait', 'deitySkillMod', 'suppressTalents', 'deityBan', 'prayerForAction', 'reduceToZero',
  'damageWornGear', 'transform', 'endTransform', 'diseaseTestMod', 'aggravateSymptom', 'grantSymptom',
]);

function opsDe(noeud: unknown, out: GameOp[] = []): GameOp[] {
  if (Array.isArray(noeud)) for (const x of noeud) opsDe(x, out);
  else if (noeud && typeof noeud === 'object') {
    const o = noeud as { op?: unknown };
    if (typeof o.op === 'string' && FAMILLES.has(o.op)) out.push(o as GameOp);
    for (const v of Object.values(noeud)) opsDe(v, out);
  }
  return out;
}

/** Les ops de chaque rangée des tables d'Incantation imparfaite et de Colère des dieux, tirées au dé FIGÉ sur la
 *  rangée, le lanceur à 3 Points de Péché. */
function opsDesContrecoups(): GameOp[] {
  return (['mineure', 'majeure', 'colere'] as MiscastSeverity[]).flatMap((gravite) =>
    miscastTableRows(miscastTableId(gravite)).flatMap((rangee) => {
      const tire = rollMiscast(gravite, makeRNG(1), gravite === 'colere' ? 0 : 3, undefined, rangee.min);
      return opsDe([tire.ops, tire.targetOps]);
    }));
}
const OPS = [...opsDe([activities, mutations, maneuvers, maladies, trappings]), ...opsDesContrecoups()];

describe('humanizeOp — les ops de la donnée réelle', () => {
  it('chaque famille est portée par la donnée', () => {
    expect([...new Set(OPS.map((o) => o.op))].sort()).toEqual([...FAMILLES].sort());
  });

  it('chaque op se dit en une phrase résolue', () => {
    for (const o of OPS) {
      const texte = humanizeOp(o);
      expect(texte.length, JSON.stringify(o)).toBeGreaterThan(0);
      expect(texte, JSON.stringify(o)).not.toMatch(/\{|\}|undefined|NaN/);
    }
  });

  it('le sens du montant choisit le verbe : Standing perdu ou gagné, malus ou bonus aux Tests de maladie', () => {
    for (const o of OPS) {
      if (o.op === 'diseaseTestMod') {
        const verbe = o.amount >= 0 ? 'gagne' : 'subit';
        expect(humanizeOp(o).startsWith(t(`codex.op.modificateurDeTestDeMaladie.${verbe}`, { mod: '' }).split(' ')[0]), JSON.stringify(o)).toBe(true);
      }
      if (o.op === 'statusMod' && typeof o.amount === 'number') {
        expect(humanizeOp(o).split(' ')[0], JSON.stringify(o)).toBe(o.amount < 0 ? 'perd' : 'gagne');
      }
    }
  });
});
