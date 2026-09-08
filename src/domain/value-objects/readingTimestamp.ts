import { ProtocolError } from '../errors';

export class ReadingTimestamp {
  private constructor(readonly epochMs: number) {}

  static fromUint32LeSeconds(bytes: Uint8Array, now = Date.now()): ReadingTimestamp {
    if (bytes.length < 4) throw new ProtocolError('Timestamp has too few bytes');
    const seconds = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
    return new ReadingTimestamp(seconds > 0 ? seconds * 1000 : now);
  }
}
