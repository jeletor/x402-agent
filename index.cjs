/**
 * x402-agent — Agent wallet for x402 payment protocol
 * 
 * Simple API for AI agents to pay for x402-protected resources.
 * Wraps @x402/* packages with a clean, agent-friendly interface.
 */

const { wrapFetchWithPayment } = require('@x402/fetch');
const { x402Client } = require('@x402/core/client');
const { ExactEvmScheme, toClientEvmSigner } = require('@x402/evm');
const { privateKeyToAccount } = require('viem/accounts');
const { createPublicClient, http, formatUnits } = require('viem');
const { base, baseSepolia } = require('viem/chains');

// USDC contract addresses
const USDC_ADDRESSES = {
  'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base mainnet
  'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
};

// ERC20 ABI for balance checking
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
];

/**
 * Create an x402 wallet from a private key
 * 
 * @param {string} privateKey - Hex private key (with or without 0x prefix)
 * @param {object} options - Configuration options
 * @param {string} options.network - Network identifier (default: 'eip155:8453' for Base mainnet)
 * @param {string} options.rpcUrl - Custom RPC URL (optional)
 * @param {number} options.maxPayment - Maximum payment in cents (optional, default: 100)
 * @returns {object} Wallet instance
 */
function createWallet(privateKey, options = {}) {
  const {
    network = 'eip155:8453',
    rpcUrl,
    maxPayment = 100, // 100 cents = $1 default max
  } = options;

  // Normalize private key
  const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  
  // Create viem account
  const account = privateKeyToAccount(normalizedKey);
  
  // Create signer (adapter for x402)
  const signer = toClientEvmSigner(account);
  
  // Create the EVM scheme client
  const evmSchemeClient = new ExactEvmScheme(signer);
  
  // Create x402 client and register the EVM scheme
  const client = x402Client.fromConfig({
    schemes: [
      { x402Version: 2, network: 'eip155:*', client: evmSchemeClient },
    ],
    policies: maxPayment ? [
      (version, accepts) => accepts.filter(a => {
        // Filter by max payment (amount is in USDC smallest unit = 10^-6)
        // Convert to cents: amount / 10^4
        const amountCents = parseInt(a.maxAmountRequired || a.amount || '0', 10) / 10000;
        return amountCents <= maxPayment;
      }),
    ] : undefined,
  });
  
  // Get chain config
  const chain = network === 'eip155:84532' ? baseSepolia : base;
  
  // Create public client for balance queries
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
  
  // Wrap fetch with payment handling
  const paidFetch = wrapFetchWithPayment(fetch, client);
  
  return {
    address: account.address,
    network,
    
    /**
     * Get USDC balance
     * @returns {Promise<{balance: string, formatted: string}>}
     */
    async getBalance() {
      const usdcAddress = USDC_ADDRESSES[network];
      if (!usdcAddress) {
        throw new Error(`Unknown USDC address for network ${network}`);
      }
      
      const balance = await publicClient.readContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      });
      
      const decimals = await publicClient.readContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      });
      
      const formatted = formatUnits(balance, decimals);
      
      return {
        balance: balance.toString(),
        formatted,
        currency: 'USDC',
        network,
      };
    },
    
    /**
     * Fetch a resource, automatically handling 402 payments
     * 
     * @param {string} url - URL to fetch
     * @param {object} init - Fetch options
     * @returns {Promise<Response>}
     */
    async fetch(url, init) {
      return paidFetch(url, init);
    },
    
    /**
     * Make a GET request with automatic payment
     * 
     * @param {string} url - URL to fetch
     * @param {object} headers - Additional headers
     * @returns {Promise<{status: number, data: any, paid: boolean}>}
     */
    async get(url, headers = {}) {
      const response = await paidFetch(url, {
        method: 'GET',
        headers,
      });
      
      const data = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        parsed = data;
      }
      
      return {
        status: response.status,
        data: parsed,
        paid: response.headers.has('x-payment-response') || response.headers.has('payment-response'),
      };
    },
    
    /**
     * Make a POST request with automatic payment
     * 
     * @param {string} url - URL to fetch
     * @param {object} body - Request body
     * @param {object} headers - Additional headers
     * @returns {Promise<{status: number, data: any, paid: boolean}>}
     */
    async post(url, body, headers = {}) {
      const response = await paidFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
      });
      
      const data = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        parsed = data;
      }
      
      return {
        status: response.status,
        data: parsed,
        paid: response.headers.has('x-payment-response') || response.headers.has('payment-response'),
      };
    },
    
    /**
     * Close the wallet (cleanup)
     */
    close() {
      // No persistent connections to clean up
    },
  };
}

/**
 * Create a wallet from environment variable
 * 
 * @param {string} envVar - Environment variable name (default: X402_PRIVATE_KEY)
 * @param {object} options - Configuration options
 * @returns {object} Wallet instance
 */
function createWalletFromEnv(envVar = 'X402_PRIVATE_KEY', options = {}) {
  const privateKey = process.env[envVar];
  if (!privateKey) {
    throw new Error(`Environment variable ${envVar} not set`);
  }
  return createWallet(privateKey, options);
}

/**
 * Create a simple fetch function that auto-pays 402 responses
 * 
 * @param {string} privateKey - Hex private key
 * @param {object} options - Configuration options
 * @returns {function} Enhanced fetch function
 */
function createPaidFetch(privateKey, options = {}) {
  const wallet = createWallet(privateKey, options);
  return wallet.fetch.bind(wallet);
}

module.exports = {
  createWallet,
  createWalletFromEnv,
  createPaidFetch,
  USDC_ADDRESSES,
};
