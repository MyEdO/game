import { describe, it, expect } from 'vitest';
import { combatTestPenalty, combatTestPenaltyParts, testStatePenalty, meleeAttackerBonus, addCondition, COND } from './conditions';
import { conditionModLines, baseTestModLines, baseTestMods, defenseModifiers, GRAPPLE_TEST_CTX } from './combat';
import type { Combatant } from './types';
import { etats, findConditionById, refLabel } from '../data';
import { setDataset } from '../data/overrides';
import { t } from '../i18n';

const mk = (): Combatant => ({
  id: 'x', name: 'X', kind: 'hero', characteristics: {}, skills: [], talents: [], traits: [],
  conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: [],
  wounds: { current: 10, max: 10, base: 10 }, advantage: 0,
}) as unknown as Combatant;

describe('Hémorragique : −10 par pion aux Tests de résistance aux infections (LDB 16 l.105, l.11, #1138)', () => {
  const saignant = (pions: number) => { const c = mk(); for (let i = 0; i < pions; i++) addCondition(c, COND.hemorragique); return c; };
  it('Blessure Purulente, Infection Mineure, Infection du Sang : −10 × pions', () => {
    for (const disease of ['blessure-purulente', 'infection-mineure', 'infection-du-sang']) {
      expect(combatTestPenalty(saignant(1), { skill: 'resistance', disease })).toBe(-10);
      expect(combatTestPenalty(saignant(3), { skill: 'resistance', disease })).toBe(-30);
      expect(testStatePenalty(saignant(2), 'resistance', { disease })).toBe(-20);
    }
  });
  it('aucune pénalité hors de ces maladies, ni sans maladie au contexte', () => {
    expect(combatTestPenalty(saignant(2), { skill: 'resistance', disease: 'pneumonie' })).toBe(0);
    expect(combatTestPenalty(saignant(2), { skill: 'corps-a-corps' })).toBe(0);
    expect(testStatePenalty(saignant(2), 'resistance')).toBe(0);
  });
});

