/**
 * La session d'édition juge chaque lecture sous le catalogue qu'elle porte (#5070, plan
 * `docs/plans/2026-11-25-composition-d-un-jeu.md` § 5.1, point 2, et fossile 9) : la table d'écriture, la pose des
 * ponts d'`editer`, l'inspecteur de l'hôte, la fiche d'un personnage, les fiches que la palette et l'inspecteur offrent
 * et que l'outil pose, la fiche que le profil personnalisé copie et dont une option offre les notes, la validation et la
 * porte du projet. Fixtures : un navire à ponts présent SEULEMENT dans le catalogue de la suite
 * (`navireDuLivreDeTest`), le même navire posé au seam du processus et sans ponts sous un catalogue déclaré, un catalogue
 * privé de toute créature, où la fiche se juge par son absence, des créatures à Blessures déclarées par la suite, dont
 * l'une, à Trait de sorts, est posée au seam, et une espèce déclarée dont l'une est le profil standard.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  avertissementsDeLaSession,
  cadreDeLaSession,
  editer,
  essaiDeLaScene,
  ouvrirLEdition,
  projetDuDepot,
  refusDeLaValeur,
  sceneEditee,
  sessionSousLeCatalogue,
  texteAEnregistrer,
  type GesteDEdition,
  type SessionDEdition,
} from './session';
import { choixDuChamp, entiteDeLaSelection, fichesDePersonnage, type ProjetDEdition } from '../sceneEditLecture';
import { emptyNarratif } from '../monde/campaignNarratif';
import { buildScene } from '../mapSpec';
import type { Scene, SceneEntity } from '../monde/scene';
import { boutonDeLEdition, inspecteurDeLaSession, zonesDeLEditeur } from '../../hote/editeur';
import { t } from '../../i18n';
import { catalogueAvec } from '../../data/catalogueAvec.testkit';
import { catalogueDeTest, type LivreDeTest } from '../../data/schemas/catalogue/catalogueDeTest.testkit';
import { datasetArray, resetData, setDataset } from '../../data/overrides';
import type { Catalogue } from '../../data/schemas/catalogue/catalogue';
import { idDeFixture } from '../../data/idDeFixture.testkit';
import { NAVIRE, navire, navireDuLivreDeTest, vehiculeDuLivreDeTest } from '../navireDuLivreDeTest.testkit';

/** Le navire du seul catalogue de la suite, sur la base vivante, qui porte le terrain et les matières de la scène que
 *  juge la porte du projet. */
const CAT = catalogueAvec({ 'vehicles.json': [navireDuLivreDeTest()] });
const CHARRETTE = 'charrette-du-livre-de-test';
/** Le navire sans ses ponts, qu'aucun cap ne refuse, et un autre véhicule. */
const SANS_PONTS = catalogueDeTest({ 'vehicles.json': [vehiculeDuLivreDeTest(CHARRETTE), vehiculeDuLivreDeTest(NAVIRE)] });
/** Un catalogue qui ne porte aucune créature : aucune entité n'y a de fiche. */
const SANS_CREATURE = catalogueDeTest({});
afterEach(() => resetData());

const CAP_NE = `navire « ${NAVIRE} » au cap NE — un navire à ponts ne prend qu'un cap cardinal (N/E/S/O)`;
/** Une fiche de personnage déclarée par la suite : une créature à Blessures (`char.B`), inconnue du processus. */
const fiche = (id: string): NonNullable<LivreDeTest['creatures.json']>[number] => ({
  id, type: 'creatures', label: id, source: { book: 'LDB', page: 1 }, title: null, folder: null,
  char: { B: 10 }, traits: [], optionals: [], skills: [], talents: [], trappings: [], spells: [], appearance: { species: 'humain' },
});

