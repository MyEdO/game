/**
 * AUTHORING de `SpellTarget.affects` (`src/engine/spellRange.ts:34`) sur les Zones d'Effet dont le
 * VERBATIM de source réserve le ciblage — le champ est lu par `castCommitZone`
 * (`src/state/combatFlow.ts:3529`, contrats `src/state/castCommitZone-affects.test.ts`).
 *
 * Ce test câble la DONNÉE au moteur : chaque `affects` authoré est réellement évalué par
 * `evalCondition` (`src/engine/flowCore.ts`) sur des candidats de camps opposés, et retient
 * exactement ce que la source réserve. Une ZdE dont la source ne réserve rien (`LDB 47 l.28`) ne
 * porte AUCUN `affects` — la retenue est vérifiée aussi.
 */
import { tableTotale } from '../lib/tableTotale';
import { describe, it, expect } from 'vitest';
import { spells } from './index';
import { evalCondition, spellEffectOps, type ActorView, type Condition, type ConditionCtx } from '../engine/flowCore';
import { CHAR_KEYS } from '../engine/types';
import type { Camp } from '../engine/relations';
import type { SpellTarget } from '../engine/spellRange';

type Area = Extract<SpellTarget, { kind: 'area' }>;

const areaOf = (id: string): Area => {
  const s = spells.find((x) => x.id === id);
  expect(s, id).toBeDefined();
  expect(s!.target?.kind, id).toBe('area');
  return s!.target as Area;
};

const actor = (o: { id: string; camp: Camp; talents?: { id: string; spec?: string }[] }): ActorView => ({
  id: o.id, woundsCurrent: 10, woundsMax: 10, size: 3, advantage: 0, camp: o.camp,
  groups: [], talents: o.talents ?? [], traits: [], conditions: {},
  chars: tableTotale(CHAR_KEYS, () => 35),
});

/** Le lanceur : héros, donc camp `party` (`campOf`, `src/engine/relations.ts`). */
const CASTER = actor({ id: 'lanceur', camp: 'party' });
const ALLY = actor({ id: 'allie', camp: 'party' });
const FOE = actor({ id: 'ennemi', camp: 'hostile' });
const NEUTRAL = actor({ id: 'neutre', camp: 'neutral' });

/** Le candidat entre-t-il en zone ? — MÊME appel que `castCommitZone` : `target` = le candidat. */
const retient = (affects: Condition | undefined, candidate: ActorView): boolean => {
  const ctx: ConditionCtx = { flags: {}, gameTime: 0, target: candidate, caster: CASTER };
  return affects == null || evalCondition(affects, ctx);
};

/** Verdict de rétention d'un `affects` sur les quatre candidats canoniques. */
const verdict = (affects: Condition | undefined) => ({
  lanceur: retient(affects, CASTER), allie: retient(affects, ALLY),
  ennemi: retient(affects, FOE), neutre: retient(affects, NEUTRAL),
});

/** ZdE dont la source réserve le ciblage aux ALLIÉS du lanceur, lanceur EXCLU (`self` ≠ `ally`). */
const ALLIES_SEULS = [
  'prouesses-martiales', // AA 06 l.541-543
  'obstination-du-boeuf', // VDM 11 l.386
  'regiment-monstrueux-de-merciw', // VDM 11 l.418
  'coeurs-ardents', // LDB 48 l.229
  'en-bon-ordre', // AA 06 l.501-507
  'en-terrain-dangereux', // AA 06 l.513-519
  'distorsion-temporelle', // VDM 04 l.349
  'malveillance-absolue', // frenchy-bzh (donnée app-owned)
];

/** ZdE dont la source ne réserve RIEN (`LDB 47 l.28` : tout le monde dans la zone). */
const SANS_FILTRE = [
  'waaagh', // « Chaque cible dans la zone… » (clause 1) — un filtre fausserait la clause 1
  'nuee-de-mouches', // « Les alliés et ennemis à moins de 3 mètres… »
  'festin-des-damnes', // ADE II 02 l.765 « créatures de votre choix » — choix du lanceur, hors vocabulaire
];

