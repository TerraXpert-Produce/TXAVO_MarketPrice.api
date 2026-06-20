export interface Observation {
  location: string;
  market: string;
  price: number;
  volume: number;
  grade: number;
  freshness: number;
}

export interface DemandInputs {
  demandLevel: number;
  supplyLevel: number;
  salesPace: number;
  buyerOrders: number | null;
  sellerOffers: number | null;
  buyerPrice: number | null;
  sellerPrice: number | null;
  exportActivity: number | null;
  participants: number | null;
  sensitivity: number;
}

export interface PriceReference {
  usd: number;
  usdPerKg: number;
  cartonWeightKg: number;
  sizePrices: Record<number, number>;
}

export interface DemandForecast {
  pressureIndex: number;
  forecastPrice: number;
  indicatedPrice: number;
  priceSpread: number | null;
  confidence: number;
  signal: 'Strong demand' | 'Weak demand' | 'Balanced';
  components: {
    marketBalance: number;
    salesPace: number;
    exportActivity: number;
    priceMomentum: number;
  };
  source: string;
  answeredSignals: number;
}

export interface BlendWeights {
  observations: number;
  exportPrice: number;
  dpiPrice: number;
}
