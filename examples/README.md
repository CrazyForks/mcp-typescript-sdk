# TypeScript SDK Examples

This directory contains examples for using [@emqx-ai/mcp-mqtt-sdk](https://www.npmjs.com/package/@emqx-ai/mcp-mqtt-sdk) to create MCP over MQTT servers and clients. The SDK supports both browser and Node.js environments with full TypeScript type safety.

For quick demonstration purposes, we'll run the examples in a Node.js environment. You can easily integrate this into browser environments and use it with frontend frameworks like Vue, React, etc.

## Creating a Demo Project

First, create a new Node.js project (requires Node.js >= 18):

```bash
mkdir mcp_typescript_demo
cd mcp_typescript_demo
npm init -y
```

## Installing Dependencies

Install the TypeScript MCP SDK:

```bash
# Using npm
npm install @emqx-ai/mcp-mqtt-sdk
npm install -D typescript @types/node ts-node

# Or using yarn
yarn add @emqx-ai/mcp-mqtt-sdk
yarn add -D typescript @types/node ts-node

# Or using pnpm
pnpm add @emqx-ai/mcp-mqtt-sdk
pnpm add -D typescript @types/node ts-node
```

## Example Files

This directory contains two main example files:

### `demo_mcp_server.ts`
A complete MCP server implementation that demonstrates:
- Creating a calculator MCP server with addition and multiplication tools
- Registering resources for personalized greetings and server status
- Event handling and graceful shutdown
- Tool parameter validation and response formatting

### `demo_mcp_client.ts`
A complete MCP client implementation that demonstrates:
- Automatic server discovery over MQTT
- Tool listing and invocation
- Resource enumeration and reading
- Event-driven client architecture
- Connection management and error handling

## Project Configuration

Since the SDK uses ES modules, you need to configure the project to support modern JavaScript module system.

Add module type and run scripts to `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "start:server": "ts-node --esm demo_mcp_server.ts",
    "start:client": "ts-node --esm demo_mcp_client.ts"
  }
}
```

## Running the Demo

1. First, run the client:

```bash
npm run start:client
```

2. Open a new terminal and run the server:

```bash
npm run start:server
```

Even if the client starts before the server, it will discover the server and connect to it. The client will list available tools and call the `add` tool with parameters `a=1` and `b=2`, and the `multiply` tool with parameters `a=3` and `b=4`.

Through this complete demonstration, you have successfully created a fully functional MCP over MQTT system. Now, large language models (such as Claude, GPT, etc.) can discover and call the calculator tools you've exposed through the MCP protocol, enabling seamless integration and intelligent interaction with external services.

## Files in this Directory

- `demo_mcp_server.ts` - Example MCP server with calculator tools and greeting/status resources
- `demo_mcp_client.ts` - Example MCP client that discovers and interacts with servers

## Features Demonstrated

- **Tool Registration**: How to register tools with input schemas and handlers
- **Resource Management**: How to create static and dynamic resources
- **Event Handling**: Server and client event management
- **MQTT Transport**: Communication over MQTT broker
- **TypeScript Support**: Full type safety and IntelliSense support
- **Cross-platform**: Works in both Node.js and browser environments
