/**
 * Preuve de COMPORTEMENT — variantes réglées de `talents.json` (#563/#564). 4 provenances de lecture de
 * la MÊME variante, sur de VRAIES entités du catalogue (jamais un id synthétique) : (1) la capacité
 * MÉCANIQUE (`dispatch.ts`, `featuresOf` via `effectiveEntry`), (2) l'affichage Codex (le registre RÉEL
 * `ui/compendium/registry.ts`), (3) le câblage `combatFlow` (Frappe blessante →
 * `hasCritRollTwiceTalent`/`critRollTwiceFor`), (4) la table de NON-RÉGRESSION de la `CombatFeature`
 * effective de CHAQUE talent à variante (liste DÉRIVÉE du catalogue) sous la sémantique REPLACE. Chaque cas couvre les DEUX modes
 * (règle `combat-aa-avantage-groupe` active/inactive).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setRule, resetRule } from '../policy';
import { activeVariant, effectiveEntry } from '../variants';
import { findTalentById, talents } from '../../data';
import { slugId } from '../../data/slug';
import { CODEX } from '../../ui/compendium/registry';
import {
  hasStealAdvantage, stealsOneAdvantage, shieldReactionCost, shieldAdvantageLevel,
  retreatAdvantageCost, keptAdvantageOnDisengage, canDisengageWithLessAdvantage,
  fearSizeAsMount, advantageTransferWeight, reloadGrantsAssessAdvantage, hasCritRollTwiceTalent,
  talentCritExtraWounds, fleeMovementBonus, pursuitTargetMovementBonus,
} from './dispatch';
import type { CombatFeature } from './types';
import { talentMaxById, talentMaxReached } from '../careerSlots';
import { talentTestSLBonus } from '../magic';
import { bonus } from '../characteristics';
import type { CharKey, Combatant, Weapon } from '../types';

afterEach(() => { for (const id of ALL_VARIANT_CARRIERS) resetRule(ruleOf(id)); });

const w = (over: Partial<Weapon> = {}): Weapon =>
  ({ label: 'Bouclier', trappingId: 'bouclier', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [{ id: 'protectrice', value: 2 }], ...over });

function mk(names: string[], over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'H', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: names.map((n) => ({ talentId: slugId(n), times: 1 })), movement: 4,
    ...over,
  } as Combatant;
}

describe('provenance 1 — capacité MÉCANIQUE (dispatch.featuresOf, via effectiveEntry)', () => {
  it('Renversement (cas d’école) : LDB = vole TOUT ; mode groupe = vole 1 dans la réserve adverse', () => {
    const c = mk(['Renversement']);
    expect(hasStealAdvantage(c)).toBe(true);
    expect(stealsOneAdvantage(c)).toBe(false);
    setRule('combat-aa-avantage-groupe', true);
    expect(hasStealAdvantage(c)).toBe(false); // LDB steal-all ÉTEINT en mode groupe
    expect(stealsOneAdvantage(c)).toBe(true);
  });

  it('Porte-Bouclier : LDB = Avantage au porteur si perdant ; mode groupe = réaction à coût (2)', () => {
    const c = mk(['Porte-Bouclier', 'Porte-Bouclier']); // 2 acquisitions = niveau 2
    expect(shieldAdvantageLevel(c, w())).toBe(2);
    expect(shieldReactionCost(c, w())).toBe(0);
    setRule('combat-aa-avantage-groupe', true);
    expect(shieldAdvantageLevel(c, w())).toBe(0); // shieldAdvantage ÉTEINT en mode groupe
    expect(shieldReactionCost(c, w())).toBe(2);
  });

  it('Impitoyable : LDB = garde niveau Avantages + Désengagement sans supériorité ; mode groupe = coût de Retraite à 1', () => {
    const c = mk(['Impitoyable']);
    expect(keptAdvantageOnDisengage(c)).toBe(1);
    expect(canDisengageWithLessAdvantage(c)).toBe(true);
    expect(retreatAdvantageCost(c)).toBe(2); // défaut LDB
    setRule('combat-aa-avantage-groupe', true);
    expect(keptAdvantageOnDisengage(c)).toBe(0);
    expect(canDisengageWithLessAdvantage(c)).toBe(false);
    expect(retreatAdvantageCost(c)).toBe(1);
  });

  it('Cavalier émérite : aucune capacité LDB (le Talent n’a pas de mécanique de combat de base) ; mode groupe → Taille de Peur = celle de la monture', () => {
    const c = mk(['Cavalier émérite']);
    expect(fearSizeAsMount(c)).toBe(false);
    setRule('combat-aa-avantage-groupe', true);
    expect(fearSizeAsMount(c)).toBe(true);
  });

  it('Coude-à-coude : mode groupe → poids de transfert 2 (défaut 1 hors mode groupe / sans Talent)', () => {
    const c = mk(['Coude-à-coude']);
    expect(advantageTransferWeight(c)).toBe(1);
    setRule('combat-aa-avantage-groupe', true);
    expect(advantageTransferWeight(c)).toBe(2);
  });

  it('Artilleur / Rechargement rapide : mode groupe → recharger compte comme Évaluer (+1 Avantage)', () => {
    const c = mk(['Artilleur', 'Rechargement rapide']);
    expect(reloadGrantsAssessAdvantage(c)).toBe(false);
    setRule('combat-aa-avantage-groupe', true);
    expect(reloadGrantsAssessAdvantage(c)).toBe(true);
  });

  it('Frappe blessante : LDB = +niveau Blessures sur Critique ; mode groupe = deux lancers, garde le préféré (pas de bonus de Blessures)', () => {
    const c = mk(['Frappe blessante']);
    expect(talentCritExtraWounds(c)).toBe(1);
    expect(hasCritRollTwiceTalent(c)).toBe(false);
    setRule('combat-aa-avantage-groupe', true);
    expect(talentCritExtraWounds(c)).toBe(0);
    expect(hasCritRollTwiceTalent(c)).toBe(true);
  });

  it('Fuite ! : LDB = +1 Mouvement en Fuite seule ; mode groupe = aussi +1 comme Cible d’une Poursuite (AA 13 l.68)', () => {
    const c = mk(['Fuite !']);
    expect(fleeMovementBonus(c)).toBe(1);
    expect(pursuitTargetMovementBonus(c)).toBe(0);
    setRule('combat-aa-avantage-groupe', true);
    expect(fleeMovementBonus(c)).toBe(1);
    expect(pursuitTargetMovementBonus(c)).toBe(1);
  });
});

const VARIANT_TALENTS = ['artilleur', 'battement', 'cavalier-emerite', 'coude-a-coude', 'distraire', 'frappe-blessante', 'fuite', 'impitoyable', 'porte-bouclier', 'rechargement-rapide', 'renversement'];

/** Tous les porteurs de variante du catalogue — DÉRIVÉ (une curation qui en ajoute un entre
 *  automatiquement dans les preuves ci-dessous, quelle que soit la règle qui le gate). */
