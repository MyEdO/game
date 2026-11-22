import { expect, it } from 'vitest';
import { idsDeTest } from '../../../src/engine/idsDeTest.testkit';
import type { Combatant } from '../../../src/noyau/index';
import { surUnBancHorsTest } from '../../../src/noyau/banc.testkit';
import { castSpell } from '../../../src/noyau/combatFlow';
import { lancerLeScenario } from '../../../src/noyau/lancementDeScenario';
import { snapshotSave, type SaveGame } from '../../../src/noyau/persistance/save';
import { combattantEnVue } from '../../../src/noyau/visionDuGroupe';
import { lancementDuScenario } from '../../../src/scenes/test-scenarios/_shared';
import { testScenarios } from '../../../src/scenes/test-scenarios';
import { ecrireLaSauvegarde } from '../../../src/hote/sauvegardes';
import { clicDuCombattant } from './pont';
import { suiteDe, table } from './pont.testkit';

const cleDeLaCase = ({ x, y, z }: NonNullable<Combatant['pos']>) => `${x},${y},${z ?? 0}`;

it('le choix Colérique garde le nom déjà vu et le pont tait la case actuelle, puis le champ peut encore viser à l’aveugle', () => {
  const { avant, horsFenetre, pendant, pendantCibleVisible, idCache, caseCachee, caseVue, idVisible, positionVisible, nomVu } = surUnBancHorsTest((banc) => {
    const scenario = testScenarios.find((s) => s.id === 'siege-enceinte')!;
    lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(scenario, idsDeTest));
    const jeu = banc.getState;
    jeu().fenetreValider('debutDuRound');
    banc.abandonner();
    const parId = (id: string) => jeu().battle!.combatants.find((c) => c.id === id)!;
    const cache = parId('personnage-5');
    const visible = parId('personnage-7');
    const sorcier = parId('sorcier-de-test');
    const soldat = parId('soldat-de-test');
    const caseVue = { x: 16, y: 44, z: 0 };
    const caseCachee = cache.pos!;
    const nomVu = 'Guetteur aperçu';
    const place = (pos: NonNullable<Combatant['pos']>, label: string) => {
      const battle = jeu().battle!;
      banc.setState({ battle: {
        ...battle,
        turn: battle.order.indexOf(sorcier.id),
        combatants: battle.combatants.map((c) => (c.id === cache.id ? { ...c, pos, label } : c)),
      } });
    };
    const sauvegarde = () => snapshotSave(jeu(), '2026-11-22T09:00:00Z');

    place(caseVue, nomVu);
    expect(combattantEnVue(jeu(), parId(cache.id))).toBe(true);
    const avant = sauvegarde();
    place(caseCachee, 'Guetteur renommé hors de vue');
    expect(combattantEnVue(jeu(), parId(cache.id))).toBe(false);
    expect(combattantEnVue(jeu(), visible)).toBe(true);

    banc.setState({ battle: { ...jeu().battle!, preview: { kind: 'attaque', targetId: cache.id } } });
    const horsFenetre = sauvegarde();
    castSpell(jeu, banc.setState, sorcier, soldat, 'colerique');
    jeu().jetLancer('incantation');
    const pc = jeu().pendingCast!;
    banc.setState({ pendingCast: { ...pc, result: { ...pc.result!, cast: true, sl: 2, isCritical: false, isFumble: false } } });
    jeu().jetValider('incantation');
    expect(jeu().battle?.preview).toEqual({ kind: 'attaque', targetId: cache.id });
    const pendant = sauvegarde();
    banc.setState({ battle: { ...jeu().battle!, preview: { kind: 'attaque', targetId: visible.id } } });
    return {
      avant, horsFenetre, pendant, pendantCibleVisible: sauvegarde(), idCache: cache.id, caseCachee, caseVue,
      idVisible: visible.id, positionVisible: visible.pos!, nomVu,
    };
  });

  const { appel, stockage } = table();
  const vueDeLaSauvegarde = (save: SaveGame) => {
    expect(ecrireLaSauvegarde(stockage, 1, save)).toBe(true);
    const { vue } = suiteDe(appel('charger', { charger: 1, graine: 1 }));
    expect(appel('quitter')).toMatchObject({ ok: true });
    return vue;
  };

  const vueInitiale = vueDeLaSauvegarde(avant);
  expect(vueInitiale.projection.combat?.voisins.liste).toContainEqual(expect.objectContaining({ id: idCache, nom: nomVu }));
  expect(vueInitiale.occupants[cleDeLaCase(caseVue)]).toBe(idCache);

  const offre = vueDeLaSauvegarde(pendant);
  expect(offre.projection.fenetre?.etape?.genre).toBe('personneChoisie');
  expect(offre.champ).toBeNull();
  expect(JSON.stringify(offre.zones)).toContain(nomVu);
  expect(offre.projection.fenetre?.etape?.choix).not.toContain(idCache);
  expect(offre.occupants[cleDeLaCase(positionVisible)]).toBe(idVisible);
  expect.soft(offre.occupants[cleDeLaCase(caseCachee)]).toBeUndefined();
  expect.soft(Object.values(offre.occupants)).not.toContain(idCache);
  expect.soft(offre.casesDesCibles[idCache]).toBeUndefined();
  expect.soft(offre.projection.combat?.apercu).toBeNull();
  expect(JSON.stringify(offre)).not.toContain(idCache);

  const offreAvecCibleVisible = vueDeLaSauvegarde(pendantCibleVisible);
  expect(offreAvecCibleVisible.projection.combat?.apercu?.cible).toBe(idVisible);
  expect(offreAvecCibleVisible.casesDesCibles[idVisible]).toEqual([positionVisible.x, positionVisible.y, positionVisible.z ?? 0]);

  const ciblageAveugle = vueDeLaSauvegarde(horsFenetre);
  expect(ciblageAveugle.projection.combat?.voisins.liste.map((c) => c.id)).not.toContain(idCache);
  expect(ciblageAveugle.occupants[cleDeLaCase(caseCachee)]).toBe(idCache);
  expect(ciblageAveugle.projection.combat?.apercu?.cible).toBe(idCache);
  expect(ciblageAveugle.casesDesCibles[idCache]).toEqual([caseCachee.x, caseCachee.y, caseCachee.z ?? 0]);
  expect(clicDuCombattant(ciblageAveugle, idCache)?.args[1]).toBe(idCache);
});
