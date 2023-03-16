import { artifacts } from "hardhat"; 
import { ethers  } from "hardhat"; 

export const getExpressionDelopyer = async (address: string) => { 

    const deployerAbiJSON = artifacts.readArtifactSync("RainterpreterExpressionDeployer").abi;  

    const expressionDeployer = new ethers.Contract(address,deployerAbiJSON) 

    return expressionDeployer

}