import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';

/**
 * GARDE — un libellé LITTÉRAL ne masque pas une identité ABSENTE (#1906, #1882).
 *
 * QUESTION : quand une entité (héros, combattant, lieu, navire, donnée) n'est pas résolue, le rendu
 * écrit-il « ? », « Le groupe », « Navire » à sa place ? Non : une absence IMPOSSIBLE est requise par le
 * type ou lève (`garanti`, `state/combatants.ts`) ; une absence ATTEIGNABLE se NOMME en français de
 * joueur (`libelleOuAbsence`, `data/index.ts` ; la source d'un lot d'ops par `nomDeSource`, `engine/ops.ts` ;
 * le navire de campagne par `nomDuNavire`, `state/carriers.ts`).
 *
 * FORME jugée sur l'AST (`typescript`), jamais sur le nom des variables : tout `??` ou `||` dont
 * l'opérande GAUCHE (ou le dernier maillon d'une chaîne `a ?? b?.label ?? …`) est un accès `label`/`name`
 * — quel que soit le récepteur : chaîne optionnelle, index, appel — et l'opérande DROIT un littéral de
 * chaîne, un gabarit, ou un appel `t('…')`/`tr('…')` (le littéral déplacé dans la table i18n). Hors tests. Exemption au SITE (`fichier|texte du site`), avec sa raison.
 * Même FORME pour un nom de siège de coop (`<x>.seatNames[…] ?? '<littéral>'`) : il se lit par
 * `nomDuSiege` (`state/netFlow.ts`), jamais « L'hôte » recopié pour un invité.
 */

const AUTHORE = 'libellé AUTHORÉ optionnel : un défaut d’affichage de donnée, aucune identité de porteur absente';
const SANS_ARME = 'arme absente : l’absence EST l’état affiché (mains nues, pièce non désignée), pas une identité masquée';
const CHOIX_OUVERT = 'création en cours : le choix reste OUVERT et l’écran le dit — aucune entité absente';
const PLACEHOLDER = 'placeholder de saisie d’éditeur : aucune entité à nommer';
const PRIMITIVE = 'corps d’une primitive d’absence : le repli nommé EST sa définition, tout lecteur passe par elle';
const OUTILLAGE = 'outillage (recette `__wfrp`, galerie QC, diagnostic dev, relais réseau) : aucun flux de jeu';

/** `fichier|texte du site` → raison. */
const EXEMPTES = new Map<string, string>([
  ["src/engine/ops.ts|ctx?.label ?? t(`op.nature.${nature}`)", PRIMITIVE],
  ["src/engine/traceLine.ts|row.label ?? t('casc.autoRowFallbackLabel')", AUTHORE],
  ["src/engine/traceLine.ts|d.label ?? t('casc.dieTraceLabel')", AUTHORE],
  ["src/state/combatEffects.ts|step.label ?? t('eff.flowTitle')", AUTHORE],
  ["src/state/combatEffects.ts|e.label || t('eff.psychScene')", AUTHORE],
  ["src/state/pursuitFlow.ts|row.label ?? t('step.pursuitMouvement')", AUTHORE],
  ["src/state/store.ts|ent.label ?? t('store.searchedFallback')", AUTHORE],
  ["src/state/store.ts|ent.label ?? t('store.searchPlaceFallback')", AUTHORE],
  ["src/state/usable.ts|a.label ?? t(`usable.${a.id}` as MsgKey)", AUTHORE],
  ['src/gameIso/rig/enemyProfile.ts|ent.label ?? \'sans libellé\'', OUTILLAGE],
  ['src/gameIso/stage/PastilleEntite.tsx|mark.label ?? \'\'', AUTHORE],
  ['src/net/relay.ts|env.name ?? \'\'', OUTILLAGE],
  ['src/state/cascade.ts|st.label ?? \'Conséquences\'', AUTHORE],
  ['src/state/combat/triggeredTest.ts|step.label ?? \'\'', AUTHORE],
  ['src/state/combat/triggeredTest.ts|step.label ?? \'Réaction\'', AUTHORE],
  ['src/state/combatEffects.ts|step.label ?? \'\'', AUTHORE],
  ['src/state/combatFlow.ts|sc.label || \'Obscurité\'', AUTHORE],
  ['src/state/combatFlow.ts|step.label ?? \'\'', AUTHORE],
  ['src/state/combatFlow.ts|parryWeaponObj?.label ?? \'arme\'', SANS_ARME],
  ['src/state/combatSlice.ts|w?.label ?? \'pièce\'', SANS_ARME],
  ['src/state/devtools.ts|c?.label ?? \'—\'', OUTILLAGE],
  ['src/state/devtools.ts|here?.label ?? \'?\'', OUTILLAGE],
  ['src/state/triggeredEffects.ts|eff.flow.test.label ?? \'Réaction\'', AUTHORE],
  ['src/ui/CascadeModal.tsx|s.label ?? \'\'', AUTHORE],
  ['src/ui/CascadeModal.tsx|r.label ?? \'\'', AUTHORE],
  ['src/ui/CascadeModal.tsx|cur.label ?? \'\'', AUTHORE],
  ['src/ui/CombatConsole.tsx|setWeapon?.label ?? \'Mains nues\'', SANS_ARME],
  ['src/ui/compendium/CodexEdit.tsx|indice?.label ?? \'\'', AUTHORE],
  ['src/ui/compendium/CompendiumScreen.tsx|cat?.label ?? \'\'', PLACEHOLDER],
  ['src/ui/compendium/registry.ts|e.label ?? \'\'', AUTHORE],
  ['src/ui/compendium/StructFields.tsx|findVehicleById(t.vehicleId)?.label ?? \'\'', PLACEHOLDER],
  ['src/ui/compendium/StructFields.tsx|t.label ?? \'\'', AUTHORE],
  ['src/ui/compendium/StructFields.tsx|findCreatureById(t.creatureId)?.label ?? \'\'', PLACEHOLDER],
  ['src/ui/creator/CharacterCreator.tsx|lvl1?.label ?? \'—\'', CHOIX_OUVERT],
  ['src/ui/creator/CharacterCreator.tsx|klass?.label ?? \'—\'', CHOIX_OUVERT],
  ['src/ui/creator/CreatorSummary.tsx|sp?.label ?? \'Race à choisir\'', CHOIX_OUVERT],
  ['src/ui/creator/draft.ts|hero.label ?? \'\'', CHOIX_OUVERT],
  ['src/ui/editor/EffectList.tsx|e.ref?.custom?.label ?? \'?\'', AUTHORE],
  ['src/ui/editor/EffectList.tsx|e.label || \'?\'', AUTHORE],
  ['src/ui/editor/EffectList.tsx|e.label ?? \'\'', AUTHORE],
  ['src/ui/editor/GameOpEditor.tsx|o.label ?? \'\'', AUTHORE],
  ['src/ui/editor/Inspector.tsx|efz.label || \'Piège\'', AUTHORE],
  ['src/ui/editor/Inspector.tsx|architectureBody.label ?? \'\'', AUTHORE],
  ['src/ui/editor/Inspector.tsx|ent.label ?? \'\'', AUTHORE],
  ['src/ui/editor/Inspector.tsx|a.label ?? \'\'', AUTHORE],
  ['src/ui/editor/NarratifEditor.tsx|profil.label ?? \'\'', AUTHORE],
  ['src/ui/editor/NarratifEditor.tsx|base?.label ?? \'ex. Josef Quartjin\'', PLACEHOLDER],
  ['src/ui/gallery/registry.tsx|signeAstralExemple()?.label ?? \'\'', OUTILLAGE],
  ['src/ui/gallery/registry.tsx|heros?.label ?? \'Héros\'', OUTILLAGE],
  ['src/ui/jetProps/useAttackJetProps.tsx|weapon?.label ?? \'Mains nues\'', SANS_ARME],
  ['src/ui/jetProps/useDefenseJetProps.tsx|pd.weapon?.label ?? \'Mains nues\'', SANS_ARME],
  ['src/ui/PossessionsScreen.tsx|selected.label ?? \'\'', AUTHORE],
  ['src/ui/ReloadModal.tsx|weapon?.label ?? \'arme\'', SANS_ARME],
  ['src/state/cascade.ts|ctx?.title ?? choix.label ?? \'Choix\'', AUTHORE],
]);

