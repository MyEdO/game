import { describe, it, expect } from 'vitest';
import { narrateEvent, combatFeed, narrateIntent } from './combatNarration';
import { ev } from '../noyau/combatLog';

const ally = { id: 'h1', label: 'Bidule', kind: 'heros' };
const ally2 = { id: 'h2', label: 'Grunni', kind: 'heros' };
const foe = { id: 'e1', label: 'Machin', kind: 'monster' };
const foe2 = { id: 'e2', label: 'Rat géant', kind: 'monster' };
const cs = [ally, ally2, foe, foe2] as any;

describe('narrateEvent — icône déduite du kind (zéro devinage)', () => {
  it('charge → journal/charge et important (passe au bandeau)', () => {
    const n = narrateEvent(ev('charge', 'Machin charge Bidule', foe.id, ally.id), cs);
    expect(n.icon).toBe('journal/charge');
    expect(n.important).toBe(true);
  });
  it('tir → action/tirer', () => {
    expect(narrateEvent(ev('tir', 'Grunni tire sur Machin — 5 dégâts', ally2.id, foe.id), cs).icon).toBe('action/tirer');
  });
  it('attaque mêlée → action/attaquer', () => {
    expect(narrateEvent(ev('attaque', 'Bidule attaque Machin', ally.id, foe.id), cs).icon).toBe('action/attaquer');
  });
  it('posture défensive → drapeau/posture-defensive et important', () => {
    const n = narrateEvent(ev('defensive', 'Bidule se met en position défensive', ally.id), cs);
    expect(n.icon).toBe('drapeau/posture-defensive');
    expect(n.important).toBe(true);
  });
  it('viser → action/viser', () => {
    expect(narrateEvent(ev('visee', 'Grunni commence à viser', ally2.id), cs).icon).toBe('action/viser');
  });
  it('état Sonné (kind condition) → icône de effectIcons (etat/sonne)', () => {
    expect(narrateEvent(ev('etat', 'Bidule est Sonné', ally.id), cs).icon).toBe('etat/sonne');
  });
  it('hors de combat → journal/mort et important', () => {
    const n = narrateEvent(ev('mort', 'Machin est mis hors de combat !', foe.id), cs);
    expect(n.icon).toBe('journal/mort');
    expect(n.important).toBe(true);
  });
  it('déplacement → journal/mouvement mais NON important (journal seul)', () => {
    const n = narrateEvent(ev('deplacement', 'Bidule se déplace', ally.id), cs);
    expect(n.icon).toBe('journal/mouvement');
    expect(n.important).toBe(false);
  });
});

describe('ton — emphase/tenue dérivée du kind (source unique)', () => {
  it('critique et mise à mort → grave', () => {
    expect(narrateEvent(ev('critique', 'Critique !', foe.id, ally.id), cs).tone).toBe('grave');
    expect(narrateEvent(ev('mort', 'Machin est mis hors de combat !', foe.id), cs).tone).toBe('grave');
  });
  it('Peur → fort ; attaque ordinaire → normal', () => {
    expect(narrateEvent(ev('peur', 'Bidule panique', ally.id), cs).tone).toBe('strong');
    expect(narrateEvent(ev('attaque', 'Bidule attaque Machin', ally.id, foe.id), cs).tone).toBe('normal');
  });
});

describe('coloration des noms par camp', () => {
  it('colore l’ennemi (Machin) et l’allié (Bidule), texte reconstituable', () => {
    const n = narrateEvent(ev('charge', 'Machin charge Bidule', foe.id, ally.id), cs);
    const machin = n.segments.find((s) => s.text === 'Machin');
    const bidule = n.segments.find((s) => s.text === 'Bidule');
    expect(machin?.team).toBe('ennemi');
    expect(bidule?.team).toBe('allie');
    expect(n.segments.map((s) => s.text).join('')).toBe('Machin charge Bidule');
  });
  it('préfère le nom le plus long (Rat géant, pas “Rat”)', () => {
    const n = narrateEvent(ev('charge', 'Rat géant charge Bidule', foe2.id, ally.id), cs);
    expect(n.segments.some((s) => s.text === 'Rat géant' && s.team === 'ennemi')).toBe(true);
  });
});

describe('narrateIntent — annonce d’intention IA (hors journal)', () => {
  const aim = (kind: 'melee' | 'charge' | 'tir' | 'incantation') => ({ fromId: 'e1', toId: 'h1', kind });
  it('charge → journal/charge « Machin charge Bidule », noms colorés, ton normal', () => {
    const n = narrateIntent(aim('charge'), cs)!;
    expect(n.icon).toBe('journal/charge');
    expect(n.tone).toBe('normal');
    expect(n.segments.map((s) => s.text).join('')).toBe('Machin charge Bidule');
    expect(n.segments.find((s) => s.text === 'Machin')?.team).toBe('ennemi');
    expect(n.segments.find((s) => s.text === 'Bidule')?.team).toBe('allie');
  });
  it('tir → action/tirer « vise » ; mêlée → action/attaquer « attaque »', () => {
    expect(narrateIntent(aim('tir'), cs)!.icon).toBe('action/tirer');
    expect(narrateIntent(aim('tir'), cs)!.raw).toBe('Machin vise Bidule');
    expect(narrateIntent(aim('melee'), cs)!.icon).toBe('action/attaquer');
    expect(narrateIntent(aim('melee'), cs)!.raw).toBe('Machin attaque Bidule');
  });
  it('sort → action/incanter « lance un sort sur »', () => {
    expect(narrateIntent(aim('incantation'), cs)!.raw).toBe('Machin lance un sort sur Bidule');
  });
  it('combattant introuvable → null', () => {
    expect(narrateIntent({ fromId: 'e1', toId: 'zzz', kind: 'melee' }, cs)).toBeNull();
  });
});

describe('combatFeed — derniers événements importants (bandeau)', () => {
  it('garde les N derniers importants, ordre préservé, exclut le déplacement', () => {
    const events = [
      ev('deplacement', 'Bidule se déplace', ally.id),
      ev('charge', 'Machin charge Bidule', foe.id, ally.id),
      ev('visee', 'Grunni commence à viser', ally2.id),
    ];
    const feed = combatFeed(events, cs, 2);
    expect(feed.map((f) => f.icon)).toEqual(['journal/charge', 'action/viser']);
  });
});
