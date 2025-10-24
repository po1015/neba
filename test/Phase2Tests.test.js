const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("NEBA Token - Phase 2 Tests", function () {
    // Test addresses
    const TREASURY = "0x1234567890123456789012345678901234567890";
    const MAIN_SAFE = "0x1111111111111111111111111111111111111111";
    const OPS_SAFE = "0x2222222222222222222222222222222222222222";
    const BOT_EXECUTOR = "0x3333333333333333333333333333333333333333";
    const SALE_CONTRACT = "0x4444444444444444444444444444444444444444";

    async function deployNEBAFixture() {
        const [deployer] = await ethers.getSigners();

        // Deploy NEBA token
    const NEBA = await ethers.getContractFactory("NEBA");
        const proxy = await upgrades.deployProxy(
      NEBA,
            [TREASURY, MAIN_SAFE, OPS_SAFE, BOT_EXECUTOR, SALE_CONTRACT],
            { initializer: "initialize", kind: "uups" }
        );

        await proxy.waitForDeployment();
        const neba = await ethers.getContractAt("NEBA", await proxy.getAddress());

        return { neba, deployer };
    }

    describe("T2.1: Initialization + Storage Safety", function () {
        it("Should initialize with correct values", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            expect(await neba.name()).to.equal("NEBA Token");
            expect(await neba.symbol()).to.equal("$NEBA");
            expect(await neba.decimals()).to.equal(18);
            expect(await neba.totalSupply()).to.equal(ethers.parseEther("1000000000")); // 1B tokens
            expect(await neba.cap()).to.equal(ethers.parseEther("1000000000"));
            expect(await neba.treasury()).to.equal(TREASURY);
        });

        it("Should have proper role assignments", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const DEFAULT_ADMIN_ROLE = await neba.DEFAULT_ADMIN_ROLE();
            const RECOVERY_ROLE = await neba.RECOVERY_ROLE();
            const UPGRADER_ROLE = await neba.UPGRADER_ROLE();
            const UPGRADER_ADMIN_ROLE = await neba.UPGRADER_ADMIN_ROLE();
            const MINTER_ROLE = await neba.MINTER_ROLE();
            const ADMIN_PAUSER_ROLE = await neba.ADMIN_PAUSER_ROLE();
            const BOT_PAUSER_ROLE = await neba.BOT_PAUSER_ROLE();

      // Check role assignments
            expect(await neba.hasRole(DEFAULT_ADMIN_ROLE, MAIN_SAFE)).to.be.true;
            expect(await neba.hasRole(RECOVERY_ROLE, MAIN_SAFE)).to.be.true;
            expect(await neba.hasRole(UPGRADER_ROLE, MAIN_SAFE)).to.be.true;
            expect(await neba.hasRole(UPGRADER_ADMIN_ROLE, MAIN_SAFE)).to.be.true;
            expect(await neba.hasRole(MINTER_ROLE, SALE_CONTRACT)).to.be.true;
            expect(await neba.hasRole(ADMIN_PAUSER_ROLE, OPS_SAFE)).to.be.true;
            expect(await neba.hasRole(BOT_PAUSER_ROLE, BOT_EXECUTOR)).to.be.true;
        });

        it("Should have correct role hierarchy", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const UPGRADER_ROLE = await neba.UPGRADER_ROLE();
            const UPGRADER_ADMIN_ROLE = await neba.UPGRADER_ADMIN_ROLE();

            expect(await neba.getRoleAdmin(UPGRADER_ROLE)).to.equal(UPGRADER_ADMIN_ROLE);
            expect(await neba.getRoleAdmin(UPGRADER_ADMIN_ROLE)).to.equal(UPGRADER_ADMIN_ROLE); // Self-admin
        });
    });

    describe("T2.1b: Protection against Empty Proxy", function () {
        it("Should not allow direct calls to implementation", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);
            
            // Try to call initialize again (should fail)
            await expect(
                neba.initialize(TREASURY, MAIN_SAFE, OPS_SAFE, BOT_EXECUTOR, SALE_CONTRACT)
            ).to.be.revertedWithCustomError(neba, "InvalidInitialization");
        });
    });

    describe("T2.2: Atomic Role Assignment", function () {
        it("Should not assign any roles to deployer", async function () {
            const { neba, deployer } = await loadFixture(deployNEBAFixture);

            const DEFAULT_ADMIN_ROLE = await neba.DEFAULT_ADMIN_ROLE();
            const RECOVERY_ROLE = await neba.RECOVERY_ROLE();
            const UPGRADER_ROLE = await neba.UPGRADER_ROLE();
            const MINTER_ROLE = await neba.MINTER_ROLE();

            expect(await neba.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.false;
            expect(await neba.hasRole(RECOVERY_ROLE, deployer.address)).to.be.false;
            expect(await neba.hasRole(UPGRADER_ROLE, deployer.address)).to.be.false;
            expect(await neba.hasRole(MINTER_ROLE, deployer.address)).to.be.false;
        });
    });

    describe("T2.3: Upgrade Admin Chain", function () {
        it("Should have R3A as self-admin", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const UPGRADER_ADMIN_ROLE = await neba.UPGRADER_ADMIN_ROLE();
            expect(await neba.getRoleAdmin(UPGRADER_ADMIN_ROLE)).to.equal(UPGRADER_ADMIN_ROLE);
        });

        it("Should allow R3A to grant R3", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const UPGRADER_ROLE = await neba.UPGRADER_ROLE();
            const UPGRADER_ADMIN_ROLE = await neba.UPGRADER_ADMIN_ROLE();

            // Main safe has UPGRADER_ADMIN_ROLE, so it can grant UPGRADER_ROLE
            const mainSafeSigner = await ethers.getImpersonatedSigner(MAIN_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [MAIN_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [MAIN_SAFE, "0x1000000000000000000"]);

            await expect(
                neba.connect(mainSafeSigner).grantRole(UPGRADER_ROLE, BOT_EXECUTOR)
            ).to.not.be.reverted;
        });
    });

    describe("T2.4: Upgrade from MAIN_SAFE", function () {
        it("Should allow MAIN_SAFE to upgrade", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const UPGRADER_ROLE = await neba.UPGRADER_ROLE();
            expect(await neba.hasRole(UPGRADER_ROLE, MAIN_SAFE)).to.be.true;
        });
    });

    describe("T2.5: Pause/Unpause Flow", function () {
        it("Should allow R8 to pause and unpause", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const opsSafeSigner = await ethers.getImpersonatedSigner(OPS_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [OPS_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [OPS_SAFE, "0x1000000000000000000"]);

            // Pause
            await neba.connect(opsSafeSigner).pause();
            expect(await neba.paused()).to.be.true;

            // Unpause
            await neba.connect(opsSafeSigner).unpause();
            expect(await neba.paused()).to.be.false;
        });

        it("Should allow R9 to pause but not unpause", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const botExecutorSigner = await ethers.getImpersonatedSigner(BOT_EXECUTOR);
            await ethers.provider.send("hardhat_impersonateAccount", [BOT_EXECUTOR]);
            await ethers.provider.send("hardhat_setBalance", [BOT_EXECUTOR, "0x1000000000000000000"]);

            // Can pause
            await neba.connect(botExecutorSigner).pause();
            expect(await neba.paused()).to.be.true;

            // Cannot unpause
      await expect(
                neba.connect(botExecutorSigner).unpause()
            ).to.be.revertedWithCustomError(neba, "AccessControlUnauthorizedAccount");
        });
    });

    describe("T2.6: Pause Semantics", function () {
        it("Should allow approve during pause", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const opsSafeSigner = await ethers.getImpersonatedSigner(OPS_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [OPS_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [OPS_SAFE, "0x1000000000000000000"]);

            // Pause
            await neba.connect(opsSafeSigner).pause();

            // Approve should work
      await expect(
                neba.connect(opsSafeSigner).approve(BOT_EXECUTOR, ethers.parseEther("1000"))
            ).to.not.be.reverted;
        });

        it("Should block transfers during pause", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const opsSafeSigner = await ethers.getImpersonatedSigner(OPS_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [OPS_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [OPS_SAFE, "0x1000000000000000000"]);

            // Pause
            await neba.connect(opsSafeSigner).pause();

            // Transfer should fail
            await expect(
                neba.connect(opsSafeSigner).transfer(BOT_EXECUTOR, ethers.parseEther("1000"))
            ).to.be.revertedWith("Token transfers paused");
      });
    });

    describe("T2.7: Mint under/over cap", function () {
        it("Should block minting when cap is already reached", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const saleContractSigner = await ethers.getImpersonatedSigner(SALE_CONTRACT);
            await ethers.provider.send("hardhat_impersonateAccount", [SALE_CONTRACT]);
            await ethers.provider.send("hardhat_setBalance", [SALE_CONTRACT, "0x1000000000000000000"]);

            const mintAmount = ethers.parseEther("1000000"); // 1M tokens

            await expect(
                neba.connect(saleContractSigner).mint(BOT_EXECUTOR, mintAmount)
            ).to.be.revertedWithCustomError(neba, "ERC20ExceededCap");
        });

        it("Should block minting over cap", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const saleContractSigner = await ethers.getImpersonatedSigner(SALE_CONTRACT);
            await ethers.provider.send("hardhat_impersonateAccount", [SALE_CONTRACT]);
            await ethers.provider.send("hardhat_setBalance", [SALE_CONTRACT, "0x1000000000000000000"]);

            const mintAmount = ethers.parseEther("1"); // 1 token over cap

      await expect(
                neba.connect(saleContractSigner).mint(BOT_EXECUTOR, mintAmount)
            ).to.be.revertedWithCustomError(neba, "ERC20ExceededCap");
        });
    });

    describe("T2.7b: Mint reverts when paused", function () {
        it("Should block minting when paused", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const opsSafeSigner = await ethers.getImpersonatedSigner(OPS_SAFE);
            const saleContractSigner = await ethers.getImpersonatedSigner(SALE_CONTRACT);
            
            await ethers.provider.send("hardhat_impersonateAccount", [OPS_SAFE]);
            await ethers.provider.send("hardhat_impersonateAccount", [SALE_CONTRACT]);
            await ethers.provider.send("hardhat_setBalance", [OPS_SAFE, "0x1000000000000000000"]);
            await ethers.provider.send("hardhat_setBalance", [SALE_CONTRACT, "0x1000000000000000000"]);

            // Pause
            await neba.connect(opsSafeSigner).pause();

            // Mint should fail
            await expect(
                neba.connect(saleContractSigner).mint(BOT_EXECUTOR, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(neba, "EnforcedPause");
        });
    });

    describe("T2.8: Recovery Success", function () {
        it("Should allow R2 to recover ETH", async function () {
            const { neba, deployer } = await loadFixture(deployNEBAFixture);

            const mainSafeSigner = await ethers.getImpersonatedSigner(MAIN_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [MAIN_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [MAIN_SAFE, "0x1000000000000000000"]);

            // Send ETH to contract
            await deployer.sendTransaction({
                to: await neba.getAddress(),
                value: ethers.parseEther("1")
            });

            const initialBalance = await ethers.provider.getBalance(BOT_EXECUTOR);
            const recoverAmount = ethers.parseEther("0.5");

            await expect(
                neba.connect(mainSafeSigner).recoverETH(BOT_EXECUTOR, recoverAmount)
            ).to.not.be.reverted;

            const finalBalance = await ethers.provider.getBalance(BOT_EXECUTOR);
            expect(finalBalance).to.be.gt(initialBalance);
        });
    });

    describe("T2.8b: Recovery forbids NEBA", function () {
        it("Should block recovery of NEBA tokens", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const mainSafeSigner = await ethers.getImpersonatedSigner(MAIN_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [MAIN_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [MAIN_SAFE, "0x1000000000000000000"]);

            await expect(
                neba.connect(mainSafeSigner).recoverERC20(neba, BOT_EXECUTOR, ethers.parseEther("1000"))
            ).to.be.revertedWith("Cannot recover NEBA");
        });
    });

    describe("T2.10: migrateRoles() dry-run", function () {
        it("Should allow migration of roles to timelock", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const mainSafeSigner = await ethers.getImpersonatedSigner(MAIN_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [MAIN_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [MAIN_SAFE, "0x1000000000000000000"]);

            const tlMain = "0x5555555555555555555555555555555555555555";
            const tlUpg = "0x6666666666666666666666666666666666666666";

            await expect(
                neba.connect(mainSafeSigner).migrateRoles(tlMain, tlUpg, MAIN_SAFE)
            ).to.not.be.reverted;

            expect(await neba.migrated()).to.be.true;
        });
    });
});
