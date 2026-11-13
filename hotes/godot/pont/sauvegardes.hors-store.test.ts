/**
 * SAUVEGARDER ET REPRENDRE PAR LE PONT (#3009) : les emplacements du stockage de l'hôte en zones (`sauvegardes`), la
 * partie ouverte écrite à un emplacement manuel (`sauvegarder`), rouverte de cet emplacement sous le même pont ou sous
 * un autre sur le même stockage (`charger`), et le point de reprise gardé à l'emplacement automatique en quittant.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { drainer, erreurDe, suiteDe, table } from './pont.testkit';
import { t } from '../../../src/i18n';
import { AUTO_SLOT, cleDEmplacement, nomDEmplacement, type AnySlot } from '../../../src/hote/sauvegardes';
import type { Bouton, Entite, Ligne } from '../../../src/hote/elements';
import type { ZonesDesSauvegardes } from '../../../src/hote/sauvegardes';
import type { Pont, Suite } from './pont';

let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; });

type Appel = ReturnType<typeof table>['appel'];
const zones = (appel: Appel, methode = 'sauvegardes', entree?: unknown): ZonesDesSauvegardes => (appel(methode, entree) as unknown as { zones: ZonesDesSauvegardes }).zones;
const emplacement = (z: ZonesDesSauvegardes, slot: AnySlot): Entite => z['sauvegardes.emplacements'].find((e) => e.id === `emplacement/${slot}`)!;
const boutons = (e: Entite): Bouton[] => e.elements.filter((x): x is Bouton => x.type === 'bouton');
const fiche = (e: Entite): string => (e.elements.find((x) => x.id === 'fiche') as Ligne).texte;

/** Une partie de la campagne `campagne` lancée par un pré-tiré, ses fenêtres d'entrée laissées en main. */
function lancee(appel: Appel, campagne: string): Suite {
  const s = suiteDe(appel('ouvrir', { graine: 7 }));
  const recruter = s.vue.zones['groupe.pretires'][0].elements.find((x): x is Bouton => x.type === 'bouton')!;
  appel('jouer', recruter.jeu);
  return drainer(appel, appel('lancer', { lancer: campagne })).suite;
}
const groupe = (s: Suite) => s.vue.zones['groupe.heros'].map((e) => ({ id: e.id, nom: e.nom, bourse: e.elements.find((x) => x.id === 'bourse') }));

