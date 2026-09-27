import { describe, expect, it } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';

/**
 * CATCH VIDES du code de production — la question du garde : « quel fichier de `src/` a le droit
 * d'avaler un échec en silence, et combien de fois ? ». Un `catch` à corps vide (`catch {}` /
 * `catch (e) {}`) ou un `.catch(() => {})` fait disparaître l'erreur sans la traiter ni l'exposer.
 * Cliquet BIDIRECTIONNEL sur baseline fermée : tout nouveau site = rouge nominatif, tout site
 * soldé = plafond à abaisser. Les 2 sites UI de la baseline décroissent avec #1577.
 */

/**
 * EN-TÊTE STRUCTURÉ de la garde (#1475).
 */
const GARDE = {
  question:
    'Quel fichier de `src/` a le droit d’avaler un échec en silence, et combien de fois ? Le plafond ' +
    'est NOMINATIF par fichier : un site neuf est rouge, un site soldé abaisse son propre plafond.',
  primitive:
    'Les deux regex `CATCH_BLOC_VIDE` (`catch {}` / `catch (e) {}`) et `CATCH_PROMESSE_VIDE` ' +
    '(`.catch(() => {})`), appliquées au corpus de `readCorpus` ' +
    '(`scripts/guards/lib/sourceCorpus.mjs`, #1462) — aucun parcours de dossiers local.',
  perimetre:
    '`src/**`, extensions `.ts` et `.tsx`, TESTS EXCLUS (défaut `tests: false` de `readCorpus`) : la ' +
    'garde mesure le code de PRODUCTION — un harnais qui avale une erreur ne trompe aucun joueur.',
  angleMort: [
    'Le comptage est STRICT : il ne voit que les corps STRICTEMENT vides. Un `catch` au corps ' +
      'COMMENTAIRE-SEUL (`catch { /* ignoré */ }`) et un `.catch(() => undefined)` / `void 0` / `null` ' +
      'avalent EXACTEMENT pareil et restent invisibles — mesuré le 2026-08-30 : 28 avaleurs LARGES ' +
      'pour 4 stricts sur le même corpus. La curation de cet écart est possédée par #1584 ; élargir les ' +
      'regex ici SANS le lot ferait entrer 24 sites d’un coup, donc une baseline gonflée, pas un gain.',
    'La garde compte des OCCURRENCES TEXTUELLES, pas des chemins d’exécution : un `catch` qui relance ' +
      'sous condition, ou qui journalise dans une branche seulement, lui est transparent.',
  ],
  baseline: {
    fichier: 'la constante `BASELINE` de ce fichier (stock FERMÉ, nominatif par chemin)',
    decroissant: true,
    raison:
      'Le stock est le dénominateur de #1577 : chaque ligne se solde par le traitement RÉEL de l’erreur ' +
      '(exposée, journalisée, remontée) et disparaît dans le commit de son lot. Le second `it` rend la ' +
      'décroissance EXÉCUTABLE : une baseline devenue trop haute est un rouge, au même titre qu’un site ' +
      'neuf — le terrain gagné se verrouille. Une ligne neuve est une dérive, jamais une exception.',
  },
  ticket: '#1577',
} as const;

/** `catch` de bloc à corps vide : `catch {}` / `catch (e) {}`, espaces et retours tolérés. */
const CATCH_BLOC_VIDE = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g;
/** Rejet de promesse avalé : `.catch(() => {})`, espaces et retours tolérés. */
const CATCH_PROMESSE_VIDE = /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g;

const BASELINE: Record<string, number> = {
  'src/audio/engine.ts': 1, // autoplay refusé par le navigateur — silence légitime, commenté au site
  'src/ui/CoopPanels.tsx': 1, // #1577 (élargi par commentaire du 2026-08-30 aux 2 sites presse-papiers)
  'src/ui/ErrorCollectorBanner.tsx': 1, // #1577 (élargi par commentaire du 2026-08-30 aux 2 sites presse-papiers)
};

