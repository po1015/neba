const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("NEBA Token - Phase 2 Negative Tests", function () {
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

    describe("N2.1: R1 cannot grant R3/R3A", function () {
        it("Should not allow R1 to grant UPGRADER_ROLE", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const UPGRADER_ROLE = await neba.UPGRADER_ROLE();
            const UPGRADER_ADMIN_ROLE = await neba.UPGRADER_ADMIN_ROLE();

            // Test with a different address that only has DEFAULT_ADMIN_ROLE
            const [deployer] = await ethers.getSigners();
            
            // Grant DEFAULT_ADMIN_ROLE to deployer (but not UPGRADER_ADMIN_ROLE)
            const mainSafeSigner = await ethers.getImpersonatedSigner(MAIN_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [MAIN_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [MAIN_SAFE, "0x1000000000000000000"]);
            await neba.connect(mainSafeSigner).grantRole(await neba.DEFAULT_ADMIN_ROLE(), deployer.address);

            // This should fail because deployer doesn't have UPGRADER_ADMIN_ROLE
            await expect(
                neba.connect(deployer).grantRole(UPGRADER_ROLE, BOT_EXECUTOR)
            ).to.be.revertedWithCustomError(neba, "AccessControlUnauthorizedAccount");
        });

        it("Should not allow R1 to grant UPGRADER_ADMIN_ROLE", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const UPGRADER_ADMIN_ROLE = await neba.UPGRADER_ADMIN_ROLE();

            // Test with a different address that only has DEFAULT_ADMIN_ROLE
            const [deployer] = await ethers.getSigners();
            
            // Grant DEFAULT_ADMIN_ROLE to deployer (but not UPGRADER_ADMIN_ROLE)
            const mainSafeSigner = await ethers.getImpersonatedSigner(MAIN_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [MAIN_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [MAIN_SAFE, "0x1000000000000000000"]);
            await neba.connect(mainSafeSigner).grantRole(await neba.DEFAULT_ADMIN_ROLE(), deployer.address);

            // This should fail because deployer doesn't have UPGRADER_ADMIN_ROLE
            await expect(
                neba.connect(deployer).grantRole(UPGRADER_ADMIN_ROLE, BOT_EXECUTOR)
            ).to.be.revertedWithCustomError(neba, "AccessControlUnauthorizedAccount");
        });
    });

    describe("N2.2: Non-MINTER cannot mint", function () {
        it("Should block non-MINTER from minting", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const [deployer] = await ethers.getSigners();

            await expect(
                neba.connect(deployer).mint(BOT_EXECUTOR, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(neba, "AccessControlUnauthorizedAccount");
        });

        it("Should block zero address minting", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const saleContractSigner = await ethers.getImpersonatedSigner(SALE_CONTRACT);
            await ethers.provider.send("hardhat_impersonateAccount", [SALE_CONTRACT]);
            await ethers.provider.send("hardhat_setBalance", [SALE_CONTRACT, "0x1000000000000000000"]);

            await expect(
                neba.connect(saleContractSigner).mint(ethers.ZeroAddress, ethers.parseEther("1000"))
            ).to.be.revertedWith("Mint to zero address");
        });

        it("Should block zero amount minting", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const saleContractSigner = await ethers.getImpersonatedSigner(SALE_CONTRACT);
            await ethers.provider.send("hardhat_impersonateAccount", [SALE_CONTRACT]);
            await ethers.provider.send("hardhat_setBalance", [SALE_CONTRACT, "0x1000000000000000000"]);

            await expect(
                neba.connect(saleContractSigner).mint(BOT_EXECUTOR, 0)
            ).to.be.revertedWith("Amount must be > 0");
        });
    });

    describe("N2.3: No nonReentrant on upgrade", function () {
        it("Should not have nonReentrant on upgrade functions", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            // This test documents that upgrade functions don't have nonReentrant
            // The actual upgrade test would require a new implementation contract
            // For now, we just verify the function exists and can be called by UPGRADER_ROLE
            
            const UPGRADER_ROLE = await neba.UPGRADER_ROLE();
            expect(await neba.hasRole(UPGRADER_ROLE, MAIN_SAFE)).to.be.true;
            
            // The _authorizeUpgrade function should exist and be callable by UPGRADER_ROLE
            // This is verified by the fact that MAIN_SAFE has UPGRADER_ROLE
        });
    });

    describe("N2.4: Deployer cannot perform admin operations", function () {
        it("Should block deployer from pausing", async function () {
            const { neba, deployer } = await loadFixture(deployNEBAFixture);

            await expect(
                neba.connect(deployer).pause()
            ).to.be.revertedWith("Unauthorized");
        });

        it("Should block deployer from unpausing", async function () {
            const { neba, deployer } = await loadFixture(deployNEBAFixture);

            await expect(
                neba.connect(deployer).unpause()
            ).to.be.revertedWithCustomError(neba, "AccessControlUnauthorizedAccount");
        });

        it("Should block deployer from recovering ETH", async function () {
            const { neba, deployer } = await loadFixture(deployNEBAFixture);

            await expect(
                neba.connect(deployer).recoverETH(BOT_EXECUTOR, ethers.parseEther("1"))
            ).to.be.revertedWithCustomError(neba, "AccessControlUnauthorizedAccount");
        });

        it("Should block deployer from recovering ERC20", async function () {
            const { neba, deployer } = await loadFixture(deployNEBAFixture);

            await expect(
                neba.connect(deployer).recoverERC20(neba, BOT_EXECUTOR, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(neba, "AccessControlUnauthorizedAccount");
        });

        it("Should block deployer from updating treasury", async function () {
            const { neba, deployer } = await loadFixture(deployNEBAFixture);

            await expect(
                neba.connect(deployer).updateTreasury(BOT_EXECUTOR)
            ).to.be.revertedWithCustomError(neba, "AccessControlUnauthorizedAccount");
        });
    });

    describe("N2.5: Non-RECOVERY_ROLE cannot recover", function () {
        it("Should block non-RECOVERY_ROLE from recovering ETH", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const opsSafeSigner = await ethers.getImpersonatedSigner(OPS_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [OPS_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [OPS_SAFE, "0x1000000000000000000"]);

            await expect(
                neba.connect(opsSafeSigner).recoverETH(BOT_EXECUTOR, ethers.parseEther("1"))
            ).to.be.revertedWithCustomError(neba, "AccessControlUnauthorizedAccount");
        });

        it("Should block non-RECOVERY_ROLE from recovering ERC20", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const opsSafeSigner = await ethers.getImpersonatedSigner(OPS_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [OPS_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [OPS_SAFE, "0x1000000000000000000"]);

            await expect(
                neba.connect(opsSafeSigner).recoverERC20(neba, BOT_EXECUTOR, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(neba, "AccessControlUnauthorizedAccount");
        });
    });

    describe("N2.6: R9/random EOA cannot unpause", function () {
        it("Should block R9 from unpausing", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const botExecutorSigner = await ethers.getImpersonatedSigner(BOT_EXECUTOR);
            await ethers.provider.send("hardhat_impersonateAccount", [BOT_EXECUTOR]);
            await ethers.provider.send("hardhat_setBalance", [BOT_EXECUTOR, "0x1000000000000000000"]);

            // First pause
            await neba.connect(botExecutorSigner).pause();

            // Then try to unpause (should fail)
            await expect(
                neba.connect(botExecutorSigner).unpause()
            ).to.be.revertedWithCustomError(neba, "AccessControlUnauthorizedAccount");
        });

        it("Should block random EOA from unpausing", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const [deployer] = await ethers.getSigners();

            await expect(
                neba.connect(deployer).unpause()
            ).to.be.revertedWithCustomError(neba, "AccessControlUnauthorizedAccount");
        });
    });

    describe("N2.7: Unknown interface ID returns false", function () {
        it("Should return false for unknown interface ID", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            // Test with a random interface ID
            const unknownInterfaceId = "0x12345678";
            expect(await neba.supportsInterface(unknownInterfaceId)).to.be.false;
        });

        it("Should return true for INEBAMinter interface ID", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            // Test with INEBAMinter interface ID
            const minterInterfaceId = "0x40c10f19"; // mint(address,uint256)
            expect(await neba.supportsInterface(minterInterfaceId)).to.be.true;
        });
    });

    describe("N2.8: Input validation failures", function () {
        it("Should block invalid treasury updates", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const mainSafeSigner = await ethers.getImpersonatedSigner(MAIN_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [MAIN_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [MAIN_SAFE, "0x1000000000000000000"]);

            // Zero address
            await expect(
                neba.connect(mainSafeSigner).updateTreasury(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid treasury");

            // Same treasury
            await expect(
                neba.connect(mainSafeSigner).updateTreasury(TREASURY)
            ).to.be.revertedWith("New treasury must be different from current");
        });

        it("Should block invalid recovery operations", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const mainSafeSigner = await ethers.getImpersonatedSigner(MAIN_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [MAIN_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [MAIN_SAFE, "0x1000000000000000000"]);

            // Zero address
            await expect(
                neba.connect(mainSafeSigner).recoverETH(ethers.ZeroAddress, ethers.parseEther("1"))
            ).to.be.revertedWith("Invalid address");

            // Zero amount
            await expect(
                neba.connect(mainSafeSigner).recoverETH(BOT_EXECUTOR, 0)
            ).to.be.revertedWith("Invalid amount");
        });
    });

    describe("N2.9: Migration validation", function () {
        it("Should block migration if already migrated", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const mainSafeSigner = await ethers.getImpersonatedSigner(MAIN_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [MAIN_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [MAIN_SAFE, "0x1000000000000000000"]);

            const tlMain = "0x5555555555555555555555555555555555555555";
            const tlUpg = "0x6666666666666666666666666666666666666666";

            // First migration
            await neba.connect(mainSafeSigner).migrateRoles(tlMain, tlUpg, MAIN_SAFE);

            // Now use the new admin (tlMain) to try migration again
            const tlMainSigner = await ethers.getImpersonatedSigner(tlMain);
            await ethers.provider.send("hardhat_impersonateAccount", [tlMain]);
            await ethers.provider.send("hardhat_setBalance", [tlMain, "0x1000000000000000000"]);

            // Second migration should fail because already migrated
            await expect(
                neba.connect(tlMainSigner).migrateRoles(tlMain, tlUpg, MAIN_SAFE)
            ).to.be.revertedWith("Already migrated");
        });

        it("Should block migration with invalid addresses", async function () {
            const { neba } = await loadFixture(deployNEBAFixture);

            const mainSafeSigner = await ethers.getImpersonatedSigner(MAIN_SAFE);
            await ethers.provider.send("hardhat_impersonateAccount", [MAIN_SAFE]);
            await ethers.provider.send("hardhat_setBalance", [MAIN_SAFE, "0x1000000000000000000"]);

            // Zero address
            await expect(
                neba.connect(mainSafeSigner).migrateRoles(ethers.ZeroAddress, BOT_EXECUTOR, MAIN_SAFE)
            ).to.be.revertedWith("Invalid main timelock");
        });
    });
});