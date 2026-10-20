import { describe, it, expect } from 'vitest';
import { parseAsciiRows, parseWalledAscii, scanMarkers, walledRowsOf, zonesFromSeeds, type ZoneSeed } from './asciiMap';

describe('parseAsciiRows', () => {
  it('mappe les chars → terrains, `.`/espace = base', () => {
    const { w, h, tiles } = parseAsciiRows(['#M.', 'M M'], 'marbre', { M: 'marbre' });
    expect({ w, h }).toEqual({ w: 3, h: 2 });
    expect(tiles).toEqual(['mur', 'marbre', 'marbre', 'marbre', 'marbre', 'marbre']);
  });

  it('lève sur une ligne de largeur incohérente', () => {
    expect(() => parseAsciiRows(['###', '##'], 'mur')).toThrow(/largeur/);
  });

  it('lève sur un char inconnu', () => {
    expect(() => parseAsciiRows(['#?#'], 'mur')).toThrow(/inconnu/);
  });
});

describe('parseWalledAscii (box-drawing : tuiles + murs sur arêtes)', () => {
  // 2×1 cases : A (sol) | B (eau), mur plein entre A et B, portes au-dessus de A et en bas de B.
  const rows = [
    '+:+-+',
    '|A|B|',
    '+-+:+',
  ];
  const out = parseWalledAscii(rows, 'sol', { A: 'sol', B: 'eau' });

  it('lit les tuiles (slots impairs) via la légende', () => {
    expect({ w: out.w, h: out.h }).toEqual({ w: 2, h: 1 });
    expect(out.tiles).toEqual(['sol', 'eau']);
  });

  it('lit le mur INTERNE entre A et B (arête E de (0,0))', () => {
    expect(out.walls).toContainEqual({ x: 0, y: 0, side: 'E' });
  });

  it('lit les PORTES (`:`) au bon endroit', () => {
    expect(out.walls).toContainEqual({ x: 0, y: 0, side: 'N', door: true }); // au-dessus de A
    expect(out.walls).toContainEqual({ x: 1, y: 1, side: 'N', door: true }); // bord bas sous B (S de (1,0) = N de (1,1))
  });

  it('lève sur une grille de dimensions paires', () => {
    expect(() => parseWalledAscii(['+-+', '|A|'], 'sol')).toThrow(/2W\+1|2H\+1|attendue/);
  });

  it('pose une STRUCTURE sur l\'arête via opts.wallLegend (herse dans le mur)', () => {
    // 2×1 cases A | B ; arête E de (0,0) = herse `H` (mur + structure `porte-de-ville`).
    const built = parseWalledAscii(['+-+-+', '|AHB|', '+-+-+'], 'sol', { A: 'sol', B: 'eau' }, { wallLegend: { H: { structure: 'porte-de-ville' } } });
    expect(built.walls).toContainEqual({ x: 0, y: 0, side: 'E', structure: 'porte-de-ville' });
    expect(built.tiles).toEqual(['sol', 'eau']);
  });

  it('pose une APPARENCE SEULE sur l\'arête via opts.wallLegend (le char vaut mur, sans PV)', () => {
    const built = parseWalledAscii(['+-+-+', '|AwB|', '+-+-+'], 'sol', { A: 'sol', B: 'eau' }, { wallLegend: { w: { appearance: 'mur-en-bois' } } });
    expect(built.walls).toContainEqual({ x: 0, y: 0, side: 'E', appearance: 'mur-en-bois' });
  });

  it('pose structure ET apparence — les deux clés DÉFINIES de l\'overlay, jamais une clé à undefined', () => {
    const built = parseWalledAscii(['+-+-+', '|AHB|', '+-+-+'], 'sol', { A: 'sol', B: 'eau' }, { wallLegend: { H: { structure: 'herse', appearance: 'herse' } } });
    const seg = built.walls.find((s) => s.x === 0 && s.y === 0 && s.side === 'E')!;
    expect(seg).toEqual({ x: 0, y: 0, side: 'E', structure: 'herse', appearance: 'herse' });
    expect(Object.keys(seg).sort()).toEqual(['appearance', 'side', 'structure', 'x', 'y']);
  });

  it('structure sur une arête PORTE (`:`) cumule door + structure', () => {
    const built = parseWalledAscii(['+:+', '|A|', '+-+'], 'sol', { A: 'sol' }, { wallLegend: { ':': { structure: 'herse' } } });
    expect(built.walls).toContainEqual({ x: 0, y: 0, side: 'N', door: true, structure: 'herse' });
  });

  it('lit la FENÊTRE (`o`) comme un mur qui porte window:true (#779)', () => {
    const built = parseWalledAscii(['+o+-+', '|A|B|', '+-+:+'], 'sol', { A: 'sol', B: 'eau' });
    expect(built.walls).toContainEqual({ x: 0, y: 0, side: 'N', window: true });
  });

  it('sans opts.wallLegend : comportement byte-identique (non-régression)', () => {
    const a = parseWalledAscii(['+:+-+', '|A|B|', '+-+:+'], 'sol', { A: 'sol', B: 'eau' });
    const b = parseWalledAscii(['+:+-+', '|A|B|', '+-+:+'], 'sol', { A: 'sol', B: 'eau' }, {});
    expect(a).toEqual(b);
    expect(a.walls).toContainEqual({ x: 0, y: 0, side: 'E' }); // mur nu, aucune clé structure
  });
});

