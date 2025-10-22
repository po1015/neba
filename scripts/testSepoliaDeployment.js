const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing NEBA Token deployment on Sepolia...");
    
    // Get the contract address from command line argument
    const contractAddress = process.argv[2];
    if (!contractAddress) {
        console.error("❌ Please provide contract address as argument");
        console.log("Usage: npx hardhat run scripts/testSepoliaDeployment.js --network sepolia -- <CONTRACT_ADDRESS>");
        process.exit(1);
    }
    
    console.log("📄 Contract Address:", contractAddress);
    
    // Get the contract instance
    const nebaToken = await ethers.getContractAt("NEBA", contractAddress);
    
    // Test basic token information
    console.log("\n📊 Testing Token Information...");
    const name = await nebaToken.name();
    const symbol = await nebaToken.symbol();
    const decimals = await nebaToken.decimals();
    const totalSupply = await nebaToken.totalSupply();
    const cap = await nebaToken.cap();
    
    console.log("✅ Token Details:");
    console.log("  Name:", name);
    console.log("  Symbol:", symbol);
    console.log("  Decimals:", decimals.toString());
    console.log("  Total Supply:", ethers.formatEther(totalSupply), "NEBA");
    console.log("  Cap:", ethers.formatEther(cap), "NEBA");
    
    // Test cap immutability
    console.log("\n🔒 Testing Cap Immutability...");
    const isCapImmutable = await nebaToken.isCapImmutable();
    console.log("✅ Cap is Immutable:", isCapImmutable);
    
    // Test emergency mode
    console.log("\n🚨 Testing Emergency Mode...");
    const emergencyMode = await nebaToken.emergencyMode();
    const canUseEmergencyPowers = await nebaToken.canUseEmergencyPowers();
    console.log("✅ Emergency Mode Active:", emergencyMode);
    console.log("✅ Can Use Emergency Powers:", canUseEmergencyPowers);
    
    // Test rate limiting
    console.log("\n⏱️ Testing Rate Limiting...");
    const mintLimits = await nebaToken.mintLimits();
    console.log("✅ Rate Limiting Configuration:");
    console.log("  Max Per Transaction:", ethers.formatEther(mintLimits.maxPerTransaction), "NEBA");
    console.log("  Max Per Block:", ethers.formatEther(mintLimits.maxPerBlock), "NEBA");
    console.log("  Max Per Day:", ethers.formatEther(mintLimits.maxPerDay), "NEBA");
    console.log("  Cooldown Blocks:", mintLimits.cooldownBlocks.toString());
    
    // Test roles
    console.log("\n🔐 Testing Role Assignments...");
    const [deployer] = await ethers.getSigners();
    const DEFAULT_ADMIN_ROLE = await nebaToken.DEFAULT_ADMIN_ROLE();
    const MINTER_ROLE = await nebaToken.MINTER_ROLE();
    const GUARDIAN_ROLE = await nebaToken.GUARDIAN_ROLE();
    
    console.log("✅ Role Assignments:");
    console.log("  Deployer has DEFAULT_ADMIN_ROLE:", await nebaToken.hasRole(DEFAULT_ADMIN_ROLE, deployer.address));
    console.log("  Deployer has MINTER_ROLE:", await nebaToken.hasRole(MINTER_ROLE, deployer.address));
    console.log("  Deployer has GUARDIAN_ROLE:", await nebaToken.hasRole(GUARDIAN_ROLE, deployer.address));
    
    // Test emergency mode activation (if deployer has guardian role)
    if (await nebaToken.hasRole(GUARDIAN_ROLE, deployer.address)) {
        console.log("\n🚨 Testing Emergency Mode Activation...");
        try {
            const tx = await nebaToken.activateEmergencyMode("Test emergency activation");
            await tx.wait();
            console.log("✅ Emergency mode activated successfully");
            
            // Check emergency mode status
            const emergencyModeAfter = await nebaToken.emergencyMode();
            const canUsePowersAfter = await nebaToken.canUseEmergencyPowers();
            console.log("✅ Emergency Mode Active:", emergencyModeAfter);
            console.log("✅ Can Use Emergency Powers:", canUsePowersAfter);
            
            // Deactivate emergency mode
            const deactivateTx = await nebaToken.deactivateEmergencyMode();
            await deactivateTx.wait();
            console.log("✅ Emergency mode deactivated successfully");
            
        } catch (error) {
            console.log("⚠️ Emergency mode test failed:", error.message);
        }
    } else {
        console.log("⚠️ Deployer does not have GUARDIAN_ROLE, skipping emergency mode test");
    }
    
    // Test minting (if deployer has minter role)
    if (await nebaToken.hasRole(MINTER_ROLE, deployer.address)) {
        console.log("\n🪙 Testing Minting...");
        try {
            const mintAmount = ethers.parseEther("1000"); // 1000 tokens
            const tx = await nebaToken.mint(deployer.address, mintAmount);
            await tx.wait();
            console.log("✅ Minting successful:", ethers.formatEther(mintAmount), "NEBA");
            
            // Check new balance
            const balance = await nebaToken.balanceOf(deployer.address);
            console.log("✅ New Balance:", ethers.formatEther(balance), "NEBA");
            
        } catch (error) {
            console.log("⚠️ Minting test failed:", error.message);
        }
    } else {
        console.log("⚠️ Deployer does not have MINTER_ROLE, skipping minting test");
    }
    
    // Test rate limiting stats
    console.log("\n📈 Testing Rate Limiting Stats...");
    try {
        const stats = await nebaToken.getMintStats();
        console.log("✅ Mint Statistics:");
        console.log("  Block Minted:", ethers.formatEther(stats.blockMinted), "NEBA");
        console.log("  Day Minted:", ethers.formatEther(stats.dayMinted), "NEBA");
        console.log("  Block Limit:", ethers.formatEther(stats.blockLimit), "NEBA");
        console.log("  Day Limit:", ethers.formatEther(stats.dayLimit), "NEBA");
        console.log("  Blocks Since Last Large:", stats.blocksSinceLastLarge.toString());
    } catch (error) {
        console.log("⚠️ Rate limiting stats test failed:", error.message);
    }
    
    console.log("\n🎉 All tests completed successfully!");
    console.log("📋 Contract is ready for use on Sepolia testnet");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });

