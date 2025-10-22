const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🔒 NEBA Token Atomic Deployment with Validation");
    console.log("================================================");
    
    // Load configuration from environment
    const config = {
        mainSafe: process.env.MAIN_SAFE || process.env.ADMIN_ADDRESS,
        opsSafe: process.env.OPS_SAFE,
        secSafe: process.env.SEC_SAFE,
        botExecutor: process.env.BOT_EXECUTOR,
        saleContract: process.env.SALE_CONTRACT,
        treasury: process.env.TREASURY_ADDRESS || process.env.MAIN_SAFE,
        commitTimeout: process.env.COMMIT_TIMEOUT || "3600",
        circuitBreakerResetInterval: process.env.CIRCUIT_BREAKER_RESET_INTERVAL || "86400"
    };
    
    console.log("🔍 Configuration loaded:");
    console.log("  Main Safe:", config.mainSafe);
    console.log("  Ops Safe:", config.opsSafe);
    console.log("  Sec Safe:", config.secSafe);
    console.log("  Bot Executor:", config.botExecutor);
    console.log("  Sale Contract:", config.saleContract);
    console.log("  Treasury:", config.treasury);
    
    // Validate required addresses
    const requiredAddresses = [
        { name: "MAIN_SAFE", value: config.mainSafe },
        { name: "OPS_SAFE", value: config.opsSafe },
        { name: "SEC_SAFE", value: config.secSafe },
        { name: "BOT_EXECUTOR", value: config.botExecutor },
        { name: "SALE_CONTRACT", value: config.saleContract },
        { name: "TREASURY", value: config.treasury }
    ];
    
    for (const addr of requiredAddresses) {
        if (!addr.value || addr.value === "0x0000000000000000000000000000000000000000") {
            console.error(`❌ ${addr.name} is not set or is zero address`);
            console.error("Please set all required addresses in .env file");
            process.exit(1);
        }
    }
    
    // Deploy validator first
    console.log("\n🔧 Deploying validation contract...");
    const Validator = await ethers.getContractFactory("DeploymentValidator");
    const validator = await Validator.deploy();
    await validator.waitForDeployment();
    console.log("✅ Validator deployed at:", await validator.getAddress());
    
    // Deploy implementation first
    console.log("\n🔧 Deploying NEBA implementation...");
    const NEBA = await ethers.getContractFactory("NEBA");
    const implementation = await NEBA.deploy();
    await implementation.waitForDeployment();
    console.log("✅ Implementation deployed at:", await implementation.getAddress());
    
    // PRE-DEPLOYMENT VALIDATION
    console.log("\n🔒 Running pre-deployment validation...");
    
    try {
        const deploymentConfig = {
            mainSafe: config.mainSafe,
            opsSafe: config.opsSafe,
            secSafe: config.secSafe,
            botExecutor: config.botExecutor,
            saleContract: config.saleContract,
            implementation: await implementation.getAddress()
        };
        
        // Validate configuration
        await validator.validateDeployment(deploymentConfig);
        console.log("✅ Pre-deployment validation PASSED");
        
    } catch (error) {
        console.error("❌ PRE-DEPLOYMENT VALIDATION FAILED:");
        console.error(error.message);
        console.error("\n🛑 Deployment aborted. Fix configuration and try again.");
        console.error("\nChecklist:");
        console.error("1. All addresses must be non-zero");
        console.error("2. All safes must be different addresses");
        console.error("3. Sale contract must be deployed");
        console.error("4. All safes must be multi-sig contracts (have code)");
        process.exit(1);
    }
    
    // ATOMIC DEPLOYMENT
    console.log("\n🚀 Starting atomic deployment...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());
    
    // Deploy proxy with initialization in single transaction
    const proxy = await upgrades.deployProxy(
        NEBA,
        [
            config.treasury,
            config.mainSafe,
            config.saleContract,
            config.opsSafe,
            config.botExecutor,
            parseInt(config.commitTimeout),
            parseInt(config.circuitBreakerResetInterval)
        ],
        {
            initializer: "initialize",
            kind: "uups"
        }
    );
    
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    console.log("✅ Proxy deployed at:", proxyAddress);
    
    // POST-DEPLOYMENT VERIFICATION
    console.log("\n🔍 Running post-deployment verification...");
    
    try {
        await validator.verifyPostDeployment(
            proxyAddress,
            config.mainSafe,
            config.opsSafe,
            config.botExecutor,
            config.saleContract
        );
        console.log("✅ Post-deployment verification PASSED");
        
    } catch (error) {
        console.error("❌ POST-DEPLOYMENT VERIFICATION FAILED:");
        console.error(error.message);
        console.error("\n⚠️  Deployment completed but verification failed!");
        console.error("Manual investigation required.");
        process.exit(1);
    }
    
    // Additional manual verification
    console.log("\n🔍 Manual verification checks...");
    
    // Check deployer has no roles
    const DEFAULT_ADMIN_ROLE = await proxy.DEFAULT_ADMIN_ROLE();
    const UPGRADER_ROLE = await proxy.UPGRADER_ROLE();
    const RECOVERY_ROLE = await proxy.RECOVERY_ROLE();
    const MINTER_ROLE = await proxy.MINTER_ROLE();
    const ADMIN_PAUSER_ROLE = await proxy.ADMIN_PAUSER_ROLE();
    const BOT_PAUSER_ROLE = await proxy.BOT_PAUSER_ROLE();
    
    const deployerHasAdmin = await proxy.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
    const deployerHasUpgrader = await proxy.hasRole(UPGRADER_ROLE, deployer.address);
    const deployerHasRecovery = await proxy.hasRole(RECOVERY_ROLE, deployer.address);
    const deployerHasMinter = await proxy.hasRole(MINTER_ROLE, deployer.address);
    const deployerHasPauser = await proxy.hasRole(ADMIN_PAUSER_ROLE, deployer.address);
    const deployerHasBotPauser = await proxy.hasRole(BOT_PAUSER_ROLE, deployer.address);
    
    console.log("Deployer role verification:");
    console.log("  Has DEFAULT_ADMIN_ROLE:", deployerHasAdmin);
    console.log("  Has UPGRADER_ROLE:", deployerHasUpgrader);
    console.log("  Has RECOVERY_ROLE:", deployerHasRecovery);
    console.log("  Has MINTER_ROLE:", deployerHasMinter);
    console.log("  Has ADMIN_PAUSER_ROLE:", deployerHasPauser);
    console.log("  Has BOT_PAUSER_ROLE:", deployerHasBotPauser);
    
    if (deployerHasAdmin || deployerHasUpgrader || deployerHasRecovery || 
        deployerHasMinter || deployerHasPauser || deployerHasBotPauser) {
        console.error("❌ CRITICAL: Deployer has roles! This is a security issue!");
        process.exit(1);
    }
    
    // Check role assignments
    const adminHasAdmin = await proxy.hasRole(DEFAULT_ADMIN_ROLE, config.mainSafe);
    const adminHasRecovery = await proxy.hasRole(RECOVERY_ROLE, config.mainSafe);
    const saleContractHasMinter = await proxy.hasRole(MINTER_ROLE, config.saleContract);
    const opsSafeHasPauser = await proxy.hasRole(ADMIN_PAUSER_ROLE, config.opsSafe);
    const botExecutorHasBotPauser = await proxy.hasRole(BOT_PAUSER_ROLE, config.botExecutor);
    
    console.log("Role assignment verification:");
    console.log("  Main Safe has DEFAULT_ADMIN_ROLE:", adminHasAdmin);
    console.log("  Main Safe has RECOVERY_ROLE:", adminHasRecovery);
    console.log("  Sale Contract has MINTER_ROLE:", saleContractHasMinter);
    console.log("  Ops Safe has ADMIN_PAUSER_ROLE:", opsSafeHasPauser);
    console.log("  Bot Executor has BOT_PAUSER_ROLE:", botExecutorHasBotPauser);
    
    if (!adminHasAdmin || !adminHasRecovery || !saleContractHasMinter || 
        !opsSafeHasPauser || !botExecutorHasBotPauser) {
        console.error("❌ CRITICAL: Role assignments are incorrect!");
        process.exit(1);
    }
    
    // Check role admins
    const upgraderAdmin = await proxy.getRoleAdmin(UPGRADER_ROLE);
    const upgraderAdminAdmin = await proxy.getRoleAdmin(await proxy.UPGRADER_ADMIN_ROLE());
    
    console.log("Role admin verification:");
    console.log("  UPGRADER_ROLE admin:", upgraderAdmin);
    console.log("  UPGRADER_ADMIN_ROLE admin:", upgraderAdminAdmin);
    console.log("  UPGRADER_ADMIN_ROLE address:", await proxy.UPGRADER_ADMIN_ROLE());
    
    if (upgraderAdmin !== await proxy.UPGRADER_ADMIN_ROLE()) {
        console.error("❌ CRITICAL: UPGRADER_ROLE admin is incorrect!");
        process.exit(1);
    }
    if (upgraderAdminAdmin !== await proxy.UPGRADER_ADMIN_ROLE()) {
        console.error("❌ CRITICAL: UPGRADER_ADMIN_ROLE should be self-admin!");
        process.exit(1);
    }
    
    // Generate deployment report
    console.log("\n📄 DEPLOYMENT REPORT");
    console.log("==================");
    console.log("✅ Implementation:", await implementation.getAddress());
    console.log("✅ Proxy (Token):", proxyAddress);
    console.log("✅ Validator:", await validator.getAddress());
    console.log("✅ Block Number:", (await ethers.provider.getBlock("latest")).number);
    console.log("✅ Deployer:", deployer.address);
    console.log("✅ Network:", hre.network.name);
    
    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        proxyAddress: proxyAddress,
        implementationAddress: await implementation.getAddress(),
        validatorAddress: await validator.getAddress(),
        adminAddress: config.mainSafe,
        treasuryAddress: config.treasury,
        saleContractAddress: config.saleContract,
        opsSafeAddress: config.opsSafe,
        secSafeAddress: config.secSafe,
        botExecutorAddress: config.botExecutor,
        deployerAddress: deployer.address,
        transactionHash: proxy.deploymentTransaction()?.hash,
        blockNumber: await proxy.deploymentTransaction()?.getBlockNumber(),
        timestamp: new Date().toISOString(),
        validationPassed: true
    };
    
    console.log("\n📋 Deployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    // Save to file
    const fs = require('fs');
    const path = require('path');
    const deploymentFile = path.join(__dirname, '..', 'deployments', `${hre.network.name}-validated.json`);
    
    // Ensure deployments directory exists
    const deploymentsDir = path.dirname(deploymentFile);
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`📁 Deployment info saved to: ${deploymentFile}`);
    
    console.log("\n🎉 DEPLOYMENT SUCCESSFUL WITH VALIDATION");
    console.log("✅ All checks passed");
    console.log("✅ Roles correctly assigned");
    console.log("✅ Deployer has no roles");
    console.log("✅ Ready for production use");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
