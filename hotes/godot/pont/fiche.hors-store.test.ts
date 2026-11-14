/**
 * LA FICHE D'UN COMBATTANT PAR LE PONT (#3328, #3678) : la fiche se montre en statbloc, comme l'Atelier des PNJ
 * (PR #3633) : la tête de son porteur (son nom, son espèce et sa carrière, ses Blessures, ses Points s'il en a, ses
 * États), son profil (Mouvement, Caractéristiques, Blessures), une section en bandeau par partie non vide (Attaques,
 * Armure, Traits, Mutations, Compétences, Talents, Sorts, Prières, Possessions), chaque terme sa description au
 * survol, puis la source de son profil. Chaque héros du groupe est un bouton qui ouvre la sienne ; tout combattant en
 * combat a la sienne. Une possession s'y choisit et dit ses gestes ; elle s'ouvre et se ferme sans toucher la partie.
 */
import { describe, it, expect } from 'vitest';
import { drainer, erreurDe, ficheDuHeros, sectionDeLaFiche, suiteDe, table, enFocus } from './pont.testkit';
import type { Suite } from './pont';
import type { Bouton, Choix, Entite, Puce } from '../../../src/hote/elements';
import { findCreatureById, findSpellById, findTalentById, findTraitById, sourceRefLabel } from '../../../src/data';

const { appel } = table();

/** La description d'une entrée du catalogue ; son absence fait échouer le test. */
const descDe = (entree: { id: string; desc?: string } | undefined): string => {
  if (entree?.desc === undefined) throw new Error(`entrée sans description : ${entree?.id ?? 'introuvable'}`);
  return entree.desc;
};

/** Les puces de la section `id` de la fiche ouverte. */
const puces = (s: Suite, id: string): Puce[] => sectionDeLaFiche(s.vue, id) as Puce[];
/** Les armes de la section Attaques d'une suite, chacune une entité. */
const armes = (s: Suite): Entite[] => sectionDeLaFiche(s.vue, 'attaques') as Entite[];

/** Les zones de la fiche d'une suite. */
const zonesDeLaFiche = (s: Suite) => (['fiche.porteur', 'fiche.gestes', 'fiche.profil', 'fiche.sections', 'fiche.source', 'fiche.objet'] as const).map((z) => s.vue.zones[z]);

