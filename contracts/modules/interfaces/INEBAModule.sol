// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title INEBAModule Interface
 * @dev Interface for NEBA token modules
 */
interface INEBAModule {
    /**
     * @notice Called before a transfer to perform checks
     * @param from The sender address
     * @param to The recipient address
     * @param amount The transfer amount
     */
    function beforeTransfer(address from, address to, uint256 amount) external;
    
    /**
     * @notice Called after a transfer to perform post-processing
     * @param from The sender address
     * @param to The recipient address
     * @param amount The transfer amount
     */
    function afterTransfer(address from, address to, uint256 amount) external;
}
