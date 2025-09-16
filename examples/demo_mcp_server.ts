// demo_mcp_server.ts
import { McpMqttServer } from '@emqx-ai/mcp-mqtt-sdk'

// Create MCP server
const server = new McpMqttServer({
  host: 'mqtt://broker.emqx.io:1883',
  serverId: 'demo-calculator-server',
  serverName: 'demo_server/calculator',
  name: 'Calculator MCP Server',
  version: '1.0.0',
  description: 'A simple calculator MCP server',
  capabilities: {
    tools: { listChanged: true },
    resources: { listChanged: true },
  },
})

// Add addition tool
server.tool(
  'add',
  'Add two numbers',
  {
    type: 'object',
    properties: {
      a: { type: 'number', description: 'First number' },
      b: { type: 'number', description: 'Second number' },
    },
    required: ['a', 'b'],
  },
  async (params: Record<string, any>) => {
    const { a, b } = params as { a: number; b: number }
    const result = a + b
    return {
      content: [
        {
          type: 'text',
          text: `${a} + ${b} = ${result}`,
        },
      ],
    }
  },
)

// Add multiplication tool
server.tool(
  'multiply',
  'Multiply two numbers',
  {
    type: 'object',
    properties: {
      a: { type: 'number', description: 'First number' },
      b: { type: 'number', description: 'Second number' },
    },
    required: ['a', 'b'],
  },
  async (params: Record<string, any>) => {
    const { a, b } = params as { a: number; b: number }
    const result = a * b
    return {
      content: [
        {
          type: 'text',
          text: `${a} × ${b} = ${result}`,
        },
      ],
    }
  },
)

// Add specific greeting resources
const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'World']
names.forEach((name) => {
  server.resource(
    `greeting://${name}`,
    `Personalized greeting - ${name}`,
    async () => {
      return {
        contents: [
          {
            uri: `greeting://${name}`,
            mimeType: 'text/plain',
            text: `Hello, ${name}! Welcome to our calculator service.`,
          },
        ],
      }
    },
    {
      description: `Generate personalized greeting message for ${name}`,
      mimeType: 'text/plain',
    },
  )
})

// Add server status resource
server.resource(
  'status://server',
  'Server status',
  async () => {
    return {
      contents: [
        {
          uri: 'status://server',
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              name: 'Calculator MCP Server',
              status: 'running',
              uptime: process.uptime(),
              availableTools: ['add', 'multiply'],
              timestamp: new Date().toISOString(),
            },
            null,
            2,
          ),
        },
      ],
    }
  },
  {
    description: 'Server runtime status information',
    mimeType: 'application/json',
  },
)

// Event handling
server.on('ready', () => {
  console.log('Calculator MCP Server started')
})

server.on('error', (error) => {
  console.error('Server error:', error)
})

// Start server
async function startServer() {
  try {
    await server.start()
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...')
  await server.stop()
  process.exit(0)
})

startServer()
