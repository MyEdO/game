import type { ReactNode } from 'react';
import { useGame } from '../state/store';
import { t } from '../i18n';
import { JET_FIGE, influencesLocally, jetFigeRevele } from '../noyau/netOwnership';
import { counterspellJoinable, counterspellDeclarePhase, counterspellRolls, counterspellSoutenu, counterspellSupportFor } from '../noyau/combatFlow';
import type { CounterDeclaration } from '../noyau/pendings';
import { fenetreDIncantation } from '../noyau/fenetreDIncantation';
import { clampTarget } from '../engine/tests';
import { counterspellValue, type CritChoice } from '../engine/magic';
import type { OvercastAxis } from '../engine/overcast';
import { fermeturesDuFlux } from '../noyau/verbesOuverts';
import { CharFrame } from './CharFrame';
import { OptionChooser } from './OptionChooser';
import { RollShell, type RollAction } from './RollShell';
import { VsHeader } from './VsHeader';
import { RollRow } from './RollRow';
import { refusDeRangee, rowForcedDie } from './forcedDieRow';
import { maskOpposedRow } from './opposedFrozen';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { testBreakdown, testPending, soutienMod, opposedLines } from './breakdown';
import { Icon } from './Icon';
import { QtyStepper } from './QtyStepper';
import { Row, Stack, grow } from './Layout';
import { libelleDeTest, libelleDOppositionDeSort } from '../noyau/jetsEnVue';
import { useGesteDeJet } from './useGesteDeJet';
import { REGLAGE_DE_L_AXE, ciblesBasculees } from '../noyau/reglagesDuJet';

/** Marque du pluriel FR, accordée sur la VALEUR (patron `plural(n)` des modales de navire) : le
 *  raccourci « (s) » du code laissait l'écran écrire « 1 pas … RESTANT(S) ». */
const plural = (n: number) => (n > 1 ? 's' : '');

/** L'icône et le libellé de chaque axe de Surincantation. */
const META: Record<OvercastAxis, [ReactNode, string]> = {
  range: [<Icon id="magie/portee" size="sm" />, 'Portée'], zone: [<Icon id="magie/zone" size="sm" />, 'Zone'], duration: [<Icon id="interface/attendre" size="sm" />, 'Durée'], targets: [<Icon id="action/viser" size="sm" />, 'Cibles'], damage: [<Icon id="journal/degats" size="sm" />, 'Dégâts'],
};

/** L'icône et l'infobulle de chaque effet d'Incantation Critique. LDB 46 l.30-32 */
const EFFETS: Record<CritChoice, [Parameters<typeof Icon>[0]['id'], string]> = {
  critique: ['journal/critique', 'Si le Sort inflige des Dégâts, il inflige aussi une Blessure Critique.'],
  puissance: ['magie/zone', 'Le Sort est lancé quels que soient son NI et votre DR, mais il peut être Dissipé.'],
  ineluctable: ['action/se-defendre', 'Si vous avez assez de DR pour lancer le Sort, il ne peut pas être Dissipé.'],
};

/**
 * Modale d'incantation — paramétrage de la coquille PARTAGÉE `RollShell` (comme Attaque/Défense) :
 * on sélectionne un sort + une cible, « Lancer » (rangée mono) fait le jet, on voit le résultat
 * (réussite DR ≥ NI, échec, ou Maladresse), Chance/Pacte/Résilience DANS la rangée, puis « Appliquer ».
 * Le métier propre à l'incantation (Surincantation, Contre-sort, Opposition, choix du Critique, pose de
 * zone) passe par les slots `setup`/`postRollExtra` ; toute la mécanique générique vit dans la coquille.
 *
 * Surincantation « +Cible » : EN COMBAT, le choix des cibles supplémentaires se fait SUR LE CHAMP
 * DE BATAILLE (`jetRegler('incantation', 'carte', 'cibles')` efface la modale, bandeau TargetPrompt + clic carte) ; hors
 * combat (pas de carte tactique), repli sur des boutons-portraits dans la modale.
 */
