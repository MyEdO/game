/**
 * LA FICHE D'UN HÉROS PAR LE PONT (#3328) : chaque héros du groupe est un bouton qui ouvre sa fiche ; la fiche dit son
 * nom, ses Blessures, ses Points de Destin, de Chance, de Résilience et de Détermination, puis l'onglet ouvert (ses
 * Caractéristiques, ses Compétences à la valeur de leur Test, ses Talents, sa description au survol, ses possessions,
 * les équipées d'abord) ; ses onglets se changent et elle se ferme par ses boutons, sans toucher la partie.
 */
import { describe, it, expect } from 'vitest';
import { drainer, erreurDe, suiteDe, table } from './pont.testkit';
import type { Bouton, Entite, Puce } from '../../../src/hote/elements';
import talents from '../../../src/data/talents.json';

const { appel } = table();

describe('la fiche d’un héros par le pont', () => {
  it('ouverte par le bouton du héros, elle dit ses Points, chaque onglet sa part, et se ferme', () => {
    const { suite: debut } = drainer(appel, appel('demarrer', { scenario: 'dome', graine: 7 }));
    const groupe = debut.vue.zones['groupe.heros'];
    expect(groupe.map((b) => b.libelle), 'chaque héros du groupe est un bouton qui le nomme').toEqual(['Ilyanwe la Voilée', 'Berta']);
    expect(groupe.some((b) => b.presse), 'aucune fiche ouverte').toBe(false);
    expect([debut.vue.zones['fiche.heros'], debut.vue.zones['fiche.gestes'], debut.vue.zones['fiche.corps']], 'sans fiche, ses zones sont vides').toEqual([[], [], []]);

    let s = suiteDe(appel('fiche', groupe[0].jeu));
    expect(s.vue.projection.pas, 'ouvrir la fiche ne joue aucun geste de la partie').toBe(debut.vue.projection.pas);
    expect(s.vue.zones['groupe.heros'][0].presse, 'le héros de la fiche ouverte est pressé').toBe(true);
    const [heros] = s.vue.zones['fiche.heros'] as Entite[];
    expect(heros.nom).toBe('Ilyanwe la Voilée');
    const points = Object.fromEntries(heros.elements.filter((e): e is Puce => e.type === 'puce').map((p) => [p.libelle, p.valeur]));
    expect(points, 'ses Points de Destin, de Chance, de Résilience et de Détermination').toEqual({ Destin: '4', Chance: '4', 'Résilience': '3', 'Détermination': '3' });
    const blessures = heros.elements.find((e) => e.id === 'blessures');
    const pb = s.vue.projection.combat!.voisins.liste.find((c) => c.id === heros.id)!.pb;
    expect(blessures, 'ses Blessures en jauge').toMatchObject({ type: 'jauge', courant: pb[0], max: pb[1] });
    expect(s.vue.zones['fiche.gestes'].map((b) => [b.libelle, b.presse]), 'ses onglets, l’ouvert pressé, puis sa fermeture')
      .toEqual([['Caractéristiques', true], ['Compétences', false], ['Talents', false], ['Possessions', false], ['Fermer', false]]);
    const caracteristiques = s.vue.zones['fiche.corps'];
    expect(caracteristiques.map((p) => p.libelle), 'ses dix Caractéristiques, par abréviation').toEqual(['CC', 'CT', 'F', 'E', 'I', 'Ag', 'Dex', 'Int', 'FM', 'Soc']);
    expect(caracteristiques.find((p) => p.libelle === 'CC')?.detail, 'son nom au survol').toBe('Capacité de Combat');
    expect(caracteristiques.every((p) => Number(p.valeur) > 0), 'chacune sa valeur').toBe(true);

    const onglet = (id: string) => s.vue.zones['fiche.gestes'].find((b) => b.id === `onglet/${id}`)!;
    s = suiteDe(appel('fiche', onglet('competences').jeu));
    const competences = s.vue.zones['fiche.corps'];
    expect(competences.length, 'chacune de ses Compétences').toBe(19);
    expect(competences.map((p) => p.libelle), 'par nom').toEqual(competences.map((p) => p.libelle).sort((a, b) => a.localeCompare(b, 'fr')));
    expect(competences.every((p) => /^\d+$/.test(p.valeur!) && /^\S+ \d+ \+ \d+$/.test(p.detail!)), 'la valeur de son Test, sa Caractéristique et ses Augmentations au survol').toBe(true);

    s = suiteDe(appel('fiche', onglet('talents').jeu));
    const perspicace = s.vue.zones['fiche.corps'].find((p) => p.libelle === 'Perspicace');
    expect(perspicace?.detail, 'un Talent se nomme ; sa description au survol').toBe(talents.find((x) => x.id === 'perspicace')!.desc);
    expect(s.vue.zones['fiche.corps'].length, 'chacun de ses Talents').toBe(12);
    const arcanes = s.vue.zones['fiche.corps'].find((p) => p.libelle === 'Magie des Arcanes (Feu)')!.detail!;
    expect(talents.find((x) => x.id === 'magie-des-arcanes')!.desc!.startsWith(arcanes.replace(/…$/, '')), 'une description longue : son premier paragraphe, coupé au mot').toBe(true);
    expect(arcanes.length <= 300 && !arcanes.includes('\n'), 'qui se lit d’un coup d’œil').toBe(true);

    s = suiteDe(appel('fiche', onglet('possessions').jeu));
    const possessions = s.vue.zones['fiche.corps'];
    expect(possessions[0], 'les possessions équipées d’abord').toMatchObject({ libelle: 'Bâton de combat', ton: 'reussite', detail: 'Équipé' });
    expect(possessions.find((p) => p.libelle === 'Feuille de parchemin')?.valeur, 'les possessions pareilles comptées ensemble').toBe('×7');

    const avance = drainer(appel, appel('jouer', debut.vue.zones['fenetre.gestes'].find((g): g is Bouton => g.type === 'bouton' && g.focus)!.jeu)).suite;
    expect(avance.vue.zones['fiche.gestes'].find((b) => b.presse)?.id, 'la fiche reste ouverte, à son onglet, quand la partie avance').toBe('onglet/possessions');

    s = suiteDe(appel('fiche', avance.vue.zones['fiche.gestes'].find((b) => b.id === 'fermer')!.jeu));
    expect([s.vue.zones['fiche.heros'], s.vue.zones['fiche.gestes'], s.vue.zones['fiche.corps']], 'fermée, ses zones se vident').toEqual([[], [], []]);
    s = suiteDe(appel('fiche', s.vue.zones['groupe.heros'][1].jeu));
    expect((s.vue.zones['fiche.heros'][0] as Entite).nom, 'le bouton d’un autre héros ouvre sa fiche, à l’onglet de la dernière').toBe('Berta');
    s = suiteDe(appel('fiche', s.vue.zones['groupe.heros'][1].jeu));
    expect(s.vue.zones['fiche.heros'], 'son bouton pressé la ferme').toEqual([]);
  });

  it('refuse un héros hors du groupe et un onglet inconnu', () => {
    const a = appel;
    expect(erreurDe(a('fiche', { fiche: { heros: 'personne', onglet: 'talents' } })), 'le refus nomme les héros du groupe').toMatchObject({ categorie: 'validation', message: expect.stringContaining('(sorciere, protegee)') });
    expect(erreurDe(a('fiche', { fiche: { heros: 'sorciere', onglet: 'grimoire' } })).categorie).toBe('validation');
    expect(erreurDe(a('fiche', {})).categorie).toBe('validation');
  });
});
