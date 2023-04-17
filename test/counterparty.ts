import { assert } from "chai";
import { ethers  } from "hardhat";


import { randomUint256 } from "../utils/bytes";
import {
  eighteenZeros,
  ONE
} from "../utils/constants/bigNumber";

import { getEventArgs } from "../utils/events";
import {
  standardEvaluableConfig
} from "../utils/interpreter/interpreter";
import deploy1820 from "../utils/deploy/registry1820/deploy";
import * as path from 'path';
import { assertError, fetchFile, resetFork } from "../utils";
import * as mustache from 'mustache'; 
import { basicDeploy } from "../utils/deploy/basicDeploy"; 

import { getOrderBook } from "../utils/deploy/orderBook";
import { getExpressionDelopyer } from "../utils/deploy/interpreter";
import config from "../config/config.json"
import * as dotenv from "dotenv";
import { encodeMeta } from "../scripts/utils";
import { prbScale } from "../utils/orderBook";
dotenv.config();

describe("Counterparty", async function () {
  let tokenA;
  let tokenB; 

  let orderBook
  let expressionDeployer

  const testNetwork = "mumbai"


  beforeEach(async () => {
   
    await resetFork(config.hardhat.forkBaseUrl+process.env["ALCHEMY_KEY_MUMBAI"], config.hardhat.blockNumber)

    tokenA = (await basicDeploy("ReserveToken18", {})) ;
    tokenB = (await basicDeploy("ReserveToken18", {})) ; 
    await tokenA.initialize();
    await tokenB.initialize(); 

    orderBook = await getOrderBook(config.contracts[testNetwork].orderbook.address) 

    expressionDeployer = await getExpressionDelopyer(config.contracts[testNetwork].expressionDeployer.address) 


  });

  before(async () => {
    // Deploy ERC1820Registry
    const signers = await ethers.getSigners();
    await deploy1820(signers[0]);
  });  


 
  it("should ensure only conterparties are able to takeOrders", async function () {  
  
    const signers = await ethers.getSigners();

    const [ , alice, bob, carol] = signers;    

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

     // DEPOSIT
     // Deposit token equal to the size of the batch
     const amountB = ethers.BigNumber.from("1000" + eighteenZeros);
 
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
 
     const takeOrderConfigStruct = {
       order: Order_A,
       inputIOIndex: 0,
       outputIOIndex: 0,
       signedContext: []
     }; 
 
     let ratio = await prbScale(0,strategyRatio) 
 
     const takeOrdersConfigStruct = {
       output: tokenA.address,
       input: tokenB.address,
       minimumInput: amountB,
       maximumInput: amountB,
       maximumIORatio: ratio,
       orders: [takeOrderConfigStruct],
     };
 
     const amountA = amountB.mul(ratio).div(ONE); 
 
     await tokenA.transfer(carol.address, amountA);
     await tokenA.connect(carol).approve(orderBook.address, amountA); 

     await assertError(
      async () =>
         await orderBook
        .connect(carol)
        .takeOrders(takeOrdersConfigStruct),
      "",
      "Invalid Conterparty"
    );
        
  }); 


}); 

