import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { PDFParse } from 'pdf-parse';
import { ExportReference, ReferenceProvider } from '../../application/ports';

export const USDA_PRICE_REPORT_URL = 'https://www.ams.usda.gov/mnreports/hc_fv010.pdf';
export const USDA_MOVEMENT_REPORT_URL = 'https://www.ams.usda.gov/mnreports/wa_fv175.pdf';

function averagePrice(match: RegExpMatchArray): number {
  const low = Number(match[1]);
  const high = match[2] ? Number(match[2]) : low;
  return (low + high) / 2;
}

export function parsePriceReport(text: string) {
  const reportDate = text.match(
    /Los Angeles Terminal Market Fruit Prices[\s\S]{0,80}\n([A-Z][a-z]+ \d{1,2}, \d{4})/
  )?.[1];
  const avocadoSection = text.match(/---AVOCADOS:([\s\S]*?)---BANANAS:/)?.[1] ?? '';
  const mexicoHass = avocadoSection.match(/MEXICO HASS([\s\S]*)/)?.[1] ?? '';
  const sizePrices: Record<number, number> = {};
  for (const size of [32, 36, 40, 48, 60, 70, 84]) {
    const match = mexicoHass.match(
      new RegExp(`\\b${size}s\\s+(\\d+(?:\\.\\d+)?)(?:-(\\d+(?:\\.\\d+)?))?`)
    );
    if (match) sizePrices[size] = averagePrice(match);
  }
  if (!reportDate || !sizePrices[48]) {
    throw new Error('USDA price report did not contain the expected Mexico Hass size 48 quote');
  }
  return { usd: sizePrices[48], sizePrices, asOf: reportDate };
}

export function parseMovementReport(text: string) {
  const reportDate = text.match(/Specialty Crops Market News ([A-Z][a-z]+ \d{1,2}, \d{4})/)?.[1];
  const shipDate = text.match(/NATIONAL SHIPMENT RECAP FOR SHIP DATE:\s*([^\n]+)/)?.[1]?.trim();
  const conventional = Number(
    (text.match(/^AVOCADOS\s+MX\s+T\s+([\d,]+)/m)?.[1] ?? '0').replaceAll(',', '')
  );
  const organic = Number(
    (text.match(/^AVOCADOS\s+Organic\s+MX\s+T\s+([\d,]+)/mi)?.[1] ?? '0').replaceAll(',', '')
  );
  const volume = conventional + organic;
  if (!reportDate || !shipDate || volume <= 0) {
    throw new Error('USDA movement report did not contain the expected Mexico avocado shipment data');
  }
  return {
    volume,
    reportDate,
    period: `Ship date ${shipDate.replace(/^[A-Za-z]+\s+/, '')}`
  };
}

@Injectable()
export class UsdaReferenceProvider implements ReferenceProvider {
  private readonly logger = new Logger(UsdaReferenceProvider.name);
  private cached?: ExportReference;
  private refreshPromise?: Promise<ExportReference>;

  constructor(private readonly config: ConfigService) {}

  async getReference(force = false): Promise<ExportReference> {
    const ttl = Number(this.config.get('USDA_CACHE_TTL_MS', 86_400_000));
    const age = this.cached ? Date.now() - Date.parse(this.cached.fetchedAt) : Infinity;
    if (!force && this.cached && age < ttl) return this.cached;
    this.refreshPromise ??= this.refresh().finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  @Interval(Number(process.env.USDA_AUTO_REFRESH_MS || 3_600_000))
  async scheduledRefresh(): Promise<void> {
    await this.getReference(true);
  }

  private async refresh(): Promise<ExportReference> {
    const previous = this.cached ?? this.fallback();
    const [priceResult, movementResult] = await Promise.allSettled([
      this.fetchPdfText(USDA_PRICE_REPORT_URL).then(parsePriceReport),
      this.fetchPdfText(USDA_MOVEMENT_REPORT_URL).then(parseMovementReport)
    ]);
    const price = priceResult.status === 'fulfilled' ? priceResult.value : previous.price;
    const movement = movementResult.status === 'fulfilled' ? movementResult.value : previous.exports;
    const errors = [priceResult, movementResult]
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
    if (errors.length) this.logger.warn(errors.join('; '));
    const cartonWeightKg = Number(this.config.get('USDA_AVOCADO_CARTON_WEIGHT_KG', 11.3));
    this.cached = {
      ...previous,
      status: errors.length ? 'partial' : 'live',
      fetchedAt: new Date().toISOString(),
      error: errors.join('; ') || null,
      price: {
        configured: true,
        usd: price.usd,
        usdPerKg: price.usd / cartonWeightKg,
        cartonWeightKg,
        package: '2-layer carton',
        size: 'Mexico Hass, size 48',
        sizePrices: price.sizePrices,
        asOf: price.asOf
      },
      exports: {
        configured: true,
        volume: movement.volume,
        unit: 'lb',
        period: movement.period,
        reportDate: 'reportDate' in movement ? movement.reportDate : null
      }
    };
    return this.cached;
  }

  private async fetchPdfText(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TerraXpert/1.0 USDA daily avocado reference' },
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) throw new Error(`USDA request failed with ${response.status}`);
    const parser = new PDFParse({ data: new Uint8Array(await response.arrayBuffer()) });
    try {
      return (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  }

  private fallback(): ExportReference {
    const cartonWeightKg = Number(this.config.get('USDA_AVOCADO_CARTON_WEIGHT_KG', 11.3));
    const lastWeekActualLb = 58_821_172;
    const currentProjectionLb = 63_935_015;
    const nextProjectionLb = 64_927_919;
    return {
      configured: true,
      status: 'fallback',
      fetchedAt: new Date().toISOString(),
      error: null,
      price: {
        configured: true,
        usd: 60,
        usdPerKg: 60 / cartonWeightKg,
        cartonWeightKg,
        package: '2-layer carton',
        size: 'Mexico Hass, size 48',
        sizePrices: { 36: 60, 40: 60, 48: 60, 60: 53, 70: 45, 84: 35 },
        asOf: 'June 17, 2026'
      },
      exports: {
        configured: true,
        volume: 7_632_482,
        unit: 'lb',
        period: 'Ship date 16-JUN-2026'
      },
      hab: {
        ytdUnits: 1_392_518_493,
        ytdPeriod: 'Week ending May 17, 2026',
        lastWeekActualLb,
        lastWeekPeriod: 'Week 23 · June 7, 2026',
        currentProjectionLb,
        currentPeriod: 'Week 24 · June 14, 2026',
        nextProjectionLb,
        nextPeriod: 'Week 25 · June 21, 2026',
        currentTrendPct: (currentProjectionLb / lastWeekActualLb - 1) * 100,
        nextTrendPct: (nextProjectionLb / currentProjectionLb - 1) * 100
      },
      source: 'USDA Agricultural Marketing Service',
      priceSourceUrl: USDA_PRICE_REPORT_URL,
      exportSourceUrl: USDA_MOVEMENT_REPORT_URL,
      habSourceUrl: 'https://hassavocadoboard.com/'
    };
  }
}
