import * as dotenv from "dotenv";
import {   getCommons} from "../utils";
import { deployStrategyWithVault } from "../utils/pilot";


dotenv.config();


export const deployPilotStrategyWithVault = async(toNetwork,vaultId)=> {    


   // Get Chain details
   const common = getCommons(toNetwork) 

   const strategyTransaction =  await deployStrategyWithVault(toNetwork,process.env.DEPLOYMENT_KEY,common ,vaultId)  

   if(!strategyTransaction){
      console.log("Err...something went wrong")
   }

   const receipt = await strategyTransaction.wait()
  
   console.log(`Startegy Deployed At : ${receipt.transactionHash}\nVault ID used for the startegy : ${vaultId}\nUse the above vault id to deposit and withdraw from the strategy`)
   console.log(`--------------------------------------------`)
}


