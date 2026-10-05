/**
 * FACES D'AFFICHAGE de la donnée (#1988 §5) — elles rendent `PlayerText` et composent leurs liants au
 * catalogue (`src/i18n/messages/fr.ts`). Deux contrats : le texte FR rendu est celui du livre, et un
 * liant suit sa clé de message (un catalogue d'une autre langue le remplace sans toucher au code). Les
 * parseurs de saisie « format livre » lisent les MÊMES clés : un aller-retour rend la même référence.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { fr } from '../i18n/messages/fr';
import { advancementLabel, choixLabel, skillRefLabel, trappingRefLabel, type TrappingRef } from './index';
import { parseSkillRef } from '../ui/editor/refFormatLivre';

const catalogue = fr as Record<string, string>;
const livre = { ...catalogue };
afterEach(() => { Object.assign(catalogue, livre); });

describe('faces d’affichage : le texte FR de la donnée', () => {
  it('« Au choix » et « A ou B » d’un emplacement de spécialisation', () => {
    expect(choixLabel('skills', 'savoir', true)).toBe('Savoir (Au choix)');
    expect(choixLabel('skills', 'corps-a-corps', ['fleau', 'deux-mains'])).toBe('Corps à corps (Fléau ou Deux-mains)');
  });

  it('avancement : « A ou B », tirage d’un ou de plusieurs Talents', () => {
    expect(advancementLabel('talents', { pick: 1, of: [{ id: 'guide-fluvial' }, { id: 'bonnes-jambes' }] })).toBe('Guide fluvial ou Bonnes jambes');
    expect(advancementLabel('talents', { random: 1 })).toBe('Talent aléatoire');
    expect(advancementLabel('talents', { random: 3 })).toBe('3 Talents aléatoires');
    expect(advancementLabel('talents', { pick: 2, of: [{ id: 'guide-fluvial' }, { id: 'bonnes-jambes' }] })).toBe('2 parmi : Guide fluvial, Bonnes jambes');
  });

  it('dotation : branches, joker d’arme, Atout au choix', () => {
    const choix: TrappingRef = { choice: [{ id: 'dague' }, { id: 'baton-de-combat' }] };
    expect(trappingRefLabel(choix)).toBe('Dague ou Bâton de combat');
    expect(trappingRefLabel({ wildcard: 'arme' })).toBe('Arme (au choix)');
    expect(trappingRefLabel({ id: 'dague', qualityChoice: true })).toBe('Dague (qualité au choix)');
  });
});

describe('faces d’affichage : le liant suit SA clé de message', () => {
  it('`ref.ou` change le liant de toutes les alternatives', () => {
    catalogue['ref.ou'] = 'or';
    expect(trappingRefLabel({ choice: [{ id: 'dague' }, { id: 'baton-de-combat' }] })).toBe('Dague or Bâton de combat');
    expect(choixLabel('skills', 'corps-a-corps', ['fleau', 'deux-mains'])).toBe('Corps à corps (Fléau or Deux-mains)');
  });

  it('`ref.motAuChoix`, `ref.armeAuChoix`, `ref.qualiteAuChoix`, `ref.talentsAleatoires`', () => {
    catalogue['ref.motAuChoix'] = 'Any';
    catalogue['ref.armeAuChoix'] = 'Weapon (any)';
    catalogue['ref.qualiteAuChoix'] = '{base} (any quality)';
    catalogue['ref.talentsAleatoires'] = '{n} random Talents';
    expect(choixLabel('skills', 'savoir', true)).toBe('Savoir (Any)');
    expect(trappingRefLabel({ wildcard: 'arme' })).toBe('Weapon (any)');
    expect(trappingRefLabel({ id: 'dague', qualityChoice: true })).toBe('Dague (any quality)');
    expect(advancementLabel('talents', { random: 3 })).toBe('3 random Talents');
  });
});

describe('saisie « format livre » : aller-retour sur les MÊMES clés que l’affichage', () => {
  const refs = [
    { id: 'savoir', choix: true as const, value: 40 },
    { id: 'corps-a-corps', choix: ['fleau', 'deux-mains'], value: 45 },
    { id: 'corps-a-corps', spec: 'fleau', value: 50 },
  ];

  it('texte affiché → saisie → même référence', () => {
    for (const ref of refs) expect(parseSkillRef(skillRefLabel(ref))).toEqual(ref);
  });

  it('sous un autre catalogue, l’aller-retour tient encore : la saisie lit le liant affiché', () => {
    catalogue['ref.ou'] = 'or';
    catalogue['ref.motAuChoix'] = 'Any';
    for (const ref of refs) expect(parseSkillRef(skillRefLabel(ref))).toEqual(ref);
  });
});
