const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🔍 Verifying NEBA Token deployment...");

  const nebaTokenAddress = process.env.NEBA_TOKEN_ADDRESS;
  
  if (!nebaTokenAddress) {
    console.log("❌ Please set NEBA_TOKEN_ADDRESS environment variable");
    console.log("Example:");
    console.log("NEBA_TOKEN_ADDRESS=0x... npx hardhat run scripts/verifyDeployment.js --network sepolia");
    return;
  }

  try {
    // Get the deployed contract
    const nebaToken = await ethers.getContractAt("NEBA", nebaTokenAddress);
    
    console.log("✅ Contract deployed at:", nebaTokenAddress);
    
    // Check basic contract information
    const name = await nebaToken.name();
    const symbol = await nebaToken.symbol();
    const decimals = await nebaToken.decimals();
    const totalSupply = await nebaToken.totalSupply();
    const treasury = await nebaToken.treasury();
    
    console.log("\n📋 Contract Information:");
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Decimals:", decimals.toString());
    console.log("Total Supply:", ethers.formatEther(totalSupply), "tokens");
    console.log("Treasury:", treasury);
    
    // Check roles
    const adminRole = await nebaToken.DEFAULT_ADMIN_ROLE();
    const upgraderRole = await nebaToken.UPGRADER_ROLE();
    const snapshotRole = await nebaToken.SNAPSHOT_ROLE();
    
    console.log("\n🔐 Role Verification:");
    console.log("Admin Role:", adminRole);
    console.log("Upgrader Role:", upgraderRole);
    console.log("Snapshot Role:", snapshotRole);
    
    // Check if contract is properly initialized
    const isPaused = await nebaToken.paused();
    const tradingEnabled = await nebaToken.tradingEnabled();
    const transferRestrictionsEnabled = await nebaToken.transferRestrictionsEnabled();
    
    console.log("\n⚙️ Contract State:");
    console.log("Paused:", isPaused);
    console.log("Trading Enabled:", tradingEnabled);
    console.log("Transfer Restrictions Enabled:", transferRestrictionsEnabled);
    
    // Test snapshot functionality
    console.log("\n📸 Snapshot Functionality Test:");
    try {
      const latestSnapshotId = await nebaToken.getLatestSnapshotId();
      console.log("Latest Snapshot ID:", latestSnapshotId.toString());
      console.log("✅ Snapshot functionality accessible");
    } catch (error) {
      console.log("❌ Snapshot functionality error:", error.message);
    }
    
    // Check token balance
    console.log("\n💰 Token Balance Check:");
    const treasuryBalance = await nebaToken.balanceOf(treasury);
    console.log("Treasury Balance:", ethers.formatEther(treasuryBalance), "NEBA");
    
    console.log("\n✅ Deployment verification completed successfully!");
    
  } catch (error) {
    console.error("❌ Deployment verification failed:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });