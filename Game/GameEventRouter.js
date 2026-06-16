import { getItemDisplayName } from "./ItemInstanceFactory.js";

export class GameEventRouter {
  constructor(contextProvider) {
    this.contextProvider = contextProvider;
  }

  getContext() {
    return this.contextProvider?.() ?? {};
  }

  collectFrameEvents() {
    const { player, enemies = [], inventory, shopManager } = this.getContext();

    return [
      ...(player?.consumeEvents?.() ?? []),
      ...enemies.flatMap((enemy) => enemy?.consumeEvents?.() ?? []),
      ...(inventory?.consumeEvents?.() ?? []),
      ...(shopManager?.consumeEvents?.() ?? []),
    ];
  }

  route(events = []) {
    for (const event of events) {
      this.getContext().gameManager?.handleEvent?.(event);
      console.log("gameEvent", event.type);

      const context = this.getContext();
      this.routeEvent(event, context);
    }
  }

  routeEvent(event, context) {
    switch (event.type) {
      case "attackWindupStarted":
        break;

      case "attackWindupCanceled":
        break;

      case "attackReady":
        break;

      case "dashLocked":
        this.addLog(context, "Dash locked: equip an ability item first.");
        context.sfx?.play?.("playerDashBlocked");
        break;

      case "dashCooldownBlocked":
        this.addLog(context, `Dash cooling down: ${event.remaining.toFixed(1)}s.`);
        context.sfx?.play?.("playerDashBlocked");
        break;

      case "dashBlocked":
        this.addLog(context, "Dash blocked.");
        context.sfx?.play?.("playerDashBlocked");
        break;

      case "dashStarted":
        this.addLog(context, "Dash used.");
        context.vfx?.playPlayerDashTrail?.(
          event.start,
          event.end,
          event.direction
        );
        context.vfx?.playPlayerDashBurst?.(event.start, event.direction, {
          scale: 0.8,
        });
        context.sfx?.play?.("playerDash");
        break;

      case "dashEnded":
        context.vfx?.playPlayerDashBurst?.(event.position, event.direction, {
          scale: 0.62,
        });
        break;

      case "dashReady":
        this.addLog(context, "Dash ready.");
        context.vfx?.playModelFlash?.(context.player?.model, 0x9edcff, 0.14, {
          emissiveIntensity: 1.1,
        });
        context.sfx?.play?.("playerDashReady");
        break;

      case "playerAttack":
        this.addLog(context, `Enemy takes ${event.damage} damage.`);
        break;

      case "playerAttackHit":
        context.vfx?.playPlayerAttackSlash?.(
          event.impactPoint,
          event.direction,
          {
            color: 0xfff1b0,
          }
        );
        context.sfx?.play?.("playerAttackHit");
        break;

      case "playerAttackWhiff":
        context.vfx?.playPlayerAttackSlash?.(
          event.impactPoint,
          event.direction,
          {
            color: 0xd7e6ff,
          }
        );
        context.sfx?.play?.("playerAttackWhiff");
        break;

      case "enemyAttack":
        this.addLog(context, `Enemy attacks: -${event.damage} HP.`);
        context.sfx?.play?.("enemyAttack");
        break;

      case "enemyDamaged":
        if (event.damage > 0) {
          const flashColor =
            event.source?.type === "poison" ? 0x9c61ff : 0xff4058;
          context.playEnemyDamageFlash?.(event.enemy, flashColor);
        }
        context.syncBossHud?.();
        break;

      case "playerDamaged":
        if (event.damage > 0) {
          context.vfx?.playModelFlash?.(context.player?.model, 0xff4058, 0.16);
          context.vfx?.playPlayerHitSlash?.(context.player);
          context.sfx?.play?.("playerDamaged");
        }
        context.updateHud?.();
        break;

      case "enemyCoinsDropped":
        context.coinManager?.addCoinDrops?.(event.coins);
        break;

      case "enemyItemsDropped":
        console.log("enemyItemsDropped", {
          count: event.items?.length ?? 0,
          itemIds: (event.items ?? []).map((item) => item.itemId),
        });
        context.itemDropManager?.addItemDrops?.(event.items ?? []);
        break;

      case "enemyDefeated":
        if (event.enemy?.isBoss) {
          context.setBossExitBlockedNotified?.(false);
          context.syncBossHud?.();
        } else {
          this.addLog(context, "Enemy defeated.");
        }
        context.sfx?.play?.("enemyDefeated");
        break;

      case "bossPhaseChanged":
        this.addLog(context, `${event.enemy.enemyName} enters ${event.phaseName}.`);
        context.flashModel?.(event.enemy.model, 0xff1f2f, 0.24);
        context.syncBossHud?.();
        break;

      case "enemyStunned":
        this.addLog(context, `Enemy stunned for ${event.duration.toFixed(1)}s.`);
        context.flashModel?.(event.enemy.model, 0x9c61ff, 0.22);
        break;

      case "enemyPoisoned":
        this.addLog(context, `Enemy poisoned for ${event.duration.toFixed(1)}s.`);
        break;

      case "itemPickedUp":
        this.addLog(context, `Item picked up: ${getItemDisplayName(event.item)}.`);
        context.updateHud?.();
        break;

      case "itemRemoved":
        this.addLog(context, `Item removed: ${getItemDisplayName(event.item)}.`);
        context.updateHud?.();
        break;

      case "passiveItemApplied":
        this.addLog(context, `Passive applied: ${getItemDisplayName(event.item)}.`);
        context.updateDebugCheatBaselinesForStatChange?.(event.result);
        context.syncDebugCheatEffects?.();
        this.highlightItemStat(context, event.result);
        context.updateHud?.();
        break;

      case "passiveItemRemoved":
        this.addLog(context, `Passive removed: ${getItemDisplayName(event.item)}.`);
        context.updateDebugCheatBaselinesForStatChange?.(event.result);
        context.syncDebugCheatEffects?.();
        this.highlightItemStat(context, event.result);
        context.updateHud?.();
        break;

      case "itemReplaced":
        this.addLog(
          context,
          `Equipped ${getItemDisplayName(event.item)}. Dropped ${getItemDisplayName(event.previousItem)}.`
        );
        context.updateDebugCheatBaselinesForStatChange?.(event.result);
        context.syncDebugCheatEffects?.();
        this.highlightItemStat(context, event.result);
        context.updateHud?.();
        break;

      case "itemUsed":
        this.addLog(context, `Item used: ${getItemDisplayName(event.item)}.`);
        this.playItemUseFeedback(context, event);
        this.highlightItemStat(context, event.result);
        context.updateHud?.();
        break;

      case "itemUseFailed":
        this.addLog(context, this.getItemUseFailedMessage(event));
        break;

      case "itemPickupBlocked":
        this.addLog(context, this.getItemPickupBlockedMessage(event));
        break;

      case "itemRemoveFailed":
        this.addLog(context, this.getItemRemoveFailedMessage(event));
        break;

      case "shopOfferCreated":
        this.addLog(
          context,
          `Shop offer: ${getItemDisplayName(event.item)} (${event.rarity}) - ${event.price} Gold.`
        );
        break;

      case "shopPurchaseSucceeded":
        this.addLog(
          context,
          `Bought ${getItemDisplayName(event.item)} for ${event.price} Gold.`
        );
        context.updateHud?.();
        break;

      case "shopPurchaseFailed":
        this.addLog(context, this.getShopPurchaseFailedMessage(event));
        break;

      case "shopOfferAlreadyPurchased":
        this.addLog(context, "Already purchased.");
        break;

      case "shopFountainUsed":
        this.addLog(context, `Fountain restored ${event.healAmount} HP.`);
        context.vfx?.playModelFlash?.(context.player?.model, 0x5fc7ff, 0.22, {
          emissiveIntensity: 1.1,
        });
        context.updateHud?.();
        break;

      case "shopFountainFailed":
        this.addLog(context, this.getShopFountainFailedMessage(event));
        break;

      case "playerDefeated":
        context.hud?.hideBoss?.();
        context.flashModel?.(context.player?.model, 0x7a1020, 0.6);
        context.updateHud?.();
        break;
    }
  }

