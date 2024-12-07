import { AbstractFeature } from "./abstract";

const SYSTEM_MONITOR_EXTENSION = encodeURIComponent("Primitive boolean [Crystools]");

export type TMonitorEvent = {
  cpu_utilization: number;
  ram_total: number;
  ram_used: number;
  ram_used_percent: number;
  hdd_total: number;
  hdd_used: number;
  hdd_used_percent: number;
  device_type: "cuda";
  gpus: Array<{
    gpu_utilization: number;
    gpu_temperature: number;
    vram_total: number;
    vram_used: number;
    vram_used_percent: number;
  }>;
};

export type TMonitorEventMap = {
  system_monitor: CustomEvent<TMonitorEvent>;
};

export class MonitoringFeature extends AbstractFeature {
  private resources?: TMonitorEvent;
  private binded = false;

  async checkSupported() {
    const data = await this.client.getNodeDefs(SYSTEM_MONITOR_EXTENSION);
    if (data) {
      this.supported = true;
      this.bind();
    }
    return this.supported;
  }

  public on<K extends keyof TMonitorEventMap>(
    type: K,
    callback: (event: TMonitorEventMap[K]) => void,
    options?: AddEventListenerOptions | boolean
  ) {
    this.addEventListener(type, callback as any, options);
    return () => this.off(type, callback);
  }

  public off<K extends keyof TMonitorEventMap>(
    type: K,
    callback: (event: TMonitorEventMap[K]) => void,
    options?: EventListenerOptions | boolean
  ): void {
    this.removeEventListener(type, callback as any, options);
  }

  /**
   * Gets the monitor data.
   *
   * @returns The monitor data if supported, otherwise false.
   */
  get monitorData() {
    if (!this.supported) {
      return false;
    }
    return this.resources;
  }

  private bind() {
    if (this.binded) {
      return;
    } else {
      this.binded = true;
    }
    this.client.on("all", (ev) => {
      const msg = ev.detail;
      if (msg.type === "crystools.monitor") {
        this.resources = msg.data;
        this.dispatchEvent(new CustomEvent("system_monitor", { detail: msg.data }));
      }
    });
  }
}
