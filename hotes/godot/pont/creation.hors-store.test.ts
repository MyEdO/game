/**
 * LA CRÉATION D'UN HÉROS PAR LE PONT (#3328) : le bouton « Nouveau héros » ouvre l'assistant sur sa première page ;
 * chaque page se joue par ses boutons, une à la fois (un tirage ne dit son résultat qu'après son geste), ne se quitte
 * que soldée, et la dernière engage le héros, qui rejoint le groupe de la partie avec les valeurs tirées et choisies,
 * son entrée écrite au roster de l'hôte.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { drainer, erreurDe, ficheDuHeros, sectionDeLaFiche, suiteDe, table, enFocus } from './pont.testkit';
import { chargerLeRoster } from '../../../src/hote/roster';
import type { Pont, Suite } from './pont';
import type { Bouton, Choix, Element, Jet, Puce } from '../../../src/hote/elements';

/** Le bouton d'id `id` d'une zone de la création, ou l'échec qui la dit. */
function boutonDe(s: Suite, zone: 'groupe.gestes' | 'creation.gestes' | 'creation.corps', id: string): Bouton {
  const b = (s.vue.zones[zone] as Element[]).find((e): e is Bouton => e.type === 'bouton' && e.id === id);
  if (!b) throw new Error(`aucun bouton ${id} dans ${zone} : ${JSON.stringify((s.vue.zones[zone] as Element[]).map((e) => e.id))}`);
  return b;
}
/** Le choix d'id `id` du corps de la page. */
const choixDe = (s: Suite, id: string): Choix | undefined => s.vue.zones['creation.corps'].find((e): e is Choix => (e.type === 'choix' || e.type === 'liste') && e.id === id);
/** L'élément d'id `id` du corps de la page. */
const elementDe = (s: Suite, id: string): Element | undefined => s.vue.zones['creation.corps'].find((e) => e.id === id);
const titre = (s: Suite): string => s.vue.zones['creation.titre'][0]?.texte ?? '';

