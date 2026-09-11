export interface SmartPotHistoryPoint {
  timestamp: number;
  soil: number;
  temperature: number;
  lux: number;
}

export interface SmartPotHistoryChunk {
  more: number;
  records: SmartPotHistoryPoint[];
}

/** 解析单个历史分页块：`c=<chunk>;t=<total>;n=<count>;more=<0|1>;ts:soil:temp:lux;...`。 */
export function parseHistoryChunk(raw: string): SmartPotHistoryChunk {
  const text = (raw ?? '').trim();
  if (!text || text === 'end') return { more: 0, records: [] };
  let more = 0;
  let moreSet = false;
  const records: SmartPotHistoryPoint[] = [];
  for (const part of text.split(';')) {
    const item = part.trim();
    if (!item) continue;
    if (!item.includes(':')) {
      const eq = item.indexOf('=');
      if (eq <= 0) continue;
      if (item.slice(0, eq).trim().toLowerCase() === 'more') {
        more = Number(item.slice(eq + 1).trim());
        moreSet = true;
      }
      continue;
    }
    const values = item.split(':');
    if (values.length !== 4) continue;
    const timestamp = Number(values[0]);
    const soil = Number(values[1]);
    const temperature = Number(values[2]);
    const lux = Number(values[3]);
    if ([timestamp, soil, temperature, lux].every(Number.isFinite)) {
      records.push({ timestamp, soil, temperature, lux });
    }
  }
  return { more: moreSet ? more : records.length === 0 ? 0 : 1, records };
}

export interface SmartPotSnapshot {
  light: string;
  lightSensor: string;
  rgb: string;
  pump: string;
  moisture: string;
  ec: string;
  temperature: string;
  config: string;
  history: SmartPotHistoryPoint[];
}

export function parseSmartPotHistory(raw: string): SmartPotHistoryPoint[] {
  const text = raw.trim();
  if (!text || text === 'end' || text === 'n=0' || text.startsWith('ERR:')) return [];
  const payload = text.startsWith('n=') ? text.split(';').slice(1).join(';') : text;
  return payload.split(/[;,]/).reduce<SmartPotHistoryPoint[]>((points, item) => {
    const values = item.trim().split(':').map(Number);
    if (values.length === 4 && values.every(Number.isFinite)) {
      points.push({ timestamp: values[0], soil: values[1], temperature: values[2], lux: values[3] });
    }
    return points;
  }, []);
}

export function validateSmartPotConfig(value: string): string | null {
  const fields = new Map<string, string>();
  for (const part of value.split(',')) {
    const [key, raw] = part.split('=', 2);
    if (!key || raw === undefined) return 'Config must be key=value pairs separated by commas';
    fields.set(key.trim().toLowerCase(), raw.trim());
  }
  const number = (key: string) => Number(fields.get(key));
  const duration = (key: string) => {
    const match = fields.get(key)?.match(/^(\d+(?:\.\d+)?)\s*([hms]?)$/i);
    if (!match) return NaN;
    const multiplier = match[2].toLowerCase() === 'h' ? 3600 : match[2].toLowerCase() === 'm' ? 60 : 1;
    return Math.round(Number(match[1]) * multiplier);
  };
  if (fields.has('l') && fields.has('h') && (!Number.isFinite(number('l')) || !Number.isFinite(number('h')) || number('l') >= number('h'))) return 'Watering thresholds must satisfy l < h';
  if (fields.has('lon') && fields.has('loff') && (!Number.isInteger(number('lon')) || !Number.isInteger(number('loff')) || number('lon') < 0 || number('loff') < 0 || number('lon') >= number('loff'))) return 'Light thresholds must satisfy lon < loff';
  for (const key of ['d', 'i', 'ld', 'li']) {
    if (fields.has(key) && (!Number.isInteger(duration(key)) || duration(key) < 0 || duration(key) > 65535)) return `${key} must be a number of seconds between 0 and 65535`;
  }
  if ((fields.has('d') && duration('d') === 0) || (fields.has('i') && duration('i') === 0)) return 'Watering duration and interval must be greater than 0';
  if (fields.get('ace') === '1') {
    const start = fields.get('cs');
    const end = fields.get('ce');
    if (!start || !end || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start >= end) return 'When care time is enabled, cs and ce must be increasing HH:MM values';
  }
  return null;
}

export function isSmartPotAutoMode(config: string): boolean {
  return /(?:^|[,;])\s*(?:am|automode)\s*=\s*(?:1|true|on)\b/i.test(config);
}
