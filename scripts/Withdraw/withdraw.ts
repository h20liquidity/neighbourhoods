 
 import * as path from "path";
 import { argv } from "process";
 import * as dotenv from "dotenv";
 import {    getCommons, withdrawNHTTokens, withdrawUSDTTokens} from "../utils";
 
 
 export const withdrawNHTAmount = async (fromNetwork:string , amount:string) => {    
    // Get Chain details
    const common = getCommons(fromNetwork) 
 
    const depositTransaction =  await withdrawNHTTokens(fromNetwork,process.env.DEPLOYMENT_KEY,common, amount ) 
    
    if(depositTransaction){
        const receipt = await depositTransaction.wait()
       
        console.log(`Amount Withdrawn : ${receipt.transactionHash}`)
    }
 } 

 export const withdrawUSDTAmount = async (fromNetwork:string , amount:string) => { 
    // Get Chain details
    const common = getCommons(fromNetwork) 
 
    const depositTransaction =  await withdrawUSDTTokens(fromNetwork,process.env.DEPLOYMENT_KEY,common, amount )  
    
    
    if(depositTransaction){
        const receipt = await depositTransaction.wait()
       
        console.log(`Amount Withdrawn : ${receipt.transactionHash}`)
    }

 }
 