#!/usr/bin/env node

import { McpMqttClient } from '../dist/index.js'
import type { McpMqttClientConfig } from '../dist/types.js'
import * as readline from 'readline'

function printUsage() {
  console.log(`
MCP over MQTT Client (Node.js)

Usage: node node-client.js [options]

Options:
  --host <host>        MQTT broker URL (default: mqtt://localhost:1883)

  --client-id <id>     MQTT client ID (auto-generated if not provided)
  --username <user>    MQTT username
  --password <pass>    MQTT password
  --client-name <name> Client name (default: Node MCP Client)
  --help, -h           Show this help message

Examples:
  node node-client.js
  node node-client.js --host mqtt://mqtt.example.com:8883
`)
}

function parseArgs(): McpMqttClientConfig {
  const args = process.argv.slice(2)
  const config = {
    host: 'mqtt://localhost:1883',

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

// Interactive interface for tool execution
class InteractiveInterface {
  private rl: readline.Interface
  private client: McpMqttClient
  private servers: Map<string, { name: string; tools: any[]; resources: any[] }> = new Map()

  constructor(client: McpMqttClient) {
    this.client = client
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
  }

  addServer(serverId: string, name: string, tools: any[], resources: any[]) {
    this.servers.set(serverId, { name, tools, resources })
  }

  async start() {
    console.log('\n🎯 Interactive Mode Started!')
    console.log('Type "help" for available commands or "exit" to quit\n')
    this.showPrompt()
  }

  private showPrompt() {
    this.rl.question('MCP> ', async (input) => {
      await this.handleCommand(input.trim())
      this.showPrompt()
    })
  }

  private async handleCommand(input: string) {
    const parts = input.split(' ')
    const command = parts[0].toLowerCase()

    try {
      switch (command) {
        case 'help':
          this.showHelp()
          break
        case 'servers':
          this.listServers()
          break
        case 'tools':
          if (parts.length > 1) {
            await this.listTools(parts[1])
          } else {
            console.log('❌ Usage: tools <server-id>')
          }
          break
        case 'resources':
          if (parts.length > 1) {
            await this.listResources(parts[1])
          } else {
            console.log('❌ Usage: resources <server-id>')
          }
          break
        case 'call':
          if (parts.length >= 3) {
            await this.callTool(parts[1], parts[2], parts.slice(3).join(' '))
          } else {
            console.log('❌ Usage: call <server-id> <tool-name> [arguments-json]')
          }
          break
        case 'read':
          if (parts.length >= 3) {
            await this.readResource(parts[1], parts[2])
          } else {
            console.log('❌ Usage: read <server-id> <resource-uri>')
          }
          break
        case 'interactive':
          if (parts.length > 1) {
            await this.startInteractiveToolExecution(parts[1])
          } else {
            console.log('❌ Usage: interactive <server-id>')
          }
          break
        case 'exit':
        case 'quit':
          console.log('👋 Goodbye!')
          await this.client.disconnect()
          process.exit(0)
          break
        case '':
          // Empty input, just show prompt again
          break
        default:
          console.log(`❌ Unknown command: ${command}. Type "help" for available commands.`)
      }
    } catch (error) {
      console.error('❌ Command error:', error)
    }
  }

  private showHelp() {
    console.log(`
📖 Available Commands:

  help                                   Show this help message
  servers                               List all discovered servers
  tools <server-id>                     List available tools for a server
  resources <server-id>                 List available resources for a server
  call <server-id> <tool-name> [args]   Call a tool with optional JSON arguments
  read <server-id> <resource-uri>       Read a resource
  interactive <server-id>               Start interactive tool execution for a server
  exit / quit                           Exit the client

Examples:
  servers
  tools server-1
  call server-1 echo {"message": "Hello World"}
  read server-1 server:info
  interactive server-1
`)
  }

  private listServers() {
    if (this.servers.size === 0) {
      console.log('📭 No servers discovered yet.')
      return
    }

    console.log('🖥️  Discovered Servers:')
    for (const [serverId, server] of this.servers) {
      console.log(`  📡 ${serverId}: ${server.name}`)
      console.log(`     🔧 Tools: ${server.tools.length}`)
      console.log(`     📚 Resources: ${server.resources.length}`)
    }
  }

  private async listTools(serverId: string) {
    const server = this.servers.get(serverId)
    if (!server) {
      console.log(`❌ Server ${serverId} not found. Use "servers" to list available servers.`)
      return
    }

    if (server.tools.length === 0) {
      console.log(`📭 No tools available on ${server.name}`)
      return
    }

    console.log(`🔧 Tools on ${server.name} (${serverId}):`)
    server.tools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.name}: ${tool.description || 'No description'}`)
      if (tool.inputSchema?.properties) {
        console.log(`     📋 Parameters: ${Object.keys(tool.inputSchema.properties).join(', ')}`)
      }
    })
  }

  private async listResources(serverId: string) {
    const server = this.servers.get(serverId)
    if (!server) {
      console.log(`❌ Server ${serverId} not found. Use "servers" to list available servers.`)
      return
    }

    if (server.resources.length === 0) {
      console.log(`📭 No resources available on ${server.name}`)
      return
    }

    console.log(`📚 Resources on ${server.name} (${serverId}):`)
    server.resources.forEach((resource, index) => {
      console.log(`  ${index + 1}. ${resource.uri}: ${resource.name}`)
      if (resource.description) {
        console.log(`     📝 ${resource.description}`)
      }
    })
  }

  private async callTool(serverId: string, toolName: string, argsStr: string) {
    const server = this.servers.get(serverId)
    if (!server) {
      console.log(`❌ Server ${serverId} not found.`)
      return
    }

    const tool = server.tools.find((t) => t.name === toolName)
    if (!tool) {
      console.log(`❌ Tool "${toolName}" not found on server ${serverId}.`)
      return
    }

    let args = {}
    if (argsStr) {
      try {
        args = JSON.parse(argsStr)
      } catch (error) {
        console.log(`❌ Invalid JSON arguments: ${argsStr}`)
        return
      }
    }

    console.log(`⏳ Calling tool "${toolName}" on ${server.name}...`)
    try {
      const result = await this.client.callTool(serverId, toolName, args)
      console.log('✅ Tool result:')
      result.content.forEach((content) => {
        if (content.type === 'text') {
          console.log(content.text)
        } else {
          console.log(`[${content.type}]`, content)
        }
      })
    } catch (error) {
      console.error('❌ Tool execution failed:', error)
    }
  }

  private async readResource(serverId: string, resourceUri: string) {
    const server = this.servers.get(serverId)
    if (!server) {
      console.log(`❌ Server ${serverId} not found.`)
      return
    }

    const resource = server.resources.find((r) => r.uri === resourceUri)
    if (!resource) {
      console.log(`❌ Resource "${resourceUri}" not found on server ${serverId}.`)
      return
    }

    console.log(`⏳ Reading resource "${resourceUri}" from ${server.name}...`)
    try {
      const result = await this.client.readResource(serverId, resourceUri)
      console.log('✅ Resource content:')
      result.contents.forEach((content) => {
        if (content.type === 'text') {
          console.log(content.text)
        } else {
          console.log(`[${content.type}]`, content)
        }
      })
    } catch (error) {
      console.error('❌ Resource read failed:', error)
    }
  }

  private async startInteractiveToolExecution(serverId: string) {
    const server = this.servers.get(serverId)
    if (!server) {
      console.log(`❌ Server ${serverId} not found.`)
      return
    }

    if (server.tools.length === 0) {
      console.log(`📭 No tools available on ${server.name}`)
      return
    }

    console.log(`\n🎯 Interactive Tool Execution for ${server.name}`)
    console.log('Select a tool to execute:\n')

    server.tools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.name}: ${tool.description || 'No description'}`)
    })

    const choice = await this.askQuestion('\nEnter tool number (or "back" to return): ')

    if (choice.toLowerCase() === 'back') {
      return
    }

    const toolIndex = parseInt(choice) - 1
    if (isNaN(toolIndex) || toolIndex < 0 || toolIndex >= server.tools.length) {
      console.log('❌ Invalid tool number.')
      return
    }

    const selectedTool = server.tools[toolIndex]
    console.log(`\n🔧 Selected tool: ${selectedTool.name}`)

    if (selectedTool.description) {
      console.log(`📝 Description: ${selectedTool.description}`)
    }

    // Collect parameters if needed
    const args = {}
    if (selectedTool.inputSchema?.properties) {
      console.log('\n📋 This tool requires parameters:')
      const properties = selectedTool.inputSchema.properties

      for (const [paramName, paramSchema] of Object.entries(properties)) {
        const schema = paramSchema as any
        const isRequired = selectedTool.inputSchema.required?.includes(paramName) || false
        const prompt = `  ${paramName}${isRequired ? ' (required)' : ' (optional)'}: ${schema.description || 'No description'} `

        const value = await this.askQuestion(prompt)

        if (value || isRequired) {
          // Try to parse as JSON for complex types, otherwise use as string
          try {
            if (schema.type === 'object' || schema.type === 'array') {
              args[paramName] = JSON.parse(value)
            } else if (schema.type === 'number' || schema.type === 'integer') {
              args[paramName] = Number(value)
            } else if (schema.type === 'boolean') {
              args[paramName] = value.toLowerCase() === 'true'
            } else {
              args[paramName] = value
            }
          } catch {
            args[paramName] = value
          }
        }
      }
    }

    // Execute the tool
    console.log(`\n⏳ Executing tool "${selectedTool.name}"...`)
    try {
      const result = await this.client.callTool(serverId, selectedTool.name, args)
      console.log('\n✅ Tool execution completed:')
      result.content.forEach((content) => {
        if (content.type === 'text') {
          console.log(content.text)
        } else {
          console.log(`[${content.type}]`, content)
        }
      })
    } catch (error) {
      console.error('\n❌ Tool execution failed:', error)
    }

    const continueChoice = await this.askQuestion('\nExecute another tool? (y/n): ')
    if (continueChoice.toLowerCase() === 'y' || continueChoice.toLowerCase() === 'yes') {
      await this.startInteractiveToolExecution(serverId)
    }
  }

  private askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, resolve)
    })
  }

  close() {
    this.rl.close()
  }
}

