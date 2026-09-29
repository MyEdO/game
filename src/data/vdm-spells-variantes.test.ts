/**
 * CÂBLAGE des variantes réglées de `spells.json` (#729, chantier VDM) — Les Vents de Magie RÉVISE
 * 18 Sorts du Livre de base sans les republier : chaque delta est une variante gatée par la règle
 * optionnelle `magic-vdm-incantation` (`src/engine/policy.ts`), jamais une seconde entrée.
 *
 * Ce test prouve la CHAÎNE RÉELLE, pas un contexte forgé : il part de la donnée committée
 * (`spells.json`), passe par le point de lecture unique (`findSpellById`, `src/data/index.ts`), et
 * assène le résultat sur les consommateurs RÉELS — `castLandProbability` (`engine/magic.ts`, NI),
 * `spellFlowFor` (`engine/flowCore.ts`, le Flow que `combatFlow` exécute), `learnableSpells`
 * (`engine/grimoire.ts`, énumération du catalogue) et le registre Codex (`ui/compendium/registry.ts`).
 * Débrancher `effectiveEntry` de l'un de ces sites rend le volet correspondant.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setRule, resetRule } from '../engine/policy';
import { activeVariant } from '../engine/variants';
import { findSpellById, spells, traits, type SpellData } from './index';
import { schema as spellsSchema, VARIANT_RESOLVED_FIELDS } from './schemas/defs/spells';
import { castLandProbability } from '../engine/magic';
import { spellFlowFor } from '../engine/flowCore';
import { learnableSpells } from '../engine/grimoire';
import { CODEX } from '../ui/compendium/registry';
import type { Combatant } from '../engine/types';

const RULE = 'magic-vdm-incantation';

afterEach(() => resetRule(RULE));

/** Porteurs de variante du catalogue — DÉRIVÉS de la donnée (une curation de plus entre seule). */
const CARRIERS = (spells as unknown as { id: string; variants?: unknown[] }[])
  .filter((s) => s.variants?.length).map((s) => s.id).sort();

/** Sorcier de Shyish : Langue (Magick) + Focalisation, de quoi faire un vrai Test d'Incantation. */
const sorcier = (): Combatant =>
  ({
    id: 'w', label: 'Sorcier', kind: 'hero', size: 'moyenne', advantage: 0,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 },
    conditions: [], traits: [], groups: [], weapons: [], movement: 4, wounds: { current: 12, max: 12 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'focalisation', spec: 'mort', advances: 30 }, { id: 'langue', spec: 'magick', advances: 30 }],
    talents: [{ talentId: 'magie-des-arcanes', spec: 'mort', times: 1 }],
  } as unknown as Combatant);

describe('donnée — 18 Sorts révisés par VDM, gatés par la RÈGLE (jamais par le livre)', () => {
  it('le catalogue porte exactement les 18 variantes curées, toutes sur `magic-vdm-incantation`', () => {
    expect(CARRIERS).toEqual([
      'bouclier-ceruleen', 'caresse-de-laniph', 'coeurs-ardents', 'creuset-de-chamon', 'destrier-d-ombre',
      'forme-bestiale', 'grands-feux-d-u-zhul', 'illusion', 'jumeau-malefique', 'l-egide-d-aqshy',
      'l-epee-ardente-de-rhuin', 'la-faux-de-shyish', 'lumiere-de-guerison', 'maitre-de-la-bete',
      'metal-changeant', 'mur-de-feu', 'sang-de-la-terre', 'serres-d-ambre',
    ]);
    for (const id of CARRIERS) {
      const v = (findSpellById(id) as unknown as { variants: { when: { rule: string }; source: { book: string } }[] }).variants;
      expect(v.map((x) => x.when.rule), id).toEqual([RULE]);
      expect(v[0].source.book, id).toBe('vents-de-la-magie');
    }
  });

  it('le schéma accepte la donnée réelle et REFUSE un champ hors liste blanche', () => {
    expect(spellsSchema.safeParse(spells).success).toBe(true);
    const porteur = JSON.parse(JSON.stringify(spells.find((s) => s.id === 'caresse-de-laniph')));
    porteur.variants[0].missile = false; // `missile` n'est pas résolu → le schéma le rejette
    expect(spellsSchema.safeParse([porteur]).success).toBe(false);
    expect(VARIANT_RESOLVED_FIELDS).toEqual(['desc', 'source', 'cn', 'duration', 'effects']);
  });

  it('chaque variante ne déclare que des champs de la liste blanche', () => {
    for (const id of CARRIERS) {
      const v = (findSpellById(id) as unknown as { variants: Record<string, unknown>[] }).variants[0];
      const declared = Object.keys(v).filter((k) => k !== 'when');
      expect(declared.filter((k) => !(VARIANT_RESOLVED_FIELDS as readonly string[]).includes(k)), id).toEqual([]);
    }
  });
});

