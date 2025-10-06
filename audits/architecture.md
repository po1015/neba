# NEBA Token - Architecture Overview

## 🏗️ **System Architecture**

### **High-Level Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEBA Token System                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   NEBA Token    │    │ Circuit Breaker │    │ Transfer Hook│ │
│  │   (Main Proxy)  │◄──►│   Contract      │◄──►│   Contract   │ │
│  │                 │    │                 │    │              │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                       │                       │     │
│           ▼                       ▼                       ▼     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │  Implementation │    │   Protection    │    │  Compliance  │ │
│  │     Layer       │    │     Layer       │    │    Layer     │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### **Contract Inheritance Hierarchy**

```
NEBA Token
├── ERC20Upgradeable
│   ├── ERC20 (OpenZeppelin)
│   └── Initializable
├── ERC20PausableUpgradeable
│   ├── PausableUpgradeable
│   └── Initializable
├── AccessControlUpgradeable
│   ├── AccessControl (OpenZeppelin)
│   └── Initializable
├── ERC20PermitUpgradeable
│   ├── ERC20Permit (OpenZeppelin)
│   └── EIP712Upgradeable
├── UUPSUpgradeable
│   ├── ERC1967Upgrade
│   └── Initializable
└── ReentrancyGuardUpgradeable
    ├── ReentrancyGuard (OpenZeppelin)
    └── Initializable
```

