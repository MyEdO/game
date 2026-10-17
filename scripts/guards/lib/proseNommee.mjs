import { analyserCorpus, typescript } from './dialecte.mjs';
import { contexteImports, estAppelDeclare, origineImportee } from './canonUnique.mjs';
import path from 'node:path';
import { TypeFlags, SymbolFlags } from 'typescript/unstable/sync';
import { repoProgram, libererSessions } from './tsProgram.mjs';

const DECLARATEURS = { 'src/data/schemas/grammaire/prose.ts': ['proseNommee'] };
const NOMMEURS = { 'src/data/schemas/grammaire/meta.ts': ['nommerChamps'], 'src/data/schemas/grammaire/mecanique.ts': ['declarerPayload'] };
const NOMMEURS_DE_NOEUD = { 'src/data/schemas/grammaire/meta.ts': ['nommerNoeud'] };
const LECTEURS_META = { 'src/data/schemas/grammaire/meta.ts': ['metaDesChamps'] };

export function classificationsProseLocale(root, fichiers, { sourcesAdditionnelles = [] } = {}) {
  const ts = typescript();
  const sources = Object.fromEntries(fichiers.map(f => [f.rel, f.text]));
  const toutes = [...fichiers, ...sourcesAdditionnelles];
  const session = repoProgram(root, () => toutes.map(f => path.resolve(root, f.rel)), Object.fromEntries(toutes.map(f => [f.rel, f.text])));
  const champs = [];
  const opaquesImportes = [];
  const importsSchemas = new Map();
  const metas = new Map();
  const opacites = new Map();
  const compositions = new Map();
  const visites = [];
  const formesOpaques = [];
  const erreurs = [];
  const nom = n => n && (ts.isIdentifier(n) || ts.isStringLiteral(n)) ? n.text : undefined;
  try {
    const checker = session.checker;
    const proprietairesDe = symbole => {
      if (symbole?.flags & SymbolFlags.Alias) symbole = checker.getAliasedSymbol(symbole);
      return symbole?.declarations?.map(d => path.relative(root, d.resolve().getSourceFile().fileName).replaceAll('\\', '/')) ?? [];
    };
    const modulesVisites = new Set();
    const collecterExports = (module, vus = modulesVisites) => {
      if (vus.has(module) || Object.hasOwn(sources, module)) return;
      vus.add(module);
      const sf = session.program.getSourceFile(path.resolve(root, module).replaceAll('\\', '/'));
      const symbole = sf && checker.getSymbolAtLocation(sf);
      if (!symbole) return;
      for (const exp of checker.getExportsOfModule(symbole)) {
        const proprios = proprietairesDe(exp);
        if (!proprios.length || proprios.some(p => Object.hasOwn(sources, p))) continue;
        importsSchemas.set(`${module}:${exp.name}`, { module, nom: exp.name });
      }
    };
    const sortie = expression => {
      const type = checker.getTypeAtLocation(expression);
      const prop = checker.getPropertyOfType(type, '_output');
      return prop ? checker.getTypeOfSymbolAtLocation(prop, expression) : undefined;
    };
    const admet = (type, vus = new Set()) => {
      if (!type || vus.has(type)) return undefined;
      vus.add(type);
      if (type.flags & TypeFlags.String) return 'chaine';
      if (type.flags & (TypeFlags.Any | TypeFlags.Unknown)) return 'opaque';
      if (type.isUnionType()) {
        const sortes = type.getTypes().map(t => admet(t, vus));
        return sortes.includes('opaque') ? 'opaque' : sortes.includes('chaine') ? 'chaine' : undefined;
      }
      if (type.isIntersectionType()) {
        const sortes = type.getTypes().map(t => admet(t, vus));
        return sortes.includes('opaque') ? 'opaque' : sortes.includes('chaine') ? 'chaine' : undefined;
      }
      if (!(type.flags & TypeFlags.Object)) return undefined;
      if (checker.isTupleType(type)) {
        const sortes = checker.getTypeArguments(type).map(t => admet(t, vus));
        return sortes.includes('opaque') ? 'opaque' : sortes.includes('chaine') ? 'chaine' : undefined;
      }
      if (checker.isArrayType(type)) return admet(checker.getTypeArguments(type)[0], vus);
      const index = checker.getIndexInfosOfType(type).filter(i => i.keyType.flags & (TypeFlags.String | TypeFlags.Number));
      const sortes = index.flatMap(i => [admet(i.valueType, vus), i.keyType.flags & TypeFlags.String ? 'chaine' : undefined]);
      return sortes.includes('opaque') ? 'opaque' : sortes.includes('chaine') ? 'chaine' : undefined;
    };
    for (const fichier of fichiers) {
      const sourceFile = session.program.getSourceFile(path.resolve(root, fichier.rel).replaceAll('\\', '/'));
      if (!sourceFile) throw new Error(`proseNommee : arbre absent ${fichier.rel}`);
      const diagnostics = session.program.getSyntacticDiagnostics(sourceFile.fileName);
      if (diagnostics.length) throw new Error(`proseNommee : syntaxe refusée dans ${fichier.rel}`);
      const contexte = contexteImports(sourceFile, checker);
      const resoudre = (expression, vus = new Set()) => {
        if (!expression || vus.has(expression)) return expression;
        vus.add(expression);
        if (ts.isIdentifier(expression)) {
          let symbol = checker.getSymbolAtLocation(expression);
          if (symbol?.flags & SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
          const declaration = symbol?.declarations?.[0]?.resolve();
          if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) return resoudre(declaration.initializer, vus);
        }
        if (ts.isAsExpression(expression) || ts.isParenthesizedExpression(expression)) return resoudre(expression.expression, vus);
        return expression;
      };
      const objets = expression => {
        const e = resoudre(expression);
        if (!e) return [];
        if (ts.isObjectLiteralExpression(e)) return [e];
        if (ts.isCallExpression(e)) {
          if (ts.isPropertyAccessExpression(e.expression) && ['object', 'strictObject', 'looseObject'].includes(e.expression.name.text)) return objets(e.arguments[0]);
          if (ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'extend') return [...objets(e.expression.expression), ...objets(e.arguments[0])];
          if (ts.isPropertyAccessExpression(e.expression)) return objets(e.expression.expression);
          return objets(e.arguments[0]);
        }
        return [];
      };
      const lireMetas = (expression, vus = new Set()) => {
        const e = resoudre(expression);
        const out = new Map();
        if (!e || vus.has(e)) return out;
        vus = new Set(vus).add(e);
        if (e && ts.isCallExpression(e) && estAppelDeclare(e, sourceFile, LECTEURS_META, contexte)) {
          for (const objet of objets(e.arguments[0])) for (const [k, v] of lireMetas(metas.get(objet), vus)) out.set(k, v);
          return out;
        }
        if (!e || !ts.isObjectLiteralExpression(e)) return out;
        for (const p of e.properties) {
          if (ts.isSpreadAssignment(p)) for (const [k,v] of lireMetas(p.expression, vus)) out.set(k,v);
          else if (ts.isPropertyAssignment(p)) out.set(nom(p.name), p.initializer);
          else if (ts.isShorthandPropertyAssignment(p)) out.set(nom(p.name), p.name);
        }
        return out;
      };
      const preparation = n => {
        if (ts.isCallExpression(n) && estAppelDeclare(n, sourceFile, NOMMEURS, contexte)) {
          for (const objet of objets(n.arguments[0])) metas.set(objet, n.arguments[1]);
        }
        if (ts.isCallExpression(n) && estAppelDeclare(n, sourceFile, DECLARATEURS, contexte)) {
          const chemin = n.arguments[1];
          if (chemin && ts.isStringLiteral(chemin)) for (const objet of objets(n.arguments[0])) compositions.set(objet, chemin.text);
        }
        if (ts.isCallExpression(n) && estAppelDeclare(n, sourceFile, NOMMEURS_DE_NOEUD, contexte)) {
          const opacite = lireMetas(lireMetas(n.arguments[1]).get('opacite'));
          const nature = opacite.get('nature');
          const raison = opacite.get('raison');
          if (nature && raison && ts.isStringLiteral(nature) && ts.isStringLiteral(raison)) {
            for (const objet of objets(n.arguments[0])) opacites.set(objet, { nature: nature.text, raison: raison.text });
          }
        }
        n.forEachChild(preparation);
      };
      preparation(sourceFile);
      const lireRole = expression => {
        const m = lireMetas(expression);
        const texte = m.get('texte');
        const role = lireMetas(texte);
        const regime = role.get('regime');
        const usage = role.get('usage');
        const hors = lireMetas(role.get('horsContrat'));
        const motif = hors.get('motif');
        const preuve = hors.get('preuve');
        return { regime: regime && ts.isStringLiteral(regime) ? regime.text : undefined, usage: usage && ts.isStringLiteral(usage) ? usage.text : undefined,
          ...(motif && preuve && ts.isStringLiteral(motif) && ts.isStringLiteral(preuve) ? { horsContrat: { motif: motif.text, preuve: preuve.text } } : {}) };
      };
      const visiter = n => {
        if ((ts.isIdentifier(n) || ts.isPropertyAccessExpression(n) || ts.isCallExpression(n)) && sortie(n)) {
          const origine = origineImportee(n, sourceFile, contexte);
          const proprietaires = proprietairesDe(checker.getSymbolAtLocation(n));
          if (origine && !Object.hasOwn(sources, origine.module) && !proprietaires.some(p => Object.hasOwn(sources, p))) importsSchemas.set(`${origine.module}:${origine.nom}`, origine);
        }
        const constructeur = ts.isCallExpression(n) ? resoudre(n.expression) : undefined;
        const nomConstructeur = constructeur && ts.isPropertyAccessExpression(constructeur) ? constructeur.name.text : undefined;
        const typeAppel = ts.isCallExpression(n) ? checker.getTypeAtLocation(n) : undefined;
        const interneZod = typeAppel && checker.getPropertyOfType(typeAppel, '_zod');
        const origineZod = interneZod?.declarations?.some(d => d.resolve().getSourceFile().fileName.replaceAll('\\', '/').includes('/node_modules/zod/'));
        const shapeZod = ts.isCallExpression(n) && sortie(n) && checker.getPropertyOfType(typeAppel, 'shape');
        if (ts.isCallExpression(n) && sortie(n) && origineZod && (shapeZod || ['object', 'strictObject', 'looseObject', 'extend', 'catchall'].includes(nomConstructeur))) {
          const shape = resoudre(n.arguments[0]);
          if (shape && nomConstructeur !== 'catchall') {
            const typeShape = checker.getTypeAtLocation(shape);
            const proprietes = checker.getPropertiesOfType(typeShape);
            const estSchema = checker.getPropertyOfType(typeShape, '_output');
            const parametre = ts.isIdentifier(shape) && checker.getSymbolAtLocation(shape)?.declarations?.some(d => d.resolve().kind === ts.SyntaxKind.Parameter);
            const locales = proprietes.some(p => p.declarations?.some(d => Object.hasOwn(sources, path.relative(root, d.resolve().getSourceFile().fileName).replaceAll('\\', '/'))));
            if (!estSchema && !parametre && !locales && checker.getIndexInfosOfType(typeShape).some(i => checker.getPropertyOfType(i.valueType, '_output') || checker.getPropertyOfType(i.valueType, '_zod'))) {
              let porteur = n;
              while (porteur.parent && (ts.isParenthesizedExpression(porteur.parent) || ts.isAsExpression(porteur.parent) || (ts.isPropertyAccessExpression(porteur.parent) && porteur.parent.expression === porteur) || (ts.isCallExpression(porteur.parent) && porteur.parent.expression === porteur))) porteur = porteur.parent;
              const champ = porteur.parent;
              const role = champ && ts.isPropertyAssignment(champ) ? lireRole(lireMetas(metas.get(champ.parent)).get(nom(champ.name))) : {};
              if (!['technique', 'atelier'].includes(role.regime) || !role.usage?.trim()) {
                const ligne = sourceFile.getLineAndCharacterOfPosition(n.getStart(sourceFile)).line + 1;
                formesOpaques.push(`${fichier.rel}:${ligne} shape ouvert indéterminé sans classification du champ porteur`);
              }
            }
            for (const propriete of proprietes) {
              const p = propriete.declarations?.map(d => d.resolve()).find(d => Object.hasOwn(sources, path.relative(root, d.getSourceFile().fileName).replaceAll('\\', '/')));
              if (!p || !(ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))) continue;
              const expression = ts.isPropertyAssignment(p) ? p.initializer : p.name;
              const typeSchema = checker.getTypeOfSymbolAtLocation(propriete, shape);
              const output = checker.getPropertyOfType(typeSchema, '_output');
              const type = output ? checker.getTypeOfSymbolAtLocation(output, shape) : undefined;
              const estOpaque = e => {
                if (ts.isAsExpression(e) || ts.isParenthesizedExpression(e)) return estOpaque(e.expression);
                if (!ts.isCallExpression(e)) return false;
                if (ts.isPropertyAccessExpression(e.expression)) {
                  if (['custom', 'unknown', 'any'].includes(e.expression.name.text)) return true;
                  if (['object', 'strictObject', 'looseObject'].includes(e.expression.name.text)) return false;
                  if (estOpaque(e.expression.expression)) return true;
                }
                return e.arguments.some(a => ts.isCallExpression(a) && estOpaque(a));
              };
              const opaqueLocal = estOpaque(resoudre(expression));
              const sorte = opaqueLocal ? 'opaque' : admet(type);
              if (!sorte) continue;
              const champ = propriete.name;
              const proprietaire = p.getSourceFile();
              const ligne = proprietaire.getLineAndCharacterOfPosition(p.getStart(proprietaire)).line + 1;
              const meta = resoudre(lireMetas(metas.get(shape)).get(champ));
              const role = lireRole(meta);
              let expr = expression;
              while (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression)) expr = expr.expression.expression;
              const symbole = ts.isIdentifier(expr) ? checker.getSymbolAtLocation(expr) : undefined;
              const importee = symbole?.declarations?.some(d => {
                const declaration = d.resolve();
                return ts.isImportSpecifier(declaration) || ts.isNamespaceImport(declaration);
              });
              const entree = { fichier: path.relative(root, proprietaire.fileName).replaceAll('\\', '/'), ligne, champ, sorte, ...role, composition: compositions.get(shape), ...(meta ? { debutMeta: meta.getStart(meta.getSourceFile()), finMeta: meta.end } : {}) };
              champs.push(entree);
              if (sorte === 'opaque' && importee) opaquesImportes.push(entree);
            }
          }
          const catchall = nomConstructeur === 'catchall' ? admet(sortie(n.arguments[0])) : undefined;
          if (nomConstructeur === 'looseObject' || catchall) {
            const ligne = sourceFile.getLineAndCharacterOfPosition(n.getStart(sourceFile)).line + 1;
            const forme = nomConstructeur === 'catchall' ? objets(constructeur.expression).at(-1) : shape;
            champs.push({ fichier: fichier.rel, ligne, champ: '*', sorte: catchall ?? 'opaque', opacite: opacites.get(forme) });
          }
        }
        n.forEachChild(visiter);
      };
      visites.push(() => visiter(sourceFile));
      const visiterImports = n => {
        if ((ts.isIdentifier(n) && sortie(n)) || (ts.isCallExpression(n) && (sortie(n) || checker.getPropertyOfType(checker.getTypeAtLocation(n), 'schema')))) {
          const cible = ts.isCallExpression(n) ? n.expression : n;
          const origine = origineImportee(cible, sourceFile, contexte);
          if (origine && !proprietairesDe(checker.getSymbolAtLocation(cible)).some(p => Object.hasOwn(sources, p))) collecterExports(origine.module);
        }
        n.forEachChild(visiterImports);
      };
      visiterImports(sourceFile);
    }
    for (const visite of visites) visite();
    const fautes = champs.flatMap(c => c.champ === '*' ? c.opacite?.nature === 'dispatch-op' && c.opacite.raison.trim() ? [] : [`${c.fichier}:${c.ligne} catchall locale sans déclaration d’opacité`]
      : !c.regime ? [`${c.fichier}:${c.ligne} ${c.champ} : texte ${c.sorte} sans classification locale`]
      : c.sorte === 'opaque' && (!['technique', 'atelier'].includes(c.regime) || !c.usage?.trim()) ? [`${c.fichier}:${c.ligne} ${c.champ} : opaque sans usage technique/atelier explicite`]
      : ['narration', 'document'].includes(c.regime) && !c.composition && !(c.horsContrat?.preuve?.trim() && ['catalogue','sans-saisie-campagne','sans-rendu-joueur'].includes(c.horsContrat.motif)) ? [`${c.fichier}:${c.ligne} ${c.champ} : ${c.regime} sans composition proseNommee`] : []);
    return { champs, fautes: [...fautes, ...formesOpaques], opaquesImportes, importsSchemas: [...importsSchemas.values()] };
  } catch (erreur) { erreurs.push(erreur); }
  finally { libererSessions([session], erreurs); }
}

