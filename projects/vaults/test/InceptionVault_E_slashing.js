const { ethers, upgrades, network } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const config = require("../hardhat.config");
const { expect } = require("chai");
const {
  addRewardsToStrategy,
  withdrawDataFromTx,
  impersonateWithEth,
  getRandomStaker,
  calculateRatio,
  mineBlocks,
  toWei,
  randomBI,
  randomBIMax,
  randomAddress,
  e18,
  day,
} = require("./helpers/utils.js");

BigInt.prototype.format = function() {
  return this.toLocaleString("de-DE");
};

assets = [
  {
    assetName: "rETH",
    assetAddress: "0x7322c24752f79c05FFD1E2a6FCB97020C1C264F1",
    assetPoolName: "RocketMockPool",
    assetPool: "0x320f3aAB9405e38b955178BBe75c477dECBA0C27",
    vaultName: "InrEthVault",
    vaultFactory: "ERC4626Facet_EL_E2",
    strategyManager: "0xdfB5f6CE42aAA7830E94ECFCcAd411beF4d4D5b6",
    assetStrategy: "0x3A8fBdf9e77DFc25d09741f51d3E181b25d0c4E0",
    iVaultOperator: "0xa4341b5Cf43afD2993e1ae47d956F44A2d6Fc08D",
    delegationManager: "0xA44151489861Fe9e3055d95adC98FbD462B948e7",
    rewardsCoordinator: "0xAcc1fb458a1317E886dB376Fc8141540537E68fE",
    withdrawalDelayBlocks: 400,
    ratioErr: 2n,
    transactErr: 5n,
    impersonateStaker: async (staker, iVault, asset, assetPool) => {
      const donor = await impersonateWithEth("0x570EDBd50826eb9e048aA758D4d78BAFa75F14AD", toWei(1));
      await asset.connect(donor).transfer(staker.address, toWei(1000));
      const balanceAfter = await asset.balanceOf(staker.address);
      await asset.connect(staker).approve(await iVault.getAddress(), balanceAfter);
      return staker;
    },
  },
];

//https://holesky.eigenlayer.xyz/restake
const nodeOperators = [
  "0x78FDDe7a5006cC64E109aeD99cA7B0Ad3d8687bb",
  "0x1B71f18fc496194b21D0669B5ADfE299a8cFEc42",
  "0x4Dbfa8bcccb1740d8044E1A093F9A078A88E45FE",
  "0x5B9A8c72B29Ee17e72ba8B9626Bf43a75B15FB3d",
  "0x139A091BcAad0ee1DAabe93cbBd194736B197FB6",
];
const minWithdrawalDelayBlocks = 50;
const nodeOperatorToRestaker = new Map();
const forcedWithdrawals = [];
let MAX_TARGET_PERCENT;

