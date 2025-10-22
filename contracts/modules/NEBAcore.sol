// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/INEBAModule.sol";
import "./NEBArateLimiting.sol";

/**
 * @title NEBA Core Module
 * @dev Core ERC20 functionality with essential features
 */
contract NEBAcore is 
    ERC20Upgradeable,
    ERC20CappedUpgradeable,
    ERC20PermitUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    INEBAModule
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

    // ============ State Variables ============
    
    /// @notice Treasury address
    address public treasury;
    
    /// @notice Module registry
    mapping(string => address) public modules;
    
    /// @notice Module manager
    address public moduleManager;

    // ============ Events ============
    
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event ModuleUpdated(string indexed moduleName, address indexed oldModule, address indexed newModule);

    // ============ Errors ============
    
    error InvalidAddress();
    error InvalidAmount();
    error ModuleNotRegistered();
    error UnauthorizedModule();

    // ============ Modifiers ============
    
    modifier onlyModuleManager() {
        require(msg.sender == moduleManager, "Only module manager");
        _;
    }
    
    modifier onlyModule(string memory moduleName) {
        require(msg.sender == modules[moduleName], "Unauthorized module");
        _;
    }

    // ============ Initialization ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the core module
     */
    function initialize(
        address _treasury,
        address _moduleManager
    ) public initializer {
        require(_treasury != address(0) && _moduleManager != address(0), "Invalid address");
        
        __ERC20_init(TOKEN_NAME, TOKEN_SYMBOL);
        __ERC20Capped_init(MAX_SUPPLY);
        __ERC20Permit_init(TOKEN_NAME);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        treasury = _treasury;
        moduleManager = _moduleManager;
        
        // Mint entire supply to treasury
        _mint(treasury, MAX_SUPPLY);
        
        emit TreasuryUpdated(address(0), _treasury);
    }

    // ============ Module Management ============
    
    /**
     * @notice Register a module
     */
    function registerModule(string memory moduleName, address moduleAddress) 
        external 
        onlyModuleManager 
    {
        require(moduleAddress != address(0), "Invalid address");
        address oldModule = modules[moduleName];
        modules[moduleName] = moduleAddress;
        emit ModuleUpdated(moduleName, oldModule, moduleAddress);
    }
    
    /**
     * @notice Update treasury address
     */
    function updateTreasury(address _treasury) external onlyModuleManager {
        require(_treasury != address(0), "Invalid address");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    // ============ ERC-20 Overrides ============
    
    /**
     * @notice Override transfer to include module checks
     */
    function transfer(address to, uint256 amount) virtual 
        public 
        override 
        nonReentrant 
        returns (bool) 
    {
        // Check with security module if registered
        if (modules["security"] != address(0)) {
            INEBAModule(modules["security"]).beforeTransfer(msg.sender, to, amount);
        }
        
        bool success = super.transfer(to, amount);
        
        // Notify security module after transfer
        if (modules["security"] != address(0)) {
            INEBAModule(modules["security"]).afterTransfer(msg.sender, to, amount);
        }
        
        return success;
    }
    
    /**
     * @notice Override transferFrom to include module checks
     */
    function transferFrom(address from, address to, uint256 amount) virtual 
        public 
        override 
        nonReentrant 
        returns (bool) 
    {
        // Check with security module if registered
        if (modules["security"] != address(0)) {
            INEBAModule(modules["security"]).beforeTransfer(from, to, amount);
        }
        
        bool success = super.transferFrom(from, to, amount);
        
        // Notify security module after transfer
        if (modules["security"] != address(0)) {
            INEBAModule(modules["security"]).afterTransfer(from, to, amount);
        }
        
        return success;
    }

    // ============ Minting Functions ============
    
    /**
     * @notice Mint tokens to a specified address
     * @dev Only callable by registered modules
     */
    function mint(address to, uint256 amount) 
        external 
        onlyModule("rateLimiting")
        nonReentrant 
    {
        require(to != address(0), "Mint to zero address");
        require(amount > 0, "Amount must be > 0");
        
        // Check with rate limiting module if registered
        if (modules["rateLimiting"] != address(0)) {
            NEBArateLimiting(modules["rateLimiting"]).checkAndUpdateMint(to, amount);
        }
        
        _mint(to, amount);
    }
    
    // Remove the override _mint function as it's not needed

    // ============ Module Interface ============
    
    /**
     * @notice Called before transfers by security module
     */
    function beforeTransfer(address from, address to, uint256 amount) external override {
        // This will be called by security module
        // Core module doesn't need to do anything here
    }
    
    /**
     * @notice Called after transfers by security module
     */
    function afterTransfer(address from, address to, uint256 amount) external override {
        // This will be called by security module
        // Core module doesn't need to do anything here
    }

    // ============ Cap Immutability ============
    
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
        onlyModuleManager 
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
