/* eslint-disable no-bitwise */
/**
 * Codec 黄金测试用例（协议事实直接固化）。
 */
import { ReadingDecoder } from '../src/domain/services/readingDecoder';
import { ProtocolError } from '../src/domain/errors';

const u8 = (...bytes: number[]) => Uint8Array.from(bytes);

describe('decodeLive', () => {
  it('解码正常实时读数', () => {
    // moist=0x28→20.0%  temp=0x1E→15.0℃  ec=0x64→5.00 mS/cm  ts=0x00000001→1s
    const r = ReadingDecoder.decodeLive(u8(0x28), u8(0x1e), u8(0x64), u8(0x01, 0, 0, 0));
    expect(r.moisturePercent).toBe(20.0);
    expect(r.temperatureC).toBe(15.0);
    expect(r.soilEc).toBe(5.0);
    expect(r.timestamp).toBe(1000);
    expect(r.source).toBe('gatt');
  });

  it('EC 实时路径为 /20', () => {
    expect(ReadingDecoder.decodeLive(u8(0), u8(0), u8(0xff), u8(0, 0, 0, 0)).soilEc).toBeCloseTo(
      0xff / 20,
      6,
    );
  });

  it('负温符号扩展', () => {
    // int8 0xEC = -20 -> -10.0℃
    expect(ReadingDecoder.decodeLive(u8(0), u8(0xec), u8(0), u8(0, 0, 0, 0)).temperatureC).toBe(
      -10.0,
    );
  });

  it('时间戳为 0 时回退当前时间', () => {
    const r = ReadingDecoder.decodeLive(u8(0), u8(0), u8(0), u8(0, 0, 0, 0));
    expect(r.timestamp).toBeGreaterThan(0);
  });

  it('字节数不足抛 ProtocolError', () => {
    expect(() => ReadingDecoder.decodeLive(u8(), u8(0), u8(0), u8(0, 0, 0, 0))).toThrow(
      ProtocolError,
    );
    expect(() => ReadingDecoder.decodeLive(u8(0), u8(0), u8(0), u8(0, 0, 0))).toThrow(
      ProtocolError,
    );
  });
});

describe('decodeRecord', () => {
  it('解码 32 字节为 8 条子记录', () => {
    const rec = new Uint8Array(32);
    // 子记录 0：record=0x03, sub=1, moist=0x28, temp=0x1e, ec=0x64
    rec[0] = (1 << 5) | 0x03;
    rec[1] = 0x28;
    rec[2] = 0x1e;
    rec[3] = 0x64;
    const subs = ReadingDecoder.decodeRecord(rec);
    expect(subs).toHaveLength(8);
    expect(subs[0]).toMatchObject({
      recordIndex: 0x03,
      subIndex: 1,
      isEmpty: false,
      moisturePercent: 20.0,
      temperatureC: 15.0,
    });
  });

  it('EC 记录路径为 /100', () => {
    const rec = new Uint8Array(32);
    rec[3] = 100; // -> 1.00 mS/cm
    expect(ReadingDecoder.decodeRecord(rec)[0].soilEc).toBe(1.0);
  });

  it('空子记录判定', () => {
    const rec = new Uint8Array(32);
    expect(ReadingDecoder.decodeRecord(rec)[0].isEmpty).toBe(true);
  });

  it('非法长度抛 ProtocolError', () => {
    expect(() => ReadingDecoder.decodeRecord(new Uint8Array(31))).toThrow(ProtocolError);
  });
});
