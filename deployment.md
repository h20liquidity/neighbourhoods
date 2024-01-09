### Deployment process

- Update env

```sh
# Public key of the bot wallet.
BOT_ADDRESS="0xf098172786a87FA7426eA811Ff25D31D599f766D"
```

- Remove current orders

```sh
npx ts-node scripts-v3/removeOrder.ts --from polygon --tx-hash 0x470130cf72761778fbd0951364cb4c02396fccd514021d6024ab93ba3e1a2fbf
```

```sh
npx ts-node scripts-v3/removeOrder.ts --from polygon --tx-hash 0x6c9554841a0408f322195471d20bbf3e4966480c199203596946ac0f6b2cffb6
```

- Deploy Vol strat

```sh
npx ts-node scripts-v3/deployStrategyNP.ts --to polygon --vault 97204478289986077644747815930608604952029942062719168778478718085404963694840
```
