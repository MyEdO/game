/**
 * LA VISION DU GROUPE PAR LE PONT (#3950, tranche A) : ce que la vue montre est ce que le groupe connaît
 * (`src/noyau/visionDuGroupe.ts`), ce que le noyau laisse viser ne change pas. `embuscade-fluviale` pose au départ ses
 * 5 ennemis sur des cases que le groupe ne voit pas ; `opera-plan`, une scène à deux couches explorée pas à pas ;
 * `poursuite-terrestre`, 3 brigands embusqués ; `ecuries-clayonnage`, des structures de siège dont une face est vue et
 * l'ancrage non.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { corpsDe, drainer, erreurDe, mondeDe, table, type Reponse } from './pont.testkit';
import { casesDesCiblesDe, clicDuCombattant, SANS_BORNE, type Suite, type VueDuPont } from './pont';
import { projeter } from '../../../src/hote/projection';
import { ouvrirLeBanc } from '../../../src/noyau/banc.testkit';
import { lancerLeScenario } from '../../../src/noyau/lancementDeScenario';
import { lancementDuScenario } from '../../../src/scenes/test-scenarios/_shared';
import type { Combatant, Jeu } from '../../../src/noyau/index';
import { testScenarios } from '../../../src/scenes/test-scenarios/index';
import { idsDeTest } from '../../../src/engine/idsDeTest.testkit';
import { depuisBase64 } from '../../../src/lib/base64';
import { hash32AuMillieme } from '../../../src/data/hash';
import { t } from '../../../src/i18n';
import type { VisionDuMonde } from '../../../src/noyau/index';
import type { Jet, Ligne } from '../../../src/hote/elements';

const INCONNU = t('vision.horsDeVue');

/** Les entités de la scène du scénario `id`, telles que son lancement les construit. */
const entitesDe = (id: string) => testScenarios.find((s) => s.id === id)!.construire(idsDeTest).scene.entities;

/** La vision du monde que rend `vision`. */
const visionDe = (r: Reponse): VisionDuMonde => {
  expect(r.ok, JSON.stringify(r).slice(0, 300)).toBe(true);
  return r as unknown as VisionDuMonde;
};

