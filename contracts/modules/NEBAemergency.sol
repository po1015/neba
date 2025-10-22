// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/INEBAModule.sol";

/**
 * @title NEBA Emergency Module
 * @dev Handles emergency mode, recovery functions, and migration
 */
contract NEBAemergency is 
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    INEBAModule
{
    // ============ Constants ============
    
    /// @notice Duration of emergency mode (7 days)
    uint256 public constant EMERGENCY_MODE_DURATION = 7 days;

    // ============ Roles ============
    
    /// @notice Role for upgrading the contract
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    /// @notice Role for recovery operations (recoverETH/ERC20)
    bytes32 public constant RECOVERY_ROLE = keccak256("RECOVERY_ROLE");
    
    /// @notice Role for emergency response (Guardian)
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ============ State Variables ============
    
    /// @notice Core contract address
    address public coreContract;
    
    /// @notice Emergency mode status
    bool public emergencyMode;
    
    /// @notice Timestamp when emergency mode was activated
    uint256 public emergencyModeActivatedAt;
    
    /// @notice Migration status for Phase 3
    bool public migrated;

    // ============ Events ============
    
    event EmergencyModeActivated(address indexed guardian, string reason);
    event EmergencyModeDeactivated(address indexed by);
    event EmergencyUpgradeExecuted(address indexed newImplementation);
    event ETHRecovered(address indexed to, uint256 amount);
    event ERC20Recovered(address indexed token, address indexed to, uint256 amount);
    event RolesMigrated(address indexed tlMain, address indexed tlUpg);

    // ============ Errors ============
    
    error InvalidAddress();
    error InvalidAmount();
    error CannotRecoverNEBA();
    error EmergencyModeNotActive();
    error EmergencyModeExpired();
    error NotInEmergencyMode();
    error AlreadyMigrated();

    // ============ Modifiers ============
    
    modifier onlyCore() {
        require(msg.sender == coreContract, "Only core contract");
        _;
    }

    // ============ Initialization ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the emergency module
     */
    function initialize(
        address _coreContract,
        address _admin
    ) public initializer {
        require(_coreContract != address(0) && _admin != address(0), "Invalid address");
        
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        coreContract = _coreContract;
        
        // Set up role admins
        _setRoleAdmin(UPGRADER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(GUARDIAN_ROLE, GUARDIAN_ROLE); // Self-admin for emergency response
        
        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(RECOVERY_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        _grantRole(GUARDIAN_ROLE, _admin);
    }

    // ============ Module Interface ============
    
    /**
     * @notice Called before transfers by core contract
     */
    function beforeTransfer(address from, address to, uint256 amount) external override onlyCore {
        // Emergency module doesn't need to do anything before transfers
    }
    
    /**
     * @notice Called after transfers by core contract
     */
    function afterTransfer(address from, address to, uint256 amount) external override onlyCore {
        // Emergency module doesn't need to do anything after transfers
    }

    // ============ Emergency Mode Functions ============
    
    /**
     * @notice Activate emergency mode (freezes all operations)
     * @dev Only callable by GUARDIAN_ROLE
     * @param reason Public reason for activation
     */
    function activateEmergencyMode(string calldata reason) 
        external 
        onlyRole(GUARDIAN_ROLE) 
    {
        require(!emergencyMode, "Already in emergency mode");
        
        emergencyMode = true;
        emergencyModeActivatedAt = block.timestamp;
        
        emit EmergencyModeActivated(msg.sender, reason);
    }
    
    /**
     * @notice Emergency upgrade (bypasses timelock, only during emergency mode)
     * @dev Can ONLY be called within EMERGENCY_MODE_DURATION after activation
     * @param newImplementation Address of new implementation contract
     */
    function emergencyUpgrade(address newImplementation) 
        external 
        onlyRole(GUARDIAN_ROLE) 
    {
        if (!emergencyMode) revert EmergencyModeNotActive();
        
        if (block.timestamp > emergencyModeActivatedAt + EMERGENCY_MODE_DURATION) {
            revert EmergencyModeExpired();
        }
        
        // Validate new implementation
        require(newImplementation != address(0), "Invalid implementation");
        require(newImplementation.code.length > 0, "Not a contract");
        
        // Perform upgrade WITHOUT timelock
        _authorizeEmergencyUpgrade(newImplementation);
        upgradeToAndCall(newImplementation, bytes(""));
        
        emit EmergencyUpgradeExecuted(newImplementation);
    }
    
    /**
     * @notice Deactivate emergency mode
     * @dev Can be called by GUARDIAN_ROLE or DEFAULT_ADMIN_ROLE
     */
    function deactivateEmergencyMode() external {
        require(emergencyMode, "Not in emergency mode");
        
        require(
            hasRole(GUARDIAN_ROLE, msg.sender) || 
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        
        emergencyMode = false;
        
        emit EmergencyModeDeactivated(msg.sender);
    }
    
    /**
     * @notice Internal authorization for emergency upgrades
     */
    function _authorizeEmergencyUpgrade(address newImplementation) internal view {
        if (!emergencyMode) revert NotInEmergencyMode();
        if (!hasRole(GUARDIAN_ROLE, msg.sender)) {
            revert("Not guardian");
        }
    }
    
    /**
     * @notice Check if emergency powers are available
     */
    function canUseEmergencyPowers() external view returns (bool) {
        if (!emergencyMode) return false;
        if (block.timestamp > emergencyModeActivatedAt + EMERGENCY_MODE_DURATION) {
            return false;
        }
        return true;
    }

    // ============ Recovery Functions ============
    
    /**
     * @notice Recover ETH from the contract
     * @dev Only callable by RECOVERY_ROLE
     */
    function recoverETH(address payable to, uint256 amount) 
        external 
        onlyRole(RECOVERY_ROLE) 
        nonReentrant 
    {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (address(this).balance < amount) revert InvalidAmount();
        
        Address.sendValue(to, amount);
        emit ETHRecovered(to, amount);
    }
    
    /**
     * @notice Recover ERC20 tokens from the contract
     * @dev Only callable by RECOVERY_ROLE, cannot recover NEBA tokens
     */
    function recoverERC20(address token, address to, uint256 amount) 
        external 
        onlyRole(RECOVERY_ROLE) 
        nonReentrant 
    {
        if (token == address(0) || to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (token == coreContract) revert CannotRecoverNEBA();
        
        SafeERC20.safeTransfer(IERC20(token), to, amount);
        emit ERC20Recovered(token, to, amount);
    }

    // ============ Migration Functions ============
    
    /**
     * @notice Migrate roles to timelock contracts (Phase 3)
     * @dev Only callable by DEFAULT_ADMIN_ROLE, one-time operation
     */
    function migrateRoles(address tlMain, address tlUpg, address mainSafe) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        if (migrated) revert AlreadyMigrated();
        if (tlMain == address(0) || tlUpg == address(0) || mainSafe == address(0)) {
            revert InvalidAddress();
        }
        
        // Grant roles to timelocks
        _grantRole(DEFAULT_ADMIN_ROLE, tlMain);
        _grantRole(RECOVERY_ROLE, tlMain);
        _grantRole(UPGRADER_ROLE, tlUpg);
        
        // Revoke roles from main safe
        _revokeRole(DEFAULT_ADMIN_ROLE, mainSafe);
        _revokeRole(RECOVERY_ROLE, mainSafe);
        _revokeRole(UPGRADER_ROLE, mainSafe);
        
        migrated = true;
        emit RolesMigrated(tlMain, tlUpg);
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
        // Emergency upgrades use different path
        require(!emergencyMode, "Use emergencyUpgrade() instead");
    }

    // ============ Receive Function ============
    
    /**
     * @notice Allow contract to receive ETH
     */
    receive() external payable {
        // Allow ETH to be sent to the contract
    }

    // ============ Storage Gap ============
    
    uint256[50] private __gap;
}
