// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import {console2} from "forge-std/console2.sol";


import {Vm} from "forge-std/Vm.sol";
import {OpTest} from "rain.interpreter/test/util/abstract/OpTest.sol";
import {StateNamespace, IInterpreterV1, SourceIndex} from "rain.interpreter/src/interface/IInterpreterV1.sol";
import {IInterpreterStoreV1} from "rain.interpreter/src/interface/IInterpreterStoreV1.sol";
import {LibEncodedDispatch} from "rain.interpreter/src/lib/caller/LibEncodedDispatch.sol";
import {SignedContextV1} from "rain.interpreter/src/interface/IInterpreterCallerV2.sol";
import {LibContext} from "rain.interpreter/src/lib/caller/LibContext.sol";
import {LibUniswapV2, IUniswapV2Pair} from "rain.interpreter/src/lib/uniswap/LibUniswapV2.sol";
import {IUniswapV2Factory} from "rain.interpreter/lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import {EnsureFailed} from "rain.interpreter/src/lib/op/logic/LibOpEnsureNP.sol";
import "lib/rain.interpreter/lib/rain.math.fixedpoint/src/lib/LibFixedPointDecimalArithmeticOpenZeppelin.sol";
import "lib/rain.interpreter/lib/rain.math.fixedpoint/src/lib/LibFixedPointDecimalScale.sol";
import {
    rainstringSell,
    rainstringBuy,
    EXPECTED_SELL_BYTECODE,
    EXPECTED_BUY_BYTECODE,
    POLYGON_SUSHI_V2_FACTORY,
    POLYGON_USDT_TOKEN_ADDRESS,
    POLYGON_NHT_TOKEN_ADDRESS,
    APPROVED_COUNTERPARTY,
    MAX_COOLDOWN,
    POLYGON_DEPLOYER,
    Order,
    IOrderBookV3,
    IExpressionDeployerV2,
    POLYGON_ORDERBOOK,
    APPROVED_EOA,
    TakeOrderConfig,
    TakeOrdersConfigV2,
    POLYGON_ARB_CONTRACT,
    IInterpreterV1,
    IInterpreterStoreV1,
    IO,
    IERC20,
    EvaluableConfigV2,
    OrderConfigV2,
    POLYGON_INTERPRETER,
    POLYGON_STORE,
    POLYGON_USDT_HOLDER,
    POLYGON_NHT_HOLDER
} from "src/4SushiV2StratBinomial.sol";
import {LibCtPop} from "rain.interpreter/src/lib/bitwise/LibCtPop.sol"; 
import "lib/rain.interpreter/lib/rain.math.fixedpoint/src/lib/LibFixedPointDecimalArithmeticOpenZeppelin.sol";
uint256 constant CONTEXT_VAULT_IO_ROWS = 5;

string constant FORK_RPC = "https://polygon.llamarpc.com";
uint256 constant FORK_BLOCK_NUMBER = 49208332;
uint256 constant VAULT_ID = uint256(keccak256("vault")); 

address constant TEST_ORDER_OWNER = address(0x84723849238);

uint256 constant RESERVE_ZERO = 53138576564435538694955386;
// Using USDT as an example.
uint256 constant RESERVE_ONE = 12270399039;
uint32 constant RESERVE_TIMESTAMP = 1692775490;

