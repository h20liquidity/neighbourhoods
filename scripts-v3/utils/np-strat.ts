import {  ethers } from "ethers";  

import {  Common} from '@ethereumjs/common'
import {  FeeMarketEIP1559Transaction } from '@ethereumjs/tx'   
import orderBookDetails from "../abis/Orderbook.json" 
import abi from 'erc-20-abi' 
import contractConfig from "../v3-config.json"
import { encodeMeta, estimateFeeData, getProvider } from "./index";
import networkConfig from "../../networkConfig.json"

import Parser from "../abis/IParserV1.json" 


export const deploySushiSellStrategy = async(network:string,priKey: string, common: Common,vaultId, strategyString: string) => { 

  console.log("Deploying Sell Strategy with Native Parser...") 
    
  //Get Provider for testnet from where the data is to be fetched 
  const provider = getProvider(network)    

  const validInputs = networkConfig
    .filter(n => n.chainId === provider._network.chainId)[0].erc20Tokens
    .filter(t => t.symbol == 'USDT')  
    .map(t => {
      return{
        token: t.address,
        decimals: t.decimals,
        vaultId: vaultId
      }
    }) 
    
    const validOutputs = networkConfig
    .filter(n => n.chainId === provider._network.chainId)[0].erc20Tokens
    .filter(t => t.symbol == 'NHT')  
    .map(t => {
      return{
        token: t.address,
        decimals: t.decimals,
        vaultId: vaultId
      }
    }) 

  const signer  = new ethers.Wallet(priKey,provider) 
 
  // Get Orderbook Instance  
  const orderBookAddress = contractConfig.contracts[network].Orderbook.address
  const parserAddress = contractConfig.contracts[network].RainterpreterParser.address
  const deployerAddress = contractConfig.contracts[network].RainterpreterExpressionDeployer.address 


  const orderBook = new ethers.Contract(orderBookAddress,orderBookDetails.abi,signer) 

  const parser = new ethers.Contract(parserAddress,Parser.abi,provider) 

  let [bytecode,constants] = await parser.parse(
    ethers.utils.toUtf8Bytes(
      strategyString.trim()
    )
  )  
  const EvaluableConfig_A = {
    deployer: deployerAddress,
    bytecode: bytecode,
    constants: constants,
  } 

  const orderConfig_A = {
    validInputs: validInputs,
    validOutputs: validOutputs ,
    evaluableConfig: EvaluableConfig_A,
    meta: encodeMeta(""),
  };  


  const addOrderData = await orderBook.populateTransaction.addOrder(orderConfig_A);

  // Building Tx
  const nonce = await provider.getTransactionCount(signer.address)   

  // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
  // but after being mined affected relevant state.
  // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
  const gasLimit = await provider.estimateGas({ 
    to:orderBook.address ,
    data: addOrderData.data
  }) 
  
  const feeData = await estimateFeeData(provider)  


  // hard conded values to be calculated
  const txData = {  
    to: orderBook.address ,
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

export const deploySushiBuyStrategy = async(network:string,priKey: string, common: Common,vaultId, strategyString: string) => { 

  console.log("Deploying Buy Strategy with Native Parser...") 

    
  //Get Provider for testnet from where the data is to be fetched 
  const provider = getProvider(network)   

  const validInputs = networkConfig
    .filter(n => n.chainId === provider._network.chainId)[0].erc20Tokens
    .filter(t => t.symbol == 'NHT')  
    .map(t => {
      return{
        token: t.address,
        decimals: t.decimals,
        vaultId: vaultId
      }
    }) 
    
    const validOutputs = networkConfig
    .filter(n => n.chainId === provider._network.chainId)[0].erc20Tokens
    .filter(t => t.symbol == 'USDT')  
    .map(t => {
      return{
        token: t.address,
        decimals: t.decimals,
        vaultId: vaultId
      }
    }) 
  

  const signer  = new ethers.Wallet(priKey,provider) 
 

  // Get Orderbook Instance 

  const orderBookAddress = contractConfig.contracts[network].Orderbook.address
  const parserAddress = contractConfig.contracts[network].RainterpreterParser.address
  const deployerAddress = contractConfig.contracts[network].RainterpreterExpressionDeployer.address 


  const orderBook = new ethers.Contract(orderBookAddress,orderBookDetails.abi,signer) 

  const parser = new ethers.Contract(parserAddress,Parser.abi,provider) 

  let [bytecode,constants] = await parser.parse(
    ethers.utils.toUtf8Bytes(
      strategyString.trim()
    )
  ) 

  const EvaluableConfig_A = {
    deployer: deployerAddress,
    bytecode: bytecode,
    constants: constants,
  } 

  const orderConfig_A = {
    validInputs: validInputs,
    validOutputs: validOutputs,
    evaluableConfig: EvaluableConfig_A,
    meta: encodeMeta(""),
  };  


  const addOrderData = await orderBook.populateTransaction.addOrder(orderConfig_A);

  // Building Tx
  const nonce = await provider.getTransactionCount(signer.address)   

  // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
  // but after being mined affected relevant state.
  // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
  const gasLimit = await provider.estimateGas({ 
    to:orderBook.address ,
    data: addOrderData.data
  }) 
  
  const feeData = await estimateFeeData(provider)  


  // hard conded values to be calculated
  const txData = {  
    to: orderBook.address ,
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
 

      const depositToken = tokenDetails.address
      const depositAmount = ethers.utils.parseUnits(amount , tokenDetails.decimals )
      const vaultId = ethers.BigNumber.from(vault)
      const orderBookAddress = contractConfig.contracts[network].Orderbook.address

    
      //Get Provider for testnet from where the data is to be fetched 
      const provider = getProvider(network)  
      
      const signer = new ethers.Wallet(priKey,provider)   

      const tokenContract = new ethers.Contract(depositToken,abi,signer)  

     
      const approveTx = await approveDepositTokenOB(tokenContract, orderBookAddress, depositAmount, signer, provider, common , priKey) 

      const approveReceipt = await approveTx.wait()  

  
      if(approveReceipt.transactionHash){   

        console.log("Tokens Approved")
        console.log("Depositing Tokens...")   

         // Get Orderbook Instance
        const orderBook = new ethers.Contract(orderBookAddress,orderBookDetails.abi,signer)  

        const depositData = await orderBook.populateTransaction.deposit(depositToken,vaultId,depositAmount);   

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
            to: orderBookAddress ,
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
      const withdrawAmount = ethers.utils.parseUnits(amount ,withdrawTokenDecimal)
      const vaultId = ethers.BigNumber.from(vault) 
      const orderBookAddress = contractConfig.contracts[network].Orderbook.address

      //Get Provider for testnet from where the data is to be fetched 
      const provider = getProvider(network)  
      
      const signer = new ethers.Wallet(priKey,provider)   

      // Get Orderbook Instance
      const orderBook = new ethers.Contract(orderBookAddress,orderBookDetails.abi,signer)   

      const balance = await orderBook.vaultBalance(
        signer.address ,
        withdrawToken ,
        vaultId
      )   

      if(withdrawAmount.gt(balance)){
        console.log(`Cannot withdraw more than balance. Your current balance for the vault is ${ethers.utils.formatUnits(balance.toString(), withdrawTokenDecimal)} ${tokenDetails.symbol}`) 
        return null
      }

      const withdrawData = await orderBook.populateTransaction.withdraw(withdrawToken,vaultId,withdrawAmount);   

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
        to: orderBookAddress ,
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
   const logs = remvTx.logs.filter(e => e.topics[0].toLocaleLowerCase() === "0x6fa57e1a7a1fbbf3623af2b2025fcd9a5e7e4e31a2a6ec7523445f18e9c50ebf")

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