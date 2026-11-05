/**
 * Un champ OPTIONNEL d'un livre se RETIRE par le geste de l'atelier (#1825) : Compendium → Livres →
 * un livre → Éditer → vider le champ → Enregistrer. `editFields.ts#inferFields` rend le champ
 * `nullable` et `CodexEdit` émet `null` au vide : le schéma doit donc ADMETTRE `null` sur CHACUN
 * d'eux. Couture générale : #1830.
 *
 * Le banc est GÉNÉRAL, jamais un banc par champ : il DÉCOUVRE les champs optionnels de `books`
 * depuis le def (nullable inféré sur la donnée réelle) et joue le geste sur chacun — un champ
 * optionnel de plus y entre sans une ligne ici.
 *
 * Il juge le CHEMIN RÉEL, sur `books.json` réel et la porte que `CodexEdit` appelle vraiment
 * (`validateDataset`, `src/data/schemas/validate.ts:129`) — jamais un schéma forgé. Il vit ici, et
 * non avec les tests de donnée (`src/data/book-source-integrity.test.ts`) ni avec ceux de
 * `validateDataset` (`src/data/schemas/validate.test.ts`), parce qu'il lui faut les DEUX côtés de la
 * couture : `src/ui` peut lire `src/data`, l'inverse serait une dépendance à contresens.
 */
import { describe, it, expect } from 'vitest';
import { inferFields } from './editFields';
import { metaPourFichier, noeudObjet, schemaForFile, validateDataset } from '../../data/schemas/validate';
import { books } from '../../data/index';

const FILE = 'books.json';
const entrees = books as unknown as Record<string, unknown>[];
/** MÊME régime que `src/ui/editor/codex/CodexEdit.tsx` › `AtelierDEntree` — le banc lit le formulaire que l'écran construit. */
const REGIME = { meta: metaPourFichier(FILE), noeud: noeudObjet(schemaForFile(FILE)) };
const CHAMPS = inferFields(entrees, REGIME);
/**
 * Les champs que l'atelier offre au VIDE : ceux du DEF (`meta`) qu'au moins une entrée ne porte pas.
 * Les clés d'ENVELOPPE en sont EXCLUES, et l'exclusion se MESURE plus bas plutôt que de se croire :
 * leur vide relève de la grammaire de document, pas de ce def — #1830.
 */
const VIDABLES = CHAMPS.filter((c) => c.nullable && REGIME.meta?.[c.key]).map((c) => c.key);
/** Les champs vidables à l'écran que ce banc LAISSE hors de son verdict — nommés, jamais tus. */
const HORS_VERDICT = CHAMPS.filter((c) => c.nullable && !REGIME.meta?.[c.key]).map((c) => c.key);

/** Le dataset réel, la PREMIÈRE entrée qui porte `cle` la recevant à `valeur`. */
const datasetAvec = (cle: string, valeur: unknown): unknown[] => {
  const i = entrees.findIndex((e) => e[cle] != null);
  return entrees.map((e, k) => (k === i ? { ...e, [cle]: valeur } : e));
};

describe('atelier — tout champ optionnel d’un livre se vide par le geste (#1825)', () => {
  it('le dataset committé, inchangé, passe la porte d’enregistrement', () => {
    expect(validateDataset(FILE, entrees)).toBeNull();
  });

  it('le formulaire offre au moins un champ vidable, et chacun porte un libellé FR (jamais sa clé technique)', () => {
    expect(VIDABLES.length).toBeGreaterThan(0);
    for (const cle of VIDABLES) {
      const champ = CHAMPS.find((c) => c.key === cle)!;
      expect(champ.label, `${cle} n’a pas de libellé FR`).not.toBe(cle);
    }
  });

  for (const cle of VIDABLES) {
    it(`VIDER « ${cle} » (\`null\`) est ACCEPTÉ par la porte d’enregistrement`, () => {
      expect(validateDataset(FILE, datasetAvec(cle, null))).toBeNull();
    });
  }

  it('la TENEUR est un enum NOMMÉ : l’atelier en rend une LISTE, jamais un texte libre', () => {
    const champ = CHAMPS.find((c) => c.key === 'teneur');
    expect(champ?.kind).toBe('select');
    expect(Object.keys(champ?.valeurs ?? {}).length).toBeGreaterThan(1);
    expect(validateDataset(FILE, datasetAvec('teneur', 'valeur-hors-univers'))).not.toBeNull();
  });

  it('le NIVEAU DE SECTION se saisit en NOMBRE, et l’atelier ne connait AUCUNE propriété de chapitre', () => {
    expect(CHAMPS.find((c) => c.key === 'niveauDeSection')?.kind).toBe('number');
    // Ce qu'on sait des CHAPITRES d'un livre est de l'OUTILLAGE Atlas (`scripts/raw/chapitres.json`) :
    // il n'entre pas dans la donnée de jeu, et n'a donc aucun champ à l'atelier du Compendium.
    expect(CHAMPS.map((c) => c.key).filter((k) => /^chapitres/.test(k))).toEqual([]);
  });

  it('les clés d’ENVELOPPE laissées hors verdict sont NOMMÉES, et leur vide est un ticket (#1830)', () => {
    expect(HORS_VERDICT).toEqual(['desc']);
    expect(validateDataset(FILE, datasetAvec('desc', null))).not.toBeNull();
  });

  it('une graphie de cœur NON normalisée reste REFUSÉE, et le message nomme la règle', () => {
    const erreur = validateDataset(FILE, datasetAvec('coeur', '5E '));
    expect(erreur).not.toBeNull();
    expect(erreur).toMatch(/graphie normalisée/);
  });

  it('la chaîne VIDE reste REFUSÉE sur un cœur — vider se dit `null`, pas `""`', () => {
    expect(validateDataset(FILE, datasetAvec('coeur', ''))).not.toBeNull();
  });
});
