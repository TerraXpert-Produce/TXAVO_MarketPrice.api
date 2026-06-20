import { DemandInputs, Observation, PriceReference } from '../domain/pricing/models';

export const OBSERVATION_REPOSITORY = Symbol('OBSERVATION_REPOSITORY');
export const PULSE_REPOSITORY = Symbol('PULSE_REPOSITORY');
export const REFERENCE_PROVIDER = Symbol('REFERENCE_PROVIDER');
export const PRICING_USE_CASE = Symbol('PRICING_USE_CASE');

export interface ObservationRecord extends Observation {
  id?: string;
  observedAt: Date;
  createdAt: Date;
}

export interface PulseRecord {
  id?: string;
  inputs: DemandInputs;
  pressureIndex: number;
  forecastPrice: number;
  submittedAt: Date;
}

export interface ObservationRepository {
  save(observation: ObservationRecord): Promise<ObservationRecord>;
  findRecent(limit: number): Promise<ObservationRecord[]>;
}

export interface PulseRepository {
  save(pulse: PulseRecord): Promise<PulseRecord>;
  findRecent(limit: number): Promise<PulseRecord[]>;
}

export interface ExportReference {
  configured: boolean;
  status: 'live' | 'partial' | 'fallback';
  fetchedAt: string;
  error: string | null;
  price: PriceReference & {
    configured: boolean;
    package: string;
    size: string;
    asOf: string;
  };
  exports: {
    configured: boolean;
    volume: number;
    unit: string;
    period: string;
    reportDate?: string | null;
  };
  hab: {
    ytdUnits: number;
    ytdPeriod: string;
    lastWeekActualLb: number;
    lastWeekPeriod: string;
    currentProjectionLb: number;
    currentPeriod: string;
    nextProjectionLb: number;
    nextPeriod: string;
    currentTrendPct: number;
    nextTrendPct: number;
  };
  source: string;
  priceSourceUrl: string;
  exportSourceUrl: string;
  habSourceUrl: string;
}

export interface ReferenceProvider {
  getReference(force?: boolean): Promise<ExportReference>;
}
