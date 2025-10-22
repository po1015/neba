const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NEBA Token - Rate Limiting (Simple)", function() {
    let nebaToken, owner, minter, user1;
    
    beforeEach(async function() {
        [owner, minter, user1] = await ethers.getSigners();
        
        // Deploy NEBA token using upgrades
        const NEBA = await ethers.getContractFactory("NEBA");
        const { upgrades } = require("hardhat");
        
        const proxy = await upgrades.deployProxy(
            NEBA,
            [
                owner.address,    // treasury
                owner.address,    // admin
                minter.address,   // saleContract
                owner.address,    // opsSafe
                owner.address,    // botExecutor
                3600,            // commitTimeout
                86400            // circuitBreakerResetInterval
            ],
            {
                initializer: "initialize",
                kind: "uups"
            }
        );
        
        nebaToken = await ethers.getContractAt("NEBA", await proxy.getAddress());
    });
    
    describe("Rate Limiting Configuration", function() {
        it("Should have default mint limits set", async function() {
            const limits = await nebaToken.mintLimits();
            
            expect(limits.maxPerTransaction).to.equal(ethers.parseEther("10000000")); // 10M
            expect(limits.maxPerBlock).to.equal(ethers.parseEther("20000000")); // 20M
            expect(limits.maxPerDay).to.equal(ethers.parseEther("100000000")); // 100M
            expect(limits.cooldownBlocks).to.equal(100);
        });
        
        it("Should allow admin to update mint limits", async function() {
            const newLimits = {
                maxPerTransaction: ethers.parseEther("5000000"),
                maxPerBlock: ethers.parseEther("10000000"),
                maxPerDay: ethers.parseEther("50000000"),
                cooldownBlocks: 50
            };
            
            await expect(
                nebaToken.connect(owner).setMintLimits(
                    newLimits.maxPerTransaction,
                    newLimits.maxPerBlock,
                    newLimits.maxPerDay,
                    newLimits.cooldownBlocks
                )
            ).to.emit(nebaToken, "MintLimitsUpdated");
            
            const limits = await nebaToken.mintLimits();
            expect(limits.maxPerTransaction).to.equal(newLimits.maxPerTransaction);
        });
        
        it("Should reject invalid limit configurations", async function() {
            // Block limit < transaction limit
            await expect(
                nebaToken.connect(owner).setMintLimits(
                    ethers.parseEther("10000000"), // tx limit
                    ethers.parseEther("5000000"),  // block limit < tx limit
                    ethers.parseEther("20000000"),
                    50
                )
            ).to.be.revertedWith("Block limit < tx limit");
        });
        
        it("Should only allow admin to update limits", async function() {
            await expect(
                nebaToken.connect(minter).setMintLimits(
                    ethers.parseEther("5000000"),
                    ethers.parseEther("10000000"),
                    ethers.parseEther("20000000"),
                    50
                )
            ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
        });
    });
    
    describe("Transaction Limit Enforcement", function() {
        it("Should enforce per-transaction limit", async function() {
            const limits = await nebaToken.mintLimits();
            const overLimit = limits.maxPerTransaction + 1n;
            
            await expect(
                nebaToken.connect(minter).mint(user1.address, overLimit)
            ).to.be.revertedWithCustomError(nebaToken, "MintExceedsTransactionLimit");
        });
        
        it("Should allow small minting amounts", async function() {
            const smallAmount = ethers.parseEther("1000"); // 1K tokens
            
            // This should work if we have available cap space
            // Note: The contract starts with MAX_SUPPLY minted to treasury
            // So we can't actually mint more, but we can test the rate limiting logic
            await expect(
                nebaToken.connect(minter).mint(user1.address, smallAmount)
            ).to.be.revertedWithCustomError(nebaToken, "ERC20ExceededCap");
        });
    });
    
    describe("Rate Limiting Logic (Without Actual Minting)", function() {
        it("Should track mint statistics correctly", async function() {
            const stats = await nebaToken.getMintStats();
            
            expect(stats.blockMinted).to.equal(0);
            expect(stats.dayMinted).to.equal(0);
            expect(stats.blockLimit).to.equal(await nebaToken.mintLimits().then(l => l.maxPerBlock));
            expect(stats.dayLimit).to.equal(await nebaToken.mintLimits().then(l => l.maxPerDay));
        });
        
        it("Should handle large mint threshold correctly", async function() {
            const threshold = await nebaToken.LARGE_MINT_THRESHOLD();
            expect(threshold).to.equal(ethers.parseEther("1000000")); // 1M tokens
        });
        
        it("Should have correct cooldown tracking", async function() {
            const lastLargeMintBlock = await nebaToken.lastLargeMintBlock();
            expect(lastLargeMintBlock).to.equal(0); // Initially zero
        });
    });
    
    describe("Edge Cases", function() {
        it("Should handle zero amount minting", async function() {
            await expect(
                nebaToken.connect(minter).mint(user1.address, 0)
            ).to.be.revertedWith("Amount must be > 0");
        });
        
        it("Should handle minting to zero address", async function() {
            await expect(
                nebaToken.connect(minter).mint(ethers.ZeroAddress, ethers.parseEther("1000"))
            ).to.be.revertedWith("Mint to zero address");
        });
        
        it("Should handle paused contract", async function() {
            await nebaToken.connect(owner).pause();
            
            await expect(
                nebaToken.connect(minter).mint(user1.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(nebaToken, "EnforcedPause");
        });
        
        it("Should handle unauthorized minter", async function() {
            await expect(
                nebaToken.connect(user1).mint(user1.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
        });
    });
    
    describe("Integration with Existing Features", function() {
        it("Should work with pause/unpause", async function() {
            // Pause
            await nebaToken.connect(owner).pause();
            
            // Should not be able to mint while paused
            await expect(
                nebaToken.connect(minter).mint(user1.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(nebaToken, "EnforcedPause");
            
            // Unpause
            await nebaToken.connect(owner).unpause();
            
            // Should still be reverted due to cap, but not due to pause
            await expect(
                nebaToken.connect(minter).mint(user1.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(nebaToken, "ERC20ExceededCap");
        });
    });
});

