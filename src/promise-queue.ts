import { Queue } from './queue';
import Timeout = NodeJS.Timeout;

class DeferredPromise<T> {
  readonly promise: Promise<T>;
  resolve: (value?: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export interface DeferredMessage<M, R> {
  timestamp: number;
  message: M;
  promise: DeferredPromise<R>;
}

export abstract class PromiseBasedQueue<M, R> implements Queue<M, R> {
  protected readonly queuedMessages: DeferredMessage<M, R>[];
  private timeout: Timeout;

  protected constructor() {
    this.queuedMessages = [];
  }

  abstract consume(message: R): boolean;

  setTimeout(timeout: number) {
    if (timeout && timeout > 0) {
      this.timeout = setTimeout(() => {
        this.cleanPending(timeout);
      }, timeout);
    }
  }

  cleanPending(timeout: number) {
    const timestamp = new Date().getTime();
    const toKeep = this.queuedMessages.reduce((keep: DeferredMessage<M, R>[], value) => {
      const delta = timestamp - value.timestamp;
      if (delta > timeout) {
        console.error(
          `Rejecting unresolved promise after ${delta}ms (${JSON.stringify(value.message)})`
        );
        value.promise.reject(new Error(`Timeout for message:  ${JSON.stringify(value.message)}`));
        return keep;
      }
      keep.push(value);
      return keep;
    }, []);
    this.flush();
    this.queuedMessages.push(...toKeep);
    this.timeout.refresh();
  }

  flush(shutdown?: boolean): void {
    if (shutdown) {
      this.queuedMessages.forEach(value => value.promise.reject(new Error('Shutting down')));
    }
    this.queuedMessages.length = 0;
  }

  processQueue(response: R) {
    if (this.consume(response)) {
      console.log(`Message processed. Message queue size is now ${this.queuedMessages.length}`);
    } else {
      console.error('Received message could not be processed', response);
    }
  }

  enqueue(message: M): Promise<R> {
    const timestamp = new Date().getTime();
    const promise = new DeferredPromise<R>();
    this.queuedMessages.push({ timestamp, message, promise });
    console.log(`Message queue size is ${this.queuedMessages.length}`);
    return promise.promise;
  }
}
