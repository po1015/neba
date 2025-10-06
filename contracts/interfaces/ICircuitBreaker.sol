// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title ICircuitBreaker
 * @dev Interface for circuit breaker functionality
 * @notice This interface provides methods for checking transfers against circuit breaker rules
 */
interface ICircuitBreaker {
    /**
     * @notice Check if a transfer should be allowed based on circuit breaker rules
     * @param from The address tokens are transferred from
     * @param to The address tokens are transferred to
     * @param amount The amount of tokens to transfer
     */
    function checkTransfer(address from, address to, uint256 amount) external view;
    
    /**
     * @notice Get the current circuit breaker state
     * @return isActive Whether the circuit breaker is currently active
     */
    function isActive() external view returns (bool isActive);
    
    /**
     * @notice Get the reason for circuit breaker activation
     * @return reason The reason the circuit breaker was activated
     */
    function getActivationReason() external view returns (string memory reason);
}
