import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { maneuvers, traits, traitProjectingManeuver } from './index';
import { codexLookupById } from '../ui/compendium/registry';

/**
 * Une manœuvre est la PROJECTION mécanique d'un Trait de créature (#1226) : le trait porte la prose
 * VERBATIM (LDB 338-343 « TRAITS DE CRÉATURE », Middenheim 115-117) et l'ancrage `source` ; la manœuvre
 * ne porte QUE ses champs mécaniques (activation, coût d'Avantage, ciblage, défense, `effects`, `stake`).
 *
 * Le lien est déclaré UNE fois, chez le trait (`TraitData.grantsManeuvers`) ; `traitProjectingManeuver`
 * en est l'index inverse dérivé — aucune seconde source de vérité côté manœuvre. Cet index étant une
 * `Map`, une manœuvre revendiquée par DEUX traits y serait écrasée en silence : le contrat d'UNICITÉ
 * ci-dessous l'interdit nommément.
 *
 * La prose ET son ancrage vivent chez le TRAIT, repérés au FOLIO (`source.page`) : une manœuvre ne
 * porte AUCUN localisateur RAW propre. La classe de ce localisateur relève de #1228.
 */
const RAW: { id: string; source?: { book: string; page: number }; desc?: string }[] = JSON.parse(
  readFileSync(fileURLToPath(new URL('./maneuvers.json', import.meta.url)), 'utf8'),
);

describe('manœuvre → Trait projetant : une entité, une prose (#1226)', () => {
  it('chaque manœuvre a un trait projetant RÉSOLUBLE, porteur d’une prose non vide (fail-fast, aucun repli)', () => {
    const orphelines = maneuvers
      .filter((m) => !(traitProjectingManeuver(m.id)?.desc ?? '').trim())
      .map((m) => m.id);
    expect(
      orphelines,
      'Manœuvre sans Trait projetant (ou trait sans prose) — déclarer `grantsManeuvers` sur le trait ' +
        `et y poser le verbatim du Source :\n${orphelines.join('\n')}`,
    ).toEqual([]);
  });

  it('chaque manœuvre est revendiquée par UN SEUL trait — l’index inverse n’écrase jamais en silence', () => {
    const parManoeuvre = new Map<string, string[]>();
    for (const t of traits) {
      for (const r of t.grantsManeuvers ?? []) parManoeuvre.set(r.id, [...(parManoeuvre.get(r.id) ?? []), t.id]);
    }
    const doubles = [...parManoeuvre.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([man, ids]) => `${man} ← ${ids.join(' + ')}`);
    expect(
      doubles,
      'Manœuvre revendiquée par PLUSIEURS traits : `traitProjectingManeuver` en perdrait tous sauf le ' +
        `dernier. Un trait projetant, une manœuvre :\n${doubles.join('\n')}`,
    ).toEqual([]);
  });

  it('aucune manœuvre ne porte de prose en propre — la desc vit chez le trait', () => {
    const avecProse = RAW.filter((m) => m.desc != null).map((m) => m.id);
    expect(
      avecProse,
      `Prose dupliquée dans maneuvers.json (règle 5) — la supprimer, le trait projetant la porte :\n${avecProse.join('\n')}`,
    ).toEqual([]);
  });

  it('le folio de la manœuvre est celui du trait projetant (aucune dérive entre les deux ancrages)', () => {
    const derives = RAW.filter((m) => {
      const t = traitProjectingManeuver(m.id);
      return JSON.stringify(m.source) !== JSON.stringify(t?.source);
    }).map((m) => `${m.id} : manœuvre ${JSON.stringify(m.source)} vs trait ${JSON.stringify(traitProjectingManeuver(m.id)?.source)}`);
    expect(derives, `Folio divergent du trait projetant :\n${derives.join('\n')}`).toEqual([]);
  });

  it('le Souffle projette UNE manœuvre, que la règle de chaque Type du verbatim compose (LDB 85 l.322-329)', () => {
    const souffle = traits.find((t) => t.id === 'souffle')!;
    const projetees = maneuvers.filter((m) => traitProjectingManeuver(m.id)?.id === 'souffle').map((m) => m.id);
    expect(projetees).toEqual(['souffle']);
    for (const mot of ['Froid', 'Corrosif', 'Feu', 'Électricité', 'Poison', 'Fumée']) {
      expect(souffle.desc, `le verbatim du trait Souffle couvre le Type ${mot}`).toContain(mot);
    }
  });
});

/** Chemin RÉEL d'affichage : la fiche Codex d'une manœuvre (`codexLookupById`, le registre vivant). */
describe('Codex — la fiche d’une manœuvre affiche le VERBATIM de son trait (#1226)', () => {
  it('« Souffle » rend le verbatim du trait Souffle, jamais un résumé', () => {
    const item = codexLookupById('maneuvers', 'souffle');
    expect(item).toBeDefined();
    expect(item!.desc).toBe(traits.find((t) => t.id === 'souffle')!.desc);
    expect(item!.desc).toContain('Le souffle de la créature est une arme puissante.');
  });

  it('« Morsure » rend le verbatim du trait Morsure', () => {
    const item = codexLookupById('maneuvers', 'morsure');
    expect(item!.desc).toBe(traits.find((t) => t.id === 'morsure')!.desc);
  });

  it('toutes les fiches de manœuvre portent une prose (aucune fiche muette après la suppression des descs)', () => {
    const muettes = maneuvers.filter((m) => !codexLookupById('maneuvers', m.id)?.desc).map((m) => m.id);
    expect(muettes, `Fiche Codex sans prose :\n${muettes.join('\n')}`).toEqual([]);
  });
});
