import { TComfyPoolEventMap } from "./types/event";
import { ComfyApi } from "./client";
import { delay } from "./tools";
import { SYSTEM_INFO_EXTENSION } from "./contansts";

interface JobItem {
  weight: number;
  fn: (api: ComfyApi, clientIdx?: number) => Promise<void>;
}

/**
 * Represents the mode for picking clients from a queue.
 *
 * - "PICK_ZERO": Picks the client which has zero queue remaining. This is the default mode. (For who using along with ComfyUI web interface)
 * - "PICK_LOWEST": Picks the client which has the lowest queue remaining.
 * - "PICK_ROUTINE": Picks the client in a round-robin manner.
 */
export enum EQueueMode {
  /**
   * Picks the client which has zero queue remaining. This is the default mode. (For who using along with ComfyUI web interface)
   */
  "PICK_ZERO",
  /**
   * Picks the client which has the lowest queue remaining.
   */
  "PICK_LOWEST",
  /**
   * Picks the client in a round-robin manner.
   */
  "PICK_ROUTINE",
}

export class ComfyPool extends EventTarget {
  public clients: ComfyApi[] = [];
  private clientStates: Array<{
    queueRemaining: number;
    locked: string | boolean;
    online: boolean;
  }> = [];

  private mode: EQueueMode = EQueueMode.PICK_ZERO;
  private jobQueue: Array<JobItem> = [];

  private routineIdx: number = 0;

  constructor(clients: ComfyApi[], mode: EQueueMode = EQueueMode.PICK_ZERO) {
    super();
    this.clients = clients;
    this.mode = mode;
    this.clientStates = clients.map(() => ({
      queueRemaining: 0,
      locked: false,
      online: false,
    }));
    this.startUp();
  }

  private async startUp() {
    /**
     * Wait for 50ms before initializing event listeners
     */
    await delay(50);
    this.dispatchEvent(new CustomEvent("init"));
    this.clients.forEach((client, index) =>
      this.initializeClient(client, index)
    );
    this.pickJob();
  }

  public on<K extends keyof TComfyPoolEventMap>(
    type: K,
    callback: (event: TComfyPoolEventMap[K]) => void,
    options?: AddEventListenerOptions | boolean
  ) {
    this.addEventListener(type, callback as any, options);
    return this;
  }

  public off<K extends keyof TComfyPoolEventMap>(
    type: K,
    callback: (event: TComfyPoolEventMap[K]) => void,
    options?: EventListenerOptions | boolean
  ) {
    this.removeEventListener(type, callback as any, options);
    return this;
  }

  addClient(client: ComfyApi): void {
    const index = this.clients.push(client);
    this.clientStates.push({ queueRemaining: 0, locked: false, online: false });
    this.initializeClient(client, this.clients.length - 1);
    this.dispatchEvent(
      new CustomEvent("added", { detail: { client, clientIdx: index } })
    );
  }

  removeClient(client: ComfyApi): void {
    const index = this.clients.indexOf(client);
    if (index !== -1) {
      this.clients.splice(index, 1);
      this.clientStates.splice(index, 1);
      this.dispatchEvent(
        new CustomEvent("removed", { detail: { client, clientIdx: index } })
      );
    }
  }

  removeClientByIndex(index: number): void {
    if (index >= 0 && index < this.clients.length) {
      const client = this.clients.splice(index, 1)[0];
      this.clientStates.splice(index, 1);
      this.dispatchEvent(
        new CustomEvent("removed", { detail: { client, clientIdx: index } })
      );
    }
  }

  changeMode(mode: EQueueMode): void {
    this.mode = mode;
    this.dispatchEvent(new CustomEvent("change_mode", { detail: { mode } }));
  }

  pick(idx: number = 0): ComfyApi {
    return this.clients[idx];
  }

