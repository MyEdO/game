/**
 * LA FICHE D'UN HÉROS PAR LE PONT (#3328) : chaque héros du groupe est un bouton qui ouvre sa fiche ; la fiche dit son
 * nom, ses Blessures, ses Points de Destin, de Chance, de Résilience et de Détermination, puis l'onglet ouvert (ses
 * Caractéristiques, ses Compétences à la valeur de leur Test, ses Talents, sa description au survol, ses possessions,
 * les équipées d'abord) ; ses onglets se changent et elle se ferme par ses boutons, sans toucher la partie.
 */
import { describe, it, expect } from 'vitest';
import { drainer, erreurDe, suiteDe, table } from './pont.testkit';
import type { Suite } from './pont';
import type { Bouton, Choix, Entite, Puce } from '../../../src/hote/elements';
import talents from '../../../src/data/talents.json';

const { appel } = table();

/** Les puces de l'onglet ouvert de la fiche. */
const puces = (x: Suite): Puce[] => x.vue.zones['fiche.corps'] as Puce[];

describe('la fiche d’un héros par le pont', () => {
  it('ouverte par le bouton du héros, elle dit ses Points, chaque onglet sa part, et se ferme', () => {
    const { suite: debut } = drainer(appel, appel('demarrer', { scenario: 'dome', graine: 7 }));
    const groupe = debut.vue.zones['groupe.heros'];
    expect(groupe.map((b) => b.libelle), 'chaque héros du groupe est un bouton qui le nomme').toEqual(['Ilyanwe la Voilée', 'Berta']);
    expect(groupe.some((b) => b.presse), 'aucune fiche ouverte').toBe(false);
    expect([debut.vue.zones['fiche.heros'], debut.vue.zones['fiche.gestes'], debut.vue.zones['fiche.corps'], debut.vue.zones['fiche.objet']], 'sans fiche, ses zones sont vides').toEqual([[], [], [], []]);

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
    const caracteristiques = puces(s);
    expect(caracteristiques.map((p) => p.libelle), 'ses dix Caractéristiques, par abréviation').toEqual(['CC', 'CT', 'F', 'E', 'I', 'Ag', 'Dex', 'Int', 'FM', 'Soc']);
    expect(caracteristiques.find((p) => p.libelle === 'CC')?.detail, 'son nom au survol').toBe('Capacité de Combat');
    expect(caracteristiques.every((p) => Number(p.valeur) > 0), 'chacune sa valeur').toBe(true);

    const onglet = (id: string) => s.vue.zones['fiche.gestes'].find((b) => b.id === `onglet/${id}`)!;
    s = suiteDe(appel('fiche', onglet('competences').jeu));
    const competences = puces(s);
    expect(competences.length, 'chacune de ses Compétences').toBe(19);
    expect(competences.map((p) => p.libelle), 'par nom').toEqual(competences.map((p) => p.libelle).sort((a, b) => a.localeCompare(b, 'fr')));
    expect(competences.every((p) => /^\d+$/.test(p.valeur!) && /^\S+ \d+ \+ \d+$/.test(p.detail!)), 'la valeur de son Test, sa Caractéristique et ses Augmentations au survol').toBe(true);

    s = suiteDe(appel('fiche', onglet('talents').jeu));
    const perspicace = puces(s).find((p) => p.libelle === 'Perspicace');
    expect(perspicace?.detail, 'un Talent se nomme ; sa description au survol').toBe(talents.find((x) => x.id === 'perspicace')!.desc);
    expect(s.vue.zones['fiche.corps'].length, 'chacun de ses Talents').toBe(12);
    const arcanes = puces(s).find((p) => p.libelle === 'Magie des Arcanes (Feu)')!.detail!;
    expect(talents.find((x) => x.id === 'magie-des-arcanes')!.desc!.startsWith(arcanes.replace(/…$/, '')), 'une description longue : son premier paragraphe, coupé au mot').toBe(true);
    expect(arcanes.length <= 300 && !arcanes.includes('\n'), 'qui se lit d’un coup d’œil').toBe(true);

    s = suiteDe(appel('fiche', onglet('possessions').jeu));
    const possessions = s.vue.zones['fiche.corps'] as Bouton[];
    expect(possessions.every((b) => b.type === 'bouton' && !b.presse), 'chaque possession est un bouton ; aucune choisie').toBe(true);
    expect(possessions[0].libelle, 'les possessions équipées d’abord').toBe('Bâton de combat');
    expect(possessions.map((b) => b.libelle), 'les possessions pareilles comptées ensemble').toContain('Feuille de parchemin ×7');
    expect(s.vue.zones['fiche.objet'], 'aucune possession choisie, rien n’en est dit').toEqual([]);
    s = suiteDe(appel('fiche', possessions[0].jeu));
    expect(s.vue.projection.pas, 'choisir une possession ne joue aucun geste de la partie').toBe(debut.vue.projection.pas);
    expect((s.vue.zones['fiche.corps'] as Bouton[]).filter((b) => b.presse).map((b) => b.libelle), 'la choisie est pressée').toEqual(['Bâton de combat']);
    const [baton] = s.vue.zones['fiche.objet'] as Entite[];
    expect([baton.nom, baton.ton], 'la possession choisie se nomme, au ton d’une équipée').toEqual(['Bâton de combat', 'reussite']);
    const gestes = baton.elements.filter((e): e is Bouton | Choix => e.type === 'bouton' || e.type === 'liste');
    expect(gestes.map((g) => [g.id, g.libelle]), 'une arme se tient dans une main du set actif, se range dans un sac où elle tient, se donne à un héros à ses côtés')
      .toEqual([['main', 'Main principale'], ['off', 'Main secondaire'], ['ranger', 'Ranger dans'], ['donner', 'Donner à']]);
    expect((gestes.find((g) => g.id === 'main') as Bouton | undefined)?.presse, 'la main qui la tient pressée').toBe(true);
    expect(gestes.every((g) => g.refus === 'En combat, l’équipement se gère depuis la barre d’action.'), 'en combat, chacun refusé, sa raison dite').toBe(true);

    const avance = drainer(appel, appel('jouer', debut.vue.zones['fenetre.gestes'].find((g): g is Bouton => g.type === 'bouton' && g.focus)!.jeu)).suite;
    expect(avance.vue.zones['fiche.gestes'].find((b) => b.presse)?.id, 'la fiche reste ouverte, à son onglet, quand la partie avance').toBe('onglet/possessions');

    s = suiteDe(appel('fiche', avance.vue.zones['fiche.gestes'].find((b) => b.id === 'fermer')!.jeu));
    expect([s.vue.zones['fiche.heros'], s.vue.zones['fiche.gestes'], s.vue.zones['fiche.corps'], s.vue.zones['fiche.objet']], 'fermée, ses zones se vident').toEqual([[], [], [], []]);
    s = suiteDe(appel('fiche', s.vue.zones['groupe.heros'][1].jeu));
    expect((s.vue.zones['fiche.heros'][0] as Entite).nom, 'le bouton d’un autre héros ouvre sa fiche, à l’onglet de la dernière').toBe('Berta');
    s = suiteDe(appel('fiche', s.vue.zones['groupe.heros'][1].jeu));
    expect(s.vue.zones['fiche.heros'], 'son bouton pressé la ferme').toEqual([]);
  });

  it('refuse un héros hors du groupe, un onglet inconnu, et une possession hors de l’onglet des possessions ou de la fiche', () => {
    const a = appel;
    const s = suiteDe(a('fiche', { fiche: { heros: 'sorciere', onglet: 'possessions' } }));
    expect(erreurDe(a('fiche', { fiche: { heros: 'personne', onglet: 'talents' } })), 'le refus nomme les héros du groupe').toMatchObject({ categorie: 'validation', message: expect.stringContaining('(sorciere, protegee)') });
    expect(erreurDe(a('fiche', { fiche: { heros: 'sorciere', onglet: 'grimoire' } })).categorie).toBe('validation');
    expect(erreurDe(a('fiche', {})).categorie).toBe('validation');
    const objet = (s.vue.zones['fiche.corps'] as Bouton[])[0];
    expect(erreurDe(a('fiche', { fiche: { heros: 'sorciere', onglet: 'possessions', objet: 'personne' } })), 'le refus nomme les possessions de la fiche')
      .toMatchObject({ categorie: 'validation', message: expect.stringContaining((objet.jeu as { fiche: { objet: string } }).fiche.objet) });
    expect(erreurDe(a('fiche', { fiche: { heros: 'sorciere', onglet: 'talents', objet: (objet.jeu as { fiche: { objet: string } }).fiche.objet } })).categorie, 'une possession hors de son onglet').toBe('validation');
  });
});