/** Le bassin 24 × 24 à l'échelle du plan, aux entités `entites`. */
const bassin = (...entites: SceneEntity[]): Scene => ({ ...buildScene({ id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'eau', metresPerTile: 2 }), entities: entites });
/** Le projet du dépôt qui porte la seule scène `scene`. */
const projetDe = (scene: Scene) => ({ id: 'p', type: 'projet', label: 'P', versionContenu: 1, maison: 'catalogue', scenes: [scene], narratif: emptyNarratif() });
/** La session ouverte du dépôt sous `cat` (le catalogue du processus à défaut) sur la scène `scene`, son entité `id`
 *  sélectionnée. */
const ouverteSous = (cat: Catalogue | undefined, scene: Scene, id?: string): SessionDEdition => {
  const s = ouvrirLEdition(projetDe(scene) as ProjetDEdition, { duDepot: true }, cat);
  return id ? editer(s, { geste: 'selectionner', porteur: { sorte: 'entite', id } }) : s;
};
const valeur = (id: string, chemin: (string | number)[], v: unknown): Extract<GesteDEdition, { geste: 'valeur' }> => ({ geste: 'valeur', porteur: { sorte: 'entite', id }, chemin, valeur: v });
const entite = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), s.sel)!;
/** Les ids des éléments de l'inspecteur de l'hôte, et de leurs valeurs. */
const idsDeLInspecteur = (s: SessionDEdition) => inspecteurDeLaSession(s).flatMap((el) => [el.id, ...('valeurs' in el ? el.valeurs.map((v) => v.id) : [])]);

describe('la session écrit et pose un navire sous son catalogue', () => {
  it('la table d’écriture juge le véhicule écrit sous le catalogue de la session : le navire au cap NE, refusé sous le processus où il a ses ponts, s’écrit sous un catalogue où il n’en a pas', () => {
    setDataset('vehicles', [...datasetArray('vehicles'), vehiculeDuLivreDeTest(CHARRETTE), navireDuLivreDeTest()]);
    const charrette = navire('NE', { pos: { x: 12, y: 12 }, vehicule: { id: CHARRETTE } });
    const ecrireLeNavire = valeur('n', ['vehicule', 'id'], NAVIRE);
    const sansPonts = ouverteSous(SANS_PONTS, bassin(charrette), 'n');
    expect(refusDeLaValeur(sansPonts, ecrireLeNavire)).toBeNull();
    const ecrite = editer(sansPonts, ecrireLeNavire);
    expect(entite(ecrite).vehicule).toEqual({ id: NAVIRE });
    const duVehicule = avertissementsDeLaSession(ecrite).map((w) => w.message).filter((m) => m.includes(NAVIRE) || /véhicule|vehicles/.test(m));
    expect(duVehicule, 'la validation de la session ne dit rien du véhicule écrit').toEqual([]);
    const sousLeProcessus = ouverteSous(undefined, bassin(charrette), 'n');
    expect(refusDeLaValeur(sousLeProcessus, ecrireLeNavire)).toEqual({ regle: CAP_NE });
    expect(editer(sousLeProcessus, ecrireLeNavire)).toBe(sousLeProcessus);
  });

  it('`editer` refuse la pose de ponts qui déborde de la carte, sous le catalogue de la session seul à porter le navire', () => {
    const auBord = bassin(navire('N', { pos: { x: 6, y: 12 } }));
    const ouest = { geste: 'entite', patch: { facing: 'O' } } as const;
    const sous = ouverteSous(CAT, auBord, 'n');
    expect(editer(sous, ouest)).toBe(sous);
    const sousLeProcessus = ouverteSous(undefined, auBord, 'n');
    expect(entite(editer(sousLeProcessus, ouest)).facing, 'le navire inconnu du processus n’a pas de ponts').toBe('O');
  });

  it('l’inspecteur de l’hôte offre au navire du seul catalogue exactement les caps cardinaux', () => {
    const s = ouverteSous(CAT, bassin(navire('N', { pos: { x: 12, y: 12 } })), 'n');
    expect(idsDeLInspecteur(s).filter((i) => i.startsWith('entite/cap/'))).toEqual(['entite/cap/N', 'entite/cap/E', 'entite/cap/S', 'entite/cap/O']);
  });
});

