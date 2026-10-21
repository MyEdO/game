import { describe, it, expect, afterEach } from 'vitest';
import type { Combatant, ConditionUnlock } from './types';
import type { Condition } from './flowCore';
import { addCondition, removeCondition, hasCondition, stacks, isConditionLocked, raisonVerrouEtat, releaseConditionLocks, hasSurgeryLockedCondition } from './conditions';
import { t } from '../i18n';
import { applyOps } from './ops';
import { CRITIQUE_DOCS } from '../data/criticals';
import { spellOps } from './flowCore';
import miscastJson from '../data/miscast.json';
import { gameOpSchema } from '../data/schemas/grammaire/mecanique';
import { schema as etatsSchema } from '../data/schemas/defs/etats';
import { etats, findConditionById } from '../data';
import { resetData, setDataset } from '../data/overrides';
import { desDuTest } from './dice.testkit';

/** Toutes les rangées de Blessure critique, les 8 documents-tables confondus (LDB + Aux Armes) —
 *  la lecture ne nomme aucune famille : un 9ᵉ tableau y entre sans une ligne. */
const rangees = () => CRITIQUE_DOCS.flatMap((d) => d.entries);

function mk(): Combatant {
  return {
    id: 'x', name: 'X', kind: 'hero', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    conditions: [], activeEffects: [], skills: [], talents: [], traits: [], weapons: [], armour: [],
    wounds: { current: 10, max: 10, base: 10 }, advantage: 0,
  } as unknown as Combatant;
}

const noHemo: Condition = { kind: 'compare', subject: { who: 'target', condition: 'hemorragique' }, op: '==', value: 0 };

describe('Verrou d’État de Critique — lockedUntil (LDB 18)', () => {
  it('Aveuglé verrouillé tant qu’un Hémorragique subsiste : removeCondition inerte', () => {
    const c = mk();
    addCondition(c, 'hemorragique', 2);
    addCondition(c, 'aveugle', 1, undefined, undefined, undefined, undefined, { lockedUntil: noHemo });
    expect(isConditionLocked(c.conditions.find((x) => x.id === 'aveugle')!, c)).toBe(true);
    removeCondition(c, 'aveugle'); // auto-dissipation / soin : bloqué
    expect(hasCondition(c, 'aveugle')).toBe(true);
  });

  it('une fois les Hémorragique éliminés, l’Aveuglé se déverrouille et part', () => {
    const c = mk();
    addCondition(c, 'hemorragique', 1);
    addCondition(c, 'aveugle', 1, undefined, undefined, undefined, undefined, { lockedUntil: noHemo });
    removeCondition(c, 'hemorragique'); // Hémorragique = 0
    expect(isConditionLocked(c.conditions.find((x) => x.id === 'aveugle')!, c)).toBe(false);
    removeCondition(c, 'aveugle');
    expect(hasCondition(c, 'aveugle')).toBe(false);
  });

  it('sans lockedUntil : aucun verrou (comportement inchangé)', () => {
    const c = mk();
    addCondition(c, 'sonne', 2);
    removeCondition(c, 'sonne');
    expect(stacks(c, 'sonne')).toBe(1);
  });
});

