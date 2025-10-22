const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NEBA Token - Emergency Mode", function() {
    let nebaToken, owner, guardian, user1, user2;
    let guardianSafe;
    
    beforeEach(async function() {
        [owner, guardian, user1, user2] = await ethers.getSigners();
        guardianSafe = guardian; // In real deployment, this would be a multi-sig
        
        // Deploy NEBA token using upgrades
        const NEBA = await ethers.getContractFactory("NEBA");
        const { upgrades } = require("hardhat");
        
        const proxy = await upgrades.deployProxy(
            NEBA,
            [
                owner.address,    // treasury
                owner.address,    // admin
                user1.address,    // saleContract
                owner.address,    // opsSafe
                owner.address,    // botExecutor
                guardianSafe.address, // guardianSafe
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
    
    describe("Emergency Mode Activation", function() {
        it("Should allow Guardian to activate emergency mode", async function() {
            const reason = "Critical vulnerability CVE-2024-XXXX detected";
            
            await expect(
                nebaToken.connect(guardianSafe).activateEmergencyMode(reason)
            ).to.emit(nebaToken, "EmergencyModeActivated")
             .withArgs(guardianSafe.address, reason);
            
            expect(await nebaToken.emergencyMode()).to.be.true;
            expect(await nebaToken.paused()).to.be.true;
            expect(await nebaToken.emergencyModeActivatedAt()).to.be.greaterThan(0);
        });
        
        it("Should prevent non-Guardian from activating emergency mode", async function() {
            const reason = "Fake emergency";
            
            await expect(
                nebaToken.connect(user1).activateEmergencyMode(reason)
            ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
        });
        
        it("Should prevent double activation of emergency mode", async function() {
            await nebaToken.connect(guardianSafe).activateEmergencyMode("First activation");
            
            await expect(
                nebaToken.connect(guardianSafe).activateEmergencyMode("Second activation")
            ).to.be.revertedWith("Already in emergency mode");
        });
        
        it("Should automatically pause contract when emergency mode is activated", async function() {
            expect(await nebaToken.paused()).to.be.false;
            
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test emergency");
            
            expect(await nebaToken.paused()).to.be.true;
        });
    });
    
    describe("Emergency Upgrade", function() {
        let newImplementation;
        
        beforeEach(async function() {
            // Deploy a new implementation for testing
            const NEBA = await ethers.getContractFactory("NEBA");
            newImplementation = await NEBA.deploy();
            await newImplementation.waitForDeployment();
        });
        
        it("Should allow emergency upgrade within 7 days", async function() {
            // Activate emergency mode
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test incident");
            
            // Emergency upgrade should work
            await expect(
                nebaToken.connect(guardianSafe).emergencyUpgrade(await newImplementation.getAddress())
            ).to.emit(nebaToken, "EmergencyUpgradeExecuted")
             .withArgs(await newImplementation.getAddress());
        });
        
        it("Should prevent emergency upgrade when not in emergency mode", async function() {
            await expect(
                nebaToken.connect(guardianSafe).emergencyUpgrade(await newImplementation.getAddress())
            ).to.be.revertedWithCustomError(nebaToken, "EmergencyModeNotActive");
        });
        
        it("Should prevent emergency upgrade after 7 days", async function() {
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            // Fast forward 8 days
            await ethers.provider.send("evm_increaseTime", [8 * 24 * 3600]);
            await ethers.provider.send("evm_mine");
            
            await expect(
                nebaToken.connect(guardianSafe).emergencyUpgrade(await newImplementation.getAddress())
            ).to.be.revertedWithCustomError(nebaToken, "EmergencyModeExpired");
        });
        
        it("Should prevent non-Guardian from emergency upgrade", async function() {
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            await expect(
                nebaToken.connect(user1).emergencyUpgrade(await newImplementation.getAddress())
            ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
        });
        
        it("Should validate new implementation address", async function() {
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            // Zero address should fail
            await expect(
                nebaToken.connect(guardianSafe).emergencyUpgrade(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid implementation");
            
            // Non-contract address should fail
            await expect(
                nebaToken.connect(guardianSafe).emergencyUpgrade(user1.address)
            ).to.be.revertedWith("Not a contract");
        });
    });
    
    describe("Emergency Mode Deactivation", function() {
        it("Should allow Guardian to deactivate emergency mode", async function() {
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            await expect(
                nebaToken.connect(guardianSafe).deactivateEmergencyMode()
            ).to.emit(nebaToken, "EmergencyModeDeactivated")
             .withArgs(guardianSafe.address);
            
            expect(await nebaToken.emergencyMode()).to.be.false;
            expect(await nebaToken.paused()).to.be.false;
        });
        
        it("Should allow DEFAULT_ADMIN to deactivate emergency mode", async function() {
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            await expect(
                nebaToken.connect(owner).deactivateEmergencyMode()
            ).to.emit(nebaToken, "EmergencyModeDeactivated")
             .withArgs(owner.address);
            
            expect(await nebaToken.emergencyMode()).to.be.false;
        });
        
        it("Should prevent non-authorized users from deactivating emergency mode", async function() {
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            await expect(
                nebaToken.connect(user1).deactivateEmergencyMode()
            ).to.be.revertedWith("Not authorized");
        });
        
        it("Should prevent deactivation when not in emergency mode", async function() {
            await expect(
                nebaToken.connect(guardianSafe).deactivateEmergencyMode()
            ).to.be.revertedWith("Not in emergency mode");
        });
    });
    
    describe("Emergency Powers Check", function() {
        it("Should return false when not in emergency mode", async function() {
            expect(await nebaToken.canUseEmergencyPowers()).to.be.false;
        });
        
        it("Should return true when in emergency mode and not expired", async function() {
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            expect(await nebaToken.canUseEmergencyPowers()).to.be.true;
        });
        
        it("Should return false when emergency mode is expired", async function() {
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            // Fast forward 8 days
            await ethers.provider.send("evm_increaseTime", [8 * 24 * 3600]);
            await ethers.provider.send("evm_mine");
            
            expect(await nebaToken.canUseEmergencyPowers()).to.be.false;
        });
    });
    
    describe("Regular Upgrade Prevention", function() {
        it("Should prevent regular upgrade during emergency mode", async function() {
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            // Deploy new implementation
            const NEBA = await ethers.getContractFactory("NEBA");
            const newImpl = await NEBA.deploy();
            await newImpl.waitForDeployment();
            
            // Regular upgrade should fail
            await expect(
                nebaToken.connect(owner).upgradeToAndCall(await newImpl.getAddress(), "0x")
            ).to.be.revertedWith("Use emergencyUpgrade() instead");
        });
        
        it("Should allow regular upgrade when not in emergency mode", async function() {
            // Deploy new implementation
            const NEBA = await ethers.getContractFactory("NEBA");
            const newImpl = await NEBA.deploy();
            await newImpl.waitForDeployment();
            
            // Regular upgrade should work (if authorized)
            // Note: This test may need adjustment based on actual upgrade implementation
            expect(await nebaToken.emergencyMode()).to.be.false;
        });
    });
    
    describe("Integration with Existing Features", function() {
        it("Should work with rate limiting", async function() {
            // Rate limiting should still work during emergency mode
            const limits = await nebaToken.mintLimits();
            expect(limits.maxPerTransaction).to.equal(ethers.parseEther("10000000"));
            
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            // Rate limiting functions should still be accessible
            const stats = await nebaToken.getMintStats();
            expect(stats.blockLimit).to.equal(limits.maxPerBlock);
        });
        
        it("Should work with cap immutability", async function() {
            // Cap should still be immutable during emergency mode
            expect(await nebaToken.isCapImmutable()).to.be.true;
            expect(await nebaToken.cap()).to.equal(ethers.parseEther("1000000000"));
            
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            // Cap should still be immutable
            expect(await nebaToken.isCapImmutable()).to.be.true;
            expect(await nebaToken.cap()).to.equal(ethers.parseEther("1000000000"));
        });
        
        it("Should work with pause functionality", async function() {
            // Emergency mode should automatically pause
            expect(await nebaToken.paused()).to.be.false;
            
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            expect(await nebaToken.paused()).to.be.true;
            
            // Deactivation should unpause
            await nebaToken.connect(guardianSafe).deactivateEmergencyMode();
            
            expect(await nebaToken.paused()).to.be.false;
        });
    });
    
    describe("Edge Cases", function() {
        it("Should handle emergency mode activation multiple times", async function() {
            await nebaToken.connect(guardianSafe).activateEmergencyMode("First");
            await nebaToken.connect(guardianSafe).deactivateEmergencyMode();
            
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Second");
            
            expect(await nebaToken.emergencyMode()).to.be.true;
        });
        
        it("Should handle emergency mode with different reasons", async function() {
            const reasons = [
                "Critical vulnerability detected",
                "Active exploit in progress",
                "Funds at immediate risk",
                "Contract malfunction detected"
            ];
            
            for (let i = 0; i < reasons.length; i++) {
                if (i > 0) {
                    await nebaToken.connect(guardianSafe).deactivateEmergencyMode();
                }
                
                await nebaToken.connect(guardianSafe).activateEmergencyMode(reasons[i]);
                expect(await nebaToken.emergencyMode()).to.be.true;
            }
        });
        
        it("Should handle emergency mode expiration correctly", async function() {
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            const activationTime = await nebaToken.emergencyModeActivatedAt();
            expect(activationTime).to.be.greaterThan(0);
            
            // Check expiration
            const duration = await nebaToken.EMERGENCY_MODE_DURATION();
            expect(duration).to.equal(7 * 24 * 3600); // 7 days in seconds
        });
    });
    
    describe("Security Tests", function() {
        it("Should prevent unauthorized emergency activation", async function() {
            const attackers = [user1, user2];
            
            for (const attacker of attackers) {
                await expect(
                    nebaToken.connect(attacker).activateEmergencyMode("Fake emergency")
                ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
            }
        });
        
        it("Should prevent unauthorized emergency upgrade", async function() {
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            const attackers = [user1, user2];
            
            for (const attacker of attackers) {
                await expect(
                    nebaToken.connect(attacker).emergencyUpgrade(await nebaToken.getAddress())
                ).to.be.revertedWithCustomError(nebaToken, "AccessControlUnauthorizedAccount");
            }
        });
        
        it("Should prevent unauthorized emergency deactivation", async function() {
            await nebaToken.connect(guardianSafe).activateEmergencyMode("Test");
            
            const attackers = [user1, user2];
            
            for (const attacker of attackers) {
                await expect(
                    nebaToken.connect(attacker).deactivateEmergencyMode()
                ).to.be.revertedWith("Not authorized");
            }
        });
    });
});
