const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Diagnosing NEBA Token Contract Issues...");
  console.log("===========================================");

  const nebaTokenAddress = "0x75770723EBBed7D482b6F02b6244B411A86C9fC6";
  const nebaToken = await ethers.getContractAt("NEBA", nebaTokenAddress);
  const [deployer] = await ethers.getSigners();
  
  console.log("📋 Contract Details:");
  console.log("Contract Address:", nebaTokenAddress);
  console.log("Deployer:", deployer.address);
  
  const treasury = await nebaToken.treasury();
  console.log("Treasury:", treasury);
  console.log("Is Deployer Treasury?", deployer.address.toLowerCase() === treasury.toLowerCase());
  console.log("");
  
  // Check available functions
  console.log("🔧 Available Functions:");
  try {
    const functions = Object.keys(nebaToken.interface.functions);
    functions.forEach(func => {
      if (func.includes("Transfer") || func.includes("Whitelist") || func.includes("Pause")) {
        console.log(`   - ${func}`);
      }
    });
  } catch (error) {
    console.log("   Could not retrieve function list");
  }
  console.log("");
  
  // Check balances
  console.log("💰 Balances:");
  const deployerBalance = await nebaToken.balanceOf(deployer.address);
  const treasuryBalance = await nebaToken.balanceOf(treasury);
  console.log(`   Deployer: ${ethers.formatEther(deployerBalance)} NEBA`);
  console.log(`   Treasury: ${ethers.formatEther(treasuryBalance)} NEBA`);
  console.log("");
  
  // Test transfer with detailed error
  console.log("🧪 Testing Transfer (Detailed):");
  try {
    const transferAmount = ethers.parseEther("100");
    console.log(`   Attempting to transfer ${ethers.formatEther(transferAmount)} NEBA from treasury to deployer...`);
    
    // Check if we can call transfer on behalf of treasury
    const treasurySigner = await ethers.getImpersonatedSigner(treasury);
    const tx = await nebaToken.connect(treasurySigner).transfer(deployer.address, transferAmount);
    await tx.wait();
    console.log("   ✅ Transfer successful!");
    
    // Check new balances
    const newDeployerBalance = await nebaToken.balanceOf(deployer.address);
    const newTreasuryBalance = await nebaToken.balanceOf(treasury);
    console.log(`   New Deployer Balance: ${ethers.formatEther(newDeployerBalance)} NEBA`);
    console.log(`   New Treasury Balance: ${ethers.formatEther(newTreasuryBalance)} NEBA`);
    
  } catch (error) {
    console.log("   ❌ Transfer failed:");
    console.log(`   Error: ${error.message}`);
    if (error.reason) {
      console.log(`   Reason: ${error.reason}`);
    }
  }
  console.log("");
  
  // Test pause functionality
  console.log("⏸️ Testing Pause Functionality:");
  try {
    const isPaused = await nebaToken.paused();
    console.log(`   Current paused state: ${isPaused}`);
    
    if (!isPaused) {
      console.log("   Attempting to pause...");
      const pauseTx = await nebaToken.connect(deployer).pause();
      await pauseTx.wait();
      console.log("   ✅ Pause successful!");
      
      const newIsPaused = await nebaToken.paused();
      console.log(`   New paused state: ${newIsPaused}`);
    }
  } catch (error) {
    console.log("   ❌ Pause failed:");
    console.log(`   Error: ${error.message}`);
  }
  console.log("");
  
  // Check whitelist functions
  console.log("📝 Checking Whitelist Functions:");
  try {
    const transferRestrictionsEnabled = await nebaToken.transferRestrictionsEnabled();
    console.log(`   Transfer Restrictions Enabled: ${transferRestrictionsEnabled}`);
    
    // Try to find the correct function name
    try {
      const functions = Object.keys(nebaToken.interface.functions);
      const whitelistFunctions = functions.filter(f => f.includes("whitelist") || f.includes("Whitelist"));
      console.log("   Available whitelist functions:");
      whitelistFunctions.forEach(func => console.log(`     - ${func}`));
      
      if (whitelistFunctions.length > 0) {
        const whitelistTx = await nebaToken.connect(deployer)[whitelistFunctions[0]](deployer.address, true);
        await whitelistTx.wait();
        console.log("   ✅ Whitelist update successful!");
      }
    } catch (error) {
      console.log("   Could not access whitelist functions");
    }
  } catch (error) {
    console.log("   ❌ Whitelist operation failed:");
    console.log(`   Error: ${error.message}`);
  }
  console.log("");
  
  console.log("🔍 Diagnosis Complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Diagnosis failed:", error);
    process.exit(1);
  });
