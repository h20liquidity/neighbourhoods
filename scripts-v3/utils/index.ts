import { BigNumber, ethers } from "ethers";  
import {  Common,  CustomChain, Chain, Hardfork } from '@ethereumjs/common'
import {  FeeMarketEIP1559Transaction } from '@ethereumjs/tx'  
import { getContractAddressesForChainOrThrow } from "@0x/contract-addresses";
import fs from "fs"  

import contractConfig from "../v3-config.json"

import axios from "axios";
import { hexlify } from "ethers/lib/utils";
import {ARB_RAINLANG_STRING} from "../../src/3-sushi-v2-arb" ;
import Parser from "../abis/IParserV1.json" 
import Cloneable from "../abis/ICloneableV2.json" 

/**
 * Supported Networks to x-deploy contracts.
 */
export const supportedNetworks = ["mumbai","polygon","ethereum","sepolia"]  

/**
 * Supported Contracts to x-deploy.
 */
export const supportedContracts = Object.freeze({
  Rainterpreter : "Rainterpreter",
  RainterpreterStore : "RainterpreterStore",
  RainterpreterExpressionDeployer : "RainterpreterExpressionDeployer",
  Orderbook : "Orderbook",
  CloneFactory : "CloneFactory",
  GenericPoolOrderBookFlashBorrowerImplementation : "GenericPoolOrderBookFlashBorrowerImplementation",
  GenericPoolOrderBookFlashBorrowerInstance : "GenericPoolOrderBookFlashBorrowerInstance"
}) 
 

/*
* Get etherscan key
*/
export const getEtherscanKey = (network:string) => { 

  let key = ''
  if (network === "mumbai" || network === "polygon"){ 
    key = process.env.POLYGONSCAN_API_KEY
  }else if(network === "sepolia" || network === "ethereum"){
    key = process.env.ETHERSCAN_API_KEY
  }
  return key
}    

/*
* Get base url
*/
export const getEtherscanBaseURL = (network:string) => { 

  let url = ''
  if (network === "mumbai"){ 
    url = 'https://api-testnet.polygonscan.com/api'
  }else if(network === "sepolia"){
    url = 'https://api-sepolia.etherscan.io/api'
  }else if(network === "polygon"){
    url = 'https://api.polygonscan.com/api'
  }else if(network === "ethereum"){
    url = 'https://api.etherscan.io/api'
  }
  return url
}  


