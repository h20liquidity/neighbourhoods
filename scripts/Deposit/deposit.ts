import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import {  deployStrategy,  depositNHTTokens,  getCommons} from "../utils";


dotenv.config();


export const depositAmount = async (toNetwork:string , amount:string) => {    

   
   // Get Chain details
   const common = getCommons(toNetwork) 

   const depositTransaction =  await depositNHTTokens(toNetwork,process.env.DEPLOYMENT_KEY,common, amount ) 

   const receipt = await depositTransaction.wait()
  
   console.log(`Amount Deposited : ${receipt.transactionHash}`)

  

  


}

