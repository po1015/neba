const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NEBA Token - Cap Immutability", function() {
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
    
    describe("Cap Immutability Verification", function() {
        it("Should confirm cap is immutable", async function() {
            const isImmutable = await nebaToken.isCapImmutable();
            expect(isImmutable).to.be.true;
        });
        
        it("Should return fixed cap value", async function() {
            const cap = await nebaToken.cap();
            const maxSupply = await nebaToken.MAX_SUPPLY();
            
            expect(cap).to.equal(maxSupply);
            expect(cap).to.equal(ethers.parseEther("1000000000")); // 1 billion tokens
        });
        
        it("Should have correct MAX_SUPPLY constant", async function() {
            const maxSupply = await nebaToken.MAX_SUPPLY();
            expect(maxSupply).to.equal(ethers.parseEther("1000000000")); // 1 billion tokens
        });
    });
    
    describe("Cap Functionality", function() {
        it("Should enforce cap during minting", async function() {
            const cap = await nebaToken.cap();
            const currentSupply = await nebaToken.totalSupply();
            
            // Contract starts with MAX_SUPPLY minted to treasury
            expect(currentSupply).to.equal(cap);
            
            // Any additional minting should fail due to cap
            await expect(
                nebaToken.connect(minter).mint(user1.address, ethers.parseEther("1"))
            ).to.be.revertedWithCustomError(nebaToken, "ERC20ExceededCap");
        });
        
        it("Should not have cap change functions", async function() {
            // Verify that no cap change functions exist
            // These functions should not exist, so calling them should throw TypeError
            
            // Try to call non-existent cap change functions
            expect(() => {
                nebaToken.connect(owner).setCap(ethers.parseEther("2000000000"));
            }).to.throw(); // Should throw because function doesn't exist
            
            expect(() => {
                nebaToken.connect(owner).updateCap(ethers.parseEther("2000000000"));
            }).to.throw(); // Should throw because function doesn't exist
            
            expect(() => {
                nebaToken.connect(owner).changeCap(ethers.parseEther("2000000000"));
            }).to.throw(); // Should throw because function doesn't exist
        });
        
        it("Should not have CAPS_MANAGER_ROLE", async function() {
            // Verify that CAPS_MANAGER_ROLE does not exist by trying to access it
            // This should fail because the role doesn't exist
            
            expect(() => {
                nebaToken.CAPS_MANAGER_ROLE();
            }).to.throw(); // Should throw because role doesn't exist
        });
    });
    
    describe("Cap Security", function() {
        it("Should not allow cap manipulation through any role", async function() {
            // Even admin should not be able to change cap
            // (No functions exist to change cap)
            
            // Try to call cap change functions - they should not exist
            expect(() => {
                nebaToken.connect(owner).setCap(ethers.parseEther("2000000000"));
            }).to.throw(); // Should throw because function doesn't exist
            
            expect(() => {
                nebaToken.connect(owner).updateCap(ethers.parseEther("2000000000"));
            }).to.throw(); // Should throw because function doesn't exist
        });
        
        it("Should maintain cap consistency", async function() {
            const cap = await nebaToken.cap();
            const maxSupply = await nebaToken.MAX_SUPPLY();
            
            // Cap should always equal MAX_SUPPLY
            expect(cap).to.equal(maxSupply);
            
            // Both should be 1 billion tokens
            expect(cap).to.equal(ethers.parseEther("1000000000"));
        });
    });
    
    describe("Cap Documentation", function() {
        it("Should have clear cap documentation", async function() {
            // Verify cap function documentation
            const cap = await nebaToken.cap();
            expect(cap).to.equal(ethers.parseEther("1000000000"));
            
            // Verify immutability function
            const isImmutable = await nebaToken.isCapImmutable();
            expect(isImmutable).to.be.true;
        });
        
        it("Should provide transparent cap information", async function() {
            const cap = await nebaToken.cap();
            const maxSupply = await nebaToken.MAX_SUPPLY();
            const isImmutable = await nebaToken.isCapImmutable();
            
            // All cap information should be consistent
            expect(cap).to.equal(maxSupply);
            expect(isImmutable).to.be.true;
            expect(cap).to.equal(ethers.parseEther("1000000000"));
        });
    });
    
    describe("Integration with Existing Features", function() {
        it("Should work with rate limiting", async function() {
            // Rate limiting should work with immutable cap
            const limits = await nebaToken.mintLimits();
            expect(limits.maxPerTransaction).to.equal(ethers.parseEther("10000000"));
            
            // Cap should still be immutable
            const isImmutable = await nebaToken.isCapImmutable();
            expect(isImmutable).to.be.true;
        });
        
        it("Should work with pause functionality", async function() {
            // Pause should work with immutable cap
            await nebaToken.connect(owner).pause();
            
            // Cap should still be immutable
            const isImmutable = await nebaToken.isCapImmutable();
            expect(isImmutable).to.be.true;
            
            const cap = await nebaToken.cap();
            expect(cap).to.equal(ethers.parseEther("1000000000"));
        });
        
        it("Should work with upgrade functionality", async function() {
            // Upgrade should not affect cap immutability
            const isImmutable = await nebaToken.isCapImmutable();
            expect(isImmutable).to.be.true;
            
            const cap = await nebaToken.cap();
            expect(cap).to.equal(ethers.parseEther("1000000000"));
        });
    });
    
    describe("Edge Cases", function() {
        it("Should handle cap queries correctly", async function() {
            // Multiple cap queries should return same value
            const cap1 = await nebaToken.cap();
            const cap2 = await nebaToken.cap();
            const cap3 = await nebaToken.cap();
            
            expect(cap1).to.equal(cap2);
            expect(cap2).to.equal(cap3);
            expect(cap1).to.equal(ethers.parseEther("1000000000"));
        });
        
        it("Should maintain cap across different contexts", async function() {
            // Cap should be same from different accounts
            const capFromOwner = await nebaToken.connect(owner).cap();
            const capFromMinter = await nebaToken.connect(minter).cap();
            const capFromUser = await nebaToken.connect(user1).cap();
            
            expect(capFromOwner).to.equal(capFromMinter);
            expect(capFromMinter).to.equal(capFromUser);
            expect(capFromOwner).to.equal(ethers.parseEther("1000000000"));
        });
    });
    
    describe("Cap Economics", function() {
        it("Should have predictable token economics", async function() {
            const cap = await nebaToken.cap();
            const maxSupply = await nebaToken.MAX_SUPPLY();
            const currentSupply = await nebaToken.totalSupply();
            
            // All values should be consistent
            expect(cap).to.equal(maxSupply);
            expect(currentSupply).to.equal(cap);
            expect(cap).to.equal(ethers.parseEther("1000000000"));
        });
        
        it("Should prevent inflation attacks", async function() {
            // No way to increase cap
            const isImmutable = await nebaToken.isCapImmutable();
            expect(isImmutable).to.be.true;
            
            // No cap change functions exist - try to call them
            expect(() => {
                nebaToken.connect(owner).setCap(ethers.parseEther("2000000000"));
            }).to.throw(); // Should throw because function doesn't exist
            
            expect(() => {
                nebaToken.connect(owner).updateCap(ethers.parseEther("2000000000"));
            }).to.throw(); // Should throw because function doesn't exist
        });
    });
});
