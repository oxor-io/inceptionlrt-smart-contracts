// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IRestakerFacets.sol";

/**
 * @title Diamond-like implementation which support call with context (simple call).
 * @author GenesisLST
 */
interface IRestaker {
    error RestakerCannotClaim();

    event Claimed(address indexed recipient, uint256 amount);

    event RewardsCoordinatorChanged(address indexed rewardCoordinator, address indexed newRewardCoordinator);

    function initialize(address owner, IRestakerFacets facets) external;

    function __claim() external;

    function __setRewardsCoordinator(address newRewardsCoordinator, address claimer) external;
}
