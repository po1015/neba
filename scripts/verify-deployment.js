const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 NEBA Token Post-Deployment Verification");
    console.log("==========================================");
    
    // Load deployment info
    const deploymentFile = process.env.DEPLOYMENT_FILE || `deployments/${hre.network.name}-validated.json`;
    const fs = require('fs');
    const path = require('path');
    
    if (!fs.existsSync(deploymentFile)) {
        console.error(`❌ Deployment file not found: ${deploymentFile}`);
        console.error("Please provide DEPLOYMENT_FILE environment variable");
        process.exit(1);
    }
    
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    console.log("📋 Deployment info loaded from:", deploymentFile);
    
    const tokenAddress = deploymentInfo.proxyAddress;
    const mainSafe = deploymentInfo.adminAddress;
    const opsSafe = deploymentInfo.opsSafeAddress;
    const botExecutor = deploymentInfo.botExecutorAddress;
    const saleContract = deploymentInfo.saleContractAddress;
    
    console.log("Token Address:", tokenAddress);
    console.log("Main Safe:", mainSafe);
    console.log("Ops Safe:", opsSafe);
    console.log("Bot Executor:", botExecutor);
    console.log("Sale Contract:", saleContract);
    
    // Connect to deployed contract
    const NEBA = await ethers.getContractFactory("NEBA");
    const token = NEBA.attach(tokenAddress);
    
    console.log("\n🔍 Verifying contract state...");
    
    // Check basic contract info
    const name = await token.name();
    const symbol = await token.symbol();
    const totalSupply = await token.totalSupply();
    const cap = await token.cap();
    const migrated = await token.migrated();
    
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Total Supply: ${ethers.formatEther(totalSupply)}`);
    console.log(`Cap: ${ethers.formatEther(cap)}`);
    console.log(`Migrated: ${migrated}`);
    
    // Check roles
    console.log("\n🔍 Verifying role assignments...");
    
    const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
    const RECOVERY_ROLE = await token.RECOVERY_ROLE();
    const UPGRADER_ROLE = await token.UPGRADER_ROLE();
    const UPGRADER_ADMIN_ROLE = await token.UPGRADER_ADMIN_ROLE();
    const MINTER_ROLE = await token.MINTER_ROLE();
    const ADMIN_PAUSER_ROLE = await token.ADMIN_PAUSER_ROLE();
    const BOT_PAUSER_ROLE = await token.BOT_PAUSER_ROLE();
    
    // Check main safe roles
    const mainSafeHasAdmin = await token.hasRole(DEFAULT_ADMIN_ROLE, mainSafe);
    const mainSafeHasRecovery = await token.hasRole(RECOVERY_ROLE, mainSafe);
    const mainSafeHasUpgrader = await token.hasRole(UPGRADER_ROLE, mainSafe);
    const mainSafeHasUpgraderAdmin = await token.hasRole(UPGRADER_ADMIN_ROLE, mainSafe);
    
    console.log("Main Safe roles:");
    console.log(`  DEFAULT_ADMIN_ROLE: ${mainSafeHasAdmin}`);
    console.log(`  RECOVERY_ROLE: ${mainSafeHasRecovery}`);
    console.log(`  UPGRADER_ROLE: ${mainSafeHasUpgrader}`);
    console.log(`  UPGRADER_ADMIN_ROLE: ${mainSafeHasUpgraderAdmin}`);
    
    // Check other roles
    const saleContractHasMinter = await token.hasRole(MINTER_ROLE, saleContract);
    const opsSafeHasPauser = await token.hasRole(ADMIN_PAUSER_ROLE, opsSafe);
    const botExecutorHasBotPauser = await token.hasRole(BOT_PAUSER_ROLE, botExecutor);
    
    console.log("Other roles:");
    console.log(`  Sale Contract MINTER_ROLE: ${saleContractHasMinter}`);
    console.log(`  Ops Safe ADMIN_PAUSER_ROLE: ${opsSafeHasPauser}`);
    console.log(`  Bot Executor BOT_PAUSER_ROLE: ${botExecutorHasBotPauser}`);
    
    // Check role admins
    console.log("\n🔍 Verifying role admins...");
    
    const upgraderAdmin = await token.getRoleAdmin(UPGRADER_ROLE);
    const upgraderAdminAdmin = await token.getRoleAdmin(UPGRADER_ADMIN_ROLE);
    const upgraderAdminRole = await token.UPGRADER_ADMIN_ROLE();
    
    console.log(`UPGRADER_ROLE admin: ${upgraderAdmin}`);
    console.log(`UPGRADER_ADMIN_ROLE admin: ${upgraderAdminAdmin}`);
    console.log(`UPGRADER_ADMIN_ROLE address: ${upgraderAdminRole}`);
    
    // Check deployer has no roles
    console.log("\n🔍 Verifying deployer has no roles...");
    
    const deployer = deploymentInfo.deployerAddress;
    const deployerHasAdmin = await token.hasRole(DEFAULT_ADMIN_ROLE, deployer);
    const deployerHasUpgrader = await token.hasRole(UPGRADER_ROLE, deployer);
    const deployerHasRecovery = await token.hasRole(RECOVERY_ROLE, deployer);
    const deployerHasMinter = await token.hasRole(MINTER_ROLE, deployer);
    const deployerHasPauser = await token.hasRole(ADMIN_PAUSER_ROLE, deployer);
    const deployerHasBotPauser = await token.hasRole(BOT_PAUSER_ROLE, deployer);
    
    console.log("Deployer roles:");
    console.log(`  DEFAULT_ADMIN_ROLE: ${deployerHasAdmin}`);
    console.log(`  UPGRADER_ROLE: ${deployerHasUpgrader}`);
    console.log(`  RECOVERY_ROLE: ${deployerHasRecovery}`);
    console.log(`  MINTER_ROLE: ${deployerHasMinter}`);
    console.log(`  ADMIN_PAUSER_ROLE: ${deployerHasPauser}`);
    console.log(`  BOT_PAUSER_ROLE: ${deployerHasBotPauser}`);
    
    // Verify pause functionality
    console.log("\n🔍 Testing pause functionality...");
    
    const isPaused = await token.paused();
    console.log(`Contract paused: ${isPaused}`);
    
    // Test interface support
    console.log("\n🔍 Testing interface support...");
    
    const INEBAMinter = "0x40c10f19"; // Interface ID for mint(address,uint256)
    const supportsMinter = await token.supportsInterface(INEBAMinter);
    console.log(`Supports INEBAMinter: ${supportsMinter}`);
    
    // Summary
    console.log("\n📊 VERIFICATION SUMMARY");
    console.log("=======================");
    
    let allPassed = true;
    
    // Check critical requirements
    if (!mainSafeHasAdmin) {
        console.error("❌ Main Safe missing DEFAULT_ADMIN_ROLE");
        allPassed = false;
    }
    
    if (!mainSafeHasRecovery) {
        console.error("❌ Main Safe missing RECOVERY_ROLE");
        allPassed = false;
    }
    
    if (!saleContractHasMinter) {
        console.error("❌ Sale Contract missing MINTER_ROLE");
        allPassed = false;
    }
    
    if (!opsSafeHasPauser) {
        console.error("❌ Ops Safe missing ADMIN_PAUSER_ROLE");
        allPassed = false;
    }
    
    if (!botExecutorHasBotPauser) {
        console.error("❌ Bot Executor missing BOT_PAUSER_ROLE");
        allPassed = false;
    }
    
    if (deployerHasAdmin || deployerHasUpgrader || deployerHasRecovery || 
        deployerHasMinter || deployerHasPauser || deployerHasBotPauser) {
        console.error("❌ CRITICAL: Deployer has roles!");
        allPassed = false;
    }
    
    if (upgraderAdmin !== upgraderAdminRole) {
        console.error("❌ UPGRADER_ROLE admin is incorrect");
        allPassed = false;
    }
    
    if (upgraderAdminAdmin !== upgraderAdminRole) {
        console.error("❌ UPGRADER_ADMIN_ROLE should be self-admin");
        allPassed = false;
    }
    
    if (allPassed) {
        console.log("✅ ALL VERIFICATIONS PASSED");
        console.log("🎉 Deployment is secure and ready for use");
    } else {
        console.error("❌ VERIFICATION FAILED");
        console.error("🚨 CRITICAL ISSUES FOUND - MANUAL INTERVENTION REQUIRED");
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Verification failed:", error);
        process.exit(1);
    });
