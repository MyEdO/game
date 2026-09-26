import type { ReactNode } from 'react';
import { useGame } from '../state/store';
import { influencesLocally } from '../state/netOwnership';
import { overcastTargetCandidates, previewCast, counterspellChanted, counterspellJoinable, counterspellDeclarePhase, counterspellRolls, counterspellSoutenu, counterspellSupportFor, withPreRollFixedDie } from '../state/combatFlow';
import type { CounterDeclaration } from '../state/pendings';
import { findSpellById } from '../data/index';
import { spellEffectOps } from '../state/flow';
import { conjureFormOptions } from '../engine/conjuredWeapons';
import { testValue } from '../engine/skills';
import { castingValue, spellTargetCount, overcastSL, castAfterCrit, castInfoIsPrayer } from '../engine/magic';
import { type OvercastAxis, overcastSourceOf, overcastAxes, extraTargetCapacity, missileOvercastDamageBonus, spellHasOvercastTableRoll, overcastBudget, overcastStepCost } from '../engine/overcast';
import { availableResistance, resistanceImproves } from '../engine/menace';
import { rule } from '../engine/policy';
import { CharFrame } from './CharFrame';
import { OptionChooser } from './OptionChooser';
import { RollShell, type RollAction } from './RollShell';
import { VsHeader } from './VsHeader';
import { RollRow } from './RollRow';
import { rowForcedDie } from './forcedDieRow';
import { maskOpposedRow, opposedResponded, opposedRevealed } from './opposedFrozen';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { testBreakdown, testPending, soutienMod, opposedLines } from './breakdown';
import { Icon } from './Icon';
import { resultLine, freeCons } from '../state/rollSeam';
import { QtyStepper } from './QtyStepper';
import { Row, Stack, grow } from './Layout';

/** Marque du pluriel FR, accordée sur la VALEUR (patron `plural(n)` des modales de navire) : le
 *  raccourci « (s) » du code laissait l'écran écrire « 1 pas … RESTANT(S) ». */
const plural = (n: number) => (n > 1 ? 's' : '');

/**
 * Modale d'incantation — paramétrage de la coquille PARTAGÉE `RollShell` (comme Attaque/Défense) :
 * on sélectionne un sort + une cible, « Lancer » (rangée mono) fait le jet, on voit le résultat
 * (réussite DR ≥ NI, échec, ou Maladresse), Chance/Pacte/Résilience DANS la rangée, puis « Appliquer ».
 * Le métier propre à l'incantation (Surincantation, Contre-sort, Opposition, choix du Critique, pose de
 * zone) passe par les slots `setup`/`postRollExtra` ; toute la mécanique générique vit dans la coquille.
 *
 * Surincantation « +Cible » : EN COMBAT, le choix des cibles supplémentaires se fait SUR LE CHAMP
 * DE BATAILLE (`castPickTargets` efface la modale, bandeau TargetPrompt + clic carte) ; hors
 * combat (pas de carte tactique), repli sur des boutons-portraits dans la modale.
 */