export function CastModal() {
  const pc = useGame((s) => s.pendingCast);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGesteDeJet('jetLancer', 'incantation');
  const reroll = useGesteDeJet('jetRelancer', 'incantation');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'incantation');
  const darkPact = useGesteDeJet('jetPactiser', 'incantation');
  const regler = useGame((s) => s.jetRegler);
  const forceSuccess = useGesteDeJet('jetForcerLaReussite', 'incantation');
  const confirm = useGesteDeJet('jetValider', 'incantation');
  const cancel = useGesteDeJet('jetAnnuler', 'incantation');
  // Opposition de la cible (multijet DANS cette modale) : chaque cible oppose son Test (FM/Int/Bagarre).
  const pcs = useGame((s) => s.pendingCastOpposition);
  const oppRoll = useGesteDeJet('jetLancer', 'opposition');
  const oppReroll = useGesteDeJet('jetRelancer', 'opposition');
  const oppBonusSL = useGesteDeJet('jetAjouterUnDR', 'opposition');
  const oppDarkPact = useGesteDeJet('jetPactiser', 'opposition');
  const oppForce = useGesteDeJet('jetForcerLaReussite', 'opposition');
  const oppResist = useGesteDeJet('jetResister', 'opposition'); // Résistance (Menace : Magie) — auto-succès du talent (LDB 10)
  const oppConfirm = useGesteDeJet('jetValider', 'opposition');
  // Contre-sort (Dissipation) : RÉACTION au Sort figé dans `pendingCast` — plus de modale
  // séparée (« le contre-sort, c'est le lancement d'un sort qui peut être opposé »). Chaque
  // contre-lanceur a SA rangée (`RollRow`), DANS cette modale d'incantation, exactement comme
  // l'opposition de cible ci-dessus. « Laisser passer »/« Appliquer » agrègent via `jetValider('contreSort')`.
  const csp = useGame((s) => s.pendingCounterspell);
  const cspRoll = useGesteDeJet('jetLancer', 'contreSort');
  const cspReroll = useGesteDeJet('jetRelancer', 'contreSort');
  const cspBonusSL = useGesteDeJet('jetAjouterUnDR', 'contreSort');
  const cspDarkPact = useGesteDeJet('jetPactiser', 'contreSort');
  const cspForce = useGesteDeJet('jetForcerLaReussite', 'contreSort');
  const cspConfirm = useGesteDeJet('jetValider', 'contreSort');
  const cspCancel = useGesteDeJet('jetAnnuler', 'contreSort');
  if (!pc) return null;
  const pool = battle?.combatants ?? party; // même modale en combat (file) et hors combat (groupe)
  // La fenêtre en données (`fenetreDIncantation`) : NI, réglages et leurs refus, Surincantation, pose, issue.
  const vue = fenetreDIncantation(useGame.getState());
  const caster = vue && pool.find((c) => c.id === vue.lanceurId);
  const target = vue && pool.find((c) => c.id === vue.cibleId);
  if (!vue || !caster || !target) return null;
  const res = pc.result;
  const zoneUnplaced = !!vue.zone?.aPoser;
  const placeable = !!vue.pose && !vue.pose.refus;
  // #990 — CALENDRIER de découverte de l'incantation FIGÉE (arbitrage user 2026-07-30) : tant que le
  // répondant de CE siège (opposition de cible OU Contre-sort) n'a pas lancé, la rangée du lanceur ET
  // le verdict qui la trahit restent masqués. Verdict du noyau (`jetFigeRevele`).
  const castRevealed = jetFigeRevele(useGame.getState(), JET_FIGE.incantation(useGame.getState(), pc));
  const outcome = castRevealed ? vue.issue : '';

  // Rangée MONO d'incantation = le jet du lanceur, porteur de son cycle d'influence (Lancer → Chance/
  // +1 DR/Pacte/Résilience → Appliquer), sur la ligne de la fenêtre (`vue.ligne`).
  const { ligne } = vue;
  // Rangée du lanceur : son cycle d'influence appartient au siège qui PILOTE le lanceur — `influencesLocally`
  // (#1005) ; un lanceur ENNEMI (IA, ou MJ d'un AUTRE siège) rend une rangée TÉMOIN. Elle passe ENSUITE par le
  // calendrier #990 — `maskOpposedRow` MASQUE sa ligne, et le cycle d'influence, DÉRIVÉ de cette ligne, s'éteint
  // avec elle.
  const castRow: BuiltRollRow = maskOpposedRow(castRevealed, buildRollRow({
    actor: caster,
    // Le ✓/✗ de la LIGNE est le verdict du TEST (`LDB 46 l.22-24`), jamais celui du Sort lancé.
    row: ligne.jet
      ? { combatant: caster, d: testBreakdown(ligne.label, ligne.base, ligne.jet, undefined, ligne.mods) }
      : { combatant: caster, pending: testPending(ligne.label, ligne.base, clampTarget(ligne.target), undefined, ligne.mods) },
    onRoll: roll,
    rerolled: !!pc.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    // L'OFFRE du Pacte se dit par la présence du handler ; sa fenêtre est celle du flux (`vue.fermetures`).
    ...(!vue.fermetures.pactiser ? { onDarkPact: darkPact } : {}),
    onForce: forceSuccess,
  }, {
    interactive: influencesLocally(useGame.getState(), pc.casterId),
    fortune: caster.fortune ?? 0,
    resilience: caster.resilience ?? 0,
  }));

  const issue = res && outcome
    ? [recapLineOfEvent(ev(res.isCritical ? 'critique' : 'sort', outcome, caster.id, vue.surSoi ? undefined : target.id), pool)]
    : undefined;

  const actions: RollAction[] = [
    // Renoncer, ou « Laisser passer » le Contre-sort : la fenêtre naît du jet d'incantation, et sans cette action
    // décliner la Dissipation serait inatteignable. L'annulation se juge au flux (`vue.annulation`), jamais au genre
    // du lanceur.
    ...(csp
      ? [{ key: 'annuler', label: 'Laisser passer', onClick: cspCancel, verbe: 'annuler', flux: 'contreSort' } as RollAction]
      : !vue.annulation
        ? [{ key: 'annuler', label: t('verbe.annuler'), onClick: cancel, verbe: 'annuler' } as RollAction]
        : []),
    {
      key: 'confirmer',
      // Le libellé « (dissipé) » EST le verdict de la comparaison au jet masqué : même calendrier que l'issue (#990).
      label: csp ? (castRevealed && csp.participants.some((p) => p.result?.dispelled) ? 'Appliquer (dissipé)' : 'Appliquer') : placeable ? <><Icon id="outil-de-carte/epingle" size="sm" /> Poser la zone</> : 'Appliquer',
      title: placeable && !csp ? "La modale s'efface — clique une case du champ de bataille pour déposer la zone" : undefined,
      onClick: csp ? cspConfirm : pcs ? oppConfirm : placeable ? () => regler('incantation', 'carte', 'zone') : confirm,
      verbe: 'valider',
      flux: csp ? 'contreSort' : pcs ? 'opposition' : 'incantation',
    },
  ];
  const sur = vue.surincantation;

  return (
    <RollShell
      flowKey="incantation"
      title={vue.intitule}
      extra={
        <>
          <VsHeader
            actor={caster}
            target={vue.surSoi || zoneUnplaced ? undefined : target}
            label={
              // La PORTÉE du sort (gabarit de Zone d'Effet, cible = le lanceur) n'est pas une
              // opposition A→B : la bande la porte comme qualificatif (#1078 LOT B2).
              vue.zone ? (
                <>
                  <strong>Zone d'Effet</strong> — gabarit {vue.zone.cote}×{vue.zone.cote} cases
                  {zoneUnplaced ? ' · la zone se pose après le jet' : ''}
                </>
              ) : vue.surSoi ? (
                <>
                  <strong>{vue.sort}</strong>
                  {vue.ni != null ? ` · NI ${vue.ni}` : ''} — sur soi
                </>
              ) : (
                <>
                  {vue.sort}
                  {vue.ni != null ? ` · NI ${vue.ni}` : ''}
                </>
              )
            }
            verb="action/incanter"
          />
        </>
      }
      rows={[castRow]}
      rolled={!!res}
      outcome={issue}
      setup={
        <>
          {/* LDB 40 l.40-42 */}
          {vue.ton && (
            <OptionChooser
              layout="seg"
              groupLabel={<><Icon id="foi/priere" size="sm" /> Ton de la Prière</>}
              options={vue.ton.options.map((o) => ({
                key: o.valeur ? 'discreet' : 'aloud', label: o.libelle, selected: vue.ton!.choisie === o.valeur,
                onSelect: () => regler('incantation', 'discret', !!o.valeur), refus: o.refus ?? undefined,
              }))}
            />
          )}
          {vue.forme && (
            <div className="rm-options">
              {/* LDB 47 */}
              <span className="mini-title"><Icon id="objet/arme" size="sm" /> Forme de l'arme invoquée</span>
              <OptionChooser
                layout="grid"
                options={vue.forme.options.map((o) => ({
                  key: String(o.valeur), label: o.libelle, selected: vue.forme!.choisie === o.valeur,
                  onSelect: () => regler('incantation', 'formeConjuree', String(o.valeur)), refus: o.refus ?? undefined,
                }))}
              />
            </div>
          )}
        </>
      }
      postRollExtra={res && (
        <>
          {/* Surincantation : un STEPPER +/− par axe que la fenêtre ouvre, chaque pas avec son refus ; la
              désignation des cibles supplémentaires est SÉPARÉE de l'allocation (en combat : sur la carte). */}
          {sur && (
            <div className="rm-options">
              <span className="mini-title"><Icon id="magie/souffle" size="sm" /> Surincantation — {sur.restant} pas (+{sur.coutDuPas} DR) restant{plural(sur.restant)}</span>
              <Stack gap="sm">
                {sur.axes.map((a) => (
                  <Row key={a.axe} gap="md" align="center">
                    <span {...grow}>
                      {META[a.axe][0]} {META[a.axe][1]}
                      {a.axe === 'zone' && vue.zone ? ` ${vue.zone.cote}×${vue.zone.cote}` : ''}
                      {a.axe === 'targets' && sur.cibles ? ` +${sur.cibles.capacite}` : ''}
                      {a.axe === 'damage' && sur.bonusDeDegats > 0 ? ` +${sur.bonusDeDegats}` : ''}
                    </span>
                    <QtyStepper
                      center={<strong>{a.pas}</strong>}
                      onDec={() => regler('incantation', REGLAGE_DE_L_AXE[a.axe], a.pas - 1)}
                      onInc={() => regler('incantation', REGLAGE_DE_L_AXE[a.axe], a.pas + 1)}
                      decLabel={`Rendre un pas de ${META[a.axe][1]}`}
                      incLabel={`Allouer un pas de ${META[a.axe][1]} (+${sur.coutDuPas} DR)`}
                      refus={{ id: `overcast-${a.axe}`, dec: a.refusDeRendre ?? undefined, inc: a.refusDAllouer ?? undefined }}
                    />
                  </Row>
                ))}
              </Stack>
              {sur.cibles && (sur.cibles.surLaCarte ? (
                // La rangée ceint le bouton à son contenu : dans la pile des réglages, un bouton seul
                // s'étirerait sur toute la largeur.
                <Row>
                  <button className="btn small" onClick={() => regler('incantation', 'carte', 'cibles')} title="Choisir les cibles supplémentaires sur le champ de bataille">
                    <Icon id="navigation/campagne" size="sm" /> Désigner les cibles ({sur.cibles.designees}/{sur.cibles.capacite})
                  </button>
                </Row>
              ) : (
                <div className="rm-loc-grid">
                  {sur.cibles.candidats.map((id) => pool.find((c) => c.id === id)).filter((m) => !!m).map((m) => (
                    <CharFrame key={m.id} c={m} variant="vital" size="sm" selected={(pc.extraTargetIds ?? []).includes(m.id)} onClick={() => regler('incantation', 'ciblesSupplementaires', ciblesBasculees(pc.extraTargetIds, m.id))} />
                  ))}
                </div>
              ))}
              {/* EDOC 13 l.276 */}
              {sur.jetsSurLeTableau && (
                <Row gap="md" align="center">
                  <span {...grow}><Icon id="navigation/des" size="sm" /> Jets sur le Tableau</span>
                  <QtyStepper
                    center={<strong>{sur.jetsSurLeTableau.choisis}</strong>}
                    onDec={() => regler('incantation', 'jetsDeTable', sur.jetsSurLeTableau!.choisis - 1)}
                    onInc={() => regler('incantation', 'jetsDeTable', sur.jetsSurLeTableau!.choisis + 1)}
                    decLabel="Décliner un jet sur le Tableau"
                    incLabel="Refaire un jet sur le Tableau"
                    refus={{ id: 'overcast-table', dec: sur.jetsSurLeTableau.refusDeDecliner ?? undefined, inc: sur.jetsSurLeTableau.refusDeRefaire ?? undefined }}
                  />
                </Row>
              )}
            </div>
          )}
          {vue.critique && (
            <div className="rm-options">
              {/* LDB 46 l.26-32 : aucune présélection, la fenêtre ne retient aucun effet tant qu'il n'est pas choisi. */}
              <span className="mini-title"><Icon id="magie/puissance" size="sm" /> Incantation Critique — choisir l'effet</span>
              <OptionChooser
                layout="grid"
                options={vue.critique.options.map((o) => ({
                  key: String(o.valeur), label: <><Icon id={EFFETS[o.valeur as CritChoice][0]} size="sm" /> {o.libelle}</>,
                  title: EFFETS[o.valeur as CritChoice][1], selected: vue.critique!.choisie === o.valeur,
                  onSelect: () => regler('incantation', 'effetCritique', o.valeur as CritChoice), refus: o.refus ?? undefined,
                }))}
              />
            </div>
          )}
          {/* OPPOSITION de la cible (Fauche-démon → FM, Parole de Tzeentch → Int) : rangées DANS la
              modale d'incantation (cible IA = témoin auto-roulée, cible héros = interactive). */}
          {pcs && (
            <div className="cs-rows">
              <span className="mini-title"><Icon id="action/se-defendre" size="sm" /> Opposition — la cible oppose son {libelleDOppositionDeSort(pcs)}</span>
              {pcs.participants.map((part) => {
                const actor = pool.find((c) => c.id === part.id);
                if (!actor) return null;
                const r = part.result;
                // LDB 12 l.166.
                const [oppLine] = opposedLines([{ label: libelleDOppositionDeSort(pcs), base: part.ligne.base, mods: part.ligne.mods, target: part.ligne.target, r: r?.oppose }]);
                const row = r
                  ? { combatant: actor, d: oppLine.d }
                  : { combatant: actor, pending: oppLine.pending };
                /* #990 : l'issue d'une rangée COMPARE le jet du répondant à l'incantation masquée — elle
                   suit donc le calendrier du SPECTATEUR (`castRevealed`), pas celui du propriétaire de la
                   rangée : sinon « Résiste ! » livre le verdict que le dé masqué cachait. Conséquence
                   assumée (arbitrage #990) : chacun joue à l'aveugle et lit son propre verdict à la fin. */
                const oppNote = r && castRevealed
                  ? <div className={`cs-outcome ${r.resisted ? 'ok-text' : 'muted'}`}>{r.resisted ? <><Icon id="interface/fait" size="sm" /> Résiste !</> : `subit · marge DR ${r.margin}`}</div>
                  : undefined;
                // COOP : même gate que la rangée Contre-sort voisine (#1005 — `influencesLocally`, routé par
                // le PORTEUR du jet), composé avec `part.interactive` (cible IA = rangée témoin, auto-roulée).
                const owned = influencesLocally(useGame.getState(), part.id) && !!part.interactive;
                // Sélecteur de dé (Résilience LDB 17 l.68 / dé fixé) : ces rangées vivent dans un SLOT de la
                // coquille, pas dans ses `rows` — la couture se demande ici, elle ne se recopie pas.
                const die = rowForcedDie(useGame.getState(), 'opposition', { actor, rolled: !!r, interactive: owned, key: part.id, onRoll: () => oppRoll(part.id) }, !!r);
                return (
                  <RollRow
                    key={part.id}
                    actor={actor}
                    row={oppNote ? { ...row, note: oppNote } : row}
                    rolled={!!r}
                    forcedRoll={die.forcedRoll}
                    fixedMark={die.fixedMark}
                    interactive={owned}
                    rollLabel={<><Icon id="action/se-defendre" size="sm" /> Résister</>}
                    onRoll={() => oppRoll(part.id)}
                    rerolled={!!part.rerolled}
                    /* La cible ne RÉSISTE pas : issue défavorable même sur un Test propre réussi
                       (opposition perdue) — la Résilience y reste offerte (LDB 17 l.68). */
                    lost={!!r && !r.resisted}
                    onReroll={() => oppReroll(part.id)}
                    onBonusSL={() => oppBonusSL(part.id)}
                    onDarkPact={() => oppDarkPact(part.id)}
                    onForce={() => oppForce(part.id)}
                    /* Résistance (Menace : Magie), LDB 10 l.1020 : la fenêtre est le verbe `resister` du flux. */
                    resist={pcs.menace != null && !fermeturesDuFlux(useGame.getState(), 'opposition', part.id).resister
                      ? { menace: pcs.menace, onResist: () => oppResist(part.id) } : undefined}
                  />
                );
              })}
            </div>
          )}
          {/* CONTRE-SORT (Dissipation, LDB 46 l.156) : le Sort est figé (révélé ci-dessus), les
              contre-lanceurs éligibles ont chacun leur rangée DANS cette même modale d'incantation
              (plus de modale séparée : un contre-sort EST un lancement de sort opposé).
              PLUSIEURS peuvent chanter contre la même incantation (#1040, cf. `jetValider('contreSort')`,
              src/noyau/combatSlice.ts) ; la COMPOSITION (contrer seul / s'unir / s'abstenir) se fige
              au premier jet de la fenêtre (#1059) — au-delà, seules les rangées déclarées agissent.
              COOP : chaque rangée est pilotée par le siège qui POSSÈDE son porteur — héros du siège,
              ennemi du MJ (#1028) ; les autres la lisent. */}
          {csp && (
            <div className="cs-rows">
              <span className="mini-title"><Icon id="action/se-defendre" size="sm" /> Contre-sort — chaque contre-lanceur oppose son Langue (Magick)</span>
              {csp.participants.map((part) => {
                const actor = pool.find((c) => c.id === part.id);
                if (!actor) return null;
                const r = part.result;
                const val = counterspellValue(actor);
                // Test SOUTENU (LDB 46 l.162) : le groupe uni n'a QU'UN jet, celui du meneur DÉRIVÉ ;
                // son Soutien s'affiche comme tout autre modificateur (`soutienMod`, source unique).
                const st = useGame.getState();
                const grp = counterspellSoutenu(st, csp);
                const mods = soutienMod(counterspellSupportFor(st, csp, part.id));
                const phase1 = counterspellDeclarePhase(csp);
                const lance = counterspellRolls(st, csp, part);
                // LDB 12 l.166 ; LDB 46 l.156.
                const [counterLine] = opposedLines([{ label: libelleDeTest('langue-magick'), base: val, r: r?.counter, mods: mods ? [mods] : undefined }]);
                const row = r
                  ? { combatant: actor, d: counterLine.d }
                  : { combatant: actor, pending: counterLine.pending };
                const owned = influencesLocally(st, part.id) && !!part.interactive;
                const onRoll = () => cspRoll(part.id);
                const die = rowForcedDie(st, 'contreSort', { actor, rolled: !!r, interactive: owned, key: part.id, onRoll }, !!r);
                // La rangée AFFICHE sa situation : en PHASE 1, une rangée d'un AUTRE siège encore
                // vierge dit qu'on l'attend (la fenêtre entière est suspendue à elle — l'attente ne
                // reste jamais muette) ; en PHASE 2, chacune porte sa déclaration, un « passe » étant
                // éteint mais motivé, jamais un vide inexpliqué.
                const situation = !part.declared
                  ? (!owned ? t('declaration.attente', { name: actor.label }) : undefined)
                  : part.declared === 'passer'
                    ? 'passe — ne tente pas la Dissipation ce Round'
                    : part.declared === 'soutenu' && grp
                      ? (lance ? `mène le Test Soutenu (+${grp.bonus})` : `soutient ${grp.leader.label} (+10)`)
                      : undefined;
                /* Sous-ligne de la rangée (canal UNIQUE `note`) : la situation s'affiche là où le
                   contrôle de déclaration ne la porte pas déjà (rangée d'un autre siège, ou phase
                   close) ; l'issue suit le calendrier du SPECTATEUR (`castRevealed`, #990).
                   Rien à dire ⇒ `null` : `RollPanel` gate `.rr-note` sur la TRUTHINESS de la note, et
                   un fragment vide est truthy — il ouvrirait une sous-ligne vide sur chaque rangée. */
                const cspSituation = !r && situation && !(owned && phase1) ? situation : null;
                const cspOutcome = r && castRevealed ? r : null;
                const cspNote = cspSituation || cspOutcome ? (
                  <>
                    {cspSituation && <div className="hint">{cspSituation}</div>}
                    {cspOutcome && <div className={`cs-outcome ${cspOutcome.dispelled ? 'ok-text' : 'muted'}`}>{cspOutcome.dispelled ? <><Icon id="interface/fait" size="sm" /> Dissipé !</> : `DR net ${cspOutcome.casterNetSL >= 0 ? '+' : ''}${cspOutcome.casterNetSL}`}</div>}
                  </>
                ) : null;
                return (
                  <RollRow
                    key={part.id}
                    actor={actor}
                    row={{ ...row, note: cspNote }}
                    rolled={!!r}
                    forcedRoll={die.forcedRoll}
                    fixedMark={die.fixedMark}
                    interactive={owned && part.declared !== 'passer'}
                    rollLabel={<><Icon id="action/se-defendre" size="sm" /> Contre-sort</>}
                    onRoll={onRoll}
                    rollBlocked={refusDeRangee(st, 'contreSort', part.id)}
                    /* PHASE 1 : chaque rangée possédée déclare (contrer seul / s'unir / passer) ; s'unir
                       n'est offert qu'avec un partenaire de même Domaine. La dernière déclaration FIGE
                       la composition — le contrôle disparaît alors. */
                    declare={owned && phase1
                      ? {
                        value: part.declared,
                        onChoose: (k) => regler('contreSort', 'declaration', k as CounterDeclaration, part.id),
                        options: [
                          { key: 'solo', label: t('valeur.declaration.solo') },
                          // La raison du refus se lit au survol/focus/tap, jamais par un segment muet.
                          { key: 'soutenu', label: t('valeur.declaration.soutenu'), refus: counterspellJoinable(st, csp, part.id) ? undefined : 'Exige un autre dissipateur du même Domaine' },
                          { key: 'passer', label: t('valeur.declaration.passer') },
                        ],
                        hint: situation,
                      }
                      : undefined}
                    rerolled={!!part.rerolled}
                    /* Le sort n'est PAS dissipé : issue défavorable même quand le Test de Langue
                       magique passe — la Résilience y reste offerte (LDB 17 l.68). */
                    lost={!!r && !r.dispelled}
                    onReroll={() => cspReroll(part.id)}
                    onBonusSL={() => cspBonusSL(part.id)}
                    onDarkPact={() => cspDarkPact(part.id)}
                    onForce={() => cspForce(part.id)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
      actions={actions}
      /* Échap = Annuler : RollShell le neutralise dès qu'un jet est lancé (`!rolled ? onCancel`). */
      onCancel={csp ? cspCancel : !vue.annulation ? cancel : undefined}
    />
  );
}
