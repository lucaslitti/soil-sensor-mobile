export interface SmartPotHistoryPoint {
  timestamp: number;
  soil: number;
  temperature: number;
  lux: number;
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
    const [timestamp, soil, temperature, lux] = item.trim().split(':');
    const values = [Number(timestamp), Number(soil), Number(temperature), Number(lux)];
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
    if (!key || raw === undefined) return '配置格式应为 key=value，以逗号分隔';
    fields.set(key.trim().toLowerCase(), raw.trim());
  }
  const number = (key: string) => Number(fields.get(key));
  const duration = (key: string) => {
    const match = fields.get(key)?.match(/^(\d+(?:\.\d+)?)\s*([hms]?)$/i);
    if (!match) return NaN;
    const multiplier = match[2].toLowerCase() === 'h' ? 3600 : match[2].toLowerCase() === 'm' ? 60 : 1;
    return Math.round(Number(match[1]) * multiplier);
  };
  if (fields.has('l') && fields.has('h') && (!Number.isFinite(number('l')) || !Number.isFinite(number('h')) || number('l') >= number('h'))) return '浇水阈值需满足 l < h';
  if (fields.has('lon') && fields.has('loff') && (!Number.isInteger(number('lon')) || !Number.isInteger(number('loff')) || number('lon') < 0 || number('loff') < 0 || number('lon') >= number('loff'))) return '光照阈值需满足 lon < loff';
  for (const key of ['d', 'i', 'ld', 'li']) {
    if (fields.has(key) && (!Number.isInteger(duration(key)) || duration(key) < 0 || duration(key) > 65535)) {
      return `${key} 必须是 0 到 65535 的秒数`;
    }
  }
  if ((fields.has('d') && duration('d') === 0) || (fields.has('i') && duration('i') === 0)) return '浇水时长和间隔必须大于 0';
  if (fields.get('ace') === '1') {
    const start = fields.get('cs');
    const end = fields.get('ce');
    const validTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
    if (!start || !end || !validTime(start) || !validTime(end) || start >= end) {
      return '启用照护时段时，cs 和 ce 必须为递增的 HH:MM';
    }
  }
  return null;
}

export function isSmartPotAutoMode(config: string): boolean {
  return /(?:^|[,;])\s*(?:am|automode)\s*=\s*(?:1|true|on)\b/i.test(config);
}