describe('la création d’un héros par le pont', () => {
  let ouvert: Pont | null = null;
  afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; });

  it('chaque page jouée par ses boutons, le héros engagé rejoint le groupe avec ses valeurs', () => {
    const { pont, appel, stockage } = table();
    ouvert = pont;
    let s = drainer(appel, appel('demarrer', { scenario: 'marche-equipement', graine: 7 })).suite;
    while (s.vue.projection.fenetre) s = drainer(appel, appel('jouer', (enFocus(s.vue) as Bouton).jeu)).suite;
    const avant = s.vue.zones['groupe.heros'].map((c) => c.nom);
    expect(s.vue.zones['creation.corps'], 'sans création, ses zones sont vides').toEqual([]);
    const creer = boutonDe(s, 'groupe.gestes', 'creation');
    expect([creer.libelle, creer.presse, creer.refus], 'un bouton ouvre la création').toEqual(['Nouveau héros', false, null]);
    const jouer = (b: Bouton): Suite => suiteDe(appel('creation', b.jeu));
    s = jouer(creer);
    expect(boutonDe(s, 'groupe.gestes', 'creation').presse, 'ouverte, son bouton est pressé').toBe(true);
    expect(titre(s), 'la première page, son rang parmi les pages').toBe('Race · 1/10');
    const pas = s.vue.projection.pas;

    // Race : aucun résultat avant le geste du joueur.
    expect(s.vue.zones['creation.corps'].some((e) => e.type === 'jet'), 'avant le d100, aucun jet n’est dit').toBe(false);
    expect(boutonDe(s, 'creation.gestes', 'suivante').refus, 'la page ne se quitte pas sans race').toBe('Choisissez votre race.');
    expect(erreurDe(appel('creation', boutonDe(s, 'creation.gestes', 'suivante').jeu)), 'la suivante refusée se refuse en règle').toEqual({ categorie: 'regle', message: 'creation : Choisissez votre race.' });
    s = jouer(boutonDe(s, 'creation.corps', 'tirage'));
    const d100 = elementDe(s, 'tirage') as Jet;
    expect(d100.type === 'jet' && /^\d+$/.test(d100.resultat!), 'le d100 tombé se dit').toBe(true);
    const espece = (elementDe(s, 'espece') as Puce).libelle;
    expect(choixDe(s, 'famille')!.valeurs.filter((v) => v.presse).length, 'la race tirée est choisie').toBe(1);
    expect((elementDe(s, 'px') as Puce).valeur, 'la race tirée gardée vaut ses PX').toBe('+20 PX');
    expect(erreurDe(appel('creation', { creation: { geste: 'tirerLaCarriere', args: [] } })).categorie, 'un geste que la page n’offre pas se refuse').toBe('validation');
    expect(erreurDe(appel('creation', { creation: { geste: 'engager', args: [] } })).categorie, 'ni l’engagement avant la dernière page').toBe('validation');
    s = jouer(boutonDe(s, 'creation.gestes', 'suivante'));

    // Carrière.
    expect(titre(s)).toBe('Carrière · 2/10');
    s = jouer(boutonDe(s, 'creation.corps', 'tirage'));
    const carriere = choixDe(s, 'tirees')!.valeurs.find((v) => v.presse)!.libelle;
    expect(s.vue.zones['creation.corps'].filter((e) => e.id.startsWith('variante/')).map((e) => e.id), `${carriere} n’a pas de variante : aucun second lancer`).toEqual([]);
    expect((elementDe(s, 'px') as Puce).valeur, 'la carrière du premier jet gardée vaut ses PX').toBe('+50 PX');
    s = jouer(boutonDe(s, 'creation.gestes', 'suivante'));

    // Caractéristiques : les dix 2d10, les 5 Augmentations de carrière, Destin et Résilience.
    expect(titre(s)).toBe('Caractéristiques · 3/10');
    expect((elementDe(s, 'carac/capacite-de-combat') as Puce).valeur, 'avant les dés, aucune Caractéristique n’est tirée').toBeNull();
    s = jouer(boutonDe(s, 'creation.corps', 'tirage'));
    const augmentations = s.vue.zones['creation.corps'].filter((e): e is Choix => e.type === 'choix' && e.id.startsWith('augmentation/'));
    expect(augmentations.length, 'les trois Caractéristiques de carrière').toBe(3);
    s = jouer(augmentations[0].valeurs.find((v) => v.libelle === '5')!);
    expect(choixDe(s, augmentations[1].id)!.valeurs.filter((v) => v.refus).map((v) => v.libelle), 'les 5 Augmentations posées, plus rien à répartir').toEqual(['1', '2', '3', '4', '5']);
    const destin = choixDe(s, 'destin')!;
    s = jouer(destin.valeurs[destin.valeurs.length - 1]);
    const caracteristiques = Object.fromEntries(s.vue.zones['creation.corps'].filter((e): e is Puce => e.type === 'puce' && e.id.startsWith('carac/')).map((p) => [p.id.slice('carac/'.length), Number(p.valeur)]));
    s = jouer(boutonDe(s, 'creation.gestes', 'suivante'));

    // Signe astral.
    expect(titre(s)).toBe('Signe astral · 4/10');
    s = jouer(boutonDe(s, 'creation.corps', 'tirage'));
    s = jouer(boutonDe(s, 'creation.gestes', 'suivante'));

    // Compétences de race, de carrière, Talents : chaque choix ouvert tranché par sa première option libre.
    const trancher = (x: Suite): Suite => {
      let y = x;
      for (let n = 0; boutonDe(y, 'creation.gestes', 'suivante').refus && n < 40; n++) {
        const ouvert = y.vue.zones['creation.corps'].find((e): e is Choix => (e.type === 'choix' || e.type === 'liste') && !e.valeurs.some((v) => v.presse));
        y = jouer(ouvert ? ouvert.valeurs.find((v) => !v.refus)! : y.vue.zones['creation.corps'].find((e): e is Bouton => e.type === 'bouton' && !e.presse && !e.refus)!);
      }
      return y;
    };
    expect(titre(s)).toBe('Compétences de race · 5/10');
    s = trancher(jouer(boutonDe(s, 'creation.corps', 'defaut')));
    s = jouer(boutonDe(s, 'creation.gestes', 'suivante'));
    expect(titre(s)).toBe('Compétences de carrière · 6/10');
    s = trancher(jouer(boutonDe(s, 'creation.corps', 'defaut')));
    s = jouer(boutonDe(s, 'creation.gestes', 'suivante'));
    expect(titre(s)).toBe('Talents · 7/10');
    s = trancher(s);
    const talent = choixDe(s, 'talentDeCarriere')!.valeurs.find((v) => v.presse)!.libelle;
    s = jouer(boutonDe(s, 'creation.gestes', 'suivante'));

    // Possessions : la bourse tirée, chaque dotation tranchée.
    expect(titre(s)).toBe('Possessions · 8/10');
    s = trancher(jouer(boutonDe(s, 'creation.corps', 'bourse')));
    expect(elementDe(s, 'bourse')?.type, 'la bourse tombée se dit').toBe('jet');
    s = jouer(boutonDe(s, 'creation.gestes', 'suivante'));

    // Identité : le nom aux dés, le physique aux dés.
    expect(titre(s)).toBe('Identité · 9/10');
    expect(boutonDe(s, 'creation.gestes', 'suivante').refus).toBe('Donnez un nom à votre personnage.');
    s = jouer(boutonDe(s, 'creation.corps', 'nom'));
    const nom = (elementDe(s, 'nomTire') as Puce).valeur!;
    s = jouer(boutonDe(s, 'creation.corps', 'physique'));
    expect((elementDe(s, 'age') as Puce).valeur, 'le physique tombé dit l’âge').toMatch(/^\d+$/);
    s = jouer(boutonDe(s, 'creation.gestes', 'suivante'));

    // Présentation, puis l'engagement.
    expect(titre(s)).toBe('Présentation · 10/10');
    const valeurs = (x: Suite, zone: 'creation.corps' | 'fiche.profil') => Object.fromEntries((x.vue.zones[zone] as Element[]).filter((e): e is Puce => e.type === 'puce').map((p) => [p.id, p.valeur]));
    const presentation = valeurs(s, 'creation.corps');
    expect((s.vue.zones['creation.corps'] as Puce[]).slice(0, 3).map((p) => p.libelle), 'le héros se présente : son nom, sa race, sa carrière').toEqual([nom, espece, carriere]);
    expect(s.vue.projection.pas, 'la création n’a joué aucun geste de la partie').toBe(pas);
    const engager = boutonDe(s, 'creation.gestes', 'engager');
    expect([engager.refus, engager.focus], 'l’engagement se joue à l’Entrée').toEqual([null, true]);
    const fin = jouer(engager);
    expect([fin.vue.zones['creation.titre'], fin.vue.zones['creation.corps'], fin.vue.zones['creation.gestes']], 'engagé, la création se ferme').toEqual([[], [], []]);
    expect(fin.vue.zones['groupe.heros'].map((c) => c.nom), 'le héros rejoint le groupe').toEqual([...avant, nom]);
    expect(fin.vue.projection.exploration!.heros.some((h) => h.nom === nom), 'la partie le porte').toBe(true);
    expect(fin.zones['journal.lignes'].some((l) => l.texte.includes(nom)), 'sa bourse de départ au journal').toBe(true);
    const [entree] = chargerLeRoster(stockage);
    expect([entree.hero.label, `heros/${entree.hero.id}`], 'son entrée au roster de l’hôte, sous l’id du héros du groupe').toEqual([nom, fin.vue.zones['groupe.heros'].slice(-1)[0].id]);

    s = suiteDe(appel('fiche', ficheDuHeros(fin.vue, nom).jeu));
    const fiche = valeurs(s, 'fiche.profil');
    const caracs = Object.fromEntries(Object.entries(presentation).filter(([id]) => id.startsWith('carac/')));
    expect(Object.fromEntries(Object.entries(fiche).filter(([id]) => id.startsWith('carac/'))), 'ses dix Caractéristiques, celles que la présentation disait').toEqual(caracs);
    const augmentee = augmentations[0].id.slice('augmentation/'.length);
    expect(Number(fiche[`carac/${augmentee}`]) - caracteristiques[augmentee], 'la Caractéristique augmentée porte ses 5 Augmentations').toBeGreaterThanOrEqual(5);
    expect((sectionDeLaFiche(s.vue, 'talents') as Puce[]).map((p) => p.libelle), 'son Talent de carrière').toContain(talent);
  });

  it('le second lancer (AA 02 l.109-111 ; VDM 03 l.17-19) : un bouton du jet dont la carrière a une variante, qui ne s’offre qu’une fois', () => {
    const { pont, appel } = table();
    ouvert = pont;
    let s = drainer(appel, appel('demarrer', { scenario: 'marche-equipement', graine: 3 })).suite;
    while (s.vue.projection.fenetre) s = drainer(appel, appel('jouer', (enFocus(s.vue) as Bouton).jeu)).suite;
    const jouer = (b: Bouton): Suite => suiteDe(appel('creation', b.jeu));
    s = jouer(boutonDe(s, 'groupe.gestes', 'creation'));
    s = jouer(boutonDe(s, 'creation.corps', 'tirage'));
    s = jouer(boutonDe(s, 'creation.gestes', 'suivante'));
    s = jouer(boutonDe(s, 'creation.corps', 'tirage'));
    const second = boutonDe(s, 'creation.corps', 'variante/0');
    expect([second.libelle, second.refus], 'le premier jet tire Soldat, qui a une variante').toEqual(['Second lancer : Soldat', null]);
    s = jouer(second);
    expect((elementDe(s, 'tirage') as Jet).resultat, 'le tirage dit le d100 et le second').toMatch(/^\d+ → \d+$/);
    expect(s.vue.zones['creation.corps'].some((e) => e.id === 'variante/0'), 'fait, il ne s’offre plus').toBe(false);
    expect(erreurDe(appel('creation', { creation: { geste: 'tirerLaVariante', args: [0] } })).categorie, 'rejoué, il se refuse').toBe('validation');
  });
});