const initVault = async a => {
  const block = await ethers.provider.getBlock("latest");
  console.log(`Starting at block number: ${block.number}`);
  console.log("... Initialization of Inception ....");

  console.log("- Asset");
  const asset = await ethers.getContractAt(a.assetName, a.assetAddress);
  console.log("- Asset pool");
  const assetPool = await ethers.getContractAt(a.assetPoolName, a.assetPool);

  // 1. Inception token
  console.log("- iToken");
  const iTokenFactory = await ethers.getContractFactory("InceptionToken");
  const iToken = await upgrades.deployProxy(iTokenFactory, ["TEST InceptionLRT Token", "tINt"]);
  iToken.address = await iToken.getAddress();

  console.log("- Strategy");
  // const strategy = await ethers.deployContract("StrategyBaseDummy", [iToken]);
  // strategy.address = await strategy.getAddress();
  const strategy = await ethers.getContractAt("IStrategy", a.assetStrategy);

  // 2. Impersonate operator
  const iVaultOperator = await impersonateWithEth(a.iVaultOperator, e18);
  // 3. Staker implementation
  console.log("- Restaker implementation");
  const restakerImp = await ethers.deployContract("InceptionEigenRestaker");
  restakerImp.address = await restakerImp.getAddress();
  // 4. Delegation manager
  console.log("- Delegation manager");


  const delegationManagerMock = await ethers.deployContract("DelegationManager");
  console.log("mock target", delegationManagerMock.target);

  // todo: fix delegationManager implementation address
  await network.provider.send("hardhat_setCode", [
    "0xda6f662777adb5209644cf5cf1a61a2f8a99bf48",
    await network.provider.send("eth_getCode", [delegationManagerMock.target]),
  ]);

  const delegationManager = await ethers.getContractAt("DelegationManager", a.delegationManager);
  delegationManager.address = await delegationManager.getAddress();

  await delegationManager.on("SlashingWithdrawalQueued", (newRoot, migratedWithdrawal) => {
    // console.log(`===Withdrawal queued: ${migratedWithdrawal.shares[0]}`);
  });

  // 5. Ratio feed
  console.log("- Ratio feed");
  const iRatioFeedFactory = await ethers.getContractFactory("InceptionRatioFeed");
  const ratioFeed = await upgrades.deployProxy(iRatioFeedFactory, []);
  await ratioFeed.updateRatioBatch([iToken.address], [e18]); //Set initial ratio e18
  ratioFeed.address = await ratioFeed.getAddress();
  // 6. Inception library
  console.log("- InceptionLibrary");
  const iLibrary = await ethers.deployContract("InceptionLibrary");
  await iLibrary.waitForDeployment();

  // 7. Inception vault
  console.log("- iVault");
  const iVaultFactory = await ethers.getContractFactory("InceptionVault_EL", {
    libraries: { InceptionLibrary: await iLibrary.getAddress() },
  });

  const strategyManager = await ethers.getContractAt("IStrategyManager", a.strategyManager);
  strategyManager.address = await strategyManager.getAddress();

  const iVault = await upgrades.deployProxy(
    iVaultFactory,
    [a.vaultName, a.iVaultOperator, strategyManager.address, iToken.address, a.assetStrategy],
    { unsafeAllowLinkedLibraries: true },
  );
  iVault.address = await iVault.getAddress();

  console.log("iVault address", iVault.address);

  await iVault.on("DelegatedTo", (restaker, elOperator) => {
    nodeOperatorToRestaker.set(elOperator, restaker);
  });

  /// =========================== FACETS ===========================

  const setterFacetFactory = await ethers.getContractFactory("EigenSetterFacet", {
    libraries: { InceptionLibrary: await iLibrary.getAddress() },
  });
  const setterFacet = await setterFacetFactory.deploy();
  await setterFacet.waitForDeployment();
  await iVault.setSetterFacet(await setterFacet.getAddress());
  const iVaultSetters = await ethers.getContractAt("EigenSetterFacet", iVault.address);

  const eigenLayerFacetFactory = await ethers.getContractFactory("EigenLayerFacet", {
    libraries: { InceptionLibrary: await iLibrary.getAddress() },
  });
  const eigenLayerFacet = await eigenLayerFacetFactory.deploy();
  await eigenLayerFacet.waitForDeployment();
  await iVault.setEigenLayerFacet(await eigenLayerFacet.getAddress());
  const iVaultEL = await ethers.getContractAt("EigenLayerFacet", iVault.address);

  const ERC4626FacetFactory = await ethers.getContractFactory(a.vaultFactory, {
    libraries: { InceptionLibrary: await iLibrary.getAddress() },
  });
  const erc4626Facet = await ERC4626FacetFactory.deploy();
  await erc4626Facet.waitForDeployment();
  await iVault.setERC4626Facet(await erc4626Facet.getAddress());
  const iVault4626 = await ethers.getContractAt(a.vaultFactory, iVault.address);

  /// =========================== SET SIGNATURE <-> TARGETs ===========================

  /// =============================== SETTER ===============================

  let facetId = "0";
  let accessId = "2";

  let funcSig = setterFacet.interface.getFunction("setDelegationManager").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = setterFacet.interface.getFunction("setRewardsCoordinator").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = setterFacet.interface.getFunction("upgradeTo").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = setterFacet.interface.getFunction("setRatioFeed").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = setterFacet.interface.getFunction("addELOperator").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = setterFacet.interface.getFunction("setTreasuryAddress").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = setterFacet.interface.getFunction("setOperator").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = setterFacet.interface.getFunction("setMinAmount").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = setterFacet.interface.getFunction("setName").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = setterFacet.interface.getFunction("setTargetFlashCapacity").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = setterFacet.interface.getFunction("setProtocolFee").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = setterFacet.interface.getFunction("setDepositBonusParams").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = setterFacet.interface.getFunction("setFlashWithdrawFeeParams").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = setterFacet.interface.getFunction("setRewardsTimeline").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  /// =============================== ################## ===============================
  /// =============================== EigenLayer Handler ===============================
  /// =============================== ################## ===============================

  facetId = "1";
  accessId = "1";

  funcSig = eigenLayerFacet.interface.getFunction("delegateToOperator").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = eigenLayerFacet.interface.getFunction("redelegateToOperator").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = eigenLayerFacet.interface.getFunction("undelegateFrom").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = eigenLayerFacet.interface.getFunction("undelegateVault").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = eigenLayerFacet.interface.getFunction("claimCompletedWithdrawals").selector;
  /// Everyone is able to claim
  await iVault.setSignature(funcSig, facetId, "0");

  funcSig = eigenLayerFacet.interface.getFunction("updateEpoch").selector;
  await iVault.setSignature(funcSig, facetId, "0");

  funcSig = eigenLayerFacet.interface.getFunction("addRewards").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = eigenLayerFacet.interface.getFunction("forceUndelegateRecovery").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  /// ================================= ####### =================================
  /// ================================= ERC4626 =================================
  /// ================================= ####### =================================

  facetId = "2";
  accessId = "0";

  funcSig = ERC4626FacetFactory.interface.getFunction("deposit").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = ERC4626FacetFactory.interface.getFunction("mint").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = ERC4626FacetFactory.interface.getFunction("depositWithReferral").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = ERC4626FacetFactory.interface.getFunction("withdraw(uint256,address)").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = ERC4626FacetFactory.interface.getFunction("flashWithdraw").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = ERC4626FacetFactory.interface.getFunction("isAbleToRedeem").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = ERC4626FacetFactory.interface.getFunction("redeem(address)").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  funcSig = ERC4626FacetFactory.interface.getFunction("redeem(uint256,address,address)").selector;
  await iVault.setSignature(funcSig, facetId, accessId);

  /// ================================= ####### =================================

  [owner] = await ethers.getSigners();

  await iVaultSetters.setDelegationManager(delegationManager.address);
  await iVaultSetters.setRewardsCoordinator(a.rewardsCoordinator);
  await iVaultSetters.upgradeTo(await restakerImp.getAddress());
  await iVaultSetters.setRatioFeed(await ratioFeed.getAddress());
  await iVaultSetters.addELOperator(nodeOperators[0]);
  await iToken.setVault(await iVault.getAddress());

  MAX_TARGET_PERCENT = await iVault.MAX_TARGET_PERCENT();
  // in % (100 * e18 == 100 %)
  await iVaultSetters.setTargetFlashCapacity(1n);
  console.log(`... iVault initialization completed ....`);

  iVault.withdrawFromELAndClaim = async function(nodeOperator, amount) {
    let tx = await iVaultEL.connect(iVaultOperator).undelegateFrom(nodeOperator, amount);
    const restaker = nodeOperatorToRestaker.get(nodeOperator);
    const receipt = await tx.wait();
    if (receipt.logs.length !== 3) {
      console.error("WRONG NUMBER OF EVENTS in withdrawFromEigenLayerEthAmount()", receipt.logs.length);
      console.log(receipt.logs);
    }

    // Loop through each log in the receipt
    let WithdrawalQueuedEvent;
    for (const log of receipt.logs) {
      try {
        const event = eigenLayerFacetFactory.interface.parseLog(log);
        if (event != null) {
          WithdrawalQueuedEvent = event.args;
        }
      } catch (error) {
        console.error("Error parsing event log:", error);
      }
    }

    const withdrawalData = [
      WithdrawalQueuedEvent["stakerAddress"],
      nodeOperator,
      restaker,
      WithdrawalQueuedEvent["nonce"],
      WithdrawalQueuedEvent["withdrawalStartBlock"],
      [WithdrawalQueuedEvent["strategy"]],
      [WithdrawalQueuedEvent["shares"]],
    ];

    await mineBlocks(minWithdrawalDelayBlocks);
    await iVaultEL.connect(iVaultOperator).claimCompletedWithdrawals(restaker, [withdrawalData]);
  };

  iVault.delegateToOperator = async function(nodeOperator, amount) {
    const tx = await iVaultEL.connect(iVaultOperator)
      .delegateToOperator(amount, nodeOperator, ethers.ZeroHash, [ethers.ZeroHash, 0]);
    let receipt = await tx.wait();
    const events = receipt.logs?.filter(e => e.eventName === "DelegatedTo");
    nodeOperatorToRestaker.set(events[0].args[1], events[0].args[0]);
  };

  return [
    iToken,
    iVault,
    ratioFeed,
    asset,
    assetPool,
    strategy,
    iVaultOperator,
    restakerImp,
    delegationManager,
    iLibrary,
    iVaultSetters,
    iVaultEL,
    iVault4626,
    strategyManager,
  ];
};

