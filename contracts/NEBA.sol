// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title NEBA Token - Phase 2
 * @notice Simple, secure token for sales launch
 * @dev Single contract architecture following Phase 2 requirements
 */
contract NEBA is 
    ERC20Upgradeable,
    ERC20CappedUpgradeable,
    ERC20PermitUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{

    // ============ Constants ============
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;

    // ============ Roles ============
    bytes32 public constant RECOVERY_ROLE = keccak256("RECOVERY_ROLE"); // R2
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE"); // R3
    bytes32 public constant UPGRADER_ADMIN_ROLE = keccak256("UPGRADER_ADMIN_ROLE"); // R3A
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE"); // R4
    bytes32 public constant ADMIN_PAUSER_ROLE = keccak256("ADMIN_PAUSER_ROLE"); // R8
    bytes32 public constant BOT_PAUSER_ROLE = keccak256("BOT_PAUSER_ROLE"); // R9

    // ============ State Variables ============
    address public treasury;
    bool public migrated; // For Phase 3 migration

    // ============ Events ============
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event RolesMigrated(address indexed tlMain, address indexed tlUpg);
    event ETHRecovered(address indexed to, uint256 amount);
    event TokenRecovered(address indexed token, address indexed to, uint256 amount);

    // ============ Errors ============
    error InvalidAddress();
    error InvalidAmount();
    error CannotRecoverNEBA();
    error AlreadyMigrated();
    error UnauthorizedUpgrade();
    
    // ============ Constructor ============
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ Initialization ============
    /**
     * @notice Initialize the NEBA token contract
     * @param _treasury Treasury address for initial token allocation
     * @param _mainSafe Main safe address (gets DEFAULT_ADMIN_ROLE, RECOVERY_ROLE, UPGRADER roles)
     * @param _opsSafe Operations safe address (gets ADMIN_PAUSER_ROLE)
     * @param _botExecutor Bot executor address (gets BOT_PAUSER_ROLE)
     * @param _saleContract Sale contract address (gets MINTER_ROLE)
     */
    function initialize(
        address _treasury,
        address _mainSafe,
        address _opsSafe,
        address _botExecutor,
        address _saleContract
    ) public initializer {
        // Comprehensive input validation
        require(_treasury != address(0), "Invalid treasury");
        require(_mainSafe != address(0), "Invalid main safe");
        require(_opsSafe != address(0), "Invalid ops safe");
        require(_botExecutor != address(0), "Invalid bot executor");
        require(_saleContract != address(0), "Invalid sale contract");
        require(_treasury != address(this), "Treasury cannot be token contract");
        require(_mainSafe != address(this), "Main safe cannot be token contract");
        require(_opsSafe != address(this), "Ops safe cannot be token contract");
        require(_botExecutor != address(this), "Bot executor cannot be token contract");
        require(_saleContract != address(this), "Sale contract cannot be token contract");
        
        // Initialize OpenZeppelin contracts
        __ERC20_init("NEBA Token", "$NEBA");
        __ERC20Capped_init(MAX_SUPPLY);
        __ERC20Permit_init("NEBA Token");
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        treasury = _treasury;
        
        // R1 - DEFAULT_ADMIN_ROLE (main safe gets this)
        _grantRole(DEFAULT_ADMIN_ROLE, _mainSafe);
        
        // R2 - RECOVERY_ROLE (main safe gets this)
        _grantRole(RECOVERY_ROLE, _mainSafe);
        
        // R3/R3A - UPGRADER roles with proper isolation
        // CRITICAL: Set role admin hierarchy BEFORE granting roles
        _setRoleAdmin(UPGRADER_ROLE, UPGRADER_ADMIN_ROLE);
        _setRoleAdmin(UPGRADER_ADMIN_ROLE, UPGRADER_ADMIN_ROLE); // Self-admin
        
        // Grant upgrade roles to main safe
        _grantRole(UPGRADER_ADMIN_ROLE, _mainSafe);
        _grantRole(UPGRADER_ROLE, _mainSafe);
        
        // R4 - MINTER_ROLE (sale contract gets this)
        _grantRole(MINTER_ROLE, _saleContract);
        
        // R8 - ADMIN_PAUSER_ROLE (ops safe gets this)
        _grantRole(ADMIN_PAUSER_ROLE, _opsSafe);
        
        // R9 - BOT_PAUSER_ROLE (bot executor gets this)
        _grantRole(BOT_PAUSER_ROLE, _botExecutor);
        
        // Mint initial supply to treasury
        _mint(treasury, MAX_SUPPLY);
        
        // CRITICAL: Deployer (msg.sender) has NO roles after deployment
        // This is verified in tests
    }

    // ============ Minting Functions ============
    /**
     * @notice Mint new tokens to specified address
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     * @dev Only callable by MINTER_ROLE when not paused
     * @dev ERC20Capped automatically enforces MAX_SUPPLY limit
     */
    function mint(address to, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(to != address(0), "Mint to zero address");
        require(amount > 0, "Amount must be > 0");
        _mint(to, amount); // ERC20Capped will enforce cap
    }
    
    // ============ Pause/Unpause Functions ============
    /**
     * @notice Pause token transfers
     * @dev Can be called by ADMIN_PAUSER_ROLE or BOT_PAUSER_ROLE
     */
    function pause() public {
        require(
            hasRole(ADMIN_PAUSER_ROLE, msg.sender) || 
            hasRole(BOT_PAUSER_ROLE, msg.sender),
            "Unauthorized"
        );
        _pause();
    }
    
    /**
     * @notice Unpause token transfers
     * @dev Can ONLY be called by ADMIN_PAUSER_ROLE (R8)
     */
    function unpause() public onlyRole(ADMIN_PAUSER_ROLE) {
        _unpause();
    }

    // ============ Recovery Functions ============
    /**
     * @notice Recover ETH accidentally sent to contract
     * @param to Address to send ETH to
     * @param amount Amount of ETH to recover
     * @dev Only callable by RECOVERY_ROLE
     */
    function recoverETH(address payable to, uint256 amount) 
        external 
        onlyRole(RECOVERY_ROLE) 
        nonReentrant 
    {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Invalid amount");
        require(address(this).balance >= amount, "Insufficient balance");
        
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
        emit ETHRecovered(to, amount);
    }
    
    /**
     * @notice Recover ERC20 tokens accidentally sent to contract
     * @param token Token contract address
     * @param to Address to send tokens to
     * @param amount Amount of tokens to recover
     * @dev Only callable by RECOVERY_ROLE
     * @dev FORBIDS recovery of NEBA tokens
     */
    function recoverERC20(
        IERC20 token, 
        address to, 
        uint256 amount
    ) 
        external 
        onlyRole(RECOVERY_ROLE) 
        nonReentrant 
    {
        require(address(token) != address(this), "Cannot recover NEBA");
        require(to != address(0), "Invalid address");
        require(amount > 0, "Invalid amount");
        
        token.transfer(to, amount);
        emit TokenRecovered(address(token), to, amount);
    }
    
    // ============ Treasury Management ============
    /**
     * @notice Update treasury address
     * @param _treasury New treasury address
     * @dev Only callable by DEFAULT_ADMIN_ROLE
     */
    function updateTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid treasury");
        require(_treasury != address(this), "Treasury cannot be token contract");
        require(_treasury != treasury, "New treasury must be different from current");
        
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }
    
    // ============ Phase 3 Migration Scaffold ============
    /**
     * @notice Migrate roles to timelock contracts for Phase 3
     * @param tlMain Main timelock contract address
     * @param tlUpg Upgrade timelock contract address
     * @param mainSafe Current main safe address (to revoke roles from)
     * @dev Only callable by DEFAULT_ADMIN_ROLE
     * @dev Can only be called once
     */
    function migrateRoles(
        address tlMain,
        address tlUpg,
        address mainSafe
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!migrated, "Already migrated");
        require(tlMain != address(0), "Invalid main timelock");
        require(tlUpg != address(0), "Invalid upgrade timelock");
        require(tlMain != address(this), "Timelock cannot be token contract");
        require(tlUpg != address(this), "Timelock cannot be token contract");
        
        // Grant roles to timelock contracts
        _grantRole(DEFAULT_ADMIN_ROLE, tlMain);
        _grantRole(RECOVERY_ROLE, tlMain);
        _grantRole(UPGRADER_ADMIN_ROLE, tlUpg);
        _grantRole(UPGRADER_ROLE, tlUpg);
        
        // Revoke roles from main safe
        _revokeRole(DEFAULT_ADMIN_ROLE, mainSafe);
        _revokeRole(RECOVERY_ROLE, mainSafe);
        _revokeRole(UPGRADER_ADMIN_ROLE, mainSafe);
        _revokeRole(UPGRADER_ROLE, mainSafe);
        
        migrated = true;
        emit RolesMigrated(tlMain, tlUpg);
    }

    // ============ Interface Support ============
    /**
     * @notice Check if contract supports interface
     * @param interfaceId Interface ID to check
     * @return True if interface is supported
     */
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(AccessControlUpgradeable) 
        returns (bool) 
    {
        return interfaceId == type(INEBAMinter).interfaceId ||
               super.supportsInterface(interfaceId);
    }
    
    // ============ Upgrade Authorization ============
    /**
     * @notice Authorize upgrade (UUPS)
     * @param newImplementation Address of new implementation
     * @dev Only callable by UPGRADER_ROLE (R3)
     * @dev NO nonReentrant modifier on upgrade functions
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(UPGRADER_ROLE) 
    {
        // Additional upgrade validation can be added here
        // For now, just ensure only R3 can upgrade
    }

    // ============ Required Overrides ============
    /**
     * @notice Update token balances
     * @param from Address tokens are transferred from
     * @param to Address tokens are transferred to
     * @param value Amount of tokens to transfer
     * @dev Enforces pause only on transfers (not minting)
     * @dev ERC20Capped enforces maximum supply
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20Upgradeable, ERC20CappedUpgradeable)
    {
        // Allow minting during pause (from == address(0))
        // Block transfers during pause (from != address(0))
        if (from != address(0)) {
            require(!paused(), "Token transfers paused");
        }
        super._update(from, to, value);
    }
    
    /**
     * @notice Get nonces for permit functionality
     * @param owner Address to get nonces for
     * @return Nonce value
     */
    function nonces(address owner)
        public
        view
        override(ERC20PermitUpgradeable)
        returns (uint256)
    {
        return super.nonces(owner);
    }
    
    // ============ View Functions ============
    /**
     * @notice Check if cap is immutable
     * @return True (cap is immutable)
     */
    function isCapImmutable() external pure returns (bool) {
        return true;
    }
    
    /**
     * @notice Get maximum supply cap
     * @return Maximum supply (1 billion tokens)
     */
    function cap() public pure override returns (uint256) {
        return MAX_SUPPLY;
    }

    // ============ Storage Gap ============
    /**
     * @notice Reserve storage slots for future upgrades
     * @dev Critical for UUPS upgrade compatibility
     */
    uint256[50] private __gap;
}

/**
 * @title INEBAMinter
 * @notice Interface for NEBA token minting
 * @dev Required for Phase 2 compliance
 */
interface INEBAMinter {
    /**
     * @notice Mint tokens to specified address
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external;
}
