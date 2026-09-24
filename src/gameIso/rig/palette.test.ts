import { describe, it, expect } from 'vitest';
import { buildTokenMap, applyTokenMap, tableDObjet, declarationsInertes, versHsl, chroma, clarte8, CHROMA_DE_TEINTE } from './palette';
import { CLES, COUCHE_DEFAUT, defautDe, propagerSuiveuses } from './clesDePalette';
import { couchesDuRig } from './parts/career';

describe('palette — buildTokenMap', () => {
  it('clé non surchargée : rend l’ombre et la lumière EXACTES déclarées (rendu par défaut sans perte)', () => {
    const declaree = { vet1: '#82724f', vet1O: '#112233', vet1H: '#ffeedd' };
    const m = buildTokenMap([declaree], {});
    expect(m.vet1).toBe('#82724f');
    expect(m.vet1O).toBe('#112233'); // ombre exacte déclarée, PAS dérivée
    expect(m.vet1H).toBe('#ffeedd');
  });

  it('clé sans ombre déclarée : dérive O/H de la base déclarée', () => {
    const m = buildTokenMap([{ vet1: '#646464' }], {}); // 100,100,100
    expect(m.vet1).toBe('#646464');
    expect(m.vet1O).toBe('#4e4e4e'); // 100*0.78 = 78 = 0x4e
    expect(m.vet1H).toBe('#767676'); // 100*1.18 = 118 = 0x76
  });

  it('clé surchargée : la base est le choix, l’écart de la gamme de couche s’y reporte en HSL (D3 point 3)', () => {
    const declaree = { vet1: '#82724f', vet1O: '#112233', vet1H: '#ffeedd' };
    const m = buildTokenMap([declaree], { vet1: '#646464' });
    expect(m.vet1).toBe('#646464');
    expect(m.vet1O).toBe('#212121');
    expect(m.vet1H).toBe('#ededed');
  });

  it('surcharge saturée : sa lumière reste plus claire qu’elle', () => {
    const m = buildTokenMap([], { vet1: '#ff0000' });
    expect(m.vet1H).not.toBe('#ff0000');
    expect(versHsl(m.vet1H)[2]).toBeGreaterThan(versHsl('#ff0000')[2]);
  });

  it('ombre recoloriée : garde la teinte de la surcharge et la PROPORTION de chroma de l’écart (peau #5d7a42)', () => {
    const defaut = buildTokenMap([]);
    const o = buildTokenMap([], { peau: '#5d7a42' }).peauO;
    expect(o).not.toBe('#494949');
    expect(Math.abs(versHsl(o)[0] - versHsl('#5d7a42')[0])).toBeLessThan(3);
    expect(chroma(o) / chroma('#5d7a42')).toBeCloseTo(chroma(defaut.peauO) / chroma(defaut.peau), 1);
  });

  it('base de couche sans teinte (chroma < CHROMA_DE_TEINTE) : ni ΔH ni rapport de chroma reportés', () => {
    const m = buildTokenMap([{ corps: '#c6cac5', corpsO: '#7b838c' }], { corps: '#b03030' });
    expect(chroma('#c6cac5')).toBeLessThan(CHROMA_DE_TEINTE);
    expect(Math.abs(versHsl(m.corpsO)[0] - versHsl('#b03030')[0])).toBeLessThan(3);
    expect(chroma(m.corpsO)).toBeCloseTo(chroma('#b03030'), 1);
  });

  it('écart d’art d’un pas sous une surcharge sombre : ombre et lumière sortent d’une clarté 8 bits distincte', () => {
    const m = buildTokenMap([{ vet1: '#808080', vet1O: '#7f7f7f', vet1H: '#818181' }], { vet1: '#101010' });
    expect(clarte8(m.vet1O)).toBeLessThan(clarte8('#101010'));
    expect(clarte8(m.vet1H)).toBeGreaterThan(clarte8('#101010'));
  });

  it('garde d’arrondi en clarté ENTIÈRE : lumière d’un pas d’art (gamme `chasseur`) sous trois surcharges du juge', () => {
    for (const s of ['#feadac', '#d3bd56', '#78ba5d'])
      expect(clarte8(buildTokenMap([{ vet1: '#3f5020', vet1H: '#46521f' }], { vet1: s }).vet1H), s).toBeGreaterThan(clarte8(s));
  });

  it('lumière déclarée `#ffffff` : reste blanche sous surcharge', () => {
    for (const s of ['#3a2a1a', '#b03030', '#5d7a42']) expect(buildTokenMap([{ corps: '#e9eae2', corpsH: '#ffffff' }], { corps: s }).corpsH, s).toBe('#ffffff');
  });

  it('lumière d’une surcharge : jamais plus colorée que la surcharge quand l’art perd de la couleur', () => {
    const m = buildTokenMap([{ corps: '#8fa4b6', corpsH: '#dcebf5' }], { corps: '#3a2a1a' });
    expect(chroma(m.corpsH)).toBeLessThanOrEqual(chroma('#3a2a1a'));
  });

  it('clé déclarée nulle part : la couche défaut de la table la donne', () => {
    const m = buildTokenMap([], {});
    expect(m.peau).toBe(defautDe('peau'));
    expect(m.metal).toBe(defautDe('metal'));
  });

  it('toute clé recoloriable ou commune est résolue sans déclaration, gamme comprise ; une clé de vocabulaire ne l’est pas', () => {
    const m = buildTokenMap([], {});
    const defaut = propagerSuiveuses(COUCHE_DEFAUT);
    expect(CLES).toContain('coque');
    expect(defaut.coque).toBeUndefined();
    for (const k of CLES) {
      if (defaut[k] == null) {
        for (const g of [k, `${k}O`, `${k}H`]) expect(m[g], g).toBeUndefined();
        continue;
      }
      expect(m[k], k).toBe(defaut[k]);
      expect(m[`${k}O`], `${k}O`).toMatch(/^#[0-9a-f]{6}$/);
      expect(m[`${k}H`], `${k}H`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('couches : l’ombre d’une couche basse ne sert JAMAIS sous une base venue d’une couche plus haute', () => {
    const m = buildTokenMap([{ vet1: '#82724f', vet1O: '#112233', vet1H: '#ffeedd' }, { vet1: '#646464' }], {});
    expect(m.vet1).toBe('#646464');
    expect(m.vet1O).toBe('#4e4e4e');
    expect(m.vet1H).toBe('#767676');
  });

  it('couche défaut : l’ombre de la table sert sous sa base, jamais sous une base déclarée', () => {
    expect(buildTokenMap([], {}).botteO).toBe(COUCHE_DEFAUT.botteO);
    expect(buildTokenMap([{ botte: '#646464' }], {}).botteO).toBe('#4e4e4e');
  });

  it('rig `cultiste` : `botteO` ET `botteDosO` dérivés de sa botte, l’ombre dorsale de la table ne survit pas', () => {
    const m = buildTokenMap(couchesDuRig(undefined, 'cultiste'), {});
    expect(m.botte).toBe('#4a3a28');
    expect(m.botteO).toBe('#3a2d1f');
    expect(m.botteDos).toBe('#4a3a28');
    expect(m.botteDosO).toBe('#3a2d1f');
  });

  it('clé suiveuse : une couche qui donne la suivie sans la suiveuse lui donne sa gamme DÉCLARÉE', () => {
    const m = buildTokenMap([{ corps: '#646464', corpsO: '#112233' }], {});
    expect(m.aile).toBe('#646464');
    expect(m.aileO).toBe('#112233');
    expect(m.aileH).toBe('#767676');
    expect(buildTokenMap([{ botte: '#646464' }], {}).semelle).toBe('#646464');
  });

  it('clé suiveuse sous surcharge de la suivie : elle suit, sauf si la couche qui donne sa base la déclare', () => {
    expect(buildTokenMap([{ corps: '#646464' }], { corps: '#ff0000' }).aile).toBe('#ff0000');
    expect(buildTokenMap([{ corps: '#646464', aile: '#00ff00' }], { corps: '#ff0000' }).aile).toBe('#00ff00');
    expect(buildTokenMap([{ aile: '#806030' }, { corps: '#ffffff' }], { corps: '#ff0000' }).aile).toBe('#ff0000');
  });

  it('applyTokenMap : substitue les jetons connus, laisse les inconnus', () => {
    const m = buildTokenMap([{ vet1: '#abcdef' }], {});
    expect(applyTokenMap('<path fill="@vet1"/>', m)).toBe('<path fill="#abcdef"/>');
    expect(applyTokenMap('<path fill="@inconnu"/>', m)).toBe('<path fill="@inconnu"/>');
    expect(applyTokenMap('<path fill="#123456"/>', m)).toBe('<path fill="#123456"/>'); // hex en dur intact
  });

  it('dégradé dérivé : `dg-` résolu réécrit par son contenu, `<defs>` préfixé une fois par id', () => {
    const m = buildTokenMap([{ vet1: '#aabbcc', vet1O: '#112233', vet1H: '#ddeeff' }], {});
    const svg = applyTokenMap('<path fill="url(#dg-v-@vet1H-@vet1O)"/><path fill="url(#dg-v-@vet1H-@vet1O)"/>', m);
    expect(svg).toBe('<defs><linearGradient id="dg-v-ddeeff-112233" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#ddeeff"/><stop offset="100%" stop-color="#112233"/></linearGradient></defs>' +
      '<path fill="url(#dg-v-ddeeff-112233)"/><path fill="url(#dg-v-ddeeff-112233)"/>');
  });

  it('dégradé dérivé : forme `v3` à trois arrêts verticaux ; un arrêt littéral se résout sans jeton', () => {
    const m = buildTokenMap([{ metal: '#8899aa', metalO: '#223344', metalH: '#ccddee' }], {});
    expect(applyTokenMap('<path fill="url(#dg-v3-@metalH-@metal-@metalO)"/>', m)).toContain(
      '<linearGradient id="dg-v3-ccddee-8899aa-223344" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#ccddee"/><stop offset="55%" stop-color="#8899aa"/><stop offset="100%" stop-color="#223344"/>');
    const litteral = applyTokenMap('<path fill="url(#dg-v3-#5A3D22-#3e2917-#241509)"/>', {});
    expect(litteral).toBe('<defs><linearGradient id="dg-v3-5a3d22-3e2917-241509" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#5a3d22"/><stop offset="55%" stop-color="#3e2917"/><stop offset="100%" stop-color="#241509"/>' +
      '</linearGradient></defs><path fill="url(#dg-v3-5a3d22-3e2917-241509)"/>');
  });

  it('dégradé dérivé : un `dg-` qui garde un `@` n’est ni réécrit ni préfixé ; la passe suivante le résout', () => {
    const objet = applyTokenMap('<path fill="url(#dg-v-@peauH-@peauO)" stroke="@metal"/>', tableDObjet([{ metal: '#8899aa' }]));
    expect(objet).toBe('<path fill="url(#dg-v-@peauH-@peauO)" stroke="#8899aa"/>');
    const porteur = buildTokenMap([{ peau: '#3a2a1a' }]);
    expect(applyTokenMap(objet, porteur)).toBe(`<defs><linearGradient id="dg-v-${porteur.peauH.slice(1)}-${porteur.peauO.slice(1)}" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="${porteur.peauH}"/><stop offset="100%" stop-color="${porteur.peauO}"/></linearGradient></defs>` +
      `<path fill="url(#dg-v-${porteur.peauH.slice(1)}-${porteur.peauO.slice(1)})" stroke="#8899aa"/>`);
  });

  it('dégradé dérivé : une seconde passe ne réémet pas un id déjà défini dans le fragment', () => {
    const m = buildTokenMap([{ vet1: '#aabbcc' }], {});
    const une = applyTokenMap('<path fill="url(#dg-v-@vet1H-@vet1O)" stroke="@peau"/>', tableDObjet([{ vet1: '#aabbcc' }]));
    const deux = applyTokenMap(une + '<path fill="url(#dg-v-@vet1H-@vet1O)"/>', m);
    expect(deux.match(/<linearGradient id="dg-v-/g)).toHaveLength(1);
  });

  it('table d’objet : aucune clé de sorte porteur (suiveuses d’une clé porteur comprises), le reste identique', () => {
    const porteur = buildTokenMap([{ metal: '#8899aa' }], { cuir: '#00ff00' });
    const objet = tableDObjet([{ metal: '#8899aa' }], { cuir: '#00ff00' });
    for (const k of ['peau', 'cheveux', 'yeux', 'voilure']) for (const suf of ['', 'O', 'H']) expect(objet[k + suf], k + suf).toBeUndefined();
    const sansPorteur = Object.fromEntries(Object.entries(porteur).filter(([k]) => !/^(peau|cheveux|yeux|voilure)(O|H)?$/.test(k)));
    expect(objet).toEqual(sansPorteur);
    expect(objet.aile).toBe(porteur.aile);
  });

  it('clés de vocabulaire déclarées par un def (ex. navire) : base + ombre/lumière dérivées, table intacte', () => {
    const m = buildTokenMap([{ coque: '#6b4a2b', toileDeVoile: '#e8e0cc' }], {});
    expect(m.coque).toBe('#6b4a2b');
    expect(m.coqueO).toBeDefined();
    expect(m.coqueH).toBeDefined();
    expect(m.toileDeVoile).toBe('#e8e0cc');
    expect(m.peau).toBe(defautDe('peau'));
    expect(applyTokenMap('<path fill="@coque" stroke="@coqueO"/><rect fill="@toileDeVoile"/>', m)).not.toContain('@');
  });

  it('clé hors table : aucune couche ne la résout, son jeton reste non résolu', () => {
    const horsTable: Record<string, string> = { gouvernail: '#6b4a2b' };
    const m = buildTokenMap([horsTable], {});
    expect(m.gouvernail).toBeUndefined();
    expect(applyTokenMap('<path fill="@gouvernail"/>', m)).toBe('<path fill="@gouvernail"/>');
  });
});

describe('palette — déclarations inertes (#1903 A4)', () => {
  it('une base égale à la couche défaut, gamme comprise, est inerte', () => {
    expect(declarationsInertes({ cuir: defautDe('cuir'), vet1: '#646464' })).toEqual(['cuir']);
  });

  it('un rôle égal à sa dérivation est inerte ; un rôle qui change la gamme ne l’est pas', () => {
    const derivee = buildTokenMap([{ vet1: '#646464' }]).vet1H;
    expect(declarationsInertes({ vet1: '#646464', vet1H: derivee })).toEqual(['vet1H']);
    expect(declarationsInertes({ vet1: '#646464', vet1H: '#ffeedd' })).toEqual([]);
  });

  it('point fixe : une gamme doublon de la couche défaut part entière, base puis rôle orphelin', () => {
    expect(declarationsInertes({ or: COUCHE_DEFAUT.or, orO: COUCHE_DEFAUT.orO, vet1: '#646464' })).toEqual(['or', 'orO']);
  });

  it('un rôle sans base, orphelin, est inerte', () => {
    expect(declarationsInertes({ cuir: '#123456', vet1O: '#101010' })).toEqual(['vet1O']);
  });

  it('une suiveuse déclarée égale à sa suivie n’est pas inerte : elle ne suit plus la surcharge', () => {
    expect(declarationsInertes({ corps: '#646464', aile: '#646464' })).toEqual([]);
  });

  it('le rôle d’une suiveuse sans sa base, sa suivie donnée, peint : il n’est pas inerte', () => {
    expect(declarationsInertes({ corps: '#646464', aileO: '#101010' })).toEqual([]);
  });

  it('une déclaration inerte sur la couche nue mais vivante sous une entrée du rig n’est pas inerte', () => {
    const greffe = (c: Record<string, string>) => [c, { ...c, peau: '#5d7a42' }];
    expect(declarationsInertes({ cheveux: '#2a2018', peauO: '#101010' })).toEqual(['peauO']);
    expect(declarationsInertes({ cheveux: '#2a2018', peauO: '#101010' }, greffe)).toEqual([]);
  });

  it('entrées comparées par indice : la couche elle-même d’un côté, des objets neufs de l’autre', () => {
    const peau = defautDe('peau');
    const greffe = (c: Record<string, string | undefined>) => (c.peau != null ? [c, c] : [c, { ...c, peau }]);
    expect(declarationsInertes({ peau, cheveux: '#2a2018' }, greffe)).toEqual(['peau']);
  });

  it('des entrées en nombre inégal avec et sans la clé lèvent', () => {
    const inegales = (c: Record<string, string | undefined>) => (c.vet1 != null ? [c] : [c, c]);
    expect(() => declarationsInertes({ vet1: '#646464' }, inegales)).toThrow(/entrée/);
  });
});
