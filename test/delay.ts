import { assert } from "chai";
import { ethers  } from "hardhat";


import { randomUint256 } from "../utils/bytes";
import {
  eighteenZeros,
  ONE,
  sixZeros,
} from "../utils/constants/bigNumber";

import { getEventArgs } from "../utils/events";
import {
  standardEvaluableConfig
} from "../utils/interpreter/interpreter";
import { compareStructs } from "../utils/test/compareStructs";
import deploy1820 from "../utils/deploy/registry1820/deploy";
import * as path from 'path'; 
import fs from "fs"  
import { assertError, resetFork, timewarp } from "../utils";
import * as mustache from 'mustache'; 
import { basicDeploy } from "../utils/deploy/basicDeploy"; 

import { getOrderBook } from "../utils/deploy/orderBook";
import { getExpressionDelopyer } from "../utils/deploy/interpreter";
import config from "../config/config.json"
import * as dotenv from "dotenv";
import { encodeMeta } from "../scripts/utils";
import { prbScale, scaleOutputMax, scaleRatio, takeOrder } from "../utils/orderBook";
dotenv.config();


export const fetchFile = (_path: string): string => {
  try {
    return fs.readFileSync(_path).toString();
  } catch (error) {
    console.log(error);
    return "";
  }
};  




describe("Pilot", async function () {
  let tokenA;
  let tokenB; 

  let orderBook
  let expressionDeployer

  beforeEach(async () => {
   
    await resetFork(config.hardhat.forkBaseUrl+process.env["ALCHEMY_KEY_MUMBAI"], config.hardhat.blockNumber)

    tokenA = (await basicDeploy("ReserveToken18", {})) ;
    tokenB = (await basicDeploy("ReserveToken18", {})) ; 
    await tokenA.initialize();
    await tokenB.initialize(); 

    orderBook = await getOrderBook(config.contracts.orderbook.address) 

    expressionDeployer = await getExpressionDelopyer(config.contracts.expressionDeployer.address) 


  });

  before(async () => {
    // Deploy ERC1820Registry
    const signers = await ethers.getSigners();
    await deploy1820(signers[0]);
  });  

  it("should ensure 24 hour delay is maintained between two batches", async function () { 

    const signers = await ethers.getSigners();

    const [, alice, bob] = signers;   

    const aliceInputVault = ethers.BigNumber.from(randomUint256());
    const aliceOutputVault = ethers.BigNumber.from(randomUint256());
  

    const aliceOrder = encodeMeta("Order_A"); 
    
    // Order_A
    const strategyRatio = "25e13"
    const strategyExpression = path.resolve(
      __dirname,
      "../src/1-in-token-batch.rain"
    );

    const strategyString = await fetchFile(strategyExpression); 

    const stringExpression = mustache.render(strategyString, {
      counterparty: bob.address,
      ratio: strategyRatio
    }); 

    const { sources, constants } = await standardEvaluableConfig(stringExpression)

    const EvaluableConfig_A = {
      deployer: expressionDeployer.address,
      sources,
      constants,
    }

    const orderConfig_A= {
      validInputs: [
        { token: tokenA.address, decimals: 18, vaultId: aliceInputVault },
      ],
      validOutputs: [
        { token: tokenB.address, decimals: 18, vaultId: aliceOutputVault },
      ],
      evaluableConfig: EvaluableConfig_A,
      meta: aliceOrder,
    };

    const txOrder_A = await orderBook.connect(alice).addOrder(orderConfig_A);

    const {
      order: Order_A
    } = (await getEventArgs(
      txOrder_A,
      "AddOrder",
      orderBook
    ));

     // BATCH 0
     const ratio0 = await prbScale(0,strategyRatio)  

     const amountB = await scaleOutputMax(ratio0.toString(),18) ; 
     
     // DEPOSIT
     // Deposit token equal to the size of the batch 
     const depositConfigStructAlice = {
       token: tokenB.address,
       vaultId: aliceOutputVault,
       amount: amountB,
     };
 
     await tokenB.transfer(alice.address, amountB);
     await tokenB
       .connect(alice)
       .approve(orderBook.address, depositConfigStructAlice.amount);
 
     // Alice deposits tokenB into her output vault
     await orderBook
       .connect(alice)
       .deposit(depositConfigStructAlice);
 
    // TAKE ORDER 0 
     const takeOrderConfigStruct0 = {
       order: Order_A,
       inputIOIndex: 0,
       outputIOIndex: 0,
       signedContext : []
     }; 
 
     
     const takeOrdersConfigStruct0 = {
       output: tokenA.address,
       input: tokenB.address,
       minimumInput: amountB,
       maximumInput: amountB,
       maximumIORatio: ratio0,
       orders: [takeOrderConfigStruct0],
     };
 
     const amountA0 = ethers.BigNumber.from('1000' + eighteenZeros)
 
     await tokenA.transfer(bob.address, amountA0);
     await tokenA.connect(bob).approve(orderBook.address, amountA0); 

     const txTakeOrders0 = await orderBook
        .connect(bob)
        .takeOrders(takeOrdersConfigStruct0)

      const { sender: sender0, config: config0, input:input0, output: output0 } = (await getEventArgs(
        txTakeOrders0,
        "TakeOrder",
        orderBook
      ));  


      assert(sender0 === bob.address, "wrong sender");
      assert(input0.eq(amountB), "wrong input");
      assert(output0.eq(amountA0), "wrong output");

      compareStructs(config0, takeOrderConfigStruct0);  

      // BATCH 1
     const ratio1 = await prbScale(1,strategyRatio)  

     const amountB1 = await scaleOutputMax(ratio1.toString(),18) ; 
     
     // DEPOSIT
     // Deposit token equal to the size of the batch 
     const depositConfigStructAlice1 = {
       token: tokenB.address,
       vaultId: aliceOutputVault,
       amount: amountB1,
     };
 
     await tokenB.transfer(alice.address, amountB1);
     await tokenB
       .connect(alice)
       .approve(orderBook.address, depositConfigStructAlice1.amount);
 
     // Alice deposits tokenB into her output vault
     await orderBook
       .connect(alice)
       .deposit(depositConfigStructAlice1);

     // TAKE ORDER 1  

     const takeOrderConfigStruct1 = {
      order: Order_A,
      inputIOIndex: 0,
      outputIOIndex: 0,
      signedContext : []
    }; 
    
    const takeOrdersConfigStruct1 = {
      output: tokenA.address,
      input: tokenB.address,
      minimumInput: amountB1,
      maximumInput: amountB1,
      maximumIORatio: ratio1,
      orders: [takeOrderConfigStruct1],
    };

    const amountA1 = ethers.BigNumber.from('1000' + eighteenZeros)

    await tokenA.transfer(bob.address, amountA1);
    await tokenA.connect(bob).approve(orderBook.address, amountA1);  

    await timewarp(43200);
    
    //Should fail as delay is not observed
    await assertError(
      async () =>
        await orderBook
      .connect(bob)
      .takeOrders(takeOrdersConfigStruct0),
      "",
      "Delay"
    )  

    await timewarp(41400);
    
    //Should fail as delay is not observed
    await assertError(
      async () =>
        await orderBook
      .connect(bob)
      .takeOrders(takeOrdersConfigStruct0),
      "",
      "Delay"
    ) 
    
    // Introducing Delay
    await timewarp(1800); 
    
    // Order should succeed after deplay is complete
    const txTakeOrders1 = await orderBook
        .connect(bob)
        .takeOrders(takeOrdersConfigStruct1)

      const { sender: sender1, config: config1, input:input1, output: output1 } = (await getEventArgs(
        txTakeOrders1,
        "TakeOrder",
        orderBook
      ));  


      assert(sender1 === bob.address, "wrong sender");
      assert(input1.eq(amountB1), "wrong input");
      assert(output1.eq(amountA1), "wrong output");

      compareStructs(config1, takeOrderConfigStruct0); 
        
  }); 


}); 

