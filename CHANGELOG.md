**Version 0.1.3**

- Use `execution_success` and `execution_error` to track execution status, prevent onFinished block next execution

**Version 0.1.2**

- Support for `Basic Authorization` when enable auth in NginX

**Version 0.1.1**

- Bind events into pool, now we can track what pool is doing
- Fix `pollQueue` not working properly of disconnected client

**Version 0.1.0**

- Optimize CallWrapper and PromptBuilder
- Remove `PromptCaller` due to implmented of `PromptBuilder`
- New tool `seed` to generatae seed

**Version 0.0.9**

- Add typing to events on client
- Better ComfyPool handling
- Include `Error` into `onFailed`of `CallWrapper`
- Include PromptId in `CallWrapper`
- Fix disconnected client cause crash
