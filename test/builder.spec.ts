import { PromptBuilder } from "src/prompt-builder";
import Prompt from "../examples/example-txt2img-workflow.json";

describe("PromptBuilder with complex input", () => {
  let promptBuilder: PromptBuilder<"size", "images", typeof Prompt>;

  beforeEach(() => {
    promptBuilder = new PromptBuilder(Prompt, ["size"], ["images"]);
  });

  it("should set and append input nodes correctly", () => {
    promptBuilder.setInputNode("size", "5.inputs.width");
    promptBuilder.appendInputNode("size", "5.inputs.height");

    expect(promptBuilder.mapInputKeys["size"]).toEqual([
      "5.inputs.width",
      "5.inputs.height",
    ]);
  });

  it("should set output nodes correctly", () => {
    promptBuilder.setOutputNode("images", "9");

    expect(promptBuilder.mapOutputKeys["images"]).toBe("9");
  });

  it("should update input values correctly", () => {
    promptBuilder.setInputNode("size", "5.inputs.width");
    promptBuilder.appendInputNode("size", "5.inputs.height");

    const newPromptBuilder = promptBuilder.input("size", 1600);

    expect(newPromptBuilder.prompt["5"].inputs.width).toBe(1600);
    expect(newPromptBuilder.prompt["5"].inputs.height).toBe(1600);
  });

  it("should have correct initial values for complex input structure", () => {
    expect(promptBuilder.prompt["3"].inputs.seed).toBe(509648683700218);
    expect(promptBuilder.prompt["4"].inputs.ckpt_name).toBe(
      "SDXL/dreamshaperXL_v2TurboDpmppSDE.safetensors"
    );
    expect(promptBuilder.prompt["6"].inputs.text).toBe(
      "beautiful scenery nature glass bottle landscape"
    );
    expect(promptBuilder.prompt["7"].inputs.text).toBe("text, watermark");
    expect(promptBuilder.prompt["8"].inputs.samples).toEqual(["3", 0]);
    expect(promptBuilder.prompt["9"].inputs.filename_prefix).toBe("ComfyUI");
    expect(promptBuilder.prompt["10"].inputs.model_name).toBe(
      "4x-ClearRealityV1.pth"
    );
    expect(promptBuilder.prompt["11"].inputs.upscale_model).toEqual(["10", 0]);
    expect(promptBuilder.prompt["12"].inputs.filename_prefix).toBe("ComfyUI");
  });
});
