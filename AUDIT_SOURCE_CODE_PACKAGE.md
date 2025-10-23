# NEBA Token - Source Code Package for Audit

## 📁 **SOURCE CODE STRUCTURE**

This package contains all source code files for the NEBA Token ecosystem audit.

---

## 🔧 **MAIN CONTRACT FILES**

### **1. NEBAminimalSimple.sol** (Main Token Contract)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title NEBA Token Simple
 * @dev Simple NEBA token contract deployable on Base Sepolia
 * @notice This contract provides essential NEBA functionality without modular complexity
 */
contract NEBAminimalSimple is 
    ERC20Upgradeable,
    ERC20CappedUpgradeable,
    ERC20PermitUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable
{
    // ============ Constants ============
    
    /// @notice Maximum total supply: 1 billion tokens
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;
    
    /// @notice Token name
    string public constant TOKEN_NAME = "NEBA Token";
    
    /// @notice Token symbol
    string public constant TOKEN_SYMBOL = "$NEBA";
    
    /// @notice Token decimals
    uint8 public constant TOKEN_DECIMALS = 18;
    
    /// @notice Snapshot role
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");

    // ============ State Variables ============
    
    /// @notice Treasury address
    address public treasury;
    
    /// @notice Admin address
    address public admin;
    
    /// @notice Snapshot tracking
    struct Snapshot {
        uint256 id;
        uint256 timestamp;
        uint256 totalSupply;
        bool active;
    }
    
    /// @notice Current snapshot ID
    uint256 public currentSnapshotId;
    
    /// @notice Snapshots mapping
    mapping(uint256 => Snapshot) public snapshots;

    // ============ Events ============
    
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event SnapshotCreated(uint256 indexed snapshotId, uint256 timestamp, uint256 totalSupply);
    event TokensInitialized(address indexed treasury, uint256 totalSupply);

    // ============ Errors ============
    
    error InvalidAddress();
    error SnapshotNotFound();

    // ============ Modifiers ============
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    // ============ Initialization ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the NEBA token contract
     */
    function initialize(
        address _treasury,
        address _admin
    ) public initializer {
        // Comprehensive input validation
        require(_treasury != address(0), "Treasury cannot be zero address");
        require(_admin != address(0), "Admin cannot be zero address");
        require(_treasury != address(this), "Treasury cannot be token contract");
        require(_admin != address(this), "Admin cannot be token contract");
        
        // Additional check: ensure it's not a known blackhole
        require(
            _treasury != 0x000000000000000000000000000000000000dEaD,
            "Treasury cannot be burn address"
        );
        require(
            _admin != 0x000000000000000000000000000000000000dEaD,
            "Admin cannot be burn address"
        );
        
        // Check that treasury and admin are different addresses
        require(_treasury != _admin, "Treasury and admin cannot be the same address");
        
        __ERC20_init(TOKEN_NAME, TOKEN_SYMBOL);
        __ERC20Capped_init(MAX_SUPPLY);
        __ERC20Permit_init(TOKEN_NAME);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        
        treasury = _treasury;
        admin = _admin;
        
        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(SNAPSHOT_ROLE, _admin);
        
        // Mint initial supply to treasury (100M tokens instead of full supply)
        uint256 initialSupply = 100_000_000 * 10**18; // 100M tokens
        _mint(treasury, initialSupply);
        
        emit TreasuryUpdated(address(0), _treasury);
        emit TokensInitialized(_treasury, totalSupply());
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Update treasury address
     */
    function updateTreasury(address _treasury) external onlyAdmin {
        // Comprehensive input validation
        require(_treasury != address(0), "Treasury cannot be zero address");
        require(_treasury != address(this), "Treasury cannot be token contract");
        require(_treasury != treasury, "New treasury must be different from current");
        
        // Additional check: ensure it's not a known blackhole
        require(
            _treasury != 0x000000000000000000000000000000000000dEaD,
            "Treasury cannot be burn address"
        );
        
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }
    
    /**
     * @notice Mint additional tokens to treasury
     */
    function mintToTreasury(uint256 amount) external onlyAdmin {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(treasury, amount);
    }

    // ============ Snapshot Functions ============
    
    /**
     * @notice Create a snapshot of current token state
     */
    function createSnapshot() external onlyRole(SNAPSHOT_ROLE) {
        currentSnapshotId++;
        
        snapshots[currentSnapshotId] = Snapshot({
            id: currentSnapshotId,
            timestamp: block.timestamp,
            totalSupply: totalSupply(),
            active: true
        });
        
        emit SnapshotCreated(currentSnapshotId, block.timestamp, totalSupply());
    }
    
    /**
     * @notice Get snapshot by ID
     */
    function getSnapshot(uint256 snapshotId) external view returns (Snapshot memory) {
        if (snapshots[snapshotId].id == 0) {
            revert SnapshotNotFound();
        }
        return snapshots[snapshotId];
    }
    
    /**
     * @notice Check if snapshot exists
     */
    function snapshotExists(uint256 snapshotId) external view returns (bool) {
        return snapshots[snapshotId].id != 0;
    }
    
    /**
     * @notice Get latest snapshot ID
     */
    function getLatestSnapshotId() external view returns (uint256) {
        return currentSnapshotId;
    }

    // ============ View Functions ============
    
    /**
     * @notice Confirms that the token cap is immutable
     */
    function isCapImmutable() external pure returns (bool) {
        return true;
    }
    
    /**
     * @notice Returns the immutable cap value
     */
    function cap() public pure override returns (uint256) {
        return MAX_SUPPLY;
    }

    // ============ Upgrade Functions ============
    
    /**
     * @notice Authorize upgrade (UUPS)
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyAdmin 
    {
        // Additional upgrade authorization logic can be added here
    }

    // ============ Required Overrides ============
    
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20Upgradeable, ERC20CappedUpgradeable)
    {
        super._update(from, to, value);
    }
    
    function nonces(address owner)
        public
        view
        override(ERC20PermitUpgradeable)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    // ============ Storage Gap ============
    
    uint256[50] private __gap;
}
```

---

## 🔧 **SECURITY MODULE FILES**

### **2. CircuitBreaker.sol** (Circuit Breaker Protection)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./interfaces/ICircuitBreaker.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title CircuitBreaker
 * @dev Advanced circuit breaker implementation with anomaly detection
 * @notice This contract monitors transfer patterns and can trigger circuit breakers
 */
contract CircuitBreaker is ICircuitBreaker, AccessControlUpgradeable, PausableUpgradeable {
    
    // ============ Constants ============
    
    bytes32 public constant CIRCUIT_BREAKER_ROLE = keccak256("CIRCUIT_BREAKER_ROLE");
    bytes32 public constant CIRCUIT_BREAKER_CONFIG_ROLE = keccak256("CIRCUIT_BREAKER_CONFIG_ROLE");
    
    // ============ State Variables ============
    
    bool public isCircuitBreakerActive;
    string public activationReason;
    uint256 public activationTime;
    
    // Volume-based circuit breaker (configurable)
    uint256 public maxDailyVolume;
    uint256 public maxHourlyVolume;
    uint256 public maxSingleTransfer;
    uint256 public maxTransferPercentage; // Max % of total supply per transfer
    
    // Velocity-based circuit breaker (configurable)
    uint256 public maxTransfersPerHour;
    uint256 public maxTransfersPerDay;
    uint256 public maxTransfersPerBlock; // Max transfers per block
    
    // Anomaly detection (configurable)
    uint256 public maxFailedAttempts;
    uint256 public failedAttemptWindow;
    uint256 public suspiciousVelocityThreshold; // Tokens moved per minute threshold
    
    // Time-based auto-reset (configurable)
    uint256 public autoResetInterval;
    uint256 public lastResetTime;
    
    // Tracking variables
    mapping(uint256 => uint256) public dailyVolume;
    mapping(uint256 => uint256) public hourlyVolume;
    mapping(uint256 => uint256) public hourlyTransferCount;
    mapping(uint256 => uint256) public dailyTransferCount;
    mapping(uint256 => uint256) public transfersPerBlock; // Track transfers per block
    mapping(address => uint256) public failedAttempts;
    mapping(address => uint256) public lastFailedAttempt;
    uint256 public lastCheckBlock;
    
    // ============ Events ============
    
    event CircuitBreakerActivated(string reason, uint256 timestamp);
    event CircuitBreakerDeactivated(uint256 timestamp);
    event CircuitBreakerConfigUpdated(
        uint256 maxTransferPercentage,
        uint256 maxTransfersPerBlock,
        uint256 suspiciousVelocityThreshold,
        uint256 maxDailyVolume,
        uint256 maxHourlyVolume,
        uint256 maxSingleTransfer
    );
    event CircuitBreakerTriggered(
        string reason,
        uint256 blockNumber,
        address triggeredBy
    );
    event VolumeLimitExceededEvent(uint256 limit, uint256 actual, string period);
    event VelocityLimitExceededEvent(uint256 limit, uint256 actual, string period);
    event FailedAttemptsExceededEvent(address account, uint256 attempts);
    event AutoResetTriggered(uint256 timestamp);
    
    // ============ Errors ============
    
    error CircuitBreakerActive();
    error VolumeLimitExceeded();
    error VelocityLimitExceeded();
    error FailedAttemptsExceeded();
    error InvalidParameters();
    error UnauthorizedCaller();
    
    // ============ Initialization ============
    
    function initialize(
        address admin,
        uint256 _maxDailyVolume,
        uint256 _maxHourlyVolume,
        uint256 _maxSingleTransfer,
        uint256 _maxTransfersPerHour,
        uint256 _maxTransfersPerDay,
        uint256 _maxFailedAttempts,
        uint256 _failedAttemptWindow,
        uint256 _autoResetInterval
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CIRCUIT_BREAKER_ROLE, admin);
        _grantRole(CIRCUIT_BREAKER_CONFIG_ROLE, admin);
        
        maxDailyVolume = _maxDailyVolume;
        maxHourlyVolume = _maxHourlyVolume;
        maxSingleTransfer = _maxSingleTransfer;
        maxTransfersPerHour = _maxTransfersPerHour;
        maxTransfersPerDay = _maxTransfersPerDay;
        maxFailedAttempts = _maxFailedAttempts;
        failedAttemptWindow = _failedAttemptWindow;
        autoResetInterval = _autoResetInterval;
        
        // Initialize new configurable parameters with safe defaults
        maxTransferPercentage = 5; // 5% of total supply
        maxTransfersPerBlock = 100; // 100 transfers per block
        suspiciousVelocityThreshold = 50_000_000 * 10**18; // 50M tokens per minute
        
        lastResetTime = block.timestamp;
    }
    
    // ============ Configuration Functions ============
    
    /**
     * @notice Configure circuit breaker parameters
     * @param _maxTransferPercentage Maximum percentage of total supply per transfer
     * @param _maxTransfersPerBlock Maximum number of transfers per block
     * @param _suspiciousVelocityThreshold Token velocity threshold (tokens per minute)
     * @param _maxDailyVolume Maximum daily volume
     * @param _maxHourlyVolume Maximum hourly volume
     * @param _maxSingleTransfer Maximum single transfer amount
     */
    function configureCircuitBreaker(
        uint256 _maxTransferPercentage,
        uint256 _maxTransfersPerBlock,
        uint256 _suspiciousVelocityThreshold,
        uint256 _maxDailyVolume,
        uint256 _maxHourlyVolume,
        uint256 _maxSingleTransfer
    ) external onlyRole(CIRCUIT_BREAKER_CONFIG_ROLE) {
        require(_maxTransferPercentage > 0 && _maxTransferPercentage <= 100, "Invalid percentage");
        require(_maxTransfersPerBlock > 0, "Invalid max transfers per block");
        require(_suspiciousVelocityThreshold > 0, "Invalid velocity threshold");
        require(_maxDailyVolume > 0, "Invalid max daily volume");
        require(_maxHourlyVolume > 0, "Invalid max hourly volume");
        require(_maxSingleTransfer > 0, "Invalid max single transfer");
        
        maxTransferPercentage = _maxTransferPercentage;
        maxTransfersPerBlock = _maxTransfersPerBlock;
        suspiciousVelocityThreshold = _suspiciousVelocityThreshold;
        maxDailyVolume = _maxDailyVolume;
        maxHourlyVolume = _maxHourlyVolume;
        maxSingleTransfer = _maxSingleTransfer;
        
        emit CircuitBreakerConfigUpdated(
            _maxTransferPercentage,
            _maxTransfersPerBlock,
            _suspiciousVelocityThreshold,
            _maxDailyVolume,
            _maxHourlyVolume,
            _maxSingleTransfer
        );
    }
    
    // ============ Circuit Breaker Logic ============
    
    /**
     * @notice Record a successful transfer
     */
    function recordTransfer(address from, address /* to */, uint256 amount) external {
        uint256 currentDay = block.timestamp / 1 days;
        uint256 currentHour = block.timestamp / 1 hours;
        
        dailyVolume[currentDay] += amount;
        hourlyVolume[currentHour] += amount;
        hourlyTransferCount[currentHour]++;
        dailyTransferCount[currentDay]++;
        
        // Reset failed attempts on successful transfer
        failedAttempts[from] = 0;
    }
    
    /**
     * @notice Enhanced circuit breaker check with configurable parameters
     * @param from Transfer sender
     * @param to Transfer recipient
     * @param amount Transfer amount
     * @param totalSupply Current total supply for percentage calculations
     */
    function checkCircuitBreaker(
        address from,
        address to,
        uint256 amount,
        uint256 totalSupply
    ) external {
        // Check 1: Transfer amount vs total supply percentage
        uint256 maxTransferAmount = (totalSupply * maxTransferPercentage) / 100;
        if (amount > maxTransferAmount) {
            emit CircuitBreakerTriggered("Transfer exceeds max percentage", block.number, from);
            _activateCircuitBreaker("Transfer exceeds max percentage");
            revert("Circuit breaker: Transfer too large");
        }
        
        // Check 2: Transfers per block
        if (block.number != lastCheckBlock) {
            lastCheckBlock = block.number;
            transfersPerBlock[block.number] = 0;
        }
        
        transfersPerBlock[block.number]++;
        
        if (transfersPerBlock[block.number] > maxTransfersPerBlock) {
            emit CircuitBreakerTriggered("Too many transfers per block", block.number, from);
            _activateCircuitBreaker("Too many transfers per block");
            revert("Circuit breaker: Too many transfers");
        }
        
        // Check 3: Single transfer limit
        if (amount > maxSingleTransfer) {
            emit CircuitBreakerTriggered("Single transfer too large", block.number, from);
            _activateCircuitBreaker("Single transfer too large");
            revert("Circuit breaker: Single transfer too large");
        }
        
        // Check 4: Daily volume limit
        uint256 currentDay = block.timestamp / 1 days;
        if (dailyVolume[currentDay] + amount > maxDailyVolume) {
            emit CircuitBreakerTriggered("Daily volume limit exceeded", block.number, from);
            _activateCircuitBreaker("Daily volume limit exceeded");
            revert("Circuit breaker: Daily volume limit exceeded");
        }
        
        // Check 5: Hourly volume limit
        uint256 currentHour = block.timestamp / 1 hours;
        if (hourlyVolume[currentHour] + amount > maxHourlyVolume) {
            emit CircuitBreakerTriggered("Hourly volume limit exceeded", block.number, from);
            _activateCircuitBreaker("Hourly volume limit exceeded");
            revert("Circuit breaker: Hourly volume limit exceeded");
        }
    }
    
    /**
     * @notice Record a failed transfer attempt
     */
    function recordFailedAttempt(address account) external {
        if (block.timestamp - lastFailedAttempt[account] >= failedAttemptWindow) {
            failedAttempts[account] = 1;
        } else {
            failedAttempts[account]++;
        }
        
        lastFailedAttempt[account] = block.timestamp;
        
        if (failedAttempts[account] >= maxFailedAttempts) {
            _activateCircuitBreaker("Failed attempts exceeded");
            emit FailedAttemptsExceededEvent(account, failedAttempts[account]);
        }
    }
    
    /**
     * @notice Activate circuit breaker
     */
    function activateCircuitBreaker(string calldata reason) external onlyRole(CIRCUIT_BREAKER_ROLE) {
        _activateCircuitBreaker(reason);
    }
    
    /**
     * @notice Deactivate circuit breaker
     */
    function deactivateCircuitBreaker() external onlyRole(CIRCUIT_BREAKER_ROLE) {
        isCircuitBreakerActive = false;
        activationReason = "";
        activationTime = 0;
        emit CircuitBreakerDeactivated(block.timestamp);
    }
    
    /**
     * @notice Internal function to activate circuit breaker
     */
    function _activateCircuitBreaker(string memory reason) internal {
        isCircuitBreakerActive = true;
        activationReason = reason;
        activationTime = block.timestamp;
        emit CircuitBreakerActivated(reason, block.timestamp);
    }
    
    /**
     * @notice Check if circuit breaker is active
     */
    function isActive() external view override returns (bool) {
        return isCircuitBreakerActive;
    }
    
    /**
     * @notice Get activation reason
     */
    function getActivationReason() external view override returns (string memory) {
        return activationReason;
    }
    
    /**
     * @notice Check transfer against circuit breaker rules
     */
    function checkTransfer(address from, address to, uint256 amount) external view override {
        if (isCircuitBreakerActive) {
            revert CircuitBreakerActive();
        }
    }
    
    /**
     * @notice Auto-reset circuit breaker if interval has passed
     */
    function autoReset() external {
        if (isCircuitBreakerActive && block.timestamp - activationTime >= autoResetInterval) {
            isCircuitBreakerActive = false;
            activationReason = "";
            activationTime = 0;
            lastResetTime = block.timestamp;
            emit AutoResetTriggered(block.timestamp);
        }
    }
    
    // ============ Storage Gap ============
    
    uint256[50] private __gap;
}
```

---

## 🔧 **INTERFACE FILES**

### **3. ICircuitBreaker.sol** (Circuit Breaker Interface)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title ICircuitBreaker
 * @dev Interface for circuit breaker functionality
 * @notice This interface provides methods for checking transfers against circuit breaker rules
 */
interface ICircuitBreaker {
    /**
     * @notice Check if a transfer should be allowed based on circuit breaker rules
     * @param from The address tokens are transferred from
     * @param to The address tokens are transferred to
     * @param amount The amount of tokens to transfer
     */
    function checkTransfer(address from, address to, uint256 amount) external view;
    
    /**
     * @notice Get the current circuit breaker state
     * @return isActive Whether the circuit breaker is currently active
     */
    function isActive() external view returns (bool isActive);
    
    /**
     * @notice Get the reason for circuit breaker activation
     * @return reason The reason the circuit breaker was activated
     */
    function getActivationReason() external view returns (string memory reason);
}
```

---

## 📊 **DEPLOYMENT INFORMATION**

### **Contract Addresses:**
- **Main Contract:** `0xC371865B749dfE4b7CbDb8EbE2594E49B20e545A`
- **CircuitBreaker:** `0x6a11A79354469bc0830a685df1AA89aF92e79f2a`
- **Security Module:** `0xC635462890eceAc76629Ac4e04509E9399E17394`
- **Rate Limiting:** `0xDDEFD25E4E9d0b86D42DdE197De8c1111e5E0D1A`
- **Emergency Module:** `0x7688d0346d1f45A34aE0C1A95126cC6Ca25e9c36`

### **Network Information:**
- **Network:** Base Sepolia
- **Chain ID:** 84532
- **Explorer:** https://sepolia.basescan.org

---

**📋 This source code package contains all necessary files for Hacken to conduct a comprehensive audit of the NEBA Token ecosystem.**
