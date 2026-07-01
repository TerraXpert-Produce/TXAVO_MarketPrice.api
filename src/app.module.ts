import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import {
  OBSERVATION_REPOSITORY,
  ObservationRepository,
  PRICING_USE_CASE,
  PULSE_REPOSITORY,
  REFERENCE_PROVIDER,
  ReferenceProvider
} from './application/ports';
import { PricingUseCase } from './application/pricing.use-case';
import { UsdaReferenceProvider } from './infrastructure/external/usda-reference.provider';
import { ApiKeyGuard } from './infrastructure/http/api-key.guard';
import {
  HealthController,
  MarketController,
  PricingController,
  ReferenceController
} from './infrastructure/http/controllers';
import {
  MarketObservationDocument,
  MarketObservationSchema,
  MarketPulseDocument,
  MarketPulseSchema
} from './infrastructure/persistence/market.schemas';
import {
  MongoObservationRepository,
  MongoPulseRepository
} from './infrastructure/persistence/mongo.repositories';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        dbName: config.get<string>('MONGODB_DB_NAME', 'txt_pricing'),
        serverSelectionTimeoutMS: 10_000
      })
    }),
    MongooseModule.forFeature([
      { name: MarketObservationDocument.name, schema: MarketObservationSchema },
      { name: MarketPulseDocument.name, schema: MarketPulseSchema }
    ])
  ],
  controllers: [HealthController, ReferenceController, PricingController, MarketController],
  providers: [
    ApiKeyGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    UsdaReferenceProvider,
    MongoObservationRepository,
    MongoPulseRepository,
    { provide: REFERENCE_PROVIDER, useExisting: UsdaReferenceProvider },
    { provide: OBSERVATION_REPOSITORY, useExisting: MongoObservationRepository },
    { provide: PULSE_REPOSITORY, useExisting: MongoPulseRepository },
    {
      provide: PRICING_USE_CASE,
      inject: [REFERENCE_PROVIDER, OBSERVATION_REPOSITORY],
      useFactory: (
        references: ReferenceProvider,
        observations: ObservationRepository
      ) => new PricingUseCase(references, observations)
    }
  ]
})
export class AppModule {}
