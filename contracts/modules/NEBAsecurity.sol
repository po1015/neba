// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/INEBAModule.sol";
import "../interfaces/ITransferHook.sol";
import "../interfaces/ICircuitBreaker.sol";

/**
 * @title NEBA Security Module
 * @dev Handles access control, pausing, blocklist/whitelist, and transfer hooks
 */
contract NEBAsecurity is 
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    INEBAModule
{
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

    // ============ State Variables ============
    
    /// @notice Core contract address
    address public coreContract;
    
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
    
    /// @notice Circuit breaker state
    bool public circuitBreakerTriggered;

    // ============ Events ============
    
    event BlocklistUpdated(address indexed account, bool blocked);
    event WhitelistUpdated(address indexed account, bool whitelisted);
    event TransferRestrictionsToggled(bool enabled);
    event TradingEnabled(uint256 timestamp);
    event CircuitBreakerUpdated(address indexed oldBreaker, address indexed newBreaker);
    event TransferHookUpdated(address indexed oldHook, address indexed newHook);
    event CircuitBreakerTriggered(address indexed triggerer, string reason);
    event CircuitBreakerReset();
    event ContractPaused(address indexed pauser, string indexed pauseType);
    event ContractUnpaused(address indexed unpauser);

    // ============ Errors ============
    
    error InvalidAddress();
    error BlockedAddress();
    error NotWhitelisted();
    error CircuitBreakerActive();
    error TradingNotEnabled();
    error UnauthorizedCaller();

    // ============ Modifiers ============
    
    modifier onlyCore() {
        require(msg.sender == coreContract, "Only core contract");
        _;
    }
    
    modifier notBlocked(address account) {
        if (blocklist[account]) revert BlockedAddress();
        _;
    }
    
    modifier onlyWhitelisted(address account) {
        if (transferRestrictionsEnabled && !whitelist[account] && account != coreContract) {
            revert NotWhitelisted();
        }
        _;
    }
    
    modifier whitelistTransferAllowed(address from, address to) {
        if (transferRestrictionsEnabled) {
            // Core contract can always send and receive
            if (from != coreContract && to != coreContract) {
                // Both addresses must be whitelisted for non-core transfers
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
        if (!tradingEnabled && msg.sender != coreContract) revert TradingNotEnabled();
        _;
    }

    // ============ Initialization ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the security module
     */
    function initialize(
        address _coreContract,
        address _admin
    ) public initializer {
        require(_coreContract != address(0) && _admin != address(0), "Invalid address");
        
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        coreContract = _coreContract;
        
        // Set up role admins
        _setRoleAdmin(UPGRADER_ROLE, DEFAULT_ADMIN_ROLE);
        
        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
    }

    // ============ Module Interface ============
    
    /**
     * @notice Called before transfers by core contract
     */
    function beforeTransfer(address from, address to, uint256 amount) external override onlyCore {
        // Check if contract is paused
        require(!paused(), "Contract paused");
        
        // Check blocklist
        require(!blocklist[from] && !blocklist[to], "Blocked address");
        
        // Check circuit breaker
        if (circuitBreakerTriggered) revert CircuitBreakerActive();
        
        // Check trading enabled
        if (!tradingEnabled && from != coreContract && to != coreContract) revert TradingNotEnabled();
        
        // Check whitelist restrictions
        if (transferRestrictionsEnabled) {
            if (from != coreContract && to != coreContract) {
                if (!whitelist[from] || !whitelist[to]) {
                    revert NotWhitelisted();
                }
            }
        }
        
        // Check circuit breaker contract
        if (address(circuitBreaker) != address(0)) {
            circuitBreaker.checkTransfer(from, to, amount);
        }
        
        // Call transfer hook if set
        if (address(transferHook) != address(0)) {
            transferHook.beforeTransfer(from, to, amount);
        }
    }
    
    /**
     * @notice Called after transfers by core contract
     */
    function afterTransfer(address from, address to, uint256 amount) external override onlyCore {
        // Call transfer hook if set
        if (address(transferHook) != address(0)) {
            transferHook.afterTransfer(from, to, amount);
        }
    }

    // ============ Access Control Functions ============
    
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
        emit CircuitBreakerTriggered(msg.sender, reason);
    }
    
    /**
     * @notice Reset circuit breaker
     */
    function resetCircuitBreaker() external onlyRole(CIRCUIT_BREAKER_ROLE) {
        circuitBreakerTriggered = false;
        emit CircuitBreakerReset();
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

    // ============ Pausable Functions ============
    
    /**
     * @notice Pauses the contract.
     */
    function pause() public whenNotPaused {
        require(
            hasRole(ADMIN_PAUSER_ROLE, msg.sender) || 
            hasRole(BOT_PAUSER_ROLE, msg.sender) ||
            hasRole(EMERGENCY_GUARDIAN_ROLE, msg.sender),
            "Caller must have pauser role"
        );
        
        string memory pauseType = "UNKNOWN";
        if (hasRole(ADMIN_PAUSER_ROLE, msg.sender)) pauseType = "ADMIN";
        else if (hasRole(BOT_PAUSER_ROLE, msg.sender)) pauseType = "BOT";
        else if (hasRole(EMERGENCY_GUARDIAN_ROLE, msg.sender)) pauseType = "EMERGENCY_GUARDIAN";
        
        _pause();
        emit ContractPaused(msg.sender, pauseType);
    }
    
    /**
     * @notice Unpauses the contract.
     */
    function unpause() public whenPaused {
        require(
            hasRole(ADMIN_PAUSER_ROLE, msg.sender) || 
            hasRole(GOVERNANCE_UNPAUSER_ROLE, msg.sender),
            "Caller must have unpauser role"
        );
        _unpause();
        emit ContractUnpaused(msg.sender);
    }

    // ============ View Functions ============
    
    /**
     * @notice Check if transfer is allowed
     */
    function isTransferAllowed(address from, address to) 
        public 
        view 
        returns (bool) 
    {
        if (paused()) return false;
        if (blocklist[from] || blocklist[to]) return false;
        if (circuitBreakerTriggered) return false;
        if (!tradingEnabled && from != coreContract && to != coreContract) return false;
        
        if (transferRestrictionsEnabled) {
            if (from == coreContract || to == coreContract) return true;
            if (!whitelist[from] || !whitelist[to]) return false;
        }
        
        return true;
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

    // ============ Storage Gap ============
    
    uint256[50] private __gap;
}
