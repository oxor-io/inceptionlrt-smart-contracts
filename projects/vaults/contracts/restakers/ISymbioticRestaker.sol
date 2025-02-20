// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Address} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {ERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IISymbioticRestaker} from "../interfaces/symbiotic-vault/restakers/IISymbioticRestaker.sol";
import {IVault} from "../interfaces/symbiotic-vault/symbiotic-core/IVault.sol";

/**
 * @title The ISymbioticRestaker Contract
 * @author The InceptionLRT team
 * @dev Handles delegation and withdrawal requests within the SymbioticFi Protocol.
 * @notice Can only be executed by InceptionVault/InceptionOperator or the owner.
 */
contract ISymbioticRestaker is
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC165Upgradeable,
    OwnableUpgradeable,
    IISymbioticRestaker
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    IERC20 internal _asset;
    address internal _trusteeManager;
    address internal _vault;

    EnumerableSet.AddressSet internal _symbioticVaults;

    /// @dev symbioticVault => withdrawal epoch
    mapping(address => uint256) public withdrawals;

    // /// @dev Symbiotic DefaultStakerRewards.sol
    // IStakerRewards public stakerRewards;

    modifier onlyTrustee() {
        if (msg.sender != _vault && msg.sender != _trusteeManager)
            revert NotVaultOrTrusteeManager();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() payable {
        _disableInitializers();
    }

    function initialize(
        address[] memory vaults,
        address vault,
        IERC20 asset,
        address trusteeManager
    ) public initializer {
        __Pausable_init();
        __ReentrancyGuard_init();
        __Ownable_init();
        __ERC165_init();

        for (uint256 i = 0; i < vaults.length; i++) {
            if (IVault(vaults[i]).collateral() != address(asset))
                revert InvalidCollateral();
            if (_symbioticVaults.contains(vaults[i])) revert AlreadyAdded();
            _symbioticVaults.add(vaults[i]);
            emit VaultAdded(vaults[i]);
        }

        _asset = asset;
        _vault = vault;

        _trusteeManager = trusteeManager;
    }

    function delegate(
        address vaultAddress,
        uint256 amount
    )
        external
        onlyTrustee
        whenNotPaused
        returns (uint256 depositedAmount, uint256 mintedShares)
    {
        if (!_symbioticVaults.contains(vaultAddress)) revert InvalidVault();
        _asset.safeTransferFrom(msg.sender, address(this), amount);
        _asset.safeIncreaseAllowance(vaultAddress, amount);
        return IVault(vaultAddress).deposit(address(this), amount);
    }

    function withdraw(
        address vaultAddress,
        uint256 amount
    ) external onlyTrustee whenNotPaused returns (uint256) {
        IVault vault = IVault(vaultAddress);
        if (!_symbioticVaults.contains(vaultAddress)) revert InvalidVault();
        if (
            withdrawals[vaultAddress] != vault.currentEpoch() + 1 &&
            withdrawals[vaultAddress] > 0
        ) revert WithdrawalInProgress();

        vault.withdraw(address(this), amount);

        uint256 epoch = vault.currentEpoch() + 1;
        withdrawals[vaultAddress] = epoch;

        return amount;
    }

    function claim(
        address vaultAddress,
        uint256 sEpoch
    ) external onlyTrustee whenNotPaused returns (uint256) {
        if (!_symbioticVaults.contains(vaultAddress)) revert InvalidVault();
        if (withdrawals[vaultAddress] == 0) revert NothingToClaim();
        if (sEpoch >= IVault(vaultAddress).currentEpoch())
            revert InvalidEpoch();
        if (IVault(vaultAddress).isWithdrawalsClaimed(sEpoch, msg.sender))
            revert AlreadyClaimed();

        delete withdrawals[vaultAddress];
        return IVault(vaultAddress).claim(_vault, sEpoch);
    }

    // /// TODO
    // function pendingRewards() external view returns (uint256) {
    //     return stakerRewards.claimable(address(_asset), address(this), "");
    // }

    /**
     * @notice Checks whether a vault is supported by the Protocol or not.
     * @param vaultAddress vault address to check
     */
    function isVaultSupported(
        address vaultAddress
    ) external view returns (bool) {
        return _symbioticVaults.contains(vaultAddress);
    }

    function getDeposited(address vaultAddress) public view returns (uint256) {
        if (!_symbioticVaults.contains(vaultAddress)) revert InvalidVault();
        return IVault(vaultAddress).activeBalanceOf(address(this));
    }

    function getTotalDeposited() public view returns (uint256 total) {
        for (uint256 i = 0; i < _symbioticVaults.length(); i++)
            total += IVault(_symbioticVaults.at(i)).activeBalanceOf(
                address(this)
            );

        return total;
    }

    function pendingWithdrawalAmount() external view returns (uint256 total) {
        for (uint256 i = 0; i < _symbioticVaults.length(); i++)
            if (withdrawals[_symbioticVaults.at(i)] != 0)
                total += IVault(_symbioticVaults.at(i)).withdrawalsOf(
                    withdrawals[_symbioticVaults.at(i)],
                    address(this)
                );

        return total;
    }

    function claimableAmount() external pure returns (uint256) {
        return 0;
    }

    function addVault(address vaultAddress) external onlyOwner {
        if (vaultAddress == address(0)) revert ZeroAddress();
        if (!Address.isContract(vaultAddress)) revert NotContract();

        if (_symbioticVaults.contains(vaultAddress)) revert AlreadyAdded();
        if (IVault(vaultAddress).collateral() != address(_asset))
            revert InvalidCollateral();

        _symbioticVaults.add(vaultAddress);

        emit VaultAdded(vaultAddress);
    }

    function removeVault(address vaultAddress) external onlyOwner {
        if (vaultAddress == address(0)) revert ZeroAddress();
        if (!Address.isContract(vaultAddress)) revert NotContract();

        if (!_symbioticVaults.contains(vaultAddress)) revert NotAdded();

        _symbioticVaults.remove(vaultAddress);

        emit VaultRemoved(vaultAddress);
    }

    function setVault(address iVault) external onlyOwner {
        if (iVault == address(0)) revert ZeroAddress();
        if (!Address.isContract(iVault)) revert NotContract();
        emit VaultSet(_vault, iVault);
        _vault = iVault;
    }

    function setTrusteeManager(address _newTrusteeManager) external onlyOwner {
        if (_newTrusteeManager == address(0)) revert ZeroAddress();
        emit TrusteeManagerSet(_trusteeManager, _newTrusteeManager);
        _trusteeManager = _newTrusteeManager;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getVersion() external pure returns (uint256) {
        return 1;
    }
}
