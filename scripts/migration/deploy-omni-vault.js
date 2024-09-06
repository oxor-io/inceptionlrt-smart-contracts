const { ethers, upgrades } = require("hardhat");

const deployContracts = async () => {
  const [deployer] = await ethers.getSigners();

  console.log(`Deploying contracts with the account: ${deployer.address}`);
  const initBalance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", initBalance.toString());

  // 1. Deploy InceptionToken
  const iTokenFactory = await ethers.getContractFactory("InceptionToken");
  const iToken = await upgrades.deployProxy(iTokenFactory, ["InceptionToken", "InETH"], { kind: "transparent" });
  await iToken.waitForDeployment();
  const iTokenAddress = await iToken.getAddress();
  console.log(`InceptionToken deployed at: ${iTokenAddress}`);

  // 2. Deploy CrossChainAdapter
  const adapterFactory = await ethers.getContractFactory("CrossChainAdapter");
  const crossChainAdapter = await adapterFactory.deploy(
    "0xB2ffC99e913970FddAdb82762459bF8E4DcaAc54", // Arbitrum Inbox Address 
    "0x1111111111111111111111111111111111111111"  //l1 cross chain adapter
  );
  await crossChainAdapter.waitForDeployment();
  const crossChainAdapterAddress = await crossChainAdapter.getAddress();
  console.log(`CrossChainAdapter deployed at: ${crossChainAdapterAddress}`);

  // 3. Deploy InceptionOmniVault
  const vaultFactory = await ethers.getContractFactory("InceptionOmniVault");
  const inceptionOmniVault = await upgrades.deployProxy(
    vaultFactory,
    ["InceptionVault", iTokenAddress, deployer.address], // Vault name, token address, and treasury address
    { kind: "transparent" }
  );
  await inceptionOmniVault.waitForDeployment();
  const inceptionOmniVaultAddress = await inceptionOmniVault.getAddress();
  console.log(`InceptionOmniVault deployed at: ${inceptionOmniVaultAddress}`);

  // 4. Set the vault address in InceptionToken
  const tx = await iToken.setVault(inceptionOmniVaultAddress);
  await tx.wait();
  console.log("Vault address set in InceptionToken");

  const finalBalance = await deployer.provider.getBalance(deployer.address);
  console.log(`Deployment completed. Gas spent: ${initBalance.sub(finalBalance).toString()}`);
};

module.exports = {
  deployContracts,
};
