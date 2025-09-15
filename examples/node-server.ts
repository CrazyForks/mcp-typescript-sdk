#!/usr/bin/env node

import { McpMqttServer } from '../dist/index.js'
import type { McpMqttServerConfig } from '../dist/types.js'

function printUsage() {
  console.log(`
MCP over MQTT Server (Node.js)

Usage: node node-server.js [options]

Options:
  --host <host>        MQTT broker host (default: localhost)
  --port <port>        MQTT broker port (default: 1883)
  --client-id <id>     MQTT client ID (auto-generated if not provided)
  --username <user>    MQTT username
  --password <pass>    MQTT password
  --server-name <name> Server name (default: Node MCP Server)
  --server-id <id>     Unique server ID (auto-generated if not provided)
  --help, -h           Show this help message

Examples:
  node node-server.js
  node node-server.js --host mqtt.example.com --port 8883 --server-name "Production Server"
`)
}

function parseArgs(): McpMqttServerConfig {
  const args = process.argv.slice(2)
  const config: Partial<McpMqttServerConfig> = {
    mqtt: { host: 'localhost' },
    serverInfo: { name: '', version: '' },
    identifiers: { serverId: '', serverName: '' },
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
        config.mqtt!.host = nextArg
        i++
        break
      case '--port':
        if (!nextArg) throw new Error('--port requires a value')
        config.mqtt!.port = parseInt(nextArg, 10)
        if (isNaN(config.mqtt!.port!)) throw new Error('--port must be a number')
        i++
        break
      case '--client-id':
        if (!nextArg) throw new Error('--client-id requires a value')
        config.mqtt!.clientId = nextArg
        i++
        break
      case '--username':
        if (!nextArg) throw new Error('--username requires a value')
        config.mqtt!.username = nextArg
        i++
        break
      case '--password':
        if (!nextArg) throw new Error('--password requires a value')
        config.mqtt!.password = nextArg
        i++
        break
      case '--server-name':
        if (!nextArg) throw new Error('--server-name requires a value')
        config.serverInfo!.name = nextArg
        i++
        break
      case '--server-id':
        if (!nextArg) throw new Error('--server-id requires a value')
        config.identifiers!.serverId = nextArg
        i++
        break
      default:
        if (arg && arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`)
        }
    }
  }

  // Set defaults
  config.mqtt!.host = config.mqtt!.host || 'localhost'
  config.mqtt!.port = config.mqtt!.port || 1883
  config.serverInfo!.name = config.serverInfo!.name || 'Node MCP Server'
  config.serverInfo!.version = '1.0.0'

  // Generate defaults for identifiers
  const defaultServerName = config.serverInfo!.name!.toLowerCase().replace(/\s+/g, '-')
  config.identifiers!.serverId = config.identifiers!.serverId || `mcp-server-${Date.now()}`
  config.identifiers!.serverName = config.identifiers!.serverName || `nodejs/${defaultServerName}`

  // Add required capabilities and description
  const finalConfig: McpMqttServerConfig = {
    ...config,
    description: `A Node.js MCP server providing system tools and environment information`,
    capabilities: {
      tools: {
        listChanged: true,
      },
      resources: {
        listChanged: true,
        subscribe: false,
      },
    },
  } as McpMqttServerConfig

  return finalConfig
}

async function main() {
  try {
    const config = parseArgs()

    console.log('🚀 Starting MCP over MQTT Server (Node.js)...')
    console.log(`📡 Server: ${config.serverInfo.name} v${config.serverInfo.version}`)
    console.log(`🌐 MQTT Broker: ${config.mqtt.host}:${config.mqtt.port}`)

    const server = new McpMqttServer(config)

    // Node.js specific tools
    server.tool(
      'system-info',
      'Get Node.js system information',
      {
        type: 'object',
        properties: {},
      },
      async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                pid: process.pid,
              },
              null,
              2,
            ),
          },
        ],
      }),
    )

    server.tool(
      'file-exists',
      'Check if a file exists on the filesystem',
      {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to check',
          },
        },
        required: ['path'],
      },
      async ({ path }) => {
        try {
          const fs = await import('fs')
          const exists = fs.existsSync(path)
          return {
            content: [
              {
                type: 'text',
                text: `File "${path}" ${exists ? 'exists' : 'does not exist'}`,
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error checking file: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          }
        }
      },
    )

    // Common tools
    server.tool(
      'echo',
      'Echo back the input message',
      {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The message to echo back',
          },
        },
        required: ['message'],
      },
      async ({ message }) => ({
        content: [
          {
            type: 'text',
            text: `Echo: ${message}`,
          },
        ],
      }),
    )

    server.tool(
      'time',
      'Get current timestamp',
      {
        type: 'object',
        properties: {},
      },
      async () => ({
        content: [
          {
            type: 'text',
            text: `Current time: ${new Date().toISOString()}`,
          },
        ],
      }),
    )

    // Node.js specific resources
    server.resource(
      'process:env',
      'Environment Variables',
      async () => ({
        contents: [
          {
            uri: 'process:env',
            mimeType: 'application/json',
            text: JSON.stringify(process.env, null, 2),
          },
        ],
      }),
      {
        description: 'Current environment variables',
        mimeType: 'application/json',
      },
    )

    server.resource(
      'server:info',
      'Server Information',
      async () => ({
        contents: [
          {
            uri: 'server:info',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                name: config.serverInfo.name,
                version: config.serverInfo.version,
                startTime: new Date().toISOString(),
                topics: server.getTopics(),
                runtime: {
                  platform: process.platform,
                  nodeVersion: process.version,
                  uptime: process.uptime(),
                },
              },
              null,
              2,
            ),
          },
        ],
      }),
      {
        description: 'Information about this MCP server',
        mimeType: 'application/json',
      },
    )

    server.on('ready', () => {
      console.log('✅ Server is ready and listening for requests')
      console.log(`📋 RPC topic: ${server.getTopics().rpc}`)
      console.log(`📤 Control topic: ${server.getTopics().control}`)
      console.log('')
      console.log('Available tools:')
      console.log('  - system-info: Get Node.js system information')
      console.log('  - file-exists: Check if a file exists')
      console.log('  - echo: Echo back a message')
      console.log('  - time: Get current timestamp')
      console.log('')
      console.log('Available resources:')
      console.log('  - process:env: Environment variables (JSON)')
      console.log('  - server:info: Server information (JSON)')
      console.log('')
      console.log('Press Ctrl+C to stop')
    })

    server.on('error', (error) => {
      console.error('❌ Server error:', error)
      process.exit(1)
    })

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down server...')
      try {
        await server.stop()
        console.log('✅ Server stopped gracefully')
        process.exit(0)
      } catch (error) {
        console.error('❌ Error during shutdown:', error)
        process.exit(1)
      }
    })

    await server.start()
  } catch (error) {
    console.error('❌ Failed to start server:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Only run if this file is being executed directly
if ((process.argv[1] && process.argv[1].endsWith('node-server.ts')) || process.argv[1]?.endsWith('node-server.js')) {
  main().catch((error) => {
    console.error('❌ Unhandled error:', error)
    process.exit(1)
  })
}
