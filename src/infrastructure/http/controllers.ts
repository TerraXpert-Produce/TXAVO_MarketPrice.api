import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import {
  OBSERVATION_REPOSITORY,
  ObservationRepository,
  PRICING_USE_CASE,
  PULSE_REPOSITORY,
  PulseRepository,
  REFERENCE_PROVIDER,
  ReferenceProvider
} from '../../application/ports';
import { PricingUseCase } from '../../application/pricing.use-case';
import { ApiKeyGuard } from './api-key.guard';
import { CalculatePricingDto, CreateObservationDto, CreatePulseDto } from './dtos';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  health() {
    const connected = new Set<number>([1]).has(this.connection.readyState);
    return { status: connected ? 'ok' : 'degraded', connected };
  }
}

@ApiTags('references')
@Controller('export-reference')
export class ReferenceController {
  constructor(
    @Inject(REFERENCE_PROVIDER) private readonly references: ReferenceProvider
  ) {}

  @Get()
  getReference() {
    return this.references.getReference();
  }

  @Get('usda')
  async getUsdaReference() {
    const reference = await this.references.getReference();
    return {
      status: reference.status,
      fetchedAt: reference.fetchedAt,
      error: reference.error,
      price: reference.price,
      exports: reference.exports,
      source: 'USDA Agricultural Marketing Service',
      priceSourceUrl: reference.priceSourceUrl,
      exportSourceUrl: reference.exportSourceUrl
    };
  }

  @Get('hab')
  async getHabReference() {
    const reference = await this.references.getReference();
    return {
      status: reference.status,
      fetchedAt: reference.fetchedAt,
      error: reference.error,
      hab: reference.hab,
      source: 'Hass Avocado Board public highlights',
      habSourceUrl: reference.habSourceUrl
    };
  }

  @Post('refresh')
  @UseGuards(ApiKeyGuard)
  refreshReference() {
    return this.references.getReference(true);
  }
}

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(
    @Inject(PRICING_USE_CASE) private readonly pricing: PricingUseCase,
    @Inject(PULSE_REPOSITORY) private readonly pulses: PulseRepository
  ) {}

  @Post('calculate')
  calculate(@Body() body: CalculatePricingDto) {
    return this.pricing.execute(body);
  }

  @Get('current')
  async current() {
    const [current] = await this.pulses.findRecent(1);
    return { data: current ?? null };
  }

  @Get('history')
  history(@Query('limit') rawLimit?: string) {
    const limit = Math.min(Math.max(Number(rawLimit) || 30, 1), 365);
    return this.pulses.findRecent(limit);
  }
}

@ApiTags('market')
@Controller()
export class MarketController {
  constructor(
    @Inject(OBSERVATION_REPOSITORY) private readonly observations: ObservationRepository,
    @Inject(PULSE_REPOSITORY) private readonly pulses: PulseRepository
  ) {}

  @Get('market-observations')
  listObservations(@Query('limit') rawLimit?: string) {
    const limit = Math.min(Math.max(Number(rawLimit) || 50, 1), 200);
    return this.observations.findRecent(limit);
  }

  @Post('market-observations')
  @UseGuards(ApiKeyGuard)
  async createObservation(@Body() body: CreateObservationDto) {
    const now = new Date();
    const observation = await this.observations.save({
      location: body.location,
      market: body.market,
      price: body.price_usd_kg,
      volume: body.volume_tonnes,
      grade: body.grade_factor,
      freshness: body.freshness_factor,
      observedAt: now,
      createdAt: now
    });
    return { saved: true, id: observation.id };
  }

  @Post('market-pulses')
  @UseGuards(ApiKeyGuard)
  async createPulse(@Body() body: CreatePulseDto) {
    const pulse = await this.pulses.save({
      inputs: {
        demandLevel: body.demand_level,
        supplyLevel: body.supply_level,
        salesPace: body.sales_pace,
        buyerOrders: body.buyer_orders,
        sellerOffers: body.seller_offers,
        buyerPrice: body.buyer_price_usd_kg,
        sellerPrice: body.seller_price_usd_kg,
        exportActivity: body.export_activity,
        participants: body.participant_count,
        sensitivity: 10
      },
      pressureIndex: body.demand_pressure_index,
      forecastPrice: body.forecast_price_usd_kg,
      submittedAt: new Date()
    });
    return { saved: true, id: pulse.id };
  }
}
