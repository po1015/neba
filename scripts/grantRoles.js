const { ethers } = require("hardhat");

async function main() {
  console.log("🔐 NEBA Token - Grant Roles to Specific Addresses\n");

  // Contract address
  const proxyAddress = "0xd079d191d9B83f4883884e57807Aab02510f3353";
  
  // Get the admin signer
  const [admin] = await ethers.getSigners();
  console.log("Admin address:", admin.address);

  // Connect to the contract
  const NEBA = await ethers.getContractFactory("NEBA");
  const nebaToken = NEBA.attach(proxyAddress);

  // Example addresses (replace with your actual addresses)
  const exampleAddresses = {
    adminPauser: "0x1234567890123456789012345678901234567890", // Replace with actual address
    botPauser: "0x0987654321098765432109876543210987654321",   // Replace with actual address
    blocklistManager: "0x1111111111111111111111111111111111111111", // Replace with actual address
    circuitBreaker: "0x2222222222222222222222222222222222222222"     // Replace with actual address
  };

  console.log("📋 Example Role Grants (replace addresses with your actual ones):");
  console.log("=" .repeat(70));

  // Get role hashes
  const ADMIN_PAUSER_ROLE = await nebaToken.ADMIN_PAUSER_ROLE();
  const BOT_PAUSER_ROLE = await nebaToken.BOT_PAUSER_ROLE();
  const BLOCKLIST_MANAGER_ROLE = await nebaToken.BLOCKLIST_MANAGER_ROLE();
  const CIRCUIT_BREAKER_ROLE = await nebaToken.CIRCUIT_BREAKER_ROLE();

  // Function to grant role with example
  const grantRoleExample = async (roleName, roleHash, address, description) => {
    console.log(`\n🔧 ${roleName}:`);
    console.log(`   Purpose: ${description}`);
    console.log(`   Address: ${address}`);
    console.log(`   Command:`);
    console.log(`   await nebaToken.grantRole("${roleHash}", "${address}");`);
    
    // Check if this is a valid address format
    if (address.length === 42 && address.startsWith('0x')) {
      console.log(`   ✅ Valid address format`);
    } else {
      console.log(`   ⚠️  Please replace with actual address`);
    }
  };

  // Show examples for each role
  await grantRoleExample(
    "ADMIN_PAUSER_ROLE", 
    ADMIN_PAUSER_ROLE, 
    exampleAddresses.adminPauser,
    "Can pause AND unpause the contract (emergency response team)"
  );

  await grantRoleExample(
    "BOT_PAUSER_ROLE", 
    BOT_PAUSER_ROLE, 
    exampleAddresses.botPauser,
    "Can ONLY pause the contract (automated monitoring bot)"
  );

  await grantRoleExample(
    "BLOCKLIST_MANAGER_ROLE", 
    BLOCKLIST_MANAGER_ROLE, 
    exampleAddresses.blocklistManager,
    "Can manage blocklist and whitelist (compliance team)"
  );

  await grantRoleExample(
    "CIRCUIT_BREAKER_ROLE", 
    CIRCUIT_BREAKER_ROLE, 
    exampleAddresses.circuitBreaker,
    "Can trigger and reset circuit breaker (risk management)"
  );

  console.log("\n" + "=" .repeat(70));
  console.log("📚 How to Grant Roles:");
  console.log("=" .repeat(70));
  
  console.log("\n1. **ADMIN_PAUSER_ROLE** - Emergency Response Team:");
  console.log("   - Can pause the contract during emergencies");
  console.log("   - Can unpause the contract after issues are resolved");
  console.log("   - Recommended: Gnosis Safe multisig or trusted team members");
  console.log("   - Example: Emergency response team, security team");

  console.log("\n2. **BOT_PAUSER_ROLE** - Automated Monitoring:");
  console.log("   - Can ONLY pause the contract (cannot unpause)");
  console.log("   - Designed for automated monitoring systems");
  console.log("   - Security feature: prevents bots from leaving contract paused");
  console.log("   - Example: Anomaly detection bots, monitoring systems");

  console.log("\n3. **BLOCKLIST_MANAGER_ROLE** - Compliance Management:");
  console.log("   - Can add/remove addresses from blocklist");
  console.log("   - Can add/remove addresses from whitelist");
  console.log("   - Can toggle transfer restrictions");
  console.log("   - Example: Compliance officers, legal team");

  console.log("\n4. **CIRCUIT_BREAKER_ROLE** - Risk Management:");
  console.log("   - Can trigger circuit breaker manually");
  console.log("   - Can reset circuit breaker after issues resolved");
  console.log("   - Can update circuit breaker parameters");
  console.log("   - Example: Risk management team, security team");

  console.log("\n" + "=" .repeat(70));
  console.log("🛠️  Implementation Steps:");
  console.log("=" .repeat(70));

  console.log("\n1. **Prepare Your Addresses:**");
  console.log("   - Get the actual wallet addresses for each role");
  console.log("   - Ensure addresses have enough ETH for gas fees");
  console.log("   - Consider using Gnosis Safe multisigs for admin roles");

  console.log("\n2. **Grant Roles:**");
  console.log("   - Use the grantRole function with the correct role hash");
  console.log("   - Each role grant is a separate transaction");
  console.log("   - Monitor the transactions on Etherscan");

  console.log("\n3. **Test Role Functionality:**");
  console.log("   - Test each role with its specific functions");
  console.log("   - Verify security restrictions work correctly");
  console.log("   - Document role assignments for your team");

  console.log("\n4. **Monitor and Maintain:**");
  console.log("   - Regularly audit role assignments");
  console.log("   - Remove unused or compromised roles");
  console.log("   - Update roles as team structure changes");

  console.log("\n" + "=" .repeat(70));
  console.log("🔍 Current Role Status Check:");
  console.log("=" .repeat(70));

  // Check current admin roles
  const hasAdminPauser = await nebaToken.hasRole(ADMIN_PAUSER_ROLE, admin.address);
  const hasBotPauser = await nebaToken.hasRole(BOT_PAUSER_ROLE, admin.address);
  const hasBlocklistManager = await nebaToken.hasRole(BLOCKLIST_MANAGER_ROLE, admin.address);
  const hasCircuitBreaker = await nebaToken.hasRole(CIRCUIT_BREAKER_ROLE, admin.address);

  console.log(`Admin (${admin.address}) has:`);
  console.log(`- ADMIN_PAUSER_ROLE: ${hasAdminPauser ? "✅ Yes" : "❌ No"}`);
  console.log(`- BOT_PAUSER_ROLE: ${hasBotPauser ? "✅ Yes" : "❌ No"}`);
  console.log(`- BLOCKLIST_MANAGER_ROLE: ${hasBlocklistManager ? "✅ Yes" : "❌ No"}`);
  console.log(`- CIRCUIT_BREAKER_ROLE: ${hasCircuitBreaker ? "✅ Yes" : "❌ No"}`);

  console.log("\n🎯 Next Steps:");
  console.log("1. Replace example addresses with your actual addresses");
  console.log("2. Run role grants on testnet first");
  console.log("3. Test each role functionality");
  console.log("4. Deploy to mainnet with proper role setup");
  console.log("5. Document role assignments and procedures");

  console.log("\n✅ Role management guide complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Role grant guide failed:", error);
    process.exit(1);
  });
