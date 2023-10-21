// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import "rain.interpreter/test/util/abstract/OpTest.sol";
import {console2} from "forge-std/console2.sol";
import "src/3SushiV2Strat.sol";
import {LibUniswapV2} from "rain.interpreter/src/lib/uniswap/LibUniswapV2.sol";
import {IUniswapV2Factory} from "rain.interpreter/lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import {LibFixedPointDecimalScale} from
    "rain.interpreter/lib/rain.math.fixedpoint/src/lib/LibFixedPointDecimalScale.sol";
import {UD60x18, mul} from "rain.interpreter/lib/prb-math/src/UD60x18.sol";
import {Vm} from "forge-std/Vm.sol";

uint256 constant CONTEXT_VAULT_INPUTS_COLUMN = 3;
uint256 constant CONTEXT_VAULT_OUTPUTS_COLUMN = 4;
uint256 constant CONTEXT_VAULT_IO_BALANCE_DIFF = 4;
uint256 constant CONTEXT_VAULT_IO_ROWS = 5;

string constant FORK_RPC = "https://polygon.llamarpc.com";
uint256 constant FORK_BLOCK_NUMBER = 47331008;
uint256 constant VAULT_ID = uint256(keccak256("vault"));

address constant TEST_ORDER_OWNER = address(0x84723849238);

