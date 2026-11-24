/**
 * L'ÉCHOPPE PAR LE PONT (#3534) : le forgeron de Steinbruck joué comme Godot le joue. L'étal par famille, chaque article
 * à son prix, le panier et son total, la bourse, chaque possession des héros à vendre et le lot (`marchandEnVue`) ; un
 * choix que le corps porte ne se redessine pas en réglage.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { departDeLaCarte, drainer, table, gestesDessines } from './pont.testkit';
import type { Bouton, Element, Entite, Puce } from '../../../src/hote/elements';
import type { Pont, Suite } from './pont';
import { imposerLesD100 } from '../../../src/noyau/battleRng.testkit';
import { rendreLaVue } from '../../texte/vue';
import { giveTrappingSchema } from '../../../src/data/schemas/defs-scenes/effets';
import { withBourseMoney } from '../../../src/engine/bourse';
import { combattantDeTest } from '../../../src/engine/combattantDeTest.testkit';
import { idsDeTest } from '../../../src/engine/idsDeTest.testkit';
import { ecrireLaSauvegarde } from '../../../src/hote/sauvegardes';
import { surUnBancHorsTest } from '../../../src/noyau/banc.testkit';
import { applyEffects } from '../../../src/noyau/combatEffects';
import { catalogEntryOf } from '../../../src/noyau/merchantFlow';
import { emptyScene } from '../../../src/noyau/monde/scene';
import { snapshotSave } from '../../../src/noyau/persistance/save';

let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; vi.restoreAllMocks(); });

/** Une partie du scénario `voyage` arrivée à Steinbruck, l'échoppe du forgeron ouverte. */
function echoppe() {
  const { pont, appel } = table();
  ouvert = pont;
  const jouer = (jeu: Bouton['jeu']): Suite => drainer(appel, appel('jouer', jeu)).suite;
  let s = drainer(appel, appel('demarrer', { scenario: 'voyage', graine: 7 })).suite;
  const avancer = (jusqua?: string) => {
    for (let pas = 0; s.vue.projection.fenetre && s.vue.projection.fenetre.cle !== jusqua; pas++) {
      expect(pas, 'les fenêtres se vident').toBeLessThan(80);
      const g = gestesDessines(s.vue);
      s = jouer((g.find((x): x is Bouton => x.type === 'bouton' && x.focus) ?? g.find((x): x is Bouton => x.type === 'bouton' && !x.refus)!).jeu);
    }
  };
  avancer();
  s = jouer(s.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Carte du monde')!.jeu);
  s = jouer(departDeLaCarte(s.vue, 'r-grandroute').valeurs[0].jeu);
  avancer('ecranDuLieu');
  s = jouer(((s.vue.zones['fenetre.corps'].find((e) => e.id === 'service/forgeron') as Entite).elements.find((e): e is Bouton => e.type === 'bouton')!).jeu);
  return { suite: s, jouer };
}

const corps = (s: Suite) => Object.fromEntries(s.vue.zones['fenetre.corps'].map((e: Element) => [e.id, e]));
const boutons = (e: Element) => (e as Entite).elements as Bouton[];

describe('l’échoppe par le pont', () => {
  it('l’étal par famille et ses prix, la bourse, le panier vide qui ne se paie pas, les possessions à vendre', () => {
    const { suite } = echoppe();
    expect(suite.vue.disposition, 'l’échoppe a son écran').toBe('marchand');
    const c = corps(suite);
    expect((c['bourse'] as Puce).valeur, 'la bourse du groupe').toMatch(/\d/);
    const familles = Object.keys(c).filter((id) => id.startsWith('etal/'));
    expect(familles.length, 'l’étal rangé par famille').toBeGreaterThan(1);
    expect(boutons(c[familles[0]]).every((b) => / · /.test(b.libelle)), 'chaque article dit son prix').toBe(true);
    expect(suite.vue.projection.marchand?.panier, 'le panier vide en données').toMatchObject({ lignes: [], total: { gold: 0, silver: 0, brass: 0 } });
    expect(boutons(c['panier']).map((b) => [b.libelle, b.refus]), 'le panier vide ne se paie pas').toEqual([['Payer 0 sc', 'Le panier est vide.']]);
    expect(Object.keys(c).filter((id) => id.startsWith('vente/')), 'les possessions de chaque héros').toEqual(['vente/bjorn', 'vente/mira', 'vente/aldric', 'vente/greta']);
    expect(suite.vue.zones['fenetre.reglages'].map((r) => r.id), 'l’étal et les ventes ne se redisent pas en listes').not.toContain('fenetreChoisir@marchand#ajouterAuPanier');
  });

  it('un article au panier : pressé à l’étal, sa ligne et son total, et le paiement ouvert', () => {
    const { suite, jouer } = echoppe();
    const article = Object.values(corps(suite)).filter((e) => e.id.startsWith('etal/')).flatMap(boutons).find((b) => !b.refus)!;
    const s = jouer(article.jeu);
    const c = corps(s);
    const nom = article.libelle.split(' · ')[0];
    expect(Object.values(c).filter((e) => e.id.startsWith('etal/')).flatMap(boutons).find((b) => b.id === article.id)?.presse, 'l’article pressé à l’étal').toBe(true);
    const panier = boutons(c['panier']);
    expect(panier[0].libelle, 'sa ligne au panier').toMatch(new RegExp(`^${nom} ×1 · `));
    expect(panier.find((b) => b.id === 'payer'), 'le paiement de son total, ouvert').toMatchObject({ refus: null });
  });

  it('une possession au lot : pressée chez son héros, et la vente ouverte', () => {
    const { suite, jouer } = echoppe();
    expect(corps(suite)['vendre'], 'un lot vide ne se vend pas').toMatchObject({ refus: expect.any(String) });
    const cape = boutons(corps(suite)['vente/bjorn']).find((b) => !b.refus)!;
    const c = corps(jouer(cape.jeu));
    expect(boutons(c['vente/bjorn']).find((b) => b.id === cape.id)?.presse, 'la possession pressée au lot').toBe(true);
    expect(c['vendre'], 'le lot se vend').toMatchObject({ refus: null });
  });
});

describe('le Marchandage joué par le pont', () => {
  it.each(['achat', 'vente'] as const)('garde le seuil du marchand opaque après le dé et la relance (%s)', (sens) => {
    const { jouer } = echoppe();
    let s = jouer({ type: 'fenetreChoisir', args: ['marchand', 'marchander', sens] });
    const jet = (suite: Suite) => suite.vue.projection.jets.find((j) => j.flux === 'marchandage')!;
    expect(jet(s).lignes).toMatchObject([
      { id: 'joueur', etat: 'aJouer', cible: expect.any(Number), jet: null },
      { id: 'marchand', etat: 'aJouer', cible: null, jet: null },
    ]);
    const [joueur] = jet(s).lignes.filter((l) => l.genre === 'test');
    expect(s.vue.zones['fenetre.corps'].filter((e) => e.type === 'jet')).toMatchObject([
      { cible: '≤ ' + joueur.cible, resultat: null },
      { cible: null, resultat: null },
    ]);
    imposerLesD100(99, 29, 5);
    s = jouer({ type: 'jetLancer', args: ['marchandage'] });
    expect(jet(s).lignes[0]).toMatchObject({ cible: joueur.cible });
    const verifier = (suite: Suite) => {
      const j = jet(suite);
      const [porteur, marchand] = j.lignes;
      expect(marchand).toMatchObject({ genre: 'test', cible: null, jet: { d100: 29 } });
      expect(suite.vue.zones['fenetre.corps'].filter((e) => e.type === 'jet' && e.resultat === '29')).toEqual([
        expect.objectContaining({ cible: null, resultat: '29', detail: null, modificateurs: [] }),
      ]);
      expect(JSON.stringify(suite)).not.toMatch(/"cible":"≤ 45"|"cible":45,"jet":\{"d100":29/);
      const ligne = rendreLaVue(suite.vue.projection).find((l) => l.startsWith('jet marchandage :'));
      expect(ligne).toContain('29/');
      expect(ligne).not.toContain('29/45');
      expect(j).toMatchObject({ sorte: 'oppose', oppose: { drNet: expect.any(Number) } });
      expect(porteur).toMatchObject({ id: expect.any(String), etat: 'revele', reference: { genre: 'competence', id: 'marchandage' } });
      expect(marchand).toMatchObject({ id: expect.any(String), etat: 'revele', jet: { dr: expect.any(Number), verdict: 'reussite' } });
      return marchand;
    };
    const marchand = verifier(s);
    expect(jet(s).lignes[0].jet).toMatchObject({ d100: 99, verdict: 'echec' });
    s = jouer({ type: 'jetRelancer', args: ['marchandage'] });
    expect(verifier(s)).toEqual(marchand);
    expect(jet(s).lignes[0].jet).toMatchObject({ d100: 5, verdict: 'reussite' });
    s = jouer({ type: 'jetValider', args: ['marchandage'] });
    expect(s.vue.projection.jets.some((j) => j.flux === 'marchandage')).toBe(false);
  });
});

describe('les contacts de Guilde par le pont (LDB 68 l.46–48)', () => {
  it('joue les boutons de l’étal, du choix de Guilde et des deux jets, puis rend l’étal', () => {
    const { sauvegarde, echec } = surUnBancHorsTest((banc) => {
      const g = banc.getState;
      const scene = emptyScene('bourg', 4, 4);
      scene.entities.push({
        id: 'medecin-du-bourg', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 1, y: 1 },
        merchant: { archetype: { id: 'medecin' }, settlement: 'village' },
      });
      const heros = withBourseMoney(combattantDeTest({ id: 'heros', kind: 'heros' }), { gold: 100, silver: 0, brass: 0 }, idsDeTest);
      banc.setState({ party: [heros], scene, gameTime: 8 * 60 });
      applyEffects(g, banc.setState, [giveTrappingSchema.parse({
        type: 'giveTrapping', objet: { id: 'licence-guilde-des-medecins' }, heroId: heros.id,
      })]);
      g().ouvrirLeMarchand('medecin-du-bourg');
      const ratage = g().merchantStocks['medecin-du-bourg'].echecs?.find((e) => e.availability === 'rare' && catalogEntryOf(e.id)?.price);
      expect(ratage, 'un échec véritable du marchand').toBeDefined();
      return {
        sauvegarde: snapshotSave(g(), '2026-11-21T20:00:00Z', { 'marche-membres-de-guildes': true }),
        echec: ratage!,
      };
    });

    const { pont, appel, stockage } = table();
    ouvert = pont;
    expect(ecrireLaSauvegarde(stockage, 1, sauvegarde)).toBe(true);
    let s = drainer(appel, appel('charger', { charger: 1, graine: 7 })).suite;
    const article = () => Object.values(corps(s)).filter((e) => e.id.startsWith('etal/'))
      .flatMap(boutons).find((b) => b.id === echec.id);
    const jouer = (b?: Bouton) => {
      expect(b, 'un bouton dessiné et autorisé').toMatchObject({ refus: null });
      s = drainer(appel, appel('jouer', b!.jeu)).suite;
    };
    const geste = (verbe: string, valeur?: string) => gestesDessines(s.vue)
      .flatMap((g): Bouton[] => g.type === 'bouton' ? [g] : g.type === 'choix' || g.type === 'liste' ? g.valeurs : [])
      .find((b) => b.refus === null && 'type' in b.jeu && b.jeu.type === verbe
        && b.jeu.args[0] === 'cascade' && (valeur === undefined || b.jeu.args[2] === valeur));

    expect(s.vue.projection.fenetre?.cle).toBe('marchand');
    expect(article()?.libelle).toMatch(/contacts de Guilde/i);
    jouer(article());
    expect(s.vue.projection.fenetre?.cle).toBe('cascade');
    jouer(geste('jetRegler', 'consulter'));
    jouer(geste('jetValider'));

    imposerLesD100(4, 5);
    jouer(geste('jetLancer'));
    jouer(geste('jetValider'));
    const relance = s.vue.projection.jets.find((j) => j.flux === 'cascade')?.lignes.find((l) => l.genre === 'test');
    expect(relance?.cible).toBe(echec.target);
    jouer(geste('jetLancer'));
    jouer(geste('jetValider'));
    if (s.vue.projection.fenetre?.cle === 'cascade') jouer(geste('fenetreFermer'));
    expect(s.vue.projection.fenetre?.cle).toBe('marchand');
    expect(article()?.libelle).toContain(catalogEntryOf(echec.id)!.label);
    expect(article()?.libelle).not.toMatch(/contacts de Guilde/i);
    jouer(article());
    expect(boutons(corps(s)['panier']).some((b) => b.id === echec.id)).toBe(true);
  });
});
