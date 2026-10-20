/**
 * PILOTE DE CASCADE RECOPIÉ — garde de cliquet (#1765).
 *
 * Une itération de test qui lit `pendingCascade` et joue un verbe `cascade*` PILOTE la cascade à la main,
 * à côté du kit (`cascade.testkit.ts`) : elle dérive quand un flux est refondu. La MESURE vit dans
 * `scripts/guards/lib/piloteCascadeAudit.ts`, partagée avec la régénération (`regenerations`) ; le stock
 * `scripts/guards/lib/piloteCascadeStock.mjs` porte les copies restantes et ne fait que décroître.
 */
import { beforeAll, describe, it, expect } from 'vitest';
import { EXEMPTIONS, bouclesPilotes, corpusMesure, regenerations, sitesDeBoucles, sitesPiloteCascade, type ExemptionPilote } from '../../scripts/guards/lib/piloteCascadeAudit';
import { PILOTE_CASCADE_RATCHET } from '../../scripts/guards/lib/piloteCascadeStock.mjs';
import { cleDeSite, ecartDuVolet, type Site } from '../../scripts/guards/lib/stock.mjs';
import { ecartDeRegeneration, texteEnPlace } from '../../scripts/guards/lib/stockDeSites.mjs';
import { detenteur } from '../detenteur.testkit';
import { avanceEtapeCascade, cascadeDeTest } from './cascade.testkit';
import type { CascadeStep } from '../noyau/pendings';
import type { GameState } from './store';
import { cleDeFixture } from '../noyau/noyau.testkit';

const STOCK = 'scripts/guards/lib/piloteCascadeStock.mjs';
const mesure = detenteur(() => {
  const corpus = corpusMesure();
  const boucles = bouclesPilotes(corpus);
  return { corpus, boucles, sites: sitesDeBoucles(boucles) };
});
const ecart = (s: readonly Site[] = mesure().sites) => ecartDuVolet({ sites: s, stock: PILOTE_CASCADE_RATCHET, ou: STOCK });

