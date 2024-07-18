import { ComfyApi } from "../src/client";
import { CallWrapper } from "../src/call-wrapper";
import { ComfyPool, EQueueMode } from "../src/pool";
import { PromptBuilder } from "../src/prompt-builder";
import ExampleTxt2ImgWorkflow from "./example-txt2img-workflow.json";
import type { TSamplerName, TSchedulerName } from "../types/sampler";

/**
 * Define a prompt for text to image task
 */
export const Txt2ImgPrompt = new PromptBuilder(
  ExampleTxt2ImgWorkflow, // Get from `Save (API Format)` button in ComfyUI's website
  [
    "positive",
    "negative",
    "checkpoint",
    "seed",
    "batch",
    "step",
    "width",
    "height",
    "sampler",
    "scheduler",
  ],
  ["images"]
)
  .setInputNode("checkpoint", "4.inputs.ckpt_name")
  .setInputNode("seed", "3.inputs.seed")
  .setInputNode("batch", "5.inputs.batch_size")
  .setInputNode("negative", "7.inputs.text")
  .setInputNode("positive", "6.inputs.text")
  .setInputNode("step", "3.inputs.steps")
  .setInputNode("width", "5.inputs.width")
  .setInputNode("height", "5.inputs.height")
  .setInputNode("sampler", "3.inputs.sampler_name")
  .setInputNode("scheduler", "3.inputs.scheduler")
  .setOutputNode("images", "9");

/**
 * Define a pool of ComfyApi
 */
const ApiPool = new ComfyPool(
  [
    new ComfyApi("http://192.168.15.204:8188"), // Comfy Instance 1
    new ComfyApi("http://192.168.15.204:8189"), // Comfy Instance 2
  ],
  EQueueMode.PICK_ZERO
);

// Fn to random Int
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

const generateFn = async (api: ComfyApi) => {
  return new Promise<string[]>((resolve) => {
    const seed = 10;
    const workflow = Txt2ImgPrompt.caller
      .input("seed", seed)
      .input("step", 16)
      .input("width", 512)
      .input("height", 512)
      .input("batch", 2)
      .input<TSamplerName>("sampler", "uni_pc")
      .input<TSchedulerName>("scheduler", "sgm_uniform")
      .input("positive", "A close up picture of cute Cat")
      .input("negative", "text, blurry, bad picture, nsfw");

    new CallWrapper<typeof workflow>(api, workflow)
      .onStart(() => console.log(`#${seed}`, "Task is started"))
      .onPreview((blob) => console.log(`#${seed}`, blob))
      .onFinished((data) => {
        console.log(`#${seed}`, "Task is finished");
        const url = data.images?.images.map((img: any) =>
          api.getPathImage(img)
        );
        resolve(url);
      })
      .onProgress((info) =>
        console.log(
          `#${seed}`,
          "Processing node",
          info.node,
          `${info.value}/${info.max}`
        )
      )
      .onFailed(() => console.log(`#${seed}`, "Task is failed"))
      .run();
  });
};
/**
 * Single shoot
 */
// const output = ApiPool.run(generateFn);

/**
 * Multiple shoot using batch
 */
const output = await ApiPool.batch(
  Array(10)
    .fill("")
    .map(() => generateFn)
);

console.log(output.flat());
