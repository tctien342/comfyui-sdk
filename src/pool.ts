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
  clients: ComfyApi[];
  queueInfo: number[] = [];
  pickingInfo: boolean[] = [];
  mode: EQueueMode = EQueueMode.PICK_ZERO;

  jobQueue: ((api: ComfyApi) => Promise<void>)[] = [];

  /**
   * This is for PICK_ROUTINE mode
   */
  routineIdx: number = 0;

  picking = false;

  /**
   * Represents a pool of ComfyApi clients.
   * @param clients - An array of ComfyApi instances.
   * @param mode - The queue mode for the pool. Defaults to "PICK_ZERO".
   */
  constructor(clients: ComfyApi[], mode: EQueueMode = EQueueMode.PICK_ZERO) {
    this.clients = clients;
    for (let i = 0; i < clients.length; i++) {
      this.queueInfo.push(0);
      this.pickingInfo.push(false);
      this.clients[i].on("status", (ev) => {
        this.queueInfo[i] = ev.detail.exec_info.queue_remaining as number;
        if (this.queueInfo[i] > 0) {
          this.pickingInfo[i] = false;
        }
      });
      this.clients[i].init();
    }
    this.mode = mode;
    return this;
  }

  addClient(client: ComfyApi) {
    this.clients.push(client);
    this.queueInfo.push(0);
    const index = this.clients.length - 1;
    this.clients[index].on("status", (ev) => {
      this.queueInfo[index] = ev.detail.exec_info.queue_remaining as number;
    });
  }

  removeClient(client: ComfyApi) {
    const index = this.clients.indexOf(client);
    if (index !== -1) {
      this.clients.splice(index, 1);
      this.queueInfo.splice(index, 1);
    }
  }

  private claim(fn: (client: ComfyApi) => Promise<void>) {
    this.jobQueue.push(fn);
    this.pickJob();
  }

  /**
   * Run a task on the pool.
   */
  run<T>(claim: (client: ComfyApi) => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      this.claim(async (client) => {
        try {
          resolve(await claim(client));
        } catch (e) {
          console.error(e);
          reject(e);
        }
      });
    });
  }

  /**
   * Run a batch of tasks on the pool.
   */
  batch<T>(claims: ((client: ComfyApi) => Promise<T>)[]) {
    const promises = claims.map((task) => {
      return this.run(task);
    });
    return Promise.all(promises);
  }

  private async getAvailableClient() {
    switch (this.mode) {
      case EQueueMode.PICK_ZERO: {
        let found = -1;
        while (found === -1) {
          found = this.queueInfo.findIndex((crr, idx) => {
            if (crr === 0 && !this.pickingInfo[idx]) return true;
            return false;
          });
          if (found === -1) {
            await delay(50);
          }
        }
        this.queueInfo[found] = 1;
        this.pickingInfo[found] = true;
        return this.clients[found];
      }
      case EQueueMode.PICK_LOWEST: {
        // Pick lowest queue remaining
        let found = -1;
        let min = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < this.queueInfo.length; i++) {
          if (this.queueInfo[i] < min) {
            min = this.queueInfo[i];
            found = i;
          }
        }
        this.queueInfo[found] = +1;
        return this.clients[found];
      }
      case EQueueMode.PICK_ROUTINE: {
        const found = this.routineIdx;
        this.routineIdx = (this.routineIdx + 1) % this.clients.length;
        return this.clients[found];
      }
    }
  }

  private async pickJob() {
    if (this.picking) return;
    if (this.jobQueue.length === 0) return;
    const job = this.jobQueue.shift();
    this.picking = true;
    const client = await this.getAvailableClient();
    job?.(client);
    this.picking = false;
    this.pickJob();
  }
}
