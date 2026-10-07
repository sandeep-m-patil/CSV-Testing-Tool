/**
 * Runs tasks with at most `workers` in flight. Each task reports whether the
 * run should stop (fail-fast); once it does, no new task starts, while tasks
 * already running finish normally so their evidence is not lost.
 */
export async function runPool<T>(
  items: T[],
  workers: number,
  task: (item: T, index: number) => Promise<{ shouldStop: boolean }>,
): Promise<{ isStopped: boolean; started: number }> {
  let next = 0;
  let isStopped = false;

  async function lane(): Promise<void> {
    while (!isStopped && next < items.length) {
      const index = next;
      next += 1;
      const { shouldStop } = await task(items[index]!, index);
      if (shouldStop) isStopped = true;
    }
  }

  const laneCount = Math.max(1, Math.min(workers, items.length));
  await Promise.all(Array.from({ length: laneCount }, () => lane()));
  return { isStopped, started: next };
}
