/**
 * Jalon 5 — la LIAISON web de la sauvegarde : les actions du store (`saveGame`, `loadGame`, `importGame`) et `autoSave`
 * sur les emplacements du `localStorage` (`stockageDesSauvegardes`), le refus dit au journal, l'interface remise au
 * chargement et les retraits du chargement exposés à l'écran, observés au stockage des sauvegardes du joueur (`saves.testkit.ts`).
 * La forme persistée : `src/noyau/forme-persistee.hors-store.test.ts` ; les emplacements, leur liste et le témoin
 * des retraits : `src/hote/sauvegardes.hors-store.test.ts` (#2404).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { autoSave, useGame } from './store';
import { initialNet } from '../noyau/etat';
import { t } from '../i18n';
import { saveDuStockage } from './saves.testkit';
import { cleDEmplacement } from '../hote/sauvegardes';
import { lireSave, exporterLaSauvegarde } from '../noyau/persistance/save';
import { FORMAT_SAVE } from '../noyau/persistance/formats.generated';
import { rule, setRule, loadRuleOverrides, OPTIONAL_RULES } from '../engine/policy';
import { conditionIds } from '../data/index';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { poserLeLocalStorage } from '../lib/stockage.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';

describe('Sauvegarde / chargement (Jalon 5)', () => {
  beforeEach(() => {
    poserLeLocalStorage();
    vi.useFakeTimers();
    vi.clearAllTimers();
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sauvé', seed: 4 });
    useGame.setState({ party: [hero], battle: null, net: initialNet() });
    useGame.getState().lancerLaScene(testScene());
    vi.clearAllTimers();
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); loadRuleOverrides({}); });

  it('saveGame → slot rempli avec métadonnées (scène, horloge)', () => {
    useGame.setState({ flags: { ...useGame.getState().flags, 'drapeau-test': true } });
    expect(useGame.getState().saveGame(1)).toBe(true);
    const s = saveDuStockage(1)!;
    expect(s.version).toBe(FORMAT_SAVE);
    expect(s.sceneLabel).toBe(testScene().label); // le NOM de la scène, pas son id
    expect(s.sceneLabel.length).toBeGreaterThan(0);
    expect((s.data.flags as Record<string, unknown>)['drapeau-test']).toBe(true);
  });

  it('round-trip : muter → sauver → réinitialiser → charger restaure données + actions vivantes', () => {
    useGame.setState({ flags: { ...useGame.getState().flags, 'quete-x': true }, gameTime: 12345, journal: ['ligne de test'] });
    useGame.getState().party[0].wounds.current = 3;
    expect(useGame.getState().saveGame(2)).toBe(true);
    // « Nouvelle partie » : tout est réinitialisé.
    useGame.setState({ party: [], flags: {}, gameTime: 0, journal: [], scene: null, screen: 'menu' });
    expect(useGame.getState().loadGame(2)).toBe(true);
    const after = useGame.getState();
    expect(after.flags['quete-x']).toBe(true);
    expect(after.gameTime).toBe(12345);
    expect(after.party[0]?.label).toBe('Sauvé');
    expect(after.party[0]?.wounds.current).toBe(3);
    expect(after.scene?.id).toBe(testScene().id);
    expect(after.screen).toBe('campaign');
    after.ecrireAuJournal('le store répond'); // les actions n'ont pas été écrasées par le merge
    const j = useGame.getState().journal;
    expect(j[j.length - 1]).toBe('le store répond');
  });

  it('règles maison : la save porte les surcharges et les restaure au chargement (portabilité)', () => {
    const id = 'test-critiques-doubles'; // un flag optionnel quelconque
    loadRuleOverrides({}); // baseline propre
    const def = rule(id) as boolean; // défaut RAW du registre
    setRule(id, !def); // l'utilisateur active la règle maison
    expect(useGame.getState().saveGame(1)).toBe(true);
    expect(saveDuStockage(1)!.rules?.[id]).toBe(!def); // la surcharge voyage DANS la save
    loadRuleOverrides({}); // « autre machine » : aucune règle maison locale → défaut
    expect(rule(id)).toBe(def);
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(rule(id)).toBe(!def); // … restaurée par le chargement
  });

  it('le chargement garde les préférences de vue et de touches, et remet le reste de l’interface', () => {
    expect(useGame.getState().saveGame(1)).toBe(true);
    useGame.setState({ camRot: 3, zoom: 2, keyOverrides: { 'menu-ouvrir': 'KeyP' }, sheetId: 'h', gameMenuOpen: true });
    expect(useGame.getState().loadGame(1)).toBe(true);
    const s = useGame.getState();
    expect([s.camRot, s.zoom, s.keyOverrides]).toEqual([3, 2, { 'menu-ouvrir': 'KeyP' }]);
    expect([s.sheetId, s.gameMenuOpen]).toEqual([null, false]);
  });

  it('chez l’invité : sauvegarde refusée, message au journal, aucun emplacement écrit', () => {
    useGame.setState({ net: { ...useGame.getState().net, mode: 'invite', mySeat: 2 } });
    expect(useGame.getState().saveGame(1)).toBe(false);
    expect(autoSave()).toBe(false);
    expect(useGame.getState().journal.slice(-1)[0]).toBe(t('store.saveInvite'));
    expect(saveDuStockage(1)).toBeNull();
    expect(saveDuStockage('auto')).toBeNull();
  });

  it('en combat : sauvegarde refusée, le slot reste vide', () => {
    useGame.getState().lancerLeCombat('enc-mutants');
    useGame.getState().fenetreValider('debutDuRound');
    vi.clearAllTimers();
    expect(useGame.getState().saveGame(1)).toBe(false);
    expect(saveDuStockage(1)).toBeNull();
  });

  it('export / import : round-trip JSON validé', () => {
    expect(useGame.getState().saveGame(3)).toBe(true);
    const json = exporterLaSauvegarde(saveDuStockage(3)!);
    const re = lireSave(json);
    expect(typeof re === 'object' && re.sceneLabel).toBe(saveDuStockage(3)!.sceneLabel);
    // importGame applique la save importée à l'état.
    useGame.setState({ flags: {}, scene: null, screen: 'menu' });
    expect(useGame.getState().importGame(json)).toBeNull();
    expect(useGame.getState().scene?.id).toBe(testScene().id);
  });
});

// #2404 · `.claude/memory/user-arbitrage-saves-reset-pas-migration.md`
describe('FORMAT — une save d’un autre format est jetée, jamais migrée', () => {
  const save = (version: string | number, sceneLabel = 'Ancienne') => ({ version, savedAt: '2026-08-17', sceneLabel, gameTime: 3, data: { flags: { 'drapeau-x': true } } });
  const ls = () => (globalThis as { localStorage: Storage }).localStorage;

  beforeEach(() => {
    poserLeLocalStorage();
  });

  it('loadGame sur une save d’un autre format : refusé, l’état courant INTACT, l’emplacement vidé', () => {
    useGame.setState({ flags: { 'drapeau-vivant': true } });
    ls().setItem(cleDEmplacement(1), JSON.stringify(save('autre-format')));
    expect(useGame.getState().loadGame(1)).toBe(false);
    expect(useGame.getState().flags['drapeau-vivant']).toBe(true);
    expect(useGame.getState().flags['drapeau-x']).toBeUndefined();
    expect(ls().getItem(cleDEmplacement(1))).toBeNull();
    expect(t('saveload.error.autreFormat', { emplacement: 'Emplacement 1' })).toBe('Emplacement 1 : sauvegarde d’un autre format, retirée.');
  });

  it('save au format courant qui nomme une règle ou un État hors du registre : CHARGÉE élaguée de ces seuls ids, nommés ; l’emplacement reste (#1463 LD.1)', () => {
    const r = OPTIONAL_RULES.find((x) => x.kind === 'flag')!;
    const autre = OPTIONAL_RULES.find((x) => x.kind === 'flag' && x.id !== r.id)!;
    const connu = conditionIds()[0];
    const lue = {
      ...save(FORMAT_SAVE),
      rules: { [r.id]: !r.default, 'regle-hors-registre': true, [autre.id]: 'texte' },
      data: { party: [combattantDeTest({ id: 'h', label: 'H', kind: 'heros', conditions: [{ id: connu, value: 1 }, { id: 'etat-hors-registre', value: 1 }] })] },
    };
    ls().setItem(cleDEmplacement(1), JSON.stringify(lue));
    expect(useGame.getState().loadGame(1), 'la dérive du registre ne jette pas la save').toBe(true);
    expect(rule(r.id), 'la surcharge connue s’applique').toBe(!r.default);
    expect(rule(autre.id), 'la valeur non conforme est retirée').toBe(autre.default);
    expect(useGame.getState().party[0].conditions.map((c) => c.id), 'le héros reste, sans l’État inconnu').toEqual([connu]);
    expect(useGame.getState().retraitsDeChargement).toEqual({ regles: ['regle-hors-registre', autre.id], etats: ['etat-hors-registre'], groupes: [] });
    expect(ls().getItem(cleDEmplacement(1)), 'l’emplacement n’est pas vidé').not.toBeNull();
  });
});
