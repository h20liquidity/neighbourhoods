import { ethers , BigNumber } from "ethers"; 
export const ONE = ethers.BigNumber.from("1000000000000000000");


export const baseIOMultiplier_2 = ethers.BigNumber.from("1010000000000000000")   

export const fixedPointDiv = (a: BigNumber, b: BigNumber): BigNumber =>
  a.mul(ONE).div(b);

export const fixedPointMul = (a: BigNumber, b: BigNumber): BigNumber =>
  a.mul(b).div(ONE);  

export const scaleOutputMax = async (orderRatio, opMax) => { 
    return fixedPointDiv(opMax,orderRatio) 
  }

export const prbScale = async (index: number, orderRatio: string) => {  
    let numRatio = new Number(orderRatio)
    let baseRatio = ethers.BigNumber.from(numRatio.toString()) 
    let base = baseIOMultiplier_2
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


async function main(){ 

    const strategyRatio = "29e13"
    for(let i = 0 ; i < 10 ; i++){   
      console.log(`-------------------- i : ${i}`)
        // Scaling ratio as batch index increases 
      const ratio = await prbScale(i,strategyRatio)    

      const amountB = await scaleOutputMax(ratio,ONE.mul(100)) 
    //   console.log("ratio : " , ethers.utils.formatEther(ratio.toString()))
      console.log('amountB : ' , amountB.toString())

      let amountA = amountB.mul(ratio).div(ONE); 
      if(amountB.mul(ratio).mod(ONE).gt(ethers.BigNumber.from('1'))){
        amountA = amountA.add(1)
      } 

      console.log('amountA : ' , ethers.utils.formatEther(amountA.toString()))


    }

} 
main() 

//34,482.7586206896551724137
//8 650000000000000000 
//10000000000000000000