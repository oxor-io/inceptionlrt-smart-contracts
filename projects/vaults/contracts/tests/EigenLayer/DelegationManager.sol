// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/eigenlayer-vault/eigen-core/IDelegationManager.sol";
import "hardhat/console.sol";

contract DelegationManager is IDelegationManager {
    function delegateTo(
        address operator,
        SignatureWithExpiry memory approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external override {}

    function undelegate(address staker) external override {}

    function completeQueuedWithdrawal(
        Withdrawal calldata withdrawal,
        IERC20[] calldata tokens,
        bool receiveAsTokens
    ) external override {}

    function completeQueuedWithdrawals(
        IDelegationManager.Withdrawal[] calldata withdrawals,
        IERC20[][] calldata tokens,
        bool[] calldata receiveAsTokens
    ) external override {
        console.logString("completeQueuedWithdrawals");
        for (uint256 i = 0; i < withdrawals.length; i++) {
            console.logAddress(withdrawals[i].withdrawer);
            console.logUint(withdrawals[i].shares[0]);
            console.logBool(tokens[i][0].transfer(withdrawals[i].withdrawer, withdrawals[i].shares[0]));
        }
    }

    function queueWithdrawals(
        IDelegationManager.QueuedWithdrawalParams[] calldata queuedWithdrawalParams
    ) external returns (bytes32[] memory) {
        bytes32 withdrawalID = bytes32(0);

        IDelegationManager.Withdrawal memory withdrawal = Withdrawal({
            staker: msg.sender,
            delegatedTo: msg.sender,
            withdrawer: queuedWithdrawalParams[0].withdrawer,
            nonce: uint32(block.number),
            startBlock: uint32(block.number),
            strategies: queuedWithdrawalParams[0].strategies,
            shares: queuedWithdrawalParams[0].shares
        });

        emit IDelegationManager.SlashingWithdrawalQueued(withdrawalID, withdrawal, queuedWithdrawalParams[0].shares);
        emit IDelegationManager.SlashingWithdrawalQueued(withdrawalID, withdrawal, queuedWithdrawalParams[0].shares);

        return new bytes32[](0);
    }

    function delegatedTo(address staker) external view returns (address) {}

    function operatorShares(address operator, address strategy)
    external
    view
    returns (uint256) {}

    function cumulativeWithdrawalsQueued(address staker)
    external
    view
    returns (uint256) {}

    function withdrawalDelayBlocks() external view returns (uint256) {}

    function isOperator(address operator) external view returns (bool) {
        return true;
    }

    function isDelegated(address staker) external view returns (bool) {
        return true;
    }

    function getWithdrawableShares(
        address staker,
        IStrategy[] memory strategies
    ) external view returns (uint256[] memory withdrawableShares, uint256[] memory depositShares) {
        withdrawableShares = new uint256[](strategies.length);
        depositShares = new uint256[](strategies.length);

        withdrawableShares[0] = 10 * 1e18;
        depositShares[0] = 10 * 1e18;

        return (withdrawableShares, depositShares);
    }

    function redelegate(
        address newOperator,
        SignatureWithExpiry memory newOperatorApproverSig,
        bytes32 approverSalt
    ) external returns (bytes32[] memory withdrawalRoots) {}
}
