import { describe, it, expect } from 'vitest';
import type { Condition } from '../engine/flowCore';
import { CONDITIONS_RESERVEES, conditionSchema } from './schemas/grammaire/mecanique';
import { customStatblockSchema } from './schemas/defs-scenes/communs';
import { semencesDeScene } from './index';
import { blocNeuf, CONDITION_TOUJOURS, emptyStatblock, noeudTestNeuf, recast } from './valeursNeuves';
import { refusHorsSentinelle } from './valeursNeuves.testkit';
import { sceneFlowSchema } from './schemas/defs-scenes/effets';

/** Les `kind` de Condition, lus au schéma (un `kind` refusé y est nommé dans son message). */
function kindsDeCondition(): Condition['kind'][] {
  const r = conditionSchema.safeParse({ kind: '__aucun__' });
  if (r.success) throw new Error('conditionSchema accepte un kind inconnu');
  const valeurs = r.error.issues.flatMap((i) => ('options' in i && Array.isArray(i.options) ? i.options : []));
  if (valeurs.length) return valeurs as Condition['kind'][];
  throw new Error(`kinds de Condition illisibles au refus : ${JSON.stringify(r.error.issues)}`);
}

describe('valeurs neuves de l’atelier en donnée (#3059)', () => {
  it('recast : chaque type de Condition hors famille réservée, depuis « Toujours », parse `conditionSchema` hors sentinelle vide', () => {
    const reservees: readonly string[] = CONDITIONS_RESERVEES;
    const kinds = kindsDeCondition().filter((k) => !reservees.includes(k));
    expect(kinds).toContain('flag');
    for (const k of kinds) {
      const c = recast(CONDITION_TOUJOURS, k);
      expect(c.kind, k).toBe(k);
      expect(refusHorsSentinelle(conditionSchema, c), k).toEqual([]);
    }
  });

  it('emptyStatblock : conforme à `customStatblockSchema`, libellé de la semence sans nom', () => {
    const s = emptyStatblock();
    expect(customStatblockSchema.safeParse(s).success).toBe(true);
    expect(s.label).toBe(semencesDeScene.profil);
    expect(emptyStatblock('Gaspard').label).toBe('Gaspard');
  });
  it('noeudTestNeuf et blocNeuf : chaque bloc neuf d’un Flow authoré est conforme à `sceneFlowSchema`', () => {
    expect(refusHorsSentinelle(sceneFlowSchema, noeudTestNeuf())).toEqual([]);
    for (const k of ['si', 'test', 'choix'] as const) expect(refusHorsSentinelle(sceneFlowSchema, blocNeuf(k)), k).toEqual([]);
  });
});
