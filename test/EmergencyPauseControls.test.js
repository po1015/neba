const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Emergency Pause Controls - Audit Requirements", function () {
  let nebaToken;
  let owner;
  let treasury;
  let admin;
  let botPauser;
  let user1;
  let user2;

  const MAX_SUPPLY = ethers.parseEther("1000000000"); // 1 billion tokens
  const COMMIT_TIMEOUT = 3600; // 1 hour
  const CIRCUIT_BREAKER_RESET_INTERVAL = 86400; // 24 hours

  beforeEach(async function () {
    [owner, treasury, admin, botPauser, user1, user2] = await ethers.getSigners();

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

    // Grant BOT_PAUSER_ROLE to botPauser (Phase 1A roles only)
    await nebaToken.connect(admin).grantRole(
      await nebaToken.BOT_PAUSER_ROLE(), 
      botPauser.address
    );

    // Enable trading for transfer tests
    await nebaToken.connect(admin).enableTrading();
    
    // Transfer some tokens from treasury to user1 for testing
    await nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("1000"));
  });

  describe("Phase 1A Role Verification", function () {
    it("Should have only Phase 1A roles: DEFAULT_ADMIN_ROLE, UPGRADER_ROLE, ADMIN_PAUSER_ROLE, BOT_PAUSER_ROLE", async function () {
      const DEFAULT_ADMIN_ROLE = await nebaToken.DEFAULT_ADMIN_ROLE();
      const UPGRADER_ROLE = await nebaToken.UPGRADER_ROLE();
      const ADMIN_PAUSER_ROLE = await nebaToken.ADMIN_PAUSER_ROLE();
      const BOT_PAUSER_ROLE = await nebaToken.BOT_PAUSER_ROLE();

      // Admin should have all Phase 1A roles
      expect(await nebaToken.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await nebaToken.hasRole(UPGRADER_ROLE, admin.address)).to.be.true;
      expect(await nebaToken.hasRole(ADMIN_PAUSER_ROLE, admin.address)).to.be.true;

      // Bot pauser should have BOT_PAUSER_ROLE
      expect(await nebaToken.hasRole(BOT_PAUSER_ROLE, botPauser.address)).to.be.true;

      // Bot pauser should NOT have ADMIN_PAUSER_ROLE
      expect(await nebaToken.hasRole(ADMIN_PAUSER_ROLE, botPauser.address)).to.be.false;
    });

    it("Should not have additional roles beyond Phase 1A", async function () {
      // These roles should not be granted to anyone in Phase 1A
      const GOVERNANCE_UNPAUSER_ROLE = await nebaToken.GOVERNANCE_UNPAUSER_ROLE();
      const EMERGENCY_GUARDIAN_ROLE = await nebaToken.EMERGENCY_GUARDIAN_ROLE();
      const BLOCKLIST_MANAGER_ROLE = await nebaToken.BLOCKLIST_MANAGER_ROLE();
      const WHITELIST_MANAGER_ROLE = await nebaToken.WHITELIST_MANAGER_ROLE();
      const CIRCUIT_BREAKER_ROLE = await nebaToken.CIRCUIT_BREAKER_ROLE();
      const PARAM_MANAGER_ROLE = await nebaToken.PARAM_MANAGER_ROLE();
      const FINANCE_ROLE = await nebaToken.FINANCE_ROLE();
      const SNAPSHOT_ROLE = await nebaToken.SNAPSHOT_ROLE();

      // Admin should not have these roles in Phase 1A
      expect(await nebaToken.hasRole(GOVERNANCE_UNPAUSER_ROLE, admin.address)).to.be.false;
      expect(await nebaToken.hasRole(EMERGENCY_GUARDIAN_ROLE, admin.address)).to.be.false;
      expect(await nebaToken.hasRole(BLOCKLIST_MANAGER_ROLE, admin.address)).to.be.false;
      expect(await nebaToken.hasRole(WHITELIST_MANAGER_ROLE, admin.address)).to.be.false;
      expect(await nebaToken.hasRole(CIRCUIT_BREAKER_ROLE, admin.address)).to.be.false;
      expect(await nebaToken.hasRole(PARAM_MANAGER_ROLE, admin.address)).to.be.false;
      expect(await nebaToken.hasRole(FINANCE_ROLE, admin.address)).to.be.false;
      expect(await nebaToken.hasRole(SNAPSHOT_ROLE, admin.address)).to.be.false;
    });
  });

  describe("BOT_PAUSER_ROLE - Can Pause but Cannot Unpause", function () {
    it("Should allow BOT_PAUSER_ROLE to pause contract", async function () {
      // Bot pauser should be able to pause
      await expect(nebaToken.connect(botPauser).pause())
        .to.emit(nebaToken, "ContractPaused");

      expect(await nebaToken.paused()).to.be.true;
    });

    it("Should prevent BOT_PAUSER_ROLE from unpausing contract", async function () {
      // First pause the contract
      await nebaToken.connect(botPauser).pause();
      expect(await nebaToken.paused()).to.be.true;

      // Bot pauser should NOT be able to unpause
      await expect(nebaToken.connect(botPauser).unpause())
        .to.be.revertedWith("Caller must have unpauser role");
    });

    it("Should emit explicit events for pause/unpause operations", async function () {
      // Test pause event
      await expect(nebaToken.connect(botPauser).pause())
        .to.emit(nebaToken, "ContractPaused");

      // Test unpause event (only admin can unpause)
      await expect(nebaToken.connect(admin).unpause())
        .to.emit(nebaToken, "ContractUnpaused");
    });
  });

  describe("ADMIN_PAUSER_ROLE - Can Pause and Unpause", function () {
    it("Should allow ADMIN_PAUSER_ROLE to pause contract", async function () {
      await expect(nebaToken.connect(admin).pause())
        .to.emit(nebaToken, "ContractPaused");

      expect(await nebaToken.paused()).to.be.true;
    });

    it("Should allow ADMIN_PAUSER_ROLE to unpause contract", async function () {
      // First pause the contract
      await nebaToken.connect(admin).pause();
      expect(await nebaToken.paused()).to.be.true;

      // Admin should be able to unpause
      await expect(nebaToken.connect(admin).unpause())
        .to.emit(nebaToken, "ContractUnpaused");

      expect(await nebaToken.paused()).to.be.false;
    });
  });

  describe("Transfer Functions Revert While Paused", function () {
    beforeEach(async function () {
      // Pause the contract before testing transfers
      await nebaToken.connect(admin).pause();
      expect(await nebaToken.paused()).to.be.true;
    });

    it("Should revert transfer() while paused with expected error", async function () {
      await expect(
        nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(nebaToken, "EnforcedPause");
    });

    it("Should revert transferFrom() while paused with expected error", async function () {
      // First approve user2 to spend user1's tokens
      await nebaToken.connect(user1).approve(user2.address, ethers.parseEther("100"));
      
      await expect(
        nebaToken.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(nebaToken, "EnforcedPause");
    });

    it("Should revert approve() while paused with expected error", async function () {
      await expect(
        nebaToken.connect(user1).approve(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(nebaToken, "EnforcedPause");
    });

    it("Should revert permit() while paused with expected error", async function () {
      const domain = {
        name: "NEBA Token",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await nebaToken.getAddress()
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };

      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const value = ethers.parseEther("100");

      const wallet = new ethers.Wallet(owner.privateKey);
      const signature = await wallet.signTypedData(domain, types, {
        owner: user1.address,
        spender: user2.address,
        value: value,
        nonce: await nebaToken.nonces(user1.address),
        deadline: deadline
      });

      const { v, r, s } = ethers.Signature.from(signature);

      await expect(
        nebaToken.connect(user2).permit(
          user1.address,
          user2.address,
          value,
          deadline,
          v,
          r,
          s
        )
      ).to.be.revertedWithCustomError(nebaToken, "EnforcedPause");
    });
  });

  describe("Role Boundary Enforcement", function () {
    it("Should prevent unauthorized pause", async function () {
      await expect(
        nebaToken.connect(user1).pause()
      ).to.be.revertedWith("Caller must have pauser role");
    });

    it("Should prevent unauthorized unpause", async function () {
      // First pause the contract
      await nebaToken.connect(admin).pause();
      
      await expect(
        nebaToken.connect(user1).unpause()
      ).to.be.revertedWith("Caller must have unpauser role");
    });

    it("Should enforce clear role boundaries", async function () {
      // Bot pauser can pause
      await nebaToken.connect(botPauser).pause();
      expect(await nebaToken.paused()).to.be.true;

      // But cannot unpause
      await expect(nebaToken.connect(botPauser).unpause())
        .to.be.revertedWith("Caller must have unpauser role");

      // Only admin can unpause
      await nebaToken.connect(admin).unpause();
      expect(await nebaToken.paused()).to.be.false;
    });
  });

  describe("Explicit Assertions and Events", function () {
    it("Should emit ContractPaused event with explicit assertions", async function () {
      const tx = await nebaToken.connect(botPauser).pause();
      const receipt = await tx.wait();
      
      // Explicit assertion: Check event was emitted
      const event = receipt.logs.find(log => {
        try {
          const parsed = nebaToken.interface.parseLog(log);
          return parsed.name === "ContractPaused";
        } catch (e) {
          return false;
        }
      });
      
      expect(event).to.not.be.undefined;
      
      // Explicit assertion: Check contract state
      expect(await nebaToken.paused()).to.be.true;
    });

    it("Should emit ContractUnpaused event with explicit assertions", async function () {
      // First pause
      await nebaToken.connect(botPauser).pause();
      
      const tx = await nebaToken.connect(admin).unpause();
      const receipt = await tx.wait();
      
      // Explicit assertion: Check event was emitted
      const event = receipt.logs.find(log => {
        try {
          const parsed = nebaToken.interface.parseLog(log);
          return parsed.name === "ContractUnpaused";
        } catch (e) {
          return false;
        }
      });
      
      expect(event).to.not.be.undefined;
      
      // Explicit assertion: Check contract state
      expect(await nebaToken.paused()).to.be.false;
    });
  });

  describe("Hard Audit Gate - Clear Enforced Boundaries", function () {
    it("Should enforce hard boundaries between pause and unpause roles", async function () {
      // Test 1: Bot can pause but not unpause
      await nebaToken.connect(botPauser).pause();
      expect(await nebaToken.paused()).to.be.true;
      
      await expect(nebaToken.connect(botPauser).unpause())
        .to.be.revertedWith("Caller must have unpauser role");

      // Test 2: Admin can both pause and unpause
      await nebaToken.connect(admin).unpause();
      expect(await nebaToken.paused()).to.be.false;
      
      await nebaToken.connect(admin).pause();
      expect(await nebaToken.paused()).to.be.true;
      
      await nebaToken.connect(admin).unpause();
      expect(await nebaToken.paused()).to.be.false;

      // Test 3: Unauthorized users cannot pause or unpause
      await expect(nebaToken.connect(user1).pause())
        .to.be.revertedWith("Caller must have pauser role");
        
      await nebaToken.connect(admin).pause();
      
      await expect(nebaToken.connect(user1).unpause())
        .to.be.revertedWith("Caller must have unpauser role");
    });

    it("Should maintain consistent role enforcement across all operations", async function () {
      // Multiple pause/unpause cycles to ensure consistency
      for (let i = 0; i < 3; i++) {
        // Bot pauses
        await nebaToken.connect(botPauser).pause();
        expect(await nebaToken.paused()).to.be.true;
        
        // Bot cannot unpause
        await expect(nebaToken.connect(botPauser).unpause())
          .to.be.revertedWith("Caller must have unpauser role");
        
        // Admin unpauses
        await nebaToken.connect(admin).unpause();
        expect(await nebaToken.paused()).to.be.false;
      }
    });
  });
});
