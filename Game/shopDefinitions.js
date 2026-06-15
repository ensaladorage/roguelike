import { ITEM_RARITIES } from "../CharacterData/itemDefinitions.js";
import { DEFAULT_SHOP_ALTAR_MODEL_ID } from "../CharacterData/modelDefinitions.js";

export const SHOP_EVENTS = Object.freeze({
  OFFER_CREATED: "shopOfferCreated",
  PURCHASE_SUCCEEDED: "shopPurchaseSucceeded",
  PURCHASE_FAILED: "shopPurchaseFailed",
  OFFER_ALREADY_PURCHASED: "shopOfferAlreadyPurchased",
  FOUNTAIN_USED: "shopFountainUsed",
  FOUNTAIN_FAILED: "shopFountainFailed",
});

export const SHOP_DEFINITION = Object.freeze({
  offerCount: 3,
  priceMultiplier: 1,
  rollQualityPriceSpread: 0.25,

  standVisual: Object.freeze({
    altarModelId: DEFAULT_SHOP_ALTAR_MODEL_ID,
    altarScale: 0.86,
    itemY: 0.92,
    labelY: 1.46,
  }),

  possibleItemIds: Object.freeze([
    "garlic",
    "ramen",
    "fish",
    "iceCream",
    "dragonSteak",
    "spicySauce",
    "dragonFruit",
  ]),

  fallbackPriceByRarity: Object.freeze({
    [ITEM_RARITIES.RARE]: 250,
    [ITEM_RARITIES.EPIC]: 500,
  }),

  itemPriceOverrides: Object.freeze({}),

  rarityWeights: Object.freeze({
    default: Object.freeze({
      [ITEM_RARITIES.RARE]: 70,
      [ITEM_RARITIES.EPIC]: 30,
    }),

    // Deprecated fallback: current finite-run shops receive tier data from RunPlan.
    byRunProgress: Object.freeze([
      Object.freeze({
        id: "early",
        minCompletedFloors: 0,
        maxCompletedFloors: 3,
        weights: Object.freeze({
          [ITEM_RARITIES.RARE]: 85,
          [ITEM_RARITIES.EPIC]: 15,
        }),
      }),
      Object.freeze({
        id: "mid",
        minCompletedFloors: 4,
        maxCompletedFloors: 7,
        weights: Object.freeze({
          [ITEM_RARITIES.RARE]: 70,
          [ITEM_RARITIES.EPIC]: 30,
        }),
      }),
      Object.freeze({
        id: "late",
        minCompletedFloors: 8,
        maxCompletedFloors: 9,
        weights: Object.freeze({
          [ITEM_RARITIES.RARE]: 55,
          [ITEM_RARITIES.EPIC]: 45,
        }),
      }),
      Object.freeze({
        // Deprecated endless/post-run fallback; finite runs currently end at stage 10.
        id: "shop_after_floor_10",
        minCompletedFloors: 10,
        minFloorIndex: 11,
        weights: Object.freeze({
          [ITEM_RARITIES.RARE]: 45,
          [ITEM_RARITIES.EPIC]: 55,
        }),
      }),
    ]),
  }),
});
