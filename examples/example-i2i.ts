import { ComfyApi } from "../src/client";
import { CallWrapper } from "../src/call-wrapper";
import { PromptBuilder } from "../src/prompt-builder";
import ExampleImg2ImgWorkflow from "./example-img2img-workflow.json";

/**
 * Define a prompt for image to image task
 */
export const Img2ImgPrompt = new PromptBuilder(
  ExampleImg2ImgWorkflow,
  [
    "sourceImg",
    "difference",
    "positive",
    "negative",
    "checkpoint",
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
  .setInputNode("step", "3.inputs.steps")
  .setInputNode("width", "12.inputs.width")
  .setInputNode("height", "12.inputs.height")
  .setOutputNode("images", "9");

/**
 * Initialize the client
 */
const api = new ComfyApi("http://localhost:8188").init();

/**
 * Execute the workflow
 */
const exampleTomImg =
  "https://www.redwolf.in/image/cache/catalog/stickers/tom-face-sticker-india-600x800.jpg";
const downloadImg = await fetch(exampleTomImg);
const imgBlob = await downloadImg.blob();
const uploadedImg = await api.uploadImage(
  imgBlob,
  "tom-face-sticker-india.jpg"
);
if (!uploadedImg) {
  throw new Error("Failed to upload image");
}

const workflow = Img2ImgPrompt.caller
  .input("sourceImg", uploadedImg.info.filename)
  .input("seed", 231412239112)
  .input("difference", 0.6)
  .input("step", 20)
  .input("width", 768)
  .input("height", 768)
  .input("positive", "A picture of cute Miku")
  .input("negative", "text, nsfw, blurry, bad draw, embeddings:easynegative");

new CallWrapper<typeof workflow>(api, workflow)
  .onStart(() => console.log("Task is started"))
  .onPreview((blob) => console.log(blob))
  .onFinished((data) => {
    console.log(data.images?.images.map((img: any) => api.getPathImage(img)));
  })
  .onProgress((info) =>
    console.log("Processing node", info.node, `${info.value}/${info.max}`)
  )
  .onFailed(() => console.log("Task is failed"))
  .run();
