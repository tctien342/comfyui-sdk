import type { ComfyApi } from "./client";
import { delay } from "./tools";

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

export class ComfyPool {
  public clients: ComfyApi[] = [];
  private clientStates: Array<{
    queueRemaining: number;
    locked: boolean;
    online: boolean;
  }> = [];

  private mode: EQueueMode = EQueueMode.PICK_ZERO;
  private jobQueue: Array<
    (api: ComfyApi, clientIdx?: number) => Promise<void>
  > = [];

  private routineIdx: number = 0;

  constructor(clients: ComfyApi[], mode: EQueueMode = EQueueMode.PICK_ZERO) {
    this.clients = clients;
    this.mode = mode;
    this.clientStates = clients.map(() => ({
      queueRemaining: 0,
      locked: false,
      online: false,
    }));
    this.clients.forEach((client, index) =>
      this.initializeClient(client, index)
    );
    this.pickJob();
  }

  addClient(client: ComfyApi): void {
    this.clients.push(client);
    this.clientStates.push({ queueRemaining: 0, locked: false, online: false });
    this.initializeClient(client, this.clients.length - 1);
  }

  removeClient(client: ComfyApi): void {
    const index = this.clients.indexOf(client);
    if (index !== -1) {
      this.clients.splice(index, 1);
      this.clientStates.splice(index, 1);
    }
  }

  removeClientByIndex(index: number): void {
    if (index >= 0 && index < this.clients.length) {
      this.clients.splice(index, 1);
      this.clientStates.splice(index, 1);
    }
  }

  changeMode(mode: EQueueMode): void {
    this.mode = mode;
  }

  pick(idx: number = 0): ComfyApi {
    return this.clients[idx];
  }

  run<T>(
    job: (client: ComfyApi, clientIdx?: number) => Promise<T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.claim(async (client, idx) => {
        try {
          resolve(await job(client, idx));
        } catch (e) {
          console.error(e);
          reject(e);
        }
      });
    });
  }

  batch<T>(
    jobs: Array<(client: ComfyApi, clientIdx?: number) => Promise<T>>
  ): Promise<T[]> {
    return Promise.all(jobs.map((task) => this.run(task)));
  }

  private initializeClient(client: ComfyApi, index: number): void {
    const states = this.clientStates[index];
    client.on("status", (ev) => {
      states.online = true;
      states.queueRemaining = ev.detail.status.exec_info.queue_remaining;
      if (this.mode !== EQueueMode.PICK_ZERO) {
        states.locked = false;
      }
    });
    client.on("disconnected", () => {
      states.online = false;
      states.locked = true;
    });
    client.on("reconnected", () => {
      states.online = true;
      states.locked = false;
    });
    client.init();
  }

  private async claim(
    fn: (client: ComfyApi, clientIdx?: number) => Promise<void>
  ): Promise<void> {
    this.jobQueue.push(fn);
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
    job?.(client, clientIdx).finally(() => {
      this.clientStates[clientIdx].locked = false;
    });
    this.pickJob();
  }
}
