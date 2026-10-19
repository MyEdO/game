// Mesure des dépendances de VALEUR de l'attaque hors zones autorisées (lecture seule).
const path = require('path'); const fs = require('fs');
const ROOT = '/home/user/game/.wt-2888-2b';
const ts = require('/opt/node-tools/node_modules/typescript');
const SRC = ROOT + '/src/';
const OUT = '/tmp/claude-0/-home-user-game/b1b0df2b-498c-56b2-b1cf-fa2718966559/scratchpad/vague3/';
const ALLOWED = new Set(['engine', 'data', 'lib', 'geometry', 'i18n', 'noyau']);

const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(ROOT + '/tsconfig.json', ts.sys.readFile).config, ts.sys, ROOT);
const FILES = { flow: SRC + 'state/combatFlow.ts', specs: SRC + 'state/rollFlowSpecs.ts', slice: SRC + 'state/combatSlice.ts' };
const program = ts.createProgram({ rootNames: Object.values(FILES), options: { ...cfg.options, noEmit: true } });
const checker = program.getTypeChecker();
const zoneOf = (f) => { if (!f.startsWith(SRC)) return 'ext'; const r = f.slice(SRC.length); return r.includes('/') ? r.split('/')[0] : 'racine'; };
const rel = (f) => f.startsWith(SRC) ? f.slice(SRC.length) : f;
const modName = (f) => rel(f).replace(/\.tsx?$/, '');
const line = (n) => n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1;
const endLine = (n) => n.getSourceFile().getLineAndCharacterOfPosition(n.getEnd()).line + 1;

// ---------- owner key d'une déclaration ----------
const OWN = (k) => ts.isVariableDeclaration(k) || ts.isFunctionDeclaration(k) || ts.isClassDeclaration(k) || ts.isEnumDeclaration(k);
function ownerOf(decl) {
  let best = null; let n = decl;
  while (n && !ts.isSourceFile(n)) {
    if (OWN(n) && n.name && ts.isIdentifier(n.name)) {
      best = n;
      if (ts.isBlock(n.parent?.parent?.parent ?? n) && false) {}
    }
    // direct du corps de createCombatSlice : s'arrête là
    if ((ts.isVariableStatement(n) || ts.isFunctionDeclaration(n)) && n.parent && ts.isBlock(n.parent) && n.parent.parent && ts.isFunctionDeclaration(n.parent.parent) && n.parent.parent.name?.text === 'createCombatSlice') {
      const d = ts.isVariableStatement(n) ? n.declarationList.declarations.find((x) => x.pos <= decl.pos && x.end >= decl.end) ?? n.declarationList.declarations[0] : n;
      return { node: d, name: 'createCombatSlice.' + d.name.text, file: d.getSourceFile().fileName };
    }
    n = n.parent;
  }
  if (!best) return null;
  return { node: best, name: best.name.text, file: best.getSourceFile().fileName };
}
const keyOf = (o) => rel(o.file) + '#' + o.name;

