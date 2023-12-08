import config from "../v3-config.json"; 


const TRANCHE_STRAT_CALCULATE_BATCH =
// Amount received
    "new-received: ,"+
    // Total amount received key
    "total-received-k: hash(context<1 0>()),"+
    // Amount Per Batch
    "amount-per-batch: 100e18,"+
    // New total amount
    "new-total-amount-received: int-add(get(total-received-k) new-received),"+
    // Batch Index is the floor of the div
    "new-batch-index: int-div(new-total-amount-received amount-per-batch),"+
    // Remaining batch amount
    "new-batch-remaining: int-sub(int-mul(int-add(new-batch-index 1) amount-per-batch) new-total-amount-received);";

export const getLimitOrderPrelude = (network) => {

    const RouteProcessorOrder = config.contracts[network].RouteProcessorOrderBookV3ArbOrderTakerInstance.address  

    const PRELUDE =
    // Address of the Arb Contract.
    `allowed-counterparty : ${RouteProcessorOrder},`+
    // Actual counterparty.
    "actual-counterparty : context<1 2>(),"+
    // Check counterparty.
    ":ensure<0>(equal-to(allowed-counterparty actual-counterparty)),"+
    // Batch Info Key.
    "batch-start-info-k : context<1 0>(),"+
    // Batch Info.
    "batch-start-info: get(batch-start-info-k),"+
    // Batch Start Time.
    "batch-start-time: bitwise-decode<32 32>(batch-start-info),"+
    // Ensure 1 hr Cooldown between Batches.
    ":ensure<1>(greater-than(block-timestamp() int-add(batch-start-time 300))),"+
    // Current Batch Index and Remaining Amount.
    "batch-index batch-remaining: call<2 2>(0),"; 

    return PRELUDE
    
} 

export const getSellLimitOrder = (network,sellRatio) => {

    const TRANCHE_STRAT_CALCULATE_IO_SELL =
    // Calcuate Ratio from initial ratio and batch index.
    `io-ratio: decimal18-mul(${sellRatio} decimal18-power-int(101e16 batch-index)),`+
    // Calculate Amount from Ratio.
    "amount: decimal18-div(batch-remaining io-ratio),"+
    // Order Ratio
    "ratio: io-ratio;"; 

    const TRANCHE_STRAT_HANDLE_IO_SELL =
    // Batch Info Key.
    "batch-start-info-k : context<1 0>(),"+
    // Total Amount Received Key
    "total-received-k : hash(batch-start-info-k),"+
    // Input Amount received.
    "usdt-in-amount : context<3 4>(),"+
    // New Total Amount Received
    "new-total-received new-batch-index _: call<2 3>(decimal18-scale18<6>(usdt-in-amount)),"+
    // Store Batch Info
    "batch-start-info: get(batch-start-info-k)," + "batch-start-index: bitwise-decode<0 32>(batch-start-info),"+
    "batch-start-time: bitwise-decode<32 32>(batch-start-info),"+
    // If we are in new Batch, record current time as batch start time.
    "new-batch-info : if(greater-than(new-batch-index batch-start-index) bitwise-encode<32 32>(block-timestamp() bitwise-encode<0 32>(new-batch-index 0)) batch-start-info),"+
    // Set Batch Info.
    ":set(batch-start-info-k new-batch-info),"+
    // Set Total Amount received.
    ":set(total-received-k new-total-received);"; 

    return getLimitOrderPrelude(network) + TRANCHE_STRAT_CALCULATE_IO_SELL + TRANCHE_STRAT_HANDLE_IO_SELL + TRANCHE_STRAT_CALCULATE_BATCH


}

export const getBuyLimitOrder = (network,buyRatio) => {

    const TRANCHE_STRAT_CALCULATE_IO_BUY =
    // Calcuate Ratio from initial ratio and batch index.
    `io-ratio: decimal18-mul(${buyRatio} decimal18-power-int(101e16 batch-index)),` +
    // Calculate Amount from Ratio.
    "amount: batch-remaining," +
    // Order Ratio
    "ratio: io-ratio;";

    const TRANCHE_STRAT_HANDLE_IO_BUY =
    // Batch Info Key.
    "batch-start-info-k : context<1 0>(),"+
    // Total Amount Received Key
    "total-received-k : hash(batch-start-info-k),"+
    // NHT Amount received from trade.
    "nht-in-amount : context<3 4>(),"+
    // Get current ratio from context
    "io-ratio: context<2 1>(),"+
    //usdt equivalent of nht-in-token-amount18.
    "usdt-out-amount18: decimal18-div(nht-in-amount io-ratio),"+
    // New Total Amount Received
    "new-total-received new-batch-index _: call<2 3>(usdt-out-amount18),"+
    // Store Batch Info
    "batch-start-info: get(batch-start-info-k),"+ "batch-start-index: bitwise-decode<0 32>(batch-start-info),"+
    "batch-start-time: bitwise-decode<32 32>(batch-start-info),"+
    // If we are in new Batch, record current time as batch start time.
    "new-batch-info : if(greater-than(new-batch-index batch-start-index) bitwise-encode<32 32>(block-timestamp() bitwise-encode<0 32>(new-batch-index 0)) batch-start-info),"+
    // Set Batch Info.
    ":set(batch-start-info-k new-batch-info),"+
    // Set Total Amount received.
    ":set(total-received-k new-total-received);";

    
    return getLimitOrderPrelude(network) + TRANCHE_STRAT_CALCULATE_IO_BUY + TRANCHE_STRAT_HANDLE_IO_BUY + TRANCHE_STRAT_CALCULATE_BATCH


}