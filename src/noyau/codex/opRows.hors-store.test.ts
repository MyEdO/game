import { describe, it, expect } from 'vitest';
import type { GameOp } from '../../engine/ops';
import { newOp } from '../valeursNeuves';
import { coDescendre } from '../../data/schemas/grammaire/descente';
import { gameOpSchema, OP_DEFS } from '../../data/schemas/grammaire/mecanique';
import { estFeuilleDId } from '../../data/schemas/grammaire/ref';
import { avecLaValeur } from '../edition/formulaire';
import { choixDuNoeud } from './editFields';
import { opRow, opRows, tableRows } from './opRows';
import { humanizeFormula, humanizeOp } from './humanize';
import { codexLookupById } from './registry';
import {
  talents,
  skills,
  traits,
  psychologies,
  etats,
  trappings,
  maladies,
  symptoms,
  creatures,
  mutations,
  findSymptomById,
  effectTables,
  groupLabel,
} from '../../data';
import { CHAR_KEYS } from '../../engine/types';
import { psychBranchOps } from '../../engine/psychology';
import { spellOps } from '../../engine/flowCore';
import { opPsy } from '../../engine/psych/opsPsy';
import { ciblePsy } from '../../engine/psych/ciblage';

const ALL_KINDS = Object.keys(OP_DEFS);

/** Ancres attendues (minimum imposé par le brief #495) — kind → catégorie Codex. */
const EXPECTED_ANCHOR: Partial<Record<GameOp['op'], string>> = {
  charMod: 'characteristics',
  grantTalent: 'talents',
  condition: 'etats',
  grantCareerSkill: 'skills',
};