describe('la fiche d’un combattant par le pont', () => {
  it('ouverte par le bouton d’un héros : sa tête, son profil, ses sections, une possession choisie, puis fermée', () => {
    const { suite: debut } = drainer(appel, appel('demarrer', { scenario: 'dome', graine: 7 }));
    const groupe = debut.vue.zones['groupe.heros'];
    expect(groupe.map((c) => c.nom), 'chaque héros du groupe a sa carte, qui le nomme').toEqual(['Ilyanwe la Voilée', 'Berta']);
    expect([0, 1].some((i) => ficheDuHeros(debut.vue, i).presse), 'aucune fiche ouverte').toBe(false);
    expect(zonesDeLaFiche(debut), 'sans fiche, ses zones sont vides').toEqual([[], [], [], [], [], []]);

    let s = suiteDe(appel('fiche', ficheDuHeros(debut.vue, 0).jeu));
    expect(s.vue.projection.pas, 'ouvrir la fiche ne joue aucun geste de la partie').toBe(debut.vue.projection.pas);
    expect(ficheDuHeros(s.vue, 0).presse, 'le héros de la fiche ouverte est pressé').toBe(true);
    const [heros] = s.vue.zones['fiche.porteur'];
    expect(heros.nom).toBe('Ilyanwe la Voilée');
    expect(heros.elements.filter((e) => e.type === 'ligne').map((l) => [l.id, l.texte]), 'son espèce et sa carrière, chacune en ligne').toEqual([['espece', 'Hauts elfes'], ['carriere', 'Sorcière']]);
    const points = Object.fromEntries(heros.elements.filter((e): e is Puce => e.type === 'puce').map((p) => [p.libelle, p.valeur]));
    expect(points, 'ses Points de Destin, de Chance, de Résilience et de Détermination').toEqual({ Destin: '4', Chance: '4', 'Résilience': '3', 'Détermination': '3' });
    const pb = s.vue.projection.combat!.voisins.liste.find((c) => c.id === heros.id)!.pb;
    expect(heros.elements.find((e) => e.id === 'blessures'), 'ses Blessures en jauge').toMatchObject({ type: 'jauge', courant: pb[0], max: pb[1] });
    expect(s.vue.zones['fiche.gestes'].map((b) => b.libelle), 'sa fermeture').toEqual(['Fermer']);

    const profil = s.vue.zones['fiche.profil'];
    expect(profil.map((p) => p.libelle), 'son profil, une colonne par puce').toEqual(['M', 'CC', 'CT', 'F', 'E', 'I', 'Ag', 'Dex', 'Int', 'FM', 'Soc', 'B']);
    expect(profil.map((p) => p.detail), 'le nom de chaque colonne au survol')
      .toEqual(['Mouvement', 'Capacité de Combat', 'Capacité de Tir', 'Force', 'Endurance', 'Initiative', 'Agilité', 'Dextérité', 'Intelligence', 'Force Mentale', 'Sociabilité', 'Blessures']);
    expect(profil.every((p) => Number(p.valeur) > 0), 'chacune sa valeur').toBe(true);
    expect(profil[profil.length - 1].valeur, 'ses Blessures à leur maximum').toBe(String(pb[1]));

    expect(s.vue.zones['fiche.sections'].map((e) => e.nom), 'chaque section non vide, dans l’ordre du statbloc').toEqual(['Attaques', 'Compétences', 'Talents', 'Sorts', 'Possessions']);
    const competences = puces(s, 'competences');
    expect(competences.length, 'chacune de ses Compétences, une par spécialisation').toBe(18);
    expect(competences.map((p) => p.libelle), 'par nom').toEqual(competences.map((p) => p.libelle).sort((a, b) => a.localeCompare(b, 'fr')));
    expect(competences.every((p) => /^\d+$/.test(p.valeur!) && /^\S+ \d+ \+ \d+$/.test(p.detail!)), 'la valeur de son Test, sa Caractéristique et ses Augmentations au survol').toBe(true);
    const [baton] = armes(s);
    expect(baton.nom, 'une arme, une entité qui la nomme').toBe('Bâton de combat');
    const termes = baton.elements as Puce[];
    expect(termes[0], 'la valeur de son Test, celle de la Compétence qui l’emploie').toMatchObject({ id: 'test', libelle: 'Test', valeur: competences.find((p) => p.libelle === "Corps à corps (Armes d'hast)")!.valeur });
    expect(termes.slice(1).map((p) => p.libelle), 'ses Dégâts résolus, son Allonge, ses Atouts et Défauts, chacun en puce')
      .toEqual([expect.stringMatching(/^Dégâts \+BF\+\d+ \(\d+\)$/), expect.stringMatching(/^Allonge /), 'Assommante', 'Défensive']);
    const perspicace = puces(s, 'talents').find((p) => p.libelle === 'Perspicace');
    expect(perspicace?.detail, 'un Talent se nomme ; sa description au survol').toBe(descDe(findTalentById('perspicace')));
    const arcanes = puces(s, 'talents').find((p) => p.libelle === 'Magie des Arcanes (Feu)')!.detail!;
    expect(descDe(findTalentById('magie-des-arcanes')).startsWith(arcanes.replace(/…$/, '')), 'une description longue : son premier paragraphe, coupé au mot').toBe(true);
    expect(arcanes.length <= 300 && !arcanes.includes('\n'), 'qui se lit d’un coup d’œil').toBe(true);
    const flechette = puces(s, 'sorts').find((p) => p.libelle === 'Fléchette');
    expect(flechette?.detail, 'un sort se nomme ; sa description au survol').toBe(findSpellById('flechette')?.desc);
    expect(s.vue.zones['fiche.source'], 'un héros n’a pas de profil sourcé').toEqual([]);

    const possessions = sectionDeLaFiche(s.vue, 'possessions') as Bouton[];
    expect(possessions.every((b) => b.type === 'bouton' && !b.presse), 'chaque possession est un bouton ; aucune choisie').toBe(true);
    const batonPossede = possessions.find((b) => b.libelle === 'Bâton de combat')!;
    const libelles = possessions.map((b) => b.libelle);
    expect(libelles.indexOf('Bâton de combat'), 'les possessions équipées d’abord').toBeLessThan(libelles.indexOf('Parchemin ×7'));
    expect(possessions.map((b) => b.libelle), 'les possessions pareilles comptées ensemble').toContain('Parchemin ×7');
    expect(s.vue.zones['fiche.objet'], 'aucune possession choisie, rien n’en est dit').toEqual([]);
    s = suiteDe(appel('fiche', batonPossede.jeu));
    expect(s.vue.projection.pas, 'choisir une possession ne joue aucun geste de la partie').toBe(debut.vue.projection.pas);
    expect((sectionDeLaFiche(s.vue, 'possessions') as Bouton[]).filter((b) => b.presse).map((b) => b.libelle), 'la choisie est pressée').toEqual(['Bâton de combat']);
    const [objet] = s.vue.zones['fiche.objet'];
    expect([objet.nom, objet.ton], 'la possession choisie se nomme, au ton d’une équipée').toEqual(['Bâton de combat', 'reussite']);
    const gestes = objet.elements.filter((e): e is Bouton | Choix => e.type === 'bouton' || e.type === 'liste');
    expect(gestes.map((g) => [g.id, g.libelle]), 'une arme se tient dans une main du set actif, se range dans un sac où elle tient, se donne à un héros à ses côtés, se pose au sol')
      .toEqual([['main', 'Main principale'], ['secondaire', 'Main secondaire'], ['ranger', 'Ranger dans'], ['donner', 'Donner à'], ['poser', 'Poser au sol']]);
    expect((gestes.find((g) => g.id === 'main') as Bouton | undefined)?.presse, 'la main qui la tient pressée').toBe(true);
    expect(gestes.every((g) => g.refus === 'En combat, l’équipement se gère depuis la barre d’action.'), 'en combat, chacun refusé, sa raison dite').toBe(true);

    const avance = drainer(appel, appel('jouer', enFocus(debut.vue)!.jeu)).suite;
    expect(avance.vue.zones['fiche.objet'][0]?.nom, 'la fiche reste ouverte, sa possession choisie, quand la partie avance').toBe('Bâton de combat');

    s = suiteDe(appel('fiche', avance.vue.zones['fiche.gestes'].find((b) => b.id === 'fermer')!.jeu));
    expect(zonesDeLaFiche(s), 'fermée, ses zones se vident').toEqual([[], [], [], [], [], []]);
    s = suiteDe(appel('fiche', ficheDuHeros(s.vue, 1).jeu));
    expect(s.vue.zones['fiche.porteur'][0].nom, 'le bouton d’un autre héros ouvre sa fiche').toBe('Berta');
    s = suiteDe(appel('fiche', ficheDuHeros(s.vue, 1).jeu));
    expect(s.vue.zones['fiche.porteur'], 'son bouton pressé la ferme').toEqual([]);
  });

  it('la fiche d’un adversaire : sans Points, ses Attaques, son Armure, ses Traits, la source de son profil', () => {
    const s = suiteDe(appel('fiche', { fiche: { porteur: 'enemy-enc-dome-1' } }));
    const [orc] = s.vue.zones['fiche.porteur'];
    expect(orc.nom).toBe('Orc');
    expect(orc.elements.map((e) => e.id).filter((id) => ['espece', 'carriere', 'destin', 'chance', 'resilience', 'determination'].includes(id)), 'ni espèce, ni carrière, ni Points pour une créature').toEqual([]);
    expect([0, 1].some((i) => ficheDuHeros(s.vue, i).presse), 'aucun héros pressé').toBe(false);
    expect(s.vue.zones['fiche.sections'].map((e) => e.nom), 'chaque section non vide, dans l’ordre du statbloc').toEqual(['Attaques', 'Armure', 'Traits']);
    expect(armes(s).map((a) => [a.nom, ...(a.elements as Puce[]).map((p) => [p.libelle, p.valeur])]), 'une arme : la valeur de son Test, ses Dégâts résolus')
      .toEqual([['Arme', ['Test', '35'], ['Dégâts +8 (8)', null]]]);
    expect(puces(s, 'armure').map((p) => [p.libelle, p.valeur])[0], 'les PA de chaque localisation qui en porte').toEqual(['Tête', '3']);
    expect(puces(s, 'traits').find((p) => p.libelle === 'Belliqueux')?.detail, 'un Trait se nomme ; sa description au survol').toBe(descDe(findTraitById('belliqueux')));
    expect(s.vue.zones['fiche.source'].map((l) => l.texte), 'la source du profil dont il est l’instance').toEqual([`Profil : ${sourceRefLabel(findCreatureById('orc')!.source)}`]);
  });

  it('refuse un porteur inconnu, une possession hors de la fiche et une entrée hors de sa forme', () => {
    const s = suiteDe(appel('fiche', { fiche: { porteur: 'sorciere' } }));
    expect(erreurDe(appel('fiche', { fiche: { porteur: 'personne' } })), 'le refus nomme les combattants à fiche')
      .toMatchObject({ categorie: 'validation', message: expect.stringContaining('sorciere, protegee') });
    expect(erreurDe(appel('fiche', { fiche: { heros: 'sorciere' } })).categorie).toBe('validation');
    expect(erreurDe(appel('fiche', {})).categorie).toBe('validation');
    const objet = (sectionDeLaFiche(s.vue, 'possessions') as Bouton[])[0];
    expect(erreurDe(appel('fiche', { fiche: { porteur: 'sorciere', objet: 'personne' } })), 'le refus nomme les possessions de la fiche')
      .toMatchObject({ categorie: 'validation', message: expect.stringContaining((objet.jeu as { fiche: { objet: string } }).fiche.objet) });
  });
});
