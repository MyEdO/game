/**
 * LE CONTRAT DU PONT (#2928, `CONTRAT.md`) : la réponse est toujours une chaîne JSON ; une méthode inconnue, une entrée
 * illisible ou hors contrat, un appel avant `demarrer`, un `demarrer` sur une partie ouverte et un jeton inconnu
 * se refusent en `validation` ; un geste refusé porte la catégorie que le module commun lui donne (`validation`,
 * `permission`, `regle`), une levée qu'aucun contrôle n'attendait la catégorie `interne` ; la vue porte le plateau de
 * la scène, chaque verbe de sa fenêtre en geste prêt à dessiner (`fautesDeLaFenetre`) et les clics du champ ; les
 * erreurs de la page s'y relèvent ; le choix d'un scénario (`scenarios`) se sert sans partie. Une partie par contexte JS : les tests de ce fichier jouent, dans l'ordre, sur un
 * même pont.
 */
import { idsDeTest } from '../../../src/engine/idsDeTest.testkit';
import { afterAll, describe, it, expect, vi } from 'vitest';
import { drainer, erreurDe, fautesDeLaFenetre, suiteDe, table } from './pont.testkit';
import type { VueDuPont } from './pont';
import { CLIC_DU_CHAMP, PREFERENCES, cleDuGeste, plateauDeLaScene, preferenceDef } from '../../../src/noyau/index';
import { t } from '../../../src/i18n';
import { SONS_DE_LA_PARTIE } from '../../../src/noyau/effetsDeLAppel';
import { VERBES } from '../../../src/hote/verbes.generated';
import { scenario } from '../../../src/scenes/test-scenarios/22-dome';
import { testScenarios } from '../../../src/scenes/test-scenarios';
import { SCENARIO_SECTIONS } from '../../../src/scenes/test-scenarios/_shared';
import type { Entite } from '../../../src/hote/elements';
import type { ZonesDesScenarios } from '../../../src/hote/scenarios';
import { baseDeTest, elementSchema3 } from '../asset/modeles.testkit.ts';
import * as projection from '../../../src/hote/projection';

/** La page témoin : son `addEventListener`, posé avant le pont, reçoit les erreurs que le test y émet ; rendu à la fin
 *  du fichier, le graphe étant partagé avec les fichiers suivants du worker. */
const page = new EventTarget();
vi.stubGlobal('addEventListener', page.addEventListener.bind(page));
afterAll(() => { vi.unstubAllGlobals(); });

const { pont, appel } = table();

/** La vue que rend `vue`. */
const vue = (): VueDuPont => (appel('vue') as { vue: VueDuPont }).vue;

