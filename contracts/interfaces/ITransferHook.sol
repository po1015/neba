// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title ITransferHook
 * @dev Interface for transfer hooks that can be called before and after transfers
 * @notice This interface allows for custom logic to be executed during token transfers
 */
interface ITransferHook {
    /**
     * @notice Called before a transfer is executed
     * @param from The address tokens are transferred from
     * @param to The address tokens are transferred to
     * @param amount The amount of tokens to transfer
     */
    function beforeTransfer(address from, address to, uint256 amount) external;
    
    /**
     * @notice Called after a transfer is executed
     * @param from The address tokens were transferred from
     * @param to The address tokens were transferred to
     * @param amount The amount of tokens transferred
     */
    function afterTransfer(address from, address to, uint256 amount) external;
}
