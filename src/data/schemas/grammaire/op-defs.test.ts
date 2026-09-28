/**
 * `OP_DEFS` (`grammaire/mecanique.ts`) — payload strict par op, repli nominatif, rouge au SITE.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { conditionSchema, gameOpSchema, OP_DEFS, OPS_NON_TYPEES } from './mecanique';
import { applyOps, messageRecurrenceHorloge, SELF_REF } from '../../../engine/ops';
import { ARG_TEMPLATE, INDICE_TEMPLATE } from '../../../engine/flowCore';
import { champsDOpASlot } from '../../../../scripts/docs/lib/slots-registre.mjs';
import type { Combatant } from '../../../engine/types';

describe('OP_DEFS — payload strict par op, repli nominatif, rouge au SITE', () => {
  it('une op TYPÉE valide son payload et refuse un champ étranger', () => {
    expect(gameOpSchema.safeParse({ op: 'heal', amount: { dice: { n: 1, sides: 10 } } }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'heal', amount: 2, perSL: { every: 2, amount: 1 } }).success).toBe(true);
    const res = gameOpSchema.safeParse({ op: 'heal', amount: 2, champInvente: true });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/GameOp « heal »/);
    expect(gameOpSchema.safeParse({ op: 'kill' }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'kill', cible: 'x' }).success).toBe(false);
  });

  it('une op NON TYPÉE garde la forme loose', () => {
    expect(OPS_NON_TYPEES).toContain('narrative');
    expect(gameOpSchema.safeParse({ op: 'narrative', text: 'un récit', quoiQueCeSoit: 3 }).success).toBe(true);
  });

  /** `condition` reste LOOSE, mais la combinaison que `applyOps` lève en plein combat (récurrence
   *  comptée en Rounds vs durée d'HORLOGE) se refuse déjà AU PARSE, du MÊME message. */
  it('une op LOOSE ne passe pas les refus mesurés : `condition` à `perRound` + durée d’horloge est refusée au PARSE', () => {
    expect(OPS_NON_TYPEES).toContain('condition');
    expect(gameOpSchema.safeParse({ op: 'condition', id: 'inconscient', perRound: true, durationRounds: 3 }).success).toBe(true);
    for (const duree of [{ durationHours: 1 }, { durationMinutes: 30 }]) {
      const res = gameOpSchema.safeParse({ op: 'condition', id: 'inconscient', perRound: true, ...duree });
      expect(res.success, JSON.stringify(duree)).toBe(false);
      expect(res.error!.issues.map((i) => i.path.join('.'))).toContain('perRound');
      expect(res.error!.issues[0].message).toBe(messageRecurrenceHorloge('inconscient'));
    }
    expect(() => applyOps(
      { id: 'c', label: 'Cobaye', kind: 'hero', characteristics: {}, wounds: { current: 5, max: 5 }, advantage: 0, conditions: [], movement: 4, weapons: [], armour: {}, skills: [], talents: [] } as unknown as Combatant,
      [{ op: 'condition', id: 'inconscient', perRound: true, durationHours: 1 }],
      {},
    ), 'le PARSE et l’APPLICATION disent le même refus').toThrow(messageRecurrenceHorloge('inconscient'));
  });

  it('une op inconnue des DEUX registres est NOMMÉE en erreur', () => {
    const res = gameOpSchema.safeParse({ op: 'nImporteQuoi' });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/GameOp « nImporteQuoi » : op inconnue de OP_DEFS et de OPS_NON_TYPEES/);
  });

  it('une op TYPÉE au payload FAUX est refusée AU CHAMP (le gate ne s’arrête pas au nom de l’op)', () => {
    // `heal.amount` est un nombre ou une Formula — une chaîne n'en est ni l'un ni l'autre. Le rouge
    // doit venir du CHAMP (`amount`), pas du repli nominatif : sans cela, une op nommée juste passerait
    // avec n'importe quelle charge utile.
    const res = gameOpSchema.safeParse({ op: 'heal', amount: 'beaucoup' });
    expect(res.success).toBe(false);
    const issues = res.error!.issues;
    expect(issues.map((i) => i.path.join('.'))).toContain('amount');
    // Le CODE d'issue du payload est REPORTÉ (jamais aplati en `custom`) : c'est lui le contrat, la
    // phrase appartient à la locale. Le préfixe `GameOp « heal » : ` est du code MAISON, lui stable.
    expect(issues.map((i) => i.code)).toContain('invalid_union');
    expect(JSON.stringify(issues)).toMatch(/GameOp « heal » : /);
  });

  it('une op TYPÉE à CLÉ EN TROP est refusée par la clé NOMMÉE, pas par un message générique', () => {
    const res = gameOpSchema.safeParse({ op: 'kill', zzz: 1 });
    expect(res.success).toBe(false);
    expect(res.error!.issues.map((i) => i.code)).toContain('unrecognized_keys');
    expect(JSON.stringify(res.error!.issues)).toMatch(/zzz/);
  });

  it('`skillDRBonus` : cible EXCLUSIVE — `skill` OU `testType`, jamais les deux, jamais aucune, refus NOMMÉ', () => {
    expect(gameOpSchema.safeParse({ op: 'skillDRBonus', skill: { id: 'calme' }, bonus: 1 }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'skillDRBonus', testType: 'poursuite', bonus: 1 }).success).toBe(true);
    for (const cible of [{ skill: { id: 'calme' }, testType: 'poursuite' }, {}]) {
      const res = gameOpSchema.safeParse({ op: 'skillDRBonus', ...cible, bonus: 1 });
      expect(res.success).toBe(false);
      expect(res.error!.issues.map((i) => i.code)).toEqual(['invalid_union']);
      expect(res.error!.issues[0].message).toMatch(/GameOp « skillDRBonus » : cible EXCLUSIVE : « skill » .* OU « testType »/);
    }
    // Une cible UNIQUE mais fausse garde le refus de sa FEUILLE, pas celui de l'exclusivité.
    const fantome = gameOpSchema.safeParse({ op: 'skillDRBonus', skill: { id: 'id-fantome' }, bonus: 1 });
    expect(fantome.error!.issues.map((i) => i.path.join('.'))).toEqual(['skill.id']);
  });

  it('`rollTable` : table EXCLUSIVE — `rows` OU `tableId`, jamais les deux, jamais aucune, refus NOMMÉ', () => {
    const rows = [{ min: 1, max: 10, ops: [{ op: 'kill' }] }];
    expect(gameOpSchema.safeParse({ op: 'rollTable', die: 'd10', rows }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'rollTable', tableId: 'mendier-ennuis' }).success).toBe(true);
    for (const table of [{ die: 'd10', rows, tableId: 'mendier-ennuis' }, {}]) {
      const res = gameOpSchema.safeParse({ op: 'rollTable', ...table });
      expect(res.success).toBe(false);
      expect(res.error!.issues.map((i) => i.code)).toEqual(['invalid_union']);
      expect(res.error!.issues[0].message).toMatch(/GameOp « rollTable » : table EXCLUSIVE : « rows » .* OU « tableId »/);
    }
    const fantome = gameOpSchema.safeParse({ op: 'rollTable', tableId: 'table-fantome' });
    expect(fantome.error!.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
      ['tableId', 'GameOp « rollTable » : « table-fantome » est absent du catalogue des tables (tables.json).'],
    ]);
    // Les ops de rangée sont PARSÉES : une op fantôme sous `rows` est refusée à son chemin.
    const imbriquee = gameOpSchema.safeParse({ op: 'rollTable', die: 'd10', rows: [{ min: 1, max: 10, ops: [{ op: 'contractDisease', disease: 'maladie-fantome' }] }] });
    expect(imbriquee.error!.issues.map((i) => i.path.join('.'))).toEqual(['rows.0.ops.0.disease']);
  });

  it('valeur RÉSERVÉE au même nœud que la feuille : acceptée sur SON champ seul, et le refus garde le message nommé d’`idDe`', () => {
    expect(gameOpSchema.safeParse({ op: 'exposeDisease', disease: ARG_TEMPLATE }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'scheduleRespawn', ref: SELF_REF, delayDays: 1 }).success).toBe(true);
    // Hors du champ qui la déclare, la valeur réservée est un id comme un autre : refusé.
    expect(gameOpSchema.safeParse({ op: 'contractDisease', disease: ARG_TEMPLATE }).success).toBe(false);
    expect(gameOpSchema.safeParse({ op: 'summon', ref: SELF_REF, count: 1 }).success).toBe(false);
    expect(gameOpSchema.safeParse({ op: 'exposeDisease', disease: INDICE_TEMPLATE }).success).toBe(false);
    for (const [op, champ, catalogue, dataset, reste] of [
      ['exposeDisease', 'disease', 'maladies', 'maladies.json', {}],
      ['scheduleRespawn', 'ref', 'créatures', 'creatures.json', { delayDays: 1 }],
    ] as const) {
      const res = gameOpSchema.safeParse({ op, [champ]: 'entite-fantome', ...reste });
      expect(res.success, `${op}.${champ}`).toBe(false);
      expect(res.error!.issues.map((i) => [i.path.join('.'), i.message]), `${op}.${champ}`).toEqual([
        [champ, `GameOp « ${op} » : « entite-fantome » est absent du catalogue des ${catalogue} (${dataset}).`],
      ]);
    }
  });

  it('`testMod.exceptSkills` exempte des Compétences ENTIÈRES (LDB 16 l.52) : `{ id }` strict, une spécialisation est refusée', () => {
    expect(gameOpSchema.safeParse({ op: 'testMod', amount: -10, exceptSkills: [{ id: 'langue' }] }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'testMod', amount: -10, exceptSkills: [{ id: 'langue', spec: 'bretonnien' }] }).success).toBe(false);
  });

  it('les CHAMPS D’OP À SLOT se lisent sur `OP_DEFS` : feuille `idDe` du champ, jamais celles d’une op imbriquée', () => {
    const champs = champsDOpASlot();
    // `summon.count` : une `Formula` porte le terme `{rule}`, feuille `idDe('regleOptionnelle')`.
    for (const k of ['removeTrait.traitId', 'diseaseTestMod.diseases', 'testMod.exceptSkills', 'rollTable.tableId', 'transform.morphRef', 'summon.count', 'grantWeapon.form']) {
      expect(champs.has(k), k).toBe(true);
    }
    // `rows`/`ops`/`thresholds`/`onCross`/`perRound`/`passive` portent des ops IMBRIQUÉES (`z.lazy`), `addTraits` un `traitInstanceSchema`
    // dont l'`id` n'est pas une feuille `idDe` : aucun n'est un champ à slot.
    for (const k of ['rollTable.rows', 'transform.ops', 'perRound.ops', 'rollThreshold.thresholds', 'delayed.ops', 'zone.onCross', 'zone.perRound', 'augmentWeapon.passive', 'summon.addTraits', 'skillDRBonus.testType']) {
      expect(champs.has(k), k).toBe(false);
    }
  });

  it('la clé `op` SURCHARGÉE d’une `Condition` (comparateur) ne passe pas par ce rouge', () => {
    for (const comparateur of ['>=', '<=', '>', '<', '==']) {
      const cond = { kind: 'slThreshold', op: comparateur, value: 2 };
      expect(conditionSchema.safeParse(cond).success).toBe(true);
    }
  });

  it('les deux registres sont DISJOINTS et couvrent EXACTEMENT les ops du moteur, sans compte magique', () => {
    const typees = Object.keys(OP_DEFS);
    expect(typees.filter((o) => OPS_NON_TYPEES.includes(o))).toEqual([]);
    // La référence est la SOURCE `src/engine/ops.ts` : chaque branche littérale de l'union `GameOp`
    // (`rollTable` en porte 2, dédoublonnées par l'ensemble). Égalité d'ensembles BIDIRECTIONNELLE :
    // une op moteur non couverte comme une entrée orpheline sont NOMMÉES.
    const source = readFileSync(new URL('../../../engine/ops.ts', import.meta.url), 'utf8');
    const opsDuMoteur = new Set([...source.matchAll(/^\s*\|\s*\{\s*op:\s*'([^']+)'/gm)].map((m) => m[1]));
    expect(opsDuMoteur.size).toBeGreaterThan(0);
    const couvertes = new Set([...typees, ...OPS_NON_TYPEES]);
    expect([...opsDuMoteur].filter((o) => !couvertes.has(o)).sort()).toEqual([]);
    expect([...couvertes].filter((o) => !opsDuMoteur.has(o)).sort()).toEqual([]);
  });
});
