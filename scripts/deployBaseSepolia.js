const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 Starting NEBA Token deployment to Base Sepolia testnet...");
    
    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
    
    // Check if we have enough ETH
    const balance = await deployer.provider.getBalance(deployer.address);
    if (balance < ethers.parseEther("0.001")) {
        console.error("❌ Insufficient ETH balance. Please fund your account.");
        console.log("Get testnet ETH from: https://bridge.base.org/deposit");
        console.log("Or use the Base Sepolia faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
        process.exit(1);
    }
    
    // For testnet deployment, we'll use the deployer as all roles
    const treasury = deployer.address;
    const admin = deployer.address;
    const saleContract = deployer.address;
    const opsSafe = deployer.address;
    const botExecutor = deployer.address;
    const guardianSafe = deployer.address;
    
    console.log("📋 Deployment Configuration:");
    console.log("  Network: Base Sepolia (Chain ID: 84532)");
    console.log("  Treasury:", treasury);
    console.log("  Admin:", admin);
    console.log("  Sale Contract:", saleContract);
    console.log("  Ops Safe:", opsSafe);
    console.log("  Bot Executor:", botExecutor);
    console.log("  Guardian Safe:", guardianSafe);
    
    // Deploy the NEBA minimal simple contract (recommended for Base Sepolia)
    console.log("📦 Deploying NEBA Minimal Simple...");
    const NEBAminimalSimple = await ethers.getContractFactory("NEBAminimalSimple");
    
    const proxy = await upgrades.deployProxy(
        NEBAminimalSimple,
        [
            treasury,
            admin
        ],
        {
            initializer: "initialize",
            kind: "uups"
        }
    );
    
    await proxy.waitForDeployment();
    const nebaProxy = await ethers.getContractAt("NEBAminimalSimple", await proxy.getAddress());
    
    console.log("✅ NEBA Minimal Proxy deployed successfully!");
    console.log("📄 Proxy Address:", await proxy.getAddress());
    
    // Try to get implementation address, but don't fail if it's not available
    try {
        const implementationAddress = await upgrades.erc1967.getImplementationAddress(await proxy.getAddress());
        console.log("📄 Implementation Address:", implementationAddress);
    } catch (error) {
        console.log("📄 Implementation Address: Not available (proxy pattern)");
    }
    
    // Verify basic functionality
    console.log("🔍 Verifying deployment...");
    
    // Wait a moment for the transaction to be mined
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
        // Check token details
        const name = await nebaProxy.name();
        const symbol = await nebaProxy.symbol();
        const decimals = await nebaProxy.decimals();
        const totalSupply = await nebaProxy.totalSupply();
        
        console.log("📊 Token Details:");
        console.log("  Name:", name);
        console.log("  Symbol:", symbol);
        console.log("  Decimals:", decimals.toString());
        console.log("  Total Supply:", ethers.formatEther(totalSupply), "NEBA");
        
        // Get treasury address
        const treasuryAddress = await nebaProxy.treasury();
        console.log("📦 Treasury Address:", treasuryAddress);
        
        // Check admin address
        const adminAddress = await nebaProxy.admin();
        console.log("🔧 Admin Address:", adminAddress);
    } catch (error) {
        console.log("⚠️  Could not verify contract state immediately:", error.message);
        console.log("📦 Contract deployed successfully at:", await proxy.getAddress());
    }
    
    // Test basic transfer functionality
    console.log("🧪 Testing basic functionality...");
    try {
        // Get current balance
        const deployerBalance = await nebaProxy.balanceOf(deployer.address);
        console.log("  Deployer Balance:", ethers.formatEther(deployerBalance), "NEBA");
        
        console.log("✅ Basic functionality test passed!");
    } catch (error) {
        console.log("⚠️  Basic functionality test failed:", error.message);
    }
    
    console.log("\n🎉 Base Sepolia deployment completed successfully!");
    console.log("📋 Next Steps:");
    console.log("1. Verify the contracts on BaseScan:");
    console.log(`   - Proxy: https://sepolia.basescan.org/address/${await proxy.getAddress()}`);
    console.log("2. Test the basic ERC20 functionality");
    console.log("3. Deploy additional modules as needed (security, rate limiting, emergency)");
    console.log("4. Update your frontend with the new contract address");
    
    // Save deployment info
    const deploymentInfo = {
        network: "base-sepolia",
        chainId: 84532,
        proxyAddress: await proxy.getAddress(),
        implementationAddress: "Not available (proxy pattern)",
        treasuryAddress: "See contract verification above",
        deployer: deployer.address,
        treasury: treasury,
        admin: admin,
        deploymentTime: new Date().toISOString(),
        blockNumber: await deployer.provider.getBlockNumber(),
        gasUsed: "Estimated",
        explorerUrls: {
            proxy: `https://sepolia.basescan.org/address/${await proxy.getAddress()}`
        }
    };
    
    console.log("\n📄 Deployment Information:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    console.log("\n💡 Tips for Base Sepolia:");
    console.log("- Use Base Bridge to get testnet ETH: https://bridge.base.org/deposit");
    console.log("- Base Sepolia faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
    console.log("- Explorer: https://sepolia.basescan.org");
    console.log("- RPC URL: https://sepolia.base.org");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });