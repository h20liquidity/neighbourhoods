 
 import * as path from "path";
 import { argv } from "process";
 import * as dotenv from "dotenv";
 import {    getCommons} from "../utils";
import { emptyNHTTokens, emptyUSDTTokens } from "../utils/1-pilot.utils";
 
 
 export const emptyNHTAmount = async (fromNetwork:string , amount:string,orderBook) => {    
    // Get Chain details
    const common = getCommons(fromNetwork) 
 
    const depositTransaction =  await emptyNHTTokens(fromNetwork,process.env.DEPLOYMENT_KEY,common, amount,orderBook ) 
    
    if(depositTransaction){
        const receipt = await depositTransaction.wait()
       
        console.log(`NHT Amount Withdrawn : ${receipt.transactionHash}`)
    }
 } 

 export const emptyUSDTAmount = async (fromNetwork:string , amount:string,orderBook) => { 
    // Get Chain details
    const common = getCommons(fromNetwork) 
 
    const depositTransaction =  await emptyUSDTTokens(fromNetwork,process.env.DEPLOYMENT_KEY,common, amount,orderBook )  
    
    
    if(depositTransaction){
        const receipt = await depositTransaction.wait()
       
        console.log(`USDT Amount Withdrawn : ${receipt.transactionHash}`)
    }

 }
 