contract Test4SushiV2StratBinomial is OpTest {
    using LibFixedPointDecimalArithmeticOpenZeppelin for uint256 ;
    using LibFixedPointDecimalScale for uint256 ;

    function constructionMetaPath() internal pure override returns (string memory) {
        return "lib/rain.interpreter/meta/RainterpreterExpressionDeployerNP.rain.meta";
    }

    function selectPolygonFork() internal {
        uint256 fork = vm.createFork(FORK_RPC);
        vm.selectFork(fork);
        vm.rollFork(FORK_BLOCK_NUMBER);
    }    

    function polygonNhtIo() internal pure returns (IO memory) {
        return IO(address(POLYGON_NHT_TOKEN_ADDRESS), 18, VAULT_ID);
    }

    function polygonUsdtIo() internal pure returns (IO memory) {
        return IO(address(POLYGON_USDT_TOKEN_ADDRESS), 6, VAULT_ID);
    } 

    function placeBuyOrderFork() internal returns (Order memory) {
        (bytes memory bytecode, uint256[] memory constants) = POLYGON_DEPLOYER.parse(rainstringBuy());
        assertEq(bytecode, EXPECTED_BUY_BYTECODE);
        return placeOrder(bytecode, constants, polygonNhtIo(), polygonUsdtIo());
    }

    function placeSellOrderFork() internal returns (Order memory order) {
        (bytes memory bytecode, uint256[] memory constants) = POLYGON_DEPLOYER.parse(rainstringSell());
        assertEq(bytecode, EXPECTED_SELL_BYTECODE);
        return placeOrder(bytecode, constants, polygonUsdtIo(), polygonNhtIo());
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

    function giveTestAccountsTokens(IERC20 token,address from, address to, uint256 amount) internal { 
        vm.startPrank(from);
        token.transfer(to, amount);
        assertEq(token.balanceOf(to), amount);
        vm.stopPrank();
    }

    function depositTokens(IERC20 token,uint256 vaultId, uint256 amount) internal {
        vm.startPrank(TEST_ORDER_OWNER);
        token.approve(address(POLYGON_ORDERBOOK), amount);
        POLYGON_ORDERBOOK.deposit(address(token), vaultId, amount);
        vm.stopPrank();
    }

    function testSellOrderHappyFork() public {
        selectPolygonFork(); 
        {   
            // Deposit more than 100$ worth NHT
            uint256 depositAmount = 4000000e18 ;
            giveTestAccountsTokens(POLYGON_NHT_TOKEN_ADDRESS,POLYGON_NHT_HOLDER,TEST_ORDER_OWNER,depositAmount);
            depositTokens(POLYGON_NHT_TOKEN_ADDRESS,VAULT_ID,depositAmount);
        } 
        Order memory sellOrder = placeSellOrderFork();

        bytes memory sellRoute = 
        //offset
        hex"0000000000000000000000000000000000000000000000000000000000000020"
        //stream length
        hex"0000000000000000000000000000000000000000000000000000000000000042"
        //command 2 = processUserERC20
        hex"02"
        //token address
        hex"84342e932797fc62814189f01f0fb05f52519708"
        //number of pools
        hex"01"
        // pool share
        hex"ffff"
        // pool type
        hex"00"
        // pool address
        hex"e427b62b495c1dfe1fe9f78bebfceb877ad05dce"
        // direction 1
        hex"01"
        // to
        hex"d1c3df3b3c5a1059fc1a123562a7215a94f34876"
        // padding
        hex"000000000000000000000000000000000000000000000000000000000000";

        for(uint256 i = 0 ; i < 10 ; i++){
            // Warp by 2hours as that could be the maximum time for the strategy.
            vm.warp(block.timestamp + 7200);  
            takeOrder(sellOrder,sellRoute);
        }      

        
    }
 
    function testBuyOrderHappyFork() public { 

        selectPolygonFork();   
        {   
            // Deposit 100 USDT.
            uint256 depositAmount = 1000e6 ;
            giveTestAccountsTokens(POLYGON_USDT_TOKEN_ADDRESS,POLYGON_USDT_HOLDER,TEST_ORDER_OWNER,depositAmount);
            depositTokens(POLYGON_USDT_TOKEN_ADDRESS,VAULT_ID,depositAmount);
        } 
        Order memory buyOrder = placeBuyOrderFork();
             
        bytes memory buyRoute = 
        //offset
        hex"0000000000000000000000000000000000000000000000000000000000000020"
        //stream length
        hex"0000000000000000000000000000000000000000000000000000000000000042"
        //command 2 = processUserERC20
        hex"02"
        //token address
        hex"c2132d05d31c914a87c6611c10748aeb04b58e8f"
        // number of pools
        hex"01"
        // pool share
        hex"ffff"
        // pool type
        hex"00"
        // pool address
        hex"e427b62b495c1dfe1fe9f78bebfceb877ad05dce"
        // direction 0
        hex"00"
        // to
        hex"d1c3df3b3c5a1059fc1a123562a7215a94f34876"
        // padding
        hex"000000000000000000000000000000000000000000000000000000000000";  

        for(uint256 i = 0 ; i < 10 ; i++){
            // Warping by 2 hours as that is the maximum time. 
            vm.warp(block.timestamp + 7200);
            takeOrder(buyOrder,buyRoute);  
        } 
        
    } 

    function takeOrder(Order memory order, bytes memory route) internal {
        assertTrue(POLYGON_ORDERBOOK.orderExists(keccak256(abi.encode(order))), "order exists");
        vm.startPrank(APPROVED_EOA);
        uint256 inputIOIndex = 0;
        uint256 outputIOIndex = 0;
        TakeOrderConfig[] memory innerConfigs = new TakeOrderConfig[](1); 
        
        innerConfigs[0] = TakeOrderConfig(order, inputIOIndex, outputIOIndex, new SignedContextV1[](0));
        uint256 outputTokenBalance = POLYGON_ORDERBOOK.vaultBalance(order.owner,order.validOutputs[0].token,order.validOutputs[0].vaultId); 
        TakeOrdersConfigV2 memory takeOrdersConfig =
            TakeOrdersConfigV2(0, outputTokenBalance, type(uint256).max, innerConfigs, route);
        POLYGON_ARB_CONTRACT.arb(takeOrdersConfig, 0);
        vm.stopPrank();
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

    function test4StratBuyNHTHappyPath(uint256 orderHash, uint16 startTime) public {
        uint256 reserve0 = 53138576564435538694955386;
        uint256 reserve1 = 12270399039;
        uint32 reserveTimestamp = 1692775490;
        uint256 lastTime = 0;
        vm.warp(reserveTimestamp + startTime + 1);

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

        {
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
        }

        IInterpreterV1 interpreterDeployer;
        IInterpreterStoreV1 storeDeployer;
        address expression;
        {
            (bytes memory bytecode, uint256[] memory constants) = iDeployer.parse(rainstringBuy());
            assertEq(bytecode, EXPECTED_BUY_BYTECODE);
            uint256[] memory minOutputs = new uint256[](1);
            minOutputs[0] = 0;
            (interpreterDeployer, storeDeployer, expression) =
                iDeployer.deployExpression(bytecode, constants, minOutputs);
        }

        // At this point the cooldown has never triggered so it can eval.
        (uint256[] memory stack, uint256[] memory kvs) = interpreterDeployer.eval(
            storeDeployer,
            StateNamespace.wrap(0),
            LibEncodedDispatch.encode(expression, SourceIndex.wrap(0), type(uint16).max),
            context
        );
        storeDeployer.set(StateNamespace.wrap(0), kvs);
        checkBuyCalculate(stack, kvs, orderHash, lastTime, reserveTimestamp);
        lastTime = block.timestamp;

        // Check the first cooldown against what we expect.
        // last time is 0 originally.
        uint256 cooldown0 = cooldown(block.timestamp);
        vm.warp(block.timestamp + cooldown0);

        // At this point the cooldown is not expired.
        vm.expectRevert(abi.encodeWithSelector(EnsureFailed.selector, 1, 0));
        (stack, kvs) = interpreterDeployer.eval(
            storeDeployer,
            StateNamespace.wrap(0),
            LibEncodedDispatch.encode(expression, SourceIndex.wrap(0), type(uint16).max),
            context
        );
        (stack, kvs);

        // The cooldown is expired one second later.
        vm.warp(block.timestamp + 1);
        (stack, kvs) = interpreterDeployer.eval(
            storeDeployer,
            StateNamespace.wrap(0),
            LibEncodedDispatch.encode(expression, SourceIndex.wrap(0), type(uint16).max),
            context
        );
        storeDeployer.set(StateNamespace.wrap(0), kvs);
        checkBuyCalculate(stack, kvs, orderHash, lastTime, reserveTimestamp);
    }

    function test4StratSellNHTHappyPath(uint256 orderHash, uint16 startTime) public {
        uint256 lastTime = 0;
        vm.warp(RESERVE_TIMESTAMP + startTime + 1);

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

        {
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
                abi.encode(RESERVE_ZERO, RESERVE_ONE, RESERVE_TIMESTAMP)
            );
        }

        IInterpreterV1 interpreterDeployer;
        IInterpreterStoreV1 storeDeployer;
        address expression;
        {
            (bytes memory bytecode, uint256[] memory constants) = iDeployer.parse(rainstringSell());
            assertEq(bytecode, EXPECTED_SELL_BYTECODE);
            uint256[] memory minOutputs = new uint256[](1);
            minOutputs[0] = 0;
            (interpreterDeployer, storeDeployer, expression) =
                iDeployer.deployExpression(bytecode, constants, minOutputs);
        }

        // At this point the cooldown has never triggered so it can eval.
        (uint256[] memory stack, uint256[] memory kvs) = interpreterDeployer.eval(
            storeDeployer,
            StateNamespace.wrap(0),
            LibEncodedDispatch.encode(expression, SourceIndex.wrap(0), type(uint16).max),
            context
        );
        storeDeployer.set(StateNamespace.wrap(0), kvs);
        checkSellCalculate(stack, kvs, orderHash, lastTime, RESERVE_TIMESTAMP);
        lastTime = block.timestamp;

        // Check the first cooldown against what we expect.
        // last time is 0 originally.
        vm.warp(block.timestamp + cooldown(block.timestamp));

        // At this point the cooldown is not expired.
        vm.expectRevert(abi.encodeWithSelector(EnsureFailed.selector, 1, 0));
        (stack, kvs) = interpreterDeployer.eval(
            storeDeployer,
            StateNamespace.wrap(0),
            LibEncodedDispatch.encode(expression, SourceIndex.wrap(0), type(uint16).max),
            context
        );
        (stack, kvs);

        // The cooldown is expired one second later.
        vm.warp(block.timestamp + 1);
        (stack, kvs) = interpreterDeployer.eval(
            storeDeployer,
            StateNamespace.wrap(0),
            LibEncodedDispatch.encode(expression, SourceIndex.wrap(0), type(uint16).max),
            context
        );
        storeDeployer.set(StateNamespace.wrap(0), kvs);
        checkSellCalculate(stack, kvs, orderHash, lastTime, RESERVE_TIMESTAMP);
    }

    function jitteryBinomial(uint256 input) internal pure returns (uint256) {
        uint256 binomial = LibCtPop.ctpop(uint256(keccak256(abi.encodePacked(input)))) * 1e18;
        uint256 noise = uint256(keccak256(abi.encodePacked(input, uint256(0)))) % 1e18;

        uint256 jittery = binomial + noise - 5e17;

        return jittery.fixedPointDiv(256e18,Math.Rounding.Down) ;

    }

    function cooldown(uint256 seed) internal pure returns (uint256) {
        uint256 multiplier = jitteryBinomial(uint256(keccak256(abi.encodePacked(seed))));
        return MAX_COOLDOWN * multiplier / 1e18;
    }

    function checkSellCalculate(
        uint256[] memory stack,
        uint256[] memory kvs,
        uint256 orderHash,
        uint256 lastTime,
        uint256 sushiLastTime
    ) internal {
        // always track the timestamp that cooldowns are relative to.
        assertEq(kvs.length, 2);
        assertEq(kvs[0], orderHash);
        assertEq(kvs[1], block.timestamp);

        assertEq(stack.length, 19);

        // addresses
        // sushi factory
        assertEq(stack[0], uint256(uint160(address(POLYGON_SUSHI_V2_FACTORY))));
        // nht token
        assertEq(stack[1], uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS))));
        // usdt token
        assertEq(stack[2], uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS))));
        // approved counterparty
        assertEq(stack[3], uint256(uint160(APPROVED_COUNTERPARTY)));
        // actual counterparty
        assertEq(stack[4], uint256(uint160(APPROVED_COUNTERPARTY)));
        // order hash
        assertEq(stack[5], orderHash);
        // last time
        assertEq(stack[6], lastTime);
        // max usdt amount
        assertEq(stack[7], 100e18);
        // amount random multiplier
        assertEq(stack[8], jitteryBinomial(lastTime));
        // target usdt amount e18
        assertEq(stack[9], 100e18 * jitteryBinomial(lastTime) / 1e18);
        // target usdt amount e6
        assertEq(stack[10], stack[9].scaleN(6,1));
        // max cooldown e18
        assertEq(stack[11], MAX_COOLDOWN * 1e18);
        // cooldown random multiplier 18
        assertEq(stack[12], jitteryBinomial(uint256(keccak256(abi.encode(lastTime)))));
        // cooldown e18
        assertEq(stack[13], stack[11].fixedPointMul(stack[12],Math.Rounding.Up) );
        // cooldown e0
        assertEq(stack[14], stack[13].scaleN(0,0));
        // last price timestamp
        assertEq(stack[15], sushiLastTime);
        // nht amount 18
        assertEq(stack[16], LibUniswapV2.getAmountIn(stack[10], RESERVE_ZERO, RESERVE_ONE));
        // amount is nht amount 18
        assertEq(stack[17], stack[16]);
        // ratio is the usdt 18 amount divided by the nht 18 amount
        assertEq(stack[18], stack[9].fixedPointDiv(stack[16],Math.Rounding.Down));
    }

    function checkBuyCalculate(
        uint256[] memory stack,
        uint256[] memory kvs,
        uint256 orderHash,
        uint256 lastTime,
        uint256 sushiLastTime
    ) internal {
        // always track the timestamp that cooldowns are relative to.
        assertEq(kvs.length, 2);
        assertEq(kvs[0], orderHash);
        assertEq(kvs[1], block.timestamp);

        assertEq(stack.length, 19);

        // addresses
        // sushi factory
        assertEq(stack[0], uint256(uint160(address(POLYGON_SUSHI_V2_FACTORY))));
        // nht token
        assertEq(stack[1], uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS))));
        // usdt token
        assertEq(stack[2], uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS))));
        // approved counterparty
        assertEq(stack[3], uint256(uint160(APPROVED_COUNTERPARTY)));
        // actual counterparty
        assertEq(stack[4], uint256(uint160(APPROVED_COUNTERPARTY)));
        // order hash
        assertEq(stack[5], orderHash);
        // last time
        assertEq(stack[6], lastTime);
        // max usdt amount
        assertEq(stack[7], 100e18);
        // amount random multiplier
        assertEq(stack[8], jitteryBinomial(lastTime));
        // target usdt amount e18
        assertEq(stack[9], 100e18 * jitteryBinomial(lastTime) / 1e18);
        // target usdt amount e6
        assertEq(stack[10], stack[9] / 1e12);
        // max cooldown e18
        assertEq(stack[11], MAX_COOLDOWN * 1e18);
        // cooldown random multiplier 18
        assertEq(stack[12], jitteryBinomial(uint256(keccak256(abi.encode(lastTime)))));
        // cooldown e18
        assertEq(stack[13], stack[11] * stack[12] / 1e18);
        // cooldown e0
        assertEq(stack[14], stack[13] / 1e18);
        // last price timestamp
        assertEq(stack[15], sushiLastTime);
        // nht amount 18
        assertEq(stack[16], LibUniswapV2.getAmountOut(stack[10], RESERVE_ONE, RESERVE_ZERO));
        // amount is usdt amount 18
        assertEq(stack[17], stack[9]);
        // io ratio is the nht amount 18 divided by the usdt 18 amount
        assertEq(stack[18], stack[16] * 1e18 / stack[9]);
    }
} 