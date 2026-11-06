import { describe, it, expect } from 'vitest';
import { categoryByKey } from './registry';
import { creatures, gods } from '../../data';

/**
 * #1541 — `title` est le SOUS-TITRE AFFICHÉ de la fiche Codex, et son ABSENCE est un ÉTAT VOULU.
 *
 * L'utilisateur l'a dit ainsi le 2026-08-29 (#1541, verbatim) : « null = état voulu — Un Gobelin
 * générique n'a pas de sous-titre — #1541 se ferme sur ce constat, la donnée est complète telle
 * quelle. »
 *
 * Ce que ce contrat VERROUILLE, c'est le CO-INVARIANT des deux sens, pas un compte gelé : un `title`
 * posé s'affiche À L'IDENTIQUE, un `title` nul n'affiche RIEN. Sans lui, deux dérives passeraient
 * muettes — un repli qui REMPLIRAIT le sous-titre absent (le libellé, la carrière, un « — »), et une
 * curation qui viderait des sous-titres réels. Le champ vit à `registry.ts` (`sub: c.title ??
 * undefined` pour les créatures, `sub: c.title` pour les dieux).
 */
describe('Codex — sous-titre : la donnée décide, y compris quand elle dit RIEN (#1541)', () => {
  const items = () => categoryByKey('creatures')!.items;

  it('les deux sens tiennent, entrée par entrée : `title` posé → rendu identique ; `title` nul → aucun sous-titre', () => {
    const parId = new Map(items().map((i) => [i.id, i]));
    const rempli: string[] = [];
    const perdu: string[] = [];
    for (const c of creatures) {
      const item = parId.get(c.id);
      if (!item) continue;
      if (c.title == null && item.sub != null) rempli.push(`${c.id} : sous-titre INVENTÉ « ${item.sub} » (la donnée dit null)`);
      if (c.title != null && item.sub !== c.title) perdu.push(`${c.id} : « ${c.title} » rendu « ${item.sub} »`);
    }
    expect(rempli, rempli.join('\n')).toEqual([]);
    expect(perdu, perdu.join('\n')).toEqual([]);
  });

  it('NON-VACUITÉ : la rubrique porte à la fois des créatures à sous-titre et des créatures sans', () => {
    const subs = items().map((i) => i.sub);
    expect(subs.filter((s) => s != null && s !== '').length).toBeGreaterThan(0);
    expect(subs.filter((s) => s == null).length).toBeGreaterThan(0);
  });

  it('même co-invariant sur les Dieux — l’épithète vient de la donnée, jamais d’un repli', () => {
    const parId = new Map(categoryByKey('gods')!.items.map((i) => [i.id, i]));
    const ecarts = gods
      .filter((g) => parId.has(g.id))
      .filter((g) => (g.title ?? undefined) !== parId.get(g.id)!.sub)
      .map((g) => `${g.id} : « ${g.title} » rendu « ${parId.get(g.id)!.sub} »`);
    expect(ecarts, ecarts.join('\n')).toEqual([]);
  });
});
