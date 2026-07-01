import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PDFParse } from 'pdf-parse';
import { ExportReference, ReferenceProvider } from '../../application/ports';

export const USDA_PRICE_REPORT_URL = 'https://www.ams.usda.gov/mnreports/fvdfob.pdf';
export const USDA_MOVEMENT_REPORT_URL = 'https://www.ams.usda.gov/mnreports/wa_fv175.pdf';
export const HAB_MARKETERS_URL = 'https://hassavocadoboard.com/marketers/';
export const REFERENCE_DAILY_REFRESH_JOB = 'external-reference-daily-refresh';
export const DEFAULT_REFERENCE_DAILY_REFRESH_CRON = '0 6 * * *';
export const DEFAULT_REFERENCE_DAILY_REFRESH_TZ = 'America/New_York';

function averagePrice(match: RegExpMatchArray): number {
  const low = Number(match[1]);
  const high = match[2] ? Number(match[2]) : low;
  return (low + high) / 2;
}

function parseInteger(value: string): number {
  return Number(value.replaceAll(',', ''));
}

function decodeHtml(value: string): string {
  return value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&#038;', '&')
    .replaceAll('&amp;', '&')
    .replaceAll('&ndash;', '-')
    .replaceAll('&mdash;', '-')
    .replaceAll('&#8211;', '-');
}

