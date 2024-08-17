import { CallWrapper } from "../src/call-wrapper";
import { ComfyApi } from "../src/client";
import { PromptBuilder } from "../src/prompt-builder";
import { seed } from "../src/tools";
import { TSamplerName, TSchedulerName } from "../src/types/sampler";
import ExampleTxt2ImgWorkflow from "./example-txt2img-upscaled-workflow.json";

/**
 * Define a T2I (text to image) with upscale step using model task
 */
export const Txt2ImgPrompt = new PromptBuilder(
  ExampleTxt2ImgWorkflow,
  [
    "positive",
    "negative",
    "checkpoint",
    "seed",
    "batch",
    "step",
    "cfg",
    "sampler",
    "sheduler",
    "width",
    "height",
  ],
  ["images", "upscaled"]
)
  .setInputNode("checkpoint", "4.inputs.ckpt_name")
  .setInputNode("seed", "3.inputs.seed")
  .setInputNode("batch", "5.inputs.batch_size")
  .setInputNode("negative", "7.inputs.text")
  .setInputNode("positive", "6.inputs.text")
  .setInputNode("cfg", "3.inputs.cfg")
  .setInputNode("sampler", "3.inputs.sampler_name")
  .setInputNode("sheduler", "3.inputs.scheduler")
  .setInputNode("step", "3.inputs.steps")
  .setInputNode("width", "5.inputs.width")
  .setInputNode("height", "5.inputs.height")
  .setOutputNode("images", "9")
  .setOutputNode("upscaled", "12");

/**
 * Initialize the client
 */
const api = new ComfyApi("http://192.168.15.37:8189").init();

/**
 * Set the workflow's input values
 */
const workflow = Txt2ImgPrompt.input(
  "checkpoint",
  "SDXL/realvisxlV40_v40LightningBakedvae.safetensors",
  /**
   * Use the client's osType to encode the path
   */
  api.osType
)
  .input("seed", seed())
  .input("step", 6)
  .input("cfg", 1)
  .input<TSamplerName>("sampler", "dpmpp_2m_sde_gpu")
  .input<TSchedulerName>("sheduler", "sgm_uniform")
  .input("width", 1024)
  .input("height", 1024)
  .input("batch", 1)
  .input("positive", "A picture of cute dog on the street");

/**
 * Execute the workflow
 */
new CallWrapper<typeof workflow>(api, workflow)
  .onPending(() => console.log("Task is pending"))
  .onStart(() => console.log("Task is started"))
  .onPreview((blob) => console.log(blob))
  /**
   * Preview output of executed node
   */
  .onOutput((outputName, outputVal) =>
    console.log(`Output ${outputName} with value`, outputVal)
  )
  .onFinished((data) => {
    console.log("Final output", {
      images: data.images?.images.map((img: any) => api.getPathImage(img)),
      upscaled: data.upscaled?.images.map((img: any) => api.getPathImage(img)),
    });
  })
  .onProgress((info) =>
    console.log("Processing node", info.node, `${info.value}/${info.max}`)
  )
  .onFailed((err) => console.log("Task is failed", err))
  .run();
