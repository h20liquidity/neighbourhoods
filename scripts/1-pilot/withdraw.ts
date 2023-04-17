import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { depositAmount } from "../Deposit/deposit";
import { withdrawNHTAmount } from "../Withdraw/withdraw";
import { getCommons } from "../utils";
import { withdrawNHTTokensOB, withdrawUSDTTokensOB } from "../utils/1-pilot.utils";


dotenv.config();


async function main() {    

  const root = path.resolve();
  const args = argv.slice(2);   


  if (
    !args.length ||
    args.includes("--help") ||
    args.includes("-h") ||
    args.includes("-H")
  ) {
    console.log(
      `
      Withdraw tokens from the vault.
      options:

        --from, -f <network name>
          Name of the network to deploy the contract. Any of ["snowtrace",goerli","mumbai","sepolia","polygon"].

        --token, -tk <token symbol>
          Symbol of the token to withdraw. Any of ["USDT","NHT"].

        --amount, -a <Amount in NHT or USDT>
          Amount in NHT or USDT to withdraw
      `
    );
  }else{ 

    let fromNetwork
    let token
    let amount

    //valid networks
    const validNetworks = ["goerli","snowtrace","mumbai","sepolia","polygon"] 
    const validTokens = ["USDT","NHT"] 


    if (
        args.includes("--from") ||
        args.includes("-f")
      ) {
        const _i =
          args.indexOf("--from") > -1
            ? args.indexOf("--from")
            : args.indexOf("-f")
        const _tmp = args.splice(_i, _i + 2);
        if (_tmp.length != 2) throw new Error("expected network to deploy from");
        if(validNetworks.indexOf(_tmp[1]) == -1 ) throw new Error(`Unsupported network : ${_tmp[1]}`);
        fromNetwork = _tmp[1]
      }   

    if (
        args.includes("--amount") ||
        args.includes("-a")
      ) {
        const _i =
          args.indexOf("--amount") > -1
            ? args.indexOf("--amount")
            : args.indexOf("-a")
        const _tmp = args.splice(_i, _i + 2);
        if (_tmp.length != 2) throw new Error("Expected Amount");
        amount = _tmp[1]
      }  

    if (
        args.includes("--token") ||
        args.includes("-tk")
      ) {
        const _i =
          args.indexOf("--token") > -1
            ? args.indexOf("--token")
            : args.indexOf("-tk")
        const _tmp = args.splice(_i, _i + 2);
        if (_tmp.length != 2) throw new Error("Expected Amount");
        if(validTokens.indexOf(_tmp[1]) == -1 ) throw new Error(`Invalid token : ${_tmp[1]}`);
        token = _tmp[1]
      } 

    
      const common = getCommons(fromNetwork)  

      let withdrawTransaction  

      if(token != 'USDT' && token != 'NHT'){
        console.log("Invalid Token")
        return
      }

      if(token == 'USDT'){
        withdrawTransaction =  await withdrawUSDTTokensOB(fromNetwork,process.env.DEPLOYMENT_KEY,common, amount ) 
      }else if(token == 'NHT'){
        withdrawTransaction =  await withdrawNHTTokensOB(fromNetwork,process.env.DEPLOYMENT_KEY,common, amount ) 
      }

      const receipt = await withdrawTransaction.wait() 
      console.log(`Amount Withdrawn : ${receipt.transactionHash}`) 

  }

  


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 


