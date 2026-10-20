import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { menaceIds, isMenaceId } from '../engine/menace';

/**
 * Garde FK du tag `menace` posé AU CODE (#1346) — pendant de la validation de donnée portée par
 * `flowTestSchema` (`data/schemas/grammaire/mecanique.ts`).
 *
 * Le tag `menace` d'un pending / d'une étape / d'une rangée est une CLÉ ÉTRANGÈRE vers un id de spec
 * de l'entrée `resistance` de `talents.json` (LDB 10 l.1016-1020, liste OUVERTE : l'auteur ajoute une
 * spec au Compendium, aucun code à toucher). Rien, à la lecture, ne distingue un tag vivant d'un tag
 * MORT : `availableResistance` rend `null` sur un id inconnu et le bouton Résistance ne s'affiche
 * simplement jamais — l'affordance est silencieusement absente (c'est ainsi que `menace: 'Exposition'`
 * a survécu au voyage terrestre, et `menace: 'Poursuite'` à un test). Cette garde rend la perte
 * BRUYANTE et NOMINATIVE : chaque littéral posé en position de tag est nommé `fichier:ligne`.
 */
const SELF = 'src/state/menace-fk.test.ts';

/** `menace: '<littéral>'` (ou `"…"`) en position de VALEUR — pas les déclarations de type
 *  (`menace?: string`), pas les lectures (`p.menace`), pas les affectations par variable. */
const TAG_RX = /\bmenace:\s*(['"])([^'"\n]*)\1/g;

/** Les tags littéraux de `src/**` — TESTS COMPRIS, corpus rendu par la primitive de marche
 *  `readCorpus` : `{ site: 'chemin:ligne', valeur }`. Les COMMENTAIRES sont écartés (une ligne de
 *  prose qui cite `menace: 'Poison'` n'est pas un site). */
function tagsLitteraux(): { site: string; valeur: string }[] {
  const out: { site: string; valeur: string }[] = [];
  for (const { rel, text } of readCorpus(['src'], { tests: true })) {
    if (rel === SELF) continue;
    text.split(/\r?\n/).forEach((ligne, i) => {
      const nu = ligne.trim();
      if (nu.startsWith('//') || nu.startsWith('*') || nu.startsWith('/*')) return;
      for (const m of ligne.matchAll(TAG_RX)) out.push({ site: `${rel}:${i + 1}`, valeur: m[2] });
    });
  }
  return out;
}

describe('#1346 — intégrité FK du tag `menace` (Résistance (Menace), LDB 10)', () => {
  it('chaque tag `menace` littéral de src/** référence une spec EXISTANTE du talent `resistance`', () => {
    const tags = tagsLitteraux();
    const morts = tags
      .filter((t) => !isMenaceId(t.valeur))
      .map((t) => `${t.site} → « ${t.valeur} »`);
    expect(
      morts,
      `Tag(s) \`menace\` sans spec correspondante sur le talent « resistance » (talents.json).\n` +
        `Valeurs admises : ${menaceIds().join(', ')}\n${morts.join('\n')}`,
    ).toEqual([]);
    expect(tags.length).toBeGreaterThan(0); // le corpus mesuré n'est pas vide (le scan voit quelque chose)
  });

  it('MORSURE du scan : la forme cherchée est bien celle des sites réels, et les tags vivants sont VUS', () => {
    const tags = tagsLitteraux();
    // Les producteurs connus posent leur tag en littéral : le scan les voit tous les trois.
    const vus = new Set(tags.map((t) => `${t.site.split(':')[0]}=${t.valeur}`));
    expect(vus).toContain('src/noyau/corruptionFlow.ts=mutation');
    expect(vus).toContain('src/noyau/combatFlow.ts=magie');
    expect(vus).toContain('src/noyau/combatFlow.ts=maladie');
  });
});
