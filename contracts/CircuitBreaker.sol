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
     * @notice Auto-reset circuit breaker if interval has passed
     */
    function autoReset() external {
        if (block.timestamp >= lastResetTime + autoResetInterval) {
            isCircuitBreakerActive = false;
            activationReason = "";
            activationTime = 0;
            lastResetTime = block.timestamp;
            
            // Reset tracking variables
            uint256 currentDay = block.timestamp / 1 days;
            uint256 currentHour = block.timestamp / 1 hours;
            
            dailyVolume[currentDay] = 0;
            hourlyVolume[currentHour] = 0;
            hourlyTransferCount[currentHour] = 0;
            dailyTransferCount[currentDay] = 0;
            
            emit AutoResetTriggered(block.timestamp);
        }
    }
    
    // ============ Internal Functions ============
    
    function _activateCircuitBreaker(string memory reason) internal {
        isCircuitBreakerActive = true;
        activationReason = reason;
        activationTime = block.timestamp;
        emit CircuitBreakerActivated(reason, block.timestamp);
    }
    
    // ============ Interface Functions ============
    
    /**
     * @notice Check if a transfer should be allowed based on circuit breaker rules
     * @param amount The amount of tokens to transfer
     */
    function checkTransfer(address /* from */, address /* to */, uint256 amount) external view override {
        if (isCircuitBreakerActive) {
            revert("Circuit breaker is active");
        }
        
        // Check single transfer limit
        if (amount > maxSingleTransfer) {
            revert("Transfer amount exceeds single transfer limit");
        }
        
        uint256 currentDay = block.timestamp / 1 days;
        uint256 currentHour = block.timestamp / 1 hours;
        
        // Check daily volume limit
        if (dailyVolume[currentDay] + amount > maxDailyVolume) {
            revert("Transfer would exceed daily volume limit");
        }
        
        // Check hourly volume limit
        if (hourlyVolume[currentHour] + amount > maxHourlyVolume) {
            revert("Transfer would exceed hourly volume limit");
        }
        
        // Check daily transfer count limit
        if (dailyTransferCount[currentDay] >= maxTransfersPerDay) {
            revert("Daily transfer count limit exceeded");
        }
        
        // Check hourly transfer count limit
        if (hourlyTransferCount[currentHour] >= maxTransfersPerHour) {
            revert("Hourly transfer count limit exceeded");
        }
    }
    
    function isActive() external view override returns (bool) {
        return isCircuitBreakerActive;
    }
    
    function getActivationReason() external view override returns (string memory) {
        return activationReason;
    }
    
    function getCurrentDailyVolume() external view returns (uint256) {
        uint256 currentDay = block.timestamp / 1 days;
        return dailyVolume[currentDay];
    }
    
    function getCurrentHourlyVolume() external view returns (uint256) {
        uint256 currentHour = block.timestamp / 1 hours;
        return hourlyVolume[currentHour];
    }
    
    function getCurrentHourlyTransferCount() external view returns (uint256) {
        uint256 currentHour = block.timestamp / 1 hours;
        return hourlyTransferCount[currentHour];
    }
    
    function getCurrentDailyTransferCount() external view returns (uint256) {
        uint256 currentDay = block.timestamp / 1 days;
        return dailyTransferCount[currentDay];
    }
    
    // ============ Admin Functions ============
    
    function updateLimits(
        uint256 _maxDailyVolume,
        uint256 _maxHourlyVolume,
        uint256 _maxSingleTransfer,
        uint256 _maxTransfersPerHour,
        uint256 _maxTransfersPerDay,
        uint256 _maxFailedAttempts,
        uint256 _failedAttemptWindow,
        uint256 _autoResetInterval
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxDailyVolume = _maxDailyVolume;
        maxHourlyVolume = _maxHourlyVolume;
        maxSingleTransfer = _maxSingleTransfer;
        maxTransfersPerHour = _maxTransfersPerHour;
        maxTransfersPerDay = _maxTransfersPerDay;
        maxFailedAttempts = _maxFailedAttempts;
        failedAttemptWindow = _failedAttemptWindow;
        autoResetInterval = _autoResetInterval;
    }
}
