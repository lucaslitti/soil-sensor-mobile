export class SoilEc {
  private constructor(
    readonly value: number,
    readonly source: 'live' | 'record',
  ) {}

  static fromLiveRaw(raw: number): SoilEc {
    return new SoilEc(raw / 20, 'live');
  }

  static fromRecordRaw(raw: number): SoilEc {
    return new SoilEc(raw / 100, 'record');
  }
}