// ---------- collecte des références de valeur d'un noeud ----------
const refCache = new Map();
function symbolOfId(id) {
  let sym;
  if (ts.isShorthandPropertyAssignment(id.parent) && id.parent.name === id) sym = checker.getShorthandAssignmentValueSymbol(id.parent);
  else sym = checker.getSymbolAtLocation(id);
  return sym;
}
function resolveAlias(sym) {
  if (sym && (sym.flags & ts.SymbolFlags.Alias)) { try { return checker.getAliasedSymbol(sym); } catch { return null; } }
  return sym;
}
const isDeclName = (id) => {
  const p = id.parent;
  if (!p) return false;
  if (ts.isShorthandPropertyAssignment(p)) return false;
  if ((ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isBindingElement(p) || ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p) || ts.isClassDeclaration(p) || ts.isEnumMember(p) || ts.isLabeledStatement(p) || ts.isGetAccessor(p) || ts.isSetAccessor(p)) && p.name === id) return true;
  if (ts.isBindingElement(p) && p.propertyName === id) return true;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return true;
  if (ts.isQualifiedName(p)) return true;
  if ((ts.isBreakOrContinueStatement(p))) return true;
  return false;
};
function refsOf(unitNode) {
  // retourne {deps: Map key->{key,file,name,zone,declNode,count}, get:{calls,passed,fields:Map}, set:{calls,passed,fields:Map}, actions:Map, spec:[] }
  if (refCache.has(unitNode)) return refCache.get(unitNode);
  const res = { deps: new Map(), get: { calls: 0, passed: 0, fields: new Map() }, set: { calls: 0, passed: 0, fields: new Map(), fnForm: 0 }, actions: new Map(), locals: 0 };
  const sf = unitNode.getSourceFile();
  const inside = (d) => d.getSourceFile() === sf && d.pos >= unitNode.pos && d.end <= unitNode.end;
  const addDep = (sym, extraKey) => {
    sym = resolveAlias(sym); if (!sym || !sym.declarations || !sym.declarations.length) return;
    if (!(sym.flags & ts.SymbolFlags.Value)) return;
    const decl = sym.declarations.find((d) => !ts.isInterfaceDeclaration(d) && !ts.isTypeAliasDeclaration(d)) ?? sym.declarations[0];
    if (inside(decl)) { res.locals++; return; }
    const f = decl.getSourceFile().fileName;
    if (zoneOf(f) === 'ext') return;
    const own = ownerOf(decl) ?? { node: decl, name: sym.name, file: f };
    let name = own.name; let key = keyOf(own);
    if (extraKey) { name = extraKey; key = rel(f) + '#' + extraKey; }
    const e = res.deps.get(key) ?? { key, file: f, name, zone: zoneOf(f), declNode: own.node, count: 0 };
    e.count++; res.deps.set(key, e);
  };
  const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
  function visit(n) {
    if (ts.isTypeNode(n) && !ts.isExpressionWithTypeArguments(n)) return;
    if (ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) return;
    if (ts.isPropertyAccessExpression(n)) {
      // actions de store : méthode déclarée en signature dans src/state
      const s = checker.getSymbolAtLocation(n.name);
      if (s && s.declarations && s.declarations.some((d) => (ts.isPropertySignature(d) || ts.isMethodSignature(d)) && zoneOf(d.getSourceFile().fileName) === 'state')) {
        let isFn = false; try { isFn = checker.getTypeOfSymbolAtLocation(s, n.name).getCallSignatures().length > 0; } catch {}
        if (isFn) bump(res.actions, n.name.text);
      }
      // espace de noms
      if (ts.isIdentifier(n.expression)) {
        const es = resolveAlias(checker.getSymbolAtLocation(n.expression));
        if (es && (es.flags & (ts.SymbolFlags.ValueModule | ts.SymbolFlags.NamespaceModule)) && es.declarations?.some(ts.isSourceFile)) { const m = checker.getSymbolAtLocation(n.name); if (m) addDep(m); visit(n.name); return; }
        // FLOWS.attack / FLOWS.defense
        if (n.expression.text === 'FLOWS') { const es2 = resolveAlias(checker.getSymbolAtLocation(n.expression)); if (es2 && es2.declarations?.[0] && rel(es2.declarations[0].getSourceFile().fileName) === 'state/rollFlowSpecs.ts' && (n.name.text === 'attack' || n.name.text === 'defense')) { addDep(es2, 'FLOWS.' + n.name.text); return; } }
      }
      visit(n.expression); return;
    }
    if (ts.isIdentifier(n)) {
      if (isDeclName(n)) return;
      const sym = symbolOfId(n);
      if (!sym) return;
      // get / set : paramètres
      if ((n.text === 'get' || n.text === 'set') && sym.declarations?.some(ts.isParameter)) {
        const p = n.parent; const st = res[n.text];
        if (ts.isCallExpression(p) && p.expression === n) {
          st.calls++;
          if (n.text === 'get') {
            if (ts.isPropertyAccessExpression(p.parent) && p.parent.expression === p) bump(st.fields, p.parent.name.text);
            else bump(st.fields, '*entier*');
          } else {
            const a = p.arguments[0];
            const keysOf = (o) => { if (!o) return; if (ts.isParenthesizedExpression(o)) return keysOf(o.expression); if (ts.isObjectLiteralExpression(o)) { for (const pr of o.properties) { if (pr.name && ts.isIdentifier(pr.name)) bump(st.fields, pr.name.text); else if (ts.isSpreadAssignment(pr)) {} } } else if (ts.isArrowFunction(o) || ts.isFunctionExpression(o)) { st.fnForm++; const b = o.body; if (ts.isBlock(b)) { const rt = []; (function w(x) { if (ts.isReturnStatement(x) && x.expression) rt.push(x.expression); ts.forEachChild(x, (c) => { if (!ts.isFunctionLike(c)) w(c); }); })(b); rt.forEach(keysOf); } else keysOf(b); } else if (ts.isConditionalExpression(o)) { keysOf(o.whenTrue); keysOf(o.whenFalse); } else bump(st.fields, '?' + ts.SyntaxKind[o.kind]); };
            keysOf(a);
          }
        } else st.passed++;
        return;
      }
      addDep(sym);
      return;
    }
    ts.forEachChild(n, visit);
  }
  ts.forEachChild(unitNode, visit);
  refCache.set(unitNode, res);
  return res;
}

