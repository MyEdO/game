/**
 * Variantes réglées de `talents.json` (#563/#564), provenance 2 : l'affichage Codex (le registre RÉEL
 * `registry.ts`, via `effectiveEntry`) suit la règle qui gate la variante. Les autres provenances :
 * `src/engine/combatFeatures/variants-lot4.test.ts`.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setRule, resetRule, type RegleOptionnelleId } from '../../engine/policy';
import { activeVariant } from '../../engine/variants';
import { findTalentById } from '../../data';
import { ALL_VARIANT_CARRIERS, ruleOf } from '../../engine/combatFeatures/variantesDeTalent.testkit';
import { CODEX } from './registry';

afterEach(() => { for (const id of ALL_VARIANT_CARRIERS) resetRule(ruleOf(id)); });

/** Fiche Codex RÉELLE d'un talent, re-projetée après un changement de règle optionnelle. */
function codexTalent(id: string) {
  return CODEX.find((c) => c.key === 'talents')!.items.find((i) => i.id === id)!;
}
const metaOf = (id: string, label: string) => codexTalent(id).meta?.find((f) => f.label === label)?.value;

describe('provenance 2 — affichage CODEX (le registre RÉEL noyau/codex/registry.ts, via effectiveEntry)', () => {
  it('la desc de chaque talent à variante bascule base ↔ variante avec SA règle, et la fiche Codex suit', () => {
    for (const id of ALL_VARIANT_CARRIERS) {
      const t = findTalentById(id)!;
      const td = t as unknown as { variants?: { when: { rule: RegleOptionnelleId }; desc?: string }[] };
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