/** Remplit les références laissées à choisir d'un brouillon depuis les choix de son schéma. */
function sample(kind: string): GameOp {
  const schema = OP_DEFS[kind];
  let brouillon = kind === 'narrative' ? { ...newOp(kind), text: 'Texte du journal.' } : newOp(kind);
  coDescendre(schema, brouillon, ({ noeuds, valeur, chemin }) => {
    if (valeur !== '') return;
    const feuille = noeuds.find(estFeuilleDId);
    if (!feuille) return;
    const choix = choixDuNoeud(feuille)?.[0];
    if (!choix) throw new Error(`${kind} : aucun choix offert sur ${chemin.join('.')}`);
    const ecrit = avecLaValeur(schema, brouillon, chemin, choix.valeur);
    if (!ecrit.ok) throw new Error(`${kind} : ${chemin.join('.')} refuse son choix ${String(choix.valeur)}`);
    brouillon = ecrit.valeur;
  });
  const parsed = gameOpSchema.safeParse(brouillon);
  if (!parsed.success) throw new Error(`${kind} : ${parsed.error.message}`);
  return parsed.data;
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
      const row = opRow(sample(kind));
      expect(row.t, `kind ${kind} : attendu t:'ref'`).toBe('ref');
      if (row.t === 'ref') expect(row.category, `kind ${kind} : mauvaise catégorie`).toBe(category);
    }
  });

  it('opRows(ops) mappe 1:1 et dans l’ordre', () => {
    const ops: GameOp[] = [sample('charMod'), sample('grantTalent'), sample('kill')];
    const rows = opRows(ops);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.t)).toEqual(['ref', 'ref', 'text']);
  });

  /** Les champs de l'op et les feuilles de référence de son schéma se lisent sous leurs libellés. */
  it('aucun repli texte ne laisse fuiter un id brut kebab-case de son propre op', () => {
    const KEBAB_RX = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
    for (const kind of ALL_KINDS) {
      const op = sample(kind);
      const row = opRow(op);
      if (row.t !== 'text') continue;
      const valeurs = new Set(Object.values(op));
      coDescendre(OP_DEFS[kind], op, ({ noeuds, valeur }) => {
        if (noeuds.some(estFeuilleDId)) valeurs.add(valeur);
      });
      for (const v of valeurs) {
        if (typeof v === 'string' && KEBAB_RX.test(v)) {
          expect(row.text, `kind ${kind} : id brut « ${v} » visible dans le texte`).not.toContain(v);
        }
      }
    }
  });

  /** Résolvabilité des ancres : chaque kind à ancre nominative
   *  d'`opRows.ts` produit un `{t:'ref'}` que `codexLookupById` résout.
   *  L'id de fixture est le PREMIER item du dataset réel
   *  de la catégorie visée, la première clé de `CHAR_KEYS` pour une Caractéristique — une dérive id↔catégorie future (mauvais champ, mauvaise catégorie,
   *  dataset renommé) casse ce test au lieu de fuiter en silence sur une chip Codex morte. */
  const ANCHOR_FIXTURES: { kind: GameOp['op']; category: string; build: () => GameOp }[] = [
    { kind: 'charMod', category: 'characteristics', build: () => ({ op: 'charMod', characteristic: CHAR_KEYS[0], mod: -10 }) },
    { kind: 'charDRBonus', category: 'characteristics', build: () => ({ op: 'charDRBonus', characteristic: CHAR_KEYS[0], bonus: 1 }) },
    // Mouvement/Blessure voyagent par leur propre famille d'ops (hors `CharKey`) mais s'affichent
    // COMME une Caractéristique (arbitrage user 2026-07-17) — même catégorie `characteristics`.
    { kind: 'moveMod', category: 'characteristics', build: () => ({ op: 'moveMod', mod: -1 }) },
    { kind: 'moveScale', category: 'characteristics', build: () => ({ op: 'moveScale', num: 1, den: 2 }) },
    { kind: 'wounds', category: 'characteristics', build: () => ({ op: 'wounds', amount: 1 }) },
    { kind: 'grantTalent', category: 'talents', build: () => ({ op: 'grantTalent', talent: { id: talents[0].id } }) },
    { kind: 'grantCareerTalent', category: 'talents', build: () => ({ op: 'grantCareerTalent', talent: { id: talents[0].id } }) },
    { kind: 'grantCareerSkill', category: 'skills', build: () => ({ op: 'grantCareerSkill', skill: { id: skills[0].id } }) },
    { kind: 'skillMod', category: 'skills', build: () => ({ op: 'skillMod', skill: { id: skills[0].id }, mod: -10 }) },
    { kind: 'skillDRBonus', category: 'skills', build: () => ({ op: 'skillDRBonus', skill: { id: skills[0].id }, bonus: 1 }) },
    { kind: 'grantTrait', category: 'traits', build: () => ({ op: 'grantTrait', trait: { id: traits[0].id } }) },
    { kind: 'grantPsychTrait', category: 'psychologies', build: () => opPsy.octroi(psychologies[0].id) },
    { kind: 'removePsychTrait', category: 'psychologies', build: () => opPsy.retrait(psychologies[0].id) },
    { kind: 'endPsych', category: 'psychologies', build: () => opPsy.fin(psychologies[0].id) },
    { kind: 'condition', category: 'etats', build: () => ({ op: 'condition', id: { id: etats[0].id } }) },
    { kind: 'removeCondition', category: 'etats', build: () => ({ op: 'removeCondition', id: { id: etats[0].id } }) },
    { kind: 'giveTrapping', category: 'trappings', build: () => ({ op: 'giveTrapping', objet: { id: trappings[0].id } }) },
    { kind: 'contractDisease', category: 'maladies', build: () => ({ op: 'contractDisease', disease: { id: maladies[0].id } }) },
    { kind: 'exposeDisease', category: 'maladies', build: () => ({ op: 'exposeDisease', disease: { id: maladies[0].id } }) },
    { kind: 'reduceDiseaseDays', category: 'maladies', build: () => ({ op: 'reduceDiseaseDays', disease: { id: maladies[0].id }, days: 1 }) },
    { kind: 'suppressSymptom', category: 'symptoms', build: () => ({ op: 'suppressSymptom', symptom: { id: symptoms[0].id } }) },
    { kind: 'summon', category: 'creatures', build: () => ({ op: 'summon', creature: { id: creatures[0].id }, count: 1 }) },
    { kind: 'scheduleRespawn', category: 'creatures', build: () => ({ op: 'scheduleRespawn', creature: { id: creatures[0].id }, delayDays: 1 }) },
    { kind: 'polymorph', category: 'creatures', build: () => ({ op: 'polymorph', creature: { id: creatures[0].id } }) },
    { kind: 'transform', category: 'creatures', build: () => ({ op: 'transform', tag: 'x', ops: [], creature: { id: creatures[0].id } }) },
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
      const rows = opRows(spellOps(s!.onTick!.test!.echec, 'target'));
      const subs = rows.filter((r) => r.t === 'sub');
      expect(subs).toHaveLength(8);
      expect(subs.map((r) => (r as { t: 'sub'; label: string }).label)).toEqual([
        '1–2', '3–4', '5–6', '7–8', '9', '10', '11–12', '13–99',
      ]);
      // chaque rangée porte au moins une ligne d'op (chip ref ou texte) après son sous-titre.
      const kill = rows[rows.length - 1];
      expect(kill.t).toBe('text'); // `kill` n'a pas d'ancre nominative → repli texte humanisé
    });

    it('rollTable par `table` (allure-demoniaque-nurgle, EDOC 13 l.234-245) : rangées de la table référencée, résolue via effectTables', () => {
      const table = effectTables.find((t) => t.id === 'allure-demoniaque-nurgle');
      expect(table).toBeTruthy();
      const rows = opRows([{ op: 'rollTable', table: { id: 'allure-demoniaque-nurgle' } }]);
      const subs = rows.filter((r) => r.t === 'sub');
      expect(subs).toHaveLength(table!.entries.length);
      // Rangée 1 → Trait « Grand » (grantTrait, ancré catégorie traits).
      const firstOpRow = rows[1];
      expect(firstOpRow.t).toBe('ref');
      if (firstOpRow.t === 'ref') expect(firstOpRow.category).toBe('traits');
    });

    it('un `rollTable` sur une table d100 écrit ses bandes sur les faces de son dé (AA Annexe II)', () => {
      const rows = opRows([{ op: 'rollTable', table: { id: 'contremaitre-lieu' } }]);
      expect(rows[0]).toEqual({ t: 'sub', label: '01–05 · Une cabane sinistre à l\'orée des bois.' });
    });

    it('rangée IMBRIQUÉE portant `rollMutation` (allure-demoniaque-nurgle, rangée 8) : lien codex vers la table de Corruption, pas d’expansion', () => {
      const rows = tableRows(effectTables.find((t) => t.id === 'allure-demoniaque-nurgle')!);
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
        die: { n: 1, sides: 10 },
        entries: [{ min: 1, max: 10, ops: [{ op: 'rollTable', table: { id: 'allure-demoniaque-nurgle' } }] }],
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

    const cond1 = opRow({ op: 'condition', id: { id: etats[0].id }, durationRounds: 1 });
    const cond3 = opRow({ op: 'condition', id: { id: etats[0].id }, durationRounds: 3 });
    expect(cond1.t).toBe('ref');
    expect(cond3.t).toBe('ref');
    if (cond1.t === 'ref') expect(cond1.badge).toBe('1 Round');
    if (cond3.t === 'ref') expect(cond3.badge).toBe('3 Rounds');
  });

  /** CAUSE PERSISTANTE (`LDB 16 l.117`) : une op `condition` récurrente GATÉE sur l'État qu'elle pose ne
   *  dit pas « un État de plus par Round » — elle dit la PERSISTANCE, du même mot que le journal. */
  it('la chip d’une cause PERSISTANTE dit la persistance, là où un `perRound` nu dit « par Round »', () => {
    const [etat] = etats;
    const nu = opRow({ op: 'condition', id: { id: etat.id }, perRound: true });
    const persistante = opRow({ op: 'condition', id: { id: etat.id }, perRound: true, unlessCondition: { id: etat.id }, durationRounds: 3 });
    expect(nu.t).toBe('ref');
    if (nu.t === 'ref') expect(nu.badge).toBe('par Round');
    expect(persistante.t).toBe('ref');
    if (persistante.t === 'ref') {
      expect(persistante.category).toBe('etats');
      expect(persistante.show, 'UNE chip d’État, pas un compte').toBe(etat.label);
      expect(persistante.badge).toBe('regagné à chaque fin de Round · 3 Rounds');
    }
    expect(humanizeOp({ op: 'condition', id: { id: etat.id }, perRound: true, unlessCondition: { id: etat.id }, durationRounds: 3 }))
      .toBe(`gagne l'État *${etat.label}*, regagné à chaque fin de Round pendant 3 Rounds`);
  });

  /** #1224 écart 4 — LDB 21 l.19 : « Sur un succès […] vous ne subirez qu'une pénalité de -20 à vos
   *  Tests de Sociabilité envers ce groupe ». La branche de RÉUSSITE du Test de Psychologie n'est donc
   *  pas une issue vide : sa chip DIT la pénalité, dérivée de la MÊME donnée que `socialPsychMod`. */
  it('la chip de la branche RÉUSSIE d’un Trait ciblé dit son modificateur social « contenu »', () => {
    const [resiste] = psychBranchOps({ kind: 'animosite', cible: ciblePsy.groupe('homme-bete'), indice: 0 }, { success: true });
    const row = opRow(resiste);
    expect(row.t).toBe('ref');
    if (row.t === 'ref') {
      expect(row.category).toBe('psychologies');
      expect(row.show).toBe('Animosité');
      expect(row.badge).toBe(`${groupLabel('homme-bete')} · −20 Sociabilité`);
    }
    // La branche d'ÉCHEC (affliction SUBIE) ne porte pas ce malus : le porteur est sous compulsion.
    const [subi] = psychBranchOps({ kind: 'animosite', cible: ciblePsy.groupe('homme-bete'), indice: 0 }, { success: false });
    const rowFail = opRow(subi);
    if (rowFail.t === 'ref') expect(rowFail.badge).toBe(groupLabel('homme-bete'));
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
      expect(op.op === 'grantTalent' ? op.talent.spec : undefined, `${mutationId} : la donnée porte l'ID, jamais le libellé`)
        .toMatch(/^[a-z-]+$/);
      const row = opRow(op);
      expect(row.t).toBe('ref');
      if (row.t === 'ref') expect(row.show).toBe(libelle);
    }
  });
});

