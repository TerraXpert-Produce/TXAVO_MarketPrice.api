import {
  BlendWeights,
  DemandForecast,
  DemandInputs,
  Observation,
  PriceReference
} from './models';

export const DEFAULT_WEIGHTS: BlendWeights = {
  observations: 0.5,
  exportPrice: 0.3,
  dpiPrice: 0.2
};

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function calculateIndex(rows: Observation[]) {
  if (rows.length === 0) throw new Error('At least one market observation is required');
  const adjusted = rows.map((row) => ({
    ...row,
    adjustedPrice: row.price * row.grade * row.freshness,
    effectiveVolume: row.volume * row.freshness
  }));
  const totalVolume = adjusted.reduce((sum, row) => sum + row.effectiveVolume, 0);
  if (totalVolume <= 0) throw new Error('Effective observation volume must be positive');
  const value = adjusted.reduce(
    (sum, row) => sum + row.adjustedPrice * row.effectiveVolume,
    0
  ) / totalVolume;
  return { value, totalVolume, adjusted };
}

export function calculateDemandForecast(
  basePrice: number,
  inputs: DemandInputs,
  trend: number[]
): DemandForecast {
  if (trend.length < 14) throw new Error('At least 14 trend values are required');
  const hasOrdersAndOffers = Number(inputs.buyerOrders) > 0 && Number(inputs.sellerOffers) > 0;
  const hasBidAndAsk = Number(inputs.buyerPrice) > 0 && Number(inputs.sellerPrice) > 0;
  const indicatedPrice = hasBidAndAsk
    ? (Number(inputs.buyerPrice) + Number(inputs.sellerPrice)) / 2
    : basePrice;
  const priceSpread = hasBidAndAsk
    ? Number(inputs.sellerPrice) - Number(inputs.buyerPrice)
    : null;
  const orderOfferRatio = hasOrdersAndOffers
    ? Number(inputs.buyerOrders) / Number(inputs.sellerOffers)
    : inputs.demandLevel / inputs.supplyLevel;
  const exportRatio = Number(inputs.exportActivity) > 0 ? Number(inputs.exportActivity) / 100 : 1;
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const momentumRatio = average(trend.slice(-7)) / average(trend.slice(-14, -7));
  const components = {
    marketBalance: clamp(orderOfferRatio, 0.5, 1.5),
    salesPace: clamp(inputs.salesPace, 0.5, 1.5),
    exportActivity: clamp(exportRatio, 0.5, 1.5),
    priceMomentum: clamp(momentumRatio, 0.5, 1.5)
  };
  const pressureIndex =
    0.45 * components.marketBalance +
    0.3 * components.salesPace +
    0.15 * components.exportActivity +
    0.1 * components.priceMomentum;
  const forecastPrice = indicatedPrice * (1 + (inputs.sensitivity / 100) * (pressureIndex - 1));
  const answeredSignals = [
    inputs.demandLevel !== 1,
    inputs.supplyLevel !== 1,
    inputs.salesPace !== 1,
    hasOrdersAndOffers,
    Number(inputs.exportActivity) > 0
  ].filter(Boolean).length;
  const participantBoost = Number(inputs.participants) > 0
    ? Math.min(Number(inputs.participants), 20)
    : 0;
  const confidence = Math.round(clamp(42 + answeredSignals * 7 + participantBoost, 42, 88));
  const signal = pressureIndex > 1.1
    ? 'Strong demand'
    : pressureIndex < 0.9
      ? 'Weak demand'
      : 'Balanced';
  return {
    pressureIndex,
    forecastPrice,
    indicatedPrice,
    priceSpread,
    confidence,
    signal,
    components,
    source: hasBidAndAsk ? 'Buyer/seller prices and DPI inputs' : 'Quick market pulse',
    answeredSignals
  };
}

export function calculateTerraXpertPrice(
  observationPrice: number,
  demand: DemandForecast,
  reference: PriceReference,
  configuredWeights: BlendWeights = DEFAULT_WEIGHTS
) {
  const exportPrice = Number(reference.usdPerKg) || reference.usd / (reference.cartonWeightKg || 11.3);
  const weightTotal =
    configuredWeights.observations + configuredWeights.exportPrice + configuredWeights.dpiPrice;
  if (weightTotal <= 0) throw new Error('Blend weight total must be positive');
  const weights = Object.fromEntries(
    Object.entries(configuredWeights).map(([key, value]) => [key, value / weightTotal])
  ) as unknown as BlendWeights;
  return {
    value:
      observationPrice * weights.observations +
      exportPrice * weights.exportPrice +
      demand.forecastPrice * weights.dpiPrice,
    exportPrice,
    observationPrice,
    dpiPrice: demand.forecastPrice,
    weights
  };
}

export function calculate30DayForecast(
  terraXpert: { value: number },
  demand: DemandForecast,
  reference: PriceReference
) {
  const referenceSizePrice = Number(reference.sizePrices[48]) || reference.usd || 1;
  const directionalMove = clamp(
    0.55 * (demand.pressureIndex - 1) +
      0.35 * (demand.components.priceMomentum - 1),
    -0.12,
    0.12
  );
  const horizons = [7, 14, 30];
  const rows = Object.entries(reference.sizePrices)
    .map(([size, cartonPrice]) => {
      // This intentionally preserves the MVP's relative size-price behavior.
      const today = terraXpert.value * (Number(cartonPrice) / referenceSizePrice);
      const prices = Object.fromEntries(
        horizons.map((days) => [days, today * (1 + directionalMove * (days / 30))])
      ) as Record<number, number>;
      return {
        size: Number(size),
        today,
        prices,
        low30: prices[30] * 0.95,
        high30: prices[30] * 1.05
      };
    })
    .sort((left, right) => left.size - right.size);
  return {
    directionalMove,
    rows,
    signal: directionalMove > 0.015
      ? 'Firming'
      : directionalMove < -0.015
        ? 'Softening'
        : 'Mostly steady'
  };
}
