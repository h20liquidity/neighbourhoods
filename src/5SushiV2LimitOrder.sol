// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import {IRouteProcessor} from "src/interface/IRouteProcessor.sol";
import {APPROVED_COUNTERPARTY} from "src/4SushiV2StratBinomial.sol";

/// @dev https://polygonscan.com/address/0x0a6e511Fe663827b9cA7e2D2542b20B37fC217A6
IRouteProcessor constant ROUTE_PROCESSOR = IRouteProcessor(address(0x0a6e511Fe663827b9cA7e2D2542b20B37fC217A6));

/// @dev Initial Sell Limit.
uint256 constant ORDER_INIT_RATIO_SELL = 50e13;

/// @dev Initial Buy Limit = 1 / ORDER_INIT_RATIO_SELL
uint256 constant ORDER_INIT_RATIO_BUY = 2000e18;

/// @dev Amount per tranche 100 USDT FP denomiated.
uint256 constant AMOUNT_PER_BATCH = 100e18;

/// @dev Cooldown 5 minutes.
uint256 constant COOLDOWN = 300;

/// @dev Increment of 1% per tranche
uint256 constant INCR_PER_BATCH = 101e16;

bytes constant PRELUDE =
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
    // Ensure 5 mins Cooldown between Batches.
    ":ensure<1>(greater-than(block-timestamp() int-add(batch-start-time 300))),"
    // Current Batch Index and Remaining Amount.
    "batch-index batch-remaining: call<2 2>(0),";

bytes constant TRANCHE_STRAT_CALCULATE_IO_SELL =
// Calcuate Ratio from initial ratio and batch index.
    "io-ratio: decimal18-mul(50e13 decimal18-power-int(101e16 batch-index)),"
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
    "usdt-in-amount : context<3 4>(),"
    // New Total Amount Received
    "new-total-received new-batch-index _: call<2 3>(decimal18-scale18<6>(usdt-in-amount)),"
    // Store Batch Info
    "batch-start-info: get(batch-start-info-k)," "batch-start-index: bitwise-decode<0 32>(batch-start-info),"
    "batch-start-time: bitwise-decode<32 32>(batch-start-info),"
    // If we are in new Batch, record current time as batch start time.
    "new-batch-info : if(greater-than(new-batch-index batch-start-index) bitwise-encode<32 32>(block-timestamp() bitwise-encode<0 32>(new-batch-index 0)) batch-start-info),"
    // Set Batch Info.
    ":set(batch-start-info-k new-batch-info),"
    // Set Total Amount received.
    ":set(total-received-k new-total-received);";

bytes constant TRANCHE_STRAT_CALCULATE_IO_BUY =
// Calcuate Ratio from initial ratio and batch index.
    "io-ratio: decimal18-mul(2000e18 decimal18-power-int(101e16 batch-index)),"
    // Calculate Amount from Ratio.
    "amount: batch-remaining,"
    // Order Ratio
    "ratio: io-ratio;";

bytes constant TRANCHE_STRAT_HANDLE_IO_BUY =
// Batch Info Key.
    "batch-start-info-k : context<1 0>(),"
    // Total Amount Received Key
    "total-received-k : hash(batch-start-info-k),"
    // NHT Amount received from trade.
    "nht-in-amount : context<3 4>(),"
    // Get current ratio from context
    "io-ratio: context<2 1>(),"
    //usdt equivalent of nht-in-token-amount18.
    "usdt-out-amount18: decimal18-div(nht-in-amount io-ratio),"
    // New Total Amount Received
    "new-total-received new-batch-index _: call<2 3>(usdt-out-amount18),"
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
    "amount-per-batch: 100e18,"
    // New total amount
    "new-total-amount-received: decimal18-add(get(total-received-k) new-received),"
    // Batch Index is the floor of the div
    "new-batch-index: int-div(new-total-amount-received amount-per-batch),"
    // Remaining batch amount
    "new-batch-remaining: decimal18-sub(int-mul(int-add(new-batch-index 1) amount-per-batch) new-total-amount-received);";

function rainstringSellLimitOrder() pure returns (bytes memory) {
    return bytes.concat(
        PRELUDE, TRANCHE_STRAT_CALCULATE_IO_SELL, TRANCHE_STRAT_HANDLE_IO_SELL, TRANCHE_STRAT_CALCULATE_BATCH
    );
}

bytes constant EXPECTED_SELL_LIMIT_BYTECODE =
    hex"030000007400ec1c0a000a010000000a00020100000001000000001a020000190100000a00000100000002340100000000000305012020010000010000000428020000160000001c0200001901000101000002090102020000000501000004240200000100000323020000000000070000000622020000000000071d0d000a0a000001000000000b0100000a00040300000002260100060901030200000000340100000000000605012000000000060501202000000006010000020000000406022000160000000602202000000007000000041c0200001e030000000000090000000035020000000000030000000135020000110901060a0000010b010000010000050000000000000001340100002802000000000002000000032a02000000000003000000020100000600000004280200003102000032020000";

function expectedLimitOrderSellConstants() pure returns (uint256[] memory constants) {
    constants = new uint256[](7);
    constants[0] = uint256(uint160(APPROVED_COUNTERPARTY));
    constants[1] = COOLDOWN;
    constants[2] = 0;
    constants[3] = ORDER_INIT_RATIO_SELL;
    constants[4] = INCR_PER_BATCH;
    constants[5] = AMOUNT_PER_BATCH;
    constants[6] = 1;
}

function rainstringBuyLimitOrder() pure returns (bytes memory) {
    return bytes.concat(
        PRELUDE, TRANCHE_STRAT_CALCULATE_IO_BUY, TRANCHE_STRAT_HANDLE_IO_BUY, TRANCHE_STRAT_CALCULATE_BATCH
    );
}

bytes constant EXPECTED_BUY_LIMIT_BYTECODE =
    hex"030000006c00f01a0a000a010000000a00020100000001000000001a020000190100000a00000100000002340100000000000305012020010000010000000428020000160000001c02000019010001010000020901020200000005010000042402000001000003230200000000000600000007200f000c0a000001000000000b0100000a0004030a000102000000030000000222020000000000040901030200000000340100000000000805012000000000080501202000000008010000020000000606022000160000000602202000000009000000061c0200001e0300000000000b0000000035020000000000050000000135020000110901060a0000010b010000010000050000000000000001340100002802000000000002000000032a02000000000003000000020100000600000004280200003102000032020000";

function expectedLimitOrderBuyConstants() pure returns (uint256[] memory constants) {
    constants = new uint256[](7);
    constants[0] = uint256(uint160(APPROVED_COUNTERPARTY));
    constants[1] = COOLDOWN;
    constants[2] = 0;
    constants[3] = ORDER_INIT_RATIO_BUY;
    constants[4] = INCR_PER_BATCH;
    constants[5] = AMOUNT_PER_BATCH;
    constants[6] = 1;
}
