# NEBA Token

A secure, upgradeable ERC-20 token implementation with advanced access control and compliance features.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation
```bash
npm install
```

### Build
```bash
npm run build
```

### Test
```bash
npm test
```

## 📋 Current Implementation

### ✅ Completed Features
- **Token Symbol:** $NEBA
- **Total Supply:** 1,000,000,000 tokens (fixed, no minting)
- **Decimals:** 18
- **Distribution:** 100% to Treasury Safe
- **Access Control:** Role-based permissions
- **Emergency Controls:** Pause/unpause functionality
- **Circuit Breaker:** Automated protection
- **Transfer Restrictions:** Whitelist/blacklist support
- **Snapshot Functionality:** Token balance snapshots with access control
- **Upgradeable:** UUPS proxy pattern

### 🔐 Roles
- `DEFAULT_ADMIN_ROLE` - Full administrative control
- `UPGRADER_ROLE` - Contract upgrade permissions
- `ADMIN_PAUSER_ROLE` - Can pause and unpause
- `BOT_PAUSER_ROLE` - Can only pause (automated bots)
- `GOVERNANCE_UNPAUSER_ROLE` - Can only unpause (governance)
- `EMERGENCY_GUARDIAN_ROLE` - Emergency pause capability
- `BLOCKLIST_MANAGER_ROLE` - Manage blocked addresses
- `WHITELIST_MANAGER_ROLE` - Manage whitelisted addresses
- `CIRCUIT_BREAKER_ROLE` - Circuit breaker management
- `PARAM_MANAGER_ROLE` - Parameter updates
- `FINANCE_ROLE` - Financial operations
- `SNAPSHOT_ROLE` - Snapshot management

## 🛠️ Development

### Available Scripts
```bash
npm run build          # Compile contracts
npm test              # Run tests
npm run deploy:local  # Deploy to local network
npm run deploy:sepolia # Deploy to Sepolia testnet
npm run deploy:mainnet # Deploy to mainnet
```

### Environment Setup
Copy `env.example` to `.env` and configure:
```env
SEPOLIA_RPC_URL=your_rpc_url
MAINNET_RPC_URL=your_rpc_url
PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=your_etherscan_key
TREASURY_ADDRESS=your_treasury_address
```

## 📄 Documentation

- [Client Requirements Implementation](CLIENT_REQUIREMENTS_IMPLEMENTATION.md) - Detailed compliance tracking

## 🔒 Security Features

- **Pausable:** Emergency stop functionality
- **Access Control:** Multi-role permission system
- **Circuit Breaker:** Automated anomaly detection
- **Transfer Hooks:** Custom compliance logic
- **Reentrancy Protection:** Guard against reentrancy attacks
- **Storage Gap:** Safe upgrade compatibility

## 📊 Test Coverage

All tests passing:
- ✅ Initialization tests
- ✅ Transfer functionality
- ✅ Access control tests
- ✅ Pause/unpause tests
- ✅ Circuit breaker tests
- ✅ Role management tests
- ✅ Transfer restriction tests
- ✅ Snapshot functionality tests

## 🚀 Deployment

The contract is ready for production deployment with all critical requirements implemented.

## 📞 Support

For questions about implementation details, see the [Client Requirements Implementation](CLIENT_REQUIREMENTS_IMPLEMENTATION.md) document.