describe('embuscade-fluviale — les ennemis hors de la vue du groupe', () => {
  const { appel } = table();
  let suite: Suite;
  const jouer = (geste: object) => (suite = drainer(appel, appel('jouer', geste)).suite);
  const vue = (): VueDuPont => suite.vue;
  const enVue = () => vue().projection.combat!.voisins.liste.map((c) => c.id);
  /** Les combattants posés que la vue ne dessine pas. */
  const horsDeVue = () => Object.values(vue().occupants).filter((id) => !enVue().includes(id));
  const ENNEMIS = ['enemy-enc-fluvial-0', 'enemy-enc-fluvial-1', 'enemy-enc-fluvial-2', 'enemy-enc-fluvial-3', 'enemy-enc-fluvial-4'];

  beforeAll(() => {
    suite = drainer(appel, appel('demarrer', { scenario: 'embuscade-fluviale', graine: 1 })).suite;
  });
  afterAll(() => { appel('quitter'); });

  it('ses 5 ennemis ont chacun leur case aux occupants, et ni corps, ni marques, ni rang dans l’ordre du tour', () => {
    expect(horsDeVue().sort(), 'les occupants hors de vue : exactement les 5 ennemis').toEqual(ENNEMIS);
    expect(Object.keys(vue().corps.combattants).sort(), 'les corps : ceux des combattants en vue').toEqual([...enVue()].sort());
    expect(Object.keys(vue().marques).sort(), 'les marques : celles des combattants en vue').toEqual([...enVue()].sort());
    const ordre = vue().zones['combat.ordre'].map((p) => p.id.slice('ordre/'.length));
    expect(ordre.every((id) => enVue().includes(id)), `l’ordre du tour ne nomme que des combattants en vue : ${ordre.join(', ')}`).toBe(true);
    expect(vue().projection.combat!.tours, 'le compte des tours : l’ordre du tour en vue').toBe(ordre.length);
  });

  it('la fiche d’un ennemi hors de vue se refuse en `validation`, en mots du joueur ; celle d’un héros s’ouvre', () => {
    expect(erreurDe(appel('fiche', { fiche: { porteur: ENNEMIS[1] } }))).toEqual({ categorie: 'validation', message: `fiche : porteur, ${t('vision.ficheHorsDeVue')}` });
    const heros = enVue()[0];
    expect(appel('fiche', { fiche: { porteur: heros } })).toMatchObject({ ok: true });
    expect(appel('fiche', { fiche: null })).toMatchObject({ ok: true });
  });

  it('`vue.vision` est l’empreinte du masque de `vision`, la même à la relecture', () => {
    const vision = visionDe(appel('vision'));
    expect(vue().vision, 'la clé de la vue : l’empreinte des octets du masque').toBe(hash32AuMillieme(depuisBase64(vision.masque)).toString(36));
    expect((appel('vue') as { vue: VueDuPont }).vue.vision, 'une relecture ne change pas la clé').toBe(vue().vision);
    expect(vision.rangees, 'un plan de `rangeesParPlan` rangées par couche').toBe(vision.rangeesParPlan * mondeDe(appel).monde!.hauteurs.length);
  });

  it('l’ennemi que le noyau laisse viser se vise par le clic de sa case ; ni l’aperçu ni la fenêtre d’attaque ne disent son nom', () => {
    jouer({ type: 'fenetreValider', args: ['debutDuRound'] });
    const combat = vue().projection.combat!;
    const vise = combat.cibles.liste.find((id) => horsDeVue().includes(id));
    expect(vise, `une cible hors de vue parmi ${combat.cibles.liste.join(', ')}`).toBeDefined();
    const clic = clicDuCombattant(vue(), vise!);
    expect(clic, 'sa case aux occupants : le champ la clique').not.toBeNull();
    jouer(clic!);
    expect(vue().projection.combat!.apercu?.cible, 'le premier clic vise l’ennemi').toBe(vise);
    expect(vue().zones['combat.apercu'], 'l’aperçu ne dit pas son nom').toEqual([{ type: 'ligne', id: 'apercu', ton: 'neutre', texte: t('ecran.apercu.cible', { cible: INCONNU }), detail: null }]);
    jouer(clic!);
    expect(vue().projection.fenetre, 'le second clic ouvre la fenêtre d’attaque').toMatchObject({ cle: 'cascade', etape: { genre: 'jetDAttaque' } });
    expect((corpsDe(vue(), 'cible') as Ligne).texte, 'la fenêtre ne nomme pas sa cible').toBe(t('ecran.attaque.cible', { cible: INCONNU }));
    expect((corpsDe(vue(), 'defense') as Jet).qui, 'ni celui qui se défend').toBe(INCONNU);
    const ecran = JSON.stringify(vue().zones);
    const noms = entitesDe('embuscade-fluviale').filter((e) => ENNEMIS.includes(e.id) && e.label).map((e) => e.label!);
    expect(noms.filter((n) => ecran.includes(n)), `aucun nom d’ennemi à l’écran (${noms.join(', ')})`).toEqual([]);
  });

  it('au tour d’un ennemi hors de vue, ni actif ni rang ; la Défense ne nomme pas l’attaquant', () => {
    jouer({ type: 'jetLancer', args: ['attaque'] });
    jouer({ type: 'jetValider', args: ['attaque'] });
    for (let n = 0; n < 8 && vue().projection.fenetre?.etape?.genre !== 'jetDeDefense'; n++) {
      const focus = vue().zones['fenetre.gestes'].find((g) => 'focus' in g && g.focus);
      if (focus?.type === 'bouton') jouer(focus.jeu);
      else jouer({ type: 'terminerLeTour', args: [] });
    }
    const combat = vue().projection.combat!;
    expect(vue().projection.fenetre, 'un ennemi attaque un héros').toMatchObject({ cle: 'cascade', etape: { genre: 'jetDeDefense' } });
    expect([combat.actif, combat.tour], 'l’actif hors de vue : aucun actif, aucun rang').toEqual([null, null]);
    expect(vue().zones['combat.actif'], 'le panneau ne montre aucun actif').toEqual([]);
    expect(vue().zones['combat.tour'].map((l) => l.texte), 'le round seul').toEqual([t('ecran.round', { round: combat.round })]);
    expect(vue().zones['combat.ordre'].filter((p) => p.ton === 'alerte'), 'l’ordre ne met personne en avant').toEqual([]);
    expect((corpsDe(vue(), 'defense/qui') as Ligne).texte, 'la Défense ne nomme pas l’attaquant (`ecran.defense.qui`)').toMatch(new RegExp(`^${INCONNU} `));
    expect(combat.barre.raison, 'la barre ne nomme pas l’actif (`barre.nonPilote`)').toBe(t('barre.nonPilote', { name: INCONNU }));
  });
});

describe('opera-plan — la vision par couche et pas à pas', () => {
  const { appel } = table();
  let suite: Suite;
  beforeAll(() => {
    suite = drainer(appel, appel('demarrer', { scenario: 'opera-plan', graine: 1 })).suite;
  });
  afterAll(() => { appel('quitter'); });

  it('le plan `i` du masque est la couche `hauteurs[i]` du monde : seule celle du groupe a des cases vues, la sienne comprise', () => {
    const { hauteurs } = mondeDe(appel).monde!;
    const vision = visionDe(appel('vision'));
    const octets = depuisBase64(vision.masque);
    const { groupe, etage } = suite.vue.projection.exploration!;
    const z = etage ?? 0;
    const plan = (i: number) => octets.subarray(i * vision.largeur * vision.rangeesParPlan, (i + 1) * vision.largeur * vision.rangeesParPlan);
    expect(hauteurs.length, 'une scène à deux couches').toBe(2);
    expect(hauteurs.map((_, i) => plan(i).includes(255)), `les plans aux cases vues, couches ${hauteurs.map((h) => h.z).join(', ')}`).toEqual(hauteurs.map((h) => h.z === z));
    const i = hauteurs.findIndex((h) => h.z === z);
    expect(plan(i)[groupe[1] * vision.largeur + groupe[0]], 'la case du groupe, vue, au plan de sa couche').toBe(255);
  });

  it('un pas change `vue.vision` ; chaque case vue que le pas quitte vaut 128, explorée', () => {
    const avant = depuisBase64(visionDe(appel('vision')).masque);
    const cle = suite.vue.vision;
    const [x, y] = suite.vue.projection.exploration!.groupe;
    suite = drainer(appel, appel('jouer', { type: suite.vue.champ, args: [{ x, y: y - 1 }] })).suite;
    expect(suite.vue.projection.exploration!.groupe, 'le groupe a fait son pas').toEqual([x, y - 1]);
    expect(suite.vue.vision, 'le pas change la clé').not.toBe(cle);
    const apres = depuisBase64(visionDe(appel('vision')).masque);
    const quittees = [...avant.keys()].filter((k) => avant[k] === 255 && apres[k] !== 255);
    expect(quittees.length, 'le pas quitte des cases vues').toBeGreaterThan(0);
    expect(new Set(quittees.map((k) => apres[k])), 'chacune explorée').toEqual(new Set([128]));
  });
});

describe('poursuite-terrestre — les embusqués', () => {
  it('ses 3 brigands embusqués ne sont pas aux entités de l’exploration', { timeout: 60_000 }, () => {
    const { appel } = table();
    try {
      const { vue } = drainer(appel, appel('demarrer', { scenario: 'poursuite-terrestre', graine: 1 })).suite;
      const embusques = entitesDe('poursuite-terrestre').filter((e) => e.combat?.hiddenUntilCombat).map((e) => e.id);
      expect(embusques, 'témoin : 3 embusqués à la scène').toHaveLength(3);
      const entites = vue.projection.exploration!.entites.liste.map((e) => e.id);
      expect(entites.filter((id) => embusques.includes(id)), `les entités de l’exploration : ${entites.join(', ')}`).toEqual([]);
    } finally {
      appel('quitter');
    }
  });
});

describe('ecuries-clayonnage — une structure de siège en vue par sa face', () => {
  it('une structure dont l’ancrage n’est pas vu et dont une face l’est est aux voisins', { timeout: 60_000 }, () => {
    const { appel } = table();
    try {
      const { vue } = drainer(appel, appel('demarrer', { scenario: 'ecuries-clayonnage', graine: 1 })).suite;
      const { masque, largeur, rangeesParPlan } = visionDe(appel('vision'));
      const octets = depuisBase64(masque);
      const { hauteurs } = mondeDe(appel).monde!;
      const octetDe = ([x, y, z]: [number, number, number]) => octets[(hauteurs.findIndex((h) => h.z === z) * rangeesParPlan + y) * largeur + x];
      const ancresNonVues = vue.projection.combat!.voisins.liste.filter((c) => c.camp !== 'heros' && c.pos && octetDe(c.pos) !== 255).map((c) => c.id);
      expect(ancresNonVues.length, `les voisins hors du groupe à l’ancrage non vu : ${ancresNonVues.join(', ')}`).toBeGreaterThan(0);
    } finally {
      appel('quitter');
    }
  });
});

describe('casesDesCibles — un couple monté partage sa case', () => {
  it('le cavalier et sa monture, au contact du chasseur, cibles tous deux, ont chacun leur case', () => {
    const banc = ouvrirLeBanc();
    lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(testScenarios.find((s) => s.id === 'embuscade-fluviale')!, idsDeTest));
    const etat = () => banc.getState() as unknown as Jeu;
    banc.getState().fenetreValider('debutDuRound');
    const [cavalier, monture] = ['enemy-enc-fluvial-1', 'enemy-enc-fluvial-2'];
    const battle = etat().battle!;
    const pos = { x: 6, y: 6 };
    const couple: Record<string, Partial<Combatant>> = { [cavalier]: { mountId: monture, pos }, [monture]: { riderId: cavalier, pos } };
    banc.setState({ battle: { ...battle, turn: battle.order.indexOf('chasseur-de-test'), combatants: battle.combatants.map((c) => ({ ...c, ...couple[c.id] })) } });
    const { combat } = projeter(etat(), 0, 0, SANS_BORNE);
    expect(combat!.cibles.liste, 'témoin : le cavalier et sa monture sont des cibles').toEqual(expect.arrayContaining([cavalier, monture]));
    const cases = casesDesCiblesDe(etat(), combat);
    expect([cases[cavalier], cases[monture]]).toEqual([[6, 6, 0], [6, 6, 0]]);
  });
});
