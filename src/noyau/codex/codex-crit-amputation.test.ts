import { describe, it, expect } from 'vitest';
import { CODEX } from './registry';
import type { CodexItem } from './registry';

const item = (categorie: string, id: string): CodexItem => {
  const cat = CODEX.find((c) => c.key === categorie);
  if (!cat) throw new Error(`catégorie Codex « ${categorie} » absente du registre`);
  const it = cat.items.find((i) => i.id === id);
  if (!it) throw new Error(`item « ${id} » absent de la catégorie « ${categorie} »`);
  return it;
};

/** Faits d'en-tête, en `label → valeur` — ce que le joueur lit AVANT d'ouvrir les rubriques. */
const faits = (it: CodexItem): Record<string, string> =>
  Object.fromEntries((it.meta ?? []).map((f) => [f.label, String(f.value)]));

/** Rubrique par titre, rendue en textes PLATS (un renvoi Codex rend son `show`). */
const rubrique = (it: CodexItem, titre: string): string[] => {
  const sec = (it.sections ?? []).find((s) => s.title === titre);
  if (!sec) throw new Error(`rubrique « ${titre} » absente — rubriques : ${(it.sections ?? []).map((s) => s.title).join(' | ')}`);
  return (sec.rows ?? []).map((r) => (r.t === 'text' ? r.text : r.t === 'ref' ? r.show : r.t === 'sub' ? r.label : JSON.stringify(r)));
};

const titres = (it: CodexItem): string[] => (it.sections ?? []).map((s) => s.title);

const CHOC_DE_LA_PLAIE = [
  'À Terre',
  'Si la marge est au plus -2 DR', 'Sonné',
  'Si la marge est au plus -4 DR', 'Inconscient',
];

describe('#1675 — projection des Flows d’Amputation', () => {
  it.each([
    ['criticalsBras', 'main-ouverte'],
    ['aaCriticalsBras', 'aa-bras-116'],
  ])('associe perte certaine et Test de plaie à Main ouverte dans %s', (categorie, id) => {
    const fiche = item(categorie, id);
    expect(faits(fiche)['Jet d’Amputation']).toBe('Résistance Complexe (−10)');
    expect(rubrique(fiche, 'Résistance Complexe (−10) — si le jet échoue')).toEqual(CHOC_DE_LA_PLAIE);
    expect(rubrique(fiche, 'Amputation — quoi que donne le jet')).toEqual(['perd Doigts amputés — Amputation']);
  });

  it.each([
    ['criticalsBras', 'main-mutilee'],
    ['aaCriticalsBras', 'aa-bras-126'],
  ])('distingue le Test de plaie du Test de rangée à −20 pour Main mutilée dans %s', (categorie, id) => {
    const fiche = item(categorie, id);
    const plaie = 'Plaie d’amputation — Résistance Difficile (−20)';
    expect(faits(fiche)['Jet']).toBe('Résistance Difficile (−20)');
    expect(faits(fiche)['Jet d’Amputation']).toBe(plaie);
    expect(rubrique(fiche, `${plaie} — si le jet échoue`)).toEqual(CHOC_DE_LA_PLAIE);
  });

  it.each([
    ['criticalsTete', 'bouche-explosee'],
    ['aaCriticalsTete', 'aa-tete-66'],
  ])('affiche la quantité de dents de Bouche explosée dans %s', (categorie, id) => {
    const fiche = item(categorie, id);
    expect(faits(fiche)['Jet d’Amputation']).toBe('Résistance Facile (+40)');
    expect(rubrique(fiche, 'Amputation — quoi que donne le jet')).toEqual(['perd 1d10 Dents perdues — Amputation']);
  });

  it.each([
    ['criticalsJambe', 'pied-ecrase'],
    ['aaCriticalsJambe', 'aa-jambe-106'],
  ])('distingue les deux Tests à +20 et leurs effets pour Pied écrasé dans %s', (categorie, id) => {
    const fiche = item(categorie, id);
    const perte = 'Perte de l’orteil — Résistance Accessible (+20)';
    const plaie = 'Plaie d’amputation — Résistance Accessible (+20)';
    expect(faits(fiche)['Jets d’Amputation']).toBe(`${perte} puis ${plaie}`);
    expect(rubrique(fiche, `${perte} — si le jet échoue`)).toEqual([
      'À Terre', 'perd Orteil(s) amputé(s), et un de plus par DR en dessous de 0 — Amputation', `Puis, ${plaie}`,
    ]);
    expect(rubrique(fiche, `${plaie} — si le jet échoue`)).toEqual(CHOC_DE_LA_PLAIE);
    expect(titres(fiche)).not.toContain(`${perte} — si le jet réussit`);
    expect(titres(fiche)).not.toContain('Amputation — quoi que donne le jet');
  });

  it.each([
    ['criticalsJambe', 'coupure-a-l-orteil'],
    ['aaCriticalsJambe', 'aa-jambe-56'],
  ])('situe le Test englobant et sa suite pour Coupure à l’orteil dans %s', (categorie, id) => {
    const fiche = item(categorie, id);
    const perte = 'Perte de l’orteil — Résistance Intermédiaire (+0)';
    const plaie = 'Plaie d’amputation — Résistance Accessible (+20)';
    expect(faits(fiche)['Jets d’Amputation']).toBe(`${perte} puis ${plaie}`);
    expect(faits(fiche).Quand).toBe('Une fois la rencontre terminée');
    expect(rubrique(fiche, `${perte} — si le jet échoue`)).toEqual([
      'perd Orteil(s) amputé(s) — Amputation', `Puis, ${plaie}`,
    ]);
    expect(rubrique(fiche, `${plaie} — si le jet échoue`)).toEqual(CHOC_DE_LA_PLAIE);
    expect(titres(fiche)).not.toContain(`${perte} — si le jet réussit`);
    expect(titres(fiche)).not.toContain('Amputation — quoi que donne le jet');
  });
});