describe("`affects` — ZdE réservées aux ALLIÉS du lanceur", () => {
  it.each(ALLIES_SEULS)('%s : retient les alliés seuls (lanceur, ennemi et neutre écartés)', (id) => {
    const area = areaOf(id);
    expect(area.affects).toEqual({ kind: 'relation', who: 'target', is: 'ally' });
    expect(verdict(area.affects)).toEqual({ lanceur: false, allie: true, ennemi: false, neutre: false });
  });
});

describe("`affects` — les formes que le verbatim rend PARTICULIÈRES", () => {
  it("les-lunes-du-chasseur : « exalter vos alliés comme vous-même » (VDM 11 l.351) — le lanceur est RETENU", () => {
    const area = areaOf('les-lunes-du-chasseur');
    expect(area.affects).toEqual({
      kind: 'any',
      of: [{ kind: 'relation', who: 'target', is: 'self' }, { kind: 'relation', who: 'target', is: 'ally' }],
    });
    expect(verdict(area.affects)).toEqual({ lanceur: true, allie: true, ennemi: false, neutre: false });
  });

  it("ironie-du-destin : « hormis ceux qui possèdent le Talent Magie des Arcanes (Cieux) » (LDB 48 l.157)", () => {
    const area = areaOf('ironie-du-destin');
    expect(area.affects).toEqual({
      kind: 'all',
      of: [
        { kind: 'relation', who: 'target', is: 'ally' },
        { kind: 'not', of: { kind: 'has', who: 'target', what: 'talent', value: 'magie-des-arcanes', spec: 'cieux' } },
      ],
    });
    expect(verdict(area.affects)).toEqual({ lanceur: false, allie: true, ennemi: false, neutre: false });
    // La spec est comparée à l'identique (`flowCore.ts:339`) : l'id de Domaine de `domains.json`.
    const celeste = actor({ id: 'celeste', camp: 'party', talents: [{ id: 'magie-des-arcanes', spec: 'cieux' }] });
    const pyromancien = actor({ id: 'pyro', camp: 'party', talents: [{ id: 'magie-des-arcanes', spec: 'feu' }] });
    expect(retient(area.affects, celeste)).toBe(false);
    expect(retient(area.affects, pyromancien)).toBe(true);
  });

  it("rafale-hurlante : « Les alliés du sorcier ne sont pas affectés » — retient les ENNEMIS seuls", () => {
    const area = areaOf('rafale-hurlante');
    expect(area.affects).toEqual({ kind: 'relation', who: 'target', is: 'opponent' });
    expect(verdict(area.affects)).toEqual({ lanceur: false, allie: false, ennemi: true, neutre: true });
  });

  it("regiment-monstrueux-de-merciw : « Ce Sort ne vous affecte pas » garde son `excludesCaster`", () => {
    expect(areaOf('regiment-monstrueux-de-merciw').excludesCaster).toBe(true);
  });
});

describe('`affects` — ZdE que la source ne réserve PAS', () => {
  it.each(SANS_FILTRE)('%s : aucun `affects` (tout candidat de la zone entre)', (id) => {
    const area = areaOf(id);
    expect(area.affects).toBeUndefined();
    expect(verdict(area.affects)).toEqual({ lanceur: true, allie: true, ennemi: true, neutre: true });
  });
});

