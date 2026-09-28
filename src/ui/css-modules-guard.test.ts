import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { reglesCss, FEUILLES_PARTAGEES, declarations, estPlacement, modulesDePrimitive } from '../../scripts/guards/lib/cssCouches.mjs';
import { imageDuDisque } from '../../scripts/guards/lib/cssCouchesAudit.js';
import { OWNERS, CADRES } from '../../scripts/guards/lib/marqueursPossedes.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * #1806 — le module CSS d'une PRIMITIVE est le SEUL foyer de ce qu'elle peint (règle A1,
 * `docs/charte-ui.md` § Architecture CSS). Deux gardes, deux défauts distincts que le stock (xxi) ne voit PAS :
 *
 *   §5.3 REPEINT — une classe DÉFINIE ailleurs (couche partagée ou module d'une autre primitive) est
 *   repeinte depuis une feuille tierce : la cascade décide alors du rendu selon l'ordre d'import, et
 *   la même classe n'a plus une seule matière. Un DESCENDANT sous un contexte de PRIMITIVE reste une
 *   spécialisation légitime (la primitive sait ce qu'elle héberge) ; un contexte d'ÉCRAN, non.
 *
 *   §5.4 DESTINATION NOMMÉE — une famille de classes migrée vers le module de sa primitive ne se
 *   RECRÉE pas dans un module d'écran : le préfixe porte sa destination, la garde la nomme.
 *
 * Les deux stocks sont NOMINATIFS et DÉCROISSANTS : une entrée soldée doit être retirée.
 */

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const lire = (rel: string) => readFileSync(`${RACINE}${rel}`, 'utf8');

const classesDe = (sel: string): string[] => (sel.match(/\.[a-zA-Z_-][\w-]*/g) ?? []).map((x) => x.slice(1));
/** Le sélecteur SANS les arguments de ses pseudo-classes fonctionnelles : `:has(> .x .y)` porte des
 *  combinateurs et des classes qui ne sont PAS le sujet de la règle — les garder ferait passer
 *  `label:has(> .btn)` pour une règle de `.btn`. Les arguments restent lisibles à part (contexte). */
const sansArguments = (sel: string): string => {
  let prof = 0;
  let out = '';
  for (const c of sel) {
    if (c === '(') { prof++; if (prof === 1) out += '()'; continue; }
    if (c === ')') { prof--; continue; }
    if (prof === 0) out += c;
  }
  return out;
};
/** Les parties d'un sélecteur, combinateurs retirés — la DERNIÈRE est ce que la règle vise. */
const parties = (sel: string): string[] => sansArguments(sel).trim().split(/\s+|>|\+|~/).filter(Boolean);
/** Les classes citées DANS les arguments d'une pseudo-classe (`:has(.modal-body)`) : du contexte. */
const classesInternes = (sel: string): string[] =>
  (sel.match(/\(([^()]*)\)/g) ?? []).flatMap((arg) => classesDe(arg));

/** Les classes DÉFINIES par une feuille : celles d'un sélecteur SANS combinateur (un descendant
 *  spécialise un contexte, il ne définit rien). La première classe du compound porte le domaine. */
function classesDefinies(rel: string): Set<string> {
  const out = new Set<string>();
  for (const r of reglesCss(lire(rel))) {
    for (const sel of r.selecteurs) {
      const p = parties(sel);
      if (p.length !== 1) continue;
      const c = classesDe(p[0])[0];
      if (c) out.add(c);
    }
  }
  return out;
}

/** classe → feuille PROPRIÉTAIRE (couche partagée d'abord, puis modules de primitive). */
function proprietaires(): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of [...FEUILLES_PARTAGEES, ...modulesDePrimitive(imageDuDisque().manifeste)]) {
    if (!existsSync(`${RACINE}${f}`)) continue;
    for (const c of classesDefinies(f)) if (!map.has(c)) map.set(c, f);
  }
  return map;
}

/**
 * Stock MESURÉ des repeints (2026-09-18, #1806 2c) : chacun est un écran qui redéfinit la matière
 * d'une classe qu'il ne possède pas. Clé = `feuille|sélecteur`, valeur = la feuille propriétaire.
 * Aucun n'appartient à la vague JET : ils se soldent à leur propre lot, et la garde interdit le
 * SUIVANT.
 */
