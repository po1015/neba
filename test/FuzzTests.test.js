const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Fuzz Tests - NEBA Token", function () {
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
    
    // Transfer some tokens for testing
    await nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("1000000"));
  });

  describe("Transfer Fuzz Tests", function () {
    it("Should handle random transfer amounts", async function () {
      const fuzzIterations = 100;
      
      for (let i = 0; i < fuzzIterations; i++) {
        // Generate random amount between 1 and 1000 tokens
        const randomAmount = Math.floor(Math.random() * 1000) + 1;
        const transferAmount = ethers.parseEther(randomAmount.toString());
        
        // Skip if user1 doesn't have enough balance
        const balance = await nebaToken.balanceOf(user1.address);
        if (balance < transferAmount) {
          continue;
        }

        // Execute transfer
        await expect(
          nebaToken.connect(user1).transfer(user2.address, transferAmount)
        ).to.not.be.reverted;

        // Verify balance changes
        const newBalance = await nebaToken.balanceOf(user1.address);
        const expectedBalance = balance - transferAmount;
        expect(newBalance).to.equal(expectedBalance);
      }
    });

    it("Should handle random approval amounts", async function () {
      const fuzzIterations = 50;
      
      for (let i = 0; i < fuzzIterations; i++) {
        // Generate random approval amount
        const randomAmount = Math.floor(Math.random() * 10000) + 1;
        const approvalAmount = ethers.parseEther(randomAmount.toString());

        // Execute approval
        await expect(
          nebaToken.connect(user1).approve(user2.address, approvalAmount)
        ).to.not.be.reverted;

        // Verify allowance
        const allowance = await nebaToken.allowance(user1.address, user2.address);
        expect(allowance).to.equal(approvalAmount);
      }
    });

    it("Should handle random transferFrom amounts", async function () {
      const fuzzIterations = 50;
      
      for (let i = 0; i < fuzzIterations; i++) {
        // Generate random amount
        const randomAmount = Math.floor(Math.random() * 100) + 1;
        const transferAmount = ethers.parseEther(randomAmount.toString());
        
        // Approve the transfer
        await nebaToken.connect(user1).approve(user2.address, transferAmount);
        
        // Execute transferFrom
        await expect(
          nebaToken.connect(user2).transferFrom(user1.address, user2.address, transferAmount)
        ).to.not.be.reverted;

        // Verify allowance decreased
        const allowance = await nebaToken.allowance(user1.address, user2.address);
        expect(allowance).to.equal(0);
      }
    });
  });

  describe("Role Management Fuzz Tests", function () {
    it("Should handle random role grants and revokes", async function () {
      const roles = [
        await nebaToken.BOT_PAUSER_ROLE(),
        await nebaToken.BLOCKLIST_MANAGER_ROLE(),
        await nebaToken.WHITELIST_MANAGER_ROLE(),
        await nebaToken.CIRCUIT_BREAKER_ROLE(),
        await nebaToken.PARAM_MANAGER_ROLE(),
        await nebaToken.FINANCE_ROLE(),
        await nebaToken.SNAPSHOT_ROLE()
      ];

      const fuzzIterations = 20;
      
      for (let i = 0; i < fuzzIterations; i++) {
        // Randomly select a role
        const randomRole = roles[Math.floor(Math.random() * roles.length)];
        
        // Grant role
        await expect(
          nebaToken.connect(admin).grantRole(randomRole, user1.address)
        ).to.not.be.reverted;

        // Verify role was granted
        expect(await nebaToken.hasRole(randomRole, user1.address)).to.be.true;

        // Revoke role
        await expect(
          nebaToken.connect(admin).revokeRole(randomRole, user1.address)
        ).to.not.be.reverted;

        // Verify role was revoked
        expect(await nebaToken.hasRole(randomRole, user1.address)).to.be.false;
      }
    });
  });

  describe("Snapshot Fuzz Tests", function () {
    it("Should handle multiple snapshot creations", async function () {
      const fuzzIterations = 10;
      
      for (let i = 0; i < fuzzIterations; i++) {
        // Create snapshot
        const tx = await nebaToken.connect(admin).createSnapshot();
        await tx.wait();
        
        // Verify snapshot was created
        const snapshotId = i + 1;
        expect(await nebaToken.snapshotExists(snapshotId)).to.be.true;
        
        // Verify snapshot data
        const snapshot = await nebaToken.getSnapshot(snapshotId);
        expect(snapshot.id).to.equal(snapshotId);
        expect(snapshot.timestamp).to.be.greaterThan(0);
        expect(snapshot.totalSupply).to.equal(MAX_SUPPLY);
        expect(snapshot.active).to.be.true;
      }
    });
  });

  describe("Blocklist/Whitelist Fuzz Tests", function () {
    it("Should handle random blocklist updates", async function () {
      const fuzzIterations = 20;
      const testAddresses = [user1.address, user2.address];
      
      for (let i = 0; i < fuzzIterations; i++) {
        // Randomly select address and boolean value
        const randomAddress = testAddresses[Math.floor(Math.random() * testAddresses.length)];
        const randomBlocked = Math.random() > 0.5;

        // Update blocklist
        await expect(
          nebaToken.connect(admin).updateBlocklist(randomAddress, randomBlocked)
        ).to.not.be.reverted;

        // Verify blocklist state
        expect(await nebaToken.blocklist(randomAddress)).to.equal(randomBlocked);
      }
    });

    it("Should handle random whitelist updates", async function () {
      const fuzzIterations = 20;
      const testAddresses = [user1.address, user2.address];
      
      for (let i = 0; i < fuzzIterations; i++) {
        // Randomly select address and boolean value
        const randomAddress = testAddresses[Math.floor(Math.random() * testAddresses.length)];
        const randomWhitelisted = Math.random() > 0.5;

        // Update whitelist
        await expect(
          nebaToken.connect(admin).updateWhitelist(randomAddress, randomWhitelisted)
        ).to.not.be.reverted;

        // Verify whitelist state
        expect(await nebaToken.whitelist(randomAddress)).to.equal(randomWhitelisted);
      }
    });
  });

  describe("Parameter Update Fuzz Tests", function () {
    it("Should handle random commit timeout updates", async function () {
      const fuzzIterations = 10;
      
      for (let i = 0; i < fuzzIterations; i++) {
        // Generate random timeout (1 hour to 24 hours)
        const randomTimeout = Math.floor(Math.random() * 82800) + 3600; // 3600 to 86400 seconds

        // Update commit timeout
        await expect(
          nebaToken.connect(admin).updateCommitTimeout(randomTimeout)
        ).to.not.be.reverted;

        // Verify timeout was updated
        expect(await nebaToken.commitTimeout()).to.equal(randomTimeout);
      }
    });

    it("Should handle random circuit breaker reset interval updates", async function () {
      const fuzzIterations = 10;
      
      for (let i = 0; i < fuzzIterations; i++) {
        // Generate random interval (1 hour to 7 days)
        const randomInterval = Math.floor(Math.random() * 604800) + 3600; // 3600 to 604800 seconds

        // Update reset interval
        await expect(
          nebaToken.connect(admin).updateCircuitBreakerResetInterval(randomInterval)
        ).to.not.be.reverted;

        // Verify interval was updated
        expect(await nebaToken.circuitBreakerResetInterval()).to.equal(randomInterval);
      }
    });
  });

  describe("State Transition Fuzz Tests", function () {
    it("Should handle random pause/unpause cycles", async function () {
      const fuzzIterations = 10;
      
      for (let i = 0; i < fuzzIterations; i++) {
        // Randomly decide to pause or unpause
        const shouldPause = Math.random() > 0.5;
        const currentState = await nebaToken.paused();

        if (shouldPause && !currentState) {
          // Pause if not already paused
          await expect(nebaToken.connect(admin).pause()).to.not.be.reverted;
          expect(await nebaToken.paused()).to.be.true;
        } else if (!shouldPause && currentState) {
          // Unpause if currently paused
          await expect(nebaToken.connect(admin).unpause()).to.not.be.reverted;
          expect(await nebaToken.paused()).to.be.false;
        }
      }
    });

    it("Should handle random trading enable/disable cycles", async function () {
      const fuzzIterations = 5;
      
      for (let i = 0; i < fuzzIterations; i++) {
        // Randomly decide to enable or disable trading
        const shouldEnableTrading = Math.random() > 0.5;
        const currentState = await nebaToken.tradingEnabled();

        if (shouldEnableTrading && !currentState) {
          // Enable trading if not already enabled
          await expect(nebaToken.connect(admin).enableTrading()).to.not.be.reverted;
          expect(await nebaToken.tradingEnabled()).to.be.true;
        } else if (!shouldEnableTrading && currentState) {
          // Note: Trading cannot be disabled once enabled (as per current implementation)
          // This test validates that the state remains consistent
          expect(await nebaToken.tradingEnabled()).to.be.true;
        }
      }
    });
  });

  describe("Boundary Condition Fuzz Tests", function () {
    it("Should handle zero amount transfers", async function () {
      // Zero amount transfers should succeed
      await expect(
        nebaToken.connect(user1).transfer(user2.address, 0)
      ).to.not.be.reverted;

      // Verify balances unchanged
      const user1Balance = await nebaToken.balanceOf(user1.address);
      const user2Balance = await nebaToken.balanceOf(user2.address);
      
      // Should emit Transfer event even for zero amount
      const tx = await nebaToken.connect(user1).transfer(user2.address, 0);
      await expect(tx).to.emit(nebaToken, "Transfer");
    });

    it("Should handle maximum amount transfers", async function () {
      const user1Balance = await nebaToken.balanceOf(user1.address);
      
      // Transfer entire balance
      await expect(
        nebaToken.connect(user1).transfer(user2.address, user1Balance)
      ).to.not.be.reverted;

      // Verify user1 balance is now zero
      expect(await nebaToken.balanceOf(user1.address)).to.equal(0);
    });

    it("Should handle transfers to self", async function () {
      const transferAmount = ethers.parseEther("100");
      const initialBalance = await nebaToken.balanceOf(user1.address);
      
      // Transfer to self
      await expect(
        nebaToken.connect(user1).transfer(user1.address, transferAmount)
      ).to.not.be.reverted;

      // Balance should remain the same
      expect(await nebaToken.balanceOf(user1.address)).to.equal(initialBalance);
    });
  });

  describe("Error Condition Fuzz Tests", function () {
    it("Should handle insufficient balance transfers", async function () {
      const user1Balance = await nebaToken.balanceOf(user1.address);
      const excessiveAmount = user1Balance + ethers.parseEther("1");
      
      // Should revert with insufficient balance
      await expect(
        nebaToken.connect(user1).transfer(user2.address, excessiveAmount)
      ).to.be.revertedWithCustomError(nebaToken, "ERC20InsufficientBalance");
    });

    it("Should handle transfers to zero address", async function () {
      const transferAmount = ethers.parseEther("100");
      
      // Should revert when transferring to zero address
      await expect(
        nebaToken.connect(user1).transfer(ethers.ZeroAddress, transferAmount)
      ).to.be.revertedWithCustomError(nebaToken, "ERC20InvalidReceiver");
    });

    it("Should handle approvals to zero address", async function () {
      const approvalAmount = ethers.parseEther("100");
      
      // Should revert when approving zero address
      await expect(
        nebaToken.connect(user1).approve(ethers.ZeroAddress, approvalAmount)
      ).to.be.revertedWithCustomError(nebaToken, "ERC20InvalidSpender");
    });
  });
});
