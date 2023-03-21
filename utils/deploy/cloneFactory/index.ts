import { ethers } from "hardhat"
import config from "../../../config/config.json"

export const cloneFactoryAbi = [{"inputs":[],"name":"ZeroImplementation","type":"error"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"address","name":"implementation","type":"address"},{"indexed":false,"internalType":"address","name":"clone","type":"address"},{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"}],"name":"NewClone","type":"event"},{"inputs":[{"internalType":"address","name":"implementation_","type":"address"},{"internalType":"bytes","name":"data_","type":"bytes"}],"name":"clone","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"nonpayable","type":"function"}] 

export const getCloneFactory = async () => {

    const signers = await ethers.getSigners()
    const cloneFactory = await ethers.getContractAt(cloneFactoryAbi,config.address.cloneFactory.address,signers[0]) 
    // console.log("cloneFactory : " , cloneFactory.address) 

    return cloneFactory

}