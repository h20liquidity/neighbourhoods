import * as dotenv from "dotenv";
import { getCommons} from "../utils";
import { deploySushiSellStrategy,deploySushiBuyStrategy } from "../utils/np-strat";


dotenv.config();


export const deployPilotStrategyWithNP = async(toNetwork,vaultId)=> {    


    // Get Chain details
    const common = getCommons(toNetwork) 
 
    const sellStrategyTransaction =  await deploySushiSellStrategy(toNetwork,process.env.DEPLOYMENT_KEY,common ,vaultId)  
 
    if(!sellStrategyTransaction){
       console.log("Err...something went wrong")
    }
 
    const sellReceipt = await sellStrategyTransaction.wait()
   
    console.log(`\n--------------------------------\n✅ Sell Startegy Deployed At : ${sellReceipt.transactionHash}\nVault ID used for the startegy : ${vaultId}\nUse the above vault id to deposit and withdraw from the strategy\n--------------------------------\n`
    ) 

    const buyStrategyTransaction =  await deploySushiBuyStrategy(toNetwork,process.env.DEPLOYMENT_KEY,common ,vaultId)  
 
    if(!buyStrategyTransaction){
       console.log("Err...something went wrong")
    }
 
    const buyReceipt = await buyStrategyTransaction.wait()
   
    console.log(`\n--------------------------------\n✅ Buy Startegy Deployed At : ${buyReceipt.transactionHash}\nVault ID used for the startegy : ${vaultId}\nUse the above vault id to deposit and withdraw from the strategy\n--------------------------------\n`
    )
 
 }
   
  


