import config from "../v3-config.json"; 


const TRANCHE_STRAT_CALCULATE_BATCH =
// Usdt18 Amount
    "usdt18-amount: ,"+
    // Total Usdt18 Key
    "total-usdt18-k: hash(context<1 0>()),"+
    // Amount Per Batch
    "amount-per-batch: 1000e18,"+
    // New total amount
    "new-total-usdt18-amount: decimal18-add(get(total-usdt18-k) usdt18-amount),"+
    // Batch Index is the floor of the div
    "new-batch-index: int-div(new-total-usdt18-amount amount-per-batch),"+
    // Remaining batch amount
    "new-batch-remaining: decimal18-sub(int-mul(int-add(new-batch-index 1) amount-per-batch) new-total-usdt18-amount);";

const TRANCHE_STRAT_HANDLE_IO =
    // Batch Info Key.
        "batch-start-info-k : context<1 0>(),"+
        // Total Usdt18 Tracked Key
        "total-usdt18-k : hash(batch-start-info-k),"+
        // New Total Usdt18
        "new-total-usdt18 new-batch-index _: call<2 3>(decimal18-scale18<6>(usdt-amount-diff)),"+
        // Get Batch Info
        "batch-start-info: get(batch-start-info-k),"+
        // Get Batch Start Index from Batch Info.
        "batch-start-index: bitwise-decode<0 32>(batch-start-info),"+
        // Get Batch Start Time from Batch Info.
        "batch-start-time: bitwise-decode<32 32>(batch-start-info),"+
        // If we are in new Batch, record current time as batch start time.
        "new-batch-info : if(greater-than(new-batch-index batch-start-index) bitwise-encode<32 32>(block-timestamp() bitwise-encode<0 32>(new-batch-index 0)) batch-start-info),"+
        // Set Batch Info.
        ":set(batch-start-info-k new-batch-info),"+
        // Set Total Usdt18 
        ":set(total-usdt18-k new-total-usdt18);";

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

    const TRANCHE_STRAT_HANDLE_IO_SELL_USDT_IN =
    // Input USDT Amount.
    "usdt-amount-diff : context<3 4>(),";
    return getLimitOrderPrelude(network) + TRANCHE_STRAT_CALCULATE_IO_SELL + TRANCHE_STRAT_HANDLE_IO_SELL_USDT_IN + TRANCHE_STRAT_HANDLE_IO + TRANCHE_STRAT_CALCULATE_BATCH


}

export const getBuyLimitOrder = (network,buyRatio) => {

    const TRANCHE_STRAT_CALCULATE_IO_BUY =
    // Calcuate Ratio from initial ratio and batch index.
    `io-ratio: decimal18-mul(${buyRatio} decimal18-power-int(101e16 batch-index)),` +
    // Calculate Amount from Ratio.
    "amount: batch-remaining," +
    // Order Ratio
    "ratio: io-ratio;";

    const TRANCHE_STRAT_HANDLE_IO_BUY_USDT_OUT =
    // Output USDT Amount.
    "usdt-amount-diff : context<4 4>(),";

    
    return getLimitOrderPrelude(network) + TRANCHE_STRAT_CALCULATE_IO_BUY + TRANCHE_STRAT_HANDLE_IO_BUY_USDT_OUT + TRANCHE_STRAT_HANDLE_IO + TRANCHE_STRAT_CALCULATE_BATCH


}