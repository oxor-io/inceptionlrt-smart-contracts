// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@arbitrum/nitro-contracts/src/precompiles/ArbSys.sol";
import "@arbitrum/nitro-contracts/src/bridge/IInbox.sol";
import "@arbitrum/nitro-contracts/src/bridge/IOutbox.sol";
import "@arbitrum/nitro-contracts/src/bridge/IBridge.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CrossChainAdapter is Ownable {
    ArbSys constant arbsys = ArbSys(address(100));
    address public l1Target;

    event AssetsInfoSentToL1(
        uint256 indexed amount,
        uint256 indexed to,
        uint256 indexed ticketId
    );
    event EthSentToL1(uint256 indexed amount, uint256 indexed ticketId);

    constructor(address _l1Target) {
        l1Target = _l1Target;
    }

    function setL1Target(address _l1Target) external onlyOwner {
        l1Target = _l1Target;
    }

    function sendAssetsInfoToL1(
        uint256 tokensAmount,
        uint256 ethAmount
    ) external {
        bytes memory data = abi.encodeWithSignature(
            "receiveAssetsInfo(uint256,uint256)",
            tokensAmount,
            ethAmount
        );

        uint256 withdrawalId = arbsys.sendTxToL1(l1Target, data);

        emit AssetsInfoSentToL1(tokensAmount, ethAmount, withdrawalId);
    }

    function sendEthToL1(uint256 amount) external payable {
        require(msg.value >= amount, "Insufficient ETH for transfer");

        bytes memory data = abi.encodeWithSignature(
            "receiveEth(uint256)",
            amount
        );

        // uint256 withdrawalId = arbsys.sendTxToL1(l1Target, data);

        // Send the ETH from L2 to L1
        // uint256 ticketId = inbox.createRetryableTicket{value: msg.value}(
        //     l1Target, // The L1 target contract
        //     amount, // The amount of ETH to send
        //     0, // Max submission cost for retryable ticket
        //     msg.sender, // Refund address if the retryable ticket fails
        //     msg.sender, // Address to receive the ticket's excess fees
        //     1000000, // Gas limit for L1 execution (adjust as needed)
        //     0, // Gas price bid for L1 transaction execution (adjust as needed)
        //     data // Encoded message data
        // );

        // emit EthSentToL1(amount, withdrawalId);
    }
}