const ALL_VARIANT_CARRIERS = (talents as unknown as { id: string; variants?: unknown[] }[])
  .filter((t) => t.variants?.length).map((t) => t.id).sort();

/** Règle optionnelle qui gate la variante d'un porteur, LUE dans la donnée — jamais un id de règle
 *  écrit en dur dans la preuve (deux variantes co-activables sont déjà interdites par
 *  `src/data/variants-integrity.test.ts`, la première suffit). */
const ruleOf = (id: string): string =>
  (findTalentById(id) as unknown as { variants: { when: { rule: string } }[] }).variants[0].when.rule;

/** Fiche Codex RÉELLE d'un talent, re-projetée après un changement de règle optionnelle. */
function codexTalent(id: string) {
  return CODEX.find((c) => c.key === 'talents')!.items.find((i) => i.id === id)!;
}
const metaOf = (id: string, label: string) => codexTalent(id).meta?.find((f) => f.label === label)?.value;

describe('provenance 2 — affichage CODEX (le registre RÉEL ui/compendium/registry.ts, via effectiveEntry)', () => {
  it('la desc de chaque talent à variante bascule base ↔ variante avec SA règle, et la fiche Codex suit', () => {
    for (const id of ALL_VARIANT_CARRIERS) {
      const t = findTalentById(id)!;
      const td = t as unknown as { variants?: { when: { rule: string }; desc?: string }[] };
      expect(activeVariant(td.variants)).toBeUndefined(); // mode de base : aucune variante active
      expect(codexTalent(id).desc).toBe(t.desc);
      setRule(ruleOf(id), true);
      const v = activeVariant(td.variants);
      expect(v?.desc).toBeTruthy();
      expect(v?.desc).not.toBe(t.desc); // la variante diffère toujours du texte de base
      expect(codexTalent(id).desc).toBe(v!.desc);
      expect(codexTalent(id).source?.page).toBe((v as unknown as { source?: { page: number } }).source!.page);
      resetRule(ruleOf(id));
    }
  });

  it('Fuite ! (#564) : la ligne « Tests » republiée par AA est CONSOMMÉE — la fiche Codex l’affiche', () => {
    expect(metaOf('fuite', 'Test')).toBe('Athlétisme quand vous Fuyez');
    setRule('combat-aa-avantage-groupe', true);
    expect(metaOf('fuite', 'Test')).toBe("Athlétisme quand vous Fuyez ou quand vous êtes la Cible d'une Poursuite");
  });
});

