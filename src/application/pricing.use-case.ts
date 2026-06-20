import {
  calculate30DayForecast,
  calculateDemandForecast,
  calculateIndex,
  calculateTerraXpertPrice
} from '../domain/pricing/pricing-calculator';
import { DemandInputs, Observation } from '../domain/pricing/models';
import { ReferenceProvider } from './ports';

export interface CalculatePricingCommand {
  observations: Observation[];
  demand: DemandInputs;
  trend: number[];
}

export class PricingUseCase {
  constructor(private readonly references: ReferenceProvider) {}

  async execute(command: CalculatePricingCommand) {
    const reference = await this.references.getReference();
    const index = calculateIndex(command.observations);
    const demand = calculateDemandForecast(index.value, command.demand, command.trend);
    const blended = calculateTerraXpertPrice(index.value, demand, reference.price);
    const forecast = calculate30DayForecast(blended, demand, reference.price);
    return { index, demand, blended, forecast, reference };
  }
}
