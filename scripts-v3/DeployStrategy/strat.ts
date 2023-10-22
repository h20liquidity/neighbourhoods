import config from "../v3-config.json"; 


export const RAINSTRING_JITTERY_BINOMIAL =
// Paramaterise the seed for our randomness (hash).
    "input:,"+
    // The binomial part is using ctpop over a hash to simulate 256 coin flips.
    "binomial: bitwise-count-ones(hash(input)),"+
    // Rescale the binomial to 18 decimal fixed point so we can easily add some
    // noise to it with a simple mod of a hash.
    "binomial18: decimal18-scale18<0>(binomial),"+
    // Generate some noise for the binomial. The noise is a number between 0 and
    // 1e18. Ensure that we use a different seed for the noise than the binomial
    // by concatenating 0 to the seed.
    "noise18: int-mod(hash(input 0) 1e18),"+
    // Add the noise to the binomial, subtracting 0.5 to ensure that the noise
    // is centred around the binomial value. This will underflow if the binomial
    // is 0, but that's only possible if the hash of the seed is `0` which is
    // somewhat unlikely.
    "jittery-binomial18: decimal18-sub(decimal18-add(binomial18 noise18) 5e17),"+
    // The jittery binomial is a number between 0 and 256e18. We want a number
    // between 0 and 1e18, so we divide by 256. As above, technically this will
    // produce a value outside this range if the hash of the input is
    // `type(256).max`, which is just as unlikely as the hash of the input being
    // `0`.
    "output: decimal18-div(jittery-binomial18 256e18);";

export const RAINSTRING_CALCULATE_ORDER_SELL =
    // Token in for uniswap is ob's token out, and vice versa.
    // We want the timestamp as well as the nht amount that sushi wants in.
    // NHT is already 18 decimals, so we don't need to scale it.
        "last-price-timestamp nht-amount18: uniswap-v2-amount-in<1>(polygon-sushi-v2-factory target-usdt-amount nht-token-address usdt-token-address),"+
        // Don't allow the price to change this block before this trade.
        ":ensure<2>(less-than(last-price-timestamp block-timestamp())),"+ 
        // nht token address is the token out during a sale.
        ":ensure<3>(equal-to(context<4 0>() nht-token-address)),"+ 
        // usdt token address is the token in during a sale.
        ":ensure<4>(equal-to(context<3 0>() usdt-token-address))," +
        // Order output max is the nht amount from sushi.
        "order-output-max18: nht-amount18,"+ 
        // IO ratio is the usdt target divided by the nht amount from sushi.
        "io-ratio: decimal18-div(target-usdt-amount18 order-output-max18)"+
        // end calculate order
        ";"; 

export const RAINSTRING_CALCULATE_ORDER_BUY =
        // Token out for uni is in for ob, and vice versa.
        // We want the timestamp as well as the nht amount that sushi will give us.
        // NHT is already 18 decimals, so we don't need to scale it.
            "last-price-timestamp nht-amount18: uniswap-v2-amount-out<1>(polygon-sushi-v2-factory target-usdt-amount usdt-token-address nht-token-address),"+
            // Don't allow the price to change this block before this trade.
            ":ensure<6>(less-than(last-price-timestamp block-timestamp())),"+
            // nht token address is the token in during a buy.
            ":ensure<7>(equal-to(context<3 0>() nht-token-address)),"+
            // usdt token address is the token out during a buy.
            ":ensure<8>(equal-to(context<4 0>() usdt-token-address)),"+
            // Order output max is the usdt amount as decimal 18.
            "order-output-max18: target-usdt-amount18,"+
            // IO ratio is the nht amount from sushi divided by the usdt target.
            "io-ratio: decimal18-div(nht-amount18 order-output-max18)"+
            // end calculate order
            ";";
        
export const RAINSTRING_HANDLE_IO_BUY =
        // context 4 4 is the vault outputs as absolute values.
        // context 2 0 is the calculated output as decimal 18.
        // USDT is the output which is decimal 6 natively so we need to scale it.
         ":ensure<9>(greater-than-or-equal-to(context<4 4>() decimal18-scale-n<6>(context<2 0>())));";
    
export const RAINSTRING_HANDLE_IO_SELL =
    // context 4 4 is the vault outputs as absolute values.
    // context 2 0 is the calculated output as decimal 18.
    // NHT is the output which is decimal 18 natively so no scaling is needed.
     ":ensure<5>(greater-than-or-equal-to(context<4 4>() context<2 0>()));";
    

export const getRainPrelude = (network) => {

    const RouteProcessorOrder = config.contracts[network].RouteProcessorOrderBookV3ArbOrderTakerInstance.address  

    const RAINSTRING_PRELUDE =
    // Sushi v2 factory address.
    "polygon-sushi-v2-factory: 0xc35DADB65012eC5796536bD9864eD8773aBc74C4,"+
    // NHT token address.
    "nht-token-address: 0x84342e932797FC62814189f01F0Fb05F52519708,"+
    // USDT token address.
    "usdt-token-address: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F,"+
    // Approved counterparty.
    `approved-counterparty: ${RouteProcessorOrder},`+
    // Actual counterparty.
    "actual-counterparty: context<1 2>(),"+
    // Order hash.
    "order-hash: context<1 0>(),"+
    // The last time is stored under the order hash, as there's only a single
    // value stored for this order.
    "last-time: get(order-hash),"+
    // Set the last time to this block.
    ":set(order-hash block-timestamp()),"+
    // Try to sell $50 worth of nht.
    // Set the max at $100 so that the binomial peak sits at $50.
    "max-usdt-amount18: 100e18,"+
    // We can just seed the rng with last time.
    "amount-random-multiplier18: call<2 1>(last-time),"+
    // Calculate the target usdt amount for the order, as decimal18.
    "target-usdt-amount18: decimal18-mul(max-usdt-amount18 amount-random-multiplier18),"+
    // Sushi needs the usdt amount as 6 decimals (tether's native size).
    "target-usdt-amount: decimal18-scale-n<6>(target-usdt-amount18),"+
    // Try to average a 1 hour cooldown, so the max is 2 hours.
    "max-cooldown18: 7200e18,"+
    // Seed the rng with the hash of the last time to make it distinct from the
    // amount random multiplier.
    "cooldown-random-multiplier18: call<2 1>(hash(last-time)),"+
    // Calculate the cooldown for the order.
    "cooldown18: decimal18-mul(max-cooldown18 cooldown-random-multiplier18),"+
    // Scale the cooldown to integer seconds.
    "cooldown: decimal18-scale-n<0>(cooldown18),"+
    // Check all the addresses are correct.
    // - counterparty is approved.
    ":ensure<0>(equal-to(approved-counterparty actual-counterparty)),"+
    // Check the cooldown.
    ":ensure<1>(less-than(int-add(last-time cooldown) block-timestamp())),";

    return RAINSTRING_PRELUDE
}

export const rainBinomialBuyString = (network) => {
    return getRainPrelude(network)+RAINSTRING_CALCULATE_ORDER_BUY+RAINSTRING_HANDLE_IO_BUY+RAINSTRING_JITTERY_BINOMIAL
} 

export const rainBinomialSellString = (network) => {
    return getRainPrelude(network)+RAINSTRING_CALCULATE_ORDER_SELL+RAINSTRING_HANDLE_IO_SELL+RAINSTRING_JITTERY_BINOMIAL
}

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
