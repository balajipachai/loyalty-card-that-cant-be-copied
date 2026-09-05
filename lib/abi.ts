/**
 * ABI for LoyaltyCard.sol (contracts/src/LoyaltyCard.sol), copied from
 * contracts/out/LoyaltyCard.sol/LoyaltyCard.json after `forge build`.
 */
export const loyaltyCardAbi = [
  {
    type: "constructor",
    inputs: [{ name: "initialOwner", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "stampsForFreeCake",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "awardStamp",
    inputs: [{ name: "customer", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "customer", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "freeCakesEarned",
    inputs: [{ name: "customer", type: "address", internalType: "address" }],
    outputs: [{ name: "cakes", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "FreeCakeEarned",
    inputs: [
      { name: "customer", type: "address", indexed: true, internalType: "address" },
      { name: "totalCakesEarned", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "StampAwarded",
    inputs: [
      { name: "customer", type: "address", indexed: true, internalType: "address" },
      { name: "newStampCount", type: "uint8", indexed: false, internalType: "uint8" },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "OwnableInvalidOwner",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
  },
  { type: "error", name: "ZeroAddressCustomer", inputs: [] },
] as const;