describe('Fuite ! — l’entrée EFFECTIVE porte le `test` de la variante (#564, AA 13 l.64-68)', () => {
  const eff = () => effectiveEntry(findTalentById('fuite')!);

  it('`test`, `desc`, `source` et `combat` basculent tous sur la forme AA', () => {
    expect(eff().test?.raw).toBe('Athlétisme quand vous Fuyez');
    expect(eff().source.book).toBe('livre-de-base');
    setRule('combat-aa-avantage-groupe', true);
    expect(eff().test?.raw).toBe("Athlétisme quand vous Fuyez ou quand vous êtes la Cible d'une Poursuite");
    expect(eff().test?.matches).toEqual([{ skill: { id: 'athletisme' }, manual: true }]);
    expect(eff().source).toEqual({ book: 'aux-armes', page: 141 });
    expect(eff().combat).toEqual({ fleeBonus: true, pursuitTargetBonus: true });
  });
});

describe('provenance 3 — câblage combatFlow (Frappe blessante variante AA → hasCritRollTwiceTalent, même point que Bénédiction de Sauvagerie)', () => {
  it('un porteur de Frappe blessante ne porte le drapeau permanent QUE sous la règle active', () => {
    const c = mk(['Frappe blessante']);
    expect(hasCritRollTwiceTalent(c)).toBe(false);
    setRule('combat-aa-avantage-groupe', true);
    expect(hasCritRollTwiceTalent(c)).toBe(true);
    resetRule('combat-aa-avantage-groupe');
    expect(hasCritRollTwiceTalent(c)).toBe(false);
  });
});

/**
 * provenance 4 — NON-RÉGRESSION du passage à la sémantique REPLACE (#564). La `CombatFeature` effective
 * attendue de CHAQUE talent à variante, dans les DEUX modes, est figée ici telle qu'elle était produite
 * par la fusion `{...base, ...variante}` : toute divergence (champ de base perdu parce que la variante
 * ne le réénonce pas) allume ce test.
 */
