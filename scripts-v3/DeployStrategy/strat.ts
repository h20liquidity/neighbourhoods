import config from "../v3-config.json"; 


export const getRainBuyNhtString = (network) => {

    const RouteProcessorOrder = config.contracts[network].RouteProcessorOrderBookV3ArbOrderTakerInstance.address 

    const  RAINSTRING_BUY_NHT =
    // String version of factory address.
        "polygon-sushi-v2-factory: 0xc35DADB65012eC5796536bD9864eD8773aBc74C4,"+
        // String version of nht token address.
        "nht-token-address: 0x84342e932797FC62814189f01F0Fb05F52519708,"+
        // String version of usdt token address.
        "usdt-token-address: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F,"+
        // String version of approved counterparty.
        `approved-counterparty: ${RouteProcessorOrder},`+
        // actual counterparty is from context
        "actual-counterparty: context<1 2>(),"+
        // Check that
        ":ensure<0>("+
        // - counterparty is approved.
        " equal-to(approved-counterparty actual-counterparty)"+
        // - nht token address is the token in to ob.
        " equal-to(context<3 0>() nht-token-address)"+
        // - usdt token address is the token out from ob.
        " equal-to(context<4 0>() usdt-token-address)"+
        //
        "),"+
        // Order hash.
        "order-hash: context<1 0>(),"+
        // Try to buy $50 worth of nht.
        "target-usdt-amount: 50e6,"+
        // Ensure a 1 hour cooldown.
        "last-time-key: hash(order-hash 1),"+
        // Get the last time.
        "last-time: get(last-time-key),"+
        // Ensure it is more than 3600 seconds ago.
        ":ensure<1>(less-than(int-add(last-time 3600) block-timestamp())),"+
        // Set the new cooldown to start now.
        ":set(last-time-key block-timestamp()),"+
        // Token out for uni is in for ob, and vice versa.
        "last-price-timestamp max-nht-amount: uniswap-v2-amount-out<1>(polygon-sushi-v2-factory target-usdt-amount usdt-token-address nht-token-address),"+
        // Don't allow the price to change this block before this trade.
        ":ensure<2>(less-than(last-price-timestamp block-timestamp())),"+
        "order-output-max: decimal18-scale18<6>(target-usdt-amount),"+
        "io-ratio: decimal18-div(max-nht-amount order-output-max)"+
        //
        ";"+
        // Ensure that we sold at least $50 worth of usdt.
        ":ensure<3>(greater-than-or-equal-to(context<4 4>() 50e6))"+
        // ;
        ";"; 

    return RAINSTRING_BUY_NHT

} 

export const getRainSellNhtString = (network) => {
    const RouteProcessorOrder = config.contracts[network].RouteProcessorOrderBookV3ArbOrderTakerInstance.address

    const RAINSTRING_SELL_NHT =
    // String version of factory address.
    "polygon-sushi-v2-factory: 0xc35DADB65012eC5796536bD9864eD8773aBc74C4,"+
    // String version of nht token address.
    "nht-token-address: 0x84342e932797FC62814189f01F0Fb05F52519708,"+
    // String version of usdt token address.
    "usdt-token-address: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F,"+
    // String version of approved counterparty.
    `approved-counterparty: ${RouteProcessorOrder},`+
    // actual counterparty is from context.
    "actual-counterparty: context<1 2>(),"+
    // Check that
    ":ensure<0>("+
    // - counterparty is approved.
    " equal-to(approved-counterparty actual-counterparty)"+
    // - usdt token address is the token in to ob.
    " equal-to(context<3 0>() usdt-token-address)"+
    // - nht token address is the token out from ob.
    " equal-to(context<4 0>() nht-token-address)"+
    //
    "),"+
    // Order hash.
    "order-hash: context<1 0>(),"+
    // Try to sell $50 worth of nht.
    "target-usdt-amount: 50e6,"+
    // Ensure a 1 hour cooldown.
    "last-time-key: hash(order-hash 1),"+
    // Get the last time.
    "last-time: get(last-time-key),"+
    // Ensure it is more than 3600 seconds ago.
    ":ensure<1>(less-than(int-add(last-time 3600) block-timestamp())),"+ ":set(last-time-key block-timestamp()),"+
    // Token in for uniswap is ob's token out, and vice versa.
    // We want the timestamp as well as the nht amount that sushi wants in.
    "last-price-timestamp nht-amount: uniswap-v2-amount-in<1>(polygon-sushi-v2-factory target-usdt-amount nht-token-address usdt-token-address),"+
    // Don't allow the price to change this block before this trade.
    ":ensure<1>(less-than(last-price-timestamp block-timestamp()))," +"order-output-max: nht-amount,"+
    "io-ratio: decimal18-div(decimal18-scale18<6>(target-usdt-amount) order-output-max)"+
    // end calculate order
    ";"+
    // Ensure that we bought at least $50 worth of usdt.
    ":ensure<2>(greater-than-or-equal-to(context<3 4>() 50e6))"+
    // end handle io
    ";"; 

    return RAINSTRING_SELL_NHT
}

  