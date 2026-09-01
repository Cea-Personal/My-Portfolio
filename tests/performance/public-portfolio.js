/** Lightweight CI budget guard; browser metrics are collected by the release runner. */
export const budgets = {
  firstContentfulPaintMs: 1800,
  largestContentfulPaintMs: 2500,
  initialJsKb: 250
};

export function withinBudget(metrics) {
  return (
    metrics.fcp <= budgets.firstContentfulPaintMs &&
    metrics.lcp <= budgets.largestContentfulPaintMs &&
    metrics.initialJsKb <= budgets.initialJsKb
  );
}
