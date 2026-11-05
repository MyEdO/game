import { describe, it, expect } from 'vitest';
import { CODEX } from './registry';
import type { CodexItem } from './registry';

/**
 * CODEX — le joueur voit AUTANT de jets que le moteur en joue, et la PERTE que la ligne prononce
 * (#1657 B3-1b). Doctrine des jets (utilisateur 2026-08-24) : « A partir du moment ou je dois faire un
 * jet, il doit apparaitre. »
 *
 * Ce que cette sonde attrape, et qu'aucune mesure de FORME ne voit (les clés du Codex ne bougent pas) :
 *  - une rangée dont l'Amputation est CERTAINE (22 des 26) affichant son Test mais TAISANT la perte —
 *    « Main ouverte » (LDB 18 l.122) rendait « jet + États » et jamais « perdez un doigt » ;
 *  - la QUANTITÉ de la ligne (« Perdez 1d10 dents », l.77) avalée par l'humanisation de l'op ;
 *  - un jet ANNONÇANT la conséquence du jet SUIVANT — « Coupure à l'orteil » (l.171) : le gate ne doit
 *    porter que l'amputation, les États étant ceux du Test l.237 qui le suit.
 * Les textes sont comparés EXACTEMENT : une régression d'affichage n'a nulle part où se cacher.
 */

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
  return (sec.rows ?? []).map((r) => (r.t === 'text' ? r.text : r.t === 'ref' ? r.show : JSON.stringify(r)));
};

const titres = (it: CodexItem): string[] => (it.sections ?? []).map((s) => s.title);

describe('#1657 B3-1b — le Codex dit les Tests d’Amputation ET la perte que la ligne prononce', () => {
  it('« Main ouverte » (LDB 18 l.122) : le Test d’Amputation est nommé, et le doigt perdu est DIT', () => {
    const it = item('criticalsBras', 'main-ouverte');
    expect(faits(it)['Jet d’Amputation']).toBe('Résistance Complexe (−10)');
    expect(rubrique(it, 'Résistance Complexe (−10) — si le jet échoue')).toEqual(['À Terre', 'Sonné', 'Inconscient']);
    expect(rubrique(it, 'Amputation — quoi que donne le jet')).toEqual(['perd Doigts amputés — Amputation']);
  });

  it('« Bouche explosée » (l.77) : la QUANTITÉ de la ligne (1d10 dents) est rendue', () => {
    const it = item('criticalsTete', 'bouche-explosee');
    expect(faits(it)['Jet d’Amputation']).toBe('Résistance Facile (+40)');
    expect(rubrique(it, 'Amputation — quoi que donne le jet')).toEqual(['perd 1d10 Dents perdues — Amputation']);
  });

  it('« Pied écrasé » (l.180) : la perte est GATÉE par le Test — elle vit dans son échec, pas hors jet', () => {
    const it = item('criticalsJambe', 'pied-ecrase');
    expect(faits(it)['Jet d’Amputation']).toBe('Résistance Accessible (+20)');
    expect(rubrique(it, 'Résistance Accessible (+20) — si le jet échoue')).toEqual([
      'À Terre', 'Sonné', 'Inconscient', 'perd Orteil(s) amputé(s), et un de plus par DR en dessous de 0 — Amputation',
    ]);
    expect(titres(it), 'une perte gatée ne doit PAS s’annoncer comme certaine').not.toContain('Amputation — quoi que donne le jet');
  });

  it('« Coupure à l’orteil » (l.171) : DEUX jets nommés, chacun ne portant QUE sa propre conséquence', () => {
    const it = item('criticalsJambe', 'coupure-a-l-orteil');
    expect(faits(it)['Jets d’Amputation']).toBe('Résistance Intermédiaire (+0) puis Résistance Accessible (+20)');
    expect(faits(it).Quand).toBe('Une fois la rencontre terminée');
    // Le GATE (l.171) ne promet QUE la perte : les États sont ceux du Test l.237 qui suit son échec.
    expect(rubrique(it, 'Résistance Intermédiaire (+0) — si le jet échoue')).toEqual(['perd Orteil(s) amputé(s) — Amputation']);
    expect(rubrique(it, 'Résistance Accessible (+20) — si le jet échoue')).toEqual(['À Terre', 'Sonné', 'Inconscient']);
  });
});
