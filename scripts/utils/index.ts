import { ethers, network } from "hardhat"; 

import {  Common,  CustomChain } from '@ethereumjs/common'
import {  Transaction , FeeMarketEIP1559Transaction } from '@ethereumjs/tx'

/*
* Get provider for a specific network
*/
export const getProvider = (network:string) => {
    let provider 
    if (network === "mumbai"){
         provider = new ethers.providers.AlchemyProvider("maticmum",`${process.env.ALCHEMY_KEY_MUMBAI}`)   
    }
    return provider
} 

/*
* Get @ethereumjs/common Common
*/
export const getCommons = (network:string) => {
    let common 
    if (network === "mumbai"){
        common = Common.custom(CustomChain.PolygonMumbai) 
    }
    return common
}

/*
* Get transaction data (bytecode + args)
*/
export const getTransactionData = async (provider: any, address:string): Promise<string> => { 

    const transaction = await provider.getTransaction(address)    

    // console.log("transaction : " , transaction )
    return transaction.data
} 

/*
* Deploy transaction
*/
export const deployContractToNetwork = async (provider: any, common: Common,  priKey: string, transactionData: string) => { 

  
    const signer  = new ethers.Wallet(priKey,provider)  
    const nonce = await provider.getTransactionCount(signer.address)
    
    // hard conded values to be calculated
    const txData = { 
      nonce: ethers.BigNumber.from(nonce).toHexString() ,
      data : transactionData ,
      gasLimit: '0x4200A9', 
      maxPriorityFeePerGas: '0x6B49D202',
      maxFeePerGas: '0x6B49D21B',
    } 
    
    // Generate Transaction 
    const tx = FeeMarketEIP1559Transaction.fromTxData(txData, { common })  
  
    const privateKey = Buffer.from(
      priKey,
      'hex'
    )
    
    // Sign Transaction 
    const signedTx = tx.sign(privateKey)
  
    // Send the transaction
    const deployTransaction = await provider.sendTransaction(
      "0x" + signedTx.serialize().toString("hex")
    ); 
    
    return deployTransaction
  
  }
  

