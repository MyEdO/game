// @vitest-environment jsdom
/**
 * « Exporter forme dépôt (dev) » (#680) : une campagne LIVRÉE ouverte à l'éditeur puis passée au geste
 * SANS modification rend, à l'octet, le fichier du dépôt ET son nom (`projetVersDepot`, `origineLivree`).
 * Mesuré sur le chemin RÉEL : `<Editor>` monté, la campagne ouverte par la voie de recette
 * (`__wfrp.editorOpen`), menu Fichier déroulé, le Blob et le nom que `downloadText` fabrique interceptés.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Editor } from './Editor';
import { buildApi } from '../../state/devtools';
import { parseProject, ProjetRefuse } from '../../state/worldMap';
import { emptyScene } from '../../state/scene';
import { __resetLibraryForTest } from '../../state/projectLibrary';
import { __setOuvertureIdbForTest } from '../../lib/indexedDb';
import { brancherBasesSimulees } from '../../lib/indexedDb.testkit';
import { diligenceCampaign } from '../../scenes/campaign';
import { proseNonMaterialisee } from '../../data/schemas/grammaire/prose';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let container: HTMLElement | null = null;

afterEach(async () => {
  if (root) await act(async () => { root!.unmount(); });
  container?.remove();
  root = null;
  container = null;
  await __resetLibraryForTest();
  __setOuvertureIdbForTest(null);
  localStorage.clear();
});

const ENTREE = 'Exporter forme dépôt (dev)';
const DISQUE = readFileSync(join(__dirname, '../../scenes/diligence/diligence-projet.json'), 'utf8');

function bouton(label: string): HTMLButtonElement | undefined {
  return Array.from(container!.querySelectorAll('button')).find((b) => b.textContent?.trim().includes(label)) as HTMLButtonElement | undefined;
}
function exigeBouton(label: string): HTMLButtonElement {
  const el = bouton(label);
  if (!el) throw new Error(`bouton introuvable : « ${label} »`);
  return el;
}

async function monter(): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root!.render(<Editor initialScene={{ ...emptyScene(4, 4), id: 'brouillon' }} />); });
}

async function ouvrirLaDiligence(): Promise<void> {
  let verdict: unknown = '';
  await act(async () => { verdict = await buildApi().editorOpen(diligenceCampaign.id); });
  expect(String(verdict), 'la campagne s’ouvre à l’éditeur').toMatch(/^✓/);
}

/** L'entrée du menu Fichier est-elle offerte ? (le menu est refermé après lecture) */
async function offerte(): Promise<boolean> {
  await act(async () => { exigeBouton('Fichier').click(); });
  const oui = bouton(ENTREE) !== undefined;
  await act(async () => { exigeBouton('Fichier').click(); });
  return oui;
}

/** « Fichier → Enregistrer… » sous le nom `nom` : le seul geste qui renomme le projet. */
async function renommer(nom: string): Promise<void> {
  brancherBasesSimulees().amorcer('wfrp4-library', 1, { projects: { keyPath: 'id' } });
  await act(async () => { exigeBouton('Fichier').click(); });
  await act(async () => { exigeBouton('Enregistrer…').click(); });
  const champ = container!.querySelector('.modal input:not([type="checkbox"])') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(champ, nom);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const enregistrer = Array.from(container!.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Enregistrer')!;
  await act(async () => { enregistrer.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

/**
 * Joue « Fichier → Exporter forme dépôt (dev) » et rend le NOM et le TEXTE que `downloadText`
 * télécharge. Surcharges PLATES, restaurées — jamais `vi.mock`/`vi.spyOn` (suite `isolate:false`).
 */
async function telecharge(): Promise<{ nom: string; texte: string }> {
  const OrigBlob = globalThis.Blob;
  const OrigCreateObjectURL = URL.createObjectURL;
  const OrigRevokeObjectURL = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  let texte = '';
  let nom = '';
  class CapturingBlob extends OrigBlob {
    constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
      super(parts, opts);
      // Seul le Blob de l'export (`application/json`) compte : le monde volumique en fabrique d'autres.
      if ((opts?.type ?? 'application/json') === 'application/json') texte = parts.map((p) => String(p)).join('');
    }
  }
  (globalThis as unknown as { Blob: unknown }).Blob = CapturingBlob;
  URL.createObjectURL = () => 'blob:fake';
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { nom = this.download; };
  try {
    await act(async () => { exigeBouton('Fichier').click(); });
    await act(async () => { exigeBouton(ENTREE).click(); });
  } finally {
    (globalThis as unknown as { Blob: unknown }).Blob = OrigBlob;
    URL.createObjectURL = OrigCreateObjectURL;
    URL.revokeObjectURL = OrigRevokeObjectURL;
    HTMLAnchorElement.prototype.click = origClick;
  }
  return { nom, texte };
}

describe('Éditeur — « Exporter forme dépôt (dev) » rend le fichier du dépôt (#680)', () => {
  it('la Diligence ouverte puis exportée SANS modification : le fichier committé à l’octet, sous son nom', async () => {
    await monter();
    await ouvrirLaDiligence();
    const { nom, texte } = await telecharge();
    expect(nom).toBe(diligenceCampaign.fichier);
    expect(texte).toBe(DISQUE);

    const doc = JSON.parse(texte) as unknown;
    expect(proseNonMaterialisee(doc).length, 'aucune prose adressée — le geste ne mesurerait rien').toBeGreaterThan(0);
    expect(() => parseProject(doc), 'forme dépôt : la porte la refuse, seule la lecture servie la complète').toThrow(ProjetRefuse);
  });

  it('renommée par l’auteur : le nom donné part TEL QUEL comme libellé', async () => {
    await monter();
    await ouvrirLaDiligence();
    await renommer('Ma Diligence');
    const { nom, texte } = await telecharge();
    expect(nom).toBe(diligenceCampaign.fichier);
    expect(texte).toBe(`${JSON.stringify({ ...JSON.parse(DISQUE), label: 'Ma Diligence' }, null, 1)}\n`);
  });

  it('un projet qui ne vient pas d’une campagne livrée n’offre pas le geste', async () => {
    await monter();
    expect(await offerte(), 'éditeur monté sur un brouillon').toBe(false);
    await ouvrirLaDiligence();
    expect(await offerte(), 'campagne livrée ouverte').toBe(true);
    await act(async () => { exigeBouton('Fichier').click(); });
    await act(async () => { exigeBouton('Nouveau projet').click(); });
    expect(await offerte(), 'nouveau projet vierge').toBe(false);
  });
});
