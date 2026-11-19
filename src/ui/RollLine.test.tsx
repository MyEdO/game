import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { RollLine, PendingRollLine } from './RollLine';

/** Le TEXTE réellement lu à l'écran, balises retirées : la Difficulté est un déclencheur Codex
 *  (libellé + glyphe), son balisage n'est pas le contrat — sa phrase, si. */
const texte = (html: string): string => html.replace(/<[^>]*>/g, '');
/** La ZONE Difficulté seule (`.rm-roll-diff`, ligne propre sous le nom du jet) en texte. */
const zoneDiff = (html: string): string => {
  const m = /class="rm-roll-diff">(.*?)<\/span><\/span>/.exec(html);
  return m ? texte(m[1]) : '';
};

describe('RollLine — détail d’un jet pour la modale', () => {
  it('réussite : base + modificateur = cible, le d100, et le DR', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Corps à corps', base: 45, modifier: 10, target: 55, roll: 32, success: true, sl: 2 }} />,
    );
    expect(html).toContain('Corps à corps');
    expect(html).toContain('45'); // base
    expect(html).toContain('55'); // cible
    expect(html).toContain('32'); // d100
    expect(html).toContain('DR');
    expect(html).toContain('✓'); // réussite
  });

  it('échec : marque l’échec (✗) et la cible réduite par un malus', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Parade', base: 40, modifier: -10, target: 30, roll: 67, success: false, sl: -3 }} />,
    );
    expect(html).toContain('Parade');
    expect(html).toContain('30'); // cible après malus
    expect(html).toContain('67'); // d100
    expect(html).toContain('✗'); // échec
  });

  it('détaille les modificateurs étiquetés quand ils reconcilient le total', () => {
    const html = renderToStaticMarkup(
      <RollLine
        d={{ label: 'Projectiles', base: 38, modifier: 60, target: 98, roll: 50, success: true, sl: 4, mods: [{ label: 'Courte portée', value: 40, famille: 'circonstance' }, { label: 'Viser', value: 20, famille: 'circonstance' }] }}
      />,
    );
    expect(html).toContain('Courte portée');
    expect(html).toContain('Viser');
    expect(html).toContain('+40');
    expect(html).toContain('+20');
  });

  it('un malus de DR se lit avant et après le jet et reste hors du calcul de la cible', () => {
    const modsDR = [{ label: 'Brouillard', value: -2, famille: 'circonstance' as const }];
    const jet = { label: 'Projectiles', base: 55, modsDR };
    const avant = renderToStaticMarkup(<PendingRollLine p={jet} />);
    const apres = renderToStaticMarkup(<RollLine d={{ ...jet, modifier: 0, target: 55, roll: 33, success: true, sl: 0 }} />);
    for (const html of [avant, apres]) {
      expect(html).toContain('Brouillard −2 DR');
      expect(html).toContain('<b>55</b>');
      expect(html).not.toContain('autres');
    }
    const masque = renderToStaticMarkup(<RollLine d={{ ...jet, modifier: 0, target: 55, roll: 33, success: true, sl: 0, mask: 'roll' }} />);
    expect(masque).not.toContain('Brouillard');
  });

  it('#1072 — la Difficulté se lit SUR LA LIGNE (texte + valeur), JAMAIS en chip', () => {
    const html = renderToStaticMarkup(
      <RollLine
        d={{ label: 'Crochetage', base: 45, modifier: 30, target: 75, roll: 20, success: true, sl: 5, difficulty: 'facile', mods: [{ label: 'Soutien', value: -10, famille: 'jet' }] }}
      />,
    );
    // Elle dit la NATURE du jet : elle vit dans le libellé de la ligne…
    expect(zoneDiff(html)).toBe('Facile (+40)');
    // …et JAMAIS dans les chips, réservées au circonstanciel (Soutien reste, lui).
    expect(html).not.toMatch(/rm-mod[^>]*>[^<]*Facile/);
    expect(html).toContain('Soutien');
    // La cible ne bouge pas d'un point : +40 de Difficulté −10 de Soutien = +30, déjà dans `modifier`.
    expect(html).toContain('<b>75</b>');
    expect(html).not.toContain('autres'); // rien d'inexpliqué : la Difficulté est portée par le texte
  });

  it('#1072 — la Difficulté ALLÉGÉE (`easierIf`) porte sa raison dans le MÊME texte de ligne', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Perception', base: 40, modifier: 20, target: 60, roll: 30, success: true, sl: 3, difficulty: 'accessible', easedBy: 'Crochetage' }} />,
    );
    expect(zoneDiff(html)).toBe('Accessible (+20), allégée : Crochetage');
    expect(html).not.toContain('rm-mod');
  });

  it('#1072 — Difficulté à modificateur NUL : la ligne l’annonce quand même (Intermédiaire (+0))', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Calme', base: 45, modifier: 0, target: 45, roll: 20, success: true, sl: 2, difficulty: 'intermediaire' }} />,
    );
    expect(html).toContain('Intermédiaire (+0)');
  });

  it('mods incomplets : les chips RESTENT et l’écart est NOMMÉ (jamais un masquage, #1064)', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Projectiles', base: 38, modifier: 40, target: 78, roll: 50, success: true, sl: 3, mods: [{ label: 'Viser', value: 20, famille: 'circonstance' }] }} />,
    );
    expect(html).toContain('Viser'); // le détail connu ne disparaît pas
    expect(html).toContain('autres'); // …et les 20 non itemisés sont AVOUÉS
  });

  it('cible PLAFONNÉE (99) : les chips restent et le bornage MESURÉ se lit « plafond 99 » (#1064)', () => {
    // Repro du ticket : 135 (+ Soutien +10, Complexe −10) = 135 → cible ramenée à 99 par `clamp`
    // (`engine/tests.clampTarget`), qui MESURE l'écrêtage (−36) et le fait voyager.
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Force Mentale', base: 135, modifier: -36, target: 99, clamped: -36, difficulty: 'complexe', roll: 50, success: true, sl: 4, mods: [{ label: 'Soutien', value: 10, famille: 'jet' }] }} />,
    );
    expect(html).toContain('Soutien');
    expect(html).toContain('−36 plafond 99'); // l'écart entier porte le plafond MESURÉ
    expect(html).not.toContain('autres'); // …rien d'inexpliqué ne reste
  });

  // La Difficulté quitte les chips (#1072) sans quitter le RAISONNEMENT : une ligne dont elle est le
  // SEUL poste doit encore nommer son écart (régression mesurée au rendu — cas A/B/C).
  it('#1072/A — Difficulté SEULE + écrêtage mesuré : le plafond reste NOMMÉ (aucune chip à côté)', () => {
    // 95 + Accessible (+20) = 115 → cible ramenée à 99, écrêtage mesuré −16.
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Résistance', base: 95, modifier: 4, target: 99, clamped: -16, difficulty: 'accessible', roll: 50, success: true, sl: 4 }} />,
    );
    expect(zoneDiff(html)).toBe('Accessible (+20)'); // la Difficulté se lit sur la ligne…
    expect(html).toContain('−16 plafond 99'); // …et l'écrêtage n'est PAS avaté par son départ des chips
  });

  it('#1072/B — Difficulté SEULE, écart NON mesuré : il s’avoue « autres », jamais un silence', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Résistance', base: 95, modifier: 4, target: 99, difficulty: 'accessible', roll: 50, success: true, sl: 4 }} />,
    );
    expect(html).not.toContain('plafond'); // rien de MESURÉ → on ne nomme pas un plafond
    expect(html).toContain('−16 autres');
  });

  it('#1072/C — Difficulté SEULE et total JUSTE : aucune chip (rien à réconcilier)', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Résistance', base: 45, modifier: 20, target: 65, difficulty: 'accessible', roll: 50, success: true, sl: 2 }} />,
    );
    expect(zoneDiff(html)).toBe('Accessible (+20)');
    expect(html).not.toContain('rm-mod'); // la ligne se lit seule : « 45 +20 = 65 »
  });

  it('cible 99 SANS écrêtage : AUCUNE chip « plafond » — l’écart inconnu s’avoue « autres » (#1064)', () => {
    // Le piège : la cible VAUT 99 par coïncidence. Sans `clamped` mesuré, la nommer « plafond » ment.
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Force Mentale', base: 89, modifier: 10, target: 99, roll: 50, success: true, sl: 4, mods: [{ label: 'Soutien', value: 20, famille: 'jet' }] }} />,
    );
    expect(html).not.toContain('plafond');
    expect(html).toContain('−10 autres');
  });

  it('écrêtage PARTIEL : le plafond ne prend que sa part mesurée, le reste s’avoue « autres »', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Perception', base: 120, modifier: -21, target: 99, clamped: -11, roll: 50, success: true, sl: 2, mods: [{ label: 'Soutien', value: 10, famille: 'jet' }] }} />,
    );
    expect(html).toContain('−11 plafond 99');
    expect(html).toContain('−20 autres'); // −21 d'écart − (−11) plafond… reste −20 après le +10 nommé
  });

  it('aucun modificateur → « 55 » seul, pas « 55 = 55 »', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Sociabilité', base: 55, modifier: 0, target: 55, roll: 40, success: true, sl: 1 }} />,
    );
    expect(html).toContain('55');
    expect(html).not.toContain('= <b>'); // pas de « = cible » redondant
  });

  it('mods qui s’annulent (+10 / −10) → ligne « 55 » SANS « = », mais chips conservées', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Esquive', base: 55, modifier: 0, target: 55, roll: 40, success: true, sl: 1, mods: [{ label: 'Avantage', value: 10, famille: 'jet' }, { label: 'Sonné', value: -10, famille: 'jet' }] }} />,
    );
    expect(html).not.toContain('= <b>');
    expect(html).toContain('Avantage'); // chips toujours visibles pour expliquer le wash
    expect(html).toContain('Sonné');
  });

  it('`mask:\'roll\'` (#990) : ni dé, ni ✓/✗ ±DR, ni cible — un « ? » PAR CELLULE, label et chips conservés', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Force', base: 45, modifier: 10, target: 55, roll: 32, success: true, sl: 2, mask: 'roll', mods: [{ label: 'Avantage', value: 10, famille: 'jet' }] }} />,
    );
    expect(html).toContain('Force'); // le libellé du jet reste lisible (on sait CE qui est joué)
    expect(html).toContain('Avantage'); // ModChips conservées
    expect(html).toContain('<b>?</b>'); // cellule du dé
    expect(html).toContain('>?</span>'); // cellule ✓/✗ ±DR
    expect(html, 'le dé ne doit pas fuir').not.toContain('class="d100"');
    expect(html, 'le verdict ne doit pas fuir').not.toContain('✓');
    expect(html).not.toContain('✗');
    expect(html, 'ni le DR').not.toContain('DR');
    expect(html, 'sans masquer la CIBLE, le masque fuit par arithmétique').not.toContain('<b>55</b>');
    expect(html, 'aucun accent de verdict : la couleur EST le verdict').not.toContain('rm-roll ok');
    expect(html).not.toContain('rm-roll fail');
  });

  it('`mask:\'value\'` : ligne opaque du marchand — base/cible cachées, dé et DR bien visibles', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Marchandage', base: 42, modifier: 0, target: 42, roll: 67, success: false, sl: -3, mask: 'value' }} />,
    );
    expect(html).not.toContain('<b>42</b>'); // base/cible cachées
    expect(html).toContain('67'); // …mais le dé et le DR restent visibles (non-régression marchand)
    expect(html).toContain('DR');
    expect(html).toContain('✗');
    expect(html).toContain('rm-roll fail');
  });

  it('rangée masquée : les 3 cellules portent un « ? », aucune n’est VIDE, et l’état `.masked` est posé', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Force', base: 45, modifier: 10, target: 55, roll: 32, success: true, sl: 2, mask: 'roll' }} />,
    );
    // Une cellule VIDE dirait « pas de jet » — la doctrine de la primitive est « un ? PAR cellule ».
    expect(html).not.toMatch(/class="rm-roll-calc"[^>]*>\s*<\/span>/);
    expect((html.match(/\?/g) ?? []).length, 'calcul + dé + DR').toBe(3);
    expect(html).toMatch(/rm-roll (masked|[^"]*masked)/);
  });

  it('rangée masquée : le « ? » PORTE son sens (title + aria-label, une seule formulation)', () => {
    const html = renderToStaticMarkup(
      <RollLine d={{ label: 'Force', base: 45, modifier: 10, target: 55, roll: 32, success: true, sl: 2, mask: 'roll' }} />,
    );
    const hint = 'Caché jusqu’à votre jet';
    expect((html.match(new RegExp(`aria-label="${hint}"`, 'g')) ?? []).length, 'les 3 cellules masquées').toBe(3);
    expect((html.match(new RegExp(`title="${hint}"`, 'g')) ?? []).length).toBe(3);
  });
});

