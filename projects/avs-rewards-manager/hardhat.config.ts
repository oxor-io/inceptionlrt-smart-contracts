import { HardhatUserConfig } from "hardhat/config";
import { CONFIG } from "../../hh.config";
import "@nomicfoundation/hardhat-toolbox";

// Hardhat tasks
import "./tasks/get-restakers-rewards";

const config: HardhatUserConfig = {
  ...(CONFIG as HardhatUserConfig),
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};

export default config;
