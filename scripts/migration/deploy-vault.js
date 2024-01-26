const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

const deployVault = async (addresses, vaultName, tokenName, tokenSymbol) => {
  const [deployer] = await ethers.getSigners();

  console.log(`Deploying ${vaultName} with the account: ${deployer.address}`);
  const initBalance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", initBalance.toString());

  // 1. Inception token
  const iTokenFactory = await hre.ethers.getContractFactory("InceptionToken");
  const iToken = await upgrades.deployProxy(iTokenFactory, [tokenName, tokenSymbol]);
  await iToken.deployed();

  const iTokenAddress = iToken.address;
  console.log(`InceptionToken address: ${iTokenAddress}`);

  let strategyAddress;
  let vaultFactory = "InVault_E1";
  switch (vaultName) {
    case "InstEthVault":
      vaultFactory = "InVault_E2";
      strategyAddress = addresses.LidoStrategy;
      break;
    case "InrEthVault":
      vaultFactory = "InVault_E2";
      strategyAddress = addresses.RocketStrategy;
      break;
    case "InosEthVault":
      strategyAddress = addresses.StakewiseStrategy;
      break;
    case "InoEthVault":
      strategyAddress = addresses.OriginStrategy;
      break;
    case "InankrEthVault":
      strategyAddress = addresses.AnkrStrategy;
      break;
    case "InwbEthVault":
      strategyAddress = addresses.BinanceStrategy;
      break;
    case "IncbEthVault":
      strategyAddress = addresses.CoinbaseStrategy;
      break;
    case "InswEthVault":
      strategyAddress = addresses.SwellStrategy;
      break;
    case "InEthxVault":
      strategyAddress = addresses.StaderStrategy;
      break;
  }

  console.log(addresses.Operator, addresses.StrategyManager, iTokenAddress, strategyAddress);

  // 2. Inception vault
  const InceptionVaultFactory = await hre.ethers.getContractFactory(vaultFactory);
  const iVault = await upgrades.deployProxy(InceptionVaultFactory, [
    vaultName,
    addresses.Operator,
    addresses.StrategyManager,
    iTokenAddress,
    strategyAddress,
  ]);
  await iVault.deployed();

  const iVaultAddress = iVault.address;
  console.log(`InceptionVault address: ${iVaultAddress}`);

  // 3. set the vault
  tx = await iToken.setVault(iVaultAddress);
  await tx.wait();

  const fininalBalance = await deployer.provider.getBalance(deployer.address);

  console.log(`deployed spent: ${initBalance - fininalBalance}`);

  // 4. save addresses localy
  const iAddresses = {
    iVaultAddress: iVaultAddress,
    iTokenAddress: iTokenAddress,
  };

  const json_addresses = JSON.stringify(iAddresses);
  fs.writeFileSync(`./scripts/migration/addresses/${network.name}_${vaultName}.json`, json_addresses);
};

module.exports = {
  deployVault,
};
