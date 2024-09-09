import { ethers } from "hardhat";

async function main() {
    const [user] = await ethers.getSigners();

    // NB!
    const inceptionOmniVaultAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"; // update with deployed vault address
    const inETHAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // update with deployed InETH address

    // 1. Get contract instances
    const inceptionOmniVault = await ethers.getContractAt("InceptionOmniVault", inceptionOmniVaultAddress);
    const inETH = await ethers.getContractAt("InceptionToken", inETHAddress);

    // 2. Check user's ETH and InETH balance before the deposit
    const userEthBalanceBefore = await ethers.provider.getBalance(user.address);
    const userInETHBalanceBefore = await inETH.balanceOf(user.address);

    console.log(`User ETH balance before deposit: ${ethers.formatUnits(userEthBalanceBefore, 18)} ETH`);
    console.log(`User InETH balance before deposit: ${ethers.formatUnits(userInETHBalanceBefore, 18)} InETH`);

    // 3. Deposit 10 ETH into the vault
    const depositAmount = ethers.parseUnits("10", 18); // 10 ETH
    const depositTx = await inceptionOmniVault.connect(user).deposit(user.address, { value: depositAmount });
    await depositTx.wait();
    console.log(`Deposited 10 ETH into InceptionOmniVault`);

    // 4. Check user's ETH and InETH balance after the deposit
    const userEthBalanceAfter = await ethers.provider.getBalance(user.address);
    const userInETHBalanceAfter = await inETH.balanceOf(user.address);

    console.log(`User ETH balance after deposit: ${ethers.formatUnits(userEthBalanceAfter, 18)} ETH`);
    console.log(`User InETH balance after deposit: ${ethers.formatUnits(userInETHBalanceAfter, 18)} InETH`);

    // 5. Check InceptionOmniVault's ETH and InETH balance
    const vaultEthBalance = await ethers.provider.getBalance(inceptionOmniVaultAddress);
    const vaultInETHBalance = await inETH.balanceOf(inceptionOmniVaultAddress);

    console.log(`InceptionOmniVault ETH balance: ${ethers.formatUnits(vaultEthBalance, 18)} ETH`);
    console.log(`InceptionOmniVault InETH balance: ${ethers.formatUnits(vaultInETHBalance, 18)} InETH`);

    // 6. Call the sendAssetsInfoToL1 function (ensure the user is allowed to call it)
    try {
        const sendAssetsInfoTx = await inceptionOmniVault.connect(user).sendAssetsInfoToL1();
        await sendAssetsInfoTx.wait();
        console.log(`Sent assets info to L1 from InceptionOmniVault`);
    } catch (error) {
        console.error("Failed to send assets info to L1: ", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });