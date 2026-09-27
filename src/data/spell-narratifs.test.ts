import { describe, it, expect } from 'vitest';
import { sitesNarratifs, sitesNarratifsParaphrases, FICHIER_DES_SORTS } from '../../scripts/data/lib/sortsNarratifs';
import { SPELL_NARRATIF_PARAPHRASE_STOCK, SPELL_NARRATIF_STOCK } from '../../scripts/guards/lib/spellNarratifStock.mjs';
import { ecartDuVolet, remedeNomme } from '../../scripts/guards/lib/stock.mjs';

/**
 * Cliquet décroissant des sorts NARRATIFS (DoD de #838) : l'écart NOMINATIF au stock
 * (`ecartDuVolet`, `scripts/guards/lib/stock.mjs`), dans les DEUX sens. Aucun plafond, aucun cardinal
 * en assertion : le compte s'imprime en diagnostic.
 */
const STOCK = 'scripts/guards/lib/spellNarratifStock.mjs';

describe('cliquet — tout sort NARRATIF est au stock, toute entrée du stock est narrative', () => {
  const sites = sitesNarratifs();
  const { neuves, perimees } = ecartDuVolet({ sites, stock: SPELL_NARRATIF_STOCK, ou: STOCK });
  console.info(`sorts narratifs mesurés : ${sites.length} · stock : ${SPELL_NARRATIF_STOCK.length}`);

  it('aucun sort narratif NEUF hors du stock — le mécaniser, jamais le stocker', () => {
    expect(neuves, `sort(s) NARRATIF(S) hors stock — mécaniser ses \`effects\` :\n${neuves.join('\n')}`).toEqual([]);
  });

  it('le stock ne peut que DÉCROÎTRE — toute entrée qui n’est plus narrative en sort', () => {
    expect(perimees, `entrée(s) du stock qui ne sont plus narratives — retirer leur ligne (ou :\n` +
      `npx tsx scripts/data/regen-spell-narratif-stock.mts) :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('chaque entrée NOMME le dataset des sorts — c’est ce que la porte de plage voit', () => {
    const muettes = SPELL_NARRATIF_STOCK.filter((e) => e.fichier !== FICHIER_DES_SORTS);
    expect(muettes, `Entrées dont le \`fichier\` n'est pas ${FICHIER_DES_SORTS} :\n  ${JSON.stringify(muettes)}`).toEqual([]);
  });

  /** SUBSTITUTION à compte constant — forgée EN MÉMOIRE, le stock du disque n'est jamais touché. */
  it('une SUBSTITUTION à compte CONSTANT rougit : la découverte est neuve, la bidon est périmée', () => {
    const substitue = [
      ...SPELL_NARRATIF_STOCK.slice(1),
      { fichier: FICHIER_DES_SORTS, ref: 'sort-qui-n-existe-pas', occurrence: 1 },
    ];
    expect(substitue, 'la forge doit rester à taille CONSTANTE, sinon elle ne prouve rien')
      .toHaveLength(SPELL_NARRATIF_STOCK.length);
    const ecart = ecartDuVolet({ sites, stock: substitue, ou: STOCK });
    expect(remedeNomme(ecart.neuves, ` :: ${SPELL_NARRATIF_STOCK[0].ref} :: `), 'la découverte doit ressortir NEUVE').toBe(true);
    expect(remedeNomme(ecart.perimees, ' :: sort-qui-n-existe-pas :: 1'), "l'entrée bidon doit ressortir SOLDÉE").toBe(true);
  });
});

describe('cliquet — une op `narrative` recopie sa `desc` VERBATIM (règle 5 de `CLAUDE.md`)', () => {
  const sites = sitesNarratifsParaphrases();
  const { neuves, perimees } = ecartDuVolet({ sites, stock: SPELL_NARRATIF_PARAPHRASE_STOCK, ou: STOCK });
  console.info(`ops narrative paraphrasées mesurées : ${sites.length} · stock : ${SPELL_NARRATIF_PARAPHRASE_STOCK.length}`);

  it('aucune paraphrase NEUVE hors du stock — recopier la `desc`, jamais la reformuler', () => {
    expect(neuves, `op(s) \`narrative\` hors stock dont le \`text\` n'est pas dans la \`desc\` :\n${neuves.join('\n')}`).toEqual([]);
  });

  it('le stock ne peut que DÉCROÎTRE — toute op redevenue verbatim en sort', () => {
    expect(perimees, `entrée(s) du stock soldées — retirer leur ligne (ou :\n` +
      `npx tsx scripts/data/regen-spell-narratif-stock.mts) :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('la mesure MORD : `putrefaction` (paraphrase) est vue, `bouclier-ceruleen` (verbatim) ne l’est pas', () => {
    expect(sites.some((s) => s.ref === 'bouclier-ceruleen'), 'bouclier-ceruleen recopie sa desc : il ne doit pas être mesuré').toBe(false);
    expect(sites.some((s) => s.ref === 'putrefaction'), 'putrefaction paraphrase sa desc : la mesure doit le voir').toBe(true);
  });
});