const REPEINTS_STOCK: readonly string[] = [
  "src/ui/styles/compendium.css|.chip.codex-facet.on",
  "src/ui/styles/compendium.css|.codex-cat.on .count",
  "src/ui/styles/creator-shell.css|.screen.creator",
  "src/ui/styles/creator.css|.creator-race-grid .fig-tile.rolled",
  "src/ui/styles/creator.css|.creator-step > .master-detail-list::after",
  "src/ui/styles/creator.css|.creator-step > .master-detail-list::before",
  "src/ui/styles/creator.css|.creator-step > .master-detail-list[data-at-bottom]::after",
  "src/ui/styles/creator.css|.creator-step > .master-detail-list[data-at-top]::before",
  "src/ui/styles/creator.css|.main-head .hint",
  "src/ui/styles/creator.css|.tag.char",
  "src/ui/styles/editor.css|.insp-fold .fold-title",
  "src/ui/styles/merchant.css|.merchant-body .empty",
  "src/ui/styles/party.css|.candidate-fig > .charprev",
  "src/ui/styles/party.css|.card-roles .entity-chip",
  "src/ui/styles/party.css|.card-roles .entity-chip:focus-within",
  "src/ui/styles/party.css|.card-roles .entity-chip:hover",
  "src/ui/styles/party.css|.party-actions .btn",
  // RÉVÉLÉ (pas créé) au 2d de #1806 : déclarer `rigPortrait` donne un propriétaire à `.rig-portrait`,
  // et la fiche PEINT le visage en médaillon depuis son écran (rayon 999px, ombre portée). Mesuré au
  // site : `width`/`height: 112px` y sont MORTS (`.ptile .ptile-face .rig-portrait`, 0-3-0, les bat),
  // et `border-width: 3px` y est redondant — restent un rayon et une ombre, qui appellent un TON de la
  // primitive et une prop traversant `PortraitTile`. Soldé au lot de la fiche (épic #1811).
  "src/ui/styles/sheet.css|.sheet-portrait .rig-portrait",
  "src/ui/styles/sheet.css|[data-tone] .plaque-row",
  "src/ui/styles/sheet.css|[data-tone='ambre'] .plaque-row",
  "src/ui/styles/sheet.css|[data-tone='sang'] .plaque-row",
  "src/ui/styles/sheet.css|[data-tone='violet'] .plaque-row",
  "src/ui/styles/world-meta.css|.btn.ghost",
];

/** Un site de repeint mesuré : `feuille|sélecteur` + la feuille qui possède la classe. */
export function sitesRepeint(feuilles: readonly { rel: string; text: string }[]): string[] {
  const proprio = proprietaires();
  const primitives = modulesDePrimitive(imageDuDisque().manifeste);
  const classesDePrimitive = new Set([...primitives].filter((f) => existsSync(`${RACINE}${f}`)).flatMap((f) => [...classesDefinies(f)]));
  const out: string[] = [];
  for (const { rel, text } of feuilles) {
    if (FEUILLES_PARTAGEES.includes(rel)) continue;
    const siennes = primitives.has(rel) ? new Set(classesDe(text)) : new Set<string>();
    for (const r of reglesCss(text)) {
      if (!declarations(r.corps).some((d) => !estPlacement(d.prop, d.valeur))) continue;
      for (const sel of r.selecteurs) {
        const p = parties(sel);
        const droite = p.pop() ?? '';
        const c = classesDe(droite)[0];
        if (!c) continue;
        const chez = proprio.get(c);
        if (!chez || chez === rel) continue;
        // Contexte = ce qui est à GAUCHE, plus ce qu'un `:has()`/`:not()` de la règle nomme.
        const contexte = [...p.flatMap(classesDe), ...classesInternes(sel)];
        if (contexte.some((x) => classesDePrimitive.has(x) || siennes.has(x))) continue;
        out.push(`${rel}|${sel}`);
      }
    }
  }
  return out;
}