describe('le pont avant sa partie', () => {
  it('une méthode inconnue se refuse en `validation` et nomme les méthodes du contrat', () => {
    const e = erreurDe(appel('simulerAttaque', {}));
    expect(e.categorie).toBe('validation');
    expect(e.message).toBe('méthode inconnue : simulerAttaque (méthodes : accueil, demarrer, ouvrir, lancer, quitter, sauvegardes, sauvegarder, charger, scenarios, vue, monde, morceaux, retrait, vision, aretes, jouer, plan, regarder, fiche, creation, roster, reprendre, modeles, composer, vehicule, catalogues, vitrine, preferences, reglages, salon, nouvelles, echantillons, echantillon, presetDeComposition, editer, erreursGlobales)');
  });

  it('`preferences` rend sans partie la valeur effective de chaque préférence de la table, par id', () => {
    const volume = preferenceDef('volume-ambiance')!;
    const avant = volume.get();
    volume.set(0.35);
    try {
      expect(appel('preferences')).toEqual({ ok: true, preferences: Object.fromEntries(PREFERENCES.map((p) => [p.id, p.get()])) });
      expect(appel('preferences')).toMatchObject({ preferences: { 'volume-ambiance': 0.35 } });
    } finally {
      volume.set(avant);
    }
  });

  it('`modeles` rend les modèles de l’atelier sans partie ; une entrée sans `manifestes` ou sans `osDesRigides` se refuse', () => {
    const manifestes = { humanoide: baseDeTest(), epee: elementSchema3() };
    expect(appel('modeles', { manifestes, osDesRigides: { humanoide: [], epee: ['root'] } })).toMatchObject({
      ok: true, bases: [{ id: 'humanoide', points: [{ id: 'main', elements: ['epee'] }, { id: 'secondaire', elements: ['epee'] }] }], fichiers: { humanoide: { glb: 'humanoide.glb', scene: 'humanoide.scn' }, epee: { glb: 'epee.glb', scene: 'epee.scn' } }, refus: [],
    });
    const sansManifestes = { categorie: 'validation', message: 'modeles : manifestes, un objet id de modèle → manifeste' };
    expect(erreurDe(appel('modeles', {}))).toEqual(sansManifestes);
    expect(erreurDe(appel('modeles'))).toEqual(sansManifestes);
    const sansOs = { categorie: 'validation', message: 'modeles : osDesRigides, un objet id de modèle → os de ses meshes rigides' };
    expect(erreurDe(appel('modeles', { manifestes }))).toEqual(sansOs);
    expect(erreurDe(appel('modeles', { manifestes, osDesRigides: { epee: 'root' } }))).toEqual(sansOs);
  });

  it('`scenarios` rend, sans partie, chaque scénario du catalogue une fois, sous sa section, et le bouton qui le démarre', () => {
    const { zones } = appel('scenarios') as unknown as { zones: ZonesDesScenarios };
    const sections = zones['scenarios.sections'];
    expect(sections.map((s) => s.nom)).toEqual(SCENARIO_SECTIONS.filter((s) => testScenarios.some((sc) => sc.category === s.key)).map((s) => s.label));
    const ranges = sections.flatMap((s) => (s.elements as Entite[]).map((e) => ({ section: s.id, e })));
    expect(ranges.map(({ e }) => e.id).sort()).toEqual(testScenarios.map((sc) => sc.id).sort());
    for (const { section, e } of ranges) {
      const sc = testScenarios.find((x) => x.id === e.id)!;
      expect(section).toBe(`section/${sc.category}`);
      expect(e.nom).toBe(sc.title);
      expect(e.elements.find((x) => x.type === 'bouton')).toMatchObject({ id: `lancer/${sc.id}`, jeu: { scenario: sc.id }, refus: null });
    }
    expect(erreurDe(appel('scenarios', { section: 'combat' }))).toEqual({ categorie: 'validation', message: 'scenarios : section hors de l’entrée (aucune clé)' });
  });

  it('`vue`, `monde`, `morceaux` de la partie, `retrait`, `vision`, `aretes`, `jouer`, `fiche` et `reprendre` se refusent sans partie', () => {
    for (const [methode, entree] of [['vue', undefined], ['monde', undefined], ['morceaux', { source: 'partie', volume: [], toits: [], couronnes: [] }], ['retrait', undefined], ['vision', undefined], ['aretes', undefined], ['jouer', { type: 'fenetreValider', args: ['debutDuRound'] }], ['fiche', { fiche: null }], ['regarder', { regard: 'plateau' }], ['reprendre', { jeton: 0 }]] as const) {
      expect(erreurDe(appel(methode, entree)), methode).toEqual({ categorie: 'validation', message: 'aucune partie : demarrer ou ouvrir d’abord' });
    }
  });

  it('une entrée illisible, qui n’est pas un objet, ou qui porte une clé hors contrat se refuse en `validation`', () => {
    expect(JSON.parse(pont.appeler('demarrer', '{scenario'))).toEqual({ ok: false, erreur: { categorie: 'validation', message: 'demarrer : entrée JSON illisible' } });
    expect(erreurDe(appel('demarrer', ['dome'])).message).toBe('demarrer : l’entrée est un objet JSON');
    expect(erreurDe(appel('demarrer', { scenario: 'dome', grain: 3 })).message).toBe('demarrer : grain hors de l’entrée (clés : scenario, graine)');
  });

  it('un scénario inconnu ou une graine non entière se refuse, et ne démarre rien', () => {
    expect(erreurDe(appel('demarrer', { scenario: 'zz-inconnu', graine: 7 }))).toEqual({ categorie: 'validation', message: 'scénario inconnu : zz-inconnu' });
    expect(erreurDe(appel('demarrer', { scenario: 'dome', graine: 1.5 }))).toEqual({ categorie: 'validation', message: 'graine non entière : 1.5' });
    expect(erreurDe(appel('vue')).message).toBe('aucune partie : demarrer ou ouvrir d’abord');
  });
});

