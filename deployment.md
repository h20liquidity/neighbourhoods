### Deployment process

- Update env 
```sh
# Public key of the bot wallet.
BOT_ADDRESS="0xf098172786a87FA7426eA811Ff25D31D599f766D" 
```
- Update dependencies
```
npm install
```
- Deploy Updated contracts
```sh 
ts-node scripts-v3/deployContracts.ts --from mumbai --to polygon 
``` 
- Deploy Binomial Strategies Strats
```sh
ts-node scripts-v3/deployStrategyNP.ts --to polygon
```
- Fund the strategies.
```sh
ts-node scripts-v3/deposit.ts --to polygon --token NHT --vault {vault} --amount 500000
```
```sh
ts-node scripts-v3/deposit.ts --to polygon --token USDT --vault {vault} --amount 300
```
- Get the Bot and sg Up
- Deploy Limit Orders
```sh
ts-node scripts-v3/deployLimitOrders.ts --to polygon -s 50e13 -b 2000e18 
```
- Fund the strategies.
```sh
ts-node scripts-v3/deposit.ts --to polygon --token NHT --vault {vault} --amount 1500000
```
```sh
ts-node scripts-v3/deposit.ts --to polygon --token USDT --vault {vault} --amount 550