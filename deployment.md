### Deployment process

- Update env 
```sh
# Public key of the bot wallet.
BOT_ADDRESS="0xf098172786a87FA7426eA811Ff25D31D599f766D" 
```
- Remove current orders
```sh
npx ts-node scripts-v3/removeOrder.ts --from polygon --tx-hash 0x6c9554841a0408f322195471d20bbf3e4966480c199203596946ac0f6b2cffb6
```
```sh
npx ts-node scripts-v3/removeOrder.ts --from polygon --tx-hash 0x264eaad41d60b2e3567969f633967d7c9534f429481d1d350cbfef3f1e893458
```
```sh
npx ts-node scripts-v3/removeOrder.ts --from polygon --tx-hash 0x8d2dc6e32cc201d983c83e24328c610feccfe51674743822fe721f71aa1f4bf2
```
```sh
npx ts-node scripts-v3/removeOrder.ts --from polygon --tx-hash 0x470130cf72761778fbd0951364cb4c02396fccd514021d6024ab93ba3e1a2fbf
```
- Withdraw from vaults
```sh
npx ts-node scripts-v3/removeOrder.ts --from polygon --token NHT --vault 0xd6e7c8f779cce6c489b1deffa0d3024e4e2257d8fb0c45a945ca4b00e838e8f8 --amount {amount}
```
```sh
npx ts-node scripts-v3/removeOrder.ts --from polygon --token USDT --vault 0xd6e7c8f779cce6c489b1deffa0d3024e4e2257d8fb0c45a945ca4b00e838e8f8 --amount {amount}
```
```sh
npx ts-node scripts-v3/removeOrder.ts --from polygon --token USDT --vault 0xb5c2e4ab8e4e8e139181dcd68c106f1601b8d3dc584765da2e8764c28719fe97 --amount {amount}
```
```sh
npx ts-node scripts-v3/removeOrder.ts --from polygon --token USDT --vault 0xb5c2e4ab8e4e8e139181dcd68c106f1601b8d3dc584765da2e8764c28719fe97 --amount {amount}
```
- Deploy Vol strat
```sh
npx ts-node scripts-v3/deployStrategyNP.ts --to polygon --vault 12345
```
- Deposit Balance
```sh
npx ts-node scripts-v3/deposit.ts --to polygon --token NHT --amount <NHT-Amount> --vault <hex-string>
```
```sh
npx ts-node scripts-v3/deposit.ts --to polygon --token USDT --amount <USDT-Amount> --vault <hex-string>
```