describe('pénalités de Test d’État lues en DONNÉES (etats.json passive testMod)', () => {
  describe('combat (combatTestPenalty)', () => {
    it('Sonné → −10', () => { const c = mk(); addCondition(c, COND.sonne); expect(combatTestPenalty(c)).toBe(-10); });
    it('Exténué ×2 → −20 (perStack)', () => { const c = mk(); addCondition(c, COND.extenue); addCondition(c, COND.extenue); expect(combatTestPenalty(c)).toBe(-20); });
    it('non-cumul (LDB 16 l.13) : Sonné + Exténué×3 → le PIRE seul (−30)', () => {
      const c = mk(); addCondition(c, COND.sonne); addCondition(c, COND.extenue); addCondition(c, COND.extenue); addCondition(c, COND.extenue);
      expect(combatTestPenalty(c)).toBe(-30);
    });
    it('Aveuglé → −10 aux Tests d’Arme et d’Esquive, 0 à un Test sans la vue (LDB 16 l.45)', () => {
      const c = mk(); addCondition(c, COND.aveugle);
      expect(combatTestPenalty(c, { skill: 'corps-a-corps' })).toBe(-10);
      expect(combatTestPenalty(c, { skill: 'esquive' })).toBe(-10);
      expect(combatTestPenalty(c, { skill: 'resistance' })).toBe(0);
    });
    it('À Terre → 0 (pénalité de DÉPLACEMENT, pas un Test de combat)', () => { const c = mk(); addCondition(c, COND.aTerre); expect(combatTestPenalty(c)).toBe(0); });
    it('Assourdi → 0 en combat (pénalité d’AUDITION, pas un Test de combat — LDB 16 l.29)', () => { const c = mk(); addCondition(c, COND.assourdi); expect(combatTestPenalty(c)).toBe(0); });
  });
  describe('hors combat (testStatePenalty)', () => {
    it('Aveuglé → −10 à la Perception par la vue, 0 par l’ouïe (LDB 16 l.45)', () => {
      const c = mk(); addCondition(c, COND.aveugle);
      expect(testStatePenalty(c, 'perception')).toBe(-10);
      expect(testStatePenalty(c, 'perception', { sense: 'vue' })).toBe(-10);
      expect(testStatePenalty(c, 'perception', { sense: 'ouie' })).toBe(0);
      expect(testStatePenalty(c, 'charme')).toBe(0);
    });
    it('Assourdi → 0 à la Perception par la vue (LDB 16 l.29)', () => { const c = mk(); addCondition(c, COND.assourdi); expect(testStatePenalty(c, 'perception', { sense: 'vue' })).toBe(0); });
    it('À Terre → −20 sur un Test de DÉPLACEMENT (Athlétisme)', () => { const c = mk(); addCondition(c, COND.aTerre); expect(testStatePenalty(c, 'athletisme')).toBe(-20); });
    it('À Terre → 0 sur un Test NON-déplacement (Perception)', () => { const c = mk(); addCondition(c, COND.aTerre); expect(testStatePenalty(c, 'perception')).toBe(0); });
    it('Brisé → −10 sauf course/dissimulation', () => {
      const c = mk(); addCondition(c, COND.brise);
      expect(testStatePenalty(c, 'perception')).toBe(-10);
      expect(testStatePenalty(c, 'athletisme')).toBe(0);
      expect(testStatePenalty(c, 'discretion')).toBe(0);
    });
    it('Empêtré → −10 sur un Test de déplacement seulement', () => {
      const c = mk(); addCondition(c, COND.empetre);
      expect(testStatePenalty(c, 'escalade')).toBe(-10);
      expect(testStatePenalty(c, 'perception')).toBe(0);
    });
    it('Assourdi → −10 sur un Test d’AUDITION (Perception) seulement (LDB 16 l.29)', () => {
      const c = mk(); addCondition(c, COND.assourdi);
      expect(testStatePenalty(c, 'perception')).toBe(-10); // Perception = hearing:true
      expect(testStatePenalty(c, 'athletisme')).toBe(0); // pas un Test d'audition
    });
  });
  // Cumul du MÊME État : les pénalités s'additionnent (LDB 16 l.11) — le « pire seul » (l.13) ne
  // départage que des États DIFFÉRENTS, après multiplication par les pions.
  describe('cumul du même État (perStack, LDB 16 l.11)', () => {
    it('Brisé ×3 → −30 (combat ET hors combat), sauf course/dissimulation', () => {
      const c = mk(); addCondition(c, COND.brise); addCondition(c, COND.brise); addCondition(c, COND.brise);
      expect(combatTestPenalty(c)).toBe(-30);
      expect(testStatePenalty(c, 'perception')).toBe(-30);
      expect(testStatePenalty(c, 'athletisme')).toBe(0);
      expect(testStatePenalty(c, 'discretion')).toBe(0);
    });
    it('Sonné ×2 → −20', () => {
      const c = mk(); addCondition(c, COND.sonne); addCondition(c, COND.sonne);
      expect(combatTestPenalty(c)).toBe(-20);
    });
    it('Empoisonné ×3 → −30', () => {
      const c = mk(); addCondition(c, COND.empoisonne); addCondition(c, COND.empoisonne); addCondition(c, COND.empoisonne);
      expect(combatTestPenalty(c)).toBe(-30);
    });
    it('Aveuglé ×2 → −20 à un Test d’Arme', () => {
      const c = mk(); addCondition(c, COND.aveugle); addCondition(c, COND.aveugle);
      expect(combatTestPenalty(c, { skill: 'corps-a-corps' })).toBe(-20);
    });
    it('Assourdi ×2 → −20 sur un Test d’audition', () => {
      const c = mk(); addCondition(c, COND.assourdi); addCondition(c, COND.assourdi);
      expect(testStatePenalty(c, 'perception')).toBe(-20);
    });
    it('Empêtré ×2 → −20 sur un Test de déplacement', () => {
      const c = mk(); addCondition(c, COND.empetre); addCondition(c, COND.empetre);
      expect(testStatePenalty(c, 'escalade')).toBe(-20);
    });
    it('Assourdi ×3 : le bonus de flanc/dos reste +10 (LDB 16 l.29)', () => {
      const c = mk(); addCondition(c, COND.assourdi); addCondition(c, COND.assourdi); addCondition(c, COND.assourdi);
      expect(meleeAttackerBonus(c, { flankRear: true })).toBe(10);
    });
    it('À Terre ne se cumule pas (LDB 16 l.37) : 2 pions → toujours −20', () => {
      const c = mk(); addCondition(c, COND.aTerre); addCondition(c, COND.aTerre);
      expect(testStatePenalty(c, 'athletisme')).toBe(-20);
    });
    it('MIXTE : Brisé ×3 + Sonné ×1 → −30 (le pire POOL après ×pions, LDB 16 l.13)', () => {
      const c = mk(); addCondition(c, COND.brise); addCondition(c, COND.brise); addCondition(c, COND.brise); addCondition(c, COND.sonne);
      expect(combatTestPenalty(c)).toBe(-30);
      expect(testStatePenalty(c, 'perception')).toBe(-30);
    });
  });
  // TÉMOIN INVERSE : c'est la DONNÉE (`perStack` de l'entrée) qui gouverne le cumul, pas le code.
  it('la donnée gouverne : sans `perStack` sur l’entrée `brise`, Brisé ×3 retombe à −10', () => {
    expect(findConditionById(COND.brise)!.perStack).toBe(true);
    const avant = [...etats];
    setDataset('etats', etats.map((e) => {
      if (e.id !== COND.brise) return e;
      const { perStack: _omis, ...sans } = e;
      return sans;
    }));
    try {
      const c = mk(); addCondition(c, COND.brise); addCondition(c, COND.brise); addCondition(c, COND.brise);
      expect(combatTestPenalty(c)).toBe(-10);
    } finally {
      setDataset('etats', avant);
    }
    const c2 = mk(); addCondition(c2, COND.brise); addCondition(c2, COND.brise); addCondition(c2, COND.brise);
    expect(combatTestPenalty(c2)).toBe(-30);
  });
});

