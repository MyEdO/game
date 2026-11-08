import { describe, it, expect } from 'vitest';
import { describeQuality } from './describe';
import { qualities } from '../../data';
import { parseQualityInstance } from '../../data/refFormatLivre';

/** Décrit depuis un libellé/id saisi (authoring) : prose → `QualityInstance` → describe. Inconnu → id brut. */
const dq = (raw: string) => describeQuality(parseQualityInstance(raw) ?? { id: raw });

describe('describeQuality (affichage Atouts/Défauts)', () => {
  it('résout clé + Indice + libellé + description', () => {
    const r = dq('Recharge 2')!;
    expect(r.key).toBe('Recharge');
    expect(r.indice).toBe(2);
    expect(r.label).toBe('Recharge 2');
    expect(r.desc).toMatch(/recharger/i);
  });

  it('insensible à la casse, sans Indice', () => {
    const r = dq('précise')!;
    expect(r.key).toBe('Précise');
    expect(r.label).toBe('Précise');
    expect(r.desc).toContain('+10');
  });

  it('renvoie le type Atout/Défaut du registre', () => {
    expect(dq('Défensive')!.polarite).toBe('atout');
    expect(dq('Peu Fiable')!.polarite).toBe('defaut');
  });

  it('qualité inconnue → null', () => {
    expect(dq('Sortilège bidon')).toBeNull();
  });

  it('chaque qualité du catalogue a une description SERVIE par son id (anti-régression)', () => {
    for (const q of qualities) {
      expect(describeQuality({ id: q.id })?.desc, `description manquante pour « ${q.label} » (${q.id})`).toBeTruthy();
    }
  });
});
