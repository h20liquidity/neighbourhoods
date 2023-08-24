import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import {  deployStrategy,    getCommons, randomUint256} from "../utils";
import { BigNumber, ethers } from "ethers";  
import { deployStrategyWithVault } from "../utils/1-pilot.utils";


dotenv.config();


export const deployPilotStrategy = async(toNetwork)=> {    


   // Get Chain details
   const common = getCommons(toNetwork) 

   const strategyTransaction =  await deployStrategy(toNetwork,process.env.DEPLOYMENT_KEY,common)  

   if(!strategyTransaction){
      console.log("Err...something went wrong")
   }

   const receipt = await strategyTransaction.wait()
  
   console.log(`Startegy Deployed At : ${receipt.transactionHash}`)

} 

export const deployPilotStrategyWithVault = async(toNetwork,vaultId)=> {    


   // Get Chain details
   const common = getCommons(toNetwork) 

   const strategyTransaction =  await deployStrategyWithVault(toNetwork,process.env.DEPLOYMENT_KEY,common ,vaultId)  

   if(!strategyTransaction){
      console.log("Err...something went wrong")
   }

   const receipt = await strategyTransaction.wait()
  
   console.log(`Startegy Deployed At : ${receipt.transactionHash}\nVault ID used for the startegy : ${vaultId}\nUse the above vault id to deposit and withdraw from the strategy`)

}


