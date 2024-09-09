// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CrossChainAdapter
 * @author The InceptionLRT team
 * @dev mocks a real L1 Rebalancer for testing purposes
 */
contract MockRebalancerL1 {
    // State variables to store the tokens and ETH amount
    uint256 public tokensAmount;
    uint256 public ethAmount;

    // Event to emit when assets info is received
    event AssetsInfoReceived(uint256 tokensAmount, uint256 ethAmount);

    /**
     * @dev Function to receive assets information from L2
     * @param _tokensAmount The amount of tokens sent to L1
     * @param _ethAmount The amount of ETH sent to L1
     */
    function receiveAssetsInfo(
        uint256 _tokensAmount,
        uint256 _ethAmount
    ) external {
        // Update the state with the received values
        tokensAmount = _tokensAmount;
        ethAmount = _ethAmount;

        // Emit an event after updating the state
        emit AssetsInfoReceived(tokensAmount, ethAmount);
    }
}
