const { ethers } = require("hardhat");

// Alert thresholds
const ALERT_THRESHOLDS = {
    LARGE_MINT: ethers.parseEther("5000000"),      // 5M tokens
    BLOCK_UTILIZATION: 0.8,  // 80% of block limit
    DAY_UTILIZATION: 0.9,    // 90% of daily limit
};

async function monitorMints(tokenAddress) {
    console.log("🔍 Starting NEBA Token mint monitoring...");
    console.log("Token Address:", tokenAddress);
    
    const token = await ethers.getContractAt("NEBA", tokenAddress);
    
    // Get initial mint limits
    const mintLimits = await token.mintLimits();
    console.log("📊 Mint Limits:");
    console.log("  Max per transaction:", ethers.formatEther(mintLimits.maxPerTransaction));
    console.log("  Max per block:", ethers.formatEther(mintLimits.maxPerBlock));
    console.log("  Max per day:", ethers.formatEther(mintLimits.maxPerDay));
    console.log("  Cooldown blocks:", mintLimits.cooldownBlocks.toString());
    
    // Listen for mint events (Transfer from zero address)
    token.on("Transfer", async (from, to, amount, event) => {
        // Mint detection (from == zero address)
        if (from === ethers.ZeroAddress) {
            console.log(`\n🪙 MINT DETECTED:`);
            console.log(`  To: ${to}`);
            console.log(`  Amount: ${ethers.formatEther(amount)} NEBA`);
            console.log(`  Block: ${event.blockNumber}`);
            console.log(`  Tx: ${event.transactionHash}`);
            
            // Check if large mint
            if (amount >= ALERT_THRESHOLDS.LARGE_MINT) {
                await sendAlert({
                    type: "LARGE_MINT",
                    amount: ethers.formatEther(amount),
                    to: to,
                    tx: event.transactionHash,
                    block: event.blockNumber
                });
            }
            
            // Check utilization
            try {
                const stats = await token.getMintStats();
                const blockUtil = (Number(stats.blockMinted) / Number(stats.blockLimit)) * 100;
                const dayUtil = (Number(stats.dayMinted) / Number(stats.dayLimit)) * 100;
                
                console.log(`  Block utilization: ${blockUtil.toFixed(2)}%`);
                console.log(`  Day utilization: ${dayUtil.toFixed(2)}%`);
                
                if (blockUtil >= ALERT_THRESHOLDS.BLOCK_UTILIZATION * 100) {
                    await sendAlert({
                        type: "HIGH_BLOCK_UTILIZATION",
                        utilization: blockUtil.toFixed(2),
                        minted: ethers.formatEther(stats.blockMinted),
                        limit: ethers.formatEther(stats.blockLimit)
                    });
                }
                
                if (dayUtil >= ALERT_THRESHOLDS.DAY_UTILIZATION * 100) {
                    await sendAlert({
                        type: "HIGH_DAY_UTILIZATION",
                        utilization: dayUtil.toFixed(2),
                        minted: ethers.formatEther(stats.dayMinted),
                        limit: ethers.formatEther(stats.dayLimit)
                    });
                }
            } catch (error) {
                console.error("Error getting mint stats:", error.message);
            }
        }
    });
    
    // Listen for large mint events
    token.on("LargeMintDetected", async (to, amount, blockNumber, event) => {
        console.log(`\n⚠️  LARGE MINT ALERT:`);
        console.log(`  To: ${to}`);
        console.log(`  Amount: ${ethers.formatEther(amount)} NEBA`);
        console.log(`  Block: ${blockNumber}`);
        
        await sendAlert({
            type: "LARGE_MINT_EVENT",
            to: to,
            amount: ethers.formatEther(amount),
            block: blockNumber.toString()
        });
    });
    
    // Listen for mint limits updates
    token.on("MintLimitsUpdated", async (maxPerTransaction, maxPerBlock, maxPerDay, cooldownBlocks, event) => {
        console.log(`\n📊 MINT LIMITS UPDATED:`);
        console.log(`  Max per transaction: ${ethers.formatEther(maxPerTransaction)}`);
        console.log(`  Max per block: ${ethers.formatEther(maxPerBlock)}`);
        console.log(`  Max per day: ${ethers.formatEther(maxPerDay)}`);
        console.log(`  Cooldown blocks: ${cooldownBlocks}`);
        console.log(`  Tx: ${event.transactionHash}`);
        
        await sendAlert({
            type: "MINT_LIMITS_UPDATED",
            maxPerTransaction: ethers.formatEther(maxPerTransaction),
            maxPerBlock: ethers.formatEther(maxPerBlock),
            maxPerDay: ethers.formatEther(maxPerDay),
            cooldownBlocks: cooldownBlocks.toString()
        });
    });
    
    console.log("✅ Monitoring active - listening for events...");
    console.log("Press Ctrl+C to stop monitoring");
}

async function sendAlert(data) {
    const timestamp = new Date().toISOString();
    console.log(`\n🚨 ALERT [${timestamp}]:`, JSON.stringify(data, null, 2));
    
    // TODO: Implement actual alerting mechanisms
    // - Telegram bot
    // - Slack webhook
    // - PagerDuty
    // - Email notifications
    // - Discord webhook
    
    // For now, just log to console
    console.log("📧 Alert would be sent to monitoring systems");
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Monitoring stopped');
    process.exit(0);
});

// Main execution
async function main() {
    const tokenAddress = process.env.TOKEN_ADDRESS;
    
    if (!tokenAddress) {
        console.error("❌ TOKEN_ADDRESS environment variable not set");
        console.error("Usage: TOKEN_ADDRESS=0x... node scripts/monitor-mints.js");
        process.exit(1);
    }
    
    try {
        await monitorMints(tokenAddress);
    } catch (error) {
        console.error("❌ Monitoring failed:", error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { monitorMints, sendAlert };
