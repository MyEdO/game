/**
 * Le bloc « dé fixé » d'une rangée de jet est CHARTRÉ dans la feuille partagée, pas hérité de
 * l'ambiance de la coquille qui l'héberge (mesure du juge vision : `.prow-act`/`.prow-fixed-mark`
 * n'avaient AUCUNE règle sur 120 feuilles → même étiquette centrée en modale Corruption, ferrée à
 * gauche en Incantation ; le champ occupait 1/3 d'une grille `repeat(3, 1fr)` détournée).
 *
 * Verrou STRUCTUREL : chaque classe portée par `RollRow`/`ForcedRollPicker` doit avoir au moins une
 * règle avec des déclarations dans `src/ui/styles/`. Même patron que
 * `creator/creator-step-scroll-cue.test.tsx` (jsdom ne calcule pas de layout : on verrouille la
 * DÉCLARATION source, la preuve de rendu vit en recette navigateur).
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { reglesCss } from '../../scripts/guards/lib/cssCouches.mjs';

// Commentaires NEUTRALISÉS (même précaution que `ui-ratchets`) : un commentaire qui NOMME la classe
// n'est pas une règle — sans ça, la sonde reste verte alors que la déclaration a disparu (mesuré).
const SHEETS = readCorpus(['src/ui/styles'], { exts: ['.css'], tests: true })
  .map(({ rel, text }) => ({ file: rel, css: text.replace(/\/\*[\s\S]*?\*\//g, '') }));

/** Toutes les règles des feuilles, LEXÉES par la porte unique `reglesCss` : une lecture à la regex
 *  ne voit qu'une règle sur deux (le `}` fermant est consommé par le match précédent, il ne peut plus
 *  servir de délimiteur au suivant) — un détecteur ne mesure que sa couverture. */
const REGLES = SHEETS.flatMap(({ file, css }) => reglesCss(css).map((r) => ({ file, ...r })));

/** Règles dont le SÉLECTEUR contient la classe, et dont le corps porte au moins une déclaration.
 *  Frontière `(?![\w-])` et non `\b` : `\b` fait passer `.prow-act` pour une règle de `.prow`. */
function rulesFor(cls: string): { file: string; body: string }[] {
  const re = new RegExp(`\\.${cls}(?![\\w-])`);
  return REGLES.filter((r) => r.selecteurs.some((s) => re.test(s)) && /[a-z-]+\s*:/.test(r.corps)).map((r) => ({
    file: r.file,
    body: r.corps,
  }));
}

/** Corps des règles dont le SÉLECTEUR contient `needle` — pour cibler une règle DESCENDANTE, qui
 *  n'a pas de classe propre : la matière du champ du dé se déclare au CONTENEUR du site, la
 *  primitive `NumberField` ne portant aucune classe d'écran. */
function rulesForSelector(needle: string): string[] {
  return REGLES.filter((r) => r.selecteurs.some((s) => s.includes(needle)) && /[a-z-]+\s*:/.test(r.corps)).map((r) => r.corps);
}

/** Corps d'un bloc `@media …{…}` (accolades APPARIÉES — une règle imbriquée ne coupe pas la tranche).
 *  null si l'en-tête est absent. */
function mediaSlice(css: string, header: RegExp): string | null {
  const m = header.exec(css);
  if (!m) return null;
  let depth = 1;
  for (let i = m.index + m[0].length; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(m.index + m[0].length, i);
  }
  return null;
}

