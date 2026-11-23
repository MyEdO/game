import { describe, expect, it } from 'vitest';
import { addCondition, COND } from '../../../src/engine/conditions';
import { chancesDeReussite, epreuveTentable, jouerLEpreuve } from '../noyau';
import { ecranDeLExpedition } from '../ui/lieux';
import { ACTIONS_A_JET, herosDuGroupe, refusDAction, refusDuSoigneur, viseeDuSoigneur } from './index';
import { devant } from './salles.testkit';

/** La carte du héros `id` au socle de l'écran `html`. */
const carte = (html: string, id: string): string => {
  const m = new RegExp(`<button type="button" class="carte-heros[^"]*" data-a="tenter" data-id="${id}"[\\s\\S]*?</button>`).exec(html);
  if (!m) throw new Error(`carte de ${id} absente du socle`);
  return m[0];
};

describe('le socle dit les chances de chaque héros avant de choisir', () => {
  it('« Qui intimide ? » : chaque carte dit la cible et les chances du Test que le noyau joue pour ce héros', () => {
    const e = devant('rencontre', 7);
    const groupe = herosDuGroupe(e);
    addCondition(groupe[1].c, COND.extenue, 2);
    const { epreuves } = ACTIONS_A_JET.intimider;
    const html = ecranDeLExpedition(e, '', null, '', { action: 'intimider' });
    expect(html).toContain('Qui intimide ?');
    let tentables = 0;
    for (const h of groupe) {
      const c = carte(html, h.c.id);
      const refus = refusDAction(h, 'intimider');
      if (refus) { expect(c).toContain(' disabled'); expect(c).toContain(refus); continue; }
      tentables++;
      const issue = jouerLEpreuve([h.c], epreuveTentable(h.c, epreuves)!, 1);
      if ('refus' in issue) throw new Error(issue.refus);
      expect(c).toContain(`Intimidation ${issue.cible} · <b class="chiffres">${chancesDeReussite(issue.cible)}\u00a0%</b>`);
    }
    expect(tentables).toBeGreaterThan(0);
  });

  it('« Qui soigne ? » : la carte du soigneur dit sa Guérison et ses chances, les autres leur refus', () => {
    const e = devant('camp', 2, ['medecin']);
    const groupe = herosDuGroupe(e);
    groupe[0].c.wounds.current = 2;
    const html = ecranDeLExpedition(e, '', null, '', { action: 'soigner' });
    let soigneurs = 0;
    for (const h of groupe) {
      const c = carte(html, h.c.id);
      const refus = refusDuSoigneur(e, h);
      const v = viseeDuSoigneur(e, h);
      if (refus) { expect(c).toContain(refus); continue; }
      soigneurs++;
      expect(c).toContain(`Guérison ${v!.cible} · <b class="chiffres">${v!.chances}\u00a0%</b>`);
    }
    expect(soigneurs).toBeGreaterThan(0);
  });
});
