const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Invariant Tests - NEBA Token", function () {
  let nebaToken;
  let owner;
  let treasury;
  let admin;
  let user1;
  let user2;

  const MAX_SUPPLY = ethers.parseEther("1000000000");
  const COMMIT_TIMEOUT = 3600;
  const CIRCUIT_BREAKER_RESET_INTERVAL = 86400;

  beforeEach(async function () {
    [owner, treasury, admin, user1, user2] = await ethers.getSigners();

    const NEBA = await ethers.getContractFactory("NEBA");
    nebaToken = await upgrades.deployProxy(
      NEBA,
      [treasury.address, admin.address, COMMIT_TIMEOUT, CIRCUIT_BREAKER_RESET_INTERVAL],
      { initializer: "initialize", kind: "uups" }
    );

    await nebaToken.waitForDeployment();
    await nebaToken.connect(admin).enableTrading();
  });

  describe("Supply Cap Invariant", function () {
    it("Should never exceed maximum supply", async function () {
      const totalSupply = await nebaToken.totalSupply();
      expect(totalSupply).to.be.at.most(MAX_SUPPLY);
      
      // Verify total supply equals sum of all balances
      const treasuryBalance = await nebaToken.balanceOf(treasury.address);
      expect(treasuryBalance).to.equal(totalSupply);
    });

    it("Should maintain supply conservation across transfers", async function () {
      const initialTotalSupply = await nebaToken.totalSupply();
      
      // Transfer some tokens
      await nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("1000"));
      
      const finalTotalSupply = await nebaToken.totalSupply();
      expect(finalTotalSupply).to.equal(initialTotalSupply);
      
      // Verify sum of balances equals total supply
      const treasuryBalance = await nebaToken.balanceOf(treasury.address);
      const user1Balance = await nebaToken.balanceOf(user1.address);
      const sumOfBalances = treasuryBalance + user1Balance;
      
      expect(sumOfBalances).to.equal(finalTotalSupply);
    });

    it("Should never mint new tokens", async function () {
      const initialTotalSupply = await nebaToken.totalSupply();
      
      // Perform various operations
      await nebaToken.connect(admin).enableTrading();
      await nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("1000"));
      await nebaToken.connect(user1).approve(user2.address, ethers.parseEther("100"));
      await nebaToken.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("100"));
      
      const finalTotalSupply = await nebaToken.totalSupply();
      expect(finalTotalSupply).to.equal(initialTotalSupply);
    });
  });

  describe("Pause State Invariant", function () {
    it("Should prevent all mutative calls when paused", async function () {
      // Pause the contract
      await nebaToken.connect(admin).pause();
      expect(await nebaToken.paused()).to.be.true;

      // All mutative calls should revert
      await expect(
        nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(nebaToken, "EnforcedPause");

      await expect(
        nebaToken.connect(user1).approve(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(nebaToken, "EnforcedPause");

      await expect(
        nebaToken.connect(user1).transferFrom(treasury.address, user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(nebaToken, "EnforcedPause");
    });

    it("Should allow read-only calls when paused", async function () {
      // Pause the contract
      await nebaToken.connect(admin).pause();
      
      // Read-only calls should still work
      expect(await nebaToken.totalSupply()).to.equal(MAX_SUPPLY);
      expect(await nebaToken.balanceOf(treasury.address)).to.equal(MAX_SUPPLY);
      expect(await nebaToken.name()).to.equal("NEBA Token");
      expect(await nebaToken.symbol()).to.equal("$NEBA");
      expect(await nebaToken.decimals()).to.equal(18);
    });

    it("Should maintain pause state consistency", async function () {
      // Test multiple pause/unpause cycles
      for (let i = 0; i < 5; i++) {
        // Pause
        await nebaToken.connect(admin).pause();
        expect(await nebaToken.paused()).to.be.true;
        
        // Verify mutative calls are blocked
        await expect(
          nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("100"))
        ).to.be.revertedWithCustomError(nebaToken, "EnforcedPause");
        
        // Unpause
        await nebaToken.connect(admin).unpause();
        expect(await nebaToken.paused()).to.be.false;
        
        // Verify mutative calls work again
        await expect(
          nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("100"))
        ).to.not.be.reverted;
      }
    });
  });

  describe("Role Permission Invariant", function () {
    it("Should prevent role escalation", async function () {
      // user1 should not be able to grant themselves admin role
      const DEFAULT_ADMIN_ROLE = await nebaToken.DEFAULT_ADMIN_ROLE();
      
      await expect(
        nebaToken.connect(user1).grantRole(DEFAULT_ADMIN_ROLE, user1.address)
      ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");

      // user1 should not be able to grant themselves upgrader role
      const UPGRADER_ROLE = await nebaToken.UPGRADER_ROLE();
      
      await expect(
        nebaToken.connect(user1).grantRole(UPGRADER_ROLE, user1.address)
      ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
    });

    it("Should maintain role hierarchy", async function () {
      // Only admin should be able to grant roles
      const BOT_PAUSER_ROLE = await nebaToken.BOT_PAUSER_ROLE();
      
      // user1 cannot grant roles
      await expect(
        nebaToken.connect(user1).grantRole(BOT_PAUSER_ROLE, user2.address)
      ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
      
      // Admin can grant roles
      await expect(
        nebaToken.connect(admin).grantRole(BOT_PAUSER_ROLE, user1.address)
      ).to.not.be.reverted;
      
      // Verify role was granted
      expect(await nebaToken.hasRole(BOT_PAUSER_ROLE, user1.address)).to.be.true;
    });

    it("Should prevent unauthorized role revocation", async function () {
      // Grant a role to user1
      const BOT_PAUSER_ROLE = await nebaToken.BOT_PAUSER_ROLE();
      await nebaToken.connect(admin).grantRole(BOT_PAUSER_ROLE, user1.address);
      
      // user1 should not be able to revoke their own role
      await expect(
        nebaToken.connect(user1).revokeRole(BOT_PAUSER_ROLE, user1.address)
      ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
      
      // user2 should not be able to revoke user1's role
      await expect(
        nebaToken.connect(user2).revokeRole(BOT_PAUSER_ROLE, user1.address)
      ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
      
      // Only admin can revoke roles
      await expect(
        nebaToken.connect(admin).revokeRole(BOT_PAUSER_ROLE, user1.address)
      ).to.not.be.reverted;
    });
  });

  describe("Transfer Restriction Invariant", function () {
    it("Should maintain transfer restriction consistency", async function () {
      // Enable transfer restrictions
      await nebaToken.connect(admin).toggleTransferRestrictions();
      expect(await nebaToken.transferRestrictionsEnabled()).to.be.true;
      
      // Treasury should always be able to transfer
      expect(await nebaToken.isTransferAllowed(treasury.address, user1.address)).to.be.true;
      
      // Non-whitelisted users should not be able to transfer
      expect(await nebaToken.isTransferAllowed(user1.address, user2.address)).to.be.false;
      
      // After whitelisting, transfers should be allowed
      await nebaToken.connect(admin).updateWhitelist(user1.address, true);
      await nebaToken.connect(admin).updateWhitelist(user2.address, true);
      
      expect(await nebaToken.isTransferAllowed(user1.address, user2.address)).to.be.true;
    });

    it("Should prevent blocked address transfers", async function () {
      // Transfer some tokens first
      await nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("1000"));
      
      // Block user1
      await nebaToken.connect(admin).updateBlocklist(user1.address, true);
      
      // user1 should not be able to transfer
      await expect(
        nebaToken.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(nebaToken, "BlockedAddress");
      
      // Others should not be able to transfer to user1
      await expect(
        nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(nebaToken, "BlockedAddress");
    });
  });

  describe("Circuit Breaker Invariant", function () {
    it("Should prevent transfers when circuit breaker is active", async function () {
      // Trigger circuit breaker
      await nebaToken.connect(admin).triggerCircuitBreaker("Test reason");
      expect(await nebaToken.circuitBreakerTriggered()).to.be.true;
      
      // Transfers should be blocked
      await expect(
        nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(nebaToken, "CircuitBreakerActive");
      
      // Reset circuit breaker
      await nebaToken.connect(admin).resetCircuitBreaker();
      expect(await nebaToken.circuitBreakerTriggered()).to.be.false;
      
      // Transfers should work again
      await expect(
        nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("100"))
      ).to.not.be.reverted;
    });

    it("Should maintain circuit breaker state consistency", async function () {
      // Initial state should be not triggered
      expect(await nebaToken.circuitBreakerTriggered()).to.be.false;
      
      // Trigger and verify
      await nebaToken.connect(admin).triggerCircuitBreaker("Test reason");
      expect(await nebaToken.circuitBreakerTriggered()).to.be.true;
      
      // Reset and verify
      await nebaToken.connect(admin).resetCircuitBreaker();
      expect(await nebaToken.circuitBreakerTriggered()).to.be.false;
    });
  });

  describe("Snapshot Invariant", function () {
    it("Should maintain snapshot data consistency", async function () {
      // Create multiple snapshots
      for (let i = 1; i <= 5; i++) {
        const tx = await nebaToken.connect(admin).createSnapshot();
        await tx.wait();
        
        // Verify snapshot data
        const snapshot = await nebaToken.getSnapshot(i);
        expect(snapshot.id).to.equal(i);
        expect(snapshot.timestamp).to.be.greaterThan(0);
        expect(snapshot.totalSupply).to.equal(MAX_SUPPLY);
        expect(snapshot.active).to.be.true;
      }
      
      // Verify latest snapshot ID
      expect(await nebaToken.getLatestSnapshotId()).to.equal(5);
    });

    it("Should prevent access to non-existent snapshots", async function () {
      // Try to access non-existent snapshot
      await expect(
        nebaToken.getSnapshot(999)
      ).to.be.revertedWithCustomError(nebaToken, "SnapshotNotFound");
      
      // Check existence
      expect(await nebaToken.snapshotExists(999)).to.be.false;
    });
  });

  describe("Parameter Invariant", function () {
    it("Should maintain parameter bounds", async function () {
      // Commit timeout should be reasonable (1 hour to 7 days)
      const commitTimeout = await nebaToken.commitTimeout();
      expect(commitTimeout).to.be.at.least(3600); // 1 hour
      expect(commitTimeout).to.be.at.most(604800); // 7 days
      
      // Circuit breaker reset interval should be reasonable
      const resetInterval = await nebaToken.circuitBreakerResetInterval();
      expect(resetInterval).to.be.at.least(3600); // 1 hour
      expect(resetInterval).to.be.at.most(604800); // 7 days
    });

    it("Should maintain treasury address consistency", async function () {
      const treasuryAddress = await nebaToken.treasury();
      expect(treasuryAddress).to.equal(treasury.address);
      
      // Treasury should have all tokens initially
      const treasuryBalance = await nebaToken.balanceOf(treasury.address);
      expect(treasuryBalance).to.equal(MAX_SUPPLY);
    });
  });

  describe("Event Emission Invariant", function () {
    it("Should emit events for all state changes", async function () {
      // Test pause event
      await expect(nebaToken.connect(admin).pause())
        .to.emit(nebaToken, "ContractPaused");
      
      // Test unpause event
      await expect(nebaToken.connect(admin).unpause())
        .to.emit(nebaToken, "ContractUnpaused");
      
      // Test blocklist update event
      await expect(nebaToken.connect(admin).updateBlocklist(user1.address, true))
        .to.emit(nebaToken, "BlocklistUpdated")
        .withArgs(user1.address, true);
      
      // Test whitelist update event
      await expect(nebaToken.connect(admin).updateWhitelist(user1.address, true))
        .to.emit(nebaToken, "WhitelistUpdated")
        .withArgs(user1.address, true);
      
      // Test snapshot creation event
      await expect(nebaToken.connect(admin).createSnapshot())
        .to.emit(nebaToken, "SnapshotCreated");
    });
  });

  describe("Gas Optimization Invariant", function () {
    it("Should maintain gas efficiency across operations", async function () {
      // Test that operations don't consume excessive gas
      const transferTx = await nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("100"));
      const transferReceipt = await transferTx.wait();
      
      // Transfer should not consume more than 100k gas
      expect(transferReceipt.gasUsed).to.be.at.most(100000);
      
      const approveTx = await nebaToken.connect(user1).approve(user2.address, ethers.parseEther("100"));
      const approveReceipt = await approveTx.wait();
      
      // Approval should not consume more than 50k gas
      expect(approveReceipt.gasUsed).to.be.at.most(50000);
    });
  });
});
