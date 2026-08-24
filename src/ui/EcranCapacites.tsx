/**
 * ÉCRAN DES CAPACITÉS (spec HUD combat « Zone 6 ») — la surface EXHAUSTIVE de ce que le porteur
 * peut faire : les TROIS pools du producteur unique (`state/poolsDeCapacites`), sectionnés par
 * FAMILLE, filtrables par libellé. La console n'en montre que ce que ses cases portent ; ici, rien
 * n'est caché — une capacité que cet écran ne montre pas n'existe nulle part (garde de parité,
 * `EcranCapacites.test.tsx`).
 *
 * Il S'OUVRE PAR-DESSUS le jeu (`ScreenShell`, voile sous les modales) et LANCE : cliquer une
 * entrée offerte FERME l'écran PUIS dispatche (séquence unique — un mode qui arme un ciblage doit
 * trouver la carte dégagée, jamais un voile par-dessus ce qu'il faut viser). Une entrée dont le
 * geste attend encore UN PARAMÈTRE borné (quelle arme recharger) n'engage RIEN : elle ouvre le
 * `PanneauParametre` ancré à elle, avec les candidats du MÊME producteur que la console — et c'est
 * l'élection d'un candidat qui ferme puis dispatche. Aucune case ne s'y pose et aucun geste ne s'y
 * glisse : le placement est le lot suivant.
 *
 * Une entrée REFUSÉE reste VISIBLE et porte sa raison au SURVOL/FOCUS, dans l'infobulle partagée
 * (`CodexRef refus`, même véhicule que les alvéoles de la console) — jamais gravée sous le nom.
 */
import { useEffect, useRef, useState } from 'react';
import { useGame, activeCombatant } from '../state/store';
import { controlsCombatant } from '../state/netOwnership';
import { refusEcranCapacites } from '../state/ecranCapacitesPorte';
import { panneauDeCase, poolsDuPorteur, type CaseDeCapacite, type CellFamily, type CtxPools } from '../state/poolsDeCapacites';
import { ScreenShell } from './ScreenShell';
import { MasterDetail } from './MasterDetail';
import { PanneauParametre, type ParamOption } from './PanneauParametre';
import { Band } from './Band';
import { SearchFilterField, filterByLabel } from './SearchFilterField';
import { CodexRef } from './compendium/CodexRef';
import { caseIcone } from './CaseIcone';
import { CaseTuile } from './CaseTuile';
import { DetailFrame } from './DetailFrame';

/** ORDRE de lecture des SECTIONS et leur intitulé — de l'AFFICHAGE : la famille est un id STABLE
 *  porté par la case (`CellFamily`), son nom se lit ici. Table TOTALE : une famille de plus au
 *  vocabulaire ne peut pas disparaître en silence de l'écran, `tsc` l'exige. */
const FAMILLES: Record<CellFamily, string> = {
  arme: 'Arme au poing',
  attaque: 'Attaques',
  magie: 'Magie',
  geste: 'Gestes',
  mouvement: 'Mouvement',
  defense: 'Défense',
  avantage: 'Avantage',
};
const ORDRE_FAMILLES = Object.keys(FAMILLES) as CellFamily[];

/** UNE ENTRÉE de l'écran = LA TUILE de la console (`CaseTuile`, matière unique d'une capacité dans
 *  ce jeu) : icône dans son alvéole, nom dessous, accent de famille, grisé du refus, or de l'armement
 *  — rien n'est redessiné ici. Le clic LANCE (ou ouvre le paramètre borné du geste) ; le survol/focus
 *  ne fait que déplacer le détail. La raison d'un refus se lit dans l'infobulle partagée qui
 *  l'enveloppe, comme au pont. */
