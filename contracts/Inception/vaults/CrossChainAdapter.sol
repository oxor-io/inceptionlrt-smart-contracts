// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@arbitrum/nitro-contracts/src/bridge/IInbox.sol";
import "@arbitrum/nitro-contracts/src/bridge/IOutbox.sol";
import "@arbitrum/nitro-contracts/src/bridge/IBridge.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CrossChainAdapter is Ownable {
    address public inboxAddress;
    address public l1Target;

    IInbox public inbox;

    event AssetsInfoSentToL1(
        uint256 indexed amount,
        uint256 indexed to,
        uint256 indexed ticketId
    );
    event EthSentToL1(uint256 indexed amount, uint256 indexed ticketId);

    constructor(address _inboxAddress, address _l1Target) {
        inboxAddress = _inboxAddress;
        inbox = IInbox(_inboxAddress);
        l1Target = _l1Target;
    }

    /**
     * @dev Sets the inbox address, typically called by the owner of the contract.
     * @param _inboxAddress The address of the Arbitrum inbox contract.
     */
    function setInboxAddress(address _inboxAddress) external onlyOwner {
        inboxAddress = _inboxAddress;
        inbox = IInbox(_inboxAddress);
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

        // Send the L2 to L1 message using Arbitrum's Inbox contract
        uint256 ticketId = inbox.createRetryableTicket(
            l1Target, // The L1 target contract
            0, // Amount of ETH to send, 0 since we're not sending ETH here
            0, // Max submission cost for retryable ticket
            msg.sender, // Refund address if the retryable ticket fails
            msg.sender, // Address to receive the ticket's excess fees
            1000000, // Gas limit for L1 execution (adjust as needed)
            0, // Gas price bid for L1 transaction execution (adjust as needed)
            data // Encoded message data
        );

        emit AssetsInfoSentToL1(tokensAmount, ethAmount, ticketId);
    }

    function sendEthToL1(uint256 amount) external payable {
        require(msg.value >= amount, "Insufficient ETH for transfer");

        bytes memory data = abi.encodeWithSignature(
            "receiveEth(uint256)",
            amount
        );

        // Send the ETH from L2 to L1
        uint256 ticketId = inbox.createRetryableTicket{value: msg.value}(
            l1Target, // The L1 target contract
            amount, // The amount of ETH to send
            0, // Max submission cost for retryable ticket
            msg.sender, // Refund address if the retryable ticket fails
            msg.sender, // Address to receive the ticket's excess fees
            1000000, // Gas limit for L1 execution (adjust as needed)
            0, // Gas price bid for L1 transaction execution (adjust as needed)
            data // Encoded message data
        );

        emit EthSentToL1(amount, ticketId);
    }
}
