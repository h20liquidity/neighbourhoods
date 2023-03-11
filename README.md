# neighbourhoods

## 0. pilot

Goal

- Make tokens available to help mitigate price spikes that hurt retail access
- Sabbatical after inventory allocated to each price point is exhausted to
  mitigate exposure of the strat itself to sustained (but still temporary) price
  spikes
- New price after sabbatical is higher than previous price according to growth
  curve
- Tight access control on counterparty to mitigate regulatory risk
- Onchain strategy for transparency and to mitigate mempool risk

Onchain strategy

- Restrict counterparty to known named address
- Stepwise price function based on batches and % price increase per batch
- Enforce time delay on new batches/price increases
- Always offer a minimum amount to counterparty to avoid dust issues near end of batch
    - Batch overflow eats inventory available to next batch