  addLog(context, message) {
    context.addLog?.(message);
  }

  highlightItemStat(context, result) {
    if (!result?.stat) return;

    context.hud?.highlightStat?.(result.stat);
  }

  playItemUseFeedback(context, event) {
    if (event.itemId !== "purpleShroom") return;

    const target = event.result?.center ?? event.result?.enemy;
    if (!target) return;

    context.vfx?.playPurpleGasCloud?.(target, {
      radius: event.result?.vfxRadius ?? event.result?.radius,
      duration: event.result?.poisonDuration,
    });
    context.sfx?.play?.("purpleShroom");
  }

  getItemUseFailedMessage(event) {
    switch (event.reason) {
      case "fullHp":
        return "You do not need healing right now.";

      case "noEnemyInRange":
        return "No enemy is close enough for the shroom.";

      case "missingItem":
        return "You do not have that consumable.";

      default:
        return "Could not use that item.";
    }
  }

  getItemPickupBlockedMessage(event) {
    switch (event.reason) {
      case "inventoryFull":
        return `Inventory full: you cannot pick up ${getItemDisplayName(event.item)}.`;

      case "slotOccupied":
        return `Slot occupied: you already have a ${event.foodCategory ?? event.itemInstance?.foodCategory ?? "matching"} item equipped.`;

      case "invalidEquipmentCategory":
        return `Could not equip ${getItemDisplayName(event.item)}.`;

      default:
        return "Could not pick up that item.";
    }
  }

  getItemRemoveFailedMessage(event) {
    switch (event.reason) {
      case "missingItem":
        return `You do not have ${getItemDisplayName(event.item)}.`;

      default:
        return `Could not remove ${getItemDisplayName(event.item)}.`;
    }
  }

  getShopPurchaseFailedMessage(event) {
    switch (event.reason) {
      case "insufficientGold":
        return "Not enough Gold.";

      case "inventoryFull":
        return "Inventory full.";

      case "slotOccupied":
        return `Slot occupied: you already have a ${event.offer?.itemInstance?.foodCategory ?? "matching"} item equipped.`;

      case "offerMissing":
        return "That shop offer is no longer available.";

      case "shopUnavailable":
        return "The shop is not available right now.";

      default:
        return "Could not buy that shop offer.";
    }
  }

  getShopFountainFailedMessage(event) {
    switch (event.reason) {
      case "fullHp":
        return "You do not need healing right now.";

      case "depleted":
        return "The fountain is dry.";

      case "fountainMissing":
      case "shopUnavailable":
        return "The fountain is not available right now.";

      default:
        return "Could not use the fountain.";
    }
  }
}