// ---------- unités ----------
const units = []; // {id,file,name,node,group:Set,start,end}
const byKey = new Map();
function addUnit(file, name, node, group, startNode) {
  const key = rel(file) + '#' + name; if (byKey.has(key)) { byKey.get(key).group.add(group); return byKey.get(key); }
  const u = { key, file, name, node, group: new Set([group]), start: line(startNode ?? node), end: endLine(startNode ?? node) };
  units.push(u); byKey.set(key, u); return u;
}
const R_ATK = { flow: [[315, 540], [689, 1110], [1616, 2640], [2641, 3190], [3277, 3790], [3791, 4336], [4485, 4586], [7124, 7300]], specs: [[71, 130]] };
const R_SORT = [[2401, 2452], [5895, 6030], [6115, 6509]];
const inR = (l, rs) => rs.some(([a, b]) => l >= a && l <= b);
function topUnits(sf, ranges, group, uniq) {
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isExportDeclaration(st)) continue;
    const l = line(st); if (!inR(l, ranges)) continue;
    if (ts.isFunctionDeclaration(st) && st.name) addUnit(sf.fileName, st.name.text, st, group);
    else if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) { if (ts.isIdentifier(d.name)) addUnit(sf.fileName, d.name.text, d, group, st); }
    else if (ts.isExpressionStatement(st)) { const t = st.expression.getText().slice(0, 60).replace(/\s+/g, ' '); addUnit(sf.fileName, 'top@' + l + ':' + t.split('(')[0] + (ts.isCallExpression(st.expression) && st.expression.arguments[0] && ts.isStringLiteral(st.expression.arguments[0]) ? "('" + st.expression.arguments[0].text + "')" : ''), st, group); }
    else if (ts.isEnumDeclaration(st) || ts.isClassDeclaration(st)) { if (st.name) addUnit(sf.fileName, st.name.text, st, group); }
  }
}
const sfFlow = program.getSourceFile(FILES.flow), sfSpecs = program.getSourceFile(FILES.specs), sfSlice = program.getSourceFile(FILES.slice);
topUnits(sfFlow, R_ATK.flow, 'attaque'); topUnits(sfSpecs, R_ATK.specs, 'attaque'); topUnits(sfFlow, R_SORT, 'sorts');
// FLOWS.attack / FLOWS.defense
for (const st of sfSpecs.statements) if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (d.name.getText() === 'FLOWS') {
  const obj = d.initializer; for (const p of obj.properties) if (p.name && ['attack', 'defense'].includes(p.name.getText())) addUnit(sfSpecs.fileName, 'FLOWS.' + p.name.getText(), p, 'attaque');
}
// combatSlice : actions
const SLICE_ACT = ['attackRoll', 'attackConfirm', 'defenseConfirm', 'fumbleConfirm', 'handGateConfirm', 'fateNegate', 'fateSurvive', 'fateAccept', 'cleaveAttack', 'cleaveEnd', 'dualStrikeAttack', 'dualStrikeSkip', 'attackSetLocation', 'attackSetWeapon', 'attackSetDualMode', 'attackSetHarpoonRopeCut', 'attackSetWithhold', 'attackSetGrapple', 'attackSetCritLocation', 'defenseSetMode', 'defenseSetParryWeapon', 'defenseSetShieldReaction', 'defenseSetRiposte'];
(function w(n) { if ((ts.isPropertyAssignment(n) || ts.isMethodDeclaration(n)) && n.name && ts.isIdentifier(n.name) && SLICE_ACT.includes(n.name.text) && n.parent && ts.isObjectLiteralExpression(n.parent) && line(n) > 500) addUnit(sfSlice.fileName, 'slice.' + n.name.text, n, 'attaque'); ts.forEachChild(n, w); })(sfSlice);
const LIST_ONLY = units.length;

// ---------- résolution des références en unités / hors zone ----------
function candidateNode(key) { return null; }
// index de tous les candidats (fonctions top-level / locaux de createCombatSlice des 3 fichiers)
const cand = new Map();
function indexCandidates(sf) {
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) { cand.set(rel(sf.fileName) + '#' + st.name.text, st); if (st.name.text === 'createCombatSlice' && st.body) for (const s2 of st.body.statements) { if (ts.isFunctionDeclaration(s2) && s2.name) cand.set(rel(sf.fileName) + '#createCombatSlice.' + s2.name.text, s2); if (ts.isVariableStatement(s2)) for (const d of s2.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer && ts.isFunctionLike(d.initializer)) cand.set(rel(sf.fileName) + '#createCombatSlice.' + d.name.text, d); } }
    else if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) cand.set(rel(sf.fileName) + '#' + d.name.text, d);
  }
}
[sfFlow, sfSpecs, sfSlice].forEach(indexCandidates);

