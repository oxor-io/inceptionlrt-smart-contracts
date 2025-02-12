// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/eigenlayer-vault/eigen-core/IStrategy.sol";
import "../../interfaces/eigenlayer-vault/eigen-core/IStrategyManager.sol";
import "hardhat/console.sol";

contract StrategyManager is IStrategyManager {
    address internal delegationManager;

    constructor(address _delegationManager) {
        delegationManager = _delegationManager;
    }

    function withdrawalRootPending(bytes32) external returns (bool) {}

    function depositIntoStrategy(
        IStrategy strategy,
        IERC20 token,
        uint256 amount
    ) external returns (uint256 shares) {
        token.transferFrom(msg.sender, delegationManager, amount);
        return amount;
    }

    function stakerStrategyShares(address user, IStrategy strategy)
    external
    view
    returns (uint256 shares) {}

/// @dev the same as stakerStrategyShares, but it's coming with Slashing Update For Node Operators/LRTs
    function stakerDepositShares(address user, IStrategy strategy)
    external
    view
    returns (uint256 depositShares) {
        return 10 * 1e18;
    }

    function getDeposits(address depositor)
    external
    view
    returns (IStrategy[] memory, uint256[] memory) {}

    function stakerStrategyListLength(address staker)
    external
    view
    returns (uint256) {}

    function queueWithdrawal(
        uint256[] calldata strategyIndexes,
        IStrategy[] calldata strategies,
        uint256[] calldata shares,
        address withdrawer,
        bool undelegateIfPossible
    ) external returns (bytes32) {}

    function completeQueuedWithdrawal(
        QueuedWithdrawal calldata queuedWithdrawal,
        IERC20[] calldata tokens,
        uint256 middlewareTimesIndex,
        bool receiveAsTokens
    ) external {}

    function completeQueuedWithdrawals(
        QueuedWithdrawal[] calldata queuedWithdrawals,
        IERC20[][] calldata tokens,
        uint256[] calldata middlewareTimesIndexes,
        bool[] calldata receiveAsTokens
    ) external {}

    function slashShares(
        address slashedAddress,
        address recipient,
        IStrategy[] calldata strategies,
        IERC20[] calldata tokens,
        uint256[] calldata strategyIndexes,
        uint256[] calldata shareAmounts
    ) external {}

    function slashQueuedWithdrawal(
        address recipient,
        QueuedWithdrawal calldata queuedWithdrawal,
        IERC20[] calldata tokens,
        uint256[] calldata indicesToSkip
    ) external {}

    function calculateWithdrawalRoot(QueuedWithdrawal memory queuedWithdrawal)
    external
    pure
    returns (bytes32) {}

    function addStrategiesToDepositWhitelist(
        IStrategy[] calldata strategiesToWhitelist
    ) external {}

    function removeStrategiesFromDepositWhitelist(
        IStrategy[] calldata strategiesToRemoveFromWhitelist
    ) external {}

    function withdrawalDelayBlocks() external view returns (uint256) {}

    function numWithdrawalsQueued(address account)
    external
    view
    returns (uint256) {}

    function delegation() external view returns (address) {}
}