const nu = (e: ts.Expression): ts.Expression => {
  let x = e;
  while (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isNonNullExpression(x)) x = x.expression;
  return x;
};
const REPLI: ts.SyntaxKind[] = [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken];
/** L'opérande nomme-t-il un `label`/`name`/nom de siège — lui, ou le dernier maillon d'une chaîne de replis ? */
function nomme(e: ts.Expression): boolean {
  const x = nu(e);
  if (ts.isBinaryExpression(x) && REPLI.includes(x.operatorToken.kind)) return nomme(x.right);
  if (ts.isPropertyAccessExpression(x)) return x.name.text === 'label' || x.name.text === 'name';
  if (ts.isElementAccessExpression(x) && ts.isPropertyAccessExpression(nu(x.expression)) && (nu(x.expression) as ts.PropertyAccessExpression).name.text === 'seatNames') return true;
  return ts.isElementAccessExpression(x) && ts.isStringLiteral(x.argumentExpression) && ['label', 'name'].includes(x.argumentExpression.text);
}
/** Un texte FIGÉ : littéral, gabarit, ou le MÊME littéral déplacé dans la table i18n (`t('…')`/`tr('…')`). */
const litteral = (e: ts.Expression): boolean => {
  const x = nu(e);
  if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x) || ts.isTemplateExpression(x)) return true;
  return ts.isCallExpression(x) && ts.isIdentifier(x.expression) && ['t', 'tr'].includes(x.expression.text);
};

function sites(): { rel: string; ligne: number; texte: string }[] {
  const out: { rel: string; ligne: number; texte: string }[] = [];
  for (const { rel, text } of readCorpus(['src'])) {
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node) => {
      if (ts.isBinaryExpression(node) && REPLI.includes(node.operatorToken.kind) && nomme(node.left) && litteral(node.right))
        out.push({ rel, ligne: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, texte: `${nu(node.left).getText().replace(/\s+/g, ' ')} ${node.operatorToken.getText()} ${node.right.getText()}` });
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

describe('identite-absente-libelle-litteral-guard (#1906)', () => {
  const vus = sites();

  it('aucun littéral ne tient lieu d’une identité absente', () => {
    const fautes = vus.filter((s) => !EXEMPTES.has(`${s.rel}|${s.texte}`)).map((s) => `${s.rel}:${s.ligne} ${s.texte}`);
    expect(fautes, 'absence impossible → type ou `garanti` ; atteignable → `libelleOuAbsence` ; légitime → exemption au SITE motivée').toEqual([]);
  });

  it('PEUPLEMENT : chaque exemption est VUE par le scan (sinon exemption périmée)', () => {
    const vues = new Set(vus.map((s) => `${s.rel}|${s.texte}`));
    expect([...EXEMPTES.keys()].filter((e) => !vues.has(e))).toEqual([]);
  });
});
