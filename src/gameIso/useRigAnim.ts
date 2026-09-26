import { useEffect, useRef } from 'react';
import { bus, EVT } from '../state/bus';
import { useGame } from '../state/store';
import { useRigClip } from './rig/anim/useRigClip';
import { weaponRest, hasShieldEquipped } from './rig/anim/weaponClips';
import { rigAttackDef, rigDefenseDef, rigHitDef, rigWalkDef, type RigSelectCtx } from './rig/anim/actorAnimSelect';
import { isShield, type EquipCtx } from './rig/parts/equipment';
import { project, type View } from './rig/facing';
import type { Dir8 } from '../state/dir8';
import type { Clip } from './rig/anim/clips';
import type { Pose } from './rig/poses';
import { walkMs } from '../geometry/walk';

/**
 * Pilote l'ANIMATION d'un rig bipède (clips de repos/marche/attaque/parade/esquive/touché via
 * le bus, projeté en vue 8-dir selon la caméra) et renvoie les éléments à donner à resolveRig :
 * `pose` (clip courant), `holdPose` (prise d'arme toujours active), `view`+`mirror`. Consommé par
 * `RigToken` (lui-même monté par `AnimatedRigToken` et par `tokenBodyKind`) : le câblage bus vit ici,
 * le token ne fait que dessiner. Le CHOIX du geste est pur (`rig/anim/actorAnimSelect`).
 */
export function useRigAnim({ id, equip, restClip, facing, pos, seated }: {
  id: string;
  equip: EquipCtx;
  restClip?: Clip;
  facing?: Dir8;
  /** Tuile de l'acteur (CULLING viewport : les rigs hors-champ ne paient plus leur rAF). */
  pos?: { x: number; y: number };
  /** EN SELLE : clips montés (lance couchée, taille à cheval) ; tout geste est ASSIS (jamais de delta
   *  bassin/jambes — ancré à la selle) et la marche est celle de la monture. Variante portée par la
   *  sélection pure (`rigAttackDef`/`rigDefenseDef`/`rigWalkDef`, contrat testé) ; à ce jour aucun
   *  appelant de production ne la passe — seul `RigToken` appelle ce hook, à pied. */
  seated?: boolean;
}): { pose: Pose; holdPose: Pose; view: View; mirror: boolean } {
  const { pose, play, playClip, holdClip } = useRigClip(restClip, pos);
  const camRot = useGame((s) => s.camRot);
  const worldDir = useGame((s) => s.facing?.[id]) ?? facing;
  const mainWeapon = equip.weapons?.find((w) => !isShield(w)) ?? equip.weapons?.[0];
  const shield = hasShieldEquipped(equip.weapons, equip.shield);
  const holdPose = weaponRest(mainWeapon);
  // Contexte injecté aux sélecteurs PURS (`rig/anim/actorAnimSelect`) : rafraîchi à chaque rendu,
  // lu par les abonnements bus sans les re-souscrire.
  const sel = useRef<RigSelectCtx>({ seated, mainWeapon, shield });
  sel.current = { seated, mainWeapon, shield };
  const walkTimer = useRef(0);
  const restRef = useRef(restClip);
  restRef.current = restClip;

  useEffect(() => {
    const combatants = () => useGame.getState().battle?.combatants;
    const offAttack = bus.on(EVT.ANIM_ATTACK, (d: any) => {
      if (d.from === id) {
        const cs = d.kind === 'spell' ? combatants() : undefined;
        // L'IMPACT part du registre de pistes (`gameIso/fx/animTracks.ts`), sur son horloge propre :
        // ce hook joue seulement le geste. Contrat d'émission unique, garde `animTracks.test.ts`.
        // Geste de l'arme EMPLOYÉE (portée par l'événement) — pas de l'arme principale :
        // la 2e frappe de dague gauche et le tentacule jouent LEUR clip (miroité à gauche).
        const def = rigAttackDef(
          {
            kind: d.kind,
            weapon: d.weapon,
            casterKind: cs?.find((c) => c.id === d.from)?.kind,
            targetKind: cs?.find((c) => c.id === d.to)?.kind,
            isSelf: d.from === d.to,
          },
          sel.current,
        );
        playClip(def.clip);
      } else if (d.to === id && !d.result?.hit) {
        // Réaction défensive : parade de l'arme QUI A PARÉ (repli sur l'arme principale quand
        // l'événement ne la porte pas), sinon dérobade — et RIEN face à un soin/une bénédiction.
        const cs = d.kind === 'spell' ? combatants() : undefined;
        const def = rigDefenseDef(
          {
            kind: d.kind,
            defense: d.defense,
            parryWeapon: d.parryWeapon,
            casterKind: cs?.find((c) => c.id === d.from)?.kind,
            targetKind: cs?.find((c) => c.id === d.to)?.kind,
            isSelf: d.from === d.to,
          },
          sel.current,
        );
        if (def) playClip(def.clip);
      }
    });
    const offImpact = bus.on(EVT.ANIM_IMPACT, (d: any) => {
      if (d.to === id && d.result?.hit) playClip(rigHitDef(sel.current).clip);
    });
    const offMove = bus.on(EVT.ANIM_MOVE, (d: any) => {
      if (d.id !== id) return;
      const walk = rigWalkDef(sel.current);
      if (!walk) return;
      const p = d.path;
      playClip(walk.clip);
      window.clearTimeout(walkTimer.current);
      const dur = Math.max(1, walkMs(p ?? [])); // = (cases-1)×STEP_MS : la marche s'arrête à l'arrivée réelle (plus d'off-by-one)
      walkTimer.current = window.setTimeout(() => {
        if (restRef.current) holdClip(restRef.current);
        else play('idle');
      }, dur);
    });
    return () => {
      offAttack();
      offImpact();
      offMove();
      window.clearTimeout(walkTimer.current);
    };
  }, [id, play, playClip, holdClip]);

  const fv = worldDir ? project(worldDir, camRot) : { view: 'front' as View, mirror: false };
  return { pose, holdPose, view: fv.view, mirror: fv.mirror };
}
