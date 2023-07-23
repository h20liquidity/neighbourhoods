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
import { compareStructs } from "../utils/test/compareStructs";
import deploy1820 from "../utils/deploy/registry1820/deploy";
import * as path from 'path'; 
import { assertError, fetchFile, resetFork, timewarp } from "../utils";
import { basicDeploy } from "../utils/deploy/basicDeploy"; 

import { getOrderBook, ob_entrypoints } from "../utils/deploy/orderBook";
import { getExpressionDelopyer } from "../utils/deploy/interpreter";
import config from "../config/config.json"
import * as dotenv from "dotenv";
import { encodeMeta } from "../scripts/utils";
import { prbScale,  takeOrder } from "../utils/orderBook";
dotenv.config();



describe("Order Batches", async function () {
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
  

  it("should ensure batch info is not shared across orders in case of multiple orders by a same user ", async function () { 

    const signers = await ethers.getSigners();

    const [, alice, bob] = signers;

    const aliceVaultA = ethers.BigNumber.from(randomUint256());
    const aliceVaultB = ethers.BigNumber.from(randomUint256());
    const aliceVaultC = ethers.BigNumber.from(randomUint256());

  

    const aliceOrder = encodeMeta("Order_A");  
    
    const strategyExpression = path.resolve(
      __dirname,
      "../src/2-price-update.rain"
    );

    const strategyString = await fetchFile(strategyExpression); 

   
    // Order_A 

    const strategyRatio_A = "29e13"

    
    

    const { sources, constants } = await standardEvaluableConfig(strategyString,ob_entrypoints)

    const EvaluableConfig_A = {
      deployer: expressionDeployer.address,
      sources,
      constants,
    }
    const orderConfig_A= {
      validInputs: [
        { token: tokenA.address, decimals: 18, vaultId: aliceVaultA },
      ],
      validOutputs: [
        { token: tokenB.address, decimals: 18, vaultId: aliceVaultA },
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

    // Order C
    // Placing order with exact params as order A.
    // Even if the params are same order hash computed is different
    const strategyRatio_C = "29e13" 
 

    const { sources:sourceC, constants:constantsC } = await standardEvaluableConfig(strategyString,ob_entrypoints)

    const EvaluableConfig_C = {
      deployer: expressionDeployer.address,
      sources: sourceC,
      constants: constantsC,
    }
    const orderConfig_C= {
      validInputs: [
        { token: tokenA.address, decimals: 18, vaultId: aliceVaultC },
      ],
      validOutputs: [
        { token: tokenB.address, decimals: 18, vaultId: aliceVaultC },
      ],
      evaluableConfig: EvaluableConfig_C,
      meta: aliceOrder,
    };

    const txOrder_C = await orderBook.connect(alice).addOrder(orderConfig_C);

    const {
      order: Order_C
    } = (await getEventArgs(
      txOrder_C,
      "AddOrder",
      orderBook
    ));
 

    // TAKE ORDER 

    // Bob takes order with direct wallet transfer for order A and order B
    for(let i = 0 ; i < 10 ; i++){   

        // Since orders are different orders , bob should be able to take orders concurrently/with delay 
        await takeOrder(
          alice, 
          bob, 
          tokenA,
          tokenB, 
          aliceVaultA,
          Order_A,
          orderBook,
          i,
          strategyRatio_A
        )  
        // placing delay
        await timewarp(3600) 

        await takeOrder(
          alice, 
          bob, 
          tokenA,
          tokenB, 
          aliceVaultC,
          Order_C,
          orderBook,
          i,
          strategyRatio_C
        )

      // Delay is introduced between batches
      await timewarp(3600)
    }   

       
  });  

  it("should ensure there is no overflow is allowed at end of batch", async function () { 

    const signers = await ethers.getSigners();

    const [, alice, bob] = signers;   


    const aliceInputVault = ethers.BigNumber.from(randomUint256());
    const aliceOutputVault = ethers.BigNumber.from(randomUint256());
  

    const aliceOrder = encodeMeta("Order_A"); 

    // Order_A
    const strategyRatio = "29e13"
    const strategyExpression = path.resolve(
      __dirname,
      "../src/2-price-update.rain"
    );

    const strategyString = await fetchFile(strategyExpression); 

    const { sources, constants } = await standardEvaluableConfig(strategyString,ob_entrypoints)

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
    for(let i = 0 ; i < 3 ; i++){  

      // DEPOSIT

      // Deposit max amount per batch
      
      const amountB = i == 0 ? (
        ethers.BigNumber.from("344827586206896551724137")
      ) : (
        i == 1 ? (
          ethers.BigNumber.from("340000000000000000000000")
        ) : ( 
          // Since overflow is set to 0 we cannot deposit more than
          // remaining amount for the batch
          ethers.BigNumber.from("1413451689996585865483")
        )
      ); 

      // Scaling ratio as batch index increases 
      const ratio =  i == 0 ? (
        await prbScale(0,strategyRatio)
      ) : (
        await prbScale(1,strategyRatio)
      ) 



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
      await timewarp(3600)
    }  

    // Bob takes order with direct wallet transfer
    for(let i = 0 ; i < 3 ; i++){  

      // DEPOSIT

      // Deposit max amount per batch
      
      const amountB = i == 0 ? (
        ethers.BigNumber.from("338033120485145134520280")
      ) : (
        i == 1 ? (
          ethers.BigNumber.from("330000000000000000000000")
        ) : ( 
          // Setting deposit amount more than remaining amount
          // for batch
          ethers.BigNumber.from("4686257906084291604237").add(1)
        )
      ); 

      // Scaling ratio as batch index increases 
      const ratio =  i == 0 ? (
        await prbScale(i+2,strategyRatio)
      ) : ( 
        // check for the third batch
        await prbScale(3,strategyRatio)
      )
  

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
  
      await tokenA.transfer(bob.address, amountA);
      await tokenA.connect(bob).approve(orderBook.address, amountA); 
  
      if(i == 0 || i == 1  ){ 

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

      }else{  
        await assertError(
          async () =>
             await orderBook
            .connect(bob)
            .takeOrders(takeOrdersConfigStruct),
          "",
          "Overflow"
        );
      }
       
      // Delay is introduced between batches
      await timewarp(3600)

    } 
    
  }); 
  
  it("should ensure order output max for a batch is correct at the end of the batch", async function () { 

    const signers = await ethers.getSigners();

    const [, alice, bob] = signers;   


    const aliceInputVault = ethers.BigNumber.from(randomUint256());
    const aliceOutputVault = ethers.BigNumber.from(randomUint256());
  

    const aliceOrder = encodeMeta("Order_A"); 

    // Order_A
    const strategyRatio = "29e13"
    const strategyExpression = path.resolve(
      __dirname,
      "../src/2-price-update.rain"
    );

    const strategyString = await fetchFile(strategyExpression); 

    const { sources, constants } = await standardEvaluableConfig(strategyString,ob_entrypoints)

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
    for(let i = 0 ; i < 3 ; i++){  

      // DEPOSIT

      // Deposit max amount per batch 

      const batch1Amount =  ethers.BigNumber.from("340000000000000000000000")
      const batch1RemainingAmout = ethers.BigNumber.from("1413451689996585865483")
      
      const amountB = i == 0 ? (
        ethers.BigNumber.from("344827586206896551724137")
      ) : (
        i == 1 ? (
          batch1Amount
        ) : ( 
          // Since overflow is set to 0 we cannot deposit more than remaining amount
          // depositing more than remaining output amount for batch
          batch1RemainingAmout.add(ONE.mul(1000))
        )
      ); 

      // Scaling ratio as batch index increases 
      const ratio =  i == 0 ? (
        await prbScale(0,strategyRatio)
      ) : (
        await prbScale(1,strategyRatio)
      ) 



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
        minimumInput: 1,
        maximumInput: amountB,
        maximumIORatio: ratio,
        orders: [takeOrderConfigStruct],
      };
  
      // Tracking Input Token amount 1000 
      let amountA = amountB.mul(ratio).div(ONE); 
      if(amountB.mul(ratio).mod(ONE).gt(ethers.BigNumber.from('1'))){
        amountA = amountA.add(1)
      } 
  
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
      if(i == 2){
        assert(input.eq(batch1RemainingAmout), "wrong input");
      }else{
        assert(input.eq(amountB), "wrong input");
      }
      compareStructs(config, takeOrderConfigStruct); 

      // Delay is introduced between batches
      await timewarp(3600)
    }  

    // Bob takes order with direct wallet transfer
    for(let i = 0 ; i < 3 ; i++){  

      // DEPOSIT

      // Deposit max amount per batch
      const batch3Amount = ethers.BigNumber.from("330000000000000000000000")
      const batch3RemainingAmount = ethers.BigNumber.from("4686257906084291604237")

      const amountB = i == 0 ? (
        ethers.BigNumber.from("338033120485145134520280")
      ) : (
        i == 1 ? (
          batch3Amount
        ) : ( 
          // Setting deposit amount more than remaining amount
          // for batch
          batch3RemainingAmount.add(ONE.mul(1000))
        )
      ); 

      // Scaling ratio as batch index increases 
      const ratio =  i == 0 ? (
        await prbScale(i+2,strategyRatio)
      ) : ( 
        // check for the third batch
        await prbScale(3,strategyRatio)
      )
  

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
        minimumInput: 1,
        maximumInput: amountB,
        maximumIORatio: ratio,
        orders: [takeOrderConfigStruct],
      };
  
      // Tracking Input Token amount 1000 
      let amountA = amountB.mul(ratio).div(ONE); 
      if(amountB.mul(ratio).mod(ONE).gt(ethers.BigNumber.from('1'))){
        amountA = amountA.add(1)
      }
  
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
      if(i == 2){
        assert(input.eq(batch3RemainingAmount), "wrong input");
      }else{
        assert(input.eq(amountB), "wrong input");
      }
  
      compareStructs(config, takeOrderConfigStruct);
     
      // Delay is introduced between batches
      await timewarp(3600)

    } 
    
  });  


}); 

