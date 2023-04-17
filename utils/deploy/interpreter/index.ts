import { artifacts } from "hardhat"; 
import { ethers  } from "hardhat"; 
import config from "../../../config/config.json" 
import deployer from '../../../config/RainterpreterExpressionDeployer/RainterpreterExpressionDeployer.json'
import axios from "axios"

export const getExpressionDelopyer = async (address: string) => { 

    const signers = await ethers.getSigners();

    // From the mumbai chain 
    // In near future this will de done from sg  
    
    //Get Source code ABI from contract 
    // const url = `https://api-testnet.polygonscan.com/api?module=contract&action=getsourcecode&address=${config.contracts["mumbai"].expressionDeployer.address}&apikey=${process.env.POLYGONSCAN_API_KEY}`;
    // const source = await axios.get(url);   
    
    const expressionDeployer = new ethers.Contract(address,deployer.abi,signers[0])   

    return expressionDeployer

}