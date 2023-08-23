## Deploying new Neighbourhoods expressions
Goal
- Deploy strategy to periodically buy and sell NHT <-> USDT tokens. 
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

#### Deploying Contracts (with Native Parser).

The script clones the contract deployed on one network to another. 

Before we deploy the contracts make sure that correct counterparty address is set in the `src/3-sushi-v2-arb.ts` under the `allowed-counterparty` 
- The `allowed-counterparty` will be the public key of the bot wallet . 
```sh
// Refuse any counterparties other than named . This will be the public key of the bot wallet.
"allowed-counterparty: 0x669845c29D9B1A64FFF66a55aA13EB4adB889a88,"+
":ensure(equal-to(allowed-counterparty context<0 0>()))"+
";"
```

To deploy contracts **run** the following command in shell from the **root of the project**.

```sh
ts-node scripts-np/deployContracts.ts --from mumbai --to polygon
```
Where arguments for the script are:

- `--from, -f <network name>` : Network name of originating network. Any of ["mumbai","sepolia","polygon"]. Usally this will be a test network.
- `--to, -t <network name>` : Network name of target network where new contract is to be deployed.Any of ["mumbai","sepolia","polygon"]. Usally this will be a main network for a chain.

Wait for all the contracts to be deployed and verified.

#### Deploying Strategy.

Before deploying the strategy, double check that the Orderbook and ZeroEx contracts are deployed on the target network (Polygon mainnet), and the corresponding addresses are updated in `scripts-np/np-config.json`.

Make sure that the correct **approved-counterparty** addresses are set in `src/3-sushi-v2-sell-strat.ts` and `src/3-sushi-v2-buy-strat.ts`. 
- The `approved-counterparty` will be the `zeroexorderbookinstance` address from the `scripts-np/np-config.json` under `polygon` network

For Eg : 
```sh
export const RAINSTRING_BUY_NHT = 
.
.
// String version of approved counterparty.
"approved-counterparty: 0x1F8Cd7FB14b6930665EaaA5F5C71b9e7396df036," +
.
.
```
and 
```sh
export const RAINSTRING_SELL_NHT = 
.
.
// String version of approved counterparty.
"approved-counterparty: 0x1F8Cd7FB14b6930665EaaA5F5C71b9e7396df036," +
.
.
```
Also make sure that all the necessary ERC20 token details on the target network required for the strategy are correct in `scripts-np/np-config.json` itself

To deploy strategy **run** the following command in your shell from the **root of the project** :

```sh
ts-node scripts-np/deployStrategyNP.ts --to polygon 
```

Where arguments for the script are:

- `--to, -t <target-network-name>` : Target network to deploy the strategy to.

Wait for the transaction to be confirmed. 

The output of the command will look something like this : 
```
Deploying Sushi Sell Strategy with Native Parser...

--------------------------------
✅ Sell Startegy Deployed At : 0xf2a80849a9f2bc6f0d51836362e28e1aeb6be49e7bdec643ae2cf8485734fa44
Vault ID used for the startegy : 0x2a5f8b466dd8f158bc5c502d9ed427eec79977b881ccbf5a5ed42d056a369423
Use the above vault id to deposit and withdraw from the strategy
--------------------------------

Deploying Sushi Buy Strategy with Native Parser...

--------------------------------
✅ Buy Startegy Deployed At : 0x163aab2be9b6a9b91689d449457cb2d09e90dafc98954b40aa3a4731138f8ecc
Vault ID used for the startegy : 0x2a5f8b466dd8f158bc5c502d9ed427eec79977b881ccbf5a5ed42d056a369423
Use the above vault id to deposit and withdraw from the strategy
--------------------------------
```
- You will notice that a vault id is generated for the strategy. Here both strategies have the same vault Id.
```
Vault ID used for the startegy : 0x2a5f8b466dd8f158bc5c502d9ed427eec79977b881ccbf5a5ed42d056a369423` 
``` 
This vault id will be used to deposit to the strategies and withdraw from it. 

#### Depositing Tokens into the vault.

Deposit some tokens into the vault. First make sure that the wallet has a sufficient balance of the tokens you'd like to deposit.

To deposit tokens run the following command in your shell from the **root of the project**

```sh
ts-node scripts-np/deposit.ts --to polygon --token NHT --amount <NHT-Amount> --vault <hex-string>
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
ts-node scripts-np/withdraw.ts --from polygon --token USDT --amount <USDT-Amount> --vault <hex-string>
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
 ts-node scripts-np/removeOrder.ts --from <network> --tx-hash <transaction-hash>
``` 
where : 
- `--from, -f <network-name>` : Network where order was deployed.
- `--tx-hash` : Transaction hash of the order. 
Wait for the transaction to be confirmed. The order will be removed from the orderbook. 