describe('opRow — grantTrait à Portée (LDB 85 l.209 ; LDB 79 l.142)', () => {
  it('la rangée montre la Portée de l’op', () => {
    const row = opRow({ op: 'grantTrait', trait: { id: 'langue-prehensile', value: 5, range: 12 } });
    expect(row.t).toBe('ref');
    if (row.t === 'ref') { expect(row.show).toBe('Langue préhensile +5 (12)'); expect(row.badge).toBeUndefined(); }
  });

  it('une attaque rend son Indice littéral en « +Dégâts »', () => {
    const row = opRow({ op: 'grantTrait', trait: { id: 'morsure', value: 4 } });
    expect(row.t).toBe('ref');
    if (row.t === 'ref') { expect(row.show).toBe('Morsure +4'); expect(row.badge).toBeUndefined(); }
  });

  it('un Indice Formula reste en badge', () => {
    const row = opRow({ op: 'grantTrait', trait: { id: 'vol', value: { charOf: 'agilite' } } });
    expect(row.t).toBe('ref');
    if (row.t === 'ref') { expect(row.show).toBe('Vol'); expect(row.badge).toBe(humanizeFormula({ charOf: 'agilite' })); }
  });
});

describe('pastille `charMod` — plancher et durée propre dits au producteur (EDO 11 l.190 ; #1853)', () => {
  const badge = (o: GameOp) => { const r = opRow(o); return r.t === 'ref' ? r.badge : undefined; };
  const CRETIN: GameOp = { op: 'charMod', characteristic: 'intelligence', mod: -40 };

  it('le plancher est porté quand il est présent', () => {
    expect(badge({ ...CRETIN, min: 10 })).toBe('-40 · min 10');
  });

  it('sans plancher, aucune mention', () => {
    expect(badge(CRETIN)).toBe('-40');
  });

  it('les trois échelles de durée propre, accordées au réel', () => {
    expect(badge({ ...CRETIN, durationHours: 3 })).toBe('-40 · 3 heures');
    expect(badge({ ...CRETIN, durationMinutes: 1 })).toBe('-40 · 1 minute');
    expect(badge({ ...CRETIN, durationRounds: 2 })).toBe('-40 · 2 Rounds');
  });

  it('`condition` lit la même durée propre', () => {
    const r = opRow({ op: 'condition', id: { id: etats[0].id }, durationHours: 2 });
    expect(r.t === 'ref' ? r.badge : undefined).toBe('2 heures');
  });
});