describe('le pont et sa partie', () => {
  it('`demarrer` ouvre la partie ; un second appel, sur la partie ouverte, se refuse', { timeout: 120_000 }, () => {
    const { suite } = drainer(appel, appel('demarrer', { scenario: 'dome', graine: 7 }));
    expect(suite.vue.projection.fenetre?.gestes.length, 'la vue nomme les gestes de la fenêtre ouverte').toBeGreaterThan(0);
    const e = erreurDe(appel('demarrer', { scenario: 'dome', graine: 7 }));
    expect(e.categorie).toBe('validation');
    expect(e.message).toBe('demarrer : une partie est ouverte ; quitter d’abord');
    expect(vue(), '`vue` rend la vue de la dernière suite').toEqual(suite.vue);
  });

  it('la vue porte le plateau de la scène, chaque verbe de sa fenêtre en geste, et les clics du champ', () => {
    const v = vue();
    const depart = scenario.construire(idsDeTest);
    expect(v.plateau, 'le plateau de la scène du scénario, sans toit à lever').toEqual(plateauDeLaScene(depart.scene, [], 'tactique'));
    expect(plateauDeLaScene({ ...depart.scene, metresPerTile: 1.5 }, [], 'tactique').metresParCase, 'l’échelle que la scène déclare').toBe(1.5);
    expect(fautesDeLaFenetre(v), 'chaque verbe de la fenêtre ouverte, dessinable').toEqual([]);
    expect(v.champ, 'l’ouverture du round tient la main : le champ ne se clique pas').toBeNull();
    expect(VERBES[CLIC_DU_CHAMP], CLIC_DU_CHAMP).toBeDefined();
  });

  it('le regard choisi par `regarder` tranche le plateau ; l’immersion cède à la tactique en combat', () => {
    const regard = (r: string) => (appel('regarder', { regard: r }) as { vue: VueDuPont }).vue.plateau!.regard;
    expect(regard('plateau')).toBe('plateau');
    expect(vue().plateau!.regard, 'gardé d’une vue à l’autre').toBe('plateau');
    expect(regard('immersion'), 'le dôme est un combat').toBe('tactique');
    expect(erreurDe(appel('regarder', { regard: 'oblique' }))).toEqual({ categorie: 'validation', message: 'regarder : regard, l’un de tactique, plateau, immersion' });
    expect(regard('tactique')).toBe('tactique');
  });

  it('un jeton inconnu se refuse en `validation`', () => {
    expect(erreurDe(appel('reprendre', { jeton: 999 }))).toEqual({ categorie: 'validation', message: 'jeton inconnu : 999' });
    expect(erreurDe(appel('reprendre', { jeton: 'a' })).message).toBe('reprendre : jeton, le numéro d’un jeton programmé');
  });

  it('une levée qu’aucun contrôle n’attendait se rend en `interne`, dans une chaîne JSON', () => {
    const panne = vi.spyOn(projection, 'projeter').mockImplementation(() => { throw new Error('lecteur en panne'); });
    expect(JSON.parse(pont.appeler('vue'))).toEqual({ ok: false, erreur: { categorie: 'interne', message: 'lecteur en panne' } });
    panne.mockRestore();
    expect(appel('vue').ok, 'le lecteur rétabli, la vue se rend').toBe(true);
  });

  it('un verbe inconnu nomme les gestes de la fenêtre qui tient la main ; un argument en trop se refuse', () => {
    const fenetre = vue().projection.fenetre!;
    const e = erreurDe(appel('jouer', { type: 'confirmRound', args: [] }));
    expect(e.categorie).toBe('validation');
    expect(e.message).toContain(`verbe inconnu : confirmRound ; gestes de la fenêtre ${fenetre.cle} : ${fenetre.gestes.map(cleDuGeste).join(', ')}`);
    const g = fenetre.gestes[0];
    expect(erreurDe(appel('jouer', { type: g.verbe, args: [...(g.flux ? [g.flux] : []), 1, 1, 1] })).categorie).toBe('validation');
    expect(erreurDe(appel('jouer', { suite: [], type: 'x' })).message).toBe('jouer : type hors de l’entrée (clés : suite)');
    expect(erreurDe(appel('jouer', { offre: 'fin-de-tour' })).message, 'une offre se joue par le verbe qu’elle déclare').toBe('jouer : offre hors de l’entrée (clés : type, args, siege)');
  });

  it('chaque catégorie d’un geste refusé : `validation`, `permission`, `regle`', { timeout: 120_000 }, () => {
    drainer(appel, appel('jouer', { type: 'fenetreValider', args: ['debutDuRound'] }));
    expect(erreurDe(appel('jouer', { type: 'armerLIntention', args: ['charge'], siege: 0 })).categorie).toBe('validation');
    expect(erreurDe(appel('jouer', { type: 'terminerLeTour', args: [], siege: 1 })).categorie).toBe('permission');
    expect(erreurDe(appel('jouer', { type: 'rompreLEngagement', args: [] })).categorie).toBe('regle');
  });

  it('un jeton déjà repris se refuse en `validation`', { timeout: 120_000 }, () => {
    // Les tours des héros finis jusqu'au premier qui programme une suite (le tour adverse) ; ses jetons repris.
    let fin = appel('jouer', { type: 'terminerLeTour', args: [] });
    for (let tours = 0; !suiteDe(fin).programmes.length && tours < 8; tours++) fin = appel('jouer', { type: 'terminerLeTour', args: [] });
    const [jeton] = suiteDe(fin).programmes;
    expect(jeton, 'une fin de tour programme la suite du round').toBeDefined();
    drainer(appel, fin);
    expect(erreurDe(appel('reprendre', { jeton: jeton.id }))).toEqual({ categorie: 'validation', message: `jeton inconnu : ${jeton.id}` });
  });

  it('`erreursGlobales` rend les erreurs de la page relevées, puis les vide', () => {
    expect(appel('erreursGlobales'), 'aucune erreur émise').toEqual({ ok: true, erreurs: [] });
    page.dispatchEvent(Object.assign(new Event('error'), { message: 'boum', filename: 'wfrp-pont.js', lineno: 12 }));
    page.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new Error('promesse rejetée') }));
    expect(appel('erreursGlobales')).toEqual({
      ok: true,
      erreurs: [{ message: 'boum', source: 'wfrp-pont.js:12' }, { message: 'promesse rejetée', source: 'unhandledrejection' }],
    });
    expect(appel('erreursGlobales'), 'relevées, elles sont vidées').toEqual({ ok: true, erreurs: [] });
  });
});

