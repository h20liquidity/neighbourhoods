import type { HardhatUserConfig } from "hardhat/types";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "@nomiclabs/hardhat-ethers";
import "hardhat-contract-sizer";
import * as config_ from "./config/config.json"
import * as dotenv from "dotenv";
dotenv.config();

const MOCHA_TESTS_PATH = process.env.TESTS_PATH || "./test";
const MOCHA_SHOULD_BAIL = process.env.BAIL === "true";

console.log('foo', process.env.ALCHEMY_KEY.length)

const config: HardhatUserConfig = {
  typechain: {
    outDir: "typechain", // overrides upstream 'fix' for another issue which changed this to 'typechain-types'
  },
  networks: {
    hardhat: {
      forking:{
        url: config_.hardhat.forkBaseUrl + process.env.ALCHEMY_KEY,
        blockNumber : config_.hardhat.blockNumber
      }
    },

    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: process.env["DEPLOYMENT_KEY_MUMBAI"]
        ? [process.env["DEPLOYMENT_KEY_MUMBAI"]]
        : [],
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000000000,
            details: {
              peephole: true,
              inliner: true,
              jumpdestRemover: true,
              orderLiterals: true,
              deduplicate: true,
              cse: true,
              constantOptimizer: true,
            },
          },
          evmVersion: "london",
          // viaIR: true,
          metadata: {
            useLiteralContent: true,
          },
        },
      },
    ],
  },
  mocha: {
    // explicit test configuration, just in case
    asyncOnly: true,
    bail: MOCHA_SHOULD_BAIL,
    parallel: false,
    timeout: 0,
  },
  paths: {
    tests: MOCHA_TESTS_PATH,
  },
};
export default config;
