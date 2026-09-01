export function suppressLowVolume(count: number, threshold = 5): number | null {
  return count < threshold ? null : count;
}
