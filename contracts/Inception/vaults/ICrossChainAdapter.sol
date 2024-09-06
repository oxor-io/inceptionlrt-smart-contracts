// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICrossChainAdapter
 * @dev Paul Fomichov
 */
interface ICrossChainAdapter {
    function sendAssetsInfoToL1(
        uint256 tokensAmount,
        uint256 ethAmount
    ) external;

    function sendEthToL1(uint256 amount) external payable;
}
