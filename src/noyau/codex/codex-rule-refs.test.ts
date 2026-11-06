/**
 * RULE_REF (#1078 LOT B3a) — INTÉGRITÉ des renvois que le type ne juge pas : ceux d'une catégorie
 * Codex SANS espace d'ids (`RenvoiCodexSansEspace`, `grammaire/ref.ts`) et les refs PRODUITES par le
 * moteur résolvent une fiche du registre (`codexLookupById`). Le cliquet des `ModLine` sans `ref` :
 * `src/engine/rule-refs.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { RULE_REF } from '../../engine/ruleRefs';
import { CATEGORIE_CODEX_DU_FICHIER } from '../../data/schemas/_cles-de-dataset.generated';
import { IDS_PAR_ESPACE } from '../../data/schemas/_ids.generated';
import { weatherRef } from '../../engine/travelStages';
import { weatherIdSchema } from '../../data/schemas/defs/weather';
import { windsModLine, windsModFromRoll } from '../../engine/windsOfMagic';
import { codexLookupById } from './registry';

describe('RULE_REF — la référence pointe une fiche Codex réelle', () => {
  it('chaque règle référencée dans une catégorie SANS espace d\'ids existe au catalogue, par id STABLE', () => {
    const categoriesAEspace = new Set(Object.entries(CATEGORIE_CODEX_DU_FICHIER).filter(([fichier]) => fichier in IDS_PAR_ESPACE).map(([, c]) => c));
    const sansEspace = Object.entries(RULE_REF).filter(([, ref]) => !categoriesAEspace.has(ref.category));
    expect(sansEspace.length, 'aucun renvoi hors espace : cette assertion est morte, la supprimer').toBeGreaterThan(0);
    for (const [rule, ref] of sansEspace) {
      expect(codexLookupById(ref.category, ref.id), `RULE_REF['${rule}'] → ${ref.category}/${ref.id} introuvable au Codex`).toBeTruthy();
    }
  });

  /**
   * Angle mort de la garde ci-dessus : une `ref` PRODUITE (catégorie hors `RULE_REF`, id calculé de
   * la donnée) n'y figure pas — une catégorie mal orthographiée ou un id absent rendrait la chip
   * muette à l'écran sans qu'aucun test ne bronche. Chaque producteur dynamique est donc énuméré
   * sur son DOMAINE COMPLET.
   */
  it('les refs PRODUITES résolvent au Codex — météo : les 6 conditions, force des Vents : les 10 faces du d10', () => {
    // DOMAINE COMPLET dérivé de la DÉCLARATION (`weatherIdSchema`, `defs/weather.ts`) : une 7ᵉ météo
    // ajoutée au schéma entre ici toute seule — une liste recopiée aurait laissé le trou en silence.
    for (const w of weatherIdSchema.options) {
      const ref = weatherRef(w);
      expect(codexLookupById(ref.category, ref.id), `weatherRef('${w}') → ${ref.category}/${ref.id} introuvable au Codex`).toBeTruthy();
    }
    for (let roll = 1; roll <= 10; roll++) {
      const mod = windsModFromRoll(roll);
      const line = windsModLine({ roll, mod });
      if (mod === 0) {
        // Vents stables : aucune ligne à afficher (rien à référencer).
        expect(line, `windsModLine(d10=${roll}) — force neutre, aucune ligne`).toBeNull();
        continue;
      }
      const ref = line!.ref!;
      expect(codexLookupById(ref.category, ref.id), `windsModLine(d10=${roll}) → ${ref.category}/${ref.id} introuvable au Codex`).toBeTruthy();
      expect(line!.label, `windsModLine(d10=${roll}) NOMME la ligne du Tableau, jamais un libellé maison`)
        .toBe(codexLookupById(ref.category, ref.id)!.label);
    }
    // Aucun Vent tiré (option inactive / hors combat) : aucune ligne — jamais une chip sans référence.
    expect(windsModLine(undefined)).toBeNull();
    expect(windsModLine(null)).toBeNull();
  });
});
