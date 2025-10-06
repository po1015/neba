// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./interfaces/ITransferHook.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title TransferHook
 * @dev Sample transfer hook implementation for compliance and monitoring
 * @notice This contract provides hooks for transfer monitoring and compliance checks
 */
contract TransferHook is ITransferHook, AccessControlUpgradeable {
    
    // ============ Constants ============
    
    bytes32 public constant HOOK_MANAGER_ROLE = keccak256("HOOK_MANAGER_ROLE");
    
    // ============ State Variables ============
    
    bool public hooksEnabled;
    mapping(address => bool) public whitelistedSenders;
    mapping(address => bool) public whitelistedReceivers;
    mapping(address => bool) public blacklistedAddresses;
    
    uint256 public maxTransferAmount;
    uint256 public minTransferAmount;
    
    // Transfer monitoring
    mapping(address => uint256) public transferCount;
    mapping(address => uint256) public totalTransferred;
    mapping(address => uint256) public lastTransferTime;
    
    // ============ Events ============
    
    event TransferExecuted(address indexed from, address indexed to, uint256 amount, uint256 timestamp);
    event WhitelistUpdated(address indexed account, bool whitelisted, bool isSender);
    event BlacklistUpdated(address indexed account, bool blacklisted);
    event LimitsUpdated(uint256 maxAmount, uint256 minAmount);
    event HooksToggled(bool enabled);
    
    // ============ Errors ============
    
    error HooksDisabled();
    error AddressBlacklisted();
    error TransferAmountExceedsLimit();
    error TransferAmountBelowMinimum();
    error UnauthorizedCaller();
    
    // ============ Initialization ============
    
    function initialize(
        address admin,
        uint256 _maxTransferAmount,
        uint256 _minTransferAmount
    ) public initializer {
        __AccessControl_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(HOOK_MANAGER_ROLE, admin);
        
        hooksEnabled = true;
        maxTransferAmount = _maxTransferAmount;
        minTransferAmount = _minTransferAmount;
    }
    
    // ============ Transfer Hook Implementation ============
    
    /**
     * @notice Called before a transfer is executed
     */
    function beforeTransfer(address from, address to, uint256 amount) external view override {
        if (!hooksEnabled) return;
        
        // Check if addresses are blacklisted
        if (blacklistedAddresses[from] || blacklistedAddresses[to]) {
            revert AddressBlacklisted();
        }
        
        // Check transfer amount limits
        if (amount > maxTransferAmount) {
            revert TransferAmountExceedsLimit();
        }
        
        if (amount < minTransferAmount && amount > 0) {
            revert TransferAmountBelowMinimum();
        }
        
        // Additional compliance checks can be added here
        _performComplianceChecks(from, to, amount);
    }
    
    /**
     * @notice Called after a transfer is executed
     */
    function afterTransfer(address from, address to, uint256 amount) external override {
        if (!hooksEnabled) return;
        
        // Update transfer statistics
        transferCount[from]++;
        transferCount[to]++;
        totalTransferred[from] += amount;
        totalTransferred[to] += amount;
        lastTransferTime[from] = block.timestamp;
        lastTransferTime[to] = block.timestamp;
        
        emit TransferExecuted(from, to, amount, block.timestamp);
        
        // Additional post-transfer logic can be added here
        _performPostTransferActions(from, to, amount);
    }
    
    // ============ Internal Functions ============
    
    function _performComplianceChecks(address from, address to, uint256 amount) internal view {
        // Add custom compliance logic here
        // For example: KYC checks, AML checks, etc.
    }
    
    function _performPostTransferActions(address from, address to, uint256 amount) internal {
        // Add custom post-transfer logic here
        // For example: notifications, reporting, etc.
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Toggle hooks on/off
     */
    function toggleHooks() external onlyRole(HOOK_MANAGER_ROLE) {
        hooksEnabled = !hooksEnabled;
        emit HooksToggled(hooksEnabled);
    }
    
    /**
     * @notice Update whitelist status
     */
    function updateWhitelist(address account, bool whitelisted, bool isSender) 
        external 
        onlyRole(HOOK_MANAGER_ROLE) 
    {
        if (isSender) {
            whitelistedSenders[account] = whitelisted;
        } else {
            whitelistedReceivers[account] = whitelisted;
        }
        emit WhitelistUpdated(account, whitelisted, isSender);
    }
    
    /**
     * @notice Update blacklist status
     */
    function updateBlacklist(address account, bool blacklisted) 
        external 
        onlyRole(HOOK_MANAGER_ROLE) 
    {
        blacklistedAddresses[account] = blacklisted;
        emit BlacklistUpdated(account, blacklisted);
    }
    
    /**
     * @notice Update transfer limits
     */
    function updateLimits(uint256 _maxTransferAmount, uint256 _minTransferAmount) 
        external 
        onlyRole(HOOK_MANAGER_ROLE) 
    {
        maxTransferAmount = _maxTransferAmount;
        minTransferAmount = _minTransferAmount;
        emit LimitsUpdated(_maxTransferAmount, _minTransferAmount);
    }
    
    // ============ View Functions ============
    
    function getTransferStats(address account) external view returns (
        uint256 count,
        uint256 total,
        uint256 lastTime
    ) {
        return (
            transferCount[account],
            totalTransferred[account],
            lastTransferTime[account]
        );
    }
    
    function isWhitelistedSender(address account) external view returns (bool) {
        return whitelistedSenders[account];
    }
    
    function isWhitelistedReceiver(address account) external view returns (bool) {
        return whitelistedReceivers[account];
    }
    
    function isBlacklisted(address account) external view returns (bool) {
        return blacklistedAddresses[account];
    }
}
