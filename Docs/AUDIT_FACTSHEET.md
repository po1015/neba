# NEBA Token - Audit Factsheet

## 📊 **Project Overview**

| Property | Value |
|----------|-------|
| **Project Name** | NEBA Token |
| **Version** | V1.0.0 |
| **License** | MIT |
| **Token Symbol** | $NEBA |
| **Token Name** | NEBA Token |
| **Total Supply** | 1,000,000,000 tokens |
| **Decimals** | 18 |
| **Standard** | ERC-20 with extensions |

## 🔧 **Technical Specifications**

### **Compiler Configuration**
- **Solidity Version:** 0.8.22
- **Optimizer:** Enabled
- **Optimizer Runs:** 200
- **Via IR:** Enabled
- **Target EVM:** Paris

### **Contract Metrics**
- **Main Contract:** NEBA.sol
- **Lines of Code:** ~607 lines
- **Contract Size:** ~18KB (estimated)
- **Inheritance Depth:** 6 levels
- **External Functions:** 25+
- **Public Functions:** 15+
- **View Functions:** 10+

### **Dependencies**
- **OpenZeppelin Contracts:** ^5.4.0
- **OpenZeppelin Upgradeable:** ^5.4.0
- **Hardhat:** ^2.26.3
- **Node.js:** >=16.0.0

## 🏗️ **Architecture**

### **Inheritance Chain**
```
NEBA
├── ERC20Upgradeable
├── ERC20PausableUpgradeable
├── AccessControlUpgradeable
├── ERC20PermitUpgradeable
├── UUPSUpgradeable
└── ReentrancyGuardUpgradeable
```

### **Key Components**
- **Main Contract:** NEBA.sol
- **Circuit Breaker:** CircuitBreaker.sol
- **Transfer Hook:** TransferHook.sol
- **Interfaces:** ICircuitBreaker.sol, ITransferHook.sol

## 🔐 **Security Features**

### **Access Control**
- **11 Roles:** Comprehensive role-based permissions
- **Multi-sig Support:** Treasury and admin roles
- **Role Separation:** Distinct pause/unpause roles

### **Emergency Controls**
- **Pausable:** Emergency stop functionality
- **Circuit Breaker:** Automated anomaly detection
- **Transfer Restrictions:** Whitelist/blacklist support

### **Upgradeability**
- **UUPS Pattern:** Universal Upgradeable Proxy Standard
- **Storage Gap:** 50 slots for future compatibility
- **Initialization Protection:** Constructor disables initializers

## 🌐 **Network Support**

### **Target Networks**
- **Mainnet:** Ethereum Mainnet
- **Testnet:** Sepolia
- **Local:** Hardhat Network
- **L2:** Base (planned)

### **Deployment Configuration**
- **Proxy Pattern:** UUPS
- **Implementation:** Upgradeable
- **Verification:** Etherscan + Sourcify

## 📈 **Gas Optimization**

### **Gas Usage Estimates**
- **Deployment:** ~3,000,000 gas
- **Transfer:** ~65,000 gas
- **Pause:** ~50,000 gas
- **Role Grant:** ~100,000 gas

### **Optimization Features**
- **Custom Errors:** Gas-efficient error handling
- **Packed Structs:** Optimized storage layout
- **Minimal External Calls:** Reduced gas consumption

## 🧪 **Testing Coverage**

### **Test Framework**
- **Framework:** Hardhat + Chai
- **Test Files:** 1 main test file
- **Test Cases:** 22 comprehensive tests
- **Coverage:** All critical paths tested

### **Test Categories**
- ✅ Initialization tests
- ✅ Transfer functionality
- ✅ Access control tests
- ✅ Pause/unpause tests
- ✅ Circuit breaker tests
- ✅ Role management tests
- ✅ Transfer restriction tests

## 📋 **Compliance**

### **Standards Compliance**
- **ERC-20:** Full compliance
- **ERC-2612:** Permit functionality
- **ERC-1822:** UUPS proxy pattern
- **ERC-1404:** Basic hooks (V2 full implementation)

### **Security Best Practices**
- ✅ Checks-Effects-Interactions pattern
- ✅ Reentrancy protection
- ✅ Access control validation
- ✅ Input validation
- ✅ Event emission
- ✅ Custom error usage

## 🔍 **Audit Readiness**

### **Code Quality**
- **Linting:** Prettier configured
- **Documentation:** Comprehensive NatSpec
- **Comments:** Detailed function documentation
- **Structure:** Clean, modular design

### **Documentation**
- **README:** Project overview
- **NatSpec:** Function documentation
- **Requirements:** Implementation tracking
- **Runbooks:** Operational procedures

## 📞 **Contact Information**

- **Development Team:** NEBA Development Team
- **License:** MIT
- **Repository:** Private
- **Last Updated:** October 2025

---

*This factsheet provides essential information for auditors and security reviewers evaluating the NEBA Token smart contract implementation.*
