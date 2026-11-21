/**
 * LE COMPENDIUM PAR LE PONT (#4020, section « Compendium ») : `compendium` s'ouvre sur une entrée, rend ses zones, la
 * fiche entière où chaque référence se suit d'un bouton, joue les boutons et les formulaires que ses zones offrent et
 * refuse les autres ; « Enregistrer » joue la transaction et rend le texte à écrire au dépôt, son empreinte d'avant
 * avec lui, puis tient l'atelier fermé à l'issue réussie de l'écriture ; une entrée désignée ne se supprime pas.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { erreurDe, table, type Reponse } from './pont.testkit';
import type { Bouton, Choix, Entite, Formulaire } from '../../../src/hote/elements';
import type { ZonesDuCompendium } from '../../../src/hote/compendium';
import { datasetArray, datasetObject, resetData, setDataset } from '../../../src/data/overrides';
import { hash32 } from '../../../src/lib/hash';
import { rangee } from '../../../src/data/schemas/defs/mutationTables';
import { traitCapabilitiesSchema } from '../../../src/data/schemas/defs/traits';
import { validateDataset } from '../../../src/data/schemas/validate';
import { categoryByKey } from '../../../src/noyau/index';

/** Le libellé de fiche de l'entrée `id` de la catégorie `categorie`. */
const libelleDe = (categorie: string, id: string): string => categoryByKey(categorie)!.items.find((i) => i.id === id)!.label;

afterEach(() => resetData());

const zonesDe = (r: Reponse): ZonesDuCompendium => {
  expect(r.ok, JSON.stringify(r).slice(0, 400)).toBe(true);
  return (r as unknown as { zones: ZonesDuCompendium }).zones;
};

/** Le premier niveau de carrière, et le premier talent qu'il accorde. */
const NIVEAU = datasetArray('careerLevels')[0];
const TALENT = NIVEAU.talents.flatMap((r) => ('id' in r ? [r.id] : []))[0];

/** Le bouton d'id `id` des zones `zones`, parmi les boutons à plat, les valeurs des choix et les éléments des entités. */
function boutonDe(zones: ZonesDuCompendium, id: string): Bouton {
  const tous = Object.values(zones).flat().flatMap((e: Bouton | Choix | Entite | Formulaire | { type: string }) =>
    e.type === 'bouton' ? [e as Bouton] : e.type === 'choix' || e.type === 'liste' ? (e as Choix).valeurs : e.type === 'entite' ? (e as Entite).elements.filter((x): x is Bouton => x.type === 'bouton') : []);
  const b = tous.find((x) => x.id === id);
  expect(b, `bouton ${id}`).toBeDefined();
  return b!;
}

