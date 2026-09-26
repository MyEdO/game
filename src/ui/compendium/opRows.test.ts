import { describe, it, expect } from 'vitest';
import type { GameOp } from '../../engine/ops';
// `newOp`/`OP_LABEL` (générateur d'échantillon + énumération EXHAUSTIVE des kinds `GameOp['op']`,
// `Record` complet forcé par TS) sont importés depuis l'ATELIER — LÉGITIME ici : les fichiers `*.test.*`
// sont hors du scan de `editor-quarantine-guard.test.ts` (la quarantaine porte sur le code applicatif,
// pas les tests qui vérifient le renderer joueur contre le vocabulaire d'atelier).
import { newOp, OP_LABEL, OP_REF_FIELDS, opRefValue, opWithRefValue } from '../editor/GameOpEditor';
import { datasetArray } from '../../data/overrides';
import { opRow, opRows, tableRows } from './opRows';
import { humanizeOp } from './humanize';
import { codexLookupById } from './registry';
import { characteristics, talents, skills, traits, psychologies, etats, trappings, maladies, symptoms, creatures, mutations, findSymptomById, effectTables } from '../../data';
import type { CharKey } from '../../engine/types';
import { psychBranchOps } from '../../engine/psychology';
import { spellOps } from '../../engine/flowCore';

const ALL_KINDS = Object.keys(OP_LABEL) as GameOp['op'][];

/** Ancres attendues (minimum imposé par le brief #495) — kind → catégorie Codex. */
const EXPECTED_ANCHOR: Partial<Record<GameOp['op'], string>> = {
  charMod: 'characteristics',
  grantTalent: 'talents',
  condition: 'etats',
  grantCareerSkill: 'skills',
};

/** Échantillon COMPLET d'un kind. `newOp` n'ÉLIT aucune réf de registre (l'auteur choisit) : l'échantillon
 *  les renseigne avec une entrée RÉELLE de leur dataset, sinon ce renderer ne mesurerait qu'une op à
 *  compléter. `narrative` : même idée sur son texte (le défaut d'atelier est vide par nature). */
function sample(kind: GameOp['op']): GameOp {
  if (kind === 'narrative') return { op: 'narrative', text: 'Un effet non modélisé, RAW verbatim.' };
  let o = { ...newOp(kind) } as Record<string, unknown>;
  for (const f of OP_REF_FIELDS[kind] ?? []) {
    const v = opRefValue(o, f.field);
    if (v == null || v === '') o = opWithRefValue(o, f.field, (datasetArray(f.ds) as { id?: string }[])[0]?.id);
  }
  return o as unknown as GameOp;
}

