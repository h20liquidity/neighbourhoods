import { assert } from "chai";
import { ethers  } from "hardhat";


import { randomUint256 } from "../utils/bytes";
import {
  eighteenZeros,
  max_uint256,
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
import { assertError, fetchFile, resetFork, timewarp } from "../utils";
import * as mustache from 'mustache'; 
import { basicDeploy } from "../utils/deploy/basicDeploy"; 

import { getOrderBook } from "../utils/deploy/orderBook";
import { getExpressionDelopyer } from "../utils/deploy/interpreter";
import config from "../config/config.json"
import * as dotenv from "dotenv";
import { encodeMeta } from "../scripts/utils";
import { prbScale, scaleOutputMax, scaleRatio, takeOrder } from "../utils/orderBook";
dotenv.config();



describe("Decimals", async function () {
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

  describe("should chain orders within same batch with decimals", () => { 

    it("should ensure ratio is not scaled based on input/output token decimals: (Input Decimals: 6 vs Output Decimals: 18)", async function () { 

      const tokenA06 = (await basicDeploy("ReserveTokenDecimals", {}, [
        6,
      ]));
      const tokenB18 = (await basicDeploy("ReserveTokenDecimals", {}, [
        18,
      ])); 

      await tokenA06.initialize();
      await tokenB18.initialize();
  
      const tokenADecimals = await tokenA06.decimals();
      const tokenBDecimals = await tokenB18.decimals();  
  
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
          { token: tokenA06.address, decimals: tokenADecimals, vaultId: aliceInputVault },
        ],
        validOutputs: [
          { token: tokenB18.address, decimals: tokenBDecimals, vaultId: aliceOutputVault },
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
  
  
      // Recursively places orders within a batch
      for(let i = 0 ; i < 10 ; i++){  

         // No need to scale ratio as batch index remains the same
         let ratio = await prbScale(0,strategyRatio) 
  
        // DEPOSIT
        // Max deposit for batch
        const amountB = ethers.BigNumber.from("400000" + eighteenZeros);
  
        const depositConfigStructAlice = {
          token: tokenB18.address,
          vaultId: aliceOutputVault,
          amount: amountB,
        };
  
        await tokenB18.transfer(alice.address, amountB);
        await tokenB18
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
        
       
      
        const maximumIORatio = await scaleRatio(ratio,tokenADecimals,tokenBDecimals)
    
        const takeOrdersConfigStruct = {
          output: tokenA06.address,
          input: tokenB18.address,
          minimumInput: amountB,
          maximumInput: amountB,
          maximumIORatio: maximumIORatio,
          orders: [takeOrderConfigStruct],
        };
    
        const amountA = amountB.mul(maximumIORatio).div(ONE) 
        
        await tokenA06.transfer(bob.address, amountA);
        await tokenA06.connect(bob).approve(orderBook.address, amountA); 
    
    
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
      } 
      
    });  

    it("should ensure ratio is not scaled based on input/output token decimals: (Input Decimals: 18 vs Output Decimals: 6)", async function () { 

      const tokenA18 = (await basicDeploy("ReserveTokenDecimals", {}, [
        18,
      ]));
      const tokenB06 = (await basicDeploy("ReserveTokenDecimals", {}, [
        6,
      ])); 

      await tokenA18.initialize();
      await tokenB06.initialize();
  
      const tokenADecimals = await tokenA18.decimals();
      const tokenBDecimals = await tokenB06.decimals();  
  
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
          { token: tokenA18.address, decimals: tokenADecimals, vaultId: aliceInputVault },
        ],
        validOutputs: [
          { token: tokenB06.address, decimals: tokenBDecimals, vaultId: aliceOutputVault },
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
  
  
      // Recursively places orders within a batch
      for(let i = 0 ; i < 10 ; i++){   

        // No need to scale ratio as batch index remains the same
        let ratio = await prbScale(0,strategyRatio) 
  
        // DEPOSIT
        const amountB = ethers.BigNumber.from("400000" + sixZeros);
  
        const depositConfigStructAlice = {
          token: tokenB06.address,
          vaultId: aliceOutputVault,
          amount: amountB,
        };
  
        await tokenB06.transfer(alice.address, amountB);
        await tokenB06
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
        
      
        const maximumIORatio = await scaleRatio(ratio,tokenADecimals,tokenBDecimals)
    
        const takeOrdersConfigStruct = {
          output: tokenA18.address,
          input: tokenB06.address,
          minimumInput: amountB,
          maximumInput: amountB,
          maximumIORatio: maximumIORatio,
          orders: [takeOrderConfigStruct],
        };
    
        const amountA = amountB.mul(maximumIORatio).div(ONE) 
        
        await tokenA18.transfer(bob.address, amountA);
        await tokenA18.connect(bob).approve(orderBook.address, amountA); 
    
    
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
      } 
      
    });  

    it("should ensure ratio is not scaled based on input/output token decimals: (Input Decimals: 6 vs Output Decimals: 6)", async function () { 

      const tokenA06 = (await basicDeploy("ReserveTokenDecimals", {}, [
        6,
      ]));
      const tokenB06 = (await basicDeploy("ReserveTokenDecimals", {}, [
        6,
      ])); 

      await tokenA06.initialize();
      await tokenB06.initialize();
  
      const tokenADecimals = await tokenA06.decimals();
      const tokenBDecimals = await tokenB06.decimals();  
  
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
          { token: tokenA06.address, decimals: tokenADecimals, vaultId: aliceInputVault },
        ],
        validOutputs: [
          { token: tokenB06.address, decimals: tokenBDecimals, vaultId: aliceOutputVault },
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
  
  
      // Recursively places orders within a batch
      for(let i = 0 ; i < 10 ; i++){   

        // No need to scale ratio as batch index remains the same
        let ratio = await prbScale(0,strategyRatio)
  
        // DEPOSIT
        const amountB = ethers.BigNumber.from("400000" + sixZeros);
  
        const depositConfigStructAlice = {
          token: tokenB06.address,
          vaultId: aliceOutputVault,
          amount: amountB,
        };
  
        await tokenB06.transfer(alice.address, amountB);
        await tokenB06
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
         
      
        const maximumIORatio = await scaleRatio(ratio,tokenADecimals,tokenBDecimals)
    
        const takeOrdersConfigStruct = {
          output: tokenA06.address,
          input: tokenB06.address,
          minimumInput: amountB,
          maximumInput: amountB,
          maximumIORatio: maximumIORatio,
          orders: [takeOrderConfigStruct],
        };
    
        const amountA = amountB.mul(maximumIORatio).div(ONE) 
        
        await tokenA06.transfer(bob.address, amountA);
        await tokenA06.connect(bob).approve(orderBook.address, amountA); 
    
    
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
      } 
      
    });  

    // Precision of token with zero decimals if the ratio is small.
    xit("should ensure ratio is not scaled based on input/output token decimals: (Input Decimals: 0 vs Output Decimals: 18)", async function () { 

      const tokenA00 = (await basicDeploy("ReserveTokenDecimals", {}, [
        0,
      ]));
      const tokenB18 = (await basicDeploy("ReserveTokenDecimals", {}, [
        18,
      ])); 

      await tokenA00.initialize();
      await tokenB18.initialize();
  
      const tokenADecimals = await tokenA00.decimals();
      const tokenBDecimals = await tokenB18.decimals();  
  
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
          { token: tokenA00.address, decimals: tokenADecimals, vaultId: aliceInputVault },
        ],
        validOutputs: [
          { token: tokenB18.address, decimals: tokenBDecimals, vaultId: aliceOutputVault },
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
  
  
      // Recursively places orders within a batch
      for(let i = 0 ; i < 10 ; i++){  
  
        // DEPOSIT
        const amountB = ethers.BigNumber.from("100" + eighteenZeros);
  
        const depositConfigStructAlice = {
          token: tokenB18.address,
          vaultId: aliceOutputVault,
          amount: amountB,
        };
  
        await tokenB18.transfer(alice.address, amountB);
        await tokenB18
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
        
        // No need to scale ratio as batch index remains the same
        let ratio = await prbScale(0,strategyRatio) 
      
        const maximumIORatio = await scaleRatio(ratio,tokenADecimals,tokenBDecimals)
    
        const takeOrdersConfigStruct = {
          output: tokenA00.address,
          input: tokenB18.address,
          minimumInput: amountB,
          maximumInput: amountB,
          maximumIORatio: maximumIORatio,
          orders: [takeOrderConfigStruct],
        };
    
        const amountA = amountB.mul(maximumIORatio).div(ONE) 
        
        await tokenA00.transfer(bob.address, amountA);
        await tokenA00.connect(bob).approve(orderBook.address, amountA); 
    
    
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
      } 
      
    }); 

  }) 

  describe("should scale ratio exponentially for different batches with decimals", () => { 

    
    it("should ensure ratio is scaled exponentially based on input/output token decimals: (Input Decimals: 6 vs Output Decimals: 18)", async function () { 


      const tokenA06 = (await basicDeploy("ReserveTokenDecimals", {}, [
        6,
      ]));
      const tokenB18 = (await basicDeploy("ReserveTokenDecimals", {}, [
        18,
      ])); 

      await tokenA06.initialize();
      await tokenB18.initialize();
  
      const tokenADecimals = await tokenA06.decimals();
      const tokenBDecimals = await tokenB18.decimals();  
  
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
      };
  
      const orderConfig_A= {
        validInputs: [
          { token: tokenA06.address, decimals: tokenADecimals, vaultId: aliceInputVault },
        ],
        validOutputs: [
          { token: tokenB18.address, decimals: tokenBDecimals, vaultId: aliceOutputVault },
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
  
      // Keeping Track of input/output
      let totalInputReceived = ethers.BigNumber.from('0')
      let totalOutput= ethers.BigNumber.from('0')


      // Recursively places orders for batches
      for(let i = 0 ; i < 10 ; i++){  
  
        let ratio = await prbScale(i,strategyRatio)  

        let amountB = ethers.BigNumber.from(i+1).mul(1000).mul(ONE).sub(totalInputReceived)  
        amountB = await scaleOutputMax(ratio,amountB)  
  
        const depositConfigStructAlice = {
          token: tokenB18.address,
          vaultId: aliceOutputVault,
          amount: amountB,
        };
  
        await tokenB18.transfer(alice.address, amountB);
        await tokenB18
          .connect(alice)
          .approve(orderBook.address, max_uint256);
  
        // Alice deposits tokenB into her output vault
         await orderBook.connect(alice).deposit(depositConfigStructAlice);
  
        const takeOrderConfigStruct = {
          order: Order_A,
          inputIOIndex: 0,
          outputIOIndex: 0,
          signedContext : []
        }; 
        
        const takeOrdersConfigStruct = {
          output: tokenA06.address,
          input: tokenB18.address,
          minimumInput: amountB,
          maximumInput: amountB,
          maximumIORatio: max_uint256,
          orders: [takeOrderConfigStruct],
        };
        
        //Deposit with overflow added
        const amountA = ethers.BigNumber.from('1005000000')
        
        await tokenA06.transfer(bob.address, amountA);
        await tokenA06.connect(bob).approve(orderBook.address, amountA); 
    
    
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
        
        //Checking if output is within specified range. 
        const errRange = ethers.BigNumber.from('10'+sixZeros)
        assert(output.gte(amountA.sub(errRange)) && output.lte(amountA), "wrong output");
    
        compareStructs(config, takeOrderConfigStruct);
        
        totalOutput = totalOutput.add(output)
        totalInputReceived = totalOutput.mul(ethers.BigNumber.from(1 + "0".repeat(tokenBDecimals - tokenADecimals)))
    
        await timewarp(86400);
      } 
      
    });  

    // Scaling ratio based on FixedPointMath `scaleRatio`
    xit("should ensure ratio is scaled exponentially based on input/output token decimals: (Input Decimals: 18 vs Output Decimals: 6)", async function () { 

      const tokenA18 = (await basicDeploy("ReserveTokenDecimals", {}, [
        18,
      ]));
      const tokenB06 = (await basicDeploy("ReserveTokenDecimals", {}, [
        6,
      ])); 

      await tokenA18.initialize();
      await tokenB06.initialize();
  
      const tokenADecimals = await tokenA18.decimals();
      const tokenBDecimals = await tokenB06.decimals();  
  
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
          { token: tokenA18.address, decimals: tokenADecimals, vaultId: aliceInputVault },
        ],
        validOutputs: [
          { token: tokenB06.address, decimals: tokenBDecimals, vaultId: aliceOutputVault },
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
  
  
      // Recursively places orders for batches
      for(let i = 0 ; i < 10 ; i++){   
        
        console.log("---------------- i : " , i)

        // scale ratio as batch index increases
        let ratio = await prbScale(i,strategyRatio) 
  
        // DEPOSIT
        // Deposit max amount per batch 
        const amountB = await scaleOutputMax(ratio.toString(),6)  
        console.log("amountB : " , amountB )
  
        const depositConfigStructAlice = {
          token: tokenB06.address,
          vaultId: aliceOutputVault,
          amount: amountB,
        };
  
        await tokenB06.transfer(alice.address, amountB);
        await tokenB06
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
        
        
        const maximumIORatio = await scaleRatio(ratio,tokenADecimals,tokenBDecimals)
    
        const takeOrdersConfigStruct = {
          output: tokenA18.address,
          input: tokenB06.address,
          minimumInput: amountB,
          maximumInput: amountB,
          maximumIORatio: maximumIORatio,
          orders: [takeOrderConfigStruct],
        };
    
        const amountA = ethers.BigNumber.from('1000' + eighteenZeros) 
      
        
        await tokenA18.transfer(bob.address, amountA);
        await tokenA18.connect(bob).approve(orderBook.address, amountA); 
    
    
        const txTakeOrders = await orderBook
          .connect(bob)
          .takeOrders(takeOrdersConfigStruct);   
          
        const { sender, config, input, output } = (await getEventArgs(
          txTakeOrders,
          "TakeOrder",
          orderBook
        ));  
    
        // assert(sender === bob.address, "wrong sender");
        // assert(input.eq(amountB), "wrong input");
        // assert(output.eq(amountA), "wrong output");
    
        // compareStructs(config, takeOrderConfigStruct); 

        //Introduce delay
        await timewarp(86400);
      } 
      
    });   
    
    // Scaling ratio based on FixedPointMath `scaleRatio`
    xit("should ensure ratio is scaled exponentially based on input/output token decimals: (Input Decimals: 6 vs Output Decimals: 6)", async function () { 

      const tokenA06 = (await basicDeploy("ReserveTokenDecimals", {}, [
        6,
      ]));
      const tokenB06 = (await basicDeploy("ReserveTokenDecimals", {}, [
        6,
      ])); 

      await tokenA06.initialize();
      await tokenB06.initialize();
  
      const tokenADecimals = await tokenA06.decimals();
      const tokenBDecimals = await tokenB06.decimals();  
  
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
          { token: tokenA06.address, decimals: tokenADecimals, vaultId: aliceInputVault },
        ],
        validOutputs: [
          { token: tokenB06.address, decimals: tokenBDecimals, vaultId: aliceOutputVault },
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
  
  
      // Recursively places orders for batches
      for(let i = 0 ; i < 10 ; i++){  
  
        // DEPOSIT
        const amountB = ethers.BigNumber.from("1000" + sixZeros);
  
        const depositConfigStructAlice = {
          token: tokenB06.address,
          vaultId: aliceOutputVault,
          amount: amountB,
        };
  
        await tokenB06.transfer(alice.address, amountB);
        await tokenB06
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
        
        // scale ratio as batch index increases
        let ratio = await prbScale(i,strategyRatio) 
      
        const maximumIORatio = await scaleRatio(ratio,tokenADecimals,tokenBDecimals)
    
        const takeOrdersConfigStruct = {
          output: tokenA06.address,
          input: tokenB06.address,
          minimumInput: amountB,
          maximumInput: amountB,
          maximumIORatio: maximumIORatio,
          orders: [takeOrderConfigStruct],
        };
    
        const amountA = amountB.mul(maximumIORatio).div(ONE) 
        
        await tokenA06.transfer(bob.address, amountA);
        await tokenA06.connect(bob).approve(orderBook.address, amountA); 
    
    
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

        //Introduce delay
        await timewarp(86400);
      } 
      
    });  
 
  })

  



}); 