describe('Verrou d’acte de soin — unlockBy (LDB 18 : medicalAid / surgery / magic)', () => {
  const withLock = (cond: string, unlockBy: ConditionUnlock): Combatant => {
    const c = mk();
    addCondition(c, cond, 1, undefined, undefined, undefined, undefined, { unlockBy });
    return c;
  };

  it('unlockBy verrouille l’État : removeCondition (récupération naturelle) inerte tant qu’il tient', () => {
    const c = withLock('sonne', 'medicalAid');
    expect(isConditionLocked(c.conditions[0], c)).toBe(true);
    removeCondition(c, 'sonne'); // auto-dissipation / récupération par Round : bloquée
    expect(hasCondition(c, 'sonne')).toBe(true);
  });

  // Matrice croisée : chaque verrou n’est levé QUE par le bon acte (et magie ⊇ Aide Médicale).
  const ACTS: ConditionUnlock[] = ['medicalAid', 'surgery', 'magic'];
  const lifts: Record<ConditionUnlock, ConditionUnlock[]> = {
    medicalAid: ['medicalAid', 'magic'], // magie compte comme Aide Médicale (LDB 18 l.311)
    surgery: ['surgery'],
    magic: ['magic'],
  };
  for (const lock of ACTS) {
    for (const act of ACTS) {
      const shouldLift = lifts[lock].includes(act);
      it(`verrou ${lock} ${shouldLift ? 'LEVÉ' : 'INTACT'} par l’acte ${act}`, () => {
        const c = withLock('aveugle', lock);
        const log = releaseConditionLocks(c, act);
        expect(hasCondition(c, 'aveugle')).toBe(!shouldLift);
        expect(log.length > 0).toBe(shouldLift);
        if (!shouldLift) expect(isConditionLocked(c.conditions[0], c)).toBe(true); // toujours verrouillé
      });
    }
  }

  it('hasSurgeryLockedCondition : vrai ssi un État porte unlockBy surgery', () => {
    expect(hasSurgeryLockedCondition(withLock('hemorragique', 'surgery'))).toBe(true);
    expect(hasSurgeryLockedCondition(withLock('sonne', 'medicalAid'))).toBe(false);
  });

  it('op condition { unlockBy } : figée sur l’instance par applyOps ; un soin de sort (magie) la lève', () => {
    const c = mk();
    applyOps(c, [{ op: 'condition', id: 'inconscient', value: 1, unlockBy: 'medicalAid' }], { rng: desDuTest, label: 'Critique' });
    expect(c.conditions.find((x) => x.id === 'inconscient')!.unlockBy).toBe('medicalAid');
    // Soin d’un SORT (ctx.sourceSpellId) = magie ⊇ Aide Médicale → l’op heal lève le verrou medicalAid.
    applyOps(c, [{ op: 'heal', amount: 1 }], { rng: desDuTest, label: 'Bénédiction', sourceSpellId: 'benediction-soin' });
    expect(hasCondition(c, 'inconscient')).toBe(false);
  });

  it('op heal SANS sort (potion/objet) = Aide Médicale : lève medicalAid mais PAS un verrou surgery', () => {
    const c = mk();
    addCondition(c, 'hemorragique', 1, undefined, undefined, undefined, undefined, { unlockBy: 'surgery' });
    addCondition(c, 'sonne', 1, undefined, undefined, undefined, undefined, { unlockBy: 'medicalAid' });
    applyOps(c, [{ op: 'heal', amount: 1 }], { rng: desDuTest, label: 'Potion' }); // pas de sourceSpellId → medicalAid
    expect(hasCondition(c, 'sonne')).toBe(false); // verrou medicalAid levé
    expect(hasCondition(c, 'hemorragique')).toBe(true); // verrou surgery INTACT
    expect(isConditionLocked(c.conditions.find((x) => x.id === 'hemorragique')!, c)).toBe(true);
  });
});

