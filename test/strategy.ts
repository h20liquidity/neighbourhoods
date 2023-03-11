import { assert } from "chai";
import { ethers } from "hardhat";
import { ReserveToken18 } from "../typechain";
import { AddOrderEvent,  DepositConfigStruct,  OrderConfigStruct } from "../typechain/contracts/orderbook/IOrderBookV1";
import {  basicDeploy, compareStructs, eighteenZeros, generateEvaluableConfig, getEventArgs,  randomUint256, standardEvaluableConfig } from "../utils";
import { deployOrderBook } from "../utils/deploy/orderBook/deploy";
import {deploy1820} from "@rainprotocol/rain-protocol/utils/deploy/registry1820/deploy";
import * as path from 'path'; 
import fs from "fs"
import { DepositEvent } from "../typechain/contracts/orderbook/OrderBook";



describe("OrderBook add order", async function () {
  let tokenA: ReserveToken18;
  let tokenB: ReserveToken18;

  beforeEach(async () => {
    tokenA = (await basicDeploy("ReserveToken18", {})) as ReserveToken18;
    tokenB = (await basicDeploy("ReserveToken18", {})) as ReserveToken18; 
    await tokenA.initialize();
    await tokenB.initialize();
  });

  before(async () => {
    // Deploy ERC1820Registry
    const signers = await ethers.getSigners();
    await deploy1820(signers[0]);
  }); 

  const fetchFile = (_path: string): string => {
    try {
      return fs.readFileSync(_path).toString();
    } catch (error) {
      console.log(error);
      return "";
    }
  };

  it("Add strategy order", async function () { 

    console.log("test")
    const signers = await ethers.getSigners();

    const [, alice] = signers; 

    const orderBook = await deployOrderBook();

    const aliceInputVault = ethers.BigNumber.from(randomUint256());
    const aliceOutputVault = ethers.BigNumber.from(randomUint256());
  

    const aliceOrder = ethers.utils.toUtf8Bytes("Order_A"); 
    
    const strategyExpression = path.resolve(
      __dirname,
      "../src/0-pilot.rain"
    );

    const strategyString = await fetchFile(strategyExpression); 


    // Order_A

    const { sources, constants } = await standardEvaluableConfig(strategyString)

    const EvaluableConfig_A = await generateEvaluableConfig(
      sources,
      constants
    );

    const orderConfig_A: OrderConfigStruct = {
      validInputs: [
        { token: tokenA.address, decimals: 18, vaultId: aliceInputVault },
      ],
      validOutputs: [
        { token: tokenB.address, decimals: 18, vaultId: aliceOutputVault },
      ],
      evaluableConfig: EvaluableConfig_A,
      data: aliceOrder,
    };

    const txOrder_A = await orderBook.connect(alice).addOrder(orderConfig_A);

    const {
      sender: sender_A,
      expressionDeployer: ExpressionDeployer_A,
      order: order_A,
    } = (await getEventArgs(
      txOrder_A,
      "AddOrder",
      orderBook
    )) as AddOrderEvent["args"];

    assert(
      ExpressionDeployer_A === EvaluableConfig_A.deployer,
      "wrong expression deployer"
    );
    assert(sender_A === alice.address, "wrong sender");
    compareStructs(order_A, orderConfig_A);    

    console.log("order_A : " , order_A )

    // DEPOSIT
    // Deposit token equal to the size of the batch
    const amountB = ethers.BigNumber.from("1000" + eighteenZeros);

    const depositConfigStructAlice: DepositConfigStruct = {
      token: tokenB.address,
      vaultId: aliceOutputVault,
      amount: amountB,
    };

    await tokenB.transfer(alice.address, amountB);
    await tokenB
      .connect(alice)
      .approve(orderBook.address, depositConfigStructAlice.amount);

    // Alice deposits tokenB into her output vault
    const txDepositOrderAlice = await orderBook
      .connect(alice)
      .deposit(depositConfigStructAlice);

    const { sender: depositAliceSender, config: depositAliceConfig } =
      (await getEventArgs(
        txDepositOrderAlice,
        "Deposit",
        orderBook
      )) as DepositEvent["args"];

    assert(depositAliceSender === alice.address);
    compareStructs(depositAliceConfig, depositConfigStructAlice); 


  }); 


});