/**
 * §5.3 ÉTENDUE AUX CADRES (#1920) — une classe d'un cadre (table `OWNERS`, propriétaires dans
 * `CADRES`) n'est visée que par son FOYER : la feuille que le manifeste donne à son propriétaire,
 * sinon celles qui la définissent. Ailleurs, la nommer — sujet, contexte ou argument de `:has()`,
 * placement compris — est un site. Tolérance zéro, sans stock.
 */
export function sitesCadreVise(feuilles: readonly { rel: string; text: string }[]): string[] {
  const manifeste = imageDuDisque().manifeste;
  const cssDe = new Map(manifeste.flatMap((e) => (e.fichier && e.css ? [[e.fichier, e.css] as const] : [])));
  const definies = new Map<string, Set<string>>();
  for (const { rel, text } of feuilles) {
    for (const r of reglesCss(text)) {
      for (const sel of r.selecteurs) {
        const p = parties(sel);
        const c = p.length === 1 ? classesDe(p[0])[0] : undefined;
        if (c) definies.set(c, (definies.get(c) ?? new Set()).add(rel));
      }
    }
  }
  const foyers = new Map<string, Set<string>>();
  for (const [classe, proprios] of Object.entries(OWNERS)) {
    if (!proprios.every((f) => CADRES.includes(f))) continue;
    const css = proprios.map((f) => cssDe.get(`src/ui/${f}`)).filter((x): x is string => !!x);
    foyers.set(classe, new Set(css.length ? css : definies.get(classe) ?? []));
  }
  const out: string[] = [];
  for (const { rel, text } of feuilles) {
    for (const r of reglesCss(text)) {
      for (const sel of r.selecteurs) {
        if (classesDe(sel).some((c) => foyers.has(c) && !foyers.get(c)!.has(rel))) out.push(`${rel}|${sel}`);
      }
    }
  }
  return out;
}

/** Chaque balise `<nom …>` d'un source : ses PROPS de premier niveau (`{ nom de prop → valeur brute }`,
 *  `"littéral"` ou `{expression}`), et l'étendue de l'ÉLÉMENT (`debut`, `fin` : après `/>`, ou après
 *  la première `</nom>` qui suit). La balise est lue jusqu'à son `>` hors accolades — un prop JSX
 *  peut contenir `>` (`=>`, `<Icon />`) et des éléments qui ont leur propre `className` (`footer`). */
function balises(text: string, nom: RegExp): { props: Map<string, string>; debut: number; fin: number }[] {
  const out: { props: Map<string, string>; debut: number; fin: number }[] = [];
  for (const m of text.matchAll(new RegExp(`<(${nom.source})\\b`, 'g'))) {
    const props = new Map<string, string>();
    let i = m.index! + m[0].length;
    for (; i < text.length && text[i] !== '>'; i++) {
      const p = /^\s([A-Za-z][\w-]*)=/.exec(text.slice(i, i + 40));
      if (p) {
        let j = i + p[0].length;
        const debut = j;
        if (text[j] === '"') j = text.indexOf('"', j + 1) + 1;
        else if (text[j] === '{') {
          for (let prof = 0; j < text.length; j++) {
            if (text[j] === '{') prof++;
            else if (text[j] === '}' && --prof === 0) { j++; break; }
          }
        }
        props.set(p[1], text.slice(debut, j));
        i = j - 1;
      } else if (text[i] === '{') {
        const debut = i;
        for (let prof = 0; i < text.length; i++) {
          if (text[i] === '{') prof++;
          else if (text[i] === '}' && --prof === 0) break;
        }
        const spread = /^\{\s*\.\.\.([\s\S]*)\}$/.exec(text.slice(debut, i + 1));
        if (spread) props.set(`...${props.size}`, spread[1].trim());
      }
    }
    const fermeture = text.indexOf(`</${m[1]}>`, i);
    const fin = text[i - 1] === '/' || fermeture < 0 ? i + 1 : fermeture + m[1].length + 3;
    out.push({ props, debut: m.index!, fin });
  }
  return out;
}

function propsDeBalises(text: string, nom: RegExp): Map<string, string>[] {
  return balises(text, nom).map((b) => b.props);
}

/** Initialiseur de la déclaration `const|let|var <nom> = …` du source : jusqu'au `;` hors parenthèses,
 *  crochets et accolades, ou à la fin d'une ligne que la suivante ne prolonge pas (opérateur en tête
 *  ou en fin de ligne : ternaire, `&&`, `+`…). */