export function fautesProseFinale(racines, { descendre, enfantsDe, metaDesChamps, nomDeNoeud, declarationProseNommee, declarationDEnfants, defDe }, bornesImportees = [], mesure) {
  const bornes = new Set(bornesImportees);
  const estBorne = noeud => {
    if (bornes.has(noeud)) { mesure?.bornesAtteintes.add(noeud); return true; }
    const meta = metaDesChamps(noeud);
    if (!meta) return false;
    const enfants = enfantsDe(noeud);
    return bornesImportees.some(borne => {
      if (metaDesChamps(borne) !== meta || defDe(borne)?.type !== defDe(noeud)?.type) return false;
      const originaux = enfantsDe(borne);
      const identique = enfants.length === originaux.length && enfants.every((e, i) => e.cle === originaux[i].cle && e.segment === originaux[i].segment && e.noeud === originaux[i].noeud);
      if (identique) mesure?.bornesAtteintes.add(borne);
      return identique;
    });
  };
  const fautes = [];
  const dispatches = new Set();
  const sortieOuverte = (noeud, vus = new Set()) => {
    if (estBorne(noeud) || vus.has(noeud)) return false;
    vus.add(noeud);
    const type = defDe(noeud)?.type;
    if (['string', 'any', 'unknown'].includes(type)) return true;
    if (type === 'object') return false;
    return enfantsDe(noeud).some(e => sortieOuverte(e.noeud, vus));
  };
  descendre(racines, ({ noeud, path: chemin }) => {
    if (estBorne(noeud)) return 'elaguer';
    const opacite = nomDeNoeud(noeud)?.opacite;
    if (!opacite) return;
    if (opacite.nature !== 'dispatch-op' || !opacite.raison.trim() || declarationDEnfants(noeud)?.nature !== 'payloads-op') {
      fautes.push(`${chemin} : opacité dispatch-op sans payloads déclarés`);
      return;
    }
    const file = [noeud];
    const vus = new Set();
    for (let i = 0; i < file.length; i++) {
      const n = file[i];
      if (vus.has(n)) continue;
      vus.add(n);
      dispatches.add(n);
      file.push(...enfantsDe(n).filter(e => e.segment === '').map(e => e.noeud));
    }
  });
  descendre(racines, ({ noeud, path: chemin }) => {
    if (estBorne(noeud)) return 'elaguer';
    const metas = metaDesChamps(noeud);
    const declaration = declarationProseNommee(noeud);
    for (const enfant of enfantsDe(noeud)) {
      if (enfant.segment === '.*' && sortieOuverte(enfant.noeud) && !dispatches.has(noeud)) fautes.push(`${chemin} : catchall locale sans dispatch-op déclaré`);
    }
    for (const enfant of enfantsDe(noeud)) {
      if (!enfant.cle) continue;
      const regime = metas?.[enfant.cle]?.texte?.regime;
      if (sortieOuverte(enfant.noeud) && !regime) fautes.push(`${chemin}.${enfant.cle} : texte ouvert sans classification locale`);
      const horsContrat = metas?.[enfant.cle]?.texte?.horsContrat;
      if (!['narration', 'document'].includes(regime)) continue;
      if (horsContrat?.preuve?.trim() && ['catalogue', 'sans-saisie-campagne', 'sans-rendu-joueur'].includes(horsContrat.motif)) { mesure?.exclusions.set(`${chemin}.${enfant.cle}`, horsContrat); continue; }
      if (!declaration || declaration.champ !== enfant.cle || declaration.regime !== regime) fautes.push(`${chemin}.${enfant.cle} : ${regime} sans composition proseNommee`);
    }
  });
  for (const noeud of racines) if (sortieOuverte(noeud)) fautes.push(' : racine ouverte sans classification locale');
  return fautes;
}

export function cheminsProseNommee(fichiers) {
  const ts = typescript();
  const chemins = [];
  for (const { sourceFile, checker, diagnostics } of analyserCorpus(fichiers)) {
    if (!sourceFile) continue;
    if (diagnostics.length) throw new Error(`proseNommee : syntaxe refusée dans ${sourceFile.fileName}`);
    const contexte = contexteImports(sourceFile, checker);
    const visiter = (noeud) => {
      if (ts.isCallExpression(noeud) && estAppelDeclare(noeud, sourceFile, DECLARATEURS, contexte)) {
        const chemin = noeud.arguments[1];
        if (chemin && ts.isStringLiteral(chemin)) chemins.push(chemin.text);
      }
      noeud.forEachChild(visiter);
    };
    visiter(sourceFile);
  }
  return chemins;
}
