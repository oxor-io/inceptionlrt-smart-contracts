const fs = require("fs").promises;
const path = require("path");
// Assuming config.json contains the necessary values
const configTemplate = require("./deploy_template.json");
const addressesPath = "./scripts/migration/addresses";

const factoryAddress = "0xb913bE186110B1119d5B9582F316f142c908fc25";

async function readJsonFiles(dirPath) {
  const vaults = new Map();
  try {
    const files = await fs.readdir(dirPath);
    const jsonFiles = files.filter((file) => path.extname(file).toLowerCase() === ".json");

    for (const file of jsonFiles) {
      const filePath = path.join(dirPath, file);
      const fileContent = await fs.readFile(filePath, "utf8");
      const jsonData = JSON.parse(fileContent);
      const modifiedName = file.replace("mainnet_", "").replace(".json", "");
      vaults.set(modifiedName, jsonData);
    }
  } catch (error) {
    console.error("Error reading JSON files:", error);
  }

  return vaults;
}

task("deploy-xerc20", "TODO")
  .addParam("vault", "the name of the vault")
  .addParam("execute", "DO deploy")
  .setAction(async (taskArgs) => {
    const inputVaultName = taskArgs["vault"];
    const execute = taskArgs["execute"];
    const vaults = await readJsonFiles(addressesPath);

    let data = "";
    for (const [vaultName, vaultData] of vaults) {
      if (vaultName == inputVaultName) {
        data = vaultData;
        break;
      }
    }
    if (data == "") {
      console.error("the wrong vault name");
      return;
    }

    const deployData = await generateCalldata(data, configTemplate);
    if (execute == "0") {
      console.log(deployData);
    } else {
      await deploy(deployData);
    }
  });

const deploy = async (deployCallData) => {
  const xERC20Address = await deployXERC20(factoryAddress, deployCallData);
  console.log("xERC20 address: ", xERC20Address);

  if (deployCallData.homeChain) {
    const lockBoxAddress = await deployLockBox(factoryAddress, xERC20Address, deployCallData.tokenAddress);
    console.log("LockBox address: ", lockBoxAddress);
  }
};

async function deployXERC20(factoryAddress, xERC20Config) {
  console.log("... Deploying of xERC20 token ...");

  const xERC20Factory = await hre.ethers.getContractFactory("XERC20FactoryDummy");
  const factory = await xERC20Factory.attach(factoryAddress);
  const tx = await factory.deployXERC20(
    xERC20Config.tokenName,
    xERC20Config.tokenSymbol,
    xERC20Config.minterLimits,
    xERC20Config.burnerLimits,
    xERC20Config.bridges
  );
  const receipt = await tx.wait();

  return receipt.events[receipt.events.length - 1].args._xerc20;
}

async function deployLockBox(factoryAddress, xERC20Address, baseTokenAddress) {
  const xERC20Factory = await hre.ethers.getContractFactory("XERC20FactoryDummy");
  const factory = await xERC20Factory.attach(factoryAddress);
  console.log(xERC20Address, baseTokenAddress);
  let tx = await factory.deployLockbox(xERC20Address, baseTokenAddress, false);
  const receipt = await tx.wait();

  return receipt.events[receipt.events.length - 1].args._lockbox;
}

const generateCalldata = async (vaultData, configFile) => {
  /// get token name and symbol
  let homeChain = false;
  let tokenName, tokenSymbol;
  try {
    const token = await hre.ethers.getContractAt("InceptionToken", vaultData.iTokenAddress);
    tokenName = await token.name();
    tokenSymbol = await token.symbol();
    homeChain = true;
  } catch (err) {
    // get from the config file -> destinationChain
    homeChain = false;
    tokenName = configFile.tokenName;
    tokenSymbol = configFile.tokenSymbol;
  }

  return {
    homeChain: homeChain,
    tokenAddress: vaultData.iTokenAddress,
    tokenName: tokenName,
    tokenSymbol: tokenSymbol,
    minterLimits: [configFile.bridgeDetails.mintLimit],
    burnerLimits: [configFile.bridgeDetails.burnLimit],
    bridges: [configFile.bridgeDetails.bridge],
  };
};
