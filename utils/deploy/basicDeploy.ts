import { ethers } from "hardhat";
import axios from "axios"
export const basicDeploy = async (name: string, libs = {}, args = []) => {
  const factory = await ethers.getContractFactory(name, {
    libraries: libs,
  });

  const contract = await factory.deploy(...args);

  await contract.deployed();

  return contract;
}; 

export const getMetaFromTransaction = async (hash: string) => {
  const result = await axios.post(
    `https://api.thegraph.com/subgraphs/name/rainprotocol/interpreter-registry`,
    {
        query: `{
          contracts(
            where: {deployTransaction: "${hash}"}
          ) {
            meta
          }
        }`
    },
    {
        headers: {
            'Content-Type': 'application/json',
        },
    }
) 
  return result.data.data.contracts[0].meta 
}