/**
 * CONTRAT (ref #1117 L4) — une pénalité d'État se rend au NOM de l'État qui l'octroie (« Brisé »,
 * « Sonné »), jamais sous une étiquette de famille (« État »), et porte son renvoi Codex (le popover
 * de `ModChip` naît de `ModLine.ref`). Le pool non-cumul (LDB 16 l.13) rend UNE ligne : celle du gagnant.
 */
describe('composantes NOMMÉES de la pénalité de Test (combatTestPenaltyParts)', () => {
  const nommee = (category: string, id: string, value: number) => ({ label: refLabel(category, { id }), value, famille: 'jet', ref: { category, id } });
  it('Brisé ×3 seul → une ligne « Brisé » −30, liée à sa fiche d’État', () => {
    const c = mk(); addCondition(c, COND.brise); addCondition(c, COND.brise); addCondition(c, COND.brise);
    expect(combatTestPenaltyParts(c)).toEqual([nommee('etats', 'brise', -30)]);
  });

  it('mixte Brisé ×3 + Sonné : le PIRE seul, et c’est LUI qui est nommé (−30 Brisé, pas « État »)', () => {
    const c = mk(); addCondition(c, COND.sonne);
    addCondition(c, COND.brise); addCondition(c, COND.brise); addCondition(c, COND.brise);
    expect(combatTestPenaltyParts(c)).toEqual([nommee('etats', 'brise', -30)]);
  });

  it('Sonné seul → « Sonné » −10', () => {
    const c = mk(); addCondition(c, COND.sonne);
    expect(combatTestPenaltyParts(c)).toEqual([nommee('etats', 'sonne', -10)]);
  });

  it('ex æquo (Sonné −10 puis Empoisonné −10) : départage DÉTERMINISTE — le premier collecté', () => {
    const c = mk(); addCondition(c, COND.sonne); addCondition(c, COND.empoisonne);
    expect(combatTestPenaltyParts(c).map((p) => p.ref)).toEqual([{ category: 'etats', id: 'sonne' }]);
    const c2 = mk(); addCondition(c2, COND.empoisonne); addCondition(c2, COND.sonne);
    expect(combatTestPenaltyParts(c2).map((p) => p.ref)).toEqual([{ category: 'etats', id: 'empoisonne' }]);
  });

  it('AURA de trait (Perturbant −20 projeté dans auraMods) : nommée par SON trait, à côté de l’État (pools distincts, LDB 85 l.262)', () => {
    const c = mk(); addCondition(c, COND.sonne);
    c.auraMods = [{ op: { op: 'testMod', amount: -20 }, src: { category: 'traits', id: 'perturbant' } }];
    expect(combatTestPenaltyParts(c)).toEqual([nommee('etats', 'sonne', -10), nommee('traits', 'perturbant', -20)]);
  });

  it('ce qui STACKE garde SA ligne : l’effet actif n’est pas fondu dans celle de l’État', () => {
    const c = mk(); addCondition(c, COND.sonne);
    const malediction = { label: 'Malédiction de malchance', bonus: 0, duration: { scale: 'rounds' as const, left: 3 }, testMod: -10, source: { kind: 'spell' as const, id: 'malediction-de-malchance' } };
    c.activeEffects = [malediction];
    expect(combatTestPenaltyParts(c)).toEqual([
      nommee('etats', 'sonne', -10),
      { label: malediction.label, value: -10, famille: 'jet', ref: { category: 'spells', id: 'malediction-de-malchance' } },
    ]);
    expect(combatTestPenalty(c)).toBe(-20); // la Σ des composantes = la valeur roulée
  });

  it('les trois producteurs servent ces MÊMES lignes (source unique conditionModLines)', () => {
    const c = mk(); addCondition(c, COND.brise);
    const expected = nommee('etats', 'brise', -10);
    expect(conditionModLines(c)).toContainEqual(expected);
    expect(baseTestModLines(c)).toContainEqual(expected);
    expect(defenseModifiers(c, 'esquive')).toContainEqual(expected);
  });

  it('identité DÉBRANCHÉE : la chip retombe MUETTE, sur la nature de SA famille — jamais celle d’une autre', () => {
    const aura = mk();
    aura.auraMods = [{ op: { op: 'testMod', amount: -20 } }]; // op projetée sans son trait émetteur
    // Une aura est un TRAIT : dégradée, elle ne s'annonce pas « État » (le gate `ignoreStatePenalties`
    // ne l'annule d'ailleurs pas, LDB 42) — le joueur lirait une règle qui ne la gouverne pas.
    expect(combatTestPenaltyParts(aura)).toEqual([{ label: t('cond.natureAura'), value: -20, famille: 'jet', ref: undefined }]);
    // Et une aura IDENTIFIÉE à côté d'un État : chacun garde son nom.
    const mixte = mk(); addCondition(mixte, COND.sonne);
    mixte.auraMods = [{ op: { op: 'testMod', amount: -20 }, src: { category: 'traits', id: 'perturbant' } }];
    expect(combatTestPenaltyParts(mixte).map((p) => p.ref)).toEqual([{ category: 'etats', id: 'sonne' }, { category: 'traits', id: 'perturbant' }]);
  });
});

