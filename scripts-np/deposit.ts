import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { getCommons } from "./utils";
import { depositNHTTokensOB, depositUSDTTokensOB } from "./utils/np-strat";


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
      Deposit MHT token into output vault of the deployed strategy.
      options:

        --to, -t <network name>
          Name of the network to deploy the contract. Any of ["snowtrace",goerli","mumbai","sepolia","polygon"].
        
        --token, -tk <token symbol>
          Symbol of the token to withdraw. Any of ["USDT","NHT"].

        --amount, -a <Amount in NHT or USDT>
          Amount in NHT or USDT to deposit

        --vault, -v <hex string representing vault to deposit>
          Hexadecimal string representing the vault to deposit
      `
    );
  }else{ 

    let toNetwork
    let token
    let amount
    let vault

    //valid networks
    const validNetworks = ["goerli","snowtrace","mumbai","sepolia","polygon"]
    const validTokens = ["USDT","NHT"] 

    

   
    if (
      args.includes("--to") ||
      args.includes("-t")
    ) {
      const _i =
        args.indexOf("--to") > -1
          ? args.indexOf("--to")
          : args.indexOf("-t")
      const _tmp = args.splice(_i,2);
      if (_tmp.length != 2) throw new Error("expected network to deploy to");
      if(validNetworks.indexOf(_tmp[1]) == -1 ) throw new Error(`Unsupported network : ${_tmp[1]}`);
      toNetwork = _tmp[1]
    }   
    if(!toNetwork) throw Error("Target Network not provided. Must provide --to <network-name> argument")

    if (
      args.includes("--token") ||
      args.includes("-tk")
    ) {
      const _i =
        args.indexOf("--token") > -1
          ? args.indexOf("--token")
          : args.indexOf("-tk")
      const _tmp = args.splice(_i, _i + 2);
      if (_tmp.length != 2) throw new Error("Expected Token");
      if(validTokens.indexOf(_tmp[1]) == -1 ) throw new Error(`Invalid token : ${_tmp[1]}`);
      token = _tmp[1]
    } 
    if(!token) throw Error("Token not provided. Must provide --token <token-name> argument") 

    if (
        args.includes("--amount") ||
        args.includes("-a")
      ) {
        const _i =
          args.indexOf("--amount") > -1
            ? args.indexOf("--amount")
            : args.indexOf("-a")
        const _tmp = args.splice(_i,2);
        if (_tmp.length != 2) throw new Error("Expected Amount");
        amount = _tmp[1]
      }   
      if(!amount) throw Error("Amount not provided. Must provide --amount <amount> argument") 

      if (
        args.includes("--vault") ||
        args.includes("-v")
      ) {
        const _i =
          args.indexOf("--vault") > -1
            ? args.indexOf("--vault")
            : args.indexOf("-v")
        const _tmp = args.splice(_i,2);
        if (_tmp.length != 2) throw new Error("Expected Vault Id. Must provide --to <network-name> argument");
        vault = _tmp[1]
      }  
      if(!vault) throw Error("Vault Id not provided. Must provide --vault <hex string> argument")
      
      
      


      //Deposit NHT into new contract 

      // Get Chain details
      const common = getCommons(toNetwork) 
        
      let depositTransaction 

      if(token != 'USDT' && token != 'NHT'){
        console.log("Invalid Token")
        return
      }

      if(token == 'USDT'){
        depositTransaction =  await depositUSDTTokensOB(toNetwork,process.env.DEPLOYMENT_KEY,common, amount , vault) 
      }else if(token == 'NHT'){
        depositTransaction = await depositNHTTokensOB(toNetwork,process.env.DEPLOYMENT_KEY,common, amount ,vault )  
      }
      
      
      const receipt = await depositTransaction.wait()
        
      console.log(`Amount Deposited : ${receipt.transactionHash}`)
  }

  


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 

