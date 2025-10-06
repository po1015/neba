# NEBA Token - NatSpec Documentation

## 📚 **Contract Documentation**

### **NEBA.sol**

#### **Contract Overview**
```solidity
/**
 * @title NEBA Token
 * @dev An upgradeable ERC-20 token with advanced access control and compliance features
 * @author NEBA Development Team
 * @notice This contract implements a secure, compliant token with emergency controls
 * @custom:security-contact security@neba.com
 */
contract NEBA is 
    ERC20Upgradeable, 
    ERC20PausableUpgradeable, 
    AccessControlUpgradeable,
    ERC20PermitUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
```

#### **State Variables**

##### **Token Information**
```solidity
/// @notice Token name
string public constant TOKEN_NAME = "NEBA Token";

/// @notice Token symbol  
string public constant TOKEN_SYMBOL = "$NEBA";

/// @notice Token decimals
uint8 public constant TOKEN_DECIMALS = 18;

/// @notice Maximum token supply (1 billion tokens)
uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;
```

##### **Role Definitions**
```solidity
/// @notice Role for contract upgrades
bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

/// @notice Role for admin pause/unpause operations
bytes32 public constant ADMIN_PAUSER_ROLE = keccak256("ADMIN_PAUSER_ROLE");

/// @notice Role for bot pause operations (pause only)
bytes32 public constant BOT_PAUSER_ROLE = keccak256("BOT_PAUSER_ROLE");

/// @notice Role for governance unpausing (unpause only, through Timelock)
bytes32 public constant GOVERNANCE_UNPAUSER_ROLE = keccak256("GOVERNANCE_UNPAUSER_ROLE");

/// @notice Role for emergency guardian (pause only, immediate)
bytes32 public constant EMERGENCY_GUARDIAN_ROLE = keccak256("EMERGENCY_GUARDIAN_ROLE");

/// @notice Role for managing blocked addresses
bytes32 public constant BLOCKLIST_MANAGER_ROLE = keccak256("BLOCKLIST_MANAGER_ROLE");

/// @notice Role for managing whitelist
bytes32 public constant WHITELIST_MANAGER_ROLE = keccak256("WHITELIST_MANAGER_ROLE");

/// @notice Role for circuit breaker management
bytes32 public constant CIRCUIT_BREAKER_ROLE = keccak256("CIRCUIT_BREAKER_ROLE");

/// @notice Role for parameter updates
bytes32 public constant PARAM_MANAGER_ROLE = keccak256("PARAM_MANAGER_ROLE");

/// @notice Role for financial operations
bytes32 public constant FINANCE_ROLE = keccak256("FINANCE_ROLE");
```

##### **Configuration Variables**
```solidity
/// @notice Treasury address for token distribution
address public treasury;

/// @notice Circuit breaker contract address
address public circuitBreaker;

/// @notice Transfer hook contract address
address public transferHook;

/// @notice Commit timeout for parameter updates
uint256 public commitTimeout;

/// @notice Circuit breaker reset interval
uint256 public circuitBreakerResetInterval;
```

##### **State Variables**
```solidity
/// @notice Whether trading is enabled
bool public tradingEnabled;

/// @notice Whether transfer restrictions are enabled
bool public transferRestrictionsEnabled;

/// @notice Whitelist mapping
mapping(address => bool) public whitelist;

/// @notice Blocklist mapping
mapping(address => bool) public blocklist;

/// @notice Parameter update commitments
mapping(bytes32 => uint256) public commitments;

/// @notice Pending parameter updates
mapping(bytes32 => bool) public pendingUpdates;
```

#### **Functions**