describe('Données — verrous & escapeStrength câblés (RAW)', () => {
  it('Critique Tête « En plein front » (46-50) : l’op Aveuglé porte lockedUntil == 0 Hémorragique', () => {
    const entry = rangees().find((e) => e.id === 'en-plein-front')! as { ops?: { op: string; id?: string; lockedUntil?: unknown }[] };
    const aveugleOp = entry.ops!.find((o) => o.op === 'condition' && o.id === 'aveugle')!;
    expect(aveugleOp.lockedUntil).toEqual(noHemo);
  });

  it('Critique Corps « Hémorragie interne » (97-99) : l’op Hémorragique porte unlockBy surgery', () => {
    const entry = rangees().find((e) => e.id === 'hemorragie-interne')! as { ops?: { op: string; id?: string; unlockBy?: string }[] };
    const op = entry.ops!.find((o) => o.op === 'condition' && o.id === 'hemorragique')!;
    expect(op.unlockBy).toBe('surgery');
  });

  it('Critiques « Aide Médicale » (œil/thorax/clavicule/épaule/genou) : unlockBy medicalAid (LDB + jumeaux AA)', () => {
    type Op = { op: string; id?: string; unlockBy?: string };
    const opsOf = (id: string, cond: string): Op | undefined => {
      const e = rangees().find((x) => x.id === id)!;
      // L'effet peut vivre dans l'effet IMMÉDIAT ou dans la branche `fail` du nœud `test` de la rangée.
      return [...((e.ops ?? []) as Op[]), ...(spellOps(e.test?.fail, 'target') as unknown as Op[])]
        .find((o) => o.op === 'condition' && o.id === cond);
    };
    // œil (Aveuglé), thorax (Sonné), clavicule (Inconscient) — LDB + jumeaux AA aa-tete-41/aa-corps-91/aa-corps-96.
    expect(opsOf('blessure-majeure-a-l-il', 'aveugle')!.unlockBy).toBe('medicalAid');
    expect(opsOf('cage-thoracique-perforee', 'sonne')!.unlockBy).toBe('medicalAid');
    expect(opsOf('clavicule-cassee', 'inconscient')!.unlockBy).toBe('medicalAid');
    expect(opsOf('aa-tete-41', 'aveugle')!.unlockBy).toBe('medicalAid');
    expect(opsOf('aa-corps-91', 'sonne')!.unlockBy).toBe('medicalAid');
    expect(opsOf('aa-corps-96', 'inconscient')!.unlockBy).toBe('medicalAid');
    expect(opsOf('aa-corps-111', 'hemorragique')!.unlockBy).toBe('surgery');
    // Épaule luxée / Genou démis (Sonné « jusqu’à Aide Médicale ») — LDB + jumeaux AA.
    expect(opsOf('epaule-luxee', 'sonne')!.unlockBy).toBe('medicalAid');
    expect(opsOf('genou-demis', 'sonne')!.unlockBy).toBe('medicalAid'); // dans resist.onFail
    expect(opsOf('aa-bras-96', 'sonne')!.unlockBy).toBe('medicalAid');
    expect(opsOf('aa-jambe-96', 'sonne')!.unlockBy).toBe('medicalAid');
  });

  it('Imparfaite « Tenue indisciplinée » (LDB 46) : Empêtré avec Force d’évasion 1d10×5', () => {
    // Adressée PAR ID stable (le libellé est de l'affichage — et il est HOMONYME entre les jeux LDB et VDM).
    type Ligne = { id: string; label: string; ops?: { op: string; id?: string; escapeStrength?: unknown }[] };
    const docs = miscastJson as unknown as { id: string; entries: Ligne[] }[];
    const mineure = docs.find((d) => d.id === 'miscast-mineure');
    if (!mineure) throw new Error('tableau « miscast-mineure » absent de miscast.json');
    const entry = mineure.entries.find((e) => e.id === 'mineure-tenue-indisciplinee')!;
    const op = entry.ops!.find((o) => o.op === 'condition')!;
    expect(op.id).toBe('empetre');
    // Résolution du 1d10×5 (multiple de 5, borné 5..50) via applyOps.
    for (let i = 0; i < 20; i++) {
      const c = mk();
      applyOps(c, entry.ops as import('./ops').GameOp[], { rng: desDuTest, label: 'Tenue indisciplinée' });
      const inst = c.conditions.find((x) => x.id === 'empetre')!;
      expect(inst.escapeStrength! % 5).toBe(0);
      expect(inst.escapeStrength).toBeGreaterThanOrEqual(5);
      expect(inst.escapeStrength).toBeLessThanOrEqual(50);
    }
  });
});

/**
 * CONTEXTE du verrou — une seule projection d'acteur (`conditionLockCtx` → `buildActorView`), la MÊME
 * que celle des Flows. Un verrou qui compare autre chose que les États du porteur (une
 * Caractéristique, ses PB, sa Taille) s'évaluait FAUX en silence avant #1599 : la vue tronquée ne
 * portait que `target.conditions`.
 */