describe('point de lecture UNIQUE — `findSpellById` rend la forme EFFECTIVE', () => {
  it('règle ÉTEINTE : aucune variante active, l’entrée du Livre de base est rendue telle quelle', () => {
    for (const id of CARRIERS) {
      const s = findSpellById(id)!;
      expect(activeVariant((s as unknown as { variants?: never[] }).variants)).toBeUndefined();
      expect(s.source.book, id).toBe('livre-de-base');
    }
  });

  it('règle ALLUMÉE : desc et source basculent sur le folio VDM, pour les 18', () => {
    setRule(RULE, true);
    for (const id of CARRIERS) {
      const s = findSpellById(id)!;
      expect(s.source.book, id).toBe('vents-de-la-magie');
      const base = spells.find((x) => x.id === id)!;
      expect(s.desc, id).not.toBe(base.desc);
    }
  });

  it('un sort SANS variante est rendu à l’identique sous les deux états (contrôle négatif)', () => {
    const off = findSpellById('embrasement') ?? findSpellById('choc')!;
    setRule(RULE, true);
    expect(findSpellById(off.id)).toBe(off); // même objet : aucune copie parasite
  });
});

describe('NI — Caresse de Laniph passe de 7 (LDB 251) à 4 (VDM folio 122), jusqu’au Test d’Incantation', () => {
  const spell = () => findSpellById('caresse-de-laniph')!;

  it('la donnée effective porte le NI du livre actif — l’entrée BRUTE, elle, ne bouge jamais', () => {
    const brut = () => spells.find((s) => s.id === 'caresse-de-laniph')!.cn;
    expect(spell().cn).toBe(7);
    setRule(RULE, true);
    expect(spell().cn).toBe(4);
    // Preuve de DÉBRANCHEMENT : l'ancre `spells.json` reste à 7 — un `findSpellById` qui cesserait de
    // passer par `effectiveEntry` rendrait 7 ici, et cette assertion tomberait.
    expect(brut()).toBe(7);
  });

  it('CÂBLAGE moteur — `castLandProbability` (engine/magic) aboutit plus souvent sous VDM', () => {
    const w = sorcier();
    const ldb = castLandProbability(w, spell());
    setRule(RULE, true);
    const vdm = castLandProbability(w, spell());
    expect(ldb).toBeGreaterThan(0);
    expect(vdm).toBeGreaterThan(ldb);
  });

  it('CÂBLAGE catalogue — `learnableSpells` (engine/grimoire) énumère le NI effectif', () => {
    const w = sorcier();
    const cn = () => learnableSpells(w).find((x) => x.spell.id === 'caresse-de-laniph')?.spell.cn;
    expect(cn()).toBe(7);
    setRule(RULE, true);
    expect(cn()).toBe(4);
  });
});

describe('Durée — Forme bestiale : (Bonus de Force Mentale) minutes → (Force Mentale) minutes (VDM folio 147)', () => {
  const duration = () => findSpellById('forme-bestiale')!.duration;

  it('la Durée effective bascule du Bonus à la Caractéristique pleine', () => {
    expect(duration()).toEqual({ kind: 'clock', value: { bonusOf: 'force-mentale' }, unit: 'minutes' });
    setRule(RULE, true);
    expect(duration()).toEqual({ kind: 'clock', value: { charOf: 'force-mentale' }, unit: 'minutes' });
  });
});

describe('Flow — Lumière de guérison : Résistance Difficile (−20) → Très Difficile (−30) (VDM folio 65)', () => {
  /** Difficulté du nœud `test` du Flow RÉELLEMENT exécuté par `combatFlow` (`spellFlowFor`, l.4112). */
  const difficulte = (): string | undefined => {
    const f = spellFlowFor(findSpellById('lumiere-de-guerison')!.effects, 'target');
    const walk = (n: { kind: string; steps?: unknown[]; test?: { difficulty?: string } }): string | undefined => {
      if (n.kind === 'test') return n.test?.difficulty;
      for (const s of (n.steps ?? []) as typeof n[]) {
        const hit = walk(s);
        if (hit) return hit;
      }
      return undefined;
    };
    return walk(f as never);
  };

  it('le Flow effectif porte la difficulté du livre actif', () => {
    expect(difficulte()).toBe('difficile');
    setRule(RULE, true);
    expect(difficulte()).toBe('tresDifficile');
  });
});

