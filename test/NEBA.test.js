const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("NEBA Token", function () {
  let nebaToken;
  let owner;
  let treasury;
  let user1;
  let user2;
  let admin;

  const MAX_SUPPLY = ethers.parseEther("1000000000"); // 1 billion tokens
  const COMMIT_TIMEOUT = 3600; // 1 hour
  const CIRCUIT_BREAKER_RESET_INTERVAL = 86400; // 24 hours

  beforeEach(async function () {
    [owner, treasury, admin, user1, user2] = await ethers.getSigners();

    // Deploy the NEBA token
    const NEBA = await ethers.getContractFactory("NEBA");
    nebaToken = await upgrades.deployProxy(
      NEBA,
      [treasury.address, admin.address, COMMIT_TIMEOUT, CIRCUIT_BREAKER_RESET_INTERVAL],
      {
        initializer: "initialize",
        kind: "uups"
      }
    );

    await nebaToken.waitForDeployment();
  });

  describe("Initialization", function () {
    it("Should initialize with correct parameters", async function () {
      expect(await nebaToken.name()).to.equal("NEBA Token");
      expect(await nebaToken.symbol()).to.equal("$NEBA");
      expect(await nebaToken.decimals()).to.equal(18);
      expect(await nebaToken.totalSupply()).to.equal(MAX_SUPPLY);
      expect(await nebaToken.treasury()).to.equal(treasury.address);
      expect(await nebaToken.balanceOf(treasury.address)).to.equal(MAX_SUPPLY);
    });

    it("Should set up roles correctly", async function () {
      const DEFAULT_ADMIN_ROLE = await nebaToken.DEFAULT_ADMIN_ROLE();
      const UPGRADER_ROLE = await nebaToken.UPGRADER_ROLE();
      const ADMIN_PAUSER_ROLE = await nebaToken.ADMIN_PAUSER_ROLE();
      const BLOCKLIST_MANAGER_ROLE = await nebaToken.BLOCKLIST_MANAGER_ROLE();
      const WHITELIST_MANAGER_ROLE = await nebaToken.WHITELIST_MANAGER_ROLE();
      const CIRCUIT_BREAKER_ROLE = await nebaToken.CIRCUIT_BREAKER_ROLE();
      const SNAPSHOT_ROLE = await nebaToken.SNAPSHOT_ROLE();

      expect(await nebaToken.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await nebaToken.hasRole(UPGRADER_ROLE, admin.address)).to.be.true;
      expect(await nebaToken.hasRole(ADMIN_PAUSER_ROLE, admin.address)).to.be.true;
      expect(await nebaToken.hasRole(BLOCKLIST_MANAGER_ROLE, admin.address)).to.be.true;
      expect(await nebaToken.hasRole(WHITELIST_MANAGER_ROLE, admin.address)).to.be.true;
      expect(await nebaToken.hasRole(CIRCUIT_BREAKER_ROLE, admin.address)).to.be.true;
      expect(await nebaToken.hasRole(SNAPSHOT_ROLE, admin.address)).to.be.true;
    });
  });

  describe("Transfer Functionality", function () {
    beforeEach(async function () {
      // Enable trading first
      await nebaToken.connect(admin).enableTrading();
      // Transfer some tokens from treasury to user1 for testing
      await nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("1000"));
    });

    it("Should allow normal transfers", async function () {
      const transferAmount = ethers.parseEther("100");
      
      await expect(nebaToken.connect(user1).transfer(user2.address, transferAmount))
        .to.emit(nebaToken, "Transfer")
        .withArgs(user1.address, user2.address, transferAmount);

      expect(await nebaToken.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("Should not allow transfers from blocked addresses", async function () {
      // Block user1
      await nebaToken.connect(admin).updateBlocklist(user1.address, true);

      await expect(
        nebaToken.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(nebaToken, "BlockedAddress");
    });

    it("Should not allow transfers to blocked addresses", async function () {
      // Block user2
      await nebaToken.connect(admin).updateBlocklist(user2.address, true);

      await expect(
        nebaToken.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(nebaToken, "BlockedAddress");
    });
  });

  describe("Transfer Restrictions", function () {
    beforeEach(async function () {
      // Enable trading first for these tests
      await nebaToken.connect(admin).enableTrading();
    });

    it("Should check transfer restrictions correctly", async function () {
      // No restrictions initially
      expect(await nebaToken.isTransferAllowed(
        treasury.address, 
        user1.address
      )).to.be.true;

      // Block an address
      await nebaToken.connect(admin).updateBlocklist(user1.address, true);
      
      expect(await nebaToken.isTransferAllowed(
        treasury.address, 
        user1.address
      )).to.be.false;
    });

    it("Should handle whitelist restrictions", async function () {
      // Enable transfer restrictions
      await nebaToken.connect(admin).toggleTransferRestrictions();
      
      // Check that transfer restrictions are enabled
      expect(await nebaToken.transferRestrictionsEnabled()).to.be.true;
      
      // Treasury should still be allowed (treasury is always whitelisted)
      expect(await nebaToken.isTransferAllowed(
        treasury.address, 
        user1.address
      )).to.be.true;

      // Regular user should not be allowed when restrictions are enabled
      expect(await nebaToken.isTransferAllowed(
        user1.address, 
        user2.address
      )).to.be.false;

      // After whitelisting both addresses, transfers should be allowed
      await nebaToken.connect(admin).updateWhitelist(user1.address, true);
      await nebaToken.connect(admin).updateWhitelist(user2.address, true);
      
      // Verify both are whitelisted
      expect(await nebaToken.whitelist(user1.address)).to.be.true;
      expect(await nebaToken.whitelist(user2.address)).to.be.true;
      
      expect(await nebaToken.isTransferAllowed(
        user1.address, 
        user2.address
      )).to.be.true;
    });
  });

  describe("Pausable Functionality", function () {
    it("Should allow admin to pause and unpause", async function () {
      await expect(nebaToken.connect(admin).pause())
        .to.emit(nebaToken, "ContractPaused");

      expect(await nebaToken.paused()).to.be.true;

      await expect(nebaToken.connect(admin).unpause())
        .to.emit(nebaToken, "ContractUnpaused");

      expect(await nebaToken.paused()).to.be.false;
    });

    it("Should prevent transfers when paused", async function () {
      await nebaToken.connect(admin).pause();

      await expect(
        nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(nebaToken, "EnforcedPause");
    });
  });

  describe("Circuit Breaker", function () {
    it("Should allow admin to trigger circuit breaker", async function () {
      await expect(nebaToken.connect(admin).triggerCircuitBreaker("Test reason"))
        .to.emit(nebaToken, "CircuitBreakerTriggered");

      expect(await nebaToken.circuitBreakerTriggered()).to.be.true;
    });

    it("Should prevent transfers when circuit breaker is active", async function () {
      await nebaToken.connect(admin).triggerCircuitBreaker("Test reason");

      await expect(
        nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(nebaToken, "CircuitBreakerActive");
    });

    it("Should allow admin to reset circuit breaker", async function () {
      await nebaToken.connect(admin).triggerCircuitBreaker("Test reason");
      expect(await nebaToken.circuitBreakerTriggered()).to.be.true;

      await expect(nebaToken.connect(admin).resetCircuitBreaker())
        .to.emit(nebaToken, "CircuitBreakerReset");

      expect(await nebaToken.circuitBreakerTriggered()).to.be.false;
    });
  });

  describe("Upgrade Functionality", function () {
    it("Should allow authorized upgrade", async function () {
      // This test would require a new implementation contract
      // For now, we just verify the role is set correctly
      const UPGRADER_ROLE = await nebaToken.UPGRADER_ROLE();
      expect(await nebaToken.hasRole(UPGRADER_ROLE, admin.address)).to.be.true;
    });
  });

  describe("Role Management", function () {
    it("Should allow admin to grant bot pauser role", async function () {
      await expect(nebaToken.connect(admin).grantBotPauserRole(user1.address))
        .to.not.be.reverted;
      
      const BOT_PAUSER_ROLE = await nebaToken.BOT_PAUSER_ROLE();
      expect(await nebaToken.hasRole(BOT_PAUSER_ROLE, user1.address)).to.be.true;
    });

    it("Should allow admin to grant governance unpauser role", async function () {
      await expect(nebaToken.connect(admin).grantGovernanceUnpauserRole(user1.address))
        .to.not.be.reverted;
      
      const GOVERNANCE_UNPAUSER_ROLE = await nebaToken.GOVERNANCE_UNPAUSER_ROLE();
      expect(await nebaToken.hasRole(GOVERNANCE_UNPAUSER_ROLE, user1.address)).to.be.true;
    });

    it("Should allow admin to grant emergency guardian role", async function () {
      await expect(nebaToken.connect(admin).grantEmergencyGuardianRole(user1.address))
        .to.not.be.reverted;
      
      const EMERGENCY_GUARDIAN_ROLE = await nebaToken.EMERGENCY_GUARDIAN_ROLE();
      expect(await nebaToken.hasRole(EMERGENCY_GUARDIAN_ROLE, user1.address)).to.be.true;
    });

    it("Should prevent non-admin from granting roles", async function () {
      await expect(
        nebaToken.connect(user1).grantBotPauserRole(user2.address)
      ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Enhanced Pause Functionality", function () {
    beforeEach(async function () {
      // Grant roles to test addresses
      await nebaToken.connect(admin).grantBotPauserRole(user1.address);
      await nebaToken.connect(admin).grantEmergencyGuardianRole(user2.address);
    });

    it("Should allow bot pauser to pause", async function () {
      await expect(nebaToken.connect(user1).pause())
        .to.emit(nebaToken, "ContractPaused");
      
      expect(await nebaToken.paused()).to.be.true;
    });

    it("Should allow emergency guardian to pause", async function () {
      await expect(nebaToken.connect(user2).pause())
        .to.emit(nebaToken, "ContractPaused");
      
      expect(await nebaToken.paused()).to.be.true;
    });

    it("Should prevent unauthorized pause", async function () {
      // Use a new signer who doesn't have any pauser role
      const signers = await ethers.getSigners();
      const unauthorizedUser = signers[5]; // Get a fresh signer
      await expect(
        nebaToken.connect(unauthorizedUser).pause()
      ).to.be.revertedWith("Caller must have pauser role");
    });
  });

  describe("Whitelist Management", function () {
    it("Should allow whitelist manager to update whitelist", async function () {
      // Grant whitelist manager role to user1
      const WHITELIST_MANAGER_ROLE = await nebaToken.WHITELIST_MANAGER_ROLE();
      await nebaToken.connect(admin).grantRole(WHITELIST_MANAGER_ROLE, user1.address);

      await expect(nebaToken.connect(user1).updateWhitelist(user2.address, true))
        .to.emit(nebaToken, "WhitelistUpdated")
        .withArgs(user2.address, true);
    });

    it("Should prevent non-whitelist manager from updating whitelist", async function () {
      await expect(
        nebaToken.connect(user1).updateWhitelist(user2.address, true)
      ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Snapshot Functionality", function () {
    it("Should allow admin to create snapshot", async function () {
      const tx = await nebaToken.connect(admin).createSnapshot();
      await tx.wait();
      
      // Verify snapshot was created
      const snapshot = await nebaToken.getSnapshot(1);
      expect(snapshot.id).to.equal(1);
      expect(snapshot.timestamp).to.be.greaterThan(0);
      expect(snapshot.totalSupply).to.equal(ethers.parseEther("1000000000"));
      expect(snapshot.active).to.be.true;
    });

    it("Should emit SnapshotCreated event", async function () {
      await expect(nebaToken.connect(admin).createSnapshot())
        .to.emit(nebaToken, "SnapshotCreated");
    });

    it("Should increment snapshot ID for multiple snapshots", async function () {
      const tx1 = await nebaToken.connect(admin).createSnapshot();
      await tx1.wait();
      
      const tx2 = await nebaToken.connect(admin).createSnapshot();
      await tx2.wait();
      
      // Verify both snapshots exist
      expect(await nebaToken.snapshotExists(1)).to.be.true;
      expect(await nebaToken.snapshotExists(2)).to.be.true;
    });

    it("Should get latest snapshot ID", async function () {
      expect(await nebaToken.getLatestSnapshotId()).to.equal(0);
      
      await nebaToken.connect(admin).createSnapshot();
      expect(await nebaToken.getLatestSnapshotId()).to.equal(1);
      
      await nebaToken.connect(admin).createSnapshot();
      expect(await nebaToken.getLatestSnapshotId()).to.equal(2);
    });

    it("Should revert when getting non-existent snapshot", async function () {
      await expect(nebaToken.getSnapshot(999))
        .to.be.revertedWithCustomError(nebaToken, "SnapshotNotFound");
    });

    it("Should prevent non-snapshot role from creating snapshot", async function () {
      await expect(
        nebaToken.connect(user1).createSnapshot()
      ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
    });

    it("Should allow admin to grant snapshot role", async function () {
      const SNAPSHOT_ROLE = await nebaToken.SNAPSHOT_ROLE();
      await nebaToken.connect(admin).grantRole(SNAPSHOT_ROLE, user1.address);
      
      // Now user1 should be able to create snapshots
      const tx = await nebaToken.connect(user1).createSnapshot();
      await tx.wait();
      
      // Verify snapshot was created
      const snapshot = await nebaToken.getSnapshot(1);
      expect(snapshot.id).to.equal(1);
    });

    it("Should check snapshot existence correctly", async function () {
      expect(await nebaToken.snapshotExists(1)).to.be.false;
      
      await nebaToken.connect(admin).createSnapshot();
      expect(await nebaToken.snapshotExists(1)).to.be.true;
      expect(await nebaToken.snapshotExists(2)).to.be.false;
    });
  });
});
