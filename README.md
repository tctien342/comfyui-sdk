# @saintno/comfyui-sdk

This SDK provides a comprehensive interface for interacting with ComfyUI, allowing developers to easily integrate ComfyUI's functionalities into their applications. It includes a variety of examples to get started with tasks such as image-to-image (i2i), text-to-image (t2i), and managing API calls efficiently using a pool of ComfyApi instances.

```ts
/**
 * Define a prompt for text to image task
 */
export const Txt2ImgPrompt = new PromptBuilder(
  ExampleTxt2ImgWorkflow, // Get from `Save (API Format)` button in ComfyUI's website
  // Declare input keys
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
  // Decalre output keys
  ["images"]
)
  // Map keys into workflow
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
    new ComfyApi("http://localhost:8188"), // Comfy Instance 1
    new ComfyApi("http://localhost:8189"), // Comfy Instance 2
  ],
  //   "PICK_ZERO", Picks the client which has zero queue remaining. This is the default mode. (For who using along with ComfyUI web interface)
  //   "PICK_LOWEST", Picks the client which has the lowest queue remaining.
  //   "PICK_ROUTINE", Picks the client in a round-robin manner.
  EQueueMode.PICK_ZERO
);

// Fn to random Int
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

const generateFn = async (api: ComfyApi) => {
  return new Promise<string[]>((resolve) => {
    const seed = randomInt(1000, 9999999999);
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
const output = await ApiPool.run(generateFn);

/**
 * Multiple shoot using batch
 */
// const output = await ApiPool.batch([
//   generateFn,
//   generateFn,
//   generateFn,
//   generateFn,
// ]);

console.log(output.flat());
```

## More Example

- **Image-to-Image (i2i) Conversion**: Convert images into different styles or formats using predefined workflows. See [example-i2i.ts](examples/example-i2i.ts) for implementation details.
- **Text-to-Image (t2i) Generation**: Generate images from textual descriptions using advanced AI models. Check out [example-t2i.ts](examples/example-t2i.ts) and [example-txt2img-workflow.json](examples/example-txt2img-workflow.json) for usage.
- **Efficient API Management**: Utilize a pool of ComfyApi instances for load balancing and efficient resource management. Refer to [example-pool.ts](examples/example-pool.ts) for an example.

## Getting Started

To get started with the @saintno/comfyui-sdk, follow these steps:

1. **Install the SDK**:

   ```sh
   npm install @saintno/comfyui-sdk
   ```

2. **Explore the Examples**: Dive into the [examples](examples/) directory to see the SDK in action. Each example demonstrates a different capability of the SDK.

3. **Read the Documentation**: For more detailed information on each component and its usage, refer to the inline documentation within the SDK's source code.

## Client APIs

> The following is a list of available methods in the `ComfyApi` class. These methods can be used to interact with the ComfyUI server.

### Constructor

- **constructor(host: string, clientId?: string)**: initializes a new instance of ComfyApi with the specified host and client ID.

```ts
const api = new ComfyApi("https://comfyui.instance:8188", "your-client-id");
```

### Event Handling

- **on(type, callback, options?)**: Register an event listener.
- **off(type, callback, options?)**: Unregister an event listener.

### General

- **pollStatus()**: Polls status for colab and other non-WebSocket environments.
- **queuePrompt(number, workflow)**: Queues a prompt for processing.
- **getQueue()**: Retrieves the current state of the queue.
- **getHistories(maxItems?)**: Retrieves the prompt execution history.
- **getHistory(promptId)**: Retrieves the history entry for a given prompt ID.
- **getSystemStats()**: Retrieves system and device stats.
- **getExtensions()**: Retrieves a list of extension URLs.
- **getEmbeddings()**: Retrieves a list of embedding names.

### Checkpoints, Loras, and Samplers

- **getCheckpoints()**: Retrieves checkpoints from the server.
- **getLoras()**: Retrieves Loras from the node definitions.
- **getSamplerInfo()**: Retrieves sampler and scheduler information.

### Node Definitions

- **getNodeDefs(nodeName?)**: Retrieves node object definitions for the graph.

### User Management

- **getUserConfig()**: Retrieves user configuration data.
- **createUser(username)**: Creates a new user.

### Settings Management

- **getSettings()**: Retrieves all setting values for the current user.
- **getSetting(id)**: Retrieves a specific setting for the current user.
- **storeSettings(settings)**: Stores a dictionary of settings for the current user.
- **storeSetting(id, value)**: Stores a specific setting for the current user.

### File Management

