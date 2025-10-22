// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../contracts/NEBA.sol";
import "../contracts/CircuitBreaker.sol";
import "../contracts/TransferHook.sol";

contract ForkCheck is Test {
    NEBA public nebaToken;
    CircuitBreaker public circuitBreaker;
    TransferHook public transferHook;
    
    address public admin;
    address public treasury;
    address public botPauser;
    address public user1;
    address public user2;
    
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;
    uint256 public constant COMMIT_TIMEOUT = 3600;
    uint256 public constant CIRCUIT_BREAKER_RESET_INTERVAL = 86400;
    
    // Base Sepolia fork
    uint256 public constant BASE_SEPOLIA_FORK_BLOCK = 10000000; // Update with recent block
    string public constant BASE_SEPOLIA_RPC = "https://sepolia.base.org";
    
    function setUp() public {
        // Fork Base Sepolia at a recent block
        vm.createFork(BASE_SEPOLIA_RPC, BASE_SEPOLIA_FORK_BLOCK);
        
        // Set up test addresses
        admin = address(0x1);
        treasury = address(0x2);
        botPauser = address(0x3);
        user1 = address(0x4);
        user2 = address(0x5);
        
        // Fund test addresses
        vm.deal(admin, 100 ether);
        vm.deal(treasury, 100 ether);
        vm.deal(botPauser, 100 ether);
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        
        // Deploy contracts
        vm.startPrank(admin);
        
        // Deploy implementation
        NEBA implementation = new NEBA();
        
        // Deploy proxy
        nebaToken = NEBA(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeWithSelector(
                        NEBA.initialize.selector,
                        treasury,
                        admin,
                        COMMIT_TIMEOUT,
                        CIRCUIT_BREAKER_RESET_INTERVAL
                    )
                )
            )
        );
        
        // Deploy supporting contracts
        circuitBreaker = new CircuitBreaker();
        transferHook = new TransferHook();
        
        vm.stopPrank();
    }
    
    function testAdminFlows() public {
        vm.startPrank(admin);
        
        // Test admin can enable trading
        nebaToken.enableTrading();
        assertTrue(nebaToken.tradingEnabled());
        
        // Test admin can pause
        nebaToken.pause();
        assertTrue(nebaToken.paused());
        
        // Test admin can unpause
        nebaToken.unpause();
        assertFalse(nebaToken.paused());
        
        // Test admin can create snapshots
        uint256 snapshotId = nebaToken.createSnapshot();
        assertEq(snapshotId, 1);
        
        // Test admin can update parameters
        nebaToken.updateCommitTimeout(7200);
        assertEq(nebaToken.commitTimeout(), 7200);
        
        vm.stopPrank();
    }
    
    function testPauseUnpauseFlows() public {
        // Test admin pause/unpause
        vm.startPrank(admin);
        
        nebaToken.pause();
        assertTrue(nebaToken.paused());
        
        nebaToken.unpause();
        assertFalse(nebaToken.paused());
        
        vm.stopPrank();
        
        // Grant bot pauser role
        vm.prank(admin);
        nebaToken.grantRole(nebaToken.BOT_PAUSER_ROLE(), botPauser);
        
        // Test bot pauser can pause
        vm.startPrank(botPauser);
        
        nebaToken.pause();
        assertTrue(nebaToken.paused());
        
        // Bot pauser cannot unpause
        vm.expectRevert("Caller must have unpauser role");
        nebaToken.unpause();
        
        vm.stopPrank();
        
        // Admin can unpause
        vm.prank(admin);
        nebaToken.unpause();
        assertFalse(nebaToken.paused());
    }
    
    function testRoleManagement() public {
        vm.startPrank(admin);
        
        // Grant bot pauser role
        nebaToken.grantRole(nebaToken.BOT_PAUSER_ROLE(), botPauser);
        assertTrue(nebaToken.hasRole(nebaToken.BOT_PAUSER_ROLE(), botPauser));
        
        // Grant blocklist manager role
        nebaToken.grantRole(nebaToken.BLOCKLIST_MANAGER_ROLE(), user1);
        assertTrue(nebaToken.hasRole(nebaToken.BLOCKLIST_MANAGER_ROLE(), user1));
        
        // Revoke role
        nebaToken.revokeRole(nebaToken.BOT_PAUSER_ROLE(), botPauser);
        assertFalse(nebaToken.hasRole(nebaToken.BOT_PAUSER_ROLE(), botPauser));
        
        vm.stopPrank();
    }
    
    function testTransferRestrictions() public {
        vm.startPrank(admin);
        
        // Enable trading
        nebaToken.enableTrading();
        
        // Transfer some tokens for testing
        nebaToken.transfer(user1, 1000 ether);
        
        vm.stopPrank();
        
        // Test normal transfer
        vm.prank(user1);
        nebaToken.transfer(user2, 100 ether);
        assertEq(nebaToken.balanceOf(user2), 100 ether);
        
        // Test blocklist
        vm.prank(admin);
        nebaToken.updateBlocklist(user1, true);
        
        vm.expectRevert();
        vm.prank(user1);
        nebaToken.transfer(user2, 100 ether);
        
        // Test whitelist
        vm.prank(admin);
        nebaToken.toggleTransferRestrictions();
        
        vm.expectRevert();
        vm.prank(user1);
        nebaToken.transfer(user2, 100 ether);
        
        // Whitelist user1 and user2
        vm.prank(admin);
        nebaToken.updateWhitelist(user1, true);
        
        vm.prank(admin);
        nebaToken.updateWhitelist(user2, true);
        
        // Transfer should work now
        vm.prank(user1);
        nebaToken.transfer(user2, 100 ether);
    }
    
    function testSnapshotFunctionality() public {
        vm.startPrank(admin);
        
        // Create multiple snapshots
        uint256 snapshot1 = nebaToken.createSnapshot();
        assertEq(snapshot1, 1);
        
        uint256 snapshot2 = nebaToken.createSnapshot();
        assertEq(snapshot2, 2);
        
        // Verify snapshot data
        (uint256 id, uint256 timestamp, uint256 totalSupply, bool active) = nebaToken.getSnapshot(1);
        assertEq(id, 1);
        assertGt(timestamp, 0);
        assertEq(totalSupply, MAX_SUPPLY);
        assertTrue(active);
        
        // Verify latest snapshot ID
        assertEq(nebaToken.getLatestSnapshotId(), 2);
        
        // Verify snapshot exists
        assertTrue(nebaToken.snapshotExists(1));
        assertTrue(nebaToken.snapshotExists(2));
        assertFalse(nebaToken.snapshotExists(3));
        
        vm.stopPrank();
    }
    
    function testCircuitBreaker() public {
        vm.startPrank(admin);
        
        // Trigger circuit breaker
        nebaToken.triggerCircuitBreaker("Test reason");
        assertTrue(nebaToken.circuitBreakerTriggered());
        
        // Transfers should be blocked
        vm.expectRevert();
        nebaToken.transfer(user1, 100 ether);
        
        // Reset circuit breaker
        nebaToken.resetCircuitBreaker();
        assertFalse(nebaToken.circuitBreakerTriggered());
        
        // Transfers should work again
        nebaToken.transfer(user1, 100 ether);
        assertEq(nebaToken.balanceOf(user1), 100 ether);
        
        vm.stopPrank();
    }
    
    function testParameterUpdates() public {
        vm.startPrank(admin);
        
        // Update commit timeout
        nebaToken.updateCommitTimeout(7200);
        assertEq(nebaToken.commitTimeout(), 7200);
        
        // Update circuit breaker reset interval
        nebaToken.updateCircuitBreakerResetInterval(172800); // 2 days
        assertEq(nebaToken.circuitBreakerResetInterval(), 172800);
        
        vm.stopPrank();
    }
    
    function testSupplyInvariant() public {
        uint256 initialSupply = nebaToken.totalSupply();
        assertEq(initialSupply, MAX_SUPPLY);
        
        vm.startPrank(admin);
        nebaToken.enableTrading();
        
        // Transfer tokens
        nebaToken.transfer(user1, 1000 ether);
        nebaToken.transfer(user2, 2000 ether);
        
        uint256 finalSupply = nebaToken.totalSupply();
        assertEq(finalSupply, initialSupply); // Supply should not change
        
        // Verify balance conservation
        uint256 treasuryBalance = nebaToken.balanceOf(treasury);
        uint256 user1Balance = nebaToken.balanceOf(user1);
        uint256 user2Balance = nebaToken.balanceOf(user2);
        
        assertEq(treasuryBalance + user1Balance + user2Balance, MAX_SUPPLY);
        
        vm.stopPrank();
    }
    
    function testEventEmission() public {
        vm.startPrank(admin);
        
        // Test pause event
        vm.expectEmit(true, true, true, true);
        emit ContractPaused(admin);
        nebaToken.pause();
        
        // Test unpause event
        vm.expectEmit(true, true, true, true);
        emit ContractUnpaused(admin);
        nebaToken.unpause();
        
        // Test blocklist update event
        vm.expectEmit(true, true, true, true);
        emit BlocklistUpdated(user1, true);
        nebaToken.updateBlocklist(user1, true);
        
        // Test snapshot creation event
        vm.expectEmit(true, true, true, true);
        emit SnapshotCreated(1, block.timestamp, MAX_SUPPLY);
        nebaToken.createSnapshot();
        
        vm.stopPrank();
    }
    
    function testNetworkAssumptions() public {
        // Test that we're on Base Sepolia
        assertEq(block.chainid, 84532);
        
        // Test that gas prices are reasonable
        assertLt(tx.gasprice, 1 gwei * 100); // Less than 100 gwei
        
        // Test that block timestamp is recent
        assertGt(block.timestamp, 1700000000); // After 2023
        
        console.log("Chain ID:", block.chainid);
        console.log("Gas Price:", tx.gasprice);
        console.log("Block Timestamp:", block.timestamp);
        console.log("Block Number:", block.number);
    }
    
    // Helper function to get recent block for forking
    function getRecentBlock() public view returns (uint256) {
        // This would typically be called with a script to get the latest block
        // For now, return a reasonable recent block number
        return 10000000;
    }
}
