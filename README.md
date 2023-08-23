## Deploying new Neighbourhoods expressions

Goal
- Deploy strategy to track input tokens received with ratio and tranche limit, with new contracts. 
### Setup Environment
- Update all the package dependencies with : 
```sh
npm install 
```
- Create a .env file at the project root and add the following to the file 
``` 
# Unprefixed private Key of the account to deploy from. 
DEPLOYMENT_KEY=  

# Alchmey keys for supported networks.
ALCHEMY_KEY_MUMBAI=
ALCHEMY_KEY_POLYGON=
ALCHEMY_KEY_SEPOLIA= 

# Blockscanner api keys for the supported networks.
POLYGONSCAN_API_KEY=
ETHERSCAN_API_KEY=
SNOWTRACE_KEY= 
```

Once you have ennvironment setup, follow the steps : 
#### Empty the older vaults
Before we deploy the new strategy, we must first withdraw all tokens from the older vaults. 

This step is crucial and must be ***performed before any other script***

To withdraw from older vaults **run** the following command in shell from the **root of the project**.


```sh
ts-node scripts/1-pilot/emptyVaults.ts --from polygon --contract 0xdd42ed000da6716044db223a0f9e6f02e6c86af3 --vault 0x6e844f3117659a033e3666d07f76a335ba8f104cbaa9d969443c8c54ae1b0fe3
```

Where arguments for the script are:

- `--from, -f <network name>` : Network name of originating network. Any of ["mumbai","sepolia","polygon"]. This will be network where previously contract was deployed.
- `--contract, -c <contract address>` : Address of the contract in which tokens were deposited.
- `--vault` : `0x` prefixed hexadecimal string representing the vault id of the previously deposited vault. 

#### Deploying Contracts

The script clones the contract deployed on one network to another. 

Before we deploy the contracts make sure that correct counterparty address is set in the `src/0-arb.rain` under the `allowed-counterparty` 
- The `allowed-counterparty` will be the public key of the bot wallet . 
```sh
/*refuse any counterparties other than named . This will be the public key of the bot wallet.*/
allowed-counterparty: 0x669845c29D9B1A64FFF66a55aA13EB4adB889a88,
```

To deploy contracts **run** the following command in shell from the **root of the project**.

```sh
ts-node scripts/1-pilot/deployContracts.ts --from mumbai --to polygon
```
Where arguments for the script are:

- `--from, -f <network name>` : Network name of originating network. Any of ["mumbai","sepolia","polygon"]. Usally this will be a test network.
- `--to, -t <network name>` : Network name of target network where new contract is to be deployed.Any of ["mumbai","sepolia","polygon"]. Usally this will be a main network for a chain.

Wait for all the contracts to be deployed and verified.

#### Deploying Strategy.

Before deploying the strategy, double check that the Orderbook and ZeroEx contracts are deployed on the target network (Polygon mainnet), and the corresponding addresses are updated in `config/config.json`.

Make sure that the correct counterparty address and ratio are set in the `src/2-price-update.rain`. 
- The `allowed-counterparty` will be the `zeroexorderbookinstance` address from the `config/config.json` under `polygon` network
- The ratio will be `29e13` or any value you may desire. 

Eg : 
```sh
/* refuse any counterparties other than named . This will be the arb contract instance address. */
allowed-counterparty: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC, 
...
/*
 * Exponential growth
 * A * (1 + r)^x
 * A = initial ratio
 * r = % increase per batch
 * x = batch index
 */
io-ratio: decimal18-mul(29e13 decimal18-pow-int(101e16 batch-index)), 
```
Also make sure that all the necessary ERC20 token details on the target network required for the strategy are correct in `config/config.json` itself

To deploy strategy **run** the following command in your shell from the **root of the project** :

```sh
ts-node scripts/1-pilot/deployStrategy.ts --to polygon
```

Where arguments for the script are:

- `--to, -t <target-network-name>` : Target network to deploy the strategy to.

Wait for the transaction to be confirmed. 

The output of the command will look something like this : 
```
Deploying Strategy...
arbCounterParty:  0x9cabd90cfd5d412721430063dce2ceb22979983e
Startegy Deployed At : 0xef3dc1e83ba028aabeca113bb72627334fb64567711c03e5dbcfaa7b180c8aea
Vault ID used for the startegy : 0x9175171f28aa16609440288de87afaa283c5528fe18c339f58a67ebef74042fd
Use the above vault id to deposit and withdraw from the strategy 
```
- You will notice that a vault id is generated for the strategy. **Every strategy has unique vault ids associated with them**, so that they can function separately of each other. The output vault id from : 
```
Vault ID used for the startegy : 0x9175171f28aa16609440288de87afaa283c5528fe18c339f58a67ebef74042fd` 
``` 
will be used to deposit to this strategy and withdraw from it. 
- You'll notice after transaction is confirmed that the order details are updated in the `scripts/1-pilot/1-orderDetails.json` file which will be used to deposit tokens. 
- The deployed order information is also useful for with the bot. You can just copy the entire `scripts/1-pilot/1-orderDetails.json` file and paste it in [orders.json](https://github.com/h20liquidity/zeroex-take-order-bot/blob/master/orders.json) for the bot to pick up. 

#### Depositing Tokens into the vault.

Deposit some tokens into the vault. First make sure that the wallet has a sufficient balance of the tokens you'd like to deposit.

To deposit tokens run the following command in your shell from the **root of the project**

```sh
ts-node scripts/1-pilot/deposit.ts --to polygon --token NHT --amount <NHT-Amount> --vault <hex-string>
```

Where arguments for the script are :

- `--to, -t <taget-network-name>` : Target network.
- `--token, tk <token symbol>` : Symbol of the token to be deposited. Any of ['USDT','NHT']
- `--amount, -a <token-amount>` : Amount of tokens to deposit. Eg : To deposit 5.2 NHT this value will be 5.2. To deposit 3.001 USDT this value will be 3.001 . 
- `--vault` : Hexadeciaml string representing the vault id to deposit. 

Wait for the transaction to be confirmed.The amount will be deposited 

#### Withdraw Tokens from the vault.

Withdrawing tokens that you have deposited.

To withdraw tokens run the following command in your shell from the **root of the project**

```sh
ts-node scripts/1-pilot/withdraw.ts --from polygon --token USDT --amount <USDT-Amount> --vault <hex-string>
```

Where arguments for the script are :

- `--from, -f <network-name>` : Network where strategy is deployed and tokens are deposited
- `--token, tk <token symbol>` : Symbol of the token to be withdrawn. Any of ['USDT','NHT']
- `--amount, -a <token-amount>` : Amount of tokens to withdraw. Eg : To withdraw 5.2 NHT this value will be 5.2 . To withdraw 3.001 USDT this value will be 3.001 .
- `--vault` : Hexadeciaml string representing the vault id to withdraw from. 

Wait for the transaction to be confirmed.The amount will be withdrawn.  

#### Removing an Order : 
- To deactivate an order from the orderbook you can run the following command : 
```sh
ts-node scripts/1-pilot/removeOrder.ts --from <network> --tx-hash <transaction-hash>
``` 
where : 
- `--from, -f <network-name>` : Network where order was deployed.
- `--tx-hash` : Transaction hash of the order. 
Wait for the transaction to be confirmed. The order will be removed from the orderbook. 


