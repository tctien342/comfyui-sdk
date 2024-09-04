// src/WebSocketClient.ts

import WebSocketLib from "ws";

let WebSocketImpl: typeof WebSocket;

if (typeof window !== "undefined" && window.WebSocket) {
  // In a browser environment
  WebSocketImpl = window.WebSocket;
} else {
  // In a Node.js environment
  WebSocketImpl = WebSocketLib as any;
}

export interface WebSocketClientOptions {
  headers?: { [key: string]: string };
}

export class WebSocketClient {
  private socket: WebSocket;

  constructor(url: string, options: WebSocketClientOptions = {}) {
    const { headers } = options;

    if (typeof window !== "undefined" && window.WebSocket) {
      // Browser environment - WebSocket does not support custom headers
      this.socket = new WebSocketImpl(url);
    } else {
      // Node.js environment - using ws package, which supports custom headers
      const WebSocketConstructor = WebSocketImpl as any;
      this.socket = new WebSocketConstructor(url, { headers });
    }

    return this;
  }

  get client() {
    return this.socket;
  }

  public send(message: string) {
    if (this.socket.readyState === WebSocketImpl.OPEN) {
      this.socket.send(message);
    } else {
      console.error("WebSocket is not open");
    }
  }

  public close() {
    this.socket.close();
  }
}
