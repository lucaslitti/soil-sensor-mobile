/**
 * UUID 字节序变体：不同 BLE 栈会以不同字节序暴露同一 128-bit UUID。
 * 出处：react-soil-sensor Web 端 buildUuidVariants。
 */
function reverseBytePairs(value: string): string {
  return value.match(/../g)!.reverse().join('');
}

/** 生成一个 UUID 在多种 BLE 栈下的候选形式。 */
export function buildUuidVariants(uuid: string): string[] {
  const normalized = uuid.toLowerCase();
  const [part1, part2, part3, part4, part5] = normalized.split('-');
  if (!part5) return [normalized];
  const variants = new Set<string>([
    normalized,
    `${reverseBytePairs(part1)}-${part2}-${part3}-${part4}-${part5}`,
    `${reverseBytePairs(part1)}-${reverseBytePairs(part2)}-${reverseBytePairs(
      part3,
    )}-${part4}-${part5}`,
  ]);
  return [...variants];
}