function initialiseur(text: string, nom: string): string | undefined {
  const m = new RegExp(`\\b(?:const|let|var)\\s+${nom}\\s*(?::[^=]+)?=\\s*`).exec(text);
  if (!m) return undefined;
  const debut = m.index + m[0].length;
  let prof = 0;
  let i = debut;
  for (; i < text.length; i++) {
    const c = text[i];
    if ('([{'.includes(c)) prof++;
    else if (')]}'.includes(c)) prof--;
    else if (c === ';' && prof <= 0) break;
    else if (c === '\n' && prof <= 0) {
      const avant = text.slice(debut, i).trimEnd();
      const apres = text.slice(i + 1).trimStart();
      if (!/[?:&|+\-=,.(]$/.test(avant) && !/^(\?|:|&&|\|\||\?\?|\+|\.)/.test(apres)) break;
    }
  }
  return text.slice(debut, i);
}

/** Les classes qu'une valeur de `className` peut poser : le littéral, chaque chaîne d'une expression
 *  (ternaire, appel, gabarit hors `${…}`), et l'initialiseur de chaque variable qu'elle nomme, lu dans
 *  le même source. */
function classesDeValeur(valeur: string, text: string, vues: Set<string> = new Set()): string[] {
  const expr = valeur.startsWith('"') ? valeur : valeur.replace(/^\{([\s\S]*)\}$/, '$1').replace(/`/g, '"').replace(/\$\{/g, '" ').replace(/\}/g, ' "');
  const chaines = [...expr.matchAll(/'([^']*)'|"([^"]*)"/g)].flatMap((m) => (m[1] ?? m[2]).split(/\s+/));
  const horsChaines = expr.replace(/'[^']*'|"[^"]*"/g, ' ');
  const variables = [...horsChaines.matchAll(/(?<![\w.$])([A-Za-z_$][\w$]*)\b/g)].map((m) => m[1]).filter((n) => !vues.has(n));
  const deVariables = variables.flatMap((n) => {
    vues.add(n);
    const init = initialiseur(text, n);
    return init ? classesDeValeur(`{${init}}`, text, vues) : [];
  });
  return [...chaines, ...deVariables].filter((c) => /^[a-z][\w-]*$/.test(c));
}

/** La valeur de `className` d'un objet étalé (`{...{ className: … }}`, `{...props}` initialisé dans
 *  le même source). */
function classNameEtale(etale: string, text: string): string | undefined {
  const objet = /^[A-Za-z_$][\w$]*$/.test(etale) ? initialiseur(text, etale) ?? '' : etale;
  return /\bclassName\s*:\s*([^,}]+)/.exec(objet)?.[1];
}

/** Les CO-CLASSES DE BOÎTE : ce qu'un appelant passe en `className` à un cadre (`<Modal>`,
 *  `<ScreenShell>`), en prop ou par un objet étalé, littéral, expression ou variable. */
export function coClassesDeBoite(sources: readonly { text: string }[]): Set<string> {
  const out = new Set<string>();
  for (const { text } of sources) {
    for (const props of propsDeBalises(text, /Modal|ScreenShell/)) {
      const valeurs = [props.get('className'), ...[...props].filter(([k]) => k.startsWith('...')).map(([, v]) => classNameEtale(v, text))];
      for (const v of valeurs) if (v) classesDeValeur(v.startsWith('"') ? v : `{${v}}`, text).forEach((c) => out.add(c));
    }
  }
  return out;
}

/**
 * RAIL DANS LE RAIL (#1920) — le rail `.screen-scroll` appartient à `ScreenShell` : il le pose autour
 * d'un corps borné (`body='centered'`, `'centered-wide'`), et un canevas (`body='full'`) compose le
 * sien (`docs/charte-ui.md`, « `ScreenShell` »). Hors de la coquille, un `screen-scroll` nommé doit
 * donc se trouver DANS un élément `<ScreenShell>` dont le `body` est `'full'` (absent ou littéral) :
 * un `body` en expression, un composant rendu ailleurs (même exporté d'un fichier-canevas) rougissent.
 * Tolérance zéro, sans stock.
 */
export function sitesRailHorsCanevas(sources: readonly { rel: string; text: string }[]): string[] {
  const out: string[] = [];
  for (const { rel, text } of sources) {
    if (/\bexport function ScreenShell\b/.test(text)) continue;
    const canevas = balises(text, /ScreenShell/).filter((b) => [undefined, '"full"'].includes(b.props.get('body')));
    let debutLigne = 0;
    text.split('\n').forEach((ligne, i) => {
      for (const m of ligne.matchAll(/'[^']*'|"[^"]*"|`[^`]*`/g)) {
        if (!/(^|[\s'"`])screen-scroll([\s'"`]|$)/.test(m[0])) continue;
        const o = debutLigne + m.index!;
        if (!canevas.some((b) => b.debut < o && o < b.fin)) { out.push(`${rel}:${i + 1}`); break; }
      }
      debutLigne += ligne.length + 1;
    });
  }
  return out;
}

/**
 * §5.3 ÉTENDUE AUX CO-CLASSES DE BOÎTE (#1920) — une co-classe passée à un cadre (`Modal`,
 * `ScreenShell`) est un crochet pour les DESCENDANTS de l'appelant ; une règle dont elle est le SUJET
 * peint ou dimensionne la boîte elle-même, ce qui est un état du cadre (`taille`, `gangrene`,
 * `ambiance`…). Tolérance zéro, sans stock.
 */
export function sitesCoClasseVisee(feuilles: readonly { rel: string; text: string }[], coClasses: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const { rel, text } of feuilles) {
    for (const r of reglesCss(text)) {
      for (const sel of r.selecteurs) {
        const sujet = parties(sel).pop() ?? '';
        if (classesDe(sujet).some((c) => coClasses.has(c))) out.push(`${rel}|${sel}`);
      }
    }
  }
  return out;
}

