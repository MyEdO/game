/**
 * CÂBLAGE des variantes réglées de `spells.json` (#729, chantier VDM), part de l'AFFICHAGE : la fiche
 * Codex RÉELLE (`registry.ts`) lit la forme effective (`findSpellById`) sous la règle optionnelle
 * `magie-vdm-incantation`. La donnée et ses consommateurs moteur : `src/data/vdm-spells-variantes.test.ts`.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setRule, resetRule } from '../../engine/policy';
import { findSpellById, spells } from '../../data/index';
import { CODEX } from './registry';

const RULE = 'magie-vdm-incantation';

afterEach(() => resetRule(RULE));

describe('affichage — la fiche Codex RÉELLE (noyau/codex/registry) suit la règle', () => {
  const fiche = (id: string) => {
    return CODEX.find((c) => c.key === 'spells')!.items.find((i) => i.id === id)!;
  };
  const meta = (id: string, label: string) => fiche(id).meta?.find((f) => f.label === label)?.value;

  it('Caresse de Laniph : desc, source et « NI » affichés sont ceux du livre actif', () => {
    const base = spells.find((s) => s.id === 'caresse-de-laniph');
    expect(fiche('caresse-de-laniph').desc).toBe(base?.desc);
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
