#!/bin/bash

# MCP MQTT Server startup script
# Quick start for MCP over MQTT server from source

set -e

echo "🚀 Starting MCP MQTT Server from source..."

# Check if TypeScript is available
if ! command -v tsx &> /dev/null && ! command -v ts-node &> /dev/null; then
    echo "❌ Neither tsx nor ts-node found. Installing tsx..."
    npm install -g tsx
fi

# Default parameters
HOST="mqtt://localhost:1883"

SERVER_NAME="MCP MQTT Server"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            HOST="$2"
            shift 2
            ;;

        --server-name)
            SERVER_NAME="$2"
            shift 2
            ;;
        --server-id)
            SERVER_ID="$2"
            shift 2
            ;;
        --username)
            USERNAME="$2"
            shift 2
            ;;
        --password)
            PASSWORD="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --host <host>          MQTT broker URL (default: mqtt://localhost:1883)"

            echo "  --server-name <name>   Server name (default: MCP MQTT Server)"
            echo "  --server-id <id>       Unique server ID (auto-generated if not provided)"
            echo "  --username <user>      MQTT username"
            echo "  --password <pass>      MQTT password"
            echo "  --help, -h             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0"
            echo "  $0 --host mqtt://mqtt.example.com:8883"
            echo "  $0 --server-name \"Production Server\" --username myuser --password mypass"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for help"
            exit 1
            ;;
    esac
done

# Build startup command
if command -v tsx &> /dev/null; then
    CMD="tsx node-server.ts"
else
    CMD="ts-node node-server.ts"
fi

CMD="$CMD --host $HOST --server-name \"$SERVER_NAME\""

if [ ! -z "$SERVER_ID" ]; then
    CMD="$CMD --server-id $SERVER_ID"
fi

if [ ! -z "$USERNAME" ]; then
    CMD="$CMD --username $USERNAME"
fi

if [ ! -z "$PASSWORD" ]; then
    CMD="$CMD --password $PASSWORD"
fi

echo "📡 Server configuration:"
echo "   Host: $HOST"

echo "   Name: $SERVER_NAME"
if [ ! -z "$SERVER_ID" ]; then
    echo "   Server ID: $SERVER_ID"
fi
if [ ! -z "$USERNAME" ]; then
    echo "   User: $USERNAME"
fi
echo ""

# Start server
echo "▶️  Command: $CMD"
echo ""
eval $CMD