function EntreeCapacite({ c, elue, advantage, onSurvol, onClic, btnRef }: {
  c: CaseDeCapacite;
  elue: boolean;
  advantage: number;
  onSurvol: () => void;
  onClic: () => void;
  btnRef?: (el: HTMLButtonElement | null) => void;
}) {
  const offerte = !!c.run && !c.disabled;
  return (
    <CodexRef category={c.rule?.category} id={c.rule?.id} label={c.label} refus={c.gate} wrap>
      <CaseTuile
        cle={c.key}
        actionId={c.id}
        famille={c.family}
        icone={caseIcone(c)}
        label={c.label}
        nom={c.label}
        raison={c.gate}
        gateId={c.gate ? `ec-gate-${c.key}` : undefined}
        on={c.on}
        elue={elue}
        adv={c.adv}
        advantage={advantage}
        ferme={!offerte}
        fermeParlante={!!c.gate}
        cellRef={btnRef}
        onClick={() => { if (offerte) onClic(); }}
        gestesTactiles={{ onMouseEnter: onSurvol, onFocus: onSurvol }}
      />
    </CodexRef>
  );
}

export function EcranCapacites() {
  const battle = useGame((s) => s.battle);
  const net = useGame((s) => s.net);
  const gameTime = useGame((s) => s.gameTime);
  const localIntent = useGame((s) => s.localIntent);
  const ouvert = useGame((s) => s.ecranCapacitesOuvert);
  const setOuvert = useGame((s) => s.setEcranCapacites);
  // LA PORTE, ABONNÉE : elle dépend du tour ET de la pause de Round — lue par sélecteur, l'écran
  // s'efface de lui-même dès que le tour passe à un porteur que ce siège ne tient pas.
  const refus = useGame(refusEcranCapacites);
  const [recherche, setRecherche] = useState('');
  const [elue, setElue] = useState<string | null>(null);
  // Panneau-paramètre OUVERT (clé de l'entrée qui l'a fait naître) et ANCRES des entrées : un
  // panneau naît de SON déclencheur, jamais du centre de l'écran.
  const [panneauOuvert, setPanneauOuvert] = useState<string | null>(null);
  const ancres = useRef(new Map<string, HTMLButtonElement>());
  // FOCUS D'ENTRÉE : le champ de filtre. `useModalA11y` (via `ScreenShell`) pose bien un focus, mais
  // sur le PREMIER focusable de la boîte — « ✕ Fermer » : la barre d'espace refermait l'écran à
  // peine ouvert (recette 2026-08-24). Le filtre est l'entrée utile d'un écran de recherche ; la
  // sortie, elle, reste Échap et le bouton de fermeture. Le retour du focus au déclencheur à la
  // fermeture est celui de la primitive (`useModalA11y`), inchangé.
  const filtreRef = useRef<HTMLDivElement>(null);
  const entree = ouvert;
  useEffect(() => {
    if (entree) filtreRef.current?.querySelector('input')?.focus();
  }, [entree]);

  const active = battle && !battle.over ? activeCombatant(battle) : undefined;
  if (!ouvert || !battle || !active || refus) return null;

  const ctx: CtxPools = {
    active,
    battle,
    netMode: net.mode,
    live: true,
    controlled: controlsCombatant(useGame.getState(), active),
    localIntent,
    gameTime,
  };
  const pools = poolsDuPorteur(ctx);
  // L'ORDRE est celui des pools (l'offre du porteur) ; les SECTIONS sont les familles. L'écran ne
  // filtre RIEN d'autre que la recherche du joueur : tout ce que le producteur rend est ici.
  const toutes = [...pools.arsenal, ...pools.accesRapide, ...pools.capacites];
  const filtrees = filterByLabel(toutes, (c) => c.label, recherche);
  const detail = toutes.find((c) => c.key === elue);

  /** LANCER : fermer PUIS dispatcher, dans cet ordre — une action qui arme un ciblage rend la main à
   *  la carte, que le voile de l'écran recouvrirait. */
  const lancer = (c: CaseDeCapacite) => {
    setOuvert(false);
    c.run?.();
  };
  /** CLIC sur une entrée : une case qui DÉCLARE un paramètre borné l'OUVRE (rien n'est engagé,
   *  l'annulation est gratuite) ; les autres lancent. */
  const clic = (c: CaseDeCapacite) => {
    if (c.ouvrePanneau) { setPanneauOuvert((v) => (v === c.key ? null : c.key)); return; }
    lancer(c);
  };
  const caseDuPanneau = panneauOuvert ? toutes.find((c) => c.key === panneauOuvert) : undefined;
  const panneau = caseDuPanneau && panneauDeCase(ctx, caseDuPanneau);
  const optionsPanneau: ParamOption[] = (panneau?.options ?? []).map((o) => ({
    ...o,
    // L'ÉLECTION d'un candidat EST le lancement : même séquence que l'entrée directe.
    onSelect: o.run && (() => { setPanneauOuvert(null); setOuvert(false); o.run!(); }),
  }));

  return (
    <ScreenShell
      title="Capacités"
      onClose={() => setOuvert(false)}
      body="centered"
      tabs={
        <div ref={filtreRef}>
        <SearchFilterField
          value={recherche}
          onChange={setRecherche}
          icon
          placeholder="Filtrer les capacités…"
          ariaLabel="Filtrer les capacités"
        />
        </div>
      }
    >
      <MasterDetail
        listLabel={`Capacités de ${active.label}`}
        list={
          /* La MATIÈRE de la travée des capacités (`cc-bay-right`, combat-console.css) porte la
             palette d'alvéole : les tuiles y sont EXACTEMENT celles du pont. Chaque famille est une
             bande titrée (`Band`, bois/laiton du jeu) dont le corps est une rangée de tuiles qui
             s'enroule (`row-flex`) — pleine largeur à 360px comme à 1920, sans une classe de plus. */
          <div className="cc-bay-right">
            {ORDRE_FAMILLES.map((f) => {
              const items = filtrees.filter((c) => c.family === f);
              if (!items.length) return null;
              return (
                <Band key={f} title={FAMILLES[f]} right={`${items.length}`}>
                  <div className="row-flex">
                    {items.map((c) => (
                      <EntreeCapacite
                        key={c.key}
                        c={c}
                        elue={c.key === elue}
                        advantage={active.advantage}
                        onSurvol={() => setElue(c.key)}
                        onClic={() => clic(c)}
                        btnRef={(el) => { if (el) ancres.current.set(c.key, el); else ancres.current.delete(c.key); }}
                      />
                    ))}
                  </div>
                </Band>
              );
            })}
          </div>
        }
        detail={
          detail ? (
            /* Le cadre de détail du jeu (`DetailFrame`, kit « Atelier du scribe ») : identité +
               chips méta + rubriques. La règle VERBATIM reste au popover du nom — le cadre ne
               recopie aucune prose. */
            <DetailFrame
              label={
                <CodexRef category={detail.rule?.category} id={detail.rule?.id} label={detail.label}>
                  {detail.label}
                </CodexRef>
              }
              meta={
                <>
                  <span className="chip">{FAMILLES[detail.family]}</span>
                  {detail.adv ? <span className="chip">{detail.adv} Avantage</span> : null}
                  {detail.gate ? <span className="chip tone-warn">{detail.gate}</span> : null}
                </>
              }
              sections={
                detail.secondaires?.length ? (
                  <div className="row-flex">
                    {detail.secondaires.map((g) => (
                      <EntreeCapacite
                        key={g.key}
                        c={g}
                        elue={false}
                        advantage={active.advantage}
                        onSurvol={() => undefined}
                        onClic={() => clic(g)}
                      />
                    ))}
                  </div>
                ) : undefined
              }
            />
          ) : (
            <span className="muted">Survolez une capacité pour la lire ; cliquez pour la jouer.</span>
          )
        }
      />
      {/* PARAMÈTRE BORNÉ du geste (quelle arme recharger) : ancré à l'entrée qui l'a ouvert, annulé
          gratuitement par Échap ou un clic dehors — la primitive porte tout cela. */}
      {panneau && caseDuPanneau && (
        <PanneauParametre
          anchor={ancres.current.get(caseDuPanneau.key) ?? null}
          intitule={panneau.intitule}
          options={optionsPanneau}
          onClose={() => setPanneauOuvert(null)}
        />
      )}
    </ScreenShell>
  );
}
