import * as dotenv from "dotenv";
import { getCommons} from "../utils";
import { deploySushiSellStrategy,deploySushiBuyStrategy } from "../utils/np-strat";
import { rainBinomialBuyString, rainBinomialSellString } from "./strat";
import { getBuyLimitOrder, getSellLimitOrder } from "./limitStrat";


dotenv.config();

 export const deployPilotBinomialStrategy = async(toNetwork,vaultId)=> {    


   // Get Chain details
   const common = getCommons(toNetwork) 
   const sellStrategyString = rainBinomialSellString(toNetwork);
   const sellStrategyTransaction =  await deploySushiSellStrategy(toNetwork,process.env.DEPLOYMENT_KEY,common ,vaultId,sellStrategyString)  

   if(!sellStrategyTransaction){
      console.log("Err...something went wrong")
   }

   const sellReceipt = await sellStrategyTransaction.wait()
  
   console.log(`\n--------------------------------\n✅ Sell Startegy Deployed At : ${sellReceipt.transactionHash}\nVault ID used for the startegy : ${vaultId}\nUse the above vault id to deposit and withdraw from the strategy\n--------------------------------\n`
   ) 
   const buyStrategyString = rainBinomialBuyString(toNetwork);
   const buyStrategyTransaction =  await deploySushiBuyStrategy(toNetwork,process.env.DEPLOYMENT_KEY,common ,vaultId,buyStrategyString)  

   if(!buyStrategyTransaction){
      console.log("Err...something went wrong")
   }

   const buyReceipt = await buyStrategyTransaction.wait()
  
   console.log(`\n--------------------------------\n✅ Buy Startegy Deployed At : ${buyReceipt.transactionHash}\nVault ID used for the startegy : ${vaultId}\nUse the above vault id to deposit and withdraw from the strategy\n--------------------------------\n`
   )

}

export const deployLimitStrategy = async(toNetwork,vaultId,sellRatio,buyRatio) => {

   // Get Chain details
   const common = getCommons(toNetwork) 
   const sellStrategyString = getSellLimitOrder(toNetwork,sellRatio);
   const sellStrategyTransaction =  await deploySushiSellStrategy(toNetwork,process.env.DEPLOYMENT_KEY,common ,vaultId,sellStrategyString)  

   if(!sellStrategyTransaction){
      console.log("Err...something went wrong")
   }

   const sellReceipt = await sellStrategyTransaction.wait()
  
   console.log(`\n--------------------------------\n✅ Sell Limit Order Deployed At : ${sellReceipt.transactionHash}\nVault ID used for the startegy : ${vaultId}\nUse the above vault id to deposit and withdraw from the strategy\n--------------------------------\n`
   ) 
   const buyStrategyString = getBuyLimitOrder(toNetwork,buyRatio);
   const buyStrategyTransaction =  await deploySushiBuyStrategy(toNetwork,process.env.DEPLOYMENT_KEY,common ,vaultId,buyStrategyString)  

   if(!buyStrategyTransaction){
      console.log("Err...something went wrong")
   }

   const buyReceipt = await buyStrategyTransaction.wait()
  
   console.log(`\n--------------------------------\n✅ Buy Limit Order Deployed At : ${buyReceipt.transactionHash}\nVault ID used for the startegy : ${vaultId}\nUse the above vault id to deposit and withdraw from the strategy\n--------------------------------\n`
   )

}
  