describe('la fiche d’un personnage se juge sous le catalogue de la session (`ficheEditee`)', () => {
  const A_SORTS = 'fiche-a-sorts-de-la-suite';
  /** La fiche déclarée par la suite, à Trait de sorts, posée au seam du processus ; la base vivante porte la définition
   *  du Trait et ses sorts (`listesDeSorts`, `findTraitById`). */
  const poserLaFiche = () => setDataset('creatures', [...datasetArray('creatures'), { ...fiche(A_SORTS), traits: [{ id: 'miracles', arg: 'taal' }] }]);
  const porteur: SceneEntity = { id: 'o', kind: 'personnage', creature: { id: A_SORTS }, pos: { x: 1, y: 1 }, combat: {} };
  const sansCreature = () => ouverteSous(SANS_CREATURE, bassin(porteur), 'o');
  const sousLeProcessus = () => ouverteSous(undefined, bassin(porteur), 'o');

  it('l’inspecteur ne montre ni profil porté ni sorts sous un catalogue sans sa créature ; sous le processus, il les montre', () => {
    poserLaFiche();
    const ids = (s: SessionDEdition) => idsDeLInspecteur(s).filter((i) => i === 'profil/caracteristiques' || i === 'sorts/connus');
    expect(ids(sansCreature())).toEqual([]);
    expect(ids(sousLeProcessus())).toEqual(['profil/caracteristiques', 'sorts/connus']);
  });

  it('le formulaire n’offre ses sorts choisis, ni de sort à choisir, que si sa fiche se juge sous le catalogue de la session', () => {
    poserLaFiche();
    const offre = (s: SessionDEdition) => idsDeLInspecteur(s).includes('valeur/combat/spells/ajouter');
    const choix = (s: SessionDEdition) => choixDuChamp('entite', entite(s), ['combat', 'spells', 0], cadreDeLaSession(s))!.length;
    expect([offre(sansCreature()), choix(sansCreature())]).toEqual([false, 0]);
    expect(offre(sousLeProcessus())).toBe(true);
    expect(choix(sousLeProcessus())).toBeGreaterThan(0);
  });
});

