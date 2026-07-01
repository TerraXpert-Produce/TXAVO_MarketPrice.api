import {
  parseHabMarketHighlights,
  parseMovementReport,
  parsePriceReport
} from '../src/infrastructure/external/usda-reference.provider';

describe('USDA report parsers', () => {
  it('extracts Mexico Hass size prices', () => {
    const report = `National FOB Review
Agricultural Marketing Service
June 30,2026
MEXICO CROSSINGS THROUGH TEXAS
---AVOCADOS:
Hass
cartons 2 layer
32s 32.25-38.25 mostly 36.25-38.25 occasional lower
36s 32.25-38.25 mostly 36.25-38.25 occasional lower
40s 32.25-38.25 mostly 36.25-38.25 occasional lower
48s 32.25-37.25 mostly 34.25-36.25 occasional higher and
lower
60s 32.25-40.25 mostly 33.25-35.25 occasional lower
70s 34.25-40.25 mostly 34.25-36.25 occasional lower
84s 27.25-32.25 mostly 28.25-30.25 occasional higher and lower.
ORGANIC`;
    expect(parsePriceReport(report)).toEqual({
      usd: 35.25,
      sizePrices: { 32: 37.25, 36: 37.25, 40: 37.25, 48: 35.25, 60: 34.25, 70: 35.25, 84: 29.25 },
      asOf: 'June 30, 2026'
    });
  });

  it('adds conventional and organic Mexico movement', () => {
    const report = `Specialty Crops Market News June 30, 2026
NATIONAL SHIPMENT RECAP FOR SHIP DATE: Monday 29-JUN-2026
AVOCADOS MX T 7,007,143
AVOCADOS Organic MX T 668,255`;
    expect(parseMovementReport(report)).toEqual({
      volume: 7_675_398,
      reportDate: 'June 30, 2026',
      period: 'Ship date 29-JUN-2026'
    });
  });

  it('extracts public HAB YTD units and volume highlights', () => {
    const html = `
      <h4 class="heading">Last Week Actual<span class="units-title">(lbs)</span></h4>
      <h3 class="title actual">66,664,626</h3>
      <p class="date">Week 26: <strong>June 28, 2026</strong></p>
      <h4 class="heading">Current Week Projection<span class="units-title">(lbs)</span></h4>
      <h3 class="title proj">65,241,450</h3>
      <p class="date">Week 27: <strong>July 5, 2026</strong></p>
      <h4 class="heading">Next Week Projection<span class="units-title">(lbs)</span></h4>
      <h3 class="title proj">69,280,461</h3>
      <p class="date">Week 28: <strong>July 12, 2026</strong></p>
      <h4 class="heading">YTD Unit Sales</h4>
      <h3 class="title actual">1,651,029,080</h3>
      <p class="date">Week Ending: <strong>June 14, 2026</strong></p>
    `;
    expect(parseHabMarketHighlights(html)).toEqual({
      ytdUnits: 1_651_029_080,
      ytdPeriod: 'Week ending June 14, 2026',
      lastWeekActualLb: 66_664_626,
      lastWeekPeriod: 'Week 26 · June 28, 2026',
      currentProjectionLb: 65_241_450,
      currentPeriod: 'Week 27 · July 5, 2026',
      nextProjectionLb: 69_280_461,
      nextPeriod: 'Week 28 · July 12, 2026',
      currentTrendPct: (65_241_450 / 66_664_626 - 1) * 100,
      nextTrendPct: (69_280_461 / 65_241_450 - 1) * 100
    });
  });
});
