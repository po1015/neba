const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Verifying NEBA Token contracts...");

  // Contract addresses (these would be updated after deployment)
  const nebaTokenAddress = process.env.NEBA_TOKEN_ADDRESS;
  const implementationAddress = process.env.IMPLEMENTATION_ADDRESS;
  
  if (!nebaTokenAddress || !implementationAddress) {
    console.log("Please set NEBA_TOKEN_ADDRESS and IMPLEMENTATION_ADDRESS environment variables");
    console.log("Example:");
    console.log("NEBA_TOKEN_ADDRESS=0x... IMPLEMENTATION_ADDRESS=0x... npx hardhat run scripts/verify.js --network sepolia");
    return;
  }

  try {
    console.log("Verifying NEBA Token proxy at:", nebaTokenAddress);
    
    // Verify the proxy contract
    await hre.run("verify:verify", {
      address: nebaTokenAddress,
      constructorArguments: [], // Proxy has no constructor args
    });
    
    console.log("✅ NEBA Token proxy verified successfully!");
    
    console.log("Verifying implementation contract at:", implementationAddress);
    
    // Verify the implementation contract
    await hre.run("verify:verify", {
      address: implementationAddress,
      constructorArguments: [], // Implementation has no constructor args
    });
    
    console.log("✅ Implementation contract verified successfully!");
    
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract already verified!");
    } else {
      console.error("❌ Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
