// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title LoyaltyCard
/// @notice On-chain punch card for a bakery loyalty program. One stamp per purchase,
/// `stampsForFreeCake` stamps (10 by default, owner-adjustable) redeem automatically
/// for a free cake. The only writer is the backend signer (the contract owner), which
/// only calls in after it has verified the requesting customer's Privy access token
/// off-chain — the contract itself has no notion of "who is asking", it only trusts
/// whoever holds the owner key.
/// @dev Ownable2Step so a typo'd or unreachable `transferOwnership` target can't
/// strand the backend-signer role - the new owner must call `acceptOwnership()`.
contract LoyaltyCard is Ownable2Step {
    /// @notice Stamps required before a free cake is earned and the counter resets.
    /// Owner-adjustable via `setStampsForFreeCake`; starts at 10.
    uint8 public stampsForFreeCake = 10;

    /// @notice Current stamp count for a customer, in [0, stampsForFreeCake).
    mapping(address customer => uint8 stamps) public stampsOf;

    /// @notice Lifetime count of free cakes a customer has earned.
    mapping(address customer => uint256 cakes) public freeCakesEarned;

    event StampAwarded(address indexed customer, uint8 newStampCount);
    event FreeCakeEarned(address indexed customer, uint256 totalCakesEarned);
    event StampsForFreeCakeUpdated(uint8 previousValue, uint8 newValue);

    error ZeroAddressCustomer();
    error InvalidStampsForFreeCake();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Awards one stamp to `customer`. Reaching `stampsForFreeCake` stamps
    /// immediately redeems them for a free cake and resets the count to zero.
    /// @dev Owner-only: the backend calls this only after verifying the customer's
    /// Privy access token server-side, so `customer` here is a value the caller
    /// already trusts, not user input taken at face value.
    function awardStamp(address customer) external onlyOwner {
        if (customer == address(0)) revert ZeroAddressCustomer();

        uint8 newCount = stampsOf[customer] + 1;

        // >= rather than == so lowering stampsForFreeCake below a customer's
        // in-progress count still redeems on their very next stamp, instead
        // of stranding them past a threshold they can no longer hit exactly.
        if (newCount >= stampsForFreeCake) {
            stampsOf[customer] = 0;
            uint256 totalCakes = freeCakesEarned[customer] + 1;
            freeCakesEarned[customer] = totalCakes;
            emit StampAwarded(customer, newCount);
            emit FreeCakeEarned(customer, totalCakes);
        } else {
            stampsOf[customer] = newCount;
            emit StampAwarded(customer, newCount);
        }
    }

    /// @notice Changes how many stamps redeem a free cake. Owner-only.
    function setStampsForFreeCake(uint8 newStampsForFreeCake) external onlyOwner {
        if (newStampsForFreeCake == 0) revert InvalidStampsForFreeCake();
        emit StampsForFreeCakeUpdated(stampsForFreeCake, newStampsForFreeCake);
        stampsForFreeCake = newStampsForFreeCake;
    }

    /// @notice Current stamp count for `customer`.
    function balanceOf(address customer) external view returns (uint8) {
        return stampsOf[customer];
    }
}