describe('narrative — ce que le champ `affects` modélise ne se journalise plus', () => {
  const narrativesDe = (s: (typeof spells)[number]) => spellEffectOps(s.effects)
    .filter((o) => o.op === 'narrative').map((o) => (o as { text: string }).text);
  const textes = (id: string) => narrativesDe(spells.find((s) => s.id === id)!);

  /** Motifs par lesquels une prose RESTITUE la restriction de ciblage — exactement ce que le champ
   *  `affects` décide. Portée : le camp du candidat (toute mention d'alliance) et les deux
   *  clauses d'exclusion nominales du corpus (« Ce Sort ne vous affecte pas », VDM 11 l.418 ;
   *  « hormis ceux qui possèdent le Talent Magie des Arcanes (Cieux) », LDB 48 l.157). Hors motif à
   *  dessein : « ennemi »/« neutre » seuls, qu'une note peut citer pour un ordre de résolution sans
   *  rien dire de qui entre en zone (Distorsion temporelle, VDM 04 l.349). */
  const RESTITUE_LE_CIBLAGE = [
    /alli[ée]/i,
    /ne (vous|les|nous) affecte(nt)? pas|ne sont pas affect/i,
    /Magie des Arcanes \(/i,
  ];

  const sortsAvecAffects = spells.filter((s) => (s.target?.kind === 'area' || s.target?.kind === 'cone') && s.target.affects != null);

  it('le corpus mesuré est bien celui des ZdE filtrées (sinon la propriété ne mesure rien)', () => {
    expect(sortsAvecAffects.map((s) => s.id).sort()).toEqual([...ALLIES_SEULS, 'les-lunes-du-chasseur', 'ironie-du-destin', 'rafale-hurlante'].sort());
  });

  it.each(sortsAvecAffects.map((s) => [s.id, s] as const))(
    '%s : aucune narrative ne restitue la restriction de ciblage que `affects` porte', (_id, s) => {
      const fautives = narrativesDe(s).filter((t) => RESTITUE_LE_CIBLAGE.some((re) => re.test(t)));
      expect(fautives).toEqual([]);
    });

  /** Les sorts dont la SEULE part « au jugement » était la restriction de ciblage : celle-ci
   *  modélisée, il ne reste rien à arbitrer — la mention deviendrait un aveu faux. */
  const PLUS_RIEN_A_ARBITRER = ['les-lunes-du-chasseur', 'obstination-du-boeuf', 'regiment-monstrueux-de-merciw',
    'ironie-du-destin', 'en-bon-ordre', 'en-terrain-dangereux', 'distorsion-temporelle'];

  it.each(PLUS_RIEN_A_ARBITRER)('%s : plus aucune narrative ne dit « arbitrage MJ »', (id) => {
    expect(textes(id).filter((t) => /arbitrage MJ/i.test(t))).toEqual([]);
  });

  it('la part RÉELLEMENT non modélisée de chaque narrative purgée est conservée', () => {
    expect(textes('obstination-du-boeuf').join(' ')).toMatch(/Test de Peur\/Terreur non modélisée/);
    expect(textes('regiment-monstrueux-de-merciw').join(' ')).toMatch(/plafond de Caractéristique non modélisé/);
    expect(textes('ironie-du-destin').join(' ')).toMatch(/réserve unique de Points de Chance/);
    expect(textes('en-bon-ordre').join(' ')).toMatch(/sans céder d’Avantage ni subir d’attaque gratuite/);
    expect(textes('en-terrain-dangereux').join(' ')).toMatch(/État Brisé/);
    expect(textes('distorsion-temporelle').join(' ')).toMatch(/Action supplémentaire non modélisée/);
  });
});

describe('`maison` — arbitrage de camp tracé en DONNÉE (CLAUDE.md règle 7)', () => {
  it("rafale-hurlante : la rétention des NEUTRES par `is:'opponent'` porte sa justification datée", () => {
    const area = areaOf('rafale-hurlante');
    expect(area.maison).toBeTypeOf('string');
    expect(area.maison).toMatch(/neutre/i);
    expect(area.maison).toMatch(/2026-07-28/);
    // Le fait tracé est CELUI que le moteur produit (cf. `verdict` ci-dessus) : le neutre est retenu.
    expect(retient(area.affects, NEUTRAL)).toBe(true);
  });
});
