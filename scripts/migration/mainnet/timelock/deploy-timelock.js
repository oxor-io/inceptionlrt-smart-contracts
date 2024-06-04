const { ethers } = require("hardhat");

/// multisig
const ownerAddress = "0x7fAE3db2f5d0F173AEe2ce98668bCDCfC904d0aE";

const minDelay = "86400";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(`Deploying InceptionTimeLock with the account: ${deployer.address}`);

  const args = [minDelay, [deployer.address], [ownerAddress]];

  const timelock = await ethers.deployContract("InceptionTimeLock", args);
  await timelock.deployed();
  console.log(`InceptionTimeLock was deployed with the address: ${timelock.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