describe('compendium', () => {
  it('s’ouvre sur une entrée, sa fiche entière, chaque référence un bouton qui la suit ; avant l’ouverture, tout est refusé', () => {
    const { appel } = table();
    expect(erreurDe(appel('compendium', { compendium: { geste: 'modifier' } })).message).toBe('compendium : aucun Compendium ouvert, compendium { ouvrir } d’abord');
    const zones = zonesDe(appel('compendium', { ouvrir: true, categorie: 'careerLevels', id: NIVEAU.id }));
    expect(zones['compendium.fiche'][0].nom).toBe(libelleDe('careerLevels', NIVEAU.id));
    const suivre = Object.values(zones['compendium.fiche']).flatMap((e) => e.elements).find((x): x is Bouton => x.type === 'bouton' && JSON.stringify(x.jeu).includes(`"id":"${TALENT}"`))!;
    const talent = zonesDe(appel('compendium', suivre.jeu));
    expect(talent['compendium.fiche'][0].nom).toBe(libelleDe('talents', TALENT));
    expect(erreurDe(appel('compendium', { compendium: { geste: 'montrer', id: 'nulle-part' } })).categorie).toBe('validation');
  });

  it('une Compétence montre ses Races et ses Carrières par rang dans les deux séries de sections, à jour dès la première relecture après édition', async () => {
    const { idDe, ref } = await import('../../../src/data/schemas/grammaire/ref');
    const source = { book: 'codex-test-livre-renvois', page: 1 };
    const desc = 'Entrée de recette du pont.';
    setDataset('books', [...datasetArray('books'), { id: source.book, label: 'Livre de test', type: 'books', abbr: 'CTR', language: null, folder: null }]);
    const competence = {
      id: 'codex-test-competence-renvois', label: 'Cartographie des brumes', type: 'skills' as const,
      characteristic: 'intelligence' as const, acces: 'base' as const, source, desc,
    };
    setDataset('skills', [...datasetArray('skills'), competence]);
    const classe = { id: 'codex-test-classe-renvois', label: 'Explorateurs des brumes', type: 'classes' as const, trappings: [], source, desc };
    setDataset('classes', [...datasetArray('classes'), classe]);
    const carriere = {
      id: 'codex-test-carriere-renvois', label: 'Traceur des brumes', type: 'careers' as const,
      class: ref('classe').parse({ id: classe.id }), source, desc,
    };
    setDataset('careers', [...datasetArray('careers'), carriere]);
    const referenceDeCarriere = ref('career').parse({ id: carriere.id });
    const marques = [['capacite-de-combat', 'capacite-de-tir', 'force'], ['endurance'], ['initiative'], ['agilite']] as const;
    const niveaux = marques.map((characteristics, index) => {
      const level = index + 1;
      return {
        id: `${carriere.id}-${level}`, label: `Traceur au rang ${level}`, type: 'careerLevels' as const,
        career: referenceDeCarriere, level, characteristics: [...characteristics],
        skills: level === 1 || level === 4 ? [{ id: competence.id }] : [], talents: [], trappings: [],
        status: { tier: 'bronze' as const, standing: 1 }, source,
      };
    });
    setDataset('careerLevels', [...datasetArray('careerLevels'), ...niveaux]);
    const colonne = {
      id: 'codex-test-colonne-renvois', label: 'Colonne de test', type: 'carrieres-aleatoires' as const, kind: 'colonne' as const,
      die: { n: 1, sides: 10 }, entries: [{ ...referenceDeCarriere, min: 1, max: 10 }], source,
    };
    setDataset('carrieresAleatoires', [...datasetArray('carrieresAleatoires'), colonne]);
    const baseDEspece = {
      type: 'species' as const, family: 'Peuples des brumes', refChar: 'humain' as const,
      refCareer: idDe('carrieresAleatoires', 'colonne').parse(colonne.id),
      movement: 3, fate: { fate: 1, resilience: 1, extra: 1 },
      baseChar: {
        'capacite-de-combat': 20, 'capacite-de-tir': 20, force: 20, endurance: 20, initiative: 20,
        agilite: 20, dexterite: 20, intelligence: 20, 'force-mentale': 20, sociabilite: 20,
      },
      skills: [{ id: competence.id }], talents: [], grantGroups: [], source,
    };
    const zephyrs = { ...baseDEspece, id: 'codex-test-espece-zephyrs', label: 'Zéphyrs des brumes' };
    const alizes = { ...baseDEspece, id: 'codex-test-espece-alizes', label: 'Alizés des brumes' };
    setDataset('species', [...datasetArray('species'), zephyrs, alizes]);

    const { appel } = table();
    const ouvert = zonesDe(appel('compendium', { ouvrir: true, categorie: 'skills', id: competence.id }));
    expect(ouvert['compendium.fiche'][0].nom).toBe(competence.label);
    const ids = ['section/0/0', 'section/1/0', 'renvoi/races', 'renvoi/careers'];
    const sections = (zones: ZonesDuCompendium) => zones['compendium.fiche'].filter((e) => ids.includes(e.id));
    const attendues = [
      ['section/0/0', 'Races'],
      ['section/1/0', 'Carrières (par rang)'],
      ['renvoi/races', 'Races'],
      ['renvoi/careers', 'Carrières (par rang)'],
    ];
    const [races, carrieres, renvoiRaces, renvoiCarrieres] = sections(ouvert);
    expect(sections(ouvert).map(({ id, nom }) => [id, nom])).toEqual(attendues);
    const liens = (section: Entite) => section.elements
      .filter((e): e is Bouton => e.type === 'bouton')
      .map(({ libelle, jeu }) => ({ libelle, jeu }));
    const lien = (categorie: string, id: string, libelle: string) => ({ libelle, jeu: { compendium: { geste: 'suivre', categorie, id } } });
    expect(liens(races)).toEqual([lien('races', alizes.id, alizes.label), lien('races', zephyrs.id, zephyrs.label)]);
    expect(liens(renvoiRaces)).toEqual(liens(races));
    expect(liens(carrieres)).toEqual([lien('careers', carriere.id, `${carriere.label} (N1, N4)`)]);
    expect(liens(renvoiCarrieres)).toEqual(liens(carrieres));
    const suivie = zonesDe(appel('compendium', boutonDe(ouvert, `careers/${carriere.id}`).jeu));
    expect(suivie['compendium.fiche'][0].nom).toBe(carriere.label);

    const ficheDuNiveau = zonesDe(appel('compendium', { ouvrir: true, categorie: 'careerLevels', id: niveaux[0].id }));
    const atelier = zonesDe(appel('compendium', boutonDe(ficheDuNiveau, 'modifier').jeu));
    const modifie = zonesDe(appel('compendium', boutonDe(atelier, 'valeur/skills/0/retirer').jeu));
    const enregistre = appel('compendium', boutonDe(modifie, 'enregistrer').jeu);
    expect(enregistre).toMatchObject({ ok: true, donnees: { fichier: 'careerLevels.json' } });
    const ferme = zonesDe(appel('compendium', { compendium: { geste: 'enregistrement', reussi: true } }));
    const famille = zonesDe(appel('compendium', boutonDe(ferme, 'competences').jeu));
    const competences = zonesDe(appel('compendium', boutonDe(famille, 'skills').jeu));
    const relu = zonesDe(appel('compendium', boutonDe(competences, competence.id).jeu));
    const relues = sections(relu);
    expect(relues.map(({ id, nom }) => [id, nom])).toEqual(attendues);
    const [, carrieresRelues, , renvoiCarrieresRelues] = relues;
    for (const section of [carrieresRelues, renvoiCarrieresRelues]) {
      expect(liens(section)).toEqual([lien('careers', carriere.id, `${carriere.label} (N4)`)]);
    }
  });

  it('la liste de bataille de masse ouvre la baliste ADE II dans l’atelier du catalogue d’engins', () => {
    const { appel } = table();
    const bataille = zonesDe(appel('compendium', { ouvrir: true, categorie: 'massBattleWarMachines', id: 'mass-battle' }));
    expect(bataille['compendium.atelier']).toEqual([]);
    const baliste = boutonDe(bataille, '0/0/0');
    expect(baliste.jeu).toEqual({ compendium: { geste: 'suivre', categorie: 'siegeEngines', id: 'baliste-ade2' } });
    const ade = zonesDe(appel('compendium', baliste.jeu));
    expect(ade['compendium.fiche'][0].nom).toBe('Baliste (ADE II)');
    expect(ade['compendium.fiche'].find((e) => e.id === 'prose')?.elements).toContainEqual(
      expect.objectContaining({ id: 'texte', texte: expect.stringContaining('similaire à une arbalète') }),
    );

    const aa = zonesDe(appel('compendium', { ouvrir: true, categorie: 'siegeEngines', id: 'baliste' }));
    expect(aa['compendium.fiche'][0].nom).toBe('Baliste (AA)');
    expect(aa['compendium.fiche'].find((e) => e.id === 'prose')?.elements).toContainEqual(
      expect.objectContaining({ id: 'texte', texte: expect.stringContaining('arbalètes géantes') }),
    );
    const atelier = zonesDe(appel('compendium', boutonDe(aa, 'modifier').jeu));
    expect(atelier['compendium.atelier'].map((e) => e.id)).toContain('valeur/label');
  });

  it('modifier, écrire une valeur, enregistrer : le texte à écrire et l’empreinte d’avant ; l’issue réussie ferme l’atelier', () => {
    const { appel } = table();
    const ouvert = zonesDe(appel('compendium', { ouvrir: true, categorie: 'talents', id: TALENT }));
    const atelier = zonesDe(appel('compendium', boutonDe(ouvert, 'modifier').jeu));
    const libelle = atelier['compendium.atelier'].find((e): e is Formulaire => e.type === 'formulaire' && e.id === 'valeur/label')!;
    const [porteur, chemin] = libelle.champs.map((c) => (c.type === 'fixe' ? c.valeur : undefined));
    const ecrit = zonesDe(appel('compendium', { type: 'valeur', args: [porteur, chemin, 'Libellé édité'] }));
    const avant = readFileSync('src/data/talents.json', 'utf8');
    const r = appel('compendium', boutonDe(ecrit, 'enregistrer').jeu) as unknown as { donnees: { fichier: string; texte: string; avant: number } };
    expect([r.donnees.fichier, r.donnees.avant, r.donnees.texte.includes('Libellé édité')]).toEqual(['talents.json', hash32(avant), true]);
    const fermee = zonesDe(appel('compendium', { compendium: { geste: 'enregistrement', reussi: true } }));
    expect(fermee['compendium.atelier'].map((e) => e.id)).toEqual(['modifier', 'creer']);
    expect(fermee['compendium.fiche'][0].nom).toBe('Libellé édité');
    expect(erreurDe(appel('compendium', { compendium: { geste: 'enregistrement', reussi: true } })).message).toBe('compendium : aucun enregistrement ni suppression en cours');
  });

  it('choisit la mutation d’une rangée par son libellé et exporte son id avec ses bornes', () => {
    const mutations = [
      { id: 'mutation-3915-originale', label: 'Mutation originale' },
      { id: 'mutation-3915-choisie', label: 'Mutation choisie' },
    ].map((m) => ({ ...m, type: 'mutations' as const, maison: 'Mutation de test', desc: 'Mutation de test.', kind: 'physique' as const }));
    setDataset('mutations', [...datasetArray('mutations'), ...mutations]);
    const bornes = { min: 1, max: 6 };
    const originale = { id: mutations[0].id, ...bornes };
    const document = {
      id: 'table-de-corruption-3915',
      type: 'mutationTables' as const,
      label: 'Table de test',
      maison: 'Table de test',
      die: { n: 1, sides: 6 },
      entries: [rangee.parse(originale)],
    };
    setDataset('mutationTables', [...datasetArray('mutationTables'), document]);

    const { appel } = table();
    const ouvert = zonesDe(appel('compendium', { ouvrir: true, categorie: 'mutationTables', id: document.id }));
    const atelier = zonesDe(appel('compendium', boutonDe(ouvert, 'modifier').jeu));
    const mutation = boutonDe(atelier, `valeur/entries/0/id/${JSON.stringify(mutations[1].id)}`);
    expect(mutation.libelle).toBe(mutations[1].label);
    const ecrit = zonesDe(appel('compendium', mutation.jeu));
    const enregistre = appel('compendium', boutonDe(ecrit, 'enregistrer').jeu) as unknown as { donnees: { fichier: string; texte: string } };
    const exportees = JSON.parse(enregistre.donnees.texte);
    expect(enregistre.donnees.fichier).toBe('mutationTables.json');
    expect(validateDataset(enregistre.donnees.fichier, exportees)).toBeNull();
    expect(exportees.find((e: { id: string }) => e.id === document.id)).toEqual({
      ...document,
      entries: [{ id: mutations[1].id, ...bornes }],
    });
  });

  it('offre les psychologies qualifiées d’un Trait, enregistre le choix et peut le vider', () => {
    const source = { book: 'codex-test-livre-psychologie', page: 1 };
    setDataset('books', [...datasetArray('books'), { id: source.book, label: 'Livre de test', type: 'books', abbr: 'CTP', language: null, folder: null }]);
    const initiale = { id: 'codex-test-psychologie-initiale', label: 'Psychologie initiale', type: 'psychology' as const, desc: 'Psychologie de test.', source };
    const autre = { ...initiale, id: 'codex-test-psychologie-remplacement', label: 'Psychologie de remplacement' };
    const exclue = { ...initiale, id: 'codex-test-psychologie-exclue', label: 'Immunité de test', psychImmune: true };
    setDataset('psychologies', [...datasetArray('psychologies'), initiale, autre, exclue]);
    const porteur = {
      id: 'codex-test-trait-psychologique', label: 'Trait de test', type: 'traits' as const, desc: 'Trait de test.', source,
      capabilities: { psychType: traitCapabilitiesSchema.shape.psychType.parse(initiale.id) },
    };
    setDataset('traits', [...datasetArray('traits'), porteur]);
    const { appel } = table();
    const ouvrir = () => {
      const ouvert = zonesDe(appel('compendium', { ouvrir: true, categorie: 'traits', id: porteur.id }));
      return zonesDe(appel('compendium', boutonDe(ouvert, 'modifier').jeu));
    };
    const enregistrer = (zones: ZonesDuCompendium) => {
      const r = appel('compendium', boutonDe(zones, 'enregistrer').jeu) as unknown as { donnees: { fichier: string; texte: string } };
      expect(r.donnees.fichier).toBe('traits.json');
      const entrees = JSON.parse(r.donnees.texte) as typeof porteur[];
      expect(validateDataset(r.donnees.fichier, entrees)).toBeNull();
      const entree = entrees.find((e) => e.id === porteur.id);
      expect(entree).toBeDefined();
      return entree?.capabilities;
    };
    const atelier = ouvrir();
    const champ = 'valeur/capabilities/psychType';
    const choix = atelier['compendium.atelier'].find((e): e is Choix => (e.type === 'choix' || e.type === 'liste') && e.id === champ)!;
    const option = (id: string) => `${champ}/${JSON.stringify(id)}`;
    expect(choix.libelle).toBe('Type psychologique');
    expect(new Map(choix.valeurs.map((b) => [b.id, b.libelle]))).toEqual(new Map(
      datasetArray('psychologies').filter((e) => !e.psychImmune).map((e) => [option(e.id), e.label]),
    ));
    expect(boutonDe(atelier, option(initiale.id)).presse).toBe(true);
    expect(traitCapabilitiesSchema.shape.psychType.safeParse(exclue.id).success).toBe(false);
    expect(traitCapabilitiesSchema.shape.psychType.safeParse('psychologie-inexistante').success).toBe(false);

    const choisie = zonesDe(appel('compendium', boutonDe(atelier, option(autre.id)).jeu));
    expect(enregistrer(choisie)).toMatchObject({ psychType: autre.id });
    appel('compendium', { compendium: { geste: 'enregistrement', reussi: true } });
    const rouverte = ouvrir();
    expect(boutonDe(rouverte, option(autre.id)).presse).toBe(true);
    const retiree = zonesDe(appel('compendium', boutonDe(rouverte, `${champ}/aucune`).jeu));
    expect(enregistrer(retiree) ?? {}).not.toHaveProperty('psychType');
  });

  it('un nombre que le schéma veut entier se saisit au pas de 1 : la page d’une source', () => {
    const { appel } = table();
    const ouvert = zonesDe(appel('compendium', { ouvrir: true, categorie: 'talents', id: TALENT }));
    const atelier = zonesDe(appel('compendium', boutonDe(ouvert, 'modifier').jeu));
    const page = atelier['compendium.atelier'].find((e): e is Formulaire => e.type === 'formulaire' && e.id === 'valeur/source/page')!;
    expect(page.champs.find((c) => c.type === 'saisieNombre')).toMatchObject({ pas: 1 });
  });

  it('une écriture au dépôt refusée remet la donnée en mémoire telle qu’avant, et l’atelier reste ouvert', () => {
    const { appel } = table();
    const ouvert = zonesDe(appel('compendium', { ouvrir: true, categorie: 'talents', id: TALENT }));
    const atelier = zonesDe(appel('compendium', boutonDe(ouvert, 'modifier').jeu));
    const libelle = atelier['compendium.atelier'].find((e): e is Formulaire => e.type === 'formulaire' && e.id === 'valeur/label')!;
    zonesDe(appel('compendium', { type: 'valeur', args: [...libelle.champs.slice(0, 2).map((c) => (c.type === 'fixe' ? c.valeur : undefined)), 'Libellé refusé'] }));
    const avant = datasetArray('talents').find((t) => t.id === TALENT)!.label;
    const r = appel('compendium', { compendium: { geste: 'enregistrer' } }) as unknown as { donnees: { texte: string } };
    expect(r.donnees.texte.includes('Libellé refusé')).toBe(true);
    const refusee = zonesDe(appel('compendium', { compendium: { geste: 'enregistrement', reussi: false, refus: 'disque changé' } }));
    expect([datasetArray('talents').find((t) => t.id === TALENT)!.label, refusee['compendium.etat'][0].texte]).toEqual([avant, 'disque changé']);
    const encore = appel('compendium', { compendium: { geste: 'enregistrer' } }) as unknown as { donnees: { avant: number } };
    expect(encore.donnees.avant).toBe(hash32(readFileSync('src/data/talents.json', 'utf8')));
  });

  it('l’identifiant d’un élément de liste à clé se change à son formulaire, son chemin fixé ; une clé que le moteur fige n’en a pas', () => {
    const { appel } = table();
    appel('compendium', { ouvrir: true });
    for (const g of [{ geste: 'famille', famille: categoryByKey('seaPerils')!.group }, { geste: 'categorie', categorie: 'seaPerils' }]) appel('compendium', { compendium: g });
    const atelier = zonesDe(appel('compendium', { compendium: { geste: 'modifier' } }))['compendium.atelier'];
    const rang = datasetObject('seaPerils').tourbillons.findIndex((t) => t.id === 'maelstrom-primordial');
    const formulaire = atelier.find((e): e is Formulaire => e.type === 'formulaire' && e.id === `identifier/tourbillons/${rang}`)!;
    expect(formulaire.champs.map((c) => [c.type, c.type === 'fixe' ? c.valeur : null])).toEqual([['fixe', ['tourbillons', rang]], ['saisieTexte', null]]);
    const renomme = zonesDe(appel('compendium', { type: 'identifier', args: [['tourbillons', rang], 'maelstrom-ultime'] }))['compendium.atelier'];
    expect(renomme.find((e): e is Formulaire => e.type === 'formulaire' && e.id === `identifier/tourbillons/${rang}`)!.champs[1]).toMatchObject({ valeur: 'maelstrom-ultime' });
    expect(erreurDe(appel('compendium', { type: 'identifier', args: [['tourbillons', 99], 'x'] })).categorie, 'un chemin qu’aucun formulaire ne fixe').toBe('validation');
    appel('compendium', { compendium: { geste: 'abandonner' } });
    for (const g of [{ geste: 'famille', famille: categoryByKey('riverNavigation')!.group }, { geste: 'categorie', categorie: 'riverNavigation' }]) appel('compendium', { compendium: g });
    const fleuve = zonesDe(appel('compendium', { compendium: { geste: 'modifier' } }))['compendium.atelier'];
    expect(fleuve.some((e) => e.id.startsWith('identifier/windForces/')), 'une force de vent se renomme (#1692)').toBe(true);
    expect(fleuve.some((e) => e.id.startsWith('identifier/windDirections/')), 'une direction est fixée par le schéma').toBe(false);
  });

  it('le dé de la table s’écrit par deux saisies de nombre entier de 1, enregistré avec l’entrée ; zéro dé refusé (#4056)', () => {
    const { appel } = table();
    const [rangee] = datasetArray('drunkenness');
    const atelier = zonesDe(appel('compendium', boutonDe(zonesDe(appel('compendium', { ouvrir: true, categorie: 'drunkenness', id: rangee.id })), 'modifier').jeu));
    const de = atelier['compendium.atelier'].find((e): e is Formulaire => e.type === 'formulaire' && e.id === 'enTete')!;
    expect(de.champs.map((c) => [c.type, c.nom, 'min' in c ? c.min : null, 'pas' in c ? c.pas : null, 'valeur' in c ? c.valeur : null])).toEqual([['saisieNombre', 'n', 1, 1, 1], ['saisieNombre', 'sides', 1, 1, 10]]);
    expect(erreurDe(appel('compendium', { type: 'enTete', args: [0, 10] }))).toMatchObject({ categorie: 'regle', message: 'Trop petit : nombre doit être >=1' });
    expect(erreurDe(appel('compendium', { type: 'enTete', args: ['2d10'] })).categorie).toBe('validation');
    const ecrit = zonesDe(appel('compendium', { type: 'enTete', args: [2, 10] }));
    const r = appel('compendium', boutonDe(ecrit, 'enregistrer').jeu) as unknown as { donnees: { fichier: string; texte: string } };
    expect(JSON.parse(r.donnees.texte).die).toEqual({ n: 2, sides: 10 });
  });

  it('supprimer une entrée désignée est refusé en règle, sa raison dite', () => {
    const { appel } = table();
    appel('compendium', { ouvrir: true, categorie: 'talents', id: TALENT });
    const atelier = zonesDe(appel('compendium', { compendium: { geste: 'modifier' } }));
    const supprimer = boutonDe(atelier, 'supprimer');
    expect(supprimer.refus).toMatch(/^D’autres données désignent cette entrée/);
    expect(erreurDe(appel('compendium', supprimer.jeu))).toEqual({ categorie: 'regle', message: supprimer.refus });
  });

  it('un geste de liste ne porte que l’élément à son rang : le plus gros jeu de l’atelier d’une table de noms, l’élément le plus gros d’une de ses listes et son enveloppe (#4020)', () => {
    const { appel } = table();
    const [entree] = datasetArray('names');
    const atelier = zonesDe(appel('compendium', boutonDe(zonesDe(appel('compendium', { ouvrir: true, categorie: 'names', id: entree.id })), 'modifier').jeu))['compendium.atelier'];
    const jeux = atelier.flatMap((e) => (e.type === 'bouton' ? [e.jeu] : e.type === 'choix' || e.type === 'liste' ? e.valeurs.map((v) => v.jeu) : []));
    const valeurDe = (jeu: unknown): unknown => {
      const j = jeu as { compendium?: { valeur?: unknown }; args?: unknown[] };
      return j.compendium ? j.compendium.valeur : j.args?.[2];
    };
    const taille = (v: unknown): number => (v === undefined ? 0 : JSON.stringify(v).length);
    const elements = Object.values(entree).flatMap((v) => (Array.isArray(v) ? v.map(taille) : []));
    const enveloppe = Math.max(...jeux.map((j) => taille(j) - taille(valeurDe(j))));
    expect(Math.max(...elements), 'l’entrée porte des listes').toBeGreaterThan(0);
    expect(Math.max(...jeux.map(taille))).toBeLessThanOrEqual(Math.max(...elements) + enveloppe);
  });

  it('un record à clé ouverte s’édite par gestes : une clé ajoutée par son formulaire, sa valeur écrite, une clé retirée au-delà du minimum', () => {
    const { appel } = table();
    const atelier = zonesDe(appel('compendium', boutonDe(zonesDe(appel('compendium', { ouvrir: true, categorie: 'terrains', id: 'bois' })), 'modifier').jeu));
    const formulaire = (zones: ZonesDuCompendium, id: string) => zones['compendium.atelier'].find((e): e is Formulaire => e.type === 'formulaire' && e.id === id);
    const fixes = (f: Formulaire | undefined) => f!.champs.flatMap((c) => (c.type === 'fixe' ? [c.valeur] : []));
    const retirer = (zones: ZonesDuCompendium) => zones['compendium.atelier'].filter((e) => /^valeur\/stops\/[^/]+\/retirer$/.test(e.id)).length;
    expect(retirer(atelier), 'deux arrêts : aucun ne se retire').toBe(0);
    const ajoutee = zonesDe(appel('compendium', { type: 'valeur', args: [...fixes(formulaire(atelier, 'valeur/stops/ajouter')), '50%'] }));
    const ecrite = zonesDe(appel('compendium', { type: 'valeur', args: [...fixes(formulaire(ajoutee, 'valeur/stops/50%')), '#808080'] }));
    expect(retirer(ecrite), 'trois arrêts : chacun se retire').toBe(3);
    expect(erreurDe(appel('compendium', { type: 'valeur', args: [...fixes(formulaire(ecrite, 'valeur/stops/ajouter')), 'milieu'] })).categorie, 'une clé que le record n’admet pas').toBe('regle');
    const retiree = zonesDe(appel('compendium', boutonDe(ecrite, 'valeur/stops/100%/retirer').jeu));
    const r = appel('compendium', boutonDe(retiree, 'enregistrer').jeu) as unknown as { donnees: { texte: string } };
    expect((JSON.parse(r.donnees.texte) as { id: string; stops: Record<string, string> }[]).find((t) => t.id === 'bois')!.stops).toEqual({ '0%': '#4d7a38', '50%': '#808080' });
  });

  it('la famille du kit d’escalier d’un terrain bâti se choisit parmi celles de son énumération, puis s’enregistre (#4471)', () => {
    const { appel } = table();
    const atelier = zonesDe(appel('compendium', boutonDe(zonesDe(appel('compendium', { ouvrir: true, categorie: 'terrains', id: 'plancher' })), 'modifier').jeu));
    const familles = atelier['compendium.atelier'].find((e): e is Choix => e.type === 'choix' && e.id === 'valeur/kitDEscalier');
    expect(familles?.valeurs.map((v) => [v.libelle, v.presse])).toEqual([['Bois', true], ['Pierre', false]]);
    const ecrite = zonesDe(appel('compendium', familles!.valeurs.find((v) => v.libelle === 'Pierre')!.jeu));
    const r = appel('compendium', boutonDe(ecrite, 'enregistrer').jeu) as unknown as { donnees: { fichier: string; texte: string } };
    expect(r.donnees.fichier).toBe('terrains.json');
    expect((JSON.parse(r.donnees.texte) as { id: string; kitDEscalier?: string }[]).find((t) => t.id === 'plancher')!.kitDEscalier).toBe('pierre');
  });
});
