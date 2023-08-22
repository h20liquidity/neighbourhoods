/// @dev https://docs.sushi.com/docs/Products/Classic%20AMM/Deployment%20Addresses
/// @dev https://polygonscan.com/address/0xc35DADB65012eC5796536bD9864eD8773aBc74C4
address constant POLYGON_SUSHI_V2_FACTORY = 0xc35DADB65012eC5796536bD9864eD8773aBc74C4;

/// @dev https://polygonscan.com/address/0x84342e932797FC62814189f01F0Fb05F52519708
address constant POLYGON_NHT_TOKEN_ADDRESS = 0x84342e932797FC62814189f01F0Fb05F52519708;

/// @dev https://polygonscan.com/address/0xc2132D05D31c914a87C6611C10748AEb04B58e8F
address constant USDT_TOKEN_ADDRESS = 0xc2132D05D31c914a87C6611C10748AEb04B58e8F;

address constant APPROVED_COUNTERPARTY = 0x1F8Cd7FB14b6930665EaaA5F5C71b9e7396df036;

bytes constant RAINSTRING =
    // String version of factory address.
    "polygon-sushi-v2-factory: 0xc35DADB65012eC5796536bD9864eD8773aBc74C4,"

    // String version of nht token address.
    "nht-token-address: 0x84342e932797FC62814189f01F0Fb05F52519708,"

    // String version of usdt token address.
    "usdt-token-address: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F,"

    // String version of approved counterparty.
    "approved-counterparty: 0x1F8Cd7FB14b6930665EaaA5F5C71b9e7396df036,"
    "actual-counterparty: context<1 2>(),"

    // Check that
    // - counterparty is approved.
    // - usdt token address is the token in to ob.
    // - nht token address is the token out from ob.
    ":ensure("
    " equal-to(approved-counterparty actual-counterparty)"
    " equal-to(context<3 0>() usdt-token-address)"
    " equal-to(context<4 0>() nht-token-address)"
    "),"

    // Order hash.
    "order-hash: context<1 0>(),"

    // Figure out when the order started.
    "order-init-time-key: hash(order-hash 0),"
    "order-init-time: any(get(order-init-time-key) block-timestamp()),"
    ":set(order-init-time-key order-init-time),"

    // We sell $50 worth of nht for usdt per hour.
    // 50e6 is $50 in usdt.
    // 50e6 / 3600 is $50 per hour.
    "usdt-per-second: 13889,"
    "total-time: int-sub(block-timestamp() order-init-time),"
    "max-usdt-amount: int-mul(total-time usdt-per-second),"
    "current-usdt-amount-key: hash(order-hash 1),"
    "current-usdt-amount: get(current-usdt-amount-key),"
    "target-usdt-amount: int-sub(max-usdt-amount current-usdt-amount),"

    // Token in for uniswap is ob's token out, and vice versa.
    // We want the timestamp as well as the nht amount that sushi wants in.
    "last-price-timestamp nht-amount: uniswap-v2-amount-in<1>(polygon-sushi-v2-factory target-usdt-amount nht-token-address usdt-token-address),"
    // Don't allow the price to change this block before this trade.
    ":ensure(less-than(last-price-timestamp block-timestamp())),"

    // We want to sell a little more nht amount than sushi sets as the minimum
    // to give some leeway for the arb bot.
    "actual-nht-amount: decimal18-mul(nht-amount 1001e15),"
    "io-ratio: decimal18-div(decimal18-scale18<6>(target-usdt-amount) actual-nht-amount)"
";"
    // Record the amount of usdt we bought.
    "usdt-diff: context<3 4>(),"
    "current-usdt-amount-key: hash(order-hash 1),"
    ":set(current-usdt-amount-key int-add(get(current-usdt-amount-key) usdt-diff)),"
    // Ensure that we bought at least $50 worth of usdt.
    ":ensure(greater-than(usdt-diff 50e6)),"
";";