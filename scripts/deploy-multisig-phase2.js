const hre = require("hardhat");

async function main() {
    console.log("🔐 Deploying Multi-Signature Safe for NEBA Token Phase 2...");
    
    // Your 17 addresses from the audit report
    const owners = [
        "0xB5A3e2d7FdbeC9CFE0282340983449E161c761Ea",
        "0xA13b244f7BF883BCbC6BbAF6D1965E31dbEFc398",
        "0xe28C24908567074FED680B814F3776344287394C",
        "0x129821Af250cE8152207526618bDd503f2134bd3",
        "0x44275be3628b51eA116873aD4B7e5e5D3Da8A993",
        "0xe927FEf8E5DE8270FF317b11F5Be197220A99967",
        "0xC4d7e97FE98Fb48558f89F9c07b0E5Bb93D00EF4",
        "0xbB1D70620396F6AA6d9fEDB1a3457F7AcD9647fc",
        "0x30BBC43Ac8c1A7fc5a1834b31cC068bd485E6a1b",
        "0xbA5D6C5a752350e83EC93160b2Be01B0Cf9265C3",
        "0xe42Fa8e17595E3800f5Ec41F1d0E488834E1030D",
        "0xCc240F007D672BE3b1a6AE0106E1Ec586Fe62a6E",
        "0x28eEEBE47252935C505E8BC2F6CfB92bd94b77de",
        "0x9A03095609d6A189f8e402a59ACa0a7ceCb59F4a",
        "0x4B9D4DAdE0e229cDdd8ce17ccE10094834768eE8",
        "0x2112f838cBF812343d806aeDb3c7479C2AFEf2E8",
        "0xC5DBE0696Fa96910BE18e4b7a83c2d89Cc4574Ff"
    ];

    const threshold = 9; // 9 out of 17 signatures required

    console.log(`📋 Setting up Multi-Sig Safe with ${owners.length} owners`);
    console.log(`🔐 Threshold: ${threshold} signatures required`);

    // Deploy Gnosis Safe using their factory
    const GnosisSafeProxyFactory = await hre.ethers.getContractAt(
        "GnosisSafeProxyFactory",
        "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2" // Base Sepolia address
    );

    const GnosisSafeMasterCopy = "0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552"; // Base Sepolia

    // Setup data for Safe initialization
    const setupData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "uint256", "address", "bytes", "address", "address", "uint256", "address"],
        [
            owners,
            threshold,
            "0x0000000000000000000000000000000000000000", // to
            "0x", // data
            "0x0000000000000000000000000000000000000000", // fallbackHandler
            "0x0000000000000000000000000000000000000000", // paymentToken
            0, // payment
            "0x0000000000000000000000000000000000000000" // paymentReceiver
        ]
    );

    console.log("🚀 Creating Safe proxy...");
    const tx = await GnosisSafeProxyFactory.createProxyWithNonce(
        GnosisSafeMasterCopy,
        setupData,
        Date.now()
    );

    const receipt = await tx.wait();
    const safeAddress = receipt.logs?.find(log => {
        try {
            const parsed = GnosisSafeProxyFactory.interface.parseLog(log);
            return parsed?.name === "ProxyCreation";
        } catch (e) {
            return false;
        }
    })?.args?.proxy;

    if (!safeAddress) {
        throw new Error("Failed to extract Safe address from transaction");
    }

    console.log("✅ Multi-sig Safe deployed successfully!");
    console.log("📄 Safe Address:", safeAddress);
    console.log("👥 Owners:", owners.length);
    console.log("🔐 Threshold:", threshold, "signatures required");
    console.log("🔗 Explorer:", `https://sepolia.basescan.org/address/${safeAddress}`);

    // Save deployment info
    const deploymentInfo = {
        network: "base-sepolia",
        chainId: 84532,
        safeAddress: safeAddress,
        owners: owners,
        threshold: threshold,
        deploymentTime: new Date().toISOString(),
        blockNumber: receipt.blockNumber,
        transactionHash: receipt.hash,
        explorerUrl: `https://sepolia.basescan.org/address/${safeAddress}`
    };

    console.log("\n📄 Deployment Information:");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    return safeAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Multi-sig deployment failed:", error);
        process.exit(1);
    });
