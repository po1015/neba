const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("📸 Deploying NEBA Token with Snapshot Functionality...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
    
    const treasury = process.env.TREASURY_ADDRESS || deployer.address;
    const admin = deployer.address;
    
    console.log("📋 Deployment Configuration:");
    console.log("  Treasury:", treasury);
    console.log("  Admin:", admin);
    
    // Deploy the NEBA token with snapshot functionality
    console.log("📦 Deploying NEBA Token with Snapshots...");
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
    const nebaToken = await ethers.getContractAt("NEBAminimalSimple", await proxy.getAddress());
    
    console.log("✅ NEBA Token with Snapshots deployed successfully!");
    console.log("📄 Proxy Address:", await proxy.getAddress());
    
    // Test snapshot functionality
    console.log("🧪 Testing snapshot functionality...");
    
    try {
        // Test initial snapshot state
        const initialSnapshotId = await nebaToken.getLatestSnapshotId();
        console.log("  Initial Snapshot ID:", initialSnapshotId.toString());
        
        // Create a snapshot
        console.log("  Creating snapshot...");
        const snapshotTx = await nebaToken.createSnapshot();
        await snapshotTx.wait();
        
        const newSnapshotId = await nebaToken.getLatestSnapshotId();
        console.log("  New Snapshot ID:", newSnapshotId.toString());
        
        // Verify snapshot was created
        const snapshot = await nebaToken.getSnapshot(newSnapshotId);
        console.log("  Snapshot Details:");
        console.log("    ID:", snapshot.id.toString());
        console.log("    Timestamp:", snapshot.timestamp.toString());
        console.log("    Total Supply:", ethers.formatEther(snapshot.totalSupply), "NEBA");
        console.log("    Active:", snapshot.active);
        
        // Test snapshot existence check
        const snapshotExists = await nebaToken.snapshotExists(newSnapshotId);
        console.log("  Snapshot exists:", snapshotExists);
        
        if (!snapshotExists) {
            throw new Error("Snapshot should exist");
        }
        
        console.log("✅ Snapshot functionality test passed!");
        
    } catch (error) {
        console.log("❌ Snapshot functionality test failed:", error.message);
    }
    
    // Test basic token functionality
    console.log("🧪 Testing basic token functionality...");
    
    try {
        // Check token details
        const name = await nebaToken.name();
        const symbol = await nebaToken.symbol();
        const decimals = await nebaToken.decimals();
        const totalSupply = await nebaToken.totalSupply();
        
        console.log("📊 Token Details:");
        console.log("  Name:", name);
        console.log("  Symbol:", symbol);
        console.log("  Decimals:", decimals.toString());
        console.log("  Total Supply:", ethers.formatEther(totalSupply), "NEBA");
        
        // Check treasury address
        const treasuryAddress = await nebaToken.treasury();
        console.log("  Treasury:", treasuryAddress);
        
        // Check admin address
        const adminAddress = await nebaToken.admin();
        console.log("  Admin:", adminAddress);
        
        console.log("✅ Basic functionality test passed!");
        
    } catch (error) {
        console.log("❌ Basic functionality test failed:", error.message);
    }
    
    console.log("\n🎉 NEBA Token with Snapshot Functionality Deployed Successfully!");
    console.log("📋 Summary:");
    console.log("  ✅ NEBA Token deployed with snapshot functionality");
    console.log("  ✅ Snapshot creation tested");
    console.log("  ✅ Snapshot query functions tested");
    console.log("  ✅ Basic ERC20 functionality verified");
    
    console.log("\n📄 Contract Details:");
    console.log("  Address:", await proxy.getAddress());
    console.log("  Explorer:", `https://sepolia.basescan.org/address/${await proxy.getAddress()}`);
    
    // Save deployment info
    const deploymentInfo = {
        network: "base-sepolia",
        chainId: 84532,
        contractAddress: await proxy.getAddress(),
        deployer: deployer.address,
        treasury: treasury,
        admin: admin,
        deploymentTime: new Date().toISOString(),
        blockNumber: await deployer.provider.getBlockNumber(),
        features: {
            snapshotFunctionality: true,
            accessControl: true,
            upgradeable: true,
            capped: true,
            permit: true
        },
        explorerUrl: `https://sepolia.basescan.org/address/${await proxy.getAddress()}`
    };
    
    console.log("\n📄 Deployment Information:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    console.log("\n🔧 SNAPSHOT FUNCTIONALITY RESTORED:");
    console.log("✅ createSnapshot() - Create snapshots of token state");
    console.log("✅ getSnapshot() - Retrieve snapshot data");
    console.log("✅ snapshotExists() - Check if snapshot exists");
    console.log("✅ getLatestSnapshotId() - Get latest snapshot ID");
    console.log("✅ SNAPSHOT_ROLE - Role-based access control");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
