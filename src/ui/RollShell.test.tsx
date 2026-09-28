import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RollShell, type RollRowData, type RollAction } from './RollShell';
import { testBreakdown, testPending } from './breakdown';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { StakeRule, stakeRuleOf } from './StakeNote';
import { flowStakeRef } from '../data';

const noop = () => {};

/** Rangée EN ATTENTE (pré-jet) sans `Combatant` — primitives d'influence, testable en `node`.
 *  Montée par la porte : `rolled` s'y dérive de l'absence de dé. */
const pendingRow = (over: Partial<RollRowData> = {}): BuiltRollRow => ({
  ...buildRollRow(
    { row: { pending: testPending('Athlétisme', 45) }, onRoll: noop, onReroll: noop, onBonusSL: noop },
    { fortune: 1, resilience: 1 },
  ),
  ...over,
});

/** Rangée RÉSOLUE (post-jet) — issue de `testBreakdown`, primitives d'influence. */
const rolledRow = (over: Partial<RollRowData> = {}): BuiltRollRow => ({
  ...buildRollRow(
    {
      row: { d: testBreakdown('Athlétisme', 45, { roll: 22, target: 45, sl: 2, success: true }) },
      onRoll: noop, onReroll: noop, onBonusSL: noop,
    },
    { fortune: 1, resilience: 1 },
  ),
  ...over,
});

// Les hooks/modales NE fournissent PLUS de « Lancer » : la coquille le hisse dans `.cadre-pied`
// pour le cas mono. Les actions sont donc seulement Annuler (pré) + Appliquer (post).
const actions: RollAction[] = [
  { key: 'cancel', label: 'Annuler', onClick: noop, when: 'pre' },
  { key: 'apply', label: 'Appliquer', onClick: noop, when: 'post' },
];

function render(node: React.ReactElement) {
  return renderToStaticMarkup(node);
}

/** Extrait le contenu de la barre `.cadre-pied` (div à profondeur équilibrée) pour vérifier OÙ est un bouton. */
function actionsBar(html: string): string {
  const ouverture = /<div class="[^"]*\bcadre-pied\b[^"]*"[^>]*>/.exec(html);
  if (!ouverture) return '';
  const contentStart = ouverture.index + ouverture[0].length;
  let depth = 1;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = contentStart;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(contentStart, m.index);
  }
  return html.slice(contentStart);
}

describe('RollShell — la couture UNIQUE du plein écran', () => {
  it('une fenêtre de jet pose le champ lisible ET le plein écran sur son voile ; embarquée, aucun', () => {
    const flottante = render(<RollShell title="Jet" rows={[pendingRow()]} rolled={false} actions={actions} onCancel={noop} />);
    const voile = /<div class="modal-overlay"[^>]*>/.exec(flottante)?.[0] ?? '';
    expect(voile).toContain('data-champ="true"');
    expect(voile).toContain('data-plein="true"');
    const embarquee = render(<RollShell title="Jet" embedded rows={[pendingRow()]} rolled={false} actions={actions} onCancel={noop} />);
    expect(embarquee).not.toContain('data-plein');
  });
});