describe('pilote de cascade : aucune itération de test neuve ne pilote la cascade à la main (#1765)', () => {
  beforeAll(() => { mesure(); }, 60_000);

  it('aucun site NEUF, et aucune entrée SOLDÉE ne traîne au stock', () => {
    const { neuves, perimees } = ecart();
    expect(neuves, `Itérations NEUVES qui jouent une cascade à la main — passer par \`avanceEtapeCascade\`/\`draineCascade\` :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Entrées de ${STOCK} dont l'itération a migré ou disparu — relancer\n`
      + `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/piloteCascadeAudit.ts :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('le stock committé est un point fixe de sa régénération', () => {
    for (const r of regenerations(mesure().sites)) expect(ecartDeRegeneration(r, texteEnPlace(r.chemin))).toBeNull();
  });

  it('chaque exemption AU SITE couvre EXACTEMENT un site de son fichier', () => {
    const couverture = EXEMPTIONS.map((e) => `${e.fichier} ${e.motif} : ${mesure().boucles.filter((b) => b.rel === e.fichier && e.motif.test(b.ref)).length}`);
    expect(couverture).toEqual(EXEMPTIONS.map((e) => `${e.fichier} ${e.motif} : 1`));
  });
});

/**
 * MORSURE — EN MÉMOIRE, sur une suite RÉELLE hors du stock : une itération neuve y est ajoutée, la mesure de cette
 * seule suite remplace la sienne, et l'écart se lit contre le stock committé.
 */
describe('morsure : une itération de pilotage ajoutée à une suite rougit la garde', () => {
  const cible = detenteur(() => {
    const stockes = new Set(PILOTE_CASCADE_RATCHET.map((e) => e.fichier));
    return mesure().corpus.find((f) => f.rel.startsWith('src/state/') && !stockes.has(f.rel) && !f.text.includes('cascade.testkit'))!;
  });
  /** Les sites du corpus, la suite `cible` remesurée sur `texte`. */
  const avec = (texte: string): Site[] => [
    ...mesure().sites.filter((s) => s.file !== cible().rel),
    ...sitesPiloteCascade([{ rel: cible().rel, text: texte }]),
  ];
  /** `cible`, précédée de déclarations de MODULE, suivie d'un `it('morsure')` qui porte `corps`. */
  const ajoute = (corps: string, module = '') => `${module}\n${cible().text}\nit('morsure', () => {\n  ${corps}\n});\n`;
  const neuves = (texte: string) => ecart(avec(texte)).neuves;
  /** Les `ref` des sites de `texte` — `cible` n'en porte aucun : ce sont ceux de l'ajout. */
  const refs = (texte: string, exemptions?: readonly ExemptionPilote[]) => sitesPiloteCascade([{ rel: cible().rel, text: texte }], exemptions).map((s) => s.ref);
  const cle = (ref: string) => cleDeSite({ fichier: cible().rel, ref, occurrence: 1 });
  const KIT = "import { avanceEtapeCascade, cascadeDeTest } from './cascade.testkit';";
  const PAR_HELPER = `${KIT}\nconst avanceMorsure = () => avanceEtapeCascade(g);`;
  const CHOIX_A_LA_MAIN = 'const p = g().pendingCascade; if (!p) break; const cur = p.participants[p.cursor]; if (cur?.options && !cur.chosen) { g().cascadeChoose(cur.id, cur.options[0].key); g().cascadeNext(); continue; }';
  /** Une lecture et un verbe en ligne droite : piloter, dès qu'une itération les exécute. */
  const PILOTE = 'const p = g().pendingCascade; g().cascadeNext();';

  it('une boucle qui lit `pendingCascade` et appelle `cascadeNext` est un site NEUF, nommé', () => {
    expect(neuves(ajoute('for (let i = 0; i < 9 && g().pendingCascade; i++) g().cascadeNext();')).join('\n')).toContain(cle('it:morsure'));
  });

  it('la LECTURE par un helper local compte : la boucle qui l’appelle est un site', () => {
    const helper = 'const etapeMorsure = () => { const c = g().pendingCascade; return c?.participants[c.cursor]; };';
    expect(neuves(ajoute('for (let i = 0; i < 9 && etapeMorsure(); i++) g().cascadeNext();', helper)).join('\n')).toContain(cle('it:morsure'));
  });

  it('le VERBE par un helper local compte : la boucle qui l’appelle est un site', () => {
    const helper = 'const suivantMorsure = () => g().cascadeNext();';
    expect(neuves(ajoute('for (let i = 0; i < 9 && g().pendingCascade; i++) suivantMorsure();', helper)).join('\n')).toContain(cle('it:morsure'));
  });

  it('le CALLBACK d’un itérateur est une itération', () => {
    const corps = 'Array.from({ length: 9 }).forEach(() => { if (g().pendingCascade) g().cascadeNext(); });';
    expect(neuves(ajoute(corps)).join('\n')).toContain(cle('it:morsure'));
  });

  it('une fonction RÉCURSIVE est une itération', () => {
    const recursive = 'function joueMorsure(): void { if (!g().pendingCascade) return; g().cascadeNext(); joueMorsure(); }';
    expect(neuves(ajoute('joueMorsure();', recursive)).join('\n')).toContain(cle('fn:joueMorsure'));
  });

  it('un helper à UNE étape n’est pas un pilote : les deux boucles qui l’appellent sont des sites, la ligne droite non', () => {
    const pose = 'function poseMorsure() { const pc = g().pendingCascade!; g().cascadeNext(); }';
    const texte = `${pose}\n${cible().text}\nit('a', () => { for (let i = 0; i < 6; i++) poseMorsure(); });\nit('b', () => { for (let i = 0; i < 6; i++) poseMorsure(); });\nit('c', () => { poseMorsure(); poseMorsure(); poseMorsure(); });\n`;
    expect(refs(texte)).toEqual(['it:a', 'it:b']);
  });

  it('un homonyme LOCAL du kit, sans boucle, est un helper : la boucle qui l’appelle est un site', () => {
    const homonyme = 'function avanceEtapeCascade(get: () => GameState) { const p = get().pendingCascade!; get().cascadeRoll(p.participants[p.cursor].id); get().cascadeNext(); }';
    expect(refs(ajoute('for (let i = 0; i < 9 && g().pendingCascade; i++) avanceEtapeCascade(g);', homonyme))).toEqual(['it:morsure']);
  });

  it('une itération qui n’appelle que le kit IMPORTÉ, directement ou par un helper, n’est pas un site', () => {
    expect(neuves(ajoute('for (let i = 0; i < 9 && g().pendingCascade; i++) avanceEtapeCascade(g);', KIT))).toEqual([]);
    expect(neuves(ajoute('for (let i = 0; i < 9 && g().pendingCascade; i++) avanceMorsure();', PAR_HELPER))).toEqual([]);
  });

  it('le kit ET un choix joué à la main : un site, que le kit soit appelé directement ou par un helper', () => {
    expect(refs(ajoute(`for (let i = 0; i < 20; i++) { ${CHOIX_A_LA_MAIN} avanceEtapeCascade(g); }`, KIT))).toEqual(['it:morsure']);
    expect(refs(ajoute(`for (let i = 0; i < 20; i++) { ${CHOIX_A_LA_MAIN} avanceMorsure(); }`, PAR_HELPER))).toEqual(['it:morsure']);
    expect(refs(ajoute('for (let i = 0; i < 9 && g().pendingCascade; i++) { g().cascadeTableRoll(\'s0\'); avanceMorsure(); }', PAR_HELPER))).toEqual(['it:morsure']);
  });

  it('une boucle IMBRIQUÉE ne se compte qu’une fois : l’interne', () => {
    const corps = 'for (let s = 0; s < 3; s++) { useGame.setState({ battle: null }); for (let i = 0; i < 9 && g().pendingCascade; i++) g().cascadeNext(); }';
    expect(refs(ajoute(corps))).toEqual(['it:morsure']);
  });

  it('une fonction dont une itération pilote ne prête rien : la boucle externe qui l’appelle n’est pas un site', () => {
    const copie = 'function drainMorsure() { while (g().pendingCascade) { g().cascadeRoll(\'a\'); g().cascadeNext(); } }';
    expect(refs(ajoute('for (let s = 1; s <= 3 && g().pendingCascade; s++) { useGame.setState({ battle: null }); drainMorsure(); }', copie))).toEqual(['fn:drainMorsure']);
  });

  it('des fonctions MUTUELLES bouclées ne se prêtent rien : aucun site, sans point fixe', () => {
    const mutuelles = 'function lisMorsure() { while (g().pendingCascade) { joueMorsure(); } }\nfunction joueMorsure() { while (g().battle) { g().cascadeNext(); lisMorsure(); } }';
    expect(refs(ajoute('lisMorsure();', mutuelles))).toEqual([]);
  });

  it('une CHAÎNE alternée de profondeur 9 : seul le maillon qui appelle le helper final est un site, sans plafond', () => {
    const maillon = (i: number) => (i === 9 ? 'function maillon9() { return g().pendingCascade; }'
      : i % 2 ? `function maillon${i}() { while (g().battle) { const p = g().pendingCascade; maillon${i + 1}(); } }`
        : `function maillon${i}() { while (g().battle) { g().cascadeNext(); maillon${i + 1}(); } }`);
    const chaine = Array.from({ length: 9 }, (_, i) => maillon(i + 1)).join('\n');
    expect(refs(ajoute('maillon1();', chaine))).toEqual(['fn:maillon8']);
  });

  it('une exemption couvre un site SEUL : deux sites au même ref sont comptés tous deux', () => {
    const exemption: ExemptionPilote = { fichier: cible().rel, motif: /^it:morsure$/, raison: 'morsure' };
    const seul = ajoute('for (let i = 0; i < 9 && g().pendingCascade; i++) g().cascadeNext();');
    expect(refs(seul, [exemption])).toEqual([]);
    expect(refs(seul, [])).toEqual(['it:morsure']);
    const second = ajoute('for (let i = 0; i < 9 && g().pendingCascade; i++) g().cascadeNext();\n  while (g().pendingCascade) { g().cascadeRoll(\'a\'); g().cascadeNext(); }');
    expect(refs(second, [exemption])).toEqual(['it:morsure', 'it:morsure']);
  });

  it('le motif d’une exemption est ANCRÉ : un titre qui le prolonge n’est pas couvert', () => {
    const texte = `${cible().text}\nit('morsure — et autre chose', () => { while (g().pendingCascade) g().cascadeNext(); });\n`;
    expect(refs(texte, [{ fichier: cible().rel, motif: /^it:morsure$/, raison: 'morsure' }])).toEqual(['it:morsure — et autre chose']);
  });

  it('une boucle qui DÉCLARE des blocs de test ou des hooks ne les exécute pas : aucun site', () => {
    const declarees = `${cible().text}\nfor (const cad of ['a', 'b'] as const) {\n  it('morsure', () => { ${PILOTE} });\n  beforeEach(() => { ${PILOTE} });\n}\n`;
    expect(refs(declarees)).toEqual([]);
  });

  it('un bloc de test MODIFIÉ (`it.concurrent`, `it.skip`, `describe.each(rows)`) déclaré par une boucle reste différé : aucun site', () => {
    expect(refs(`${cible().text}\nfor (const c of [1, 2]) { it.concurrent('B', () => { ${PILOTE} }); }\n`)).toEqual([]);
    expect(refs(`${cible().text}\nfor (const c of [1, 2]) { it.skip('D', () => { ${PILOTE} }); }\n`)).toEqual([]);
    expect(refs(`${cible().text}\nfor (const c of [1, 2]) { describe.each([1])('D4', () => { ${PILOTE} }); }\n`)).toEqual([]);
  });

  it('un bloc de test en GABARIT ÉTIQUETÉ, PARENTHÉSÉ ou NON NUL déclaré par une boucle reste différé : aucun site', () => {
    const gabarit = 'it.each`a\n1`';
    expect(refs(`${cible().text}\nfor (const c of [1, 2]) { ${gabarit}('G', () => { ${PILOTE} }); }\n`)).toEqual([]);
    expect(refs(`${cible().text}\nfor (const c of [1, 2]) { (it.skip)('P', () => { ${PILOTE} }); }\n`)).toEqual([]);
    expect(refs(`${cible().text}\nfor (const c of [1, 2]) { it!('N', () => { ${PILOTE} }); }\n`)).toEqual([]);
  });

  it('un bloc de test atteint par un ACCÈS CALCULÉ à chaîne littérale (`it[\'skip\']`) déclaré par une boucle reste différé : aucun site', () => {
    expect(refs(`${cible().text}\nfor (const c of [1, 2]) { it['skip']('K', () => { ${PILOTE} }); }\n`)).toEqual([]);
    expect(refs(`${cible().text}\nfor (const c of [1, 2]) { describe['each']([1])('K2', () => { ${PILOTE} }); }\n`)).toEqual([]);
  });

  it('un VERBE appelé par accès calculé à chaîne littérale (`g()[\'cascadeNext\']()`) joue : la boucle est un site', () => {
    expect(refs(ajoute("while (g().pendingCascade) g()['cascadeNext']();"))).toEqual(['it:morsure']);
  });

  it('une LECTURE par accès calculé à chaîne littérale (`g()[\'pendingCascade\']`) lit : la boucle est un site', () => {
    expect(refs(ajoute("while (g()['pendingCascade']) g().cascadeNext();"))).toEqual(['it:morsure']);
  });

  it('un `declare` AMBIANT ne lie pas le bloc de test homonyme : déclaré par une boucle, il reste différé', () => {
    expect(refs(`declare function it(t: string, f: () => void): void;\n${cible().text}\nfor (const c of [1, 2]) { it('A1', () => { ${PILOTE} }); }\n`)).toEqual([]);
    expect(refs(`declare const test: (t: string, f: () => void) => void;\n${cible().text}\nfor (const c of [1, 2]) { test('A2', () => { ${PILOTE} }); }\n`)).toEqual([]);
  });

  it('un nom de bloc de test LIÉ dans une portée englobante n’en est pas un : son callback s’exécute dans la boucle', () => {
    const local = `${cible().text}\nit('T2', () => { for (let i = 0; i < 9; i++) { const test = g().pendingCascade!; test.participants.forEach((s) => g().cascadeRoll(s.id)); } });\n`;
    expect(refs(local)).toEqual(['it:T2']);
    expect(refs(ajoute(`const it = (t: string, f: () => void) => f(); for (let i = 0; i < 9; i++) it('Q4b', () => { ${PILOTE} });`))).toEqual(['it:morsure']);
  });

  it('le NOM PROPRE d’une expression de fonction ou de classe lie le bloc de test homonyme : son callback s’exécute dans la boucle', () => {
    expect(refs(ajoute(`const run = function it(t: string, f: () => void) { for (let i = 0; i < 9; i++) it('F1', () => { ${PILOTE} }); };`))).toEqual(['fn:run']);
    expect(refs(ajoute(`const K = class it { static go(f: () => void) { f(); } static boucle() { for (let i = 0; i < 9; i++) it.go(() => { ${PILOTE} }); } };`))).toEqual(['fn:boucle']);
  });

  it('une fonction qui DÉCLARE un bloc de test pilotant ne prête rien : la boucle qui l’appelle n’est pas un site', () => {
    expect(refs(`${cible().text}\nfunction declareMorsure(n: number) { it('d', () => { ${PILOTE} }); }\nfor (const c of [1, 2]) declareMorsure(c);\n`)).toEqual([]);
  });

  it('un RECEVEUR qui ne remonte pas à un bloc de test (`suite.test`) n’en déclare aucun : sa boucle est un site', () => {
    const corps = `for (let i = 0; i < 9; i++) { suite.test(() => { ${PILOTE} }); }`;
    expect(refs(`${cible().text}\nit('M', () => { ${corps} });\n`)).toEqual(['it:M']);
  });

  it('la boucle DANS un bloc de test déclaré par une boucle est un site, comme celle qui joue sous `act`', () => {
    const boucle = 'for (let i = 0; i < 9 && g().pendingCascade; i++) g().cascadeNext();';
    const dedans = `${cible().text}\nfor (const cad of ['a', 'b'] as const) {\n  it('dedans', () => { ${boucle} });\n}\n`;
    expect(refs(dedans)).toEqual(['it:dedans']);
    expect(refs(`${cible().text}\nit.each([1, 2, 3])('E2 %s', () => { ${boucle} });\n`)).toEqual(['it:E2 %s']);
    expect(refs(ajoute('for (let i = 0; i < 9; i++) act(() => { if (g().pendingCascade) g().cascadeNext(); });'))).toEqual(['it:morsure']);
  });

  it('la CLÉ d’une propriété `pendingCascade: …` écrit, elle ne lit pas', () => {
    expect(neuves(ajoute('for (const n of [1, 2]) { useGame.setState({ pendingCascade: null }); g().cascadeNext(); }'))).toEqual([]);
  });

  it('un callback de DONNÉES (sans lecture ni verbe) ne disqualifie pas un helper : la boucle qui l’appelle est un site', () => {
    const pose = 'function poseMorsure() { const pc = g().pendingCascade!; const i = pc.participants.findIndex((s) => s.kind === \'x\'); g().cascadeNext(); return i; }';
    expect(refs(ajoute('for (let i = 0; i < 6; i++) poseMorsure();', pose))).toEqual(['it:morsure']);
  });

  it('le RECEVEUR d’un itérateur ne s’itère pas', () => {
    const tire = 'const tireMorsure = () => { g().cascadeRoll(\'s0\'); return [1, 2]; };';
    expect(neuves(ajoute('tireMorsure().map(() => g().pendingCascade);', tire))).toEqual([]);
  });

  it('un nom importé du kit n’est pas un verbe, importé nommé ou par ESPACE DE NOMS', () => {
    expect(neuves(ajoute('for (const n of [1, 2]) { const p = g().pendingCascade; useGame.setState({ pendingCascade: cascadeDeTest([], { cursor: n }) }); }', KIT))).toEqual([]);
    const espace = "import * as kit from './cascade.testkit';";
    expect(neuves(ajoute('for (const n of [1, 2]) { const p = g().pendingCascade; useGame.setState({ pendingCascade: kit.cascadeDeTest([], { cursor: n }) }); }', espace))).toEqual([]);
    expect(neuves(ajoute("for (const n of [1, 2]) { const p = g().pendingCascade; useGame.setState({ pendingCascade: kit['cascadeDeTest']([], { cursor: n }) }); }", espace))).toEqual([]);
  });
});

describe('le kit LÈVE sur une étape qui porte à la fois une table et un dé nu', () => {
  it('`avanceEtapeCascade` nomme l’étape à deux porteurs au lieu d’en jouer un', () => {
    const etape: CascadeStep = { id: 's0', kind: cleDeFixture('table'), table: { tableId: 't' }, de: {} };
    const rien = () => {};
    const etat = { pendingCascade: cascadeDeTest([etape]), cascadeTableRoll: rien, cascadeDieRoll: rien, cascadeNext: rien };
    expect(() => avanceEtapeCascade(() => etat as unknown as GameState)).toThrow(/« s0 ».*`table`.*`de`/);
  });
});

describe("l'autre sens du cliquet : une entrée que plus aucun site ne porte est SOLDÉE", () => {
  it('une entrée fantôme ressort en `perimees`, avec le geste', () => {
    const fantome = { fichier: PILOTE_CASCADE_RATCHET[0].fichier, ref: 'fn:boucleQuiNExistePlus', occurrence: 1 };
    const { perimees } = ecartDuVolet({ sites: mesure().sites, stock: [...PILOTE_CASCADE_RATCHET, fantome], ou: STOCK });
    expect(perimees).toHaveLength(1);
    expect(perimees[0]).toContain(fantome.ref);
  });
});
