import { ethers } from "ethers";  

import {  Common} from '@ethereumjs/common'
import {  FeeMarketEIP1559Transaction } from '@ethereumjs/tx' 
import * as path from "path";  
import orderBookDetails from "../abis/1-OrderBook.json" ;
import abi from 'erc-20-abi' 

import contractConfig from "../config.json"
import networkConfig from "../../networkConfig.json"


import { standardEvaluableConfig } from "../../utils/interpreter/interpreter";
import { encodeMeta, estimateFeeData, fetchFile, getProvider } from ".";
import { ob_entrypoints } from "../../utils/deploy/orderBook";



export const deployStrategyWithVault = async(network:string,priKey: string, common: Common,vaultId) => {   

    console.log("Deploying Strategy...")   
    //Get Provider for testnet from where the data is to be fetched 
    const provider = getProvider(network)   
    
    const validInputs = networkConfig
    .filter(n => n.chainId === provider._network.chainId)[0].stableTokens
    .filter(t => t.symbol == 'USDT')  
    .map(t => {
      return{
        token: t.address,
        decimals: t.decimals,
        vaultId: vaultId
      }
    }) 
    
    const validOutputs = networkConfig
    .filter(n => n.chainId === provider._network.chainId)[0].stableTokens
    .filter(t => t.symbol == 'NHT')  
    .map(t => {
      return{
        token: t.address,
        decimals: t.decimals,
        vaultId: vaultId
      }
    }) 

    const signer  = new ethers.Wallet(priKey,provider) 
    const orderBookAddress = contractConfig.contracts[network].Orderbook.address 
    const arbInsatnceAddres = contractConfig.contracts[network].GenericPoolOrderBookFlashBorrowerInstance.address 
    const expressionDeployer =  contractConfig.contracts[network].RainterpreterExpressionDeployer.address 


    // Get Orderbook Instance
    const orderBook = new ethers.Contract(orderBookAddress,orderBookDetails.abi,signer) 
  
    //Building Expression
    const strategyExpression = path.resolve(
        __dirname,
        "../../src/2-price-update.rain"
      ); 
  
    const strategyString = await fetchFile(strategyExpression);  
  
    const arbCounterParty = arbInsatnceAddres
    console.log("Arb Counterparty: ",arbCounterParty)
      
  
    const { sources, constants } = await standardEvaluableConfig(strategyString,ob_entrypoints)  
  
    const evaluableConfig = {
      deployer: expressionDeployer,
      sources,
      constants,
    }
    const orderConfig_A = {
      validInputs : validInputs,
      validOutputs : validOutputs,
      evaluableConfig,
      meta: encodeMeta("")
    };  
  
  
    const addOrderData = await orderBook.populateTransaction.addOrder(orderConfig_A);   
  
    // Building Tx
    const nonce = await provider.getTransactionCount(signer.address)   
  
  
      // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
      // but after being mined affected relevant state.
      // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
      const gasLimit = await provider.estimateGas({ 
        to:orderBookAddress ,
        data: addOrderData.data
      }) 
  
      const feeData = await estimateFeeData(provider)  
      
    
      // hard conded values to be calculated
      const txData = {  
        to: orderBookAddress ,
        from: signer.address, 
        nonce: ethers.BigNumber.from(nonce).toHexString() ,
        data : addOrderData.data ,
        gasLimit : gasLimit.toHexString(), 
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toHexString(), 
        maxFeePerGas: feeData.maxFeePerGas.toHexString(),
        type: '0x02'
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
      const contractTransaction = await provider.sendTransaction(
        "0x" + signedTx.serialize().toString("hex")
      );     
  
      return contractTransaction

}   

export const approveDepositTokenOB = async(tokenContract, spender, amount, signer, provider, common , priKey) => {  
  
    console.log("Approving Tokens For Deposit.....")   
    
    const balance = await tokenContract.balanceOf(signer.address) 

    if( amount.gt(balance) ){
      console.log(`Not Enough balance, please make sure to have enough balance`)
      return null
    }

    const approveData = await tokenContract.populateTransaction.approve(spender.toLowerCase(), amount.toString());  

    // Building Tx
    const nonce = await provider.getTransactionCount(signer.address)   

    // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
    // but after being mined affected relevant state.
    // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
    const gasLimit = await provider.estimateGas({ 
      to: approveData.to.toLowerCase() ,
      from : approveData.from.toLowerCase(),
      data: approveData.data
    }) 

    const feeData = await estimateFeeData(provider)  
    
  
    // hard conded values to be calculated
    const txData = {  
      to: tokenContract.address.toLowerCase() ,
      from: signer.address, 
      nonce: ethers.BigNumber.from(nonce).toHexString() ,
      data : approveData.data ,
      gasLimit : gasLimit.toHexString(), 
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toHexString(), 
      maxFeePerGas: feeData.maxFeePerGas.toHexString(),
      type: '0x02'
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
    const contractTransaction = await provider.sendTransaction(
      "0x" + signedTx.serialize().toString("hex")
    );      

    return contractTransaction

}

export const depositTokens = async(network:string,priKey: string, common: Common,amount:string,vault:string,tokenDetails:any) => {   

    //Get Provider for testnet from where the data is to be fetched 
    const provider = getProvider(network)   
    
    const depositToken = tokenDetails.address
    const depositAmount = ethers.utils.parseUnits(amount , tokenDetails.decimals )
    const vaultId = ethers.BigNumber.from(vault) 
    const orderbookAddress = contractConfig.contracts[network].Orderbook.address
    
    const signer = new ethers.Wallet(priKey,provider)   

    const tokenContract = new ethers.Contract(depositToken,abi,signer)  

  
    const approveTx = await approveDepositTokenOB(tokenContract, orderbookAddress, depositAmount, signer, provider, common , priKey) 

    const approveReceipt = await approveTx.wait()  


    if(approveReceipt.transactionHash){   

      console.log("Tokens Approved")
      console.log("Depositing Tokens...")   

      // Get Orderbook Instance
      const orderBook = new ethers.Contract(orderbookAddress,orderBookDetails.abi,signer)  

      const depositConfigStruct = {
        token: depositToken ,
        vaultId: vaultId ,
        amount: depositAmount,
      }; 

      const depositData = await orderBook.populateTransaction.deposit(depositConfigStruct);   

      // Building Tx
      const nonce = await provider.getTransactionCount(signer.address)   


        // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
        // but after being mined affected relevant state.
        // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
        const gasLimit = await provider.estimateGas({ 
          to:depositData.to.toLowerCase() , 
          from:depositData.from.toLowerCase() , 
          data: depositData.data
        }) 

        const feeData = await estimateFeeData(provider)  
        
      
        // hard conded values to be calculated
        const txData = {  
          to: orderbookAddress ,
          from: signer.address, 
          nonce: ethers.BigNumber.from(nonce).toHexString() ,
          data : depositData.data ,
          gasLimit : gasLimit.toHexString(), 
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toHexString(), 
          maxFeePerGas: feeData.maxFeePerGas.toHexString(),
          type: '0x02'
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
        const contractTransaction = await provider.sendTransaction(
          "0x" + signedTx.serialize().toString("hex")
        );     

        return contractTransaction

    }else{
    console.log("Token Approval failed")
    }
 

    

}  

export const withdrawTokens = async(network:string,priKey: string, common: Common,amount:string,vault:string,tokenDetails:any) => { 

      const withdrawToken = tokenDetails.address
      const withdrawTokenDecimal = tokenDetails.decimals
      const withdrawAmount = ethers.utils.parseUnits(amount, withdrawTokenDecimal)
      const vaultId = ethers.BigNumber.from(vault)  
      const orderbookAddress = contractConfig.contracts[network].Orderbook.address

      //Get Provider for testnet from where the data is to be fetched 
      const provider = getProvider(network)  
      
      const signer = new ethers.Wallet(priKey,provider)   

      // Get Orderbook Instance
      const orderBook = new ethers.Contract(orderbookAddress,orderBookDetails.abi,signer)   

      const balance = await orderBook.vaultBalance(
        signer.address ,
        withdrawToken ,
        vaultId
      )   

      if(withdrawAmount.gt(balance)){
        console.log(`Cannot withdraw more than balance. Your current balance for the vault is ${ethers.utils.formatUnits(balance.toString(), withdrawTokenDecimal)} ${tokenDetails.symbol}`) 
        return null
      }
     
      const withdrawConfigStruct = {
        token: withdrawToken ,
        vaultId: vaultId ,
        amount: withdrawAmount,
      }; 

      const withdrawData = await orderBook.populateTransaction.withdraw(withdrawConfigStruct);   

      // Building Tx
      const nonce = await provider.getTransactionCount(signer.address)   


      // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
      // but after being mined affected relevant state.
      // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
      const gasLimit = await provider.estimateGas({ 
        to:withdrawData.to.toLowerCase() , 
        from:withdrawData.from.toLowerCase() , 
        data: withdrawData.data
      }) 

      const feeData = await estimateFeeData(provider)  
      
    
      // hard conded values to be calculated
      const txData = {  
        to: orderbookAddress ,
        from: signer.address, 
        nonce: ethers.BigNumber.from(nonce).toHexString() ,
        data : withdrawData.data ,
        gasLimit : gasLimit.toHexString(), 
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toHexString(), 
        maxFeePerGas: feeData.maxFeePerGas.toHexString(),
        type: '0x02'
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
      const contractTransaction = await provider.sendTransaction(
        "0x" + signedTx.serialize().toString("hex")
      );     

      return contractTransaction 
} 

export const removeOrder = async(network:string,priKey:string,common: Common,hash:string) => { 

   //Get Provider for testnet from where the data is to be fetched 
   const provider = getProvider(network)  
    
   const signer = new ethers.Wallet(process.env.DEPLOYMENT_KEY,provider)  
   
   const orderBookAddress = contractConfig.contracts[network].Orderbook.address
   const orderBook = new ethers.Contract(orderBookAddress,orderBookDetails.abi,signer)  

   const remvTx = await provider.getTransactionReceipt(hash)  

   // Filter By AddOrder Event
   const logs = remvTx.logs.filter(e => e.topics[0].toLocaleLowerCase() === "0x73e46afa6205785bdaa1daaf8b6ccc71715ec06b3b4264f5a00fde98671c2fc6")

    const order = ethers.utils.defaultAbiCoder.decode([ 
        "address",
        "address",
        "tuple(address,bool,tuple(address,address,address),tuple(address,uint8,uint256)[],tuple(address,uint8,uint256)[]) order",
        "uint256"
    ],logs[0].data).order 

  const removeData = await orderBook.populateTransaction.removeOrder(order);   

  // Building Tx
  const nonce = await provider.getTransactionCount(signer.address)   

  // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
  // but after being mined affected relevant state.
  // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
  const gasLimit = await provider.estimateGas({ 
    to:removeData.to.toLowerCase() , 
    from:removeData.from.toLowerCase() , 
    data: removeData.data
  }) 

  const feeData = await estimateFeeData(provider)  
  

  // hard conded values to be calculated
  const txData = {  
    to: orderBook.address ,
    from: signer.address, 
    nonce: ethers.BigNumber.from(nonce).toHexString() ,
    data : removeData.data ,
    gasLimit : gasLimit.toHexString(), 
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toHexString(), 
    maxFeePerGas: feeData.maxFeePerGas.toHexString(),
    type: '0x02'
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
  const contractTransaction = await provider.sendTransaction(
    "0x" + signedTx.serialize().toString("hex")
  );     

  return contractTransaction
  
}