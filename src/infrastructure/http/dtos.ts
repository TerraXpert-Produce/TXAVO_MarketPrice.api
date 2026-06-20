import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';

export class ObservationDto {
  @IsString() @MinLength(2) @MaxLength(120)
  location!: string;

  @IsString() @MinLength(2) @MaxLength(120)
  market!: string;

  @IsNumber() @Min(Number.MIN_VALUE)
  price!: number;

  @IsNumber() @Min(Number.MIN_VALUE)
  volume!: number;

  @IsNumber() @Min(0.5) @Max(1.5)
  grade!: number;

  @IsNumber() @Min(0.5) @Max(1)
  freshness!: number;
}

export class DemandInputsDto {
  @IsNumber() @Min(0.5) @Max(1.5) demandLevel!: number;
  @IsNumber() @Min(0.5) @Max(1.5) supplyLevel!: number;
  @IsNumber() @Min(0.5) @Max(1.5) salesPace!: number;
  @IsOptional() @IsInt() @Min(0) buyerOrders!: number | null;
  @IsOptional() @IsInt() @Min(0) sellerOffers!: number | null;
  @IsOptional() @IsNumber() @Min(Number.MIN_VALUE) buyerPrice!: number | null;
  @IsOptional() @IsNumber() @Min(Number.MIN_VALUE) sellerPrice!: number | null;
  @IsOptional() @IsNumber() @Min(Number.MIN_VALUE) exportActivity!: number | null;
  @IsOptional() @IsInt() @Min(1) participants!: number | null;
  @IsNumber() @Min(0) @Max(100) sensitivity!: number;
}

export class CalculatePricingDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ObservationDto)
  observations!: ObservationDto[];

  @ValidateNested() @Type(() => DemandInputsDto)
  demand!: DemandInputsDto;

  @IsArray() @ArrayMinSize(14) @IsNumber({}, { each: true })
  trend!: number[];
}

export class CreateObservationDto {
  @IsString() @MinLength(2) @MaxLength(120) location!: string;
  @IsString() @MinLength(2) @MaxLength(120) market!: string;
  @IsNumber() @Min(Number.MIN_VALUE) price_usd_kg!: number;
  @IsNumber() @Min(Number.MIN_VALUE) volume_tonnes!: number;
  @IsNumber() @Min(0.5) @Max(1.5) grade_factor!: number;
  @IsNumber() @Min(0.5) @Max(1) freshness_factor!: number;
}

export class CreatePulseDto {
  @IsNumber() @Min(0.5) @Max(1.5) demand_level!: number;
  @IsNumber() @Min(0.5) @Max(1.5) supply_level!: number;
  @IsNumber() @Min(0.5) @Max(1.5) sales_pace!: number;
  @IsOptional() @IsInt() @Min(0) buyer_orders!: number | null;
  @IsOptional() @IsInt() @Min(0) seller_offers!: number | null;
  @IsOptional() @IsNumber() @Min(Number.MIN_VALUE) buyer_price_usd_kg!: number | null;
  @IsOptional() @IsNumber() @Min(Number.MIN_VALUE) seller_price_usd_kg!: number | null;
  @IsOptional() @IsNumber() @Min(Number.MIN_VALUE) export_activity!: number | null;
  @IsOptional() @IsInt() @Min(1) participant_count!: number | null;
  @IsNumber() @Min(0.5) @Max(1.5) demand_pressure_index!: number;
  @IsNumber() @Min(Number.MIN_VALUE) forecast_price_usd_kg!: number;
}
