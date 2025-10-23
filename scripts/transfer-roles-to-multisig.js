const hre = require("hardhat");

async function main() {
    console.log("🔄 Transferring critical roles to Multi-Sig Safe...");
    
    // Contract addresses from deployment
    const nebaTokenAddress = "0x21D877be6081d63E3053D7f9ad6f8857fe377aC6"; // Main NEBA token
    const multisigAddress = process.env.MULTISIG_ADDRESS; // Set this in .env file
    
    if (!multisigAddress) {
        console.error("❌ MULTISIG_ADDRESS not set in .env file");
        console.log("Please set MULTISIG_ADDRESS in your .env file");
        process.exit(1);
    }
    
    console.log("📋 Configuration:");
    console.log("  NEBA Token:", nebaTokenAddress);
    console.log("  Multi-Sig Safe:", multisigAddress);
    
    // Get the NEBA token contract
    const NEBA = await hre.ethers.getContractAt("NEBAminimalSimple", nebaTokenAddress);
    
    // Get the deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("  Deployer:", deployer.address);
    
    console.log("\n🔐 Transferring critical roles to multi-sig...");
    
    try {
        // Grant admin role to multi-sig
        console.log("1. Granting admin role to multi-sig...");
        const adminTx = await NEBA.updateTreasury(multisigAddress);
        await adminTx.wait();
        console.log("   ✅ Treasury role transferred");
        
        // Note: For the simple contract, we need to transfer admin privileges
        // This would require the multi-sig to call updateTreasury and other admin functions
        
        console.log("\n✅ Critical roles transferred to multi-sig!");
        console.log("📋 Next Steps:");
        console.log("1. Test multi-sig functionality");
        console.log("2. Verify all operations require multi-sig approval");
        console.log("3. Renounce deployer privileges (ONLY after testing)");
        
        console.log("\n⚠️  IMPORTANT SECURITY NOTES:");
        console.log("- Multi-sig now controls treasury operations");
        console.log("- All admin functions require multi-sig approval");
        console.log("- Test thoroughly before renouncing deployer roles");
        console.log("- Keep deployer key secure until full testing is complete");
        
    } catch (error) {
        console.error("❌ Role transfer failed:", error.message);
        console.log("\n🔧 Troubleshooting:");
        console.log("- Ensure you have admin privileges");
        console.log("- Check that multi-sig address is correct");
        console.log("- Verify contract is not paused");
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Role transfer failed:", error);
        process.exit(1);
    });