describe('rangée de jet — les classes du bloc « dé fixé » sont chartrées (feuille partagée)', () => {
  // `rm-range` (#942 L7) : la FOURCHETTE portée par chaque tuile de tableau — posée en JSX sans
  // règle, elle se collait au libellé (« Trahison !07-10 »), soit exactement le défaut que cette
  // garde existe pour attraper. `prow-line` : le conteneur qui ancre la marque à SA ligne.
  for (const cls of ['prow', 'prow-line', 'prow-act', 'prow-fixed-mark', 'rm-die-pick', 'rm-range']) {
    it(`\`.${cls}\` porte au moins une règle CSS`, () => {
      const rules = rulesFor(cls);
      expect(
        rules.length,
        `\`.${cls}\` n'a AUCUNE règle dans src/ui/styles/ — son alignement/sa matière seraient hérités de l'ambiance de la coquille (divergence par écran).`,
      ).toBeGreaterThan(0);
    });
  }

  it('`.prow-act` pose un LAYOUT explicite (jamais un div nu qui suit le flux du parent)', () => {
    const bodies = rulesFor('prow-act').map((r) => r.body).join('\n');
    expect(bodies).toMatch(/display:\s*flex/);
    expect(bodies).toMatch(/align-items:/);
    expect(bodies).toMatch(/text-align:/);
  });

  // Sonde du juge vision, PROMUE : aucun élément de rangée n'hérite du `text-align` de la coquille. Le
  // ferrage se déclare sur le CONTENEUR (`.prow`) — mesuré : marque centrée par l'ambiance hôte
  // au-dessus d'un champ ferré à gauche, dans la MÊME rangée.
  it('`.prow` (le conteneur) ferre ses enfants EXPLICITEMENT — sinon l’ambiance de la coquille décide', () => {
    const bodies = rulesFor('prow').map((r) => r.body).join('\n');
    expect(
      bodies,
      '`.prow` sans `text-align` : chaque enfant (marque, issue courte, actions) hérite du ferrage de la coquille hôte et diverge d’une modale à l’autre.',
    ).toMatch(/text-align:\s*(left|start)/);
  });

  /**
   * VOILE des fenêtres de jet (#942 L7, verdict vision) : l'allègement (voile clair + ancrage par
   * bandes) existe pour garder le CHAMP DE BATAILLE lisible sous la fenêtre — il vit donc dans le
   * module du cadre (`modal.css`, état `data-champ`) et porte le scope de l'écran qui
   * affiche ce champ. En couche PARTAGÉE il
   * s'appliquait à tout écran (interlude compris), où il ne séparait plus les plans, et il a fallu
   * une contre-règle par écran (dérive « classe mono-écran »). jsdom ne calcule pas la cascade : ce
   * qui se verrouille ici est la DÉCLARATION (où vit la règle et à quoi elle est scopée) ; la preuve
   * de rendu est la capture de recette navigateur, en combat comme à l'interlude.
   */
  it('l’allègement de voile est SCOPÉ au domaine (jamais un défaut de la couche partagée)', () => {
    const overlayRules = rulesFor('modal-overlay').filter((r) => /background:\s*rgba\(0,\s*0,\s*0,\s*0\.2/.test(r.body));
    expect(overlayRules.length, 'aucun allègement de voile déclaré — le combat a perdu sa lisibilité du champ').toBeGreaterThan(0);
    for (const r of overlayRules) {
      expect(r.file, 'allègement de voile déclaré en couche PARTAGÉE : il s’appliquerait à tout écran portant une modale de jet').toMatch(/modal\.css$/);
    }
    const combat = SHEETS.find((s) => /\/modal\.css$/.test(s.file))!.css;
    expect(combat, 'l’allègement n’est pas scopé à l’écran qui porte le champ de bataille').toMatch(
      /\.app-campaign\s+\.modal-overlay\[data-champ\]\s*\{[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.28\)/,
    );
  });

  /**
   * INVARIANT DE GÉOMÉTRIE d'une fenêtre de jet (#1142, `docs/charte-ui.md`) : au-dessus de 560px,
   * c'est le bord HAUT qui est ancré (bande de champ de bataille CONSTANTE d'un état à l'autre), et
   * la bande BASSE est RÉSERVÉE — le dock d'action et le tiroir de journal y vivent, une fenêtre
   * haute les recouvrait sans elle. Les deux bandes se retrouvent dans le plafond de hauteur, sinon
   * la fenêtre reprend au bas ce que le haut lui a donné. jsdom ne calcule pas de layout : on
   * verrouille la DÉCLARATION, la preuve pixel est la mesure de recette navigateur.
   */
  it('la géométrie ancre le bord HAUT et RÉSERVE la bande basse (tranche ≥561px)', () => {
    const combat = SHEETS.find((s) => /\/modal\.css$/.test(s.file))!.css;
    const slice = mediaSlice(combat, /@media\s*\(min-width:\s*561px\)\s*\{/);
    expect(slice, 'plus de tranche `@media (min-width: 561px)` dans la feuille du cadre de modale').toBeTruthy();
    const overlay = /\.app-campaign\s+\.modal-overlay\[data-champ\]\s*\{([^{}]*)\}/.exec(slice!)?.[1] ?? '';
    expect(overlay, 'la bande haute n’est plus nommée : rien ne fixe le bord haut').toMatch(/--roll-band:/);
    expect(overlay, 'sans `align-items: start` la fenêtre se recentre — le bord haut redevient variable').toMatch(/align-items:\s*start/);
    expect(overlay, 'sans `padding-top: var(--roll-band)` le bord haut ne tient plus à la bande').toMatch(/padding-top:\s*var\(--roll-band\)/);
    const bas = /padding-bottom:\s*([^;]+);/.exec(overlay)?.[1]?.trim();
    expect(bas, 'aucune bande basse réservée : une fenêtre haute recouvre le dock d’action et le tiroir de journal').toBeTruthy();
    expect(bas, 'bande basse nulle : idem').not.toMatch(/^0(px)?$/);
    const modal = /\.app-campaign\s+\.modal-overlay\[data-champ\]\s*>\s*\.modal\s*\{([^{}]*)\}/.exec(slice!)?.[1] ?? '';
    const maxH = /max-height:\s*([^;]+);/.exec(modal)?.[1] ?? '';
    expect(maxH, 'le plafond de hauteur ne retire pas la bande HAUTE : la fenêtre crève le bas de l’écran').toContain('var(--roll-band)');
    expect(maxH, 'le plafond de hauteur ne retire pas la bande BASSE : la fenêtre redescend sur le dock').toContain(bas!);
  });

  /**
   * BANDES FONCTIONS DE L'ÉCRAN SEUL (#1142, #1847) : `--roll-band` se déclare UNE FOIS, et
   * sur un sélecteur qui ne connaît aucun ÉTAT. Le jour où une bande se redéclare sous un état
   * (`[data-phase]`, `.open`, un état de flux), le bord haut de la fenêtre se met à bouger PENDANT
   * une session de jet — c'est exactement le tremblement que l'invariant interdit. Ce contrat-là
   * se lit au TEXTE du CSS ; la HAUTEUR RENDUE, elle, se mesure au navigateur
   * (`scripts/recette/hauteur-reelle.mjs`, détecteur `corpsDeModaleEcrase`).
   */
  it('`--roll-band` est déclarée UNE fois, sur un sélecteur sans état', () => {
    const porteuses = REGLES.filter((r) => /--roll-band\s*:/.test(r.corps));
    expect(porteuses.length, 'la bande haute est déclarée à plusieurs adresses : elle peut diverger d’un état à l’autre').toBe(1);
    // Un sélecteur d'ÉTAT : attribut de donnée, pseudo-classe d'interaction, classe d'état montée
    // par le runtime. `[data-champ]` NOMME la fenêtre visée — `Modal` le fixe au montage
    // depuis sa prop `champ`, il ne change jamais pendant un jet.
    const ETAT = /\[data-(?!champ\])|:hover|:focus|:active|:checked|\.open(?![\w-])|\.is-[\w-]+|\.active(?![\w-])/;
    for (const sel of porteuses[0].selecteurs) {
      expect(ETAT.test(sel), `la bande haute est déclarée sous un sélecteur d’ÉTAT (« ${sel} ») : le bord haut bougerait en cours de jet`).toBe(false);
    }
  });

  // Sonde du juge vision, PROMUE : une classe posée en JSX sans règle qui SÉPARE laisse « Trahison !07-10 »
  // collé sur la tuile. L'existence d'un bloc ne suffit donc pas — la fourchette doit déclarer son
  // espacement ET son ton (elle est secondaire au nom de la ligne).
  it('`.rm-range` SÉPARE la fourchette du libellé et la pose au ton secondaire', () => {
    const bodies = rulesFor('rm-range').map((r) => r.body).join('\n');
    expect(bodies, '`.rm-range` sans marge/padding : la fourchette se colle au libellé de la ligne.').toMatch(/(margin|padding)(-left|-inline-start)?:\s*[^0;]/);
    expect(bodies, '`.rm-range` sans ton propre : la fourchette pèse autant que le nom de la ligne.').toMatch(/(color|font-size):/);
  });

  it('le champ du dé est dimensionné à son contenu, jamais une cellule pleine largeur', () => {
    const bodies = rulesForSelector('.rm-die-pick > label > input').join('\n');
    expect(bodies, 'aucune règle ne vise le champ du dé (`.rm-die-pick > label > input`)').toBeTruthy();
    const width = bodies.match(/width:\s*([^;]+);/)?.[1]?.trim();
    expect(width, 'le champ du dé sans `width`').toBeTruthy();
    expect(width, 'un champ de 3 chiffres ne prend pas 100 % de sa rangée').not.toBe('100%');
  });

  // Sonde du juge vision, PROMUE : la mention du dé EFFECTIF (« 56 (76 − 20) ») ne doit se COLLER ni
  // au champ ni au dé. L'espacement se déclare sur les CONTENEURS des deux surfaces — `.rm-die-pick`
  // (le champ) et `.rm-roll-dice` (la pastille de rangée) — plutôt qu'en classe de domaine dédiée
  // (cliquet xii : le stock de classes est gelé et décroissant ; on compose le token `.hint`).
  it('les conteneurs du dé posé ESPACENT leurs enfants (la mention d’opération n’est jamais collée)', () => {
    for (const cls of ['rm-die-pick', 'rm-roll-dice']) {
      const bodies = rulesFor(cls).map((r) => r.body).join('\n');
      expect(bodies, `\`.${cls}\` sans \`display: flex\` : ses enfants suivent le flux et la mention se colle au dé.`).toMatch(/display:\s*(inline-)?flex/);
      expect(bodies, `\`.${cls}\` sans \`gap\` : rien ne sépare l'icône, la valeur et la mention.`).toMatch(/gap:/);
    }
  });
});
