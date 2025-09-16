// demo_mcp_client.ts
import { McpMqttClient } from '@emqx-ai/mcp-mqtt-sdk'

// Create MCP client
const client = new McpMqttClient({
  host: 'mqtt://broker.emqx.io:1883',
  name: 'Demo MCP Client',
  version: '1.0.0',
})

async function onServerDiscovered(server: any) {
  console.log(`Discovered server ${server.name}, connecting...`)
  await client.initializeServer(server.serverId)
}

async function onServerConnected(server: any, initResult: any) {
  if (!initResult) {
    console.error(`Failed to connect to ${server.name}`)
    return
  }

  console.log(`Connected to ${server.name}`)
  const capabilities = initResult.capabilities

  // List tools
  if (capabilities.tools) {
    try {
      const tools = await client.listTools(server.serverId)
      console.log(
        `Tools for ${server.name}:`,
        tools.map((t) => t.name),
      )

      // Test addition tool
      if (tools.some((t) => t.name === 'add')) {
        const result = await client.callTool(server.serverId, 'add', {
          a: 1,
          b: 2,
        })
        console.log('Result of calling add(a=1, b=2) tool:', result.content[0]?.text)
      }

      // Test multiplication tool
      if (tools.some((t) => t.name === 'multiply')) {
        const result = await client.callTool(server.serverId, 'multiply', {
          a: 3,
          b: 4,
        })
        console.log('Result of calling multiply(a=3, b=4) tool:', result.content[0]?.text)
      }
    } catch (error) {
      console.error('Tool operation error:', error)
    }
  }

  // List and read resources
  if (capabilities.resources) {
    try {
      const resources = await client.listResources(server.serverId)
      console.log(
        `Resources for ${server.name}:`,
        resources.map((r) => r.uri),
      )

      // Read server status
      if (resources.some((r) => r.uri === 'status://server')) {
        const status = await client.readResource(server.serverId, 'status://server')
        console.log('Server status:', status.contents[0]?.text)
      }

      // Read dynamic greeting resource
      const greeting = await client.readResource(server.serverId, 'greeting://Alice')
      console.log('Greeting resource:', greeting.contents[0]?.text)
    } catch (error) {
      console.error('Resource operation error:', error)
    }
  }
}

async function onServerDisconnected(serverId: string) {
  console.log(`Disconnected from server ${serverId}`)
}

// Set up event handlers
client.on('serverDiscovered', onServerDiscovered)
client.on('serverInitialized', (server) => {
  // Here we need to get initialization result, simplified handling
  onServerConnected(server, { capabilities: { tools: true, resources: true } })
})
client.on('serverDisconnected', onServerDisconnected)
client.on('error', (error) => {
  console.error('Client error:', error)
})

// Start client
async function startClient() {
  try {
    await client.connect()
    console.log('Demo MCP Client started')

    // Keep running - wait for process termination
    await new Promise(() => {}) // Keep process alive until SIGINT
  } catch (error) {
    console.error('Failed to start client:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down client...')
  await client.disconnect()
  process.exit(0)
})

startClient()
