import {
  calculate30DayForecast,
  calculateDemandForecast,
  calculateIndex,
  calculateTerraXpertPrice
} from '../src/domain/pricing/pricing-calculator';
import { DemandInputs, Observation } from '../src/domain/pricing/models';

const observations: Observation[] = [
  { location: 'Mexico Grower', market: 'Michoacan farmgate', price: 2.63, volume: 380, grade: 1, freshness: 1 },
  { location: 'California', market: 'Los Angeles wholesale', price: 2.94, volume: 265, grade: 0.98, freshness: 0.97 },
  { location: 'New York', market: 'Terminal market', price: 3.1, volume: 310, grade: 1.02, freshness: 0.96 },
  { location: 'Mc Allen', market: 'Cross-border wholesale', price: 3.18, volume: 190, grade: 1.01, freshness: 0.94 },
  { location: 'Florida Miami', market: 'Wholesale', price: 2.75, volume: 155, grade: 0.99, freshness: 0.98 }
];

const trend = [
  2.76, 2.78, 2.76, 2.8, 2.83, 2.81, 2.85, 2.88, 2.86, 2.89,
  2.91, 2.93, 2.92, 2.95, 2.97, 2.94, 2.98, 2.99, 2.97, 3,
  3.02, 3.04, 3.02, 3.06, 3.08, 3.06, 3.09, 3.11, 3.09, 3.11
];

const demandInputs: DemandInputs = {
  demandLevel: 1,
  supplyLevel: 1,
  salesPace: 1,
  buyerOrders: null,
  sellerOffers: null,
  buyerPrice: 2.95,
  sellerPrice: 3.05,
  exportActivity: null,
  participants: null,
  sensitivity: 10
};

const reference = {
  usd: 60,
  usdPerKg: 60 / 11.3,
  cartonWeightKg: 11.3,
  sizePrices: { 36: 60, 40: 60, 48: 60, 60: 53, 70: 45, 84: 35 }
};

describe('MVP pricing golden master', () => {
  it('preserves the volume-weighted market index', () => {
    const result = calculateIndex(observations);
    expect(result.totalVolume).toBeCloseTo(1265.15, 8);
    expect(result.value).toBeCloseTo(2.8183626166067266, 12);
  });

  it('preserves DPI, near-term price and 50/30/20 blended price', () => {
    const index = calculateIndex(observations);
    const demand = calculateDemandForecast(index.value, demandInputs, trend);
    const blend = calculateTerraXpertPrice(index.value, demand, reference);
    expect(demand.components.priceMomentum).toBeCloseTo(1.027592768791627, 12);
    expect(demand.pressureIndex).toBeCloseTo(1.0027592768791627, 12);
    expect(demand.forecastPrice).toBeCloseTo(3.000827783063749, 12);
    expect(blend.value).toBeCloseTo(3.602267218898414, 12);
    expect(blend.weights).toEqual({ observations: 0.5, exportPrice: 0.3, dpiPrice: 0.2 });
  });

  it('preserves size ratios and the bounded 30-day scenario', () => {
    const demand = calculateDemandForecast(calculateIndex(observations).value, demandInputs, trend);
    const blend = calculateTerraXpertPrice(calculateIndex(observations).value, demand, reference);
    const forecast = calculate30DayForecast(blend, demand, reference);
    expect(forecast.rows.find((row) => row.size === 48)?.today).toBeCloseTo(blend.value, 12);
    expect(forecast.rows.find((row) => row.size === 84)?.today).toBeCloseTo(blend.value * 35 / 60, 12);
    expect(forecast.directionalMove).toBeLessThanOrEqual(0.12);
    expect(forecast.directionalMove).toBeGreaterThanOrEqual(-0.12);
  });

  it('rejects incomplete trend data and observations without effective volume', () => {
    expect(() => calculateDemandForecast(3, demandInputs, trend.slice(0, 13))).toThrow();
    expect(() => calculateIndex([{ ...observations[0], volume: 0 }])).toThrow();
  });
});
