/* eslint-disable no-bitwise */
/**
 * 极简 base64 -> Uint8Array 解码（ble-plx 以 base64 字符串返回特征值）。
 * 避免在 RN 里依赖 Buffer polyfill。
 */
const CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(b64: string): Uint8Array {
  // 去除可能的空白
  const cleaned = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of cleaned) {
    if (ch === '=') break;
    const val = CHARS.indexOf(ch);
    if (val === -1) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  let out = '';
  for (let i = 0; i < binary.length; i += 3) {
    const c1 = binary.charCodeAt(i);
    const c2 = i + 1 < binary.length ? binary.charCodeAt(i + 1) : NaN;
    const c3 = i + 2 < binary.length ? binary.charCodeAt(i + 2) : NaN;
    out += CHARS[c1 >> 2];
    out += CHARS[((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4)];
    out += isNaN(c2) ? '=' : CHARS[((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6)];
    out += isNaN(c3) ? '=' : CHARS[c3 & 63];
  }
  return out;
}
