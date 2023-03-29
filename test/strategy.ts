import { assert } from "chai";
import { ethers  } from "hardhat";
import { BigNumber } from "ethers";


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
import {  fixedPointMul } from "../utils/math";
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
dotenv.config();


export const fetchFile = (_path: string): string => {
  try {
    return fs.readFileSync(_path).toString();
  } catch (error) {
    console.log(error);
    return "";
  }
};  

// Hacky Util
const prbScale = async (index: number) => {  
  let base = ethers.BigNumber.from("1020000000000000000")   
  let result
  if(index == 0){
    result = ONE
  }else if(index == 1){
    result = base
  }else{
    result = ONE
    for(let i = 0 ; i < index ; i++){
      result = fixedPointMul(base,result)
    }
  } 
  return result
} 

// Hacky Util 
const scaleRatio = async(ratio: BigNumber, aDecimals: number,bDecimals: number) => {   
 
  let maxRatio
  maxRatio = fixedPointMul(
    ratio,
    ethers.BigNumber.from(10).pow(18 + aDecimals - bDecimals)
  )  
  if(maxRatio.mod(10).gt(5)){ 
    maxRatio = maxRatio.add(1)  
  }   
  return maxRatio
}


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


 
  it.only("should ensure only conterparties are able to takeOrders", async function () {  
  
    const signers = await ethers.getSigners();

    const [ , alice, bob, carol] = signers;    

    const aliceInputVault = ethers.BigNumber.from(randomUint256());
    const aliceOutputVault = ethers.BigNumber.from(randomUint256());
  
    const aliceOrder = encodeMeta("Order_A");   

    // Order_A 

    const strategyExpression = path.resolve(
      __dirname,
      "../src/0-pilot.rain"
    );

    const strategyString = await fetchFile(strategyExpression); 

    const stringExpression = mustache.render(strategyString, {
      counterparty: bob.address,
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
 
     let ratio = await prbScale(0) 
 
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

  it("should ensure 24 hour delay is maintained between two batches", async function () { 

    const signers = await ethers.getSigners();

    const [, alice, bob] = signers;   

    const aliceInputVault = ethers.BigNumber.from(randomUint256());
    const aliceOutputVault = ethers.BigNumber.from(randomUint256());
  

    const aliceOrder = encodeMeta("Order_A"); 
    
    // Order_A

    const strategyExpression = path.resolve(
      __dirname,
      "../src/0-pilot.rain"
    );

    const strategyString = await fetchFile(strategyExpression); 

    const stringExpression = mustache.render(strategyString, {
      counterparty: bob.address,
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

     // DEPOSIT
     // Deposit token equal to the size of the batch
     const amountB = ethers.BigNumber.from("1000" + eighteenZeros); 
 
     const depositConfigStructAlice = {
       token: tokenB.address,
       vaultId: aliceOutputVault,
       amount: amountB.mul(2),
     };
 
     await tokenB.transfer(alice.address, amountB.mul(2));
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
 
     let ratio0 = await prbScale(0) 
     
     const takeOrdersConfigStruct0 = {
       output: tokenA.address,
       input: tokenB.address,
       minimumInput: amountB,
       maximumInput: amountB,
       maximumIORatio: ratio0,
       orders: [takeOrderConfigStruct0],
     };
 
     const amountA0 = amountB.mul(ratio0).div(ONE); 
 
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

     // TAKE ORDER 1  

     const takeOrderConfigStruct1 = {
      order: Order_A,
      inputIOIndex: 0,
      outputIOIndex: 0,
      signedContext : []
    }; 

    let ratio1 = await prbScale(1) 
    
    const takeOrdersConfigStruct1 = {
      output: tokenA.address,
      input: tokenB.address,
      minimumInput: amountB,
      maximumInput: amountB,
      maximumIORatio: ratio1,
      orders: [takeOrderConfigStruct1],
    };

    const amountA1 = amountB.mul(ratio1).div(ONE); 

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
      assert(input1.eq(amountB), "wrong input");
      assert(output1.eq(amountA1), "wrong output");

      compareStructs(config1, takeOrderConfigStruct0); 
        
  }); 

  it("should ensure ratio is not scaled by the expressions for orders with same batch", async function () { 

    const signers = await ethers.getSigners();

    const [, alice, bob] = signers;   

    const aliceInputVault = ethers.BigNumber.from(randomUint256());
    const aliceOutputVault = ethers.BigNumber.from(randomUint256());
  

    const aliceOrder = encodeMeta("Order_A"); 

    // Order_A

    const strategyExpression = path.resolve(
      __dirname,
      "../src/0-pilot.rain"
    );

    const strategyString = await fetchFile(strategyExpression); 

    const stringExpression = mustache.render(strategyString, {
      counterparty: bob.address,
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
      const amountB = ethers.BigNumber.from("100" + eighteenZeros);

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

      // Batch Index Remains the same hence ratio remains the same 
      const ratio = await prbScale(0)
  
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

  it("should ensure ratio is scaled exponentially by the expressions as batch index increases", async function () { 

    const signers = await ethers.getSigners();

    const [, alice, bob] = signers;   


    const aliceInputVault = ethers.BigNumber.from(randomUint256());
    const aliceOutputVault = ethers.BigNumber.from(randomUint256());
  

    const aliceOrder = encodeMeta("Order_A"); 

    // Order_A

    const strategyExpression = path.resolve(
      __dirname,
      "../src/0-pilot.rain"
    );

    const strategyString = await fetchFile(strategyExpression); 

    const stringExpression = mustache.render(strategyString, {
      counterparty: bob.address,
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

      // Deposit max amount per batch
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
       await orderBook.connect(alice).deposit(depositConfigStructAlice);

      const takeOrderConfigStruct = {
        order: Order_A,
        inputIOIndex: 0,
        outputIOIndex: 0,
       signedContext : []
      }; 

      // Scaling ratio as batch index increases 
      const ratio = await prbScale(i)
  
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

      // Delay is introduced between batches
      await timewarp(86400)
    } 
    
  });  

  it("should ensure that overflow is allowed at end of batch", async function () { 

    const signers = await ethers.getSigners();

    const [, alice, bob] = signers;   


    const aliceInputVault = ethers.BigNumber.from(randomUint256());
    const aliceOutputVault = ethers.BigNumber.from(randomUint256());
  

    const aliceOrder = encodeMeta("Order_A"); 

    // Order_A

    const strategyExpression = path.resolve(
      __dirname,
      "../src/0-pilot.rain"
    );

    const strategyString = await fetchFile(strategyExpression); 

    const stringExpression = mustache.render(strategyString, {
      counterparty: bob.address,
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
    for(let i = 0 ; i < 3 ; i++){  

      // DEPOSIT

      // Deposit max amount per batch
      const amountB = i == 0 ? (
        ethers.BigNumber.from("1000" + eighteenZeros)
      ) : (
        i == 1 ? (
          ethers.BigNumber.from("999" + eighteenZeros)
        ) : (
          ethers.BigNumber.from("10" + eighteenZeros)
        )
      );

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

      // Scaling ratio as batch index increases 
      const ratio =  i == 0 ? (
        await prbScale(0)
      ) : (
        await prbScale(1)
      )
  
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

      // Delay is introduced between batches
      await timewarp(86400)
    } 
    
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

    const strategyExpression = path.resolve(
      __dirname,
      "../src/0-pilot.rain"
    );

    const strategyString = await fetchFile(strategyExpression); 

    const stringExpression = mustache.render(strategyString, {
      counterparty: bob.address,
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
        let ratio = await prbScale(0) 
      
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

    const strategyExpression = path.resolve(
      __dirname,
      "../src/0-pilot.rain"
    );

    const strategyString = await fetchFile(strategyExpression); 

    const stringExpression = mustache.render(strategyString, {
      counterparty: bob.address,
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
  
        // DEPOSIT
        const amountB = ethers.BigNumber.from("100" + sixZeros);
  
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
        
        // No need to scale ratio as batch index remains the same
        let ratio = await prbScale(0) 
      
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

      const strategyExpression = path.resolve(
        __dirname,
        "../src/0-pilot.rain"
      );

      const strategyString = await fetchFile(strategyExpression); 

      const stringExpression = mustache.render(strategyString, {
        counterparty: bob.address,
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
  
        // DEPOSIT
        const amountB = ethers.BigNumber.from("100" + sixZeros);
  
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
        
        // No need to scale ratio as batch index remains the same
        let ratio = await prbScale(0) 
      
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

    it("should ensure ratio is not scaled based on input/output token decimals: (Input Decimals: 0 vs Output Decimals: 18)", async function () { 

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

    const strategyExpression = path.resolve(
      __dirname,
      "../src/0-pilot.rain"
    );

    const strategyString = await fetchFile(strategyExpression); 

    const stringExpression = mustache.render(strategyString, {
      counterparty: bob.address,
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
        let ratio = await prbScale(0) 
      
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

    it.skip("should ensure ratio is scaled exponentially based on input/output token decimals: (Input Decimals: 6 vs Output Decimals: 18)", async function () { 

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

      const strategyExpression = path.resolve(
        __dirname,
        "../src/0-pilot.rain"
      );

      const strategyString = await fetchFile(strategyExpression); 

      const stringExpression = mustache.render(strategyString, {
        counterparty: bob.address,
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
  
  
      // Recursively places orders for batches
      for(let i = 0 ; i < 10 ; i++){  
  
        // DEPOSIT

        // Deposit amount same as max posit amount per batch
        const amountB = ethers.BigNumber.from("1000" + eighteenZeros);
  
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
        
        // scale ratio as batch index increases
        let ratio = await prbScale(i) 
      
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

        //Introduce delay
        await timewarp(86400);
      } 
      
    });  

    it("should ensure ratio is scaled exponentially based on input/output token decimals: (Input Decimals: 18 vs Output Decimals: 6)", async function () { 

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

      const strategyExpression = path.resolve(
        __dirname,
        "../src/0-pilot.rain"
      );

      const strategyString = await fetchFile(strategyExpression); 

      const stringExpression = mustache.render(strategyString, {
        counterparty: bob.address,
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
        let ratio = await prbScale(i) 
      
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

        //Introduce delay
        await timewarp(86400);
      } 
      
    });  

    it.skip("should ensure ratio is scaled exponentially based on input/output token decimals: (Input Decimals: 6 vs Output Decimals: 6)", async function () { 

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

      const strategyExpression = path.resolve(
        __dirname,
        "../src/0-pilot.rain"
      );

      const strategyString = await fetchFile(strategyExpression); 

      const stringExpression = mustache.render(strategyString, {
        counterparty: bob.address,
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
        let ratio = await prbScale(i) 
      
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

