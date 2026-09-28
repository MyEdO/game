/**
 * GARDES DES LIBELLÉS DE CHAMP (#1467 L1b V-FLIP-ENTITE-a) — ce qui tient les `MetaChamp` posées EN
 * MASSE par l'adoption de `document()`. Population : la méta de TOUS les defs adoptés (`meta` exporté
 * par le def, relevé au registre), jamais un fichier nommé à la main.
 *
 * TROIS gardes VIVANTES, toutes à tolérance ZÉRO :
 *  1. RÉPERTOIRE FERMÉ FR — chaque caractère d'un `label`/`hint` appartient à un répertoire déclaré
 *     (lettres FR accentuées, `œ`/`æ` compris, chiffres, ponctuation d'écriture). ANGLE MORT DIT :
 *     cette garde mesure le RÉPERTOIRE, jamais la QUALITÉ du français — « Zzz » y passe, un mojibake
 *     `Ã©` n'y passe pas.
 *  2. ANTI-JARGON — liste FERMÉE de lexèmes de MOTEUR qui n'ont rien à faire sous les yeux d'un
 *     joueur. `index` en est ABSENT à dessein : « index » est un mot français ordinaire (« Index du
 *     mois », `calendarIntercalary`), comme « Source », « Type » et « Table ».
 *     MESURÉ À LA NAISSANCE (2026-08-28) : la garde a trouvé 4 offenseurs, pas zéro — `id` dans
 *     `arcane-phenomena`/`driving-mishap`, `override` dans `hairs`/`renduMonte`. Les 4 sont corrigés
 *     dans le commit qui pose la garde ; le chiffre attendu était faux, la mesure fait foi.
 *  3. QUASI-DOUBLONS INTRA-DEF — deux champs d'un MÊME document ne peuvent pas porter deux libellés
 *     que la normalisation forte (minuscules, sans accents, sans ponctuation ni espaces) confond :
 *     à l'écran, l'utilisateur ne saurait pas lequel il édite.
 *
 * DEUX gardes ÉVALUÉES et RÉFUTÉES, avec leur mesure — elles ne naissent pas :
 *  - « la méta couvre EXACTEMENT les clés » : `document()` le fait DÉJÀ, dans les deux sens et au
 *    chargement (`document.ts` : « le champ « x » n'a pas de méta d'édition » / « méta d'édition « x »
 *    sans champ correspondant »). Une garde de test ne ferait que doubler un verrou de construction.
 *  - « un nom de champ RÉCURRENT porte partout LE MÊME libellé » : mesuré sur la population réelle,
 *    des divergences LÉGITIMES existent (le test `mesure les divergences de libellé` ci-dessous les
 *    compte et les NOMME) — un même nom de clé y désigne des concepts différents d'un document à
 *    l'autre. Geler l'égalité forcerait un libellé faux ; la mesure vit donc ici, en constat.
 */
import { describe, it, expect } from 'vitest';
import { SCHEMA_DEFS } from './schemas/_registry.generated';
import { replier } from '../lib/ordre.mjs';

interface Rangee {
  readonly def: string;
  readonly champ: string;
  readonly cle: 'label' | 'hint';
  readonly texte: string;
}

/** Toutes les rangées de méta de tous les defs adoptés (`meta` non vide), à plat. */
function rangees(): Rangee[] {
  const out: Rangee[] = [];
  for (const def of SCHEMA_DEFS as readonly { file: string; meta?: Record<string, { label: string; hint?: string }> }[]) {
    for (const [champ, m] of Object.entries(def.meta ?? {})) {
      out.push({ def: def.file, champ, cle: 'label', texte: m.label });
      if (m.hint !== undefined) out.push({ def: def.file, champ, cle: 'hint', texte: m.hint });
    }
  }
  return out;
}

/**
 * RÉPERTOIRE FERMÉ, réduit à ce qui est MESURÉ sur la population réelle (512 rangées au 2026-08-28,
 * vagues 11a + 11b).
 *
 * Les LETTRES sont déclarées par LANGUE : tout l'alphabet français accentué, ligatures `œ`/`æ`
 * comprises — un répertoire de langue ne se rétrécit pas à l'échantillon (`î` n'apparaît nulle part
 * aujourd'hui, il reste français). Les SIGNES, eux, sont déclarés par USAGE : chacun de ceux qui
 * suivent est compté au moins une fois dans la population —
 * `,`×125 `’`×83 `(`/`)`×80 `/`×57 `'`×42 `—`×20 `-`×20 `:`×19 `` ` ``×14 `.`×10 `=`×8 `;`×7
 * `«`/`»`×6 `+`×6 `%`×5 `…`×4 `#`×2 `→`×2 `×`×2 `≤`×2 `−`×2 `÷`×1 `!`×1, plus l'espace U+0020 et
 * les exposants ordinaux `ᵉ`×1 / `ʳ`×1.
 *
 * HORS répertoire, et pourquoi : `⇒ ≥ ≠ ±` comptent ZÉRO occurrence, et les signes de CODE
 * (`_ [ ] { } | @ $ ~ ^ * & < > " “ ” ‘ – ° ² ³ ?`) n'en comptent aucune non plus — les admettre
 * ouvrirait la porte à « Couleur ${face} » ou « payload|null » sous une garde censée FERMER le
 * répertoire. Le ban des ACCOLADES a mordu dans le lot 11b : le hint de `voyage-stakes.template`
 * montrait son trou nommé entre accolades, il le DIT désormais en français (`defs/voyage-stakes.ts`).
 * Un signe légitime qui apparaîtra plus tard fera ROUGE, et s'inscrira ici avec son compte.
 *
 * Tout le reste est un caractère ÉTRANGER — un mojibake (`Ã©`) est refusé par sa lettre `Ã`, une
 * lettre grecque ou cyrillique de même.
 */
