#!/bin/bash

# MCP MQTT Client startup script
# Quick start for MCP over MQTT client from source

set -e

echo "🚀 Starting MCP MQTT Client from source..."

# Check if TypeScript is available
if ! command -v tsx &> /dev/null && ! command -v ts-node &> /dev/null; then
    echo "❌ Neither tsx nor ts-node found. Installing tsx..."
    npm install -g tsx
fi

# Default parameters
HOST="mqtt://localhost:1883"

CLIENT_NAME="MCP MQTT Client"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            HOST="$2"
            shift 2
            ;;

        --client-name)
            CLIENT_NAME="$2"
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

            echo "  --client-name <name>   Client name (default: MCP MQTT Client)"
            echo "  --username <user>      MQTT username"
            echo "  --password <pass>      MQTT password"
            echo "  --help, -h             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0"
            echo "  $0 --host mqtt://mqtt.example.com:8883"
            echo "  $0 --client-name \"Test Client\" --username myuser --password mypass"
            echo ""
            echo "Note: Make sure to start a server first with ./start-server.sh"
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
    CMD="tsx node-client.ts"
else
    CMD="ts-node node-client.ts"
fi

CMD="$CMD --host $HOST --client-name \"$CLIENT_NAME\""

if [ ! -z "$USERNAME" ]; then
    CMD="$CMD --username $USERNAME"
fi

if [ ! -z "$PASSWORD" ]; then
    CMD="$CMD --password $PASSWORD"
fi

echo "📡 Client configuration:"
echo "   Host: $HOST"

echo "   Name: $CLIENT_NAME"
if [ ! -z "$USERNAME" ]; then
    echo "   User: $USERNAME"
fi
echo ""

# Start client
echo "▶️  Command: $CMD"
echo ""
eval $CMD
