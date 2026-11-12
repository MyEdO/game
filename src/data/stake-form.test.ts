/**
 * GARDE de FORME des enjeux (#1117 L0b) — la leçon des deux lots : une vérification one-shot
 * n'existe pas, elle se COMMITTE. Chaque entrée de `stakes.json` déclare STRUCTURELLEMENT ce qu'est
 * son `template` (champ `form`), et la garde tient la promesse correspondante :
 *
 *  • `verbatim` : CHAQUE bloc du `template` est une sous-chaîne CONTIGUË d'UNE ligne du chapitre
 *    cité par `source.note` — donc recollable tel quel (règle stricte 5), sans préfixe fabriqué et
 *    sans fragment qui enjambe une coupure de folio (les marqueurs `data-folio` coupent les lignes) ;
 *  • `descripteur` : assemblage MÉCANIQUE assumé (ce que l'applier fait) — aucune contiguïté promise ;
 *    la porte vers la règle est exigée par le schéma (`schemas/defs/stakes.ts`), sauf au voyage.
 *
 * Un assemblage NON déclaré échoue : c'est exactement le défaut qu'avait `maladie-test-quotidien` (préfixes
 * « **Blessé :** »/« **Toxine :** » fabriqués, 2ᵉ fragment à cheval sur deux folios).
 */
import { describe, it, expect } from 'vitest';
import { chapterFile, readText, sigleDe } from '../../scripts/guards/lib/rawRefIntegrity.mjs';
import { STAKES, ACTIVITY_STAKES, etats } from './index';
import { ACTIVITIES } from '../engine/activities';
import { STAKE_FORMS, type StakeForm } from '../engine/types';
import { coupeAuMot } from '../lib/coupeAuMot.mjs';


/** Lignes du fichier de CHAPITRE cité par une note (`LDB 18 l.342` → `18 - Traumatisme.md`). */
const chapterCache = new Map<string, string[]>();
function chapterLines(bookId: string, note: string): string[] {
  const chap = /^\S+\s+(\d+)/.exec(note)?.[1];
  if (!chap) throw new Error(`note sans numéro de chapitre : « ${note} »`);
  const key = `${bookId}#${chap}`;
  if (!chapterCache.has(key)) {
    const abbr = sigleDe(bookId);
    const fichier = abbr ? chapterFile(abbr, chap) : null;
    if (!fichier) throw new Error(`chapitre ${chap} introuvable pour le livre ${bookId}`);
    chapterCache.set(key, readText(fichier.path).split('\n'));
  }
  return chapterCache.get(key)!;
}

/** Un bloc est CONTIGU s'il est sous-chaîne d'UNE ligne du chapitre (jamais d'un corpus recollé :
 *  une concaténation ferait passer un fragment à cheval sur deux lignes/folios). */
const contigu = (lines: string[], bloc: string) => lines.some((l) => l.includes(bloc));

describe('stakes — la FORME de chaque enjeu est déclarée et tenue (#1117 L0b)', () => {
  it('tout `template` déclaré VERBATIM est contigu au chapitre cité, bloc par bloc', () => {
    const defauts: string[] = [];
    for (const e of STAKES) {
      if (e.form !== 'verbatim') continue;
      const lines = chapterLines(e.source.book, e.source.note ?? '');
      for (const bloc of e.template!.split('\n\n')) {
        if (!contigu(lines, bloc)) {
          defauts.push(`${e.id} : bloc NON contigu au Source (${e.source.note}) — « ${coupeAuMot(bloc, 70)} »`);
        }
      }
    }
    expect(defauts, 'un assemblage qui se présente comme du verbatim : le déclarer `descripteur` ou le rendre contigu').toEqual([]);
  });

  it('le stock d’assemblages de la NUIT est NOMMÉ et borné', () => {
    // Chaque `descripteur` de nuit est un choix motivé, pas un repli.
    expect(STAKES.filter((e) => e.cascade === 'nuit' && e.form === 'descripteur').map((e) => e.id).sort())
      .toEqual(['cauchemar', 'maladie-test-quotidien']);
  });

  it('FAIL-CLOSED : un fragment fabriqué ou à cheval sur deux lignes est DÉTECTÉ', () => {
    const lines = chapterLines('livre-de-base', 'LDB 20 l.145');
    // Le vrai passage du symptôme Blessé — contigu.
    expect(contigu(lines, "ou subissez une Blessure Purulente si vous n'en avez pas déjà une.")).toBe(true);
    // Le préfixe FABRIQUÉ (la source titre `### **Blessé**`, elle n'écrit jamais « **Blessé :** »).
    expect(contigu(lines, '**Blessé :** Chaque jour')).toBe(false);
    // Un fragment recollé par-dessus la coupure de folio de Toxine (l.212 → l.215).
    expect(contigu(lines, 'tous les jours (en général pendant votre sommeil)')).toBe(false);
  });
});

