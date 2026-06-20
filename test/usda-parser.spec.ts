import {
  parseMovementReport,
  parsePriceReport
} from '../src/infrastructure/external/usda-reference.provider';

describe('USDA report parsers', () => {
  it('extracts Mexico Hass size prices', () => {
    const report = `Los Angeles Terminal Market Fruit Prices\nJune 17, 2026
---AVOCADOS:
MEXICO HASS cartons 2 layer
36s 58.00-62.00
48s 59.00-61.00
60s 53.00
70s 45.00
84s 35.00
---BANANAS:`;
    expect(parsePriceReport(report)).toEqual({
      usd: 60,
      sizePrices: { 36: 60, 48: 60, 60: 53, 70: 45, 84: 35 },
      asOf: 'June 17, 2026'
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
