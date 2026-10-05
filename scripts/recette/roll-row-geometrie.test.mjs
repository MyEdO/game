import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { defautsEnTete, mesurerRollRows, expressionMesureRollRows } from './roll-row-geometrie.mjs';

const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
const cellule = (r, texte) => ({ rect: r, texte, lignes: texte ? 1 : 0, texteRects: texte ? [{ ...r }] : [] });
function mesure() {
  return {
    page: { viewport: { largeur: 360, hauteur: 640 }, scroll: { largeur: 360, hauteur: 640 }, rect: rect(0, 0, 360, 640) },
    rangees: [{ index: 0, visible: true, participant: 'prow-0', table: false, pending: true, rect: rect(20, 20, 320, 100),
      calcul: cellule(rect(20, 42, 280, 18), '123 + 40 = 163'),
      de: { ...cellule(rect(20, 65, 100, 20), 'à lancer'), statut: 'à lancer', lignesStatut: 1, statutRects: [rect(42, 66, 70, 18)] },
      dr: cellule(rect(220, 65, 90, 20), '✓ +10 DR'),
    }],
    provenances: [],
  };
}

const classes = [
  ['calcul-multiligne', (m) => { m.rangees[0].calcul.lignes = 4; }],
  ['statut-multiligne', (m) => { m.rangees[0].de.lignesStatut = 2; }],
  ['de-multiligne', (m) => { m.rangees[0].de.lignes = 2; }],
  ['dr-multiligne', (m) => { m.rangees[0].dr.lignes = 2; }],
  ['cellule-hors-rangee', (m) => { m.rangees[0].dr.rect = rect(330, 65, 90, 20); }],
  ['texte-hors-cellule', (m) => { m.rangees[0].calcul.texteRects = [rect(20, 42, 330, 18)]; }],
  ['cellules-superposees', (m) => { m.rangees[0].dr.rect = rect(110, 65, 90, 20); m.rangees[0].dr.texteRects = [rect(110, 65, 90, 20)]; }],
  ['texte-superpose', (m) => { m.rangees[0].de.texteRects = [rect(110, 65, 140, 20)]; }],
  ['scroll-horizontal-page', (m) => { m.page.scroll.largeur = 380; }],
  ['scroll-vertical-page', (m) => { m.page.scroll.hauteur = 660; }],
];
for (const [classe, casser] of classes) {
  test(`${classe} : rouge puis géométrie corrigée verte`, () => {
    const rouge = mesure();
    casser(rouge);
    assert.ok(defautsEnTete(rouge).some((d) => d.includes(classe)));
    assert.deepEqual(defautsEnTete(mesure()), []);
  });
}

test('trois chiffres, +10 DR, pas trouvé, masque et seconde lecture restent confinés', () => {
  for (const texte of ['✓ +10 DR', 'pas trouvé', '?']) {
    const m = mesure();
    m.rangees[0].dr.texte = texte;
    m.rangees[0].pending = false;
    m.rangees[0].de.statut = '';
    m.rangees[0].de.lignesStatut = 0;
    const seconde = structuredClone(m.rangees[0]);
    seconde.index = 1;
    seconde.de.texte = 'même dé';
    m.rangees.push(seconde);
    assert.deepEqual(defautsEnTete(m), []);
    seconde.dr.lignes = 2;
    assert.ok(defautsEnTete(m).some((d) => d.includes('dr-multiligne')));
  }
});

test('la table autorise le résultat plié mais refuse son texte hors cellule', () => {
  const m = mesure();
  m.rangees[0].table = true;
  m.rangees[0].pending = false;
  m.rangees[0].dr = null;
  m.rangees[0].calcul.lignes = 3;
  m.rangees[0].calcul.texteRects = [rect(20, 42, 100, 5), rect(20, 48, 100, 5), rect(20, 54, 100, 5)];
  assert.deepEqual(defautsEnTete(m), []);
  m.rangees[0].calcul.texteRects[2] = rect(20, 54, 340, 5);
  assert.ok(defautsEnTete(m).some((d) => d.includes('texte-hors-cellule')));
});

test('les rangées non visibles ou détachées sont ignorées', () => {
  const m = mesure();
  m.rangees[0].visible = false;
  m.rangees[0].calcul.lignes = 4;
  m.rangees[0].de.lignesStatut = 2;
  assert.deepEqual(defautsEnTete(m), []);
  m.rangees[0].visible = true;
  assert.ok(defautsEnTete(m).some((d) => d.includes('calcul-multiligne')));
});

function avecProvenance() {
  const m = mesure();
  const deux = structuredClone(m.rangees[0]);
  deux.index = 1;
  deux.participant = 'prow-1';
  m.rangees.push(deux);
  const provenance = { rect: rect(220, 126, 90, 18), texteRects: [rect(220, 126, 90, 18)], participant: 'prow-0', ligneRect: rect(20, 20, 320, 130), rangees: [0] };
  m.rangees[0].provenance = provenance;
  m.provenances.push(provenance);
  return m;
}
for (const [classe, casser] of [
  ['provenance-participant', (m) => { m.rangees[0].provenance.participant = 'prow-1'; }],
  ['provenance-hors-ligne', (m) => { m.rangees[0].provenance.rect = rect(350, 126, 90, 18); }],
  ['provenance-superposee', (m) => { m.rangees[0].provenance.rect = rect(220, 65, 90, 18); }],
  ['provenance-detachee', (m) => { m.provenances[0].rangees = []; }],
]) {
  test(`${classe} : deux participants, marque attachée au premier`, () => {
    const m = avecProvenance();
    casser(m);
    assert.ok(defautsEnTete(m).some((d) => d.includes(classe)));
    assert.deepEqual(defautsEnTete(avecProvenance()), []);
  });
}

