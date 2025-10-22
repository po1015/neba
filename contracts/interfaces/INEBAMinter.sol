// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title INEBAMinter
 * @dev Interface for NEBA token minting functionality
 * @notice This interface defines the minting capabilities for the NEBA token
 */
interface INEBAMinter {
    /**
     * @notice Mint tokens to a specified address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external;
}