assets.forEach(function(a) {
  describe("Withdrawal slashing", function() {
    this.timeout(150000);

    let iToken,
      iVault,
      ratioFeed,
      asset,
      assetPool,
      strategy,
      restakerImp,
      delegationManager,
      iLibrary,
      iVaultSetters,
      iVaultEL,
      iVault4626,
      strategyManager;
    let iVaultOperator, deployer, staker, staker2, staker3, treasury;
    let ratioErr, transactErr;
    let snapshot;

    before(async function() {
      await network.provider.send("hardhat_reset", [
        {
          forking: {
            jsonRpcUrl: a.url ? a.url : config.default.networks.hardhat.forking.url,
            blockNumber: a.blockNumber ? a.blockNumber : config.default.networks.hardhat.forking.blockNumber,
          },
        },
      ]);

      [
        iToken,
        iVault,
        ratioFeed,
        asset,
        assetPool,
        strategy,
        iVaultOperator,
        restakerImp,
        delegationManager,
        iLibrary,
        iVaultSetters,
        iVaultEL,
        iVault4626,
        strategyManager,
      ] = await initVault(a);
      ratioErr = a.ratioErr;
      transactErr = a.transactErr;

      [deployer, staker, staker2, staker3] = await ethers.getSigners();
      staker = await a.impersonateStaker(staker, iVault, asset, assetPool);
      staker2 = await a.impersonateStaker(staker2, iVault, asset, assetPool);
      staker3 = await a.impersonateStaker(staker3, iVault, asset, assetPool);
      treasury = await iVault.treasury(); //deployer

      snapshot = await helpers.takeSnapshot();
    });

    after(async function() {
      if (iVault) {
        await iVault.removeAllListeners();
      }
      if (delegationManager) {
        await delegationManager.removeAllListeners();
      }
    });

    describe("Flow", async function() {
      it("1 withdrawal", async function() {
        await snapshot.restore();

        // make deposit
        let deposited = toWei(10);
        let tx = await iVault4626.connect(staker).deposit(deposited, staker.address);
        await tx.wait();

        // // delegate all
        await iVault.delegateToOperator(nodeOperators[0], toWei(10));

        expect(await iVaultEL.connect(iVaultOperator).getTotalDelegated()).to.be.eq(toWei(10));
        expect(await calculateRatio(iVault, iToken)).to.be.closeTo(toWei(1), ratioErr);

        // withdraw
        tx = await iVault4626.connect(staker).withdraw(toWei(9), staker.address);
        await tx.wait();

        expect(await iVaultEL.connect(iVaultOperator).getTotalDelegated()).to.be.eq(toWei(10));
        expect(await iVaultEL.connect(iVaultOperator).totalAmountToWithdraw()).to.be.eq(toWei(9));
        expect(await calculateRatio(iVault, iToken)).to.be.closeTo(toWei(1), ratioErr);

        // queue withdrawals from EL
        tx = await iVaultEL.connect(iVaultOperator).undelegateFrom(nodeOperators[0], toWei(9));
        const withdrawalData = await withdrawDataFromTx(tx, nodeOperators[0], nodeOperatorToRestaker.get(nodeOperators[0]));

        expect(await iVaultEL.connect(iVaultOperator).getTotalDelegated()).to.be.eq(toWei(1));
        expect(await iVaultEL.connect(iVaultOperator).getPendingWithdrawalAmountFromEL()).to.be.closeTo(toWei(9), 5);
        expect(await iVaultEL.connect(iVaultOperator).totalAmountToWithdraw()).to.be.eq(toWei(9));
        expect(await calculateRatio(iVault, iToken)).to.be.closeTo(toWei(1), ratioErr);

        await mineBlocks(minWithdrawalDelayBlocks);

        // apply slash 50%
        tx = await delegationManager.applySlash(2);
        await tx.wait();

        // complete queued withdrawals from EL
        tx = await iVaultEL.connect(iVaultOperator).claimCompletedWithdrawals(nodeOperatorToRestaker.get(nodeOperators[0]), [withdrawalData]);
        await tx.wait();

        expect(await iVaultEL.connect(iVaultOperator).getTotalDelegated()).to.be.eq(toWei(0.5));
        expect(await iVaultEL.connect(iVaultOperator).getPendingWithdrawalAmountFromEL()).to.be.closeTo(toWei(4.5), 5);
        expect(await iVaultEL.connect(iVaultOperator).totalAmountToWithdraw()).to.be.eq(toWei(9));
        expect(await asset.balanceOf(iVault.address)).to.be.eq(toWei(4.5));
        expect(await calculateRatio(iVault, iToken)).to.be.closeTo(toWei(2), ratioErr);

        // update ratio
        await ratioFeed.updateRatioBatch([iToken.address], [await calculateRatio(iVault, iToken)]);

        // redeem
        tx = await iVault4626.connect(iVaultOperator).redeem(staker.address);
        await tx.wait();

        expect(await iVaultEL.connect(iVaultOperator).getTotalDelegated()).to.be.eq(toWei(0.5));
        expect(await iVaultEL.connect(iVaultOperator).getPendingWithdrawalAmountFromEL()).to.be.closeTo(toWei(0), 5);
        expect(await iVaultEL.connect(iVaultOperator).totalAmountToWithdraw()).to.be.eq(toWei(0));
        expect(await asset.balanceOf(iVault.address)).to.be.eq(toWei(0));
        expect(await calculateRatio(iVault, iToken)).to.be.closeTo(toWei(2), ratioErr);
      });

      // it("1 withdraw all", async function() {
      //   // make deposit
      //   let deposited = toWei(10);
      //   let tx = await iVault4626.connect(staker).deposit(deposited, staker.address);
      //   await tx.wait();
      //   console.log("deposited()\n\n");
      //
      //   // // delegate all
      //   await iVault.delegateToOperator(nodeOperators[0], toWei(10));
      //   console.log("delegateToOperator()");
      //   console.log("-----");
      //   console.log("ratio after delegate", ethers.formatEther(await calculateRatio(iVault, iToken)));
      //   console.log("vault balance after delegate: ", ethers.formatEther(await asset.balanceOf(iVault.address)));
      //   console.log("-----\n\n");
      //
      //   // withdraw
      //   tx = await iVault4626.connect(staker).withdraw(toWei(10), staker.address);
      //   await tx.wait();
      //   console.log("withdraw()");
      //   console.log("-----");
      //   console.log("ratio after withdraw", ethers.formatEther(await calculateRatio(iVault, iToken)));
      //   console.log("vault balance after withdraw : ", ethers.formatEther(await asset.balanceOf(iVault.address)));
      //   console.log("-----\n\n");
      //
      //   // queue withdrawals from EL
      //   tx = await iVaultEL.connect(iVaultOperator).undelegateFrom(nodeOperators[0], toWei(10));
      //   const withdrawalData = await withdrawDataFromTx(tx, nodeOperators[0], nodeOperatorToRestaker.get(nodeOperators[0]));
      //
      //   console.log("queueWithdrawals()");
      //   console.log("-----");
      //   console.log("ratio after withdraw", ethers.formatEther(await calculateRatio(iVault, iToken)));
      //   console.log("vault balance after withdraw : ", ethers.formatEther(await asset.balanceOf(iVault.address)));
      //   console.log("-----\n\n");
      //
      //   await mineBlocks(minWithdrawalDelayBlocks);
      //
      //   // apply slash 50%
      //   tx = await delegationManager.applySlash(2);
      //   await tx.wait();
      //
      //   // complete queued withdrawals from EL
      //   tx = await iVaultEL.connect(iVaultOperator).claimCompletedWithdrawals(nodeOperatorToRestaker.get(nodeOperators[0]), [withdrawalData]);
      //   await tx.wait();
      //
      //   console.log("-----");
      //   console.log("withdrawFromELAndClaim()");
      //   let ratio = await calculateRatio(iVault, iToken);
      //   console.log("ratio after withdrawFromELAndClaim", ethers.formatEther(ratio));
      //   console.log("vault balance after withdrawFromELAndClaim : ", ethers.formatEther(await asset.balanceOf(iVault.address)));
      //   console.log("-----\n\n");
      //
      //   // update ratio
      //   await ratioFeed.updateRatioBatch([iToken.address], [ratio]);
      //
      //   // redeem
      //   tx = await iVault4626.connect(iVaultOperator).redeem(staker.address);
      //   await tx.wait();
      //
      //   console.log("redeem()");
      //   console.log("-----");
      //   console.log("ratio after redeem", ethers.formatEther(await calculateRatio(iVault, iToken)));
      //   console.log("vault balance after redeem : ", ethers.formatEther(await asset.balanceOf(iVault.address)));
      //   console.log("-----");
      // });

      it("2 withdrawals", async function() {
        await snapshot.restore();

        // make deposit
        let deposited = toWei(10);
        let tx = await iVault4626.connect(staker).deposit(deposited, staker.address);
        await tx.wait();

        tx = await iVault4626.connect(staker2).deposit(deposited, staker2.address);
        await tx.wait();

        // // delegate all
        await iVault.delegateToOperator(nodeOperators[0], toWei(20));

        expect(await iVaultEL.connect(iVaultOperator).getTotalDelegated()).to.be.eq(toWei(20));
        expect(await calculateRatio(iVault, iToken)).to.be.closeTo(toWei(1), ratioErr);

        // withdraw
        tx = await iVault4626.connect(staker).withdraw(toWei(6), staker.address);
        await tx.wait();

        expect(await iVaultEL.connect(iVaultOperator).getTotalDelegated()).to.be.eq(toWei(20));
        expect(await iVaultEL.connect(iVaultOperator).getPendingWithdrawalAmountFromEL()).to.be.closeTo(toWei(0), 5);
        expect(await iVaultEL.connect(iVaultOperator).totalAmountToWithdraw()).to.be.eq(toWei(6));
        expect(await calculateRatio(iVault, iToken)).to.be.closeTo(toWei(1), ratioErr);

        tx = await iVault4626.connect(staker2).withdraw(toWei(8), staker2.address);
        await tx.wait();

        expect(await iVaultEL.connect(iVaultOperator).getTotalDelegated()).to.be.eq(toWei(20));
        expect(await iVaultEL.connect(iVaultOperator).getPendingWithdrawalAmountFromEL()).to.be.closeTo(toWei(0), 5);
        expect(await iVaultEL.connect(iVaultOperator).totalAmountToWithdraw()).to.be.eq(toWei(14));
        expect(await calculateRatio(iVault, iToken)).to.be.closeTo(toWei(1), ratioErr);

        // queue withdrawals from EL
        tx = await iVaultEL.connect(iVaultOperator).undelegateFrom(nodeOperators[0], toWei(14));
        const withdrawalData = await withdrawDataFromTx(tx, nodeOperators[0], nodeOperatorToRestaker.get(nodeOperators[0]));

        expect(await iVaultEL.connect(iVaultOperator).getTotalDelegated()).to.be.eq(toWei(6));
        expect(await iVaultEL.connect(iVaultOperator).getPendingWithdrawalAmountFromEL()).to.be.closeTo(toWei(14), 5);
        expect(await iVaultEL.connect(iVaultOperator).totalAmountToWithdraw()).to.be.eq(toWei(14));
        expect(await asset.balanceOf(iVault.address)).to.be.eq(toWei(0));
        expect(await calculateRatio(iVault, iToken)).to.be.closeTo(toWei(1), ratioErr);

        await mineBlocks(minWithdrawalDelayBlocks);

        // apply slash 50%
        tx = await delegationManager.applySlash(2);
        await tx.wait();

        // complete queued withdrawals from EL
        tx = await iVaultEL.connect(iVaultOperator).claimCompletedWithdrawals(nodeOperatorToRestaker.get(nodeOperators[0]), [withdrawalData]);
        await tx.wait();

        expect(await iVaultEL.connect(iVaultOperator).getTotalDelegated()).to.be.eq(toWei(3));
        expect(await iVaultEL.connect(iVaultOperator).getPendingWithdrawalAmountFromEL()).to.be.closeTo(toWei(7), 5);
        expect(await iVaultEL.connect(iVaultOperator).totalAmountToWithdraw()).to.be.eq(toWei(14));
        expect(await asset.balanceOf(iVault.address)).to.be.eq(toWei(7));
        expect(await calculateRatio(iVault, iToken)).to.be.closeTo(toWei(2), ratioErr);

        // update ratio
        await ratioFeed.updateRatioBatch([iToken.address], [await calculateRatio(iVault, iToken)]);

        // redeem
        tx = await iVault4626.connect(iVaultOperator).redeem(staker.address);
        await tx.wait();

        expect(await iVaultEL.connect(iVaultOperator).getTotalDelegated()).to.be.eq(toWei(3));
        expect(await iVaultEL.connect(iVaultOperator).getPendingWithdrawalAmountFromEL()).to.be.closeTo(toWei(4), 5);
        expect(await iVaultEL.connect(iVaultOperator).totalAmountToWithdraw()).to.be.eq(toWei(8));
        expect(await asset.balanceOf(iVault.address)).to.be.eq(toWei(4));
        expect(await calculateRatio(iVault, iToken)).to.be.closeTo(toWei(2), ratioErr);

        tx = await iVault4626.connect(iVaultOperator).redeem(staker2.address);
        await tx.wait();

        expect(await iVaultEL.connect(iVaultOperator).getTotalDelegated()).to.be.eq(toWei(3));
        expect(await iVaultEL.connect(iVaultOperator).getPendingWithdrawalAmountFromEL()).to.be.closeTo(0, 5);
        expect(await iVaultEL.connect(iVaultOperator).totalAmountToWithdraw()).to.be.eq(0);
        expect(await asset.balanceOf(iVault.address)).to.be.eq(0n);
        expect(await calculateRatio(iVault, iToken)).to.be.closeTo(toWei(2), ratioErr);
      });
    })

  });
});