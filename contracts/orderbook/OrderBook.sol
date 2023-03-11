// SPDX-License-Identifier: CAL
pragma solidity =0.8.17;

import "./IOrderBookV1.sol";
import "./LibOrder.sol";
import "../interpreter/run/LibStackPointer.sol";
import "../math/LibFixedPointMath.sol";
import "../interpreter/ops/AllStandardOps.sol";
import "./OrderBookFlashLender.sol";
import "../interpreter/run/LibEncodedDispatch.sol";
import "../interpreter/caller/LibContext.sol";
import "../interpreter/caller/InterpreterCallerV1.sol";
import "./LibOrderBook.sol";

import {MulticallUpgradeable as Multicall} from "@openzeppelin/contracts-upgradeable/utils/MulticallUpgradeable.sol";
import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable as SafeERC20} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {ReentrancyGuardUpgradeable as ReentrancyGuard} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/// Thrown when the `msg.sender` modifying an order is not its owner.
/// @param sender `msg.sender` attempting to modify the order.
/// @param owner The owner of the order.
error NotOrderOwner(address sender, address owner);

/// Thrown when the input and output tokens don't match, in either direction.
/// @param a The input or output of one order.
/// @param b The input or output of the other order that doesn't match a.
error TokenMismatch(address a, address b);

/// Thrown when the minimum input is not met.
/// @param minimumInput The minimum input required.
/// @param input The input that was achieved.
error MinimumInput(uint256 minimumInput, uint256 input);

/// Thrown when two orders have the same owner during clear.
/// @param owner The owner of both orders.
error SameOwner(address owner);

bytes32 constant CALLER_META_HASH = bytes32(
    0x09245f242fc54e6dd9fcb650f8b8f226bed3b424cd80a009de53648c5aaffc92
);

/// @dev Value that signifies that an order is live in the internal mapping.
/// Anything nonzero is equally useful.
uint256 constant LIVE_ORDER = 1;

/// @dev Value that signifies that an order is dead in the internal mapping.
uint256 constant DEAD_ORDER = 0;

/// @dev Entrypoint to a calculate the amount and ratio of an order.
SourceIndex constant CALCULATE_ORDER_ENTRYPOINT = SourceIndex.wrap(0);
/// @dev Entrypoint to handle the final internal vault movements resulting from
/// matching multiple calculated orders.
SourceIndex constant HANDLE_IO_ENTRYPOINT = SourceIndex.wrap(1);

/// @dev Minimum outputs for calculate order are the amount and ratio.
uint256 constant CALCULATE_ORDER_MIN_OUTPUTS = 2;
/// @dev Maximum outputs for calculate order are the amount and ratio.
uint256 constant CALCULATE_ORDER_MAX_OUTPUTS = 2;

/// @dev Handle IO has no outputs as it only responds to vault movements.
uint256 constant HANDLE_IO_MIN_OUTPUTS = 0;
/// @dev Handle IO has no outputs as it only response to vault movements.
uint256 constant HANDLE_IO_MAX_OUTPUTS = 0;

/// @dev Orderbook context is actually fairly complex. The calling context column
/// is populated before calculate order, but the remaining columns are only
/// available to handle IO as they depend on the full evaluation of calculuate
/// order, and cross referencing against the same from the counterparty, as well
/// as accounting limits such as current vault balances, etc.
/// The token address and decimals for vault inputs and outputs IS available to
/// the calculate order entrypoint, but not the final vault balances/diff.
uint256 constant CONTEXT_COLUMNS = 4;
/// @dev Contextual data available to both calculate order and handle IO. The
/// order hash, order owner and order counterparty. IMPORTANT NOTE that the
/// typical base context of an order with the caller will often be an unrelated
/// clearer of the order rather than the owner or counterparty.
uint256 constant CONTEXT_CALLING_CONTEXT_COLUMN = 0;
/// @dev Calculations column contains the DECIMAL RESCALED calculations but
/// otherwise provided as-is according to calculate order entrypoint
uint256 constant CONTEXT_CALCULATIONS_COLUMN = 1;
/// @dev Vault inputs are the literal token amounts and vault balances before and
/// after for the input token from the perspective of the order. MAY be
/// significantly different to the calculated amount due to insufficient vault
/// balances from either the owner or counterparty, etc.
uint256 constant CONTEXT_VAULT_INPUTS_COLUMN = 2;
/// @dev Vault outputs are the same as vault inputs but for the output token from
/// the perspective of the order.
uint256 constant CONTEXT_VAULT_OUTPUTS_COLUMN = 3;