describe('affichage — la fiche Codex RÉELLE (ui/compendium/registry) suit la règle', () => {
  const fiche = (id: string) => {
    return CODEX.find((c) => c.key === 'spells')!.items.find((i) => i.id === id)!;
  };
  const meta = (id: string, label: string) => fiche(id).meta?.find((f) => f.label === label)?.value;

  it('Caresse de Laniph : desc, source et « NI » affichés sont ceux du livre actif', () => {
    const base = spells.find((s) => s.id === 'caresse-de-laniph') as SpellData;
    expect(fiche('caresse-de-laniph').desc).toBe(base.desc);
    expect(meta('caresse-de-laniph', 'NI')).toBe('7');
    setRule(RULE, true);
    const eff = findSpellById('caresse-de-laniph')!;
    expect(fiche('caresse-de-laniph').desc).toBe(eff.desc);
    expect(meta('caresse-de-laniph', 'NI')).toBe('4');
  });

  it('Forme bestiale : la « Durée » affichée bascule avec la variante', () => {
    const ldb = meta('forme-bestiale', 'Durée');
    setRule(RULE, true);
    expect(meta('forme-bestiale', 'Durée')).not.toBe(ldb);
  });
});

// ── Contradictions FRANCHES desc ⇄ op (#880) ──────────────────────────────────────────────────────
/** Label d'un Trait par son id (le label est de l'AFFICHAGE — la donnée, elle, est keyée par id). */
const TRAIT_LABEL = new Map(traits.map((t) => [t.id, t.label]));

/**
 * Texte de RÈGLE d'un Flow d'effets : la prose des ops PLUS le rendu des Conditions STRUCTURELLES
 * (un gate `has what:'trait'` NOMME son Trait, un `compare` sur `size` NOMME la Taille). Sans ce
 * rendu, une règle passée du narratif au mécanique paraîtrait muette à la comparaison.
 */
function ruleTextOf(node: unknown): string {
  let out = '';
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== 'object') return;
    const rec = n as Record<string, unknown>;
    if (rec.kind === 'has' && rec.what === 'trait' && typeof rec.value === 'string')
      out += ` ${TRAIT_LABEL.get(rec.value) ?? rec.value}`;
    if (rec.kind === 'compare' && (rec.subject as { field?: string } | undefined)?.field === 'size')
      out += ' Taille';
    for (const v of Object.values(rec)) {
      if (typeof v === 'string') out += ` ${v}`;
      else walk(v);
    }
  };
  walk(node);
  return out;
}

/**
 * Les 4 entrées où l'op de BASE affirmait une valeur que la desc republiée par VDM dit autrement.
 * `vdm` = la règle du folio des Vents (doit être dans la desc EFFECTIVE **et** dans l'op EFFECTIVE) ;
 * `ldb` = la formulation du Livre de base que la variante remplace (doit avoir disparu des deux).
 */
const CONTRADICTIONS: { id: string; ref: string; vdm: RegExp[]; ldb: RegExp[] }[] = [
  { id: 'illusion', ref: 'VDM 08 l.382', vdm: [/Intuition Complexe/], ldb: [/Perception Complexe/] },
  {
    id: 'serres-d-ambre',
    ref: 'VDM 11 l.426',
    vdm: [/DR plus votre Bonus de Force et de Force Mentale/],
    ldb: [/Dégâts égaux à votre BFM/],
  },
  { id: 'maitre-de-la-bete', ref: 'VDM 11 l.363', vdm: [/Bestial/, /Taille/], ldb: [] },
  {
    id: 'sang-de-la-terre',
    ref: 'VDM 06 l.472',
    vdm: [/soit en la touchant/],
    ldb: [/\(et vous, debout pieds nus\)/],
  },
];

describe('desc EFFECTIVE ⇄ op EFFECTIVE — les deux disent la MÊME règle sous VDM (#880)', () => {
  for (const c of CONTRADICTIONS) {
    it(`${c.id} (${c.ref}) — la règle des Vents est portée par la desc ET par l’op`, () => {
      setRule(RULE, true);
      const eff = findSpellById(c.id)!;
      const opText = ruleTextOf(eff.effects);
      for (const re of c.vdm) {
        expect(eff.desc, `${c.id} desc`).toMatch(re);
        expect(opText, `${c.id} op`).toMatch(re);
      }
      for (const re of c.ldb) {
        expect(eff.desc, `${c.id} desc`).not.toMatch(re);
        expect(opText, `${c.id} op`).not.toMatch(re);
      }
    });

    it(`${c.id} — MORSURE : sans la republication d’\`effects\`, l’op contredit la desc`, () => {
      setRule(RULE, true);
      const eff = findSpellById(c.id)!;
      const sansRepublication = ruleTextOf(spells.find((s) => s.id === c.id)!.effects);
      // L'op de base ne dit PAS la règle que la desc effective affiche…
      expect(c.vdm.every((re) => re.test(sansRepublication)), `${c.id}`).toBe(false);
      // …que la desc effective, elle, porte en entier : c'est la divergence que #880 ferme.
      expect(c.vdm.every((re) => re.test(eff.desc)), `${c.id}`).toBe(true);
    });
  }
});