describe('sauvegarder et reprendre par le pont', () => {
  it('sans partie : chaque emplacement vide, l’automatique d’abord, rien à charger ni à écrire', () => {
    const { appel } = table();
    const z = zones(appel);
    expect(z['sauvegardes.emplacements'].map((e) => [e.id, e.nom, fiche(e), boutons(e)])).toEqual(
      ([AUTO_SLOT, 1, 2, 3] as const).map((slot) => [`emplacement/${slot}`, nomDEmplacement(slot), t('saveload.slot.empty'), []]));
    expect(z['sauvegardes.avis']).toEqual([]);
    expect(z['sauvegardes.gestes'].map((b) => b.jeu), 'le panneau se ferme').toEqual([{ sauvegardes: false }]);
    expect(erreurDe(appel('sauvegarder', { sauvegarder: 1 })).categorie, 'aucune partie à écrire').toBe('validation');
    expect(erreurDe(appel('charger', { charger: 1 })), 'un emplacement vide ne se charge pas').toEqual({ categorie: 'validation', message: `charger : ${nomDEmplacement(1)}, ${t('saveload.error.load')}` });
    expect(erreurDe(appel('charger', { charger: 4 })).categorie, 'un emplacement inconnu').toBe('validation');
  });

  it('la partie écrite à un emplacement manuel se rouvre telle quelle, sous le même pont puis sous un autre sur le même stockage', () => {
    const { pont, appel, stockage } = table();
    ouvert = pont;
    const avant = lancee(appel, 'la-diligence');
    const offerts = zones(appel);
    expect(boutons(emplacement(offerts, AUTO_SLOT)), 'l’emplacement automatique ne s’écrit pas à la main').toEqual([]);
    const ecrire = boutons(emplacement(offerts, 2))[0];
    expect([ecrire.jeu, ecrire.refus]).toEqual([{ sauvegarder: 2 }, null]);
    expect(avant.vue.zones['partie.gestes'].map((b) => b.jeu), 'le panneau s’ouvre de la partie').toEqual([{ sauvegardes: true }, { reglages: true }, { quitter: true }]);

    const ecrit = emplacement(zones(appel, 'sauvegarder', ecrire.jeu), 2);
    expect(fiche(ecrit), 'l’emplacement dit la scène sauvegardée').toContain(avant.vue.projection.scene!.nom);
    expect(boutons(ecrit).map((b) => b.jeu), 'il se charge et se réécrit').toEqual([{ charger: 2 }, { sauvegarder: 2 }]);
    expect(erreurDe(appel('sauvegarder', { sauvegarder: AUTO_SLOT })).categorie, 'l’automatique refusé à la méthode aussi').toBe('validation');
    expect(erreurDe(appel('charger', { charger: 2 })).message, 'une partie à la fois').toMatch(/quitter d’abord/);

    appel('quitter');
    const reprise = suiteDe(appel('charger', { charger: 2, graine: 7 }));
    expect(reprise.programmes, 'une suite sans jeton').toEqual([]);
    expect([reprise.vue.projection.scene?.id, reprise.vue.projection.fenetre?.cle], 'la scène et la fenêtre en main').toEqual([avant.vue.projection.scene?.id, avant.vue.projection.fenetre?.cle]);
    expect(groupe(reprise), 'le groupe, sa bourse intacte').toEqual(groupe(avant));
    expect((appel('monde') as { monde?: unknown }).monde, 'son monde se sert').toBeTruthy();
    expect(reprise.vue.zones['groupe.campagnes'], 'la partie reprise est en cours').toEqual([]);

    appel('quitter');
    const autre = table(stockage);
    ouvert = autre.pont;
    expect(groupe(suiteDe(autre.appel('charger', { charger: 2 }))), 'un pont neuf sur le même stockage la retrouve').toEqual(groupe(avant));
  });

  it('quitter une campagne lancée garde son point de reprise à l’emplacement automatique ; un scénario de test, jamais', () => {
    const { pont, appel, stockage } = table();
    ouvert = pont;
    drainer(appel, appel('demarrer', { scenario: 'voyage', graine: 7 }));
    appel('quitter');
    expect(stockage.getItem(cleDEmplacement(AUTO_SLOT)), 'un scénario de test quitté n’écrit rien').toBeNull();

    const avant = lancee(appel, 'la-diligence');
    appel('quitter');
    const auto = emplacement(zones(appel), AUTO_SLOT);
    expect(boutons(auto).map((b) => b.jeu), 'la campagne quittée se reprend').toEqual([{ charger: AUTO_SLOT }]);
    expect(groupe(suiteDe(appel('charger', boutons(auto)[0].jeu))), 'où elle a été quittée').toEqual(groupe(avant));
  });

  it('en combat, la partie ne s’écrit pas : le noyau dit le refus, au bouton comme à la méthode', () => {
    const { pont, appel, stockage } = table();
    ouvert = pont;
    drainer(appel, appel('demarrer', { scenario: 'dome', graine: 7 }));
    const refus = t('store.saveInBattle');
    expect(boutons(emplacement(zones(appel), 1)).map((b) => b.refus)).toEqual([refus]);
    expect(erreurDe(appel('sauvegarder', { sauvegarder: 1 }))).toEqual({ categorie: 'regle', message: `sauvegarder : ${refus}` });
    expect(stockage.getItem(cleDEmplacement(1))).toBeNull();
  });

  it('un stockage qui refuse l’écriture : la sauvegarde est refusée, et dite', () => {
    const { pont, appel } = table({ getItem: () => null, setItem: () => { throw new Error('plein'); }, removeItem: () => {} });
    ouvert = pont;
    drainer(appel, appel('demarrer', { scenario: 'voyage', graine: 7 }));
    expect(erreurDe(appel('sauvegarder', { sauvegarder: 1 }))).toEqual({ categorie: 'regle', message: `sauvegarder : ${t('store.saveKo')}` });
  });

  it('une sauvegarde d’un autre format est retirée du stockage à la lecture, et dite une fois', () => {
    const { appel, stockage } = table();
    stockage.setItem(cleDEmplacement(3), JSON.stringify({ version: 'un-autre-format', savedAt: 'x', data: {} }));
    const z = zones(appel);
    expect(z['sauvegardes.avis'].map((l) => l.texte)).toEqual([t('saveload.error.autreFormat', { emplacement: nomDEmplacement(3) })]);
    expect([fiche(emplacement(z, 3)), boutons(emplacement(z, 3))]).toEqual([t('saveload.slot.empty'), []]);
    expect(stockage.getItem(cleDEmplacement(3))).toBeNull();
    expect(zones(appel)['sauvegardes.avis'], 'le retrait ne se redit pas').toEqual([]);
  });
});