##### **Initialization**
```solidity
/**
 * @notice Initialize the NEBA token contract
 * @dev Sets up initial roles, mints tokens to treasury, and configures parameters
 * @param _treasury Treasury address for token distribution
 * @param _admin Admin address for initial role assignment
 * @param _commitTimeout Timeout for parameter update commitments
 * @param _circuitBreakerResetInterval Interval for circuit breaker resets
 * @custom:security Only callable once during deployment
 */
function initialize(
    address _treasury,
    address _admin,
    uint256 _commitTimeout,
    uint256 _circuitBreakerResetInterval
) public initializer
```

##### **Transfer Functions**
```solidity
/**
 * @notice Transfer tokens to a specified address
 * @dev Overrides ERC20 transfer with additional security checks
 * @param to Recipient address
 * @param amount Amount of tokens to transfer
 * @return success True if transfer successful
 * @custom:security Includes pause, blocklist, whitelist, circuit breaker, and reentrancy checks
 */
function transfer(address to, uint256 amount) 
    public 
    override 
    whenNotPaused 
    notBlocked(msg.sender) 
    notBlocked(to) 
    whitelistTransferAllowed(msg.sender, to)
    whenCircuitBreakerNotActive 
    whenTradingEnabled
    nonReentrant 
    returns (bool)

/**
 * @notice Transfer tokens from one address to another
 * @dev Overrides ERC20 transferFrom with additional security checks
 * @param from Sender address
 * @param to Recipient address  
 * @param amount Amount of tokens to transfer
 * @return success True if transfer successful
 * @custom:security Includes pause, blocklist, whitelist, circuit breaker, and reentrancy checks
 */
function transferFrom(address from, address to, uint256 amount) 
    public 
    override 
    whenNotPaused 
    notBlocked(from) 
    notBlocked(to) 
    whitelistTransferAllowed(from, to)
    whenCircuitBreakerNotActive 
    whenTradingEnabled
    nonReentrant 
    returns (bool)
```

##### **Access Control Functions**
```solidity
/**
 * @notice Grant bot pauser role to an address
 * @dev Only admin can grant this role
 * @param botAddress Address to grant bot pauser role
 * @custom:security Prevents zero address and validates caller permissions
 */
function grantBotPauserRole(address botAddress) external onlyRole(DEFAULT_ADMIN_ROLE)

/**
 * @notice Grant governance unpauser role to an address
 * @dev Only admin can grant this role
 * @param governanceAddress Address to grant governance unpauser role
 * @custom:security Prevents zero address and validates caller permissions
 */
function grantGovernanceUnpauserRole(address governanceAddress) external onlyRole(DEFAULT_ADMIN_ROLE)

/**
 * @notice Grant emergency guardian role to an address
 * @dev Only admin can grant this role
 * @param guardianAddress Address to grant emergency guardian role
 * @custom:security Prevents zero address and validates caller permissions
 */
function grantEmergencyGuardianRole(address guardianAddress) external onlyRole(DEFAULT_ADMIN_ROLE)
```

##### **Emergency Control Functions**
```solidity
/**
 * @notice Pause the contract
 * @dev Can be called by admin, bot, or emergency guardian roles
 * @custom:security Emits pause type for audit trail
 */
function pause() public whenNotPaused

/**
 * @notice Unpause the contract
 * @dev Can be called by admin or governance unpauser roles
 * @custom:security Requires proper role permissions
 */
function unpause() public whenPaused
```

##### **Whitelist Management**
```solidity
/**
 * @notice Update whitelist status for an address
 * @dev Only whitelist manager can update whitelist
 * @param account Address to update
 * @param whitelisted New whitelist status
 * @custom:security Emits event for audit trail
 */
function updateWhitelist(address account, bool whitelisted) 
    external 
    onlyRole(WHITELIST_MANAGER_ROLE)
```

##### **Blocklist Management**
```solidity
/**
 * @notice Update blocklist status for an address
 * @dev Only blocklist manager can update blocklist
 * @param account Address to update
 * @param blocked New blocklist status
 * @custom:security Emits event for audit trail
 */
function updateBlocklist(address account, bool blocked) 
    external 
    onlyRole(BLOCKLIST_MANAGER_ROLE)
```

