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


  it("should ensure ratio is not scaled by the expressions for orders with same batch", async function () { 

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


    // TAKE ORDER

    // Bob takes order with direct wallet transfer
    for(let i = 0 ; i < 10 ; i++){  

      // DEPOSIT
      const amountB = ethers.BigNumber.from("400000" + eighteenZeros); 

      // Batch Index Remains the same hence ratio remains the same 
      const ratio = await prbScale(0,strategyRatio)

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
       await orderBook.connect(alice).deposit(depositConfigStructAlice);

      const takeOrderConfigStruct = {
        order: Order_A,
        inputIOIndex: 0,
        outputIOIndex: 0,
       signedContext : []
      }; 

  
      const takeOrdersConfigStruct = {
        output: tokenA.address,
        input: tokenB.address,
        minimumInput: amountB,
        maximumInput: amountB,
        maximumIORatio: ratio,
        orders: [takeOrderConfigStruct],
      };
  
      const amountA = amountB.mul(ratio).div(ONE); 
  
      await tokenA.transfer(bob.address, amountA);
      await tokenA.connect(bob).approve(orderBook.address, amountA); 
  
  
      const txTakeOrders = await orderBook
        .connect(bob)
        .takeOrders(takeOrdersConfigStruct);   
        
      const { sender, config, input, output } = (await getEventArgs(
        txTakeOrders,
        "TakeOrder",
        orderBook
      ));  
    
      assert(sender === bob.address, "wrong sender");
      assert(input.eq(amountB), "wrong input");
      assert(output.eq(amountA), "wrong output");
  
      compareStructs(config, takeOrderConfigStruct); 

      // No delay is introduced as all orders are part of the same batch
      // await timewarp(86400)
    } 
    
  });  

  it.only("should ensure ratio is scaled exponentially by the expressions as batch index increases", async function () { 

    const signers = await ethers.getSigners();

    const [, alice, bob] = signers;   


    const aliceInputVault = ethers.BigNumber.from(randomUint256());
    const aliceOutputVault = ethers.BigNumber.from(randomUint256());
  

    const aliceOrder = encodeMeta("Order_A");  

    const strategyRatio = "25e13"

    // Order_A

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


    // TAKE ORDER 

    // Bob takes order with direct wallet transfer
    for(let i = 0 ; i < 10 ; i++){   

      // DEPOSIT

      // Scaling ratio as batch index increases 
      const ratio = await prbScale(i,strategyRatio)  

      // Deposit max amount per batch 
      const amountB = await scaleOutputMax(ratio.toString(),18) 

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
       await orderBook.connect(alice).deposit(depositConfigStructAlice);

      const takeOrderConfigStruct = {
        order: Order_A,
        inputIOIndex: 0,
        outputIOIndex: 0,
       signedContext : []
      }; 

      const takeOrdersConfigStruct = {
        output: tokenA.address,
        input: tokenB.address,
        minimumInput: amountB,
        maximumInput: amountB,
        maximumIORatio: ratio,
        orders: [takeOrderConfigStruct],
      };
     
      // Tracking Input Token amount 1000 
      let amountA = amountB.mul(ratio).div(ONE); 
      if(amountB.mul(ratio).mod(ONE).gt(ethers.BigNumber.from('1'))){
        amountA = amountA.add(1)
      }
      console.log("amountA : " , amountA )
  
      await tokenA.transfer(bob.address, amountA);
      await tokenA.connect(bob).approve(orderBook.address, amountA); 
  
  
      const txTakeOrders = await orderBook
        .connect(bob)
        .takeOrders(takeOrdersConfigStruct);   
        
      const { sender, config, input, output } = (await getEventArgs(
        txTakeOrders,
        "TakeOrder",
        orderBook
      ));      

      assert(sender === bob.address, "wrong sender"); 
      assert(input.eq(amountB), "wrong input");
      assert(output.eq(amountA), "wrong output");  
      compareStructs(config, takeOrderConfigStruct); 

      // Delay is introduced between batches
      await timewarp(86400)
    } 
    
  });  

}); 

