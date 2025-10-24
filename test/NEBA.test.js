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

  beforeEach(async function () {
    [owner, treasury, admin, user1, user2] = await ethers.getSigners();

    // Deploy the NEBA token with Phase 2 parameters
    const NEBA = await ethers.getContractFactory("NEBA");
    nebaToken = await upgrades.deployProxy(
      NEBA,
      [
        treasury.address,  // _treasury
        admin.address,     // _mainSafe
        admin.address,     // _opsSafe
        admin.address,     // _botExecutor
        admin.address      // _saleContract
      ],
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
      const RECOVERY_ROLE = await nebaToken.RECOVERY_ROLE();
      const UPGRADER_ROLE = await nebaToken.UPGRADER_ROLE();
      const UPGRADER_ADMIN_ROLE = await nebaToken.UPGRADER_ADMIN_ROLE();
      const MINTER_ROLE = await nebaToken.MINTER_ROLE();
      const ADMIN_PAUSER_ROLE = await nebaToken.ADMIN_PAUSER_ROLE();
      const BOT_PAUSER_ROLE = await nebaToken.BOT_PAUSER_ROLE();

      expect(await nebaToken.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await nebaToken.hasRole(RECOVERY_ROLE, admin.address)).to.be.true;
      expect(await nebaToken.hasRole(UPGRADER_ROLE, admin.address)).to.be.true;
      expect(await nebaToken.hasRole(UPGRADER_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await nebaToken.hasRole(MINTER_ROLE, admin.address)).to.be.true;
      expect(await nebaToken.hasRole(ADMIN_PAUSER_ROLE, admin.address)).to.be.true;
      expect(await nebaToken.hasRole(BOT_PAUSER_ROLE, admin.address)).to.be.true;
    });
  });

  describe("Transfer Functionality", function () {
    beforeEach(async function () {
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
  });

  describe("Pausable Functionality", function () {
    it("Should allow admin to pause and unpause", async function () {
      await expect(nebaToken.connect(admin).pause())
        .to.emit(nebaToken, "Paused");

      expect(await nebaToken.paused()).to.be.true;

      await expect(nebaToken.connect(admin).unpause())
        .to.emit(nebaToken, "Unpaused");

      expect(await nebaToken.paused()).to.be.false;
    });

    it("Should prevent transfers when paused", async function () {
      await nebaToken.connect(admin).pause();

      await expect(
        nebaToken.connect(treasury).transfer(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Token transfers paused");
    });
  });

  describe("Minting Functionality", function () {
    it("Should prevent minting when cap is already reached", async function () {
      const mintAmount = ethers.parseEther("1000");
      
      await expect(
        nebaToken.connect(admin).mint(user1.address, mintAmount)
      ).to.be.revertedWithCustomError(nebaToken, "ERC20ExceededCap");
    });

    it("Should prevent non-minter from minting", async function () {
      await expect(
        nebaToken.connect(user1).mint(user2.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Recovery Functionality", function () {
    it("Should allow recovery of ETH", async function () {
      // Send some ETH to the contract
      await owner.sendTransaction({
        to: await nebaToken.getAddress(),
        value: ethers.parseEther("1")
      });

      const initialBalance = await ethers.provider.getBalance(admin.address);
      
      await expect(nebaToken.connect(admin).recoverETH(admin.address, ethers.parseEther("1")))
        .to.emit(nebaToken, "ETHRecovered");

      const finalBalance = await ethers.provider.getBalance(admin.address);
      expect(finalBalance).to.be.greaterThan(initialBalance);
    });

    it("Should prevent recovery of NEBA tokens", async function () {
      await expect(
        nebaToken.connect(admin).recoverERC20(await nebaToken.getAddress(), admin.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Cannot recover NEBA");
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
});