/** Préfixe de la vague JET → module de destination. La famille a un FOYER, nommé ici. */
const FAMILLES_JET: readonly (readonly [string, string])[] = [
  ['rm-', 'le module de la primitive qui pose la classe (roll-shell, roll-line, dice-roll, option-chooser, vs-header)'],
  ['prow', 'roll-row.css'],
  ['rr-', 'roll-panel.css'],
  ['mrl', 'multi-roll-list.css'],
  ['crit-', 'reveal-body.css'],
  ['recap-', 'recap-line.css'],
  ['insp-', 'inspect-panel.css'],
  ['eq-', 'equipment-panel.css'],
  ['equip-', 'equipment-panel.css'],
  ['set-', 'equipment-panel.css'],
  ['jr-', 'log-drawer.css'],
  ['cb-', 'combat-banner.css'],
  ['nm-', 'team-segments.css'],
  ['d100', 'dice-roll.css'],
  ['rs-', 'roll-shell.css'],
];

/**
 * EXEMPTIONS AU SITE (`feuille|classe`, jamais au FICHIER) : une collision de PRÉFIXE n'est pas une
 * famille. Les trois classes de l'inspecteur d'éditeur sont posées par le seul `editor/Inspector.tsx`
 * et ne servent AUCUN panneau d'inspection de jeu — l'en-tête, lui, est bien partagé (`.insp-head`,
 * `inspect-panel.css`).
 */
const FAMILLE_EXEMPT_SITES = new Map<string, string>([
  ['src/ui/styles/editor.css|insp-title', 'titre de l’inspecteur d’ÉDITEUR (`editor/Inspector.tsx`), pas du panneau d’inspection'],
  ['src/ui/styles/editor.css|insp-actions', 'barre d’actions de l’inspecteur d’ÉDITEUR'],
  ['src/ui/styles/editor.css|insp-content', 'corps défilant de l’inspecteur d’ÉDITEUR'],
]);

