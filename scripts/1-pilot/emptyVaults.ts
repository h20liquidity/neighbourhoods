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
        
        --vault, -v <hex string>
          Hexadecimal string representing the vault. 
      `
    );
  }else{ 

    let fromNetwork
    let contractAdress   
    let vault  

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
        const _tmp = args.splice(_i,2);
        if (_tmp.length != 2) throw new Error("expected network to deploy from");
        if(validNetworks.indexOf(_tmp[1]) == -1 ) throw new Error(`Unsupported network : ${_tmp[1]}`);
        fromNetwork = _tmp[1]
     }
    if(!fromNetwork) throw Error("Origin Network not provided. Must provide --from <network name> argument")  
     
     if (
        args.includes("--contract") ||
        args.includes("-c")
      ) {
        const _i =
          args.indexOf("--contract") > -1
            ? args.indexOf("--contract")
            : args.indexOf("-c")
        const _tmp = args.splice(_i,2);
        if (_tmp.length != 2) throw new Error("expected contract address");
        contractAdress = _tmp[1]
      } 
      if(!contractAdress) throw Error("Contract Address not provided. Must provide --contract <ob address> argument")   

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

      //Get Provider for testnet from where the data is to be fetched 
      const provider = getProvider(fromNetwork)  
      
      const signer = new ethers.Wallet(process.env.DEPLOYMENT_KEY,provider)  

      const orderBook = new ethers.Contract(contractAdress,orderBookDetails0.abi,signer)   

      const nhtTokenAddress = contractConfig.contracts[fromNetwork].nht.address
      const nhtTokenDecimals = contractConfig.contracts[fromNetwork].nht.address

      const usdtTokenAddress = contractConfig.contracts[fromNetwork].usdt.address
      const usdtTokenDecimals = contractConfig.contracts[fromNetwork].usdt.address

      //Withdraw Output Tokens 
      let nhtBalance = await orderBook.vaultBalance(
        signer.address ,
        nhtTokenAddress ,
        ethers.BigNumber.from(vault)
      ) 
      
      let nhtBalanceDisplacy = ethers.utils.formatUnits(nhtBalance.toString(),nhtTokenDecimals)  
      console.log("NHT Balance : " , nhtBalanceDisplacy )
      if(ethers.BigNumber.from(nhtBalance.toString()).gt(0)){
        await emptyNHTAmount(fromNetwork,nhtBalanceDisplacy,orderBook,vault) 
      }else{
        console.log("No NHT tokens to withdraw.")
      }
      
       


      //Withdraw Input Tokens 
      let usdtBalance = await orderBook.vaultBalance(
        signer.address ,
        usdtTokenAddress ,
        ethers.BigNumber.from(vault)
      )  
      let usdtBalanceDisplay = ethers.utils.formatUnits(usdtBalance.toString(),usdtTokenDecimals)
      console.log("USDT Balance : " , usdtBalanceDisplay ) 
      if(ethers.BigNumber.from(usdtBalance.toString()).gt(0)){
        await emptyUSDTAmount(fromNetwork,usdtBalanceDisplay,orderBook,vault)
      }else{
        console.log("No USDT tokens to withdraw.")
      }
        

  }

  


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 