export function CastModal() {
  const pc = useGame((s) => s.pendingCast);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.castRoll);
  const reroll = useGame((s) => s.castReroll);
  const bonusSL = useGame((s) => s.castBonusSL);
  const darkPact = useGame((s) => s.castDarkPact);
  const setCritChoice = useGame((s) => s.castSetCritChoice);
  const setConjureForm = useGame((s) => s.castSetConjureForm);
  const setDiscreet = useGame((s) => s.castSetDiscreet);
  const allocOvercast = useGame((s) => s.castAllocOvercast);
  const setChosenTableRolls = useGame((s) => s.castSetChosenTableRolls);
  const toggleExtraTarget = useGame((s) => s.castToggleExtraTarget);
  const pickTargets = useGame((s) => s.castPickTargets);
  const placeZone = useGame((s) => s.castPlaceZone);
  const forceSuccess = useGame((s) => s.castForceSuccess);
  const confirm = useGame((s) => s.castConfirm);
  const cancel = useGame((s) => s.castCancel);
  // Opposition de la cible (multijet DANS cette modale) : chaque cible oppose son Test (FM/Int/Bagarre).
  const pcs = useGame((s) => s.pendingCastOpposition);
  const oppRoll = useGame((s) => s.oppositionRoll);
  const oppReroll = useGame((s) => s.oppositionReroll);
  const oppBonusSL = useGame((s) => s.oppositionBonusSL);
  const oppDarkPact = useGame((s) => s.oppositionDarkPact);
  const oppForce = useGame((s) => s.oppositionForceSuccess);
  const oppResist = useGame((s) => s.oppositionResist); // Résistance (Menace : Magie) — auto-succès du talent (LDB 10)
  const oppConfirm = useGame((s) => s.oppositionConfirm);
  // Contre-sort (Dissipation) : RÉACTION au Sort figé dans `pendingCast` — plus de modale
  // séparée (« le contre-sort, c'est le lancement d'un sort qui peut être opposé »). Chaque
  // contre-lanceur a SA rangée (`RollRow`), DANS cette modale d'incantation, exactement comme
  // l'opposition de cible ci-dessus. « Laisser passer »/« Appliquer » agrègent via `counterspellConfirm`.
  const csp = useGame((s) => s.pendingCounterspell);
  const cspRoll = useGame((s) => s.counterspellRoll);
  const cspReroll = useGame((s) => s.counterspellReroll);
  const cspBonusSL = useGame((s) => s.counterspellBonusSL);
  const cspDarkPact = useGame((s) => s.counterspellDarkPact);
  const cspForce = useGame((s) => s.counterspellForceSuccess);
  const cspDeclare = useGame((s) => s.counterspellDeclare);
  const cspConfirm = useGame((s) => s.counterspellConfirm);
  const cspCancel = useGame((s) => s.counterspellCancel);
  if (!pc) return null;
  const pool = battle?.combatants ?? party; // même modale en combat (file) et hors combat (groupe)
  const caster = pool.find((c) => c.id === pc.casterId);
  const target = pool.find((c) => c.id === pc.targetId);
  const spell = findSpellById(pc.spellId);
  if (!caster || !target || !spell) return null;
  const res = pc.result;
  const isPrayer = castInfoIsPrayer(spell); // la branche de résolution, pas un proxy sur `cn`
  const ni = spell.cn ?? 0;
  const selfTarget = caster.id === target.id;
  // Arme invoquée à forme libre (Arme aethyrique, op grantWeapon + chooseForm) : le lanceur choisit
  // la Compétence de Corps à corps / le profil d'arme avant d'appliquer (RAW LDB 47). Sinon : [].
  const conjureForms = spellEffectOps(spell.effects).some((o) => o.op === 'grantWeapon' && o.chooseForm)
    ? conjureFormOptions(caster) : [];
  const selectedForm = pc.conjureForm ?? conjureForms[0];
  // ZONE non posée (flux « jet puis pose », LDB 47 l.15/28) : pas de cible — le gabarit se dépose
  // APRÈS le jet et la Surincantation. « Puissance totale » (crit) repêche un DR insuffisant.
  const zoneUnplaced = !!pc.zone && !pc.zone.center;
  const placeable = zoneUnplaced && !!res && !res.dispelled && castAfterCrit(res, pc.critChoice, !!pc.missile);
  // #990 — CALENDRIER de découverte de l'incantation FIGÉE (arbitrage user 2026-07-30) : tant que le
  // répondant de CE siège (opposition de cible OU Contre-sort) n'a pas lancé, la rangée du lanceur ET
  // le verdict qui la trahit (« Sort lancé ! », « DR n < NI n ») restent masqués. Formule UNIQUE.
  const responders = [...(pcs?.participants ?? []), ...(csp?.participants ?? [])];
  const responded = opposedResponded(useGame.getState(), responders);
  const castRevealed = opposedRevealed(useGame.getState(), pc.casterId, responded);
  // #1004 — une résolution que l'opposition ANNULE ne s'énonce pas comme appliquée : tant qu'un
  // répondant reste à jouer, et définitivement dès qu'il l'emporte (Contre-sort qui DISSIPE, cible qui
  // RÉSISTE), la ligne de résolution du lanceur (« … 11 dégâts − 3 (BE+PA) = 8 Blessures », « Sort
  // lancé ! ») se tait. Les DEUX oppositions comptent (`pendingCounterspell` ET `pendingCastOpposition`) :
  // une seule gatée laisserait le même faux verdict passer par l'autre. Portée = un Sort RÉELLEMENT
  // lancé (`res.cast`) : l'ÉCHEC du lanceur est son propre verdict, que l'opposition ne change pas
  // (le taire cacherait une information vraie). Le verdict de l'opposition vit là où il est produit :
  // la rangée du répondant (« Dissipé ! » / « Résiste ! ») et l'action (« Appliquer (dissipé) »).
  //
  // GRAIN : la Dissipation tue le Sort ENTIER (n'importe quel contre-lanceur suffit), mais une
  // Résistance n'annule le Sort que POUR SA CIBLE — or cette ligne est mono-cible (`res.log` et
  // l'événement porté par `journal` ci-dessous ne parlent que de `pc.targetId`, la résolution
  // PRIMAIRE). Le gate d'opposition lit donc le répondant DE CETTE cible : sur 2 cibles, celle qui
  // résiste ne fait pas taire le verdict VRAI de l'autre.
  const primaryOpposer = pcs?.participants.find((part) => part.id === pc.targetId);
  const annulled = !!res?.cast && (
    (!!csp && csp.participants.some((part) => !part.result || part.result.dispelled))
    || (!!primaryOpposer && (!primaryOpposer.result || primaryOpposer.result.resisted)));
  // Issue COURTE (1 ligne) — le panneau dit déjà qui lance quoi sur qui. `res.log` (Projectile magique
  // touché) reste TEL QUEL — ligne de journal du MOTEUR, hors composeur (docs/plans/…jets.md § HORS).
  const outcome = !res || !castRevealed || annulled
    ? ''
    : res.cast
      ? pc.missile && res.hit
        ? res.log
        : resultLine(freeCons([`Sort lancé !${res.isCritical ? ' (Critique)' : ''}`]))
      : resultLine(freeCons([
          res.isFumble
            ? 'Maladresse — Incantation Imparfaite / Colère des dieux'
            : res.roll <= res.target
              ? `Réussite trop faible : DR ${res.sl} < NI ${ni}`
              : 'Incantation échouée',
        ]));

  // Rangée MONO d'incantation = le jet du lanceur, porteur de son cycle d'influence (Lancer → Chance/
  // +1 DR/Pacte/Résilience → Appliquer). Pré-jet : ligne en attente (base+mods=cible, dé/DR vides) via
  // `testPending`, dérivée du même `previewCast` que le panneau (parité Attaque/Défense). Post-jet :
  // `testBreakdown` (base = cible du Test, aucun mod post-hoc — parité avec l'ancien littéral inline).
  // Vents Tourbillonnants (LDB 46 l.179-190) : le mod n'entre dans l'APERÇU pré-jet que RÉVÉLÉ
  // (Seconde vue) — sinon on subit les Vents sans les avoir repérés, révélés au breakdown POST-jet.
  const winds = battle?.windsOfMagic ?? null;
  // CONTEXTE du jet dans l'aperçu (#1064) : le pré-jet annonce la cible RÉELLE — protection de la
  // victime (LDB 42), attribut et environnement de Domaine y sont des chips nommés, plus un écart
  // muet entre la cible annoncée et celle que `castRoll` applique. Zone non posée = pas de cible.
  const castCtx = { s: useGame.getState(), target, skipWard: !!pc.zone && !pc.zone.center };
  const preview = previewCast(caster, spell, { missile: pc.missile, focused: pc.focused, winds: winds?.revealed ? winds : null, ctx: castCtx });
  // POST-jet : les Vents sont révélés par le jet lui-même (LDB 46 l.179-190) — même aperçu, winds inclus.
  const previewRolled = previewCast(caster, spell, { missile: pc.missile, focused: pc.focused, winds, ctx: castCtx });
  const castLabel = isPrayer ? 'Prière' : `Incantation / NI ${ni}`; // le jet reste Langue (Magick) ; un Projectile magique ne change que Localisation/Dégâts post-réussite
  // Rangée du lanceur : son cycle d'influence (Lancer/Chance/+1 DR/Pacte/Résilience, sélecteur de dé)
  // appartient au siège qui PILOTE le lanceur — `influencesLocally` (#1005) ; un lanceur ENNEMI (IA, ou
  // MJ d'un AUTRE siège) rend donc une rangée TÉMOIN : portrait, jet et verdict restent lisibles, aucune
  // affordance n'est offerte. Elle passe ENSUITE par le calendrier #990 — `maskOpposedRow` MASQUE sa
  // ligne, et le cycle d'influence, DÉRIVÉ de cette ligne, s'éteint avec elle.
  const castRow: BuiltRollRow = maskOpposedRow(useGame.getState(), { ownerId: pc.casterId, responded }, buildRollRow({
    actor: caster,
    // Le ✓/✗ de la LIGNE est le verdict du TEST (`LDB 46 l.23-25` : « Succès mais DR < NI → tentative
    // échoue » — la tentative échoue, le Test est RÉUSSI). Le « sort non lancé » se dit par le verdict
    // du flux (issue/journal), jamais par le succès de la ligne : c'est aussi l'issue canonique du
    // seam (`cleanRollOutcome`, roll ≤ cible), dont dérivent Chance et Résilience.
    row: res
      ? { combatant: caster, d: testBreakdown(castLabel, previewRolled.base, { roll: res.roll, target: res.target, sl: res.sl, success: res.roll <= res.target }, undefined, previewRolled.mods) }
      : { combatant: caster, pending: testPending(castLabel, preview.base, preview.target, undefined, preview.mods) },
    onRoll: roll,
    rerolled: !!pc.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    // Un sort résolu SANS jet (`roll` nul : incantation automatique) n'offre pas le Pacte — il n'y a
    // pas de Test à relancer. L'OFFRE se dit par l'absence du handler.
    ...(res != null && res.roll > 0 ? { onDarkPact: darkPact } : {}),
    onForce: forceSuccess,
  }, {
    interactive: influencesLocally(useGame.getState(), pc.casterId),
    fortune: caster.fortune ?? 0,
    resilience: caster.resilience ?? 0,
    // Résilience PRÉ-JET : même geste en deux temps que le dé fixé pré-armé — rendu ATOMIQUE (#1029),
    // sinon le routage du Contre-sort déciderait sur le jet naturel, avant la réussite forcée.
    preRollForce: () => withPreRollFixedDie(useGame.getState, useGame.setState, roll, forceSuccess),
  }));

  const issue = res && castRevealed && outcome
    ? [recapLineOfEvent(ev(res.isCritical ? 'crit' : 'cast', outcome, caster.id, selfTarget ? undefined : target.id), pool)]
    : undefined;

  // Rangée d'opposition interactive encore à lancer : `oppositionConfirm` REFUSE d'agréger (la cible
  // subirait sans avoir opposé) — l'action le DIT au lieu de rester cliquable pour rien.
  const oppPending = !!pcs && pcs.participants.some((part) => part.interactive && !part.result);
  // Incantation CRITIQUE d'un Sort : l'effet retenu est un CHOIX du lanceur (LDB 46 l.28-32) — tant
  // qu'il n'est pas ÉCRIT, « Appliquer » reste gris (la même garde tient dans `castConfirm`), car de
  // ce choix dépend la dissipabilité. Une Prière n'a pas cette table de choix.
  const critChoicePending = !!res?.isCritical && !isPrayer && !pc.critChoice && influencesLocally(useGame.getState(), pc.casterId);
  const actions: RollAction[] = [
    // Renoncer (héros lanceur) : pré-jet uniquement. « Laisser passer » (Contre-sort) vit APRÈS le jet
    // d'incantation — la fenêtre naît du jet : sans cette action, décliner la Dissipation serait
    // inatteignable (Échap est neutralisé une fois lancé). Il décline la fenêtre ENTIÈRE : dès qu'une
    // rangée a chanté, le choix n'existe plus (l'issue s'applique par « Appliquer », qui agrège).
    ...(csp
      ? counterspellChanted(csp)
        ? []
        : [{ key: 'cancel', label: 'Laisser passer', onClick: cspCancel, when: 'post' } as RollAction]
      : caster.kind !== 'enemy'
        ? [{ key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' } as RollAction]
        : []),
    {
      key: 'confirm',
      // Le libellé « (dissipé) » EST le verdict de la comparaison au jet masqué : même calendrier que l'issue (#990).
      label: csp ? (castRevealed && csp.participants.some((p) => p.result?.dispelled) ? 'Appliquer (dissipé)' : 'Appliquer') : placeable ? <><Icon id="map-tool/pin" size="sm" /> Poser la zone</> : 'Appliquer',
      title: oppPending
        ? 'Une cible n’a pas encore opposé son Test'
        : critChoicePending ? 'Choisis l’effet de ton Incantation Critique'
          : placeable && !csp ? "La modale s'efface — clique une case du champ de bataille pour déposer la zone" : undefined,
      onClick: csp ? cspConfirm : pcs ? oppConfirm : placeable ? () => placeZone(true) : confirm,
      when: 'post',
      ...(oppPending || critChoicePending ? { disabled: true } : {}),
    },
  ];

  return (
    <RollShell
      flowKey="cast"
      title={isPrayer ? 'Prière' : 'Incantation'}
      extra={
        <>
          <VsHeader
            actor={caster}
            target={selfTarget || zoneUnplaced ? undefined : target}
            label={
              // La PORTÉE du sort (gabarit de Zone d'Effet, cible = le lanceur) n'est pas une
              // opposition A→B : la bande la porte comme qualificatif, à côté du seul portrait
              // du lanceur — une seule bande d'en-tête par fenêtre (#1078 LOT B2).
              pc.zone ? (
                <>
                  <strong>Zone d'Effet</strong> — gabarit {pc.zone.radius * 2 + 1}×{pc.zone.radius * 2 + 1} cases
                  {zoneUnplaced ? ' · la zone se pose après le jet' : ''}
                </>
              ) : selfTarget ? (
                <>
                  <strong>{spell.label}</strong>
                  {!isPrayer ? ` · NI ${ni}` : ''} — sur soi
                </>
              ) : (
                <>
                  {spell.label}
                  {!isPrayer ? ` · NI ${ni}` : ''}
                </>
              )
            }
            verb="action/cast"
          />
        </>
      }
      rows={[castRow]}
      rolled={!!res}
      outcome={issue}
      setup={
        <>
          {/* « Prêchez, ma sœur ! » (LDB 40 l.40-42) : entonner la Prière à voix haute (Intermédiaire)
              ou discrètement (murmurée → un cran plus dure). Seulement Prière + option active + avant le jet. */}
          {isPrayer && !res && rule('prayer-conviction') && (
            <OptionChooser
              layout="seg"
              groupLabel={<><Icon id="faith/prayer" size="sm" /> Ton de la Prière</>}
              options={[
                { key: 'aloud', label: 'À voix haute', selected: !pc.discreet, onSelect: () => setDiscreet(false), title: 'Prière entonnée fermement (Intermédiaire +0, RAW)' },
                { key: 'discreet', label: 'Discrètement', selected: !!pc.discreet, onSelect: () => setDiscreet(true), title: 'Prière murmurée / sans conviction : Difficulté d’un cran plus dure' },
              ]}
            />
          )}
          {conjureForms.length > 0 && (
            <div className="rm-options">
              {/* Arme invoquée à forme libre (LDB 47) : le lanceur choisit sa Compétence de Corps à corps. */}
              <span className="mini-title"><Icon id="item/weapon" size="sm" /> Forme de l'arme invoquée</span>
              <div className="rm-loc-grid">
                {conjureForms.map((f) => (
                  <button
                    key={`${f.group}:${f.weapon}`}
                    className={`btn small ${selectedForm?.weapon === f.weapon ? 'btn-primary' : ''}`}
                    title={`Corps à corps (${f.group}) — l'arme prend la forme : ${f.weapon}`}
                    onClick={() => setConjureForm(f)}
                  >
                    {f.weapon} · {f.group}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      }
      postRollExtra={res && (
        <>
          {/* Surincantation : un STEPPER +/− par axe (Portée/ZdE/Durée/Cible), borné au budget (coût
              par pas = overcastStepCost, source-aware ; DR − NI pour un Sort, DR entier pour Prière).
              L'effet d'un pas est SOURCE-AWARE (engine/overcast) : ×initial (Sort/Miracle) vs +6 m/+1/+6 R
              FIXE (Bénédiction), ZdE réservée à l'arcane. La désignation des cibles supplémentaires est
              SÉPARÉE de l'allocation (en combat : sur la carte). */}
          {(() => {
            if (!castAfterCrit(res, pc.critChoice, !!pc.missile) || caster.kind !== 'hero' || (pc.zone && !zoneUnplaced)) return null;
            const source = overcastSourceOf(spell);
            const stepCost = overcastStepCost(source);
            const budget = overcastBudget(source, overcastSL(res, pc.critChoice, !!pc.missile), isPrayer || pc.focused ? 0 : ni);
            if (budget <= 0) return null;
            const oc = pc.overcast ?? { range: 0, zone: 0, duration: 0, targets: 0, damage: 0 };
            const left = budget - oc.range - oc.zone - oc.duration - oc.targets - oc.damage;
            // Axes = ceux de la SOURCE (ZdE arcane seulement) ∩ ceux que CE sort porte (RAW : « Vous »/
            // « Contact »/« Spécial »/Instantané non extensibles ; une Bénédiction étend même le Contact).
            const can: Record<OvercastAxis, boolean> = {
              range: spell.range?.kind === 'distance' || (spell.range?.kind === 'touch' && source === 'blessing'),
              zone: zoneUnplaced,
              duration: spell.duration?.kind === 'rounds',
              targets: !pc.zone && spell.target?.kind === 'count' && spell.range?.kind !== 'self',
              damage: !!pc.missile,
            };
            const rows = overcastAxes(source, !!pc.missile).filter((a) => can[a]);
            if (!rows.length) return null;
            const META: Record<OvercastAxis, [ReactNode, string]> = {
              range: [<Icon id="magic/range" size="sm" />, 'Portée'], zone: [<Icon id="magic/area" size="sm" />, 'Zone'], duration: [<Icon id="ui/wait" size="sm" />, 'Durée'], targets: [<Icon id="action/aim" size="sm" />, 'Cibles'], damage: [<Icon id="journal/damage" size="sm" />, 'Dégâts'],
            };
            const cap = extraTargetCapacity(source, oc.targets, spellTargetCount(spell, caster));
            const dmgBonus = missileOvercastDamageBonus(source, oc.damage);
            const designated = pc.extraTargetIds?.length ?? 0;
            const candidates = overcastTargetCandidates(pool, caster, pc.targetId, spell, !!pc.missile, source, oc.range);
            return (
              <div className="rm-options">
                <span className="mini-title"><Icon id="magic/gust" size="sm" /> Surincantation — {left} pas (+{stepCost} DR) restant{plural(left)}</span>
                <Stack gap="sm">
                  {rows.map((a) => (
                    <Row key={a} gap="md" align="center">
                      <span {...grow}>
                        {META[a][0]} {META[a][1]}
                        {a === 'zone' && pc.zone ? ` ${pc.zone.radius * 2 + 1}×${pc.zone.radius * 2 + 1}` : ''}
                        {a === 'targets' && cap > 0 ? ` +${cap}` : ''}
                        {a === 'damage' && dmgBonus > 0 ? ` +${dmgBonus}` : ''}
                      </span>
                      <QtyStepper
                        center={<strong>{oc[a]}</strong>}
                        onDec={() => allocOvercast(a, -1)}
                        onInc={() => allocOvercast(a, 1)}
                        decLabel={`Rendre un pas de ${META[a][1]}`}
                        incLabel={`Allouer un pas de ${META[a][1]} (+${stepCost} DR)`}
                        refus={{
                          id: `overcast-${a}`,
                          dec: oc[a] > 0 ? undefined : `Aucun pas de ${META[a][1]} à rendre.`,
                          inc: left > 0 ? undefined : 'Plus aucun DR excédentaire à allouer.',
                        }}
                      />
                    </Row>
                  ))}
                </Stack>
                {/* Désignation des cibles supplémentaires — SÉPARÉE de l'allocation (sans bouton carte redondant). */}
                {can.targets && cap > 0 && (battle ? (
                  // La rangée ceint le bouton à son contenu : dans la pile des réglages, un bouton seul
                  // s'étirerait sur toute la largeur.
                  <Row>
                    <button className="btn small" onClick={() => pickTargets(true)} title="Choisir les cibles supplémentaires sur le champ de bataille">
                      <Icon id="nav/campaign" size="sm" /> Désigner les cibles ({designated}/{cap})
                    </button>
                  </Row>
                ) : (
                  <div className="rm-loc-grid">
                    {candidates.map((m) => (
                      <CharFrame key={m.id} c={m} variant="vital" size="sm" selected={(pc.extraTargetIds ?? []).includes(m.id)} onClick={() => toggleExtraTarget(m.id)} />
                    ))}
                  </div>
                ))}
                {/* Jet sur Tableau DÉCLINABLE (EDOC 13 l.276 : « vous pouvez à la fois prolonger la durée
                    et refaire un jet ») : la durée se prolonge intégralement quel que soit ce choix,
                    borné [0, pas Durée alloués]. Défaut = tous les pas (paquet complet, zéro-clic). */}
                {oc.duration > 0 && spellHasOvercastTableRoll(spellEffectOps(spell.effects)) && (
                  <Row gap="md" align="center">
                    <span {...grow}><Icon id="nav/dice" size="sm" /> Jets sur le Tableau</span>
                    <QtyStepper
                      center={<strong>{pc.chosenTableRolls ?? oc.duration}</strong>}
                      onDec={() => setChosenTableRolls((pc.chosenTableRolls ?? oc.duration) - 1)}
                      onInc={() => setChosenTableRolls((pc.chosenTableRolls ?? oc.duration) + 1)}
                      decLabel="Décliner un jet sur le Tableau"
                      incLabel="Refaire un jet sur le Tableau"
                      refus={{
                        id: 'overcast-table',
                        dec: (pc.chosenTableRolls ?? oc.duration) > 0 ? undefined : 'Aucun jet sur le Tableau à décliner.',
                        inc: (pc.chosenTableRolls ?? oc.duration) < oc.duration ? undefined : 'Tous les pas de Durée alloués font déjà l’objet d’un jet.',
                      }}
                    />
                  </Row>
                )}
              </div>
            );
          })()}
          {res.isCritical && !isPrayer && influencesLocally(useGame.getState(), pc.casterId) && (
            <div className="rm-options">
              {/* Incantation CRITIQUE (LDB 46 l.26-32) : puissance supplémentaire au choix
                  (le contrecoup — Imparfaite Mineure sauf Diction instinctive — est automatique). */}
              <span className="mini-title"><Icon id="magic/power" size="sm" /> Incantation Critique — choisir l'effet</span>
              <div className="rm-loc-grid">
                {([
                  ...(pc.missile ? [['critique', <><Icon id="journal/critical" size="sm" /> Blessure Critique</>, 'Si le Sort inflige des Dégâts, il inflige aussi une Blessure Critique.']] : []),
                  ['puissance', <><Icon id="magic/area" size="sm" /> Puissance totale</>, 'Le Sort est lancé quels que soient son NI et votre DR, mais il peut être Dissipé.'],
                  ['ineluctable', <><Icon id="action/defend" size="sm" /> Force inéluctable</>, 'Si vous avez assez de DR pour lancer le Sort, il ne peut pas être Dissipé.'],
                ] as [('critique' | 'puissance' | 'ineluctable'), ReactNode, string][]).map(([val, label, tip]) => {
                  // Aucune PRÉSÉLECTION : un bouton allumé sans choix écrit ferait croire l'effet
                  // acquis alors que rien n'est enregistré (LDB 46 l.28 : sans choix, c'est la table
                  // des Imparfaites Mineures qui s'applique, pas un des trois effets).
                  const selected = pc.critChoice === val;
                  return (
                    <button key={val} className={`btn small ${selected ? 'btn-primary' : ''}`} title={tip} onClick={() => setCritChoice(val)}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* OPPOSITION de la cible (Fauche-démon → FM, Parole de Tzeentch → Int) : rangées DANS la
              modale d'incantation (cible IA = témoin auto-roulée, cible héros = interactive). */}
          {pcs && (
            <div className="cs-rows">
              <span className="mini-title"><Icon id="action/defend" size="sm" /> Opposition — la cible oppose son {pcs.kind === 'contact' ? 'Corps à corps (Bagarre)' : (pcs.char ?? pcs.skill)}</span>
              {pcs.participants.map((part) => {
                const actor = pool.find((c) => c.id === part.id);
                if (!actor) return null;
                const r = part.result;
                const lab = pcs.char ?? pcs.skill ?? 'Opposition';
                // Test OPPOSÉ : la cible oppose son Test à Difficulté Intermédiaire — ce que roule le
                // résolveur `castOpposition` (LDB 12 l.166).
                const [oppLine] = opposedLines([{ label: lab, base: testValue(actor, pcs.skill, pcs.char), r: r?.oppose }]);
                const row = r
                  ? { combatant: actor, d: oppLine.d }
                  : { combatant: actor, pending: oppLine.pending };
                /* #990 : l'issue d'une rangée COMPARE le jet du répondant à l'incantation masquée — elle
                   suit donc le calendrier du SPECTATEUR (`castRevealed`), pas celui du propriétaire de la
                   rangée : sinon « Résiste ! » livre le verdict que le dé masqué cachait. Conséquence
                   assumée (arbitrage #990) : chacun joue à l'aveugle et lit son propre verdict à la fin. */
                const oppNote = r && castRevealed
                  ? <div className={`cs-outcome ${r.resisted ? 'ok-text' : 'muted'}`}>{r.resisted ? <><Icon id="ui/done" size="sm" /> Résiste !</> : `subit · marge DR ${r.margin}`}</div>
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
                    rollLabel={<><Icon id="action/defend" size="sm" /> Résister</>}
                    onRoll={() => oppRoll(part.id)}
                    rerolled={!!part.rerolled}
                    /* La cible ne RÉSISTE pas : issue défavorable même sur un Test propre réussi
                       (opposition perdue) — la Résilience y reste offerte (LDB 17 l.68). */
                    lost={!!r && !r.resisted}
                    onReroll={() => oppReroll(part.id)}
                    onBonusSL={() => oppBonusSL(part.id)}
                    onDarkPact={() => oppDarkPact(part.id)}
                    onForce={() => oppForce(part.id)}
                    /* Résistance (Menace : Magie), LDB 10 l.1020 : auto-succès du Test qui résiste au
                       Sort, à DR = Bonus d'Endurance. MÊME fenêtre que le verbe `resist` de la fabrique
                       (`resistanceImproves`) : une opposition GAGNÉE à DR inférieur laisse une marge que
                       le talent réduit encore — c'est le « DR requis important » du texte. */
                    resist={pcs.menace != null && availableResistance(actor, pcs.menace) != null
                      && resistanceImproves(actor, r ? { won: r.resisted, sl: r.oppose.sl } : null)
                      ? { menace: pcs.menace, onResist: () => oppResist(part.id) } : undefined}
                  />
                );
              })}
            </div>
          )}
          {/* CONTRE-SORT (Dissipation, LDB 46 l.156) : le Sort est figé (révélé ci-dessus), les
              contre-lanceurs éligibles ont chacun leur rangée DANS cette même modale d'incantation
              (plus de modale séparée : un contre-sort EST un lancement de sort opposé).
              PLUSIEURS peuvent chanter contre la même incantation (#1040, cf. `counterspellConfirm`,
              src/state/combatSlice.ts) ; la COMPOSITION (contrer seul / s'unir / s'abstenir) se fige
              au premier jet de la fenêtre (#1059) — au-delà, seules les rangées déclarées agissent.
              COOP : chaque rangée est pilotée par le siège qui POSSÈDE son porteur — héros du siège,
              ennemi du MJ (#1028) ; les autres la lisent. */}
          {csp && (
            <div className="cs-rows">
              <span className="mini-title"><Icon id="action/defend" size="sm" /> Contre-sort — chaque contre-lanceur oppose son Langue (Magick)</span>
              {csp.participants.map((part) => {
                const actor = pool.find((c) => c.id === part.id);
                if (!actor) return null;
                const r = part.result;
                const val = castingValue(actor, 'langue', 'magick');
                // Test SOUTENU (LDB 46 l.162) : le groupe uni n'a QU'UN jet, celui du meneur DÉRIVÉ ;
                // son Soutien s'affiche comme tout autre modificateur (`soutienMod`, source unique).
                const st = useGame.getState();
                const grp = counterspellSoutenu(st, csp);
                const mods = soutienMod(counterspellSupportFor(st, csp, part.id));
                const phase1 = counterspellDeclarePhase(csp);
                const lance = counterspellRolls(st, csp, part);
                // Contre-sort OPPOSÉ à l'incantation : Difficulté Intermédiaire — ce que roule
                // `resolveCounterspell` (LDB 12 l.166 ; LDB 46 l.156).
                const [counterLine] = opposedLines([{ label: 'Langue (Magick)', base: val, r: r?.counter, mods: mods ? [mods] : undefined }]);
                const row = r
                  ? { combatant: actor, d: counterLine.d }
                  : { combatant: actor, pending: counterLine.pending };
                const owned = influencesLocally(st, part.id) && !!part.interactive;
                // Seule une rangée qui LANCE (solo, ou meneur du groupe) reçoit le jet : ni bouton, ni
                // dé à fixer, ni Résilience pré-jet pour un soutien ou une rangée qui passe.
                const onRoll = lance ? () => cspRoll(part.id) : null;
                const die = rowForcedDie(st, 'counterspell', { actor, rolled: !!r, interactive: owned, key: part.id, onRoll }, !!r);
                // La rangée AFFICHE sa situation : en PHASE 1, une rangée d'un AUTRE siège encore
                // vierge dit qu'on l'attend (la fenêtre entière est suspendue à elle — l'attente ne
                // reste jamais muette) ; en PHASE 2, chacune porte sa déclaration, un « passe » étant
                // éteint mais motivé, jamais un vide inexpliqué.
                const situation = !part.declared
                  ? (!owned ? `en attente de la déclaration de ${actor.label}` : undefined)
                  : part.declared === 'pass'
                    ? 'passe — ne tente pas la Dissipation ce Round'
                    : part.declared === 'soutenu' && grp
                      ? (lance ? `mène le Test Soutenu (+${grp.bonus})` : `soutient ${grp.leader.label} (+10)`)
                      : undefined;
                // AFFORDANCE = GARDE : les deux refus SILENCIEUX de `counterspellEngage` (phase de
                // déclaration ouverte ; une AUTRE rangée a déjà dissipé) éteignent le CTA avec leur
                // raison, lus par les MÊMES prédicats — jamais une seconde condition recopiée.
                const dejaDissipee = csp.participants.find((p) => p.id !== part.id && p.result?.dispelled);
                const dissipateur = dejaDissipee && pool.find((c) => c.id === dejaDissipee.id);
                if (dejaDissipee && !dissipateur) throw new Error(`[contre-sort] le participant « ${dejaDissipee.id} » a dissipé hors des combattants de la fenêtre`);
                const rollBlocked = phase1
                  ? 'En attente des déclarations de la fenêtre'
                  : dissipateur
                    ? `Déjà dissipé par ${dissipateur.label}`
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
                    {cspOutcome && <div className={`cs-outcome ${cspOutcome.dispelled ? 'ok-text' : 'muted'}`}>{cspOutcome.dispelled ? <><Icon id="ui/done" size="sm" /> Dissipé !</> : `DR net ${cspOutcome.casterNetSL >= 0 ? '+' : ''}${cspOutcome.casterNetSL}`}</div>}
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
                    interactive={owned && part.declared !== 'pass'}
                    rollLabel={<><Icon id="action/defend" size="sm" /> Contre-sort</>}
                    onRoll={onRoll ?? undefined}
                    rollBlocked={rollBlocked}
                    /* PHASE 1 : chaque rangée possédée déclare (contrer seul / s'unir / passer) ; s'unir
                       n'est offert qu'avec un partenaire de même Domaine. La dernière déclaration FIGE
                       la composition — le contrôle disparaît alors. */
                    declare={owned && phase1
                      ? {
                        value: part.declared,
                        onChoose: (k) => cspDeclare(part.id, k as CounterDeclaration),
                        options: [
                          { key: 'solo', label: 'Contrer seul' },
                          // La raison du refus se lit au survol/focus/tap, jamais par un segment muet.
                          { key: 'soutenu', label: 'S’unir', refus: counterspellJoinable(st, csp, part.id) ? undefined : 'Exige un autre dissipateur du même Domaine' },
                          { key: 'pass', label: 'Passer' },
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
                    onForce={lance ? () => cspForce(part.id) : undefined}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
      actions={actions}
      /* Échap = Annuler : RollShell le neutralise dès qu'un jet est lancé (`!rolled ? onCancel`). */
      onCancel={csp ? cspCancel : caster.kind !== 'enemy' ? cancel : undefined}
    />
  );
}
