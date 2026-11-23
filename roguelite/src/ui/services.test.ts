import { describe, expect, it } from 'vitest';
import * as J from '../jeu';
import { panneauDeService } from './services';

/** L'hospice au palier 1 pour un héros à la déchirure mineure, la bourse à `or` CO. */
function hospice(or: number) {
  const e = J.nouvellePartie(3);
  e.or = or;
  e.batiments.temple = 1;
  const h = e.roster[0];
  h.c.traumas = [{ uid: 't1', label: 'Déchirure musculaire (Mineure)', location: 'brasG', kind: 'dechirure', severity: 'mineur', recoveryDays: 23, recoveryTotal: 25 }];
  const { cadre } = panneauDeService({ e, client: h.c.id, emplacement: 'main', dest: null, choix: new Set(), congediement: null }, 'temple');
  return { e, h, cadre, panser: cadre.match(/<button[^>]*data-a="hospice"[^>]*data-k="panser"[^>]*>.*?<\/button>/s)![0] };
}

describe('l’hospice dit avant le clic ce qu’il refuse', () => {
  it('trop peu d’or : « Panser » porte son prix, fermé sur le refus même de l’hospice', () => {
    const { e, h, panser } = hospice(6);
    expect(panser).toContain('Panser · 20 CO');
    expect(panser).toMatch(/\sdisabled[\s>]/);
    expect(panser).toContain('data-bulle="Il faut 20 CO."');
    expect(J.confierALHospice(e, h.c.id, 'panser')).toBe('Il faut 20 CO.');
  });

  it('la bourse suffit : « Panser » s’ouvre et annonce le Test de Guérison des sœurs', () => {
    const { cadre, panser } = hospice(20);
    expect(panser).not.toMatch(/\sdisabled[\s>]/);
    expect(cadre).toContain(`Test de Guérison des sœurs (${J.GUERISON_DE_L_HOSPICE})`);
  });
});
