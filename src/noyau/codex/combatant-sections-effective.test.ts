import { describe, it, expect } from 'vitest';
import { combatantSections } from './registry';
import { pregen, PREGEN } from '../../data/pregens';
import { effectiveChar } from '../../engine/characteristics';
import { skillBaseValue } from '../../engine/skills';
import { charAbr } from '../../data';

/**
 * Contre-vérification au moteur (#498) : `combatantSections` (statbloc Codex/inspection) doit AFFICHER
 * exactement ce que rendent les lecteurs canoniques (`effectiveChar`/`skillBaseValue`), jamais la carac
 * BRUTE `characteristics[k]`. Fixture = pré-tiré Sigmund (talent « Guerrier né », charMod permanent sur
 * CC) — un pregen SANS talent à charMod ne prouverait rien (effective === brute par coïncidence).
 */
describe('combatantSections — affichage carac/compétence = moteur (#498)', () => {
  const sigmund = pregen(PREGEN.soldat);

  it('fixture pertinente : Sigmund porte un talent à charMod sur CC (effective > brute)', () => {
    expect(effectiveChar(sigmund, 'capacite-de-combat')).toBeGreaterThan(sigmund.characteristics['capacite-de-combat']);
  });

  it('la row de carac CC affiche effectiveChar, pas la carac brute', () => {
    const sections = combatantSections(sigmund);
    const carSec = sections.find((s) => s.title === 'Caractéristiques')!;
    const ccRow = carSec.rows.find((r) => 'k' in r && r.k === charAbr('capacite-de-combat')) as { v: string };
    expect(ccRow.v).toBe(String(effectiveChar(sigmund, 'capacite-de-combat')));
  });

  it('une row de compétence dont la carac porte un passif se termine par skillBaseValue', () => {
    const sections = combatantSections(sigmund);
    const skillSec = sections.find((s) => s.title === 'Compétences')!;
    const ccSkill = sigmund.skills.find((s) => s.characteristic === 'capacite-de-combat');
    expect(ccSkill).toBeDefined();
    const expected = skillBaseValue(sigmund, ccSkill!.id, ccSkill!.spec);
    const row = skillSec.rows.find((r) => 'show' in r && r.show?.endsWith(` ${expected}`)) as { show?: string } | undefined;
    expect(row).toBeDefined();
  });
});
