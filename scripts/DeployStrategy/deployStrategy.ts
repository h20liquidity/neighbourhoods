import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import {  deployStrategy,  getCommons} from "../utils";


dotenv.config();


export const deployPilotStrategy = async(toNetwork)=> {    


   // Get Chain details
   const common = getCommons(toNetwork) 

   const strategyTransaction =  await deployStrategy(toNetwork,process.env.DEPLOYMENT_KEY,common ) 

   const receipt = await strategyTransaction.wait()
  
   console.log(`Startegy Deployed At : ${receipt.transactionHash}`)

  

  


}

  


