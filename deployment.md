### Deployment process

- Update env 
```sh
# Public key of the bot wallet.
BOT_ADDRESS="0xf098172786a87FA7426eA811Ff25D31D599f766D" 
```
- Fund the ongoing strategy 
Withdraw USDT
```sh
ts-node scripts-v2/withdraw.ts --from polygon --token USDT --vault 0xd9dd4c8f5ac7dd9add98b98882350919b2815eec3994a94509d89cfbf0975703 --amount 1905.679464  
```  
and fund with NHT
```sh
ts-node scripts-v2/deposit.ts --to polygon --token NHT --vault 0xd9dd4c8f5ac7dd9add98b98882350919b2815eec3994a94509d89cfbf0975703 --amount {amount}  
``` 

- Withdraw funds from older contracts 
```sh 
ts-node scripts-np/withdraw.ts --from polygon --token USDT --vault 0x2e1e0c9ff2cb2638fe785e3cb0f777451d701c31f9cc1511815ad1f5577848c4 --amount 100 
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
ts-node scripts-v3/deposit.ts --to polygon --token NHT --vault {vault} --amount {amount}
```