test('mesurerRollRows utilise seulement le kit evaluate', async () => {
  const appels = [];
  const attendu = mesure();
  const session = { rpc: async (method, params) => { appels.push([method, params]); return { result: { value: attendu } }; } };
  assert.deepEqual(await mesurerRollRows(session), attendu);
  assert.equal(appels.length, 1);
  assert.equal(appels[0][0], 'Runtime.evaluate');
  assert.equal(appels[0][1].expression, expressionMesureRollRows);
  assert.match(appels[0][1].expression, /createRange/);
  assert.match(appels[0][1].expression, /SHOW_TEXT/);
});

function sessionAvecRectangles({ plier = false } = {}) {
  const visites = [];
  const element = (r, texte = '') => ({ isConnected: true, textContent: texte, parentElement: null, nodes: [],
    getBoundingClientRect: () => r, getClientRects: () => [r], closest: () => null });
  const row = element(rect(20, 20, 320, 100));
  row.classList = { contains: (nom) => nom === 'pending' };
  const calcul = element(rect(20, 42, 280, 18), '123 + 40 = 163');
  const de = element(rect(20, 65, 100, 20), 'à lancer');
  const dr = element(rect(220, 65, 90, 20), '✓ +10 DR');
  const statut = element(rect(42, 66, 70, 18), 'à lancer');
  const n = (parentElement, textContent, rectangles) => ({ parentElement, textContent, rectangles });
  calcul.nodes = [n(calcul, '123 ', [rect(20, 42, 30, 16)]), n(calcul, '+ 40 = ', [rect(50, plier ? 66 : 45, 70, 13)]), n(calcul, '163', [rect(120, 44, 30, 14)])];
  statut.nodes = [n(statut, 'à lancer', [rect(42, 66, 70, 18)])];
  de.nodes = statut.nodes;
  dr.nodes = [n(dr, '✓ +10 DR', [rect(220, 65, 90, 20)])];
  for (const el of [calcul, de, dr, statut]) el.parentElement = row;
  row.querySelector = (selecteur) => ({ '.rm-roll-calc': calcul, '.rm-roll-dice': de, '.rm-roll-sl': dr, '.rm-roll-empty': statut })[selecteur] ?? null;
  const invisible = { ...row, isConnected: false };
  const cachee = { ...row, cachee: true };
  const horsVue = { ...row, getBoundingClientRect: () => rect(20, 800, 320, 100) };
  const root = { scrollWidth: 360, scrollHeight: 640, getBoundingClientRect: () => rect(0, 0, 360, 640) };
  const document = {
    scrollingElement: root,
    querySelectorAll: (s) => s === '.rm-roll' ? [row, invisible, cachee, horsVue] : [],
    createTreeWalker: (el, filtre) => {
      assert.equal(filtre, 4);
      let index = 0;
      return { nextNode: () => el.nodes[index++] ?? null };
    },
    createRange: () => {
      let node;
      return { selectNodeContents: (n) => { node = n; visites.push(n.textContent); }, getClientRects: () => node.rectangles };
    },
  };
  const contexte = { document, NodeFilter: { SHOW_TEXT: 4 }, innerWidth: 360, innerHeight: 640,
    getComputedStyle: (el) => ({ display: el.cachee ? 'none' : 'block', visibility: 'visible', opacity: '1', overflowX: 'visible', overflowY: 'visible' }) };
  return { visites, session: { rpc: async (method, params) => {
    assert.equal(method, 'Runtime.evaluate');
    return { result: { value: runInNewContext(params.expression, contexte) } };
  } } };
}

test('le collecteur parcourt tous les textes et réunit des polices 16/13/14px sur une ligne', async () => {
  const { session, visites } = sessionAvecRectangles();
  const m = await mesurerRollRows(session);
  assert.equal(m.rangees.length, 1);
  assert.equal(m.rangees[0].calcul.lignes, 1);
  assert.equal(m.rangees[0].calcul.texteRects.length, 3);
  assert.deepEqual(visites.filter((texte) => ['123 ', '+ 40 = ', '163'].includes(texte)), ['123 ', '+ 40 = ', '163']);
  assert.equal(m.rangees[0].de.lignesStatut, 1);
  assert.deepEqual(defautsEnTete(m), []);
});

test('le collecteur distingue un vrai retour à la ligne des variations de police', async () => {
  const { session } = sessionAvecRectangles({ plier: true });
  const m = await mesurerRollRows(session);
  assert.equal(m.rangees[0].calcul.lignes, 2);
  assert.ok(defautsEnTete(m).some((d) => d.includes('calcul-multiligne')));
});
