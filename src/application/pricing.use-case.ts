import {
  calculate30DayForecast,
  calculateDemandForecast,
  calculateIndex,
  calculateTerraXpertPrice
} from '../domain/pricing/pricing-calculator';
import { DemandInputs, Observation } from '../domain/pricing/models';
import { ObservationRepository, ReferenceProvider } from './ports';

export interface CalculatePricingCommand {
  observations?: Observation[];
  demand: DemandInputs;
  trend: number[];
}

const DEFAULT_MARKET_OBSERVATION_LIMIT = 50;

export class PricingUseCase {
  constructor(
    private readonly references: ReferenceProvider,
    private readonly observations?: ObservationRepository
  ) {}

  async execute(command: CalculatePricingCommand) {
    const reference = await this.references.getReference();
    const { observations, source } = await this.resolveObservations(command.observations);
    const index = calculateIndex(observations);
    const demand = calculateDemandForecast(index.value, command.demand, command.trend);
    const blended = calculateTerraXpertPrice(index.value, demand, reference.price);
    const forecast = calculate30DayForecast(blended, demand, reference.price);
    return {
      index,
      demand,
      blended,
      forecast,
      reference,
      marketData: {
        source,
        observationCount: observations.length
      }
    };
  }

  private async resolveObservations(observations?: Observation[]) {
    if (observations?.length) {
      return { observations, source: 'request' as const };
    }
    if (!this.observations) {
      throw new Error('At least one market observation is required');
    }
    const recent = await this.observations.findRecent(DEFAULT_MARKET_OBSERVATION_LIMIT);
    if (!recent.length) {
      throw new Error('At least one market observation is required');
    }
    return { observations: recent, source: 'market_observations' as const };
  }
}
