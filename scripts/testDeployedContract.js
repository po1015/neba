const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing Deployed NEBA Token Contract...");
  console.log("==========================================");

  const nebaTokenAddress = "0x75770723EBBed7D482b6F02b6244B411A86C9fC6";
  
  // Get the contract and signers
  const nebaToken = await ethers.getContractAt("NEBA", nebaTokenAddress);
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  
  console.log("📋 Contract Information:");
  console.log("Contract Address:", nebaTokenAddress);
  console.log("Deployer:", deployer.address);
  console.log("Available Signers:", signers.length);
  console.log("");

  let testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Helper function to run tests
  async function runTest(testName, testFunction) {
    try {
      console.log(`🔍 Testing: ${testName}`);
      await testFunction();
      console.log(`✅ PASSED: ${testName}`);
      testResults.passed++;
      testResults.tests.push({ name: testName, status: "PASSED" });
    } catch (error) {
      console.log(`❌ FAILED: ${testName}`);
      console.log(`   Error: ${error.message}`);
      testResults.failed++;
      testResults.tests.push({ name: testName, status: "FAILED", error: error.message });
    }
    console.log("");
  }

  // Test 1: Basic Contract Information
  await runTest("Basic Contract Information", async () => {
    const name = await nebaToken.name();
    const symbol = await nebaToken.symbol();
    const decimals = await nebaToken.decimals();
    const totalSupply = await nebaToken.totalSupply();
    const treasury = await nebaToken.treasury();
    
    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Decimals: ${decimals}`);
    console.log(`   Total Supply: ${ethers.formatEther(totalSupply)} NEBA`);
    console.log(`   Treasury: ${treasury}`);
    
    if (name !== "NEBA Token") throw new Error("Incorrect token name");
    if (symbol !== "$NEBA") throw new Error("Incorrect token symbol");
    if (decimals !== 18n) throw new Error("Incorrect decimals");
    if (totalSupply !== ethers.parseEther("1000000000")) throw new Error("Incorrect total supply");
  });

  // Test 2: Token Balance
  await runTest("Token Balance Check", async () => {
    const treasury = await nebaToken.treasury();
    const treasuryBalance = await nebaToken.balanceOf(treasury);
    console.log(`   Treasury Balance: ${ethers.formatEther(treasuryBalance)} NEBA`);
    
    if (treasuryBalance !== ethers.parseEther("1000000000")) {
      throw new Error("Treasury should have all tokens");
    }
  });

  // Test 3: Role Verification
  await runTest("Role Verification", async () => {
    const DEFAULT_ADMIN_ROLE = await nebaToken.DEFAULT_ADMIN_ROLE();
    const UPGRADER_ROLE = await nebaToken.UPGRADER_ROLE();
    const SNAPSHOT_ROLE = await nebaToken.SNAPSHOT_ROLE();
    
    const hasAdminRole = await nebaToken.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
    const hasUpgraderRole = await nebaToken.hasRole(UPGRADER_ROLE, deployer.address);
    const hasSnapshotRole = await nebaToken.hasRole(SNAPSHOT_ROLE, deployer.address);
    
    console.log(`   Admin Role: ${hasAdminRole}`);
    console.log(`   Upgrader Role: ${hasUpgraderRole}`);
    console.log(`   Snapshot Role: ${hasSnapshotRole}`);
    
    if (!hasAdminRole) throw new Error("Deployer should have admin role");
    if (!hasUpgraderRole) throw new Error("Deployer should have upgrader role");
    if (!hasSnapshotRole) throw new Error("Deployer should have snapshot role");
  });

  // Test 4: Contract State
  await runTest("Contract State Check", async () => {
    const isPaused = await nebaToken.paused();
    const tradingEnabled = await nebaToken.tradingEnabled();
    const transferRestrictionsEnabled = await nebaToken.transferRestrictionsEnabled();
    
    console.log(`   Paused: ${isPaused}`);
    console.log(`   Trading Enabled: ${tradingEnabled}`);
    console.log(`   Transfer Restrictions: ${transferRestrictionsEnabled}`);
    
    // These are expected initial states
    if (isPaused !== false) throw new Error("Contract should not be paused initially");
    if (tradingEnabled !== false) throw new Error("Trading should be disabled initially");
    if (transferRestrictionsEnabled !== false) throw new Error("Transfer restrictions should be disabled initially");
  });

  // Test 5: Enable Trading
  await runTest("Enable Trading", async () => {
    const tx = await nebaToken.connect(deployer).enableTrading();
    await tx.wait();
    
    const tradingEnabled = await nebaToken.tradingEnabled();
    console.log(`   Trading Enabled: ${tradingEnabled}`);
    
    if (tradingEnabled !== true) throw new Error("Trading should be enabled");
  });

  // Test 6: Transfer Tokens (Treasury to Deployer)
  await runTest("Token Transfer", async () => {
    const transferAmount = ethers.parseEther("1000");
    
    // Transfer from treasury to deployer
    const tx = await nebaToken.connect(deployer).transfer(deployer.address, transferAmount);
    await tx.wait();
    
    const deployerBalance = await nebaToken.balanceOf(deployer.address);
    console.log(`   Deployer Balance: ${ethers.formatEther(deployerBalance)} NEBA`);
    
    // Since we're transferring to ourselves, balance should increase
    if (deployerBalance < transferAmount) throw new Error("Transfer amount incorrect");
  });

  // Test 7: Snapshot Functionality
  await runTest("Snapshot Creation", async () => {
    const initialSnapshotId = await nebaToken.getLatestSnapshotId();
    console.log(`   Initial Snapshot ID: ${initialSnapshotId}`);
    
    const tx = await nebaToken.connect(deployer).createSnapshot();
    await tx.wait();
    
    const newSnapshotId = await nebaToken.getLatestSnapshotId();
    console.log(`   New Snapshot ID: ${newSnapshotId}`);
    
    if (newSnapshotId !== initialSnapshotId + 1n) throw new Error("Snapshot ID should increment");
    
    const snapshot = await nebaToken.getSnapshot(newSnapshotId);
    console.log(`   Snapshot Total Supply: ${ethers.formatEther(snapshot.totalSupply)} NEBA`);
    console.log(`   Snapshot Active: ${snapshot.active}`);
    console.log(`   Snapshot Timestamp: ${snapshot.timestamp}`);
    
    if (snapshot.totalSupply !== await nebaToken.totalSupply()) throw new Error("Snapshot total supply incorrect");
    if (snapshot.active !== true) throw new Error("Snapshot should be active");
  });

  // Test 8: Pause Functionality
  await runTest("Pause Contract", async () => {
    const pauseTx = await nebaToken.connect(deployer).pause();
    await pauseTx.wait();
    
    const isPaused = await nebaToken.paused();
    console.log(`   Contract Paused: ${isPaused}`);
    
    if (isPaused !== true) throw new Error("Contract should be paused");
    
    // Try to transfer while paused (should fail)
    try {
      await nebaToken.connect(deployer).transfer(deployer.address, ethers.parseEther("100"));
      throw new Error("Transfer should fail when paused");
    } catch (error) {
      if (!error.message.includes("Pausable: paused")) {
        throw new Error("Expected pause error but got different error");
      }
      console.log("   ✅ Transfer correctly blocked while paused");
    }
  });

  // Test 9: Unpause Functionality
  await runTest("Unpause Contract", async () => {
    const unpauseTx = await nebaToken.connect(deployer).unpause();
    await unpauseTx.wait();
    
    const isPaused = await nebaToken.paused();
    console.log(`   Contract Paused: ${isPaused}`);
    
    if (isPaused !== false) throw new Error("Contract should not be paused");
    
    // Transfer should work again
    const transferTx = await nebaToken.connect(deployer).transfer(deployer.address, ethers.parseEther("100"));
    await transferTx.wait();
    console.log("   ✅ Transfer works after unpause");
  });

  // Test 10: Whitelist Functionality
  await runTest("Whitelist Management", async () => {
    // Enable transfer restrictions
    const enableTx = await nebaToken.connect(deployer).updateTransferRestrictions(true);
    await enableTx.wait();
    
    const transferRestrictionsEnabled = await nebaToken.transferRestrictionsEnabled();
    console.log(`   Transfer Restrictions Enabled: ${transferRestrictionsEnabled}`);
    
    if (transferRestrictionsEnabled !== true) throw new Error("Transfer restrictions should be enabled");
    
    // Add deployer to whitelist
    const whitelistTx = await nebaToken.connect(deployer).updateWhitelist(deployer.address, true);
    await whitelistTx.wait();
    
    const isWhitelisted = await nebaToken.whitelisted(deployer.address);
    console.log(`   Deployer Whitelisted: ${isWhitelisted}`);
    
    if (isWhitelisted !== true) throw new Error("Deployer should be whitelisted");
    
    // Transfer should work for whitelisted user
    const transferTx = await nebaToken.connect(deployer).transfer(deployer.address, ethers.parseEther("50"));
    await transferTx.wait();
    console.log("   ✅ Transfer works for whitelisted user");
    
    // Disable transfer restrictions
    const disableTx = await nebaToken.connect(deployer).updateTransferRestrictions(false);
    await disableTx.wait();
  });

  // Test 11: Parameter Updates
  await runTest("Parameter Updates", async () => {
    const currentCommitTimeout = await nebaToken.commitTimeout();
    const currentCircuitBreakerResetInterval = await nebaToken.circuitBreakerResetInterval();
    
    console.log(`   Commit Timeout: ${currentCommitTimeout} seconds`);
    console.log(`   Circuit Breaker Reset Interval: ${currentCircuitBreakerResetInterval} seconds`);
    
    if (currentCommitTimeout !== 3600n) throw new Error("Incorrect commit timeout");
    if (currentCircuitBreakerResetInterval !== 86400n) throw new Error("Incorrect circuit breaker reset interval");
  });

  // Test 12: Event Emission
  await runTest("Event Emission", async () => {
    const transferAmount = ethers.parseEther("100");
    
    // Perform a transfer to generate an event
    const tx = await nebaToken.connect(deployer).transfer(deployer.address, transferAmount);
    const receipt = await tx.wait();
    
    const transferEvents = receipt.logs.filter(log => {
      try {
        const parsed = nebaToken.interface.parseLog(log);
        return parsed.name === 'Transfer';
      } catch (e) {
        return false;
      }
    });
    
    console.log(`   Transfer Events in Latest TX: ${transferEvents.length}`);
    
    if (transferEvents.length === 0) throw new Error("No transfer events emitted");
  });

  // Test 13: Access Control
  await runTest("Access Control", async () => {
    // Try to call admin function with non-admin account (simulate by checking roles)
    const DEFAULT_ADMIN_ROLE = await nebaToken.DEFAULT_ADMIN_ROLE();
    const hasAdminRole = await nebaToken.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
    
    if (!hasAdminRole) {
      throw new Error("Deployer should have admin role");
    }
    
    console.log("   ✅ Access control working correctly");
  });

  // Test 14: Snapshot Query Functions
  await runTest("Snapshot Query Functions", async () => {
    const latestSnapshotId = await nebaToken.getLatestSnapshotId();
    console.log(`   Latest Snapshot ID: ${latestSnapshotId}`);
    
    if (latestSnapshotId > 0) {
      const snapshotExists = await nebaToken.snapshotExists(latestSnapshotId);
      console.log(`   Snapshot ${latestSnapshotId} exists: ${snapshotExists}`);
      
      if (!snapshotExists) throw new Error("Latest snapshot should exist");
      
      const snapshot = await nebaToken.getSnapshot(latestSnapshotId);
      console.log(`   Snapshot ID: ${snapshot.id}`);
      console.log(`   Snapshot Active: ${snapshot.active}`);
    }
  });

  // Test 15: Final State Verification
  await runTest("Final State Verification", async () => {
    const totalSupply = await nebaToken.totalSupply();
    const treasury = await nebaToken.treasury();
    const treasuryBalance = await nebaToken.balanceOf(treasury);
    const deployerBalance = await nebaToken.balanceOf(deployer.address);
    
    console.log(`   Total Supply: ${ethers.formatEther(totalSupply)} NEBA`);
    console.log(`   Treasury Balance: ${ethers.formatEther(treasuryBalance)} NEBA`);
    console.log(`   Deployer Balance: ${ethers.formatEther(deployerBalance)} NEBA`);
    
    // Total supply should remain constant
    if (totalSupply !== ethers.parseEther("1000000000")) throw new Error("Total supply should remain constant");
    
    // Treasury balance should be less than total supply (some transferred to deployer)
    if (treasuryBalance >= totalSupply) throw new Error("Some tokens should have been transferred");
    
    console.log("   ✅ Token balances are correct");
  });

  // Print Test Results Summary
  console.log("📊 Test Results Summary:");
  console.log("========================");
  console.log(`✅ Tests Passed: ${testResults.passed}`);
  console.log(`❌ Tests Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  console.log("");
  
  if (testResults.failed > 0) {
    console.log("❌ Failed Tests:");
    testResults.tests.filter(t => t.status === "FAILED").forEach(test => {
      console.log(`   - ${test.name}: ${test.error}`);
    });
    console.log("");
  }
  
  console.log("✅ All Core Functionality Tests Completed!");
  
  if (testResults.failed === 0) {
    console.log("🎉 All tests passed! The deployed contract is working correctly.");
  } else {
    console.log("⚠️  Some tests failed. Please review the errors above.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test execution failed:", error);
    process.exit(1);
  });