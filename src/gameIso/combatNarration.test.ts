import { describe, it, expect } from 'vitest';
import { narrateEvent, combatFeed, narrateIntent } from './combatNarration';
import { ev } from '../noyau/combatLog';

const ally = { id: 'h1', label: 'Bidule', kind: 'hero' };
const ally2 = { id: 'h2', label: 'Grunni', kind: 'hero' };
const foe = { id: 'e1', label: 'Machin', kind: 'monster' };
const foe2 = { id: 'e2', label: 'Rat géant', kind: 'monster' };
const cs = [ally, ally2, foe, foe2] as any;

describe('narrateEvent — icône déduite du kind (zéro devinage)', () => {
  it('charge → journal/charge et important (passe au bandeau)', () => {
    const n = narrateEvent(ev('charge', 'Machin charge Bidule', foe.id, ally.id), cs);
    expect(n.icon).toBe('journal/charge');
    expect(n.important).toBe(true);
  });
  it('tir → action/shoot', () => {
    expect(narrateEvent(ev('shoot', 'Grunni tire sur Machin — 5 dégâts', ally2.id, foe.id), cs).icon).toBe('action/shoot');
  });
  it('attaque mêlée → action/attack', () => {
    expect(narrateEvent(ev('attack', 'Bidule attaque Machin', ally.id, foe.id), cs).icon).toBe('action/attack');
  });
  it('posture défensive → flag/defensive et important', () => {
    const n = narrateEvent(ev('defensive', 'Bidule se met en position défensive', ally.id), cs);
    expect(n.icon).toBe('flag/defensive');
    expect(n.important).toBe(true);
  });
  it('viser → action/aim', () => {
    expect(narrateEvent(ev('aim', 'Grunni commence à viser', ally2.id), cs).icon).toBe('action/aim');
  });
  it('état Sonné (kind condition) → icône de effectIcons (condition/stunned)', () => {
    expect(narrateEvent(ev('condition', 'Bidule est Sonné', ally.id), cs).icon).toBe('condition/stunned');
  });
  it('hors de combat → journal/death et important', () => {
    const n = narrateEvent(ev('death', 'Machin est mis hors de combat !', foe.id), cs);
    expect(n.icon).toBe('journal/death');
    expect(n.important).toBe(true);
  });
  it('déplacement → journal/move mais NON important (journal seul)', () => {
    const n = narrateEvent(ev('move', 'Bidule se déplace', ally.id), cs);
    expect(n.icon).toBe('journal/move');
    expect(n.important).toBe(false);
  });
});

describe('ton — emphase/tenue dérivée du kind (source unique)', () => {
  it('critique et mise à mort → grave', () => {
    expect(narrateEvent(ev('crit', 'Critique !', foe.id, ally.id), cs).tone).toBe('grave');
    expect(narrateEvent(ev('death', 'Machin est mis hors de combat !', foe.id), cs).tone).toBe('grave');
  });
  it('Peur → fort ; attaque ordinaire → normal', () => {
    expect(narrateEvent(ev('fear', 'Bidule panique', ally.id), cs).tone).toBe('strong');
    expect(narrateEvent(ev('attack', 'Bidule attaque Machin', ally.id, foe.id), cs).tone).toBe('normal');
  });
});

describe('coloration des noms par camp', () => {
  it('colore l’ennemi (Machin) et l’allié (Bidule), texte reconstituable', () => {
    const n = narrateEvent(ev('charge', 'Machin charge Bidule', foe.id, ally.id), cs);
    const machin = n.segments.find((s) => s.text === 'Machin');
    const bidule = n.segments.find((s) => s.text === 'Bidule');
    expect(machin?.team).toBe('enemy');
    expect(bidule?.team).toBe('ally');
    expect(n.segments.map((s) => s.text).join('')).toBe('Machin charge Bidule');
  });
  it('préfère le nom le plus long (Rat géant, pas “Rat”)', () => {
    const n = narrateEvent(ev('charge', 'Rat géant charge Bidule', foe2.id, ally.id), cs);
    expect(n.segments.some((s) => s.text === 'Rat géant' && s.team === 'enemy')).toBe(true);
  });
});

describe('narrateIntent — annonce d’intention IA (hors journal)', () => {
  const aim = (kind: 'melee' | 'charge' | 'ranged' | 'cast') => ({ fromId: 'e1', toId: 'h1', kind });
  it('charge → journal/charge « Machin charge Bidule », noms colorés, ton normal', () => {
    const n = narrateIntent(aim('charge'), cs)!;
    expect(n.icon).toBe('journal/charge');
    expect(n.tone).toBe('normal');
    expect(n.segments.map((s) => s.text).join('')).toBe('Machin charge Bidule');
    expect(n.segments.find((s) => s.text === 'Machin')?.team).toBe('enemy');
    expect(n.segments.find((s) => s.text === 'Bidule')?.team).toBe('ally');
  });
  it('tir → action/shoot « vise » ; mêlée → action/attack « attaque »', () => {
    expect(narrateIntent(aim('ranged'), cs)!.icon).toBe('action/shoot');
    expect(narrateIntent(aim('ranged'), cs)!.raw).toBe('Machin vise Bidule');
    expect(narrateIntent(aim('melee'), cs)!.icon).toBe('action/attack');
    expect(narrateIntent(aim('melee'), cs)!.raw).toBe('Machin attaque Bidule');
  });
  it('sort → action/cast « lance un sort sur »', () => {
    expect(narrateIntent(aim('cast'), cs)!.raw).toBe('Machin lance un sort sur Bidule');
  });
  it('combattant introuvable → null', () => {
    expect(narrateIntent({ fromId: 'e1', toId: 'zzz', kind: 'melee' }, cs)).toBeNull();
  });
});

describe('combatFeed — derniers événements importants (bandeau)', () => {
  it('garde les N derniers importants, ordre préservé, exclut le déplacement', () => {
    const events = [
      ev('move', 'Bidule se déplace', ally.id),
      ev('charge', 'Machin charge Bidule', foe.id, ally.id),
      ev('aim', 'Grunni commence à viser', ally2.id),
    ];
    const feed = combatFeed(events, cs, 2);
    expect(feed.map((f) => f.icon)).toEqual(['journal/charge', 'action/aim']);
  });
});
