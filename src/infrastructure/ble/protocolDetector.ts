export type SensorProtocol = 'soil-sensor' | 'smart-pot';

/** 服务发现后的协议路由入口；未来固件版本在这里扩展，不污染 Application。 */
export class ProtocolDetector {
  detect(name: string | null, services: readonly string[] = []): SensorProtocol {
    const normalized = (name ?? '').toLowerCase();
    if (normalized.startsWith('smartpot')) return 'smart-pot';
    if (normalized.startsWith('soil sensor-')) return 'soil-sensor';
    if (services.some(service => service.toLowerCase().includes('6f3f0000'))) return 'smart-pot';
    return 'soil-sensor';
  }
}