describe('scanMarkers', () => {
  it('renvoie positions des marqueurs + lignes nettoyées (marqueurs → `.`)', () => {
    const { positions, cleaned } = scanMarkers(['.@.', 'X.@'], '@X');
    expect(positions['@']).toEqual([{ x: 1, y: 0 }, { x: 2, y: 1 }]);
    expect(positions['X']).toEqual([{ x: 0, y: 1 }]);
    expect(cleaned).toEqual(['...', '...']);
  });

  it('n\'altère pas les chars non-marqueurs', () => {
    const { positions, cleaned } = scanMarkers(['#@#', '~.~'], '@');
    expect(cleaned).toEqual(['#.#', '~.~']);
    expect(positions['@']).toEqual([{ x: 1, y: 0 }]);
  });

  it('clé par marqueur même absent (→ [])', () => {
    const { positions } = scanMarkers(['...'], '@X');
    expect(positions).toEqual({ '@': [], X: [] });
  });
});

describe('zonesFromSeeds (calque de zones DÉRIVÉ du box-drawing)', () => {
  // 6×4 cases. Pièce gauche x0..x2 / pièce droite x3..x5, séparées à l'arête E de x2 par un mur (y0),
  // une PORTE (y1) et une FENÊTRE (y2). Un refend N sur y2 coupe la pièce gauche en deux, franchi par
  // une porte interne. (1,3) porte une cloison DIAGONALE, (5,0) est du vide.
  const GRID = [
    '-------------',
    '|, , ,|, ,  |',
    '             ',
    '|, , ,:, , ,|',
    ' - : -       ',
    '|, , ,o, , ,|',
    ' -           ',
    '|, / ,|, , ,|',
    '-------------',
  ];
  /** Même lecture que `buildScene` : base = hors-bâtiment, `,` = sol praticable. */
  const calque = (seeds: ZoneSeed[], rows = GRID, opts = {}) =>
    zonesFromSeeds(rows, 'vide', { ',': 'dalle' }, seeds, opts).split('\n');
  const at = (rows: string[], x: number, y: number) => rows[y][x];

  it('rend un calque dense H×W, `.` hors zone', () => {
    const rows = calque([{ char: 'P', at: [[0, 0]] }]);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.length === 6)).toBe(true);
    expect(rows[0]).toBe('PPP...');
  });

  it('une PORTE borne la pièce (elle ne fuit pas chez la voisine)', () => {
    const rows = calque([{ char: 'P', at: [[0, 1]] }]);
    expect(at(rows, 2, 1)).toBe('P'); // case à gauche de la porte
    expect(at(rows, 3, 1)).toBe('.'); // case à droite de la porte
  });

  it('une FENÊTRE borne la pièce', () => {
    const rows = calque([{ char: 'P', at: [[0, 2]] }]);
    expect(at(rows, 2, 2)).toBe('P');
    expect(at(rows, 3, 2)).toBe('.');
  });

  it('une cloison DIAGONALE borne la pièce (angle mort des arêtes)', () => {
    const rows = calque([{ char: 'P', at: [[0, 2]] }]);
    expect(at(rows, 1, 3)).toBe('.'); // la case diagonale elle-même
    expect(at(rows, 0, 3)).toBe('.'); // au-delà : seul chemin = la diagonale
  });

  it('le VIDE n’est jamais rempli', () => {
    const rows = calque([{ char: 'Q', at: [[3, 0]] }]);
    expect(at(rows, 4, 0)).toBe('Q');
    expect(at(rows, 5, 0)).toBe('.');
  });

  it('deux GRAINES d’un même char (porte interne) rendent UNE seule zone', () => {
    const rows = calque([{ char: 'P', at: [[0, 0], [0, 2]] }]);
    const cells = rows.join('').split('').filter((c) => c === 'P');
    expect(cells).toHaveLength(10);
    expect(at(rows, 0, 0)).toBe('P');
    expect(at(rows, 2, 3)).toBe('P');
  });

  it('deux chars qui atteignent la même case LÈVENT, en nommant la case et les deux chars', () => {
    expect(() => calque([{ char: 'P', at: [[0, 0]] }, { char: 'Q', at: [[2, 0]] }]))
      .toThrow(/\(2,0\).*P.*Q|\(2,0\).*Q.*P/);
  });

  it('la CLIP partitionne une aire ouverte (arbitrage d’auteur : aucun trait au plan)', () => {
    const rows = calque([
      { char: 'Q', at: [[3, 1]], clip: { x1: 4 } },
      { char: 'R', at: [[5, 1]], clip: { x0: 5 } },
    ]);
    expect(rows[1]).toBe('...QQR');
    expect(rows[3]).toBe('...QQR');
  });

  // Les trois contrats suivants tiennent la lecture UNIQUE : le calque se dérive de ce que
  // `parseWalledAscii` a lu (murs ET terrains), jamais d'un second décodage du box-drawing.
  it('une STRUCTURE d’arête (herse) borne la pièce comme un mur', () => {
    const HERSE = ['+-+-+', '|,H,|', '+-+-+'];
    expect(calque([{ char: 'P', at: [[0, 0]] }], HERSE, { wallLegend: { H: { structure: 'porte-de-ville' } } })[0]).toBe('P.');
    // CONTRE-ÉPREUVE : sans la déclaration de structure, `H` n'est plus une arête — la pièce fuit.
    expect(calque([{ char: 'P', at: [[0, 0]] }], HERSE)[0]).toBe('PP');
  });

  it('un TERRAIN que le pas ne foule pas (mur, eau, fosse) ne se remplit pas et borne la pièce', () => {
    const BARRE = ['-----------', '|, # ~ _ ,|', '-----------'];
    expect(calque([{ char: 'P', at: [[0, 0]] }], BARRE)[0]).toBe('P....');
    // CONTRE-ÉPREUVE : les mêmes cases en sol praticable, sans toucher une seule arête, se remplissent.
    const SOL = ['-----------', '|, , , , ,|', '-----------'];
    expect(calque([{ char: 'P', at: [[0, 0]] }], SOL)[0]).toBe('PPPPP');
  });

  it('une APPARENCE d’arête borne la pièce, et sans la `wallLegend` de sa grille le char ne vaut pas mur', () => {
    const BOIS = ['+-+-+', '|,w,|', '+-+-+'];
    const deux: ZoneSeed[] = [{ char: 'A', at: [[0, 0]] }, { char: 'B', at: [[1, 0]] }];
    // Sans la table : `w` n'est pas une arête, le remplissage fuit et les deux graines se disputent la case.
    expect(() => calque(deux, BOIS)).toThrow(/revendiquée/);
    // Avec la table : deux zones d'UNE case, sur le calque rendu.
    expect(calque(deux, BOIS, { wallLegend: { w: { appearance: 'mur-en-bois' } } })).toEqual(['AB']);
  });

  it('une largeur de rangée incohérente lève la MÊME erreur que `parseWalledAscii`', () => {
    const TRONQUE = ['-----------', '|, , , , ,|', '-------'];
    expect(() => calque([{ char: 'P', at: [[0, 0]] }], TRONQUE)).toThrow(/largeur/);
  });

  it('une graine posée sur une case infranchissable lève, en nommant le terrain', () => {
    const BARRE = ['-----------', '|, # ~ _ ,|', '-----------'];
    expect(() => calque([{ char: 'P', at: [[1, 0]] }], BARRE)).toThrow(/P@1,0.*mur/);
  });
});

describe('walledRowsOf', () => {
  it('ne retire QU’UNE ligne vide de tête et de queue (les rangées d’arêtes internes sont du plan)', () => {
    expect(walledRowsOf('\n+-+\n\n+-+\n')).toEqual(['+-+', '', '+-+']);
  });

  it('recomplète chaque rangée à 2w+1 quand la largeur de carte est donnée (jamais de troncature)', () => {
    expect(walledRowsOf('\n|,\n|, , ,|\n', 3)).toEqual(['|,     ', '|, , ,|']);
  });
});