describe('le verrou s’évalue contre la vue COMPLÈTE du porteur (#1599)', () => {
  const forceAuMoins30: Condition = { kind: 'compare', subject: { who: 'target', char: 'force' }, op: '>=', value: 30 };

  it('verrou sur une CARACTÉRISTIQUE : verrouillé tant qu’elle n’atteint pas le seuil', () => {
    const c = mk();
    c.characteristics.force = 20;
    addCondition(c, 'sonne', 1, undefined, undefined, undefined, undefined, { lockedUntil: forceAuMoins30 });
    expect(isConditionLocked(c.conditions[0], c), 'Force 20 : le verrou doit TENIR').toBe(true);
    removeCondition(c, 'sonne');
    expect(hasCondition(c, 'sonne')).toBe(true);
    c.characteristics.force = 35;
    expect(isConditionLocked(c.conditions[0], c), 'Force 35 : le verrou doit TOMBER').toBe(false);
    removeCondition(c, 'sonne');
    expect(hasCondition(c, 'sonne')).toBe(false);
  });

  it('verrou sur les PB du porteur (`woundsCurrent`) : lu, jamais rabattu à 0', () => {
    const c = mk();
    c.wounds.current = 2;
    const pbPleins: Condition = { kind: 'compare', subject: { who: 'target', field: 'woundsCurrent' }, op: '>=', value: 10 };
    addCondition(c, 'a-terre', 1, undefined, undefined, undefined, undefined, { lockedUntil: pbPleins });
    expect(isConditionLocked(c.conditions[0], c)).toBe(true);
    c.wounds.current = 10;
    expect(isConditionLocked(c.conditions[0], c)).toBe(false);
  });
});

/**
 * VERROU PAR CONSTRUCTION à la donnée : un sujet que le contexte de verrou ne GARANTIT pas (drapeau de
 * scène, horloge, bourse…) est refusé AU PARSE, nominativement — jamais évalué faux en silence.
 */
describe('la donnée ne peut pas authorer un verrou sur un sujet non garanti (#1599)', () => {
  it('les verrous `lockedUntil` LIVRÉS passent tous la porte', () => {
    const verrous = rangees().flatMap((e) => JSON.stringify(e).match(/"lockedUntil"/g) ?? []);
    expect(verrous.length, 'plus aucun verrou `lockedUntil` en donnée : la garde ne mesure rien').toBeGreaterThan(0);
    for (const e of rangees()) {
      for (const op of (e as { ops?: unknown[] }).ops ?? []) {
        const o = op as Record<string, unknown>;
        if (o.op !== 'condition' || o.lockedUntil == null) continue;
        expect(gameOpSchema.safeParse(o).success, `verrou refusé sur « ${String(e.id)} »`).toBe(true);
      }
    }
  });

  it('un verrou sur un DRAPEAU de scène est REFUSÉ, en nommant la famille fautive', () => {
    const res = gameOpSchema.safeParse({ op: 'condition', id: 'sonne', lockedUntil: { kind: 'flag', expr: 'porte-ouverte' } });
    expect(res.success).toBe(false);
    expect(res.success ? '' : res.error.issues.map((i) => i.message).join('\n')).toContain('« flag »');
  });

  it('un verrou sur l’HORLOGE est REFUSÉ, même imbriqué dans un `all`', () => {
    const res = gameOpSchema.safeParse({
      op: 'condition', id: 'sonne',
      lockedUntil: { kind: 'all', of: [noHemo, { kind: 'time', window: { afterHour: 6 } }] },
    });
    expect(res.success).toBe(false);
    expect(res.success ? '' : res.error.issues.map((i) => i.message).join('\n')).toContain('« time »');
  });
});

/**
 * VERROU DE TYPE (`EtatData.lockedUntil`, etats.json) : même algèbre, même contexte et donc MÊME porte
 * de parse que le verrou d'instance — il vaut pour TOUTE instance de l'État, quelle que soit sa cause.
 */
