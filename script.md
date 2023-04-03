# Deploying the first Neighbourhoods expressions

## Strategy summary

Goal

- Make tokens available to help mitigate price spikes that hurt retail access
- Sabbatical after inventory allocated to each price point is exhausted to mitigate exposure of the strat itself to sustained (but still temporary) price spikes
- New price after sabbatical is higher than previous price according to growth curve
- Tight access control on counterparty to mitigate regulatory risk
- Onchain strategy for transparency and to mitigate mempool risk

Onchain strategy

- Restrict counterparty to known named address
- Stepwise price function based on batches and % price increase per batch
- Enforce time delay on new batches/price increases
- Always offer a minimum amount to counterparty to avoid dust issues near end of batch
- Batch overflow eats inventory available to next batch

The strategy can be found here:

[0-pilot.rain](/src/0-pilot.rain)

Next step is to prepare to deploy the contracts, strategy and deposit tokens into the vault to get the strategy ready. Final step is set up and deploy the bot that will clear your order periodically.

## Deploying a strategy

As this is the first time you are deploying a strategy with H20 you will need to deploy all of the contracts:

1. Deploy DISpair (Deployer, Interpreter, Store) contracts
2. Deploy Orderbook

Once everything up to the Orderbook is already deployed then you only need to:

1. Deploy the ZeroExArb Contracts
2. Deploy the strategy
3. Deposit $ for the strategy

## Setting up script environment

#### Preparing my environment :

- Assume github desktop is installed locally
- Clone the Neighbourhoods repo, https://github.com/h20liquidity/neighbourhoods

![](https://i.imgur.com/2xVzld5.png)

- Open in Visual Studio
- Open .env.example
- Save file as `.env` (the fullstop means it is hidden it is not designating an extension, you need to name the file exactly as written, .env)

#### Populating .env file:

In order to be able to deploy contracts and expressions, the wallet corresponding to the `DEPLOYMENT_KEY` _must_ have **atleast 5 MATIC** as balance and must hold a few **NHT tokens**

```sh
DEPLOYMENT_KEY = <private-key-of-wallet-to-deploy-from>

ALCHEMY_KEY_MUMBAI =  <alchemy-key-mumbai>
ALCHEMY_KEY_POLYGON = <alchemy-key-polygon-mainnet>

POLYGONSCAN_API_KEY = <polygonscan-api-key>
```

The private key you get from your metamask or other wallet. Please note if you share your private key people can have access to your wallet assets. Your private key will remain on your computer, it will never be uploaded and it can be deleted once your strategy is deployed.

Sign up to Alchemy to get your Mumbai and Polygon mainnet API keys. Any questions follow the Alchemy help. You need to create two apps to get the API keys for both Polygon mainet and mumbai.

https://dashboard.alchemy.com

Sign up to Polygonscan

https://polygonscan.com/

Save the `.env` file and now you are ready to configure the deployment of the contracts.

#### Config files :

We have prepopulated `scripts/config/contracts.config.json`. You can skip this section.

- `scripts/config/contracts.config.json` contains all _verified_ smart contract address across network.
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

#### Entering the environment

There a few steps to undertake before you can run the scripts in this repo.

1. [Install devenv](https://devenv.sh/getting-started/) completing steps a, b,c on this page.
2. Now, whilst at the project root, enter `devenv shell`

#### Deploying Contracts

The script clones the contract deployed on one network to another.

To deploy contracts **run** the following command in shell from the **root of the project**.
Replace <your-public-key> with the public address for the `DEPLOYMENT_KEY` you added to the `.env` file.

```sh
ts-node scripts/deployContracts.ts --from mumbai --to polygon --counterparty <your-public-key>
```

Where arguments for the script are:

- `--from, -f <network name>` : Network name of originating network. Any of ["mumbai","sepolia","polygon"]. Usally this will be a test network.
- `--to, -t <network name>` : Network name of target network where new contract is to be deployed.Any of ["mumbai","sepolia","polygon"]. Usally this will be a main network for a chain.
- `--counterparty, -c <address>` : Conterparty address (public key) used for the strategy.

Wait for all the contracts to be deployed and verified.

#### Deploying Strategy.

Before deploying the strategy, double check that the Orderbook and ZeroEx contracts are deployed on the target network (Polygon mainnet), and the corresponding addresses are updated in `scripts/config/contracts.config.json`.

Also make sure that all the necessary ERC20 token details on the target network required for the strategy are correct in `scripts/config/tokens.config.json`

To deploy strategy **run** the following command in your shell from the **root of the project** :

```sh
ts-node scripts/deployStrategy.ts --to polygon
```

Where arguments for the script are:

- `--to, -t <target-network-name>` : Target network to deploy the strategy to.

Wait for the transaction to be confirmed.

You'll notice after transaction is confirmed that the order details are updated in the `scripts/DeployStrategy/orderDetails.json` file which will be used to deposit tokens.

#### Depositing NHT Tokens into the vault.

Deposit some tokens into the vault. First make sure that the wallet has a sufficient balance of the tokens you'd like to deposit.

To deposit tokens run the following command in your shell from the **root of the project**

```sh
ts-node scripts/depositAmount.ts --to polygon --amount <NHT-Amount>
```

Where arguments for the script are :

- `--to, -t <taget-network-name>` : Target network.
- `--amount, -a <token-amount>` : Amount of tokens to deposit. Eg : To deposit 5.2 NHT this value will be 5.2 .

Wait for the transaction to be confirmed.