const unitDeps = new Map(); // key -> {intern:Set(unit keys), horsListe:Set(cand keys), externes: Map(key->dep), refs}
function classify(u) {
  const r = refsOf(u.node);
  const intern = new Map(), horsListe = new Map(), externes = new Map(), moduleVars = new Map();
  for (const d of r.deps.values()) {
    if (d.zone !== 'state' || !['state/combatFlow.ts', 'state/rollFlowSpecs.ts', 'state/combatSlice.ts'].includes(rel(d.file))) {
      if (ALLOWED.has(d.zone)) continue;
      externes.set(d.key, d); continue;
    }
    if (byKey.has(d.key)) { if (d.key !== u.key) intern.set(d.key, d); continue; }
    if (cand.has(d.key)) horsListe.set(d.key, d); else moduleVars.set(d.key, d);
  }
  return { r, intern, horsListe, externes, moduleVars };
}
// ---------- sortie ----------
const out = []; const P = (s = '') => out.push(s);
const modOf = (d) => d.zone === 'state' ? modName(d.file) : d.zone + '/' + modName(d.file).split('/').slice(1).join('/');
function fmtDeps(ext) {
  const g = new Map(); for (const d of ext.values()) { const m = modOf(d); (g.get(m) ?? g.set(m, []).get(m)).push(d.name.replace(/^.*#/, '')); }
  return [...g.entries()].sort().map(([m, s]) => m.replace(/^state\//, '') + '.{' + [...new Set(s)].sort().join(',') + '}').join(' ; ');
}
const fmtMap = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '×' + v).join(' ');

const info = new Map();
for (const u of units) info.set(u.key, classify(u));
// extension (un niveau)
const ext1 = new Map();
for (const [k, c] of info) for (const [hk] of c.horsListe) { if (!ext1.has(hk)) ext1.set(hk, new Set()); ext1.get(hk).add(k); }

// SCC / ordre topologique
function tarjan(nodes, edges) {
  let idx = 0; const st = [], on = new Set(), I = new Map(), L = new Map(), sccs = [];
  const sc = (v) => { I.set(v, idx); L.set(v, idx); idx++; st.push(v); on.add(v); for (const w of edges.get(v) ?? []) { if (!I.has(w)) { sc(w); L.set(v, Math.min(L.get(v), L.get(w))); } else if (on.has(w)) L.set(v, Math.min(L.get(v), I.get(w))); } if (L.get(v) === I.get(v)) { const c = []; let w; do { w = st.pop(); on.delete(w); c.push(w); } while (w !== v); sccs.push(c); } };
  for (const v of nodes) if (!I.has(v)) sc(v); return sccs;
}
const edges = new Map(units.map((u) => [u.key, [...info.get(u.key).intern.keys()]]));
const sccs = tarjan(units.map((u) => u.key), edges);

const JSONOUT = { units: [], sccs };
// ----- TABLE 1
P('# Mesure automatique (TypeScript compiler API) — dépendances de VALEUR hors zones autorisées');
P('');
P(`Arbre ${ROOT}, HEAD ${require('child_process').execSync('git -C ' + ROOT + ' rev-parse --short HEAD').toString().trim()}. Script : \`sondes/mesure.cjs\`. Unités : ${units.length}.`);
P('Une dépendance = identifiant de valeur dans le corps de l\'unité, résolu (alias suivis, barils traversés) à sa déclaration finale ; zones autorisées (engine, data, lib, geometry, i18n, noyau) omises ; locaux omis. `get`/`set` = paramètres store (appels, champs lus par `get().X`, clés écrites par `set({...})`, `fn` = forme fonctionnelle `set((s)=>…)`, `passé` = transmis en argument à un autre appelé).');
P('');
const grpName = (u) => [...u.group].join('+');
P('## 1. Table par unité');
P('');
P('| unité | fichier:lignes | grp | dépendances hors zones (module.{symboles}) | get (appels/champs/passé) | set (appels/clés/passé) | actions de store appelées | variables de module internes | internes (appelés dans la liste) | hors liste (cand.) |');
P('|---|---|---|---|---|---|---|---|---|---|');
for (const u of units) {
  const c = info.get(u.key); const g = c.r.get, s = c.r.set;
  P(`| ${u.name} | ${rel(u.file).replace('state/', '')}:${u.start}-${u.end} (${u.end - u.start + 1}) | ${grpName(u)} | ${fmtDeps(c.externes) || '-'} | ${g.calls}/${fmtMap(g.fields) || '-'}/${g.passed} | ${s.calls}/${fmtMap(s.fields) || '-'}${s.fnForm ? ' fn×' + s.fnForm : ''}/${s.passed} | ${[...c.r.actions.keys()].join(',') || '-'} | ${[...c.moduleVars.values()].map((d) => d.name).join(',') || '-'} | ${[...c.intern.values()].map((d) => d.name).join(',') || '-'} | ${[...c.horsListe.values()].map((d) => d.name).join(',') || '-'} |`);
}
// ----- Agrégat par symbole externe
const sym = new Map();
for (const u of units) for (const d of info.get(u.key).externes.values()) { const e = sym.get(d.key) ?? { d, units: new Set(), attaque: new Set(), sorts: new Set() }; e.units.add(u.name); for (const gname of u.group) e[gname]?.add(u.name); sym.set(d.key, e); }
P(''); P('## 2. Agrégat par symbole externe (utilisé par N unités)'); P('');
P('| symbole | module | zone | unités attaque | unités sorts | exemples |'); P('|---|---|---|---|---|---|');
for (const e of [...sym.values()].sort((a, b) => b.units.size - a.units.size || a.d.key.localeCompare(b.d.key))) P(`| ${e.d.name} | ${modName(e.d.file)} | ${e.d.zone} | ${e.attaque.size} | ${e.sorts.size} | ${[...e.units].slice(0, 5).join(', ')} |`);

// ----- graphe interne
P(''); P('## 3. Graphe interne et ordre topologique (feuilles d\'abord ; composantes fortement connexes entre accolades)'); P('');
const callers = new Map(); for (const [k, es] of edges) for (const e of es) (callers.get(e) ?? callers.set(e, []).get(e)).push(k);
let rank = 0;
P('| rang | composante | appelle (dans la liste) | appelée par (dans la liste) |'); P('|---|---|---|---|');
for (const c of sccs) { rank++; const nm = (k) => byKey.get(k).name; const out1 = new Set(); for (const k of c) for (const e of edges.get(k)) if (!c.includes(e)) out1.add(nm(e)); const in1 = new Set(); for (const k of c) for (const e of callers.get(k) ?? []) if (!c.includes(e)) in1.add(nm(e));
  P(`| ${rank} | ${c.length > 1 ? '{' + c.map(nm).join(', ') + '}' : nm(c[0])} | ${[...out1].join(', ') || '(feuille)'} | ${[...in1].join(', ') || '(racine)'} |`); }
P(''); P(`Composantes cycliques (taille>1) : ${sccs.filter((c) => c.length > 1).map((c) => c.length).join(', ') || 'aucune'}.`);

// ----- hors liste
P(''); P('## 4. Appelés directs HORS liste (fonctions de combatFlow / rollFlowSpecs / combatSlice, un niveau)'); P('');
P('| fonction | fichier:lignes | appelée par (unités de la liste) | dépendances hors zones propres |'); P('|---|---|---|---|');
const extInfo = new Map();
for (const [hk, by] of ext1) { const node = cand.get(hk); const u = { key: hk, name: hk.split('#')[1], node, file: node.getSourceFile().fileName, start: line(node), end: endLine(node), group: new Set(['ext']) }; const c = classify(u); extInfo.set(hk, { u, c });
  P(`| ${u.name} | ${rel(u.file).replace('state/', '')}:${u.start}-${u.end} | ${[...by].map((k) => byKey.get(k).name).join(', ')} | ${fmtDeps(c.externes) || '-'} |`); }
// fermeture transitive dans les 3 fichiers (taille seulement)
function closureInternal() {
  const seen = new Set(units.map((u) => u.key)); const q = [...units.map((u) => u.key)]; const nodeOf = (k) => byKey.get(k)?.node ?? cand.get(k);
  while (q.length) { const k = q.pop(); const n = nodeOf(k); if (!n) continue; const r = refsOf(n); for (const d of r.deps.values()) if (cand.has(d.key) && !seen.has(d.key)) { seen.add(d.key); q.push(d.key); } }
  return seen;
}
const clo = closureInternal();
P(''); P(`Fermeture transitive de l'attaque dans les trois fichiers (fonctions/constantes top-level + locaux de createCombatSlice) : ${clo.size} candidats atteints (liste initiale ${units.length}) ; total candidats ${cand.size}. Par fichier : ${[...clo].reduce((m, k) => (m[k.split('#')[0]] = (m[k.split('#')[0]] ?? 0) + 1, m), {}) && JSON.stringify([...clo].reduce((m, k) => (m[k.split('#')[0]] = (m[k.split('#')[0]] ?? 0) + 1, m), {}))}`);

// ----- fermeture par symbole externe (symbol-level) et par module (file-level)
function resolveSpec(spec, from) { const r = ts.resolveModuleName(spec, from, cfg.options, ts.sys); return r.resolvedModule?.resolvedFileName; }
const fileClosCache = new Map();
function importsOf(f) {
  const sf = program.getSourceFile(f); const res = [];
  if (!sf) return res;
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) { const ic = st.importClause; if (ic) { if (ic.isTypeOnly) continue; if (!ic.name && ic.namedBindings && ts.isNamedImports(ic.namedBindings) && ic.namedBindings.elements.length && ic.namedBindings.elements.every((e) => e.isTypeOnly)) continue; } const t = resolveSpec(st.moduleSpecifier.text, f); if (t) res.push(t); }
    else if (ts.isExportDeclaration(st) && st.moduleSpecifier) { if (st.isTypeOnly) continue; if (st.exportClause && ts.isNamedExports(st.exportClause) && st.exportClause.elements.length && st.exportClause.elements.every((e) => e.isTypeOnly)) continue; const t = resolveSpec(st.moduleSpecifier.text, f); if (t) res.push(t); }
  }
  return res;
}
function fileClosure(f) {
  const seen = new Set([f]); const parent = new Map(); const q = [f];
  while (q.length) { const x = q.shift(); for (const y of importsOf(x)) { if (!y.startsWith(SRC) || seen.has(y)) continue; if (ALLOWED.has(zoneOf(y))) continue; seen.add(y); parent.set(y, x); q.push(y); } }
  return { seen, parent };
}
const chain = (parent, to) => { const c = [to]; let x = to; while (parent.has(x)) { x = parent.get(x); c.push(x); } return c.reverse().map(modName).join(' > '); };

// symbol-level closure
function symClosure(rootDecl, rootKey) {
  const seen = new Map([[rootKey, null]]); const q = [[rootKey, rootDecl]]; const meta = new Map([[rootKey, rootDecl]]);
  while (q.length) { const [k, node] = q.shift(); const r = refsOf(node); for (const d of r.deps.values()) { if (ALLOWED.has(d.zone) || seen.has(d.key)) continue; seen.set(d.key, k); meta.set(d.key, d); q.push([d.key, d.declNode]); } }
  return { seen, meta };
}
const keyFile = (k) => k.split('#')[0];
P(''); P('## 5. Fermeture par symbole externe utilisé (précis : références de valeur d\'une déclaration, transitives hors zones autorisées)'); P('');
P('Colonnes : décl. = nombre de déclarations atteintes (soi inclus) ; fichiers state = nombre de fichiers `src/state` distincts ; autres zones = fichiers hors state/zones autorisées ; store = atteint une déclaration de `store.ts` (chaîne la plus courte) ; combatFlow = atteint `combatFlow.ts`.');
P(''); P('| symbole | décl. | fichiers state | autres zones | store.ts ? | combatFlow.ts ? | chaîne vers store |'); P('|---|---|---|---|---|---|---|');
const symRows = [];
for (const e of [...sym.values()].sort((a, b) => a.d.key.localeCompare(b.d.key))) {
  const { seen } = symClosure(e.d.declNode, e.d.key);
  const files = new Set([...seen.keys()].map(keyFile));
  const stateF = [...files].filter((f) => f.startsWith('state/')); const other = [...files].filter((f) => !f.startsWith('state/'));
  let storeKey = [...seen.keys()].find((k) => keyFile(k) === 'state/store.ts');
  let ch = '';
  if (storeKey) { const c = [storeKey]; let x = storeKey; while (seen.get(x)) { x = seen.get(x); c.push(x); } ch = c.reverse().map((k) => k.replace('state/', '')).join(' > '); }
  const flowReached = files.has('state/combatFlow.ts');
  symRows.push({ name: e.d.name, mod: modName(e.d.file), n: seen.size, stateF, other, store: !!storeKey, flow: flowReached });
  P(`| ${modName(e.d.file).replace('state/', '')}.${e.d.name} | ${seen.size} | ${stateF.length} | ${other.length ? other.join(',') : '-'} | ${storeKey ? 'OUI' : 'non'} | ${flowReached ? 'OUI' : 'non'} | ${ch.length > 300 ? ch.slice(0, 300) + '…' : ch} |`);
}
// par module : fichier-level + union symbole-level
P(''); P('## 6. Par module de state (fermeture de FICHIER par imports de valeur — sur-estime —, et union des fermetures de symboles utilisés par l\'attaque)'); P('');
P('| module | symboles utilisés (attaque+sorts) | fichiers state (imports valeur) | store ? | combatFlow ? | fichiers state (symboles utilisés) | store (symboles) ? | autres zones (symboles) |'); P('|---|---|---|---|---|---|---|---|');
const mods = new Map(); for (const e of sym.values()) (mods.get(e.d.file) ?? mods.set(e.d.file, []).get(e.d.file)).push(e);
for (const [f, es] of [...mods.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const { seen, parent } = fileClosure(f);
  const sf = [...seen].filter((x) => zoneOf(x) === 'state').length;
  const hasStore = seen.has(SRC + 'state/store.ts'), hasFlow = seen.has(SRC + 'state/combatFlow.ts');
  const U = new Set(); for (const e of es) { const { seen: s2 } = symClosure(e.d.declNode, e.d.key); for (const k of s2.keys()) U.add(keyFile(k)); }
  const stU = [...U].filter((x) => x.startsWith('state/')); const oth = [...U].filter((x) => !x.startsWith('state/'));
  P(`| ${modName(f)}${zoneOf(f) !== 'state' ? ' (' + zoneOf(f) + ')' : ''} | ${[...new Set(es.map((e) => e.d.name))].sort().join(', ')} | ${sf}${[...seen].filter((x) => zoneOf(x) !== 'state').length ? ' (+' + [...seen].filter((x) => zoneOf(x) !== 'state').length + ' autres zones)' : ''} | ${hasStore ? 'OUI (' + chain(parent, SRC + 'state/store.ts') + ')' : 'non'} | ${hasFlow ? 'OUI' : 'non'} | ${stU.length} | ${U.has('state/store.ts') ? 'OUI' : 'non'} | ${oth.join(', ') || '-'} |`);
}

// ----- 4bis : champs get/set des appelés hors liste
P(''); P('## 4bis. Hors liste : champs lus/écrits du store, actions de store, variables de module'); P('');
P('| fonction | get (appels/champs/passé) | set (appels/clés/passé) | actions de store | variables de module (autres) |'); P('|---|---|---|---|---|');
for (const [hk, { u, c }] of extInfo) { const g = c.r.get, st = c.r.set; P(`| ${u.name} | ${g.calls}/${fmtMap(g.fields) || '-'}/${g.passed} | ${st.calls}/${fmtMap(st.fields) || '-'}${st.fnForm ? ' fn×' + st.fnForm : ''}/${st.passed} | ${[...c.r.actions.keys()].join(',') || '-'} | ${[...c.moduleVars.values()].map((d) => d.name).join(',') || '-'} |`); }
// ----- 1bis : actions + variables de module + autres colonnes des unités
P(''); P('## 1bis. Unités : actions de store appelées (get().action), variables de module internes'); P('');
P('| unité | actions de store | variables de module (combatFlow/specs/slice) |'); P('|---|---|---|');
for (const u of units) { const c = info.get(u.key); if (!c.r.actions.size && !c.moduleVars.size) continue; P(`| ${u.name} | ${[...c.r.actions.keys()].join(', ') || '-'} | ${[...c.moduleVars.values()].map((d) => d.name).join(', ') || '-'} |`); }
// ----- 7 : externes de la fermeture transitive
{
  const allExt = new Map(); const nodeOf = (k) => byKey.get(k)?.node ?? cand.get(k);
  for (const k of clo) { const n = nodeOf(k); if (!n) continue; const r = refsOf(n); for (const d of r.deps.values()) { if (ALLOWED.has(d.zone)) continue; if (cand.has(d.key) || byKey.has(d.key)) continue; const e = allExt.get(d.key) ?? { d, by: new Set() }; e.by.add(k.split('#')[1]); allExt.set(d.key, e); } }
  P(''); P(`## 7. Externes (hors fichiers combatFlow/rollFlowSpecs/combatSlice et hors zones autorisées) de la FERMETURE TRANSITIVE de l'attaque (${clo.size} fonctions, y compris IA/sorts/tour atteints) : ${allExt.size} symboles`); P('');
  P('Sur-estimation : la fermeture suit toute référence (appel, passage en argument), y compris vers l\'IA, les sorts et la boucle de tour. Colonnes : nombre de fonctions atteintes qui le référencent.'); P('');
  P('| symbole | module | zone | fonctions référentes | dont direct dans la liste d\'attaque |'); P('|---|---|---|---|---|');
  const direct = new Set([...sym.keys()]);
  for (const e of [...allExt.values()].sort((a, b) => b.by.size - a.by.size || a.d.key.localeCompare(b.d.key))) P(`| ${e.d.name} | ${modName(e.d.file)} | ${e.d.zone} | ${e.by.size} | ${direct.has(e.d.key) ? 'oui' : 'non'} |`);
}
// ----- 5bis : taille des fermetures de symboles sans store
P(''); P('## 5bis. Taille (lignes) des déclarations atteintes par symbole externe, quand la fermeture n\'atteint pas store.ts'); P('');
P('| symbole | décl. atteintes (≤12 listées) | lignes cumulées |'); P('|---|---|---|');
for (const e of [...sym.values()].sort((a, b) => a.d.key.localeCompare(b.d.key))) {
  const { seen, meta } = symClosure(e.d.declNode, e.d.key);
  if ([...seen.keys()].some((k) => keyFile(k) === 'state/store.ts')) continue;
  let tot = 0; const names = [];
  for (const k of seen.keys()) { const n = meta.get(k)?.declNode ?? meta.get(k); const node = n && n.getSourceFile ? n : null; if (node) { const st = ts.isVariableDeclaration(node) && ts.isVariableDeclarationList(node.parent) && ts.isVariableStatement(node.parent.parent) ? node.parent.parent : node; tot += endLine(st) - line(st) + 1; } names.push(k.replace('state/', '')); }
  P(`| ${modName(e.d.file).replace('state/', '')}.${e.d.name} | ${names.length <= 12 ? names.join(', ') : names.length + ' décl.'} | ${tot} |`);
}
// ----- 8 : sorts
P(''); P('## 8. Unités des sorts partageant le coup (applyCast, Projectile 5903-6033, 2401-2452 compterLesCritiquesDuProjectile…)'); P('');
P('| unité | lignes | dépendances hors zones | internes appelés dans la liste | hors liste | get (champs) | set (clés) |'); P('|---|---|---|---|---|---|---|');
for (const u of units) if (u.group.has('sorts')) { const c = info.get(u.key); P(`| ${u.name} [${grpName(u)}] | ${u.start}-${u.end} | ${fmtDeps(c.externes) || '-'} | ${[...c.intern.values()].map((d) => d.name + (byKey.get(d.key).group.has('sorts') ? '' : '*')).join(', ') || '-'} | ${[...c.horsListe.values()].map((d) => d.name).join(', ') || '-'} | ${fmtMap(c.r.get.fields) || '-'} (${c.r.get.calls}) | ${fmtMap(c.r.set.fields) || '-'} (${c.r.set.calls}) |`); }
P(''); P('(`*` = unité du chemin d\'attaque, partagée avec les sorts.)');
{
  const A = new Set(), S = new Set(); for (const u of units) { for (const k of info.get(u.key).externes.keys()) (u.group.has('sorts') ? S : A).add(k); }
  const shared = [...S].filter((k) => A.has(k) && !units.some((u) => u.group.has('sorts') && u.group.size === 1 && false));
  P(''); P(`Symboles externes communs attaque/sorts : ${shared.map((k) => k.split('#')[1]).join(', ')}.`);
  const sharedUnits = new Set(); for (const u of units) if (u.group.has('sorts')) for (const d of info.get(u.key).intern.values()) if (!byKey.get(d.key).group.has('sorts')) sharedUnits.add(d.name);
  P(`Unités d'attaque appelées par les sorts : ${[...sharedUnits].join(', ')}.`);
  // fermeture transitive des unités d'attaque appelées par les sorts
  const reach = new Set(); const q = [...units.filter((u) => u.group.has('sorts')).flatMap((u) => [...info.get(u.key).intern.keys()])]; while (q.length) { const k = q.pop(); if (reach.has(k)) continue; reach.add(k); for (const e of edges.get(k) ?? []) q.push(e); }
  P(`Fermeture dans la liste de ce que les sorts appellent côté coup : ${reach.size} unités : ${[...reach].map((k) => byKey.get(k).name).join(', ')}.`);
  const total = units.filter((u) => u.group.has('attaque')).length;
  P(`Sur ${total} unités d'attaque, ${[...reach].filter((k) => byKey.get(k).group.has('attaque')).length} sont atteintes par les sorts.`);
}
// ----- 9 : clôture de combat
P(''); P('## 9. Clôture de combat : checkBattleOver / finishVictory / finishCombatEnd et leurs appelés hors liste (combatFlow)'); P('');
{
  const fam = ['combatFlow.ts#checkBattleOver', 'combatFlow.ts#finishVictory', 'combatFlow.ts#finishCombatEnd', 'combatFlow.ts#resolveFirstBlood'].map((k) => 'state/' + k);
  const seen = new Set(), q = [...fam]; const rows = [];
  const nodeOf = (k) => byKey.get(k)?.node ?? cand.get(k);
  while (q.length) { const k = q.shift(); if (seen.has(k)) continue; seen.add(k); const n = nodeOf(k); if (!n) continue; const r = refsOf(n); rows.push([k, n, r]); for (const d of r.deps.values()) if (cand.has(d.key) && /combatFlow\.ts#(finalizeBattle|openCombatEndCascade|resolveSurrenderThreshold|victoryConditionMet|collapseStructure|finishVictory|checkBattleOver|finishCombatEnd)/.test(d.key)) q.push(d.key); }
  P('| fonction | lignes | get (appels/champs) | set (clés) | actions de store | externes hors zones | internes autres (hors famille) |'); P('|---|---|---|---|---|---|---|');
  for (const [k, n, r] of rows) { const ext = new Map(); const oth = []; for (const d of r.deps.values()) { if (ALLOWED.has(d.zone)) continue; if (cand.has(d.key) || byKey.has(d.key)) { oth.push(d.name); continue; } ext.set(d.key, d); } P(`| ${k.split('#')[1]} | ${line(n)}-${endLine(n)} | ${r.get.calls}/${fmtMap(r.get.fields) || '-'}/pass ${r.get.passed} | ${r.set.calls}/${fmtMap(r.set.fields) || '-'}/pass ${r.set.passed} | ${[...r.actions.keys()].join(',') || '-'} | ${fmtDeps(ext) || '-'} | ${oth.join(',') || '-'} |`); }
}


// ----- 10 : points d'entrée vers store.ts dans les fermetures lourdes
P(''); P('## 10. Fermetures lourdes : déclarations qui référencent DIRECTEMENT une valeur de store.ts (points d\'entrée du store)'); P('');
for (const nm of ['combatEffects.ts#applyEffects', 'combatEffects.ts#gearFromEffects', 'combat/triggeredTest.ts#routeTriggeredTest', 'combat/triggeredTest.ts#runCombatFlow', 'combat/triggeredTest.ts#bandeTriggeredTest', 'consumableFlow.ts#runConsumable']) {
  const e = sym.get('state/' + nm); if (!e) continue;
  const { seen, meta } = symClosure(e.d.declNode, e.d.key);
  const entries = [];
  for (const k of seen.keys()) { const node = meta.get(k)?.declNode ?? meta.get(k); if (!node || !node.getSourceFile) continue; const r = refsOf(node); const st = [...r.deps.values()].filter((d) => rel(d.file) === 'state/store.ts'); if (st.length) entries.push(k.replace('state/', '') + ' -> ' + st.map((d) => d.name).join(','));
  }
  const files = new Set([...seen.keys()].map(keyFile));
  P(`### ${nm} : ${seen.size} décl., ${files.size} fichiers ; ${entries.length} déclarations touchent store.ts directement`); P('');
  for (const x of entries.slice(0, 40)) P('- ' + x); if (entries.length > 40) P(`- … (+${entries.length - 40})`); P('');
  const byFile = {}; for (const k of seen.keys()) byFile[keyFile(k)] = (byFile[keyFile(k)] ?? 0) + 1;
  P('Fichiers (décl. atteintes) : ' + Object.entries(byFile).sort((a, b) => b[1] - a[1]).map(([f, n]) => f + ':' + n).join(', ')); P('');
}


// ----- 6bis : union (décl., lignes) par module, symboles dont la fermeture n'atteint pas le store
P(''); P('## 6bis. Par module : union des déclarations à déplacer (symboles utilisés dont la fermeture n\'atteint pas store.ts), lignes cumulées'); P('');
P('| module | symboles | décl. (union) | lignes (union) | fichiers touchés par la fermeture |'); P('|---|---|---|---|---|');
let GT = 0, GD = 0; const allDecl = new Map();
for (const [f, es] of [...mods.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const U = new Map(); const names = [];
  for (const e of es) { const { seen, meta } = symClosure(e.d.declNode, e.d.key); if ([...seen.keys()].some((k) => keyFile(k) === 'state/store.ts')) continue; names.push(e.d.name); for (const k of seen.keys()) { const m = meta.get(k); const node = m?.declNode ?? m; if (node && node.getSourceFile) U.set(k, node); } }
  if (!names.length) continue;
  let tot = 0; for (const [k, node] of U) { const st = ts.isVariableDeclaration(node) && ts.isVariableDeclarationList(node.parent) && ts.isVariableStatement(node.parent.parent) ? node.parent.parent : node; tot += endLine(st) - line(st) + 1; allDecl.set(k, endLine(st) - line(st) + 1); }
  P(`| ${modName(f)} | ${names.sort().join(', ')} | ${U.size} | ${tot} | ${[...new Set([...U.keys()].map(keyFile))].join(', ')} |`);
}
P(''); P(`Union globale (symboles sans store) : ${allDecl.size} déclarations, ${[...allDecl.values()].reduce((a, b) => a + b, 0)} lignes.`);

JSONOUT.units = units.map((u) => ({ key: u.key, group: [...u.group], lines: [u.start, u.end], externes: [...info.get(u.key).externes.keys()], intern: [...info.get(u.key).intern.keys()] }));
fs.writeFileSync(OUT + 'sondes/mesure.json', JSON.stringify(JSONOUT, null, 1));
fs.writeFileSync(OUT + 'sondes/mesure.md', out.join('\n'));
console.log('ok', units.length, 'unités ;', sym.size, 'symboles externes ;', out.length, 'lignes');