/// @dev Row of the token address for vault inputs and outputs columns.
uint256 constant CONTEXT_VAULT_IO_TOKEN = 0;
/// @dev Row of the token decimals for vault inputs and outputs columns.
uint256 constant CONTEXT_VAULT_IO_TOKEN_DECIMALS = 1;
/// @dev Row of the vault ID for vault inputs and outputs columns.
uint256 constant CONTEXT_VAULT_IO_VAULT_ID = 2;
/// @dev Row of the vault balance before the order was cleared for vault inputs
/// and outputs columns.
uint256 constant CONTEXT_VAULT_IO_BALANCE_BEFORE = 3;
/// @dev Row of the vault balance difference after the order was cleared for
/// vault inputs and outputs columns. The diff is ALWAYS POSITIVE as it is a
/// `uint256` so it must be added to input balances and subtraced from output
/// balances.
uint256 constant CONTEXT_VAULT_IO_BALANCE_DIFF = 4;
/// @dev Length of a vault IO column.
uint256 constant CONTEXT_VAULT_IO_ROWS = 5;

/// @title OrderBook
/// See `IOrderBookV1` for more documentation.
contract OrderBook is
    IOrderBookV1,
    ReentrancyGuard,
    Multicall,
    OrderBookFlashLender,
    InterpreterCallerV1
{
    using LibInterpreterState for bytes;
    using LibStackPointer for StackPointer;
    using LibStackPointer for uint256[];
    using LibUint256Array for uint256[];
    using SafeERC20 for IERC20;
    using Math for uint256;
    using LibFixedPointMath for uint256;
    using LibOrder for Order;
    using LibInterpreterState for InterpreterState;
    using LibUint256Array for uint256;

    /// All hashes of all active orders. There's nothing interesting in the value
    /// it's just nonzero if the order is live. The key is the hash of the order.
    /// Removing an order sets the value back to zero so it is identical to the
    /// order never existing and gives a gas refund on removal.
    /// The order hash includes its owner so there's no need to build a multi
    /// level mapping, each order hash MUST uniquely identify the order globally.
    /// order hash => order is live
    mapping(uint256 => uint256) internal orders;

    /// @inheritdoc IOrderBookV1
    mapping(address => mapping(address => mapping(uint256 => uint256)))
        public vaultBalance;

    /// Initializes the orderbook upon construction for compatibility with
    /// Open Zeppelin upgradeable contracts. Orderbook itself does NOT support
    /// factory deployments as each order is a unique expression deployment
    /// rather than needing to wrap up expressions with proxies.
    constructor(
        InterpreterCallerV1ConstructionConfig memory config_
    ) initializer InterpreterCallerV1(CALLER_META_HASH, config_) {
        __ReentrancyGuard_init();
        __Multicall_init();
    }

    /// @inheritdoc IOrderBookV1
    function deposit(DepositConfig calldata config_) external nonReentrant {
        // It is safest with vault deposits to move tokens in to the Orderbook
        // before updating internal vault balances although we have a reentrancy
        // guard in place anyway.
        emit Deposit(msg.sender, config_);
        IERC20(config_.token).safeTransferFrom(
            msg.sender,
            address(this),
            config_.amount
        );
        vaultBalance[msg.sender][config_.token][config_.vaultId] += config_
            .amount;
    }

    /// @inheritdoc IOrderBookV1
    function withdraw(WithdrawConfig calldata config_) external nonReentrant {
        uint256 vaultBalance_ = vaultBalance[msg.sender][config_.token][
            config_.vaultId
        ];
        uint256 withdrawAmount_ = config_.amount.min(vaultBalance_);
        // The overflow check here is redundant with .min above, so technically
        // this is overly conservative but we REALLY don't want withdrawals to
        // exceed vault balances.
        vaultBalance[msg.sender][config_.token][config_.vaultId] =
            vaultBalance_ -
            withdrawAmount_;
        emit Withdraw(msg.sender, config_, withdrawAmount_);
        _decreaseFlashDebtThenSendToken(
            config_.token,
            msg.sender,
            withdrawAmount_
        );
    }

    /// @inheritdoc IOrderBookV1
    function addOrder(OrderConfig calldata config_) external nonReentrant {
        (
            IInterpreterV1 interpreter_,
            IInterpreterStoreV1 store_,
            address expression_
        ) = config_.evaluableConfig.deployer.deployExpression(
                config_.evaluableConfig.sources,
                config_.evaluableConfig.constants,
                LibUint256Array.arrayFrom(
                    CALCULATE_ORDER_MIN_OUTPUTS,
                    HANDLE_IO_MIN_OUTPUTS
                )
            );
        Order memory order_ = Order(
            msg.sender,
            config_
                .evaluableConfig
                .sources[SourceIndex.unwrap(HANDLE_IO_ENTRYPOINT)]
                .length > 0,
            Evaluable(interpreter_, store_, expression_),
            config_.validInputs,
            config_.validOutputs,
            config_.data
        );
        uint256 orderHash_ = order_.hash();
        orders[orderHash_] = LIVE_ORDER;
        emit AddOrder(
            msg.sender,
            config_.evaluableConfig.deployer,
            order_,
            orderHash_
        );
    }

    function _calculateOrderDispatch(
        address expression_
    ) internal pure returns (EncodedDispatch) {
        return
            LibEncodedDispatch.encode(
                expression_,
                CALCULATE_ORDER_ENTRYPOINT,
                CALCULATE_ORDER_MAX_OUTPUTS
            );
    }

    function _handleIODispatch(
        address expression_
    ) internal pure returns (EncodedDispatch) {
        return
            LibEncodedDispatch.encode(
                expression_,
                HANDLE_IO_ENTRYPOINT,
                HANDLE_IO_MAX_OUTPUTS
            );
    }

    /// @inheritdoc IOrderBookV1
    function removeOrder(Order calldata order_) external nonReentrant {
        if (msg.sender != order_.owner) {
            revert NotOrderOwner(msg.sender, order_.owner);
        }
        uint256 orderHash_ = order_.hash();
        delete (orders[orderHash_]);
        emit RemoveOrder(msg.sender, order_, orderHash_);
    }

    /// @inheritdoc IOrderBookV1
    function takeOrders(
        TakeOrdersConfig calldata takeOrders_
    )
        external
        nonReentrant
        returns (uint256 totalInput_, uint256 totalOutput_)
    {
        uint256 i_ = 0;
        TakeOrderConfig memory takeOrder_;
        Order memory order_;
        uint256 remainingInput_ = takeOrders_.maximumInput;
        while (i_ < takeOrders_.orders.length && remainingInput_ > 0) {
            takeOrder_ = takeOrders_.orders[i_];
            order_ = takeOrder_.order;
            uint256 orderHash_ = order_.hash();
            if (orders[orderHash_] == DEAD_ORDER) {
                emit OrderNotFound(msg.sender, order_.owner, orderHash_);
            } else {
                if (
                    order_.validInputs[takeOrder_.inputIOIndex].token !=
                    takeOrders_.output
                ) {
                    revert TokenMismatch(
                        order_.validInputs[takeOrder_.inputIOIndex].token,
                        takeOrders_.output
                    );
                }
                if (
                    order_.validOutputs[takeOrder_.outputIOIndex].token !=
                    takeOrders_.input
                ) {
                    revert TokenMismatch(
                        order_.validOutputs[takeOrder_.outputIOIndex].token,
                        takeOrders_.input
                    );
                }

                OrderIOCalculation
                    memory orderIOCalculation_ = _calculateOrderIO(
                        order_,
                        takeOrder_.inputIOIndex,
                        takeOrder_.outputIOIndex,
                        msg.sender
                    );

                // Skip orders that are too expensive rather than revert as we have
                // no way of knowing if a specific order becomes too expensive
                // between submitting to mempool and execution, but other orders may
                // be valid so we want to take advantage of those if possible.
                if (orderIOCalculation_.IORatio > takeOrders_.maximumIORatio) {
                    emit OrderExceedsMaxRatio(
                        msg.sender,
                        order_.owner,
                        orderHash_
                    );
                } else if (orderIOCalculation_.outputMax == 0) {
                    emit OrderZeroAmount(msg.sender, order_.owner, orderHash_);
                } else {
                    // Don't exceed the maximum total input.
                    uint256 input_ = remainingInput_.min(
                        orderIOCalculation_.outputMax
                    );
                    // Always round IO calculations up.
                    uint256 output_ = input_.fixedPointMul(
                        orderIOCalculation_.IORatio,
                        Math.Rounding.Up
                    );

                    remainingInput_ -= input_;
                    totalOutput_ += output_;

                    _recordVaultIO(
                        order_,
                        output_,
                        input_,
                        orderIOCalculation_
                    );
                    emit TakeOrder(msg.sender, takeOrder_, input_, output_);
                }
            }

            unchecked {
                i_++;
            }
        }
        totalInput_ = takeOrders_.maximumInput - remainingInput_;

        if (totalInput_ < takeOrders_.minimumInput) {
            revert MinimumInput(takeOrders_.minimumInput, totalInput_);
        }

        // We already updated vault balances before we took tokens from
        // `msg.sender` which is usually NOT the correct order of operations for
        // depositing to a vault. We rely on reentrancy guards to make this safe.
        IERC20(takeOrders_.output).safeTransferFrom(
            msg.sender,
            address(this),
            totalOutput_
        );
        // Prioritise paying down any active flash loans before sending any
        // tokens to `msg.sender`.
        _decreaseFlashDebtThenSendToken(
            takeOrders_.input,
            msg.sender,
            totalInput_
        );
    }

    /// @inheritdoc IOrderBookV1
    function clear(
        Order memory a_,
        Order memory b_,
        ClearConfig calldata clearConfig_
    ) external nonReentrant {
        {
            if (a_.owner == b_.owner) {
                revert SameOwner(a_.owner);
            }
            if (
                a_.validOutputs[clearConfig_.aOutputIOIndex].token !=
                b_.validInputs[clearConfig_.bInputIOIndex].token
            ) {
                revert TokenMismatch(
                    a_.validOutputs[clearConfig_.aOutputIOIndex].token,
                    b_.validInputs[clearConfig_.bInputIOIndex].token
                );
            }

            if (
                b_.validOutputs[clearConfig_.bOutputIOIndex].token !=
                a_.validInputs[clearConfig_.aInputIOIndex].token
            ) {
                revert TokenMismatch(
                    b_.validOutputs[clearConfig_.bOutputIOIndex].token,
                    a_.validInputs[clearConfig_.aInputIOIndex].token
                );
            }

            // If either order is dead the clear is a no-op other than emitting
            // `OrderNotFound`. Returning rather than erroring makes it easier to
            // bulk clear using `Multicall`.
            if (orders[a_.hash()] == DEAD_ORDER) {
                emit OrderNotFound(msg.sender, a_.owner, a_.hash());
                return;
            }
            if (orders[b_.hash()] == DEAD_ORDER) {
                emit OrderNotFound(msg.sender, b_.owner, b_.hash());
                return;
            }

            // Emit the Clear event before `eval`.
            emit Clear(msg.sender, a_, b_, clearConfig_);
        }
        OrderIOCalculation memory aOrderIOCalculation_ = _calculateOrderIO(
            a_,
            clearConfig_.aInputIOIndex,
            clearConfig_.aOutputIOIndex,
            b_.owner
        );
        OrderIOCalculation memory bOrderIOCalculation_ = _calculateOrderIO(
            b_,
            clearConfig_.bInputIOIndex,
            clearConfig_.bOutputIOIndex,
            a_.owner
        );
        ClearStateChange memory clearStateChange_ = LibOrderBook
            ._clearStateChange(aOrderIOCalculation_, bOrderIOCalculation_);

        _recordVaultIO(
            a_,
            clearStateChange_.aInput,
            clearStateChange_.aOutput,
            aOrderIOCalculation_
        );
        _recordVaultIO(
            b_,
            clearStateChange_.bInput,
            clearStateChange_.bOutput,
            bOrderIOCalculation_
        );

        {
            // At least one of these will overflow due to negative bounties if
            // there is a spread between the orders.
            uint256 aBounty_ = clearStateChange_.aOutput -
                clearStateChange_.bInput;
            uint256 bBounty_ = clearStateChange_.bOutput -
                clearStateChange_.aInput;
            if (aBounty_ > 0) {
                vaultBalance[msg.sender][
                    a_.validOutputs[clearConfig_.aOutputIOIndex].token
                ][clearConfig_.aBountyVaultId] += aBounty_;
            }
            if (bBounty_ > 0) {
                vaultBalance[msg.sender][
                    b_.validOutputs[clearConfig_.bOutputIOIndex].token
                ][clearConfig_.bBountyVaultId] += bBounty_;
            }
        }

        emit AfterClear(msg.sender, clearStateChange_);
    }

    /// Main entrypoint into an order calculates the amount and IO ratio. Both
    /// are always treated as 18 decimal fixed point values and then rescaled
    /// according to the order's definition of each token's actual fixed point
    /// decimals.
    /// @param order_ The order to evaluate.
    /// @param inputIOIndex_ The index of the input token being calculated for.
    /// @param outputIOIndex_ The index of the output token being calculated for.
    /// @param counterparty_ The counterparty of the order as it is currently
    /// being cleared against.
    function _calculateOrderIO(
        Order memory order_,
        uint256 inputIOIndex_,
        uint256 outputIOIndex_,
        address counterparty_
    ) internal view virtual returns (OrderIOCalculation memory) {
        unchecked {
            uint256 orderHash_ = order_.hash();
            uint256[][] memory context_ = new uint256[][](CONTEXT_COLUMNS);

            {
                context_[CONTEXT_CALLING_CONTEXT_COLUMN] = LibUint256Array
                    .arrayFrom(
                        orderHash_,
                        uint256(uint160(order_.owner)),
                        uint256(uint160(counterparty_))
                    );

                context_[CONTEXT_VAULT_INPUTS_COLUMN] = LibUint256Array
                    .arrayFrom(
                        uint256(
                            uint160(order_.validInputs[inputIOIndex_].token)
                        ),
                        order_.validInputs[inputIOIndex_].decimals,
                        order_.validInputs[inputIOIndex_].vaultId,
                        vaultBalance[order_.owner][
                            order_.validInputs[inputIOIndex_].token
                        ][order_.validInputs[inputIOIndex_].vaultId],
                        // Don't know the balance diff yet!
                        0
                    );

                context_[CONTEXT_VAULT_OUTPUTS_COLUMN] = LibUint256Array
                    .arrayFrom(
                        uint256(
                            uint160(order_.validOutputs[outputIOIndex_].token)
                        ),
                        order_.validOutputs[outputIOIndex_].decimals,
                        order_.validOutputs[outputIOIndex_].vaultId,
                        vaultBalance[order_.owner][
                            order_.validOutputs[outputIOIndex_].token
                        ][order_.validOutputs[outputIOIndex_].vaultId],
                        // Don't know the balance diff yet!
                        0
                    );
            }

            // The state changes produced here are handled in _recordVaultIO so
            // that local storage writes happen before writes on the interpreter.
            StateNamespace namespace_ = StateNamespace.wrap(
                uint(uint160(order_.owner))
            );
            (uint256[] memory stack_, uint256[] memory kvs_) = order_
                .evaluable
                .interpreter
                .eval(
                    order_.evaluable.store,
                    namespace_,
                    _calculateOrderDispatch(order_.evaluable.expression),
                    context_
                );

            uint256 orderOutputMax_ = stack_[stack_.length - 2];
            uint256 orderIORatio_ = stack_[stack_.length - 1];

            // Rescale order output max from 18 FP to whatever decimals the
            // output token is using.
            // Always round order output down.
            orderOutputMax_ = orderOutputMax_.scaleN(
                order_.validOutputs[outputIOIndex_].decimals,
                Math.Rounding.Down
            );
            // Rescale the ratio from 18 FP according to the difference in
            // decimals between input and output.
            // Always round IO ratio up.
            orderIORatio_ = orderIORatio_.scaleRatio(
                order_.validOutputs[outputIOIndex_].decimals,
                order_.validInputs[inputIOIndex_].decimals,
                Math.Rounding.Up
            );

            // The order owner can't send more than the smaller of their vault
            // balance or their per-order limit.
            orderOutputMax_ = orderOutputMax_.min(
                vaultBalance[order_.owner][
                    order_.validOutputs[outputIOIndex_].token
                ][order_.validOutputs[outputIOIndex_].vaultId]
            );

            // Populate the context with the output max rescaled and vault capped
            // and the rescaled ratio.
            context_[CONTEXT_CALCULATIONS_COLUMN] = LibUint256Array.arrayFrom(
                orderOutputMax_,
                orderIORatio_
            );

            return
                OrderIOCalculation(
                    orderOutputMax_,
                    orderIORatio_,
                    context_,
                    namespace_,
                    kvs_
                );
        }
    }

    /// Given an order, final input and output amounts and the IO calculation
    /// verbatim from `_calculateOrderIO`, dispatch the handle IO entrypoint if
    /// it exists and update the order owner's vault balances.
    /// @param order_ The order that is being cleared.
    /// @param input_ The exact token input amount to move into the owner's
    /// vault.
    /// @param output_ The exact token output amount to move out of the owner's
    /// vault.
    /// @param orderIOCalculation_ The verbatim order IO calculation returned by
    /// `_calculateOrderIO`.
    function _recordVaultIO(
        Order memory order_,
        uint256 input_,
        uint256 output_,
        OrderIOCalculation memory orderIOCalculation_
    ) internal virtual {
        orderIOCalculation_.context[CONTEXT_VAULT_INPUTS_COLUMN][
            CONTEXT_VAULT_IO_BALANCE_DIFF
        ] = input_;
        orderIOCalculation_.context[CONTEXT_VAULT_OUTPUTS_COLUMN][
            CONTEXT_VAULT_IO_BALANCE_DIFF
        ] = output_;

        if (input_ > 0) {
            // IMPORTANT! THIS MATH MUST BE CHECKED TO AVOID OVERFLOW.
            vaultBalance[order_.owner][
                address(
                    uint160(
                        orderIOCalculation_.context[
                            CONTEXT_VAULT_INPUTS_COLUMN
                        ][CONTEXT_VAULT_IO_TOKEN]
                    )
                )
            ][
                orderIOCalculation_.context[CONTEXT_VAULT_INPUTS_COLUMN][
                    CONTEXT_VAULT_IO_VAULT_ID
                ]
            ] += input_;
        }
        if (output_ > 0) {
            // IMPORTANT! THIS MATH MUST BE CHECKED TO AVOID UNDERFLOW.
            vaultBalance[order_.owner][
                address(
                    uint160(
                        orderIOCalculation_.context[
                            CONTEXT_VAULT_OUTPUTS_COLUMN
                        ][CONTEXT_VAULT_IO_TOKEN]
                    )
                )
            ][
                orderIOCalculation_.context[CONTEXT_VAULT_OUTPUTS_COLUMN][
                    CONTEXT_VAULT_IO_VAULT_ID
                ]
            ] -= output_;
        }

        // Emit the context only once in its fully populated form rather than two
        // nearly identical emissions of a partial and full context.
        emit Context(msg.sender, orderIOCalculation_.context);

        // Apply state changes to the interpreter store after the vault balances
        // are updated, but before we call handle IO. We want handle IO to see
        // a consistent view on sets from calculate IO.
        if (orderIOCalculation_.kvs.length > 0) {
            order_.evaluable.store.set(
                orderIOCalculation_.namespace,
                orderIOCalculation_.kvs
            );
        }

        // Only dispatch handle IO entrypoint if it is defined, otherwise it is
        // a waste of gas to hit the interpreter a second time.
        if (order_.handleIO) {
            // The handle IO eval is run under the same namespace as the
            // calculate order entrypoint.
            (, uint256[] memory handleIOKVs_) = order_
                .evaluable
                .interpreter
                .eval(
                    order_.evaluable.store,
                    orderIOCalculation_.namespace,
                    _handleIODispatch(order_.evaluable.expression),
                    orderIOCalculation_.context
                );
            // Apply state changes to the interpreter store from the handle IO
            // entrypoint.
            if (handleIOKVs_.length > 0) {
                order_.evaluable.store.set(
                    orderIOCalculation_.namespace,
                    handleIOKVs_
                );
            }
        }
    }
}
