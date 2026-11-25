/** #680 sur les paquets livrés : chaque profil de preset se retrouve au Combatant spawné. */
import { describe, it, expect, beforeEach } from 'vitest';
import { listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';
import { ouvrirLeBanc, type Banc } from '../../../src/noyau/banc.testkit';
import { presetDuNarratif, resolvePresetCreature } from '../../../src/noyau/monde/resolveursDuNarratif';
import { creatureToCombatant } from '../../../src/noyau/monde/spawn';
import { parseProject } from '../../../src/noyau/worldMap';
import type { NarratifBlock } from '../../../src/data/schemas/defs-scenes/narratif';
import type { Combatant } from '../../../src/engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Le résolveur de preset du narratif chargé sur le banc. */
const presetPnjById = (id: string) => presetDuNarratif(banc.getState().campaignNarratif)(id);

/** Lecture au Combatant d'une clé de `profil.char` (`creatureToCombatant`, `noyau/monde/spawn.ts`). */
function auCombatant(c: Combatant, cle: string): unknown {
  if (cle === 'M') return c.movement;
  if (cle === 'B') return c.wounds.max;
  return (c.characteristics as Record<string, number | undefined>)[cle];
}

/** Valeur attendue au Combatant : « - » imprimé (`null`) → 0 (#2304). */
const attendue = (cle: string, v: number | null): number | null => (v === null && cle !== 'M' && cle !== 'B' ? 0 : v);

type PresetLivre = NarratifBlock['presetsPnj'][number];

/** Écarts entre le profil d'un preset (caractéristiques, M, B, Corruption) et le Combatant spawné. */
function ecartsAuCombatant(ou: string, preset: PresetLivre, c: Combatant): string[] {
  const fautes: string[] = [];
  for (const [cle, v] of Object.entries(preset.profil?.char ?? {})) {
    const voulu = attendue(cle, v);
    if (voulu !== null && auCombatant(c, cle) !== voulu) fautes.push(`${ou} : ${cle} attendu ${voulu}, lu ${String(auCombatant(c, cle))}`);
  }
  const corruption = preset.profil?.corruption;
  if (corruption !== undefined && c.corruption !== corruption) fautes.push(`${ou} : corruption attendue ${corruption}, lue ${String(c.corruption)}`);
  return fautes;
}

describe('presets des projets livrés — chaque profil se retrouve au Combatant spawné (#680)', () => {
  const projets = listerProjetsLivres().map((rel) => ({
    rel,
    narratif: parseProject(lireProjetLivre(rel)).narratif,
  }));

  it('résolu, spawné sans lever, caractéristiques / M / B / Corruption du profil portés par le Combatant', () => {
    const verifies: string[] = [];
    const fautes: string[] = [];
    for (const { rel, narratif } of projets) {
      banc.setState({ campaignNarratif: narratif });
      for (const preset of narratif.presetsPnj) {
        const ou = `${rel} › ${preset.id}`;
        const r = resolvePresetCreature(preset.id, presetPnjById);
        if (!r) {
          fautes.push(`${ou} : irrésoluble`);
          continue;
        }
        let c: Combatant;
        try {
          c = creatureToCombatant(r.creature, preset.id, { x: 0, y: 0 });
        } catch (e) {
          fautes.push(`${ou} : creatureToCombatant lève (${String(e)})`);
          continue;
        }
        fautes.push(...ecartsAuCombatant(ou, preset, c));
        verifies.push(ou);
      }
    }
    expect(fautes).toEqual([]);
    expect(verifies.length, 'aucun preset vérifié : la propriété serait vraie à vide').toBeGreaterThan(0);
  });

  it('contre-épreuve : un profil ALTÉRÉ (caractéristique et Corruption) face au Combatant réel remplit les fautes', () => {
    const [{ narratif }] = projets.filter((p) => p.narratif.presetsPnj.some((x) => x.profil?.char && x.profil.corruption !== undefined));
    banc.setState({ campaignNarratif: narratif });
    const preset = narratif.presetsPnj.find((x) => x.profil?.char && x.profil.corruption !== undefined)!;
    const c = creatureToCombatant(resolvePresetCreature(preset.id, presetPnjById)!.creature, preset.id, { x: 0, y: 0 });
    const [cle, v] = Object.entries(preset.profil!.char!).find(([, x]) => typeof x === 'number')! as [string, number];
    const altere: PresetLivre = { ...preset, profil: { ...preset.profil, char: { ...preset.profil!.char, [cle]: v + 1 }, corruption: preset.profil!.corruption! + 1 } };
    expect(ecartsAuCombatant(preset.id, preset, c), 'le profil réel ne diverge pas').toEqual([]);
    const fautes = ecartsAuCombatant(preset.id, altere, c);
    expect(fautes.some((f) => f.includes(`${cle} attendu ${v + 1}`)), fautes.join(' ; ')).toBe(true);
    expect(fautes.some((f) => f.includes('corruption attendue')), fautes.join(' ; ')).toBe(true);
  });
});
