/** Serialize work per document without retaining closed document keys. */
export class KeyedTaskQueue {
  private readonly pending = new Map<string, Promise<unknown>>();

  run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(key) ?? Promise.resolve();
    const task = previous.catch(() => {}).then(operation);
    this.pending.set(key, task);
    const cleanup = () => {
      if (this.pending.get(key) === task) this.pending.delete(key);
    };
    void task.then(cleanup, cleanup);
    return task;
  }

  async drain(): Promise<void> {
    while (this.pending.size) await Promise.allSettled([...this.pending.values()]);
  }
}

export const documentTasks = new KeyedTaskQueue();