/** Les classes d'une famille JET définies dans un module d'ÉCRAN, avec leur destination. */
export function sitesFamilleEgaree(feuilles: readonly { rel: string; text: string }[]): string[] {
  const primitives = modulesDePrimitive(imageDuDisque().manifeste);
  const out: string[] = [];
  for (const { rel, text } of feuilles) {
    if (FEUILLES_PARTAGEES.includes(rel) || primitives.has(rel)) continue;
    for (const r of reglesCss(text)) {
      for (const sel of r.selecteurs) {
        const p = parties(sel);
        if (p.length !== 1) continue;
        const c = classesDe(p[0])[0];
        if (!c || FAMILLE_EXEMPT_SITES.has(`${rel}|${c}`)) continue;
        const fam = FAMILLES_JET.find(([prefixe]) => c.startsWith(prefixe));
        if (fam) out.push(`${rel} : .${c} → ${fam[1]}`);
      }
    }
  }
  return out;
}

describe('#1806 — un module de primitive est le seul foyer de ce qu’il peint', () => {
  const feuilles = imageDuDisque().fichiers;

  it('§5.3 aucun REPEINT neuf d’une classe possédée ailleurs (stock nominatif)', () => {
    const mesures = sitesRepeint(feuilles);
    const neufs = mesures.filter((s) => !REPEINTS_STOCK.includes(s));
    expect(neufs, `Classe REPEINTE hors de son module propriétaire — la matière doit rester UNIQUE :\n${neufs.join('\n')}`).toEqual([]);
    const soldes = REPEINTS_STOCK.filter((s) => !mesures.includes(s));
    expect(soldes, `Entrée(s) SOLDÉE(s) du stock de repeints — retirer la ligne :\n${soldes.join('\n')}`).toEqual([]);
  });

  it('§5.3 preuve par mutation — un écran qui repeint une classe partagée rougit', () => {
    const faux = [{ rel: 'src/ui/styles/faux-ecran.css', text: '.faux-panneau .btn { color: var(--gold) }' }];
    expect(sitesRepeint(faux)).toEqual(['src/ui/styles/faux-ecran.css|.faux-panneau .btn']);
    const placement = [{ rel: 'src/ui/styles/faux-ecran.css', text: '.faux-panneau .btn { margin-top: var(--sp-md) }' }];
    expect(placement.length && sitesRepeint(placement), 'un PLACEMENT sous contexte d’écran reste légitime').toEqual([]);
  });

  it('§5.3 le SUJET d’une règle n’est pas ce que son `:has()` nomme', () => {
    // `label:has(> .btn)` peint le LABEL, pas le bouton : compter `.btn` pour sujet inventerait un
    // repeint (et la découpe naïve sur `,` inventait en plus une règle « `> .btn)` »).
    const faux = [{ rel: 'src/ui/styles/faux-ecran.css', text: "label:has(> a, > .btn) { color: var(--gold) }" }];
    expect(sitesRepeint(faux)).toEqual([]);
  });

  it('§5.3 étendue aux CADRES : aucune feuille hors de leur foyer ne vise leurs classes, placement compris', () => {
    const sites = sitesCadreVise(feuilles);
    expect(sites, `Classe d'un CADRE visée hors de son foyer — passer par un état \`data-*\` du cadre :\n${sites.join('\n')}`).toEqual([]);
  });

  it('§5.3 étendue, preuve par mutation — un PLACEMENT ou un contexte qui nomme un cadre rougit', () => {
    const faux = [
      { rel: 'src/ui/styles/faux-ecran.css', text: '.faux-panneau .cadre-pied { margin-top: 0 }' },
      { rel: 'src/ui/styles/faux-ecran2.css', text: '.faux:has(> .modal-body) { gap: 4px }' },
      { rel: 'src/ui/styles/faux-ecran3.css', text: '.faux-panneau .btn { margin-top: 0 }' },
    ];
    expect(sitesCadreVise(faux)).toEqual([
      'src/ui/styles/faux-ecran.css|.faux-panneau .cadre-pied',
      'src/ui/styles/faux-ecran2.css|.faux:has(> .modal-body)',
    ]);
  });

  it('§5.3 étendue aux CO-CLASSES DE BOÎTE : aucune règle ne prend la boîte d’un cadre (`Modal`, `ScreenShell`) pour sujet', () => {
    const coClasses = coClassesDeBoite(readCorpus(['src/ui'], { exts: ['.tsx'] }));
    const sites = sitesCoClasseVisee(feuilles, coClasses);
    expect(sites, `Co-classe de boîte prise pour SUJET — la géométrie et la matière de la boîte sont des états de son cadre :\n${sites.join('\n')}`).toEqual([]);
  });

  it('§5.3 co-classes, preuve par mutation — la boîte visée rougit, un descendant non', () => {
    const coClasses = coClassesDeBoite([{ text: '<Modal title={<b className="btn">x</b>} onClose={() => a > b} className="faux-boite">' }]);
    expect([...coClasses]).toEqual(['faux-boite']);
    const faux = [
      { rel: 'src/ui/styles/faux-ecran.css', text: '.faux-boite { width: 900px; padding: 0 }' },
      { rel: 'src/ui/styles/faux-ecran2.css', text: '.faux-boite[data-corruption] { border-top-color: red }' },
      { rel: 'src/ui/styles/faux-ecran3.css', text: '.faux-boite .rm-loc-grid { gap: 4px }' },
    ];
    expect(sitesCoClasseVisee(faux, coClasses)).toEqual([
      'src/ui/styles/faux-ecran.css|.faux-boite',
      'src/ui/styles/faux-ecran2.css|.faux-boite[data-corruption]',
    ]);
  });

  it('§5.3 co-classes de `ScreenShell` — un écran qui repeint la boîte de sa coquille rougit', () => {
    const coClasses = coClassesDeBoite([{ text: '<ScreenShell title="x" onClose={() => a > b} className="faux-ecran">' }]);
    expect([...coClasses]).toEqual(['faux-ecran']);
    const faux = [
      { rel: 'src/ui/styles/faux-ecran.css', text: '.faux-ecran { background: var(--bg); overflow: auto }' },
      { rel: 'src/ui/styles/faux-ecran2.css', text: '.faux-ecran .wme-body { gap: 4px }' },
    ];
    expect(sitesCoClasseVisee(faux, coClasses)).toEqual(['src/ui/styles/faux-ecran.css|.faux-ecran']);
  });

  it('§5.3 co-classes lues aussi dans une EXPRESSION (`className={…}` : ternaire, gabarit, appel)', () => {
    const coClasses = coClassesDeBoite([
      { text: '<Modal title="x" className={ouvert ? "faux-a" : \'faux-b\'}>' },
      { text: '<ScreenShell title="x" onClose={f} className={`faux-c ${x ? "faux-d" : ""}`}>' },
      { text: '<Modal title="x" className={clsx("faux-clsx", on && "faux-on")}>' },
    ]);
    expect([...coClasses].sort()).toEqual(['faux-a', 'faux-b', 'faux-c', 'faux-clsx', 'faux-d', 'faux-on']);
  });

  it('§5.3 co-classes lues à travers une VARIABLE et un objet ÉTALÉ (sonde du juge B8)', () => {
    expect([...coClassesDeBoite([{ text: 'const cls = "faux-var";\n<Modal title="x" className={cls}>' }])]).toEqual(['faux-var']);
    expect([...coClassesDeBoite([{ text: 'const base = "faux-base";\nconst cls = `${base} faux-var2`;\n<Modal title="x" className={cls}>' }])].sort()).toEqual(['faux-base', 'faux-var2']);
    expect([...coClassesDeBoite([{ text: '<Modal title="x" {...{ className: "faux-spread" }}>' }])]).toEqual(['faux-spread']);
    expect([...coClassesDeBoite([{ text: 'const p = { title: "Titre", className: "faux-props" };\n<Modal {...p}>' }])]).toEqual(['faux-props']);
  });

  it('§5.3 co-classes lues dans un initialiseur sur PLUSIEURS lignes (sonde du juge B9)', () => {
    expect([...coClassesDeBoite([{ text: 'const cls = large\n  ? "faux-a"\n  : "faux-b";\n<Modal title="x" className={cls}>' }])].sort()).toEqual(['faux-a', 'faux-b']);
    expect([...coClassesDeBoite([{ text: 'const cls = [\n  "faux-c",\n  on && "faux-d",\n].join(" ");\n<Modal title="x" className={cls}>' }])].sort()).toEqual(['faux-c', 'faux-d']);
    expect([...coClassesDeBoite([{ text: 'const cls = "faux-e"\nconst autre = "pas-une-co-classe";\n<Modal title="x" className={cls}>' }])]).toEqual(['faux-e']);
  });

  it('rail dans le rail : seul un canevas (`body="full"`) compose `.screen-scroll` hors de la coquille', () => {
    const sites = sitesRailHorsCanevas(readCorpus(['src/ui'], { exts: ['.tsx'] }));
    expect(sites, `\`.screen-scroll\` posé hors d'un canevas \`ScreenShell body="full"\` rendu par le même fichier :\n${sites.join('\n')}`).toEqual([]);
  });

  it('rail dans le rail, preuve par mutation — corps borné, `body` en expression, enfant d’un autre fichier (sonde du juge B8)', () => {
    const borne = '<ScreenShell title="x" onClose={() => a > b} body="centered">\n  <Split className="screen-scroll port-yard">\n</ScreenShell>';
    const expr = '<ScreenShell title="x" onClose={f} body={large ? "centered-wide" : "centered"}>\n  <div className="screen-scroll">x</div>\n</ScreenShell>';
    const hote = '<ScreenShell title="x" onClose={f} body="centered">\n  <Escale />\n</ScreenShell>';
    const enfant = 'export function Escale() {\n  return <div className="screen-scroll escale">x</div>;\n}';
    const canevas = '<ScreenShell title="x" onClose={f}>\n  <Split className="screen-scroll carte">\n</ScreenShell>';
    const canevasFull = '<ScreenShell title="x" onClose={f} body="full">\n  <div className="screen-scroll">\n</ScreenShell>';
    expect(sitesRailHorsCanevas([
      { rel: 'Borne.tsx', text: borne }, { rel: 'Expr.tsx', text: expr }, { rel: 'Hote.tsx', text: hote }, { rel: 'Escale.tsx', text: enfant },
      { rel: 'Canevas.tsx', text: canevas }, { rel: 'CanevasFull.tsx', text: canevasFull },
    ])).toEqual(['Borne.tsx:2', 'Expr.tsx:2', 'Escale.tsx:2']);
  });

  it('rail dans le rail — un fichier-canevas qui exporte AUSSI un enfant à rail rendu sous une coquille bornée (sonde du juge B9)', () => {
    const carte = 'export function Carte() {\n  return <ScreenShell title="c" onClose={f} body="full"><div className="screen-scroll">x</div></ScreenShell>;\n}\nexport function Escale() {\n  return <div className="screen-scroll escale">x</div>;\n}';
    const hote = 'import { Escale } from "./Carte";\n<ScreenShell title="x" onClose={f} body="centered">\n  <Escale />\n</ScreenShell>';
    expect(sitesRailHorsCanevas([{ rel: 'Carte.tsx', text: carte }, { rel: 'Hote.tsx', text: hote }])).toEqual(['Carte.tsx:5']);
  });

  it('§5.4 aucune famille JET recréée dans un module d’écran', () => {
    const egarees = sitesFamilleEgaree(feuilles);
    expect(egarees, `Famille migrée RECRÉÉE hors du module de sa primitive — sa destination est nommée :\n${egarees.join('\n')}`).toEqual([]);
  });

  it('§5.4 preuve par mutation — une classe de la famille JET dans un module d’écran rougit', () => {
    const faux = [{ rel: 'src/ui/styles/faux-ecran.css', text: '.rm-neuf { color: var(--gold) }' }];
    expect(sitesFamilleEgaree(faux).length, 'la famille `.rm-*` doit être renvoyée à son module').toBe(1);
  });

  it('§5.4 chaque exemption est un SITE encore RÉEL — une ligne périmée se retire', () => {
    const reels = new Set(
      feuilles.flatMap(({ rel, text }) =>
        reglesCss(text).flatMap((r) =>
          r.selecteurs.flatMap((sel) => {
            const p = parties(sel);
            const c = p.length === 1 ? classesDe(p[0])[0] : undefined;
            return c ? [`${rel}|${c}`] : [];
          }),
        ),
      ),
    );
    const perimees = [...FAMILLE_EXEMPT_SITES.keys()].filter((k) => !reels.has(k));
    expect(perimees, `Exemption(s) PÉRIMÉE(S) — la classe a bougé ou a été migrée :\n${perimees.join('\n')}`).toEqual([]);
  });
});
