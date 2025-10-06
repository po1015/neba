# 🚀 NEBA Token Deployment Guide

## 📋 Prerequisites

Before deploying to Sepolia testnet, ensure you have:

1. **Sepolia ETH**: Get testnet ETH from [Sepolia Faucet](https://sepoliafaucet.com/)
2. **RPC Endpoint**: Get from [Infura](https://infura.io/) or [Alchemy](https://alchemy.com/)
3. **Etherscan API Key**: Get from [Etherscan](https://etherscan.io/apis)
4. **Private Key**: Your wallet's private key (64 characters, no 0x prefix)
5. **Treasury Address**: Address that will receive all tokens (Gnosis Safe or wallet)

## 🔧 Environment Setup

1. **Copy environment template:**
   ```bash
   cp env.example .env
   ```

2. **Update `.env` file with your values:**
   ```env
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
   PRIVATE_KEY=your_64_character_private_key_without_0x_prefix
   ETHERSCAN_API_KEY=your_etherscan_api_key
   TREASURY_ADDRESS=0xYourTreasuryAddress
   ```

## 🌐 Sepolia Testnet Deployment

### Step 1: Deploy the Contract

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

**Expected Output:**
```
Deploying NEBA Token...
Deploying contracts with the account: 0x...
Account balance: 10000000000000000000000
Deployment parameters:
- Treasury: 0x...
- Admin: 0x...
- Commit Timeout: 3600 seconds
- Circuit Breaker Reset Interval: 86400 seconds
NEBA Token deployed to: 0x...
Implementation deployed to: 0x...
```

### Step 2: Save Deployment Addresses

After successful deployment, save the addresses:
```bash
export NEBA_TOKEN_ADDRESS=0x...  # From deployment output
export IMPLEMENTATION_ADDRESS=0x...  # From deployment output
```

### Step 3: Verify Deployment

```bash
NEBA_TOKEN_ADDRESS=0x... npx hardhat run scripts/verifyDeployment.js --network sepolia
```

### Step 4: Verify on Etherscan

```bash
npx hardhat verify --network sepolia 0xNEBA_TOKEN_ADDRESS "0xTREASURY_ADDRESS" "0xADMIN_ADDRESS" 3600 86400
```

## 📊 Post-Deployment Verification

### Contract Information
- **Name**: NEBA Token
- **Symbol**: $NEBA
- **Decimals**: 18
- **Total Supply**: 1,000,000,000 tokens
- **Distribution**: 100% to Treasury

### Key Functions to Test
1. **Snapshot Creation**: `createSnapshot()`
2. **Role Management**: Grant/revoke roles
3. **Transfer Restrictions**: Enable/disable whitelist
4. **Emergency Controls**: Pause/unpause functionality

### Test Transactions

1. **Create Snapshot:**
   ```javascript
   const snapshotId = await nebaToken.createSnapshot();
   ```

2. **Enable Trading:**
   ```javascript
   await nebaToken.enableTrading();
   ```

3. **Transfer Tokens:**
   ```javascript
   await nebaToken.transfer(recipientAddress, ethers.parseEther("1000"));
   ```

## 🔐 Role Management

After deployment, configure roles:

```bash
npx hardhat run scripts/grantRoles.js --network sepolia
```

### Available Roles
- `DEFAULT_ADMIN_ROLE`: Full administrative control
- `UPGRADER_ROLE`: Contract upgrade permissions
- `ADMIN_PAUSER_ROLE`: Can pause and unpause
- `BOT_PAUSER_ROLE`: Can only pause (automated bots)
- `GOVERNANCE_UNPAUSER_ROLE`: Can only unpause (governance)
- `EMERGENCY_GUARDIAN_ROLE`: Emergency pause capability
- `BLOCKLIST_MANAGER_ROLE`: Manage blocked addresses
- `WHITELIST_MANAGER_ROLE`: Manage whitelisted addresses
- `CIRCUIT_BREAKER_ROLE`: Circuit breaker management
- `PARAM_MANAGER_ROLE`: Parameter updates
- `FINANCE_ROLE`: Financial operations
- `SNAPSHOT_ROLE`: Snapshot management

## 📝 Update Documentation

After successful deployment, update:

1. **`audits/addresses.json`**: Add new contract addresses
2. **Deployment logs**: Save transaction hashes and block numbers
3. **Verification links**: Etherscan contract URLs

## 🚨 Troubleshooting

### Common Issues

1. **"Private key too short"**: Ensure private key is 64 characters without 0x
2. **"Insufficient funds"**: Get more Sepolia ETH from faucet
3. **"Contract verification failed"**: Check constructor arguments
4. **"Transaction failed"**: Increase gas limit or check network

### Gas Optimization

The contract is optimized for gas efficiency:
- **Deployment**: ~3,000,000 gas
- **Transfer**: ~65,000 gas
- **Snapshot Creation**: ~50,000 gas

## ✅ Deployment Checklist

- [ ] Environment variables configured
- [ ] Sepolia ETH obtained
- [ ] Contract deployed successfully
- [ ] Deployment verified on Etherscan
- [ ] Token functionality tested
- [ ] Roles configured properly
- [ ] Documentation updated
- [ ] Addresses saved securely

## 🔗 Useful Links

- [Sepolia Faucet](https://sepoliafaucet.com/)
- [Etherscan Sepolia](https://sepolia.etherscan.io/)
- [Infura](https://infura.io/)
- [Alchemy](https://alchemy.com/)

## 📞 Support

For deployment issues, check:
1. Network connectivity
2. Gas fees and limits
3. Environment configuration
4. Contract compilation
5. Etherscan verification status
