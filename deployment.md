### Deployment process

- Update env 
```sh
# Public key of the bot wallet.
BOT_ADDRESS="0xf098172786a87FA7426eA811Ff25D31D599f766D" 
 ```
- Withdraw funds from older contracts 
```sh 
ts-node scripts-v3/withdraw.ts --from polygon --token USDT --vault 0x422b5afd1b3c468bb46ac91d3bd090dbdf3e67cc2696a627ebfc88b18f1f4952 --amount 50 
``` 
```sh 
ts-node scripts-v3/withdraw.ts --from polygon --token NHT --vault 0x422b5afd1b3c468bb46ac91d3bd090dbdf3e67cc2696a627ebfc88b18f1f4952 --amount 532499.079846955074361473  
``` 

- Deploy Updated contracts
```sh 
ts-node scripts-v3/deployContracts.ts --from mumbai --to polygon 
``` 
- Deploy Strats
```sh
ts-node scripts-v3/deployStrategyNP.ts --to polygon
```
- Fund the strategies.
```sh
ts-node scripts-v3/deposit.ts --to polygon --token NHT --vault {vault} --amount 1000000
```
```sh
ts-node scripts-v3/deposit.ts --to polygon --token USDT --vault {vault} --amount 100
```