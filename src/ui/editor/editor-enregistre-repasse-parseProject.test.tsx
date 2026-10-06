// @vitest-environment jsdom
/**
 * `parseProject` est la porte UNIQUE des documents de projet (JSON committé, bibliothèque locale,
 * import de l'auteur — `src/data/schemas/validate.ts`). Ce que le chemin d'ÉCRITURE de l'éditeur
 * produit doit donc repasser cette porte : un projet que l'application écrit et ne peut plus rouvrir
 * est une perte de travail. Le round-trip est mesuré sur le chemin RÉEL (« Fichier → Enregistrer »
 * de `<Editor>` → `projectSave` → document capturé au dos d'IndexedDB), jamais sur un document forgé.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { __resetLibraryForTest, initLibrary, type SavedProject } from '../../state/projectLibrary';
import { __setOuvertureIdbForTest } from '../../lib/indexedDb';
import { brancherBasesSimulees, type BaseSimulee } from '../../lib/indexedDb.testkit';
import { parseProject, CURRENT_PROJECT_SCHEMA } from '../../state/worldMap';
import { emptyScene, type Scene } from '../../state/scene';
import { emptyNarratif } from '../../state/campaignNarratif';
import { Editor } from './Editor';
import { allBuiltinCampaigns, paquetDuJeu, type BuiltinCampaign } from '../../scenes/campaign';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
  demonterRacines();
  await __resetLibraryForTest();
  __setOuvertureIdbForTest(null);
  localStorage.clear();
});

const BIBLIOTHEQUE = 'wfrp4-library';

/** Branche la bibliothèque IndexedDB sur une base simulée amorcée avec `entrees`. */
function bibliotheque(entrees: SavedProject[] = []): BaseSimulee {
  const base = brancherBasesSimulees().amorcer(BIBLIOTHEQUE, 1, { projects: { keyPath: 'id' } });
  for (const e of entrees) base.magasins.get('projects')!.contenu.set(e.id, e);
  return base;
}

/** Les entrées réellement écrites dans la bibliothèque, dans l'ordre. */
const ecritsDe = (base: BaseSimulee) => base.ecritures.filter((q) => q.geste === 'put').map((q) => q.valeur as SavedProject);

/** Joue « Fichier → Enregistrer… → Enregistrer » sur un éditeur fraîchement monté et rend ce que le
 *  geste PRODUIT : les entrées réellement écrites, et le refus AFFICHÉ s'il y en a un. */