describe('RollShell — coquille de jet unifiée', () => {
  it('(a) mono : 1 rangée interactive pré-jet → « Lancer » HISSÉ dans la barre `.cadre-pied`', () => {
    const html = render(
      <RollShell
        title="Test mono"
        subtitle="Un jet"
        rows={[pendingRow()]}
        rolled={false}
        actions={actions}
        onCancel={noop}
      />,
    );
    expect(html).toContain('Un jet');
    expect(html).toContain('45'); // cible pré-jet
    expect(html).not.toContain('Appliquer'); // action 'post' masquée pré-jet
    // Le « Lancer » vit dans `.cadre-pied` (même niveau qu'Annuler), jamais dans la rangée.
    const bar = actionsBar(html);
    expect(bar).toContain('Lancer'); // Lancer hissé DANS la barre
    expect(bar).toContain('Annuler'); // à côté d'Annuler (pré-jet)
    // La rangée (`prow-act`) ne rend plus le bouton Lancer inline.
    const beforeBar = html.slice(0, html.search(/<div class="[^"]*\bcadre-pied\b/));
    expect(beforeBar).not.toContain('Lancer');
  });

  it('(f) mono : « Lancer » dans la barre, pré-jet — masqué après le jet', () => {
    const pre = render(<RollShell title="T" rows={[pendingRow()]} rolled={false} actions={actions} onCancel={noop} />);
    const post = render(<RollShell title="T" rows={[rolledRow()]} rolled actions={actions} onCancel={noop} />);
    expect(actionsBar(pre)).toContain('Lancer'); // hissé pré-jet
    expect(post).not.toContain('🎲 Lancer'); // rien à hisser post-jet (rangée déjà lancée)
  });

  it('(g) multi : 2 rangées interactives non lancées → « Lancer » PAR RANGÉE, PAS hissé dans la barre', () => {
    const html = render(
      <RollShell
        title="Multi"
        rows={[pendingRow(), pendingRow({ row: { pending: testPending('Voile', 50) } })]}
        rolled={false}
        actions={actions}
        onCancel={noop}
      />,
    );
    // ≥2 rangées à lancer → aucun hissage : le Lancer reste dans les rangées (`prow-act`), pas dans la barre.
    expect(actionsBar(html)).not.toContain('Lancer');
    const beforeBar = html.slice(0, html.search(/<div class="[^"]*\bcadre-pied\b/));
    expect(beforeBar).toContain('Lancer'); // les deux boutons de rangée
  });

  it('(b) multi : 2 rangées + summary rendu', () => {
    const html = render(
      <RollShell
        title="Test multi"
        instruction="Chaque rôle lance"
        rows={[rolledRow(), rolledRow({ row: { d: testBreakdown('Voile', 50, { roll: 30, target: 50, sl: 2, success: true }) } })]}
        rolled={true}
        summary={<>DR total <b>+4</b></>}
        actions={actions}
        onCancel={noop}
      />,
    );
    expect(html).toContain('Chaque rôle lance');
    expect(html).toContain('Athlétisme');
    expect(html).toContain('Voile');
    expect(html).toContain('DR total'); // bandeau summary agrégé
  });

  it('(c) rangée témoin (interactive=false) : AUCUN bouton d’influence', () => {
    const interactiveOnly = render(
      <RollShell title="T" rows={[rolledRow()]} rolled actions={[]} onCancel={noop} />,
    );
    const witnessOnly = render(
      <RollShell title="T" rows={[rolledRow({ interactive: false })]} rolled actions={[]} onCancel={noop} />,
    );
    // La rangée interactive expose la relance (Chance) ; la témoin non.
    expect(interactiveOnly).toContain('rm-influence');
    expect(witnessOnly).not.toContain('rm-influence');
  });

  it('(e) opposé : winnerIndex=1 post-jet → rangée 1 = rr-win, rangée 0 = rr-lose', () => {
    const html = render(
      <RollShell
        title="Test opposé"
        rows={[
          rolledRow(), // rangée 0 (perdante)
          { ...rolledRow({ row: { d: testBreakdown('Opposition', 55, { roll: 12, target: 55, sl: 4, success: true }) } }), interactive: false }, // rangée 1 (gagnante, témoin)
        ]}
        rolled
        winnerIndex={1}
        netSL={2}
        actions={[]}
        onCancel={noop}
      />,
    );
    expect(html).toContain('rr-win');
    expect(html).toContain('rr-lose');
    expect(html).toContain('DR net'); // badge agrégé au niveau shell, une seule fois
    // Le badge « DR net » ne doit PAS être dupliqué par rangée (RollRow ne reçoit jamais netSL).
    expect(html.match(/rm-netsl/g)?.length).toBe(1);
  });

  // ── Garde de vocabulaire d'actions (#211) : la barre d'une modale de jet est verrouillée à
  //    (verbes DÉCLARÉS du flux ∪ commandes neutres). Choke-point unique : `RollShell` + `flowKey`. ──
  const act = (key: string): RollAction => ({ key, label: key, onClick: noop, when: 'always' });

  it('(h) garde : actions NEUTRES (cancel/rollAll/confirm) passent pour tout flux', () => {
    expect(() =>
      render(<RollShell flowKey="crewTest" title="T" rows={[rolledRow()]} rolled actions={[act('cancel'), act('rollAll'), act('confirm')]} />),
    ).not.toThrow();
  });

  it('(i) garde : un verbe DÉCLARÉ du flux passe (resist ∈ cascade)', () => {
    expect(() =>
      render(<RollShell flowKey="cascade" title="T" rows={[rolledRow()]} rolled actions={[act('resist')]} />),
    ).not.toThrow();
  });

  it('(j) garde : action FANTÔME (hors verbes déclarés + neutres) LÈVE', () => {
    // 'resist' n'est PAS déclaré par le flux `test` (ni neutre) → dérive rejetée.
    expect(() =>
      render(<RollShell flowKey="test" title="T" rows={[rolledRow()]} rolled actions={[act('resist')]} />),
    ).toThrow(/hors vocabulaire/);
    // clé inventée sur un flux qui ne la déclare pas.
    expect(() =>
      render(<RollShell flowKey="crewTest" title="T" rows={[rolledRow()]} rolled actions={[act('zorglub')]} />),
    ).toThrow(/hors vocabulaire/);
  });

  it('(k) garde : sans flowKey, inerte (modale sans flux naturel)', () => {
    expect(() =>
      render(<RollShell title="T" rows={[rolledRow()]} rolled actions={[act('zorglub')]} />),
    ).not.toThrow();
  });

  it('(d) actions filtrées par phase : Annuler (pre) disparaît après jet, Appliquer (post) apparaît', () => {
    const pre = render(
      <RollShell title="T" rows={[pendingRow()]} rolled={false} actions={actions} onCancel={noop} />,
    );
    const post = render(
      <RollShell title="T" rows={[rolledRow()]} rolled actions={actions} onCancel={noop} />,
    );
    expect(pre).toContain('Annuler'); // when:'pre'
    expect(pre).not.toContain('Appliquer'); // when:'post' masqué
    expect(post).toContain('Appliquer'); // when:'post'
    expect(post).not.toContain('Annuler'); // when:'pre' masqué
    // Le « Lancer » hissé (mono) suit la même phase : présent pré-jet, absent post-jet.
    // (Le préfixe 🎲 est désormais l'icône <Icon id="nav/dice"> — on vérifie le libellé texte.)
    expect(pre).toContain('Lancer');
    expect(post).not.toContain('Lancer');
  });

  it('(l) une action REFUSÉE garde le ton de sa clé : le bouton nu et `GatedAction` lisent le même `actionTon`', () => {
    const classes = (html: string, label: string) =>
      (new RegExp(`<button[^>]*class="([^"]*)"[^>]*>${label}<`).exec(actionsBar(html))?.[1] ?? '').split(' ').filter(Boolean).sort();
    const refusees: RollAction[] = [
      { key: 'cancel', label: 'Annuler', onClick: noop, when: 'pre', refus: 'Le jet est engagé.' },
      { key: 'confirm', label: 'Valider', onClick: noop, when: 'pre', refus: 'Choisis une option.' },
    ];
    const nues: RollAction[] = refusees.map(({ refus: _refus, ...a }) => a);
    const refuse = render(<RollShell title="T" rows={[]} rolled={false} actions={refusees} />);
    const offert = render(<RollShell title="T" rows={[]} rolled={false} actions={nues} />);
    expect(classes(refuse, 'Annuler')).toEqual(['btn', 'btn-ghost']);
    expect(classes(refuse, 'Valider')).toEqual(['btn', 'btn-primary']);
    expect(classes(offert, 'Annuler')).toEqual(classes(refuse, 'Annuler'));
    expect(classes(offert, 'Valider')).toEqual(classes(refuse, 'Valider'));
  });
});

