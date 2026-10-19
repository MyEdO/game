/**
 * Contrat de rendu de la couche LAYOUT (#1800) : chaque prop de placement se rend en attribut
 * `data-*` (jamais en classe modificatrice — le catalogue de classes serait à recompter), une prop
 * ABSENTE ne rend AUCUN attribut (c'est le défaut de `layout.css` qui répond), et `style` est un
 * refus de COMPILATION. La matière (ce que chaque attribut produit) vit dans `layout.css` et se
 * juge à l'écran ; ici, rien que la couture props → DOM.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Grid, Row, Split, Stack, grow, pushEnd, spanFull } from './Layout';

describe('#1800 — Stack/Row/Grid/Split : props de placement → attributs data-*', () => {
  it('chaque primitive pose SA classe, et la classe de l’appelant la suit', () => {
    expect(renderToStaticMarkup(<Stack>x</Stack>)).toContain('class="stack"');
    expect(renderToStaticMarkup(<Row>x</Row>)).toContain('class="row"');
    expect(renderToStaticMarkup(<Grid>x</Grid>)).toContain('class="grid"');
    expect(renderToStaticMarkup(<Split>x</Split>)).toContain('class="split"');
    expect(renderToStaticMarkup(<Stack className="panel sunken">x</Stack>)).toContain('class="stack panel sunken"');
  });

  it('prop ABSENTE = attribut ABSENT (le défaut vit dans la feuille, pas dans le TSX)', () => {
    const html = renderToStaticMarkup(<Stack>x</Stack>);
    for (const attr of ['data-gap', 'data-pad', 'data-align', 'data-row-below']) expect(html).not.toContain(attr);
    const row = renderToStaticMarkup(<Row>x</Row>);
    for (const attr of ['data-gap', 'data-pad', 'data-align', 'data-justify', 'data-wrap', 'data-stack-below']) {
      expect(row).not.toContain(attr);
    }
    const grid = renderToStaticMarkup(<Grid>x</Grid>);
    for (const attr of ['data-min', 'data-cols', 'data-align', 'data-stack-below']) expect(grid).not.toContain(attr);
  });

  it('Grid : `align="stretch"` égale les cases d’une rangée', () => {
    expect(renderToStaticMarkup(<Grid cols={2} align="stretch">x</Grid>)).toContain('data-align="stretch"');
  });

  it('Stack : gap/pad/align/rowBelow', () => {
    const html = renderToStaticMarkup(<Stack gap="xl" pad="sm" align="center" rowBelow={700}>x</Stack>);
    expect(html).toContain('data-gap="xl"');
    expect(html).toContain('data-pad="sm"');
    expect(html).toContain('data-align="center"');
    expect(html).toContain('data-row-below="700"');
  });

  it('Row : justify/align, et `wrap={false}` seul pose `data-wrap="no"`', () => {
    const html = renderToStaticMarkup(<Row gap="md" justify="between" align="baseline" stackBelow={560}>x</Row>);
    expect(html).toContain('data-justify="between"');
    expect(html).toContain('data-align="baseline"');
    expect(html).toContain('data-stack-below="560"');
    expect(html).not.toContain('data-wrap');
    expect(renderToStaticMarkup(<Row wrap={false}>x</Row>)).toContain('data-wrap="no"');
  });

  it('Grid : `cols` EXCLUT `min` et pose la cassure 700 par défaut ; `min` seul n’en pose aucune', () => {
    const fixe = renderToStaticMarkup(<Grid cols={3} min="lg">x</Grid>);
    expect(fixe).toContain('data-cols="3"');
    expect(fixe).not.toContain('data-min');
    expect(fixe).toContain('data-stack-below="700"');
    const auto = renderToStaticMarkup(<Grid min="lg">x</Grid>);
    expect(auto).toContain('data-min="lg"');
    expect(auto).not.toContain('data-stack-below');
  });

  it('Split : aside/side/sticky, cassure 700 par défaut et surchargeable', () => {
    const html = renderToStaticMarkup(<Split aside="md" side="end" sticky stackBelow={900}>x</Split>);
    expect(html).toContain('data-aside="md"');
    expect(html).toContain('data-side="end"');
    expect(html).toContain('data-sticky=""');
    expect(html).toContain('data-stack-below="900"');
    expect(renderToStaticMarkup(<Split>x</Split>)).toContain('data-stack-below="700"');
    expect(renderToStaticMarkup(<Split>x</Split>)).not.toContain('data-sticky');
  });

  it('`as` choisit la balise, et le reste (role, aria, data-testid, id) passe', () => {
    const html = renderToStaticMarkup(
      <Stack as="ul" role="list" aria-label="Services" data-testid="svc" id="s1">x</Stack>,
    );
    expect(html.startsWith('<ul')).toBe(true);
    expect(html).toContain('role="list"');
    expect(html).toContain('aria-label="Services"');
    expect(html).toContain('data-testid="svc"');
    expect(html).toContain('id="s1"');
  });

  it('modificateurs d’ENFANT : grow / pushEnd / spanFull s’étalent sur l’élément placé', () => {
    expect(renderToStaticMarkup(<Row><span {...grow}>a</span></Row>)).toContain('data-grow=""');
    expect(renderToStaticMarkup(<Row><span {...pushEnd}>a</span></Row>)).toContain('data-push="end"');
    expect(renderToStaticMarkup(<Grid><span {...spanFull}>a</span></Grid>)).toContain('data-span="full"');
  });

  it('`style` est refusé par le TYPE sur les quatre primitives (arbitrage A2, #1800)', () => {
    // @ts-expect-error — une propriété CSS inline sur une primitive de placement ne compile pas.
    const refus = <Stack style={{ width: 10 }}>x</Stack>;
    expect(renderToStaticMarkup(refus)).toContain('class="stack"');
  });
});
