/**
 * LES RÉGLAGES ET L'ACCUEIL PAR LE PONT (#3009) : les préférences de confort et les règles maison en zones
 * (`reglages`), réglées par le `jeu` de leurs contrôles et persistées au stockage de l'hôte, la partie du jeu ouverte
 * aux réglages du joueur (`ouvrir`), et les entrées de l'accueil (`accueil`).
 */
import { afterEach, describe, it, expect } from 'vitest';
import { drainer, erreurDe, table } from './pont.testkit';
import { t } from '../../../src/i18n';
import { OPTIONAL_RULES, PREFERENCES, poserLesReglesMaisonPersistees, ruleOverrides } from '../../../src/noyau/index';
import type { Bouton, Choix, Element, Entite, Formulaire, Ligne } from '../../../src/hote/elements';
import type { ZonesDeLAccueil } from '../../../src/hote/accueil';
import type { ZonesDesReglages } from '../../../src/hote/reglages';
import type { Pont } from './pont';

let ouvert: Pont | null = null;
afterEach(() => {
  ouvert?.appeler('quitter');
  ouvert = null;
  poserLesReglesMaisonPersistees({});
  for (const p of PREFERENCES) p.set(p.default);
});

type Appel = ReturnType<typeof table>['appel'];
const zones = (appel: Appel, entree?: unknown): ZonesDesReglages => (appel('reglages', entree) as unknown as { zones: ZonesDesReglages }).zones;
const accueil = (appel: Appel): Bouton[] => (appel('accueil') as unknown as { zones: ZonesDeLAccueil }).zones['accueil.gestes'];
const preference = (z: ZonesDesReglages, id: string): Element => z['reglages.preferences'].find((e) => e.id === `preference/${id}`)!;
const regles = (z: ZonesDesReglages): Element[] => z['reglages.regles'].flatMap((g) => g.elements);
const regle = (z: ZonesDesReglages, id: string): Element => regles(z).find((e) => e.id === `regle/${id}`)!;
const pressee = (c: Element): unknown => ((c as Choix).valeurs.find((v) => v.presse)!.jeu as { args: unknown[] }).args[1];
const saisie = (f: Element): { valeur: number; min: number; max: number; pas: number } => (f as Formulaire).champs[1] as never;
const PLAFOND = OPTIONAL_RULES.find((r) => r.id === 'combat-plafond-avantage')!;

