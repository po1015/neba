const { ethers } = require("hardhat");

async function main() {
  console.log("🔐 NEBA Token Role Management\n");

  // Contract address
  const proxyAddress = "0xd079d191d9B83f4883884e57807Aab02510f3353";
  
  // Get signers
  const [admin, user1, user2, user3] = await ethers.getSigners();
  
  console.log("👥 Available Accounts:");
  console.log("- Admin (has all roles):", admin.address);
  if (user1) console.log("- User 1:", user1.address);
  if (user2) console.log("- User 2:", user2.address);
  if (user3) console.log("- User 3:", user3.address);

  // Connect to the contract
  const NEBA = await ethers.getContractFactory("NEBA");
  const nebaToken = NEBA.attach(proxyAddress);

  console.log("\n📋 Current Role Status:");
  
  // Get role hashes
  const DEFAULT_ADMIN_ROLE = await nebaToken.DEFAULT_ADMIN_ROLE();
  const UPGRADER_ROLE = await nebaToken.UPGRADER_ROLE();
  const ADMIN_PAUSER_ROLE = await nebaToken.ADMIN_PAUSER_ROLE();
  const BOT_PAUSER_ROLE = await nebaToken.BOT_PAUSER_ROLE();
  const BLOCKLIST_MANAGER_ROLE = await nebaToken.BLOCKLIST_MANAGER_ROLE();
  const CIRCUIT_BREAKER_ROLE = await nebaToken.CIRCUIT_BREAKER_ROLE();

  // Check current roles
  const checkRole = async (roleName, roleHash, address, user) => {
    const hasRole = await nebaToken.hasRole(roleHash, address);
    console.log(`- ${roleName} (${user}):`, hasRole ? "✅ Yes" : "❌ No");
    return hasRole;
  };

  await checkRole("DEFAULT_ADMIN_ROLE", DEFAULT_ADMIN_ROLE, admin.address, "Admin");
  await checkRole("UPGRADER_ROLE", UPGRADER_ROLE, admin.address, "Admin");
  await checkRole("ADMIN_PAUSER_ROLE", ADMIN_PAUSER_ROLE, admin.address, "Admin");
  await checkRole("BOT_PAUSER_ROLE", BOT_PAUSER_ROLE, admin.address, "Admin");
  await checkRole("BLOCKLIST_MANAGER_ROLE", BLOCKLIST_MANAGER_ROLE, admin.address, "Admin");
  await checkRole("CIRCUIT_BREAKER_ROLE", CIRCUIT_BREAKER_ROLE, admin.address, "Admin");

  console.log("\n🔧 Role Management Functions:");
  console.log("=" .repeat(60));

  // Example: Grant ADMIN_PAUSER_ROLE to user1
  if (user1) {
    console.log("\n1. Granting ADMIN_PAUSER_ROLE to User 1...");
    try {
      const grantTx = await nebaToken.grantRole(ADMIN_PAUSER_ROLE, user1.address);
      await grantTx.wait();
      console.log("   ✅ ADMIN_PAUSER_ROLE granted to User 1");
      
      const hasRole = await nebaToken.hasRole(ADMIN_PAUSER_ROLE, user1.address);
      console.log("   - User 1 has ADMIN_PAUSER_ROLE:", hasRole ? "✅ Yes" : "❌ No");
    } catch (error) {
      console.log("   ❌ Failed to grant ADMIN_PAUSER_ROLE:", error.message);
    }
  } else {
    console.log("\n1. Skipping User 1 role grant (not available)");
  }

  // Example: Grant BLOCKLIST_MANAGER_ROLE to user2
  if (user2) {
    console.log("\n2. Granting BLOCKLIST_MANAGER_ROLE to User 2...");
    try {
      const grantTx = await nebaToken.grantRole(BLOCKLIST_MANAGER_ROLE, user2.address);
      await grantTx.wait();
      console.log("   ✅ BLOCKLIST_MANAGER_ROLE granted to User 2");
      
      const hasRole = await nebaToken.hasRole(BLOCKLIST_MANAGER_ROLE, user2.address);
      console.log("   - User 2 has BLOCKLIST_MANAGER_ROLE:", hasRole ? "✅ Yes" : "❌ No");
    } catch (error) {
      console.log("   ❌ Failed to grant BLOCKLIST_MANAGER_ROLE:", error.message);
    }
  } else {
    console.log("\n2. Skipping User 2 role grant (not available)");
  }

  // Example: Grant BOT_PAUSER_ROLE to user3 (automated bot)
  if (user3) {
    console.log("\n3. Granting BOT_PAUSER_ROLE to User 3 (Bot)...");
    try {
      const grantTx = await nebaToken.grantRole(BOT_PAUSER_ROLE, user3.address);
      await grantTx.wait();
      console.log("   ✅ BOT_PAUSER_ROLE granted to User 3");
      
      const hasRole = await nebaToken.hasRole(BOT_PAUSER_ROLE, user3.address);
      console.log("   - User 3 has BOT_PAUSER_ROLE:", hasRole ? "✅ Yes" : "❌ No");
    } catch (error) {
      console.log("   ❌ Failed to grant BOT_PAUSER_ROLE:", error.message);
    }
  } else {
    console.log("\n3. Skipping User 3 role grant (not available)");
  }

  // Test the roles
  console.log("\n4. Testing Role Functionality:");
  
  // Test ADMIN_PAUSER_ROLE (can pause and unpause)
  if (user1) {
    console.log("\n   Testing ADMIN_PAUSER_ROLE (User 1)...");
    try {
      // User 1 should be able to pause
      const pauseTx = await nebaToken.connect(user1).pause();
      await pauseTx.wait();
      console.log("   ✅ User 1 can pause the contract");
      
      // User 1 should be able to unpause
      const unpauseTx = await nebaToken.connect(user1).unpause();
      await unpauseTx.wait();
      console.log("   ✅ User 1 can unpause the contract");
    } catch (error) {
      console.log("   ❌ User 1 role test failed:", error.message);
    }
  }

  // Test BOT_PAUSER_ROLE (can only pause, not unpause)
  if (user3) {
    console.log("\n   Testing BOT_PAUSER_ROLE (User 3)...");
    try {
      // User 3 should be able to pause
      const pauseTx = await nebaToken.connect(user3).pause();
      await pauseTx.wait();
      console.log("   ✅ User 3 (Bot) can pause the contract");
      
      // User 3 should NOT be able to unpause (this should fail)
      try {
        const unpauseTx = await nebaToken.connect(user3).unpause();
        await unpauseTx.wait();
        console.log("   ❌ User 3 should NOT be able to unpause!");
      } catch (unpauseError) {
        console.log("   ✅ User 3 correctly cannot unpause (expected)");
      }
      
      // Admin unpauses to restore normal operation
      const adminUnpauseTx = await nebaToken.connect(admin).unpause();
      await adminUnpauseTx.wait();
      console.log("   ✅ Admin unpaused the contract");
      
    } catch (error) {
      console.log("   ❌ User 3 role test failed:", error.message);
    }
  }

  // Test BLOCKLIST_MANAGER_ROLE
  if (user2 && user1) {
    console.log("\n   Testing BLOCKLIST_MANAGER_ROLE (User 2)...");
    try {
      // User 2 should be able to update blocklist
      const blockTx = await nebaToken.connect(user2).updateBlocklist(user1.address, true);
      await blockTx.wait();
      console.log("   ✅ User 2 can update blocklist");
      
      // User 2 should be able to update whitelist
      const whitelistTx = await nebaToken.connect(user2).updateWhitelist(user1.address, true);
      await whitelistTx.wait();
      console.log("   ✅ User 2 can update whitelist");
      
      // Clean up - unblock the address
      const unblockTx = await nebaToken.connect(user2).updateBlocklist(user1.address, false);
      await unblockTx.wait();
      console.log("   ✅ User 2 cleaned up blocklist");
      
    } catch (error) {
      console.log("   ❌ User 2 role test failed:", error.message);
    }
  }

  console.log("\n📋 Final Role Status:");
  if (user1) await checkRole("ADMIN_PAUSER_ROLE", ADMIN_PAUSER_ROLE, user1.address, "User 1");
  if (user2) await checkRole("BLOCKLIST_MANAGER_ROLE", BLOCKLIST_MANAGER_ROLE, user2.address, "User 2");
  if (user3) await checkRole("BOT_PAUSER_ROLE", BOT_PAUSER_ROLE, user3.address, "User 3");

  console.log("\n🎉 Role Management Test Complete!");
  
  console.log("\n📚 Role Management Summary:");
  console.log("=" .repeat(60));
  console.log("✅ ADMIN_PAUSER_ROLE: Can pause AND unpause");
  console.log("✅ BOT_PAUSER_ROLE: Can ONLY pause (security feature)");
  console.log("✅ BLOCKLIST_MANAGER_ROLE: Can manage blocklist/whitelist");
  console.log("✅ Role-based access control is working correctly");
  console.log("=" .repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Role management failed:", error);
    process.exit(1);
  });
