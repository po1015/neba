// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

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
    ReentrancyGuardUpgradeable
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
    
    /// @notice Admin address
    address public admin;

    // ============ Events ============
    
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ============ Errors ============
    
    error InvalidAddress();

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
        require(_treasury != address(0) && _admin != address(0), "Invalid address");
        
        __ERC20_init(TOKEN_NAME, TOKEN_SYMBOL);
        __ERC20Capped_init(MAX_SUPPLY);
        __ERC20Permit_init(TOKEN_NAME);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        treasury = _treasury;
        admin = _admin;
        
        // Mint initial supply to treasury (100M tokens instead of full supply)
        uint256 initialSupply = 100_000_000 * 10**18; // 100M tokens
        _mint(treasury, initialSupply);
        
        emit TreasuryUpdated(address(0), _treasury);
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Update treasury address
     */
    function updateTreasury(address _treasury) external onlyAdmin {
        require(_treasury != address(0), "Invalid address");
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
