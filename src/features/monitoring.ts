import { ComfyApi } from "src/client";
import { SYSTEM_INFO_EXTENSION } from "src/contansts";

export class MonitoringFeature {
  client: ComfyApi;
  supported = false;

  constructor(client: ComfyApi) {
    this.client = client;
  }

  async checkSupported() {
    const data = await this.client.getNodeDefs(SYSTEM_INFO_EXTENSION);
    if (data) {
      this.supported = true;
    }
    return this.supported;
  }
}
