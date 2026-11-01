/**
 * `OP_DEFS` (`grammaire/mecanique.ts`) — payload strict par op, repli nominatif, rouge au SITE.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { conditionSchema, gameOpSchema, OP_DEFS, OPS_NON_TYPEES, mecaniqueDe } from './mecanique';
import { applyOps, messageRecurrenceHorloge, SELF_REF } from '../../../engine/ops';
import { ARG_TEMPLATE, INDICE_TEMPLATE } from '../../../engine/flowCore';
import { champsDOpASlot } from '../../../../scripts/docs/lib/slots-registre.mjs';
import type { Combatant } from '../../../engine/types';
import { desDuTest } from '../../../engine/dice.testkit';
import { conditionIds } from '../../index';
import { blessuresSurLeProfil, blessuresDeBase } from '../../../engine/combattantDeTest.testkit';

describe('OP_DEFS — payload strict par op, repli nominatif, rouge au SITE', () => {
  it('chaque famille garde les slots directs et confie les opérations imbriquées à leur propre entrée', () => {
    for (const famille of [mecaniqueDe({}), mecaniqueDe({ 'grantTalent.talent': 'specOuChoixFacultatifs' })]) {
      const champs = champsDOpASlot(famille.opDefs);
      expect(champs.has('rollTable.tableId')).toBe(true);
      expect(champs.has('removeTrait.trait')).toBe(true);
      expect(champs.has('rollTable.rows')).toBe(false);
      expect(champs.has('transform.ops')).toBe(false);
    }
  });
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
    expect(OPS_NON_TYPEES).toContain('condition');
    expect(gameOpSchema.safeParse({ op: 'condition', id: 'inconscient', quoiQueCeSoit: 3 }).success).toBe(true);
  });

  it('narrative est typée : texte et provenance locaux, aucun champ étranger', () => {
    expect(OPS_NON_TYPEES).not.toContain('narrative');
    expect(gameOpSchema.safeParse({ op: 'narrative', text: 'un récit' }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'narrative', text: 'un récit', source: { book: 'ennemi-dans-l-ombre', page: 12 } }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'narrative', text: 'un récit', adapteDe: { book: 'ennemi-dans-l-ombre', page: 14 } }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'narrative', text: 'un récit', quoiQueCeSoit: 3 }).success).toBe(false);
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
      blessuresSurLeProfil({ id: 'c', label: 'Cobaye', kind: 'hero', characteristics: {}, wounds: blessuresDeBase(5), advantage: 0, conditions: [], movement: 4, weapons: [], armour: {}, skills: [], talents: [] }) as unknown as Combatant,
      [{ op: 'condition', id: 'inconscient', perRound: true, durationHours: 1 }],
      { rng: desDuTest },
    ), 'le PARSE et l’APPLICATION disent le même refus').toThrow(messageRecurrenceHorloge('inconscient'));
  });

  it('une op `condition`/`removeCondition` qui nomme un État hors du registre est refusée AU CHAMP (#1463 LD.1)', () => {
    const connu = conditionIds()[0];
    expect(gameOpSchema.safeParse({ op: 'condition', id: connu, onlyIfCondition: connu, unlessCondition: connu }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'removeCondition', id: connu }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'condition', id: 'petrifie' }).success, 'un marqueur narratif est un État connu').toBe(true);
    for (const op of [
      { op: 'condition', id: 'etat-hors-registre' },
      { op: 'condition', id: connu, onlyIfCondition: 'etat-hors-registre' },
      { op: 'condition', id: connu, unlessCondition: 'etat-hors-registre' },
      { op: 'removeCondition', id: 'etat-hors-registre' },
    ]) {
      const res = gameOpSchema.safeParse(op);
      expect(res.success, JSON.stringify(op)).toBe(false);
      const champ = Object.keys(op).find((k) => (op as Record<string, unknown>)[k] === 'etat-hors-registre')!;
      expect(res.error!.issues.map((i) => i.path.join('.'))).toContain(champ);
    }
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

  /** `withArg` (`noyau/triggeredEffects`) écarte l'op dont l'instance n'a pas le paramètre : seul un champ
   *  REQUIS peut porter un gabarit, faute de quoi l'op entière tomberait pour un champ facultatif (#3060). */
  it('un champ d’op qui admet un gabarit d’instance (`$arg`, `$indice`) est requis', () => {
    const porteurs: string[] = [];
    for (const [op, def] of Object.entries(OP_DEFS)) {
      const shape = (def as { shape?: Record<string, { safeParse: (v: unknown) => { success: boolean } }> }).shape ?? {};
      for (const [champ, schema] of Object.entries(shape)) {
        const reserve = [ARG_TEMPLATE, INDICE_TEMPLATE].some((g) => schema.safeParse(g).success) && !schema.safeParse('$non-reserve').success;
        if (!reserve) continue;
        porteurs.push(`${op}.${champ}`);
        expect(schema.safeParse(undefined).success, `${op}.${champ}`).toBe(false);
      }
    }
    expect(porteurs).toEqual(expect.arrayContaining(['exposeDisease.disease', 'topUpAdvantage.amount']));
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
    // `summon.count` : une `Formula` porte le terme `{rule}`, feuille `idDe('regleOptionnelle')` ; `summon.addTraits`
    // des `traitInstanceSchema`, dont l'`id` est la feuille `idDe('trait')`.
    for (const k of ['grantTrait.trait', 'removeTrait.trait', 'diseaseTestMod.diseases', 'testMod.exceptSkills', 'rollTable.tableId', 'transform.morphRef', 'summon.count', 'summon.addTraits', 'grantWeapon.form']) {
      expect(champs.has(k), k).toBe(true);
    }
    // `rows`/`ops`/`thresholds`/`onCross`/`perRound`/`passive` portent des ops IMBRIQUÉES (`z.lazy`) : aucun n'est un champ à slot.
    for (const k of ['rollTable.rows', 'transform.ops', 'perRound.ops', 'rollThreshold.thresholds', 'delayed.ops', 'zone.onCross', 'zone.perRound', 'augmentWeapon.passive', 'skillDRBonus.testType']) {
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
