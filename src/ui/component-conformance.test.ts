import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { detenteur } from '../detenteur.testkit';

/**
 * Gardes du SYSTÈME DE COMPOSANTS unifié (#236). Une garde par classe de conformité, scan de source
 * (comme `comment-poison-guard`/`combat-hardcode-guard`). L'objectif : une primitive ABSENTE est une
 * invitation à réinventer — donc on verrouille les coquilles de dialogue/écran à leurs primitives
 * canoniques (`Modal`, `ScreenShell`, `RollShell`), l'a11y à `useModalA11y`, et la proéminence des
 * barres de jet à la déduction par rôle (plus de style au call-site).
 */

const UI = 'src/ui';

/** Les composants de `src/ui`, hors tests — chemin relatif POSIX à `src/ui/`. */
const FILES = detenteur(() =>
  readCorpus([UI], { exts: ['.tsx'] }).map(({ rel, text }) => ({
    rel: rel.slice(UI.length + 1),
    src: text,
  })),
);

/** Valeurs de tous les attributs `className=` (double/simple/accolade+template) d'un fichier. */
function classNames(src: string): string[] {
  const out: string[] = [];
  const re = /className=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`|`([^`]*)`)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

/** Idem, mais UNIQUEMENT le `className` d'un `<div>` natif — un modificateur passé en props à un
 *  composant (`<ScreenShell className="port-overlay">`) n'est pas un voile hand-rollé : le composant
 *  possède déjà le voile réel. */
function divClassNames(src: string): string[] {
  const out: string[] = [];
  const tagRe = /<div\b[^>]*>/g;
  let tag: RegExpExecArray | null;
  while ((tag = tagRe.exec(src))) out.push(...classNames(tag[0]));
  return out;
}

// Coquilles CANONIQUES (définissent le voile + l'a11y) et semi-canoniques SANCTIONNÉES (markup propre,
// squelette maison mais a11y `useModalA11y` câblée). Toute AUTRE surface passe par une primitive.
const OVERLAY_OWNERS = ['Modal.tsx', 'ScreenShell.tsx'];
// CampaignView (défaite) : surface plein-écran de RÉSULTAT, bouton unique, Échap inerte — voile
// bespoke. Dette #285.
// GameMenu.tsx : menu SYSTÈME plein écran (pause) — voile `.game-menu-overlay` semi-canonique (squelette
// maison composant la primitive MenuCard, a11y `useModalA11y` câblée) ; langage MenuCard voulu, pas la
// chrome de Modal/ScreenShell.
// OptionsScreen.tsx (#839) : MÊME voile et MÊME carte que GameMenu — c'est l'écran Options du menu
// PRINCIPAL, qui compose `OptionsSubScreen`, exactement celui du sous-écran Options en
// jeu. Même justification, même a11y (`useModalA11y` câblée) : semi-canonique, jamais une 2e chrome.
const OVERLAY_WHITELIST = ['CharacterSheet.tsx', 'ShipSheet.tsx', 'InspectPanel.tsx', 'compendium/CompendiumScreen.tsx', 'CampaignView.tsx', 'GameMenu.tsx', 'OptionsScreen.tsx'];

describe('#236 — gardes du système de composants unifié', () => {
  // ── (ii) Le voile plein écran est une PRIMITIVE : `modal-overlay`/`worldmap-overlay` n'apparaissent
  //    en className qu'au sein de `Modal`/`ScreenShell`, plus une whitelist EXPLICITE de semi-canoniques. ──
  it('(ii) modal-overlay / worldmap-overlay : hors Modal/ScreenShell + whitelist des semi-canoniques', () => {
    const offenders = FILES().filter(
      (f) =>
        !OVERLAY_OWNERS.includes(f.rel) &&
        !OVERLAY_WHITELIST.includes(f.rel) &&
        divClassNames(f.src).some((c) => /\b[\w-]*-overlay\b/.test(c)),
    ).map((f) => f.rel);
    expect(
      offenders,
      'Voile hand-rollé hors primitive — composer <Modal>/<ScreenShell> (ou, si semi-canonique légitime, ajouter à OVERLAY_WHITELIST avec useModalA11y) :\n' + offenders.join('\n'),
    ).toEqual([]);
  });

  // ── (iii) Tout markup portant `role="dialog"` câble l'a11y partagée (`useModalA11y`) DANS LE MÊME
  //    fichier — un dialogue sans focus/Échap/piège Tab est un cul-de-sac clavier. ──
  it('(iii) role="dialog" ⇒ useModalA11y dans le même fichier', () => {
    const offenders = FILES().filter((f) => f.src.includes('role="dialog"') && !f.src.includes('useModalA11y')).map((f) => f.rel);
    expect(offenders, 'role="dialog" sans useModalA11y — câbler l’a11y (ou passer par <Modal>/<ScreenShell>) :\n' + offenders.join('\n')).toEqual([]);
  });

  // ── (i) Registre des coquilles : tout fichier qui MONTE une surface de dialogue/écran (voile
  //    hand-rollé OU `aria-modal`) importe une primitive canonique — pas de coquille orpheline. ──
  it('(i) toute coquille montée importe une primitive canonique (Modal/ScreenShell/RollShell)', () => {
    const IMPORTS_SHELL = (src: string) => /from '\.{1,2}\/(Modal|ScreenShell|RollShell)'/.test(src);
    const offenders = FILES().filter((f) => {
      if (OVERLAY_OWNERS.includes(f.rel) || OVERLAY_WHITELIST.includes(f.rel)) return false;
      const isShell = f.src.includes('aria-modal') || divClassNames(f.src).some((c) => /\b[\w-]*-overlay\b/.test(c));
      return isShell && !IMPORTS_SHELL(f.src);
    }).map((f) => f.rel);
    expect(offenders, 'Coquille montée sans import de primitive canonique :\n' + offenders.join('\n')).toEqual([]);
  });

  // ── (vi) Proéminence NORMÉE : aucune barre d'action de jet ne choisit son style au call-site — le
  //    champ `kind` a disparu de `RollAction` (déduction par rôle dans RollShell). Le TYPAGE l'impose
  //    déjà (excess property) ; cette garde ferme la porte à sa réintroduction textuelle. ──
  it('(vi) aucune action de jet ne porte de style de proéminence au call-site (kind supprimé)', () => {
    const offenders = FILES().filter((f) => /kind:\s*'(?:primary|ghost|resource)'/.test(f.src)).map((f) => f.rel);
    expect(offenders, 'Style de proéminence au call-site — retirer `kind` (RollShell déduit par rôle) :\n' + offenders.join('\n')).toEqual([]);
  });

  // ── (vii) Titre de modale de jet composé au call-site (#295 Lot 3, verrou a) : un `title=` de
  //    `<RollShell>` en TEMPLATE LITERAL (backticks) avec au moins une interpolation ET un tiret
  //    cadratin est le motif qui a produit `${actor} — ${action} (${skill})` au call-site — SOURCE
  //    UNIQUE = `rollTitle`/`composeRollLabel` (rollSeam.ts). Formes LÉGALES : littéral nu
  //    (`'Recharger'`), `pending.label`/`step.label`, `rollTitle(...)`, ou une expression JSX
  //    (`<>…</>` — pas un template literal JS). ──
  it('(vii) titre de RollShell : pas de template literal `${…} — …` composé au call-site', () => {
    const offenders: string[] = [];
    for (const f of FILES()) {
      const re = /<RollShell[\s\S]{0,600}?\btitle=\{(`[^`]*`)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(f.src))) {
        const lit = m[1];
        if (lit.includes('${') && lit.includes('—')) offenders.push(`${f.rel} : ${lit}`);
      }
    }
    expect(offenders, 'Titre composé au call-site — littéral nu, pending.label/step.label, ou rollTitle(...) :\n' + offenders.join('\n')).toEqual([]);
  });

  it('(vii) fail-closed : le détecteur flague un titre synthétique `${actor} — ${action} (${skill})`', () => {
    const regressed = "<RollShell\n  flowKey=\"x\"\n  title={`${actor.name} — Frapper (${skill.label})`}\n  rows={[]}\n/>";
    const re = /<RollShell[\s\S]{0,600}?\btitle=\{(`[^`]*`)\}/g;
    const m = re.exec(regressed);
    expect(m).toBeTruthy();
    expect(m![1].includes('${') && m![1].includes('—')).toBe(true);
  });
});
