import { describe, it, expect } from 'vitest';
import { auditFolio, labelSurLaPage } from '../../scripts/guards/lib/folioIntegrity.mjs';
import structures from './structures.json';

/**
 * Garde-fou « le folio déclaré par une structure est celui où vit sa `desc` » (#1467 L1b V-Src).
 *
 * `structures.json` portait une réf de source à granularité CHAPITRE (`{book, chapter}`), forme
 * PROPRE au dataset qu'aucun instrument du dépôt ne savait confronter : ni `auditFolio` (voie
 * desc-verbatim → ancre `data-folio`), ni `auditAlignment` ne mordent sans `page`. La migration
 * `scripts/migrations/2026-08-27-l1b-1a-structures-folio.mjs` l'a passée au `sourceRefSchema`
 * commun ; ce test est ce qui rend la migration VÉRIFIABLE plutôt que déclarée.
 *
 * Ce qu'il mesure : chaque entrée `aux-armes` porte une `desc` VERBATIM, donc `auditFolio` peut
 * chercher où ce texte vit dans l'extraction et le confronter au folio déclaré. Le verdict exigé est
 * `folio-ok` — un folio faux rend `folio-ment`, un folio hors livre `folio-impossible`.
 *
 * Les 5 entrées `archives-de-l-empire-2` n'ont PAS de `desc` (elles sont des lignes de table nues) :
 * elles sont hors de portée de cette voie et le test le DIT plutôt que de les compter vertes. Leur
 * folio 89 est attesté par l'ancre de titre de leur table (`ADE II 8` l.280
 * « BARRICADES ET PROTECTIONS TYPIQUES », folio gouvernant 89), relevé au geste de migration.
 *
 * L'entrée `livre-de-base` (garde-corps, #1883) n'a ni `desc` ni ligne de table : son folio 161 se
 * confronte au passage que son `maison` cite (LDB 14 l.81), lu dans les tranches du folio déclaré
 * (ancre `data-folio="161"`, LDB 14 l.44) — et réfuté au folio voisin.
 */

type Structure = { id: string; source: { book: string; page: number }; desc?: string };

const ENTREES = structures as Structure[];
const AUX_ARMES = ENTREES.filter((s) => s.source.book === 'aux-armes');
const ADE_II = ENTREES.filter((s) => s.source.book === 'archives-de-l-empire-2');
const LDB = ENTREES.filter((s) => s.source.book === 'livre-de-base') as (Structure & { maison?: string })[];
/** LDB 14 l.81, verbatim — le passage que le `maison` du garde-corps cite pour son Couvert. */
const LDB_14_L81 = 'Cible protégée par une couverture moyenne (une barrière en bois, par exemple).';

describe('structures.json — folio de source confronté à l’extraction (#1467 L1b)', () => {
  it('chaque entrée aux-armes déclare le folio où vit sa `desc` (auditFolio → folio-ok)', () => {
    expect(AUX_ARMES.length, 'le catalogue porte des Structures AA').toBeGreaterThan(0);
    const verdicts = AUX_ARMES.map((s) => {
      expect(s.desc, `${s.id} : desc absente, la voie verbatim ne peut pas juger`).toBeTruthy();
      const { verdict } = auditFolio({ book: s.source.book, page: s.source.page, desc: s.desc! });
      return `${s.id} p.${s.source.page} → ${verdict}`;
    });
    const fautifs = verdicts.filter((v) => !v.endsWith('→ folio-ok'));
    expect(fautifs, `folio(s) non attesté(s) :\n  ${fautifs.join('\n  ')}`).toEqual([]);
  });

  it('l’instrument MORD : au folio CROISÉ (119↔120), toutes rendent `folio-ment`', () => {
    // Sans ce volet, le test précédent ne prouve rien : un `auditFolio` qui dirait `folio-ok` à
    // tout le monde le passerait aussi. La table AA court sur deux folios voisins — échanger l'un
    // pour l'autre est la plus PETITE erreur possible, et elle doit déjà être vue.
    const survivants = AUX_ARMES.filter((s) => {
      const croise = s.source.page === 119 ? 120 : 119;
      return auditFolio({ book: s.source.book, page: croise, desc: s.desc! }).verdict !== 'folio-ment';
    });
    expect(survivants.map((s) => s.id), 'entrée(s) que le folio croisé ne réfute PAS').toEqual([]);
  });

  it('la source est au FOLIO (`page`), jamais au chapitre — sur toutes les entrées', () => {
    for (const s of ENTREES) {
      expect(typeof s.source.page, `${s.id} : \`page\` absente ou non numérique`).toBe('number');
    }
  });

  it('les folios posés sont exactement ceux attestés : ADE II 89, AA 119-120, LDB 161', () => {
    expect(new Set(ADE_II.map((s) => s.source.page))).toEqual(new Set([89]));
    expect(ADE_II.length).toBe(5);
    expect(new Set(AUX_ARMES.map((s) => s.source.page))).toEqual(new Set([119, 120]));
    expect(LDB.map((s) => `${s.id} p.${s.source.page}`)).toEqual(['garde-corps p.161']);
    expect(ADE_II.length + AUX_ARMES.length + LDB.length, 'chaque entrée relève d’une voie').toBe(ENTREES.length);
  });

  it('l’entrée LDB : le passage cité par son `maison` vit au folio déclaré, et le folio voisin le réfute', () => {
    const [gc] = LDB;
    expect(gc.maison, 'le `maison` cite le passage confronté').toContain(LDB_14_L81);
    expect(labelSurLaPage(gc.source.book, gc.source.page, LDB_14_L81), 'passage absent du folio déclaré').not.toBeNull();
    for (const voisin of [gc.source.page - 1, gc.source.page + 1])
      expect(labelSurLaPage(gc.source.book, voisin, LDB_14_L81), `folio ${voisin} : l’instrument doit réfuter`).toBeNull();
  });

  it('les 5 entrées ADE II sont HORS de la voie verbatim (aucune `desc`) — couverture dite, pas supposée', () => {
    expect(ADE_II.every((s) => !s.desc)).toBe(true);
  });
});
