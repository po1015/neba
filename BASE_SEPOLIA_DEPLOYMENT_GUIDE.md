# NEBA Token Deployment on Base Sepolia

## Overview

This guide will help you deploy the NEBA token contract on Base Sepolia testnet using the modular architecture that solves the contract size limit issue.

## Prerequisites

### 1. Environment Setup

Create a `.env` file in your project root with the following variables:

```bash
# Base Sepolia RPC URL (free public endpoint)
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Your private key (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# Basescan API Key for contract verification (optional)
BASESCAN_API_KEY=your_basescan_api_key_here

# Gas reporting (optional)
REPORT_GAS=true
```

### 2. Get Testnet ETH

You'll need Base Sepolia ETH for gas fees. Get it from:

1. **Base Bridge**: https://bridge.base.org/deposit
   - Bridge ETH from Ethereum Sepolia to Base Sepolia
   
2. **Base Sepolia Faucet**: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
   - Get free testnet ETH

3. **Alternative Faucet**: https://faucet.quicknode.com/base/sepolia

### 3. Install Dependencies

```bash
npm install
```

## Deployment Options

### Option 1: Minimal Deployment (Recommended)

Deploy the lightweight minimal proxy with core functionality:

```bash
npm run deploy:base-sepolia
```

This deploys:
- ✅ NEBAminimal proxy contract (under size limit)
- ✅ NEBAcore module with essential ERC20 functionality
- ✅ All basic token features

### Option 2: Full Modular Deployment

If you need all features, you can deploy the full modular version:

```bash
# Deploy full modular version (may have size issues)
npm run deploy:modular-simple-sepolia
```

## Deployment Process

### Step 1: Compile Contracts

```bash
npx hardhat compile
```

### Step 2: Deploy to Base Sepolia

```bash
npm run deploy:base-sepolia
```

### Step 3: Verify Deployment

The deployment script will output:
- Contract addresses
- Transaction hashes
- BaseScan explorer links
- Verification status

## Network Details

- **Network Name**: Base Sepolia
- **Chain ID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org
- **Currency**: ETH

## Contract Addresses

After deployment, you'll get:

1. **Proxy Address**: Main contract address for interactions
2. **Implementation Address**: Logic contract address
3. **Core Module Address**: Core functionality module

## Verification

### Automatic Verification

The deployment script will attempt to verify contracts automatically if you have PIPECAN_API_KEY set.

### Manual Verification

```bash
npx hardhat verify --network base-sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

## Testing Your Deployment

### 1. Check Token Details

```javascript
// Connect to the deployed contract
const contract = await ethers.getContractAt("NEBAminimal", PROXY_ADDRESS);

// Get token details
const name = await contract.name();
const symbol = await contract.symbol();
const decimals = await contract.decimals();
const totalSupply = await contract.totalSupply();

console.log(`Token: ${name} (${symbol})`);
console.log(`Decimals: ${decimals}`);
console.log(`Total Supply: ${ethers.formatEther(totalSupply)} NEBA`);
```

### 2. Test Basic Functions

```javascript
// Test transfer
await contract.transfer(RECIPIENT_ADDRESS, ethers.parseEther("100"));

// Check balance
const balance = await contract.balanceOf(RECIPIENT_ADDRESS);
console.log(`Balance: ${ethers.formatEther(balance)} NEBA`);
```

## Troubleshooting

### Common Issues

1. **Insufficient ETH Balance**
   ```
   Error: Insufficient ETH balance
   Solution: Get testnet ETH from faucets mentioned above
   ```

2. **RPC Connection Issues**
   ```
   Error: Could not connect to network
   Solution: Check BASE_SEPOLIA_RPC_URL in .env file
   ```

3. **Private Key Issues**
   ```
   Error: Invalid private key
   Solution: Ensure PRIVATE_KEY is 64 characters without 0x prefix
   ```

### Gas Issues

If you encounter gas estimation issues:

```bash
# Increase gas limit
npx hardhat run scripts/deployBaseSepolia.js --network base-sepolia --gas-limit 10000000
```

## Adding Additional Modules

After deploying the minimal version, you can add modules:

### 1. Deploy Security Module

```bash
npx hardhat run scripts/deploySecurityModule.js --network base-sepolia
```

### 2. Deploy Rate Limiting Module

```bash
npx hardhat run scripts/deployRateLimitingModule.js --network base-sepolia
```

### 3. Deploy Emergency Module

```bash
npx hardhat run scripts/deployEmergencyModule.js --network base-sepolia
```

## Integration

### Frontend Integration

```javascript
// Contract ABI and address
const contractAddress = "YOUR_PROXY_ADDRESS";
const contractABI = require("./artifacts/contracts/NEBAminimal.sol/NEBAminimal.json").abi;

// Connect to contract
const contract = new ethers.Contract(contractAddress, contractABI, signer);
```

### Web3 Integration

```javascript
// Using Web3.js
const web3 = new Web3("https://sepolia.base.org");
const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
```

## Security Considerations

1. **Private Key Security**: Never commit your private key to version control
2. **Environment Variables**: Use .env file for sensitive data
3. **Contract Verification**: Always verify contracts on BaseScan
4. **Testing**: Test thoroughly on testnet before mainnet deployment

## Support

- **Base Documentation**: https://docs.base.org/
- **Base Discord**: https://discord.gg/buildonbase
- **BaseScan Explorer**: https://sepolia.basescan.org

## Next Steps

1. ✅ Deploy to Base Sepolia
2. ✅ Verify contracts
3. ✅ Test functionality
4. ✅ Deploy additional modules if needed
5. ✅ Integrate with frontend
6. ✅ Prepare for mainnet deployment

---

**Ready to deploy? Run:**

```bash
npm run deploy:base-sepolia
```
