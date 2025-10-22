const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 Starting NEBA Modules deployment to Base Sepolia...");
    
    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
    
    // Deploy Security Module
    console.log("📦 Deploying NEBA Security Module...");
    const NEBAsecurity = await ethers.getContractFactory("NEBAsecurity");
    const securityModule = await NEBAsecurity.deploy();
    await securityModule.waitForDeployment();
    
    console.log("✅ Security Module deployed at:", await securityModule.getAddress());
    
    // Deploy Rate Limiting Module
    console.log("📦 Deploying NEBA Rate Limiting Module...");
    const NEBArateLimiting = await ethers.getContractFactory("NEBArateLimiting");
    const rateLimitingModule = await NEBArateLimiting.deploy();
    await rateLimitingModule.waitForDeployment();
    
    console.log("✅ Rate Limiting Module deployed at:", await rateLimitingModule.getAddress());
    
    // Deploy Emergency Module
    console.log("📦 Deploying NEBA Emergency Module...");
    const NEBAemergency = await ethers.getContractFactory("NEBAemergency");
    const emergencyModule = await NEBAemergency.deploy();
    await emergencyModule.waitForDeployment();
    
    console.log("✅ Emergency Module deployed at:", await emergencyModule.getAddress());
    
    // Deploy Circuit Breaker
    console.log("📦 Deploying Circuit Breaker...");
    const CircuitBreaker = await ethers.getContractFactory("CircuitBreaker");
    const circuitBreaker = await CircuitBreaker.deploy();
    await circuitBreaker.waitForDeployment();
    
    console.log("✅ Circuit Breaker deployed at:", await circuitBreaker.getAddress());
    
    // Deploy Transfer Hook
    console.log("📦 Deploying Transfer Hook...");
    const TransferHook = await ethers.getContractFactory("TransferHook");
    const transferHook = await TransferHook.deploy();
    await transferHook.waitForDeployment();
    
    console.log("✅ Transfer Hook deployed at:", await transferHook.getAddress());
    
    console.log("\n🎉 All modules deployed successfully!");
    console.log("📋 Module Addresses:");
    console.log("  Security Module:", await securityModule.getAddress());
    console.log("  Rate Limiting Module:", await rateLimitingModule.getAddress());
    console.log("  Emergency Module:", await emergencyModule.getAddress());
    console.log("  Circuit Breaker:", await circuitBreaker.getAddress());
    console.log("  Transfer Hook:", await transferHook.getAddress());
    
    // Save deployment info
    const deploymentInfo = {
        network: "base-sepolia",
        chainId: 84532,
        deployer: deployer.address,
        deploymentTime: new Date().toISOString(),
        blockNumber: await deployer.provider.getBlockNumber(),
        modules: {
            securityModule: await securityModule.getAddress(),
            rateLimitingModule: await rateLimitingModule.getAddress(),
            emergencyModule: await emergencyModule.getAddress(),
            circuitBreaker: await circuitBreaker.getAddress(),
            transferHook: await transferHook.getAddress()
        },
        explorerUrls: {
            securityModule: `https://sepolia.basescan.org/address/${await securityModule.getAddress()}`,
            rateLimitingModule: `https://sepolia.basescan.org/address/${await rateLimitingModule.getAddress()}`,
            emergencyModule: `https://sepolia.basescan.org/address/${await emergencyModule.getAddress()}`,
            circuitBreaker: `https://sepolia.basescan.org/address/${await circuitBreaker.getAddress()}`,
            transferHook: `https://sepolia.basescan.org/address/${await transferHook.getAddress()}`
        }
    };
    
    console.log("\n📄 Deployment Information:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
