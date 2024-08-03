# @saintno/comfyui-sdk

This SDK provides a comprehensive interface for interacting with ComfyUI, allowing developers to easily integrate ComfyUI's functionalities into their applications. It includes a variety of examples to get started with tasks such as image-to-image (i2i), text-to-image (t2i), and managing API calls efficiently using a pool of ComfyApi instances.

```ts
/**
 * Define basic creadentials if you enable auth in NginX
 */
const credentials: BasicCredentials = {
  type: "basic",
  username: "username",
  password: "password",
};

/**
 * Define a T2I (text to image) workflow task
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
    "cfg",
    "sampler",
    "sheduler",
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
  .setInputNode("cfg", "3.inputs.cfg")
  .setInputNode("sampler", "3.inputs.sampler_name")
  .setInputNode("scheduler", "3.inputs.scheduler")
  .setOutputNode("images", "9");

/**
 * Define a pool of ComfyApi
 */
const ApiPool = new ComfyPool(
  [
    new ComfyApi("http://localhost:8188", "node-1", {
      credentials, // optional
    }), // Comfy Instance 1
    new ComfyApi("http://localhost:8189", "node-2", {
      credentials, // optional
    }), // Comfy Instance 2
  ],
  //   "PICK_ZERO", Picks the client which has zero queue remaining. This is the default mode. (For who using along with ComfyUI web interface)
  //   "PICK_LOWEST", Picks the client which has the lowest queue remaining.
  //   "PICK_ROUTINE", Picks the client in a round-robin manner.
  EQueueMode.PICK_ZERO
)
  .on("init", () => console.log("Pool in initializing"))
  .on("loading_client", (ev) =>
    console.log("Loading client", ev.detail.clientIdx)
  )
  .on("add_job", (ev) => console.log("Job added", ev.detail.jobIdx))
  .on("added", (ev) => console.log("Client added", ev.detail.clientIdx))
  .on("auth_success", (ev) => {
    console.info(`Client ${ev.detail.clientIdx} auth successfuly`);
  })
  .on("auth_error", (ev) => {
    console.error(`Client ${ev.detail.clientIdx} auth failed`);
  });

/**
 * Define the generator function for all nodes
 */
const generateFn = async (api: ComfyApi, clientIdx?: number) => {
  return new Promise<string[]>((resolve) => {
    /**
     * Set the workflow's input values
     */
    const workflow = Txt2ImgPrompt.input(
      "checkpoint",
      "SDXL/realvisxlV40_v40LightningBakedvae.safetensors"
    )
      .input("seed", seed())
      .input("step", 6)
      .input("width", 512)
      .input("height", 512)
      .input("batch", 2)
      .input("cfg", 1)
      .input<TSamplerName>("sampler", "dpmpp_2m_sde_gpu")
      .input<TSchedulerName>("scheduler", "sgm_uniform")
      .input("positive", "A close up picture of cute Cat")
      .input("negative", "text, blurry, bad picture, nsfw");

    new CallWrapper(api, workflow)
      .onPending((promptId) =>
        console.log(`[${clientIdx}]`, `#${promptId}`, "Task is pending")
      )
      .onStart((promptId) =>
        console.log(`[${clientIdx}]`, `#${promptId}`, "Task is started")
      )
      .onPreview((blob, promptId) =>
        console.log(`[${clientIdx}]`, `#${promptId}`, "Blob size", blob.size)
      )
      .onFinished(async (data, promptId) => {
        console.log(`[${clientIdx}]`, `#${promptId}`, "Task is finished");
        /**
         * Use getImage instead of getURL because we use basic auth
         * This download image from ComfyUI server and return the Blob
         */
        const url = await Promise.all(
          data.images?.images.map((img: any) => api.getImage(img))
        );
        resolve(url as string[]);
      })
      .onProgress((info, promptId) => {
        console.log(
          `[${clientIdx}]`,
          `#${promptId}`,
          "Processing node",
          info.node,
          `${info.value}/${info.max}`
        );
      })
      .onFailed((err, promptId) => {
        console.log(`[${clientIdx}]`, `#${promptId}`, "Task is failed", err);
        resolve([]);
      })
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

- **constructor(host: string, clientId?: string, opts?: {credentials?: BasicCredentials})**: initializes a new instance of ComfyApi with the specified host and client ID.

```ts
const api = new ComfyApi("https://comfyui.instance:8188", "your-client-id");
```

### Event Handling

- **on(type: TEventKey, callback, options?)**: Register an event listener. Return off function to remove the listener.
- **off(type: TEventKey, callback, options?)**: Unregister an event listener.

### General

- **pollStatus()**: Polls status for colab and other non-WebSocket environments.
- **queuePrompt(number, workflow)**: Queues a prompt for processing.
- **getQueue()**: Retrieves the current state of the queue.
- **getHistories(maxItems?)**: Retrieves the prompt execution history.
- **getHistory(promptId)**: Retrieves the history entry for a given prompt ID.
- **getSystemStats()**: Retrieves system and device stats.
- **getExtensions()**: Retrieves a list of extension URLs.

### Checkpoints, Loras, Embeddings and Samplers

- **getEmbeddings()**: Retrieves a list of embedding names.
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

- **onPreview(fn: (ev: Blob, promptId: string) => void)**: Registers a callback for preview images.
- **onStart(fn: (promptId: string) => void)**: Registers a callback for when the prompt starts.
- **onFinished(fn: (data: Record<keyof T["mapOutputPath"], any>, promptId: string) => void)**: Registers a callback for when the prompt finishes.
- **onFailed(fn: (error: Error, promptId: string) => void)**: Registers a callback for when the prompt fails.
- **onProgress(fn: (info: NodeProgress, promptId: string) => void)**: Registers a callback for progress updates.

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

- **on(type: TComfyPoolEventKey, callback: (ev: CustomEvent) => void)**: Registers an event listener.
- **off(type: TComfyPoolEventKey, callback: (ev: CustomEvent) => void)**: Unregisters an event listener.
- **addClient(client: ComfyApi)**: Adds a new `ComfyApi` client to the pool.
- **removeClient(client: ComfyApi)**: Removes a `ComfyApi` client from the pool.
- **removeClientByIndex(index: number)**: Removes a `ComfyApi` client from the pool by index.
- **changeMode(mode: EQueueMode)**: Changes the queue mode of the pool.
- **run<T>(claim: (client: ComfyApi, clientIdx?: number) => Promise<T>)**: Runs a task on the pool and returns a promise that resolves with the result.
- **batch<T>(claims: ((client: ComfyApi, clientIdx?: number) => Promise<T>)[])**: Runs a batch of tasks on the pool and returns a promise that resolves with the results.

## Contributing

Contributions are welcome! If you have a feature request, bug report, or a pull request, please open an issue or PR on our [GitHub repository](https://github.com/tctien342/comfyui-sdk).

## License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for more details.

```

This README provides a basic overview of the SDK, its features, how to get started, and contribution guidelines. Adjustments and expansions should be made based on the actual functionalities and requirements of the SDK.
```
