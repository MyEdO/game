/**
 * L'INVENTAIRE D'UN HÉROS PAR LE PONT (#3328) : hors combat, dans la section des possessions de sa fiche, une
 * possession choisie dit ses gestes (`gestesDeLObjet`) ; chacun se joue par le pont comme Godot le joue et change la partie : une
 * armure ôtée puis portée, une arme lâchée puis reprise en main, un objet rangé dans un sac puis sorti, donné à un
 * autre héros, un consommable utilisé.
 */
import { describe, it, expect } from 'vitest';
import { drainer, ficheDuHeros, sectionDeLaFiche, suiteDe, table, enFocus } from './pont.testkit';
import type { Suite } from './pont';
import type { Bouton, Choix, Entite, Jeu } from '../../../src/hote/elements';

const { appel } = table();

/** Les possessions de la fiche ouverte, chacune son bouton. */
const possessions = (s: Suite): Bouton[] => sectionDeLaFiche(s.vue, 'possessions') as Bouton[];

/** La possession choisie, en entité. */
const choisie = (s: Suite): Entite | undefined => (s.vue.zones['fiche.objet'] as Entite[])[0];

/** Le geste `id` de la possession choisie. */
const geste = (s: Suite, id: string): Bouton | Choix => {
  const g = choisie(s)?.elements.find((e) => e.id === id);
  if (!g || (g.type !== 'bouton' && g.type !== 'liste')) throw new Error(`aucun geste ${id} : ${JSON.stringify(choisie(s)?.elements.map((e) => e.id))}`);
  return g;
};

/** La possession `libelle` choisie par son bouton. */
const choisir = (s: Suite, libelle: string): Suite => {
  const b = possessions(s).find((p) => p.libelle === libelle);
  if (!b) throw new Error(`aucune possession ${libelle} : ${possessions(s).map((p) => p.libelle).join(', ')}`);
  return suiteDe(appel('fiche', b.jeu));
};

/** Un geste joué par le pont, ses jetons rejoués. */
const jouer = (jeu: Jeu): Suite => drainer(appel, appel('jouer', jeu)).suite;

describe('l’inventaire d’un héros par le pont', () => {
  it('hors combat, chaque geste d’une possession se joue et change la partie', () => {
    let { suite: s } = drainer(appel, appel('demarrer', { scenario: 'porte-close', graine: 7 }));
    while (s.vue.projection.fenetre) s = jouer(enFocus(s.vue)!.jeu);
    const rosa = ficheDuHeros(s.vue, 'Apothicaire');
    s = suiteDe(appel('fiche', rosa.jeu));

    s = choisir(s, 'Justaucorps de cuir');
    expect(choisie(s)?.ton, 'une armure portée se dit au ton d’une équipée').toBe('reussite');
    expect(geste(s, 'porter'), 'portée, son geste pressé et ouvert').toMatchObject({ libelle: 'Porter', presse: true, refus: null });
    s = jouer((geste(s, 'porter') as Bouton).jeu);
    expect([choisie(s)?.ton, geste(s, 'porter').type === 'bouton' && (geste(s, 'porter') as Bouton).presse], 'ôtée par son geste, la possession reste choisie').toEqual(['neutre', false]);
    expect(possessions(s).find((p) => p.presse)?.libelle).toBe('Justaucorps de cuir');
    s = jouer((geste(s, 'porter') as Bouton).jeu);
    expect(choisie(s)?.ton, 'portée de nouveau').toBe('reussite');

    s = choisir(s, 'Dague');
    expect([geste(s, 'main'), geste(s, 'secondaire')].map((g) => [g.libelle, (g as Bouton).presse, g.refus]), 'une arme tenue en main principale')
      .toEqual([['Main principale', true, null], ['Main secondaire', false, null]]);
    s = jouer((geste(s, 'main') as Bouton).jeu);
    expect([(geste(s, 'main') as Bouton).presse, choisie(s)?.ton], 'lâchée par son geste pressé').toEqual([false, 'neutre']);
    s = jouer((geste(s, 'main') as Bouton).jeu);
    expect((geste(s, 'main') as Bouton).presse, 'reprise en main').toBe(true);

    s = choisir(s, 'Potion de guérison');
    expect(geste(s, 'utiliser').refus, 'un consommable de son héros s’utilise hors combat').toBeNull();
    s = jouer((geste(s, 'utiliser') as Bouton).jeu);
    while (s.vue.projection.fenetre) s = jouer(enFocus(s.vue)!.jeu);
    expect(possessions(s).map((p) => p.libelle), 'utilisé, il est consommé').not.toContain('Potion de guérison');

    s = choisir(s, 'Pilon et Mortier');
    const ranger = geste(s, 'ranger') as Choix;
    expect(ranger.valeurs.map((v) => v.libelle), 'un objet en vrac se range dans un contenant de son héros où il tient').toContain('Besace');
    s = jouer(ranger.valeurs.find((v) => v.libelle === 'Besace')!.jeu);
    expect(choisie(s)?.elements.find((e) => e.id === 'contenant'), 'rangé, il dit son contenant').toMatchObject({ type: 'puce', libelle: 'Dans : Besace' });
    expect(choisie(s)?.elements.some((e) => e.id === 'ranger'), 'rangé, il ne se range plus').toBe(false);
    s = jouer((geste(s, 'sortir') as Bouton).jeu);
    expect(choisie(s)?.elements.some((e) => e.id === 'contenant'), 'sorti par son geste, il est en vrac').toBe(false);

    const donner = geste(s, 'donner') as Choix;
    expect(donner.valeurs.map((v) => v.libelle), 'il se donne à chaque autre héros du groupe').not.toContain('Apothicaire');
    s = jouer(donner.valeurs.find((v) => v.libelle === 'Soldat')!.jeu);
    expect(possessions(s).map((p) => p.libelle), 'donné, il quitte la fiche de son héros').not.toContain('Pilon et Mortier');
    expect(s.vue.zones['fiche.objet'], 'et n’est plus choisi').toEqual([]);
    s = suiteDe(appel('fiche', ficheDuHeros(s.vue, 'Soldat').jeu));
    expect(possessions(s).map((p) => p.libelle), 'il rejoint celle de l’autre héros').toContain('Pilon et Mortier');
  });
});
