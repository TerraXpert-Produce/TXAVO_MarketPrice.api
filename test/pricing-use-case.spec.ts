import { PricingUseCase } from '../src/application/pricing.use-case';
import {
  ExportReference,
  ObservationRecord,
  ObservationRepository,
  ReferenceProvider
} from '../src/application/ports';
import { DemandInputs } from '../src/domain/pricing/models';

const reference: ExportReference = {
  configured: true,
  status: 'live',
  fetchedAt: '2026-06-30T12:00:00.000Z',
  error: null,
  price: {
    configured: true,
    usd: 35.25,
    usdPerKg: 35.25 / 11.3,
    cartonWeightKg: 11.3,
    package: '2-layer carton',
    size: 'Mexico Hass, size 48 · FOB McAllen',
    sizePrices: { 32: 37.25, 36: 37.25, 40: 37.25, 48: 35.25, 60: 34.25, 70: 35.25, 84: 29.25 },
    asOf: 'June 30, 2026'
  },
  exports: {
    configured: true,
    volume: 7_675_398,
    unit: 'lb',
    period: 'Ship date 29-JUN-2026',
    reportDate: 'June 30, 2026'
  },
  hab: {
    ytdUnits: 1_392_518_493,
    ytdPeriod: 'Week ending May 17, 2026',
    lastWeekActualLb: 58_821_172,
    lastWeekPeriod: 'Week 23 · June 7, 2026',
    currentProjectionLb: 63_935_015,
    currentPeriod: 'Week 24 · June 14, 2026',
    nextProjectionLb: 64_927_919,
    nextPeriod: 'Week 25 · June 21, 2026',
    currentTrendPct: 8.69388176112101,
    nextTrendPct: 1.553038168072634
  },
  source: 'USDA Agricultural Marketing Service',
  priceSourceUrl: 'https://www.ams.usda.gov/mnreports/fvdfob.pdf',
  exportSourceUrl: 'https://www.ams.usda.gov/mnreports/wa_fv175.pdf',
  habSourceUrl: 'https://hassavocadoboard.com/'
};

const demand: DemandInputs = {
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

const trend = [
  2.76, 2.78, 2.76, 2.8, 2.83, 2.81, 2.85, 2.88, 2.86, 2.89,
  2.91, 2.93, 2.92, 2.95
];

const recentObservations: ObservationRecord[] = [
  {
    location: 'McAllen',
    market: 'Cross-border wholesale',
    price: 3.12,
    volume: 100,
    grade: 1,
    freshness: 1,
    observedAt: new Date('2026-06-30T12:00:00.000Z'),
    createdAt: new Date('2026-06-30T12:00:00.000Z')
  },
  {
    location: 'Los Angeles',
    market: 'Wholesale',
    price: 2.98,
    volume: 80,
    grade: 1,
    freshness: 0.98,
    observedAt: new Date('2026-06-30T11:00:00.000Z'),
    createdAt: new Date('2026-06-30T11:00:00.000Z')
  }
];

describe('PricingUseCase', () => {
  it('uses recent saved market observations when observations are omitted', async () => {
    const findRecent = jest.fn().mockResolvedValue(recentObservations);
    const references: ReferenceProvider = {
      getReference: jest.fn().mockResolvedValue(reference)
    };
    const observations: ObservationRepository = {
      save: jest.fn(),
      findRecent
    };
    const useCase = new PricingUseCase(references, observations);

    const result = await useCase.execute({ demand, trend });

    expect(findRecent).toHaveBeenCalledWith(50);
    expect(result.marketData).toEqual({
      source: 'market_observations',
      observationCount: recentObservations.length
    });
    expect(result.reference.price.asOf).toBe('June 30, 2026');
    expect(result.blended.observationPrice).toBeCloseTo(3.0322834080717493, 12);
  });
});
