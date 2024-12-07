import { ComfyApi } from "../src/client";
import { CallWrapper } from "../src/call-wrapper";
import { PromptBuilder } from "../src/prompt-builder";
import ExampleImg2ImgWorkflow from "./example-img2img-workflow.json";
import { TSamplerName, TSchedulerName } from "../src/types/sampler";
import { seed } from "../src/tools";

/**
 * Define a I2I (image to image) workflow task
 */
export const Img2ImgPrompt = new PromptBuilder(
  ExampleImg2ImgWorkflow,
  [
    "sourceImg",
    "difference",
    "positive",
    "negative",
    "checkpoint",
    "cfg",
    "sampler",
    "sheduler",
    "seed",
    "step",
    "width",
    "height",
  ],
  ["images"]
)
  .setInputNode("sourceImg", "10.inputs.image")
  .setInputNode("checkpoint", "4.inputs.ckpt_name")
  .setInputNode("difference", "3.inputs.denoise")
  .setInputNode("seed", "3.inputs.seed")
  .setInputNode("negative", "7.inputs.text")
  .setInputNode("positive", "6.inputs.text")
  .setInputNode("cfg", "3.inputs.cfg")
  .setInputNode("sampler", "3.inputs.sampler_name")
  .setInputNode("sheduler", "3.inputs.scheduler")
  .setInputNode("step", "3.inputs.steps")
  .setInputNode("width", "12.inputs.width")
  .setInputNode("height", "12.inputs.height")
  .setOutputNode("images", "9");

/**
 * Initialize the client
 */
const api = new ComfyApi("http://localhost:8189").init();

/**
 * Prepare the image to be uploaded
 */
const exampleTomImg =
  "https://www.redwolf.in/image/cache/catalog/stickers/tom-face-sticker-india-600x800.jpg";
const downloadImg = await fetch(exampleTomImg);
const imgBlob = await downloadImg.blob();

/**
 * Upload the source image to ComfyUI server
 */
const uploadedImg = await api.uploadImage(
  imgBlob,
  "tom-face-sticker-india.jpg"
);
if (!uploadedImg) {
  throw new Error("Failed to upload image");
} else {
  console.log("Uploaded source image", uploadedImg.url);
}

/**
 * Set the workflow's input values
 */
const workflow = Img2ImgPrompt.input(
  "checkpoint",
  "SDXL/realvisxlV40_v40LightningBakedvae.safetensors",
  /**
   * Use the client's osType to encode the path
   */
  api.osType
)
  .input("sourceImg", uploadedImg.info.filename)
  .input("seed", seed())
  .input("difference", 0.6)
  .input("step", 4)
  .input("cfg", 1)
  .input<TSamplerName>("sampler", "dpmpp_2m_sde_gpu")
  .input<TSchedulerName>("sheduler", "sgm_uniform")
  .input("width", 768)
  .input("height", 768)
  .input("positive", "A picture of cute cat")
  .input("negative", "text, nsfw, blurry, bad draw, embeddings:easynegative");

new CallWrapper(api, workflow)
  .onPending(() => console.log("Task is pending"))
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
