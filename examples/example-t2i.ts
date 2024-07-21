import { CallWrapper } from "../src/call-wrapper";
import { ComfyApi } from "../src/client";
import { PromptBuilder } from "../src/prompt-builder";
import ExampleTxt2ImgWorkflow from "./example-txt2img-workflow.json";

/**
 * Define a prompt for image to image task
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
    "width",
    "height",
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
  .setOutputNode("images", "9");

/**
 * Initialize the client
 */
const api = new ComfyApi("http://localhost:8189").init();
/**
 * Execute the workflow
 */

const workflow = Txt2ImgPrompt.caller
  .input("seed", 23141223291)
  .input("step", 20)
  .input("width", 1024)
  .input("height", 1024)
  .input("batch", 3)
  .input("positive", "A picture miku under space");

new CallWrapper<typeof workflow>(api, workflow)
  .onStart(() => console.log("Task is started"))
  .onPreview((blob) => console.log(blob))
  .onFinished((data) => {
    console.log(data.images?.images.map((img: any) => api.getPathImage(img)));
  })
  .onProgress((info) =>
    console.log("Processing node", info.node, `${info.value}/${info.max}`)
  )
  .onFailed((err) => console.log("Task is failed", err))
  .run();
