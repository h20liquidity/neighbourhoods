import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { getCommons } from "./utils";
import { withdrawNHTTokensOB, withdrawUSDTTokensOB } from "./utils/np-strat";


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
        
        --vault, -v <hex string of vault to deposit>
          Hexadecimal string representing the vault to withdraw from
      `
    );
  }else{ 

    let fromNetwork
    let token
    let amount
    let vault
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
        const _tmp = args.splice(_i, 2);
        if (_tmp.length != 2) throw new Error("expected network to deploy from");
        if(validNetworks.indexOf(_tmp[1]) == -1 ) throw new Error(`Unsupported network : ${_tmp[1]}`);
        fromNetwork = _tmp[1]
      }   

    if(!fromNetwork) throw Error("Network not provided")
    if (
        args.includes("--amount") ||
        args.includes("-a")
      ) {
        const _i =
          args.indexOf("--amount") > -1
            ? args.indexOf("--amount")
            : args.indexOf("-a")
        
        const _tmp = args.splice(_i, 2); 
        if (_tmp.length != 2) throw new Error("Expected Amount");
        amount = _tmp[1]
      }  
      if(!amount) throw Error("Amount not provided")
    if (
        args.includes("--token") ||
        args.includes("-tk")
      ) {
        const _i =
          args.indexOf("--token") > -1
            ? args.indexOf("--token")
            : args.indexOf("-tk")
        const _tmp = args.splice(_i, 2);
        if (_tmp.length != 2) throw new Error("Expected Token");
        if(validTokens.indexOf(_tmp[1]) == -1 ) throw new Error(`Invalid token : ${_tmp[1]}`);
        token = _tmp[1]
      }  
      if(!token) throw Error("Token not provided")
      if (
        args.includes("--vault") ||
        args.includes("-v")
      ) {
        const _i =
          args.indexOf("--vault") > -1
            ? args.indexOf("--vault")
            : args.indexOf("-v") 
        const _tmp = args.splice(_i, 2);
        if (_tmp.length != 2) throw new Error("Expected Vault Id");
        vault = _tmp[1]
      }   

      if(!vault) throw Error("Vault Id not provided")
      
      
  

    
      const common = getCommons(fromNetwork)  

      let withdrawTransaction  

      if(token != 'USDT' && token != 'NHT'){
        console.log("Invalid Token")
        return
      }

      if(token == 'USDT'){
        withdrawTransaction =  await withdrawUSDTTokensOB(fromNetwork,process.env.DEPLOYMENT_KEY,common, amount ,vault ) 
      }else if(token == 'NHT'){
        withdrawTransaction =  await withdrawNHTTokensOB(fromNetwork,process.env.DEPLOYMENT_KEY,common, amount , vault) 
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


