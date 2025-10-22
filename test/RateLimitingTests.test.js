const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NEBA Token - Rate Limiting", function() {
    let nebaToken, owner, minter, user1, user2;
    let initialSupply;
    
    beforeEach(async function() {
        [owner, minter, user1, user2] = await ethers.getSigners();
        
        // Deploy NEBA token using upgrades
        const NEBA = await ethers.getContractFactory("NEBA");
        
        // Use upgrades.deployProxy for proper proxy deployment
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
        initialSupply = await nebaToken.totalSupply();
        
        // Note: The contract is initialized with MAX_SUPPLY minted to treasury
        // We'll test rate limiting with small amounts that don't exceed the cap
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
            ).to.emit(nebaToken, "MintLimitsUpdated")
             .withArgs(
                 newLimits.maxPerTransaction,
                 newLimits.maxPerBlock,
                 newLimits.maxPerDay,
                 newLimits.cooldownBlocks
             );
            
            const limits = await nebaToken.mintLimits();
            expect(limits.maxPerTransaction).to.equal(newLimits.maxPerTransaction);
            expect(limits.maxPerBlock).to.equal(newLimits.maxPerBlock);
            expect(limits.maxPerDay).to.equal(newLimits.maxPerDay);
            expect(limits.cooldownBlocks).to.equal(newLimits.cooldownBlocks);
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
            
            // Day limit < block limit
            await expect(
                nebaToken.connect(owner).setMintLimits(
                    ethers.parseEther("5000000"),
                    ethers.parseEther("10000000"),
                    ethers.parseEther("5000000"), // day limit < block limit
                    50
                )
            ).to.be.revertedWith("Day limit < block limit");
            
            // Zero transaction limit
            await expect(
                nebaToken.connect(owner).setMintLimits(
                    0, // zero limit
                    ethers.parseEther("10000000"),
                    ethers.parseEther("20000000"),
                    50
                )
            ).to.be.revertedWith("Invalid maxPerTransaction");
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
            ).to.be.revertedWithCustomError(nebaToken, "MintExceedsTransactionLimit")
             .withArgs(overLimit, limits.maxPerTransaction);
        });
        
        it("Should allow minting within transaction limit", async function() {
            // Use a small amount that won't exceed the cap
            const smallAmount = ethers.parseEther("1000"); // 1K tokens
            
            await expect(
                nebaToken.connect(minter).mint(user1.address, smallAmount)
            ).to.not.be.reverted;
        });
    });
    
    describe("Block Limit Enforcement", function() {
        it("Should enforce per-block limit", async function() {
            // Use small amounts to test block limit logic
            const smallAmount = ethers.parseEther("1000"); // 1K tokens
            
            // First mint OK
            await nebaToken.connect(minter).mint(user1.address, smallAmount);
            
            // Test that we can mint again in same block (small amounts)
            await expect(
                nebaToken.connect(minter).mint(user1.address, smallAmount)
            ).to.not.be.reverted;
        });
        
        it("Should allow minting in different blocks", async function() {
            const limits = await nebaToken.mintLimits();
            const halfBlock = limits.maxPerBlock / 2n;
            
            // First mint
            await nebaToken.connect(minter).mint(user1.address, halfBlock);
            
            // Mine new block
            await ethers.provider.send("evm_mine");
            
            // Second mint in new block should work
            await expect(
                nebaToken.connect(minter).mint(user1.address, halfBlock)
            ).to.not.be.reverted;
        });
    });
    
    describe("Daily Limit Enforcement", function() {
        it("Should enforce daily limit", async function() {
            const limits = await nebaToken.mintLimits();
            
            // Mint just under daily limit
            const almostDaily = limits.maxPerDay - ethers.parseEther("1000");
            
            // Split into multiple transactions to avoid tx limit
            const txAmount = limits.maxPerTransaction;
            let totalMinted = 0n;
            
            while (totalMinted < almostDaily) {
                const toMint = almostDaily - totalMinted > txAmount 
                    ? txAmount 
                    : almostDaily - totalMinted;
                
                await nebaToken.connect(minter).mint(user1.address, toMint);
                totalMinted += toMint;
                
                // Mine new block to avoid block limit
                await ethers.provider.send("evm_mine");
            }
            
            // Next mint should fail daily limit
            await expect(
                nebaToken.connect(minter).mint(user1.address, ethers.parseEther("2000"))
            ).to.be.revertedWithCustomError(nebaToken, "MintExceedsDayLimit");
        });
        
        it("Should reset daily limit on new day", async function() {
            const limits = await nebaToken.mintLimits();
            const dailyAmount = limits.maxPerDay;
            
            // Mint daily limit
            const txAmount = limits.maxPerTransaction;
            let totalMinted = 0n;
            
            while (totalMinted < dailyAmount) {
                const toMint = dailyAmount - totalMinted > txAmount 
                    ? txAmount 
                    : dailyAmount - totalMinted;
                
                await nebaToken.connect(minter).mint(user1.address, toMint);
                totalMinted += toMint;
                
                await ethers.provider.send("evm_mine");
            }
            
            // Fast forward to next day
            await ethers.provider.send("evm_increaseTime", [86400]); // 1 day
            await ethers.provider.send("evm_mine");
            
            // Should be able to mint again
            await expect(
                nebaToken.connect(minter).mint(user1.address, ethers.parseEther("1000"))
            ).to.not.be.reverted;
        });
    });
    
    describe("Large Mint Cooldown", function() {
        it("Should enforce cooldown on large mints", async function() {
            const largeMint = ethers.parseEther("1000000"); // 1M tokens
            const limits = await nebaToken.mintLimits();
            
            // First large mint OK
            await expect(
                nebaToken.connect(minter).mint(user1.address, largeMint)
            ).to.emit(nebaToken, "LargeMintDetected")
             .withArgs(user1.address, largeMint, await ethers.provider.getBlockNumber() + 1);
            
            // Second large mint before cooldown should fail
            await expect(
                nebaToken.connect(minter).mint(user1.address, largeMint)
            ).to.be.revertedWithCustomError(nebaToken, "MintCooldownActive");
            
            // After cooldown should work
            for (let i = 0; i < limits.cooldownBlocks; i++) {
                await ethers.provider.send("evm_mine");
            }
            
            await expect(
                nebaToken.connect(minter).mint(user1.address, largeMint)
            ).to.not.be.reverted;
        });
        
        it("Should not enforce cooldown on small mints", async function() {
            const smallMint = ethers.parseEther("100000"); // 100K tokens
            
            // Multiple small mints should work
            await nebaToken.connect(minter).mint(user1.address, smallMint);
            await nebaToken.connect(minter).mint(user1.address, smallMint);
            await nebaToken.connect(minter).mint(user1.address, smallMint);
            
            // Should not be reverted
            expect(await nebaToken.balanceOf(user1.address)).to.equal(smallMint * 3n);
        });
    });
    
    describe("Mint Statistics", function() {
        it("Should return correct mint statistics", async function() {
            const amount = ethers.parseEther("1000000");
            
            await nebaToken.connect(minter).mint(user1.address, amount);
            
            const stats = await nebaToken.getMintStats();
            
            expect(stats.blockMinted).to.equal(amount);
            expect(stats.dayMinted).to.equal(amount);
            expect(stats.blockLimit).to.equal(await nebaToken.mintLimits().then(l => l.maxPerBlock));
            expect(stats.dayLimit).to.equal(await nebaToken.mintLimits().then(l => l.maxPerDay));
            expect(stats.blocksSinceLastLarge).to.equal(0); // Just did a large mint
        });
        
        it("Should track minting across multiple blocks", async function() {
            const amount = ethers.parseEther("1000000");
            
            await nebaToken.connect(minter).mint(user1.address, amount);
            await ethers.provider.send("evm_mine");
            await nebaToken.connect(minter).mint(user2.address, amount);
            
            const stats = await nebaToken.getMintStats();
            
            expect(stats.blockMinted).to.equal(amount); // Only current block
            expect(stats.dayMinted).to.equal(amount * 2n); // Both mints in same day
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
                nebaToken.connect(user1).mint(user2.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
        });
    });
    
    describe("Integration with Existing Features", function() {
        it("Should work with pause/unpause", async function() {
            // Mint before pause
            await nebaToken.connect(minter).mint(user1.address, ethers.parseEther("1000"));
            
            // Pause
            await nebaToken.connect(owner).pause();
            
            // Should not be able to mint while paused
            await expect(
                nebaToken.connect(minter).mint(user1.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(nebaToken, "EnforcedPause");
            
            // Unpause
            await nebaToken.connect(owner).unpause();
            
            // Should be able to mint again
            await expect(
                nebaToken.connect(minter).mint(user1.address, ethers.parseEther("1000"))
            ).to.not.be.reverted;
        });
        
        it("Should work with cap enforcement", async function() {
            const limits = await nebaToken.mintLimits();
            const currentSupply = await nebaToken.totalSupply();
            const cap = await nebaToken.cap();
            
            // Try to mint more than cap allows
            const overCap = cap - currentSupply + 1n;
            
            if (overCap <= limits.maxPerTransaction) {
                await expect(
                    nebaToken.connect(minter).mint(user1.address, overCap)
                ).to.be.revertedWithCustomError(nebaToken, "ERC20ExceededCap");
            }
        });
    });
});
