// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

uint256 constant ORDER_INIT_RATIO = 25e13;
uint256 constant AMOUNT_PER_BATCH = 1000e18;
uint256 constant COOLDOWN = 3600;
uint256 constant INCR_PER_BATCH = 101e16;

bytes constant TRANCHE_STRAT_CALCULATE_IO =
// Address of the Arb Contract.
    "allowed-counterparty : 0xb4ffa641e5dA49F7466142E8418622CB64dBe86B,"
    // Actual counterparty.
    "actual-counterparty : context<1 2>(),"
    // Check counterparty.
    ":ensure<0>(equal-to(allowed-counterparty actual-counterparty)),"
    // Batch Info Key.
    "batch-start-info-k : context<1 0>(),"
    // Batch Info.
    "batch-start-info: get(batch-start-info-k),"
    // Batch Start Time.
    "batch-start-time: bitwise-decode<32 32>(batch-start-info),"
    // Ensure 1 hr Cooldown between Batches.
    ":ensure<1>(greater-than(block-timestamp() int-add(batch-start-time 3600))),"
    // Current Batch Index and Remaining Amount.
    "batch-index batch-remaining: call<2 2>(0),"
    // Calcuate Ratio from initial ratio and batch index.
    "io-ratio: decimal18-mul(25e13 decimal18-power-int(101e16 batch-index)),"
    // Calculate Amount from Ratio.
    "amount: decimal18-div(batch-remaining io-ratio),"
    // Order Ratio
    "ratio: io-ratio;";

bytes constant TRANCHE_STRAT_HANDLE_IO_SELL =
    // Batch Info Key.
    "batch-start-info-k : context<1 0>(),"
    // Total Amount Received Key
    "total-received-k : hash(batch-start-info-k),"
    // Input Amount received.
    "in-token-amount : context<3 4>(),"
    // Input Token decimals.
    "in-token-decimals: context<3 1>(),"
    // New Total Amount Received
    "new-total-received new-batch-index _: call<2 3>(decimal18-scale18-dynamic<0 1>(in-token-decimals in-token-amount)),"
    // Store Batch Info
    "batch-start-info: get(batch-start-info-k)," "batch-start-index: bitwise-decode<0 32>(batch-start-info),"
    "batch-start-time: bitwise-decode<32 32>(batch-start-info),"
    // If we are in new Batch, record current time as batch start time.
    "new-batch-info : if(greater-than(new-batch-index batch-start-index) bitwise-encode<32 32>(block-timestamp() bitwise-encode<0 32>(new-batch-index 0)) batch-start-info),"
    // Set Batch Info.
    ":set(batch-start-info-k new-batch-info),"
    // Set Total Amount received.
    ":set(total-received-k new-total-received);";

bytes constant TRANCHE_STRAT_HANDLE_IO_BUY =
    // Batch Info Key.
    "batch-start-info-k : context<1 0>(),"
    // Total Amount Received Key
    "total-received-k : hash(batch-start-info-k),"
    // NHT Amount received from trade.
    "nht-in-token-amount18 : context<3 4>(),"
    // USDT Token decimals.
    "usdt-token-decimals: context<4 1>(),"
    //usdt equivalent of nht-in-token-amount18.
    "_ usdt-amount6: uniswap-v2-amount-out<1>(0xc35DADB65012eC5796536bD9864eD8773aBc74C4 nht-in-token-amount18 0x84342e932797FC62814189f01F0Fb05F52519708 0xc2132D05D31c914a87C6611C10748AEb04B58e8F),"
    // New Total Amount Received
    "new-total-received new-batch-index _: call<2 3>(decimal18-scale18-dynamic<0 1>(usdt-token-decimals usdt-amount6)),"
    // Store Batch Info
    "batch-start-info: get(batch-start-info-k)," "batch-start-index: bitwise-decode<0 32>(batch-start-info),"
    "batch-start-time: bitwise-decode<32 32>(batch-start-info),"
    // If we are in new Batch, record current time as batch start time.
    "new-batch-info : if(greater-than(new-batch-index batch-start-index) bitwise-encode<32 32>(block-timestamp() bitwise-encode<0 32>(new-batch-index 0)) batch-start-info),"
    // Set Batch Info.
    ":set(batch-start-info-k new-batch-info),"
    // Set Total Amount received.
    ":set(total-received-k new-total-received);";

bytes constant TRANCHE_STRAT_CALCULATE_BATCH =
// Amount received
    "new-received: ,"
    // Total amount received key
    "total-received-k: hash(context<1 0>()),"
    // Amount Per Batch
    "amount-per-batch: 1000e18,"
    // New total amount
    "new-total-amount-received: int-add(get(total-received-k) new-received),"
    // Batch Index is the floor of the div
    "new-batch-index: int-div(new-total-amount-received amount-per-batch),"
    // Remaining batch amount
    "new-batch-remaining: int-sub(int-mul(int-add(new-batch-index 1) amount-per-batch) new-total-amount-received);";

function rainstringSellLimitOrder() pure returns (bytes memory) {
    return bytes.concat(TRANCHE_STRAT_CALCULATE_IO, TRANCHE_STRAT_HANDLE_IO_SELL, TRANCHE_STRAT_CALCULATE_BATCH);
}

function rainstringBuyLimitOrder() pure returns (bytes memory) {
    return bytes.concat(TRANCHE_STRAT_CALCULATE_IO, TRANCHE_STRAT_HANDLE_IO_BUY, TRANCHE_STRAT_CALCULATE_BATCH);
}