### **Role-Based Access Control**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Role Hierarchy                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                           │
│  │ DEFAULT_ADMIN   │ ◄─── Full Administrative Control          │
│  │     ROLE        │                                           │
│  └─────────────────┘                                           │
│           │                                                     │
│           ├─── UPGRADER_ROLE (Contract Upgrades)               │
│           ├─── ADMIN_PAUSER_ROLE (Emergency Controls)          │
│           ├─── BOT_PAUSER_ROLE (Automated Pause)               │
│           ├─── GOVERNANCE_UNPAUSER_ROLE (Governance Unpause)   │
│           ├─── EMERGENCY_GUARDIAN_ROLE (Emergency Pause)       │
│           ├─── BLOCKLIST_MANAGER_ROLE (Blocklist Management)   │
│           ├─── WHITELIST_MANAGER_ROLE (Whitelist Management)   │
│           ├─── CIRCUIT_BREAKER_ROLE (Protection Management)    │
│           ├─── PARAM_MANAGER_ROLE (Parameter Updates)          │
│           └─── FINANCE_ROLE (Financial Operations)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### **Transfer Flow Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Transfer Flow                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Transfer Request                                               │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │   Pause Check   │ ◄─── Contract Paused?                    │
│  └─────────────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Blocklist Check │ ◄─── Sender/Receiver Blocked?            │
│  └─────────────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Whitelist Check │ ◄─── Transfer Restrictions Enabled?      │
│  └─────────────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Circuit Breaker │ ◄─── Protection Active?                  │
│  │     Check       │                                           │
│  └─────────────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Trading Check   │ ◄─── Trading Enabled?                    │
│  └─────────────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Transfer Hook   │ ◄─── Custom Compliance Logic             │
│  └─────────────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Execute Transfer│ ◄─── All Checks Passed                   │
│  └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### **Emergency Control Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                Emergency Control System                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   Admin Pause   │    │   Bot Pause     │    │ Emergency    │ │
│  │   (Full Control)│    │ (Automated)     │    │ Guardian     │ │
│  │                 │    │                 │    │ (Immediate)  │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                       │                       │     │
│           └───────────────────────┼───────────────────────┘     │
│                                   │                             │
│                                   ▼                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                Contract Pause State                         │ │
│  │                                                             │ │
│  │  • All transfers blocked                                   │ │
│  │  • Emergency functions available                           │ │
│  │  • Audit trail maintained                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                   │                             │
│                                   ▼                             │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   Admin Unpause │    │ Governance      │                    │
│  │ (Immediate)     │    │ Unpause         │                    │
│  │                 │    │ (Timelock)      │                    │
│  └─────────────────┘    └─────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### **Upgrade Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Upgrade System                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                           │
│  │   Proxy Contract│ ◄─── User Interactions                    │
│  │   (NEBA Token)  │                                           │
│  └─────────────────┘                                           │
│           │                                                     │
│           │ delegates to                                        │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Implementation  │ ◄─── Current Logic                        │
│  │   Contract V1   │                                           │
│  └─────────────────┘                                           │
│           │                                                     │
│           │ upgrade to                                          │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Implementation  │ ◄─── New Logic (V2)                       │
│  │   Contract V2   │                                           │
│  └─────────────────┘                                           │
│                                                                 │
│  ┌─────────────────┐                                           │
│  │  UPGRADER_ROLE  │ ◄─── Authorization Required               │
│  │   Authorization │                                           │
│  └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### **Storage Layout**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Storage Layout                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Slot 0:    ERC20Upgradeable._balances                         │
│  Slot 1:    ERC20Upgradeable._allowances                       │
│  Slot 2:    ERC20Upgradeable._totalSupply                      │
│  Slot 3:    ERC20Upgradeable._name                             │
│  Slot 4:    ERC20Upgradeable._symbol                           │
│  Slot 5:    ERC20Upgradeable._decimals                         │
│  Slot 6:    AccessControlUpgradeable._roles                    │
│  Slot 7:    PausableUpgradeable._paused                        │
│  Slot 8:    ERC20PermitUpgradeable._nonces                     │
│  Slot 9:    ERC20PermitUpgradeable._EIP712Version              │
│  Slot 10:   ERC20PermitUpgradeable._EIP712Name                 │
│  Slot 11:   ERC20PermitUpgradeable._EIP712DomainSeparator      │
│  Slot 12:   UUPSUpgradeable._ERC1967Upgrade                    │
│  Slot 13:   ReentrancyGuardUpgradeable._status                 │
│  Slot 14:   NEBA.treasury                                      │
│  Slot 15:   NEBA.circuitBreaker                                │
│  Slot 16:   NEBA.transferHook                                  │
│  Slot 17:   NEBA.commitTimeout                                 │
│  Slot 18:   NEBA.circuitBreakerResetInterval                   │
│  Slot 19:   NEBA.tradingEnabled                                │
│  Slot 20:   NEBA.transferRestrictionsEnabled                   │
│  Slot 21:   NEBA.whitelist (mapping)                           │
│  Slot 22:   NEBA.blocklist (mapping)                           │
│  Slot 23:   NEBA.commitments (mapping)                         │
│  Slot 24:   NEBA.pendingUpdates (mapping)                      │
│  Slot 25-74: Storage Gap (50 slots for future compatibility)   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### **Network Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Network Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   Mainnet       │    │    Sepolia      │    │   Hardhat    │ │
│  │   (Production)  │    │   (Testnet)     │    │   (Local)    │ │
│  │                 │    │                 │    │              │ │
│  │ • NEBA Token    │    │ • NEBA Token    │    │ • NEBA Token │ │
│  │ • Treasury Safe │    │ • Test Treasury │    │ • Test Setup │ │
│  │ • Governance    │    │ • Test Gov      │    │ • Test Roles │ │
│  │ • Monitoring    │    │ • Test Monitor  │    │ • Test Tools │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│                                                                 │
│  ┌─────────────────┐                                           │
│  │   Base L2       │ ◄─── Future Deployment                   │
│  │   (Planned)     │                                           │
│  │                 │                                           │
│  │ • NEBA Token    │                                           │
│  │ • L2 Treasury   │                                           │
│  │ • L2 Governance │                                           │
│  │ • L2 Monitoring │                                           │
│  └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### **Security Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Layers                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: Access Control                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ • Role-based permissions                                   │ │
│  │ • Multi-sig treasury                                       │ │
│  │ • Timelock governance                                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Layer 2: Emergency Controls                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ • Pause/unpause mechanism                                  │ │
│  │ • Circuit breaker protection                               │ │
│  │ • Emergency guardian role                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Layer 3: Transfer Restrictions                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ • Whitelist management                                     │ │
│  │ • Blocklist management                                     │ │
│  │ • Treasury exemptions                                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Layer 4: Code Security                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ • Reentrancy protection                                    │ │
│  │ • Input validation                                         │ │
│  │ • Custom error handling                                    │ │
│  │ • Event logging                                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Layer 5: Upgrade Security                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ • UUPS proxy pattern                                       │ │
│  │ • Storage gap protection                                   │ │
│  │ • Authorization checks                                     │ │
│  │ • Initialization protection                                │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

*This architecture document provides a comprehensive overview of the NEBA Token system design and should be updated as the system evolves.*
