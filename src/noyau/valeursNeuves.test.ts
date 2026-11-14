import { describe, it, expect } from 'vitest';
import { OP_DEFS, flowSchema, gameOpSchema } from '../data/schemas/grammaire/mecanique';
import { formulaSinSchema } from '../data/schemas/grammaire/valeurs';
import { effectSchema, sceneFlowSchema } from '../data/schemas/defs-scenes/effets';
import { mapPlaceSchema, routePerilSchema, worldMapSchema } from '../data/schemas/defs-scenes/worldmap';
import { semencesDeScene } from '../data';
import { refusHorsSentinelle } from '../data/valeursNeuves.testkit';
import { EFFECT_HANDLERS } from './combatEffects';
import { formulaForShape, newEffect, newOp, paramsDeRegle, shapeOf, valeurNeuveDe, variantesAChoisir, type FormulaShape } from './valeursNeuves';
import { marcheNeuf, peripetieNeuve, portNeuf } from './worldMapEdit';
import { emptyWorldMap } from './worldMap';

describe('valeurs neuves de l’atelier au noyau (#3059) : toute valeur neuve parse son schéma, hors sentinelle vide', () => {
  it('newOp : chaque op du vocabulaire (`OP_DEFS`) naît conforme à `gameOpSchema`', () => {
    for (const op of Object.keys(OP_DEFS)) {
      expect(refusHorsSentinelle(gameOpSchema, newOp(op)), op).toEqual([]);
    }
  });

  it('newOp : le terrain d’`offTerrainMod` est le premier terrain électif non franchissable du registre', () => {
    expect(gameOpSchema.safeParse(newOp('offTerrainMod')).success).toBe(true);
  });

  it('formulaForShape : chaque forme rend une formule de cette forme, conforme à `formulaSinSchema`', () => {
    const formes: FormulaShape[] = ['lit', 'bonus', 'char', 'dice', 'times', 'rolled', 'indice', 'pions', 'ecartAvantage', 'blessuresInfligees', 'blessuresMax', 'dr', 'regle', 'minimum', 'tranches', 'somme', 'peche'];
    expect(paramsDeRegle().length, 'aucune règle optionnelle numérique : `{rule}` sans défaut').toBeGreaterThan(0);
    for (const s of formes) {
      const f = formulaForShape(s, undefined);
      expect(shapeOf(f), s).toBe(s);
      expect(refusHorsSentinelle(formulaSinSchema, f), s).toEqual([]);
    }
  });

  it('newEffect : chaque type du registre (`EFFECT_HANDLERS`) naît conforme à `effectSchema`', () => {
    for (const t of Object.keys(EFFECT_HANDLERS) as (keyof typeof EFFECT_HANDLERS)[]) {
      expect(refusHorsSentinelle(effectSchema, newEffect(t)), t).toEqual([]);
    }
  });

  it('Flow : chaque branche, nommée, naît conforme, chaque flux qu’elle porte à la séquence vide, où la récursion s’arrête (#3606 M2b)', () => {
    const vide = { kind: 'sequence', etapes: [] };
    for (const [schema, effet] of [[sceneFlowSchema, { type: 'setFlag', flag: '' }], [flowSchema, { type: 'ops', ops: [] }]] as const) {
      expect(valeurNeuveDe(schema)).toEqual(vide);
      const variantes = variantesAChoisir(schema, undefined)!;
      expect(variantes.map((v) => [v.cle, v.libelle, v.valeur])).toEqual([
        ['sequence', 'Séquence', vide],
        ['effet', 'Effet', { kind: 'effet', effet: effet }],
        ['si', 'Si', { kind: 'si', condition: { kind: 'always' }, alors: vide }],
        ['test', 'Test', { kind: 'test', test: {}, reussite: vide, echec: vide }],
        ['choix', 'Choix', { kind: 'choix', oui: vide, invite: '' }],
      ]);
      for (const v of variantes) expect(refusHorsSentinelle(schema, v.valeur), v.cle).toEqual([]);
    }
  });

  it('carte du monde : carte, péripétie, port et marché neufs sont conformes à leurs schémas ; le libellé de la carte vient de la semence', () => {
    const carte = emptyWorldMap('carte-neuve');
    expect(carte.label).toBe(semencesDeScene.carte);
    expect(worldMapSchema.safeParse(carte).success).toBe(true);
    expect(routePerilSchema.safeParse(peripetieNeuve()).success).toBe(true);
    const lieu = { id: 'l', label: 'L', scene: { id: 's' }, pos: { x: 10, y: 10 }, port: portNeuf(), market: marcheNeuf() };
    expect(mapPlaceSchema.safeParse(lieu).success).toBe(true);
    expect(portNeuf(), 'chaque port neuf est une valeur propre').not.toBe(portNeuf());
  });
});
