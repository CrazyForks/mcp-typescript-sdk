# @emqx-ai/mcp-mqtt-sdk

A TypeScript SDK for implementing Model Context Protocol (MCP) over MQTT, supporting both browser and Node.js environments.

## Features

- 🚀 **Universal**: Works in both browser and Node.js environments
- 🔒 **Type Safe**: Full TypeScript support with Zod schema validation
- 🌐 **MQTT Transport**: Uses MQTT as the transport layer for MCP communication
- 🔧 **Easy to Use**: Simple API for creating MCP servers and clients
- 📋 **Standards Compliant**: Follows MCP specification v2024-11-05
- 🏷️ **Tool & Resource Support**: Full support for tools and resources
- 🔍 **Auto Discovery**: Automatic server discovery over MQTT

## Installation

```bash
npm install @emqx-ai/mcp-mqtt-sdk
```

## Quick Start

### Server Example

```typescript
import { createMcpServer } from '@emqx-ai/mcp-mqtt-sdk';

const server = createMcpServer({
  mqtt: {
    host: 'localhost',
    port: 1883,
  },
  serverInfo: {
    name: 'My MCP Server',
    version: '1.0.0',
  },
});

// Add a tool
server.tool(
  'greet',
  'Greet someone with a message',
  {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name to greet' },
    },
    required: ['name'],
  },
  async ({ name }) => ({
    content: [{
      type: 'text',
      text: `Hello, ${name}!`,
    }],
  })
);

// Start the server
await server.start();
console.log('Server started!');
```

### Client Example

```typescript
import { createMcpClient } from '@emqx-ai/mcp-mqtt-sdk';

const client = createMcpClient({
  mqtt: {
    host: 'localhost',
    port: 1883,
  },
  clientInfo: {
    name: 'My MCP Client',
    version: '1.0.0',
  },
});

// Connect and discover servers
await client.connect();

client.onServerDiscovered(async (server) => {
  console.log('Discovered server:', server.name);

  // Connect to the server
  await client.connectToServer(server.name);

  // List available tools
  const tools = await client.listTools(server.name);
  console.log('Available tools:', tools);

  // Call a tool
  const result = await client.callTool(server.name, 'greet', { name: 'World' });
  console.log('Result:', result);
});
```

## API Reference

### Server API

#### `createMcpServer(config)`

Creates a new MCP server instance.

**Config:**
```typescript
interface McpMqttServerConfig {
  mqtt: MqttConnectionOptions;
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities?: {
    prompts?: { listChanged?: boolean };
    resources?: { subscribe?: boolean; listChanged?: boolean };
    tools?: { listChanged?: boolean };
  };
}
```

#### `server.tool(name, description, inputSchema, handler)`

Register a tool with the server.

```typescript
server.tool(
  'calculate',
  'Perform mathematical calculations',
  {
    type: 'object',
    properties: {
      expression: { type: 'string' },
    },
    required: ['expression'],
  },
  async ({ expression }) => {
    // Tool implementation
    return {
      content: [{
        type: 'text',
        text: `Result: ${eval(expression)}`,
      }],
    };
  }
);
```

#### `server.resource(uri, name, handler, options?)`

Register a resource with the server.

```typescript
server.resource(
  'config://settings',
  'Application Settings',
  async () => ({
    contents: [{
      uri: 'config://settings',
      mimeType: 'application/json',
      text: JSON.stringify({ theme: 'dark' }),
    }],
  }),
  {
    description: 'Current application configuration',
    mimeType: 'application/json',
  }
);
```

### Client API

#### `createMcpClient(config)`

Creates a new MCP client instance.

**Config:**
```typescript
interface McpMqttClientConfig {
  mqtt: MqttConnectionOptions;
  clientInfo: {
    name: string;
    version: string;
  };
  capabilities?: {
    roots?: { listChanged?: boolean };
    sampling?: Record<string, any>;
  };
}
```

#### Client Methods

- `await client.connect()` - Connect to MQTT broker and start discovery
- `await client.disconnect()` - Disconnect from broker
- `await client.connectToServer(serverName)` - Connect to a specific server
- `await client.listTools(serverName)` - Get available tools from server
- `await client.callTool(serverName, toolName, args)` - Call a tool
- `await client.listResources(serverName)` - Get available resources
- `await client.readResource(serverName, uri)` - Read a resource

#### Client Events

```typescript
client.onServerDiscovered((server) => {
  console.log('New server found:', server.name);
});

client.onServerConnected((server) => {
  console.log('Connected to server:', server.name);
});
```

## MQTT Configuration

The SDK supports standard MQTT connection options:

```typescript
interface MqttConnectionOptions {
  host: string;
  port?: number;
  clientId?: string;
  username?: string;
  password?: string;
  clean?: boolean;
  keepalive?: number;
  connectTimeout?: number;
  reconnectPeriod?: number;
  will?: {
    topic: string;
    payload: string | Buffer;
    qos?: 0 | 1 | 2;
    retain?: boolean;
  };
}
```

### Browser vs Node.js

The SDK automatically detects the environment:
- **Browser**: Uses WebSocket transport (wss://) on port 8084 by default
- **Node.js**: Uses TCP transport (mqtt://) on port 1883 by default

## Examples

See the `examples/` directory for complete examples:
- **Node.js Server** (`node-server.ts`) - MCP server with tools and resources
- **Node.js Client** (`node-client.ts`) - MCP client with server discovery and testing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License. See LICENSE file for details.