async function main() {
  try {
    const config = parseArgs()

    console.log('🚀 Starting MCP over MQTT Client (Node.js)...')
    console.log(`📡 Client: ${config.name} v${config.version}`)
    console.log(`🌐 MQTT Broker: ${config.host}`)

    const client = new McpMqttClient(config)
    const interactive = new InteractiveInterface(client)

    const connectedServers: Set<string> = new Set()

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
        } else {
          console.log(`📚 No resources available on ${server.name}`)
        }

        // Add server to interactive interface
        interactive.addServer(server.serverId, server.name, tools, resources)
      } catch (error) {
        console.error(`❌ Failed to interact with server ${server.name}:`)
        console.error('   Error details:', error)
        console.error('   Stack:', error instanceof Error ? error.stack : 'No stack available')
      }
    })

    client.on('error', (error) => {
      console.error('❌ Client error:', error)
    })

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down client...')
      try {
        interactive.close()
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

    // Wait for initial server discovery
    console.log('⏳ Waiting for server discovery (5 seconds)...')
    console.log('   Make sure to start a server with: node node-server.js')

    setTimeout(async () => {
      if (connectedServers.size === 0) {
        console.log('⚠️  No servers discovered yet. You can still use the interactive interface.')
      }
      // Start interactive mode
      await interactive.start()
    }, 5000)
  } catch (error) {
    console.error('❌ Failed to start client:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Only run if this file is being executed directly
if ((process.argv[1] && process.argv[1].endsWith('node-client.ts')) || process.argv[1]?.endsWith('node-client.js')) {
  main().catch((error) => {
    console.error('❌ Unhandled error:', error)
    process.exit(1)
  })
}
