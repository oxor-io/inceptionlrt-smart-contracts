import { task } from "hardhat/config";
import { exec } from "child_process";
import * as fs from "fs";
import * as util from "util";
import * as path from "path";

const execAsync = util.promisify(exec);

task("get-rewards", "Processes restakers based on the config file").setAction(async (taskArgs) => {
  // Path to the eigenlayer binary
  const EIGENLAYER_BIN = path.join(process.env.HOME || "", "bin", "eigenlayer");
  const CONFIG_FILE = "./restakers.json";

  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`Error: Cannot read configuration file '${CONFIG_FILE}'.`);
    process.exit(1);
  }

  interface Config {
    network: {
      [networkName: string]: string[];
    };
  }

  const configData = fs.readFileSync(CONFIG_FILE, "utf-8");
  let config: Config;

  try {
    config = JSON.parse(configData);
  } catch (error: any) {
    console.error(`Error parsing JSON file: ${error.message}`);
    process.exit(1);
  }

  function parseOutput(output: string): { tokenAddress: string; weiAmount: string }[] {
    const lines = output.split("\n");
    const dataStartIndex = lines.findIndex((line) => line.startsWith("----")) + 1;
    const dataEndIndex = lines.lastIndexOf("---------------------------------------------------------------------------------------");

    const dataLines = lines.slice(dataStartIndex, dataEndIndex);
    const filteredLines = dataLines.filter((line) => line.trim() !== "");

    const results = filteredLines
      .map((line) => {
        const [tokenAddress, weiAmount] = line.split("|").map((part) => part.trim());
        return { tokenAddress, weiAmount };
      })
      .filter((entry) => entry.tokenAddress && entry.weiAmount);

    return results;
  }

  for (const network in config.network) {
    const addresses = config.network[network];

    for (const address of addresses) {
      if (!network || !address) {
        console.warn("Warning: Missing network or address in the configuration.");
        continue;
      }

      // Log the network and address being processed
      console.log(`Processing Network: ${network}, Address: ${address}`);

      // Build the command
      const command = `"${EIGENLAYER_BIN}" rewards show --network "${network}" --earner-address "${address}" --claim-type unclaimed`;

      try {
        // Execute the command
        const { stdout, stderr } = await execAsync(command);

        if (stderr) {
          console.error(`Error executing command: ${stderr}`);
          continue;
        }

        // Parse the output
        const parsedData = parseOutput(stdout);

        if (parsedData.length === 0) {
          console.log("No data found for this address.");
          continue;
        }

        for (const entry of parsedData) {
          if (entry.tokenAddress.includes("Token Address")) {
            continue;
          }

          console.log(`Token Address: ${entry.tokenAddress}, Wei Amount: ${entry.weiAmount}`);
          // Additional processing can be added here
        }
      } catch (error: any) {
        console.error(`Command execution failed: ${error.message}`);
      }
    }
  }
});