const EFFECTIVE: Record<string, { off: CombatFeature | undefined; on: CombatFeature | undefined }> = {
  'artilleur': { off: { reloadDR: 'blackpowder' }, on: { reloadDR: 'blackpowder', reloadAssessAdvantage: true } },
  'battement': { off: { battement: true }, on: { battement: true } },
  'cavalier-emerite': { off: undefined, on: { fearSizeAsMount: true } },
  'coude-a-coude': { off: undefined, on: { transferWeight: 2 } },
  'distraire': { off: { distraire: true }, on: { distraire: true } },
  'frappe-blessante': { off: { critExtraWounds: true }, on: { critExtraWounds: false, critRollTwice: true } },
  'fuite': { off: { fleeBonus: true }, on: { fleeBonus: true, pursuitTargetBonus: true } },
  'impitoyable': {
    off: { keepAdvantageOnDisengage: true, disengageWithLessAdvantage: true },
    on: { keepAdvantageOnDisengage: false, disengageWithLessAdvantage: false, retreatCost: 1 },
  },
  'porte-bouclier': { off: { shieldAdvantage: true }, on: { shieldAdvantage: false, advantageDefenseReaction: { avantage: 2 } } },
  'rechargement-rapide': { off: { reloadDR: 'all' }, on: { reloadDR: 'all', reloadAssessAdvantage: true } },
  'renversement': { off: { stealAdvantage: true }, on: { stealAdvantage: false, stealOne: true } },
  // VDM #734 : la variante révisée de Concocter ne touche aucune `CombatFeature` (elle republie
  // `desc`/`source`/`test`) — la forme effective reste sans capacité de combat dans les deux modes.
  'concocter': { off: undefined, on: undefined },
};

describe('provenance 4 — CombatFeature effective sous REPLACE, identique à la fusion d’avant (#564)', () => {
  it('couvre TOUS les talents à variante du catalogue (aucun oubli possible)', () => {
    expect(ALL_VARIANT_CARRIERS).toEqual(Object.keys(EFFECTIVE).sort());
    expect(VARIANT_TALENTS.every((id) => ALL_VARIANT_CARRIERS.includes(id))).toBe(true);
  });

  for (const [id, exp] of Object.entries(EFFECTIVE)) {
    it(`${id} — règle DÉSACTIVÉE puis ACTIVÉE`, () => {
      expect(effectiveEntry(findTalentById(id)!).combat).toEqual(exp.off);
      setRule(ruleOf(id), true);
      expect(effectiveEntry(findTalentById(id)!).combat).toEqual(exp.on);
    });
  }
});

/** Porteurs DÉRIVÉS du catalogue : les talents dont une variante réglée republie le champ `field`.
 *  Aucune liste d'ids en dur — un porteur ajouté en donnée entre automatiquement dans les preuves. */
function carriersDeclaring(field: 'max' | 'test') {
  return (talents as unknown as { id: string; variants?: Record<string, unknown>[] }[])
    .filter((t) => t.variants?.some((v) => field in v))
    .map((t) => t.id);
}

const mkById = (id: string): Combatant => ({ ...mk([]), talents: [{ talentId: id, times: 1 }] }) as Combatant;

/** Maxi attendu d'une valeur `max` de donnée, calculé INDÉPENDAMMENT du résolveur sous test. */
const expectedMax = (c: Combatant, max: unknown): number | null =>
  max == null ? null : typeof max === 'number' ? max : bonus(c.characteristics[(max as { bonusOf: CharKey }).bonusOf]);

