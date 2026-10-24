import { describe, it, expect, vi } from 'vitest';
import { CODEX, traitItem } from './registry';
import type { CodexItem } from './registry';
import { porteurDApercu } from './apercuPorteur';
import { resolveRender } from '../../gameIso/rig/bodyPlan';
import { resetDiagOnce } from '../../gameIso/rig/devDiag';
import { entityRigProfile } from '../../gameIso/rig/enemyProfile';
import { resolveRig } from '../../gameIso/rig/composeRig';
import { bonesToSvg } from '../../gameIso/rig/renderBones';
import { hashSeed } from '../../engine/dice';
import { findCreatureById, traits } from '../../data';
import { findTrappingById } from '../../data';

/**
 * Aucun aperçu du Codex ne tombe dans la branche « aucune espèce résolue » (#1693).
 *
 * `CreaturePreview` résout `resolveRender(appearance.species ?? porteur, traits du record, réf)`. Quand
 * rien ne résout, `bodyPlan` retombe sur la race par défaut EN CRIANT un défaut de donnée
 * (`src/gameIso/rig/bodyPlan.ts:190-195`) : pour une mutation ou un trait, dont l'`appearance` est un
 * FRAGMENT porté et dont le libellé FR n'est l'id d'aucune créature, ce cri était systématique.
 *
 * La garde rejoue cette résolution EXACTE pour toutes les entrées à `appearance` de TOUTES les
 * catégories (pas de DOM : l'appel direct suffit, le diagnostic s'observe sur `console.error` en DEV),
 * et vérifie d'abord que la sonde MORD sur une entrée non déclarée.
 */

type Apercu = { cat: string; id: string; item: CodexItem };

const apercus = (): Apercu[] =>
  CODEX.flatMap((c) => c.items.filter((i) => i.appearance).map((item) => ({ cat: c.key, id: item.id, item })));

/** La résolution que fera l'aperçu, et les diagnostics qu'elle émet. */
function diagsDe(item: Pick<CodexItem, 'label' | 'appearance' | 'previewRef' | 'previewPorteur'>): string[] {
  const nom = item.previewRef ?? item.label;
  const espece = item.appearance?.species ?? item.previewPorteur;
  resetDiagOnce(); // chaque entrée repart d'une console vierge : `diagOnce` ne muselle pas la suivante
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    resolveRender(espece, findCreatureById(nom)?.traits, nom);
    return spy.mock.calls.map((c) => String(c[0])).filter((m) => /\[bodyPlan\]/.test(m));
  } finally {
    spy.mockRestore();
  }
}

describe('Codex — tout aperçu rig résout son rendu, jamais par diagnostic (#1693)', () => {
  it('CONTRÔLE POSITIF : une entrée à fragment sans porteur ni réf déclarés est CRIÉE', () => {
    const diags = diagsDe({ label: "Pattes d'animaux", appearance: { features: ['oreilles-pointues'] } });
    expect(diags.join('\n')).toMatch(/aucune espèce résolue/);
  });

  it('aucune entrée du registre ne tombe dans la branche diagnostic', () => {
    const fautives = apercus()
      .map((a) => ({ ...a, diags: diagsDe(a.item) }))
      .filter((a) => a.diags.length > 0)
      .map((a) => `${a.cat}/${a.id} → ${a.diags.join(' | ')}`);
    expect(fautives).toEqual([]);
  });

  it('le clivage est DÉCLARÉ : fragment ⟹ porteur, entité autonome ⟹ réf de record', () => {
    const sans = apercus().filter((a) => !a.item.previewRef && !a.item.appearance?.species && !a.item.previewPorteur);
    expect(sans.map((a) => `${a.cat}/${a.id}`)).toEqual([]);
    // Le porteur transporté par les items vient bien du foyer unique, catégorie par catégorie.
    const declares = [...new Set(apercus().filter((a) => a.item.previewPorteur).map((a) => a.cat))];
    expect(declares.length).toBeGreaterThan(0);
    for (const cat of declares) {
      for (const a of apercus().filter((x) => x.cat === cat && x.item.previewPorteur))
        expect(a.item.previewPorteur).toBe(porteurDApercu(cat));
    }
  });

  it('chaque catégorie qui projette la fiche de Trait lit SA propre déclaration', () => {
    // `traitItem` sert `traits` ET le filtre `psychologie` : la clé passée est celle de la catégorie
    // appelante, pas une constante. Les deux déclarations étant égales en donnée, l'assertion se lit
    // contre le foyer, catégorie par catégorie : déclarer `psychologie` sur une autre espèce la rend
    // rouge si l'appelant est codé en dur. Sonde SYNTHÉTIQUE : `traits.json` ne porte aucune
    // `appearance`, donc aucun item réel ne mesurerait ce chemin.
    const fragment = { ...traits[0], id: 'sonde-fragment', appearance: { features: ['oreilles-pointues'] } } as (typeof traits)[number];
    for (const cat of ['traits', 'psychologie'])
      expect(traitItem(fragment, cat).previewPorteur).toBe(porteurDApercu(cat));
  });

  it("un item SANS fragment ne porte pas la clé `previewPorteur`", () => {
    const sansFragment = { ...traits[0], appearance: undefined } as (typeof traits)[number];
    expect('previewPorteur' in traitItem(sansFragment, 'traits')).toBe(false);
    const inertes = CODEX.flatMap((c) => c.items.filter((i) => !i.appearance && 'previewPorteur' in i).map((i) => `${c.key}/${i.id}`));
    expect(inertes).toEqual([]);
  });

  it("le porteur n'ajoute au rendu que le tirage individuel de sa race : le SVG des mutations, hors teintes tirées, est identique avec et sans porteur", () => {
    // Déclarer le porteur éteint le cri de `bodyPlan` ; il ne déplace rien d'autre que ce que la race du
    // porteur TIRE pour un individu (`raceAppearance.json` `tirageIndividuel`, #1882), que la race de REPLI ne tire
    // pas. Sonde du juge #1693 promue en garde : le tirage est neutralisé par une palette posée.
    const NEUTRE = { colors: { peau: '#000001', cheveux: '#000002' } };
    const svg = (nom: string, a0: NonNullable<CodexItem['appearance']>, porteur?: string): string => {
      const a = { ...a0, colors: { ...NEUTRE.colors, ...a0.colors } };
      const species = a.species ?? porteur;
      const r = resolveRender(species, findCreatureById(nom)?.traits, nom);
      if (r.kind !== 'rig') return `PLAN:${r.plan}`;
      const p = entityRigProfile(findTrappingById, nom, hashSeed(nom), {
        seed: a.seed, species, tenue: a.tenue, monster: a.monster, features: a.features, colors: a.colors,
        parts: a.parts, sex: a.sex, build: a.build, eyes: a.eyes,
      });
      return p ? bonesToSvg(resolveRig(p.appearance, p.equip, {}, p.tenue, 'front', [])) : 'VIDE';
    };
    const mutations = CODEX.find((c) => c.key === 'mutations')!.items.filter((i) => i.appearance);
    expect(mutations.length).toBeGreaterThan(0);
    // La branche « sans porteur » CRIE (c'est le défaut corrigé) : le cri est attendu ici, muselé.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const changes = mutations.filter((m) => svg(m.label, m.appearance!, undefined) !== svg(m.label, m.appearance!, m.previewPorteur)).map((m) => m.id);
      expect(changes).toEqual([]);
    } finally { spy.mockRestore(); }
  });
});
