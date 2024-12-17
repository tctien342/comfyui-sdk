import { defineCommand, runMain } from "citty";
import { ComfyApi } from "./src/client";

import { writeFileSync } from "fs";

const main = defineCommand({
  meta: {
    name: "comfyui-sdk",
    version: "1.0.0",
    description: "CLI to work with the sdk"
  },
  args: {
    host: {
      type: "string",
      description: "ComfyUI endpoints",
      required: true,
      alias: "h"
    },
    headers: {
      type: "string",
      description: "Header for authentication",
      required: false
    },
    sync: {
      type: "boolean",
      description: "Sync all the node information for type lint",
      required: false
    }
  },
  async run({ args }) {
    return new Promise(async (rs, rj) => {
      const client = new ComfyApi(args.host, "sdk-cli", {
        credentials: args.headers
          ? {
              type: "custom",
              headers: JSON.parse(args.headers)
            }
          : undefined
      });
      client.on("auth_error", (ev) => rj(ev.detail));
      await client.ping().then((res) => {
        if (res.status) {
          console.log("> Connect to ComfyUI server successfully!");
        } else {
          console.warn(new Error("Connection failed, please check your authentication"));
        }
      });

      if (args.sync) {
        console.log("> Syncing node information...");
        try {
          const objectInfo = await client.getNodeDefs();
          // save to file
          writeFileSync("nodeDefs.json", JSON.stringify(objectInfo, null, 2));
          console.log("> Syncing node information successfully!");
        } catch (e) {
          console.error(e);
        }
        return;
      }
    });
  }
});

runMain(main);
