const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 NEBA Token Deployment Validation");
    console.log("===================================");
    
    // Load configuration
    const config = {
        mainSafe: process.env.MAIN_SAFE || process.env.ADMIN_ADDRESS,
        opsSafe: process.env.OPS_SAFE,
        secSafe: process.env.SEC_SAFE,
        botExecutor: process.env.BOT_EXECUTOR,
        saleContract: process.env.SALE_CONTRACT,
        treasury: process.env.TREASURY_ADDRESS || process.env.MAIN_SAFE
    };
    
    console.log("📋 Configuration:");
    console.log(JSON.stringify(config, null, 2));
    
    // Check for zero addresses
    console.log("\n🔍 Checking for zero addresses...");
    const addresses = [
        { name: "MAIN_SAFE", value: config.mainSafe },
        { name: "OPS_SAFE", value: config.opsSafe },
        { name: "SEC_SAFE", value: config.secSafe },
        { name: "BOT_EXECUTOR", value: config.botExecutor },
        { name: "SALE_CONTRACT", value: config.saleContract },
        { name: "TREASURY", value: config.treasury }
    ];
    
    let hasErrors = false;
    
    for (const addr of addresses) {
        if (!addr.value || addr.value === "0x0000000000000000000000000000000000000000") {
            console.error(`❌ ${addr.name} is not set or is zero address`);
            hasErrors = true;
        } else {
            console.log(`✅ ${addr.name}: ${addr.value}`);
        }
    }
    
    if (hasErrors) {
        console.error("\n❌ Address validation failed!");
        process.exit(1);
    }
    
    // Check for duplicate addresses
    console.log("\n🔍 Checking for duplicate addresses...");
    const uniqueAddresses = new Set();
    for (const addr of addresses) {
        if (uniqueAddresses.has(addr.value)) {
            console.error(`❌ Duplicate address found: ${addr.value}`);
            hasErrors = true;
        } else {
            uniqueAddresses.add(addr.value);
        }
    }
    
    if (hasErrors) {
        console.error("\n❌ Duplicate address validation failed!");
        process.exit(1);
    }
    
    console.log("✅ All addresses are unique");
    
    // Check contract code
    console.log("\n🔍 Checking contract code...");
    
    for (const addr of addresses) {
        try {
            const code = await ethers.provider.getCode(addr.value);
            if (code === "0x") {
                console.error(`❌ ${addr.name} has no code (not a contract)`);
                hasErrors = true;
            } else {
                console.log(`✅ ${addr.name} has contract code (${code.length} bytes)`);
            }
        } catch (error) {
            console.error(`❌ Error checking ${addr.name}: ${error.message}`);
            hasErrors = true;
        }
    }
    
    if (hasErrors) {
        console.error("\n❌ Contract code validation failed!");
        process.exit(1);
    }
    
    // Check network
    console.log("\n🔍 Checking network...");
    const network = await ethers.provider.getNetwork();
    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
    
    if (network.chainId === 1n) {
        console.log("⚠️  WARNING: You are on MAINNET!");
        console.log("Make sure all addresses are correct before proceeding.");
    }
    
    // Check deployer balance
    console.log("\n🔍 Checking deployer balance...");
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    const balanceEth = ethers.formatEther(balance);
    
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance: ${balanceEth} ETH`);
    
    if (balance < ethers.parseEther("0.01")) {
        console.error("❌ Insufficient balance for deployment!");
        hasErrors = true;
    }
    
    if (hasErrors) {
        console.error("\n❌ Validation failed!");
        process.exit(1);
    }
    
    console.log("\n✅ All validations passed!");
    console.log("🚀 Ready for deployment");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Validation failed:", error);
        process.exit(1);
    });
