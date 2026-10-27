/**
 * SaveLoadModal — rendu des libellés i18n Phase D.
 * Rendu statique via renderToStaticMarkup (pas de DOM, pas de localStorage requis).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SaveLoadModal } from './SaveLoadModal';
import { poserLeLocalStorage } from '../lib/stockage.testkit';

describe("SaveLoadModal -- libelles i18n Phase D", () => {
  beforeEach(() => {
    poserLeLocalStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("mode save : titre Sauvegarder, emplacements vides, bouton importer, fermer", () => {
    const html = renderToStaticMarkup(<SaveLoadModal mode="save" onClose={() => {}} />);
    expect(html).toContain("Sauvegarder");
    expect(html).toContain("Emplacement 1");
    expect(html).toContain("Emplacement 2");
    expect(html).toContain("Emplacement 3");
    expect(html).toContain("— vide —");
    expect(html).toContain("Importer un fichier");
    expect(html).toContain("Fermer");
  });

  it("mode load : titre Charger une partie", () => {
    const html = renderToStaticMarkup(<SaveLoadModal mode="load" onClose={() => {}} />);
    expect(html).toContain("Charger une partie");
    expect(html).toContain("Emplacement 1");
    expect(html).toContain("— vide —");
    expect(html).toContain("Fermer");
  });
});