describe('les réglages par le pont', () => {
  it('sans partie : chaque préférence et chaque règle optionnelle porte le contrôle de sa forme', () => {
    const { appel } = table();
    const z = zones(appel);
    const formes = { flag: 'choix', mode: 'liste', param: 'formulaire' };
    expect(PREFERENCES.map((p) => [p.id, preference(z, p.id).type])).toEqual(PREFERENCES.map((p) => [p.id, formes[p.kind]]));
    expect(OPTIONAL_RULES.map((r) => [r.id, regle(z, r.id).type])).toEqual(OPTIONAL_RULES.map((r) => [r.id, formes[r.kind]]));
    expect(z['reglages.regles'].map((g) => g.nom), 'un sous-système par entité, dans l’ordre du registre').toEqual([...new Set(OPTIONAL_RULES.map((r) => r.group))]);
    expect(saisie(regle(z, PLAFOND.id))).toMatchObject({ valeur: PLAFOND.default, min: PLAFOND.min, max: PLAFOND.max, pas: 1 });
    expect(saisie(preference(z, 'volume-musique'))).toMatchObject({ min: 0, max: 1, pas: 0.05 });
    expect((regles(z).find((e) => e.id === `regle/${PLAFOND.id}/ref`) as Ligne).texte).toBe(PLAFOND.ref);
    expect(regles(z).filter((e) => e.id.startsWith('retablir/')), 'aucune règle surchargée').toEqual([]);
    expect(z['reglages.gestes'].map((b) => b.jeu), 'le panneau se ferme').toEqual([{ reglages: false }]);
  });

  it('une préférence se règle par le `jeu` de sa valeur, vit au stockage et revient sous un autre pont', () => {
    const { appel, stockage } = table();
    const oui = (preference(zones(appel), 'des-fixes') as Choix).valeurs.find((v) => v.libelle === t('valeur.oui'))!;
    expect(pressee(preference(zones(appel, oui.jeu), 'des-fixes'))).toBe(true);
    const volume = preference(zones(appel), 'volume-musique') as Formulaire;
    const z = zones(appel, { type: volume.verbe, args: [volume.champs[0].type === 'fixe' && volume.champs[0].valeur, 0.35] });
    expect(saisie(preference(z, 'volume-musique')).valeur).toBe(0.35);
    expect(pressee(preference(zones(appel, { type: 'preference', args: ['son-coupe', true] }), 'son-coupe'))).toBe(true);
    expect(appel('preferences')).toMatchObject({ preferences: { 'volume-musique': 0.35, 'des-fixes': true, 'son-coupe': true } });
    for (const p of PREFERENCES) p.set(p.default);
    expect(table(stockage).appel('preferences'), 'posées à la création du pont').toMatchObject({ preferences: { 'volume-musique': 0.35, 'des-fixes': true, 'son-coupe': true } });
  });

  it('une valeur hors de la forme de son entrée, un id inconnu, un autre geste : refusés, rien n’est écrit', () => {
    const { appel, stockage } = table();
    for (const entree of [
      { type: 'preference', args: ['volume-musique', 2] }, { type: 'preference', args: ['combat-cadence', 'eclair'] }, { type: 'preference', args: ['inconnue', true] },
      { type: 'regle', args: [PLAFOND.id, 99] }, { type: 'regle', args: ['inconnue', true] }, { type: 'retablir', args: ['inconnue'] }, { type: 'vider', args: [PLAFOND.id] },
    ]) expect(erreurDe(appel('reglages', entree)).categorie, JSON.stringify(entree)).toBe('validation');
    expect([stockage.getItem('wfrp4.prefs'), stockage.getItem('wfrp4.house-rules')]).toEqual([null, null]);
  });

  it('une règle maison se surcharge, se dit surchargée, puis revient à son défaut ; le stockage la suit', () => {
    const { appel, stockage } = table();
    const z = zones(appel, { type: 'regle', args: [PLAFOND.id, 12] });
    expect(saisie(regle(z, PLAFOND.id)).valeur).toBe(12);
    const defaut = regles(z).find((e): e is Bouton => e.id === `retablir/${PLAFOND.id}`)!;
    expect(defaut.libelle).toBe(t('ecran.reglages.defaut'));
    expect(JSON.parse(stockage.getItem('wfrp4.house-rules')!)).toEqual({ [PLAFOND.id]: 12 });
    const remise = zones(appel, defaut.jeu);
    expect(saisie(regle(remise, PLAFOND.id)).valeur).toBe(PLAFOND.default);
    expect(regles(remise).filter((e) => e.id.startsWith('retablir/'))).toEqual([]);
    expect(JSON.parse(stockage.getItem('wfrp4.house-rules')!)).toEqual({});
  });

  it('la partie du jeu s’ouvre aux règles maison et aux préférences du joueur, même après un scénario de test', () => {
    const { pont, appel } = table();
    ouvert = pont;
    zones(appel, { type: 'regle', args: [PLAFOND.id, 12] });
    zones(appel, { type: 'preference', args: ['combat-cadence', 'auto'] });
    drainer(appel, appel('demarrer', { scenario: 'dome', graine: 7 }));
    expect(ruleOverrides(), 'le scénario de test joue aux règles du livre').toEqual({});
    appel('quitter');
    appel('ouvrir', { graine: 7 });
    expect(ruleOverrides()).toEqual({ [PLAFOND.id]: 12 });
    expect(appel('preferences')).toMatchObject({ preferences: { 'combat-cadence': 'auto' } });
  });

  it('en combat, les règles maison sont verrouillées, au contrôle comme à la méthode ; une préférence se règle encore', () => {
    const { pont, appel } = table();
    ouvert = pont;
    drainer(appel, appel('demarrer', { scenario: 'dome', graine: 7 }));
    const verrou = t('houseRules.lockedInBattle');
    expect((regle(zones(appel), PLAFOND.id) as Formulaire).refus).toBe(verrou);
    expect(erreurDe(appel('reglages', { type: 'regle', args: [PLAFOND.id, 12] }))).toEqual({ categorie: 'regle', message: `reglages : ${verrou}` });
    expect(pressee(preference(zones(appel, { type: 'preference', args: ['des-fixes', true] }), 'des-fixes'))).toBe(true);
  });
});

describe('l’accueil par le pont', () => {
  it('ses entrées, « Reprendre » refusé tant qu’aucun emplacement ne porte de sauvegarde, puis « Options »', () => {
    const { pont, appel } = table();
    expect(accueil(appel).map((b) => [b.id, b.jeu, b.refus])).toEqual([
      ['jouer', { accueil: 'jouer' }, null], ['reprendre', { accueil: 'reprendre' }, t('ecran.accueil.reprendre.aucune')], ['combat', { accueil: 'combat' }, null],
      ['atelier', { accueil: 'atelier' }, null], ['editeur', { accueil: 'editeur' }, null], ['reglages', { reglages: true }, null],
    ]);
    ouvert = pont;
    const s = appel('ouvrir', { graine: 7 }) as unknown as { vue: { zones: { 'groupe.pretires': Entite[]; 'partie.gestes': Bouton[] } } };
    expect(s.vue.zones['partie.gestes'].map((b) => b.id)).toEqual(['sauvegardes', 'reglages', 'quitter']);
    appel('sauvegarder', { sauvegarder: 1 });
    appel('quitter');
    expect(accueil(appel).find((b) => b.id === 'reprendre')!.refus, 'une sauvegarde à reprendre').toBeNull();
  });
});