/**
 * Z3b′ AU SOCLE (recette #1117) : le renvoi vers la règle était une DISCIPLINE AU SITE — `RunModal`
 * posait son enjeu sans jamais enrober son titre, et le joueur n'avait aucune porte. La coquille
 * l'accole désormais elle-même, dérivé de la MÊME entrée d'enjeu que la phrase.
 */
describe('RollShell — Z3b′ : le renvoi de règle est accolé au titre PAR LA COQUILLE', () => {
  const stake = flowStakeRef('run-roll'); // un jet dont l'enjeu a un foyer (`regles/course`)

  it('un `stake` à foyer donne le ℹ au titre SANS que le site ne compose quoi que ce soit', () => {
    const html = render(<RollShell title="Course" rows={[pendingRow()]} rolled={false} actions={actions} stake={stake} />);
    expect(stakeRuleOf(stake), 'pré-requis : cet enjeu a bien un foyer').toBeTruthy();
    expect(html.match(/ab-codex-info/g) ?? [], 'une porte, et une seule').toHaveLength(1);
    // Nom accessible DÉRIVÉ du titre — aucun libellé recopié au call-site.
    expect(html).toContain('aria-label="Règle : Course"');
  });

  it('sans `stake`, aucune porte n’apparaît au titre', () => {
    const html = render(<RollShell title="Course" rows={[pendingRow()]} rolled={false} actions={actions} />);
    expect(html).not.toContain('ab-codex-info');
  });

  it('un site qui a DÉJÀ composé sa porte (titre ou sous-titre) n’en reçoit pas une 2ᵉ', () => {
    const rule = stakeRuleOf(stake);
    const auTitre = render(<RollShell title={<>Course <StakeRule rule={rule} /></>} rows={[pendingRow()]} rolled={false} actions={actions} stake={stake} />);
    const auSousTitre = render(<RollShell title="Course" subtitle={<>étape <StakeRule rule={rule} /></>} rows={[pendingRow()]} rolled={false} actions={actions} stake={stake} />);
    expect(auTitre.match(/ab-codex-info/g) ?? []).toHaveLength(1);
    expect(auSousTitre.match(/ab-codex-info/g) ?? []).toHaveLength(1);
  });
});
