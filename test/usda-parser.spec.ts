import {
  parseMovementReport,
  parsePriceReport
} from '../src/infrastructure/external/usda-reference.provider';

describe('USDA report parsers', () => {
  it('extracts Mexico Hass size prices', () => {
    const report = `National FOB Review
Agricultural Marketing Service
June 24, 2026
MEXICO CROSSINGS THROUGH TEXAS
---AVOCADOS:
Hass
cartons 2 layer
32s 32.25-38.25 mostly 34.25-38.25 occasional higher
36s 32.25-38.25 mostly 34.25-38.25 occasional higher
40s 32.25-38.25 mostly 34.25-38.25 occasional higher
48s 32.25-37.25 mostly 34.25-37.25 occasional higher
60s 32.25-40.25 mostly 34.25-36.25 occasional higher
70s 36.25-40.25 mostly 36.25-38.25
84s 27.25-32.25 mostly 28.25-30.25 occasional higher and lower.
ORGANIC`;
    expect(parsePriceReport(report)).toEqual({
      usd: 35.75,
      sizePrices: { 32: 36.25, 36: 36.25, 40: 36.25, 48: 35.75, 60: 35.25, 70: 37.25, 84: 29.25 },
      asOf: 'June 24, 2026'
    });
  });

  it('adds conventional and organic Mexico movement', () => {
    const report = `Specialty Crops Market News June 18, 2026
NATIONAL SHIPMENT RECAP FOR SHIP DATE: Tuesday 17-JUN-2026
AVOCADOS MX T 7,500,000
AVOCADOS Organic MX T 132,482`;
    expect(parseMovementReport(report)).toEqual({
      volume: 7_632_482,
      reportDate: 'June 18, 2026',
      period: 'Ship date 17-JUN-2026'
    });
  });
});