- **uploadImage(file, fileName, config?)**: Uploads an image file to the server.
- **getPathImage(imageInfo)**: Returns the path to an image based on provided image information.
- **getUserData(file)**: Retrieves a user data file for the current user.
- **storeUserData(file, data, options?)**: Stores a user data file for the current user.
- **deleteUserData(file)**: Deletes a user data file for the current user.
- **moveUserData(source, dest, options?)**: Moves a user data file for the current user.
- **listUserData(dir, recurse?, split?)**: Lists user data files for the current user.

### Execution Control

- **interrupt()**: Interrupts the execution of the running prompt.

### WebSocket Real-Time Updates

- **init()**: Initializes the WebSocket for real-time updates. Must call after create new instance.

## CallWrapper APIs

> For easier to start a render job, we use CallWrapper

- **constructor(client: ComfyApi, workflow: T)**: Creates a new instance of CallWrapper.

### Event Handling

- **onPreview(fn: (ev: Blob) => void)**: Registers a callback for preview images.
- **onStart(fn: () => void)**: Registers a callback for when the prompt starts.
- **onFinished(fn: (data: Record<keyof T["mapOutputPath"], any>) => void)**: Registers a callback for when the prompt finishes.
- **onFailed(fn: () => void)**: Registers a callback for when the prompt fails.
- **onProgress(fn: (info: NodeProgress) => void)**: Registers a callback for progress updates.

### Execution

- **run()**: Starts the execution of the prompt and returns a promise that resolves to the output data, `false` if execution fails.

## PromptBuilder and PromptCaller

> The PromptCaller and PromptBuilder classes provide a convenient way to create and manage workflows from JSON files. These classes allow for dynamic mapping of input and output paths within a JSON object representing a workflow.

#### PromptCaller Class

##### Constructor

- **constructor(prompt: object, mapIn: Record<string, string | undefined>, mapOut: Record<string, string | undefined>)**: Creates a new instance of PromptCaller.

##### Methods

- **input<T = string | number>(key: I, value: T)**: Sets the value for a specified input key.
- **mapOutputKeys**: Returns the mapping of output keys to paths.
- **mapInputKeys**: Returns the mapping of input keys to paths.
- **workflow**: Returns the current state of the workflow JSON object.

#### PromptBuilder Class

##### Constructor

- **constructor(prompt: T, inputKeys: I[], outputKeys: O[])**: Creates a new instance of PromptBuilder.

##### Methods

- **setInputNode(input: I, key: KeysUnion<T>)**: Sets the path for a specified input key.
- **setOutputNode(output: O, key: KeysUnion<T>)**: Sets the path for a specified output key.
- **caller**: Returns a new instance of PromptCaller with the current mappings.

#### Example

```ts
import { PromptCaller, PromptBuilder } from "path/to/prompt-caller-builder";

const workflowJson = {
  input: { a: "", b: "" },
  output: { result: "" },
};

const inputKeys = ["a", "b"];
const outputKeys = ["result"];

const builder = new PromptBuilder(workflowJson, inputKeys, outputKeys)
  .setInputNode("a", "input.a")
  .setInputNode("b", "input.b")
  .setOutputNode("result", "output.result");

const caller = builder.caller;

caller.input("a", "value1").input("b", "value2");

console.log("Workflow:", caller.workflow);
console.log("Mapped Outputs:", caller.mapOutputKeys);
```

### ComfyPool APIs

> The ComfyPool class provides a mechanism to manage and distribute tasks across multiple ComfyApi clients using various queue modes.

#### EQueueMode

- **PICK_ZERO**: Picks the client which has zero queue remaining. This is the default mode. (For who using along with ComfyUI web interface)
- **PICK_LOWEST**: Picks the client with the lowest queue remaining.
- **PICK_ROUTINE**: Picks the client in a round-robin manner.

#### Constructor

- **constructor(clients: ComfyApi[], mode: EQueueMode = EQueueMode.PICK_ZERO)**: Creates a new instance of ComfyPool.

#### Methods

- **addClient(client: ComfyApi)**: Adds a new `ComfyApi` client to the pool.
- **removeClient(client: ComfyApi)**: Removes a `ComfyApi` client from the pool.
- **run<T>(claim: (client: ComfyApi) => Promise<T>)**: Runs a task on the pool and returns a promise that resolves with the result.
- **batch<T>(claims: ((client: ComfyApi) => Promise<T>)[])**: Runs a batch of tasks on the pool and returns a promise that resolves with the results.

## Contributing

Contributions are welcome! If you have a feature request, bug report, or a pull request, please open an issue or PR on our [GitHub repository](https://github.com/tctien342/comfyui-sdk).

## License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for more details.

```

This README provides a basic overview of the SDK, its features, how to get started, and contribution guidelines. Adjustments and expansions should be made based on the actual functionalities and requirements of the SDK.
```