describe('provenance 5 — le Maxi EFFECTIF suit la variante (talentMaxById, AA 13 l.54-59, l.70-74)', () => {
  const carriers = carriersDeclaring('max');

  it('au moins un talent du catalogue voit son Maxi republié par une variante réglée', () => {
    expect(carriers.length).toBeGreaterThan(0);
  });

  for (const id of carriers) {
    it(`${id} — talentMaxById bascule avec la règle (base ≠ variante)`, () => {
      const c = mkById(id);
      const base = findTalentById(id)! as unknown as { max?: unknown; variants: { max?: unknown }[] };
      expect(talentMaxById(c, id)).toBe(expectedMax(c, base.max));
      setRule(ruleOf(id), true);
      const vMax = base.variants.find((v) => 'max' in v)!.max;
      expect(talentMaxById(c, id)).toBe(expectedMax(c, vMax));
      expect(talentMaxById(c, id)).not.toBe(expectedMax(c, base.max)); // morsure : le Maxi CHANGE réellement
    });

    it(`${id} — talentMaxReached (le consommateur d'achat) applique le Maxi de la variante`, () => {
      const c = mkById(id);
      const vMax = findTalentById(id)! as unknown as { variants: { max?: unknown }[] };
      const n = expectedMax(c, vMax.variants.find((v) => 'max' in v)!.max)!;
      c.talents = [{ talentId: id, times: n }];
      expect(talentMaxReached(c, id)).toBe(false); // sous la base, le Maxi (Bonus de carac) est plus haut
      setRule(ruleOf(id), true);
      expect(talentMaxReached(c, id)).toBe(true);
    });
  }
});

describe('provenance 6 — la ligne « Tests » republiée est CONSOMMÉE par le +DR de Talent (talentTestSLBonus)', () => {
  /** Sondes de Test dérivées des `matches` d'un mode : une par match auto-applicable. */
  const probes = (matches: { skill?: { id: string; spec?: string }; char?: CharKey; manual?: boolean }[] | undefined) =>
    (matches ?? []).filter((m) => !m.manual).map((m) => ({ skill: m.skill?.id, spec: m.skill?.spec, char: m.char }));

  const carriers = carriersDeclaring('test');

  it('au moins un talent du catalogue voit sa ligne « Tests » republiée par une variante réglée', () => {
    expect(carriers.length).toBeGreaterThan(0);
  });

  for (const id of carriers) {
    const base = findTalentById(id)! as unknown as { test?: { matches?: [] }; variants: { test?: { matches?: [] } }[] };
    const vTest = base.variants.find((v) => 'test' in v)!.test;
    const structurallyDifferent = JSON.stringify(vTest?.matches) !== JSON.stringify(base.test?.matches);

    it(`${id} — l'entrée effective porte les \`matches\` de la variante sous la règle`, () => {
      const eff = () => (effectiveEntry(findTalentById(id)!) as unknown as { test?: { matches?: [] } }).test;
      expect(eff()?.matches).toEqual(base.test?.matches);
      setRule(ruleOf(id), true);
      expect(eff()?.matches).toEqual(vTest?.matches);
    });

    // Morsure PORTÉE PAR TOUS : la ligne « Tests » imprimée est un CONTENU consommé (fiche Codex,
    // `fact('Test', e.test?.raw)`) — elle doit réellement changer d'un mode à l'autre.
    it(`${id} — MORSURE : la ligne « Tests » EFFECTIVE change avec la règle`, () => {
      const raw = () => (effectiveEntry(findTalentById(id)!) as unknown as { test?: { raw?: string } }).test?.raw;
      const off = raw();
      setRule(ruleOf(id), true);
      expect(raw()).not.toBe(off);
    });

    // Morsure du +DR : réservée aux talents dont les `matches` divergent structurellement (un talent
    // dont la variante ne republie que le TEXTE n'a pas de sonde auto-applicable à faire diverger).
    if (!structurallyDifferent) continue;

    it(`${id} — MORSURE : une sonde de Test réelle change de +DR avec la règle`, () => {
      const c = mkById(id);
      const all = [...probes(base.test?.matches), ...probes(vTest?.matches)];
      const diverging = all.filter((q) => {
        resetRule(ruleOf(id));
        const off = talentTestSLBonus(c, q, () => true);
        setRule(ruleOf(id), true);
        const on = talentTestSLBonus(c, q, () => true);
        resetRule(ruleOf(id));
        return off !== on;
      });
      expect(diverging.length).toBeGreaterThan(0);
    });
  }
});