/** MÊME contrat de forme pour l'enjeu de RÉCUPÉRATION porté par l'État (`etats.json`, `recover.enjeu`). */
describe('etats — la FORME de chaque enjeu de récupération est tenue', () => {
  it('tout `recover.enjeu` déclaré VERBATIM est localisable ET contigu au chapitre cité, bloc par bloc', () => {
    const defauts: string[] = [];
    for (const e of etats.filter((x) => x.recover?.form === 'verbatim')) {
      const note = (e.source as { note?: string }).note;
      if (!note) { defauts.push(`${e.id} : verbatim sans source.note — passage non localisable`); continue; }
      const lines = chapterLines(e.source.book, note);
      for (const bloc of e.recover!.enjeu.split('\n\n')) {
        if (!contigu(lines, bloc)) defauts.push(`${e.id} : bloc NON contigu au Source (${note}) — « ${coupeAuMot(bloc, 70)} »`);
      }
    }
    expect(defauts, 'le déclarer `descripteur` ou le rendre contigu').toEqual([]);
  });
});

/**
 * MÊME contrat de forme pour les ACTIVITÉS (#1117 L3), 4ᵉ dataset d'enjeux — porté par l'ENTITÉ
 * (`activities.json`, champs `stake`/`stakeForm`). La différence d'ancrage est nommée : une Activité
 * cite son folio (`source.page`), pas une ligne de chapitre — un enjeu déclaré `verbatim` doit donc
 * fournir `source.note` pour être localisable, faute de quoi la contiguïté n'est pas démontrable et
 * le régime est refusé. La branche `verbatim` est tenue par le FAIL-CLOSED ci-dessous, pas par un
 * échantillon.
 */
describe('activities — la FORME de chaque enjeu d’Activité est déclarée et tenue (#1117 L3)', () => {
  const avecEnjeu = ACTIVITY_STAKES.filter((a) => a.stake);

  it('toute Activité qui porte un enjeu DÉCLARE sa forme', () => {
    const sans = avecEnjeu.filter((a) => !STAKE_FORMS.includes(a.stakeForm as StakeForm)).map((a) => a.id);
    expect(sans, 'un assemblage qui ne dit pas ce qu’il est').toEqual([]);
  });

  it('tout `stake` déclaré VERBATIM est localisable ET contigu au chapitre cité, bloc par bloc', () => {
    const defauts: string[] = [];
    for (const a of avecEnjeu.filter((x) => x.stakeForm === 'verbatim')) {
      const entry = ACTIVITIES.find((x) => x.id === a.id)!;
      const note = (entry.source as { note?: string }).note;
      if (!note) { defauts.push(`${a.id} : verbatim sans source.note — passage non localisable`); continue; }
      const lines = chapterLines(entry.source.book, note);
      for (const bloc of a.stake!.split('\n\n')) {
        if (!contigu(lines, bloc)) defauts.push(`${a.id} : bloc NON contigu au Source (${note}) — « ${coupeAuMot(bloc, 70)} »`);
      }
    }
    expect(defauts, 'le déclarer `descripteur` ou le rendre contigu').toEqual([]);
  });

  it('FAIL-CLOSED : le même `contigu` reconnaît un passage réel d’activité et rejette un assemblage', () => {
    const lines = chapterLines('ennemi-dans-l-ombre-compagnon', 'EDOC 8 l.157');
    expect(contigu(lines, 'les Personnages ne peuvent pas être surpris pendant cette étape de leur voyage.')).toBe(true);
    // Le descripteur mécanique de « Rester aux aguets » n'est PAS du verbatim — le déclarer tel échouerait.
    expect(contigu(lines, 'Réussite : le groupe ne peut pas être surpris pendant cette Étape.')).toBe(false);
  });
});
