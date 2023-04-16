import { assert } from "chai";
import { ethers  } from "hardhat";
import { BigNumber } from "ethers";
import { eighteenZeros, ONE } from "../constants";
import { getEventArgs } from "../events"; 
import { fixedPointDiv, fixedPointMul } from "../math";
import { compareStructs } from "../test"; 

export const scaleOutputMax = async (orderRatio: string, decimals : number) => { 
    let a = ethers.BigNumber.from(1 + "0".repeat(decimals)).mul(1000) 
    let b = ethers.BigNumber.from(orderRatio) 
    return fixedPointDiv(a,b) 
}

// Hacky Util
export const prbScale = async (index: number, orderRatio: string) => {  
    let numRatio = new Number(orderRatio)
    let baseRatio = ethers.BigNumber.from(numRatio.toString()) 
    let base = ethers.BigNumber.from("1020000000000000000")   
    let ioMultiplier
    if(index == 0){
      ioMultiplier = ONE
    }else if(index == 1){
      ioMultiplier = base
    }else{
      ioMultiplier = ONE
      for(let i = 0 ; i < index ; i++){
        ioMultiplier = fixedPointMul(base,ioMultiplier)
      }
    }  
  
    let ratio = fixedPointMul(baseRatio,ioMultiplier) 
    return ratio
  } 
  
  // Hacky Util 
  export const scaleRatio = async(ratio: BigNumber, aDecimals: number,bDecimals: number) => {   
   
    const decimalDiff = ethers.BigNumber.from(10).pow(18 + aDecimals - bDecimals)
    let maxRatio =  ratio.mul(decimalDiff).div(ONE)

    if(ratio.mul(decimalDiff).mod(ONE).gt(ethers.BigNumber.from('1'))){
      maxRatio = maxRatio.add(1)
    } 
    
    return maxRatio
  } 

// Util to take order
export const takeOrder = async (
    owner,  // order owner
    taker,  // order taker
    tokenA, // input token
    tokenB, // output token
    outputVault, // output vault 
    order, // order
    orderBook, // orderBook 
    index, // index to scale
    orderRatio // ratio to scale by index
    ) => {
   
    // Scaling ratio as batch index increases 
    const ratio = await prbScale(index,orderRatio)  

    // Deposit max amount per batch
    const amountB = await scaleOutputMax(ratio.toString(),18) ;

    const depositConfigStructAlice = {
      token: tokenB.address,
      vaultId: outputVault,
      amount: amountB,
    };

    await tokenB.transfer(owner.address, amountB);
    await tokenB
      .connect(owner)
      .approve(orderBook.address, depositConfigStructAlice.amount);

    // Alice deposits tokenB into her output vault
     await orderBook.connect(owner).deposit(depositConfigStructAlice);

    const takeOrderConfigStruct = {
      order: order,
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

    await tokenA.transfer(taker.address, amountA);
    await tokenA.connect(taker).approve(orderBook.address, amountA); 


    const txTakeOrders = await orderBook
      .connect(taker)
      .takeOrders(takeOrdersConfigStruct);   
      
    const { sender, config, input, output } = (await getEventArgs(
      txTakeOrders,
      "TakeOrder",
      orderBook
    ));   

  
    assert(sender === taker.address, "wrong sender");
    assert(input.eq(amountB), "wrong input");
    assert(output.eq(amountA), "wrong output");

    compareStructs(config, takeOrderConfigStruct); 
}  