const REPERTOIRE = /^[A-Za-zÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸÆŒàâäçéèêëîïôöùûüÿæœ0-9ᵉʳ ,()’/':—`.=+;%«»#→×≤−÷…!-]*$/u;

/**
 * ANTI-JARGON : lexèmes de MOTEUR, en liste FERMÉE. Comparés sur le mot ENTIER (frontières de mot),
 * insensibles à la casse — « Identifiant » n'est pas « id », « Table » n'est pas « bool ».
 */
const JARGON = ['id', 'ids', 'key', 'keys', 'flag', 'bool', 'boolean', 'enum', 'array', 'callback', 'override', 'wildcard', 'timestamp', 'slug', 'uid', 'payload'] as const;

/** Normalisation FORTE : ce que deux libellés doivent différer PAR AUTRE CHOSE que la décoration. */
const normalise = (s: string): string => replier(s).replace(/[^a-z0-9]/g, '');

describe('libellés de champ — répertoire, jargon, doublons (#1467 L1b)', () => {
  it('la population mesurée n’est pas vide — la garde regarde bien quelque chose', () => {
    const r = rangees();
    expect(r.length).toBeGreaterThan(100);
    expect(new Set(r.map((x) => x.def)).size).toBeGreaterThan(40);
  });

  it('RÉPERTOIRE FERMÉ : aucun caractère hors du répertoire FR déclaré', () => {
    const fautifs = rangees()
      .filter((r) => !REPERTOIRE.test(r.texte))
      .map((r) => {
        const etrangers = [...r.texte].filter((c) => !REPERTOIRE.test(c));
        return `${r.def} ${r.champ}.${r.cle} : caractère(s) hors répertoire « ${[...new Set(etrangers)].join('')} » dans « ${r.texte} »`;
      });
    expect(fautifs, `Libellé(s) hors du répertoire FR fermé :\n${fautifs.join('\n')}`).toEqual([]);
  });

  it('ANTI-JARGON : aucun lexème de moteur dans un libellé de champ', () => {
    const fautifs: string[] = [];
    for (const r of rangees()) {
      for (const mot of JARGON) {
        if (new RegExp(`(^|[^\\p{L}\\p{N}])${mot}([^\\p{L}\\p{N}]|$)`, 'iu').test(r.texte)) {
          fautifs.push(`${r.def} ${r.champ}.${r.cle} : lexème moteur « ${mot} » dans « ${r.texte} »`);
        }
      }
    }
    expect(fautifs, `Lexème(s) de moteur exposé(s) à l’écran :\n${fautifs.join('\n')}`).toEqual([]);
  });

  it('QUASI-DOUBLONS : deux champs d’un même document ne portent pas deux libellés confondus', () => {
    const fautifs: string[] = [];
    for (const def of SCHEMA_DEFS as readonly { file: string; meta?: Record<string, { label: string }> }[]) {
      const vus = new Map<string, string>();
      for (const [champ, m] of Object.entries(def.meta ?? {})) {
        const cle = normalise(m.label);
        const deja = vus.get(cle);
        if (deja) fautifs.push(`${def.file} : « ${champ} » et « ${deja} » portent le même libellé normalisé (« ${m.label} »)`);
        else vus.set(cle, champ);
      }
    }
    expect(fautifs, `Libellé(s) quasi-doublon(s) dans un même document :\n${fautifs.join('\n')}`).toEqual([]);
  });

  it('CONSTAT (garde réfutée) : mesure les divergences de libellé d’un nom de champ RÉCURRENT', () => {
    const parChamp = new Map<string, Map<string, string[]>>();
    for (const def of SCHEMA_DEFS as readonly { file: string; meta?: Record<string, { label: string }> }[]) {
      for (const [champ, m] of Object.entries(def.meta ?? {})) {
        const labels = parChamp.get(champ) ?? new Map<string, string[]>();
        labels.set(m.label, [...(labels.get(m.label) ?? []), def.file]);
        parChamp.set(champ, labels);
      }
    }
    const divergents = [...parChamp.entries()]
      .filter(([, labels]) => labels.size > 1)
      .map(([champ, labels]) => `${champ} : ${[...labels.entries()].map(([l, defs]) => `« ${l} » (${defs.join(', ')})`).join(' ≠ ')}`)
      .sort();
    // Le NOMBRE n'est pas gelé (il bougera à chaque vague d'adoption) ; ce qui est gelé, c'est le
    // FAIT qu'il existe des divergences légitimes — donc qu'aucune garde d'unicité ne peut naître.
    // Elles sont NOMMÉES ici : le constat est lisible sans relire le code (`--reporter=verbose`).
    expect(divergents, `Aucune divergence de libellé mesurée — la garde d’unicité redeviendrait posable, ré-examine sa réfutation.`).not.toEqual([]);
    console.info(`divergences de libellé mesurées (${divergents.length}) :\n  ${divergents.join('\n  ')}`);
  });
});