describe('#990 — géométrie de la ligne masquée : la révélation change les VALEURS, pas la mise en page', () => {
  const css = readFileSync(new URL('./styles/roll-line.css', import.meta.url), 'utf8');

  it('l’état `.masked` porte le liseré 3px de la ligne pré-remplie voisine (pas le 1px par défaut)', () => {
    expect(css).toMatch(/\.rm-roll\.masked\s*\{[^}]*border-left:\s*3px/);
  });

  it('les colonnes `auto` (dé, DR) sont RÉSERVÉES sous masque — même invariant que le pré-jet (#362)', () => {
    expect(css, 'sans réservation, « ? » → « 73 » fait glisser la ligne').toMatch(/\.rm-roll\.masked \.rm-roll-dice b\s*\{[^}]*min-width:/);
    expect(css).toMatch(/\.rm-roll\.masked \.rm-roll-sl\s*\{[^}]*min-width:/);
  });
});

describe('PendingRollLine — pré-jet (même règle « pas de = redondant »)', () => {
  it('aucun modificateur → « 55 » seul', () => {
    const html = renderToStaticMarkup(<PendingRollLine p={{ label: 'Sociabilité', base: 55, target: 55 }} />);
    expect(html).toContain('55');
    expect(html).not.toContain('= <b>');
  });

  it('avec modificateur → « 45 +10 = 55 »', () => {
    const html = renderToStaticMarkup(
      <PendingRollLine p={{ label: 'Corps à corps', base: 45, target: 55, mods: [{ label: 'Avantage', value: 10, famille: 'jet' }] }} />,
    );
    expect(html).toContain('45');
    expect(html).toContain('= <b>');
    expect(html).toContain('Avantage');
  });

  it('#1072 — pré-jet : la Difficulté est SUR la ligne et reste DANS la cible dérivée', () => {
    const html = renderToStaticMarkup(
      <PendingRollLine p={{ label: 'Crochetage', base: 45, difficulty: 'difficile', mods: [{ label: 'Acharnement', value: 10, famille: 'jet' }] }} />,
    );
    expect(zoneDiff(html), 'la Difficulté est sa PROPRE ligne sous le nom du jet').toBe('Difficile (−20)');
    expect(html).not.toMatch(/rm-mod[^>]*>[^<]*Difficile/);
    expect(html).toContain('<b>35</b>'); // 45 −20 (Difficulté) +10 (Acharnement) : la somme ne bouge pas
    expect(html).toContain('Acharnement'); // la chip circonstancielle reste
    expect(html).not.toContain('autres'); // …et rien n'est déclaré inexpliqué
  });
});
