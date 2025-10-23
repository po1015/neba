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
