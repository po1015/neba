// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/INEBAModule.sol";
import "./NEBAcore.sol";

/**
 * @title NEBA Rate Limiting Module
 * @dev Handles rate limiting for minting operations
 */
contract NEBArateLimiting is 
    AccessControlUpgradeable,
    UUPSUpgradeable,
    INEBAModule
{
    // ============ Constants ============
    
    /// @notice Threshold for large mint detection (1M tokens)
    uint256 public constant LARGE_MINT_THRESHOLD = 1_000_000 * 10**18;

    // ============ Roles ============
    
    /// @notice Role for upgrading the contract
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    /// @notice Role for minting tokens (SALE_CONTRACT)
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ============ Rate Limiting Structures ============
    
    /// @notice Rate limiting configuration
    struct MintLimits {
        uint256 maxPerTransaction;  // Max tokens per single mint
        uint256 maxPerBlock;        // Max tokens per block
        uint256 maxPerDay;          // Max tokens per 24h period
        uint256 cooldownBlocks;     // Min blocks between large mints
    }

    // ============ State Variables ============
    
    /// @notice Core contract address
    address public coreContract;
    
    /// @notice Current mint limits configuration
    MintLimits public mintLimits;
    
    /// @notice Tracking minted amounts per block
    mapping(uint256 => uint256) public mintedPerBlock;
    
    /// @notice Tracking minted amounts per day
    mapping(uint256 => uint256) public mintedPerDay;
    
    /// @notice Last block with large mint
    uint256 public lastLargeMintBlock;

    // ============ Events ============
    
    event MintLimitsUpdated(
        uint256 maxPerTransaction,
        uint256 maxPerBlock,
        uint256 maxPerDay,
        uint256 cooldownBlocks
    );
    event LargeMintDetected(address indexed to, uint256 amount, uint256 blockNumber);

    // ============ Errors ============
    
    error InvalidAddress();
    error MintExceedsTransactionLimit(uint256 amount, uint256 limit);
    error MintExceedsBlockLimit(uint256 amount, uint256 limit, uint256 alreadyMinted);
    error MintExceedsDayLimit(uint256 amount, uint256 limit, uint256 alreadyMinted);
    error MintCooldownActive(uint256 currentBlock, uint256 allowedBlock);

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
     * @notice Initialize the rate limiting module
     */
    function initialize(
        address _coreContract,
        address _admin
    ) public initializer {
        require(_coreContract != address(0) && _admin != address(0), "Invalid address");
        
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        coreContract = _coreContract;
        
        // Set up role admins
        _setRoleAdmin(UPGRADER_ROLE, DEFAULT_ADMIN_ROLE);
        
        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        _grantRole(MINTER_ROLE, _admin);
        
        // Initialize rate limiting with conservative defaults
        mintLimits = MintLimits({
            maxPerTransaction: 10_000_000 * 10**18,  // 10M per tx
            maxPerBlock: 20_000_000 * 10**18,         // 20M per block
            maxPerDay: 100_000_000 * 10**18,          // 100M per day
            cooldownBlocks: 100                        // ~20 min on mainnet
        });
    }

    // ============ Module Interface ============
    
    /**
     * @notice Called before transfers by core contract
     */
    function beforeTransfer(address from, address to, uint256 amount) external override onlyCore {
        // Rate limiting module doesn't need to do anything before transfers
    }
    
    /**
     * @notice Called after transfers by core contract
     */
    function afterTransfer(address from, address to, uint256 amount) external override onlyCore {
        // Rate limiting module doesn't need to do anything after transfers
    }

    // ============ Minting Functions ============
    
    /**
     * @notice Check if minting is allowed and update tracking
     * @dev Called by core contract before minting
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function checkAndUpdateMint(address to, uint256 amount) 
        external 
        onlyCore
        returns (bool)
    {
        // Check transaction limit
        if (amount > mintLimits.maxPerTransaction) {
            revert MintExceedsTransactionLimit(amount, mintLimits.maxPerTransaction);
        }
        
        uint256 currentBlock = block.number;
        uint256 currentDay = block.timestamp / 1 days;
        
        // Check block limit
        uint256 blockMinted = mintedPerBlock[currentBlock];
        if (blockMinted + amount > mintLimits.maxPerBlock) {
            revert MintExceedsBlockLimit(
                amount, 
                mintLimits.maxPerBlock, 
                blockMinted
            );
        }
        
        // Check daily limit
        uint256 dayMinted = mintedPerDay[currentDay];
        if (dayMinted + amount > mintLimits.maxPerDay) {
            revert MintExceedsDayLimit(
                amount,
                mintLimits.maxPerDay,
                dayMinted
            );
        }
        
        // Check cooldown for large mints
        if (amount >= LARGE_MINT_THRESHOLD) {
            uint256 blocksSinceLastLarge = currentBlock - lastLargeMintBlock;
            if (blocksSinceLastLarge < mintLimits.cooldownBlocks && lastLargeMintBlock != 0) {
                revert MintCooldownActive(
                    currentBlock,
                    lastLargeMintBlock + mintLimits.cooldownBlocks
                );
            }
            lastLargeMintBlock = currentBlock;
            emit LargeMintDetected(to, amount, currentBlock);
        }
        
        // Update tracking
        mintedPerBlock[currentBlock] += amount;
        mintedPerDay[currentDay] += amount;
        
        return true;
    }
    
    /**
     * @notice Mint tokens to a specified address
     * @dev Only callable by MINTER_ROLE
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
    {
        require(to != address(0), "Mint to zero address");
        require(amount > 0, "Amount must be > 0");
        
        // Call core contract to perform mint (core will call checkAndUpdateMint)
        NEBAcore(coreContract).mint(to, amount);
    }

    // ============ Rate Limiting Management ============
    
    /**
     * @notice Update mint limits (only DEFAULT_ADMIN_ROLE)
     */
    function setMintLimits(
        uint256 _maxPerTransaction,
        uint256 _maxPerBlock,
        uint256 _maxPerDay,
        uint256 _cooldownBlocks
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_maxPerTransaction > 0, "Invalid maxPerTransaction");
        require(_maxPerBlock >= _maxPerTransaction, "Block limit < tx limit");
        require(_maxPerDay >= _maxPerBlock, "Day limit < block limit");
        
        mintLimits = MintLimits({
            maxPerTransaction: _maxPerTransaction,
            maxPerBlock: _maxPerBlock,
            maxPerDay: _maxPerDay,
            cooldownBlocks: _cooldownBlocks
        });
        
        emit MintLimitsUpdated(
            _maxPerTransaction,
            _maxPerBlock,
            _maxPerDay,
            _cooldownBlocks
        );
    }
    
    /**
     * @notice Get current mint statistics
     */
    function getMintStats() external view returns (
        uint256 blockMinted,
        uint256 dayMinted,
        uint256 blockLimit,
        uint256 dayLimit,
        uint256 blocksSinceLastLarge
    ) {
        blockMinted = mintedPerBlock[block.number];
        dayMinted = mintedPerDay[block.timestamp / 1 days];
        blockLimit = mintLimits.maxPerBlock;
        dayLimit = mintLimits.maxPerDay;
        blocksSinceLastLarge = block.number - lastLargeMintBlock;
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