describe('les fiches qu’un personnage nomme se lisent sous le catalogue de la session (`fichesDePersonnage`)', () => {
  const FICHE = 'fiche-de-la-suite';
  /** La seule fiche de personnage que la suite déclare (`fiche`). */
  const SOUS_LA_FICHE = catalogueAvec({ 'creatures.json': [fiche(FICHE)] });
  const posee: SceneEntity = { id: 'f', kind: 'personnage', creature: { id: FICHE }, pos: { x: 1, y: 1 } };
  /** Les ids des fiches de la palette de l'outil personnage. */
  const palette = (cat: Catalogue | undefined) => {
    const s = editer(ouverteSous(cat, bassin()), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: FICHE } });
    return zonesDeLEditeur(s)['editeur.options'].flatMap((el) => ('valeurs' in el ? el.valeurs.map((v) => v.id) : [])).filter((i) => i.startsWith('personnage/'));
  };
  const auChoixFiche = (cat: Catalogue | undefined) => idsDeLInspecteur(ouverteSous(cat, bassin(posee), 'f')).includes(`entite/type/${FICHE}`);

  it('la palette et le choix « Fiche » de l’inspecteur offrent la fiche du seul catalogue de la session ; sous le processus, ni l’un ni l’autre', () => {
    expect(palette(SOUS_LA_FICHE)).toContain(`personnage/${FICHE}`);
    expect(auChoixFiche(SOUS_LA_FICHE)).toBe(true);
    expect(palette(undefined)).not.toContain(`personnage/${FICHE}`);
    expect(auChoixFiche(undefined)).toBe(false);
  });

  it('l’outil Personnage pose la fiche du seul catalogue de la session, que la palette offre', () => {
    const point = { case: { x: 2, y: 2 }, f: { x: 2, y: 2 } };
    const enMain = editer(ouverteSous(SOUS_LA_FICHE, bassin()), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: FICHE } });
    const posee = editer(editer(enMain, { geste: 'appui', point }), { geste: 'relache', point });
    expect(sceneEditee(posee).entities.map((e) => e.creature)).toEqual([{ id: FICHE }]);
  });

  it('le profil personnalisé offre la copie de la fiche du seul catalogue de la session ; sous le processus, le profil neuf seul', () => {
    const profils = (cat: Catalogue | undefined) => {
      const s = ouverteSous(cat, bassin(posee), 'f');
      return choixDuChamp('entite', entite(s), ['statblock'], cadreDeLaSession(s))!.map((c) => c.libelle);
    };
    expect(profils(SOUS_LA_FICHE)).toEqual([t('ecran.editeur.profil.neuf'), t('ecran.editeur.profil.copie', { fiche: FICHE })]);
    expect(profils(undefined)).toEqual([t('ecran.editeur.profil.neuf')]);
  });

  it('une option offre les notes de la fiche du seul catalogue de la session ; sous le processus, la courante seule', () => {
    const note = { note: 'swap' as const, label: 'Note de la fiche de la suite', remove: [], grant: [{ characteristic: 'sociabilite' as const, value: 20 }] };
    const SOUS_LA_FICHE_A_NOTE = catalogueAvec({ 'creatures.json': [{ ...fiche(FICHE), optionals: [note] }] });
    const aLaNote: SceneEntity = { ...posee, combat: { optionals: [{ ...note, label: 'Note de la scène' }] } };
    const notes = (cat: Catalogue | undefined) => {
      const s = ouverteSous(cat, bassin(aLaNote), 'f');
      return choixDuChamp('entite', entite(s), ['combat', 'optionals', 0], cadreDeLaSession(s))!.map((c) => c.libelle).filter((l) => l.startsWith('Note '));
    };
    expect(notes(SOUS_LA_FICHE_A_NOTE)).toEqual(['Note de la fiche de la suite', 'Note de la scène']);
    expect(notes(undefined)).toEqual(['Note de la scène']);
  });
});

describe('l’outil personnage se lit sous le catalogue de la session (`fichesDePersonnage`)', () => {
  const ORDINAIRE = 'fiche-ordinaire-de-la-suite';
  const STANDARD = 'fiche-standard-de-la-suite';
  /** Une espèce déclarée par la suite, aux valeurs neutres, dont le profil standard (`LDB 77 l.7`) est `STANDARD`. */
  const espece: NonNullable<LivreDeTest['species.json']>[number] = {
    id: 'espece-de-la-suite', type: 'species', label: 'Espèce de la suite', source: { book: 'LDB', page: 1 },
    family: 'Suite', refChar: 'humain', refCareer: 'humain', movement: 4,
    fate: { fate: 0, resilience: 0, extra: 0 }, skills: [], talents: [], grantGroups: [],
    baseChar: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 0, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
    profilStandard: { id: idDeFixture('creature', STANDARD) },
  };
  const SOUS_DEUX_FICHES = catalogueDeTest({ 'creatures.json': [fiche(ORDINAIRE), fiche(STANDARD)], 'species.json': [espece] });
  const outilPersonnage = (s: SessionDEdition) =>
    zonesDeLEditeur(s)['editeur.outils'].flatMap((el) => ('valeurs' in el ? el.valeurs : [])).find((b) => b.id === 'outil/personnage');

  it('sous un catalogue sans fiche, le bouton Personnage est refusé, et son geste joué rend ce refus', () => {
    const s = ouverteSous(SANS_CREATURE, bassin());
    const bouton = outilPersonnage(s);
    expect(bouton?.refus).toBe(t('ecran.editeur.personnage.sansFiche'));
    expect(bouton?.jeu).toEqual({ edition: { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: null } } });
    expect(boutonDeLEdition(zonesDeLEditeur(s), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: null } })).toMatchObject({ id: 'outil/personnage', refus: bouton?.refus });
    const enMain = editer(s, { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: ORDINAIRE } });
    expect(outilPersonnage(enMain)?.refus, 'l’outil personnage déjà en main ne lève pas le refus').toBe(t('ecran.editeur.personnage.sansFiche'));
  });

  it('sous un catalogue qui porte une fiche, le bouton Personnage est offert, sa référence par défaut la première fiche', () => {
    const bouton = outilPersonnage(ouverteSous(catalogueDeTest({ 'creatures.json': [fiche(ORDINAIRE)] }), bassin()));
    expect(bouton?.refus).toBeNull();
    expect(bouton?.jeu).toEqual({ edition: { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: ORDINAIRE } } });
  });

  it('le profil standard d’une espèce du catalogue vient en tête des fiches, et de la référence par défaut', () => {
    expect(fichesDePersonnage(SOUS_DEUX_FICHES).map((c) => c.id)).toEqual([STANDARD, ORDINAIRE]);
    expect(outilPersonnage(ouverteSous(SOUS_DEUX_FICHES, bassin()))?.jeu).toEqual({ edition: { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: STANDARD } } });
  });
});

