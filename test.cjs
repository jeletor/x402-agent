/**
 * x402-agent tests
 */

const { createWallet, createPaidFetch, USDC_ADDRESSES } = require('./index.cjs');

// Test private key (DO NOT USE IN PRODUCTION - this is just for testing)
const TEST_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertDefined(value, message) {
  if (value === undefined || value === null) {
    throw new Error(`${message}: expected defined value`);
  }
}

console.log('Running x402-agent tests...\n');

// Test: createWallet returns expected structure
test('createWallet returns wallet with address', () => {
  const wallet = createWallet(TEST_KEY);
  assertDefined(wallet.address, 'address');
  assertEqual(wallet.address.startsWith('0x'), true, 'address format');
  wallet.close();
});

// Test: createWallet with options
test('createWallet accepts network option', () => {
  const wallet = createWallet(TEST_KEY, { network: 'eip155:84532' });
  assertEqual(wallet.network, 'eip155:84532', 'network');
  wallet.close();
});

// Test: createWallet with maxPayment policy
test('createWallet accepts maxPayment option', () => {
  const wallet = createWallet(TEST_KEY, { maxPayment: 50 });
  assertDefined(wallet.fetch, 'fetch method');
  wallet.close();
});

// Test: wallet has expected methods
test('wallet has required methods', () => {
  const wallet = createWallet(TEST_KEY);
  assertDefined(wallet.fetch, 'fetch');
  assertDefined(wallet.get, 'get');
  assertDefined(wallet.post, 'post');
  assertDefined(wallet.getBalance, 'getBalance');
  assertDefined(wallet.close, 'close');
  wallet.close();
});

// Test: createPaidFetch returns function
test('createPaidFetch returns function', () => {
  const paidFetch = createPaidFetch(TEST_KEY);
  assertEqual(typeof paidFetch, 'function', 'paidFetch type');
});

// Test: USDC addresses are defined
test('USDC addresses for known networks', () => {
  assertDefined(USDC_ADDRESSES['eip155:8453'], 'Base mainnet USDC');
  assertDefined(USDC_ADDRESSES['eip155:84532'], 'Base Sepolia USDC');
});

// Test: private key normalization
test('createWallet normalizes private key without 0x', () => {
  const keyWithout0x = TEST_KEY.slice(2);
  const wallet = createWallet(keyWithout0x);
  assertDefined(wallet.address, 'address from key without 0x');
  wallet.close();
});

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