/*
* Get provider for a specific network
*/
export const getProvider = (network:string) => { 

    let provider 
    if (network === "mumbai"){  
      provider = new ethers.providers.AlchemyProvider("maticmum",`${process.env.ALCHEMY_KEY_MUMBAI}`)   
    }else if(network === "sepolia"){ 
      provider = new ethers.providers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY_SEPOLIA}`)
    }else if(network === "polygon"){
      provider = new ethers.providers.AlchemyProvider("matic",`${process.env.ALCHEMY_KEY_POLYGON}`)   
    }else if(network === "ethereum"){
      provider = new ethers.providers.AlchemyProvider("homestead",`${process.env.ALCHEMY_KEY_ETHEREUM}`)   
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
    }else if(network === "sepolia"){
      common = Common.custom({ chainId: 11155111 })
    }else if(network === "polygon"){
      common = Common.custom(CustomChain.PolygonMainnet) 
    }else if(network === "polygon"){
      common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.London })  
    }
    
    return common
}

/*
* Get transaction data (bytecode + args)
*/
export const getTransactionData = async (provider: any, address:string): Promise<string> => { 

    const transaction = await provider.getTransaction(address)  

    return transaction.data
}   

/**
 *Replace all DISpair instances 
 */
 export const getTransactionDataForZeroEx = (txData:string,fromNetwork:string,toNetwork:string) => { 

  const fromProvider = getProvider(fromNetwork)
  const toProvider = getProvider(toNetwork)  

  const { exchangeProxy: fromNetworkProxy } = getContractAddressesForChainOrThrow(fromProvider._network.chainId);
  const { exchangeProxy: toNetworkProxy } = getContractAddressesForChainOrThrow(toProvider._network.chainId);  

  
  txData = txData.toLocaleLowerCase()
  const fromContractConfig = contractConfig.contracts[fromNetwork]
  const toContractConfig = contractConfig.contracts[toNetwork] 

  if(txData.includes(fromContractConfig["Orderbook"]["address"].split('x')[1].toLowerCase())){ 
    txData = txData.replace(fromContractConfig["Orderbook"]["address"].split('x')[1].toLowerCase(), toContractConfig["Orderbook"]["address"].split('x')[1].toLowerCase())
  }
  if(txData.includes(fromNetworkProxy.split('x')[1].toLowerCase())){
    txData = txData.replace(fromNetworkProxy.split('x')[1].toLowerCase(), toNetworkProxy.split('x')[1].toLowerCase())
  }
  return txData 
}   

/**
 * @returns a random 32 byte number in hexstring format
 */
export function randomUint256(): string {
  return ethers.utils.hexZeroPad(ethers.utils.randomBytes(32), 32);
} 


/**
 *Replace all DISpair instances 
 */
export const getTransactionDataForNetwork =  (txData:string,fromNetwork:string,toNetwork:string) => {
  
  txData = txData.toLocaleLowerCase()
  const fromNetworkConfig = contractConfig.contracts[fromNetwork]
  const toNetworkConfig = contractConfig.contracts[toNetwork]  

  // let contract = await hre.ethers.getContractAt('Rainterpreter',fromNetworkConfig["interpreter"]["address"]) 
  // console.log("contract : " , contract )

  if(txData.includes(fromNetworkConfig["Rainterpreter"]["address"].split('x')[1].toLowerCase())){ 
    txData = txData.replace(fromNetworkConfig["Rainterpreter"]["address"].split('x')[1].toLowerCase(), toNetworkConfig["Rainterpreter"]["address"].split('x')[1].toLowerCase())
  }
  if(txData.includes(fromNetworkConfig["RainterpreterStore"]["address"].split('x')[1].toLowerCase())){
    txData = txData.replace(fromNetworkConfig["RainterpreterStore"]["address"].split('x')[1].toLowerCase(), toNetworkConfig["RainterpreterStore"]["address"].split('x')[1].toLowerCase())
  }
  if(txData.includes(fromNetworkConfig["RainterpreterExpressionDeployer"]["address"].split('x')[1].toLowerCase())){
    txData = txData.replace(fromNetworkConfig["RainterpreterExpressionDeployer"]["address"].split('x')[1].toLowerCase(), toNetworkConfig["RainterpreterExpressionDeployer"]["address"].split('x')[1].toLowerCase())
  }
  return txData 
}  


export const estimateFeeData = async ( 
  chainProvider:any ,
): Promise<{
  gasPrice: BigNumber;
  maxFeePerGas: BigNumber;
  maxPriorityFeePerGas: BigNumber;
}> => {
  if (chainProvider._network.chainId === 137) {    
     
    let res = await axios.get(
      "https://api.blocknative.com/gasprices/blockprices?chainid=137",
      {headers: {
          "Authorization" : " 49281639-8d0e-4d3c-a55a-71f18585deef"
        }
      }
    ) 
    let gasPrice = ethers.utils.parseUnits(`${res.data.blockPrices[0].estimatedPrices[0].price}`,9)
    let maxPriorityFeePerGas = ethers.utils.parseUnits(`${res.data.blockPrices[0].estimatedPrices[0].maxPriorityFeePerGas}`,9)
    let maxFeePerGas = ethers.utils.parseUnits(`${res.data.blockPrices[0].estimatedPrices[0].maxFeePerGas}`,9) 

    return {
      gasPrice: gasPrice,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      maxFeePerGas: maxFeePerGas 
    }

  }else if(chainProvider._network.chainId === 43113 || chainProvider._network.chainId === 11155111 || chainProvider._network.chainId === 80001 ){
    // Snowtrace Network
    const feeData = await chainProvider.getFeeData();   
    return {
      gasPrice: BigNumber.from("0x7A1200"),
      maxPriorityFeePerGas: feeData["maxPriorityFeePerGas"],
      maxFeePerGas: feeData["maxFeePerGas"],
    }
  }
};
 

export const fetchFile = (_path: string): string => {
  try {
    return fs.readFileSync(_path).toString();
  } catch (error) {
    console.log(error);
    return "";
  }
};   

export const encodeMeta = (data: string) => {
  return (
    "0x" +
    BigInt(0xff0a89c674ee7874n).toString(16).toLowerCase() +
    hexlify(ethers.utils.toUtf8Bytes(data)).split("x")[1]
  );
}; 

/*
* Deploy transaction
*/
export const deployContractToNetwork = async (provider: any, common: Common,  priKey: string, transactionData: string) => { 

    console.log("Deploying Contract...")
  
    const signer  = new ethers.Wallet(priKey,provider)   

    const nonce = await provider.getTransactionCount(signer.address)   


    // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
    // but after being mined affected relevant state.
    // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
    const gasLimit = await provider.estimateGas({
      data: transactionData
    }) 


    const feeData = await estimateFeeData(provider)  
    
  
    // hard conded values to be calculated
    const txData = { 
      nonce: ethers.BigNumber.from(nonce).toHexString() ,
      data : transactionData ,
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
    const deployTransaction = await provider.sendTransaction(
      "0x" + signedTx.serialize().toString("hex")
    ); 
    
    return deployTransaction
  
  }   
 
export const decodeCloneEvent = async(transaction,cloneFactory) => {  

  const eventObj = (await transaction.wait()).logs.find(
    (x) =>{  
      return (x.topics[0] == "0x274b5f356634f32a865af65bdc3d8205939d9413d75e1f367652e4f3b24d0c3a") // Checking for New Clone Event 
    }
      
  ); 

  if (!eventObj) {
    console.log(`Could not find event data!!!`);
  }

  let eventData = cloneFactory.interface.decodeEventLog(
    "NewClone",
    eventObj.data,
    eventObj.topics
  );    

  const cloneObject = {
    sender : eventData.sender ,
    implementation: eventData.implementation ,
    clone : eventData.clone ,
  }

  return cloneObject

} 

 
export const deployArbContractInstance = async (provider: any, common: Common,  priKey: string, network: string) => { 

  console.log("Deploying Arb Instance...")

  const signer  = new ethers.Wallet(priKey,provider)   

  const nonce = await provider.getTransactionCount(signer.address)    

  const arbString = ARB_RAINLANG_STRING ; 
  const expressionDeployerAddress = contractConfig.contracts[network].RainterpreterExpressionDeployer
  const orderBookAddress = contractConfig.contracts[network].Orderbook.address 
  const cloneFactoryAddress = contractConfig.contracts[network].CloneFactory.address
  const arbImplementationAddress = contractConfig.contracts[network].GenericPoolOrderBookFlashBorrowerImplementation.address


  const parser = new ethers.Contract(expressionDeployerAddress.address,Parser.abi,provider) 

  let [bytecode,constants] = await parser.parse(
    ethers.utils.toUtf8Bytes(
      arbString.trim()
    )
  ) 
  
  const abiEncodedRouter = ethers.utils.defaultAbiCoder.encode(
    ["address"],
    ["0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"] // Sushi Router Address
  ) 

  const borrowerConfig = {
    orderBook : orderBookAddress,
    evaluableConfig: {
      deployer: expressionDeployerAddress.address,
      bytecode,
      constants
    },
    implementationData : abiEncodedRouter
  }
  const encodedConfig = ethers.utils.defaultAbiCoder.encode(
    [
      "tuple(address orderBook,tuple(address deployer,bytes bytecode,uint256[] constants) evaluableConfig, bytes implementationData)",
    ],
    [borrowerConfig]
  ); 
  
  // Create Clone Factory Instance
  const cloneFactory = new ethers.Contract(cloneFactoryAddress,Cloneable.abi,signer)  

  const cloneData = await cloneFactory.populateTransaction.clone(arbImplementationAddress,encodedConfig);   
  

  // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
  // but after being mined affected relevant state.
  // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
  const gasLimit = await provider.estimateGas({ 
    to:cloneData.to ,
    from:cloneData.from ,
    data: cloneData.data
  }) 

  const feeData = await estimateFeeData(provider)  

  // hard conded values to be calculated
  const txData = {  
    to: cloneFactoryAddress.toLowerCase() ,
    from: signer.address, 
    nonce: ethers.BigNumber.from(nonce).toHexString() ,
    data : cloneData.data ,
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

  const cloneEventData = await decodeCloneEvent(contractTransaction,cloneFactory)


  return {cloneEventData,contractTransaction}


}  


 
