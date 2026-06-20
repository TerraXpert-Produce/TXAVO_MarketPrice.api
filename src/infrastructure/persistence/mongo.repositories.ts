import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ObservationRecord,
  ObservationRepository,
  PulseRecord,
  PulseRepository
} from '../../application/ports';
import {
  MarketObservationDocument,
  MarketObservationHydrated,
  MarketPulseDocument,
  MarketPulseHydrated
} from './market.schemas';

@Injectable()
export class MongoObservationRepository implements ObservationRepository {
  constructor(
    @InjectModel(MarketObservationDocument.name)
    private readonly model: Model<MarketObservationHydrated>
  ) {}

  async save(record: ObservationRecord): Promise<ObservationRecord> {
    const saved = await this.model.create({
      location: record.location,
      market: record.market,
      priceUsdKg: record.price,
      volumeTonnes: record.volume,
      gradeFactor: record.grade,
      freshnessFactor: record.freshness,
      originCountry: 'Mexico',
      variety: 'Hass',
      source: 'web_form',
      observedAt: record.observedAt,
      createdAt: record.createdAt
    });
    return { ...record, id: saved.id as string };
  }

  async findRecent(limit: number): Promise<ObservationRecord[]> {
    const rows = await this.model.find().sort({ observedAt: -1 }).limit(limit).lean().exec();
    return rows.map((row) => ({
      id: String(row._id),
      location: row.location,
      market: row.market,
      price: row.priceUsdKg,
      volume: row.volumeTonnes ?? 0,
      grade: row.gradeFactor,
      freshness: row.freshnessFactor,
      observedAt: row.observedAt,
      createdAt: row.createdAt
    }));
  }
}

@Injectable()
export class MongoPulseRepository implements PulseRepository {
  constructor(
    @InjectModel(MarketPulseDocument.name)
    private readonly model: Model<MarketPulseHydrated>
  ) {}

  async save(record: PulseRecord): Promise<PulseRecord> {
    const saved = await this.model.create({
      inputs: record.inputs,
      pressureIndex: record.pressureIndex,
      forecastPriceUsdKg: record.forecastPrice,
      originCountry: 'Mexico',
      variety: 'Hass',
      source: 'web_form',
      submittedAt: record.submittedAt
    });
    return { ...record, id: saved.id as string };
  }

  async findRecent(limit: number): Promise<PulseRecord[]> {
    const rows = await this.model.find().sort({ submittedAt: -1 }).limit(limit).lean().exec();
    return rows.map((row) => ({
      id: String(row._id),
      inputs: row.inputs as unknown as PulseRecord['inputs'],
      pressureIndex: row.pressureIndex,
      forecastPrice: row.forecastPriceUsdKg,
      submittedAt: row.submittedAt
    }));
  }
}
