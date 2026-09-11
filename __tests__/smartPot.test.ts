import { parseHistoryChunk, parseSmartPotHistory, validateSmartPotConfig } from '../src/domain/entities/smartPot';

describe('parseHistoryChunk', () => {
  it('parses metadata and records and reports more', () => {
    const chunk = parseHistoryChunk('c=0;t=24;n=5;more=1;1723456800:43.2:24.1:320;1723460400:42.8:24.3:280');
    expect(chunk.more).toBe(1);
    expect(chunk.records).toEqual([
      { timestamp: 1723456800, soil: 43.2, temperature: 24.1, lux: 320 },
      { timestamp: 1723460400, soil: 42.8, temperature: 24.3, lux: 280 },
    ]);
  });

  it('stops paging when more=0', () => {
    expect(parseHistoryChunk('c=0;t=2;n=2;more=0;100:40.5:23.1:300').more).toBe(0);
  });

  it('treats end and empty as no more records', () => {
    expect(parseHistoryChunk('end')).toEqual({ more: 0, records: [] });
    expect(parseHistoryChunk('')).toEqual({ more: 0, records: [] });
  });

  it('ignores malformed records', () => {
    expect(parseHistoryChunk('c=0;more=1;bad;100:40:20:200').records).toHaveLength(1);
  });
});

describe('parseSmartPotHistory', () => {
  it('parses paged history metadata and records', () => {
    expect(parseSmartPotHistory('c=0;t=2;n=2;more=0;100:40.5:23.1:300;200:41:24:280')).toEqual([
      { timestamp: 100, soil: 40.5, temperature: 23.1, lux: 300 },
      { timestamp: 200, soil: 41, temperature: 24, lux: 280 },
    ]);
  });

  it('ignores malformed records', () => {
    expect(parseSmartPotHistory('n=2;100:40:20:200;bad;200:30:10')).toHaveLength(1);
  });
});

describe('validateSmartPotConfig', () => {
  it('accepts a valid full configuration', () => {
    expect(validateSmartPotConfig('aw=1,l=35,h=50,d=30,i=60,lon=300,loff=500,ace=1,cs=08:00,ce=17:00')).toBeNull();
    expect(validateSmartPotConfig('d=1h,i=2m')).toBeNull();
  });

  it('rejects invalid thresholds and care windows', () => {
    expect(validateSmartPotConfig('l=50,h=35')).toBe('Watering thresholds must satisfy l < h');
    expect(validateSmartPotConfig('d=0')).toBe('Watering duration and interval must be greater than 0');
    expect(validateSmartPotConfig('ace=1,cs=18:00,ce=08:00')).toBe('When care time is enabled, cs and ce must be increasing HH:MM values');
  });
});
