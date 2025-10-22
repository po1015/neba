const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Starting contract verification on BaseScan...");
    
    const contracts = [
        {
            name: "NEBA Token (Main Contract)",
            address: "0x21D877be6081d63E3053D7f9ad6f8857fe377aC6",
            contract: "NEBAminimalSimple"
        },
        {
            name: "Security Module",
            address: "0x882C327dC991940674a0Ad17466cb3663f0bF42D",
            contract: "NEBAsecurity"
        },
        {
            name: "Rate Limiting Module",
            address: "0x49349814Ab2479233A28dEB909A5a0a2D77C7afe",
            contract: "NEBArateLimiting"
        },
        {
            name: "Emergency Module",
            address: "0x67d1422f5C107D5C719d5721cd28C93fA04C4707",
            contract: "NEBAemergency"
        },
        {
            name: "Circuit Breaker",
            address: "0xf009E3d72E99b962Cd158bCBBfF75a1179E2c289",
            contract: "CircuitBreaker"
        },
        {
            name: "Transfer Hook",
            address: "0x6883EC349bd2F7F1C25E05CDe8F577ECb4eE481c",
            contract: "TransferHook"
        }
    ];
    
    console.log("📋 Contract Verification Status:");
    console.log("=====================================");
    
    for (const contract of contracts) {
        try {
            console.log(`\n🔍 Verifying ${contract.name}...`);
            console.log(`   Address: ${contract.address}`);
            console.log(`   Explorer: https://sepolia.basescan.org/address/${contract.address}`);
            
            // Try to verify the contract
            try {
                await hre.run("verify:verify", {
                    address: contract.address,
                    constructorArguments: [],
                    contract: `contracts/${contract.contract}.sol:${contract.contract}`
                });
                console.log(`   ✅ Verification successful!`);
            } catch (verifyError) {
                if (verifyError.message.includes("Already Verified")) {
                    console.log(`   ✅ Already verified!`);
                } else {
                    console.log(`   ⚠️  Verification failed: ${verifyError.message}`);
                    console.log(`   📝 Manual verification may be required`);
                }
            }
            
        } catch (error) {
            console.log(`   ❌ Error verifying ${contract.name}: ${error.message}`);
        }
    }
    
    console.log("\n🎉 Contract verification process completed!");
    console.log("\n📋 Summary:");
    console.log("All contracts have been processed for verification.");
    console.log("Check the BaseScan explorer links above to confirm verification status.");
    
    console.log("\n🔗 Quick Links:");
    contracts.forEach(contract => {
        console.log(`   ${contract.name}: https://sepolia.basescan.org/address/${contract.address}`);
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Verification process failed:", error);
        process.exit(1);
    });
