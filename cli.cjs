#!/usr/bin/env node

/**
 * x402-agent CLI
 * 
 * Commands:
 *   balance              Check USDC balance
 *   get <url>            Fetch a URL (auto-pay 402)
 *   post <url> <json>    POST to a URL (auto-pay 402)
 */

const { createWallet, createWalletFromEnv } = require('./index.cjs');

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  // Try to get private key from env
  const privateKey = process.env.X402_PRIVATE_KEY;
  const network = process.env.X402_NETWORK || 'eip155:8453';
  
  if (!privateKey && command !== 'help') {
    console.error('Error: X402_PRIVATE_KEY environment variable required');
    console.error('Set it to your hex private key (with or without 0x prefix)');
    process.exit(1);
  }
  
  const wallet = privateKey ? createWallet(privateKey, { network }) : null;
  
  switch (command) {
    case 'balance': {
      try {
        const result = await wallet.getBalance();
        console.log(`Address: ${wallet.address}`);
        console.log(`Network: ${result.network}`);
        console.log(`Balance: ${result.formatted} ${result.currency}`);
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
      break;
    }
    
    case 'get': {
      const url = args[1];
      if (!url) {
        console.error('Usage: x402-agent get <url>');
        process.exit(1);
      }
      
      try {
        console.error(`Fetching ${url}...`);
        const result = await wallet.get(url);
        if (result.paid) {
          console.error('(Payment was made)');
        }
        console.log(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2));
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
      break;
    }
    
    case 'post': {
      const url = args[1];
      const body = args[2];
      if (!url || !body) {
        console.error('Usage: x402-agent post <url> <json-body>');
        process.exit(1);
      }
      
      try {
        const parsed = JSON.parse(body);
        console.error(`POSTing to ${url}...`);
        const result = await wallet.post(url, parsed);
        if (result.paid) {
          console.error('(Payment was made)');
        }
        console.log(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2));
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
      break;
    }
    
    case 'help':
    case '--help':
    case '-h':
    default: {
      console.log(`x402-agent — Agent wallet for x402 payment protocol

Commands:
  balance              Check USDC balance
  get <url>            Fetch a URL (auto-pay 402)
  post <url> <json>    POST to a URL (auto-pay 402)
  help                 Show this help

Environment:
  X402_PRIVATE_KEY     Hex private key (required)
  X402_NETWORK         Network ID (default: eip155:8453 = Base mainnet)
                       Use eip155:84532 for Base Sepolia testnet

Examples:
  X402_PRIVATE_KEY=0x... x402-agent balance
  X402_PRIVATE_KEY=0x... x402-agent get https://api.example.com/data
  X402_PRIVATE_KEY=0x... x402-agent post https://api.example.com/submit '{"key":"value"}'
`);
      break;
    }
  }
  
  wallet?.close();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
