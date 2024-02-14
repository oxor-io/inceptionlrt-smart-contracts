// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

contract XERC20FactoryDummy {
    function deployXERC20(
        string memory _name,
        string memory _symbol,
        uint256[] memory _minterLimits,
        uint256[] memory _burnerLimits,
        address[] memory _bridges
    ) external returns (address _xerc20) {}

    function deployLockbox(address _xerc20, address _baseToken, bool _isNative)
        external
        returns (address payable _lockbox)
    {}
}