describe('la file de la partie', () => {
  /** Ce que la `Suite` de `regarder` porte de la partie : ses jetons, son journal, ses lignes d'écran et ses effets. */
  const produit = () => {
    const s = suiteDe(appel('regarder', { regard: 'tactique' }));
    return { programmes: s.programmes, journal: s.journal, lignes: s.zones['journal.lignes'], effets: s.effets };
  };
  const RIEN = { programmes: [], journal: [], lignes: [], effets: [] };

  it('la `Suite` de `demarrer` porte le journal de son lancement ; la suivante n’en redit rien', { timeout: 120_000 }, () => {
    appel('quitter');
    const s = suiteDe(appel('demarrer', { scenario: 'dome', graine: 7 }));
    expect(s.journal.length, 'le lancement du dôme écrit au journal').toBeGreaterThan(0);
    expect(produit(), 'rien ne sort deux fois').toEqual(RIEN);
  });

  it('un geste refusé à un siège sort sa ligne et le son de ses dés à la `Suite` suivante, une fois', () => {
    expect(erreurDe(appel('jouer', { type: 'terminerLeTour', args: [], siege: 1 })).categorie).toBe('permission');
    expect(erreurDe(appel('jouer', { type: 'jetLancer', args: ['cascade', 'sorciere'], siege: 1 })).categorie).toBe('permission');
    const p = produit();
    expect(p.journal.map((l) => ('texte' in l ? l.texte : null)), 'la ligne de chaque refus').toEqual([t('coop.intentRefused'), t('coop.intentRefused')]);
    expect(p.effets.some((e) => e.quoi === 'son' && e.son.id === SONS_DE_LA_PARTIE.des), 'le son des dés du verbe de jet').toBe(true);
    expect(produit(), 'rien ne sort deux fois').toEqual(RIEN);
  });

  it('le jeton d’un pas joué avant le refus de `jouer { suite }` sort à la `Suite` suivante, une fois, et se reprend', { timeout: 120_000 }, () => {
    drainer(appel, appel('jouer', { type: 'fenetreValider', args: ['debutDuRound'] }));
    for (let tour = 0; tour < 3; tour++) expect(suiteDe(appel('jouer', { type: 'terminerLeTour', args: [] })).programmes, `fin de tour ${tour + 1}, sans jeton`).toEqual([]);
    const refus = erreurDe(appel('jouer', { suite: [{ type: 'terminerLeTour', args: [] }, { type: 'inconnu' }] }));
    expect(refus.categorie).toBe('validation');
    expect(refus.message).toContain('verbe inconnu : inconnu');
    const { programmes } = produit();
    expect(programmes.length, 'le jeton de la quatrième fin de tour').toBe(1);
    expect(produit().programmes, 'rien ne sort deux fois').toEqual([]);
    expect(appel('reprendre', { jeton: programmes[0].id }).ok, 'le jeton se reprend').toBe(true);
  });
});