##### **Transfer Restrictions**
```solidity
/**
 * @notice Check if transfer is allowed between addresses
 * @dev Returns true if transfer is permitted based on current restrictions
 * @param from Sender address
 * @param to Recipient address
 * @return allowed True if transfer is allowed
 */
function isTransferAllowed(address from, address to) public view returns (bool)
```

##### **Upgrade Functions**
```solidity
/**
 * @notice Authorize contract upgrade
 * @dev Only upgrader role can authorize upgrades
 * @param newImplementation Address of new implementation
 * @custom:security Ensures proper authorization for upgrades
 */
function _authorizeUpgrade(address newImplementation) 
    internal 
    override 
    onlyRole(UPGRADER_ROLE)
```

#### **Events**

##### **Token Events**
```solidity
/// @notice Emitted when trading is enabled/disabled
event TradingToggled(bool enabled);

/// @notice Emitted when transfer restrictions are toggled
event TransferRestrictionsToggled(bool enabled);
```

##### **Access Control Events**
```solidity
/// @notice Emitted when whitelist is updated
event WhitelistUpdated(address indexed account, bool whitelisted);

/// @notice Emitted when blocklist is updated
event BlocklistUpdated(address indexed account, bool blocked);
```

##### **Emergency Events**
```solidity
/// @notice Emitted when contract is paused
event ContractPaused(address indexed account, string pauseType);

/// @notice Emitted when contract is unpaused
event ContractUnpaused(address indexed account);
```

##### **Configuration Events**
```solidity
/// @notice Emitted when circuit breaker is updated
event CircuitBreakerUpdated(address indexed oldBreaker, address indexed newBreaker);

/// @notice Emitted when transfer hook is updated
event TransferHookUpdated(address indexed oldHook, address indexed newHook);

/// @notice Emitted when treasury is updated
event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
```

#### **Modifiers**

##### **Security Modifiers**
```solidity
/// @notice Ensures address is not blocked
modifier notBlocked(address account)

/// @notice Ensures transfer is allowed based on whitelist
modifier whitelistTransferAllowed(address from, address to)

/// @notice Ensures circuit breaker is not active
modifier whenCircuitBreakerNotActive

/// @notice Ensures trading is enabled
modifier whenTradingEnabled
```

### **CircuitBreaker.sol**

#### **Contract Overview**
```solidity
/**
 * @title Circuit Breaker
 * @dev Provides automated protection against unusual transaction patterns
 * @author NEBA Development Team
 * @notice Implements circuit breaker pattern for transaction monitoring
 */
contract CircuitBreaker is ICircuitBreaker, Initializable, AccessControlUpgradeable
```

#### **Key Functions**
```solidity
/**
 * @notice Check if circuit breaker should trigger
 * @dev Analyzes transaction patterns and triggers if threshold exceeded
 * @param from Sender address
 * @param to Recipient address
 * @param amount Transfer amount
 * @return shouldTrigger True if circuit breaker should activate
 */
function shouldTrigger(address from, address to, uint256 amount) 
    external 
    view 
    override 
    returns (bool)
```

### **TransferHook.sol**

#### **Contract Overview**
```solidity
/**
 * @title Transfer Hook
 * @dev Provides custom logic for transfer validation
 * @author NEBA Development Team
 * @notice Implements transfer hook pattern for compliance
 */
contract TransferHook is ITransferHook, Initializable, AccessControlUpgradeable
```

#### **Key Functions**
```solidity
/**
 * @notice Execute transfer hook logic
 * @dev Custom validation logic for transfers
 * @param from Sender address
 * @param to Recipient address
 * @param amount Transfer amount
 * @return success True if hook execution successful
 */
function executeHook(address from, address to, uint256 amount) 
    external 
    override 
    returns (bool)
```

---

*This documentation is automatically generated from contract NatSpec comments and should be updated when contracts are modified.*
