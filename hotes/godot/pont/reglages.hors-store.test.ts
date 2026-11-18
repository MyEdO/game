/**
 * LES RÉGLAGES ET L'ACCUEIL PAR LE PONT (#3009) : les préférences de confort et les règles maison en zones
 * (`reglages`), réglées par le `jeu` de leurs contrôles et persistées au stockage de l'hôte, la partie du jeu ouverte
 * aux réglages du joueur (`ouvrir`), et les entrées de l'accueil (`accueil`).
 */
import { afterEach, describe, it, expect } from 'vitest';
import { drainer, erreurDe, table } from './pont.testkit';
import { t } from '../../../src/i18n';
import { OPTIONAL_RULES, PREFERENCES, poserLesReglesMaisonPersistees, ruleOverrides, type OptionalRule } from '../../../src/noyau/index';
import { REGLES_PAR_PAGE } from '../../../src/hote/reglages';
import type { Bouton, Choix, Curseur, Element, Entite, Ligne } from '../../../src/hote/elements';
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
/** Chaque élément sous les domaines, à toute profondeur (domaine, feuillet, règle). */
const aplatir = (es: readonly Element[]): Element[] => es.flatMap((e) => (e.type === 'entite' ? [e, ...aplatir(e.elements)] : [e]));
const regles = (z: ZonesDesReglages): Element[] => aplatir(z['reglages.regles']);
const feuillets = (z: ZonesDesReglages, groupe: string): Entite[] => z['reglages.regles'].find((g) => g.nom === groupe)!.elements.filter((e): e is Entite => e.type === 'entite');
const texte = (es: readonly Element[], id: string): string | undefined => (es.find((e) => e.id === id) as Ligne | undefined)?.texte;
const entiteDe = (z: ZonesDesReglages, id: string): Entite => regles(z).find((e): e is Entite => e.type === 'entite' && /^(gauche|droite)\//.test(e.id) && e.elements.some((c) => c.id === `regle/${id}`))!;
const regle = (z: ZonesDesReglages, id: string): Element => regles(z).find((e) => e.id === `regle/${id}`)!;
const pressee = (c: Element): unknown => ((c as Choix).valeurs.find((v) => v.presse)!.jeu as { args: unknown[] }).args[1];
const curseur = (e: Element): Curseur => e as Curseur;
const PLAFOND = OPTIONAL_RULES.find((r): r is Extract<OptionalRule, { kind: 'param' }> => r.id === 'combat-plafond-avantage' && r.kind === 'param')!;

describe('les réglages par le pont', () => {
  it('sans partie : chaque préférence et chaque règle optionnelle porte le contrôle de sa forme', () => {
    const { appel } = table();
    const z = zones(appel);
    const forme = (f: { kind: string; options?: readonly string[] }): string => (f.kind === 'flag' ? 'choix' : f.kind === 'param' ? 'curseur' : f.options!.length > 3 ? 'liste' : 'choix');
    expect(PREFERENCES.map((p) => [p.id, preference(z, p.id).type])).toEqual(PREFERENCES.map((p) => [p.id, forme(p)]));
    expect(OPTIONAL_RULES.map((r) => [r.id, regle(z, r.id).type])).toEqual(OPTIONAL_RULES.map((r) => [r.id, forme(r)]));
    expect(z['reglages.regles'].map((g) => g.nom), 'un domaine par entité, dans l’ordre du registre').toEqual([...new Set(OPTIONAL_RULES.map((r) => r.group))]);
    expect(curseur(regle(z, PLAFOND.id))).toMatchObject({ libelle: PLAFOND.label, valeur: PLAFOND.default, min: PLAFOND.min, max: PLAFOND.max, pas: 1, verbe: 'regle', arguments: [PLAFOND.id], refus: null });
    expect(curseur(preference(z, 'volume-musique')), 'un volume en pour cent').toMatchObject({ min: 0, max: 100, pas: 5, verbe: 'pourcent', arguments: ['volume-musique'] });
    expect(entiteDe(z, PLAFOND.id)).toMatchObject({ nom: PLAFOND.label, ton: 'neutre' });
    expect(texte(entiteDe(z, PLAFOND.id).elements, 'ref')).toBe(PLAFOND.ref);
    expect(regles(z).filter((e) => e.id.startsWith('retablir/')), 'aucune règle surchargée').toEqual([]);
    expect(z['reglages.gestes'].map((b) => b.jeu), 'le panneau se ferme').toEqual([{ reglages: false }]);
  });

  it('une préférence se règle par le `jeu` de sa valeur, vit au stockage et revient sous un autre pont', () => {
    const { appel, stockage } = table();
    const oui = (preference(zones(appel), 'des-fixes') as Choix).valeurs.find((v) => v.libelle === t('valeur.oui'))!;
    expect(pressee(preference(zones(appel, oui.jeu), 'des-fixes'))).toBe(true);
    const volume = curseur(preference(zones(appel), 'volume-musique'));
    const z = zones(appel, { type: volume.verbe, args: [...volume.arguments, 35] });
    expect(curseur(preference(z, 'volume-musique')).valeur).toBe(35);
    expect(pressee(preference(zones(appel, { type: 'preference', args: ['son-coupe', true] }), 'son-coupe'))).toBe(true);
    expect(appel('preferences')).toMatchObject({ preferences: { 'volume-musique': 0.35, 'des-fixes': true, 'son-coupe': true } });
    for (const p of PREFERENCES) p.set(p.default);
    expect(table(stockage).appel('preferences'), 'posées à la création du pont').toMatchObject({ preferences: { 'volume-musique': 0.35, 'des-fixes': true, 'son-coupe': true } });
  });

  it('une valeur hors de la forme de son entrée, un id inconnu, un autre geste : refusés, rien n’est écrit', () => {
    const { appel, stockage } = table();
    for (const entree of [
      { type: 'preference', args: ['volume-musique', 2] }, { type: 'preference', args: ['combat-cadence', 'eclair'] }, { type: 'preference', args: ['inconnue', true] },
      { type: 'pourcent', args: ['volume-musique', 200] }, { type: 'pourcent', args: ['des-fixes', 50] }, { type: 'pourcent', args: ['volume-musique', 'fort'] },
      { type: 'regle', args: [PLAFOND.id, 99] }, { type: 'regle', args: ['inconnue', true] }, { type: 'retablir', args: ['inconnue'] }, { type: 'vider', args: [PLAFOND.id] },
    ]) expect(erreurDe(appel('reglages', entree)).categorie, JSON.stringify(entree)).toBe('validation');
    expect([stockage.getItem('wfrp4.prefs'), stockage.getItem('wfrp4.house-rules')]).toEqual([null, null]);
  });

  it('une règle maison se surcharge, se dit surchargée, puis revient à son défaut ; le stockage la suit', () => {
    const { appel, stockage } = table();
    const z = zones(appel, { type: 'regle', args: [PLAFOND.id, 12] });
    expect(curseur(regle(z, PLAFOND.id)).valeur).toBe(12);
    const defaut = regles(z).find((e): e is Bouton => e.id === `retablir/${PLAFOND.id}`)!;
    expect(defaut.libelle).toBe(t('ecran.reglages.defaut'));
    expect(entiteDe(z, PLAFOND.id).ton, 'la règle surchargée au ton d’alerte').toBe('alerte');
    const domaine = z['reglages.regles'].find((g) => g.nom === PLAFOND.group)!;
    expect(domaine.elements.some((e) => e.id === 'cire'), 'la cire de son domaine').toBe(true);
    expect(texte(feuillets(z, PLAFOND.group)[0]!.elements, 'modifiees')).toBe(t('ecran.reglages.modifiees', { n: 1, s: '' }));
    expect(JSON.parse(stockage.getItem('wfrp4.house-rules')!)).toEqual({ [PLAFOND.id]: 12 });
    const remise = zones(appel, defaut.jeu);
    expect(curseur(regle(remise, PLAFOND.id)).valeur).toBe(PLAFOND.default);
    expect(regles(remise).filter((e) => e.id.startsWith('retablir/') || e.id === 'cire' || e.id === 'modifiees')).toEqual([]);
    expect(JSON.parse(stockage.getItem('wfrp4.house-rules')!)).toEqual({});
  });

  it('chaque domaine se range en feuillets de deux pages, chaque règle une fois, dans l’ordre du registre', () => {
    const z = zones(table().appel);
    for (const g of z['reglages.regles']) {
      const attendues = OPTIONAL_RULES.filter((r) => r.group === g.nom);
      const fs = feuillets(z, g.nom);
      expect(texte(g.elements, 'nombre'), g.nom).toBe(String(attendues.length));
      expect(fs.map((f) => f.id), g.nom).toEqual(fs.map((_, i) => `feuillet/${g.nom}/${i + 1}`));
      expect(fs.length, g.nom).toBe(Math.ceil(attendues.length / (2 * REGLES_PAR_PAGE)));
      const posees = fs.flatMap((f, i) => {
        const pages = f.elements.filter((e): e is Entite => e.type === 'entite');
        const gauche = pages.filter((e) => e.id.startsWith('gauche/'));
        const droite = pages.filter((e) => e.id.startsWith('droite/'));
        expect(gauche.length, `${g.nom} ${i + 1}`).toBeLessThanOrEqual(REGLES_PAR_PAGE);
        expect(droite.length, `${g.nom} ${i + 1}`).toBeLessThanOrEqual(REGLES_PAR_PAGE);
        expect(texte(f.elements, 'folio')).toBe(t('ecran.reglages.feuillet', { n: i + 1, total: fs.length }));
        const premiere = i * 2 * REGLES_PAR_PAGE + REGLES_PAR_PAGE + 1;
        expect(texte(f.elements, 'plage')).toBe(droite.length ? t('ecran.reglages.plage', { de: premiere, a: premiere + droite.length - 1, n: attendues.length }) : undefined);
        return [...gauche, ...droite].map((e) => e.elements.find((c) => c.id.startsWith('regle/'))!.id);
      });
      expect(posees, g.nom).toEqual(attendues.map((r) => `regle/${r.id}`));
    }
  });

  it('l’action d’une règle se montre à la valeur qui l’offre, refusée sans partie ouverte', () => {
    const r = OPTIONAL_RULES.find((x) => x.action !== undefined)!;
    const { appel } = table();
    const action = (z: ZonesDesReglages) => regles(z).find((e): e is Bouton => e.id === `action/${r.id}`);
    expect(action(zones(appel, { type: 'regle', args: [r.id, r.action!.when] }))).toMatchObject({ libelle: r.action!.label, jeu: { suite: [{ type: r.action!.run, args: [] }] }, refus: t('ecran.reglages.horsPartie') });
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
    expect(curseur(regle(zones(appel), PLAFOND.id)).refus).toBe(verrou);
    expect(erreurDe(appel('reglages', { type: 'regle', args: [PLAFOND.id, 12] }))).toEqual({ categorie: 'regle', message: `reglages : ${verrou}` });
    expect(pressee(preference(zones(appel, { type: 'preference', args: ['des-fixes', true] }), 'des-fixes'))).toBe(true);
  });
});

describe('l’accueil par le pont', () => {
  it('ses entrées, « Reprendre » refusé tant qu’aucun emplacement ne porte de sauvegarde, puis « Options »', () => {
    const { pont, appel } = table();
    expect(accueil(appel).map((b) => [b.id, b.jeu, b.refus])).toEqual([
      ['jouer', { accueil: 'jouer' }, null], ['reprendre', { accueil: 'reprendre' }, t('ecran.accueil.reprendre.aucune')],
      ['salon', { accueil: 'salon' }, null], ['combat', { accueil: 'combat' }, null],
      ['atelier', { accueil: 'atelier' }, null], ['editeur', { accueil: 'editeur' }, null], ['compendium', { accueil: 'compendium' }, null], ['reglages', { reglages: true }, null],
    ]);
    ouvert = pont;
    const s = appel('ouvrir', { graine: 7 }) as unknown as { vue: { zones: { 'groupe.pretires': Entite[]; 'partie.gestes': Bouton[] } } };
    expect(s.vue.zones['partie.gestes'].map((b) => b.id)).toEqual(['sauvegardes', 'reglages', 'salon', 'quitter']);
    appel('sauvegarder', { sauvegarder: 1 });
    appel('quitter');
    expect(accueil(appel).find((b) => b.id === 'reprendre')!.refus, 'une sauvegarde à reprendre').toBeNull();
  });
});
