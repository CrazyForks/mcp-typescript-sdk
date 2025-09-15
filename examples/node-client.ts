#!/usr/bin/env node

import { McpMqttClient } from '../dist/index.js'
import type { McpMqttClientConfig } from '../dist/types.js'

function printUsage() {
  console.log(`
MCP over MQTT Client (Node.js)

Usage: node node-client.js [options]

Options:
  --host <host>        MQTT broker host (default: localhost)
  --port <port>        MQTT broker port (default: 1883)
  --client-id <id>     MQTT client ID (auto-generated if not provided)
  --username <user>    MQTT username
  --password <pass>    MQTT password
  --client-name <name> Client name (default: Node MCP Client)
  --help, -h           Show this help message

Examples:
  node node-client.js
  node node-client.js --host mqtt.example.com --port 8883
`)
}

function parseArgs(): McpMqttClientConfig {
  const args = process.argv.slice(2)
  const config = {
    host: 'localhost',
    port: 1883,
    clientId: undefined as string | undefined,
    username: undefined as string | undefined,
    password: undefined as string | undefined,
    clientName: 'Node MCP Client',
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]

    switch (arg) {
      case '--help':
      case '-h':
        printUsage()
        process.exit(0)
        break
      case '--host':
        if (!nextArg) throw new Error('--host requires a value')
        config.host = nextArg
        i++
        break
      case '--port':
        if (!nextArg) throw new Error('--port requires a value')
        config.port = parseInt(nextArg, 10)
        if (isNaN(config.port)) throw new Error('--port must be a number')
        i++
        break
      case '--client-id':
        if (!nextArg) throw new Error('--client-id requires a value')
        config.clientId = nextArg
        i++
        break
      case '--username':
        if (!nextArg) throw new Error('--username requires a value')
        config.username = nextArg
        i++
        break
      case '--password':
        if (!nextArg) throw new Error('--password requires a value')
        config.password = nextArg
        i++
        break
      case '--client-name':
        if (!nextArg) throw new Error('--client-name requires a value')
        config.clientName = nextArg
        i++
        break
      default:
        if (arg && arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`)
        }
    }
  }

  // Build final configuration matching new structure
  const finalConfig: McpMqttClientConfig = {
    // MQTT connection settings
    host: config.host,
    port: config.port,
    clientId: config.clientId,
    username: config.username,
    password: config.password,

    // Client information (required)
    name: config.clientName,
    version: '1.0.0',

    // Optional configuration
    capabilities: {
      roots: {
        listChanged: false,
      },
      sampling: {},
    },
  }

  return finalConfig
}

async function main() {
  try {
    const config = parseArgs()

    console.log('🚀 Starting MCP over MQTT Client (Node.js)...')
    console.log(`📡 Client: ${config.name} v${config.version}`)
    console.log(`🌐 MQTT Broker: ${config.host}:${config.port}`)

    const client = new McpMqttClient(config)

    let connectedServers: Set<string> = new Set()

    client.on('serverDiscovered', async (server) => {
      console.log(`🔍 Discovered server: ${server.name} (ID: ${server.serverId})`)

      try {
        console.log(`🔌 Connecting to server: ${server.name}...`)
        await client.initializeServer(server.serverId)
        connectedServers.add(server.serverId)

        console.log(`✅ Connected to server: ${server.name}`)

        // List and call tools
        console.log(`📋 Listing tools for ${server.name}...`)
        const tools = await client.listTools(server.serverId)

        if (tools.length > 0) {
          console.log(`🔧 Available tools (${tools.length}):`)
          tools.forEach((tool) => {
            console.log(`  - ${tool.name}: ${tool.description || 'No description'}`)
          })

          // Test Node.js specific tools
          await testNodeTools(client, server.serverId, tools)
        } else {
          console.log(`📋 No tools available on ${server.name}`)
        }

        // List and read resources
        console.log(`📚 Listing resources for ${server.name}...`)
        const resources = await client.listResources(server.serverId)

        if (resources.length > 0) {
          console.log(`📄 Available resources (${resources.length}):`)
          resources.forEach((resource) => {
            console.log(`  - ${resource.uri}: ${resource.name}`)
          })

          // Test Node.js specific resources
          await testNodeResources(client, server.serverId, resources)
        } else {
          console.log(`📚 No resources available on ${server.name}`)
        }
      } catch (error) {
        console.error(`❌ Failed to interact with server ${server.name}:`, error)
      }
    })

    client.on('error', (error) => {
      console.error('❌ Client error:', error)
    })

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down client...')
      try {
        await client.disconnect()
        console.log('✅ Client stopped gracefully')
        process.exit(0)
      } catch (error) {
        console.error('❌ Error during shutdown:', error)
        process.exit(1)
      }
    })

    console.log('🔍 Starting server discovery...')
    await client.connect()

    // Keep the client running for a while to discover servers
    console.log('⏳ Waiting for server discovery (30 seconds)...')
    console.log('   Make sure to start a server with: node node-server.js')

    setTimeout(() => {
      if (connectedServers.size === 0) {
        console.log('⚠️  No servers discovered. Make sure a server is running.')
        process.exit(0)
      }
    }, 30000)
  } catch (error) {
    console.error('❌ Failed to start client:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

async function testNodeTools(client: any, serverId: string, tools: any[]) {
  console.log(`🧪 Testing Node.js tools on server ${serverId}...`)

  // Test system-info tool
  const systemInfoTool = tools.find((t) => t.name === 'system-info')
  if (systemInfoTool) {
    try {
      const result = await client.callTool(serverId, 'system-info', {})
      const systemInfo = JSON.parse(result.content[0]?.text || '{}')
      console.log(`  ✅ system-info tool: Platform: ${systemInfo.platform}, Node: ${systemInfo.nodeVersion}`)
    } catch (error) {
      console.log(`  ❌ system-info tool failed: ${error}`)
    }
  }

  // Test file-exists tool
  const fileExistsTool = tools.find((t) => t.name === 'file-exists')
  if (fileExistsTool) {
    try {
      const result = await client.callTool(serverId, 'file-exists', { path: './package.json' })
      console.log(`  ✅ file-exists tool: ${result.content[0]?.text}`)
    } catch (error) {
      console.log(`  ❌ file-exists tool failed: ${error}`)
    }
  }

  // Test common tools
  const echoTool = tools.find((t) => t.name === 'echo')
  if (echoTool) {
    try {
      const result = await client.callTool(serverId, 'echo', { message: 'Hello from Node.js client!' })
      console.log(`  ✅ echo tool: ${result.content[0]?.text}`)
    } catch (error) {
      console.log(`  ❌ echo tool failed: ${error}`)
    }
  }

  const timeTool = tools.find((t) => t.name === 'time')
  if (timeTool) {
    try {
      const result = await client.callTool(serverId, 'time', {})
      console.log(`  ✅ time tool: ${result.content[0]?.text}`)
    } catch (error) {
      console.log(`  ❌ time tool failed: ${error}`)
    }
  }
}

async function testNodeResources(client: any, serverId: string, resources: any[]) {
  console.log(`🧪 Testing Node.js resources on server ${serverId}...`)

  // Test server:info resource
  const infoResource = resources.find((r) => r.uri === 'server:info')
  if (infoResource) {
    try {
      const result = await client.readResource(serverId, 'server:info')
      console.log(`  ✅ server:info resource:`)
      const info = JSON.parse(result.contents[0]?.text || '{}')
      console.log(`     Server: ${info.name} v${info.version}`)
      console.log(`     Platform: ${info.runtime?.platform}, Node: ${info.runtime?.nodeVersion}`)
      console.log(`     Uptime: ${Math.floor(info.runtime?.uptime || 0)} seconds`)
    } catch (error) {
      console.log(`  ❌ server:info resource failed: ${error}`)
    }
  }

  // Test process:env resource (show only a few env vars for privacy)
  const envResource = resources.find((r) => r.uri === 'process:env')
  if (envResource) {
    try {
      const result = await client.readResource(serverId, 'process:env')
      const env = JSON.parse(result.contents[0]?.text || '{}')
      const envCount = Object.keys(env).length
      console.log(`  ✅ process:env resource: Found ${envCount} environment variables`)
      console.log(`     Sample: PATH exists: ${env.PATH ? 'Yes' : 'No'}`)
    } catch (error) {
      console.log(`  ❌ process:env resource failed: ${error}`)
    }
  }
}

// Only run if this file is being executed directly
if ((process.argv[1] && process.argv[1].endsWith('node-client.ts')) || process.argv[1]?.endsWith('node-client.js')) {
  main().catch((error) => {
    console.error('❌ Unhandled error:', error)
    process.exit(1)
  })
}
