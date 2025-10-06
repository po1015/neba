// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./interfaces/ITransferHook.sol";
import "./interfaces/ICircuitBreaker.sol";

/**
 * @title NEBA Token
 * @dev Phase 1 implementation of NEBA Token with hardened security, upgradability, and compliance features
 * @author NEBA Development Team
 * @notice This contract implements ERC-20 with additional security, compliance, and governance features
 */
contract NEBA is 
    ERC20Upgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable,
    ERC20PermitUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
    // IERC1404 removed - will be implemented in V2
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

    // ============ Roles ============
    
    /// @notice Role for upgrading the contract
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    /// @notice Role for the Multisig. Has full control: Can pause AND unpause.
    bytes32 public constant ADMIN_PAUSER_ROLE = keccak256("ADMIN_PAUSER_ROLE");
    
    /// @notice Role for automated bots (Keepers/Sentinels). Has limited control: Can ONLY pause.
    bytes32 public constant BOT_PAUSER_ROLE = keccak256("BOT_PAUSER_ROLE");
    
    /// @notice Role for governance unpausing (unpause only, through Timelock)
    bytes32 public constant GOVERNANCE_UNPAUSER_ROLE = keccak256("GOVERNANCE_UNPAUSER_ROLE");
    
    /// @notice Role for emergency guardian (pause only, immediate)
    bytes32 public constant EMERGENCY_GUARDIAN_ROLE = keccak256("EMERGENCY_GUARDIAN_ROLE");
    
    /// @notice Role for managing blocklist
    bytes32 public constant BLOCKLIST_MANAGER_ROLE = keccak256("BLOCKLIST_MANAGER_ROLE");
    
    /// @notice Role for managing whitelist
    bytes32 public constant WHITELIST_MANAGER_ROLE = keccak256("WHITELIST_MANAGER_ROLE");
    
    /// @notice Role for circuit breaker management
    bytes32 public constant CIRCUIT_BREAKER_ROLE = keccak256("CIRCUIT_BREAKER_ROLE");
    
    /// @notice Role for parameter management
    bytes32 public constant PARAM_MANAGER_ROLE = keccak256("PARAM_MANAGER_ROLE");
    
    /// @notice Role for financial operations
    bytes32 public constant FINANCE_ROLE = keccak256("FINANCE_ROLE");
    
    /// @notice Role for snapshot management
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");

    // ============ State Variables ============
    
    /// @notice Treasury address (Gnosis Safe Multisig)
    address public treasury;
    
    /// @notice Blocklist mapping for restricted addresses
    mapping(address => bool) public blocklist;
    
    /// @notice Whitelist mapping for approved addresses
    mapping(address => bool) public whitelist;
    
    /// @notice Transfer restrictions enabled flag
    bool public transferRestrictionsEnabled;
    
    /// @notice Trading enabled flag
    bool public tradingEnabled;
    
    /// @notice Circuit breaker contract
    ICircuitBreaker public circuitBreaker;
    
    /// @notice Transfer hook contract
    ITransferHook public transferHook;
    
    /// @notice Commit-reveal scheme for sensitive updates
    mapping(bytes32 => uint256) public commits;
    
    /// @notice Commit timeout duration
    uint256 public commitTimeout;
    
    /// @notice Snapshot data mapping
    mapping(uint256 => SnapshotData) public snapshots;
    
    /// @notice Current snapshot ID counter
    uint256 public currentSnapshotId;
    
    /// @notice Circuit breaker state
    bool public circuitBreakerTriggered;
    
    /// @notice Last circuit breaker reset time
    uint256 public lastCircuitBreakerReset;
    
    /// @notice Circuit breaker reset interval
    uint256 public circuitBreakerResetInterval;

    // ============ Structs ============
    
    struct SnapshotData {
        uint256 id;
        uint256 timestamp;
        uint256 totalSupply;
        bool active;
    }
    
    struct CommitData {
        bytes32 commit;
        uint256 timestamp;
        bool revealed;
    }

    // ============ Events ============
    
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event BlocklistUpdated(address indexed account, bool blocked);
    event WhitelistUpdated(address indexed account, bool whitelisted);
    event TransferRestrictionsToggled(bool enabled);
    event TradingEnabled(uint256 timestamp);
    event CircuitBreakerUpdated(address indexed oldBreaker, address indexed newBreaker);
    event TransferHookUpdated(address indexed oldHook, address indexed newHook);
    event CircuitBreakerTriggered(address indexed triggerer, string reason);
    event CircuitBreakerReset();
    event SnapshotCreated(uint256 indexed snapshotId, uint256 timestamp, uint256 totalSupply);
    event CommitCreated(bytes32 indexed commit, address indexed committer, uint256 timestamp);
    event CommitRevealed(bytes32 indexed commit, bytes32 secret, uint256 timestamp);
    event ContractPaused(address indexed pauser, string indexed pauseType);
    event ContractUnpaused(address indexed unpauser);

    // ============ Errors ============
    
    error InvalidAddress();
    error InvalidAmount();
    error BlockedAddress();
    error NotWhitelisted();
    error TransferRestrictionsActive();
    error CircuitBreakerActive();
    error CommitExpired();
    error CommitNotFound();
    error CommitAlreadyRevealed();
    error InvalidCommit();
    error SnapshotNotFound();
    error UnauthorizedUpgrade();
    error TradingNotEnabled();
    error ParamCommitExpired();

    // ============ Modifiers ============
    
    modifier notBlocked(address account) {
        if (blocklist[account]) revert BlockedAddress();
        _;
    }
    
    modifier onlyWhitelisted(address account) {
        if (transferRestrictionsEnabled && !whitelist[account] && account != treasury) {
            revert NotWhitelisted();
        }
        _;
    }
    
    modifier whitelistTransferAllowed(address from, address to) {
        if (transferRestrictionsEnabled) {
            // Treasury can always send and receive
            if (from != treasury && to != treasury) {
                // Both addresses must be whitelisted for non-treasury transfers
                if (!whitelist[from] || !whitelist[to]) {
                    revert NotWhitelisted();
                }
            }
        }
        _;
    }
    
    modifier whenCircuitBreakerNotActive() {
        if (circuitBreakerTriggered) revert CircuitBreakerActive();
        _;
    }
    
    modifier whenTradingEnabled() {
        if (!tradingEnabled && msg.sender != treasury) revert TradingNotEnabled();
        _;
    }

    // ============ Initialization ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the NEBA Token contract
     * @param _treasury Treasury address (Gnosis Safe Multisig)
     * @param _admin Admin address
     * @param _commitTimeout Commit timeout duration in seconds
     * @param _circuitBreakerResetInterval Circuit breaker reset interval in seconds
     */
    function initialize(
        address _treasury,
        address _admin,
        uint256 _commitTimeout,
        uint256 _circuitBreakerResetInterval
    ) public initializer {
        if (_treasury == address(0) || _admin == address(0)) revert InvalidAddress();
        
        __ERC20_init(TOKEN_NAME, TOKEN_SYMBOL);
        __ERC20Pausable_init();
        __AccessControl_init();
        __ERC20Permit_init(TOKEN_NAME);
        // __ERC20Votes_init(); // Removed - will be implemented in V2
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        treasury = _treasury;
        commitTimeout = _commitTimeout;
        circuitBreakerResetInterval = _circuitBreakerResetInterval;
        
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        _grantRole(ADMIN_PAUSER_ROLE, _admin);
        _grantRole(BLOCKLIST_MANAGER_ROLE, _admin);
        _grantRole(WHITELIST_MANAGER_ROLE, _admin);
        _grantRole(CIRCUIT_BREAKER_ROLE, _admin);
        _grantRole(SNAPSHOT_ROLE, _admin);
        _grantRole(PARAM_MANAGER_ROLE, _admin);
        _grantRole(FINANCE_ROLE, _admin);
        // Note: BOT_PAUSER_ROLE, GOVERNANCE_UNPAUSER_ROLE, and EMERGENCY_GUARDIAN_ROLE 
        // will be granted separately to their respective addresses
        
        // Mint entire supply to treasury
        _mint(treasury, MAX_SUPPLY);
        
        emit TreasuryUpdated(address(0), _treasury);
    }

    // ============ ERC-20 Overrides ============
    
    /**
     * @notice Override transfer to include security checks
     */
    function transfer(address to, uint256 amount) virtual 
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
    {
        // Check circuit breaker
        if (address(circuitBreaker) != address(0)) {
            circuitBreaker.checkTransfer(msg.sender, to, amount);
        }
        
        // Call transfer hook if set
        if (address(transferHook) != address(0)) {
            transferHook.beforeTransfer(msg.sender, to, amount);
        }
        
        bool success = super.transfer(to, amount);
        
        if (address(transferHook) != address(0)) {
            transferHook.afterTransfer(msg.sender, to, amount);
        }
        
        return success;
    }
    
    /**
     * @notice Override transferFrom to include security checks
     */
    function transferFrom(address from, address to, uint256 amount) virtual 
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
    {
        // Check circuit breaker
        if (address(circuitBreaker) != address(0)) {
            circuitBreaker.checkTransfer(from, to, amount);
        }
        
        // Call transfer hook if set
        if (address(transferHook) != address(0)) {
            transferHook.beforeTransfer(from, to, amount);
        }
        
        bool success = super.transferFrom(from, to, amount);
        
        if (address(transferHook) != address(0)) {
            transferHook.afterTransfer(from, to, amount);
        }
        
        return success;
    }

    // ============ Transfer Restriction Hooks ============
    // Note: Full ERC-1404 standard implementation deferred to V2
    
    /**
     * @notice Check if transfer is allowed (basic hooks for V1)
     * @dev Simplified version - full ERC-1404 will be implemented in V2
     */
    function isTransferAllowed(address from, address to) 
        public 
        view 
        returns (bool) 
    {
        // Basic transfer restrictions for V1
        if (!tradingEnabled && from != treasury && to != treasury) return false;
        if (paused()) return false;
        if (blocklist[from] || blocklist[to]) return false;
        if (circuitBreakerTriggered) return false;
        
        // Whitelist restrictions: if enabled, both from and to must be whitelisted OR one of them is treasury
        if (transferRestrictionsEnabled) {
            // Treasury can always send and receive
            if (from == treasury || to == treasury) return true;
            // Both addresses must be whitelisted
            if (!whitelist[from] || !whitelist[to]) return false;
        }
        
        return true;
    }

    // ============ Access Control Functions ============
    
    /**
     * @notice Update treasury address
     */
    function updateTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_treasury == address(0)) revert InvalidAddress();
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }
    
    /**
     * @notice Update blocklist status
     */
    function updateBlocklist(address account, bool blocked) 
        external 
        onlyRole(BLOCKLIST_MANAGER_ROLE) 
    {
        blocklist[account] = blocked;
        emit BlocklistUpdated(account, blocked);
    }
    
    /**
     * @notice Update whitelist status
     */
    function updateWhitelist(address account, bool whitelisted) 
        external 
        onlyRole(WHITELIST_MANAGER_ROLE) 
    {
        whitelist[account] = whitelisted;
        emit WhitelistUpdated(account, whitelisted);
    }
    
    /**
     * @notice Toggle transfer restrictions
     */
    function toggleTransferRestrictions() external onlyRole(DEFAULT_ADMIN_ROLE) {
        transferRestrictionsEnabled = !transferRestrictionsEnabled;
        emit TransferRestrictionsToggled(transferRestrictionsEnabled);
    }
    
    /**
     * @notice Enable trading (one-time only)
     */
    function enableTrading() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!tradingEnabled, "Trading already enabled");
        tradingEnabled = true;
        emit TradingEnabled(block.timestamp);
    }

    // ============ Circuit Breaker Functions ============
    
    /**
     * @notice Update circuit breaker contract
     */
    function updateCircuitBreaker(address _circuitBreaker) 
        external 
        onlyRole(CIRCUIT_BREAKER_ROLE) 
    {
        address oldBreaker = address(circuitBreaker);
        circuitBreaker = ICircuitBreaker(_circuitBreaker);
        emit CircuitBreakerUpdated(oldBreaker, _circuitBreaker);
    }
    
    /**
     * @notice Trigger circuit breaker manually
     */
    function triggerCircuitBreaker(string calldata reason) 
        external 
        onlyRole(CIRCUIT_BREAKER_ROLE) 
    {
        circuitBreakerTriggered = true;
        lastCircuitBreakerReset = block.timestamp;
        emit CircuitBreakerTriggered(msg.sender, reason);
    }
    
    /**
     * @notice Reset circuit breaker
     */
    function resetCircuitBreaker() external onlyRole(CIRCUIT_BREAKER_ROLE) {
        circuitBreakerTriggered = false;
        lastCircuitBreakerReset = block.timestamp;
        emit CircuitBreakerReset();
    }
    
    /**
     * @notice Auto-reset circuit breaker if interval has passed
     */
    function autoResetCircuitBreaker() external {
        if (block.timestamp >= lastCircuitBreakerReset + circuitBreakerResetInterval) {
            circuitBreakerTriggered = false;
            lastCircuitBreakerReset = block.timestamp;
            emit CircuitBreakerReset();
        }
    }

    // ============ Transfer Hook Functions ============
    
    /**
     * @notice Update transfer hook contract
     */
    function updateTransferHook(address _transferHook) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        address oldHook = address(transferHook);
        transferHook = ITransferHook(_transferHook);
        emit TransferHookUpdated(oldHook, _transferHook);
    }

    // ============ Commit-Reveal Functions ============
    
    /**
     * @notice Create a commit for sensitive parameter updates
     */
    function createCommit(bytes32 commit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        commits[commit] = block.timestamp;
        emit CommitCreated(commit, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Reveal a commit
     */
    function revealCommit(bytes32 commit, bytes32 secret) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (commits[commit] == 0) revert CommitNotFound();
        if (block.timestamp > commits[commit] + commitTimeout) revert ParamCommitExpired();
        if (keccak256(abi.encodePacked(secret, msg.sender, block.timestamp)) != commit) {
            revert InvalidCommit();
        }
        
        delete commits[commit];
        emit CommitRevealed(commit, secret, block.timestamp);
    }

    // ============ Snapshot Functions ============
    
    /**
     * @notice Create a snapshot of current token balances
     * @dev Only callable by SNAPSHOT_ROLE
     * @return snapshotId The ID of the created snapshot
     */
    function createSnapshot() 
        external 
        onlyRole(SNAPSHOT_ROLE) 
        returns (uint256 snapshotId) 
    {
        currentSnapshotId++;
        snapshotId = currentSnapshotId;
        
        snapshots[snapshotId] = SnapshotData({
            id: snapshotId,
            timestamp: block.timestamp,
            totalSupply: totalSupply(),
            active: true
        });
        
        emit SnapshotCreated(snapshotId, block.timestamp, totalSupply());
        return snapshotId;
    }
    
    /**
     * @notice Get snapshot data by ID
     * @param snapshotId The snapshot ID to retrieve
     * @return snapshot The snapshot data
     */
    function getSnapshot(uint256 snapshotId) 
        external 
        view 
        returns (SnapshotData memory snapshot) 
    {
        if (snapshots[snapshotId].id == 0) {
            revert SnapshotNotFound();
        }
        return snapshots[snapshotId];
    }
    
    /**
     * @notice Get the latest snapshot ID
     * @return The latest snapshot ID
     */
    function getLatestSnapshotId() external view returns (uint256) {
        return currentSnapshotId;
    }
    
    /**
     * @notice Check if a snapshot exists
     * @param snapshotId The snapshot ID to check
     * @return True if snapshot exists
     */
    function snapshotExists(uint256 snapshotId) external view returns (bool) {
        return snapshots[snapshotId].id != 0;
    }

    // ============ Pausable Functions ============
    
    /**
     * @notice Pauses the contract.
     * @dev Accessible by ADMIN_PAUSER_ROLE, BOT_PAUSER_ROLE, or EMERGENCY_GUARDIAN_ROLE.
     */
    function pause() public whenNotPaused {
        // Check if the caller has any of the pauser roles
        require(
            hasRole(ADMIN_PAUSER_ROLE, msg.sender) || 
            hasRole(BOT_PAUSER_ROLE, msg.sender) ||
            hasRole(EMERGENCY_GUARDIAN_ROLE, msg.sender),
            "Caller must have pauser role"
        );
        
        // Determine pause type for event emission
        string memory pauseType = "UNKNOWN";
        if (hasRole(ADMIN_PAUSER_ROLE, msg.sender)) pauseType = "ADMIN";
        else if (hasRole(BOT_PAUSER_ROLE, msg.sender)) pauseType = "BOT";
        else if (hasRole(EMERGENCY_GUARDIAN_ROLE, msg.sender)) pauseType = "EMERGENCY_GUARDIAN";
        
        _pause();
        emit ContractPaused(msg.sender, pauseType);
    }
    
    /**
     * @notice Unpauses the contract.
     * @dev Accessible by ADMIN_PAUSER_ROLE or GOVERNANCE_UNPAUSER_ROLE.
     */
    function unpause() public whenPaused {
        // Only Admin or Governance roles can unpause
        require(
            hasRole(ADMIN_PAUSER_ROLE, msg.sender) || 
            hasRole(GOVERNANCE_UNPAUSER_ROLE, msg.sender),
            "Caller must have unpauser role"
        );
        _unpause();
        emit ContractUnpaused(msg.sender);
    }
    
    /**
     * @notice Grant BOT_PAUSER_ROLE to automated bot address
     * @dev Only callable by admin to set up the automated monitoring bot
     * @param botAddress Address of the automated bot/keeper
     */
    function grantBotPauserRole(address botAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (botAddress == address(0)) revert InvalidAddress();
        _grantRole(BOT_PAUSER_ROLE, botAddress);
    }
    
    /**
     * @notice Revoke BOT_PAUSER_ROLE from automated bot address
     * @dev Only callable by admin to revoke bot permissions if compromised
     * @param botAddress Address of the automated bot/keeper
     */
    function revokeBotPauserRole(address botAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(BOT_PAUSER_ROLE, botAddress);
    }
    
    /**
     * @notice Grant GOVERNANCE_UNPAUSER_ROLE to governance address
     * @dev Only callable by admin to set up governance unpausing
     * @param governanceAddress Address of the governance system (e.g., Timelock)
     */
    function grantGovernanceUnpauserRole(address governanceAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (governanceAddress == address(0)) revert InvalidAddress();
        _grantRole(GOVERNANCE_UNPAUSER_ROLE, governanceAddress);
    }
    
    /**
     * @notice Grant EMERGENCY_GUARDIAN_ROLE to emergency guardian address
     * @dev Only callable by admin to set up emergency guardian
     * @param guardianAddress Address of the emergency guardian (e.g., Security Council)
     */
    function grantEmergencyGuardianRole(address guardianAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (guardianAddress == address(0)) revert InvalidAddress();
        _grantRole(EMERGENCY_GUARDIAN_ROLE, guardianAddress);
    }

    // ============ Upgrade Functions ============
    
    /**
     * @notice Authorize upgrade (UUPS)
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(UPGRADER_ROLE) 
    {
        // Additional upgrade authorization logic can be added here
    }

    // ============ Required Overrides ============
    
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20Upgradeable, ERC20PausableUpgradeable)
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
    
    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     */
    uint256[50] private __gap;
}