describe('verrou de TYPE — une instance NUE de l’État en hérite', () => {
  it('À Terre à 0 Blessure : `removeCondition` est inerte, et se lève dès 1 Blessure regagnée', () => {
    expect(findConditionById('a-terre')!.lockedUntil, 'la donnée ne porte plus le verrou : la sonde ne mesure rien').toBeDefined();
    const c = mk();
    c.wounds.current = 0;
    addCondition(c, 'a-terre', 1); // pose NUE : aucun verrou d'instance
    expect(isConditionLocked(c.conditions[0], c)).toBe(true);
    removeCondition(c, 'a-terre');
    expect(hasCondition(c, 'a-terre'), 'À Terre retiré à 0 Blessure (LDB 18 l.15)').toBe(true);
    c.wounds.current = 1;
    expect(isConditionLocked(c.conditions[0], c)).toBe(false);
    removeCondition(c, 'a-terre');
    expect(hasCondition(c, 'a-terre')).toBe(false);
  });

  // La raison rendue est celle du verrou QUI TIENT : à 5 Blessures, le verrou de TYPE d'À Terre est
  // TOMBÉ — dire « il faut regagner au moins 1 Blessure » serait FAUX.
  it('verrou d’INSTANCE sur un État qui porte AUSSI un verrou de type : la raison est celle de l’instance', () => {
    const c = mk();
    c.wounds.current = 5;
    addCondition(c, 'hemorragique', 1);
    addCondition(c, 'a-terre', 1, undefined, undefined, undefined, undefined, { lockedUntil: noHemo });
    const inst = c.conditions.find((x) => x.id === 'a-terre')!;
    expect(isConditionLocked(inst, c), 'l’Hémorragique tient encore : l’État est verrouillé').toBe(true);
    expect(raisonVerrouEtat(inst, c)).toBe(t('cond.locked'));
    expect(raisonVerrouEtat(inst, c), 'raison du verrou de TYPE alors que le porteur a 5 Blessures')
      .not.toBe(findConditionById('a-terre')!.lockedReason);
    // TÉMOIN — à 0 Blessure, sans verrou d'instance, c'est bien la raison du TYPE qui est rendue.
    const d = mk();
    d.wounds.current = 0;
    addCondition(d, 'a-terre', 1);
    expect(raisonVerrouEtat(d.conditions[0], d)).toBe(findConditionById('a-terre')!.lockedReason);
  });

  it('la donnée ne peut pas authorer un verrou de TYPE sur un sujet non garanti', () => {
    const res = etatsSchema.safeParse([{
      id: 'x', type: 'etats', label: 'X', desc: 'x', source: { book: 'livre-de-base', page: 1 },
      lockedUntil: { kind: 'flag', expr: 'porte-ouverte' },
    }]);
    expect(res.success).toBe(false);
    expect(res.success ? '' : res.error.issues.map((i) => i.message).join('\n')).toContain('« flag »');
  });
});

/**
 * Le verrou de TYPE (`lockedUntil`) est la DONNÉE du verrou ; `lockedReason` n'en est que le libellé,
 * chacun authorable SEUL au Codex. Sans libellé, le moteur rend la raison générique (`cond.locked`).
 * Un soin de Détermination NUL, lui, se dit par l'absence du champ (`LDB 17 l.61`).
 */
describe('etats.json — verrou de type sans libellé, et soin de Détermination', () => {
  const etat = (extra: Record<string, unknown>) => ([{
    id: 'x', type: 'etats', label: 'X', desc: 'x', source: { book: 'livre-de-base', page: 1 }, ...extra,
  }]);
  const pbPleins = { kind: 'compare', subject: { who: 'target', field: 'woundsCurrent' }, op: '>=', value: 1 } as const;

  afterEach(() => resetData());

  it('chaque champ du verrou s’authore SEUL, et un verrou sans libellé rend la raison générique', () => {
    expect(etatsSchema.safeParse(etat({ lockedUntil: pbPleins })).success).toBe(true);
    expect(etatsSchema.safeParse(etat({ lockedReason: 'parce que' })).success).toBe(true);
    setDataset('etats', etats.map((e) => (e.id === 'sonne' ? { ...e, lockedUntil: pbPleins as unknown as Condition } : e)));
    const c = mk();
    c.wounds.current = 0;
    addCondition(c, 'sonne', 1);
    const inst = c.conditions.find((x) => x.id === 'sonne')!;
    expect(isConditionLocked(inst, c), 'le verrou de TYPE tient, libellé ou non').toBe(true);
    expect(raisonVerrouEtat(inst, c)).toBe(t('cond.locked'));
    // TÉMOIN — l'État qui PORTE son libellé authoré rend celui-là, jamais le générique.
    const d = mk();
    d.wounds.current = 0;
    addCondition(d, 'a-terre', 1);
    expect(raisonVerrouEtat(d.conditions[0], d)).toBe(findConditionById('a-terre')!.lockedReason);
  });

  it('un soin de Détermination nul ou fractionnaire est refusé', () => {
    expect(etatsSchema.safeParse(etat({ resolveHeals: 1 })).success).toBe(true);
    expect(etatsSchema.safeParse(etat({ resolveHeals: 0 })).success, '0 n’est pas un soin : l’absence du champ le dit').toBe(false);
    expect(etatsSchema.safeParse(etat({ resolveHeals: 1.5 })).success).toBe(false);
  });
});
