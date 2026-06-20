import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'market_observations', versionKey: false })
export class MarketObservationDocument {
  @Prop({ required: true, minlength: 2, maxlength: 120, index: true })
  location!: string;

  @Prop({ required: true, minlength: 2, maxlength: 120, index: true })
  market!: string;

  @Prop({ required: true, min: Number.MIN_VALUE })
  priceUsdKg!: number;

  @Prop({ type: Number, min: Number.MIN_VALUE, default: null })
  volumeTonnes!: number | null;

  @Prop({ required: true, min: 0.5, max: 1.5 })
  gradeFactor!: number;

  @Prop({ required: true, min: 0.5, max: 1 })
  freshnessFactor!: number;

  @Prop({ required: true, enum: ['Mexico'], default: 'Mexico' })
  originCountry!: string;

  @Prop({ required: true, enum: ['Hass'], default: 'Hass' })
  variety!: string;

  @Prop({ required: true, enum: ['web_form'], default: 'web_form' })
  source!: string;

  @Prop({ required: true, index: true })
  observedAt!: Date;

  @Prop({ required: true })
  createdAt!: Date;
}

export type MarketObservationHydrated = HydratedDocument<MarketObservationDocument>;
export const MarketObservationSchema = SchemaFactory.createForClass(MarketObservationDocument);
MarketObservationSchema.index({ location: 1, observedAt: -1 });
MarketObservationSchema.index({ market: 1, observedAt: -1 });

@Schema({ collection: 'market_pulses', versionKey: false })
export class MarketPulseDocument {
  @Prop({ required: true, type: Object })
  inputs!: Record<string, number | null>;

  @Prop({ required: true, min: 0.5, max: 1.5 })
  pressureIndex!: number;

  @Prop({ required: true, min: Number.MIN_VALUE })
  forecastPriceUsdKg!: number;

  @Prop({ required: true, enum: ['Mexico'], default: 'Mexico' })
  originCountry!: string;

  @Prop({ required: true, enum: ['Hass'], default: 'Hass' })
  variety!: string;

  @Prop({ required: true, enum: ['web_form'], default: 'web_form' })
  source!: string;

  @Prop({ required: true, index: true })
  submittedAt!: Date;
}

export type MarketPulseHydrated = HydratedDocument<MarketPulseDocument>;
export const MarketPulseSchema = SchemaFactory.createForClass(MarketPulseDocument);
