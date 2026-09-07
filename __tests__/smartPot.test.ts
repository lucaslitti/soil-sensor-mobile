import { parseSmartPotHistory, validateSmartPotConfig } from '../src/features/sensor/domain/smartPot';

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
    expect(validateSmartPotConfig('l=50,h=35')).toBe('浇水阈值需满足 l < h');
    expect(validateSmartPotConfig('d=0')).toBe('浇水时长和间隔必须大于 0');
    expect(validateSmartPotConfig('ace=1,cs=18:00,ce=08:00')).toBe('启用照护时段时，cs 和 ce 必须为递增的 HH:MM');
  });
});