describe('la validation et la porte du projet se jugent sous le catalogue de la session', () => {
  const auNord = bassin(navire('N', { pos: { x: 12, y: 12 } }));
  const auNordEst = bassin(navire('NE', { pos: { x: 12, y: 12 } }));

  it('la validation dit le cap NE du navire du seul catalogue sous lui ; sous le processus, le navire est inconnu', () => {
    const messages = (s: SessionDEdition) => avertissementsDeLaSession(s).map((w) => w.message);
    expect(messages(ouverteSous(CAT, auNordEst))).toEqual([`entité « n » › orientation : ${CAP_NE}`]);
    expect(messages(ouverteSous(undefined, auNordEst))).toEqual([`entité « n » › coque › identifiant : « ${NAVIRE} » est absent du catalogue des véhicules (vehicles.json).`]);
  });

  it('l’ouverture du dépôt, l’enregistrement et l’essai passent la porte sous le catalogue reçu', () => {
    expect(projetDuDepot(projetDe(auNord), CAT).ok).toBe(true);
    expect(projetDuDepot(projetDe(auNord)).ok).toBe(false);
    const sous = ouverteSous(CAT, auNord);
    const sousLeProcessus = ouverteSous(undefined, auNord);
    expect([texteAEnregistrer(sous).ok, essaiDeLaScene(sous).ok]).toEqual([true, true]);
    expect([texteAEnregistrer(sousLeProcessus).ok, essaiDeLaScene(sousLeProcessus).ok]).toEqual([false, false]);
  });
});

describe('la session reposée sous un catalogue (`sessionSousLeCatalogue`, fossile 9)', () => {
  it('reposée sous son propre catalogue, elle reste la même ; sous un autre, elle juge le geste suivant et sa validation sous lui', () => {
    const s = ouverteSous(undefined, bassin(navire('N', { pos: { x: 6, y: 12 } })), 'n');
    expect(sessionSousLeCatalogue(s, s.catalogue)).toBe(s);
    expect(sessionSousLeCatalogue(s)).toBe(s);
    const reposee = sessionSousLeCatalogue(s, CAT);
    const ouest = { geste: 'entite', patch: { facing: 'O' } } as const;
    expect(entite(editer(s, ouest)).facing).toBe('O');
    expect(editer(reposee, ouest)).toBe(reposee);

    const deBiais = ouverteSous(undefined, bassin(navire('NE', { pos: { x: 12, y: 12 } })));
    const caps = (t: SessionDEdition) => avertissementsDeLaSession(t).map((w) => w.message).filter((m) => m.endsWith(CAP_NE));
    expect(caps(deBiais), 'le navire inconnu du processus n’a pas de cap jugé').toEqual([]);
    expect(caps(sessionSousLeCatalogue(deBiais, CAT)), 'mêmes scènes, autre catalogue : la validation le relit').toHaveLength(1);
  });
});