describe('opRows — renderer JOUEUR de GameOp[] (#495)', () => {
  it('couvre TOUS les kinds de GameOp (jamais de ligne vide)', () => {
    for (const kind of ALL_KINDS) {
      const row = opRow(sample(kind));
      expect(row, `kind ${kind} : pas de ligne produite`).toBeTruthy();
      if (row.t === 'ref') {
        expect(row.label, `kind ${kind} : label vide`).not.toBe('');
        expect(row.show, `kind ${kind} : show vide`).not.toBe('');
        expect(row.category, `kind ${kind} : category vide`).not.toBe('');
      } else if (row.t === 'text') {
        expect(row.text, `kind ${kind} : text vide`).not.toBe('');
      } else {
        throw new Error(`kind ${kind} : type de ligne inattendu ${row.t}`);
      }
    }
  });

  it('les kinds à ancre nominative produisent une chip `ref` de la bonne catégorie', () => {
    for (const [kind, category] of Object.entries(EXPECTED_ANCHOR)) {
      const row = opRow(newOp(kind as GameOp['op']));
      expect(row.t, `kind ${kind} : attendu t:'ref'`).toBe('ref');
      if (row.t === 'ref') expect(row.category, `kind ${kind} : mauvaise catégorie`).toBe(category);
    }
  });

  it('opRows(ops) mappe 1:1 et dans l’ordre', () => {
    const ops: GameOp[] = [newOp('charMod'), newOp('grantTalent'), newOp('kill')];
    const rows = opRows(ops);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.t)).toEqual(['ref', 'ref', 'text']);
  });

  /** Spot-check : un `t:'text'` (repli `humanizeOp`, registre JOUEUR déjà résolveur) ne laisse jamais
   *  fuiter un id BRUT (kebab-case) porté par le champ de l'op elle-même — les labels sont résolus. */
  it('aucun repli texte ne laisse fuiter un id brut kebab-case de son propre op', () => {
    const KEBAB_RX = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
    for (const kind of ALL_KINDS) {
      const op = sample(kind);
      const row = opRow(op);
      if (row.t !== 'text') continue;
      for (const v of Object.values(op as Record<string, unknown>)) {
        if (typeof v === 'string' && KEBAB_RX.test(v)) {
          expect(row.text, `kind ${kind} : id brut « ${v} » visible dans le texte`).not.toContain(v);
        }
      }
    }
  });

  /** Résolvabilité des ancres — DATA-DRIVEN (zéro id en dur) : chaque kind à ancre nominative
   *  d'`opRows.ts` produit un `{t:'ref'}` dont l'id RÉSOUT réellement dans le Codex (même lookup
   *  que `CodexRef.tsx:90`, `codexLookupById`). L'id de fixture est le PREMIER item du dataset réel
   *  de la catégorie visée — une dérive id↔catégorie future (mauvais champ, mauvaise catégorie,
   *  dataset renommé) casse ce test au lieu de fuiter en silence sur une chip Codex morte. */
  const ANCHOR_FIXTURES: { kind: GameOp['op']; category: string; build: () => GameOp }[] = [
    { kind: 'charMod', category: 'characteristics', build: () => ({ op: 'charMod', char: characteristics[0].id as CharKey, mod: -10 }) },
    { kind: 'charDRBonus', category: 'characteristics', build: () => ({ op: 'charDRBonus', char: characteristics[0].id as CharKey, bonus: 1 }) },
    // Mouvement/Blessure voyagent par leur propre famille d'ops (hors `CharKey`) mais s'affichent
    // COMME une Caractéristique (arbitrage user 2026-07-17) — même catégorie `characteristics`.
    { kind: 'moveMod', category: 'characteristics', build: () => ({ op: 'moveMod', mod: -1 }) },
    { kind: 'moveScale', category: 'characteristics', build: () => ({ op: 'moveScale', num: 1, den: 2 }) },
    { kind: 'wounds', category: 'characteristics', build: () => ({ op: 'wounds', amount: 1 }) },
    { kind: 'grantTalent', category: 'talents', build: () => ({ op: 'grantTalent', talentId: talents[0].id }) },
    { kind: 'grantCareerTalent', category: 'talents', build: () => ({ op: 'grantCareerTalent', talentId: talents[0].id }) },
    { kind: 'grantCareerSkill', category: 'skills', build: () => ({ op: 'grantCareerSkill', skill: { id: skills[0].id } }) },
    { kind: 'skillMod', category: 'skills', build: () => ({ op: 'skillMod', skill: { id: skills[0].id }, mod: -10 }) },
    { kind: 'skillDRBonus', category: 'skills', build: () => ({ op: 'skillDRBonus', skill: { id: skills[0].id }, bonus: 1 }) },
    { kind: 'grantTrait', category: 'traits', build: () => ({ op: 'grantTrait', traitId: traits[0].id }) },
    { kind: 'grantPsychTrait', category: 'psychologies', build: () => ({ op: 'grantPsychTrait', psychType: psychologies[0].id }) },
    { kind: 'removePsychTrait', category: 'psychologies', build: () => ({ op: 'removePsychTrait', psychType: psychologies[0].id }) },
    { kind: 'endPsych', category: 'psychologies', build: () => ({ op: 'endPsych', type: psychologies[0].id }) },
    { kind: 'condition', category: 'etats', build: () => ({ op: 'condition', id: etats[0].id }) },
    { kind: 'removeCondition', category: 'etats', build: () => ({ op: 'removeCondition', id: etats[0].id }) },
    { kind: 'giveTrapping', category: 'trappings', build: () => ({ op: 'giveTrapping', trappingId: trappings[0].id }) },
    { kind: 'contractDisease', category: 'maladies', build: () => ({ op: 'contractDisease', disease: maladies[0].id }) },
    { kind: 'exposeDisease', category: 'maladies', build: () => ({ op: 'exposeDisease', disease: maladies[0].id }) },
    { kind: 'reduceDiseaseDays', category: 'maladies', build: () => ({ op: 'reduceDiseaseDays', disease: maladies[0].id, days: 1 }) },
    { kind: 'suppressSymptom', category: 'symptoms', build: () => ({ op: 'suppressSymptom', symptomId: symptoms[0].id }) },
    { kind: 'summon', category: 'creatures', build: () => ({ op: 'summon', ref: creatures[0].id, count: 1 }) },
    { kind: 'scheduleRespawn', category: 'creatures', build: () => ({ op: 'scheduleRespawn', ref: creatures[0].id, delayDays: 1 }) },
    { kind: 'polymorph', category: 'creatures', build: () => ({ op: 'polymorph', ref: creatures[0].id }) },
    { kind: 'transform', category: 'creatures', build: () => ({ op: 'transform', tag: 'x', ops: [], morphRef: creatures[0].id }) },
  ];

  it('couvre chaque kind ancré (10 catégories) et résout réellement dans le Codex', () => {
    const coveredCategories = new Set(ANCHOR_FIXTURES.map((f) => f.category));
    expect(coveredCategories.size, 'attendu 10 catégories Codex couvertes').toBe(10);

    for (const fixture of ANCHOR_FIXTURES) {
      const row = opRow(fixture.build());
      expect(row.t, `kind ${fixture.kind} : attendu t:'ref'`).toBe('ref');
      if (row.t !== 'ref') continue;
      expect(row.category, `kind ${fixture.kind} : mauvaise catégorie`).toBe(fixture.category);
      const resolved = codexLookupById(row.category, row.id);
      expect(resolved, `kind ${fixture.kind} : id « ${row.id} » (catégorie ${row.category}) ne résout à AUCUN item Codex`).toBeTruthy();
    }
  });

  /** ref #540 : la vue LECTURE doit montrer les rangées d'un `rollTable` — vérifié sur les données
   *  RÉELLES (vers-de-carie, `symptoms.json`), jamais un fixture inventé. */
  describe('rollTable — rangées EXPANSÉES (ref #540)', () => {
    it('rollTable INLINE (vers-de-carie, MSRC 16 l.90-101) : 8 rangées visibles, sous-titre + ops', () => {
      const s = findSymptomById('vers-de-carie');
      expect(s?.onTick).toBeTruthy();
      const rows = opRows(spellOps(s!.onTick!.test!.fail, 'target'));
      const subs = rows.filter((r) => r.t === 'sub');
      expect(subs).toHaveLength(8);
      expect(subs.map((r) => (r as { t: 'sub'; label: string }).label)).toEqual([
        '1–2', '3–4', '5–6', '7–8', '9', '10', '11–12', '13–99',
      ]);
      // chaque rangée porte au moins une ligne d'op (chip ref ou texte) après son sous-titre.
      const kill = rows[rows.length - 1];
      expect(kill.t).toBe('text'); // `kill` n'a pas d'ancre nominative → repli texte humanisé
    });

    it('rollTable par `tableId` (allure-demoniaque-nurgle, EDOC 13 l.234-245) : rangées de la table référencée, résolue via effectTables', () => {
      const table = effectTables.find((t) => t.id === 'allure-demoniaque-nurgle');
      expect(table).toBeTruthy();
      const rows = opRows([{ op: 'rollTable', tableId: 'allure-demoniaque-nurgle' }]);
      const subs = rows.filter((r) => r.t === 'sub');
      expect(subs).toHaveLength(table!.rows.length);
      // Rangée 1 → Trait « Grand » (grantTrait, ancré catégorie traits).
      const firstOpRow = rows[1];
      expect(firstOpRow.t).toBe('ref');
      if (firstOpRow.t === 'ref') expect(firstOpRow.category).toBe('traits');
    });

    it('rangée IMBRIQUÉE portant `rollMutation` (allure-demoniaque-nurgle, rangée 8) : lien codex vers la table de Corruption, pas d’expansion', () => {
      const rows = tableRows(effectTables.find((t) => t.id === 'allure-demoniaque-nurgle')!.rows);
      const mutationRow = rows.find((r) => r.t === 'ref' && r.category === 'mutationTables');
      expect(mutationRow, 'aucune ligne « mutationTables » — la rangée Mutation ne se rend pas en lien codex').toBeTruthy();
      if (mutationRow?.t === 'ref') {
        expect(mutationRow.id).toBe('edoc-phys-nurgle');
        const resolved = codexLookupById('mutationTables', mutationRow.id);
        expect(resolved, `id « ${mutationRow.id} » ne résout à aucune Table de Corruption`).toBeTruthy();
      }
    });

    it('table IMBRIQUÉE dans une rangée déjà expansée (rollTable → rollTable) : libellé + lien codex, jamais ré-expansée (borne l’imbrication)', () => {
      const nested: import('../../engine/ops').GameOp = {
        op: 'rollTable',
        die: 'd10',
        rows: [{ min: 1, max: 10, ops: [{ op: 'rollTable', tableId: 'allure-demoniaque-nurgle' }] }],
      };
      const rows = opRows([nested]);
      // 1 sous-titre (rangée de tête) + 1 chip ref vers la table imbriquée — PAS ses 10 sous-rangées.
      expect(rows).toHaveLength(2);
      expect(rows[1].t).toBe('ref');
      if (rows[1].t === 'ref') {
        expect(rows[1].category).toBe('effectTables');
        expect(rows[1].id).toBe('allure-demoniaque-nurgle');
      }
    });
  });

  /** Accord réel singulier/pluriel (juge vision 2026-07-17) — jamais le pluriel-code « (s) ». */
  it('accorde Blessure(s)/Round(s) au réel — singulier à 1, pluriel sinon', () => {
    const one = opRow({ op: 'wounds', amount: 1 });
    const two = opRow({ op: 'wounds', amount: 2 });
    expect(one.t).toBe('ref');
    expect(two.t).toBe('ref');
    if (one.t === 'ref') expect(one.show).toBe('1 Blessure');
    if (two.t === 'ref') expect(two.show).toBe('2 Blessures');

    const cond1 = opRow({ op: 'condition', id: etats[0].id, durationRounds: 1 });
    const cond3 = opRow({ op: 'condition', id: etats[0].id, durationRounds: 3 });
    expect(cond1.t).toBe('ref');
    expect(cond3.t).toBe('ref');
    if (cond1.t === 'ref') expect(cond1.badge).toBe('1 Round');
    if (cond3.t === 'ref') expect(cond3.badge).toBe('3 Rounds');
  });

  /** CAUSE PERSISTANTE (`LDB 16 l.117`) : une op `condition` récurrente GATÉE sur l'État qu'elle pose ne
   *  dit pas « un État de plus par Round » — elle dit la PERSISTANCE, du même mot que le journal. */
  it('la chip d’une cause PERSISTANTE dit la persistance, là où un `perRound` nu dit « par Round »', () => {
    const [etat] = etats;
    const nu = opRow({ op: 'condition', id: etat.id, perRound: true });
    const persistante = opRow({ op: 'condition', id: etat.id, perRound: true, unlessCondition: etat.id, durationRounds: 3 });
    expect(nu.t).toBe('ref');
    if (nu.t === 'ref') expect(nu.badge).toBe('par Round');
    expect(persistante.t).toBe('ref');
    if (persistante.t === 'ref') {
      expect(persistante.category).toBe('etats');
      expect(persistante.show, 'UNE chip d’État, pas un compte').toBe(etat.label);
      expect(persistante.badge).toBe('regagné à chaque fin de Round · 3 Rounds');
    }
    expect(humanizeOp({ op: 'condition', id: etat.id, perRound: true, unlessCondition: etat.id, durationRounds: 3 }))
      .toBe(`gagne l'État *${etat.label}*, regagné à chaque fin de Round pendant 3 Round(s)`);
  });

  /** #1224 écart 4 — LDB 21 l.19 : « Sur un succès […] vous ne subirez qu'une pénalité de -20 à vos
   *  Tests de Sociabilité envers ce groupe ». La branche de RÉUSSITE du Test de Psychologie n'est donc
   *  pas une issue vide : sa chip DIT la pénalité, dérivée de la MÊME donnée que `socialPsychMod`. */
  it('la chip de la branche RÉUSSIE d’un Trait ciblé dit son modificateur social « contenu »', () => {
    const [resiste] = psychBranchOps({ kind: 'animosite', cible: 'hommes-betes', indice: 0 }, { success: true });
    const row = opRow(resiste);
    expect(row.t).toBe('ref');
    if (row.t === 'ref') {
      expect(row.category).toBe('psychologies');
      expect(row.show).toBe('Animosité');
      expect(row.badge).toBe('hommes-betes · −20 Sociabilité');
    }
    // La branche d'ÉCHEC (affliction SUBIE) ne porte pas ce malus : le porteur est sous compulsion.
    const [subi] = psychBranchOps({ kind: 'animosite', cible: 'hommes-betes', indice: 0 }, { success: false });
    const rowFail = opRow(subi);
    if (rowFail.t === 'ref') expect(rowFail.badge).toBe('hommes-betes');
  });

  /** #1646 (L-ref-3) — la donnée porte l'ID de la spécialisation (`spec: 'odorat'`), l'ÉCRAN rend le
   *  LIBELLÉ : `refLabel('talents', …)` résout par `specs[].label` du catalogue. Sonde sur la donnée
   *  RÉELLE (`mutations.json`), pas sur une op forgée — c'est la chaîne d'affichage
   *  que la migration devait laisser intacte. */
  it('une `spec` en ID s’AFFICHE par son libellé de catalogue (« Sens aiguisé (Odorat) »)', () => {
    const attendus: [string, string][] = [
      ['tete-bestiale-chien', 'Sens aiguisé (Odorat)'],
      ['grandes-oreilles', 'Sens aiguisé (Ouïe)'],
      ['trois-yeux', 'Sens aiguisé (Vue)'],
    ];
    for (const [mutationId, libelle] of attendus) {
      const mutation = mutations.find((m) => m.id === mutationId)!;
      const op = (mutation.passive ?? []).find((o) => o.op === 'grantTalent')!;
      expect(op, mutationId).toBeTruthy();
      expect((op as { spec?: string }).spec, `${mutationId} : la donnée porte l'ID, jamais le libellé`)
        .toMatch(/^[a-z-]+$/);
      const row = opRow(op);
      expect(row.t).toBe('ref');
      if (row.t === 'ref') expect(row.show).toBe(libelle);
    }
  });
});
