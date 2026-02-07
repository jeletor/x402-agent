# x402-wallet

Agent wallet for the [x402 payment protocol](https://x402.org). Enables AI agents to pay for x402-protected resources automatically.

> Note: This is a standalone wallet implementation. For Coinbase's MCP server, see [@x402/agent](https://npmjs.com/package/x402-agent).

## Installation

```bash
npm install x402-wallet
```

## Quick Start

```javascript
const { createWallet } = require('x402-agent');

// Create wallet from private key
const wallet = createWallet(process.env.PRIVATE_KEY);

// Make a request to an x402-protected endpoint
// Payment is handled automatically if the server returns HTTP 402
const result = await wallet.get('https://api.example.com/data');
console.log(result.data);
console.log('Paid:', result.paid);
```

## Features

- **Auto-pay 402 responses** — Wraps fetch to automatically handle HTTP 402 Payment Required
- **EVM compatible** — Works with any EVM chain (Base, Ethereum, etc.)
- **USDC payments** — Uses USDC stablecoins via EIP-3009 or Permit2
- **Payment limits** — Set maximum payment per request
- **Balance checking** — Query USDC balance

## API

### `createWallet(privateKey, options?)`

Creates a wallet instance.

**Parameters:**
- `privateKey` — Hex private key (with or without `0x` prefix)
- `options.network` — Network ID (default: `'eip155:8453'` for Base mainnet)
- `options.rpcUrl` — Custom RPC URL (optional)
- `options.maxPayment` — Maximum payment in cents (default: 100 = $1)

**Returns:** Wallet instance

```javascript
const wallet = createWallet('0x...', {
  network: 'eip155:84532', // Base Sepolia testnet
  maxPayment: 50, // 50 cents max
});
```

### Wallet Methods

#### `wallet.fetch(url, init?)`

Fetch wrapper that auto-pays 402 responses.

```javascript
const response = await wallet.fetch('https://api.example.com/data');
const data = await response.json();
```

#### `wallet.get(url, headers?)`

Convenience method for GET requests.

```javascript
const { status, data, paid } = await wallet.get('https://api.example.com/data');
```

#### `wallet.post(url, body, headers?)`

Convenience method for POST requests.

```javascript
const { data, paid } = await wallet.post('https://api.example.com/submit', {
  key: 'value'
});
```

#### `wallet.getBalance()`

Check USDC balance.

```javascript
const { formatted, currency, network } = await wallet.getBalance();
console.log(`${formatted} ${currency}`);
```

#### `wallet.close()`

Clean up resources.

### `createWalletFromEnv(envVar?, options?)`

Creates wallet from environment variable.

```javascript
const { createWalletFromEnv } = require('x402-agent');

// Uses X402_PRIVATE_KEY by default
const wallet = createWalletFromEnv();

// Or specify a different env var
const wallet = createWalletFromEnv('MY_WALLET_KEY');
```

### `createPaidFetch(privateKey, options?)`

Creates a fetch function that auto-pays 402 responses.

```javascript
const { createPaidFetch } = require('x402-agent');

const paidFetch = createPaidFetch(process.env.PRIVATE_KEY);
const response = await paidFetch('https://api.example.com/data');
```

## CLI

```bash
# Check balance
X402_PRIVATE_KEY=0x... npx x402-wallet balance

# Fetch a URL (auto-pay 402)
X402_PRIVATE_KEY=0x... npx x402-wallet get https://api.example.com/data

# POST to a URL
X402_PRIVATE_KEY=0x... npx x402-wallet post https://api.example.com/submit '{"key":"value"}'
```

## Networks

Supported networks:
- `eip155:8453` — Base mainnet (default)
- `eip155:84532` — Base Sepolia testnet

Set via `X402_NETWORK` environment variable or `network` option.

## How It Works

1. Your request hits a 402-protected endpoint
2. Server responds with HTTP 402 and payment requirements
3. x402-agent signs a payment authorization (EIP-3009 or Permit2)
4. Request is retried with payment headers
5. Server settles payment and returns the resource

The payment uses gasless signatures — your private key signs an authorization, and the server's facilitator executes the on-chain transfer.

## Related Packages

- [@x402/core](https://www.npmjs.com/package/@x402/core) — Core x402 protocol
- [@x402/fetch](https://www.npmjs.com/package/@x402/fetch) — Fetch wrapper
- [@x402/evm](https://www.npmjs.com/package/@x402/evm) — EVM implementation

## License

MIT

## Author

Built by [Jeletor](https://x.com/Jeletor)
