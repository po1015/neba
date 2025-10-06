const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Deploying NEBA Token...");

  // Get the contract factory
  const NEBA = await ethers.getContractFactory("NEBA");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deployment parameters
  const treasury = (process.env.TREASURY_ADDRESS && process.env.TREASURY_ADDRESS !== "your_treasury_address_here") 
    ? process.env.TREASURY_ADDRESS 
    : deployer.address; // Use deployer as treasury for testing
  const admin = deployer.address;
  const commitTimeout = 3600; // 1 hour in seconds
  const circuitBreakerResetInterval = 86400; // 24 hours in seconds

  console.log("Deployment parameters:");
  console.log("- Treasury:", treasury);
  console.log("- Admin:", admin);
  console.log("- Commit Timeout:", commitTimeout, "seconds");
  console.log("- Circuit Breaker Reset Interval:", circuitBreakerResetInterval, "seconds");

  // Deploy the proxy
  const nebaToken = await upgrades.deployProxy(
    NEBA,
    [treasury, admin, commitTimeout, circuitBreakerResetInterval],
    {
      initializer: "initialize",
      kind: "uups"
    }
  );

  await nebaToken.waitForDeployment();

  const nebaTokenAddress = await nebaToken.getAddress();
  console.log("NEBA Token deployed to:", nebaTokenAddress);

  // Get implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(nebaTokenAddress);
  console.log("Implementation deployed to:", implementationAddress);

  // Verify deployment
  console.log("\nVerifying deployment...");
  const name = await nebaToken.name();
  const symbol = await nebaToken.symbol();
  const totalSupply = await nebaToken.totalSupply();
  const treasuryAddress = await nebaToken.treasury();

  console.log("Token Name:", name);
  console.log("Token Symbol:", symbol);
  console.log("Total Supply:", ethers.formatEther(totalSupply), "NEBA");
  console.log("Treasury Address:", treasuryAddress);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    nebaToken: nebaTokenAddress,
    implementation: implementationAddress,
    treasury: treasuryAddress,
    admin: admin,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    commitTimeout: commitTimeout,
    circuitBreakerResetInterval: circuitBreakerResetInterval
  };

  console.log("\nDeployment completed successfully!");
  console.log("Deployment info:", JSON.stringify(deploymentInfo, null, 2));

  // Instructions for verification
  console.log("\nTo verify the contracts on Etherscan, run:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${nebaTokenAddress} "${treasury}" "${admin}" ${commitTimeout} ${circuitBreakerResetInterval}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
