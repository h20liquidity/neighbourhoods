## Deploying new Neighbourhoods expressions

Goal
- Deploy new strategy to track input tokens received.

Once you have ennvironment setup, follow the steps : 
#### Empty the older vaults
Before we deploy the new strategy, we must first withdraw all tokens from the older vaults. 

This step is crucial and must be ***performed before any other script***

To withdraw from older vaults **run** the following command in shell from the **root of the project**.


```sh
ts-node scripts/1-pilot/emptyVaults.ts --from polygon --contract 0x4a6E9C7B512afcE6544b771EFdCdc384cef8bF9C
```

Where arguments for the script are:

- `--from, -f <network name>` : Network name of originating network. Any of ["mumbai","sepolia","polygon"]. This will be network where previously contract was deployed.
- `--contract, -c <contract address>` : Address of the contract in which tokens were deposited.

#### Deploying Contracts

The script clones the contract deployed on one network to another.

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

Also make sure that all the necessary ERC20 token details on the target network required for the strategy are correct in `config/config.json` itself

To deploy strategy **run** the following command in your shell from the **root of the project** :

```sh
ts-node scripts/1-pilot/deployStrategy.ts --to polygon --ratio 25e13
```

Where arguments for the script are:

- `--to, -t <target-network-name>` : Target network to deploy the strategy to.
- `--ratio -r <value>`  : Ratio value for the startegy represented as exponential notation. Note that ***exponent*** and ***power*** are both ***whole number*** values. Eg  : **25e13** , **1e18** etc.

Wait for the transaction to be confirmed.

You'll notice after transaction is confirmed that the order details are updated in the `scripts/1-pilot/1-orderDetails.json` file which will be used to deposit tokens. 
The deployed order information is also useful for with the bot. You can just copy the entire `scripts/1-pilot/1-orderDetails.json` file and paste it in [orders.json](https://github.com/h20liquidity/zeroex-take-order-bot/blob/master/orders.json) for the bot to pick up. 

#### Depositing Tokens into the vault.

Deposit some tokens into the vault. First make sure that the wallet has a sufficient balance of the tokens you'd like to deposit.

To deposit tokens run the following command in your shell from the **root of the project**

```sh
ts-node scripts/1-pilot/deposit.ts --to polygon --token NHT --amount <NHT-Amount>
```

Where arguments for the script are :

- `--to, -t <taget-network-name>` : Target network.
- `--token, tk <token symbol>` : Symbol of the token to be deposited. Any of ['USDT','NHT']
- `--amount, -a <token-amount>` : Amount of tokens to deposit. Eg : To deposit 5.2 NHT this value will be 5.2. To deposit 3.001 USDT this value will be 3.001 .

Wait for the transaction to be confirmed.The amount will be deposited 

#### Withdraw Tokens from the vault.

Withdrawing tokens that you have deposited.

To withdraw tokens run the following command in your shell from the **root of the project**

```sh
ts-node scripts/1-pilot/withdraw.ts --from polygon --token USDT --amount <USDT-Amount>
```

Where arguments for the script are :

- `--from, -f <network-name>` : Network where strategy is deployed and tokens are deposited
- `--token, tk <token symbol>` : Symbol of the token to be withdrawn. Any of ['USDT','NHT']
- `--amount, -a <token-amount>` : Amount of tokens to withdraw. Eg : To withdraw 5.2 NHT this value will be 5.2 . To withdraw 3.001 USDT this value will be 3.001 .

Wait for the transaction to be confirmed.The amount will be withdrawn.  


