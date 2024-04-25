require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

require("./tasks/deploy-xerc20");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  networks: {
    hardhat: {
      forking: {
        url: `${process.env.RPC_URL_ETHEREUM}`,
        blockNumber: 18923449,
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545/",
    },
    mainnet: {
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY}`],
      url: `${process.env.RPC_URL_ETHEREUM}`,
      chainId: 1,
      gas: 8000000,
    },
    holesky: {
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY_TESTNET}`],
      url: `${process.env.RPC_URL_HOLESKY}`,
      chainId: 17000,
      gas: 8000000,
    },
    arbitrum: {
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY}`],
      url: `${process.env.RPC_URL_ARBITRUM}`,
      chainId: 42161,
      gas: 8000000,
    },
    arbitrum_testnet: {
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY_TESTNET}`],
      url: `${process.env.RPC_URL_ARBITRUM_TESTNET}`,
      chainId: 421614,
      gas: 8000000,
    },
    mode: {
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY}`],
      url: `${process.env.RPC_URL_MODE}`,
      chainId: 34443,
      gas: 8000000,
    },
    mode_testnet: {
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY_TESTNET}`],
      url: `${process.env.RPC_URL_MODE_TESTNET}`,
      chainId: 919,
      gas: 8000000,
    },
    xlayer: {
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY}`],
      url: `${process.env.RPC_URL_XLAYER}`,
      chainId: 196,
      gas: 8000000,
    },
    xlayer_testnet: {
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY_TESTNET}`],
      url: `${process.env.RPC_URL_XLAYER_TESTNET}`,
      chainId: 195,
      gas: 8000000,
    },
    linea: {
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY}`],
      url: `${process.env.RPC_URL_LINEA}`,
      chainId: 59144,
      gas: 8000000,
    },
    linea_testnet: {
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY_TESTNET}`],
      url: `${process.env.RPC_URL_LINEA_TESTNET}`,
      chainId: 59140,
      gas: 8000000,
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
};
