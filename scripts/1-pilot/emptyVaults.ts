import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { emptyNHTAmount, emptyUSDTAmount } from "../Withdraw/withdraw";
import { ethers } from "ethers";
import contractConfig from "../../config/config.json"
import orderBookDetails0 from "../../config/Orderbook/0-OrderBook.json"  

import orderDetails from "../DeployStrategy/orderDetails.json"

import {  getProvider } from "../utils";

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
      Withdraw NHT token from the vault.
      options:

        --from, -f <network name>
          Name of the network to deploy the contract. Any of ["snowtrace",goerli","mumbai","sepolia","polygon"]. 
        
        --contract -c <contract address>
          OrderBook Contract
      `
    );
  }else{ 

    let fromNetwork
    let contractAdress    

    //valid networks
    const validNetworks = ["goerli","snowtrace","mumbai","sepolia","polygon"] 

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
        args.includes("--contract") ||
        args.includes("-c")
      ) {
        const _i =
          args.indexOf("--contract") > -1
            ? args.indexOf("--contract")
            : args.indexOf("-c")
        const _tmp = args.splice(_i, _i + 2);
        if (_tmp.length != 2) throw new Error("expected contract address");
        contractAdress = _tmp[1]
      } 

      //Get Provider for testnet from where the data is to be fetched 
      const provider = getProvider(fromNetwork)  
      
      const signer = new ethers.Wallet(process.env.DEPLOYMENT_KEY,provider)  

      const orderBook = new ethers.Contract(contractAdress,orderBookDetails0.abi,signer)  

      //Withdraw Output Tokens 
      let nhtBalance = await orderBook.vaultBalance(
        signer.address ,
        contractConfig.contracts[fromNetwork].nht.address ,
        ethers.BigNumber.from(orderDetails[0].validOutputs[0].vaultId)
      )
      nhtBalance = ethers.utils.formatUnits(nhtBalance.toString(),orderDetails[0].validOutputs[0].decimals) 
      console.log("NHT Balance : " , nhtBalance )
      await emptyNHTAmount(fromNetwork,nhtBalance,orderBook)  


      //Withdraw Input Tokens 
      let usdtBalance = await orderBook.vaultBalance(
        signer.address ,
        contractConfig.contracts[fromNetwork].usdt.address ,
        ethers.BigNumber.from(orderDetails[0].validInputs[0].vaultId)
      )  
      usdtBalance = ethers.utils.formatUnits(usdtBalance.toString(),orderDetails[0].validInputs[0].decimals)
      console.log("USDT Balance : " , usdtBalance )
      await emptyUSDTAmount(fromNetwork,usdtBalance,orderBook)  

  }

  


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 


