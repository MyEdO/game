/**
 * #1318 E1 — CÂBLAGE de la borne d'une règle optionnelle chiffrée (`kind: 'param'`). Le panneau ne
 * connaît AUCUNE règle : il rend un contrôle par entrée du registre. Depuis la migration vers
 * `NumberField`, la saisie clavier est CALÉE — avant, seule la donnée annonçait le domaine et rien
 * ne l'appliquait. Ce que ce test verrouille : la borne DITE au DOM est bien celle de l'entrée
 * (`src/data/reglesOptionnelles.json`), jamais une valeur écrite au site.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HouseRulesPanel } from './HouseRulesModal';
import { OPTIONAL_RULES, type OptionalRule } from '../engine/policy';

describe('HouseRulesPanel — la borne d’une règle chiffrée vient de la DONNÉE', () => {
  const params = OPTIONAL_RULES.filter((r): r is Extract<OptionalRule, { kind: 'param' }> => r.kind === 'param');

  it('le champ rendu porte le min/max/step de SON entrée — jamais une borne écrite au panneau', () => {
    const html = renderToStaticMarkup(<HouseRulesPanel />);
    const champs = [...html.matchAll(/<input[^>]*type="number"[^>]*>/g)].map((m) => m[0]);
    expect(champs.length, 'aucun champ nombre rendu par le panneau').toBeGreaterThan(0);
    let mesures = 0;
    for (const r of params) {
      const champ = champs.find((t) => t.includes(`aria-label="${r.label}"`));
      if (!champ) continue; // onglet non rendu : le panneau n'affiche qu'un groupe à la fois
      mesures++;
      expect(champ, `${r.id} : min`).toContain(`min="${r.min}"`);
      expect(champ, `${r.id} : max`).toContain(`max="${r.max}"`);
      expect(champ, `${r.id} : step`).toContain(`step="${r.step ?? 1}"`);
    }
    expect(mesures, 'aucune règle chiffrée confrontée : la boucle passerait à vide').toBeGreaterThan(0);
  });
});