  run<T>(
    job: (client: ComfyApi, clientIdx?: number) => Promise<T>,
    weight?: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const fn = async (client: ComfyApi, idx?: number) => {
        this.dispatchEvent(
          new CustomEvent("executing", { detail: { client, clientIdx: idx } })
        );
        try {
          resolve(await job(client, idx));
          this.dispatchEvent(
            new CustomEvent("executed", { detail: { client, clientIdx: idx } })
          );
        } catch (e) {
          console.error(e);
          reject(e);
          this.dispatchEvent(
            new CustomEvent("execution_error", {
              detail: { client, clientIdx: idx, error: e },
            })
          );
        }
      };
      this.claim(fn, weight);
    });
  }

  batch<T>(
    jobs: Array<(client: ComfyApi, clientIdx?: number) => Promise<T>>,
    weight?: number
  ): Promise<T[]> {
    return Promise.all(jobs.map((task) => this.run(task, weight)));
  }

  private initializeClient(client: ComfyApi, index: number): void {
    this.dispatchEvent(
      new CustomEvent("loading_client", {
        detail: { client, clientIdx: index },
      })
    );
    const states = this.clientStates[index];
    client.on("status", (ev) => {
      if (states.online === false) {
        this.dispatchEvent(
          new CustomEvent("connected", { detail: { client, clientIdx: index } })
        );
      }
      states.online = true;
      if (
        ev.detail.status.exec_info.queue_remaining !== states.queueRemaining
      ) {
        if (ev.detail.status.exec_info.queue_remaining > 0) {
          this.dispatchEvent(
            new CustomEvent("have_job", {
              detail: { client, remain: states.queueRemaining },
            })
          );
        }
        if (ev.detail.status.exec_info.queue_remaining === 0) {
          this.dispatchEvent(new CustomEvent("idle", { detail: { client } }));
        }
      }
      states.queueRemaining = ev.detail.status.exec_info.queue_remaining;
      if (this.mode !== EQueueMode.PICK_ZERO) {
        states.locked = false;
      }
    });
    client.on("disconnected", () => {
      states.online = false;
      states.locked = false;
      this.dispatchEvent(
        new CustomEvent("disconnected", {
          detail: { client, clientIdx: index },
        })
      );
    });
    client.on("reconnected", () => {
      states.online = true;
      states.locked = false;
      this.dispatchEvent(
        new CustomEvent("reconnected", {
          detail: { client, clientIdx: index },
        })
      );
    });
    client.on("execution_success", (ev) => {
      states.locked = false;
    });
    client.on("execution_error", (ev) => {
      states.locked = false;
    });
    client.on("auth_error", (ev) => {
      this.dispatchEvent(
        new CustomEvent("auth_error", {
          detail: { client, clientIdx: index, res: ev.detail },
        })
      );
    });
    client.on("auth_success", (ev) => {
      this.dispatchEvent(
        new CustomEvent("auth_success", {
          detail: { client, clientIdx: index },
        })
      );
    });
    this.bindClientSystemMonitor(client, index);
    client.init();
  }

  private async bindClientSystemMonitor(client: ComfyApi, index: number) {
    const extensionInfo = await client.getNodeDefs(SYSTEM_INFO_EXTENSION);
    if (extensionInfo) {
      // Have Crystools extension for update real-time system monitor
      this.bindWsSystemMonitor(client, index);
    } else {
      // No Crystools extension for update real-time system monitor
      // Use polling instead
      this.pollingSystemMonitor(client, index);
    }
  }

  private bindWsSystemMonitor(client: ComfyApi, index: number) {
    client.on("crystools.monitor", (ev) => {
      this.dispatchEvent(
        new CustomEvent("system_monitor", {
          detail: {
            client,
            type: "websocket",
            data: ev.detail,
            clientIdx: index,
          },
        })
      );
    });
  }

  private async pollingSystemMonitor(client: ComfyApi, index: number) {
    const data = await client.getSystemStats();
    this.dispatchEvent(
      new CustomEvent("system_monitor", {
        detail: {
          client,
          type: "polling",
          data,
          clientIdx: index,
        },
      })
    );
    await delay(1000);
    this.pollingSystemMonitor(client, index);
  }

  private pushJobByWeight(item: JobItem): number {
    const idx = this.jobQueue.findIndex((job) => job.weight > item.weight);
    if (idx === -1) {
      return this.jobQueue.push(item);
    } else {
      this.jobQueue.splice(idx, 0, item);
      return idx;
    }
  }

  private async claim(
    fn: (client: ComfyApi, clientIdx?: number) => Promise<void>,
    weight?: number
  ): Promise<void> {
    const inputWeight = weight === undefined ? this.jobQueue.length : weight;
    const idx = this.pushJobByWeight({
      weight: inputWeight,
      fn,
    });
    this.dispatchEvent(
      new CustomEvent("add_job", {
        detail: { jobIdx: idx, weight: inputWeight },
      })
    );
  }

  private async getAvailableClient(): Promise<ComfyApi> {
    while (true) {
      let index = -1;
      switch (this.mode) {
        case EQueueMode.PICK_ZERO:
          index = this.clientStates.findIndex(
            (c) => c.queueRemaining === 0 && !c.locked && c.online
          );
          break;
        case EQueueMode.PICK_LOWEST:
          const queueSizes = this.clientStates.map((state) =>
            state.online ? state.queueRemaining : Number.MAX_SAFE_INTEGER
          );
          index = queueSizes.indexOf(Math.min(...queueSizes));
          break;
        case EQueueMode.PICK_ROUTINE:
          index = this.routineIdx++ % this.clients.length;
          this.routineIdx = this.routineIdx % this.clients.length;
          if (!this.clientStates[index].online) index = -1;
          break;
      }
      if (index !== -1 && !this.clientStates[index].locked) {
        this.clientStates[index].locked = true;
        const client = this.clients[index];
        return client;
      }
      await delay(20);
    }
  }

  private async pickJob(): Promise<void> {
    if (this.jobQueue.length === 0) {
      await delay(100);
      return this.pickJob();
    }
    const client = await this.getAvailableClient();
    const clientIdx = this.clients.indexOf(client);
    const job = this.jobQueue.shift();
    job?.fn?.(client, clientIdx);
    this.pickJob();
  }
}
