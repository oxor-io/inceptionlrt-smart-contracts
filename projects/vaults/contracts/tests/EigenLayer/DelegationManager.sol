// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/eigenlayer-vault/eigen-core/IDelegationManager.sol";
import "../../interfaces/eigenlayer-vault/eigen-core/IShareManager.sol";
import "hardhat/console.sol";

contract DelegationManager is IDelegationManager {
    function completeQueuedWithdrawals(
        IDelegationManager.Withdrawal[] calldata withdrawals,
        IERC20[][] calldata tokens,
        bool[] calldata receiveAsTokens
    ) external override {
        for (uint256 i = 0; i < withdrawals.length; i++) {
            for (uint256 j = 0; j < withdrawals[i].strategies.length; j++) {
                IShareManager shareManager = _getShareManager(withdrawals[i].strategies[j]);

                uint256 shares = shareManager.stakerDepositShares(withdrawals[i].staker, withdrawals[i].strategies[j]);
                uint256 slashedAmountToWithdraw = withdrawals[i].shares[j] / 2;
                uint256 slashedAmount = shares / 2;

                // apply slashed withdraw
                shareManager.withdrawSharesAsTokens(
                    withdrawals[i].staker,
                    withdrawals[i].strategies[j],
                    tokens[i][j],
                    slashedAmountToWithdraw
                );

                // apply slash
                shareManager.burnShares(withdrawals[i].strategies[j], slashedAmount);
                shareManager.removeDepositShares(withdrawals[i].staker, withdrawals[i].strategies[j], slashedAmount);
            }
        }
    }

    function queueWithdrawals(
        IDelegationManager.QueuedWithdrawalParams[] calldata queuedWithdrawalParams
    ) external returns (bytes32[] memory) {
        for (uint256 i = 0; i < queuedWithdrawalParams.length; i++) {
            for (uint256 j = 0; j < queuedWithdrawalParams[i].strategies.length; j++) {
                IShareManager shareManager = _getShareManager(queuedWithdrawalParams[i].strategies[j]);
                shareManager.removeDepositShares(
                    msg.sender,
                    queuedWithdrawalParams[i].strategies[j],
                    queuedWithdrawalParams[i].shares[j]
                );
            }

            IDelegationManager.Withdrawal memory withdrawal = Withdrawal({
                staker: msg.sender,
                delegatedTo: msg.sender,
                withdrawer: queuedWithdrawalParams[i].withdrawer,
                nonce: uint32(block.number),
                startBlock: uint32(block.number),
                strategies: queuedWithdrawalParams[i].strategies,
                shares: queuedWithdrawalParams[i].shares
            });

            bytes32 withdrawalID = bytes32(0);
            emit IDelegationManager.SlashingWithdrawalQueued(withdrawalID, withdrawal, queuedWithdrawalParams[i].shares);
            emit IDelegationManager.SlashingWithdrawalQueued(withdrawalID, withdrawal, queuedWithdrawalParams[i].shares);
        }

        return new bytes32[](0);
    }

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

    function _getShareManager(
        IStrategy strategy
    ) internal view returns (IShareManager) {
        return address(strategy) == 0xbeaC0eeEeeeeEEeEeEEEEeeEEeEeeeEeeEEBEaC0
            ? IShareManager(address(0x30770d7E3e71112d7A6b7259542D1f680a70e315))
            : IShareManager(address(0xdfB5f6CE42aAA7830E94ECFCcAd411beF4d4D5b6));
    }

    // ---------------------------------------------------------------------------

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

    function cumulativeWithdrawalsQueued(address staker)
    external
    view
    returns (uint256) {}

    function withdrawalDelayBlocks() external view returns (uint256) {}

    function redelegate(
        address newOperator,
        SignatureWithExpiry memory newOperatorApproverSig,
        bytes32 approverSalt
    ) external returns (bytes32[] memory withdrawalRoots) {}

    function increaseDelegatedShares(
        address staker,
        IStrategy strategy,
        uint256 prevDepositShares,
        uint256 addedShares
    ) external {}

    function decreaseDelegatedShares(
        address staker,
        uint256 curDepositShares,
        uint64 beaconChainSlashingFactorDecrease
    ) external {}

    function delegatedTo(address staker) external view returns (address) {}

    function operatorShares(address operator, address strategy) external view returns (uint256) {}
}