describe('pools distincts, sommés entre eux (LDB 14 l.95)', () => {
  const effet = (id: string, kind: 'spell' | 'trapping', testMod: number) => ({ label: id, bonus: 0, duration: { scale: 'rounds', left: 3 }, source: { kind, id }, testMod });
  it('testMod global de Sorts : la pire pénalité seule (LDB 46 l.119)', () => {
    const c = mk(); c.activeEffects = [effet('s1', 'spell', -10), effet('s2', 'spell', -20)] as never;
    expect(combatTestPenalty(c)).toBe(-20);
    expect(testStatePenalty(c, 'charme')).toBe(-20);
  });
  it('testMod global d’un objet et d’un Sort : sommés', () => {
    const c = mk(); c.activeEffects = [effet('o', 'trapping', -10), effet('s', 'spell', -10)] as never;
    expect(combatTestPenalty(c)).toBe(-20);
  });
  it('aura : son propre pool (« une seule fois », LDB 85 l.262), sommé avec le pool des États (LDB 16 l.13)', () => {
    const c = mk(); addCondition(c, COND.sonne);
    c.auraMods = [{ op: { op: 'testMod', amount: -20 } }, { op: { op: 'testMod', amount: -20 } }] as never;
    expect(combatTestPenalty(c)).toBe(-30);
  });
});

describe('pénalités de déplacement en combat (LDB 16 l.35, l.64 ; LDB 14 l.77)', () => {
  it('À Terre : −20 à l’Esquive, 0 à un Test d’Arme', () => {
    const c = mk(); addCondition(c, COND.aTerre);
    expect(combatTestPenalty(c, { skill: 'esquive' })).toBe(-20);
    expect(combatTestPenalty(c, { skill: 'corps-a-corps' })).toBe(0);
  });
  it('Empêtré : −10 au Test de Force d’Empoignade', () => {
    const c = mk(); addCondition(c, COND.empetre);
    expect(baseTestMods(c, 'force', GRAPPLE_TEST_CTX)).toBe(-10);
    expect(baseTestMods(c, 'force')).toBe(0);
  });
});