async function enregistre(initialScene: Scene): Promise<{ ecrits: SavedProject[]; refus: string | null }> {
  const base = bibliotheque();

  const { container, rendre } = monterRacine(null);
  await act(async () => {
    rendre(<Editor initialScene={initialScene} />);
  });

  const byText = (label: string) =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;
  await act(async () => { byText('Fichier').click(); });
  await act(async () => { byText('Enregistrer…').click(); });
  const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Enregistrer')!;
  await act(async () => { saveBtn.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  return { ecrits: ecritsDe(base), refus: container.querySelector('[role="alert"]')?.textContent ?? null };
}

/** Le document de projet TEL QU'ÉCRIT par l'application sur le chemin nominal. */
async function enregistreEtCapture(): Promise<SavedProject> {
  const { ecrits } = await enregistre({ ...emptyScene(4, 4), id: 'scene-round-trip', label: 'Round-trip' });
  expect(ecrits).toHaveLength(1);
  return ecrits[0];
}

describe('Éditeur — un projet ENREGISTRÉ repasse sa propre porte `parseProject`', () => {
  it('un projet JAMAIS nommé se NOMME au geste d’enregistrement, et le document écrit repasse sa porte', async () => {
    const saved = await enregistreEtCapture();

    // La porte unique relit ce que l'application vient d'écrire.
    expect(() => parseProject(saved.project)).not.toThrow();
    const relu = parseProject(saved.project);
    expect(relu.scenes.map((s) => s.id)).toEqual(['scene-round-trip']);

    // Identité REQUISE (#1552 — invariant et verbatim au contrat du schéma,
    // `src/data/schemas/defs-scenes/projet-schema.test.ts` cas (d bis)).
    // L'éditeur démarre SANS identité ; c'est le geste d'enregistrement (le champ
    // pré-rempli de `SaveProjectModal`) qui la pose. Le document écrit s'annonce, se nomme, et dit
    // sa provenance — sans quoi sa propre porte le refuserait à la relecture ci-dessus.
    expect(saved.project).toMatchObject({ type: 'projet', schema: CURRENT_PROJECT_SCHEMA, versionContenu: 1 });
    expect(saved.project.id, 'identité posée par le geste').toBeTruthy();
    expect(saved.project.label, 'le NOM vient du champ de la modale').toBeTruthy();
    expect(saved.project.maison, 'provenance : une campagne d’éditeur ne cite aucun folio').toBeTruthy();
    expect(Object.keys(saved.project).sort()).toEqual(['id', 'label', 'maison', 'narratif', 'scenes', 'schema', 'type', 'versionContenu']);
  });
});

/**
 * Et la porte est ANTÉRIEURE à l'écriture, pas postérieure à elle : un document que « Ouvrir »
 * refuserait ne se couche PAS. Sans ce verrou, l'auteur enregistrait sans alerte un fichier qu'il ne
 * pourrait plus rouvrir — perte de travail silencieuse. Mesuré sur la contrainte que #877 rend
 * REQUISE (un décor NOMME son type), qui vaut pour toute autre contrainte du schéma.
 */
describe('Éditeur — un projet que la porte REFUSE ne s’écrit pas', () => {
  /** Une scène dont UN décor ne nomme aucun type — ce que l'éditeur pouvait produire avant #877. */
  const sceneAuDecorSansType = (): Scene => ({
    ...emptyScene(4, 4),
    id: 'scene-fautive',
    label: 'Salle fautive',
    entities: [{ id: 'p0', kind: 'prop', pos: { x: 1, y: 1 }, label: 'La jetée' }],
  });

  it('rien n’est écrit, et le refus NOMME la scène et l’entité à corriger', async () => {
    const { ecrits, refus } = await enregistre(sceneAuDecorSansType());
    expect(ecrits, 'aucune écriture : `projectSave` n’est pas appelé').toEqual([]);
    expect(refus).toContain('ce projet ne pourrait plus être rouvert');
    expect(refus, 'la scène est nommée').toContain('Salle fautive');
    expect(refus, 'l’entité fautive est nommée').toContain('La jetée');
    expect(refus, 'et la règle enfreinte est dite').toContain('« ref » absente');
  });

  it('le document de la scène fautive est bien celui que la porte REFUSE (sans quoi on ne mesurerait rien)', () => {
    expect(() => parseProject({
      type: 'projet', schema: CURRENT_PROJECT_SCHEMA, id: 'p', label: 'P', versionContenu: 1,
      maison: 'fixture de test', narratif: emptyNarratif(),
      scenes: [sceneAuDecorSansType()],
    })).toThrow(/« ref » absente/);
  });

  it('un projet SAIN s’enregistre comme avant — la porte ne barre que ce qui est fautif', async () => {
    const saine: Scene = {
      ...emptyScene(4, 4), id: 'scene-saine', label: 'Salle saine',
      entities: [{ id: 'p0', kind: 'prop', pos: { x: 1, y: 1 }, ref: 'tonneau' }],
    };
    const { ecrits, refus } = await enregistre(saine);
    expect(refus).toBeNull();
    expect(ecrits).toHaveLength(1);
    expect((ecrits[0].project as { scenes: Scene[] }).scenes[0].entities[0].ref).toBe('tonneau');
  });
});

/** Un projet déjà en bibliothèque, écrit AVANT #1552 : son document n'a ni `type`, ni identité à la
 *  racine, et ses scènes ne s'annoncent pas. L'ENTRÉE, elle, porte un id et un nom — la clé et le
 *  libellé de la bibliothèque (`SavedProject`). */
function entreeAncienne(over: Partial<SavedProject> = {}): SavedProject {
  const { type: _muette, ...sceneMuette } = { ...emptyScene(4, 4), id: 'scene-ancienne', label: 'Salle ancienne' };
  return {
    id: 'proj-ancien',
    label: 'Campagne d’avant',
    startSceneId: 'scene-ancienne',
    savedAt: 1,
    published: false,
    project: {
      schema: 6,
      scenes: [sceneMuette as Scene],
      narratif: emptyNarratif(),
    },
    ...over,
  } as SavedProject;
}

/** Monte l'éditeur sur une bibliothèque donnée, joue « Fichier → Ouvrir… → Ouvrir » sur la 1ʳᵉ entrée,
 *  et rend ce que l'écran montre : le titre de scène chargé et le refus AFFICHÉ s'il y en a un. */
async function ouvreLaPremiereEntree(entrees: SavedProject[]): Promise<{ refus: string | null; texte: string; ecrits: SavedProject[]; enregistre: () => Promise<string> }> {
  await __resetLibraryForTest();
  const base = bibliotheque(entrees);
  await initLibrary();
  const ecrits: SavedProject[] = [];

  const { container, rendre } = monterRacine(null);
  await act(async () => {
    rendre(<Editor initialScene={{ ...emptyScene(4, 4), id: 'scene-vierge', label: 'Vierge' }} />);
  });
  const byText = (label: string) =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;
  await act(async () => { byText('Fichier').click(); });
  await act(async () => { byText('Ouvrir…').click(); });
  // « Mes projets » est la 1ʳᵉ section de la modale : la 1ʳᵉ rangée est l'entrée de bibliothèque — y
  // compris quand elle est ANONYME (aucun libellé à chercher, c'est justement le cas mesuré).
  const ouvrir = container.querySelectorAll('.listrow')[0].querySelector('button')!;
  await act(async () => { ouvrir.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  const refus = container.querySelector('[role="alert"]')?.textContent ?? null;
  const texte = container.textContent ?? '';
  const enregistre = async () => {
    await act(async () => { byText('Fichier').click(); });
    await act(async () => { byText('Enregistrer…').click(); });
    const nomPreRempli = (container.querySelector('.modal .field input') as HTMLInputElement).value;
    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Enregistrer')!;
    await act(async () => { saveBtn.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    ecrits.splice(0, ecrits.length, ...ecritsDe(base));
    return nomPreRempli;
  };
  return { refus, texte, ecrits, enregistre };
}

describe('Éditeur — un projet de bibliothèque d’AVANT #1552 se ROUVRE', () => {
  it('sans identité au document : l’identité DE L’ENTRÉE est reconduite, le projet CHARGE et se réenregistre', async () => {
    const { refus, texte, ecrits, enregistre } = await ouvreLaPremiereEntree([entreeAncienne()]);
    expect(refus, 'aucun refus ne doit s’afficher').toBeNull();
    expect(texte, 'la scène du projet ancien est chargée').toContain('Salle ancienne');

    await enregistre();
    expect(ecrits).toHaveLength(1);
    const doc = ecrits[0].project as Record<string, unknown>;
    expect(doc.id, 'l’id de l’entrée est reconduit au document').toBe('proj-ancien');
    expect(doc.label).toBe('Campagne d’avant');
    expect(doc.versionContenu, 'version de contenu inconnue du document → 0').toBe(0);
    expect(doc.type).toBe('projet');
    expect(() => parseProject(doc), 'le document réécrit repasse sa porte').not.toThrow();
  });

  it('avec identité au document : l’id et la version sont CEUX DU DOCUMENT, le nom est CELUI DE L’ENTRÉE', async () => {
    const entree = entreeAncienne();
    const projet = { ...(entree.project as Record<string, unknown>), id: 'id-du-document', label: 'Nom du document', versionContenu: 4 };
    const { refus, ecrits, enregistre } = await ouvreLaPremiereEntree([{ ...entree, project: projet } as SavedProject]);
    expect(refus).toBeNull();
    await enregistre();
    const doc = ecrits[0].project as Record<string, unknown>;
    expect(doc.id).toBe('id-du-document');
    expect(doc.label, 'le nom que la liste montre est celui qui se réécrit').toBe('Campagne d’avant');
    expect(doc.versionContenu).toBe(4);
  });

  it('copie d’une campagne du jeu d’AVANT E5 (document au nom du paquet, entrée au nom de l’auteur) : s’ouvre et se réenregistre sous le nom de l’ENTRÉE', async () => {
    const paquet = paquetDuJeu(allBuiltinCampaigns[0]);
    const { scenes: _sc, worldMap: _wm, activeAxes: _aa, narratif: _na, label: _lb, ...identiteDuPaquet } = paquet;
    const projet = {
      ...identiteDuPaquet,
      type: 'projet',
      schema: CURRENT_PROJECT_SCHEMA,
      label: 'L’Arène',
      scenes: [{ ...emptyScene(4, 4), id: 'scene-copie', label: 'Salle copiée' }],
      narratif: emptyNarratif(),
    };
    const copie = { ...entreeAncienne(), id: 'entree-copie', label: 'Mon nom', project: projet } as SavedProject;
    const { refus, ecrits, enregistre } = await ouvreLaPremiereEntree([copie]);
    expect(refus).toBeNull();
    const nomAffiche = await enregistre();
    expect(nomAffiche, 'le champ Nom de « Enregistrer » montre le nom de l’entrée').toBe('Mon nom');
    expect(ecrits).toHaveLength(1);
    const entree = ecrits[0];
    expect((entree.project as Record<string, unknown>).label).toBe('Mon nom');
    expect(entree.label).toBe('Mon nom');
  });

  it('IRRÉCUPÉRABLE (entrée sans nom ni id) : refus en mots d’AUTEUR, détail technique dessous — jamais une boîte du navigateur', async () => {
    const anonyme = { ...entreeAncienne(), id: '', label: '' } as SavedProject;
    const { refus, texte } = await ouvreLaPremiereEntree([anonyme]);
    // Ce que l'auteur lit d'abord est en mots d'AUTEUR (règle 4) : le rapport de la porte nomme des
    // chemins de schéma, il reste consultable mais ne tient plus lieu de message.
    expect(refus, 'le refus doit être RENDU par l’éditeur').toContain('Ce projet n’a pas de nom');
    expect(refus, 'le détail technique reste consultable').toMatch(/id/);
    expect(refus).toMatch(/label/);
    expect(texte, 'la scène ancienne n’est pas chargée').not.toContain('Salle ancienne');
  });

  it('document SANS SCÈNE : le refus se LIT dans la modale « Ouvrir », jamais un clic muet', async () => {
    const entree = entreeAncienne();
    const vide: SavedProject = { ...entree, project: { ...entree.project, scenes: [] } };
    const { refus, texte } = await ouvreLaPremiereEntree([vide]);
    expect(refus).toBe(
      'Ouverture refusée : ce projet ne peut pas être ouvert. Faute : Scènes — le projet ne porte aucune scène : il en faut au moins une pour l’ouvrir ou le jouer.',
    );
    expect(texte, 'la modale « Ouvrir » reste à l’écran').toContain('Mes projets');
  });

  it('entrée dont la scène de départ n’existe pas : l’éditeur l’OUVRE quand même (c’est là qu’on la répare)', async () => {
    const { refus, texte } = await ouvreLaPremiereEntree([entreeAncienne({ startSceneId: 'scene-disparue' })]);
    expect(refus).toBeNull();
    expect(texte).toContain('Salle ancienne');
  });

  it.each([
    ['scènes nulles', [null]],
    ['scène en chaîne', ['a']],
  ])('document que la MIGRATION ne traverse pas (%s) : le refus se LIT dans « Ouvrir »', async (_nom, scenes) => {
    const entree = entreeAncienne();
    const casse = { ...entree, project: { ...entree.project, schema: 2, scenes } } as unknown as SavedProject;
    const { refus } = await ouvreLaPremiereEntree([casse]);
    expect(refus).toContain('Ouverture refusée : ce projet ne peut pas être ouvert. Ce document n’est pas un projet lisible.');
  });

  it('une entrée SANS NOM se rend « (sans nom) » dans « Ouvrir », jamais une rangée muette', async () => {
    const { texte } = await ouvreLaPremiereEntree([{ ...entreeAncienne(), label: '' } as SavedProject]);
    expect(texte).toContain('(sans nom)');
  });
});

/**
 * « Fichier → Importer JSON… » : le document importé PORTE son identité (id, nom, provenance). Le
 * chemin d'import doit la reconduire jusqu'à l'ENTRÉE de bibliothèque que « Enregistrer » écrira —
 * sinon le champ de la modale se pré-remplit du nom de l'éditeur, l'entrée naît sous ce nom-là, et
 * le document garde le sien : entrée et document divergents, le nom du document masqué à l'écran.
 */
async function importePuisEnregistre(docJson: string): Promise<SavedProject[]> {
  await __resetLibraryForTest();
  const base = bibliotheque();
  await initLibrary();

  const { container, rendre } = monterRacine(null);
  await act(async () => {
    rendre(<Editor initialScene={{ ...emptyScene(4, 4), id: 'scene-vierge', label: 'Vierge' }} />);
  });
  const byText = (label: string) =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;

  await act(async () => { byText('Fichier').click(); });
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const fichier = { name: 'projet.json', text: async () => docJson } as unknown as File;
  Object.defineProperty(input, 'files', { value: [fichier], configurable: true });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  await act(async () => { byText('Fichier').click(); });
  await act(async () => { byText('Enregistrer…').click(); });
  // Le champ « Nom » est PRÉ-REMPLI du nom du document importé — l'auteur enregistre sans le ressaisir.
  const champNom = container.querySelector('.modal .field input') as HTMLInputElement;
  expect(champNom.value, 'le nom du document importé pré-remplit la modale').toBe('Campagne importée');
  const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Enregistrer')!;
  await act(async () => { saveBtn.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return ecritsDe(base);
}

describe('Éditeur — un projet IMPORTÉ garde son identité jusqu’à la bibliothèque', () => {
  it('import → enregistrement : l’ENTRÉE et le DOCUMENT portent le MÊME id et le MÊME nom', async () => {
    const doc = {
      type: 'projet',
      schema: CURRENT_PROJECT_SCHEMA,
      id: 'proj-importe',
      label: 'Campagne importée',
      versionContenu: 3,
      maison: 'fixture de test — aucun folio à citer',
      scenes: [{ ...emptyScene(4, 4), id: 'scene-importee', label: 'Salle importée' }],
      narratif: emptyNarratif(),
    };
    const ecrits = await importePuisEnregistre(JSON.stringify(doc));
    expect(ecrits).toHaveLength(1);
    const entree = ecrits[0];
    const ecrit = entree.project as Record<string, unknown>;
    expect(ecrit.id, 'le document garde son id').toBe('proj-importe');
    expect(ecrit.label).toBe('Campagne importée');
    expect(entree.id, 'l’entrée porte l’id DU DOCUMENT').toBe(ecrit.id);
    expect(entree.label, 'l’entrée porte le nom DU DOCUMENT').toBe(ecrit.label);
    expect(() => parseProject(ecrit), 'le document réécrit repasse sa porte').not.toThrow();
  });
});

/**
 * « Fichier → Ouvrir… » sur une campagne DU JEU (« s'ouvre en copie »), puis « Enregistrer » sous un
 * nom NEUF : le nom saisi est celui du DOCUMENT écrit ET de son entrée — une seule source, le champ de
 * la modale.
 */
async function ouvreEnCopiePuisEnregistre(paquet: BuiltinCampaign, nom: string): Promise<SavedProject[]> {
  await __resetLibraryForTest();
  const base = bibliotheque();
  await initLibrary();

  const { container, rendre } = monterRacine(null);
  await act(async () => {
    rendre(<Editor initialScene={{ ...emptyScene(4, 4), id: 'scene-vierge', label: 'Vierge' }} />);
  });
  const byText = (label: string) =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;
  await act(async () => { byText('Fichier').click(); });
  await act(async () => { byText('Ouvrir…').click(); });
  const rangee = Array.from(container.querySelectorAll('.listrow')).find((el) => el.textContent?.includes('ouvre en copie') && el.textContent?.includes(paquet.label))!;
  await act(async () => { rangee.querySelector('button')!.click(); });

  await act(async () => { byText('Fichier').click(); });
  await act(async () => { byText('Enregistrer…').click(); });
  const champNom = container.querySelector('.modal .field input') as HTMLInputElement;
  const poseValeur = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    poseValeur.call(champNom, nom);
    champNom.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Enregistrer')!;
  await act(async () => { saveBtn.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return ecritsDe(base);
}

describe('Éditeur — une campagne du jeu ouverte en copie s’enregistre sous le nom SAISI', () => {
  it('le label du document écrit et celui de l’entrée sont le nom tapé', async () => {
    const ecrits = await ouvreEnCopiePuisEnregistre(allBuiltinCampaigns[0], 'Mon nom neuf');
    expect(ecrits).toHaveLength(1);
    const entree = ecrits[0];
    const ecrit = entree.project as Record<string, unknown>;
    expect(entree.label, 'l’entrée porte le nom saisi').toBe('Mon nom neuf');
    expect(ecrit.label, 'le document porte le nom saisi').toBe(entree.label);
  });

  it('la copie garde le BLOC NARRATIF de son paquet : le document écrit le porte', async () => {
    const campagne = allBuiltinCampaigns.find((bc) => paquetDuJeu(bc).narratif.ouverture !== undefined);
    expect(campagne, 'une campagne du jeu porte un narratif non vide (sans quoi on ne mesurerait rien)').toBeDefined();
    const ecrits = await ouvreEnCopiePuisEnregistre(campagne!, 'Copie narrative');
    expect(ecrits).toHaveLength(1);
    expect((ecrits[0].project as Record<string, unknown>).narratif).toEqual(paquetDuJeu(campagne!).narratif);
  });
});
