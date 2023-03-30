## Deploying a strategy 

In order to deploy startegy, we need to first deploy DISpair(Deployter,Interpreter,Store) contracts, followed by Orderbook and ZeroExArb Contracts, and then finally the startegy itself. 

### Setting up script environment  

#### Env Variables : 
Make an `.env` file and populate it with keys from `.env.example` . 

```sh
DEPLOYMENT_KEY = <private-key-of-wallet-to-deploy-from>

ALCHEMY_KEY_MUMBAI =  <alchemy-key-mumbai>
ALCHEMY_KEY_POLYGON = <alchemy-key-polygon-mainnet>
ALCHEMY_KEY_SEPOLIA = <alchemy-key-sepolia>

POLYGONSCAN_API_KEY = <polygonscan-api-key>
ETHERSCAN_API_KEY= <etherscan-api-key>
```  
#### Config files :  

- `dispair.config.json` contains address for all DISpair contracts across networks. It is crucial for the script that the dispair contract across networks *must be verified*. 
```sh
{
  "mumbai": {
    "interpreter": {
      "address": "0x9a1a9544d7a247ea50b35e6563d267f57c05d041",
      "transaction": "0xeec072dbb681b2c1674e0aebded4da385248cfb957276f54c84bd9ebd8f83787"
    },
    "store": {
      "address": "0xbdeb3b4ad63625db69692cf4d60fb0d092312362",
      "transaction": "0x5dd93b93daab920fcf3cd47a22732f2fa244c7d74447cd1ef2c1a15b3930efe7"
    },
    "expressionDeployer": {
      "address": "0xb4daa68e3a48b5ee7b66a66374a5d552c53f7758",
      "transaction": "0x5dfb04c5581d83a70f920349beba866e41e85fb66ebe547b96bab416f2b221af"
    }
  }
}
  ``` 
- `contracts.config.json` contains all *verified* smart contract address across network. 
```sh
{
  "mumbai": {
    "orderbook": {
      "address": "0x067a07b7e27917281bdefb6c99267f215d5b81a0",
      "transaction": "0x7eae8a6e95f4609329aa02ba66b7c9191a99c5f7463900657391dc88890dc045"
    },
    "zeroexorderbook": {
      "address": "0xabfac36e7220e003b3ad5097441a798da0302d90",
      "transaction": "0x24a9fc4e3d0b4701ca3401fa0aa509c81046de22870cbe46b3ea5d2da317e098"
    }
  }
}
``` 
- Lastly `tokens.config.json` contains any ERC20 tokens related details across chains. 
```sh
{
"polygon":{
        "usdt":{
            "address": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
            "decimals": 6
        },
        "nht":{
            "address": "0x84342e932797FC62814189f01F0Fb05F52519708",
            "decimals": 18
        }
    } 
}
``` 
#### Deploying DISpair contracts 
The script to deploy contracts and strategy is uniform with common arguments. The script clones the contract deployed on one network to another. 
Common arguments to run the script are :  
- `--transaction, -tx, <hash>` : Deploy transaction hash of the contract on originating chain.You can copy the transaction hash mentioned in `dispair.config.json` . Usually the originating chain will be a test network. You can copy the transaction for a particular contract, for a particular network from `dispair.config.json`.
- `--from, -f <network name>` : Network name of originating network. Any of ["mumbai","sepolia","polygon"]. Usally this will be a test network.
- `--to, -t <network name>` : Network name of target network where new contract is to be deployed.Any of ["mumbai","sepolia","polygon"]. Usally this will be a main network for a chain.

Now lets deploy the DISpair . It is a *must* that we deploy interpreter and store first, and expression deployer after. 
#### Deploy Interpreter contract  
To deploy Interpreter contract run the following command in shell.
```sh
ts-node scripts/DISpair/deployInterpreter.ts --transaction <tx-hash> --from <origin-network-name> --to <target-network-name>
``` 
You can copy the transaction hash from `dispair.config.json` for the interpreter of the originating network. 

Wait for the contract to be deployed and verified . 

#### Deploy Store contract 
To deploy Store contract run the following command in shell.
```sh
ts-node scripts/DISpair/deployStore.ts --transaction <tx-hash> --from <origin-network-name> --to <target-network-name>
```   
You can copy the transaction hash from `dispair.config.json` for the store of the originating network.  

Wait for the contract to be deployed and verified .  

#### Deploy Expression Deployer contract 
To deploy Expression Deployer contract run the following command in shell.
```sh
ts-node scripts/DISpair/deployExpressionDeployer.ts --transaction <tx-hash> --from <origin-network-name> --to <target-network-name>
```  
You can copy the transaction hash from `dispair.config.json` for the expressionDeployer of the originating network. 

Wait for the contract to be deployed and verified .  

After the contracts are deployed on the `target` network, you can see that `dispair.config.json` is updated with DISpair for `target` network . 

#### Deploying Orderbook 
To deploy orderbook run the following command in shell. 
```sh
ts-node scripts/ContractDeploy/deployOrderbook.ts --transaction <tx-hash> --from <origin-network-name> --to <target-network-name>
```  
You can copy the transaction hash from `contracts.config.json` for the orderbook of the originating network 

Wait for the contract to be deployed and verified .  

#### Deploying ZeroEx 
To deploy ZeroEx Arb contract run the following command in shell. 
```sh
ts-node scripts/ContractDeploy/deployZeroXArb.ts --transaction <tx-hash> --from <origin-network-name> --to <target-network-name>
```   
You can copy the transaction hash from `contracts.config.json` for the zeroexorderbook of the originating network 

Wait for the contract to be deployed and verified .   

Note: Deploying ZeroEx to some test networks may fail due to lack of [ZeroExExchangeProxy](https://docs.0x.org/developer-resources/contract-addresses)

#### Deploying Startegy. 
Finally to deploy strategy make sure that Orderbook and ZeroEx contracts are deployed on target network and corresponding address are updated in `scripts/contracts.config.json` . 
Also make sure that all the necessary ERC20 token details on the target network required for the startegyt are updated in `scripts/tokens.config.json` 

To deploy startegy run the following command in your shell : 
```sh
ts-node scripts/DeployStrategy/deployStrategy.ts --to <taget-network-name> --counterparty <counterparty-public-address>
``` 
where arguments for the script are : 
- `--to, -t <taget-network-name>` : Target network to deploy startegy to. 
-  `--counterparty, -c <address>` : Conterparty address (public key) used for the startegy. 

Wait for the transaction to be confirmed.  

You'll Notice that the order details are updated in the `scripts/DeployStrategy/orderDetails.json` file which will be used to deposit tokens.

#### Depositing NHT Tokens into vault.  

Deposit some tokens into the vault. First make sure that the wallet has enough number of tokens you want to deposit

To deposit tokens run the following command in your shell 

```sh
ts-node scripts/DeployStrategy/deposit.ts --to <target-network-name> --amount <NHT-Amount>
``` 
where arguments for the script are : 
- `--to, -t <taget-network-name>` : Target network. 
-  `--amount, -a <token-amount>` : Amount of tokens to deposit. Eg : To deposit 5.2 NHT this vaslue will be 5.2 . 

wait for the transaction to be confirmed. 