function htmlToText(html: string): string {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parsePriceReport(text: string) {
  const reportDateRaw = text.match(
    /National FOB Review[\s\S]{0,260}\n([A-Z][a-z]+ \d{1,2},?\s*\d{4})/
  )?.[1];
  const reportDate = reportDateRaw?.replace(/,?\s*(\d{4})$/, ', $1');
  const texasSection = [...text.matchAll(
    /MEXICO CROSSINGS THROUGH TEXAS[\s\S]{0,1200}?---AVOCADOS:([\s\S]*?)(?:---PAPAYA:|ORGANIC)/g
  )].find((match) => /Hass[\s\S]*?cartons 2 layer/.test(match[1]))?.[1] ?? '';
  const mexicoHass = texasSection.match(/Hass[\s\S]*?cartons 2 layer([\s\S]*)/)?.[1] ?? '';
  const sizePrices: Record<number, number> = {};
  for (const size of [32, 36, 40, 48, 60, 70, 84]) {
    const match = mexicoHass.match(
      new RegExp(`\\b${size}s[^\\n]*?mostly\\s+(\\d+(?:\\.\\d+)?)-(\\d+(?:\\.\\d+)?)`)
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

export function parseHabMarketHighlights(html: string) {
  const text = htmlToText(html);
  const ytd = text.match(/YTD Unit Sales\s+([\d,]+)\s+Week Ending:\s+([A-Z][a-z]+ \d{1,2}, \d{4})/);
  const lastWeek = text.match(
    /Last Week Actual\s*(?:\(lbs\))?\s+([\d,]+)\s+Week\s+(\d+):\s+([A-Z][a-z]+ \d{1,2}, \d{4})/
  );
  const currentWeek = text.match(
    /Current Week Projection\s*(?:\(lbs\))?\s+([\d,]+)\s+Week\s+(\d+):\s+([A-Z][a-z]+ \d{1,2}, \d{4})/
  );
  const nextWeek = text.match(
    /Next Week Projection\s*(?:\(lbs\))?\s+([\d,]+)\s+Week\s+(\d+):\s+([A-Z][a-z]+ \d{1,2}, \d{4})/
  );
  if (!ytd || !lastWeek || !currentWeek || !nextWeek) {
    throw new Error('HAB marketers page did not contain the expected public YTD and volume highlights');
  }
  const lastWeekActualLb = parseInteger(lastWeek[1]);
  const currentProjectionLb = parseInteger(currentWeek[1]);
  const nextProjectionLb = parseInteger(nextWeek[1]);
  return {
    ytdUnits: parseInteger(ytd[1]),
    ytdPeriod: `Week ending ${ytd[2]}`,
    lastWeekActualLb,
    lastWeekPeriod: `Week ${lastWeek[2]} · ${lastWeek[3]}`,
    currentProjectionLb,
    currentPeriod: `Week ${currentWeek[2]} · ${currentWeek[3]}`,
    nextProjectionLb,
    nextPeriod: `Week ${nextWeek[2]} · ${nextWeek[3]}`,
    currentTrendPct: (currentProjectionLb / lastWeekActualLb - 1) * 100,
    nextTrendPct: (nextProjectionLb / currentProjectionLb - 1) * 100
  };
}

@Injectable()
export class UsdaReferenceProvider implements ReferenceProvider, OnModuleInit {
  private readonly logger = new Logger(UsdaReferenceProvider.name);
  private cached?: ExportReference;
  private refreshPromise?: Promise<ExportReference>;

  constructor(
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry
  ) {}

  onModuleInit(): void {
    const cronTime = this.config.get<string>('REFERENCE_DAILY_REFRESH_CRON')
      ?? this.config.get<string>('USDA_DAILY_REFRESH_CRON', DEFAULT_REFERENCE_DAILY_REFRESH_CRON);
    const timeZone = this.config.get<string>('REFERENCE_DAILY_REFRESH_TZ')
      ?? this.config.get<string>('USDA_DAILY_REFRESH_TZ', DEFAULT_REFERENCE_DAILY_REFRESH_TZ);
    const job = CronJob.from({
      cronTime,
      onTick: () => this.scheduledRefresh(),
      start: true,
      timeZone,
      waitForCompletion: true,
      name: REFERENCE_DAILY_REFRESH_JOB
    });

    this.scheduler.addCronJob(REFERENCE_DAILY_REFRESH_JOB, job);
    this.logger.log(`Scheduled USDA/HAB reference refresh with "${cronTime}" in ${timeZone}`);
    void this.scheduledRefresh().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Initial USDA/HAB reference refresh failed: ${message}`);
    });
  }

  async getReference(force = false): Promise<ExportReference> {
    const ttl = Number(this.config.get('USDA_CACHE_TTL_MS', 86_400_000));
    const age = this.cached ? Date.now() - Date.parse(this.cached.fetchedAt) : Infinity;
    if (!force && this.cached && age < ttl) return this.cached;
    this.refreshPromise ??= this.refresh().finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  async scheduledRefresh(): Promise<void> {
    const reference = await this.getReference(true);
    this.logger.log(
      `Updated USDA/HAB reference: price ${reference.price.asOf}, exports ${reference.exports.period}, HAB ${reference.hab.currentPeriod}`
    );
  }

  private async refresh(): Promise<ExportReference> {
    const previous = this.cached ?? this.fallback();
    const [priceResult, movementResult, habResult] = await Promise.allSettled([
      this.fetchPdfText(USDA_PRICE_REPORT_URL).then(parsePriceReport),
      this.fetchPdfText(USDA_MOVEMENT_REPORT_URL).then(parseMovementReport),
      this.fetchText(HAB_MARKETERS_URL).then(parseHabMarketHighlights)
    ]);
    const price = priceResult.status === 'fulfilled' ? priceResult.value : previous.price;
    const movement = movementResult.status === 'fulfilled' ? movementResult.value : previous.exports;
    const hab = habResult.status === 'fulfilled' ? habResult.value : previous.hab;
    const errors = [priceResult, movementResult, habResult]
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
        size: 'Mexico Hass, size 48 · FOB McAllen',
        sizePrices: price.sizePrices,
        asOf: price.asOf
      },
      exports: {
        configured: true,
        volume: movement.volume,
        unit: 'lb',
        period: movement.period,
        reportDate: 'reportDate' in movement ? movement.reportDate : null
      },
      hab,
      source: 'USDA Agricultural Marketing Service; Hass Avocado Board public highlights',
      priceSourceUrl: USDA_PRICE_REPORT_URL,
      exportSourceUrl: USDA_MOVEMENT_REPORT_URL,
      habSourceUrl: HAB_MARKETERS_URL
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

  private async fetchText(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TerraXpert/1.0 daily avocado reference' },
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) throw new Error(`HAB request failed with ${response.status}`);
    return response.text();
  }

  private fallback(): ExportReference {
    const cartonWeightKg = Number(this.config.get('USDA_AVOCADO_CARTON_WEIGHT_KG', 11.3));
    const lastWeekActualLb = 66_664_626;
    const currentProjectionLb = 65_241_450;
    const nextProjectionLb = 69_280_461;
    return {
      configured: true,
      status: 'fallback',
      fetchedAt: new Date().toISOString(),
      error: null,
      price: {
        configured: true,
        usd: 35.25,
        usdPerKg: 35.25 / cartonWeightKg,
        cartonWeightKg,
        package: '2-layer carton',
        size: 'Mexico Hass, size 48 · FOB McAllen',
        sizePrices: { 32: 37.25, 36: 37.25, 40: 37.25, 48: 35.25, 60: 34.25, 70: 35.25, 84: 29.25 },
        asOf: 'June 30, 2026'
      },
      exports: {
        configured: true,
        volume: 7_675_398,
        unit: 'lb',
        period: 'Ship date 29-JUN-2026',
        reportDate: 'June 30, 2026'
      },
      hab: {
        ytdUnits: 1_651_029_080,
        ytdPeriod: 'Week ending June 14, 2026',
        lastWeekActualLb,
        lastWeekPeriod: 'Week 26 · June 28, 2026',
        currentProjectionLb,
        currentPeriod: 'Week 27 · July 5, 2026',
        nextProjectionLb,
        nextPeriod: 'Week 28 · July 12, 2026',
        currentTrendPct: (currentProjectionLb / lastWeekActualLb - 1) * 100,
        nextTrendPct: (nextProjectionLb / currentProjectionLb - 1) * 100
      },
      source: 'USDA Agricultural Marketing Service; Hass Avocado Board public highlights',
      priceSourceUrl: USDA_PRICE_REPORT_URL,
      exportSourceUrl: USDA_MOVEMENT_REPORT_URL,
      habSourceUrl: HAB_MARKETERS_URL
    };
  }
}