describe('catch-vide-guard : cliquet des catch vides de src/', () => {
  const reel = new Map<string, number>();
  for (const { rel, text } of readCorpus(['src'])) {
    const n = (text.match(CATCH_BLOC_VIDE) ?? []).length + (text.match(CATCH_PROMESSE_VIDE) ?? []).length;
    if (n > 0) reel.set(rel, n);
  }

  it('aucun catch vide au-dessus de son plafond — un échec ne s’avale pas en silence', () => {
    expect(
      [...reel.entries()]
        .filter(([rel, n]) => n > (BASELINE[rel] ?? 0))
        .map(([rel, n]) => `${rel} : ${n} > ${BASELINE[rel] ?? 0}`),
      'catch vide(s) HORS baseline — traiter l’erreur ou l’exposer (#1577), jamais l’avaler.',
    ).toEqual([]);
  });

  it('la baseline suit le terrain — un site soldé abaisse son plafond', () => {
    expect(
      Object.keys(BASELINE)
        .filter((rel) => (reel.get(rel) ?? 0) < BASELINE[rel])
        .map((rel) => `${rel} : baseline PÉRIMÉE ${BASELINE[rel]}, abaisser à ${reel.get(rel) ?? 0}`),
      'baseline PÉRIMÉE — le terrain gagné se VERROUILLE : abaisser le plafond au réel mesuré.',
    ).toEqual([]);
  });

  /* Cas VIVANTS du détecteur — sans eux, la branche BLOC (population 0 dans `src/` au 2026-08-30 :
   * les 4 sites stricts sont tous des `.catch()`) pourrait être cassée sans qu’aucun test rougisse.
   * Les motifs sont plantés en CHAÎNE : ce fichier est un test, donc hors du corpus qu’il scanne. */
  describe('le détecteur MORD — cas vivants et contrôles négatifs', () => {
    it.each([
      ['catch {}', 'bloc sans binding'],
      ['catch (e) {\n}', 'bloc avec binding, corps sur une autre ligne'],
      ['try { f(); } catch   ( err )   {   }', 'espaces partout, binding nommé'],
    ])('CATCH_BLOC_VIDE matche %j (%s)', (source) => {
      expect(source.match(new RegExp(CATCH_BLOC_VIDE.source, 'g'))).not.toBeNull();
    });

    it.each([
      ['.catch(() => {})', 'forme compacte'],
      ['.catch( (  ) => {  } )', 'espaces partout'],
      ['p.catch(() =>\n{\n})', 'retours à la ligne'],
    ])('CATCH_PROMESSE_VIDE matche %j (%s)', (source) => {
      expect(source.match(new RegExp(CATCH_PROMESSE_VIDE.source, 'g'))).not.toBeNull();
    });

    it.each([
      ['catch { log(e); }', 'bloc qui TRAITE — journalise'],
      ['catch (e) { throw e; }', 'bloc qui RELANCE'],
    ])('CATCH_BLOC_VIDE ne matche PAS %j (%s)', (source) => {
      expect(source.match(new RegExp(CATCH_BLOC_VIDE.source, 'g'))).toBeNull();
    });

    it.each([
      ['.catch((e) => report(e))', 'rejet REMONTÉ à un rapporteur'],
      ['.catch(() => setErreur(true))', 'rejet EXPOSÉ à l’écran'],
    ])('CATCH_PROMESSE_VIDE ne matche PAS %j (%s)', (source) => {
      expect(source.match(new RegExp(CATCH_PROMESSE_VIDE.source, 'g'))).toBeNull();
    });

    it('l’en-tête structuré nomme son ticket et sa baseline décroissante (#1475)', () => {
      expect(GARDE.ticket).toBe('#1577');
      expect(GARDE.baseline.decroissant).toBe(true);
      expect(GARDE.angleMort.length).toBeGreaterThan(0);
    });
  });
});