contract Test3SushiV2Strat is OpTest {
    function constructionMetaPath() internal pure override returns (string memory) {
        return "lib/rain.interpreter/meta/RainterpreterExpressionDeployerNP.rain.meta";
    }

    function selectPolygonFork() internal {
        uint256 fork = vm.createFork(FORK_RPC);
        vm.selectFork(fork);
        vm.rollFork(FORK_BLOCK_NUMBER);
    }

    function parseAndEvalWithContext(
        bytes memory expectedBytecode,
        bytes memory rainString,
        uint256[][] memory context,
        SourceIndex sourceIndex
    ) internal returns (uint256[] memory, uint256[] memory) {
        IInterpreterV1 interpreterDeployer;
        IInterpreterStoreV1 storeDeployer;
        address expression;
        {
            (bytes memory bytecode, uint256[] memory constants) = iDeployer.parse(rainString);
            assertEq(bytecode, expectedBytecode);
            uint256[] memory minOutputs = new uint256[](1);
            minOutputs[0] = 0;
            (interpreterDeployer, storeDeployer, expression) =
                iDeployer.deployExpression(bytecode, constants, minOutputs);
        }

        (uint256[] memory stack, uint256[] memory kvs) = interpreterDeployer.eval(
            storeDeployer,
            StateNamespace.wrap(0),
            LibEncodedDispatch.encode(expression, sourceIndex, type(uint16).max),
            context
        );
        return (stack, kvs);
    }

    function checkBuyConstants(uint256[] memory constants) internal {
        assertEq(constants.length, 7);
        assertEq(constants[0], uint256(uint160(POLYGON_SUSHI_V2_FACTORY)), "constants[0]");
        assertEq(constants[1], uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS))), "constants[1]");
        assertEq(constants[2], uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS))), "constants[2]");
        assertEq(constants[3], uint256(uint160(APPROVED_COUNTERPARTY)), "constants[3]");
        assertEq(constants[4], MIN_USDT_AMOUNT, "constants[4]");
        assertEq(constants[5], 1, "constants[5]");
        assertEq(constants[6], ONE_HOUR, "constants[6]");
    }

    function checkSellConstants(uint256[] memory constants) internal {
        assertEq(constants.length, 7);
        assertEq(constants[0], uint256(uint160(POLYGON_SUSHI_V2_FACTORY)), "constants[0]");
        assertEq(constants[1], uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS))), "constants[1]");
        assertEq(constants[2], uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS))), "constants[2]");
        assertEq(constants[3], uint256(uint160(APPROVED_COUNTERPARTY)), "constants[3]");
        assertEq(constants[4], MIN_USDT_AMOUNT, "constants[4]");
        assertEq(constants[5], 1, "constants[5]");
        assertEq(constants[6], ONE_HOUR, "constants[6]");
    }

    function checkSellCalculate(
        uint256[] memory stack,
        uint256[] memory kvs,
        uint256 orderHash,
        uint256 reserveTimestamp
    ) internal {
        uint256 lastTimeKey = uint256(keccak256(abi.encodePacked(orderHash, uint256(1))));
        assertEq(kvs.length, 2);
        kvs[0] = lastTimeKey;
        kvs[1] = block.timestamp;
        assertEq(stack.length, 13);

        // addresses.
        assertEq(stack[0], uint256(uint160(POLYGON_SUSHI_V2_FACTORY)), "stack[0]");
        assertEq(stack[1], uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS))), "stack[1]");
        assertEq(stack[2], uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS))), "stack[2]");

        // approved counterparty.
        assertEq(stack[3], uint256(uint160(APPROVED_COUNTERPARTY)), "stack[3]");
        // actual counterparty.
        assertEq(stack[4], uint256(uint160(APPROVED_COUNTERPARTY)), "stack[4]");

        // order hash.
        assertEq(stack[5], orderHash, "stack[5]");
        // target usdt amount.
        assertEq(stack[6], MIN_USDT_AMOUNT, "stack[6]");
        // last time key
        assertEq(stack[7], lastTimeKey, "stack[7]");
        // last time.
        assertEq(stack[8], 0, "stack[8]");
        // last price timestamp.
        assertEq(stack[9], reserveTimestamp, "stack[9]");
        // nht amount.
        assertEq(stack[10], 218071733215424131376675, "stack[10]");
        // order output max nhs.
        assertEq(stack[11], stack[10], "stack[11]");
    }

    function checkSellHandle(uint256[] memory stack, uint256[] memory kvs) internal {
        assertEq(kvs.length, 0);
        assertEq(stack.length, 0);
    }

    function testStratSellNHTHappyPath(uint256 orderHash) public {
        uint256 reserve0 = 53138576564435538694955386;
        // Using USDT as an example.
        uint256 reserve1 = 12270399039;

        uint32 reserveTimestamp = 1692775490;

        uint256[][] memory context = new uint256[][](4);
        {
            uint256[] memory callingContext = new uint256[](3);
            // order hash
            callingContext[0] = orderHash;
            // owner
            callingContext[1] = uint256(uint160(address(this)));
            // counterparty
            callingContext[2] = uint256(uint160(APPROVED_COUNTERPARTY));
            context[0] = callingContext;
        }
        {
            uint256[] memory calculationsContext = new uint256[](0);
            context[1] = calculationsContext;
        }
        {
            uint256[] memory inputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
            inputsContext[0] = uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS)));
            context[2] = inputsContext;
        }
        {
            uint256[] memory outputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
            outputsContext[0] = uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS)));
            context[3] = outputsContext;
        }
        context = LibContext.build(context, new SignedContextV1[](0));

        address expectedPair = LibUniswapV2.pairFor(
            POLYGON_SUSHI_V2_FACTORY, address(POLYGON_NHT_TOKEN_ADDRESS), address(POLYGON_USDT_TOKEN_ADDRESS)
        );
        vm.etch(POLYGON_SUSHI_V2_FACTORY, hex"fe");
        vm.mockCall(
            POLYGON_SUSHI_V2_FACTORY,
            abi.encodeWithSelector(IUniswapV2Factory.getPair.selector),
            abi.encode(expectedPair)
        );
        vm.etch(expectedPair, hex"fe");
        vm.mockCall(
            expectedPair,
            abi.encodeWithSelector(IUniswapV2Pair.getReserves.selector),
            abi.encode(reserve0, reserve1, reserveTimestamp)
        );

        uint256 orderInitTime = uint256(reserveTimestamp) + 1;
        // Give it an hour so we can clear the handle io check.
        uint256 duration = 3600;
        vm.warp(orderInitTime + duration);

        (uint256[] memory stack, uint256[] memory kvs) =
            parseAndEvalWithContext(EXPECTED_SELL_BYTECODE, RAINSTRING_SELL_NHT, context, SourceIndex.wrap(0));

        checkSellCalculate(stack, kvs, orderHash, reserveTimestamp);

        uint256 orderOutputMax = stack[stack.length - 2];
        uint256 ioRatio = stack[stack.length - 1];

        // usdt diff is the amount of usdt we bought (order output max * io ratio) scaled to 6 decimals.
        // usdt is the input here as we're selling nht.
        context[CONTEXT_VAULT_INPUTS_COLUMN][CONTEXT_VAULT_IO_BALANCE_DIFF] = LibFixedPointDecimalScale.scaleN(
            UD60x18.unwrap(mul(UD60x18.wrap(orderOutputMax), UD60x18.wrap(ioRatio))), 6, 1
        );

        // nht diff is the amount of nht we sold (order output max).
        // nht is the output here as we're selling nht.
        context[CONTEXT_VAULT_OUTPUTS_COLUMN][CONTEXT_VAULT_IO_BALANCE_DIFF] = orderOutputMax;

        // it hasn't been an hour so we should revert.
        (stack, kvs) =
            parseAndEvalWithContext(EXPECTED_SELL_BYTECODE, RAINSTRING_SELL_NHT, context, SourceIndex.wrap(1));
        checkSellHandle(stack, kvs);
    }

    function testDeployer() external {
        selectPolygonFork();

        assertEq(address(POLYGON_DEPLOYER.iInterpreter()), POLYGON_INTERPRETER);
        assertEq(address(POLYGON_DEPLOYER.iStore()), POLYGON_STORE);
    }

    function testStratSellNHTHappyFork() external {
        selectPolygonFork();

        giveTestAccountsTokens();
        depositTokens();

        Order memory sellOrder = placeSellOrderFork();
        Order memory buyOrder = placeBuyOrderFork();
        (buyOrder);

        // This is the bytes encoded route data that is built off chain for particular token pair.
        // Will change depending on the token traded.
        bytes memory route =
        // offset?
            hex"0000000000000000000000000000000000000000000000000000000000000020"
            // stream length
            hex"0000000000000000000000000000000000000000000000000000000000000042"
            // command 2 = processUserERC20
            hex"02"
            // token address
            hex"84342e932797fc62814189f01f0fb05f52519708"
            // number of pools
            hex"01"
            // pool share
            hex"ffff"
            // pool type 0 = uni v2
            hex"00"
            // pool address
            hex"e427b62b495c1dfe1fe9f78bebfceb877ad05dce"
            // direction 1
            hex"01"
            // to
            hex"D709Bc4c77929C4d9900cB275769Ed9C68716bde"
            // padding
            hex"000000000000000000000000000000000000000000000000000000000000";

        takeOrder(sellOrder, route);
    }

    function checkBuyCalculate(
        uint256[] memory stack,
        uint256[] memory kvs,
        uint256 orderHash,
        uint256 reserveTimestamp
    ) internal {
        uint256 lastTimeKey = uint256(keccak256(abi.encodePacked(orderHash, uint256(1))));
        assertEq(kvs.length, 2);
        kvs[0] = lastTimeKey;
        kvs[1] = block.timestamp;
        assertEq(stack.length, 13);

        // addresses.
        assertEq(stack[0], uint256(uint160(POLYGON_SUSHI_V2_FACTORY)), "stack[0]");
        assertEq(stack[1], uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS))), "stack[1]");
        assertEq(stack[2], uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS))), "stack[2]");

        // approved counterparty.
        assertEq(stack[3], uint256(uint160(APPROVED_COUNTERPARTY)), "stack[3]");
        // actual counterparty.
        assertEq(stack[4], uint256(uint160(APPROVED_COUNTERPARTY)), "stack[4]");

        // order hash.
        assertEq(stack[5], orderHash, "stack[5]");
        // target usdt amount.
        assertEq(stack[6], MIN_USDT_AMOUNT, "stack[6]");
        // last time key.
        assertEq(stack[7], lastTimeKey, "stack[7]");
        // last time
        assertEq(stack[8], 0, "stack[8]");
        // last price timestamp.
        assertEq(stack[9], reserveTimestamp, "stack[9]");
        // nht amount in to ob.
        assertEq(stack[10], 215008481837646366747564, "stack[10]");
        // order output max usdt.
        assertEq(stack[11], 50e18, "stack[11]");
        // io ratio.
        assertEq(stack[12], stack[10] * 1e18 / stack[11], "stack[12]");
    }

    function checkBuyHandle(uint256[] memory stack, uint256[] memory kvs) internal {
        assertEq(kvs.length, 0);
        assertEq(stack.length, 0);
    }

    function testStratBuyNHTHappyPath(uint256 orderHash) public {
        uint256 reserve0 = 53138576564435538694955386;
        uint256 reserve1 = 12270399039;

        uint32 reserveTimestamp = 1692775490;

        uint256[][] memory context = new uint256[][](4);
        {
            uint256[] memory callingContext = new uint256[](3);
            // order hash
            callingContext[0] = orderHash;
            // owner
            callingContext[1] = uint256(uint160(address(this)));
            // counterparty
            callingContext[2] = uint256(uint160(APPROVED_COUNTERPARTY));
            context[0] = callingContext;
        }
        {
            uint256[] memory calculationsContext = new uint256[](0);
            context[1] = calculationsContext;
        }
        {
            uint256[] memory inputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
            inputsContext[0] = uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS)));
            context[2] = inputsContext;
        }
        {
            uint256[] memory outputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
            outputsContext[0] = uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS)));
            context[3] = outputsContext;
        }
        context = LibContext.build(context, new SignedContextV1[](0));

        address expectedPair = LibUniswapV2.pairFor(
            POLYGON_SUSHI_V2_FACTORY, address(POLYGON_NHT_TOKEN_ADDRESS), address(POLYGON_USDT_TOKEN_ADDRESS)
        );
        vm.etch(POLYGON_SUSHI_V2_FACTORY, hex"fe");
        vm.mockCall(
            POLYGON_SUSHI_V2_FACTORY,
            abi.encodeWithSelector(IUniswapV2Factory.getPair.selector),
            abi.encode(expectedPair)
        );
        vm.etch(expectedPair, hex"fe");
        vm.mockCall(
            expectedPair,
            abi.encodeWithSelector(IUniswapV2Pair.getReserves.selector),
            abi.encode(reserve0, reserve1, reserveTimestamp)
        );
        uint256 orderInitTime = uint256(reserveTimestamp) + 1;
        // Give it an hour so we can clear the handle io check.
        uint256 duration = 3600;
        vm.warp(orderInitTime + duration);
        (uint256[] memory stack, uint256[] memory kvs) =
            parseAndEvalWithContext(EXPECTED_BUY_BYTECODE, RAINSTRING_BUY_NHT, context, SourceIndex.wrap(0));

        checkBuyCalculate(stack, kvs, orderHash, reserveTimestamp);

        uint256 outputMax = stack[stack.length - 2];
        uint256 ioRatio = stack[stack.length - 1];

        // usdt diff is the order output max scaled to 6 decimals.
        // usdt is the output here as we're buying nht.
        context[CONTEXT_VAULT_OUTPUTS_COLUMN][CONTEXT_VAULT_IO_BALANCE_DIFF] =
            LibFixedPointDecimalScale.scaleN(outputMax, 6, 1);

        // nht diff is the amount of nht we sold (order output max * io ratio).
        // nht is the input here as we're buying nht.
        context[CONTEXT_VAULT_INPUTS_COLUMN][CONTEXT_VAULT_IO_BALANCE_DIFF] = outputMax * ioRatio / 1e18;

        (stack, kvs) = parseAndEvalWithContext(EXPECTED_BUY_BYTECODE, RAINSTRING_BUY_NHT, context, SourceIndex.wrap(1));
        checkBuyHandle(stack, kvs);
    }

    function testStratBuyNHTHappyFork() external {
        selectPolygonFork();

        giveTestAccountsTokens();
        depositTokens();

        Order memory sellOrder = placeSellOrderFork();
        (sellOrder);
        Order memory buyOrder = placeBuyOrderFork();

        // This is the bytes encoded route data that is built off chain for particular token pair.
        // Will change depending on the token traded.
        bytes memory route =
        // offset?
            hex"0000000000000000000000000000000000000000000000000000000000000020"
            // stream length
            hex"0000000000000000000000000000000000000000000000000000000000000042"
            // command 2 = processUserERC20
            hex"02"
            // token address
            hex"c2132d05d31c914a87c6611c10748aeb04b58e8f"
            // number of pools
            hex"01"
            // pool share
            hex"ffff"
            // pool type 0 = uni v2
            hex"00"
            // pool address
            hex"e427b62b495c1dfe1fe9f78bebfceb877ad05dce"
            // direction 0
            hex"00"
            // to
            hex"D709Bc4c77929C4d9900cB275769Ed9C68716bde"
            // padding
            hex"000000000000000000000000000000000000000000000000000000000000";

        takeOrder(buyOrder, route);
    }

    function giveTestAccountsTokens() internal {
        {
            vm.startPrank(POLYGON_NHT_HOLDER);
            //100 mil NHT deposit.
            uint256 amountNht = 2000000e18;
            POLYGON_NHT_TOKEN_ADDRESS.transfer(TEST_ORDER_OWNER, amountNht);
            assertEq(POLYGON_NHT_TOKEN_ADDRESS.balanceOf(TEST_ORDER_OWNER), amountNht);
            POLYGON_NHT_TOKEN_ADDRESS.transfer(APPROVED_COUNTERPARTY, amountNht);
            assertEq(POLYGON_NHT_TOKEN_ADDRESS.balanceOf(APPROVED_COUNTERPARTY), amountNht);
            vm.stopPrank();
        }
        {
            vm.startPrank(POLYGON_USDT_HOLDER);
            // one mil usdt to each of owner order and counterparty.
            uint256 amountUsdt = 50e6;
            POLYGON_USDT_TOKEN_ADDRESS.transfer(TEST_ORDER_OWNER, amountUsdt);
            assertEq(POLYGON_USDT_TOKEN_ADDRESS.balanceOf(TEST_ORDER_OWNER), amountUsdt);
            // POLYGON_USDT_TOKEN_ADDRESS.transfer(APPROVED_COUNTERPARTY, amountUsdt);
            // assertEq(POLYGON_USDT_TOKEN_ADDRESS.balanceOf(APPROVED_COUNTERPARTY), amountUsdt);
            vm.stopPrank();
        }
    }

    function depositTokens() internal {
        vm.startPrank(TEST_ORDER_OWNER);

        uint256 amountNht = POLYGON_NHT_TOKEN_ADDRESS.balanceOf(TEST_ORDER_OWNER);
        POLYGON_NHT_TOKEN_ADDRESS.approve(address(POLYGON_ORDERBOOK), amountNht);
        POLYGON_ORDERBOOK.deposit(address(POLYGON_NHT_TOKEN_ADDRESS), VAULT_ID, amountNht);

        uint256 amountUsdt = POLYGON_USDT_TOKEN_ADDRESS.balanceOf(TEST_ORDER_OWNER);
        POLYGON_USDT_TOKEN_ADDRESS.approve(address(POLYGON_ORDERBOOK), amountUsdt);
        POLYGON_ORDERBOOK.deposit(address(POLYGON_USDT_TOKEN_ADDRESS), VAULT_ID, amountUsdt);
        vm.stopPrank();
    }

    function placeOrder(bytes memory bytecode, uint256[] memory constants, IO memory input, IO memory output)
        internal
        returns (Order memory order)
    {
        IO[] memory inputs = new IO[](1);
        inputs[0] = input;

        IO[] memory outputs = new IO[](1);
        outputs[0] = output;

        EvaluableConfigV2 memory evaluableConfig = EvaluableConfigV2(POLYGON_DEPLOYER, bytecode, constants);

        OrderConfigV2 memory orderConfig = OrderConfigV2(inputs, outputs, evaluableConfig, "");

        vm.startPrank(TEST_ORDER_OWNER);
        vm.recordLogs();
        (bool stateChanged) = POLYGON_ORDERBOOK.addOrder(orderConfig);
        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 3);
        (,, order,) = abi.decode(entries[2].data, (address, address, Order, bytes32));
        assertEq(order.owner, TEST_ORDER_OWNER);
        assertEq(order.handleIO, true);
        assertEq(address(order.evaluable.interpreter), address(POLYGON_INTERPRETER));
        assertEq(address(order.evaluable.store), address(POLYGON_STORE));
        assertEq(stateChanged, true);
    }

    function polygonNhtIo() internal pure returns (IO memory) {
        return IO(address(POLYGON_NHT_TOKEN_ADDRESS), 18, VAULT_ID);
    }

    function polygonUsdtIo() internal pure returns (IO memory) {
        return IO(address(POLYGON_USDT_TOKEN_ADDRESS), 6, VAULT_ID);
    }

    function placeBuyOrderFork() internal returns (Order memory) {
        (bytes memory bytecode, uint256[] memory constants) = POLYGON_DEPLOYER.parse(RAINSTRING_BUY_NHT);
        assertEq(bytecode, EXPECTED_BUY_BYTECODE_FORK);
        checkBuyConstants(constants);
        return placeOrder(bytecode, constants, polygonNhtIo(), polygonUsdtIo());
    }

    function placeSellOrderFork() internal returns (Order memory order) {
        (bytes memory bytecode, uint256[] memory constants) = POLYGON_DEPLOYER.parse(RAINSTRING_SELL_NHT);
        assertEq(bytecode, EXPECTED_SELL_BYTECODE_FORK);
        checkSellConstants(constants);
        return placeOrder(bytecode, constants, polygonUsdtIo(), polygonNhtIo());
    }

    function takeOrder(Order memory order, bytes memory route) internal {
        assertTrue(POLYGON_ORDERBOOK.orderExists(keccak256(abi.encode(order))), "order exists");
        vm.startPrank(APPROVED_EOA);
        uint256 inputIOIndex = 0;
        uint256 outputIOIndex = 0;
        TakeOrderConfig[] memory innerConfigs = new TakeOrderConfig[](1);
        innerConfigs[0] = TakeOrderConfig(order, inputIOIndex, outputIOIndex, new SignedContextV1[](0));

        // (uint112 reserve0, uint112 reserve1, uint32 time) = POLYGON_NHT_USDT_PAIR_ADDRESS.getReserves();

        // bytes memory encodedSwap = abi.encodeCall(IUniswapV2Pair.swap, (0, 50e6, APPROVED_COUNTERPARTY, ""));

        // function swapExactTokensForTokens(
        //     uint amountIn,
        //     uint amountOutMin,
        //     address[] calldata path,
        //     address to,
        //     uint deadline
        // ) external returns (uint[] memory amounts);
        // bytes memory encodedSwap = abi.encodeCall(UniswapV2Router02.swapExactTokensForTokens, ());

        TakeOrdersConfigV2 memory takeOrdersConfig =
            TakeOrdersConfigV2(0, type(uint256).max, type(uint256).max, innerConfigs, route);
        POLYGON_ARB_CONTRACT.arb(takeOrdersConfig, 0);
        // IERC20(outputToken).approve(address(POLYGON_ORDERBOOK), type(uint256).max);
        // (totalInput, totalOutput) = POLYGON_ORDERBOOK.takeOrders(takeOrdersConfig);
        // assertTrue(totalInput > 0, "totalInput nonzero");
        // assertTrue(totalOutput > 0, "totalOutput nonzero");
        vm.stopPrank();
    }
}
