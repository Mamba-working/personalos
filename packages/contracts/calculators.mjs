/** Trusted named function. No model-authored executable code or formula evaluation. */
export const CALCULATOR_VERSION = 'concurrency-v1';
export function calculateConcurrency(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Concurrency input must be an object');
  const { taskCount, taskDurationMs, maxConcurrency, overheadMs, serialFraction = 0 } = input;
  if (!Number.isInteger(taskCount) || taskCount < 1 || taskCount > 10000 ||
      !Number.isInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > 256 ||
      !Number.isFinite(taskDurationMs) || taskDurationMs < 0.1 || taskDurationMs > 3600000 ||
      !Number.isFinite(overheadMs) || overheadMs < 0 || overheadMs > 60000 ||
      !Number.isFinite(serialFraction) || serialFraction < 0 || serialFraction > 1) throw new RangeError('Concurrency input is outside the supported bounds');
  const effectiveConcurrency = Math.min(taskCount, maxConcurrency);
  const batches = Math.ceil(taskCount / effectiveConcurrency);
  const sequentialMs = taskCount * taskDurationMs;
  const serialMs = sequentialMs * serialFraction;
  const parallelWorkMs = batches * taskDurationMs * (1 - serialFraction);
  const parallelMs = serialMs + parallelWorkMs + batches * overheadMs;
  const speedup = sequentialMs / parallelMs;
  return { sequentialMs, parallelMs, speedup, batches, effectiveConcurrency, parallelEfficiency: speedup / effectiveConcurrency };
}
