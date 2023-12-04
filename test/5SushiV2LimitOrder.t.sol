// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import "test/lib/OrderBookNPE2Real.sol";
import {console2} from "forge-std/console2.sol";
import {
    rainstringLimitOrder,
    ORDER_INIT_RATIO,
    AMOUNT_PER_BATCH,
    INCR_PER_BATCH
} from "src/5SushiV2LimitOrder.sol";
import {
    POLYGON_PARSER_NPE2,
    POLYGON_NHT_TOKEN_ADDRESS,
    POLYGON_USDT_TOKEN_ADDRESS,
    APPROVED_COUNTERPARTY,
    POLYGON_NHT_TOKEN_DECIMALS,
    POLYGON_USDT_TOKEN_DECIMALS
} from "src/4SushiV2StratBinomial.sol";
import "rain.interpreter/lib/rain.math.fixedpoint/src/lib/LibFixedPointDecimalArithmeticOpenZeppelin.sol";
import "rain.interpreter/lib/rain.math.fixedpoint/src/lib/LibFixedPointDecimalScale.sol";

contract Test4SushiV2LimitOrder is OrderBookNPE2Real {
    using LibFixedPointDecimalArithmeticOpenZeppelin for uint256;
    using LibFixedPointDecimalScale for uint256;  

    string constant FORK_RPC = "https://polygon.llamarpc.com";
    uint256 constant FORK_BLOCK_NUMBER = 50654283;

    uint32 constant RESERVE_TIMESTAMP = 1701608565;

    uint256 constant CONTEXT_VAULT_IO_ROWS = 5;

    struct LimitOrder{
        uint256 orderHash;
        uint256[] stack;
        uint256 balanceDiff;
    }

    function selectPolygonFork() internal {
        uint256 fork = vm.createFork(FORK_RPC);
        vm.selectFork(fork);
        vm.rollFork(FORK_BLOCK_NUMBER);
    } 

    function encode(uint256 startBit, uint256 length, uint256 target, uint256 source) internal returns(uint256){
        uint256 mask = (2 ** length - 1);
        // Punch a mask sized hole in target.
        target &= ~(mask << startBit);
        // Fill the hole with masked bytes from source.
        target |= (source & mask) << startBit;
        return target;
    }

    function decode(uint256 startBit, uint256 length, uint256 target) internal returns(uint256){
        uint256 mask = (2 ** length) - 1;
        return (target >> startBit) & mask;
    }

    function testLimitOrderReal() public {
        // vm.assume(balanceDiff > 1 && balanceDiff <= 1000e6);
        vm.warp(RESERVE_TIMESTAMP);

        uint256 orderHash = 123456789;
        uint256 vaultId = 11223344;
        uint256 balanceDiff = 1000e6;
        
        uint256[][] memory context = new uint256[][](5);
        {
            {
                uint256[] memory baseContext = new uint256[](2);
                context[0] = baseContext;
            }
            {
                uint256[] memory callingContext = new uint256[](3);
                // order hash
                callingContext[0] = orderHash;
                // owner
                callingContext[1] = uint256(uint160(address(this)));
                // counterparty
                callingContext[2] = uint256(uint160(APPROVED_COUNTERPARTY));
                context[1] = callingContext;
            }
            {
                uint256[] memory calculationsContext = new uint256[](0);
                context[2] = calculationsContext;
            }
            {
                uint256[] memory inputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
                inputsContext[0] = uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS)));
                inputsContext[1] = POLYGON_USDT_TOKEN_DECIMALS ;
                inputsContext[2] = vaultId;
                inputsContext[3] = balanceDiff;
                inputsContext[4] = balanceDiff; 

                context[3] = inputsContext;
            }
            {
                uint256[] memory outputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
                outputsContext[0] = uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS)));
                context[4] = outputsContext;
            }
        }
        uint256[] memory inputs = new uint256[](0);

        (bytes memory bytecode, uint256[] memory constants) = iParseExpression(rainstringLimitOrder());

        address interpreter;
        address store;
        address expression;
        {
            (interpreter,store,expression) = iDeployExpression(bytecode,constants);
        } 

        LimitOrder memory limitOrder;

        for(uint256 i = 0 ; i < 10 ; i++){ 
            console2.log("------------");

            {   
                (uint256[] memory stack,uint256[] memory kvs) = iEvalExpressionWithIndex(expression,0,interpreter,store,context,inputs); 
                limitOrder = LimitOrder(orderHash,stack,0);
                checkCalculateStack(limitOrder);
                IInterpreterStoreV1(store).set(StateNamespace.wrap(0), kvs);                
            }
            
            {
                (uint256[] memory stack,uint256[] memory kvs) = iEvalExpressionWithIndex(expression,1,interpreter,store,context,inputs); 
                IInterpreterStoreV1(store).set(StateNamespace.wrap(0), kvs);
            } 
            

            
            vm.warp(block.timestamp + 3600 + 1);
        }

    }  

    function calculateBatch(uint256 orderHash, uint256 newReceived18, uint256 decimals) internal returns(uint256,uint256,uint256){ 

        newReceived18 = newReceived18.scale18(decimals,0);

        FullyQualifiedNamespace namespace = LibNamespace.qualifyNamespace(StateNamespace.wrap(0), address(this));
        uint256 totalReceivedKey = uint256(keccak256(abi.encodePacked(orderHash))); 

        uint256 totalReceived = IInterpreterStoreV1(address(iStore)).get(namespace, totalReceivedKey);
        uint256 newTotalReceived =  totalReceived + newReceived18;


        uint256 newBatchIndex = newTotalReceived / AMOUNT_PER_BATCH ;

        uint256 newBatchRemaining = ((newBatchIndex + 1) * AMOUNT_PER_BATCH) - newTotalReceived ;
        // console2.log("newBatchRemaining : ",newBatchRemaining);
        return(newTotalReceived,newBatchIndex,newBatchRemaining ) ;

    }
    
    function checkCalculateStack(
        LimitOrder memory limitOrder
    ) internal {

        uint256[] memory stack = limitOrder.stack;
        uint256 orderHash = limitOrder.orderHash; 
        uint256 diff = limitOrder.balanceDiff;
        (uint256 newTotalReceived,uint256 batchIndex,uint256 batchRemaining) = calculateBatch(orderHash,diff,POLYGON_USDT_TOKEN_DECIMALS);


        FullyQualifiedNamespace namespace = LibNamespace.qualifyNamespace(StateNamespace.wrap(0), address(this));
        uint256 batchStartInfo = IInterpreterStoreV1(address(iStore)).get(namespace, orderHash) ;
        uint256 batchStartTime = decode(32,32,batchStartInfo);
        uint256 ratioIncrement = (batchIndex == 0) ? 1e18 : (INCR_PER_BATCH ** batchIndex) ;
        uint256 ioRatio = ORDER_INIT_RATIO.fixedPointMul(ratioIncrement,Math.Rounding.Down);
        console2.log("ioRatio : ",ioRatio);

        uint256 amount = batchRemaining.fixedPointDiv(ioRatio,Math.Rounding.Down);


        assertEq(stack[9], uint256(uint160(address(APPROVED_COUNTERPARTY))), "stack 9");

        assertEq(stack[8], uint256(uint160(address(APPROVED_COUNTERPARTY))), "stack 8");

        assertEq(stack[7], orderHash, "stack 7");

        assertEq(stack[6], batchStartInfo, "stack 6"); 

        assertEq(stack[5], batchStartTime, "stack 5");
        
        assertEq(stack[4], batchIndex, "stack 4");
        assertEq(stack[3], batchRemaining, "stack 3");
        assertEq(stack[2], ioRatio, "stack 2");
        assertEq(stack[1], amount, "stack 1");
        assertEq(stack[0], ioRatio, "stack 0");
        
    }

    function testExp() public { 

        // bytes memory exp = 
        // "batch-index: 0,"
        // "res: decimal18-mul(25e13 if(batch-index int-exp(101e16 batch-index) 1e18));"; 

        // (bytes memory bytecode, uint256[] memory constants) = iParseExpression(exp);
        // (address i,address s,address expression) = iDeployExpression(bytecode,constants);

        // uint256[] memory inputs = new uint256[](0);
        // uint256[][] memory context = new uint256[][](0);

        // (uint256[] memory stack, uint256[] memory kvs) = iEvalExpression(expression,i,s,context,inputs); 

        // for(uint256 i = 0 ; i < stack.length ; i++){
        //     console2.log("stack : ", stack[i]);
        // } 

        // uint256 res = 101e16 ** 9;
    }
}
