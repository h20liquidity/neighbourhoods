## Deploying a strategy 

In order to deploy startegy, we need to first deploy DISpair(Deployter,Interpreter,Store) contracts, followed by Orderbook and ZeroExArb Contracts, and then finally the startegy itself. We will also deposit some amount for the startegy . 

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

Note that wallet corresponding to the `DEPLOYMENT_KEY` *must* have **atleast 5 MATIC** as balance and must hold a few **NHT tokens**
#### Config files :  


- `scripts/config/contracts.config.json` contains all *verified* smart contract address across network.
- Contracts include DISpair contracts, orderbook and arbitrage contracts.
```sh
{
  "mumbai": {
    "orderbook": {
      "address": "0x067a07b7e27917281bdefb6c99267f215d5b81a0",
      "transaction": "0x7eae8a6e95f4609329aa02ba66b7c9191a99c5f7463900657391dc88890dc045"
    },
    "zeroexorderbookimplmentation": {
      "address": "0xabfac36e7220e003b3ad5097441a798da0302d90",
      "transaction": "0x24a9fc4e3d0b4701ca3401fa0aa509c81046de22870cbe46b3ea5d2da317e098"
    }
  }
}
``` 
- `scripts/config/tokens.config.json` contains any ERC20 tokens related details across chains. 
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
#### Deploying Contracts 
The script clones the contract deployed on one network to another. 
Arguments to run the script are : 
- `--from, -f <network name>` : Network name of originating network. Any of ["mumbai","sepolia","polygon"]. Usally this will be a test network.
- `--to, -t <network name>` : Network name of target network where new contract is to be deployed.Any of ["mumbai","sepolia","polygon"]. Usally this will be a main network for a chain.
- `--counterparty, -c <address>` : Conterparty address (public key) used for the startegy.
 
To deploy contracts **run** the following command in shell from the **root of the project**.
```sh
ts-node scripts/deployContracts.ts --from <origin-network-name> --to <target-network-name> --counterparty <counterparty-address>
``` 
Wait for all the contracts to be deployed and verified . 

#### Deploying Startegy. 
To deploy strategy make sure that Orderbook and ZeroEx contracts are deployed on target network and corresponding address are updated in `scripts/config/contracts.config.json` . 
Also make sure that all the necessary ERC20 token details on the target network required for the strategy are updated in `scripts/config/tokens.config.json` 

To deploy startegy **run** the following command in your shell from the **root of the project** : 
```sh
ts-node scripts/deployStrategy.ts --to <taget-network-name>
``` 
where arguments for the script are : 
- `--to, -t <taget-network-name>` : Target network to deploy startegy to. 

Wait for the transaction to be confirmed.  

You'll notice after transaction is confirmed that the order details are updated in the `scripts/DeployStrategy/orderDetails.json` file which will be used to deposit tokens.

#### Depositing NHT Tokens into vault.  

Deposit some tokens into the vault. First make sure that the wallet has enough number of tokens you want to deposit

To deposit tokens run the following command in your shell from the **root of the project**

```sh
ts-node scripts/depositAmount.ts --to <target-network-name> --amount <NHT-Amount>
``` 
where arguments for the script are : 
- `--to, -t <taget-network-name>` : Target network. 
-  `--amount, -a <token-amount>` : Amount of tokens to deposit. Eg : To deposit 5.2 NHT this vaslue will be 5.2 . 

Wait for the transaction to be confirmed. 







